import { DepartmentRepository } from "./department.repo";
import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";
import type { DepartmentCategory } from "../generated/enums";

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
}
