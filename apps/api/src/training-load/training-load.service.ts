import { TrainingLoadRepository } from "./training-load.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { UpsertTrainingLoadDto, TrainingLoadQuery, WeeklySummaryQuery } from "./dto/training-load.dto";
import { AppError } from "../lib/appError";

// KN3: position-based load thresholds instead of a single constant
export const WEEKLY_LOAD_THRESHOLD: Record<string, number> = {
  GK: 400,
  CB: 500,
  LB: 520,
  RB: 520,
  CDM: 540,
  CM: 540,
  CAM: 520,
  LW: 530,
  RW: 530,
  ST: 500,
  DEFAULT: 500,
};

export function getLoadThreshold(position?: string | null): number {
  return WEEKLY_LOAD_THRESHOLD[position ?? "DEFAULT"] ?? WEEKLY_LOAD_THRESHOLD["DEFAULT"]!;
}

export function isWeeklyOverload(weeklyTotal: number, position?: string | null): boolean {
  return weeklyTotal >= getLoadThreshold(position);
}

export function getEffectiveThreshold(position?: string | null, rehabLoadPercentage?: number | null): number {
  const base = getLoadThreshold(position);
  if (rehabLoadPercentage == null) return base;
  return Math.round(base * (rehabLoadPercentage / 100));
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
      const activeInjury = await this.repo.findActiveInjuryWithReport(dto.playerId);
      const rehabLoadPercentage = activeInjury?.report?.rehabLoadPercentage ?? null;
      const allowedActivities = activeInjury?.report?.allowedActivities ?? null;

      if (activeInjury) {
        console.warn(`[TrainingLoad] Player ${dto.playerId} has active injury (${activeInjury.status})`);
      }

      const weekStart = this.getWeekStart(new Date());
      const total = await this.repo.getWeeklyLoadTotal(dto.playerId, weekStart);
      const player = await this.repo.getPlayerName(dto.playerId);
      const playerName = player?.playerName ?? dto.playerId;
      // KN3: use position-based threshold for overload check; KN6: scale by rehabLoadPercentage
      const threshold = getEffectiveThreshold(player?.position, rehabLoadPercentage);
      if (total >= threshold) {
        try {
          await Promise.all([
            this.notifRepo.createForPhysicalCoach(
              "TRAINING_LOAD_ALERT",
              () => ({
                title: "훈련 부하 초과",
                body: `${playerName} 선수의 이번 주 누적 부하(${total})가 임계값(${threshold})을 초과했습니다.`,
              }),
              undefined,
            ).catch(console.error),
            this.notifRepo.createForHeadCoach(
              "TRAINING_LOAD_ALERT",
              () => ({
                title: "훈련 부하 초과",
                body: `${playerName} 선수의 이번 주 누적 부하(${total})가 임계값(${threshold})을 초과했습니다.`,
              }),
              undefined,
            ).catch(console.error),
            this.notifRepo.createForMedicalDirector(
              "TRAINING_LOAD_ALERT",
              () => ({
                title: "훈련 부하 초과",
                body: `${playerName} 선수의 이번 주 누적 부하(${total})가 임계값(${threshold})을 초과했습니다.`,
              }),
              undefined,
            ).catch(console.error),
          ]);
        } catch (err) {
          console.error("[TrainingLoad:overload-notify]", err);
        }
      }

      if (allowedActivities != null) {
        return { ...result, allowedActivities };
      }
    }

    return result;
  }

  async getWeeklySummary(query: WeeklySummaryQuery) {
    const weekStart = new Date(query.weekStart);
    const [total, player] = await Promise.all([
      this.repo.getWeeklyLoadTotal(query.playerId, weekStart),
      this.repo.getPlayerName(query.playerId),
    ]);
    // KN3: use position-based threshold for summary overload flag
    return {
      playerId: query.playerId,
      weekStart: query.weekStart,
      total,
      overload: isWeeklyOverload(total, player?.position),
      threshold: getLoadThreshold(player?.position),
    };
  }

  getInjuryLoadCorrelation(playerId: string, weeksBeforeInjury?: number) {
    return this.repo.getInjuryLoadCorrelation(playerId, weeksBeforeInjury);
  }

  getPlayerGrowthTrajectory(playerId: string) {
    return this.repo.getPlayerGrowthTrajectory(playerId);
  }

  async detectLoadRpeAnomalies(seasonId?: number) {
    const loads = await this.repo.getAllWithSession(seasonId);
    const anomalies = loads.filter((l) => {
      // KN3: use DEFAULT threshold as session-level reference for anomaly detection
      const sessionHighLoadRef = getLoadThreshold("DEFAULT") * 0.14;
      const highLoad = (l.load ?? 0) >= sessionHighLoadRef;
      const lowRpe = l.rpe < 4;
      const lowLoad = (l.load ?? 0) > 0 && (l.load ?? 0) < 20;
      const highRpe = l.rpe >= 8;
      return (highLoad && lowRpe) || (lowLoad && highRpe);
    });
    return anomalies.map((l) => ({
      playerId: l.playerId,
      sessionId: l.sessionId,
      load: l.load,
      rpe: l.rpe,
      anomalyType: ((l.load ?? 0) >= (getLoadThreshold("DEFAULT") * 0.14) && l.rpe < 4) ? "HIGH_LOAD_LOW_RPE" : "LOW_LOAD_HIGH_RPE",
    }));
  }

  async getAcuteChronicRatio(playerId: string) {
    const now = new Date();
    const acuteStart = new Date(now); acuteStart.setDate(now.getDate() - 7);
    const chronicStart = new Date(now); chronicStart.setDate(now.getDate() - 28);

    const [acuteLoads, chronicLoads] = await Promise.all([
      this.repo.getLoadsBetween(playerId, acuteStart, now),
      this.repo.getLoadsBetween(playerId, chronicStart, now),
    ]);

    const acuteTotal = acuteLoads.reduce((s, l) => s + (l.load ?? 0), 0);
    const chronicWeeklyAvg = chronicLoads.reduce((s, l) => s + (l.load ?? 0), 0) / 4;
    const ratio = chronicWeeklyAvg === 0 ? null : Math.round((acuteTotal / chronicWeeklyAvg) * 100) / 100;

    return {
      playerId,
      acuteLoad: acuteTotal,
      chronicWeeklyAvg: Math.round(chronicWeeklyAvg),
      acuteChronicRatio: ratio,
      riskLevel: ratio == null ? "UNKNOWN" : ratio > 1.5 ? "HIGH" : ratio > 1.3 ? "MODERATE" : "LOW",
    };
  }

  private getWeekStart(date: Date): Date {
    // Convert to KST (UTC+9) before calculating week boundary
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const kstTime = new Date(date.getTime() + KST_OFFSET_MS);
    const day = kstTime.getUTCDay(); // 0=Sunday, 1=Monday
    const diff = kstTime.getUTCDate() - day + (day === 0 ? -6 : 1);
    kstTime.setUTCDate(diff);
    kstTime.setUTCHours(0, 0, 0, 0);
    // Return as UTC (subtract KST offset)
    return new Date(kstTime.getTime() - KST_OFFSET_MS);
  }
}
