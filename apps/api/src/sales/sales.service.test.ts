import { SalesService } from "./sales.service";
import { AppError } from "../lib/appError";
import type { SalesRepository } from "./sales.repo";

const makeRepo = (overrides: Partial<SalesRepository> = {}): SalesRepository => ({
  create: jest.fn().mockImplementation(async (data) => ({ id: 1, ...data })),
  ...overrides,
} as unknown as SalesRepository);

describe("SalesService.create", () => {
  it("throws 400 when quantity is negative", async () => {
    const service = new SalesService(makeRepo());
    await expect(service.create({ type: "TICKET", quantity: -1, unitPrice: 100, saleDate: "2026-08-05" } as any, 1))
      .rejects.toThrow(new AppError(400, "NEGATIVE_SALES_VALUE"));
  });

  it("throws 400 when unitPrice is negative", async () => {
    const service = new SalesService(makeRepo());
    await expect(service.create({ type: "TICKET", quantity: 1, unitPrice: -100, saleDate: "2026-08-05" } as any, 1))
      .rejects.toThrow(new AppError(400, "NEGATIVE_SALES_VALUE"));
  });

  it("computes totalAmount correctly", async () => {
    const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
    const service = new SalesService(makeRepo({ create }));
    await service.create({ type: "TICKET", quantity: 3, unitPrice: 50000, saleDate: "2026-08-05" } as any, 1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ totalAmount: 150000 }));
  });
});
