import { PlayerCallupRepository } from "./player-callup.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { writeAuditLog } from "../lib/auditLog";
import { AppError } from "../lib/appError";
import { CreateCallupDto, RejectCallupDto, CallupListQuery } from "./dto/player-callup.dto";

export class PlayerCallupService {
  constructor(
    private repo: PlayerCallupRepository,
    private notifRepo: NotificationRepository,
  ) {}

  getAll(query: CallupListQuery) {
    return this.repo.findAll(query);
  }

  async getById(id: number) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    return callup;
  }

  async create(dto: CreateCallupDto, requestedById: number) {
    const callup = await this.repo.create({ ...dto, requestedById });
    void this.notifRepo
      .createForGM(
        "CALLUP_REQUESTED",
        "유소년 콜업 요청",
        `${callup.player.playerName} 선수의 1군 콜업 요청이 등록됐습니다.`,
        callup.id,
      )
      .catch(console.error);
    return callup;
  }

  async approve(id: number, approvedById: number) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    if (callup.status !== "REQUESTED") throw new AppError(409, "INVALID_STATUS");

    const updated = await this.repo.approve(id, approvedById);
    await this.repo.updatePlayerTeam(callup.player.id, callup.toTeam.id);
    await writeAuditLog({ actorId: approvedById, action: "CALLUP_APPROVED", targetId: id });

    void this.notifRepo
      .createForHeadCoach(
        "CALLUP_APPROVED",
        "콜업 승인",
        `${callup.player.playerName} 선수의 1군 콜업이 승인됐습니다.`,
        id,
      )
      .catch(console.error);

    return updated;
  }

  async reject(id: number, approvedById: number, dto: RejectCallupDto) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    if (callup.status !== "REQUESTED") throw new AppError(409, "INVALID_STATUS");
    if (!dto.reason?.trim()) throw new AppError(400, "REASON_REQUIRED");

    const updated = await this.repo.reject(id, approvedById, dto.reason);
    await writeAuditLog({ actorId: approvedById, action: "CALLUP_REJECTED", targetId: id });

    void this.notifRepo
      .createForHeadCoach(
        "CALLUP_REJECTED",
        "콜업 거절",
        `${callup.player.playerName} 선수의 1군 콜업이 거절됐습니다. 사유: ${dto.reason}`,
        id,
      )
      .catch(console.error);

    return updated;
  }

  async complete(id: number, actorId: number) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    if (callup.status !== "APPROVED") throw new AppError(409, "INVALID_STATUS");
    await writeAuditLog({ actorId, action: "CALLUP_COMPLETED", targetId: id });
    return this.repo.complete(id);
  }
}
