export type ExpenseCostCategory = 'OUTPATIENT' | 'EXAMINATION' | 'SURGERY' | 'REHABILITATION' | 'MEDICATION'
export type ExpensePayerType = 'CLUB' | 'ASSOCIATION' | 'INDIVIDUAL'
export type MedicalExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'LEADER_APPROVED' | 'APPROVED' | 'REJECTED'

export interface ExpenseUser {
  id: number
  nickname: string
  role: string
  coachingRole: string | null
}

export interface ExpenseInjury {
  id: number
  bodyPart: string
  playerId: string
}

export interface MedicalExpense {
  id: number
  status: MedicalExpenseStatus
  injuryId: number | null
  injury: ExpenseInjury | null
  receiptDate: string
  costCategory: ExpenseCostCategory
  totalAmount: number
  payerType: ExpensePayerType
  description: string | null
  fileUrl: string | null
  fileName: string | null
  rejectionReason: string | null
  submittedById: number
  submittedBy: ExpenseUser
  leaderReviewerId: number | null
  leaderReviewer: ExpenseUser | null
  adminReviewerId: number | null
  adminReviewer: ExpenseUser | null
  submittedAt: string | null
  leaderReviewedAt: string | null
  adminReviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateExpenseDto {
  receiptDate: string
  costCategory: ExpenseCostCategory
  totalAmount: number
  payerType: ExpensePayerType
  injuryId?: number
  description?: string
  file?: File
}

export interface UpdateExpenseDto {
  receiptDate?: string
  costCategory?: ExpenseCostCategory
  totalAmount?: number
  payerType?: ExpensePayerType
  injuryId?: number | null
  description?: string
  file?: File
}

export const COST_CATEGORY_LABEL: Record<ExpenseCostCategory, string> = {
  OUTPATIENT: '외래',
  EXAMINATION: '검사',
  SURGERY: '수술',
  REHABILITATION: '재활',
  MEDICATION: '약제',
}

export const PAYER_TYPE_LABEL: Record<ExpensePayerType, string> = {
  CLUB: '구단',
  ASSOCIATION: '협회',
  INDIVIDUAL: '개인',
}

export const EXPENSE_STATUS_LABEL: Record<MedicalExpenseStatus, string> = {
  DRAFT: '초안',
  SUBMITTED: '상신됨',
  LEADER_APPROVED: '1차승인',
  APPROVED: '최종승인',
  REJECTED: '반려',
}

export const EXPENSE_STATUS_STYLE: Record<MedicalExpenseStatus, string> = {
  DRAFT: 'border-border text-muted-foreground',
  SUBMITTED: 'border-blue-300 text-blue-700 bg-blue-50',
  LEADER_APPROVED: 'border-indigo-300 text-indigo-700 bg-indigo-50',
  APPROVED: 'border-green-300 text-green-700 bg-green-50',
  REJECTED: 'border-red-300 text-red-700 bg-red-50',
}
