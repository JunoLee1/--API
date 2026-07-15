import { api } from './api'
import type { Injury, InjuryDetail, InjuryStatus, InjuryCause, HospitalType, InjuryReport, RehabStage, RiskLevel, SecurityLevel } from '@/types/injury'

export const injuryApi = {
  byPlayer: (playerId: string) =>
    api.get<Injury[]>(`/injuries/player/${playerId}`),

  get: (id: number) =>
    api.get<InjuryDetail>(`/injuries/${id}`),

  create: (payload: {
    playerId: string
    bodyPart: string
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
}
