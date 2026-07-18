import { api } from './api'
import type { Team, TeamType } from '@/types/team'

export interface CreateTeamPayload {
  name: string
  type: TeamType
  ageGroup?: string
  trackStats?: boolean
  requiresContract?: boolean
}

export const teamApi = {
  list: () => api.get<Team[]>('/teams'),
  create: (payload: CreateTeamPayload) => api.post<Team>('/teams', payload),
  update: (id: number, payload: Partial<CreateTeamPayload & { isActive: boolean }>) =>
    api.patch<Team>(`/teams/${id}`, payload),
  deactivate: (id: number) => api.patch<Team>(`/teams/${id}/deactivate`, {}),
}
