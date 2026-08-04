export type TeamType = 'FIRST_TEAM' | 'B_TEAM' | 'YOUTH'

export interface ClubSummary {
  id: number
  name: string
  isLite: boolean
}

export interface Team {
  id: number
  name: string
  type: TeamType
  ageGroup: string | null
  isActive: boolean
  trackStats: boolean
  requiresContract: boolean
  clubId: number | null
  club: ClubSummary | null
}

export interface Club {
  id: number
  name: string
  isActive: boolean
  isLite: boolean
  createdAt: string
  teams: Array<{ id: number; name: string; type: TeamType; isActive: boolean }>
}

export const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  FIRST_TEAM: 'First Team',
  B_TEAM: 'B Team',
  YOUTH: 'Youth',
}
