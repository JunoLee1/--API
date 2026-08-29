import type { PrismaClient } from "../generated/client";
import type { BudgetAutomationService } from "../budget-automation/budget-automation.service";
import type { ExpenseCategoryService } from "../expense-category/expense-category.service";

type Prisma = Pick<PrismaClient, "season" | "financialReport" | "budgetCategoryPlan" | "budgetTier">;

export interface DraftCreationResult {
  nextSeasonId: number;
  draftReportId: number;
}

export async function createDraftForNextSeason(
  prisma: Prisma,
  budgetAutomationService: Pick<BudgetAutomationService, "preview">,
  expenseCategoryService: Pick<ExpenseCategoryService, "resolveCategoryId">,
  closedSeasonId: number,
): Promise<DraftCreationResult | null> {
  const closed = await prisma.season.findUnique({
    where: { id: closedSeasonId },
    select: { endDate: true },
  });
  if (!closed) return null;

  const nextSeason = await prisma.season.findFirst({
    where: { startDate: { gt: closed.endDate } },
    orderBy: { startDate: "asc" },
    select: { id: true },
  });
  if (!nextSeason) return null;

  const existing = await prisma.financialReport.findUnique({
    where: { seasonId: nextSeason.id },
    select: { id: true, planStatus: true },
  });
  if (existing && existing.planStatus !== "FINALIZED") {
    return null;
  }

  const preview = await budgetAutomationService.preview({
    targetSeasonId: nextSeason.id,
    revenueGoal: "MAINTAIN",
    expenseGoal: "MAINTAIN",
  });

  const now = new Date();
  const report = await prisma.financialReport.upsert({
    where: { seasonId: nextSeason.id },
    create: {
      seasonId: nextSeason.id,
      totalRevenue: preview.revenue.total,
      planStatus: "DRAFT",
      planStatusChangedAt: now,
    },
    update: {
      totalRevenue: preview.revenue.total,
      planStatus: "DRAFT",
      planStatusChangedAt: now,
    },
  });

  const categoryEntries = await Promise.all(
    Object.entries(preview.expense.byCategory).map(async ([code, prediction], idx) => ({
      categoryId: await expenseCategoryService.resolveCategoryId(code),
      predicted: prediction.predicted,
      sortOrder: idx,
    })),
  );

  await prisma.budgetCategoryPlan.createMany({
    data: categoryEntries.map((c) => ({
      financialReportId: report.id,
      categoryId: c.categoryId,
      mandatoryMinimum: 0,
      sortOrder: c.sortOrder,
    })),
    skipDuplicates: true,
  });

  const plans = await prisma.budgetCategoryPlan.findMany({
    where: { financialReportId: report.id },
    select: { id: true, categoryId: true },
  });
  const planByCategory = new Map(plans.map((p) => [p.categoryId, p.id]));

  await prisma.budgetTier.createMany({
    data: categoryEntries.map((c) => ({
      categoryPlanId: planByCategory.get(c.categoryId)!,
      name: "Basic",
      cost: c.predicted,
      value: 0,
      isSelected: true,
      sortOrder: 0,
    })),
    skipDuplicates: true,
  });

  return { nextSeasonId: nextSeason.id, draftReportId: report.id };
}
