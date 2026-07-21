import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchSquadService } from "../../src/match/match.squad.service";

const mockRepo = {
  findByMatch: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  addPlayer: jest.fn<() => Promise<any>>(),
  removePlayer: jest.fn<() => Promise<any>>(),
  confirmSquad: jest.fn<() => Promise<any>>(),
  findConfirmedWithPlayers: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
} as any;

const service = new MatchSquadService(mockRepo);

describe("MatchSquadService - addPlayer", () => {
  beforeEach(() => jest.clearAllMocks());

  test("선수 추가 성공", async () => {
    mockRepo.addPlayer.mockResolvedValue({ id: 1, matchId: 10, playerId: "p1" });
    const result = await service.addPlayer(10, "p1");
    expect(mockRepo.addPlayer).toHaveBeenCalledWith(10, "p1");
    expect(result.matchId).toBe(10);
  });
});

describe("MatchSquadService - confirmSquad", () => {
  beforeEach(() => jest.clearAllMocks());

  test("스쿼드 확정 호출", async () => {
    mockRepo.confirmSquad.mockResolvedValue({ count: 3 });
    const result = await service.confirmSquad(10, 5);
    expect(mockRepo.confirmSquad).toHaveBeenCalledWith(10, 5);
    expect(result.count).toBe(3);
  });
});
