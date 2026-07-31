import { PrismaClient } from "../generated/client";

export interface PeriodRange {
  start: Date;
  end: Date;
}

export interface HeadcountSnapshot {
  players: { active: number; onLoan: number; total: number };
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
  distribution: { label: string; count: number }[];
}

export class HrReportRepository {
  constructor(private prisma: PrismaClient) {}

  async getHeadcount(): Promise<HeadcountSnapshot> {
    const [playerCounts, userCounts, staffActive] = await Promise.all([
      this.prisma.player.groupBy({
        by: ["status"],
        where: { status: { in: ["ACTIVE", "ON_LOAN"] } },
        _count: { id: true },
      }),
      this.prisma.user.groupBy({
        by: ["role"],
        where: { isDeleted: false },
        _count: { id: true },
      }),
      this.prisma.staffRecord.count({ where: { isActive: true } }),
    ]);

    const pActive = playerCounts.find((r) => r.status === "ACTIVE")?._count.id ?? 0;
    const pOnLoan = playerCounts.find((r) => r.status === "ON_LOAN")?._count.id ?? 0;
    const uAdmin = userCounts.find((r) => r.role === "ADMIN")?._count.id ?? 0;
    const uFO = userCounts.find((r) => r.role === "FRONT_OFFICE")?._count.id ?? 0;
    const uCS = userCounts.find((r) => r.role === "COACHING_STAFF")?._count.id ?? 0;

    return {
      players: { active: pActive, onLoan: pOnLoan, total: pActive + pOnLoan },
      users: { admin: uAdmin, frontOffice: uFO, coachingStaff: uCS, total: uAdmin + uFO + uCS },
      staffRecords: { active: staffActive },
    };
  }

  async getTransferMovements(period: PeriodRange): Promise<TransferMovements> {
    const [transferCounts, permanentIn, permanentOut, newContracts] = await Promise.all([
      this.prisma.transfer.groupBy({
        by: ["type"],
        where: { date: { gte: period.start, lte: period.end } },
        _count: { id: true },
      }),
      this.prisma.transfer.count({
        where: {
          type: "PERMANENT",
          fromClub: { not: null },
          toClub: null,
          date: { gte: period.start, lte: period.end },
        },
      }),
      this.prisma.transfer.count({
        where: {
          type: "PERMANENT",
          toClub: { not: null },
          fromClub: null,
          date: { gte: period.start, lte: period.end },
        },
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
      { type: "PERMANENT_IN", count: permanentIn },
    ].filter((r) => r.count > 0);

    const outRows = [
      { type: "LOAN_OUT", count: countFor("LOAN_OUT") },
      { type: "RELEASE", count: countFor("RELEASE") },
      { type: "PERMANENT_OUT", count: permanentOut },
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

    return {
      total: present + absentUnauthorized + lateUnauthorized + absentAuthorized,
      present,
      absentUnauthorized,
      lateUnauthorized,
      absentAuthorized,
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

  async getWageAnalysis(): Promise<WageAnalysis> {
    const RANGES = [
      { label: "300만 미만", min: 0, max: 3_000_000 },
      { label: "300~500만", min: 3_000_000, max: 5_000_000 },
      { label: "500~1000만", min: 5_000_000, max: 10_000_000 },
      { label: "1000만+", min: 10_000_000, max: Infinity },
    ];

    const [agg, contracts] = await Promise.all([
      this.prisma.contract.aggregate({
        where: { status: "ACTIVE" },
        _sum: { salary: true },
        _avg: { salary: true },
        _min: { salary: true },
        _max: { salary: true },
        _count: { id: true },
      }),
      this.prisma.contract.findMany({
        where: { status: "ACTIVE" },
        select: { salary: true },
      }),
    ]);

    const distribution = RANGES.map(({ label, min, max }) => ({
      label,
      count: contracts.filter((c) => c.salary >= min && c.salary < max).length,
    }));

    return {
      totalAnnualWage: (agg._sum.salary ?? 0) * 12,
      avgSalary: Math.round(agg._avg.salary ?? 0),
      minSalary: agg._min.salary ?? 0,
      maxSalary: agg._max.salary ?? 0,
      playerCount: agg._count.id,
      distribution,
    };
  }
}
