import { PrismaClient, OperatingCategory } from "../generated/client";

export class OperatingExpenseRepository {
  constructor(private prisma: PrismaClient) {}

  async findBudgetPlan(seasonId: number, category: OperatingCategory) {
    const report = await this.prisma.financialReport.findUnique({
      where: { seasonId },
      include: {
        budgetCategoryPlans: { where: { category } },
      },
    });
    if (!report) return null;
    return report.budgetCategoryPlans[0] ?? null;
  }

  async sumSpendBySeasonAndCategory(seasonId: number, category: OperatingCategory) {
    const result = await this.prisma.operatingExpense.aggregate({
      where: { seasonId, category },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  createOverrideLog(data: {
    financialReportId: number;
    category: OperatingCategory;
    amount: number;
    reason: string;
    createdById: number;
  }) {
    return this.prisma.budgetOverrideLog.create({ data });
  }

  findBySeasonId(seasonId: number) {
    return this.prisma.operatingExpense.findMany({
      where: { seasonId },
      include: { createdBy: { select: { id: true, username: true } } },
      orderBy: { date: "desc" },
    });
  }

  create(data: {
    seasonId: number;
    category: OperatingCategory;
    amount: number;
    date: Date;
    note?: string;
    createdById: number;
  }) {
    return this.prisma.operatingExpense.create({
      data: { ...data, note: data.note ?? null },
      include: { createdBy: { select: { id: true, username: true } } },
    });
  }

  findById(id: number) {
    return this.prisma.operatingExpense.findUnique({ where: { id } });
  }

  delete(id: number) {
    return this.prisma.operatingExpense.delete({ where: { id } });
  }
}
