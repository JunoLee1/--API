import { PrismaClient, ExpenseStatus } from "../generated/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export class OperatingExpenseRepository {
  constructor(private prisma: PrismaClient) {}

  findBySeasonId(seasonId: number) {
    return this.prisma.operatingExpense.findMany({
      where: { seasonId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, username: true } },
        budgetLine: { select: { id: true, originalAmount: true, expenseCategory: { select: { code: true } } } },
        expenseCategory: { select: { code: true } },
      },
      orderBy: { date: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.operatingExpense.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, username: true } },
        budgetLine: { select: { id: true, originalAmount: true, budgetHeaderId: true, expenseCategory: { select: { code: true } } } },
        expenseCategory: { select: { code: true } },
      },
    });
  }

  findBudgetLine(budgetLineId: number) {
    return this.prisma.budgetLine.findUnique({ where: { id: budgetLineId } });
  }

  async createWithBudgetCheck(data: {
    seasonId: number;
    categoryId: number;
    amount: number;
    date: Date;
    note?: string | null;
    createdById: number;
    budgetLineId: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.budgetLine.findUnique({ where: { id: data.budgetLineId } });
      if (!line) throw new Error("BUDGET_LINE_NOT_FOUND");
      if (line.categoryId !== data.categoryId) throw new Error("CATEGORY_MISMATCH");

      const { _sum } = await tx.operatingExpense.aggregate({
        where: {
          budgetLineId: data.budgetLineId,
          deletedAt: null,
          status: { in: ["PENDING", "FIRST_APPROVED", "APPROVED", "PAID"] },
        },
        _sum: { amount: true },
      });
      const used = _sum.amount ?? 0;
      if (used + data.amount > line.originalAmount) throw new Error("BUDGET_EXCEEDED");

      return tx.operatingExpense.create({
        data: {
          seasonId: data.seasonId,
          categoryId: data.categoryId,
          amount: data.amount,
          date: data.date,
          note: data.note ?? null,
          createdById: data.createdById,
          budgetLineId: data.budgetLineId,
          status: "PENDING",
        },
        include: {
          createdBy: { select: { id: true, username: true } },
          budgetLine: { select: { id: true, originalAmount: true, expenseCategory: { select: { code: true } } } },
          expenseCategory: { select: { code: true } },
        },
      });
    });
  }

  updateStatus(
    id: number,
    data: Partial<{
      status: ExpenseStatus;
      firstApprovedById: number;
      firstApprovedAt: Date;
      approvedById: number;
      approvedAt: Date;
      rejectedById: number;
      rejectedAt: Date;
      rejectionReason: string;
      cancelledById: number;
      cancelledAt: Date;
      cancellationReason: string;
      paidAt: Date;
      paidById: number;
    }>
  ) {
    return this.prisma.operatingExpense.update({ where: { id }, data });
  }

  update(id: number, data: { amount?: number; categoryId?: number; note?: string }) {
    return this.prisma.operatingExpense.update({ where: { id }, data });
  }

  async findBudgetPlan(seasonId: number, categoryId: number) {
    const report = await this.prisma.financialReport.findUnique({
      where: { seasonId },
      include: {
        budgetCategoryPlans: { where: { categoryId } },
      },
    });
    if (!report) return null;
    return report.budgetCategoryPlans[0] ?? null;
  }

  async sumSpendBySeasonAndCategory(seasonId: number, categoryId: number) {
    const result = await this.prisma.operatingExpense.aggregate({
      where: { seasonId, categoryId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  softDelete(id: number, reason: string) {
    return this.prisma.operatingExpense.update({
      where: { id },
      data: { deletedAt: new Date(), deletionReason: reason },
    });
  }

  purgeExpired() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 10);
    return this.prisma.operatingExpense.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
  }
}
