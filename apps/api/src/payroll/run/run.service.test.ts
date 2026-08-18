import { RunService } from "./run.service";
import { AppError } from "../../lib/appError";
import type { RunRepository } from "./run.repo";
import type { PrismaClient } from "../../generated/client";

const makeRepo = (overrides: Partial<RunRepository> = {}): RunRepository => ({
  findById: jest.fn().mockResolvedValue(null),
  secondApprove: jest.fn().mockResolvedValue({ id: 1, isLocked: true }),
  ...overrides,
} as unknown as RunRepository);

const makePrisma = (overrides: Partial<PrismaClient> = {}): PrismaClient =>
  overrides as unknown as PrismaClient;

describe("RunService.secondApproveRun", () => {
  it("throws 404 when run is not found", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new RunService(repo, undefined as any, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(404, "PAYROLL_RUN_NOT_FOUND"));
  });

  it("throws 400 when run is already locked", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, staffSalaryId: 10, status: "CONFIRMED", isLocked: true }),
    });
    const service = new RunService(repo, undefined as any, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(400, "PAYROLL_RUN_ALREADY_LOCKED"));
  });

  it("throws 400 when status is not CONFIRMED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, staffSalaryId: 10, status: "DRAFT", isLocked: false }),
    });
    const service = new RunService(repo, undefined as any, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(400, "PAYROLL_RUN_NOT_CONFIRMED"));
  });

  it("throws 403 when approver is the same as confirmer", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({
        id: 1, staffSalaryId: 10, status: "CONFIRMED", isLocked: false, confirmedById: 99,
      }),
    });
    const service = new RunService(repo, undefined as any, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(403, "CANNOT_SECOND_APPROVE_OWN_CONFIRMATION"));
  });

  it("atomically locks the run and creates a SALARY ledger entry with grossPay", async () => {
    const payrollUpdate = jest.fn().mockResolvedValue({
      id: 1, isLocked: true, secondApprovedById: 99, grossPay: 5_000_000,
    });
    const ledgerCreate = jest.fn().mockResolvedValue({ id: 10 });
    const mockTx = {
      payrollRun: { update: payrollUpdate },
      ledgerEntry: { create: ledgerCreate },
    };
    const prisma = makePrisma({
      $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
    } as any);
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({
        id: 1, staffSalaryId: 10, status: "CONFIRMED", isLocked: false,
        confirmedById: 5, grossPay: 5_000_000,
      }),
    });
    const service = new RunService(repo, undefined as any, undefined as any, prisma);
    const result = await service.secondApproveRun(10, 1, 99);

    expect(payrollUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({ isLocked: true, secondApprovedById: 99 }),
    }));
    expect(ledgerCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: "SALARY",
        amount: 5_000_000,
        amountKrw: 5_000_000,
        type: "EXPENSE",
      }),
    }));
    expect(result.isLocked).toBe(true);
  });
});
