import { AppError } from "../lib/appError";
import { OperatingExpenseRepository } from "./operating-expense.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { OperatingCategory } from "../generated/client";
import { getPrisma } from "../lib/prisma";

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

    const expense = await this.repo.create({ ...data, date: new Date(data.date) });

    if (currentSpend + data.amount > ceiling) {
      // 소프트 가드: 생성은 허용, 초과 로그 기록 + FINANCE_MANAGER·GM 알림
      await this.repo.createOverrideLog({
        financialReportId: plan.financialReportId,
        category: data.category,
        amount: data.amount,
        reason: data.overrideReason ?? "예산 초과 자동 기록",
        createdById: data.createdById,
      });

      const notifRepo = new NotificationRepository(getPrisma());
      const overAmount = currentSpend + data.amount - ceiling;
      const getMsg = (lang: string | null) => ({
        title: lang === "en" ? "Budget Exceeded" : "예산 초과",
        body: lang === "en"
          ? `${data.category} budget exceeded by ₩${overAmount.toLocaleString()}.`
          : `${data.category} 예산이 ₩${overAmount.toLocaleString()} 초과됐습니다.`,
      });
      await Promise.allSettled([
        notifRepo.createForFinanceManager("BUDGET_EXCEEDED", getMsg, expense.id),
        notifRepo.createForGM("BUDGET_EXCEEDED", getMsg, expense.id),
      ]);
    }

    return expense;
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
