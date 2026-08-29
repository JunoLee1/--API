import type { PrismaClient } from "../generated/client";
import type { BudgetAutomationService } from "../budget-automation/budget-automation.service";
import type { ExpenseCategoryService } from "../expense-category/expense-category.service";
import type { GoalWeight, BudgetPreviewResponse } from "../budget-automation/dto/budget-automation.dto";
import { calculateCapacity, validateInvariants } from "./capacity";
import { AppError } from "../lib/appError";

type Prisma = Pick<PrismaClient, "season" | "financialReport" | "budgetCategoryPlan" | "budgetTier">;

export interface DraftCreationResult {
  nextSeasonId: number;
  draftReportId: number;
  planStatus: "DRAFT" | "CAPACITY_FAILED";
}

interface RunPreviewArgs {
  prisma: Prisma;
  budgetAutomationService: Pick<BudgetAutomationService, "preview">;
  expenseCategoryService: Pick<ExpenseCategoryService, "resolveCategoryId">;
  nextSeasonId: number;
  reportId: number;
  goal: GoalWeight;
}

interface BasicTierProbe {
  categoryId: number;
  cost: number;
  mandatoryMinimum: number;
}

async function runPreviewAndPersistBasics(args: RunPreviewArgs): Promise<{
  preview: BudgetPreviewResponse;
  basicTiers: BasicTierProbe[];
}> {
  const preview = await args.budgetAutomationService.preview({
    targetSeasonId: args.nextSeasonId,
    revenueGoal: args.goal,
    expenseGoal: args.goal,
  });

  const categoryEntries = await Promise.all(
    Object.entries(preview.expense.byCategory).map(async ([code, prediction], idx) => ({
      categoryId: await args.expenseCategoryService.resolveCategoryId(code),
      predicted: prediction.predicted,
      sortOrder: idx,
    })),
  );

  await args.prisma.budgetCategoryPlan.createMany({
    data: categoryEntries.map((c) => ({
      financialReportId: args.reportId,
      categoryId: c.categoryId,
      mandatoryMinimum: 0,
      sortOrder: c.sortOrder,
    })),
    skipDuplicates: true,
  });

  const plans = await args.prisma.budgetCategoryPlan.findMany({
    where: { financialReportId: args.reportId },
    select: { id: true, categoryId: true, mandatoryMinimum: true },
  });
  const planByCategory = new Map(plans.map((p) => [p.categoryId, p]));

  // 재시도 시 기존 Basic 티어 제거 후 재생성 (CONSERVATIVE 결과 반영)
  await args.prisma.budgetTier.deleteMany({
    where: {
      name: "Basic",
      categoryPlan: { financialReportId: args.reportId },
    },
  });
  await args.prisma.budgetTier.createMany({
    data: categoryEntries.map((c) => ({
      categoryPlanId: planByCategory.get(c.categoryId)!.id,
      name: "Basic",
      cost: c.predicted,
      value: 0,
      isSelected: true,
      sortOrder: 0,
    })),
    skipDuplicates: true,
  });

  return {
    preview,
    basicTiers: categoryEntries.map((c) => ({
      categoryId: c.categoryId,
      cost: c.predicted,
      mandatoryMinimum: planByCategory.get(c.categoryId)?.mandatoryMinimum ?? 0,
    })),
  };
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

  const now = new Date();
  const report = await prisma.financialReport.upsert({
    where: { seasonId: nextSeason.id },
    create: {
      seasonId: nextSeason.id,
      totalRevenue: 0,
      planStatus: "DRAFT",
      planStatusChangedAt: now,
    },
    update: {
      planStatus: "DRAFT",
      planStatusChangedAt: now,
      note: null,
    },
  });
  const capReport = {
    totalOperatingBudget: (report as any).totalOperatingBudget ?? null,
    contingencyReserve: (report as any).contingencyReserve ?? null,
  };

  // Step 1: MAINTAIN preview → Basic 티어
  const first = await runPreviewAndPersistBasics({
    prisma,
    budgetAutomationService,
    expenseCategoryService,
    nextSeasonId: nextSeason.id,
    reportId: report.id,
    goal: "MAINTAIN",
  });

  // Step 2: invariant → 위반 시 즉시 CAPACITY_FAILED
  const invariantResult1 = checkInvariants(first.basicTiers);
  if (invariantResult1) {
    await failWithReason(prisma, report.id, invariantResult1);
    return { nextSeasonId: nextSeason.id, draftReportId: report.id, planStatus: "CAPACITY_FAILED" };
  }

  // Step 3: capacity 계산
  let capacity = calculateCapacity(capReport, first.basicTiers.map((b) => ({ cost: b.cost })));
  if (capacity >= 0) {
    return { nextSeasonId: nextSeason.id, draftReportId: report.id, planStatus: "DRAFT" };
  }

  // Step 4: CONSERVATIVE 재시도
  const second = await runPreviewAndPersistBasics({
    prisma,
    budgetAutomationService,
    expenseCategoryService,
    nextSeasonId: nextSeason.id,
    reportId: report.id,
    goal: "CONSERVATIVE",
  });

  const invariantResult2 = checkInvariants(second.basicTiers);
  if (invariantResult2) {
    await failWithReason(prisma, report.id, invariantResult2);
    return { nextSeasonId: nextSeason.id, draftReportId: report.id, planStatus: "CAPACITY_FAILED" };
  }

  capacity = calculateCapacity(capReport, second.basicTiers.map((b) => ({ cost: b.cost })));
  if (capacity >= 0) {
    return { nextSeasonId: nextSeason.id, draftReportId: report.id, planStatus: "DRAFT" };
  }

  const basicSum = second.basicTiers.reduce((s, b) => s + b.cost, 0);
  const reason = `capacity insufficient after CONSERVATIVE retry: totalOperatingBudget=${capReport.totalOperatingBudget}, basicSum=${basicSum}, contingency=${capReport.contingencyReserve}`;
  await failWithReason(prisma, report.id, reason);
  // TODO(#404): GM alert via NotificationService.notifyBudgetPlanEvent({ event: "CAPACITY_FAILED", ... })
  console.warn(`[budget-plan] CAPACITY_FAILED seasonId=${nextSeason.id}: ${reason}`);
  return { nextSeasonId: nextSeason.id, draftReportId: report.id, planStatus: "CAPACITY_FAILED" };
}

function checkInvariants(basics: BasicTierProbe[]): string | null {
  try {
    validateInvariants(
      basics.map((b) => ({
        categoryId: b.categoryId,
        mandatoryMinimum: b.mandatoryMinimum,
        basicCost: b.cost,
      })),
    );
    return null;
  } catch (err) {
    if (err instanceof AppError && err.code === "BASIC_BELOW_MANDATORY_MIN") {
      return err.message;
    }
    throw err;
  }
}

async function failWithReason(prisma: Prisma, reportId: number, reason: string): Promise<void> {
  await prisma.financialReport.update({
    where: { id: reportId },
    data: {
      planStatus: "CAPACITY_FAILED",
      planStatusChangedAt: new Date(),
      note: reason,
    },
  });
}
