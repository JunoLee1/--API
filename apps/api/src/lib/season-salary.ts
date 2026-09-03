import type { PrismaClient } from "../generated/client";
import { computeSigningBonusForSeason } from "./signing-bonus";

/**
 * Season-scoped salary aggregation helpers.
 *
 * - Player salary: sum of Contract.salary * (overlapping months / 12) for
 *   ACTIVE contracts whose window intersects the season.
 * - Staff salary planned: StaffSalary.baseSalary + StaffAllowance monthly
 *   amounts, prorated to overlapping months in the season.
 * - Staff salary actual: PayrollRun.grossPay sum where status = "CONFIRMED"
 *   and the run's month falls inside the season window; falls back to
 *   `planned` when no confirmed runs exist yet (early-season anchor).
 *
 * Note: the plan originally specified `status: "PAID"` for the actual mode
 * but the PayrollRunStatus enum only has DRAFT | CONFIRMED.
 */

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

async function overlapPlayerSalary(prisma: PrismaClient, seasonId: number): Promise<number> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { startDate: true, endDate: true },
  });
  if (!season) return 0;
  const contracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: season.endDate },
      endDate: { gte: season.startDate },
    },
    select: { salary: true, signingBonus: true, startDate: true, endDate: true },
  });
  return contracts.reduce((sum, c) => {
    const overlapStart = c.startDate > season.startDate ? c.startDate : season.startDate;
    const overlapEnd = c.endDate < season.endDate ? c.endDate : season.endDate;
    if (overlapEnd <= overlapStart) return sum;
    const months = (overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_MONTH;
    const bonus = computeSigningBonusForSeason(c, season.startDate, season.endDate);
    return sum + (c.salary / 12) * months + bonus;
  }, 0);
}

async function plannedStaffSalary(prisma: PrismaClient, seasonId: number): Promise<number> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { startDate: true, endDate: true },
  });
  if (!season) return 0;
  const salaries = await prisma.staffSalary.findMany({
    where: {
      effectiveFrom: { lte: season.endDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: season.startDate } }],
    },
    select: {
      id: true,
      baseSalary: true,
      effectiveFrom: true,
      effectiveTo: true,
      allowances: { select: { amount: true } },
    },
  });
  return salaries.reduce((sum, s) => {
    const from = s.effectiveFrom > season.startDate ? s.effectiveFrom : season.startDate;
    const to = s.effectiveTo && s.effectiveTo < season.endDate ? s.effectiveTo : season.endDate;
    if (to <= from) return sum;
    const months = (to.getTime() - from.getTime()) / MS_PER_MONTH;
    const baseAnnual = Number(s.baseSalary);
    const allowanceMonthly = s.allowances.reduce((a, x) => a + Number(x.amount), 0);
    return sum + (baseAnnual / 12 + allowanceMonthly) * months;
  }, 0);
}

async function actualStaffSalary(prisma: PrismaClient, seasonId: number): Promise<number> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { startDate: true, endDate: true },
  });
  if (!season) return 0;
  const runs = await prisma.payrollRun.aggregate({
    where: {
      month: { gte: season.startDate, lte: season.endDate },
      status: "CONFIRMED",
    },
    _sum: { grossPay: true },
  });
  return Number(runs._sum.grossPay ?? 0);
}

export async function getSeasonPlayerSalary(
  prisma: PrismaClient,
  seasonId: number,
): Promise<number> {
  return Math.round(await overlapPlayerSalary(prisma, seasonId));
}

export async function getSeasonStaffSalary(
  prisma: PrismaClient,
  seasonId: number,
  mode: "planned" | "actual",
): Promise<number> {
  const planned = await plannedStaffSalary(prisma, seasonId);
  if (mode === "planned") return Math.round(planned);
  const actual = await actualStaffSalary(prisma, seasonId);
  // Fallback: when no confirmed PayrollRuns exist yet, use the planned
  // anchor so the KPI is never 0 just because payroll is not yet run.
  return Math.round(actual > 0 ? actual : planned);
}
