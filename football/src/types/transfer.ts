export type TransferType = 'PERMANENT' | 'LOAN_OUT' | 'LOAN_IN' | 'FREE' | 'RELEASE'
export type RecallStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface TransferRecall {
  id: number
  status: RecallStatus
}

export interface Transfer {
  id: number
  type: TransferType
  date: string
  startDate: string | null
  endDate: string | null
  fee: number | null
  fromClub: string | null
  toClub: string | null
  recall: TransferRecall | null
}

export interface Recall {
  id: number
  status: RecallStatus
  transferId: number
}

export const TRANSFER_TYPE_LABEL: Record<TransferType, string> = {
  PERMANENT: 'Permanent',
  LOAN_OUT: 'Loan Out',
  LOAN_IN: 'Loan In',
  FREE: 'Free Transfer',
  RELEASE: 'Release',
}

export const TRANSFER_TYPE_STYLE: Record<TransferType, string> = {
  PERMANENT: 'bg-blue-100 text-blue-800 border-blue-200',
  LOAN_OUT: 'bg-purple-100 text-purple-800 border-purple-200',
  LOAN_IN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  FREE: 'bg-amber-100 text-amber-800 border-amber-200',
  RELEASE: 'bg-gray-100 text-gray-600 border-gray-200',
}

export const RECALL_STATUS_LABEL: Record<RecallStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const RECALL_STATUS_STYLE: Record<RecallStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
}
