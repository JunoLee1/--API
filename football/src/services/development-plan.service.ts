import { api } from './api'
import type {
  DevelopmentPlan,
  CreateDevelopmentPlanPayload,
  UpdateDevelopmentPlanPayload,
} from '@/types/development-plan'

export const developmentPlanApi = {
  list: (params?: { playerId?: string; seasonId?: number }) => {
    const q = new URLSearchParams()
    if (params?.playerId) q.set('playerId', params.playerId)
    if (params?.seasonId) q.set('seasonId', String(params.seasonId))
    const qs = q.toString()
    return api.get<DevelopmentPlan[]>(`/development-plans${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<DevelopmentPlan>(`/development-plans/${id}`),

  create: (payload: CreateDevelopmentPlanPayload) =>
    api.post<DevelopmentPlan>('/development-plans', payload),

  update: (id: number, payload: UpdateDevelopmentPlanPayload) =>
    api.put<DevelopmentPlan>(`/development-plans/${id}`, payload),

  activate: (id: number) =>
    api.patch<DevelopmentPlan>(`/development-plans/${id}/activate`, {}),

  review: (id: number) =>
    api.patch<DevelopmentPlan>(`/development-plans/${id}/review`, {}),
}
