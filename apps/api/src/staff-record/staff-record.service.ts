import { StaffRecordRepository } from "./staff-record.repo";

export class StaffRecordService {
  constructor(private repo: StaffRecordRepository) {}

  async list(includeInactive = false) {
    return this.repo.findAll(includeInactive);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new Error("NOT_FOUND");
    return record;
  }

  async create(
    data: { name: string; role: string; department?: string; phone?: string; notes?: string },
    createdById: number
  ) {
    return this.repo.create({ ...data, createdById });
  }

  async update(
    id: number,
    data: { name?: string; role?: string; department?: string; phone?: string; isActive?: boolean; notes?: string }
  ) {
    await this.get(id);
    return this.repo.update(id, data);
  }

  async delete(id: number) {
    await this.get(id);
    return this.repo.delete(id);
  }
}
