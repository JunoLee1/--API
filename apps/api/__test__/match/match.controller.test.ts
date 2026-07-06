import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchController } from "../../src/match/match.controller";

const mockService = {
  getMatches: jest.fn(),
  getMatchById: jest.fn(),
  createMatch: jest.fn(),
  updateMatch: jest.fn(),
  upsertPlayerStats: jest.fn(),
  upsertTeamStats: jest.fn(),
} as any;

const controller = new MatchController(mockService);

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const makeNext = () => jest.fn() as jest.MockedFunction<(err?: any) => void>;

describe("MatchController — getMatches competitionType 필터 검증", () => {
  beforeEach(() => jest.clearAllMocks());

  test("유효한 competitionType = FRIENDLY 쿼리로 정상 응답한다", async () => {
    const req = { query: { competitionType: "FRIENDLY" }, user: { role: "ADMIN" } } as any;
    const res = makeRes();
    const next = makeNext();
    mockService.getMatches.mockResolvedValue([]);

    await controller.getMatches(req, res as any, next);

    expect(mockService.getMatches).toHaveBeenCalledWith({ competitionType: "FRIENDLY" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("유효하지 않은 competitionType 쿼리 값은 next(AppError 400)로 전달된다", async () => {
    const req = { query: { competitionType: "CUP" }, user: { role: "ADMIN" } } as any;
    const res = makeRes();
    const next = makeNext();

    await controller.getMatches(req, res as any, next);

    expect(next).toHaveBeenCalled();
    const errArg = (next as jest.MockedFunction<any>).mock.calls[0]?.[0];
    expect(errArg?.statusCode).toBe(400);
    expect(errArg?.code).toBe("INVALID_COMPETITION_TYPE");
    expect(mockService.getMatches).not.toHaveBeenCalled();
  });

  test("CHAMPIONS_LEAGUE는 유효하지 않은 쿼리 값으로 400 에러를 낸다", async () => {
    const req = { query: { competitionType: "CHAMPIONS_LEAGUE" }, user: { role: "ADMIN" } } as any;
    const res = makeRes();
    const next = makeNext();

    await controller.getMatches(req, res as any, next);

    expect(next).toHaveBeenCalled();
    const errArg = (next as jest.MockedFunction<any>).mock.calls[0]?.[0];
    expect(errArg?.statusCode).toBe(400);
    expect(errArg?.code).toBe("INVALID_COMPETITION_TYPE");
  });
});
