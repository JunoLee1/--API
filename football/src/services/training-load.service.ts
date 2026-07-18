import { api } from './api'
import type { TrainingLoad, WeeklySummary, UpsertTrainingLoadPayload } from '@/types/training-load'

export const trainingLoadApi = {
  list: (params?: { sessionId?: number; playerId?: string }) => {
    const q = new URLSearchParams()
    if (params?.sessionId) q.set('sessionId', String(params.sessionId))
    if (params?.playerId) q.set('playerId', params.playerId)
    const qs = q.toString()
    return api.get<TrainingLoad[]>(`/training-loads${qs ? `?${qs}` : ''}`)
  },
  upsert: (payload: UpsertTrainingLoadPayload) =>
    api.post<TrainingLoad>('/training-loads', payload),
  weeklySummary: (playerId: string, weekStart: string) =>
    api.get<WeeklySummary>(`/training-loads/weekly-summary?playerId=${playerId}&weekStart=${weekStart}`),
}
