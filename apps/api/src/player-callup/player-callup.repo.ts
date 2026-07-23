import { PrismaClient } from "../generated/client";
import { CreateCallupDto, CallupListQuery } from "./dto/player-callup.dto";

const SELECT = {
  id: true,
  status: true,
  reason: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  player: { select: { id: true, playerName: true, position: true, guardianId: true } },
  fromTeam: { select: { id: true, name: true } },
  toTeam: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, nickname: true } },
  approvedBy: { select: { id: true, nickname: true } },
} as const;

export class PlayerCallupRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: CallupListQuery) {
    const where = query.status ? { status: query.status as any } : {};
    return this.prisma.playerCallup.findMany({
      where,
      select: SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.playerCallup.findUnique({ where: { id }, select: SELECT });
  }

  create(dto: CreateCallupDto & { requestedById: number }) {
    return this.prisma.playerCallup.create({
      data: {
        playerId: dto.playerId,
        fromTeamId: dto.fromTeamId,
        toTeamId: dto.toTeamId,
        requestedById: dto.requestedById,
        reason: dto.reason,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      select: SELECT,
    });
  }

  approve(id: number, approvedById: number) {
    return this.prisma.playerCallup.update({
      where: { id },
      data: { status: "APPROVED", approvedById },
      select: SELECT,
    });
  }

  reject(id: number, approvedById: number, reason: string) {
    return this.prisma.playerCallup.update({
      where: { id },
      data: { status: "REJECTED", approvedById, reason },
      select: SELECT,
    });
  }

  complete(id: number) {
    return this.prisma.playerCallup.update({
      where: { id },
      data: { status: "COMPLETED" },
      select: SELECT,
    });
  }

  updatePlayerTeam(playerId: string, teamId: number) {
    return this.prisma.player.update({
      where: { id: playerId },
      data: { teamId },
    });
  }
}
