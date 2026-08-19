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
      where: { seasonId, deletedAt: null },
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

  softDelete(id: number, reason: string) {
    return this.prisma.operatingExpense.update({
      where: { id },
      data: { deletedAt: new Date(), deletionReason: reason },
    });
  }

  // 보존기간(10년) 만료분 실제 삭제 — cron 전용
  purgeExpired() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 10);
    return this.prisma.operatingExpense.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
  }
}
