export type FeeStatus = 'PENDING' | 'SUBMITTED' | 'PAID' | 'OVERDUE' | 'LOCKED'

export interface AcademyFee {
  id: number
  playerId: string
  player: { id: string; playerName: string; teamId: number | null; status: string }
  guardianId: number
  guardian: { id: number; username: string }
  amount: number
  dueDate: string
  status: FeeStatus
  paidAt: string | null
  paymentProofUrl: string | null
  paymentSubmittedAt: string | null
  year: number
  month: number
  createdAt: string
}

export interface AcademyFinanceStats {
  monthlyCollectionRate: number
  totalRevenue: number
  overdueCount: number
  lockedPlayerCount: number
}
