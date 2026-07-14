import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { DashboardService } from "../../src/dashboard/dashboard.service";

const mockRepo = {
  getAdminStats: jest.fn(),
  getGmStats: jest.fn(),
  getTdStats: jest.fn(),
  getContractManagerStats: jest.fn(),
  getScoutStats: jest.fn(),
  getEquipmentManagerStats: jest.fn(),
  getTacticalAnalystStats: jest.fn(),
  getHeadCoachStats: jest.fn(),
  getSpecialistCoachStats: jest.fn(),
  getPhysicalCoachStats: jest.fn(),
  getMedicalStats: jest.fn(),
  getMedicalDirectorStats: jest.fn(),
  getPlayerStats: jest.fn(),
  getAgentStats: jest.fn(),
} as any;

const service = new DashboardService(mockRepo);

describe("DashboardService.getStats", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ADMIN → getAdminStats 호출", async () => {
    mockRepo.getAdminStats.mockResolvedValue({ activePlayerCount: 30 });
    const result = await service.getStats({ id: 1, role: "ADMIN", coachingRole: null, frontOfficeRole: null });
    expect(mockRepo.getAdminStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ activePlayerCount: 30 });
  });

  test("FRONT_OFFICE + GM → getGmStats 호출", async () => {
    mockRepo.getGmStats.mockResolvedValue({ expiringContractCount: 2 });
    const result = await service.getStats({ id: 2, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "GM" });
    expect(mockRepo.getGmStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ expiringContractCount: 2 });
  });

  test("FRONT_OFFICE + TD → getTdStats 호출", async () => {
    mockRepo.getTdStats.mockResolvedValue({ prospectCount: 5 });
    await service.getStats({ id: 3, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "TD" });
    expect(mockRepo.getTdStats).toHaveBeenCalledTimes(1);
  });

  test("FRONT_OFFICE + CONTRACT_MANAGER → getContractManagerStats 호출", async () => {
    mockRepo.getContractManagerStats.mockResolvedValue({ expiringContractCount: 1 });
    await service.getStats({ id: 4, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "CONTRACT_MANAGER" });
    expect(mockRepo.getContractManagerStats).toHaveBeenCalledTimes(1);
  });

  test("FRONT_OFFICE + SCOUT → getScoutStats 호출", async () => {
    mockRepo.getScoutStats.mockResolvedValue({ prospectCount: 10 });
    await service.getStats({ id: 5, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "SCOUT" });
    expect(mockRepo.getScoutStats).toHaveBeenCalledTimes(1);
  });

  test("FRONT_OFFICE + EQUIPMENT_MANAGER → getEquipmentManagerStats 호출", async () => {
    mockRepo.getEquipmentManagerStats.mockResolvedValue({ lowStockEquipmentCount: 3 });
    const result = await service.getStats({ id: 6, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "EQUIPMENT_MANAGER" });
    expect(mockRepo.getEquipmentManagerStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ lowStockEquipmentCount: 3 });
  });

  test("FRONT_OFFICE + TACTICAL_ANALYST → getTacticalAnalystStats(userId) 호출", async () => {
    mockRepo.getTacticalAnalystStats.mockResolvedValue({ myDraftAnalysisCount: 2 });
    await service.getStats({ id: 7, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "TACTICAL_ANALYST" });
    expect(mockRepo.getTacticalAnalystStats).toHaveBeenCalledWith(7);
  });

  test("COACHING_STAFF + HEAD_COACH → getHeadCoachStats 호출", async () => {
    mockRepo.getHeadCoachStats.mockResolvedValue({ injuredPlayerCount: 2 });
    await service.getStats({ id: 8, role: "COACHING_STAFF", coachingRole: "HEAD_COACH", frontOfficeRole: null });
    expect(mockRepo.getHeadCoachStats).toHaveBeenCalledTimes(1);
  });

  test("COACHING_STAFF + ASSISTANT_COACH → getHeadCoachStats 호출 (동일 대시보드)", async () => {
    mockRepo.getHeadCoachStats.mockResolvedValue({ injuredPlayerCount: 2 });
    await service.getStats({ id: 9, role: "COACHING_STAFF", coachingRole: "ASSISTANT_COACH", frontOfficeRole: null });
    expect(mockRepo.getHeadCoachStats).toHaveBeenCalledTimes(1);
  });

  test("COACHING_STAFF + DEFENSIVE_COACH → getSpecialistCoachStats(coachingRole, userId) 호출", async () => {
    mockRepo.getSpecialistCoachStats.mockResolvedValue({ assignedPlayerCount: 8 });
    await service.getStats({ id: 10, role: "COACHING_STAFF", coachingRole: "DEFENSIVE_COACH", frontOfficeRole: null });
    expect(mockRepo.getSpecialistCoachStats).toHaveBeenCalledWith("DEFENSIVE_COACH", 10);
  });

  test("COACHING_STAFF + PHYSICAL_COACH → getPhysicalCoachStats(userId) 호출", async () => {
    mockRepo.getPhysicalCoachStats.mockResolvedValue({ assignedPlayerCount: 25 });
    await service.getStats({ id: 11, role: "COACHING_STAFF", coachingRole: "PHYSICAL_COACH", frontOfficeRole: null });
    expect(mockRepo.getPhysicalCoachStats).toHaveBeenCalledWith(11);
  });

  test("COACHING_STAFF + MEDICAL → getMedicalStats(userId) 호출", async () => {
    mockRepo.getMedicalStats.mockResolvedValue({ myActiveInjuryCaseCount: 3 });
    await service.getStats({ id: 12, role: "COACHING_STAFF", coachingRole: "MEDICAL", frontOfficeRole: null });
    expect(mockRepo.getMedicalStats).toHaveBeenCalledWith(12);
  });

  test("COACHING_STAFF + MEDICAL_DIRECTOR → getMedicalDirectorStats(userId) 호출", async () => {
    mockRepo.getMedicalDirectorStats.mockResolvedValue({ totalInjuredPlayerCount: 5 });
    await service.getStats({ id: 13, role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR", frontOfficeRole: null });
    expect(mockRepo.getMedicalDirectorStats).toHaveBeenCalledWith(13);
  });

  test("PLAYER → getPlayerStats(userId) 호출", async () => {
    mockRepo.getPlayerStats.mockResolvedValue({ thisSeasonMatchCount: 10 });
    await service.getStats({ id: 14, role: "PLAYER", coachingRole: null, frontOfficeRole: null });
    expect(mockRepo.getPlayerStats).toHaveBeenCalledWith(14);
  });

  test("AGENT → getAgentStats(userId) 호출", async () => {
    mockRepo.getAgentStats.mockResolvedValue({ managedPlayerCount: 3 });
    await service.getStats({ id: 15, role: "AGENT", coachingRole: null, frontOfficeRole: null });
    expect(mockRepo.getAgentStats).toHaveBeenCalledWith(15);
  });
});
