import { api } from './api'
import type { Team } from '@/types/team'

export const teamAdminApi = {
  setLite: (teamId: number, isLite: boolean) =>
    api.patch<Team>(`/teams/${teamId}/lite`, { isLite }),
}
