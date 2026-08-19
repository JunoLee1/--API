export type BudgetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LOCKED'
export type AdjustmentType = 'CARRYOVER' | 'INCREASE' | 'DECREASE' | 'TRANSFER'
export type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface BudgetLine {
  id: number
  budgetHeaderId: number
  departmentId: number | null
  department: { id: number; name: string } | null
  category: string
  year: number
  month: number | null
  originalAmount: number
  note: string | null
  createdAt: string
}

export interface BudgetAdjustment {
  id: number
  budgetHeaderId: number
  type: AdjustmentType
  amount: number
  fromLineId: number | null
  toLineId: number | null
  reason: string
  status: AdjustmentStatus
  createdBy: { id: number; username: string }
  approvedBy: { id: number; username: string } | null
  approvedAt: string | null
  createdAt: string
}

export interface BudgetHeader {
  id: number
  seasonId: number
  season: { id: number; name: string }
  version: number
  status: BudgetStatus
  name: string
  totalBudget: number
  note: string | null
  createdBy: { id: number; username: string }
  approvedBy: { id: number; username: string } | null
  approvedAt: string | null
  lines: BudgetLine[]
  adjustments: BudgetAdjustment[]
  createdAt: string
  updatedAt: string
}

export interface BudgetHeaderSummary {
  id: number
  seasonId: number
  season: { id: number; name: string }
  version: number
  status: BudgetStatus
  name: string
  totalBudget: number
  createdBy: { id: number; username: string }
  createdAt: string
}

export interface AvailableBudget {
  headerId: number
  status: BudgetStatus
  approvedBudget: number
  carryover: number
  increase: number
  decrease: number
  commitment: number
  actual: number
  available: number
}
