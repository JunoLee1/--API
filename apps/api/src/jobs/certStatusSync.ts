import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function runCertStatusSync() {
  const prisma = getPrisma();
  const notifRepo = new NotificationRepository(prisma);
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * MS_PER_DAY);

  // 1. 만료 처리: VALID|EXPIRING_SOON|FM_APPROVED → EXPIRED
  await prisma.certification.updateMany({
    where: {
      status: { in: ["VALID", "EXPIRING_SOON", "FM_APPROVED"] },
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  // 2. 만료 임박 처리: VALID → EXPIRING_SOON (30일 이내)
  await prisma.certification.updateMany({
    where: {
      status: "VALID",
      expiresAt: { gt: now, lte: in30Days },
    },
    data: { status: "EXPIRING_SOON" },
  });

  // 3. 알림 발송
  const activeCerts = await prisma.certification.findMany({
    where: { status: { in: ["VALID", "EXPIRING_SOON", "FM_APPROVED"] } },
    include: { reminders: true },
  });

  for (const cert of activeCerts) {
    const daysLeft = Math.ceil((cert.expiresAt.getTime() - now.getTime()) / MS_PER_DAY);

    for (const threshold of cert.reminderDays) {
      if (daysLeft > threshold) continue;
      const alreadySent = cert.reminders.some((r) => r.daysThreshold === threshold);
      if (alreadySent) continue;

      const title = `인증 만료 알림: ${cert.certType}`;
      const body  = `인증 만료까지 ${daysLeft}일 남았습니다. (발급 기관: ${cert.issuingBody})`;

      try {
        // 담당자 알림
        await notifRepo.createForUser(
          cert.ownerId,
          "COMPLIANCE_DEADLINE_REMINDER",
          () => ({ title, body }),
          cert.id,
        );

        // 30일 이하: Admin·GM 에스컬레이션
        if (daysLeft <= 30) {
          const escalationTargets = await prisma.user.findMany({
            where: {
              role: { in: daysLeft <= 0 ? ["ADMIN", "GM", "SUPER_ADMIN"] : ["ADMIN", "GM"] },
              isDeleted: false,
            },
            select: { id: true },
          });
          for (const target of escalationTargets) {
            await notifRepo.createForUser(
              target.id,
              "COMPLIANCE_DEADLINE_REMINDER",
              () => ({ title: `[에스컬레이션] ${title}`, body }),
              cert.id,
            );
          }
        }

        // 발송 기록 (@@unique가 중복 방지)
        await prisma.certificationReminderLog.create({
          data: { certificationId: cert.id, daysThreshold: threshold },
        });
      } catch (err) {
        console.error(`[certStatusSync] reminder failed for cert ${cert.id}`, err);
      }
    }
  }

  console.log(`[certStatusSync] done: ${activeCerts.length} certs checked at ${now.toISOString()}`);
}

export function startCertStatusSyncJob() {
  cron.schedule("30 8 * * *", () => {
    runCertStatusSync().catch(console.error);
  });
  console.log("[certStatusSync] scheduled at 08:30 daily");
}
