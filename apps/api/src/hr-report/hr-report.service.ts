import { HrReportRepository, PeriodRange } from "./hr-report.repo";
import type { PrismaClient } from "../generated/client";
import { HiringAutomationRepository } from "../hiring-automation/hiring-automation.repo";
import { HiringAutomationService } from "../hiring-automation/hiring-automation.service";
import { AppError } from "../lib/appError";

export function buildPeriod(year: number, month: number): PeriodRange {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

export function computeTurnoverRate(departures: number, startCount: number, endCount: number): number {
  const avg = (startCount + endCount) / 2;
  if (avg === 0) return 0;
  return Math.round((departures / avg) * 10000) / 100;
}

export function computeAttendanceRate(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 1000) / 10;
}

export function computeStaffTurnoverRate(terminated: number, avgHeadcount: number): number {
  if (avgHeadcount === 0) return 0;
  return Math.round((terminated / avgHeadcount) * 10000) / 100;
}

export class HrReportService {
  constructor(private repo: HrReportRepository) {}

  async getMonthly(year: number, month: number) {
    const period = buildPeriod(year, month);

    const [headcount, transfers, attendance, issues, openHiring] = await Promise.all([
      this.repo.getHeadcount(),
      this.repo.getTransferMovements(period),
      this.repo.getAttendance(period),
      this.repo.getIssues(period),
      this.repo.getOpenHiringCounts(),
    ]);

    const startOwnCount = Math.max(0, headcount.players.own + transfers.totalOut - transfers.totalIn);
    const turnoverRate = computeTurnoverRate(transfers.totalOut, startOwnCount, headcount.players.own);
    const attendanceRate = computeAttendanceRate(attendance.present, attendance.total);

    const changes: string[] = [];
    if (transfers.totalIn > 0) changes.push(`이적 영입 ${transfers.totalIn}명`);
    if (transfers.totalOut > 0) changes.push(`이적 방출 ${transfers.totalOut}명`);
    if (issues.totalIncidents > 0) changes.push(`사건·사고 ${issues.totalIncidents}건 발생`);
    if (issues.newInjuries > 0) changes.push(`신규 부상 ${issues.newInjuries}명`);

    const netChange = transfers.totalIn - transfers.totalOut;
    return {
      period: { year, month },
      executiveSummary: {
        keyChanges: changes.slice(0, 3),
        playerHeadline: `자체 선수 ${headcount.players.own}명 · 임대 영입 ${headcount.players.loanIn}명 (전월 대비 ${netChange >= 0 ? "+" : ""}${netChange})`,
      },
      headcount,
      recruitment: {
        transfersIn: transfers.totalIn,
        transfersOut: transfers.totalOut,
        inBreakdown: transfers.in,
        outBreakdown: transfers.out,
        newContractsStarted: transfers.newContractsStarted,
        openCoachingRounds: openHiring.coachingRounds,
        openJobPostings: openHiring.jobPostings,
      },
      turnover: {
        arrivals: transfers.totalIn,
        departures: transfers.totalOut,
        netChange,
        turnoverRate,
      },
      attendance: { ...attendance, attendanceRate },
      issues,
    };
  }

  async getAnnual(year: number) {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const [monthlyData, wageAnalysis, { terminated: staffTerminated, totalActive: staffActive }] = await Promise.all([
      Promise.all(months.map((m) => this.getMonthly(year, m))),
      this.repo.getWageAnalysis(),
      this.repo.getStaffTurnoverCount({ start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)) }),
    ]);
    const staffTurnoverRate = computeStaffTurnoverRate(staffTerminated, staffActive);

    const totalDepartures = monthlyData.reduce((s, m) => s + m.turnover.departures, 0);
    const totalArrivals = monthlyData.reduce((s, m) => s + m.turnover.arrivals, 0);
    const totalIncidents = monthlyData.reduce((s, m) => s + m.issues.totalIncidents, 0);
    const totalInjuries = monthlyData.reduce((s, m) => s + m.issues.newInjuries, 0);
    const avgHeadcount = Math.round(monthlyData.reduce((s, m) => s + m.headcount.players.total, 0) / 12);
    const annualTurnoverRate = computeTurnoverRate(
      totalDepartures,
      monthlyData[0]!.headcount.players.total,
      monthlyData[11]!.headcount.players.total,
    );
    const avgAttendanceRate =
      Math.round((monthlyData.reduce((s, m) => s + m.attendance.attendanceRate, 0) / 12) * 10) / 10;

    const monthlyBreakdown = monthlyData.map((m) => ({
      month: m.period.month,
      headcount: m.headcount.players.total,
      turnoverRate: m.turnover.turnoverRate,
      attendanceRate: m.attendance.attendanceRate,
      incidents: m.issues.totalIncidents,
    }));

    const incidentByType = monthlyData
      .flatMap((m) => m.issues.incidents)
      .reduce<Record<string, number>>((acc, r) => {
        acc[r.type] = (acc[r.type] ?? 0) + r.count;
        return acc;
      }, {});

    const peakMonth = monthlyData.reduce(
      (best, m) =>
        m.turnover.departures > best.departures
          ? { month: m.period.month, departures: m.turnover.departures }
          : best,
      { month: 0, departures: 0 },
    ).month;

    const worstMonth = monthlyData.reduce(
      (best, m) =>
        m.attendance.attendanceRate < best.rate
          ? { month: m.period.month, rate: m.attendance.attendanceRate }
          : best,
      { month: 0, rate: 101 },
    ).month;

    return {
      year,
      kpi: { totalRecruitment: totalArrivals, annualTurnoverRate, avgAttendanceRate, totalIncidents, avgHeadcount },
      monthlyBreakdown,
      recruitment: { totalIn: totalArrivals, totalOut: totalDepartures },
      wageAnalysis,
      staffTurnover: {
        terminated: staffTerminated,
        avgHeadcount: staffActive,
        rate: staffTurnoverRate,
      },
      turnover: { annualRate: annualTurnoverRate, totalDepartures, peakMonth },
      attendance: {
        annualRate: avgAttendanceRate,
        worstMonth,
        totalAbsences: monthlyData.reduce(
          (s, m) => s + m.attendance.absentUnauthorized + m.attendance.lateUnauthorized,
          0,
        ),
      },
      issues: {
        total: totalIncidents,
        byType: Object.entries(incidentByType).map(([type, count]) => ({ type, count })),
        totalInjuries,
      },
    };
  }

  async getHiringPriorityQueue(prisma: PrismaClient) {
    const season = await prisma.season.findFirst({ where: { status: "ACTIVE" } });
    if (!season?.leagueLevel) throw new AppError(400, "NO_ACTIVE_SEASON");

    const settings = await prisma.clubSettings.findFirst();
    const ibiBeta = settings?.ibiBeta ?? 1.0;

    const autoRepo = new HiringAutomationRepository(prisma);
    const autoService = new HiringAutomationService(autoRepo);
    return autoService.computePriorityQueue(
      { id: season.id, leagueLevel: season.leagueLevel as any },
      ibiBeta,
    );
  }
}
