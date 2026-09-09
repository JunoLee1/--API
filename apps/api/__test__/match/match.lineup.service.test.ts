import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchLineupService } from "../../src/match/match.lineup.service";

const mockRepo = {
  findByMatch: jest.fn<() => Promise<any>>(),
  saveLineup: jest.fn<() => Promise<any>>(),
  confirmLineup: jest.fn<() => Promise<any>>(),
  findSlotsWithUsers: jest.fn<() => Promise<any>>().mockResolvedValue([]),
  findMatchInfo: jest.fn<() => Promise<any>>().mockResolvedValue(null),
  findActiveInjuredPlayerIds: jest.fn<() => Promise<any>>().mockResolvedValue([]),
  findPlayersByIds: jest.fn<() => Promise<any>>().mockResolvedValue([]),
} as any;

const service = new MatchLineupService(mockRepo);

const makeSlots = () => [
  { playerId: "p1",  slotKey: "GK",   isStarter: true },
  { playerId: "p2",  slotKey: "LB",   isStarter: true },
  { playerId: "p3",  slotKey: "LCB",  isStarter: true },
  { playerId: "p4",  slotKey: "RCB",  isStarter: true },
  { playerId: "p5",  slotKey: "RB",   isStarter: true },
  { playerId: "p6",  slotKey: "LCM",  isStarter: true },
  { playerId: "p7",  slotKey: "CM",   isStarter: true },
  { playerId: "p8",  slotKey: "RCM",  isStarter: true },
  { playerId: "p9",  slotKey: "LW",   isStarter: true },
  { playerId: "p10", slotKey: "ST",   isStarter: true },
  { playerId: "p11", slotKey: "RW",   isStarter: true },
  { playerId: "p12", slotKey: "B1",   isStarter: false },
  { playerId: "p13", slotKey: "B2",   isStarter: false },
  { playerId: "p14", slotKey: "B3",   isStarter: false },
  { playerId: "p15", slotKey: "B4",   isStarter: false },
  { playerId: "p16", slotKey: "B5",   isStarter: false },
];

const validDto = {
  formation: "4-3-3",
  slots: makeSlots(),
};

describe("MatchLineupService - saveLineup", () => {
  beforeEach(() => jest.clearAllMocks());

  test("유효한 dto로 저장 성공 시 repo.saveLineup 호출", async () => {
    mockRepo.findPlayersByIds.mockResolvedValue(makeSlots().map(s => ({ id: s.playerId, status: "ACTIVE" })));
    mockRepo.findActiveInjuredPlayerIds.mockResolvedValue([]);
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
    const baseSlots = makeSlots();
    const dto = {
      formation: "4-3-3",
      slots: [
        ...baseSlots.slice(0, 10),                           // 10 starters (p1–p10)
        { playerId: "p1", slotKey: "RW", isStarter: true }, // duplicate p1 as 11th starter
        ...baseSlots.filter(s => !s.isStarter),             // 5 bench
      ],
    };
    mockRepo.findPlayersByIds.mockResolvedValue(
      dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
    );
    await expect(service.saveLineup(10, dto))
      .rejects.toMatchObject({ statusCode: 409, message: "DUPLICATE_PLAYER" });
  });

  test("중복 slotKey면 409 DUPLICATE_SLOT", async () => {
    const baseSlots = makeSlots();
    // Replace the 11th starter (RW, p11) with a duplicate LB slot
    // → 11 starters, 10 outfield (slotsForFormation passes), but LB appears twice
    const dto = {
      formation: "4-3-3",
      slots: [
        ...baseSlots.slice(0, 10),                            // p1(GK)..p10(ST) – 10 starters
        { playerId: "p17", slotKey: "LB", isStarter: true }, // 11th starter with duplicate LB
        ...baseSlots.filter(s => !s.isStarter),              // 5 bench
      ],
    };
    mockRepo.findPlayersByIds.mockResolvedValue(
      dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
    );
    await expect(service.saveLineup(10, dto))
      .rejects.toMatchObject({ statusCode: 409, message: "DUPLICATE_SLOT" });
  });

  test("부상 중인 선수 포함 시 409 INJURED_PLAYER_IN_LINEUP", async () => {
    mockRepo.findPlayersByIds.mockResolvedValue(makeSlots().map(s => ({ id: s.playerId, status: "ACTIVE" })));
    mockRepo.findActiveInjuredPlayerIds.mockResolvedValue([{ playerId: "p1" }]);
    await expect(service.saveLineup(10, validDto))
      .rejects.toMatchObject({ statusCode: 409, message: "INJURED_PLAYER_IN_LINEUP" });
    expect(mockRepo.saveLineup).not.toHaveBeenCalled();
  });

  test("복귀 완료 선수만 있으면 저장 성공", async () => {
    mockRepo.findPlayersByIds.mockResolvedValue(makeSlots().map(s => ({ id: s.playerId, status: "ACTIVE" })));
    mockRepo.findActiveInjuredPlayerIds.mockResolvedValue([]);
    mockRepo.saveLineup.mockResolvedValue({ id: 1, matchId: 10, formation: "4-3-3", slots: [] });
    await service.saveLineup(10, validDto);
    expect(mockRepo.saveLineup).toHaveBeenCalledWith(10, validDto);
  });

  test("RELEASED 선수 포함 시 400 INELIGIBLE_PLAYER_IN_LINEUP", async () => {
    mockRepo.findPlayersByIds.mockResolvedValue([
      { id: "p1", status: "RELEASED" },
      ...makeSlots().slice(1).map(s => ({ id: s.playerId, status: "ACTIVE" })),
    ]);
    await expect(service.saveLineup(10, validDto))
      .rejects.toMatchObject({ statusCode: 400, message: "INELIGIBLE_PLAYER_IN_LINEUP" });
    expect(mockRepo.saveLineup).not.toHaveBeenCalled();
  });

  test("ON_LOAN 선수 포함 시 400 INELIGIBLE_PLAYER_IN_LINEUP", async () => {
    mockRepo.findPlayersByIds.mockResolvedValue([
      { id: "p2", status: "ON_LOAN" },
      ...makeSlots().filter(s => s.playerId !== "p2").map(s => ({ id: s.playerId, status: "ACTIVE" })),
    ]);
    await expect(service.saveLineup(10, validDto))
      .rejects.toMatchObject({ statusCode: 400, message: "INELIGIBLE_PLAYER_IN_LINEUP" });
    expect(mockRepo.saveLineup).not.toHaveBeenCalled();
  });

  test("선발 10명이면 400 INVALID_STARTER_COUNT", async () => {
    const dto = {
      formation: "4-3-3",
      slots: makeSlots().map((s, i) =>
        i === 10 ? { ...s, isStarter: false } : s  // move p11 to bench → 10 starters, 6 bench
      ),
    };
    mockRepo.findPlayersByIds.mockResolvedValue(
      dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
    );
    await expect(service.saveLineup(10, dto))
      .rejects.toMatchObject({ statusCode: 400, message: "INVALID_STARTER_COUNT" });
  });

  test("선발 12명이면 400 INVALID_STARTER_COUNT", async () => {
    const dto = {
      formation: "4-3-3",
      slots: [
        ...makeSlots().filter(s => s.isStarter),   // 11 starters
        { playerId: "p17", slotKey: "ST2", isStarter: true },  // 12th starter
        ...makeSlots().filter(s => !s.isStarter),  // 5 bench
      ],
    };
    mockRepo.findPlayersByIds.mockResolvedValue(
      dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
    );
    await expect(service.saveLineup(10, dto))
      .rejects.toMatchObject({ statusCode: 400, message: "INVALID_STARTER_COUNT" });
  });

  test("벤치 8명이면 400 BENCH_LIMIT_EXCEEDED", async () => {
    const dto = {
      formation: "4-3-3",
      slots: [
        ...makeSlots().filter(s => s.isStarter),  // 11 starters
        { playerId: "p12", slotKey: "B1", isStarter: false },
        { playerId: "p13", slotKey: "B2", isStarter: false },
        { playerId: "p14", slotKey: "B3", isStarter: false },
        { playerId: "p15", slotKey: "B4", isStarter: false },
        { playerId: "p16", slotKey: "B5", isStarter: false },
        { playerId: "p17", slotKey: "B6", isStarter: false },
        { playerId: "p18", slotKey: "B7", isStarter: false },
        { playerId: "p19", slotKey: "B8", isStarter: false },  // 8 bench
      ],
    };
    mockRepo.findPlayersByIds.mockResolvedValue(
      dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
    );
    await expect(service.saveLineup(10, dto))
      .rejects.toMatchObject({ statusCode: 400, message: "BENCH_LIMIT_EXCEEDED" });
  });

  test("벤치 7명이면 저장 성공", async () => {
    const dto = {
      formation: "4-3-3",
      slots: [
        ...makeSlots().filter(s => s.isStarter),  // 11 starters
        { playerId: "p12", slotKey: "B1", isStarter: false },
        { playerId: "p13", slotKey: "B2", isStarter: false },
        { playerId: "p14", slotKey: "B3", isStarter: false },
        { playerId: "p15", slotKey: "B4", isStarter: false },
        { playerId: "p16", slotKey: "B5", isStarter: false },
        { playerId: "p17", slotKey: "B6", isStarter: false },
        { playerId: "p18", slotKey: "B7", isStarter: false },  // exactly 7
      ],
    };
    mockRepo.findPlayersByIds.mockResolvedValue(
      dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
    );
    mockRepo.findActiveInjuredPlayerIds.mockResolvedValue([]);
    mockRepo.saveLineup.mockResolvedValue({ id: 1, matchId: 10, formation: "4-3-3", slots: [] });
    await service.saveLineup(10, dto);
    expect(mockRepo.saveLineup).toHaveBeenCalled();
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
