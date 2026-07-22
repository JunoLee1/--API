import { PlayerRepository } from "./player.repo";
import { AppError } from "../lib/appError";
import { CreatePlayerDto, UpdatePlayerDto, UpdatePlayerStatusDto, PlayerListQuery } from "./dto/player.dto";
import { MarketValueRepository } from "./market-value.repo";
import { UpdateMarketValueDto } from "./dto/market-value.dto";

export class PlayerService {
  constructor(private repo: PlayerRepository, private mvRepo?: MarketValueRepository) {}

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

  async deletePlayer(id: string) {
    const player = await this.repo.findById(id);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    await this.repo.delete(id);
  }

  async getMarketValueHistory(playerId: string) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    if (!this.mvRepo) throw new AppError(500, "MARKET_VALUE_REPO_NOT_CONFIGURED");
    return this.mvRepo.getHistory(playerId);
  }

  async updateMarketValue(playerId: string, dto: UpdateMarketValueDto, recordedById: number) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    if (!this.mvRepo) throw new AppError(500, "MARKET_VALUE_REPO_NOT_CONFIGURED");
    await this.mvRepo.updateCurrentValue(playerId, dto.value, recordedById);
    return { playerId, currentMarketValue: dto.value };
  }

  async getMatchStats(playerId: string, seasonId?: number) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    return this.repo.getMatchStats(playerId, seasonId);
  }

  async getTrainingResults(playerId: string, requesterId: string, requesterRole: string, from?: string, to?: string) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    if (requesterRole === "PLAYER" && String(player.userId) !== requesterId) {
      throw new AppError(403, "FORBIDDEN");
    }
    return this.repo.getTrainingResults(playerId, from, to);
  }

  async getPositionDiversity(playerId: string) {
    const player = await this.repo.findById(playerId);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    if (player.team?.type !== "YOUTH") return [];
    const rows = await this.repo.getPositionDiversity(playerId);
    const totalMinutes = rows.reduce((sum, r) => sum + r.totalMinutes, 0);
    if (totalMinutes === 0) return [];
    return rows.map((r) => ({
      position: r.position,
      minutes: r.totalMinutes,
      percentage: Math.round((r.totalMinutes / totalMinutes) * 100),
    }));
  }
}
