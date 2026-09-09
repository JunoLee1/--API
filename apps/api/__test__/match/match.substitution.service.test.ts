import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchSubstitutionService } from "../../src/match/match.substitution.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  create: jest.fn<() => Promise<any>>(),
  delete: jest.fn<() => Promise<any>>(),
  findByMatch: jest.fn<() => Promise<any>>().mockResolvedValue([]),
} as any;

const baseMatch = {
  id: 1, homeTeamName: "FC Seoul", awayTeamName: "Jeonbuk",
  homeScore: null, awayScore: null, extraTime: null,
};

const mockMatchRepo = {
  findById: jest.fn<() => Promise<any>>().mockResolvedValue(baseMatch),
} as any;

describe("MatchSubstitutionService.create", () => {
  let service: MatchSubstitutionService;
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchRepo.findById.mockResolvedValue(baseMatch);
    service = new MatchSubstitutionService(mockRepo, mockMatchRepo);
  });

  test("match not found → 404 MATCH_NOT_FOUND", async () => {
    mockMatchRepo.findById.mockResolvedValue(null);
    await expect(service.create(1, { fromPlayerId: "A", toPlayerId: "B", minute: 60 }))
      .rejects.toMatchObject({ statusCode: 404, message: "MATCH_NOT_FOUND" });
  });

  test("fromPlayerId === toPlayerId → 400 SUBSTITUTION_SAME_PLAYER", async () => {
    await expect(service.create(1, { fromPlayerId: "A", toPlayerId: "A", minute: 60 }))
      .rejects.toMatchObject({ statusCode: 400, message: "SUBSTITUTION_SAME_PLAYER" });
  });

  test("minute < 1 → 400 INVALID_SUBSTITUTION_MINUTE", async () => {
    await expect(service.create(1, { fromPlayerId: "A", toPlayerId: "B", minute: 0 }))
      .rejects.toMatchObject({ statusCode: 400, message: "INVALID_SUBSTITUTION_MINUTE" });
  });

  test("minute > 120 → 400 INVALID_SUBSTITUTION_MINUTE", async () => {
    await expect(service.create(1, { fromPlayerId: "A", toPlayerId: "B", minute: 121 }))
      .rejects.toMatchObject({ statusCode: 400, message: "INVALID_SUBSTITUTION_MINUTE" });
  });

  test("valid dto → calls repo.create", async () => {
    const sub = { id: 1, matchId: 1, fromPlayerId: "A", toPlayerId: "B", minute: 70 };
    mockRepo.create.mockResolvedValue(sub);
    const result = await service.create(1, { fromPlayerId: "A", toPlayerId: "B", minute: 70 });
    expect(mockRepo.create).toHaveBeenCalledWith(1, { fromPlayerId: "A", toPlayerId: "B", minute: 70 });
    expect(result).toEqual(sub);
  });
});

describe("MatchSubstitutionService.delete", () => {
  let service: MatchSubstitutionService;
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchRepo.findById.mockResolvedValue(baseMatch);
    service = new MatchSubstitutionService(mockRepo, mockMatchRepo);
  });

  test("calls repo.delete with eventId", async () => {
    mockRepo.delete.mockResolvedValue({ id: 5 });
    await service.delete(1, 5);
    expect(mockRepo.delete).toHaveBeenCalledWith(5);
  });
});

describe("MatchSubstitutionService.list", () => {
  let service: MatchSubstitutionService;
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchRepo.findById.mockResolvedValue(baseMatch);
    service = new MatchSubstitutionService(mockRepo, mockMatchRepo);
  });

  test("returns repo.findByMatch result", async () => {
    const list = [{ id: 1, minute: 60 }];
    mockRepo.findByMatch.mockResolvedValue(list);
    const result = await service.list(1);
    expect(result).toEqual(list);
  });
});
