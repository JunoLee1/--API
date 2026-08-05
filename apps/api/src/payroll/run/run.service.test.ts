import { RunService } from "./run.service";
import { AppError } from "../../lib/appError";
import type { RunRepository } from "./run.repo";

const makeRepo = (overrides: Partial<RunRepository> = {}): RunRepository => ({
  findById: jest.fn().mockResolvedValue(null),
  secondApprove: jest.fn().mockResolvedValue({ id: 1, isLocked: true }),
  ...overrides,
} as unknown as RunRepository);

describe("RunService.secondApproveRun", () => {
  it("throws 404 when run is not found", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new RunService(repo, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(404, "PAYROLL_RUN_NOT_FOUND"));
  });

  it("throws 400 when run is already locked", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, staffSalaryId: 10, status: "CONFIRMED", isLocked: true }),
    });
    const service = new RunService(repo, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(400, "PAYROLL_RUN_ALREADY_LOCKED"));
  });

  it("throws 400 when status is not CONFIRMED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, staffSalaryId: 10, status: "DRAFT", isLocked: false }),
    });
    const service = new RunService(repo, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(400, "PAYROLL_RUN_NOT_CONFIRMED"));
  });

  it("succeeds and locks the run", async () => {
    const secondApprove = jest.fn().mockResolvedValue({ id: 1, isLocked: true, secondApprovedById: 99 });
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, staffSalaryId: 10, status: "CONFIRMED", isLocked: false }),
      secondApprove,
    });
    const service = new RunService(repo, undefined as any, undefined as any);
    const result = await service.secondApproveRun(10, 1, 99);
    expect(secondApprove).toHaveBeenCalledWith(1, 99);
    expect(result.isLocked).toBe(true);
  });
});
