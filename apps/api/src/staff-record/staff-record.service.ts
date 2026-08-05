import { StaffRecordRepository } from "./staff-record.repo";
import { AppError } from "../lib/appError";

export class StaffRecordService {
  constructor(private repo: StaffRecordRepository) {}

  async list(includeInactive = false) {
    return this.repo.findAll(includeInactive);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "STAFF_RECORD_NOT_FOUND");
    return record;
  }

  async create(
    data: { name: string; role: string; departmentId?: number; phone?: string; notes?: string; email?: string; employeeId?: string },
    createdById: number
  ) {
    if (data.email) {
      const existing = await this.repo.findByEmail(data.email);
      if (existing) throw new AppError(409, "STAFF_ALREADY_EXISTS");
    }
    if (data.employeeId) {
      const existing = await this.repo.findByEmployeeId(data.employeeId);
      if (existing) throw new AppError(409, "STAFF_ALREADY_EXISTS");
    }
    return this.repo.create({ ...data, createdById });
  }

  async update(
    id: number,
    data: { name?: string; role?: string; departmentId?: number | null; phone?: string; isActive?: boolean; notes?: string }
  ) {
    await this.get(id);
    return this.repo.update(id, data);
  }

  async delete(id: number) {
    await this.get(id);
    return this.repo.delete(id);
  }

  async terminate(id: number) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(404, "STAFF_RECORD_NOT_FOUND");
    return this.repo.terminate(id, new Date());
  }
}
