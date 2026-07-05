import { CompetitionType } from "../../generated/enums";

export interface CreateMatchDto {
  date: string;
  homeTeamName: string;
  awayTeamName: string;
  competitionType: CompetitionType;
  seasonId: number;
  externalId?: string;
}

export interface UpdateMatchDto {
  date?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore?: number;
  awayScore?: number;
  competitionType?: CompetitionType;
}

export interface MatchListQuery {
  seasonId?: number;
  competitionType?: CompetitionType;
}

export interface UpsertPlayerStatsDto {
  playerId: string;
  goals?: number;
  assists?: number;
  xG?: number;
  xA?: number;
  shots?: number;
  passAccuracy?: number;
  keyPasses?: number;
  tackles?: number;
  tackleSuccessRate?: number;
  clearances?: number;
  interceptions?: number;
  saves?: number;
  cleanSheet?: boolean;
  minutesPlayed?: number;
}

export interface UpsertTeamStatsDto {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passAccuracy: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  xG: number;
  corners: number;
  offsides: number;
  tackles: number;
  interceptions: number;
  clearances: number;
}
