export type OperatingCategory = 'MEDICAL' | 'MEAL' | 'TRAVEL' | 'EQUIPMENT' | 'SCOUTING' | 'YOUTH'

export const OPERATING_CATEGORY_LABEL: Record<OperatingCategory, string> = {
  MEDICAL: '의료·재활',
  MEAL: '식대',
  TRAVEL: '이동·숙박',
  EQUIPMENT: '장비·유니폼',
  SCOUTING: '스카우팅·영입',
  YOUTH: '유소년 개발',
}

export const ALL_OPERATING_CATEGORIES: OperatingCategory[] = [
  'MEDICAL', 'MEAL', 'TRAVEL', 'EQUIPMENT', 'SCOUTING', 'YOUTH',
]

export interface BudgetTier {
  id: number
  categoryPlanId: number
  name: string
  cost: number
  value: number
  isSelected: boolean
}

export interface BudgetCategoryPlan {
  id: number
  financialReportId: number
  category: OperatingCategory
  mandatoryMinimum: number
  knapsackAllocated: number | null
  tiers: BudgetTier[]
}

export interface BudgetOverrideLog {
  id: number
  category: OperatingCategory
  amount: number
  reason: string
  createdAt: string
}

export interface BudgetPlan {
  id: number
  seasonId: number
  totalRevenue: number
  totalOperatingBudget: number | null
  contingencyReserve: number | null
  budgetCategoryPlans: BudgetCategoryPlan[]
  overrideLogs: BudgetOverrideLog[]
  actuals: Record<string, number> | null
}

export interface UpsertBudgetPlanPayload {
  totalOperatingBudget: number
  contingencyReserve: number
  categories: {
    category: OperatingCategory
    mandatoryMinimum: number
    tiers: { name: string; cost: number; value: number }[]
  }[]
}

export interface OptimizeResult {
  selectedTiers: { tierId: number; categoryPlanId: number; allocated: number }[]
  totalCost: number
  totalValue: number
  capacity: number
  mandatoryTotal: number
}

export interface OperatingExpense {
  id: number
  seasonId: number
  category: OperatingCategory
  amount: number
  date: string
  note: string | null
  createdAt: string
  createdBy: { id: number; username: string }
}
