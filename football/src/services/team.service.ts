import { api } from './api'
import type { Team } from '@/types/team'

export type { Team }

export interface CreateTeamPayload {
  name: string
  type: 'FIRST_TEAM' | 'YOUTH'
  ageGroup?: string
  trackStats: boolean
  requiresContract: boolean
}

export const teamApi = {
  list: () => api.get<Team[]>('/teams'),
  create: (payload: CreateTeamPayload) => api.post<Team>('/teams', payload),
  update: (id: number, payload: CreateTeamPayload) => api.patch<Team>(`/teams/${id}`, payload),
  deactivate: (id: number) => api.delete<void>(`/teams/${id}`),
}
