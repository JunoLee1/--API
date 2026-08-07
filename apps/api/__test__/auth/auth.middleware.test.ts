import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { Request, Response, NextFunction } from "express";

const mockFindUnique = jest.fn();

jest.mock("../../src/lib/prisma", () => ({
  getPrisma: () => ({ user: { findUnique: mockFindUnique } }),
}));

jest.mock("passport", () => ({
  authenticate: jest.fn(),
  initialize: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

import passport from "passport";
import { auth } from "../../src/lib/authMiddleware";

const mockPassport = passport as jest.Mocked<typeof passport>;

const makeReq = (cookies: Record<string, string> = {}) =>
  ({ cookies, headers: {} }) as unknown as Request;

const makeRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res) as any;
  res.json = jest.fn().mockReturnValue(res) as any;
  return res;
};

const next: NextFunction = jest.fn();

function mockPassportUser(user: object | false) {
  (mockPassport.authenticate as jest.Mock).mockImplementation(
    (_strategy: string, _opts: object, cb: Function) =>
      async (req: Request, res: Response, next: NextFunction) => {
        await cb(null, user);
      },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("authMiddleware", () => {
  test("유효한 유저 — next() 호출", async () => {
    mockPassportUser({ id: 1, role: "ADMIN" });
    mockFindUnique.mockResolvedValue({ isDeleted: false });

    await auth(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  test("isDeleted=true — 401 반환", async () => {
    mockPassportUser({ id: 2, role: "PLAYER" });
    mockFindUnique.mockResolvedValue({ isDeleted: true });

    const res = makeRes();
    await auth(makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("DB에 유저 없음 — 401 반환", async () => {
    mockPassportUser({ id: 99, role: "PLAYER" });
    mockFindUnique.mockResolvedValue(null);

    const res = makeRes();
    await auth(makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("passport 인증 실패 — 401 반환", async () => {
    mockPassportUser(false);

    const res = makeRes();
    await auth(makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("SUPER_ADMIN — x-team-id 헤더 반영", async () => {
    const user = { id: 1, role: "SUPER_ADMIN" };
    mockPassportUser(user);
    mockFindUnique.mockResolvedValue({ isDeleted: false });

    const req = { cookies: {}, headers: { "x-team-id": "5" } } as unknown as Request;
    await auth(req, makeRes(), next);

    expect(req.user?.teamId).toBe(5);
    expect(next).toHaveBeenCalled();
  });
});
