import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { DashboardService } from "../../src/dashboard/dashboard.service";

const mockRepo = {
  getYouthDevelopmentStats: jest.fn(),
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
  getMedicalDashboardStats: jest.fn(),
} as any;

const service = new DashboardService(mockRepo);

describe("DashboardService - getYouthDevelopmentStats", () => {
  beforeEach(() => jest.clearAllMocks());

  test("repo 결과를 그대로 반환한다", async () => {
    const mockResult = {
      teams: [{ teamId: 1, teamName: "U15", playerCount: 2, biasedPlayerCount: 1, players: [] }],
    };
    mockRepo.getYouthDevelopmentStats.mockResolvedValue(mockResult);

    const result = await service.getYouthDevelopmentStats();

    expect(result).toEqual(mockResult);
    expect(mockRepo.getYouthDevelopmentStats).toHaveBeenCalledTimes(1);
  });

  test("repo 에러가 전파된다", async () => {
    mockRepo.getYouthDevelopmentStats.mockRejectedValue(new Error("DB error"));
    await expect(service.getYouthDevelopmentStats()).rejects.toThrow("DB error");
  });
});
