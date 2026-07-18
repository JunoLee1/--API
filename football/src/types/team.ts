export type TeamType = 'FIRST_TEAM' | 'YOUTH'

export interface Team {
  id: number
  name: string
  type: TeamType
  ageGroup: string | null
  isActive: boolean
  trackStats: boolean
  requiresContract: boolean
}

export const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  FIRST_TEAM: '1군',
  YOUTH: '유소년',
}
