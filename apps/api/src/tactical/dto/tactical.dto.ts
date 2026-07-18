import { TacticalPhase, Position } from "../../generated/enums";

export interface CreateAnalysisDto {
  matchId: number;
  seasonId: number;
  phase: TacticalPhase;
  formation?: string;
  opponentAnalysis?: string;
}

export interface AddLineupDto {
  playerId: string;
  position: Position;
}

export interface AddMediaDto {
  url: string;
  type: string;
}
