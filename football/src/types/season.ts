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
  // Existing fields (backwards-compat).
  wageCapType: WageCapType | null
  wageCapValue: number | null
  totalRevenue: number | null
  cap: number | null
  totalPayroll: number
  percentUsed: number | null
  remaining: number | null
  // New available-budget breakdown. Optional on the client type so older
  // API responses still deserialize cleanly; the current server always emits
  // these fields via findActiveWithKPI.
  revenue?: { planned: number; actual: number }
  carryOverFromPrev?: {
    amount: number
    isAutoCalculated: boolean
    overriddenAt: string | null
    overriddenById: number | null
    overrideReason: string | null
  }
  playerSalary?: { planned: number; actual: number }
  staffSalary?: { planned: number; actual: number }
  availableBudget?: { planned: number; actual: number }
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
