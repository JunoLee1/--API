import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { InspectionService } from "../../src/facility/inspection/inspection.service";

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
} as any;

const mockMaintenanceService = {
  create: jest.fn(),
} as any;

const service = new InspectionService(mockRepo, mockMaintenanceService);
const userId = 1;

beforeEach(() => jest.clearAllMocks());

describe("InspectionService", () => {
  test("result=OK 시 MaintenanceService.create를 호출하지 않는다", async () => {
    mockRepo.create.mockResolvedValue({ id: 1, facilityZone: "GROUND", result: "OK" });

    await service.create({ type: "DAILY", facilityZone: "GROUND", result: "OK" }, userId);

    expect(mockMaintenanceService.create).not.toHaveBeenCalled();
  });

  test("result=ISSUE_FOUND 시 MaintenanceService.create(EMERGENCY)를 호출한다", async () => {
    const inspection = { id: 10, facilityZone: "MECHANICAL", notes: "균열 발견", result: "ISSUE_FOUND" };
    mockRepo.create.mockResolvedValue(inspection);
    mockMaintenanceService.create.mockResolvedValue({ id: 20 });

    await service.create({ type: "MONTHLY", facilityZone: "MECHANICAL", result: "ISSUE_FOUND", notes: "균열 발견" }, userId);

    expect(mockMaintenanceService.create).toHaveBeenCalledWith(
      {
        title: "[자동] MECHANICAL 구역 점검 이상 감지",
        description: "균열 발견",
        priority: "EMERGENCY",
        sourceInspectionId: 10,
      },
      userId,
    );
  });

  test("result=ISSUE_FOUND이고 notes 없을 시 description을 빈 문자열로 한다", async () => {
    const inspection = { id: 11, facilityZone: "SAFETY", notes: null, result: "ISSUE_FOUND" };
    mockRepo.create.mockResolvedValue(inspection);
    mockMaintenanceService.create.mockResolvedValue({ id: 21 });

    await service.create({ type: "DAILY", facilityZone: "SAFETY", result: "ISSUE_FOUND" }, userId);

    expect(mockMaintenanceService.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: "" }),
      userId,
    );
  });

  test("존재하지 않는 ID 조회 시 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.get(99)).rejects.toMatchObject({
      statusCode: 404,
      code: "INSPECTION_NOT_FOUND",
    });
  });
});
