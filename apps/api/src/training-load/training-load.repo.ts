import { PrismaClient } from "../generated/client";
import { UpsertTrainingLoadDto, TrainingLoadQuery } from "./dto/training-load.dto";

export class TrainingLoadRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: TrainingLoadQuery) {
    const where: Record<string, unknown> = {};
    if (query.sessionId) where["sessionId"] = query.sessionId;
    if (query.playerId) where["playerId"] = query.playerId;
    return this.prisma.trainingLoad.findMany({
      where,
      include: {
        player: { select: { id: true, playerName: true, position: true } },
        session: { select: { id: true, date: true, sessionType: true } },
      },
      orderBy: { session: { date: "desc" } },
    });
  }

  upsert(dto: UpsertTrainingLoadDto) {
    return this.prisma.trainingLoad.upsert({
      where: { playerId_sessionId: { playerId: dto.playerId, sessionId: dto.sessionId } },
      create: {
        playerId: dto.playerId,
        sessionId: dto.sessionId,
        rpe: dto.rpe ?? 5,
        load: dto.load ?? null,
      },
      update: {
        ...(dto.rpe !== undefined && { rpe: dto.rpe }),
        ...(dto.load !== undefined && { load: dto.load }),
      },
    });
  }

  async getWeeklyLoadTotal(playerId: string, weekStart: Date): Promise<number> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const rows = await this.prisma.trainingLoad.findMany({
      where: {
        playerId,
        load: { not: null },
        session: { date: { gte: weekStart, lt: weekEnd } },
      },
      select: { load: true },
    });
    return rows.reduce((sum, r) => sum + (r.load ?? 0), 0);
  }

  getPlayerName(playerId: string) {
    return this.prisma.player.findUnique({
      where: { id: playerId },
      select: { playerName: true },
    });
  }

  async getInjuryLoadCorrelation(playerId: string, weeksBeforeInjury = 4) {
    const injuries = await this.prisma.injury.findMany({
      where: { playerId },
      select: { id: true, occurredAt: true, bodyPart: true, cause: true },
      orderBy: { occurredAt: "desc" },
    });
    const result = [];
    for (const injury of injuries) {
      const windowStart = new Date(injury.occurredAt);
      windowStart.setDate(windowStart.getDate() - weeksBeforeInjury * 7);
      const loads = await this.prisma.trainingLoad.findMany({
        where: {
          playerId,
          session: { date: { gte: windowStart, lte: injury.occurredAt } },
        },
        include: { session: { select: { date: true, sessionType: true } } },
        orderBy: { session: { date: "asc" } },
      });
      const totalLoad = loads.reduce((s, l) => s + (l.load ?? 0), 0);
      const avgRpe = loads.length === 0 ? null : Math.round(loads.reduce((s, l) => s + l.rpe, 0) / loads.length * 10) / 10;
      result.push({ injury, priorPeriodLoad: totalLoad, avgRpe, sessionCount: loads.length });
    }
    return result;
  }

  async getPlayerGrowthTrajectory(playerId: string) {
    const results = await this.prisma.trainingResult.findMany({
      where: { playerId, performanceScore: { not: null } },
      select: {
        performanceScore: true,
        session: { select: { date: true, sessionType: true } },
      },
      orderBy: { session: { date: "asc" } },
    });
    const windowSize = 4;
    const byWeek = new Map<string, number[]>();
    for (const r of results) {
      const d = r.session.date;
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      const arr = byWeek.get(key) ?? [];
      arr.push(r.performanceScore!);
      byWeek.set(key, arr);
    }
    const weekEntries = Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, scores]) => ({ weekStart, avgScore: scores.reduce((s, v) => s + v, 0) / scores.length }));
    const trajectory = weekEntries.map((entry, i) => {
      const window = weekEntries.slice(Math.max(0, i - windowSize + 1), i + 1);
      const movingAvg = window.reduce((s, e) => s + e.avgScore, 0) / window.length;
      return { weekStart: entry.weekStart, weekAvg: Math.round(entry.avgScore * 10) / 10, movingAvg: Math.round(movingAvg * 10) / 10 };
    });
    return { playerId, trajectory, dataPoints: trajectory.length };
  }

  getAllWithSession(seasonId?: number) {
    return this.prisma.trainingLoad.findMany({
      where: seasonId ? { session: { seasonId } } : {},
      include: { session: { select: { id: true, date: true, seasonId: true } } },
    });
  }

  getLoadsBetween(playerId: string, from: Date, to: Date) {
    return this.prisma.trainingLoad.findMany({
      where: { playerId, session: { date: { gte: from, lt: to } } },
      select: { load: true, rpe: true },
    });
  }
}
