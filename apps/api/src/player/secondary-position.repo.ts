import { PrismaClient } from "../generated/client";
import { Position } from "../generated/enums";

export class SecondaryPositionRepository {
  constructor(private prisma: PrismaClient) {}

  list(playerId: string) {
    return this.prisma.playerSecondaryPosition.findMany({
      where: { playerId },
      orderBy: { createdAt: "asc" },
    });
  }

  upsert(playerId: string, position: Position, fitnessTarget: number) {
    return this.prisma.playerSecondaryPosition.upsert({
      where: { playerId_position: { playerId, position } },
      create: { playerId, position, fitnessTarget },
      update: { fitnessTarget },
    });
  }

  delete(playerId: string, position: Position) {
    return this.prisma.playerSecondaryPosition.deleteMany({
      where: { playerId, position },
    });
  }
}
