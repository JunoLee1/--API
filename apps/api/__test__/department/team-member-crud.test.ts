import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { DepartmentService } from "../../src/department/department.service";
import { AppError } from "../../src/lib/appError";

jest.mock("../../src/lib/auditLog", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { writeAuditLog } from "../../src/lib/auditLog";

// ─── Shared fixtures ────────────────────────────────────────────────────────

const ADMIN_ID = 1;
const LEADER_ID = 10;
const MEMBER_ID = 20;
const OTHER_USER_ID = 30;
const DEPT_ID = 100;
const PARENT_DEPT_ID = 50;
const OTHER_DEPT_ID = 200;

const fakeDept = {
  id: DEPT_ID,
  name: "전략팀",
  parentId: PARENT_DEPT_ID,
  headId: LEADER_ID,
  isActive: true,
  children: [],
  parent: { id: PARENT_DEPT_ID, headId: 999, name: "상위부서" },
};

const fakeParentDept = {
  id: PARENT_DEPT_ID,
  name: "상위부서",
  parentId: null,
  headId: LEADER_ID, // LEADER_ID is parent head → can appoint head in child
  isActive: true,
  children: [],
  parent: null,
};

const fakeRootDept = {
  id: DEPT_ID,
  name: "최상위부서",
  parentId: null,
  headId: LEADER_ID,
  isActive: true,
  children: [],
  parent: null,
};

const fakeUser = { id: MEMBER_ID, username: "member", email: "m@example.com" };
const fakeOtherUser = { id: OTHER_USER_ID, username: "other", email: "o@example.com" };

const fakeUserDept = { userId: MEMBER_ID, departmentId: DEPT_ID, role: "MEMBER" as const, joinedAt: new Date() };

// ─── Mock repo builder ────────────────────────────────────────────────────────

const makeRepo = (overrides: Record<string, jest.Mock> = {}) =>
  ({
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(fakeDept),
    findByName: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countActiveStaff: jest.fn().mockResolvedValue(0),
    getHeadcount: jest.fn(),
    findMembers: jest.fn().mockResolvedValue([]),
    findMember: jest.fn().mockResolvedValue(null),
    findUserById: jest.fn().mockResolvedValue(fakeUser),
    addMember: jest.fn().mockResolvedValue(fakeUserDept),
    updateMemberRole: jest.fn().mockResolvedValue(fakeUserDept),
    removeMember: jest.fn().mockResolvedValue(fakeUserDept),
    transferMember: jest.fn().mockResolvedValue(undefined),
    countUserDepartments: jest.fn().mockResolvedValue(2),
    updateHead: jest.fn().mockResolvedValue({ ...fakeDept, headId: OTHER_USER_ID }),
    ...overrides,
  } as any);

// ─── assertLeaderOrAdmin ─────────────────────────────────────────────────────

describe("assertLeaderOrAdmin (via listMembers)", () => {
  test("admin 역할은 통과", async () => {
    const repo = makeRepo();
    const svc = new DepartmentService(repo);
    await expect(svc.listMembers(DEPT_ID, ADMIN_ID, "ADMIN")).resolves.not.toThrow();
  });

  test("SUPER_ADMIN 역할은 통과", async () => {
    const repo = makeRepo();
    const svc = new DepartmentService(repo);
    await expect(svc.listMembers(DEPT_ID, ADMIN_ID, "SUPER_ADMIN")).resolves.not.toThrow();
  });

  test("GM 역할은 통과", async () => {
    const repo = makeRepo();
    const svc = new DepartmentService(repo);
    await expect(svc.listMembers(DEPT_ID, ADMIN_ID, "GM")).resolves.not.toThrow();
  });

  test("팀장(headId 일치)은 통과", async () => {
    const repo = makeRepo();
    const svc = new DepartmentService(repo);
    await expect(svc.listMembers(DEPT_ID, LEADER_ID, "FRONT_OFFICE")).resolves.not.toThrow();
  });

  test("팀장 아닌 일반 역할 → 403 NOT_LEADER", async () => {
    const repo = makeRepo();
    const svc = new DepartmentService(repo);
    await expect(svc.listMembers(DEPT_ID, OTHER_USER_ID, "FRONT_OFFICE")).rejects.toMatchObject({
      statusCode: 403,
      code: "NOT_LEADER",
    });
  });

  test("부서 없으면 404", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const svc = new DepartmentService(repo);
    await expect(svc.listMembers(DEPT_ID, OTHER_USER_ID, "FRONT_OFFICE")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ─── addMember ───────────────────────────────────────────────────────────────

describe("addMember", () => {
  beforeEach(() => jest.clearAllMocks());

  test("성공 + audit log 호출", async () => {
    const repo = makeRepo();
    const svc = new DepartmentService(repo);
    const result = await svc.addMember(DEPT_ID, MEMBER_ID, "MEMBER", LEADER_ID, "FRONT_OFFICE");
    expect(result).toEqual({ ok: true });
    expect(repo.addMember).toHaveBeenCalledWith(DEPT_ID, MEMBER_ID, "MEMBER");
    // fire-and-forget: give microtask queue a tick
    await Promise.resolve();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TEAM_MEMBER_ADDED" })
    );
  });

  test("유저 없으면 404 USER_NOT_FOUND", async () => {
    const repo = makeRepo({ findUserById: jest.fn().mockResolvedValue(null) });
    const svc = new DepartmentService(repo);
    await expect(
      svc.addMember(DEPT_ID, 9999, "MEMBER", LEADER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 404, code: "USER_NOT_FOUND" });
  });

  test("이미 소속이면 400 ALREADY_MEMBER", async () => {
    const repo = makeRepo({ findMember: jest.fn().mockResolvedValue(fakeUserDept) });
    const svc = new DepartmentService(repo);
    await expect(
      svc.addMember(DEPT_ID, MEMBER_ID, "MEMBER", LEADER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 400, code: "ALREADY_MEMBER" });
  });
});

// ─── updateMemberRole ────────────────────────────────────────────────────────

describe("updateMemberRole", () => {
  beforeEach(() => jest.clearAllMocks());

  test("성공", async () => {
    const repo = makeRepo({ findMember: jest.fn().mockResolvedValue(fakeUserDept) });
    const svc = new DepartmentService(repo);
    const result = await svc.updateMemberRole(DEPT_ID, MEMBER_ID, "SENIOR", LEADER_ID, "FRONT_OFFICE");
    expect(result).toEqual({ ok: true });
    expect(repo.updateMemberRole).toHaveBeenCalledWith(DEPT_ID, MEMBER_ID, "SENIOR");
  });

  test("자기 자신 역할 변경 → 403 SELF_ROLE_CHANGE_FORBIDDEN", async () => {
    const repo = makeRepo({ findMember: jest.fn().mockResolvedValue(fakeUserDept) });
    const svc = new DepartmentService(repo);
    await expect(
      svc.updateMemberRole(DEPT_ID, LEADER_ID, "SENIOR", LEADER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 403, code: "SELF_ROLE_CHANGE_FORBIDDEN" });
  });

  test("소속 없으면 404 NOT_MEMBER", async () => {
    const repo = makeRepo({ findMember: jest.fn().mockResolvedValue(null) });
    const svc = new DepartmentService(repo);
    await expect(
      svc.updateMemberRole(DEPT_ID, MEMBER_ID, "SENIOR", LEADER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_MEMBER" });
  });

  test("audit log 호출", async () => {
    const repo = makeRepo({ findMember: jest.fn().mockResolvedValue(fakeUserDept) });
    const svc = new DepartmentService(repo);
    await svc.updateMemberRole(DEPT_ID, MEMBER_ID, "SENIOR", LEADER_ID, "FRONT_OFFICE");
    await Promise.resolve();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TEAM_MEMBER_ROLE_CHANGED" })
    );
  });
});

// ─── removeMember ────────────────────────────────────────────────────────────

describe("removeMember", () => {
  beforeEach(() => jest.clearAllMocks());

  test("겸직(2개 이상 부서) → 성공", async () => {
    const repo = makeRepo({ countUserDepartments: jest.fn().mockResolvedValue(2) });
    const svc = new DepartmentService(repo);
    const result = await svc.removeMember(DEPT_ID, MEMBER_ID, LEADER_ID, "FRONT_OFFICE");
    expect(result).toEqual({ ok: true });
    expect(repo.removeMember).toHaveBeenCalledWith(DEPT_ID, MEMBER_ID);
  });

  test("단독 소속(1개) → 400 MUST_TRANSFER", async () => {
    const repo = makeRepo({ countUserDepartments: jest.fn().mockResolvedValue(1) });
    const svc = new DepartmentService(repo);
    await expect(
      svc.removeMember(DEPT_ID, MEMBER_ID, LEADER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 400, code: "MUST_TRANSFER" });
  });

  test("자기 자신 제거 → 403 SELF_REMOVAL_FORBIDDEN", async () => {
    const repo = makeRepo({ countUserDepartments: jest.fn().mockResolvedValue(2) });
    const svc = new DepartmentService(repo);
    await expect(
      svc.removeMember(DEPT_ID, LEADER_ID, LEADER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 403, code: "SELF_REMOVAL_FORBIDDEN" });
  });

  test("audit log 호출", async () => {
    const repo = makeRepo({ countUserDepartments: jest.fn().mockResolvedValue(2) });
    const svc = new DepartmentService(repo);
    await svc.removeMember(DEPT_ID, MEMBER_ID, LEADER_ID, "FRONT_OFFICE");
    await Promise.resolve();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TEAM_MEMBER_REMOVED" })
    );
  });
});

// ─── transferMember ──────────────────────────────────────────────────────────

describe("transferMember", () => {
  beforeEach(() => jest.clearAllMocks());

  test("성공 + transferMember($transaction) 호출", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ ...fakeDept, id: DEPT_ID }),
      transferMember: jest.fn().mockResolvedValue(undefined),
    });
    // Second call (toDeptId lookup) should also resolve
    repo.findById
      .mockResolvedValueOnce(fakeDept)           // assertLeaderOrAdmin → finds DEPT_ID
      .mockResolvedValueOnce({ ...fakeDept, id: OTHER_DEPT_ID }); // toDept lookup

    const svc = new DepartmentService(repo);
    const result = await svc.transferMember(DEPT_ID, OTHER_DEPT_ID, MEMBER_ID, "MEMBER", LEADER_ID, "FRONT_OFFICE");
    expect(result).toEqual({ ok: true });
    expect(repo.transferMember).toHaveBeenCalledWith(DEPT_ID, OTHER_DEPT_ID, MEMBER_ID, "MEMBER");
  });

  test("자기 자신 이관 → 403 SELF_TRANSFER_FORBIDDEN", async () => {
    const repo = makeRepo();
    const svc = new DepartmentService(repo);
    await expect(
      svc.transferMember(DEPT_ID, OTHER_DEPT_ID, LEADER_ID, "MEMBER", LEADER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 403, code: "SELF_TRANSFER_FORBIDDEN" });
  });

  test("같은 부서로 이관 → 400 SAME_DEPARTMENT", async () => {
    const repo = makeRepo();
    const svc = new DepartmentService(repo);
    await expect(
      svc.transferMember(DEPT_ID, DEPT_ID, MEMBER_ID, "MEMBER", LEADER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 400, code: "SAME_DEPARTMENT" });
  });

  test("대상 부서 없으면 404 TARGET_DEPT_NOT_FOUND", async () => {
    const repo = makeRepo({
      findById: jest.fn()
        .mockResolvedValueOnce(fakeDept)   // assertLeaderOrAdmin
        .mockResolvedValueOnce(null),       // toDept lookup
    });
    const svc = new DepartmentService(repo);
    await expect(
      svc.transferMember(DEPT_ID, OTHER_DEPT_ID, MEMBER_ID, "MEMBER", LEADER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 404, code: "TARGET_DEPT_NOT_FOUND" });
  });

  test("audit log 호출", async () => {
    const repo = makeRepo({
      findById: jest.fn()
        .mockResolvedValueOnce(fakeDept)
        .mockResolvedValueOnce({ ...fakeDept, id: OTHER_DEPT_ID }),
      transferMember: jest.fn().mockResolvedValue(undefined),
    });
    const svc = new DepartmentService(repo);
    await svc.transferMember(DEPT_ID, OTHER_DEPT_ID, MEMBER_ID, "MEMBER", LEADER_ID, "FRONT_OFFICE");
    await Promise.resolve();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TEAM_MEMBER_TRANSFERRED" })
    );
  });
});

// ─── updateHead ──────────────────────────────────────────────────────────────

describe("updateHead", () => {
  beforeEach(() => jest.clearAllMocks());

  test("admin은 통과", async () => {
    const repo = makeRepo({
      findById: jest.fn()
        .mockResolvedValueOnce(fakeDept)           // dept
        .mockResolvedValueOnce(fakeParentDept),    // parent
      findUserById: jest.fn().mockResolvedValue(fakeOtherUser),
    });
    const svc = new DepartmentService(repo);
    const result = await svc.updateHead(DEPT_ID, OTHER_USER_ID, ADMIN_ID, "ADMIN");
    expect(result).toEqual({ ok: true });
    expect(repo.updateHead).toHaveBeenCalledWith(DEPT_ID, OTHER_USER_ID);
  });

  test("상위 부서장은 하위 부서 headId 변경 가능", async () => {
    // LEADER_ID는 fakeParentDept.headId — 따라서 하위 부서(DEPT_ID)의 head를 변경할 수 있다
    const repo = makeRepo({
      findById: jest.fn()
        .mockResolvedValueOnce({ ...fakeDept, parentId: PARENT_DEPT_ID }) // dept
        .mockResolvedValueOnce(fakeParentDept),                            // parent (headId=LEADER_ID)
      findUserById: jest.fn().mockResolvedValue(fakeOtherUser),
    });
    const svc = new DepartmentService(repo);
    const result = await svc.updateHead(DEPT_ID, OTHER_USER_ID, LEADER_ID, "FRONT_OFFICE");
    expect(result).toEqual({ ok: true });
  });

  test("비 상위부서장 + 비 admin → 403 FORBIDDEN", async () => {
    const repo = makeRepo({
      findById: jest.fn()
        .mockResolvedValueOnce({ ...fakeDept, parentId: PARENT_DEPT_ID })
        .mockResolvedValueOnce({ ...fakeParentDept, headId: 999 }), // 요청자와 다른 headId
    });
    const svc = new DepartmentService(repo);
    await expect(
      svc.updateHead(DEPT_ID, OTHER_USER_ID, MEMBER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  test("자기 자신 임명 → 403 SELF_HEAD_APPOINTMENT_FORBIDDEN", async () => {
    const repo = makeRepo({
      findById: jest.fn()
        .mockResolvedValueOnce(fakeDept)
        .mockResolvedValueOnce(fakeParentDept),
    });
    const svc = new DepartmentService(repo);
    await expect(
      svc.updateHead(DEPT_ID, ADMIN_ID, ADMIN_ID, "ADMIN")
    ).rejects.toMatchObject({ statusCode: 403, code: "SELF_HEAD_APPOINTMENT_FORBIDDEN" });
  });

  test("최상위 부서(parentId없음) 비 admin → 403 FORBIDDEN", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakeRootDept), // parentId: null
    });
    const svc = new DepartmentService(repo);
    await expect(
      svc.updateHead(DEPT_ID, OTHER_USER_ID, MEMBER_ID, "FRONT_OFFICE")
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  test("최상위 부서 admin → 통과", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakeRootDept),
      findUserById: jest.fn().mockResolvedValue(fakeOtherUser),
    });
    const svc = new DepartmentService(repo);
    const result = await svc.updateHead(DEPT_ID, OTHER_USER_ID, ADMIN_ID, "ADMIN");
    expect(result).toEqual({ ok: true });
  });

  test("새 head 유저 없으면 404 USER_NOT_FOUND", async () => {
    const repo = makeRepo({
      findById: jest.fn()
        .mockResolvedValueOnce(fakeDept)
        .mockResolvedValueOnce(fakeParentDept),
      findUserById: jest.fn().mockResolvedValue(null),
    });
    const svc = new DepartmentService(repo);
    await expect(
      svc.updateHead(DEPT_ID, OTHER_USER_ID, ADMIN_ID, "ADMIN")
    ).rejects.toMatchObject({ statusCode: 404, code: "USER_NOT_FOUND" });
  });

  test("audit log 호출", async () => {
    const repo = makeRepo({
      findById: jest.fn()
        .mockResolvedValueOnce(fakeDept)
        .mockResolvedValueOnce(fakeParentDept),
      findUserById: jest.fn().mockResolvedValue(fakeOtherUser),
    });
    const svc = new DepartmentService(repo);
    await svc.updateHead(DEPT_ID, OTHER_USER_ID, ADMIN_ID, "ADMIN");
    await Promise.resolve();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DEPARTMENT_HEAD_CHANGED" })
    );
  });
});
