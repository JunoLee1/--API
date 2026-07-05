export type SeasonStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED'

export interface Season {
  id: number
  name: string
  startDate: string
  endDate: string
  status: SeasonStatus
}
