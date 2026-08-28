import { api } from './api'
import type {
  CreateSurveyResponseDto,
  HiringNeedsSurvey,
  HiringPlanItem,
  SurveyResponse,
  UpdateHiringSurveyDraftDto,
  UpdateSurveyResponseDto,
} from '@/types/hiring-survey'

export const hiringSurveyApi = {
  list: (): Promise<HiringNeedsSurvey[]> =>
    api.get('/hiring-surveys'),

  get: (id: number): Promise<HiringNeedsSurvey> =>
    api.get(`/hiring-surveys/${id}`),

  create: (data: { title: string; deadlineAt: string; targetDeptIds: number[] }): Promise<HiringNeedsSurvey> =>
    api.post('/hiring-surveys', data),

  updateDraft: (id: number, body: UpdateHiringSurveyDraftDto): Promise<HiringNeedsSurvey> =>
    api.patch(`/hiring-surveys/${id}`, body),

  open: (id: number): Promise<HiringNeedsSurvey> =>
    api.post(`/hiring-surveys/${id}/open`, {}),

  deleteDraft: (id: number): Promise<void> =>
    api.delete(`/hiring-surveys/${id}`),

  /**
   * 팀장 (LEADER role) creates/updates a DRAFT SurveyResponse for their dept.
   * Payload must include departmentId — leader membership is verified server-side.
   */
  respond: (surveyId: number, data: CreateSurveyResponseDto): Promise<SurveyResponse> =>
    api.post(`/hiring-surveys/${surveyId}/respond`, data),

  updateResponse: (
    surveyId: number,
    responseId: number,
    data: UpdateSurveyResponseDto,
  ): Promise<SurveyResponse> =>
    api.patch(`/hiring-surveys/${surveyId}/responses/${responseId}`, data),

  submitResponse: (surveyId: number, responseId: number): Promise<SurveyResponse> =>
    api.post(`/hiring-surveys/${surveyId}/responses/${responseId}/submit`, {}),

  approveResponse: (surveyId: number, responseId: number): Promise<SurveyResponse> =>
    api.post(`/hiring-surveys/${surveyId}/responses/${responseId}/approve`, {}),

  rejectResponse: (
    surveyId: number,
    responseId: number,
    rejectionReason: string,
  ): Promise<SurveyResponse> =>
    api.post(`/hiring-surveys/${surveyId}/responses/${responseId}/reject`, { rejectionReason }),

  close: (surveyId: number): Promise<{ id: number }> =>
    api.post(`/hiring-surveys/${surveyId}/close`, {}),

  listHiringItems: (planReportId: number): Promise<HiringPlanItem[]> =>
    api.get(`/plan-reports/${planReportId}/hiring-items`),

  createHiringItem: (planReportId: number, data: {
    roleTitle: string; headcount: number; quarter?: number; priority: string; estimatedBudget?: number
  }): Promise<HiringPlanItem> =>
    api.post(`/plan-reports/${planReportId}/hiring-items`, data),

  updateHiringItem: (planReportId: number, itemId: number, data: {
    roleTitle?: string; headcount?: number; quarter?: number | null; priority?: string; estimatedBudget?: number | null
  }): Promise<HiringPlanItem> =>
    api.patch(`/plan-reports/${planReportId}/hiring-items/${itemId}`, data),

  deleteHiringItem: (planReportId: number, itemId: number): Promise<void> =>
    api.delete(`/plan-reports/${planReportId}/hiring-items/${itemId}`),
}
