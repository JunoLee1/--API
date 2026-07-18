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
}
