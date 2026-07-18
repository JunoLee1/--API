import { api } from './api'
import type {
  TrainingSession,
  TrainingSessionDetail,
  SessionType,
  ContentPhase,
  AttendanceStatus,
  TrainingResultRow,
  TrainingResultFilters,
} from '@/types/training'

export const trainingApi = {
  list: (seasonId?: number) =>
    api.get<TrainingSession[]>(
      `/training${seasonId ? `?seasonId=${seasonId}` : ''}`,
    ),

  get: (id: number) =>
    api.get<TrainingSessionDetail>(`/training/${id}`),

  create: (payload: {
    date: string
    goal: string
    sessionType: SessionType
    seasonId: number
    contents?: { phase: ContentPhase; description: string }[]
  }) => api.post<TrainingSession>('/training', payload),

  approve: (id: number) =>
    api.patch<TrainingSession>(`/training/${id}/approve`, {}),

  addContent: (id: number, phase: ContentPhase, description: string) =>
    api.post<unknown>(`/training/${id}/contents`, { phase, description }),

  addParticipants: (id: number, playerIds: string[]) =>
    api.post<unknown>(`/training/${id}/participants`, { playerIds }),

  upsertResult: (
    id: number,
    payload: {
      playerId: string
      attendance: AttendanceStatus
      feedback?: string
      performanceScore?: number
    },
  ) => api.put<unknown>(`/training/${id}/results`, payload),

  getResults: (filters: TrainingResultFilters) => {
    const params = new URLSearchParams()
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.sessionType) params.set('sessionType', filters.sessionType)
    if (filters.playerId) params.set('playerId', filters.playerId)
    return api.get<TrainingResultRow[]>(`/training/results?${params.toString()}`)
  },
}
