import type { PrismaClient, TriggerType } from "../generated/client";
import { AppError } from "../lib/appError";
import { resolveRequesterScope, assertCategoryScopeMatch, type CategoryScope } from "./scope";
import { promoteTiers, type PromotedTier } from "./promotion";
import type { KnapsackService, KnapsackGroup } from "../budget/knapsack.service";
import type { BudgetPlanNotifyHook } from "./draft";

interface Reviewer {
  userId: number;
  email: string | null;
  language: string | null;
  scope: "TEAM" | "DEPARTMENT";
  ownerId: number;
}
export type BudgetPlanReviewersFn = () => Promise<Reviewer[]>;

const REVIEW_WINDOW_DAYS = 14;
const REVIEW_WINDOW_MS = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface SubmitLineDto {
  categoryId: number;
  triggers: TriggerType[];
  standardDelta: number;
  premiumDelta: number;
  evidenceUrl?: string;
  comment?: string;
}

export class BudgetPlanRequestService {
  constructor(
    private prisma: PrismaClient,
    private knapsackService?: KnapsackService,
    private notifyHook?: BudgetPlanNotifyHook,
    private reviewersFn?: BudgetPlanReviewersFn,
  ) {}

  async openReview(seasonId: number, actorUserId: number): Promise<void> {
    const report = await this.prisma.financialReport.findUnique({
      where: { seasonId },
      select: { id: true, planStatus: true },
    });
    if (!report) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    if (report.planStatus !== "DRAFT") {
      throw new AppError(409, "INVALID_PLAN_STATUS_TRANSITION");
    }
    const now = new Date();
    await this.prisma.financialReport.update({
      where: { id: report.id },
      data: {
        planStatus: "AWAITING_REVIEW",
        planStatusChangedAt: now,
        planStatusChangedById: actorUserId,
        reviewOpenedAt: now,
        reviewDeadline: new Date(now.getTime() + REVIEW_WINDOW_MS),
      },
    });
    if (this.notifyHook && this.reviewersFn) {
      const reviewers = await this.reviewersFn();
      await this.notifyHook("REVIEW_OPENED", {
        seasonId,
        deadline: new Date(now.getTime() + REVIEW_WINDOW_MS),
        reviewers,
      });
    }
  }

  async submit(seasonId: number, actorUserId: number, lines: SubmitLineDto[]) {
    const report = await this.prisma.financialReport.findUnique({
      where: { seasonId },
      select: { id: true, planStatus: true },
    });
    if (!report) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    if (report.planStatus !== "AWAITING_REVIEW") {
      throw new AppError(409, "INVALID_PLAN_STATUS_TRANSITION");
    }

    const requester = await resolveRequesterScope(actorUserId, this.prisma);

    if (lines.length === 0) throw new AppError(400, "NO_LINES");

    const categoryIds = lines.map((l) => l.categoryId);
    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, scope: true },
    });
    const catById = new Map(categories.map((c) => [c.id, c.scope as CategoryScope]));
    for (const line of lines) {
      const catScope = catById.get(line.categoryId);
      if (!catScope) throw new AppError(400, "UNKNOWN_CATEGORY");
      assertCategoryScopeMatch(requester, { scope: catScope });
    }

    const now = new Date();
    const request = await this.prisma.budgetPlanRequest.create({
      data: {
        financialReportId: report.id,
        requestedById: actorUserId,
        scope: requester.scope,
        ownerType: requester.scope,
        ownerId: requester.ownerId,
        status: "SUBMITTED",
        submittedAt: now,
      },
    });

    await this.prisma.budgetPlanRequestLine.createMany({
      data: lines.map((l) => ({
        requestId: request.id,
        categoryId: l.categoryId,
        triggers: l.triggers,
        standardDelta: l.standardDelta,
        premiumDelta: l.premiumDelta,
        evidenceUrl: l.evidenceUrl ?? null,
        comment: l.comment ?? null,
      })),
    });

    // TODO(#404): 심사 신청 접수 알림 (in-app to FinanceManager)
    return request;
  }

  async list(seasonId: number) {
    return this.prisma.budgetPlanRequest.findMany({
      where: { financialReport: { seasonId } },
      include: { lines: true },
      orderBy: { submittedAt: "desc" },
    });
  }

  async executeKnapsack(seasonId: number, actorUserId: number): Promise<void> {
    if (!this.knapsackService) throw new AppError(500, "KNAPSACK_SERVICE_NOT_INJECTED");

    const report = await this.prisma.financialReport.findUnique({
      where: { seasonId },
      select: {
        id: true,
        planStatus: true,
        reviewDeadline: true,
        totalOperatingBudget: true,
        contingencyReserve: true,
      },
    });
    if (!report) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    if (report.planStatus !== "AWAITING_REVIEW") {
      throw new AppError(409, "INVALID_PLAN_STATUS_TRANSITION");
    }

    // 조기 실행 검증: reviewDeadline 전이면 모든 팀장·부서장이 신청 완료해야 함
    const now = new Date();
    const deadlinePassed = report.reviewDeadline != null && now >= report.reviewDeadline;
    if (!deadlinePassed) {
      const [expectedTeams, expectedDepts, requests] = await Promise.all([
        this.prisma.team.count({ where: { isActive: true } }),
        this.prisma.department.count({ where: { isActive: true, headId: { not: null } } }),
        this.prisma.budgetPlanRequest.findMany({
          where: { financialReportId: report.id, status: "SUBMITTED" },
          select: { scope: true },
        }),
      ]);
      const teamRequests = requests.filter((r) => r.scope === "TEAM").length;
      const deptRequests = requests.filter((r) => r.scope === "DEPARTMENT").length;
      if (teamRequests < expectedTeams || deptRequests < expectedDepts) {
        throw new AppError(409, "REVIEW_STILL_OPEN");
      }
    }

    // 신청서 + BudgetCategoryPlan + Basic 티어 조회
    const [requests, categoryPlans, basicTiers] = await Promise.all([
      this.prisma.budgetPlanRequest.findMany({
        where: { financialReportId: report.id, status: "SUBMITTED" },
        include: { lines: true },
      }),
      this.prisma.budgetCategoryPlan.findMany({
        where: { financialReportId: report.id },
        select: { id: true, categoryId: true, mandatoryMinimum: true },
      }),
      this.prisma.budgetTier.findMany({
        where: {
          name: "Basic",
          categoryPlan: { financialReportId: report.id },
        },
        select: { id: true, categoryPlanId: true, cost: true },
      }),
    ]);

    // Basic cost map (categoryId → cost)
    const planByCat = new Map(categoryPlans.map((p) => [p.categoryId, p]));
    const basicByPlanId = new Map(basicTiers.map((b) => [b.categoryPlanId, b]));
    const basicByCat = new Map<number, number>();
    for (const plan of categoryPlans) {
      const basic = basicByPlanId.get(plan.id);
      if (basic) basicByCat.set(plan.categoryId, basic.cost);
    }

    // 모든 요청 line 을 단일 리스트로 (같은 카테고리 중복 신청은 스코프 분리로 방지됨)
    const allLines = requests.flatMap((r) => r.lines);
    const promoted = promoteTiers(
      allLines.map((l) => ({
        categoryId: l.categoryId,
        triggers: l.triggers,
        standardDelta: l.standardDelta,
        premiumDelta: l.premiumDelta,
      })),
      basicByCat,
    );

    // 기존 Standard/Premium 티어 제거 후 재생성
    const planIds = categoryPlans.map((p) => p.id);
    await this.prisma.budgetTier.deleteMany({
      where: {
        categoryPlanId: { in: planIds },
        name: { in: ["Standard", "Premium"] },
      },
    });

    const newTiers = promoted
      .filter((t) => t.name !== "Basic")
      .map((t) => {
        const planId = planByCat.get(t.categoryId)!.id;
        return {
          categoryPlanId: planId,
          name: t.name,
          cost: t.cost,
          value: t.value,
          sortOrder: t.sortOrder,
          isSelected: false,
        };
      });
    if (newTiers.length > 0) {
      await this.prisma.budgetTier.createMany({ data: newTiers });
    }

    // Knapsack 입력 구성: Basic 은 제외 (항상 선택), Standard/Premium 만 groups
    // 재조회로 새 tier id 확보
    const allTiersAfter = await this.prisma.budgetTier.findMany({
      where: { categoryPlanId: { in: planIds } },
      select: { id: true, categoryPlanId: true, name: true, cost: true, value: true },
    });
    const groupsByPlan = new Map<number, { basicCost: number; tiers: { id: number; name: string; cost: number; value: number }[] }>();
    for (const t of allTiersAfter) {
      const existing = groupsByPlan.get(t.categoryPlanId) ?? { basicCost: 0, tiers: [] };
      if (t.name === "Basic") existing.basicCost = t.cost;
      else existing.tiers.push({ id: t.id, name: t.name, cost: t.cost, value: t.value });
      groupsByPlan.set(t.categoryPlanId, existing);
    }

    const basicSum = Array.from(groupsByPlan.values()).reduce((s, g) => s + g.basicCost, 0);
    const capacity =
      (report.totalOperatingBudget ?? 0) - basicSum - (report.contingencyReserve ?? 0);

    const groups: KnapsackGroup[] = Array.from(groupsByPlan.entries())
      .filter(([, g]) => g.tiers.length > 0)
      .map(([planId, g]) => ({
        categoryPlanId: planId,
        category: String(planId),
        tiers: g.tiers.map((t) => ({ tierId: t.id, cost: t.cost - g.basicCost, value: t.value })),
      }));

    const result = this.knapsackService.solve({ capacity, groups });

    // 결과 반영: selected tier isSelected=true, BudgetCategoryPlan.knapsackAllocated
    const selectedByPlan = new Map(result.selectedTiers.map((s) => [s.categoryPlanId, s]));
    await Promise.all(
      Array.from(groupsByPlan.entries()).map(async ([planId, g]) => {
        const selected = selectedByPlan.get(planId);
        const allocated = g.basicCost + (selected ? selected.allocated : 0);
        await this.prisma.budgetCategoryPlan.update({
          where: { id: planId },
          data: { knapsackAllocated: allocated },
        });
        if (selected) {
          await this.prisma.budgetTier.updateMany({
            where: { id: selected.tierId },
            data: { isSelected: true },
          });
        }
      }),
    );

    // 상태 전이
    await this.prisma.financialReport.update({
      where: { id: report.id },
      data: {
        planStatus: "KNAPSACK_EXECUTED",
        planStatusChangedAt: now,
        planStatusChangedById: actorUserId,
        knapsackExecutedAt: now,
      },
    });
    await this.prisma.budgetPlanRequest.updateMany({
      where: { financialReportId: report.id, status: "SUBMITTED" },
      data: { status: "PROCESSED", processedAt: now },
    });

    if (this.notifyHook && this.reviewersFn) {
      const reviewers = await this.reviewersFn();
      await this.notifyHook("KNAPSACK_EXECUTED", { seasonId, reviewers });
    }
  }
}
