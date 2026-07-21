import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchLineupService } from "../../src/match/match.lineup.service";

const mockRepo = {
  findByMatch: jest.fn<() => Promise<any>>(),
  saveLineup: jest.fn<() => Promise<any>>(),
  confirmLineup: jest.fn<() => Promise<any>>(),
  findSlotsWithUsers: jest.fn<() => Promise<any>>().mockResolvedValue([]),
  findMatchInfo: jest.fn<() => Promise<any>>().mockResolvedValue(null),
} as any;

const service = new MatchLineupService(mockRepo);

const validDto = {
  formation: "4-3-3",
  slots: [
    { playerId: "p1", slotKey: "GK", isStarter: true },
    { playerId: "p2", slotKey: "LB", isStarter: true },
  ],
};

describe("MatchLineupService - saveLineup", () => {
  beforeEach(() => jest.clearAllMocks());

  test("유효한 dto로 저장 성공 시 repo.saveLineup 호출", async () => {
    mockRepo.saveLineup.mockResolvedValue({ id: 1, matchId: 10, formation: "4-3-3", slots: [] });
    await service.saveLineup(10, validDto);
    expect(mockRepo.saveLineup).toHaveBeenCalledWith(10, validDto);
  });

  test("지원하지 않는 포메이션이면 400 INVALID_FORMATION", async () => {
    await expect(service.saveLineup(10, { ...validDto, formation: "3-3-3" }))
      .rejects.toMatchObject({ statusCode: 400, message: "INVALID_FORMATION" });
    expect(mockRepo.saveLineup).not.toHaveBeenCalled();
  });

  test("중복 playerId면 409 DUPLICATE_PLAYER", async () => {
    const dto = {
      formation: "4-3-3",
      slots: [
        { playerId: "p1", slotKey: "GK", isStarter: true },
        { playerId: "p1", slotKey: "LB", isStarter: true },
      ],
    };
    await expect(service.saveLineup(10, dto))
      .rejects.toMatchObject({ statusCode: 409, message: "DUPLICATE_PLAYER" });
  });

  test("중복 slotKey면 409 DUPLICATE_SLOT", async () => {
    const dto = {
      formation: "4-3-3",
      slots: [
        { playerId: "p1", slotKey: "GK", isStarter: true },
        { playerId: "p2", slotKey: "GK", isStarter: true },
      ],
    };
    await expect(service.saveLineup(10, dto))
      .rejects.toMatchObject({ statusCode: 409, message: "DUPLICATE_SLOT" });
  });
});

describe("MatchLineupService - confirmLineup", () => {
  beforeEach(() => jest.clearAllMocks());

  test("라인업 없으면 404 LINEUP_NOT_FOUND", async () => {
    mockRepo.findByMatch.mockResolvedValue(null);
    await expect(service.confirmLineup(10, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "LINEUP_NOT_FOUND" });
    expect(mockRepo.confirmLineup).not.toHaveBeenCalled();
  });

  test("라인업 있으면 confirmLineup 호출 성공", async () => {
    mockRepo.findByMatch.mockResolvedValue({ id: 1, matchId: 10 });
    mockRepo.confirmLineup.mockResolvedValue({ id: 1, isConfirmed: true });
    await service.confirmLineup(10, 5);
    expect(mockRepo.confirmLineup).toHaveBeenCalledWith(10, 5);
  });
});
