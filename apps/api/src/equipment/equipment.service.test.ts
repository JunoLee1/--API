import { EquipmentService } from "./equipment.service";
import { AppError } from "../lib/appError";
import type { EquipmentRepository } from "./equipment.repo";

const makeRepo = (overrides: any = {}): any => ({
  findUnitWithDepreciation: jest.fn().mockResolvedValue(null),
  updateUnitDepreciation: jest.fn().mockResolvedValue({}),
  ...overrides,
} as unknown as EquipmentRepository);

describe("EquipmentService.calculateAndSaveDepreciation", () => {
  it("computes declining balance correctly", async () => {
    const updateUnitDepreciation = jest.fn().mockResolvedValue({});
    const repo = makeRepo({
      findUnitWithDepreciation: jest.fn().mockResolvedValue({
        id: 1, purchaseValue: 1000, bookValue: 1000, depreciationRate: 0.2,
        depreciationMethod: "DECLINING_BALANCE", purchasedAt: new Date(),
      }),
      updateUnitDepreciation,
    });
    const service = new EquipmentService(repo, undefined as any);
    await service.calculateAndSaveDepreciation(1);
    // 1000 * (1 - 0.2) = 800
    expect(updateUnitDepreciation).toHaveBeenCalledWith(1, 800);
  });

  it("computes straight line correctly", async () => {
    const updateUnitDepreciation = jest.fn().mockResolvedValue({});
    const purchasedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // ~1 month ago
    const repo = makeRepo({
      findUnitWithDepreciation: jest.fn().mockResolvedValue({
        id: 1, purchaseValue: 1000, bookValue: 1000, depreciationRate: 0.1,
        depreciationMethod: "STRAIGHT_LINE", purchasedAt,
      }),
      updateUnitDepreciation,
    });
    const service = new EquipmentService(repo, undefined as any);
    await service.calculateAndSaveDepreciation(1);
    // 1000 - (1000 * 0.1) * 1 month = 900
    expect(updateUnitDepreciation).toHaveBeenCalledWith(1, 900);
  });

  it("throws 400 when newBookValue would go negative", async () => {
    const repo = makeRepo({
      findUnitWithDepreciation: jest.fn().mockResolvedValue({
        id: 1, purchaseValue: 1000, bookValue: 100, depreciationRate: 0.5,
        depreciationMethod: "STRAIGHT_LINE",
        purchasedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 12 months
      }),
    });
    const service = new EquipmentService(repo, undefined as any);
    await expect(service.calculateAndSaveDepreciation(1))
      .rejects.toThrow(new AppError(400, "NEGATIVE_BOOK_VALUE"));
  });
});
