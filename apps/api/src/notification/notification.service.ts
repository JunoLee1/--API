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
    await this.repo.createForStaff("PLAYER_CONTRACT_SIGNED", () => ({ title, body }));
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
    await this.repo.createForTD("COACH_SHORTLISTED", () => ({ title, body }), coachId);
    getIO().to("staff-room").emit("notification:coach", { type: "COACH_SHORTLISTED", title, body, createdAt: new Date().toISOString() });
  }

  async notifyCoachApprovalPending(coachName: string, coachId: number) {
    const title = "코치 채용 승인 요청";
    const body = `${coachName} 코치 채용 건에 GM 최종 승인이 필요합니다.`;
    await this.repo.createForGM("COACH_APPROVAL_PENDING", () => ({ title, body }), coachId);
    getIO().to("staff-room").emit("notification:coach", { type: "COACH_APPROVAL_PENDING", title, body, createdAt: new Date().toISOString() });
  }

  async notifyCoachContracted(coachName: string, coachId: number) {
    const title = "코치 채용 완료 — 계정 생성 필요";
    const body = `${coachName} 코치 계약이 확정됐습니다. ADMIN이 User 계정을 생성하고 초대해주세요.`;
    await this.repo.createForAdmin("COACH_CONTRACTED", () => ({ title, body }), coachId);
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
    await this.repo.createForHeadCoach("ATTENDANCE_PENALTY", () => ({ title, body }));
    getIO().to("staff-room").emit("notification:attendance", {
      type: "ATTENDANCE_PENALTY", title, body, createdAt: new Date().toISOString(),
    });
  }

  async notifyJerseyConflict(
    playerUserId: number,
    number: number,
    reason: "OCCUPIED" | "RETIRED" | "RESERVED",
  ) {
    const reasonText: Record<string, string> = {
      OCCUPIED: "이미 다른 선수가 사용 중입니다",
      RETIRED: "구단 영구결번입니다",
      RESERVED: "계약 진행 중인 선수가 선점한 번호입니다",
    };
    const title = `등번호 ${number}번 선택 불가`;
    const body = `요청하신 ${number}번은 ${reasonText[reason]}. 다른 번호를 선택해 주세요.`;
    await this.repo.createForUser(playerUserId, "JERSEY_NUMBER_CONFLICT", () => ({ title, body }));
  }

  async notifyAttendanceUnauthorized(
    playerUserId: number,
    type: "LATE" | "ABSENT",
    date: Date,
    lateCount: number,
    effectiveAbsences: number,
  ) {
    const typeText = type === "LATE" ? "무단 지각" : "무단 결근";
    const dateStr = date.toLocaleDateString("ko-KR");
    const title = `${typeText} 기록 안내`;
    const body = `${dateStr} ${typeText}이 기록됐습니다. 현재 누적 무단 결근 환산 ${effectiveAbsences}회 (무단 지각 ${lateCount}회 포함).`;
    await this.repo.createForUser(playerUserId, "ATTENDANCE_UNAUTHORIZED", () => ({ title, body }));
  }

  async notifyAttendancePenaltyPlayer(playerUserId: number, effectiveAbsences: number) {
    const title = "출결 페널티 경고";
    const body = `무단 결근 누적 환산 ${effectiveAbsences}회로 규정에 따른 페널티(벌금, 출전 정지 등)가 부여될 수 있습니다. 코치진에게 문의하세요.`;
    await this.repo.createForUser(playerUserId, "ATTENDANCE_PENALTY_PLAYER", () => ({ title, body }));
  }

  async notifyMatchDayReminder(
    playerUserId: number,
    matchInfo: { date: Date; homeTeamName: string; awayTeamName: string; venue?: string | null },
  ) {
    const dateStr = matchInfo.date.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    const timeStr = matchInfo.date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const title = "내일 경기 알림";
    const body = `${dateStr} ${timeStr} | ${matchInfo.homeTeamName} vs ${matchInfo.awayTeamName}${matchInfo.venue ? ` @ ${matchInfo.venue}` : ""}. 경기 준비 바랍니다.`;
    await this.repo.createForUser(playerUserId, "MATCH_DAY_REMINDER", () => ({ title, body }));
  }

  async notifyLineupConfirmed(
    playerUserId: number,
    isStarter: boolean,
    matchInfo: { homeTeamName: string; awayTeamName: string },
    matchId: number,
  ) {
    const role = isStarter ? "선발" : "후보";
    const title = "라인업 확정";
    const body = `${matchInfo.homeTeamName} vs ${matchInfo.awayTeamName} 경기 ${role}로 확정되었습니다.`;
    await this.repo.createForUser(playerUserId, "LINEUP_CONFIRMED", () => ({ title, body }), matchId);
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
