import { MatchSquadRepository } from "./match.squad.repo";

export class MatchSquadService {
  constructor(private repo: MatchSquadRepository) {}

  getSquad(matchId: number) {
    return this.repo.findByMatch(matchId);
  }

  addPlayer(matchId: number, playerId: string) {
    return this.repo.addPlayer(matchId, playerId);
  }

  removePlayer(matchId: number, playerId: string) {
    return this.repo.removePlayer(matchId, playerId);
  }

  confirmSquad(matchId: number, confirmedById: number) {
    return this.repo.confirmSquad(matchId, confirmedById);
  }
}
