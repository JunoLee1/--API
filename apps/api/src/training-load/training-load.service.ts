import { TrainingLoadRepository } from "./training-load.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { UpsertTrainingLoadDto, TrainingLoadQuery, WeeklySummaryQuery } from "./dto/training-load.dto";
import { AppError } from "../lib/appError";

export const WEEKLY_LOAD_THRESHOLD = 500;

export function isWeeklyOverload(weeklyTotal: number): boolean {
  return weeklyTotal >= WEEKLY_LOAD_THRESHOLD;
}

export class TrainingLoadService {
  constructor(
    private repo: TrainingLoadRepository,
    private notifRepo: NotificationRepository,
  ) {}

  getAll(query: TrainingLoadQuery) {
    return this.repo.findAll(query);
  }

  async upsert(
    dto: UpsertTrainingLoadDto,
    requesterId: string,
    requesterRole: string,
    requesterCoachingRole: string | null,
  ) {
    const isPhysicalCoach = requesterRole === "COACHING_STAFF" && requesterCoachingRole === "PHYSICAL_COACH";
    const isHeadCoach = requesterRole === "COACHING_STAFF" && requesterCoachingRole === "HEAD_COACH";
    const isAdmin = requesterRole === "ADMIN";
    const isPlayer = requesterRole === "PLAYER";

    if (dto.rpe !== undefined) {
      if (!isPlayer) throw new AppError(403, "RPE_PLAYER_ONLY");
      if (dto.playerId !== requesterId) throw new AppError(403, "RPE_OWN_ONLY");
      if (dto.rpe < 1 || dto.rpe > 10) throw new AppError(400, "RPE_OUT_OF_RANGE");
    }
    if (dto.load !== undefined) {
      if (!isPhysicalCoach && !isHeadCoach && !isAdmin) throw new AppError(403, "LOAD_COACH_ONLY");
    }

    const result = await this.repo.upsert(dto);

    if (dto.load !== undefined) {
      const weekStart = this.getWeekStart(new Date());
      const total = await this.repo.getWeeklyLoadTotal(dto.playerId, weekStart);
      if (isWeeklyOverload(total)) {
        const player = await this.repo.getPlayerName(dto.playerId);
        const playerName = player?.playerName ?? dto.playerId;
        void Promise.all([
          this.notifRepo
            .createForPhysicalCoach(
              "TRAINING_LOAD_ALERT",
              "훈련 부하 초과",
              `${playerName} 선수의 이번 주 누적 부하(${total})가 임계값(${WEEKLY_LOAD_THRESHOLD})을 초과했습니다.`,
            )
            .catch(console.error),
          this.notifRepo
            .createForHeadCoach(
              "TRAINING_LOAD_ALERT",
              "훈련 부하 초과",
              `${playerName} 선수의 이번 주 누적 부하(${total})가 임계값(${WEEKLY_LOAD_THRESHOLD})을 초과했습니다.`,
            )
            .catch(console.error),
        ]);
      }
    }

    return result;
  }

  async getWeeklySummary(query: WeeklySummaryQuery) {
    const weekStart = new Date(query.weekStart);
    const total = await this.repo.getWeeklyLoadTotal(query.playerId, weekStart);
    return {
      playerId: query.playerId,
      weekStart: query.weekStart,
      total,
      overload: isWeeklyOverload(total),
    };
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
