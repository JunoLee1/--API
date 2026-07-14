export type Role = 'ADMIN' | 'FRONT_OFFICE' | 'COACHING_STAFF' | 'PLAYER' | 'AGENT'

export type CoachingRole =
  | 'HEAD_COACH'
  | 'ASSISTANT_COACH'
  | 'DEFENSIVE_COACH'
  | 'ATTACKING_COACH'
  | 'PHYSICAL_COACH'
  | 'SET_PIECE_COACH'
  | 'GOALKEEPER_COACH'
  | 'MEDICAL'
  | 'MEDICAL_DIRECTOR'

export type FrontOfficeRole =
  | 'GM'
  | 'TD'
  | 'CONTRACT_MANAGER'
  | 'SCOUT'
  | 'EQUIPMENT_MANAGER'
  | 'TACTICAL_ANALYST'

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: '관리자',
  FRONT_OFFICE: '프런트오피스',
  COACHING_STAFF: '코칭스태프',
  PLAYER: '선수',
  AGENT: '에이전트',
}

export const COACHING_ROLE_LABEL: Record<CoachingRole, string> = {
  HEAD_COACH: '감독',
  ASSISTANT_COACH: '수석코치',
  DEFENSIVE_COACH: '수비코치',
  ATTACKING_COACH: '공격코치',
  PHYSICAL_COACH: '피지컬코치',
  SET_PIECE_COACH: '세트피스코치',
  GOALKEEPER_COACH: '골키퍼코치',
  MEDICAL: '의료진',
  MEDICAL_DIRECTOR: '의료 디렉터',
}

export const FRONT_OFFICE_ROLE_LABEL: Record<FrontOfficeRole, string> = {
  GM: '단장',
  TD: '테크니컬 디렉터',
  CONTRACT_MANAGER: '계약 담당',
  SCOUT: '스카우트',
  EQUIPMENT_MANAGER: '장비 담당',
  TACTICAL_ANALYST: '전술 분석가',
}

export interface UserDto {
  id: number
  email: string
  username: string
  nickname: string
  role: Role
  coachingRole: CoachingRole | null
  frontOfficeRole: FrontOfficeRole | null
  isOutOfOffice: boolean
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
}
