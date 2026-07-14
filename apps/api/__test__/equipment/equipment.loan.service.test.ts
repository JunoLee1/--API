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
  findLoanById: jest.fn(),
  findAllLoans: jest.fn(),
  findMyLoans: jest.fn(),
  createLoan: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1, status: "REQUESTED" }),
  updateLoan: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
} as any;

const mockNotificationRepo = { create: jest.fn(), createForStaff: jest.fn() } as any;
const service = new EquipmentService(mockEquipmentRepo, mockNotificationRepo);

describe("EquipmentService - requestLoan", () => {
  beforeEach(() => jest.clearAllMocks());

  test("대여 신청 생성 후 EQUIPMENT_MANAGER에게 알림", async () => {
    mockEquipmentRepo.findItemById.mockResolvedValue({ id: 1, name: "훈련화", quantity: 5 });
    await service.requestLoan(99, { equipmentItemId: 1 });
    expect(mockEquipmentRepo.createLoan).toHaveBeenCalledWith(99, expect.objectContaining({ equipmentItemId: 1 }));
    expect(mockNotificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 10, type: "EQUIPMENT_LOAN_REQUESTED" }),
    );
  });
});

describe("EquipmentService - approveLoan / rejectLoan", () => {
  beforeEach(() => jest.clearAllMocks());

  test("REQUESTED 상태의 대여 승인", async () => {
    mockEquipmentRepo.findLoanById.mockResolvedValue({ id: 1, status: "REQUESTED", requestedBy: { id: 5 }, equipmentItem: { name: "훈련화" } });
    await service.approveLoan(1, 10);
    expect(mockEquipmentRepo.updateLoan).toHaveBeenCalledWith(1, expect.objectContaining({ status: "APPROVED", approvedById: 10 }));
  });

  test("REQUESTED가 아닌 상태에서 approveLoan 시 409", async () => {
    mockEquipmentRepo.findLoanById.mockResolvedValue({ id: 1, status: "ISSUED", requestedBy: { id: 5 }, equipmentItem: { name: "훈련화" } });
    await expect(service.approveLoan(1, 10)).rejects.toMatchObject({ code: "INVALID_LOAN_STATUS_TRANSITION" });
  });
});
