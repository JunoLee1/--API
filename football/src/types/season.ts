export type SeasonStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED'
export type WageCapType = 'FIXED' | 'RATIO'

export interface Season {
  id: number
  name: string
  startDate: string
  endDate: string
  status: SeasonStatus
  wageCapType: WageCapType | null
  wageCapValue: number | null
}

export interface WageCapKPI {
  wageCapType: WageCapType | null
  wageCapValue: number | null
  totalRevenue: number | null
  cap: number | null
  totalPayroll: number
  percentUsed: number | null
  remaining: number | null
}

export const SEASON_STATUS_LABEL: Record<SeasonStatus, string> = {
  UPCOMING: 'Upcoming',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
}

export const SEASON_STATUS_STYLE: Record<SeasonStatus, string> = {
  UPCOMING: 'border-yellow-300 text-yellow-700 bg-yellow-50',
  ACTIVE: 'border-green-300 text-green-700 bg-green-50',
  CLOSED: 'border-gray-300 text-gray-600 bg-gray-50',
}
