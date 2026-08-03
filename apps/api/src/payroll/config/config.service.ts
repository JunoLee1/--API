import { AppError } from "../../lib/appError";
import type { ConfigRepository } from "./config.repo";
import type { CreatePayrollConfigDto, UpdatePayrollConfigDto, PayrollConfigListQuery } from "./dto/config.dto";

export class ConfigService {
  constructor(private repo: ConfigRepository) {}

  list(query: PayrollConfigListQuery) {
    return this.repo.findAll(query);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "PAYROLL_CONFIG_NOT_FOUND");
    return record;
  }

  create(dto: CreatePayrollConfigDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdatePayrollConfigDto) {
    await this.get(id);
    return this.repo.update(id, dto);
  }
}
