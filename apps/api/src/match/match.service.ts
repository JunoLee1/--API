import { MatchRepository } from "./match.repo";
import { AppError } from "../lib/appError";
import {
  CreateMatchDto,
  UpdateMatchDto,
  MatchListQuery,
  UpsertPlayerStatsDto,
  UpsertTeamStatsDto,
} from "./dto/match.dto";

export class MatchService {
  constructor(private repo: MatchRepository) {}

  getMatches(query: MatchListQuery) {
    return this.repo.findAll(query);
  }

  async getMatchById(id: number) {
    const match = await this.repo.findById(id);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
    return match;
  }

  createMatch(dto: CreateMatchDto) {
    return this.repo.create(dto);
  }

  async updateMatch(id: number, dto: UpdateMatchDto) {
    const match = await this.repo.findById(id);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
    return this.repo.update(id, dto);
  }

  async upsertPlayerStats(matchId: number, dto: UpsertPlayerStatsDto) {
    const match = await this.repo.findById(matchId);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");

    const existing = await this.repo.findPlayerStats(matchId, dto.playerId);
    if (existing) {
      return this.repo.updatePlayerStats(existing.id, dto);
    }
    return this.repo.createPlayerStats(matchId, dto);
  }

  async upsertTeamStats(matchId: number, dto: UpsertTeamStatsDto) {
    const match = await this.repo.findById(matchId);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
    return this.repo.upsertTeamStats(matchId, dto);
  }
}
