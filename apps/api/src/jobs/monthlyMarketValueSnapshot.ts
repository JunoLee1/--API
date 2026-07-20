import cron from "node-cron";
import { getPrisma } from "../lib/prisma";

export function startMonthlyMarketValueSnapshotJob() {
  // 매월 1일 자정 실행
  cron.schedule("0 0 1 * *", async () => {
    const prisma = getPrisma();

    const players = await prisma.player.findMany({
      where: { currentMarketValue: { not: null } },
      select: { id: true, currentMarketValue: true },
    });

    if (players.length === 0) return;

    await prisma.marketValueHistory.createMany({
      data: players.map((p) => ({
        playerId: p.id,
        value: p.currentMarketValue!,
        source: "EXTERNAL_API" as const,
      })),
    });

    console.log(`[MarketValueSnapshot] ${players.length}명 스냅샷 저장`);
  });
}
