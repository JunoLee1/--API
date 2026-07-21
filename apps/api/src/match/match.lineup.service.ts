import { MatchLineupRepository } from "./match.lineup.repo";
import { AppError } from "../lib/appError";
import type { SaveLineupDto } from "./dto/lineup.dto";

const SUPPORTED_FORMATIONS = [
  "4-3-3", "4-4-2", "4-2-3-1", "4-1-4-1",
  "3-5-2", "3-4-3", "5-3-2", "5-4-1",
];

export class MatchLineupService {
  constructor(private repo: MatchLineupRepository) {}

  getLineup(matchId: number) {
    return this.repo.findByMatch(matchId);
  }

  async saveLineup(matchId: number, dto: SaveLineupDto) {
    if (!SUPPORTED_FORMATIONS.includes(dto.formation)) {
      throw new AppError(400, "INVALID_FORMATION");
    }
    const playerIds = dto.slots.map((s) => s.playerId);
    if (new Set(playerIds).size !== playerIds.length) {
      throw new AppError(409, "DUPLICATE_PLAYER");
    }
    const slotKeys = dto.slots.map((s) => s.slotKey);
    if (new Set(slotKeys).size !== slotKeys.length) {
      throw new AppError(409, "DUPLICATE_SLOT");
    }
    return this.repo.saveLineup(matchId, dto);
  }

  async confirmLineup(matchId: number, confirmedById: number) {
    const lineup = await this.repo.findByMatch(matchId);
    if (!lineup) throw new AppError(404, "LINEUP_NOT_FOUND");
    return this.repo.confirmLineup(matchId, confirmedById);
  }
}
