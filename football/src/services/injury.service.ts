import { api } from './api'
import type { Injury, InjuryDetail, InjuryStatus, InjuryCause, HospitalType } from '@/types/injury'

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
}
