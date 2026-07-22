import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { PlayerService } from "../../src/player/player.service";

const mockRepo = {
  findById: jest.fn(),
  getPositionDiversity: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findMatchStats: jest.fn(),
  findTrainingResults: jest.fn(),
} as any;

const service = new PlayerService(mockRepo);

describe("PlayerService - getPositionDiversity", () => {
  beforeEach(() => jest.clearAllMocks());

  test("YOUTH 선수의 포지션 다양성 집계를 반환한다", async () => {
    mockRepo.findById.mockResolvedValue({ id: "player-1", team: { type: "YOUTH" } });
    mockRepo.getPositionDiversity.mockResolvedValue([
      { position: "ST", totalMinutes: 180 },
      { position: "LW", totalMinutes: 60 },
    ]);
    const result = await service.getPositionDiversity("player-1");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ position: "ST", minutes: 180, percentage: 75 });
    expect(result[1]).toMatchObject({ position: "LW", minutes: 60, percentage: 25 });
  });

  test("FIRST_TEAM 선수는 빈 배열 반환", async () => {
    mockRepo.findById.mockResolvedValue({ id: "player-2", team: { type: "FIRST_TEAM" } });
    const result = await service.getPositionDiversity("player-2");
    expect(result).toEqual([]);
    expect(mockRepo.getPositionDiversity).not.toHaveBeenCalled();
  });

  test("선수가 없으면 404", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getPositionDiversity("nonexistent")).rejects.toMatchObject({
      statusCode: 404,
      code: "PLAYER_NOT_FOUND",
    });
  });

  test("출전 기록 없으면 빈 배열", async () => {
    mockRepo.findById.mockResolvedValue({ id: "player-3", team: { type: "YOUTH" } });
    mockRepo.getPositionDiversity.mockResolvedValue([]);
    const result = await service.getPositionDiversity("player-3");
    expect(result).toEqual([]);
  });
});
