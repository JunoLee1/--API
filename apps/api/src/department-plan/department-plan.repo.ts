import { PrismaClient } from "../generated/client";
import type { Prisma } from "../generated/client";
import { OperatingCategory } from "../generated/enums";
import {
  CreateDepartmentPlanDto,
  UpdateDepartmentPlanDto,
  ListDepartmentPlanQuery,
} from "./dto/department-plan.dto";

const PLAN_INCLUDE = {
  department: { select: { id: true, name: true, headId: true } },
  createdBy: { select: { id: true, username: true } },
  reviewedBy: { select: { id: true, username: true } },
  budgetItems: true,
  kpiItems: true,
  reviews: {
    include: {
      reviewerDept: { select: { id: true, name: true } },
      confirmedBy: { select: { id: true, username: true } },
    },
  },
};

export class DepartmentPlanRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(filters: ListDepartmentPlanQuery) {
    return this.prisma.departmentAnnualPlan.findMany({
      where: {
        ...(filters.seasonId && { seasonId: Number(filters.seasonId) }),
        ...(filters.departmentId && { departmentId: Number(filters.departmentId) }),
        ...(filters.status && { status: filters.status as any }),
      },
      include: PLAN_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.departmentAnnualPlan.findUnique({
      where: { id },
      include: PLAN_INCLUDE,
    });
  }

  async create(dto: CreateDepartmentPlanDto, createdById: number) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.departmentAnnualPlan.create({
        data: {
          seasonId: dto.seasonId,
          departmentId: dto.departmentId,
          objectives: dto.objectives ?? [],
          milestones: (dto.milestones ?? []) as Prisma.InputJsonValue,
          createdById,
        },
      });

      if (dto.budgetItems?.length) {
        await tx.departmentBudgetItem.createMany({
          data: dto.budgetItems.map((b) => ({
            planId: plan.id,
            category: b.category as OperatingCategory,
            amount: b.amount,
          })),
        });
      }

      if (dto.kpiItems?.length) {
        await tx.departmentKpiItem.createMany({
          data: dto.kpiItems.map((k) => ({
            planId: plan.id,
            title: k.title,
            targetValue: k.targetValue,
            quarter: k.quarter ?? null,
          })),
        });
      }

      return tx.departmentAnnualPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: PLAN_INCLUDE,
      });
    });
  }

  async update(id: number, dto: UpdateDepartmentPlanDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.departmentAnnualPlan.update({
        where: { id },
        data: {
          ...(dto.objectives !== undefined && { objectives: dto.objectives }),
          ...(dto.milestones !== undefined && {
            milestones: dto.milestones as Prisma.InputJsonValue,
          }),
        },
      });

      if (dto.budgetItems !== undefined) {
        await tx.departmentBudgetItem.deleteMany({ where: { planId: id } });
        if (dto.budgetItems.length) {
          await tx.departmentBudgetItem.createMany({
            data: dto.budgetItems.map((b) => ({
              planId: id,
              category: b.category as OperatingCategory,
              amount: b.amount,
            })),
          });
        }
      }

      if (dto.kpiItems !== undefined) {
        await tx.departmentKpiItem.deleteMany({ where: { planId: id } });
        if (dto.kpiItems.length) {
          await tx.departmentKpiItem.createMany({
            data: dto.kpiItems.map((k) => ({
              planId: id,
              title: k.title,
              targetValue: k.targetValue,
              quarter: k.quarter ?? null,
            })),
          });
        }
      }

      return tx.departmentAnnualPlan.findUniqueOrThrow({
        where: { id },
        include: PLAN_INCLUDE,
      });
    });
  }

  async submit(id: number) {
    // 해당 부서의 검토 부서 목록 조회
    const plan = await this.prisma.departmentAnnualPlan.findUniqueOrThrow({ where: { id } });
    const reviewerDeptIds = await this.prisma.departmentReviewerConfig
      .findMany({
        where: { subjectDepartmentId: plan.departmentId },
        select: { reviewerDepartmentId: true },
      })
      .then((rows) => rows.map((r) => r.reviewerDepartmentId));

    return this.prisma.$transaction(async (tx) => {
      if (reviewerDeptIds.length > 0) {
        await tx.planReview.createMany({
          data: reviewerDeptIds.map((reviewerDeptId) => ({ planId: id, reviewerDeptId })),
          skipDuplicates: true,
        });
      }
      return tx.departmentAnnualPlan.update({
        where: { id },
        data: { status: "REVIEWING", submittedAt: new Date() },
        include: PLAN_INCLUDE,
      });
    });
  }

  async allReviewsComplete(planId: number): Promise<boolean> {
    const total = await this.prisma.planReview.count({ where: { planId } });
    if (total === 0) return true;
    const confirmed = await this.prisma.planReview.count({
      where: { planId, status: "CONFIRMED" },
    });
    return total === confirmed;
  }

  async withReviewStatus(plan: { id: number } & Record<string, any>) {
    const total = await this.prisma.planReview.count({ where: { planId: plan.id } });
    const confirmed = await this.prisma.planReview.count({
      where: { planId: plan.id, status: "CONFIRMED" },
    });
    return {
      ...plan,
      allReviewsComplete: total === 0 || total === confirmed,
      reviewProgress: { total, confirmed },
    };
  }

  approve(id: number, reviewedById: number) {
    return this.prisma.departmentAnnualPlan.update({
      where: { id },
      data: { status: "APPROVED", reviewedById, reviewedAt: new Date() },
      include: PLAN_INCLUDE,
    });
  }

  reject(id: number, reviewedById: number, reason: string) {
    // 반려 후 바로 DRAFT로 복귀, rejectionReason 보존
    return this.prisma.departmentAnnualPlan.update({
      where: { id },
      data: {
        status: "DRAFT",
        reviewedById,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      include: PLAN_INCLUDE,
    });
  }

  async budgetSummary(seasonId: number) {
    const items = await this.prisma.departmentBudgetItem.findMany({
      where: {
        plan: {
          seasonId,
          status: "APPROVED",
        },
      },
      include: {
        plan: {
          include: {
            department: { select: { id: true, name: true, headId: true } },
          },
        },
      },
    });

    // Group by department + category
    const grouped: Record<
      string,
      {
        departmentId: number;
        departmentName: string;
        category: string;
        total: number;
      }
    > = {};

    for (const item of items) {
      const key = `${item.plan.departmentId}:${item.category}`;
      if (!grouped[key]) {
        grouped[key] = {
          departmentId: item.plan.departmentId,
          departmentName: item.plan.department.name,
          category: item.category,
          total: 0,
        };
      }
      grouped[key].total += item.amount;
    }

    return Object.values(grouped);
  }
}
