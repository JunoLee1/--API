import { PrismaClient, OperatingCategory } from "../generated/client";

export interface RevenueBreakdownDto {
  revenueTicket?: number;
  revenueSponsorship?: number;
  revenueBroadcast?: number;
  revenueMerchandise?: number;
  revenueSubsidy?: number;
  revenueParentCompany?: number;
  revenueAcademyFee?: number;
  revenueOther?: number;
}

export function sumBreakdown(b: RevenueBreakdownDto): number {
  return (
    (b.revenueTicket ?? 0) +
    (b.revenueSponsorship ?? 0) +
    (b.revenueBroadcast ?? 0) +
    (b.revenueMerchandise ?? 0) +
    (b.revenueSubsidy ?? 0) +
    (b.revenueParentCompany ?? 0) +
    (b.revenueAcademyFee ?? 0) +
    (b.revenueOther ?? 0)
  );
}

export interface UpsertBudgetPlanDto {
  totalOperatingBudget: number;
  contingencyReserve: number;
  categories: {
    category: OperatingCategory;
    mandatoryMinimum: number;
    tiers: { name: string; cost: number; value: number }[];
  }[];
}

export class FinancialReportRepository {
  constructor(private prisma: PrismaClient) {}

  async upsert(seasonId: number, totalRevenue: number, note?: string, breakdown?: RevenueBreakdownDto) {
    const noteVal = note ?? null;
    const breakdownData = breakdown
      ? {
          revenueTicket: breakdown.revenueTicket ?? 0,
          revenueSponsorship: breakdown.revenueSponsorship ?? 0,
          revenueBroadcast: breakdown.revenueBroadcast ?? 0,
          revenueMerchandise: breakdown.revenueMerchandise ?? 0,
          revenueSubsidy: breakdown.revenueSubsidy ?? 0,
          revenueParentCompany: breakdown.revenueParentCompany ?? 0,
          revenueAcademyFee: breakdown.revenueAcademyFee ?? 0,
          revenueOther: breakdown.revenueOther ?? 0,
        }
      : {};
    return (this.prisma.financialReport as any).upsert({
      where: { seasonId },
      create: { seasonId, totalRevenue, note: noteVal, ...breakdownData },
      update: { totalRevenue, note: noteVal, ...breakdownData },
    });
  }

  async findBySeasonId(seasonId: number) {
    return this.prisma.financialReport.findUnique({ where: { seasonId } });
  }

  async upsertBudgetPlan(seasonId: number, dto: UpsertBudgetPlanDto) {
    const report = await this.prisma.financialReport.upsert({
      where: { seasonId },
      create: { seasonId, totalRevenue: 0, totalOperatingBudget: dto.totalOperatingBudget, contingencyReserve: dto.contingencyReserve },
      update: { totalOperatingBudget: dto.totalOperatingBudget, contingencyReserve: dto.contingencyReserve },
      select: { id: true },
    });

    for (const cat of dto.categories) {
      const plan = await this.prisma.budgetCategoryPlan.upsert({
        where: { financialReportId_category: { financialReportId: report.id, category: cat.category } },
        create: { financialReportId: report.id, category: cat.category, mandatoryMinimum: cat.mandatoryMinimum },
        update: { mandatoryMinimum: cat.mandatoryMinimum },
        select: { id: true },
      });

      await this.prisma.budgetTier.deleteMany({ where: { categoryPlanId: plan.id } });
      if (cat.tiers.length > 0) {
        await this.prisma.budgetTier.createMany({
          data: cat.tiers.map((t) => ({ categoryPlanId: plan.id, name: t.name, cost: t.cost, value: t.value })),
        });
      }
    }

    return this.getBudgetPlan(seasonId);
  }

  async getBudgetPlan(seasonId: number) {
    return this.prisma.financialReport.findUnique({
      where: { seasonId },
      include: {
        budgetCategoryPlans: {
          include: { tiers: { orderBy: { cost: "asc" } } },
          orderBy: { category: "asc" },
        },
        overrideLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
  }

  async saveOptimizeResult(
    reportId: number,
    selections: { tierId: number; categoryPlanId: number; allocated: number }[]
  ) {
    await this.prisma.budgetTier.updateMany({
      where: { categoryPlan: { financialReportId: reportId } },
      data: { isSelected: false },
    });
    for (const sel of selections) {
      await this.prisma.budgetTier.update({
        where: { id: sel.tierId },
        data: { isSelected: true },
      });
      await this.prisma.budgetCategoryPlan.update({
        where: { id: sel.categoryPlanId },
        data: { knapsackAllocated: sel.allocated },
      });
    }
  }

  async addOverrideLog(
    reportId: number,
    category: OperatingCategory,
    amount: number,
    reason: string,
    createdById: number
  ) {
    return this.prisma.budgetOverrideLog.create({
      data: { financialReportId: reportId, category, amount, reason, createdById },
    });
  }

  async getActuals(seasonId: number) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { startDate: true, endDate: true },
    });
    if (!season) return null;

    const [medical, operating] = await Promise.all([
      this.prisma.medicalExpense.aggregate({
        where: { status: "APPROVED", receiptDate: { gte: season.startDate, lte: season.endDate } },
        _sum: { totalAmount: true },
      }),
      this.prisma.operatingExpense.groupBy({
        by: ["category"],
        where: { seasonId },
        _sum: { amount: true },
      }),
    ]);

    const result: Record<string, number> = {
      MEDICAL: medical._sum?.totalAmount ?? 0,
    };
    for (const row of operating) {
      result[row.category] = row._sum?.amount ?? 0;
    }
    return result;
  }
}
