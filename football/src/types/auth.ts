export type Role = 'ADMIN' | 'FRONT_OFFICE' | 'COACHING_STAFF' | 'PLAYER' | 'AGENT' | 'GUARDIAN'

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
  | 'FINANCE_MANAGER'
  | 'ASSET_MANAGER'

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  FRONT_OFFICE: 'Front Office',
  COACHING_STAFF: 'Coaching Staff',
  PLAYER: 'Player',
  AGENT: 'Agent',
  GUARDIAN: 'Guardian',
}

export const COACHING_ROLE_LABEL: Record<CoachingRole, string> = {
  HEAD_COACH: 'Head Coach',
  ASSISTANT_COACH: 'Assistant Coach',
  DEFENSIVE_COACH: 'Defensive Coach',
  ATTACKING_COACH: 'Attacking Coach',
  PHYSICAL_COACH: 'Physical Coach',
  SET_PIECE_COACH: 'Set Piece Coach',
  GOALKEEPER_COACH: 'Goalkeeper Coach',
  MEDICAL: 'Medical',
  MEDICAL_DIRECTOR: 'Medical Director',
}

export const FRONT_OFFICE_ROLE_LABEL: Record<FrontOfficeRole, string> = {
  GM: 'GM',
  TD: 'Technical Director',
  CONTRACT_MANAGER: 'Contract Manager',
  SCOUT: 'Scout',
  EQUIPMENT_MANAGER: 'Equipment Manager',
  TACTICAL_ANALYST: 'Tactical Analyst',
  FINANCE_MANAGER: 'Finance Manager',
  ASSET_MANAGER: 'Asset Manager',
}

export interface UserDto {
  id: number
  email: string
  username: string
  nickname: string
  role: Role
  coachingRole: CoachingRole | null
  frontOfficeRole: FrontOfficeRole | null
  teamId: number | null
  isOutOfOffice: boolean
  language: 'ko' | 'en'
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
}
