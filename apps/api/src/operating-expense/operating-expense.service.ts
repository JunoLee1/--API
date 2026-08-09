import { AppError } from "../lib/appError";
import { OperatingExpenseRepository } from "./operating-expense.repo";
import { OperatingCategory } from "../generated/client";

const DISCRETIONARY: OperatingCategory[] = ["TRAVEL", "EQUIPMENT", "SCOUTING", "YOUTH"];

export class OperatingExpenseService {
  constructor(private repo: OperatingExpenseRepository) {}

  list(seasonId: number) {
    return this.repo.findBySeasonId(seasonId);
  }

  async create(data: {
    seasonId: number;
    category: OperatingCategory;
    amount: number;
    date: string;
    note?: string;
    createdById: number;
    requesterRole: string;
    overrideReason?: string;
  }) {
    if (data.amount <= 0) throw new AppError(400, "INVALID_AMOUNT");
    if (!DISCRETIONARY.includes(data.category)) {
      throw new AppError(400, "INVALID_CATEGORY");
    }

    const plan = await this.repo.findBudgetPlan(data.seasonId, data.category);
    if (!plan) throw new AppError(400, "BUDGET_PLAN_NOT_FOUND");

    const ceiling = plan.mandatoryMinimum + (plan.knapsackAllocated ?? 0);
    const currentSpend = await this.repo.sumSpendBySeasonAndCategory(data.seasonId, data.category);

    if (currentSpend + data.amount > ceiling) {
      if (data.requesterRole === "ADMIN" && data.overrideReason) {
        await this.repo.createOverrideLog({
          financialReportId: plan.financialReportId,
          category: data.category,
          amount: data.amount,
          reason: data.overrideReason,
          createdById: data.createdById,
        });
      } else {
        throw new AppError(400, "BUDGET_EXCEEDED");
      }
    }

    return this.repo.create({ ...data, date: new Date(data.date) });
  }

  async delete(id: number, requesterId: number, requesterRole: string) {
    const expense = await this.repo.findById(id);
    if (!expense) throw new AppError(404, "NOT_FOUND");
    if (expense.createdById !== requesterId && requesterRole !== "ADMIN") {
      throw new AppError(403, "FORBIDDEN");
    }
    return this.repo.delete(id);
  }
}
