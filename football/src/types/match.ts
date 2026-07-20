export type CompetitionType = 'LEAGUE' | 'DOMESTIC_CUP' | 'CONTINENTAL' | 'PLAYOFF' | 'FRIENDLY'

export interface Match {
  id: number
  date: string
  homeTeamName: string
  awayTeamName: string
  homeScore: number | null
  awayScore: number | null
  competitionType: CompetitionType
  seasonId: number
  externalId: string | null
}

export interface PlayerMatchStat {
  id: number
  playerId: string
  goals: number | null
  assists: number | null
  xG: number | null
  xA: number | null
  shots: number | null
  passAccuracy: number | null
  keyPasses: number | null
  tackles: number | null
  tackleSuccessRate: number | null
  clearances: number | null
  interceptions: number | null
  saves: number | null
  cleanSheet: boolean | null
  minutesPlayed: number | null
  player: { playerName: string; position: string }
}

export interface TeamMatchStat {
  id: number
  possession: number
  shots: number
  shotsOnTarget: number
  passes: number
  passAccuracy: number
  fouls: number
  yellowCards: number
  redCards: number
  xG: number
  corners: number
  offsides: number
  tackles: number
  interceptions: number
  clearances: number
}

export type ShotResult = 'GOAL' | 'ON_TARGET' | 'OFF_TARGET' | 'BLOCKED'

export const SHOT_RESULT_LABEL: Record<ShotResult, string> = {
  GOAL:       '골',
  ON_TARGET:  '유효슈팅',
  OFF_TARGET: '빗나감',
  BLOCKED:    '블록',
}

export const SHOT_RESULT_STYLE: Record<ShotResult, string> = {
  GOAL:       'bg-emerald-100 text-emerald-800 border-emerald-200',
  ON_TARGET:  'bg-blue-100 text-blue-800 border-blue-200',
  OFF_TARGET: 'bg-slate-100 text-slate-600 border-slate-200',
  BLOCKED:    'bg-orange-100 text-orange-800 border-orange-200',
}

export interface ShotEvent {
  id:                       number
  matchId:                  number
  xG:                       number
  result:                   ShotResult
  minute:                   number | null
  assisterPositionOverride: string | null
  shooter:                  { id: string; playerName: string; position: string }
  assister:                 { id: string; playerName: string; position: string } | null
}

export interface MatchDetail extends Match {
  playerMatchStats: PlayerMatchStat[]
  teamMatchStats: TeamMatchStat | null
}

export const COMPETITION_LABEL: Record<CompetitionType, string> = {
  LEAGUE: '리그',
  DOMESTIC_CUP: 'FA컵',
  CONTINENTAL: 'ACL',
  PLAYOFF: '플레이오프',
  FRIENDLY: '친선',
}

export const COMPETITION_STYLE: Record<CompetitionType, string> = {
  LEAGUE: 'bg-blue-100 text-blue-800 border-blue-200',
  DOMESTIC_CUP: 'bg-amber-100 text-amber-800 border-amber-200',
  CONTINENTAL: 'bg-purple-100 text-purple-800 border-purple-200',
  PLAYOFF: 'bg-orange-100 text-orange-800 border-orange-200',
  FRIENDLY: 'bg-gray-100 text-gray-600 border-gray-200',
}
