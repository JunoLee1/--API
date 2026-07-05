import { api } from './api'
import type {
  TrainingSession,
  TrainingSessionDetail,
  SessionType,
  ContentPhase,
  AttendanceStatus,
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
}
