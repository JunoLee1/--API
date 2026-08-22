export type GoalWeight = 'AGGRESSIVE' | 'MAINTAIN' | 'CONSERVATIVE'
export type OperatingCategory = 'MEDICAL' | 'MEAL' | 'TRAVEL' | 'EQUIPMENT' | 'SCOUTING' | 'YOUTH'
export type RevenueKey =
  | 'plannedRevenueTicket'
  | 'plannedRevenueSponsorship'
  | 'plannedRevenueBroadcast'
  | 'plannedRevenueMerchandise'
  | 'plannedRevenueSubsidy'
  | 'plannedRevenueParentCompany'
  | 'plannedRevenueAcademyFee'
  | 'plannedRevenueOther'

export interface CategoryPrediction {
  predicted: number
  cagr: number
  dataPoints: number
  warning?: 'INSUFFICIENT_DATA' | 'LOW_UTILIZATION' | 'HIGH_VOLATILITY'
}

export interface BudgetPreviewResponse {
  revenue: {
    total: number
    byCategory: Record<RevenueKey, CategoryPrediction>
  }
  expense: {
    total: number
    byCategory: Record<OperatingCategory, CategoryPrediction>
  }
  parameters: {
    targetSeasonId: number
    lookback: number
    inflation: number
    revenueGoal: GoalWeight
    expenseGoal: GoalWeight
    categoryOverrides: Partial<Record<OperatingCategory, GoalWeight>>
    seasonsUsed: number
  }
}

export interface BudgetPreviewRequest {
  targetSeasonId: number
  lookback?: number
  inflation?: number
  revenueGoal: GoalWeight
  expenseGoal: GoalWeight
  categoryOverrides?: Partial<Record<OperatingCategory, GoalWeight>>
}

export interface BudgetApplyRequest extends BudgetPreviewRequest {
  name: string
  note?: string
}
