import { PrismaClient } from "../generated/client";
import { CreatePlayerRepoDto, LinkUserRepoDto, UpdatePlayerServiceDto } from "./dto/player.dto";

export class PlayerRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreatePlayerRepoDto) {
    return await this.prisma.player.create({
      data: {
        playerName: data.playerName,
        dateOfBirth: data.dateOfBirth,
        preferredFoot: data.preferredFoot,
        height: data.height,
        weight: data.weight,
        position: data.position,
        level: data.level,
        ...(data.externalId !== undefined && { externalId: data.externalId }),
        nationality: { connect: { id: data.nationalityId } },
      },
      include: { nationality: true },
    });
  }

  async findById(id: string) {
    return await this.prisma.player.findUnique({
      where: { id },
      include: { nationality: true, user: true },
    });
  }

  async findAll(params: { skip?: number; take?: number }) {
    return await this.prisma.player.findMany({
      ...(params.skip !== undefined && { skip: params.skip }),
      ...(params.take !== undefined && { take: params.take }),
      include: { nationality: true, user: true },
    });
  }

  async linkUser({ playerId, userId }: LinkUserRepoDto) {
    return await this.prisma.player.update({
      where: { id: playerId },
      data: { user: { connect: { id: userId } } },
      include: { nationality: true, user: true },
    });
  }

  async unlinkUser(playerId: string) {
    return await this.prisma.player.update({
      where: { id: playerId },
      data: { userId: null },
    });
  }

  async update(id: string, data: Partial<CreatePlayerRepoDto>) {
    return await this.prisma.player.update({
      where: { id },
      data,
      include: { nationality: true, user: true },
    });
  }

  async isUserAlreadyLinked(userId: number) {
    return await this.prisma.player.findFirst({ where: { userId } });
  }
}
