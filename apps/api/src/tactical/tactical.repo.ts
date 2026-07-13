import { PrismaClient } from "../generated/client";
import { CreateAnalysisDto, AddLineupDto, AddMediaDto } from "./dto/tactical.dto";

const n = <T>(v: T | undefined): T | null => v ?? null;

export class TacticalRepository {
  constructor(private prisma: PrismaClient) {}

  findByMatch(matchId: number) {
    return this.prisma.tacticalAnalysis.findMany({
      where: { matchId },
      select: { id: true, phase: true, formation: true, createdAt: true, createdById: true },
    });
  }

  findById(id: number) {
    return this.prisma.tacticalAnalysis.findUnique({
      where: { id },
      include: {
        lineup: { include: { player: { select: { playerName: true } } } },
        media: true,
      },
    });
  }

  create(dto: CreateAnalysisDto, createdById: number) {
    return this.prisma.tacticalAnalysis.create({
      data: {
        matchId: dto.matchId,
        seasonId: dto.seasonId,
        phase: dto.phase,
        formation: dto.formation,
        opponentAnalysis: n(dto.opponentAnalysis),
        createdById,
      },
      select: { id: true, phase: true, formation: true, opponentAnalysis: true, createdAt: true },
    });
  }

  addLineup(tacticalAnalysisId: number, dto: AddLineupDto) {
    return this.prisma.tacticalLineup.create({
      data: { tacticalAnalysisId, playerId: dto.playerId, position: dto.position },
    });
  }

  addMedia(tacticalAnalysisId: number, dto: AddMediaDto) {
    return this.prisma.tacticalMedia.create({
      data: { tacticalAnalysisId, url: dto.url, type: dto.type },
    });
  }

  confirm(id: number) {
    return this.prisma.tacticalAnalysis.update({
      where: { id },
      data: { status: "CONFIRMED" },
      select: { id: true, status: true },
    });
  }
}
