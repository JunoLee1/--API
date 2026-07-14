import { api } from './api'
import type { TacticalAnalysis, CreateTacticalDto, TacticalPhase } from '@/types/tactical'

export const tacticalApi = {
  list: (params?: { matchId?: number; phase?: TacticalPhase }) => {
    const qs = new URLSearchParams()
    if (params?.matchId) qs.set('matchId', String(params.matchId))
    if (params?.phase) qs.set('phase', params.phase)
    const q = qs.toString()
    return api.get<TacticalAnalysis[]>(`/tactical${q ? `?${q}` : ''}`)
  },

  get: (id: number) => api.get<TacticalAnalysis>(`/tactical/${id}`),

  create: (dto: CreateTacticalDto) =>
    api.post<TacticalAnalysis>('/tactical', dto),

  update: (id: number, dto: Partial<CreateTacticalDto>) =>
    api.patch<TacticalAnalysis>(`/tactical/${id}`, dto),

  confirm: (id: number) =>
    api.patch<TacticalAnalysis>(`/tactical/${id}/confirm`, {}),
}
