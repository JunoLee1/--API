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
