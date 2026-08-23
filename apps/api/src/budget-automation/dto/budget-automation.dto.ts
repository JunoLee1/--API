export type GoalWeight = "AGGRESSIVE" | "MAINTAIN" | "CONSERVATIVE";

export const GOAL_MULTIPLIER: Record<GoalWeight, number> = {
  AGGRESSIVE: 1.2,
  MAINTAIN: 1.0,
  CONSERVATIVE: 0.8,
};

export const REVENUE_KEYS = [
  "plannedRevenueTicket",
  "plannedRevenueSponsorship",
  "plannedRevenueBroadcast",
  "plannedRevenueMerchandise",
  "plannedRevenueSubsidy",
  "plannedRevenueParentCompany",
  "plannedRevenueAcademyFee",
  "plannedRevenueOther",
] as const;

export type RevenueKey = (typeof REVENUE_KEYS)[number];

export interface BudgetPreviewRequestDto {
  targetSeasonId: number;
  lookback?: number;       // default 3
  inflation?: number;      // default 0.03
  revenueGoal: GoalWeight;
  expenseGoal: GoalWeight;
  // key = ExpenseCategory code string
  categoryOverrides?: Record<string, GoalWeight>;
}

export interface BudgetApplyRequestDto extends BudgetPreviewRequestDto {
  name: string;
  note?: string;
}

export type WarningCode = "INSUFFICIENT_DATA" | "LOW_UTILIZATION" | "HIGH_VOLATILITY";

export interface CategoryPrediction {
  predicted: number;
  cagr: number;
  dataPoints: number;
  warning?: WarningCode;
}

export interface BudgetPreviewResponse {
  revenue: {
    total: number;
    byCategory: Record<RevenueKey, CategoryPrediction>;
  };
  expense: {
    total: number;
    byCategory: Record<string, CategoryPrediction>;
  };
  parameters: {
    targetSeasonId: number;
    lookback: number;
    inflation: number;
    revenueGoal: GoalWeight;
    expenseGoal: GoalWeight;
    categoryOverrides: Record<string, GoalWeight>;
    seasonsUsed: number;
  };
}
