import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

export function calcMonthlyAttendanceRate(
  present: number,
  authorizedAbsences: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return (present + authorizedAbsences) / total;
}

export function startMonthlyAttendanceCheckJob() {
  cron.schedule("0 0 1 * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);

    const now = new Date();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sessions = await prisma.trainingSession.findMany({
      where: {
        date: { gte: firstOfLastMonth, lt: firstOfThisMonth },
        isApproved: true,
      },
      select: { id: true },
    });

    if (sessions.length === 0) return;
    const sessionIds = sessions.map((s) => s.id);

    const results = await prisma.trainingResult.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { playerId: true, attendance: true },
    });

    const playerMap = new Map<string, { present: number; authorized: number; total: number }>();
    for (const r of results) {
      if (!playerMap.has(r.playerId)) {
        playerMap.set(r.playerId, { present: 0, authorized: 0, total: 0 });
      }
      const stat = playerMap.get(r.playerId)!;
      stat.total++;
      if (r.attendance === "PRESENT") stat.present++;
      else if (r.attendance === "ABSENT_AUTHORIZED") stat.authorized++;
    }

    const monthLabel = `${firstOfLastMonth.getFullYear()}년 ${firstOfLastMonth.getMonth() + 1}월`;

    for (const [playerId, stat] of playerMap.entries()) {
      const rate = calcMonthlyAttendanceRate(stat.present, stat.authorized, stat.total);
      if (rate === null || rate >= 0.8) continue;

      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { playerName: true },
      });
      if (!player) continue;

      void notifRepo
        .createForCoachingStaff(
          "TRAINING_ATTENDANCE_WARNING",
          () => ({
            title: "월간 출석률 80% 미만",
            body: `${player.playerName} 선수의 ${monthLabel} 출석률이 ${Math.round(rate * 100)}%입니다.`,
          }),
        )
        .catch(console.error);
    }
  });
}
