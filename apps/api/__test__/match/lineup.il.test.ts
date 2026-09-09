import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchLineupService } from "../../src/match/match.lineup.service";

const mockRepo = {
  findByMatch: jest.fn(),
  findMatchInfo: jest.fn(),
  findSquadPlayers: jest.fn(),
  findActiveInjuredPlayerIds: jest.fn<() => Promise<{ playerId: string }[]>>().mockResolvedValue([]),
  findPlayersByIds: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  saveLineup: jest.fn(),
  confirmLineup: jest.fn(),
  findSlotsWithUsers: jest.fn(),
} as any;

const service = new MatchLineupService(mockRepo);

// 11 starters (4-3-3: GK + 4 def + 3 mid + 3 fwd) + no bench
const makeValidSlots = () => [
  { playerId: "p1",  slotKey: "GK",  isStarter: true },
  { playerId: "p2",  slotKey: "LB",  isStarter: true },
  { playerId: "p3",  slotKey: "LCB", isStarter: true },
  { playerId: "p4",  slotKey: "RCB", isStarter: true },
  { playerId: "p5",  slotKey: "RB",  isStarter: true },
  { playerId: "p6",  slotKey: "LCM", isStarter: true },
  { playerId: "p7",  slotKey: "CM",  isStarter: true },
  { playerId: "p8",  slotKey: "RCM", isStarter: true },
  { playerId: "p9",  slotKey: "LW",  isStarter: true },
  { playerId: "p10", slotKey: "ST",  isStarter: true },
  { playerId: "p11", slotKey: "RW",  isStarter: true },
];

describe("MatchLineupService - IL 선수 라인업 차단", () => {
  beforeEach(() => jest.clearAllMocks());

  test("부상 중인 선수가 포함되면 409 INJURED_PLAYER_IN_LINEUP", async () => {
    const slots = makeValidSlots();
    mockRepo.findPlayersByIds.mockResolvedValue(slots.map(s => ({ id: s.playerId, status: "ACTIVE" })));
    mockRepo.findActiveInjuredPlayerIds.mockResolvedValue([{ playerId: "p1" }]);

    await expect(
      service.saveLineup(1, { formation: "4-3-3", slots }),
    ).rejects.toMatchObject({ statusCode: 409, code: "INJURED_PLAYER_IN_LINEUP" });

    expect(mockRepo.saveLineup).not.toHaveBeenCalled();
  });

  test("부상 선수 없으면 정상 저장", async () => {
    const slots = makeValidSlots();
    mockRepo.findPlayersByIds.mockResolvedValue(slots.map(s => ({ id: s.playerId, status: "ACTIVE" })));
    mockRepo.findActiveInjuredPlayerIds.mockResolvedValue([]);
    mockRepo.saveLineup.mockResolvedValue({ id: 1, slots: [] });

    await service.saveLineup(1, { formation: "4-3-3", slots });

    expect(mockRepo.saveLineup).toHaveBeenCalledTimes(1);
  });
});
