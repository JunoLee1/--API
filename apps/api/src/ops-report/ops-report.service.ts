import { PrismaClient } from "../generated/client";
import { OpsReportRepository, OpsSnapshotData } from "./ops-report.repo";

export interface NoticeUnreadDrillRow {
  userId: number;
  name: string;
  unreadCount: number;
  unreadTitles: string[];
}

export interface AttendanceDrillRow {
  playerId: string;
  playerName: string;
  position: string | null;
  teamId: number | null;
  present: number;
  lateUnauth: number;
  absentUnauth: number;
  authorizedAbsence: number;
  effectiveAbsences: number;
}

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
      ticketResult,
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
      this.prisma.salesRecord.aggregate({
        where: { type: "TICKET", match: { seasonId } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
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
      ticketRevenue: Number(ticketResult._sum.totalAmount ?? 0),
      ticketSalesCount: ticketResult._count.id,
    };
  }

  async getOpsSnapshot(seasonId: number, year: number, month: number): Promise<OpsSnapshotData> {
    const existing = await this.repo.findOpsSnapshot(seasonId, year, month);
    if (existing?.snapshotData) return existing.snapshotData as unknown as OpsSnapshotData;
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

    const actualsByCategory = await this.prisma.operatingExpense.groupBy({
      by: ["category"],
      where: { seasonId, date: { gte: start, lt: end } },
      _sum: { amount: true },
    });
    const actualsMap = new Map(
      actualsByCategory.map((r) => [r.category, r._sum.amount ?? 0])
    );

    const snapshotData: Record<string, { budget: number; actual: number }> = {};
    let totalBudget = 0;
    let totalActual = 0;

    for (const plan of plans) {
      const budget = plan.mandatoryMinimum + (plan.knapsackAllocated ?? 0);
      const actual = actualsMap.get(plan.category) ?? 0;
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

  async drillNoticeUnread(year: number, month: number): Promise<NoticeUnreadDrillRow[]> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const groups = await this.prisma.notification.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: start, lt: end }, readAt: null },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    if (groups.length === 0) return [];

    const userIds = groups.map((g) => g.userId);
    const [users, notices] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nickname: true },
      }),
      this.prisma.notification.findMany({
        where: { userId: { in: userIds }, createdAt: { gte: start, lt: end }, readAt: null },
        select: { userId: true, title: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u.nickname]));
    const noticesByUser = new Map<number, string[]>();
    for (const n of notices) {
      const titles = noticesByUser.get(n.userId) ?? [];
      titles.push(n.title);
      noticesByUser.set(n.userId, titles);
    }

    return groups.map((g) => ({
      userId: g.userId,
      name: userMap.get(g.userId) ?? "",
      unreadCount: g._count.id,
      unreadTitles: (noticesByUser.get(g.userId) ?? []).slice(0, 5),
    }));
  }

  async drillAttendance(year: number, month: number): Promise<AttendanceDrillRow[]> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const sessions = await this.prisma.trainingSession.findMany({
      where: { date: { gte: start, lt: end }, isApproved: true },
      select: { id: true },
    });

    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);
    const results = await this.prisma.trainingResult.findMany({
      where: { sessionId: { in: sessionIds } },
      select: {
        playerId: true,
        attendance: true,
        player: { select: { playerName: true, position: true, team: { select: { id: true } } } },
      },
    });

    const aggregates = new Map<
      string,
      { playerName: string; position: string | null; teamId: number | null; present: number; lateUnauth: number; absentUnauth: number; authorizedAbsence: number }
    >();

    for (const r of results) {
      if (!aggregates.has(r.playerId)) {
        aggregates.set(r.playerId, {
          playerName: r.player.playerName,
          position: r.player.position,
          teamId: r.player.team?.id ?? null,
          present: 0,
          lateUnauth: 0,
          absentUnauth: 0,
          authorizedAbsence: 0,
        });
      }
      const agg = aggregates.get(r.playerId)!;
      switch (r.attendance) {
        case "PRESENT":
          agg.present++;
          break;
        case "LATE_UNAUTHORIZED":
          agg.lateUnauth++;
          break;
        case "ABSENT_UNAUTHORIZED":
          agg.absentUnauth++;
          break;
        case "ABSENT_AUTHORIZED":
          agg.authorizedAbsence++;
          break;
      }
    }

    const rows: AttendanceDrillRow[] = [];
    for (const [playerId, agg] of aggregates) {
      const effectiveAbsences = agg.absentUnauth + Math.floor(agg.lateUnauth / 3);
      rows.push({ playerId, ...agg, effectiveAbsences });
    }

    rows.sort((a, b) => b.effectiveAbsences - a.effectiveAbsences);
    return rows;
  }

  async getAttendanceCorrectionLog(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return this.prisma.auditLog.findMany({
      where: {
        action: { in: ["ATTENDANCE_CORRECTED", "TRAINING_RESULT_UPDATED"] },
        createdAt: { gte: start, lt: end },
      },
      include: { actor: { select: { id: true, nickname: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async getSalaryDistributionDrilldown(seasonId: number) {
    const contracts = await this.prisma.contract.findMany({
      where: { status: "ACTIVE" },
      select: {
        salary: true,
        player: { select: { id: true, playerName: true, position: true } },
      },
      orderBy: { salary: "desc" },
    });
    const brackets = [0, 100_000_000, 300_000_000, 500_000_000, 1_000_000_000];
    const distribution = brackets.map((min, i) => {
      const max = brackets[i + 1] ?? Infinity;
      const inBracket = contracts.filter((c) => c.salary >= min && c.salary < max);
      return {
        label: max === Infinity ? `${(min / 1e8).toFixed(0)}억+` : `${(min / 1e8).toFixed(0)}-${(max / 1e8).toFixed(0)}억`,
        count: inBracket.length,
        players: inBracket.map((c) => ({ id: c.player.id, name: c.player.playerName, position: c.player.position, salary: c.salary })),
      };
    });
    return distribution;
  }

  async getSessionsWithUnregisteredAttendance(seasonId: number, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const sessions = await this.prisma.trainingSession.findMany({
      where: { seasonId, date: { gte: start, lt: end }, isApproved: true },
      include: {
        _count: { select: { results: true } },
      },
    });
    const totalPlayers = await this.prisma.player.count({
      where: { status: "ACTIVE", team: { type: { not: "YOUTH" } } },
    });
    return sessions.map((s) => ({
      sessionId: s.id,
      date: s.date,
      registeredCount: s._count.results,
      totalPlayers,
      unregisteredCount: Math.max(0, totalPlayers - s._count.results),
    }));
  }

  async getBudgetExecutionByCategory(seasonId: number, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const plans = await this.prisma.budgetCategoryPlan.findMany({
      where: { financialReport: { seasonId } },
      select: { category: true, mandatoryMinimum: true, knapsackAllocated: true },
    });
    const actuals = await this.prisma.operatingExpense.groupBy({
      by: ["category"],
      where: { seasonId, date: { gte: start, lt: end } },
      _sum: { amount: true },
    });
    const actualsMap = new Map(actuals.map((a) => [a.category, a._sum.amount ?? 0]));
    return plans.map((p) => {
      const budget = p.mandatoryMinimum + (p.knapsackAllocated ?? 0);
      const actual = actualsMap.get(p.category) ?? 0;
      return { category: p.category, budget, actual, executionRate: budget === 0 ? 0 : Math.round((actual / budget) * 1000) / 10 };
    });
  }

  async getPartnerKpi(seasonId: number) {
    const partners = await this.prisma.partner.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        _count: { select: { contracts: true } },
      },
    });
    const activeContracts = await this.prisma.partnerContract.findMany({
      where: { status: "ACTIVE" },
      select: { partnerId: true, sponsorshipFee: true },
    });
    const contractsByPartner = new Map<number, number>();
    for (const c of activeContracts) {
      contractsByPartner.set(c.partnerId, (contractsByPartner.get(c.partnerId) ?? 0) + Number(c.sponsorshipFee ?? 0));
    }
    return partners.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      totalContracts: p._count.contracts,
      activeContractValue: contractsByPartner.get(p.id) ?? 0,
    }));
  }

  async getSponsorshipVsBudget(seasonId: number) {
    const report = await this.prisma.financialReport.findFirst({
      where: { seasonId },
      select: { totalRevenue: true },
    });
    const sponsorshipTotal = await this.prisma.sponsorshipPayment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    });
    return {
      plannedRevenue: report?.totalRevenue ?? 0,
      sponsorshipCollected: Number(sponsorshipTotal._sum.amount ?? 0),
      coverageRate: report?.totalRevenue
        ? Math.round((Number(sponsorshipTotal._sum.amount ?? 0) / report.totalRevenue) * 1000) / 10
        : 0,
    };
  }
}
