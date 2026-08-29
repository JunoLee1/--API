import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import {
  sendCapacityFailedEmail,
  sendReviewOpenedEmail,
  sendReviewDeadlineD1Email,
} from "../lib/email";
import { notifyBudgetPlanEvent, resolveBudgetPlanReviewers } from "../budget-plan/notify";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = [7, 3, 1] as const;

type ReminderDays = (typeof REMINDER_DAYS)[number];

const eventFor = (days: ReminderDays): "REMINDER_D7" | "REMINDER_D3" | "REMINDER_D1" => {
  if (days === 7) return "REMINDER_D7";
  if (days === 3) return "REMINDER_D3";
  return "REMINDER_D1";
};

const startOfDay = (d: Date): Date => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

export async function runBudgetPlanReminder(now: Date = new Date()): Promise<void> {
  const prisma = getPrisma();
  const notificationRepo = new NotificationRepository(prisma);
  const emailSender = { sendCapacityFailedEmail, sendReviewOpenedEmail, sendReviewDeadlineD1Email };

  const today = startOfDay(now);

  for (const days of REMINDER_DAYS) {
    const targetDay = new Date(today.getTime() + days * MS_PER_DAY);
    const targetDayEnd = new Date(targetDay.getTime() + MS_PER_DAY);

    const reports = await prisma.financialReport.findMany({
      where: {
        planStatus: "AWAITING_REVIEW",
        reviewDeadline: { gte: targetDay, lt: targetDayEnd },
      },
      select: {
        id: true,
        seasonId: true,
        reviewDeadline: true,
        planRequests: {
          where: { status: "SUBMITTED" },
          select: { requestedById: true, scope: true, ownerId: true },
        },
      },
    });

    for (const report of reports) {
      const allReviewers = await resolveBudgetPlanReviewers(prisma);
      const submittedUserIds = new Set(report.planRequests.map((r) => r.requestedById));
      const missingReviewers = allReviewers.filter((r) => !submittedUserIds.has(r.userId));
      if (missingReviewers.length === 0) continue;

      await notifyBudgetPlanEvent(
        eventFor(days),
        {
          seasonId: report.seasonId,
          deadline: report.reviewDeadline ?? undefined,
          reviewers: missingReviewers,
        },
        { notificationRepo, email: emailSender },
      );
    }
  }
}

export function startBudgetPlanReminderJob() {
  // 매일 08:30 KST (기존 cron 패턴과 동일 시간대)
  cron.schedule("30 8 * * *", () => {
    runBudgetPlanReminder().catch(console.error);
  });
}
