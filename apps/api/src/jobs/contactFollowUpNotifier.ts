import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationService } from "../notification/notification.service";
import { NotificationRepository } from "../notification/notification.repo";

async function runContactFollowUpNotifier() {
  const prisma = getPrisma();
  const notificationService = new NotificationService(new NotificationRepository(prisma));

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const dueLogs = await prisma.partnerContactLog.findMany({
    where: { nextActionDate: { gte: tomorrow, lt: dayAfter } },
    include: {
      partner: { select: { name: true } },
      actor: { select: { id: true } },
    },
  });

  for (const log of dueLogs) {
    await notificationService
      .notifyContactFollowUp(log.partner.name, log.id, log.actor.id)
      .catch(console.error);
  }

  console.log(`[contactFollowUpNotifier] ${dueLogs.length} follow-up notifications sent`);
}

export function startContactFollowUpNotifierJob() {
  cron.schedule("0 8 * * *", () => {
    runContactFollowUpNotifier().catch(console.error);
  });
  console.log("[contactFollowUpNotifier] scheduled at 08:00 daily");
}
