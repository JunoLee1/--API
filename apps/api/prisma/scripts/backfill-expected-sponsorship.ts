import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/client";

/**
 * #476 (ADR 0024): 기존 FinancialReport row 에 expectedRevenueSponsorship 채움.
 *
 * Idempotent — 매 실행마다 SponsorshipPayment.dueDate ∈ season window (status 무관)
 * 로 재계산해서 update. 실행:
 *
 *   cd apps/api && npx tsx prisma/scripts/backfill-expected-sponsorship.ts
 *
 * getSeasonRevenueActuals 를 직접 import 하지 않고 로컬 재구현. 이유:
 * - season-actuals.ts 는 lib/prisma singleton 을 사용해서 스크립트용 PrismaClient
 *   와 lifecycle 이 어긋남.
 * - 이 필드 계산은 단순 aggregate 라 재현 비용이 낮음.
 */
async function main() {
  const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
  const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

  const reports = await prisma.financialReport.findMany({
    select: { seasonId: true, id: true },
    orderBy: { seasonId: "asc" },
  });

  console.log(`[backfill] Found ${reports.length} FinancialReport row(s) to process.`);
  let updated = 0;

  for (const r of reports) {
    const season = await prisma.season.findUnique({
      where: { id: r.seasonId },
      select: { startDate: true, endDate: true },
    });
    if (!season) {
      console.warn(`[backfill] seasonId=${r.seasonId} not found — skip`);
      continue;
    }

    const agg = await prisma.sponsorshipPayment.aggregate({
      where: { dueDate: { gte: season.startDate, lte: season.endDate } },
      _sum: { amount: true },
    });
    const expected = Number(agg._sum.amount ?? 0);

    await (prisma.financialReport as any).update({
      where: { seasonId: r.seasonId },
      data: { expectedRevenueSponsorship: expected },
    });
    updated++;
    console.log(`[backfill] seasonId=${r.seasonId} expectedRevenueSponsorship=${expected}`);
  }

  console.log(`[backfill] Done. Updated ${updated} row(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
