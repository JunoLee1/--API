import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../../src/lib/appError";

// Inline role guard extracted from recruitment.routes.ts (SJ9)
function applicationDetailRoleGuard(req: Request, _res: Response, next: NextFunction) {
  const role = req.user!.role;
  const foRole = (req.user as any).frontOfficeRole;
  const allowed =
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    (role === "FRONT_OFFICE" && foRole === "HR_MANAGER");
  if (!allowed) return next(new AppError(403, "FORBIDDEN"));
  next();
}

const makeReq = (role: string, frontOfficeRole?: string | null): Request =>
  ({ user: { id: 1, role, frontOfficeRole: frontOfficeRole ?? null } }) as any;

const mockRes = {} as Response;

describe("GET /applications/:id — SJ9 role guard", () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    next = jest.fn() as any;
  });

  test("HEAD_COACH (COACHING_STAFF) gets 403 FORBIDDEN", () => {
    const req = makeReq("COACHING_STAFF", "HEAD_COACH");
    applicationDetailRoleGuard(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
  });

  test("COACHING_STAFF without coachingRole gets 403 FORBIDDEN", () => {
    const req = makeReq("COACHING_STAFF");
    applicationDetailRoleGuard(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
  });

  test("PLAYER gets 403 FORBIDDEN", () => {
    const req = makeReq("PLAYER");
    applicationDetailRoleGuard(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
  });

  test("ADMIN gets 200 (next called without error)", () => {
    const req = makeReq("ADMIN");
    applicationDetailRoleGuard(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(/* no args */);
    expect((next as any).mock.calls[0]).toHaveLength(0);
  });

  test("SUPER_ADMIN gets 200 (next called without error)", () => {
    const req = makeReq("SUPER_ADMIN");
    applicationDetailRoleGuard(req, mockRes, next);
    expect(next).toHaveBeenCalledWith();
  });

  test("HR (FRONT_OFFICE + HR_MANAGER) gets 200 (next called without error)", () => {
    const req = makeReq("FRONT_OFFICE", "HR_MANAGER");
    applicationDetailRoleGuard(req, mockRes, next);
    expect(next).toHaveBeenCalledWith();
  });

  test("FRONT_OFFICE non-HR role (e.g. TD) gets 403 FORBIDDEN", () => {
    const req = makeReq("FRONT_OFFICE", "TD");
    applicationDetailRoleGuard(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
  });
});
