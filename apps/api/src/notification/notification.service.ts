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

  async getPartnerAlerts() {
    const contracts = await this.repo.findExpiringContracts(30);
    return contracts.map((c) => {
      const daysLeft = Math.ceil((c.endDate.getTime() - Date.now()) / 86_400_000);
      return {
        type: "CONTRACT_EXPIRY",
        title: "계약 만료 임박",
        body: `${c.player.playerName} 선수의 계약이 ${daysLeft}일 후 만료됩니다.`,
        daysLeft,
        contractId: c.id,
        playerId: c.player.id,
        playerName: c.player.playerName,
        endDate: c.endDate.toISOString(),
        managedBy: c.managedBy?.nickname ?? null,
      };
    });
  }
}
