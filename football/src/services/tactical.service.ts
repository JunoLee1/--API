import { api } from './api'
import type { TacticalAnalysis, CreateTacticalDto, TacticalPhase } from '@/types/tactical'

export const tacticalApi = {
  list: (params?: { matchId?: number; phase?: TacticalPhase }) => {
    const qs = new URLSearchParams()
    if (params?.matchId) qs.set('matchId', String(params.matchId))
    if (params?.phase) qs.set('phase', params.phase)
    const q = qs.toString()
    return api.get<TacticalAnalysis[]>(`/tactical-analyses${q ? `?${q}` : ''}`)
  },

  get: (id: number) => api.get<TacticalAnalysis>(`/tactical-analyses/${id}`),

  create: (dto: CreateTacticalDto) =>
    api.post<TacticalAnalysis>('/tactical-analyses', dto),

  update: (id: number, dto: Partial<CreateTacticalDto>) =>
    api.patch<TacticalAnalysis>(`/tactical-analyses/${id}`, dto),

  confirm: (id: number) =>
    api.patch<TacticalAnalysis>(`/tactical-analyses/${id}/confirm`, {}),
}
