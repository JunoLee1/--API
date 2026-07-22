import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchLineupService } from "../../src/match/match.lineup.service";

const mockRepo = {
  findByMatch: jest.fn(),
  findMatchInfo: jest.fn(),
  findSquadPlayers: jest.fn(),
  findActiveInjuredPlayerIds: jest.fn<() => Promise<{ playerId: string }[]>>().mockResolvedValue([]),
  saveLineup: jest.fn(),
  confirmLineup: jest.fn(),
  findSlotsWithUsers: jest.fn(),
} as any;

const service = new MatchLineupService(mockRepo);

describe("MatchLineupService - IL 선수 라인업 차단", () => {
  beforeEach(() => jest.clearAllMocks());

  test("부상 중인 선수가 포함되면 409 INJURED_PLAYER_IN_LINEUP", async () => {
    mockRepo.findActiveInjuredPlayerIds.mockResolvedValue([{ playerId: "player-1" }]);

    await expect(
      service.saveLineup(1, {
        formation: "4-3-3",
        slots: [{ playerId: "player-1", slotKey: "ST", isStarter: true }],
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "INJURED_PLAYER_IN_LINEUP" });

    expect(mockRepo.saveLineup).not.toHaveBeenCalled();
  });

  test("부상 선수 없으면 정상 저장", async () => {
    mockRepo.findActiveInjuredPlayerIds.mockResolvedValue([]);
    mockRepo.saveLineup.mockResolvedValue({ id: 1, slots: [] });

    await service.saveLineup(1, {
      formation: "4-3-3",
      slots: [{ playerId: "player-2", slotKey: "ST", isStarter: true }],
    });

    expect(mockRepo.saveLineup).toHaveBeenCalledTimes(1);
  });
});
