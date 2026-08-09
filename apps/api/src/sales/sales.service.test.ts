import { SalesService } from "./sales.service";
import { AppError } from "../lib/appError";
import type { SalesRepository } from "./sales.repo";
import type { PrismaClient } from "../generated/client";

const makeRepo = (overrides: Partial<SalesRepository> = {}): SalesRepository => ({
  create: jest.fn().mockImplementation(async (data) => ({ id: 1, ...data })),
  ...overrides,
} as unknown as SalesRepository);

const makePrisma = (overrides: Partial<PrismaClient> = {}): PrismaClient =>
  overrides as unknown as PrismaClient;

describe("SalesService.create", () => {
  it("throws 400 when quantity is negative", async () => {
    const service = new SalesService(makeRepo(), makePrisma());
    await expect(service.create({ type: "TICKET", quantity: -1, unitPrice: 100, saleDate: "2026-08-05" } as any, 1))
      .rejects.toThrow(new AppError(400, "NEGATIVE_SALES_VALUE"));
  });

  it("throws 400 when unitPrice is negative", async () => {
    const service = new SalesService(makeRepo(), makePrisma());
    await expect(service.create({ type: "TICKET", quantity: 1, unitPrice: -100, saleDate: "2026-08-05" } as any, 1))
      .rejects.toThrow(new AppError(400, "NEGATIVE_SALES_VALUE"));
  });

  it("computes totalAmount correctly for non-TICKET type", async () => {
    const txRecord = { id: 1, type: "UNIFORM", quantity: 3, unitPrice: 50000, totalAmount: 150000 };
    const mockTx = {
      salesRecord: { create: jest.fn().mockResolvedValue(txRecord) },
      ledgerEntry: { create: jest.fn() },
    };
    const prisma = makePrisma({
      $transaction: jest.fn().mockImplementation((fn) => fn(mockTx)),
    } as any);
    const service = new SalesService(makeRepo(), prisma);
    await service.create({ type: "UNIFORM", quantity: 3, unitPrice: 50000, saleDate: "2026-08-05" } as any, 1);
    expect(mockTx.salesRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalAmount: 150000 }) }),
    );
  });
});
