import { PrismaClient } from "../generated/client";

export interface PeriodRange {
  start: Date;
  end: Date;
}

export interface HeadcountSnapshot {
  players: {
    own: number;       // 정식 계약 + ON_LOAN 방출 중인 우리 선수
    loanIn: number;    // 타 구단에서 임대 영입한 선수
    onLoanOut: number; // 우리 선수 중 외부 임대 나간 선수
    total: number;     // own + loanIn (현재 우리 팀에서 활동 중인 전체)
  };
  users: { admin: number; frontOffice: number; coachingStaff: number; total: number };
  staffRecords: { active: number };
}

export interface TransferMovements {
  in: { type: string; count: number }[];
  out: { type: string; count: number }[];
  totalIn: number;
  totalOut: number;
  newContractsStarted: number;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absentUnauthorized: number;
  lateUnauthorized: number;
  absentAuthorized: number;
  lateAuthorized: number;
}

export interface IssueSummary {
  incidents: { type: string; count: number }[];
  totalIncidents: number;
  newInjuries: number;
  safeguardReports: number;
}

export interface WageAnalysis {
  totalAnnualWage: number;
  avgSalary: number;
  minSalary: number;
  maxSalary: number;
  playerCount: number;
  staffCount: number;
  totalCount: number;
  distribution: { label: string; count: number }[];
}

export class HrReportRepository {
  constructor(private prisma: PrismaClient) {}

  async getHeadcount(): Promise<HeadcountSnapshot> {
    const now = new Date();
    const [playerCounts, loanInCount, userCounts, staffActive] = await Promise.all([
      this.prisma.player.groupBy({
        by: ["status"],
        where: { status: { in: ["ACTIVE", "ON_LOAN"] } },
        _count: { id: true },
      }),
      // 현재 유효한 LOAN_IN Transfer를 가진 ACTIVE 선수 = 임대 영입 선수
      this.prisma.transfer.count({
        where: {
          type: "LOAN_IN",
          player: { status: "ACTIVE" },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      }),
      this.prisma.user.groupBy({
        by: ["role"],
        where: { isDeleted: false },
        _count: { id: true },
      }),
      this.prisma.staffRecord.count({ where: { isActive: true } }),
    ]);

    const pActive = playerCounts.find((r) => r.status === "ACTIVE")?._count.id ?? 0;
    const pOnLoanOut = playerCounts.find((r) => r.status === "ON_LOAN")?._count.id ?? 0;
    const ownActive = pActive - loanInCount; // ACTIVE에서 LOAN_IN 선수 제외
    const uAdmin = userCounts.find((r) => r.role === "ADMIN")?._count.id ?? 0;
    const uFO = userCounts.find((r) => r.role === "FRONT_OFFICE")?._count.id ?? 0;
    const uCS = userCounts.find((r) => r.role === "COACHING_STAFF")?._count.id ?? 0;

    return {
      players: {
        own: ownActive + pOnLoanOut,
        loanIn: loanInCount,
        onLoanOut: pOnLoanOut,
        total: pActive + pOnLoanOut,
      },
      users: { admin: uAdmin, frontOffice: uFO, coachingStaff: uCS, total: uAdmin + uFO + uCS },
      staffRecords: { active: staffActive },
    };
  }

  async getTransferMovements(period: PeriodRange): Promise<TransferMovements> {
    const [transferCounts, newContracts] = await Promise.all([
      this.prisma.transfer.groupBy({
        by: ["type"],
        where: { date: { gte: period.start, lte: period.end } },
        _count: { id: true },
      }),
      this.prisma.contract.count({
        where: { startDate: { gte: period.start, lte: period.end }, status: "ACTIVE" },
      }),
    ]);

    const countFor = (type: string) =>
      transferCounts.find((r) => r.type === type)?._count.id ?? 0;

    const inRows = [
      { type: "LOAN_IN", count: countFor("LOAN_IN") },
      { type: "FREE", count: countFor("FREE") },
      { type: "PERMANENT_IN", count: countFor("PERMANENT_IN") },
    ].filter((r) => r.count > 0);

    const outRows = [
      { type: "LOAN_OUT", count: countFor("LOAN_OUT") },
      { type: "RELEASE", count: countFor("RELEASE") },
      { type: "PERMANENT_OUT", count: countFor("PERMANENT_OUT") },
    ].filter((r) => r.count > 0);

    return {
      in: inRows,
      out: outRows,
      totalIn: inRows.reduce((s, r) => s + r.count, 0),
      totalOut: outRows.reduce((s, r) => s + r.count, 0),
      newContractsStarted: newContracts,
    };
  }

  async getAttendance(period: PeriodRange): Promise<AttendanceSummary> {
    const rows = await this.prisma.trainingResult.groupBy({
      by: ["attendance"],
      where: { session: { date: { gte: period.start, lte: period.end } } },
      _count: { playerId: true },
    });

    const countFor = (s: string) => rows.find((r) => r.attendance === s)?._count.playerId ?? 0;
    const present = countFor("PRESENT");
    const absentUnauthorized = countFor("ABSENT_UNAUTHORIZED");
    const lateUnauthorized = countFor("LATE_UNAUTHORIZED");
    const absentAuthorized = countFor("ABSENT_AUTHORIZED");
    const lateAuthorized = countFor("LATE_AUTHORIZED");

    return {
      total: present + absentUnauthorized + lateUnauthorized + absentAuthorized + lateAuthorized,
      present,
      absentUnauthorized,
      lateUnauthorized,
      absentAuthorized,
      lateAuthorized,
    };
  }

  async getIssues(period: PeriodRange): Promise<IssueSummary> {
    const [incidentRows, newInjuries, safeguardCount] = await Promise.all([
      this.prisma.incidentReport.groupBy({
        by: ["type"],
        where: { createdAt: { gte: period.start, lte: period.end } },
        _count: { id: true },
      }),
      this.prisma.injury.count({
        where: { occurredAt: { gte: period.start, lte: period.end } },
      }),
      this.prisma.safeguardReport.count({
        where: { createdAt: { gte: period.start, lte: period.end } },
      }),
    ]);

    const incidents = incidentRows.map((r) => ({ type: r.type as string, count: r._count.id }));
    return {
      incidents,
      totalIncidents: incidents.reduce((s, r) => s + r.count, 0),
      newInjuries,
      safeguardReports: safeguardCount,
    };
  }

  async getOpenHiringCounts(): Promise<{ coachingRounds: number; jobPostings: number }> {
    const [coachingRounds, jobPostings] = await Promise.all([
      this.prisma.coachHiringRound.count({ where: { status: "OPEN" } }),
      this.prisma.jobPosting.count({ where: { status: "OPEN" } }),
    ]);
    return { coachingRounds, jobPostings };
  }

  async getWageAnalysis(): Promise<WageAnalysis> {
    const RANGES = [
      { label: "300만 미만", min: 0, max: 3_000_000 },
      { label: "300~500만", min: 3_000_000, max: 5_000_000 },
      { label: "500~1000만", min: 5_000_000, max: 10_000_000 },
      { label: "1000만+", min: 10_000_000, max: Infinity },
    ];

    const [contractAgg, contracts, staffSalaries] = await Promise.all([
      this.prisma.contract.aggregate({
        where: { status: "ACTIVE" },
        _sum: { salary: true },
        _count: { id: true },
      }),
      this.prisma.contract.findMany({
        where: { status: "ACTIVE" },
        select: { salary: true },
      }),
      this.prisma.staffSalary.findMany({
        where: { user: { isDeleted: false } },
        orderBy: { effectiveFrom: "desc" },
        distinct: ["userId", "staffRecordId"],
        select: { baseSalary: true },
      }),
    ]);

    const allSalaries: number[] = [
      ...contracts.map((c) => Number(c.salary)),
      ...staffSalaries.map((s) => Number(s.baseSalary)),
    ];
    const totalCount = allSalaries.length;
    const totalAnnualWage = allSalaries.reduce((s, v) => s + v, 0) * 12;
    const avgSalary = totalCount > 0 ? Math.round(allSalaries.reduce((s, v) => s + v, 0) / totalCount) : 0;
    const minSalary = totalCount > 0 ? Math.min(...allSalaries) : 0;
    const maxSalary = totalCount > 0 ? Math.max(...allSalaries) : 0;

    const distribution = RANGES.map(({ label, min, max }) => ({
      label,
      count: allSalaries.filter((v) => v >= min && v < max).length,
    }));

    return {
      totalAnnualWage,
      avgSalary,
      minSalary,
      maxSalary,
      playerCount: contractAgg._count.id,
      staffCount: staffSalaries.length,
      totalCount,
      distribution,
    };
  }

  async getStaffTurnoverCount(period: PeriodRange): Promise<{ terminated: number; totalActive: number }> {
    const [terminated, totalActive] = await Promise.all([
      this.prisma.staffRecord.count({
        where: { terminatedAt: { gte: period.start, lte: period.end } },
      }),
      this.prisma.staffRecord.count({ where: { isActive: true } }),
    ]);
    return { terminated, totalActive };
  }
}
