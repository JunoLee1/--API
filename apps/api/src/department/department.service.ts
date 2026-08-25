import { DepartmentRepository } from "./department.repo";
import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";
import { isAdminLike } from "../lib/permissions";
import type { DepartmentCategory, DeptRole } from "../generated/enums";

export class DepartmentService {
  constructor(private repo: DepartmentRepository) {}

  list(clubId?: number | null) {
    return this.repo.findAll(clubId);
  }

  async get(id: number) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new AppError(404, "DEPARTMENT_NOT_FOUND");
    return dept;
  }

  async create(data: { name: string; parentId?: number; category?: DepartmentCategory | null; clubId?: number | null }) {
    const existing = await this.repo.findByName(data.name, data.clubId);
    if (existing) throw new AppError(409, "DEPARTMENT_NAME_CONFLICT");
    if (data.parentId !== undefined) {
      const parent = await this.repo.findById(data.parentId);
      if (!parent) throw new AppError(404, "PARENT_DEPARTMENT_NOT_FOUND");
    }
    return this.repo.create(data);
  }

  async update(id: number, data: { name?: string; isActive?: boolean; parentId?: number | null; category?: DepartmentCategory | null }, actorId?: number, clubId?: number | null) {
    const dept = await this.get(id);
    if (data.name !== undefined) {
      const existing = await this.repo.findByName(data.name, dept.clubId);
      if (existing && existing.id !== id) throw new AppError(409, "DEPARTMENT_NAME_CONFLICT");
    }
    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === id) throw new AppError(400, "DEPARTMENT_CIRCULAR_REFERENCE");
      const parent = await this.repo.findById(data.parentId);
      if (!parent) throw new AppError(404, "PARENT_DEPARTMENT_NOT_FOUND");
      // Walk ancestor chain to detect cycles (Y3)
      let cursor: number | null = parent.parentId ?? null;
      while (cursor !== null) {
        if (cursor === id) throw new AppError(400, "DEPARTMENT_CIRCULAR_REFERENCE");
        const ancestor = await this.repo.findById(cursor);
        cursor = ancestor?.parentId ?? null;
      }
    }
    const result = await this.repo.update(id, data);
    if (actorId != null) {
      await writeAuditLog({ actorId, action: "DEPARTMENT_UPDATED", targetId: id });
    }
    return result;
  }

  async getHeadcount(id: number) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new AppError(404, "DEPARTMENT_NOT_FOUND");
    return this.repo.getHeadcount(id);
  }

  async delete(id: number) {
    const dept = await this.get(id);
    if (dept.children && dept.children.length > 0)
      throw new AppError(409, "DEPARTMENT_HAS_CHILDREN");
    const activeStaffCount = await this.repo.countActiveStaff(id);
    if (activeStaffCount > 0) throw new AppError(409, "DEPARTMENT_HAS_ACTIVE_STAFF");
    return this.repo.delete(id);
  }

  // ── Member CRUD ────────────────────────────────────────────

  private async assertLeaderOrAdmin(deptId: number, userId: number, role: string) {
    if (isAdminLike(role)) return;
    const dept = await this.repo.findById(deptId);
    if (!dept) throw new AppError(404, "DEPARTMENT_NOT_FOUND");
    if (dept.headId !== userId) throw new AppError(403, "NOT_LEADER");
  }

  async listMembers(deptId: number, requesterId: number, role: string) {
    await this.assertLeaderOrAdmin(deptId, requesterId, role);
    return this.repo.findMembers(deptId);
  }

  async addMember(deptId: number, userId: number, memberRole: DeptRole, requesterId: number, role: string) {
    await this.assertLeaderOrAdmin(deptId, requesterId, role);
    const user = await this.repo.findUserById(userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");
    const existing = await this.repo.findMember(deptId, userId);
    if (existing) throw new AppError(400, "ALREADY_MEMBER");
    await this.repo.addMember(deptId, userId, memberRole);
    void writeAuditLog({ actorId: requesterId, action: "TEAM_MEMBER_ADDED", targetId: deptId, detail: { userId, memberRole } }).catch(console.error);
    return { ok: true };
  }

  async updateMemberRole(deptId: number, userId: number, newRole: DeptRole, requesterId: number, role: string) {
    await this.assertLeaderOrAdmin(deptId, requesterId, role);
    if (userId === requesterId) throw new AppError(403, "SELF_ROLE_CHANGE_FORBIDDEN");
    const existing = await this.repo.findMember(deptId, userId);
    if (!existing) throw new AppError(404, "NOT_MEMBER");
    await this.repo.updateMemberRole(deptId, userId, newRole);
    void writeAuditLog({ actorId: requesterId, action: "TEAM_MEMBER_ROLE_CHANGED", targetId: deptId, detail: { userId, newRole } }).catch(console.error);
    return { ok: true };
  }

  async removeMember(deptId: number, userId: number, requesterId: number, role: string) {
    await this.assertLeaderOrAdmin(deptId, requesterId, role);
    if (userId === requesterId) throw new AppError(403, "SELF_REMOVAL_FORBIDDEN");
    const deptCount = await this.repo.countUserDepartments(userId);
    if (deptCount <= 1) throw new AppError(400, "MUST_TRANSFER");
    await this.repo.removeMember(deptId, userId);
    void writeAuditLog({ actorId: requesterId, action: "TEAM_MEMBER_REMOVED", targetId: deptId, detail: { userId } }).catch(console.error);
    return { ok: true };
  }

  async transferMember(fromDeptId: number, toDeptId: number, userId: number, toRole: DeptRole, requesterId: number, role: string) {
    await this.assertLeaderOrAdmin(fromDeptId, requesterId, role);
    if (userId === requesterId) throw new AppError(403, "SELF_TRANSFER_FORBIDDEN");
    if (fromDeptId === toDeptId) throw new AppError(400, "SAME_DEPARTMENT");
    const toDept = await this.repo.findById(toDeptId);
    if (!toDept) throw new AppError(404, "TARGET_DEPT_NOT_FOUND");
    await this.repo.transferMember(fromDeptId, toDeptId, userId, toRole);
    void writeAuditLog({ actorId: requesterId, action: "TEAM_MEMBER_TRANSFERRED", targetId: fromDeptId, detail: { userId, toDeptId, toRole } }).catch(console.error);
    return { ok: true };
  }

  async updateHead(deptId: number, newHeadId: number | null, requesterId: number, role: string) {
    const dept = await this.repo.findById(deptId);
    if (!dept) throw new AppError(404, "DEPARTMENT_NOT_FOUND");
    const parent = dept.parentId ? await this.repo.findById(dept.parentId) : null;
    const isParentHead = parent != null && parent.headId === requesterId;
    if (!isParentHead && !isAdminLike(role)) throw new AppError(403, "FORBIDDEN");
    if (newHeadId === requesterId) throw new AppError(403, "SELF_HEAD_APPOINTMENT_FORBIDDEN");
    if (newHeadId !== null) {
      const newHead = await this.repo.findUserById(newHeadId);
      if (!newHead) throw new AppError(404, "USER_NOT_FOUND");
    }
    const oldHeadId = dept.headId;
    await this.repo.updateHead(deptId, newHeadId);
    void writeAuditLog({ actorId: requesterId, action: "DEPARTMENT_HEAD_CHANGED", targetId: deptId, detail: { oldHeadId, newHeadId } }).catch(console.error);
    return { ok: true };
  }
}
