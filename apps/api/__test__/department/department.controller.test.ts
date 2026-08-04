import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { DepartmentController } from "../../src/department/department.controller";

// 팀(하위 노드): parentId 있음, parent.headId = 4 (headOfDept)
const teamRecord = {
  id: 2, name: "1팀", parentId: 1, isActive: true, children: [],
  parent: { id: 1, headId: 4, name: "자산관리", parentId: null, isActive: true },
};

// 최상위 부서: parentId 없음
const deptRecord = {
  id: 1, name: "자산관리", parentId: null, isActive: true, children: [], parent: null,
};

const mockService = {
  list: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  get: jest.fn<(id: number) => Promise<any>>(),
  create: jest.fn<() => Promise<any>>().mockResolvedValue(teamRecord),
  update: jest.fn<() => Promise<any>>().mockResolvedValue(teamRecord),
  delete: jest.fn<() => Promise<any>>().mockResolvedValue(undefined),
} as any;

const controller = new DepartmentController(mockService);

// 역할 정의 (PR #108 이후 GM은 top-level role)
const user = {
  admin:       { id: 1, role: "ADMIN",         coachingRole: null, frontOfficeRole: null },
  gm:          { id: 2, role: "GM",             coachingRole: null, frontOfficeRole: null },
  frontOffice: { id: 3, role: "FRONT_OFFICE",   coachingRole: null, frontOfficeRole: null },
  headOfDept:  { id: 4, role: "FRONT_OFFICE",   coachingRole: null, frontOfficeRole: null }, // parent.headId === 4
  coaching:    { id: 5, role: "COACHING_STAFF", coachingRole: null, frontOfficeRole: null },
  player:      { id: 6, role: "PLAYER",         coachingRole: null, frontOfficeRole: null },
};

const mockReq = (overrides: any) =>
  ({ user: user.admin, body: {}, params: { id: "2" }, query: {}, ...overrides }) as any;

const mockRes = () => {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  r.send = jest.fn().mockReturnValue(r);
  return r;
};

const next = jest.fn() as any;

beforeEach(() => {
  jest.clearAllMocks();
  // 기본값: 팀 레코드 반환 (update/delete 부서장 테스트에서 사용)
  mockService.get.mockResolvedValue(teamRecord);
});

// ─── READ ────────────────────────────────────────────────────────────────────

describe("list", () => {
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

  test("FRONT_OFFICE → 200 (조회 허용)", async () => {
    const res = mockRes();
    await controller.list(mockReq({ user: user.frontOffice }), res, next);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("COACHING_STAFF → 403", async () => {
    const res = mockRes();
    await controller.list(mockReq({ user: user.coaching }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });

  test("PLAYER → 403", async () => {
    const res = mockRes();
    await controller.list(mockReq({ user: user.player }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });
});

// ─── CREATE ──────────────────────────────────────────────────────────────────

describe("create", () => {
  const body = { name: "신규팀", parentId: 1 };

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

  test("부서장(headId 일치) → 201", async () => {
    // service.get(parentId=1) → deptRecord with headId=4
    mockService.get.mockResolvedValue({ ...deptRecord, headId: 4 });
    const res = mockRes();
    await controller.create(mockReq({ user: user.headOfDept, body }), res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("FRONT_OFFICE(부서장 아님) → 403", async () => {
    mockService.get.mockResolvedValue({ ...deptRecord, headId: 99 });
    const res = mockRes();
    await controller.create(mockReq({ user: user.frontOffice, body }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });

  test("FRONT_OFFICE + parentId 없음 → 403 (최상위 부서 생성 불가)", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.frontOffice, body: { name: "신규부서" } }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });

  test("COACHING_STAFF → 403", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.coaching, body }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });

  test("빈 name → 400", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.admin, body: { name: "  " } }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, code: "NAME_REQUIRED" }));
  });

  test("name이 문자열 아님 → 400", async () => {
    const res = mockRes();
    await controller.create(mockReq({ user: user.admin, body: { name: 123 } }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, code: "NAME_REQUIRED" }));
  });
});

// ─── UPDATE ──────────────────────────────────────────────────────────────────

describe("update", () => {
  const body = { name: "수정팀" };

  test("ADMIN → 200", async () => {
    const res = mockRes();
    await controller.update(mockReq({ user: user.admin, body }), res, next);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("GM → 200", async () => {
    const res = mockRes();
    await controller.update(mockReq({ user: user.gm, body }), res, next);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("부서장(headId 일치) → 200", async () => {
    // get(id=2) → teamRecord (parentId=1, parent.headId=4)
    const res = mockRes();
    await controller.update(mockReq({ user: user.headOfDept, body }), res, next);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("FRONT_OFFICE(부서장 아님) → 403", async () => {
    const res = mockRes();
    await controller.update(mockReq({ user: user.frontOffice, body }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });

  test("COACHING_STAFF → 403", async () => {
    const res = mockRes();
    await controller.update(mockReq({ user: user.coaching, body }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe("delete", () => {
  test("ADMIN → 204", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.admin }), res, next);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  test("GM → 204", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.gm }), res, next);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  test("부서장(headId 일치) → 204", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.headOfDept }), res, next);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  test("FRONT_OFFICE(부서장 아님) → 403", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.frontOffice }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });

  test("COACHING_STAFF → 403", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.coaching }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });

  test("PLAYER → 403", async () => {
    const res = mockRes();
    await controller.delete(mockReq({ user: user.player }), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }));
  });
});
