import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationService } from "../notification/notification.service";
import { NotificationRepository } from "../notification/notification.repo";
import { ContactLogRepository } from "../partner/contact-log/contact-log.repo";

async function runContactFollowUpNotifier() {
  const prisma = getPrisma();
  const notificationService = new NotificationService(new NotificationRepository(prisma));
  const contactLogRepo = new ContactLogRepository(prisma);

  const dueLogs = await contactLogRepo.findDueTomorrow();

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
  }, { timezone: "Asia/Seoul" });
  console.log("[contactFollowUpNotifier] scheduled at 08:00 KST daily");
}
