import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchSubstitutionService } from "../../src/match/match.substitution.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  create: jest.fn<() => Promise<any>>(),
  delete: jest.fn<() => Promise<any>>(),
  findByMatch: jest.fn<() => Promise<any>>().mockResolvedValue([]),
} as any;

const mockMatchRepo = {
  findById: jest.fn<() => Promise<any>>(),
} as any;

describe("MatchSubstitutionService", () => {
  let service: MatchSubstitutionService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new MatchSubstitutionService(mockRepo, mockMatchRepo);
  });

  test("match not found → 404", async () => {
    mockMatchRepo.findById.mockResolvedValue(null);
    await expect(service.create(1, { fromPlayerId: "A", toPlayerId: "B", minute: 60 }))
      .rejects.toMatchObject({ statusCode: 404, message: "MATCH_NOT_FOUND" });
  });
});
