import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchService } from "../../src/match/match.service";
import { AppError } from "../../src/lib/appError";
import { CompetitionType, Venue } from "../../src/generated/enums";

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findPlayerStats: jest.fn(),
  createPlayerStats: jest.fn(),
  updatePlayerStats: jest.fn(),
  upsertTeamStats: jest.fn(),
  recalculateTeamStats: jest.fn().mockResolvedValue(undefined),
  findSubstitutionForPlayer: jest.fn().mockResolvedValue({ subOff: null, subOn: null }),
} as any;

const service = new MatchService(mockRepo);

const baseCreateDto = {
  date: "2026-07-06T15:00:00Z",
  homeTeamName: "FC Seoul",
  awayTeamName: "Jeonbuk",
  competitionType: CompetitionType.FRIENDLY,
  seasonId: 1,
};

describe("MatchService — venue 필드", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("venue = NEUTRAL로 경기 생성 시 repo.create가 venue 포함 dto로 호출된다", async () => {
    const dto = { ...baseCreateDto, venue: Venue.NEUTRAL };
    const expected = { id: 1, ...dto, homeScore: null, awayScore: null, externalId: null };
    mockRepo.create.mockResolvedValue(expected);

    const result = await service.createMatch(dto);

    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(expected);
  });

  test("venue 없이 경기 생성해도 정상 동작한다", async () => {
    const expected = { id: 2, ...baseCreateDto, venue: null, homeScore: null, awayScore: null, externalId: null };
    mockRepo.create.mockResolvedValue(expected);

    const result = await service.createMatch(baseCreateDto);

    expect(mockRepo.create).toHaveBeenCalledWith(baseCreateDto);
    expect(result).toEqual(expected);
  });

  test("유효하지 않은 venue 값 전달 시 400 INVALID_VENUE 에러를 던진다", async () => {
    const dto = { ...baseCreateDto, venue: "STADIUM" as Venue };

    try {
      await service.createMatch(dto);
      throw new Error("Should have thrown");
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("INVALID_VENUE");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});

describe("MatchService — competitionType 검증", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("competitionType = FRIENDLY 필터로 getMatches 호출 시 repo.findAll에 그대로 전달된다", async () => {
    const query = { competitionType: CompetitionType.FRIENDLY };
    mockRepo.findAll.mockResolvedValue([]);

    await service.getMatches(query);

    expect(mockRepo.findAll).toHaveBeenCalledWith(query);
  });

  test("유효하지 않은 competitionType으로 createMatch 시 400 INVALID_COMPETITION_TYPE 에러를 던진다", async () => {
    const dto = { ...baseCreateDto, competitionType: "CUP" as CompetitionType };

    try {
      await service.createMatch(dto);
      throw new Error("Should have thrown");
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("INVALID_COMPETITION_TYPE");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  test("CHAMPIONS_LEAGUE는 더 이상 유효한 competitionType이 아니다", async () => {
    const dto = { ...baseCreateDto, competitionType: "CHAMPIONS_LEAGUE" as CompetitionType };

    try {
      await service.createMatch(dto);
      throw new Error("Should have thrown");
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("INVALID_COMPETITION_TYPE");
    }
  });

  test("DOMESTIC_CUP은 유효한 competitionType으로 처리된다", async () => {
    const dto = { ...baseCreateDto, competitionType: CompetitionType.DOMESTIC_CUP };
    const expected = { id: 3, ...dto, venue: null, homeScore: null, awayScore: null, externalId: null };
    mockRepo.create.mockResolvedValue(expected);

    const result = await service.createMatch(dto);

    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(expected);
  });

  test("CONTINENTAL은 유효한 competitionType으로 처리된다", async () => {
    const dto = { ...baseCreateDto, competitionType: CompetitionType.CONTINENTAL };
    const expected = { id: 4, ...dto, venue: null, homeScore: null, awayScore: null, externalId: null };
    mockRepo.create.mockResolvedValue(expected);

    const result = await service.createMatch(dto);

    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(expected);
  });
});

describe("MatchService — updateMatch venue 반영", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("updateMatch 시 venue = HOME으로 변경되면 repo.update에 venue 포함 dto 전달", async () => {
    const existingMatch = { id: 1, ...baseCreateDto, venue: null };
    mockRepo.findById.mockResolvedValue(existingMatch);
    const updateDto = { venue: Venue.HOME };
    const updated = { ...existingMatch, venue: Venue.HOME };
    mockRepo.update.mockResolvedValue(updated);

    const result = await service.updateMatch(1, updateDto);

    expect(mockRepo.update).toHaveBeenCalledWith(1, updateDto);
    expect(result.venue).toBe(Venue.HOME);
  });

  test("updateMatch 시 유효하지 않은 venue 전달 시 400 에러", async () => {
    const existingMatch = { id: 1, ...baseCreateDto, venue: null };
    mockRepo.findById.mockResolvedValue(existingMatch);

    try {
      await service.updateMatch(1, { venue: "FIELD" as Venue });
      throw new Error("Should have thrown");
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("INVALID_VENUE");
    }
  });
});

describe("MatchService — upsertPlayerStats 드리블 검증", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("dribblesCompleted > dribblesAttempted인 경우 400 DRIBBLES_COMPLETED_EXCEEDS_ATTEMPTED 에러를 던진다", async () => {
    const existingMatch = { id: 1, ...baseCreateDto };
    mockRepo.findById.mockResolvedValue(existingMatch);
    const dto = {
      playerId: 10,
      dribblesAttempted: 4,
      dribblesCompleted: 5,
      dribblesFailed: 0,
    };

    try {
      await service.upsertPlayerStats(1, dto);
      throw new Error("Should have thrown");
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("DRIBBLES_COMPLETED_EXCEEDS_ATTEMPTED");
    }
    expect(mockRepo.findPlayerStats).not.toHaveBeenCalled();
  });

  test("dribblesFailed > dribblesAttempted인 경우 400 DRIBBLES_FAILED_EXCEEDS_ATTEMPTED 에러를 던진다", async () => {
    const existingMatch = { id: 1, ...baseCreateDto };
    mockRepo.findById.mockResolvedValue(existingMatch);
    const dto = {
      playerId: 10,
      dribblesAttempted: 4,
      dribblesCompleted: 2,
      dribblesFailed: 7,
    };

    try {
      await service.upsertPlayerStats(1, dto);
      throw new Error("Should have thrown");
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("DRIBBLES_FAILED_EXCEEDS_ATTEMPTED");
    }
    expect(mockRepo.findPlayerStats).not.toHaveBeenCalled();
  });
});

describe("MatchService — minutesPlayed 검증", () => {
  const baseMatch = {
    id: 1, homeTeamName: "FC Seoul", awayTeamName: "Jeonbuk",
    homeScore: 2, awayScore: 1, extraTime: false, hasSquad: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.findById.mockResolvedValue(baseMatch);
    mockRepo.findPlayerStats.mockResolvedValue(null);
    mockRepo.createPlayerStats.mockResolvedValue({ id: 1 });
    mockRepo.findSubstitutionForPlayer.mockResolvedValue({ subOff: null, subOn: null });
  });

  test("교체 OUT 선수: minutesPlayed ≠ subOff.minute → 400 MINUTES_PLAYED_MISMATCH_SUB_OFF", async () => {
    mockRepo.findSubstitutionForPlayer.mockResolvedValue({
      subOff: { minute: 70 },
      subOn: null,
    });
    await expect(
      service.upsertPlayerStats(1, { playerId: "A", minutesPlayed: 65 })
    ).rejects.toMatchObject({ statusCode: 400, message: "MINUTES_PLAYED_MISMATCH_SUB_OFF" });
  });

  test("교체 OUT 선수: minutesPlayed === subOff.minute → 성공", async () => {
    mockRepo.findSubstitutionForPlayer.mockResolvedValue({
      subOff: { minute: 70 },
      subOn: null,
    });
    await service.upsertPlayerStats(1, { playerId: "A", minutesPlayed: 70 });
    expect(mockRepo.createPlayerStats).toHaveBeenCalled();
  });

  test("교체 IN 선수: minutesPlayed ≠ (90 - subOn.minute) → 400 MINUTES_PLAYED_MISMATCH_SUB_ON", async () => {
    mockRepo.findSubstitutionForPlayer.mockResolvedValue({
      subOff: null,
      subOn: { minute: 70 },
    });
    await expect(
      service.upsertPlayerStats(1, { playerId: "B", minutesPlayed: 15 })
    ).rejects.toMatchObject({ statusCode: 400, message: "MINUTES_PLAYED_MISMATCH_SUB_ON" });
    // expected: 90 - 70 = 20
  });

  test("교체 IN 선수: minutesPlayed === (90 - subOn.minute) → 성공", async () => {
    mockRepo.findSubstitutionForPlayer.mockResolvedValue({
      subOff: null,
      subOn: { minute: 70 },
    });
    await service.upsertPlayerStats(1, { playerId: "B", minutesPlayed: 20 });
    expect(mockRepo.createPlayerStats).toHaveBeenCalled();
  });

  test("extraTime=true 인 경우: (120 - subOn.minute) 기준 검증", async () => {
    mockRepo.findById.mockResolvedValue({ ...baseMatch, extraTime: true });
    mockRepo.findSubstitutionForPlayer.mockResolvedValue({
      subOff: null,
      subOn: { minute: 100 },
    });
    await expect(
      service.upsertPlayerStats(1, { playerId: "B", minutesPlayed: 15 })
    ).rejects.toMatchObject({ statusCode: 400, message: "MINUTES_PLAYED_MISMATCH_SUB_ON" });
    // expected: 120 - 100 = 20
  });

  test("교체 없는 선수: minutesPlayed ≠ matchDuration → 400 MINUTES_PLAYED_MISMATCH_FULL", async () => {
    mockRepo.findSubstitutionForPlayer.mockResolvedValue({ subOff: null, subOn: null });
    await expect(
      service.upsertPlayerStats(1, { playerId: "C", minutesPlayed: 80 })
    ).rejects.toMatchObject({ statusCode: 400, message: "MINUTES_PLAYED_MISMATCH_FULL" });
  });

  test("minutesPlayed 미제공 시 검증 스킵 → 성공", async () => {
    await service.upsertPlayerStats(1, { playerId: "C" });
    expect(mockRepo.createPlayerStats).toHaveBeenCalled();
  });
});

describe("MatchService — upsertTeamStats Q_Opp 검증", () => {
  const baseMatch = {
    id: 1, homeTeamName: "FC Seoul", awayTeamName: "Jeonbuk",
    homeScore: 2, awayScore: 1, extraTime: false, hasSquad: true,
  };
  const baseDto = {
    possession: 55, yellowCards: 1, redCards: 0, corners: 5, offsides: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.findById.mockResolvedValue(baseMatch);
    mockRepo.upsertTeamStats.mockResolvedValue({ id: 1 });
  });

  test("oppShotsOnTarget > oppShots → 400 OPP_SHOTS_ON_TARGET_EXCEEDS_SHOTS", async () => {
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppShots: 3, oppShotsOnTarget: 5 })
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_SHOTS_ON_TARGET_EXCEEDS_SHOTS" });
  });

  test("oppShotsOnTarget === oppShots → 성공", async () => {
    await service.upsertTeamStats(1, { ...baseDto, oppShots: 5, oppShotsOnTarget: 5 });
    expect(mockRepo.upsertTeamStats).toHaveBeenCalled();
  });

  test("oppPossession < 0 → 400 OPP_POSSESSION_OUT_OF_RANGE", async () => {
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppPossession: -1 })
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_POSSESSION_OUT_OF_RANGE" });
  });

  test("oppPossession > 100 → 400 OPP_POSSESSION_OUT_OF_RANGE", async () => {
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppPossession: 101 })
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_POSSESSION_OUT_OF_RANGE" });
  });

  test("oppGoals < 0 → 400 OPP_GOALS_NEGATIVE", async () => {
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppGoals: -1 })
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_GOALS_NEGATIVE" });
  });
});

describe("MatchService — upsertTeamStats Q_Cross 검증", () => {
  const baseMatch = {
    id: 1, homeTeamName: "FC Seoul", awayTeamName: "Jeonbuk",
    homeScore: 2, awayScore: 1, extraTime: false, hasSquad: true,
  };
  const baseDto = {
    possession: 55, yellowCards: 1, redCards: 0, corners: 5, offsides: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.findById.mockResolvedValue(baseMatch);
    mockRepo.upsertTeamStats.mockResolvedValue({ id: 1 });
  });

  test("possession + oppPossession ≠ 100 → 400 POSSESSION_SUM_INVALID", async () => {
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppPossession: 40 })
    ).rejects.toMatchObject({ statusCode: 400, message: "POSSESSION_SUM_INVALID" });
    // possession = 55, oppPossession = 40, sum = 95 ≠ 100
  });

  test("possession + oppPossession = 100 → 성공", async () => {
    await service.upsertTeamStats(1, { ...baseDto, oppPossession: 45 });
    expect(mockRepo.upsertTeamStats).toHaveBeenCalled();
  });

  test("oppPossession 미제공 시 합산 검증 스킵 → 성공", async () => {
    await service.upsertTeamStats(1, { ...baseDto });
    expect(mockRepo.upsertTeamStats).toHaveBeenCalled();
  });

  test("홈팀(FC Seoul): oppGoals ≠ awayScore → 400 OPP_GOALS_MISMATCH", async () => {
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppGoals: 2 })
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_GOALS_MISMATCH" });
    // match.awayScore = 1, oppGoals = 2 → mismatch
  });

  test("홈팀(FC Seoul): oppGoals === awayScore → 성공", async () => {
    await service.upsertTeamStats(1, { ...baseDto, oppGoals: 1 });
    expect(mockRepo.upsertTeamStats).toHaveBeenCalled();
  });

  test("원정팀(FC Seoul): oppGoals ≠ homeScore → 400 OPP_GOALS_MISMATCH", async () => {
    mockRepo.findById.mockResolvedValue({
      ...baseMatch, homeTeamName: "Jeonbuk", awayTeamName: "FC Seoul",
      homeScore: 3, awayScore: 0,
    });
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppGoals: 2 })
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_GOALS_MISMATCH" });
  });

  test("스코어 미입력 시 oppGoals 검증 스킵 → 성공", async () => {
    mockRepo.findById.mockResolvedValue({ ...baseMatch, homeScore: null, awayScore: null });
    await service.upsertTeamStats(1, { ...baseDto, oppGoals: 99 });
    expect(mockRepo.upsertTeamStats).toHaveBeenCalled();
  });
});
