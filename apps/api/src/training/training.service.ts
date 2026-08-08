import { TrainingRepository } from "./training.repo";
import { AppError } from "../lib/appError";
import { CreateSessionDto, AddContentDto, AddParticipantsDto, UpsertResultDto, SessionListQuery } from "./dto/training.dto";
import { NotificationRepository } from "../notification/notification.repo";
import { writeAuditLog } from "../lib/auditLog";
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
    const sessionDate = new Date(dto.date);
    if (sessionDate > new Date()) {
      throw new AppError(400, "SESSION_DATE_FUTURE_NOT_ALLOWED");
    }
    const session = await this.repo.create(dto, createdById);
    void this.repo.addAllActivePlayers(session.id, session.teamId).catch(console.error);
    if (this.notifRepo) {
      void this.notifRepo
        .createForHeadCoach(
          "TRAINING_SESSION_PENDING",
          () => ({
            title: "훈련 세션 승인 요청",
            body: `${new Date(dto.date).toLocaleDateString("ko-KR")} 훈련 세션(${dto.sessionType})이 등록되어 승인이 필요합니다.`,
          }),
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
    if (dto.performanceScore !== undefined && (dto.performanceScore < 0 || dto.performanceScore > 100)) {
      throw new AppError(400, "PERFORMANCE_SCORE_OUT_OF_RANGE");
    }
    const result = await this.repo.upsertResult(sessionId, dto);

    if (dto.attendance === "ABSENT_UNAUTHORIZED" || dto.attendance === "LATE_UNAUTHORIZED") {
      const { absences, lateCount } = await this.repo.countUnexcusedAttendance(dto.playerId);
      const effective = calcEffectiveAbsences(absences, lateCount);
      const type = dto.attendance === "LATE_UNAUTHORIZED" ? "LATE" : "ABSENT";

      // notify player (fire-and-forget)
      void this.repo
        .findPlayerUserId(dto.playerId)
        .then(async (p) => {
          if (!p?.userId) return;
          await notificationService.notifyAttendanceUnauthorized(p.userId, type, new Date(), lateCount, effective);
          if (shouldTriggerPenalty(effective)) {
            await notificationService.notifyAttendancePenaltyPlayer(p.userId, effective);
          }
        })
        .catch(console.error);

      if (shouldTriggerPenalty(effective)) {
        const player = await this.repo.findPlayerNameById(dto.playerId);
        if (player) {
          void notificationService.notifyAttendancePenalty(player.playerName, effective).catch(console.error);
        }
      }
    }

    return result;
  }

  async updateSession(id: number, data: { date?: string; goal?: string }, _updatedById: number) {
    const session = await this.repo.findByIdWithTeam(id);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    const updated = await this.repo.updateSession(id, data);
    if (session.team?.type === "YOUTH" && this.notifRepo) {
      const teamName = session.team.name;
      const guardianIds = await this.repo.findGuardiansByTeam(session.teamId!);
      for (const guardianId of guardianIds) {
        void this.notifRepo
          .createForGuardian(
            guardianId,
            "YOUTH_SESSION_CHANGED",
            () => ({
              title: `${teamName} 훈련 일정 변경`,
              body: `훈련 일정이 변경됐습니다. 앱에서 확인해주세요.`,
            }),
            session.id,
          )
          .catch(console.error);
      }
    }
    return updated;
  }

  async cancelSession(id: number) {
    const session = await this.repo.findByIdWithTeam(id);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
    const result = await this.repo.cancelSession(id);
    if (session.team?.type === "YOUTH" && this.notifRepo) {
      const teamName = session.team.name;
      const guardianIds = await this.repo.findGuardiansByTeam(session.teamId!);
      for (const guardianId of guardianIds) {
        void this.notifRepo
          .createForGuardian(
            guardianId,
            "YOUTH_SESSION_CHANGED",
            () => ({
              title: `${teamName} 훈련 취소`,
              body: `훈련이 취소됐습니다.`,
            }),
            session.id,
          )
          .catch(console.error);
      }
    }
    return result;
  }

  getResults(filters: { from?: string; to?: string; sessionType?: string; playerId?: string; nullOnly?: boolean }) {
    return this.repo.findResults(filters)
  }

  async correctAttendance(resultId: number, adminId: number, attendance: string, reason: string) {
    if (!reason?.trim()) throw new AppError(400, "REASON_REQUIRED");
    const result = await this.repo.findResultById(resultId);
    if (!result) throw new AppError(404, "RESULT_NOT_FOUND");
    const updated = await this.repo.updateAttendance(resultId, attendance);
    await writeAuditLog({
      actorId: adminId,
      action: "ATTENDANCE_CORRECTED",
      targetId: resultId,
      detail: { before: result.attendance, after: attendance, reason: reason.trim() },
    });
    return updated;
  }
}
