export type RevenueField =
  | 'TICKET' | 'SPONSORSHIP' | 'BROADCAST' | 'MERCHANDISE'
  | 'SUBSIDY' | 'PARENT_COMPANY' | 'ACADEMY_FEE' | 'OTHER'

export interface RevenueAdjustment {
  id: number
  financialReportId?: number
  monthlyReportId?: number
  field: RevenueField
  delta: number
  memo?: string
  createdAt: string
  createdBy: { username: string }
  ledgerEntry?: {
    id: number
    type: string
    category: string
    amount: string
    description?: string
  } | null
}

export interface DrilldownLedgerEntry {
  id: number
  type: string
  category: string
  amountKrw: string
  description?: string | null
  createdAt: string
}

export interface DrilldownResult {
  type: 'ledger' | 'adjustments'
  items: DrilldownLedgerEntry[] | RevenueAdjustment[]
  adjustments?: RevenueAdjustment[]
}
