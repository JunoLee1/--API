export type SurveyStatus = 'OPEN' | 'CLOSED'
export type SurveyPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export const PRIORITY_LABELS: Record<SurveyPriority, string> = {
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
}

export interface SurveyTargetDept {
  surveyId: number
  departmentId: number
  department: { id: number; name: string; headId: number | null }
}

export interface SurveyResponse {
  id: number
  surveyId: number
  departmentId: number
  department: { id: number; name: string }
  submittedBy: { id: number; username: string }
  roleTitle: string
  headcount: number
  quarter: number | null
  priority: SurveyPriority
  estimatedBudget: number | null
  reason: string
  createdAt: string
}

export interface HiringNeedsSurvey {
  id: number
  title: string
  deadlineAt: string
  status: SurveyStatus
  createdBy: { id: number; username: string }
  targetDepartments: SurveyTargetDept[]
  responses: SurveyResponse[]
  createdAt: string
}

export interface HiringPlanItem {
  id: number
  planReportId: number
  surveyResponseId: number | null
  roleTitle: string
  headcount: number
  quarter: number | null
  priority: SurveyPriority
  estimatedBudget: number | null
  createdAt: string
}
