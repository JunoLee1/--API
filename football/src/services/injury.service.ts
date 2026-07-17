import { api } from './api'
import type { Injury, InjuryDetail, InjuryStatus, InjuryCause, HospitalType, InjuryReport, RehabStage, RiskLevel, SecurityLevel, InjuryAssessment, ExternalReport, ExternalReportStatus, BodyPart } from '@/types/injury'

export const injuryApi = {
  byPlayer: (playerId: string) =>
    api.get<Injury[]>(`/injuries/player/${playerId}`),

  get: (id: number) =>
    api.get<InjuryDetail>(`/injuries/${id}`),

  create: (payload: {
    playerId: string
    bodyPart: BodyPart
    cause: InjuryCause
    expectedReturnDate?: string
    hospitalType?: HospitalType
    partnerId?: number
    customHospitalName?: string
  }) => api.post<Injury>('/injuries', payload),

  updateStatus: (id: number, status: InjuryStatus, expectedReturnDate?: string) =>
    api.patch<Injury>(`/injuries/${id}/status`, {
      status,
      ...(expectedReturnDate && { expectedReturnDate }),
    }),

  stats: () =>
    api.get<{
      activeCount: number
      byBodyPart: Record<string, number>
      byCause: Record<string, number>
      avgRecoveryDays: number | null
    }>('/injuries/stats'),

  getReport: (injuryId: number) =>
    api.get<InjuryReport | null>(`/injuries/${injuryId}/report`),

  saveReport: (injuryId: number, payload: {
    diagnosisName?: string
    treatmentContent?: string
    rehabStage?: RehabStage
    trainingReturnDate?: string
    matchAvailable?: boolean
    reinjuryRisk?: RiskLevel
    medicalOpinion?: string
    securityLevel?: SecurityLevel
  }) => api.put<InjuryReport>(`/injuries/${injuryId}/report`, payload),

  signReport: (injuryId: number) =>
    api.post<InjuryReport>(`/injuries/${injuryId}/report/sign`, {}),

  unsignReport: (injuryId: number) =>
    api.delete<InjuryReport>(`/injuries/${injuryId}/report/sign`),

  getAssessment: (injuryId: number) =>
    api.get<InjuryAssessment | null>(`/injuries/${injuryId}/assessment`),

  saveAssessment: (injuryId: number, dto: {
    painLevel: number
    hasSwelling: boolean
    romScore: number
    strengthScore: number
    sprintScore: number
    jumpScore: number
    psychScore: number
    positionRiskScore: number
  }) => api.put<{ assessment: InjuryAssessment; triggeredReports: boolean }>(`/injuries/${injuryId}/assessment`, dto),

  getExternalReports: (injuryId: number) =>
    api.get<ExternalReport[]>(`/injuries/${injuryId}/external-reports`),

  updateExternalReportStatus: (injuryId: number, reportId: number, status: ExternalReportStatus, note?: string) =>
    api.patch<ExternalReport>(`/injuries/${injuryId}/external-reports/${reportId}/status`, {
      status,
      ...(note !== undefined && { note }),
    }),
}
