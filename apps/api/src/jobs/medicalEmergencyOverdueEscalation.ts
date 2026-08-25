import cron from "node-cron";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { medicalEquipmentLoanRepo } from "../medical-equipment-loan/medical-equipment-loan.repo";

dayjs.extend(utc);
dayjs.extend(timezone);

const KST = "Asia/Seoul";

/**
 * D+1 09:00 KST 초과 EMERGENCY_PENDING_POST_APPROVAL 조회 → escalation.
 * 매일 00:01 UTC (= 09:01 KST) 실행. escalatedAt IS NULL 로 idempotent.
 *
 * 알림 대상:
 *   - 의무팀장 (MEDICAL_DIRECTOR) — 즉시 처리 독촉
 *   - GM/ADMIN — 부서장 escalation (Q2)
 */
export function startMedicalEmergencyOverdueEscalationJob() {
  cron.schedule("1 0 * * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);

    // cutoff = 어제 09:00 KST 이전에 issuedAt 된 건 (지급 후 D+1 09:00 경과)
    const cutoff = dayjs()
      .tz(KST)
      .subtract(1, "day")
      .hour(9)
      .minute(0)
      .second(0)
      .millisecond(0)
      .toDate();

    const overdues = await medicalEquipmentLoanRepo.findOverdueEmergency(cutoff);
    if (overdues.length === 0) return;

    for (const ledger of overdues) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.medicalEquipmentLoanLedger.update({
            where: { id: ledger.id },
            data: { escalatedAt: new Date() },
          });
        });

        const requesterName = ledger.requestedBy?.nickname ?? "요청자";

        void notifRepo
          .createForMedicalDirector(
            "MEDICAL_EQUIPMENT_LOAN_ESCALATED",
            () => ({
              title: "응급 대여 사후 승인 지연",
              body: `${requesterName} 님의 응급 대여가 D+1 09:00 를 초과했습니다. 즉시 처리 필요.`,
            }),
            ledger.equipmentLoanId,
          )
          .catch(console.error);

        void notifRepo
          .createForGM(
            "MEDICAL_EQUIPMENT_LOAN_ESCALATED",
            () => ({
              title: "응급 대여 escalation",
              body: `의무기기 응급 대여 사후 승인 지연 (${requesterName}). 의무팀장 독촉 요망.`,
            }),
            ledger.equipmentLoanId,
          )
          .catch(console.error);
      } catch (err) {
        console.error(`[MedicalEmergencyEscalation] ledger ${ledger.id} escalation failed:`, err);
      }
    }
  });
}
