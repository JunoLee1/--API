import { PrismaClient } from "../generated/client";
import { CreateSessionDto, AddContentDto, AddParticipantsDto, UpsertResultDto, SessionListQuery } from "./dto/training.dto";

const n = <T>(v: T | undefined): T | null => v ?? null;

export class TrainingRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: SessionListQuery) {
    return this.prisma.trainingSession.findMany({
      where: { ...(query.seasonId && { seasonId: query.seasonId }) },
      select: {
        id: true,
        date: true,
        goal: true,
        sessionType: true,
        isApproved: true,
        seasonId: true,
        createdById: true,
      },
      orderBy: { date: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.trainingSession.findUnique({
      where: { id },
      select: {
        id: true,
        date: true,
        goal: true,
        sessionType: true,
        isApproved: true,
        seasonId: true,
        createdById: true,
        approvedById: true,
        contents: true,
        participants: { select: { playerId: true, player: { select: { playerName: true, position: true } } } },
        results: true,
      },
    });
  }

  create(dto: CreateSessionDto, createdById: number) {
    return this.prisma.trainingSession.create({
      data: {
        date: new Date(dto.date),
        goal: dto.goal,
        sessionType: dto.sessionType,
        seasonId: dto.seasonId,
        createdById,
        ...(dto.contents && {
          contents: { create: dto.contents },
        }),
      },
      select: { id: true, date: true, goal: true, sessionType: true, isApproved: true, seasonId: true },
    });
  }

  approve(id: number, approvedById: number) {
    return this.prisma.trainingSession.update({
      where: { id },
      data: { isApproved: true, approvedById },
      select: { id: true, isApproved: true, approvedById: true },
    });
  }

  addContent(sessionId: number, dto: AddContentDto) {
    return this.prisma.trainingContent.create({
      data: { sessionId, phase: dto.phase, description: dto.description },
    });
  }

  addParticipants(sessionId: number, dto: AddParticipantsDto) {
    return this.prisma.trainingParticipant.createMany({
      data: dto.playerIds.map((playerId) => ({ sessionId, playerId })),
      skipDuplicates: true,
    });
  }

  upsertResult(sessionId: number, dto: UpsertResultDto) {
    return this.prisma.trainingResult.upsert({
      where: { sessionId_playerId: { sessionId, playerId: dto.playerId } },
      create: {
        sessionId,
        playerId: dto.playerId,
        attendance: dto.attendance,
        feedback: n(dto.feedback),
        performanceScore: n(dto.performanceScore),
      },
      update: {
        attendance: dto.attendance,
        feedback: n(dto.feedback),
        performanceScore: n(dto.performanceScore),
      },
    });
  }

  async countUnexcusedAttendance(playerId: string): Promise<{ absences: number; lateCount: number }> {
    const rows = await this.prisma.trainingResult.groupBy({
      by: ["attendance"],
      where: { playerId, attendance: { in: ["ABSENT_UNAUTHORIZED", "LATE_UNAUTHORIZED"] } },
      _count: { attendance: true },
    });
    const absences = rows.find((r) => r.attendance === "ABSENT_UNAUTHORIZED")?._count.attendance ?? 0;
    const lateCount = rows.find((r) => r.attendance === "LATE_UNAUTHORIZED")?._count.attendance ?? 0;
    return { absences, lateCount };
  }

  findPlayerNameById(playerId: string) {
    return this.prisma.player.findUnique({ where: { id: playerId }, select: { playerName: true } });
  }

  findResults(filters: {
    from?: string
    to?: string
    sessionType?: string
    playerId?: string
  }) {
    const where: Record<string, unknown> = {}

    if (filters.from || filters.to) {
      where.session = {
        date: {
          ...(filters.from ? { gte: new Date(filters.from) } : {}),
          ...(filters.to ? { lte: new Date(filters.to + 'T23:59:59Z') } : {}),
        },
      }
    }

    if (filters.sessionType) {
      where.session = {
        ...(where.session as object ?? {}),
        sessionType: filters.sessionType,
      }
    }

    if (filters.playerId) {
      where.playerId = filters.playerId
    }

    return this.prisma.trainingResult.findMany({
      where: where as any,
      include: {
        session: { select: { id: true, date: true, sessionType: true, goal: true } },
        player: { select: { id: true, playerName: true, position: true } },
      },
      orderBy: { session: { date: 'desc' } },
    })
  }
}
