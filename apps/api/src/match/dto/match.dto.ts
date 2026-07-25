import { CompetitionType, Venue } from "../../generated/enums";

export const VALID_COMPETITION_TYPES = Object.values(CompetitionType);

export interface CreateMatchDto {
  date: string;
  homeTeamName: string;
  awayTeamName: string;
  competitionType: CompetitionType;
  seasonId: number;
  externalId?: string;
  venue?: Venue;
}

export interface UpdateMatchDto {
  date?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore?: number;
  awayScore?: number;
  competitionType?: CompetitionType;
  venue?: Venue;
}

export interface MatchListQuery {
  seasonId?: number;
  competitionType?: CompetitionType;
}

export interface UpsertPlayerStatsDto {
  playerId: string;
  goals?: number;
  assists?: number;
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
  aerialDuelSuccessRate?: number;
  sprint?: number;
  clearCutChanceRate?: number;
  penaltyConversionRate?: number;
  freeKickConversionRate?: number;
  foulsCommitted?: number;
  crossesCompleted?: number;
  shotsAllowed?: number;
  shotBlocked?: number;
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

export type ShotResultType = 'GOAL' | 'ON_TARGET' | 'OFF_TARGET' | 'BLOCKED';
export const VALID_SHOT_RESULTS: ShotResultType[] = ['GOAL', 'ON_TARGET', 'OFF_TARGET', 'BLOCKED'];

export interface CreateShotEventDto {
  shooterId: string;
  assisterId?: string;
  assisterPositionOverride?: string;
  xG: number;
  result: ShotResultType;
  minute?: number;
}
