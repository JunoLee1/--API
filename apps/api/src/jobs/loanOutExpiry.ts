import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

export function startLoanOutExpiryJob() {
  cron.schedule("0 0 * * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);

    const now = new Date();

    const expiredLoans = await prisma.transfer.findMany({
      where: {
        type: "LOAN_OUT",
        endDate: { lt: now },
        player: { status: "ON_LOAN" },
      },
      select: {
        id: true,
        player: { select: { id: true, playerName: true } },
      },
    });

    for (const transfer of expiredLoans) {
      await prisma.player.update({
        where: { id: transfer.player.id },
        data: { status: "ACTIVE" },
      });

      void notifRepo
        .createForStaff(
          "LOAN_OUT_EXPIRED",
          () => ({
            title: "임대 만료",
            body: `${transfer.player.playerName} 선수의 임대 기간이 만료되어 복귀 처리됐습니다.`,
          }),
          transfer.id,
        )
        .catch(console.error);
    }
  });
}
