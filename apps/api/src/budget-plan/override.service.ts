import type { PrismaClient } from "../generated/client";
import { AppError } from "../lib/appError";
import { resolveRequesterScope, assertCategoryScopeMatch, type CategoryScope } from "./scope";

export interface OverrideRequestDto {
  categoryId: number;
  amount: number;
  reason: string;
}

export class BudgetOverrideService {
  constructor(private prisma: PrismaClient) {}

  async requestOverride(
    seasonId: number,
    actorUserId: number,
    dto: OverrideRequestDto,
  ): Promise<{ id: number }> {
    const report = await this.prisma.financialReport.findUnique({
      where: { seasonId },
      select: { id: true, planStatus: true },
    });
    if (!report) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    if (report.planStatus !== "FINALIZED") {
      throw new AppError(409, "INVALID_PLAN_STATUS_TRANSITION");
    }
    if (dto.amount <= 0) throw new AppError(400, "AMOUNT_MUST_BE_POSITIVE");
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new AppError(400, "REASON_REQUIRED");
    }

    // 스코프 검증: 요청자가 해당 카테고리의 스코프와 매칭되어야 함
    const requester = await resolveRequesterScope(actorUserId, this.prisma);
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: dto.categoryId },
      select: { scope: true },
    });
    if (!category) throw new AppError(400, "UNKNOWN_CATEGORY");
    assertCategoryScopeMatch(requester, { scope: category.scope as CategoryScope });

    const log = await this.prisma.budgetOverrideLog.create({
      data: {
        financialReportId: report.id,
        categoryId: dto.categoryId,
        amount: dto.amount,
        reason: dto.reason,
        createdById: actorUserId,
        status: "PENDING",
      },
    });
    return { id: log.id };
  }

  async reviewOverride(
    logId: number,
    reviewerUserId: number,
    decision: "APPROVED" | "REJECTED",
    note?: string,
  ): Promise<void> {
    const log = await this.prisma.budgetOverrideLog.findUnique({
      where: { id: logId },
      select: { id: true, status: true, financialReportId: true, categoryId: true, amount: true },
    });
    if (!log) throw new AppError(404, "OVERRIDE_LOG_NOT_FOUND");
    if (log.status !== "PENDING") throw new AppError(409, "INVALID_OVERRIDE_STATUS_TRANSITION");

    const now = new Date();
    if (decision === "REJECTED") {
      await this.prisma.budgetOverrideLog.update({
        where: { id: logId },
        data: {
          status: "REJECTED",
          reviewedById: reviewerUserId,
          reviewedAt: now,
          reviewNote: note ?? null,
        },
      });
      return;
    }

    // APPROVED: capacity 검증 후 knapsackAllocated 조정
    const plan = await this.prisma.budgetCategoryPlan.findFirst({
      where: { financialReportId: log.financialReportId, categoryId: log.categoryId },
      select: { id: true, knapsackAllocated: true },
    });
    if (!plan) throw new AppError(400, "CATEGORY_PLAN_NOT_FOUND");

    const [allPlans, report] = await Promise.all([
      this.prisma.budgetCategoryPlan.findMany({
        where: { financialReportId: log.financialReportId },
        select: { id: true, knapsackAllocated: true },
      }),
      this.prisma.financialReport.findUnique({
        where: { id: log.financialReportId },
        select: { totalOperatingBudget: true, contingencyReserve: true },
      }),
    ]);
    if (!report) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");

    const otherAllocated = allPlans
      .filter((p) => p.id !== plan.id)
      .reduce((s, p) => s + (p.knapsackAllocated ?? 0), 0);
    const newTotal = otherAllocated + log.amount + (report.contingencyReserve ?? 0);
    const budget = report.totalOperatingBudget ?? 0;
    if (newTotal > budget) {
      throw new AppError(409, "OVERRIDE_EXCEEDS_TOTAL_BUDGET");
    }

    await this.prisma.$transaction([
      this.prisma.budgetOverrideLog.update({
        where: { id: logId },
        data: {
          status: "APPROVED",
          reviewedById: reviewerUserId,
          reviewedAt: now,
          reviewNote: note ?? null,
        },
      }),
      this.prisma.budgetCategoryPlan.update({
        where: { id: plan.id },
        data: { knapsackAllocated: log.amount },
      }),
    ]);
  }
}
