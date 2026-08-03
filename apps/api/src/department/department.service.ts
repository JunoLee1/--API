import { DepartmentRepository } from "./department.repo";
import { AppError } from "../lib/appError";
import type { DepartmentCategory } from "../generated/enums";

export class DepartmentService {
  constructor(private repo: DepartmentRepository) {}

  list() {
    return this.repo.findAll();
  }

  async get(id: number) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new AppError(404, "DEPARTMENT_NOT_FOUND");
    return dept;
  }

  async create(data: { name: string; parentId?: number; category?: DepartmentCategory | null }) {
    const existing = await this.repo.findByName(data.name);
    if (existing) throw new AppError(409, "DEPARTMENT_NAME_CONFLICT");
    if (data.parentId !== undefined) {
      const parent = await this.repo.findById(data.parentId);
      if (!parent) throw new AppError(404, "PARENT_DEPARTMENT_NOT_FOUND");
    }
    return this.repo.create(data);
  }

  async update(id: number, data: { name?: string; isActive?: boolean; parentId?: number | null; category?: DepartmentCategory | null }) {
    await this.get(id);
    if (data.name !== undefined) {
      const existing = await this.repo.findByName(data.name);
      if (existing && existing.id !== id) throw new AppError(409, "DEPARTMENT_NAME_CONFLICT");
    }
    if (data.parentId !== undefined && data.parentId !== null) {
      const parent = await this.repo.findById(data.parentId);
      if (!parent) throw new AppError(404, "PARENT_DEPARTMENT_NOT_FOUND");
    }
    return this.repo.update(id, data);
  }

  async delete(id: number) {
    const dept = await this.get(id);
    if (dept.children && dept.children.length > 0)
      throw new AppError(409, "DEPARTMENT_HAS_CHILDREN");
    return this.repo.delete(id);
  }
}
