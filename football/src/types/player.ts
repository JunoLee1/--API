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
  GOALKEEPER: '골키퍼',
  STRIKER: '공격수',
  SHADOW_STRIKER: '쉐도우 스트라이커',
  WINGER: '윙어',
  CENTRAL_ATTACK_MIDFIELDER: '중앙 공격형 MF',
  RIGHT_ATTACK_MIDFIELDER: '우측 공격형 MF',
  LEFT_ATTACK_MIDFIELDER: '좌측 공격형 MF',
  CENTRAL_DEFENSIVE_MIDFIELDER: '중앙 수비형 MF',
  LEFT_DEFENSIVE_MIDFIELDER: '좌측 수비형 MF',
  RIGHT_DEFENSIVE_MIDFIELDER: '우측 수비형 MF',
  CENTER_BACK: '센터백',
  LEFT_WING_BACK: '좌측 윙백',
  LEFT_FULL_BACK: '좌측 풀백',
  RIGHT_WING_BACK: '우측 윙백',
  RIGHT_FULL_BACK: '우측 풀백',
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
  YOUTH: '유스',
  ROOKIE: '루키',
  SENIOR: '시니어',
  VETERAN: '베테랑',
}

export const STATUS_LABEL: Record<PlayerStatus, string> = {
  ACTIVE: '활성',
  ON_LOAN: '임대 중',
  RELEASED: '방출',
  RETIRED: '은퇴',
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
  xG: number | null
  xA: number | null
  passesAttempted: number | null
  passesCompleted: number | null
  tackleSuccessRate: number | null
  clearances: number | null
  interceptions: number | null
  saves: number | null
  aerialDuelSuccessRate: number | null
  sprint: number | null
  clearCutChanceRate: number | null
  penaltyConversionRate: number | null
  freeKickConversionRate: number | null
  crossesCompleted: number | null
  shotsAllowed: number | null
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
