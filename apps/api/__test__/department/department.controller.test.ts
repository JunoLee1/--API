import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { DepartmentController } from "../../src/department/department.controller";

const mockService = {
  list: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  get: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1, name: "자산관리", parentId: null, children: [], parent: null, isActive: true }),
  create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 2, name: "신규팀", parentId: null, children: [], parent: null, isActive: true }),
  update: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1, name: "자산관리", parentId: null, children: [], parent: null, isActive: true }),
  delete: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
} as any;

const controller = new DepartmentController(mockService);

const user = {
  admin: { id: 1, role: "ADMIN", coachingRole: null, frontOfficeRole: null },
  gm: { id: 2, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "GM" },
  assetManager: { id: 3, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "ASSET_MANAGER" },
  financeManager: { id: 4, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "FINANCE_MANAGER" },
  contractManager: { id: 5, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "CONTRACT_MANAGER" },
  headCoach: { id: 6, role: "COACHING_STAFF", coachingRole: "HEAD_COACH", frontOfficeRole: null },
  player: { id: 7, role: "PLAYER", coachingRole: null, frontOfficeRole: null },
};

const mockReq = (overrides: any) =>
  ({
    user: user.admin,
    body: {},
    params: { id: "1" },
    query: {},
    ...overrides,
  }) as any;

const mockRes = () => {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  r.send = jest.fn().mockReturnValue(r);
  return r;
};

const next = jest.fn() as any;

beforeEach(() => jest.clearAllMocks());

// ─── READ (list, get) ─────────────────────────────────────────────────────────

describe("DepartmentController - list", () => {
  test("ADMIN → 200", async () => {
    const res = mockRes();
    await controller.list(mockReq({ user: user.admin }), res, next);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("GM → 200", async () => {
    const res = mockRes();
    await controller.list(mockReq({ user: user.gm }), res, next);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("ASSET_MANAGER → 200", async () => {
    const res = mockRes();
    await controller.list(mockReq({ user: user.assetManager }), res, next);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("FINANCE_MANAGER → 200 (org chart 조회 허용)", async () => {
    const res = mockRes();
    await controller.list(mockReq({ user: user.financeManager }), res, next);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("CONTRACT_MANAGER → 403", async () => {
    const res = mockRes();
    await controller.list(mockReq({ user: user.contractManager }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  test("COACHING_STAFF → 403", async () => {
    const res = mockRes();
    await controller.list(mockReq({ user: user.headCoach }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
  });

  test("PLAYER → 403", async () => {
    const res = mockRes();
    await controller.list(mockReq({ user: user.player }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
  });
});

// ─── WRITE (create, update, delete) ──────────────────────────────────────────

describe("DepartmentController - create", () => {
  const body = { name: "신규팀" };

  test("ADMIN → 201", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.admin, body }), res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("GM → 201", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.gm, body }), res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("ASSET_MANAGER → 201", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.assetManager, body }), res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("FINANCE_MANAGER → 403", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.financeManager, body }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  test("CONTRACT_MANAGER → 403", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.contractManager, body }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
  });

  test("COACHING_STAFF → 403", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.headCoach, body }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
  });

  test("PLAYER → 403", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.player, body }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
  });
});

describe("DepartmentController - update", () => {
  const body = { name: "수정팀" };

  test("GM → 200", async () => {
    const res = mockRes();
    await controller.update(mockReq({ user: user.gm, body }), res, next);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("ASSET_MANAGER → 200", async () => {
    const res = mockRes();
    await controller.update(mockReq({ user: user.assetManager, body }), res, next);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("FINANCE_MANAGER → 403", async () => {
    const res = mockRes();
    await controller.update(mockReq({ user: user.financeManager, body }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  test("COACHING_STAFF → 403", async () => {
    const res = mockRes();
    await controller.update(mockReq({ user: user.headCoach, body }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
  });
});

describe("DepartmentController - delete", () => {
  test("GM → 204", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.gm }), res, next);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  test("ASSET_MANAGER → 204", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.assetManager }), res, next);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  test("FINANCE_MANAGER → 403", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.financeManager }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  test("COACHING_STAFF → 403", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.headCoach }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
  });

  test("PLAYER → 403", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.player }), res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
  });
});
