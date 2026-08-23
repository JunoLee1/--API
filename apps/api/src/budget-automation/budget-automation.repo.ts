import { PrismaClient, OperatingCategory } from "../generated/client";

export class BudgetAutomationRepository {
  constructor(private prisma: PrismaClient) {}

  getTargetSeason(seasonId: number) {
    return this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, name: true, startDate: true },
    });
  }

  getPastSeasons(beforeDate: Date, limit: number) {
    return this.prisma.season.findMany({
      where: { startDate: { lt: beforeDate } },
      orderBy: { startDate: "desc" },
      take: limit,
      select: { id: true, name: true, startDate: true },
    });
  }

  getExpenseActualsByCategory(seasonIds: number[]) {
    return this.prisma.operatingExpense.groupBy({
      by: ["seasonId", "category"],
      where: {
        seasonId: { in: seasonIds },
        status: { in: ["APPROVED", "PAID"] },
        deletedAt: null,
      },
      _sum: { amount: true },
    });
  }

  async getLatestApprovedBudgetLines(seasonId: number) {
    const header = await this.prisma.budgetHeader.findFirst({
      where: { seasonId, status: { in: ["APPROVED", "LOCKED"] } },
      include: { lines: { select: { category: true, originalAmount: true } } },
      orderBy: { createdAt: "desc" },
    });
    return header?.lines ?? [];
  }

  createHeaderWithLines(
    data: {
      seasonId: number;
      name: string;
      totalBudget: number;
      note?: string;
      createdById: number;
    },
    lines: Array<{ category: OperatingCategory; categoryId: number; originalAmount: number; year: number }>
  ) {
    return this.prisma.$transaction(async (tx) => {
      const header = await tx.budgetHeader.create({
        data: {
          seasonId: data.seasonId,
          name: data.name,
          totalBudget: data.totalBudget,
          note: data.note ?? null,
          createdById: data.createdById,
        },
      });
      await tx.budgetLine.createMany({
        data: lines.map((l) => ({
          budgetHeaderId: header.id,
          category: l.category,
          categoryId: l.categoryId,
          originalAmount: l.originalAmount,
          year: l.year,
        })),
      });
      return tx.budgetHeader.findUniqueOrThrow({
        where: { id: header.id },
        include: { lines: true },
      });
    });
  }
}
