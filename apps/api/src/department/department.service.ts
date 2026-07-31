import { DepartmentRepository } from "./department.repo";
import { AppError } from "../lib/appError";

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

  async create(data: { name: string }) {
    const existing = await this.repo.findByName(data.name);
    if (existing) throw new AppError(409, "DEPARTMENT_NAME_CONFLICT");
    return this.repo.create(data);
  }

  async update(id: number, data: { name?: string; isActive?: boolean }) {
    await this.get(id);
    if (data.name) {
      const existing = await this.repo.findByName(data.name);
      if (existing && existing.id !== id) throw new AppError(409, "DEPARTMENT_NAME_CONFLICT");
    }
    return this.repo.update(id, data);
  }

  async delete(id: number) {
    await this.get(id);
    return this.repo.delete(id);
  }
}
