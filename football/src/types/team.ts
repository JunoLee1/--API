export type TeamType = 'FIRST_TEAM' | 'YOUTH'

export interface Team {
  id: number
  name: string
  type: TeamType
  ageGroup: string | null
  isActive: boolean
  isLite: boolean
  trackStats: boolean
  requiresContract: boolean
}

export const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  FIRST_TEAM: 'First Team',
  YOUTH: 'Youth',
}
