export type SettlementStatus = 'DRAFT' | 'PENDING_FIRST' | 'FIRST_APPROVED' | 'APPROVED' | 'REJECTED'

export interface MonthlySettlementSummary {
  id: number
  seasonId: number
  year: number
  month: number
  status: SettlementStatus
  totalRevenue: number
  totalExpense: number
  netIncome: number
  createdBy: { id: number; username: string }
  season: { id: number; name: string }
  createdAt: string
}

export interface MonthlySettlementDetail extends MonthlySettlementSummary {
  snapshotJson: {
    revenue?: Record<string, number>
    expenses?: Record<string, number>
    budgetComparison?: Record<string, { budget: number; actual: number; variance: number }>
    pnl?: { totalRevenue: number; totalExpense: number; netIncome: number }
  }
  note: string | null
  rejectionReason: string | null
  firstSubmittedBy: { id: number; username: string } | null
  firstApprover: { id: number; username: string } | null
  approver: { id: number; username: string } | null
}
