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
    // userId가 속한 부서 조회
    const membership = await this.prisma.userDepartment.findFirst({
      where: { userId },
      select: { departmentId: true },
    });
    if (!membership) throw new AppError(403, "NOT_A_DEPARTMENT_MEMBER");

    // 해당 계획서에 대해 이 부서가 검토자인지 확인
    const review = await this.prisma.planReview.findUnique({
      where: {
        planId_reviewerDeptId: { planId, reviewerDeptId: membership.departmentId },
      },
    });
    if (!review) throw new AppError(403, "NOT_A_REVIEWER");
    if (review.status === "CONFIRMED") throw new AppError(409, "ALREADY_CONFIRMED");

    // 계획서가 REVIEWING 상태인지 확인
    const plan = await this.prisma.departmentAnnualPlan.findUnique({ where: { id: planId } });
    if (!plan || plan.status !== "REVIEWING") throw new AppError(409, "PLAN_NOT_IN_REVIEWING");

    return this.repo.confirm(planId, membership.departmentId, userId, comment);
  }
}
