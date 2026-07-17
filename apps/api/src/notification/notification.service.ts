import { NotificationRepository } from "./notification.repo";
import { AppError } from "../lib/appError";
import { getIO } from "../lib/io";

export class NotificationService {
  constructor(private repo: NotificationRepository) {}

  getMyNotifications(userId: number) {
    return this.repo.findByUserId(userId);
  }

  async markRead(id: number, userId: number) {
    const count = await this.repo.markRead(id, userId);
    if (count.count === 0) throw new AppError(404, "NOTIFICATION_NOT_FOUND");
    return { ok: true };
  }

  async notifyProspectSigned(playerName: string) {
    const title = "선수 영입 완료";
    const body = `${playerName} 선수의 계약이 체결되어 선수단에 합류했습니다.`;
    await this.repo.createForStaff("PLAYER_CONTRACT_SIGNED", title, body);
    getIO().to("staff-room").emit("notification:player-contract", {
      type: "PLAYER_CONTRACT_SIGNED",
      title,
      body,
      createdAt: new Date().toISOString(),
    });
  }

  async notifyCoachShortlisted(coachName: string, coachId: number) {
    const title = "코치 후보 숏리스트 등록";
    const body = `${coachName} 코치가 숏리스트에 추가됐습니다. 검토 바랍니다.`;
    await this.repo.createForTD("COACH_SHORTLISTED", title, body, coachId);
    getIO().to("staff-room").emit("notification:coach", { type: "COACH_SHORTLISTED", title, body, createdAt: new Date().toISOString() });
  }

  async notifyCoachApprovalPending(coachName: string, coachId: number) {
    const title = "코치 채용 승인 요청";
    const body = `${coachName} 코치 채용 건에 GM 최종 승인이 필요합니다.`;
    await this.repo.createForGM("COACH_APPROVAL_PENDING", title, body, coachId);
    getIO().to("staff-room").emit("notification:coach", { type: "COACH_APPROVAL_PENDING", title, body, createdAt: new Date().toISOString() });
  }

  async notifyCoachContracted(coachName: string, coachId: number) {
    const title = "코치 채용 완료 — 계정 생성 필요";
    const body = `${coachName} 코치 계약이 확정됐습니다. ADMIN이 User 계정을 생성하고 초대해주세요.`;
    await this.repo.createForAdmin("COACH_CONTRACTED", title, body, coachId);
    getIO().to("staff-room").emit("notification:coach", { type: "COACH_CONTRACTED", title, body, createdAt: new Date().toISOString() });
  }

  async notifyCoachArchived(coachName: string, coachId: number, roundCreatorId: number) {
    const title = "코치 후보 탈락";
    const body = `${coachName} 코치 후보가 탈락 처리됐습니다.`;
    await this.repo.create({ userId: roundCreatorId, type: "COACH_ARCHIVED", title, body, entityId: coachId });
  }

  async notifyAttendancePenalty(playerName: string, effectiveAbsences: number) {
    const title = "훈련 출결 페널티 발생";
    const body = `${playerName} 선수의 누적 무단 결석이 ${effectiveAbsences}회에 도달했습니다.`;
    await this.repo.createForHeadCoach("ATTENDANCE_PENALTY", title, body);
    getIO().to("staff-room").emit("notification:attendance", {
      type: "ATTENDANCE_PENALTY", title, body, createdAt: new Date().toISOString(),
    });
  }

  async getPartnerAlerts() {
    const contracts = await this.repo.findExpiringContracts(30);
    return contracts.map((c) => {
      const daysLeft = Math.ceil((c.endDate.getTime() - Date.now()) / 86_400_000);
      return {
        type: "CONTRACT_EXPIRY",
        title: "계약 만료 임박",
        body: `${c.partner.name} ${c.partner.type === "HOSPITAL" ? "병원" : "제조사"} 계약이 ${daysLeft}일 후 만료됩니다.`,
        daysLeft,
        contractId: c.id,
        partnerId: c.partner.id,
        partnerName: c.partner.name,
        partnerType: c.partner.type,
        endDate: c.endDate.toISOString(),
        sponsorshipFee: c.sponsorshipFee,
        discountRate: c.discountRate,
      };
    });
  }
}
