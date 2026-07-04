import { PrismaClient, Role } from "../generated/client";
import { AppError } from "../lib/appError";
import { PlayerRepository } from "./player.repo";
import { CreatePlayerRepoDto, CreatePlayerServiceDto, UpdatePlayerServiceDto } from "./dto/player.dto";

export class PlayerService {
  constructor(
    private repo: PlayerRepository,
    private prisma: PrismaClient,
  ) {}

  async createPlayer(data: CreatePlayerServiceDto) {
    return await this.repo.create({
      ...data,
      dateOfBirth: new Date(data.dateOfBirth),
    });
  }

  async getPlayerById(id: string) {
    const player = await this.repo.findById(id);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    return player;
  }

  async getPlayers(params: { skip?: number; take?: number }) {
    return await this.repo.findAll(params);
  }

  async linkUser(playerId: string, userId: number) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");

    if (player.userId !== null) throw new AppError(409, "PLAYER_ALREADY_LINKED");

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, "USER_NOT_FOUND");

    if (user.role !== Role.PLAYER) throw new AppError(400, "USER_ROLE_MUST_BE_PLAYER");

    const existingLink = await this.repo.isUserAlreadyLinked(userId);
    if (existingLink) throw new AppError(409, "USER_ALREADY_LINKED_TO_PLAYER");

    return await this.repo.linkUser({ playerId, userId });
  }

  async updatePlayer(id: string, data: UpdatePlayerServiceDto) {
    const player = await this.repo.findById(id);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");

    const updateData: Partial<CreatePlayerRepoDto> = {
      ...(data.playerName !== undefined && { playerName: data.playerName }),
      ...(data.preferredFoot !== undefined && { preferredFoot: data.preferredFoot }),
      ...(data.height !== undefined && { height: data.height }),
      ...(data.weight !== undefined && { weight: data.weight }),
      ...(data.position !== undefined && { position: data.position }),
      ...(data.level !== undefined && { level: data.level }),
      ...(data.externalId !== undefined && { externalId: data.externalId }),
      ...(data.dateOfBirth !== undefined && { dateOfBirth: new Date(data.dateOfBirth) }),
    };
    return await this.repo.update(id, updateData);
  }
}
