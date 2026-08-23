import type { PrismaClient } from "../generated/client";

/**
 * Season-level carryover computation.
 *
 * - `computeSeasonNetIncome`: sum of approved MonthlySettlementReport
 *   totalRevenue - totalExpense for the season.
 * - `applyCarryOverToNextSeason`: writes the closed season's net income into
 *   `FinancialReport.carryOverFromPrev` on the next chronological season.
 *   Skips the write when the next season already has a manual override.
 */

export async function computeSeasonNetIncome(
  prisma: PrismaClient,
  seasonId: number,
): Promise<number> {
  const agg = await prisma.monthlySettlementReport.aggregate({
    where: { seasonId, status: "APPROVED" },
    _sum: { totalRevenue: true, totalExpense: true },
  });
  const rev = Number(agg._sum.totalRevenue ?? 0);
  const exp = Number(agg._sum.totalExpense ?? 0);
  return Math.round(rev - exp);
}

export interface ApplyCarryOverResult {
  applied: boolean;
  nextSeasonId?: number;
  amount?: number;
}

export async function applyCarryOverToNextSeason(
  prisma: PrismaClient,
  closedSeasonId: number,
): Promise<ApplyCarryOverResult> {
  const closed = await prisma.season.findUnique({
    where: { id: closedSeasonId },
    select: { endDate: true },
  });
  if (!closed) return { applied: false };

  const next = await prisma.season.findFirst({
    where: { startDate: { gt: closed.endDate } },
    orderBy: { startDate: "asc" },
    select: { id: true },
  });
  if (!next) return { applied: false };

  // Manual override on the next season is authoritative — do not overwrite it.
  const existing = await prisma.financialReport.findUnique({
    where: { seasonId: next.id },
    select: { carryOverOverriddenById: true },
  });
  if (existing?.carryOverOverriddenById) {
    return { applied: false, nextSeasonId: next.id };
  }

  const amount = await computeSeasonNetIncome(prisma, closedSeasonId);
  await prisma.financialReport.upsert({
    where: { seasonId: next.id },
    create: { seasonId: next.id, totalRevenue: 0, carryOverFromPrev: amount },
    update: {
      carryOverFromPrev: amount,
      carryOverOverriddenById: null,
      carryOverOverriddenAt: null,
      carryOverOverrideReason: null,
    },
  });
  return { applied: true, nextSeasonId: next.id, amount };
}
