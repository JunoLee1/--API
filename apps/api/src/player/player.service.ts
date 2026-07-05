import { PlayerRepository } from "./player.repo";
import { AppError } from "../lib/appError";
import { CreatePlayerDto, UpdatePlayerDto, UpdatePlayerStatusDto, PlayerListQuery } from "./dto/player.dto";

export class PlayerService {
  constructor(private repo: PlayerRepository) {}

  getPlayers(query: PlayerListQuery) {
    return this.repo.findAll(query);
  }

  async getPlayerById(id: string) {
    const player = await this.repo.findById(id);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    return player;
  }

  createPlayer(dto: CreatePlayerDto) {
    return this.repo.create(dto);
  }

  async updatePlayer(id: string, dto: UpdatePlayerDto) {
    const player = await this.repo.findById(id);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    return this.repo.update(id, dto);
  }

  async updatePlayerStatus(id: string, { status }: UpdatePlayerStatusDto) {
    const player = await this.repo.findById(id);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    return this.repo.updateStatus(id, status);
  }
}
