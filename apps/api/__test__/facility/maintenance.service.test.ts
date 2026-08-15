import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { MaintenanceService } from "../../src/facility/maintenance/maintenance.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
} as any;

const mockNotificationService = {
  notifyFacilityEmergency: jest.fn().mockResolvedValue(undefined),
  notifyFacilityResolved: jest.fn().mockResolvedValue(undefined),
} as any;

const service = new MaintenanceService(mockRepo, mockNotificationService, undefined as any, undefined as any);
const userId = 1;

beforeEach(() => jest.clearAllMocks());

describe("MaintenanceService", () => {
  test("EMERGENCY priority로 생성 시 notifyFacilityEmergency를 호출한다", async () => {
    const created = { id: 5, title: "펌프 고장", priority: "EMERGENCY" };
    mockRepo.create.mockResolvedValue(created);

    await service.create({ title: "펌프 고장", description: "고장", priority: "EMERGENCY" }, userId);

    expect(mockNotificationService.notifyFacilityEmergency).toHaveBeenCalledWith("펌프 고장", 5);
  });

  test("NORMAL priority로 생성 시 알림을 발송하지 않는다", async () => {
    mockRepo.create.mockResolvedValue({ id: 6, title: "청소", priority: "NORMAL" });

    await service.create({ title: "청소", description: "청소 필요", priority: "NORMAL" }, userId);

    expect(mockNotificationService.notifyFacilityEmergency).not.toHaveBeenCalled();
  });

  test("status=IN_PROGRESS 업데이트 시 repo.update를 호출한다", async () => {
    const existing = { id: 7, status: "OPEN", title: "배수관 교체" };
    mockRepo.findById.mockResolvedValue(existing);
    mockRepo.update.mockResolvedValue({ ...existing, status: "IN_PROGRESS" });

    await service.update(7, { status: "IN_PROGRESS" }, 1);

    expect(mockRepo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      status: "IN_PROGRESS",
    }));
    expect(mockNotificationService.notifyFacilityResolved).not.toHaveBeenCalled();
  });

  test("이미 RESOLVED인 항목 업데이트 시 409를 던진다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 8, status: "RESOLVED" });

    await expect(service.update(8, { status: "IN_PROGRESS" })).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_RESOLVED",
    });
  });

  test("존재하지 않는 ID 조회 시 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.get(99)).rejects.toMatchObject({
      statusCode: 404,
      code: "MAINTENANCE_REQUEST_NOT_FOUND",
    });
  });
});
