export type PlanStatus = 'DRAFT' | 'REVIEWING' | 'APPROVED' | 'REJECTED'
export type OperatingCategory = 'MEDICAL' | 'MEAL' | 'TRAVEL' | 'EQUIPMENT' | 'SCOUTING' | 'YOUTH'

export interface DepartmentBudgetItem {
  id: number
  category: OperatingCategory
  amount: number
}

export interface DepartmentKpiItem {
  id: number
  title: string
  targetValue: string
  quarter: number | null
}

export interface DepartmentAnnualPlan {
  id: number
  seasonId: number
  departmentId: number
  status: PlanStatus
  objectives: string[]
  milestones: { quarter: number; text: string }[]
  rejectionReason: string | null
  submittedAt: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  department: { id: number; name: string; headId: number | null }
  createdBy: { id: number; username: string }
  reviewedBy: { id: number; username: string } | null
  budgetItems: DepartmentBudgetItem[]
  kpiItems: DepartmentKpiItem[]
}

export const OPERATING_CATEGORIES: OperatingCategory[] = [
  'MEDICAL',
  'MEAL',
  'TRAVEL',
  'EQUIPMENT',
  'SCOUTING',
  'YOUTH',
]

export const OPERATING_CATEGORY_LABEL: Record<OperatingCategory, string> = {
  MEDICAL: '의료·재활',
  MEAL: '식대',
  TRAVEL: '이동·숙박',
  EQUIPMENT: '장비·유니폼',
  SCOUTING: '스카우팅·영입',
  YOUTH: '유소년 개발',
}

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: '작성 중',
  REVIEWING: '검토 중',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
}

export const PLAN_STATUS_CLASS: Record<PlanStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  REVIEWING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
}
