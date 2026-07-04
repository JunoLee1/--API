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
}

export interface UserDto {
  id: number
  email: string
  username: string
  nickname: string
  role: Role
  coachingRole: CoachingRole | null
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
