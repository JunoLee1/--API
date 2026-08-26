export type SurveyPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface CreateHiringSurveyDto {
  title: string
  deadlineAt: string
  targetDeptIds: number[]
}

export interface CreateSurveyResponseDto {
  roleTitle: string
  headcount: number
  quarter?: number
  priority: SurveyPriority
  estimatedBudget?: number
  reason: string
}

export interface CreateHiringPlanItemDto {
  roleTitle: string
  headcount: number
  quarter?: number
  priority: SurveyPriority
  estimatedBudget?: number
}

export interface UpdateHiringPlanItemDto {
  roleTitle?: string
  headcount?: number
  quarter?: number | null
  priority?: SurveyPriority
  estimatedBudget?: number | null
}

export interface UpdateHiringSurveyDraftDto {
  title?: string
  deadlineAt?: string
  targetDeptIds?: number[]
}
