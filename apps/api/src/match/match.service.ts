import { MatchRepository } from "./match.repo";
import { AppError } from "../lib/appError";
import {
  CreateMatchDto,
  UpdateMatchDto,
  MatchListQuery,
  UpsertPlayerStatsDto,
  UpsertTeamStatsDto,
  VALID_COMPETITION_TYPES,
} from "./dto/match.dto";
import { Venue } from "../generated/enums";

const VALID_VENUES = Object.values(Venue);

export class MatchService {
  constructor(private repo: MatchRepository) {}

  getMatches(query: MatchListQuery) {
    if (query.competitionType !== undefined && !VALID_COMPETITION_TYPES.includes(query.competitionType)) {
      throw new AppError(400, "INVALID_COMPETITION_TYPE");
    }
    return this.repo.findAll(query);
  }

  async getMatchById(id: number) {
    const match = await this.repo.findById(id);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
    return match;
  }

  createMatch(dto: CreateMatchDto) {
    if (!VALID_COMPETITION_TYPES.includes(dto.competitionType)) {
      throw new AppError(400, "INVALID_COMPETITION_TYPE");
    }
    if (dto.venue !== undefined && !VALID_VENUES.includes(dto.venue)) {
      throw new AppError(400, "INVALID_VENUE");
    }
    return this.repo.create(dto);
  }

  async updateMatch(id: number, dto: UpdateMatchDto) {
    const match = await this.repo.findById(id);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
    if (dto.competitionType !== undefined && !VALID_COMPETITION_TYPES.includes(dto.competitionType)) {
      throw new AppError(400, "INVALID_COMPETITION_TYPE");
    }
    if (dto.venue !== undefined && !VALID_VENUES.includes(dto.venue)) {
      throw new AppError(400, "INVALID_VENUE");
    }
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
