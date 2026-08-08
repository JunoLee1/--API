import { LedgerService, ALLOWED_MODULES } from "./ledger.service";
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

  it("refund creates a negative entry and marks original as reversed", async () => {
    const markReversed = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockImplementation(async (data) => ({ id: 2, ...data }));
    const service = new LedgerService(makeRepo({
      findById: jest.fn().mockResolvedValue({
        id: 1, type: "EXPENSE", category: "SALARY",
        amount: 100, currency: "KRW", exchangeRate: 1, amountKrw: 100,
        relatedModule: null, relatedId: null, reversedById: null,
      }),
      create,
      markReversed,
    }));
    await service.createRefund(1, 42);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      amount: -100, amountKrw: -100, isRefund: true, category: "REFUND",
    }));
    expect(markReversed).toHaveBeenCalledWith(1, 2);
  });

  it("throws 400 when trying to refund an already-reversed entry", async () => {
    const service = new LedgerService(makeRepo({
      findById: jest.fn().mockResolvedValue({
        id: 1, type: "EXPENSE", category: "SALARY",
        amount: 100, currency: "KRW", exchangeRate: 1, amountKrw: 100,
        relatedModule: null, relatedId: null, reversedById: 5,
      }),
    }));
    await expect(service.createRefund(1, 42))
      .rejects.toThrow(new AppError(400, "ALREADY_REVERSED"));
  });

  describe("exchange rate validation", () => {
    it("throws 400 when exchangeRate is 0", async () => {
      const service = new LedgerService(makeRepo());
      await expect(service.create({ type: "EXPENSE", category: "OTHER", amount: 100, exchangeRate: 0 } as any, 1))
        .rejects.toThrow(new AppError(400, "INVALID_EXCHANGE_RATE"));
    });

    it("throws 400 when exchangeRate is negative", async () => {
      const service = new LedgerService(makeRepo());
      await expect(service.create({ type: "EXPENSE", category: "OTHER", amount: 100, exchangeRate: -5 } as any, 1))
        .rejects.toThrow(new AppError(400, "INVALID_EXCHANGE_RATE"));
    });

    it("throws 400 when exchangeRate exceeds 10000", async () => {
      const service = new LedgerService(makeRepo());
      await expect(service.create({ type: "EXPENSE", category: "OTHER", amount: 100, exchangeRate: 10001 } as any, 1))
        .rejects.toThrow(new AppError(400, "INVALID_EXCHANGE_RATE"));
    });

    it("accepts boundary values 0.01 and 10000", async () => {
      const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
      const service = new LedgerService(makeRepo({ create }));
      await service.create({ type: "EXPENSE", category: "OTHER", amount: 100, exchangeRate: 0.01 } as any, 1);
      await service.create({ type: "EXPENSE", category: "OTHER", amount: 100, exchangeRate: 10000 } as any, 1);
      expect(create).toHaveBeenCalledTimes(2);
    });

    it("defaults to rate 1 when exchangeRate is undefined", async () => {
      const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
      const service = new LedgerService(makeRepo({ create }));
      await service.create({ type: "EXPENSE", category: "OTHER", amount: 100, currency: "KRW" } as any, 1);
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ exchangeRate: 1 }));
    });

    it("validates exchangeRate in createAutoEntry", async () => {
      const service = new LedgerService(makeRepo());
      await expect(service.createAutoEntry({ type: "EXPENSE", category: "OTHER", amount: 100, exchangeRate: -1 } as any, 1))
        .rejects.toThrow(new AppError(400, "INVALID_EXCHANGE_RATE"));
    });
  });

  describe("relatedModule validation", () => {
    it("throws 400 when relatedModule is not in whitelist", async () => {
      const service = new LedgerService(makeRepo());
      await expect(service.create({ type: "EXPENSE", category: "OTHER", amount: 100, relatedModule: "INVALID" } as any, 1))
        .rejects.toThrow(new AppError(400, "INVALID_RELATED_MODULE"));
    });

    it("accepts all whitelisted modules", async () => {
      const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
      const service = new LedgerService(makeRepo({ create }));
      for (const module of ALLOWED_MODULES) {
        await service.create({ type: "EXPENSE", category: "OTHER", amount: 100, relatedModule: module } as any, 1);
      }
      expect(create).toHaveBeenCalledTimes(ALLOWED_MODULES.length);
    });

    it("allows undefined relatedModule", async () => {
      const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
      const service = new LedgerService(makeRepo({ create }));
      await service.create({ type: "EXPENSE", category: "OTHER", amount: 100 } as any, 1);
      expect(create).toHaveBeenCalled();
    });
  });

  describe("relatedId validation", () => {
    it("throws 400 when relatedId is 0", async () => {
      const service = new LedgerService(makeRepo());
      await expect(service.create({ type: "EXPENSE", category: "OTHER", amount: 100, relatedId: 0 } as any, 1))
        .rejects.toThrow(new AppError(400, "INVALID_RELATED_ID"));
    });

    it("throws 400 when relatedId is negative", async () => {
      const service = new LedgerService(makeRepo());
      await expect(service.create({ type: "EXPENSE", category: "OTHER", amount: 100, relatedId: -5 } as any, 1))
        .rejects.toThrow(new AppError(400, "INVALID_RELATED_ID"));
    });

    it("throws 400 when relatedId is not an integer", async () => {
      const service = new LedgerService(makeRepo());
      await expect(service.create({ type: "EXPENSE", category: "OTHER", amount: 100, relatedId: 1.5 } as any, 1))
        .rejects.toThrow(new AppError(400, "INVALID_RELATED_ID"));
    });

    it("accepts positive integer relatedId", async () => {
      const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
      const service = new LedgerService(makeRepo({ create }));
      await service.create({ type: "EXPENSE", category: "OTHER", amount: 100, relatedId: 1 } as any, 1);
      expect(create).toHaveBeenCalled();
    });

    it("allows undefined relatedId", async () => {
      const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
      const service = new LedgerService(makeRepo({ create }));
      await service.create({ type: "EXPENSE", category: "OTHER", amount: 100 } as any, 1);
      expect(create).toHaveBeenCalled();
    });
  });

  describe("createAutoEntry validation", () => {
    it("validates exchangeRate but skips relatedModule/relatedId", async () => {
      const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
      const service = new LedgerService(makeRepo({ create }));
      await service.createAutoEntry({
        type: "EXPENSE", category: "OTHER", amount: 100,
        relatedModule: "INVALID", relatedId: -1,
      } as any, 1);
      expect(create).toHaveBeenCalled();
    });

    it("throws on invalid exchangeRate in createAutoEntry", async () => {
      const service = new LedgerService(makeRepo());
      await expect(service.createAutoEntry({ type: "EXPENSE", category: "OTHER", amount: 100, exchangeRate: 20000 } as any, 1))
        .rejects.toThrow(new AppError(400, "INVALID_EXCHANGE_RATE"));
    });
  });
});
