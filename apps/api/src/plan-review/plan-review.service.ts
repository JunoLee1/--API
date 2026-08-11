import { PrismaClient } from "../generated/client";
import { AppError } from "../lib/appError";
import { PlanReviewRepository } from "./plan-review.repo";

export class PlanReviewService {
  constructor(
    private repo: PlanReviewRepository,
    private prisma: PrismaClient,
  ) {}

  list(planId: number) {
    return this.repo.findByPlan(planId);
  }

  async confirm(planId: number, userId: number, comment?: string) {
    // 사용자가 부서장(headId)인 부서 중 해당 계획서의 reviewer 부서를 단일 쿼리로 확인
    const review = await this.prisma.planReview.findFirst({
      where: {
        planId,
        reviewerDept: { headId: userId },
      },
    });
    if (!review) throw new AppError(403, "NOT_A_REVIEWER");
    if (review.status === "CONFIRMED") throw new AppError(409, "ALREADY_CONFIRMED");

    const plan = await this.prisma.planReport.findUnique({ where: { id: planId } });
    if (!plan || plan.status !== "REVIEWING") throw new AppError(409, "PLAN_NOT_IN_REVIEWING");

    return this.repo.confirm(planId, review.reviewerDeptId, userId, comment);
  }
}
