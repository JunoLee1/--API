import { LedgerService } from "./ledger.service";
import { AppError } from "../lib/appError";
import type { LedgerRepository } from "./ledger.repo";

const makeRepo = (overrides: Partial<LedgerRepository> = {}): LedgerRepository => ({
  findById: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation(async (data) => ({ id: 1, ...data })),
  findAll: jest.fn().mockResolvedValue([]),
  ...overrides,
} as unknown as LedgerRepository);

describe("LedgerService", () => {
  it("throws 400 when amount is negative", async () => {
    const service = new LedgerService(makeRepo());
    await expect(service.create({ type: "EXPENSE", category: "OTHER", amount: -100 } as any, 1))
      .rejects.toThrow(new AppError(400, "INVALID_AMOUNT"));
  });

  it("auto-calculates amountKrw from amount * exchangeRate", async () => {
    const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
    const service = new LedgerService(makeRepo({ create }));
    await service.create({ type: "EXPENSE", category: "OTHER", amount: 100, currency: "USD", exchangeRate: 1300 } as any, 1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amountKrw: 130000 }));
  });

  it("throws 404 when original entry not found in createRefund", async () => {
    const service = new LedgerService(makeRepo({ findById: jest.fn().mockResolvedValue(null) }));
    await expect(service.createRefund(999, 1))
      .rejects.toThrow(new AppError(404, "LEDGER_ENTRY_NOT_FOUND"));
  });

  it("refund creates a negative entry", async () => {
    const create = jest.fn().mockImplementation(async (data) => ({ id: 2, ...data }));
    const service = new LedgerService(makeRepo({
      findById: jest.fn().mockResolvedValue({
        id: 1, type: "EXPENSE", category: "SALARY",
        amount: 100, currency: "KRW", exchangeRate: 1, amountKrw: 100,
        relatedModule: null, relatedId: null,
      }),
      create,
    }));
    await service.createRefund(1, 42);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      amount: -100, amountKrw: -100, isRefund: true, category: "REFUND",
    }));
  });
});
