export type CompetitionType = 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'CHAMPIONS_LEAGUE'

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

export interface MatchDetail extends Match {
  playerMatchStats: PlayerMatchStat[]
  teamMatchStats: TeamMatchStat | null
}

export const COMPETITION_LABEL: Record<CompetitionType, string> = {
  LEAGUE: '리그',
  CUP: '컵',
  FRIENDLY: '친선',
  CHAMPIONS_LEAGUE: 'UCL',
}

export const COMPETITION_STYLE: Record<CompetitionType, string> = {
  LEAGUE: 'bg-blue-100 text-blue-800 border-blue-200',
  CUP: 'bg-amber-100 text-amber-800 border-amber-200',
  FRIENDLY: 'bg-gray-100 text-gray-600 border-gray-200',
  CHAMPIONS_LEAGUE: 'bg-purple-100 text-purple-800 border-purple-200',
}
