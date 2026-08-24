import { PrismaClient, ExpenseStatus, ExpenseCostType } from "../generated/client";

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

  findBudgetLinesForSeasonCategory(seasonId: number, categoryId: number) {
    return this.prisma.budgetLine.findMany({
      where: {
        categoryId,
        budgetHeader: { seasonId, status: "APPROVED" },
      },
      select: { id: true, departmentId: true, originalAmount: true },
    });
  }

  /**
   * Look up an APPROVED BudgetLine matching (season, category, departmentId).
   * Used by AssetRequest dept-head approval to auto-match a line. Pass
   * `departmentId: null` explicitly to look up club-wide lines. If more than one
   * line exists for the tuple (year vs monthly split), the most specific (monthly
   * for current month, else year-only) wins.
   */
  async findBudgetLineForSeasonCategoryDept(params: {
    seasonId: number;
    categoryId: number;
    departmentId: number | null;
    date?: Date;
  }) {
    const date = params.date ?? new Date();
    const candidates = await this.prisma.budgetLine.findMany({
      where: {
        categoryId: params.categoryId,
        departmentId: params.departmentId,
        year: date.getFullYear(),
        budgetHeader: { seasonId: params.seasonId, status: "APPROVED" },
      },
      select: { id: true, originalAmount: true, month: true, year: true, departmentId: true },
    });
    if (candidates.length === 0) return null;
    const currentMonth = date.getMonth() + 1;
    const monthly = candidates.find((c) => c.month === currentMonth);
    if (monthly) return monthly;
    const yearOnly = candidates.find((c) => c.month === null);
    if (yearOnly) return yearOnly;
    return candidates[0] ?? null;
  }

  async createWithBudgetCheck(data: {
    seasonId: number;
    categoryId: number;
    costType?: ExpenseCostType;
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
          ...(data.costType && { costType: data.costType }),
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
