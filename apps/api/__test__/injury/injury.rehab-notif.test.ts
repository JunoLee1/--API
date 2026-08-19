import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { InjuryService } from "../../src/injury/injury.service";

const baseRepo = {
  findById: jest.fn(),
  updateStatus: jest.fn(),
  getReport: jest.fn(),
  upsertReport: jest.fn(),
} as any;
const mockNotifRepo = {
  createForPhysicalCoach: jest.fn().mockResolvedValue(undefined),
  createForHeadCoach: jest.fn().mockResolvedValue(undefined),
  createForCoachingStaff: jest.fn().mockResolvedValue(undefined),
} as any;

describe("InjuryService — BH7 rehab notifications", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(baseRepo, mockNotifRepo);
    baseRepo.findById.mockResolvedValue({ id: 1, playerId: "p1", status: "DIAGNOSED", player: { playerName: "김민준" } });
    baseRepo.updateStatus.mockResolvedValue({ id: 1, status: "REHABILITATING" });
  });

  test("updateStatus → REHABILITATING 시 PHYSICAL_COACH + HEAD_COACH 알림", async () => {
    baseRepo.getReport.mockResolvedValue(null);
    await service.updateStatus(1, { status: "REHABILITATING" }, 2, { role: "ADMIN", coachingRole: null });
    expect(mockNotifRepo.createForPhysicalCoach).toHaveBeenCalledWith(
      "INJURY_REHABILITATING_STARTED",
      expect.any(Function),
      1
    );
    expect(mockNotifRepo.createForHeadCoach).toHaveBeenCalledWith(
      "INJURY_REHABILITATING_STARTED",
      expect.any(Function),
      1
    );
  });

  test("REHABILITATING 외 상태 전환 시 INJURY_REHABILITATING_STARTED 알림 없음", async () => {
    baseRepo.updateStatus.mockResolvedValue({ id: 1, status: "READY_TO_RETURN" });
    baseRepo.findById.mockResolvedValue({ id: 1, playerId: "p1", status: "REHABILITATING", player: { playerName: "김민준" } });
    await service.updateStatus(1, { status: "READY_TO_RETURN" }, 2, { role: "ADMIN", coachingRole: null });
    expect(mockNotifRepo.createForPhysicalCoach).not.toHaveBeenCalledWith(
      "INJURY_REHABILITATING_STARTED",
      expect.any(Function),
      expect.anything()
    );
  });

  test("saveReport에서 rehabLoadPercentage 변경 시 PHYSICAL_COACH + HEAD_COACH 알림", async () => {
    baseRepo.findById.mockResolvedValue({ id: 1, playerId: "p1", status: "REHABILITATING", player: { playerName: "김민준" } });
    baseRepo.getReport.mockResolvedValue({ rehabLoadPercentage: 40, allowedActivities: null });
    baseRepo.upsertReport.mockResolvedValue({ id: 1, rehabLoadPercentage: 70, allowedActivities: null, matchAvailable: false, medicalSignedAt: null });
    await service.saveReport(1, { rehabLoadPercentage: 70 } as any, 2, { role: "ADMIN", coachingRole: null });
    expect(mockNotifRepo.createForPhysicalCoach).toHaveBeenCalledWith(
      "INJURY_REPORT_UPDATED",
      expect.any(Function),
      1
    );
    expect(mockNotifRepo.createForHeadCoach).toHaveBeenCalledWith(
      "INJURY_REPORT_UPDATED",
      expect.any(Function),
      1
    );
  });

  test("saveReport에서 재활 무관 필드(matchAvailable)만 변경 시 알림 없음", async () => {
    baseRepo.findById.mockResolvedValue({ id: 1, playerId: "p1", status: "REHABILITATING", player: { playerName: "김민준" } });
    baseRepo.getReport.mockResolvedValue({ rehabLoadPercentage: 60, allowedActivities: null });
    baseRepo.upsertReport.mockResolvedValue({ id: 1, rehabLoadPercentage: 60, allowedActivities: null, matchAvailable: true, medicalSignedAt: null });
    await service.saveReport(1, { matchAvailable: true } as any, 2, { role: "ADMIN", coachingRole: null });
    expect(mockNotifRepo.createForPhysicalCoach).not.toHaveBeenCalledWith(
      "INJURY_REPORT_UPDATED",
      expect.any(Function),
      expect.anything()
    );
  });
});
