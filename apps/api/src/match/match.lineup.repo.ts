import { PrismaClient } from "../generated/client";
import type { SaveLineupDto } from "./dto/lineup.dto";

const PLAYER_SELECT = { id: true, playerName: true, position: true } as const;

export class MatchLineupRepository {
  constructor(private prisma: PrismaClient) {}

  findByMatch(matchId: number) {
    return this.prisma.matchLineup.findUnique({
      where: { matchId },
      include: {
        slots: {
          include: { player: { select: PLAYER_SELECT } },
        },
      },
    });
  }

  async saveLineup(matchId: number, dto: SaveLineupDto) {
    return this.prisma.$transaction(async (tx) => {
      const lineup = await tx.matchLineup.upsert({
        where: { matchId },
        create: { matchId, formation: dto.formation },
        update: { formation: dto.formation },
      });
      await tx.lineupSlot.deleteMany({ where: { lineupId: lineup.id } });
      if (dto.slots.length > 0) {
        await tx.lineupSlot.createMany({
          data: dto.slots.map((s) => ({
            lineupId: lineup.id,
            playerId: s.playerId,
            slotKey: s.slotKey,
            isStarter: s.isStarter,
          })),
        });
      }
      return tx.matchLineup.findUnique({
        where: { id: lineup.id },
        include: {
          slots: {
            include: { player: { select: PLAYER_SELECT } },
          },
        },
      });
    });
  }

  confirmLineup(matchId: number, confirmedById: number) {
    return this.prisma.matchLineup.update({
      where: { matchId },
      data: { isConfirmed: true, confirmedAt: new Date(), confirmedById },
    });
  }
}
