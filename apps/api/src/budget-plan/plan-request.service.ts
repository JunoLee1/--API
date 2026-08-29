import type { PrismaClient, TriggerType } from "../generated/client";
import { AppError } from "../lib/appError";
import { resolveRequesterScope, assertCategoryScopeMatch, type CategoryScope } from "./scope";

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
  constructor(private prisma: PrismaClient) {}

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
    // TODO(#404): NotificationService.notifyBudgetPlanEvent({ event: "REVIEW_OPENED", ... })
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
}
