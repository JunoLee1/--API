import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

export function startExternalReportReminderJob() {
  cron.schedule("0 0 * * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);
    const now = new Date();

    const twoDaysFromNow = new Date(now);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const upcoming = await prisma.externalReport.findMany({
      where: {
        status: { in: ["PENDING_SUBMISSION", "SUPPLEMENT_REQUESTED"] },
        dueDate: { gte: now, lte: twoDaysFromNow },
      },
    });

    if (upcoming.length > 0) {
      try {
        await notifRepo.createForMedicalDirector(
          "EXTERNAL_REPORT_DUE_SOON",
          "외부 의무보고서 마감 임박",
          `마감 2일 이내 미제출 보고서가 ${upcoming.length}건 있습니다.`,
        );
      } catch (err) {
        console.error("[cron] 마감 임박 알림 실패:", err);
      }
    }

    const overdue = await prisma.externalReport.findMany({
      where: {
        status: { in: ["PENDING_SUBMISSION", "SUPPLEMENT_REQUESTED"] },
        dueDate: { lt: now },
      },
    });

    if (overdue.length > 0) {
      try {
        await notifRepo.createForMedicalDirector(
          "EXTERNAL_REPORT_OVERDUE",
          "외부 의무보고서 마감 초과",
          `미제출 보고서 ${overdue.length}건이 마감을 초과했습니다.`,
        );
      } catch (err) {
        console.error("[cron] 마감 초과 알림 실패:", err);
      }
    }
  });
}
