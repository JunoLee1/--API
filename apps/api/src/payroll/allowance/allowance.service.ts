import { AppError } from "../../lib/appError";
import type { AllowanceRepository } from "./allowance.repo";
import type { SalaryRepository } from "../salary/salary.repo";
import type { CreateAllowanceDto, UpdateAllowanceDto } from "./dto/allowance.dto";

export class AllowanceService {
  constructor(
    private repo: AllowanceRepository,
    private salaryRepo: SalaryRepository,
  ) {}

  private async assertSalaryExists(salaryId: number) {
    const salary = await this.salaryRepo.findById(salaryId);
    if (!salary) throw new AppError(404, "SALARY_NOT_FOUND");
  }

  private async getOwnedAllowance(salaryId: number, allowanceId: number) {
    const allowance = await this.repo.findById(allowanceId);
    if (!allowance || allowance.staffSalaryId !== salaryId) {
      throw new AppError(404, "ALLOWANCE_NOT_FOUND");
    }
    return allowance;
  }

  async list(salaryId: number) {
    await this.assertSalaryExists(salaryId);
    return this.repo.findAll(salaryId);
  }

  async create(salaryId: number, dto: CreateAllowanceDto) {
    await this.assertSalaryExists(salaryId);
    return this.repo.create(salaryId, dto);
  }

  async update(salaryId: number, allowanceId: number, dto: UpdateAllowanceDto) {
    await this.assertSalaryExists(salaryId);
    await this.getOwnedAllowance(salaryId, allowanceId);
    return this.repo.update(allowanceId, dto);
  }

  async remove(salaryId: number, allowanceId: number) {
    await this.assertSalaryExists(salaryId);
    await this.getOwnedAllowance(salaryId, allowanceId);
    return this.repo.remove(allowanceId);
  }
}
