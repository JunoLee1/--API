import { TrainingRepository } from "./training.repo";
import { AppError } from "../lib/appError";
import { CreateSessionDto, AddContentDto, AddParticipantsDto, UpsertResultDto, SessionListQuery } from "./dto/training.dto";
import { NotificationRepository } from "../notification/notification.repo";
import { NotificationService } from "../notification/notification.service";
import { getPrisma } from "../lib/prisma";

const notificationService = new NotificationService(new NotificationRepository(getPrisma()));

export function calcEffectiveAbsences(absences: number, lateCount: number): number {
  return absences + Math.floor(lateCount / 3);
}

export function shouldTriggerPenalty(effectiveAbsences: number): boolean {
  return effectiveAbsences > 0 && effectiveAbsences % 3 === 0;
}

export class TrainingService {
  constructor(
    private repo: TrainingRepository,
    private notifRepo?: NotificationRepository,
  ) {}

  getSessions(query: SessionListQuery) {
    return this.repo.findAll(query);
  }

  async getSessionById(id: number) {
    const session = await this.repo.findById(id);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    return session;
  }

  async createSession(dto: CreateSessionDto, createdById: number) {
    const session = await this.repo.create(dto, createdById);
    if (this.notifRepo) {
      void this.notifRepo
        .createForHeadCoach(
          "TRAINING_SESSION_PENDING",
          "훈련 세션 승인 요청",
          `${new Date(dto.date).toLocaleDateString("ko-KR")} 훈련 세션(${dto.sessionType})이 등록되어 승인이 필요합니다.`,
          session.id,
        )
        .catch(console.error);
    }
    return session;
  }

  async approveSession(id: number, approvedById: number) {
    const session = await this.repo.findById(id);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    if (session.isApproved) throw new AppError(409, "ALREADY_APPROVED");
    return this.repo.approve(id, approvedById);
  }

  async addContent(sessionId: number, dto: AddContentDto) {
    const session = await this.repo.findById(sessionId);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    return this.repo.addContent(sessionId, dto);
  }

  async addParticipants(sessionId: number, dto: AddParticipantsDto) {
    const session = await this.repo.findById(sessionId);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    return this.repo.addParticipants(sessionId, dto);
  }

  async upsertResult(sessionId: number, dto: UpsertResultDto) {
    const session = await this.repo.findById(sessionId);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    const existing = await this.repo.findResult(sessionId, dto.playerId);
    const result = existing
      ? await this.repo.updateResult(existing.id, dto)
      : await this.repo.createResult(sessionId, dto);

    if (dto.attendance === "ABSENT_UNAUTHORIZED" || dto.attendance === "LATE_UNAUTHORIZED") {
      const { absences, lateCount } = await this.repo.countUnexcusedAttendance(dto.playerId);
      const effective = calcEffectiveAbsences(absences, lateCount);
      if (shouldTriggerPenalty(effective)) {
        const player = await this.repo.findPlayerNameById(dto.playerId);
        if (player) {
          void notificationService.notifyAttendancePenalty(player.playerName, effective).catch(console.error);
        }
      }
    }

    return result;
  }
}
