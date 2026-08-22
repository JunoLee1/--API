import { getPrisma } from "./prisma";
import { AppError } from "./appError";

/**
 * 특정 시즌의 실제 매출을 소스 테이블에서 집계한다.
 * - Ticket:        SalesRecord TICKET+VIP_TICKET, Match.seasonId 매칭
 * - Sponsorship:   SponsorshipPayment PAID, paidAt in season window
 * - Merchandise:   SalesRecord UNIFORM, saleDate in season window
 * - Other:         SalesRecord OTHER,   saleDate in season window
 * - AcademyFee:    LedgerEntry ACADEMY_FEE INCOME, createdAt in season window
 * - Broadcast/Subsidy/ParentCompany: 소스 테이블 없음. 0 반환. (수동 입력만.)
 *
 * PR C (budget-automation CAGR) 에서도 재사용됨.
 */
export interface SeasonRevenueActuals {
  plannedRevenueTicket: number;
  plannedRevenueSponsorship: number;
  plannedRevenueMerchandise: number;
  plannedRevenueOther: number;
  plannedRevenueAcademyFee: number;
  plannedRevenueBroadcast: number;      // always 0 — manual entry only
  plannedRevenueSubsidy: number;        // always 0 — manual entry only
  plannedRevenueParentCompany: number;  // always 0 — manual entry only
}

export async function getSeasonRevenueActuals(seasonId: number): Promise<SeasonRevenueActuals> {
  const prisma = getPrisma();

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { startDate: true, endDate: true },
  });
  if (!season) throw new AppError(404, "SEASON_NOT_FOUND");

  const [ticketAgg, uniformAgg, otherAgg, sponsorAgg, academyFeeAgg] = await Promise.all([
    prisma.salesRecord.aggregate({
      where: {
        type: { in: ["TICKET", "VIP_TICKET"] as any[] },
        match: { seasonId },
        deletedAt: null,
      } as any,
      _sum: { totalAmount: true },
    }),
    prisma.salesRecord.aggregate({
      where: {
        type: "UNIFORM",
        saleDate: { gte: season.startDate, lte: season.endDate },
        deletedAt: null,
      } as any,
      _sum: { totalAmount: true },
    }),
    prisma.salesRecord.aggregate({
      where: {
        type: "OTHER",
        saleDate: { gte: season.startDate, lte: season.endDate },
        deletedAt: null,
      } as any,
      _sum: { totalAmount: true },
    }),
    prisma.sponsorshipPayment.aggregate({
      where: { status: "PAID", paidAt: { gte: season.startDate, lte: season.endDate } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        category: "ACADEMY_FEE",
        type: "INCOME",
        createdAt: { gte: season.startDate, lte: season.endDate },
      },
      _sum: { amountKrw: true },
    }),
  ]);

  return {
    plannedRevenueTicket:        Number((ticketAgg._sum as any).totalAmount ?? 0),
    plannedRevenueSponsorship:   Number(sponsorAgg._sum.amount ?? 0),
    plannedRevenueMerchandise:   Number((uniformAgg._sum as any).totalAmount ?? 0),
    plannedRevenueOther:         Number((otherAgg._sum as any).totalAmount ?? 0),
    plannedRevenueAcademyFee:    Number(academyFeeAgg._sum.amountKrw ?? 0),
    plannedRevenueBroadcast:     0,
    plannedRevenueSubsidy:       0,
    plannedRevenueParentCompany: 0,
  };
}
