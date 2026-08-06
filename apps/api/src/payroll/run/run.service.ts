import { AppError } from "../../lib/appError";
import type { RunRepository } from "./run.repo";
import type { SalaryRepository } from "../salary/salary.repo";
import type { ConfigRepository } from "../config/config.repo";
import type { CreateRunDto } from "./dto/run.dto";
import type { LedgerService } from "../../ledger/ledger.service";

export function computePayroll(
  baseSalary: number,
  allowancesTotal: number,
  configs: { employeeRate: number }[],
): { grossPay: number; totalDeductions: number; netPay: number } {
  const grossPay = parseFloat((baseSalary + allowancesTotal).toFixed(2));
  const totalDeductions = parseFloat(
    configs.reduce((sum, c) => sum + grossPay * c.employeeRate, 0).toFixed(2),
  );
  const rawNetPay = parseFloat((grossPay - totalDeductions).toFixed(2));
  if (rawNetPay < 0) {
    throw new AppError(400, "NEGATIVE_NET_PAY");
  }
  const netPay = rawNetPay;
  return { grossPay, totalDeductions, netPay };
}

export class RunService {
  constructor(
    private runRepo: RunRepository,
    private salaryRepo: SalaryRepository,
    private configRepo: ConfigRepository,
    private ledgerService: LedgerService,
  ) {}

  async list(salaryId: number) {
    const salary = await this.salaryRepo.findById(salaryId);
    if (!salary) throw new AppError(404, "SALARY_NOT_FOUND");
    return this.runRepo.findAll(salaryId);
  }

  async createRun(salaryId: number, dto: CreateRunDto) {
    const salary = await this.salaryRepo.findById(salaryId);
    if (!salary) throw new AppError(404, "SALARY_NOT_FOUND");

    const raw = new Date(dto.month);
    const month = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), 1));

    const existing = await this.runRepo.findByMonth(salaryId, month);
    if (existing) throw new AppError(409, "PAYROLL_RUN_ALREADY_EXISTS");

    const activeConfigs = await this.configRepo.findActiveForCountry(salary.country, month);
    if (activeConfigs.length === 0) throw new AppError(422, "NO_PAYROLL_CONFIG_FOR_COUNTRY");

    const allowancesTotal = salary.allowances.reduce(
      (sum, a) => sum + a.amount.toNumber(),
      0,
    );

    const { grossPay, totalDeductions, netPay } = computePayroll(
      salary.baseSalary.toNumber(),
      allowancesTotal,
      activeConfigs.map((c) => ({ employeeRate: c.employeeRate.toNumber() })),
    );

    return this.runRepo.create({ staffSalaryId: salaryId, month, grossPay, totalDeductions, netPay });
  }

  async secondApproveRun(salaryId: number, runId: number, userId: number) {
    const run = await this.runRepo.findById(runId);
    if (!run || run.staffSalaryId !== salaryId) {
      throw new AppError(404, "PAYROLL_RUN_NOT_FOUND");
    }
    if (run.isLocked) {
      throw new AppError(400, "PAYROLL_RUN_ALREADY_LOCKED");
    }
    if (run.status !== "CONFIRMED") {
      throw new AppError(400, "PAYROLL_RUN_NOT_CONFIRMED");
    }
    if (run.confirmedById === userId) {
      throw new AppError(403, "CANNOT_SECOND_APPROVE_OWN_CONFIRMATION");
    }
    const updated = await this.runRepo.secondApprove(runId, userId);
    void this.ledgerService.createAutoEntry({
      type: "EXPENSE",
      category: "SALARY",
      amount: Number(updated.netPay),
      currency: "KRW",
      exchangeRate: 1,
      amountKrw: Number(updated.netPay),
      description: `급여 지급 - salaryId ${salaryId} runId ${runId}`,
      relatedModule: "payroll",
      relatedId: runId,
    }, userId).catch(err => console.error("[LedgerAutoEntry:payroll]", err));
    return updated;
  }

  async confirmRun(salaryId: number, runId: number, userId: number) {
    const salary = await this.salaryRepo.findById(salaryId);
    if (!salary) throw new AppError(404, "SALARY_NOT_FOUND");

    const run = await this.runRepo.findById(runId);
    if (!run || run.staffSalaryId !== salaryId) throw new AppError(404, "PAYROLL_RUN_NOT_FOUND");
    if (run.status === "CONFIRMED") throw new AppError(409, "ALREADY_CONFIRMED");

    return this.runRepo.update(runId, {
      status: "CONFIRMED",
      confirmedById: userId,
      confirmedAt: new Date(),
    });
  }
}
