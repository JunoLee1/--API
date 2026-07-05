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

  findResult(sessionId: number, playerId: string) {
    return this.prisma.trainingResult.findFirst({ where: { sessionId, playerId } });
  }

  createResult(sessionId: number, dto: UpsertResultDto) {
    return this.prisma.trainingResult.create({
      data: {
        sessionId,
        playerId: dto.playerId,
        attendance: dto.attendance,
        feedback: n(dto.feedback),
        performanceScore: n(dto.performanceScore),
      },
    });
  }

  updateResult(id: number, dto: UpsertResultDto) {
    return this.prisma.trainingResult.update({
      where: { id },
      data: {
        attendance: dto.attendance,
        feedback: n(dto.feedback),
        performanceScore: n(dto.performanceScore),
      },
    });
  }
}
