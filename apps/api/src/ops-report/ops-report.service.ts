import { PrismaClient } from "../generated/client";
import { OpsReportRepository, OpsSnapshotData } from "./ops-report.repo";

export class OpsReportService {
  constructor(
    private repo: OpsReportRepository,
    private prisma: PrismaClient,
  ) {}

  async computeOpsKpi(seasonId: number, year: number, month: number): Promise<OpsSnapshotData> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [
      totalFees, paidFees, delinquentFees,
      totalBudgetCeiling, totalActualSpend,
      overrideCount,
      totalRegistrations, approvedRegistrations,
      sessions,
      presentResults,
      totalNotifications, readNotifications,
    ] = await Promise.all([
      // AcademyFee uses year/month fields, not createdAt, for period filtering
      this.prisma.academyFee.count({ where: { year, month } }),
      this.prisma.academyFee.count({ where: { year, month, status: "PAID" } }),
      this.prisma.academyFee.count({ where: { year, month, status: { in: ["OVERDUE", "LOCKED"] } } }),
      this.prisma.budgetCategoryPlan.findMany({
        where: { financialReport: { seasonId } },
        select: { mandatoryMinimum: true, knapsackAllocated: true },
      }).then((plans) => plans.reduce((sum, p) => sum + p.mandatoryMinimum + (p.knapsackAllocated ?? 0), 0)),
      this.prisma.operatingExpense.aggregate({
        where: { seasonId },
        _sum: { amount: true },
      }).then((r) => r._sum.amount ?? 0),
      this.prisma.budgetOverrideLog.count({
        where: { financialReport: { seasonId }, createdAt: { gte: start, lt: end } },
      }),
      // YouthRegistration has no seasonId — filter by month window via createdAt
      this.prisma.youthRegistration.count({ where: { createdAt: { gte: start, lt: end } } }),
      this.prisma.youthRegistration.count({
        where: { createdAt: { gte: start, lt: end }, status: "CONTRACTED" },
      }),
      // TrainingSession has seasonId directly
      this.prisma.trainingSession.findMany({
        where: { seasonId, date: { gte: start, lt: end }, isApproved: true },
        select: { id: true },
      }),
      // TrainingResult.attendance (not attendanceStatus)
      this.prisma.trainingResult.count({
        where: {
          session: { seasonId, date: { gte: start, lt: end }, isApproved: true },
          attendance: "PRESENT",
        },
      }),
      this.prisma.notification.count({ where: { createdAt: { gte: start, lt: end } } }),
      this.prisma.notification.count({ where: { createdAt: { gte: start, lt: end }, readAt: { not: null } } }),
    ]);

    const totalSessions = sessions.length;
    const rate = (num: number, den: number) => den === 0 ? 0 : Math.round((num / den) * 1000) / 10;

    return {
      feeCollectionRate: rate(paidFees, totalFees),
      feeDelinquencyRate: rate(delinquentFees, totalFees),
      monthlySettlementRate: rate(paidFees, totalFees),
      budgetExecutionRate: rate(totalActualSpend, totalBudgetCeiling),
      overrideCount,
      registrationRate: rate(approvedRegistrations, totalRegistrations),
      attendanceRate: totalSessions === 0 ? 0 : rate(presentResults, totalSessions * 25),
      noticeReadRate: rate(readNotifications, totalNotifications),
    };
  }

  async getOpsSnapshot(seasonId: number, year: number, month: number): Promise<OpsSnapshotData> {
    const existing = await this.repo.findOpsSnapshot(seasonId, year, month);
    if (existing) return existing.snapshotData as unknown as OpsSnapshotData;
    return this.computeOpsKpi(seasonId, year, month);
  }

  async getAnnualOpsReport(seasonId: number) {
    const snapshots = await this.repo.findOpsSnapshotsBySeason(seasonId);
    return snapshots.map((s) => ({
      year: s.year,
      month: s.month,
      data: s.snapshotData as unknown as OpsSnapshotData,
    }));
  }

  async computeBudgetSnapshot(seasonId: number, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const plans = await this.prisma.budgetCategoryPlan.findMany({
      where: { financialReport: { seasonId } },
      select: { category: true, mandatoryMinimum: true, knapsackAllocated: true },
    });

    const snapshotData: Record<string, { budget: number; actual: number }> = {};
    let totalBudget = 0;
    let totalActual = 0;

    for (const plan of plans) {
      const budget = plan.mandatoryMinimum + (plan.knapsackAllocated ?? 0);
      const actual = await this.prisma.operatingExpense.aggregate({
        where: { seasonId, category: plan.category, date: { gte: start, lt: end } },
        _sum: { amount: true },
      }).then((r) => r._sum.amount ?? 0);
      snapshotData[plan.category] = { budget, actual };
      totalBudget += budget;
      totalActual += actual;
    }

    return { snapshotData, totalBudget, totalActual };
  }

  async getBudgetSnapshot(seasonId: number, year: number, month: number) {
    const existing = await this.repo.findBudgetSnapshot(seasonId, year, month);
    if (existing) return existing;
    const { snapshotData, totalBudget, totalActual } = await this.computeBudgetSnapshot(seasonId, year, month);
    return { snapshotData, totalBudget, totalActual };
  }

  async getAnnualBudgetReport(seasonId: number) {
    return this.repo.findBudgetSnapshotsBySeason(seasonId);
  }
}
