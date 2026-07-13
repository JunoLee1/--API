import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { EquipmentService } from "../../src/equipment/equipment.service";

const mockEquipmentRepo = {
  findAllItems: jest.fn(),
  findItemById: jest.fn(),
  createItem: jest.fn(),
  adjustQuantity: jest.fn(),
  createUnit: jest.fn(),
  findUnitById: jest.fn(),
  updateUnitStatus: jest.fn(),
  createAssignment: jest.fn(),
  findUnreturnedByPlayer: jest.fn(),
  findAssignmentById: jest.fn(),
  markReturned: jest.fn(),
  findEquipmentManagers: jest.fn<() => Promise<{ id: number }[]>>().mockResolvedValue([{ id: 10 }]),
} as any;

const mockNotificationRepo = {
  create: jest.fn(),
} as any;

const service = new EquipmentService(mockEquipmentRepo, mockNotificationRepo);

describe("EquipmentService - adjustQuantity", () => {
  beforeEach(() => jest.clearAllMocks());

  test("fires EQUIPMENT_LOW_STOCK notification when quantity drops to threshold", async () => {
    mockEquipmentRepo.findItemById.mockResolvedValue({
      id: 1,
      name: "Training Balls",
      trackedIndividually: false,
      quantity: 5,
      lowStockThreshold: 5,
    });
    mockEquipmentRepo.adjustQuantity.mockResolvedValue({ id: 1, quantity: 5 });

    await service.adjustQuantity(1, { delta: 0 });

    expect(mockNotificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "EQUIPMENT_LOW_STOCK", userId: 10 }),
    );
  });

  test("does NOT fire notification when quantity stays above threshold", async () => {
    mockEquipmentRepo.findItemById.mockResolvedValue({
      id: 2,
      name: "Cones",
      trackedIndividually: false,
      quantity: 20,
      lowStockThreshold: 5,
    });
    mockEquipmentRepo.adjustQuantity.mockResolvedValue({ id: 2, quantity: 20 });

    await service.adjustQuantity(2, { delta: 0 });

    expect(mockNotificationRepo.create).not.toHaveBeenCalled();
  });

  test("does NOT fire notification when item has no threshold set", async () => {
    mockEquipmentRepo.findItemById.mockResolvedValue({
      id: 3,
      name: "Bibs",
      trackedIndividually: false,
      quantity: 2,
      lowStockThreshold: null,
    });
    mockEquipmentRepo.adjustQuantity.mockResolvedValue({ id: 3, quantity: 2 });

    await service.adjustQuantity(3, { delta: -1 });

    expect(mockNotificationRepo.create).not.toHaveBeenCalled();
  });

  test("throws 400 when quantity would go below zero", async () => {
    mockEquipmentRepo.findItemById.mockResolvedValue({
      id: 4,
      name: "Shorts",
      trackedIndividually: false,
      quantity: 2,
      lowStockThreshold: null,
    });

    await expect(service.adjustQuantity(4, { delta: -5 })).rejects.toMatchObject({
      statusCode: 400,
      code: "QUANTITY_BELOW_ZERO",
    });
  });

  test("throws 400 when item is tracked individually", async () => {
    mockEquipmentRepo.findItemById.mockResolvedValue({
      id: 5,
      name: "GPS Vest",
      trackedIndividually: true,
      quantity: null,
      lowStockThreshold: null,
    });

    await expect(service.adjustQuantity(5, { delta: 1 })).rejects.toMatchObject({
      statusCode: 400,
      code: "ITEM_IS_TRACKED_INDIVIDUALLY",
    });
  });
});

describe("EquipmentService - transitionUnitStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  test("AVAILABLE → IN_USE is valid", async () => {
    mockEquipmentRepo.findUnitById.mockResolvedValue({ id: 1, status: "AVAILABLE", equipmentItemId: 1 });
    mockEquipmentRepo.updateUnitStatus.mockResolvedValue({ id: 1, status: "IN_USE", equipmentItemId: 1 });

    const result = await service.transitionUnitStatus(1, { status: "IN_USE" });

    expect(result.status).toBe("IN_USE");
  });

  test("RETIRED → AVAILABLE is invalid → 409", async () => {
    mockEquipmentRepo.findUnitById.mockResolvedValue({ id: 2, status: "RETIRED", equipmentItemId: 1 });

    await expect(service.transitionUnitStatus(2, { status: "AVAILABLE" })).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_STATUS_TRANSITION",
    });
  });

  test("MAINTENANCE → RETIRED is valid", async () => {
    mockEquipmentRepo.findUnitById.mockResolvedValue({ id: 3, status: "MAINTENANCE", equipmentItemId: 1 });
    mockEquipmentRepo.updateUnitStatus.mockResolvedValue({ id: 3, status: "RETIRED", equipmentItemId: 1 });

    const result = await service.transitionUnitStatus(3, { status: "RETIRED" });

    expect(result.status).toBe("RETIRED");
  });
});

describe("EquipmentService - returnAssignment", () => {
  beforeEach(() => jest.clearAllMocks());

  test("marks assignment returned", async () => {
    const now = new Date();
    mockEquipmentRepo.findAssignmentById.mockResolvedValue({ id: 1, returnedAt: null, playerId: "p1", equipmentItemId: 1, equipmentUnitId: null });
    mockEquipmentRepo.markReturned.mockResolvedValue({ id: 1, returnedAt: now, playerId: "p1", equipmentItemId: 1, equipmentUnitId: null });

    const result = await service.returnAssignment(1);

    expect(result.returnedAt).toBeDefined();
  });

  test("throws 409 when already returned", async () => {
    mockEquipmentRepo.findAssignmentById.mockResolvedValue({
      id: 2,
      returnedAt: new Date("2026-01-01"),
      playerId: "p1",
      equipmentItemId: 1,
      equipmentUnitId: null,
    });

    await expect(service.returnAssignment(2)).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_RETURNED",
    });
  });
});
