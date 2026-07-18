import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

export function startWorkPermitExpiryCheckJob() {
  cron.schedule("0 0 * * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiring = await prisma.player.findMany({
      where: {
        workPermitStatus: "APPROVED",
        workPermitExpiry: { gte: now, lte: thirtyDaysFromNow },
      },
      select: { id: true, playerName: true, workPermitExpiry: true },
    });

    for (const player of expiring) {
      const expiry = player.workPermitExpiry!;
      const daysLeft = Math.ceil(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      void notifRepo
        .createForStaff(
          "WORK_PERMIT_EXPIRY_SOON",
          "노동허가 만료 임박",
          `${player.playerName} 선수의 노동허가가 ${daysLeft}일 후(${expiry.toLocaleDateString("ko-KR")}) 만료됩니다.`,
          undefined,
        )
        .catch(console.error);
    }
  });
}
