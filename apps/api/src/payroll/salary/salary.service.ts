import { AppError } from "../../lib/appError";
import type { SalaryRepository } from "./salary.repo";
import type { CreateSalaryDto, UpdateSalaryDto, SalaryListQuery } from "./dto/salary.dto";

export class SalaryService {
  constructor(private repo: SalaryRepository) {}

  list(query: SalaryListQuery) {
    return this.repo.findAll(query);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "SALARY_NOT_FOUND");
    return record;
  }

  async create(dto: CreateSalaryDto) {
    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const closeAt = new Date(effectiveFrom.getTime() - 1);
    await this.repo.closeActive(dto.userId ?? null, dto.staffRecordId ?? null, closeAt);
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateSalaryDto) {
    await this.get(id);
    return this.repo.update(id, dto);
  }
}
