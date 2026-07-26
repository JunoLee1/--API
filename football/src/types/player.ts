export type PlayerStatus = 'ACTIVE' | 'ON_LOAN' | 'RELEASED' | 'RETIRED'
export type PlayerLevel = 'YOUTH' | 'ROOKIE' | 'SENIOR' | 'VETERAN'
export type Foot = 'LEFT' | 'RIGHT'

export type Position =
  | 'GOALKEEPER'
  | 'STRIKER'
  | 'SHADOW_STRIKER'
  | 'WINGER'
  | 'CENTRAL_ATTACK_MIDFIELDER'
  | 'RIGHT_ATTACK_MIDFIELDER'
  | 'LEFT_ATTACK_MIDFIELDER'
  | 'CENTRAL_DEFENSIVE_MIDFIELDER'
  | 'LEFT_DEFENSIVE_MIDFIELDER'
  | 'RIGHT_DEFENSIVE_MIDFIELDER'
  | 'CENTER_BACK'
  | 'LEFT_WING_BACK'
  | 'LEFT_FULL_BACK'
  | 'RIGHT_WING_BACK'
  | 'RIGHT_FULL_BACK'

export interface PlayerNationality {
  id: number
  name: string
  code: string
}

export interface PlayerContract {
  id: string
  startDate: string
  endDate: string
  salary: number
  status: string
}

export interface Player {
  id: string
  playerName: string
  dateOfBirth: string
  preferredFoot: Foot
  height: number
  weight: number
  position: Position
  level: PlayerLevel
  status: PlayerStatus
  externalId: string | null
  currentMarketValue: number | null
  nationality: PlayerNationality
}

export type TransferType = 'PERMANENT' | 'LOAN_OUT' | 'LOAN_IN' | 'FREE' | 'RELEASE'

export interface PlayerTransfer {
  id: number
  type: TransferType
  date: string
  fee: number | null
  fromClub: string | null
  toClub: string | null
}


export interface PlayerDetail extends Player {
  userId: number | null
  agentId: number | null
  teamId: number | null
  playStyle: string | null
  team: { id: number; type: 'FIRST_TEAM' | 'YOUTH' } | null
  contracts: PlayerContract[]
  transfers: PlayerTransfer[]
}

export interface PlayerListQuery {
  status?: PlayerStatus
  position?: Position
  level?: PlayerLevel
  excludeYouth?: boolean
}

export interface CreatePlayerPayload {
  playerName: string
  dateOfBirth: string
  preferredFoot: Foot
  height: number
  weight: number
  position: Position
  level: PlayerLevel
  nationalityId: number
  externalId?: string
}

export interface UpdatePlayerPayload {
  playerName?: string
  dateOfBirth?: string
  preferredFoot?: Foot
  height?: number
  weight?: number
  position?: Position
  level?: PlayerLevel
  nationalityId?: number
  externalId?: string
}

export const POSITION_ABBR: Record<Position, string> = {
  GOALKEEPER: 'GK',
  STRIKER: 'ST',
  SHADOW_STRIKER: 'SS',
  WINGER: 'WG',
  CENTRAL_ATTACK_MIDFIELDER: 'CAM',
  RIGHT_ATTACK_MIDFIELDER: 'RAM',
  LEFT_ATTACK_MIDFIELDER: 'LAM',
  CENTRAL_DEFENSIVE_MIDFIELDER: 'CDM',
  LEFT_DEFENSIVE_MIDFIELDER: 'LDM',
  RIGHT_DEFENSIVE_MIDFIELDER: 'RDM',
  CENTER_BACK: 'CB',
  LEFT_WING_BACK: 'LWB',
  LEFT_FULL_BACK: 'LB',
  RIGHT_WING_BACK: 'RWB',
  RIGHT_FULL_BACK: 'RB',
}

export const POSITION_LABEL: Record<Position, string> = {
  GOALKEEPER: 'Goalkeeper',
  STRIKER: 'Striker',
  SHADOW_STRIKER: 'Shadow Striker',
  WINGER: 'Winger',
  CENTRAL_ATTACK_MIDFIELDER: 'CAM',
  RIGHT_ATTACK_MIDFIELDER: 'RAM',
  LEFT_ATTACK_MIDFIELDER: 'LAM',
  CENTRAL_DEFENSIVE_MIDFIELDER: 'CDM',
  LEFT_DEFENSIVE_MIDFIELDER: 'LDM',
  RIGHT_DEFENSIVE_MIDFIELDER: 'RDM',
  CENTER_BACK: 'Center Back',
  LEFT_WING_BACK: 'LWB',
  LEFT_FULL_BACK: 'LB',
  RIGHT_WING_BACK: 'RWB',
  RIGHT_FULL_BACK: 'RB',
}

export type PositionZone = 'GK' | 'DEF' | 'MID' | 'FWD'

export const POSITION_ZONE: Record<Position, PositionZone> = {
  GOALKEEPER: 'GK',
  CENTER_BACK: 'DEF',
  LEFT_WING_BACK: 'DEF',
  LEFT_FULL_BACK: 'DEF',
  RIGHT_WING_BACK: 'DEF',
  RIGHT_FULL_BACK: 'DEF',
  CENTRAL_DEFENSIVE_MIDFIELDER: 'MID',
  LEFT_DEFENSIVE_MIDFIELDER: 'MID',
  RIGHT_DEFENSIVE_MIDFIELDER: 'MID',
  CENTRAL_ATTACK_MIDFIELDER: 'MID',
  RIGHT_ATTACK_MIDFIELDER: 'MID',
  LEFT_ATTACK_MIDFIELDER: 'MID',
  STRIKER: 'FWD',
  SHADOW_STRIKER: 'FWD',
  WINGER: 'FWD',
}

export const LEVEL_LABEL: Record<PlayerLevel, string> = {
  YOUTH: 'Youth',
  ROOKIE: 'Rookie',
  SENIOR: 'Senior',
  VETERAN: 'Veteran',
}

export const STATUS_LABEL: Record<PlayerStatus, string> = {
  ACTIVE: 'Active',
  ON_LOAN: 'On Loan',
  RELEASED: 'Released',
  RETIRED: 'Retired',
}

export interface JerseyNumber {
  id: number
  number: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'RETIRED' | 'RESERVED'
  teamId: number
}

export interface TeamJerseyEntry {
  id: number
  number: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'RETIRED' | 'RESERVED'
  teamId: number
  player?: { id: string; playerName: string; position: string } | null
}

export interface MarketValueEntry {
  id: number
  value: number
  source: 'MANUAL' | 'EXTERNAL_API'
  recordedAt: string
}

export interface MatchStat {
  id: number
  goals: number | null
  assists: number | null
  shots: number | null
  keyPasses: number | null
  xG: number | null
  xA: number | null
  passesAttempted: number | null
  passesCompleted: number | null
  tackles: number | null
  tacklesAttempted: number | null
  tackleSuccessRate: number | null
  clearances: number | null
  interceptions: number | null
  saves: number | null
  cleanSheet: boolean | null
  aerialDuelSuccessRate: number | null
  groundDuels: number | null
  groundDuelsAttempted: number | null
  groundDuelSuccessRate: number | null
  aerialDuels: number | null
  aerialDuelsAttempted: number | null
  ballRecoveries: number | null
  turnovers: number | null
  distanceCovered: number | null
  sprint: number | null
  clearCutChanceRate: number | null
  penaltyConversionRate: number | null
  freeKickConversionRate: number | null
  crossesCompleted: number | null
  shotsAllowed: number | null
  foulsCommitted: number | null
  dribblesAttempted: number | null
  dribblesCompleted: number | null
  dribblesFailed: number | null
  longPassesAttempted: number | null
  longPassesCompleted: number | null
  minutesPlayed: number | null
  match: {
    id: number
    date: string
    seasonId: number
  }
}

export interface TrainingResultEntry {
  id: number
  attendance: string
  feedback: string | null
  performanceScore: number | null
  session: {
    id: number
    date: string
    sessionType: string
    goal: string
  }
}

export interface RadarData {
  scores: Record<string, number>
  strengths: string[]
  weaknesses: string[]
  message?: string
}
