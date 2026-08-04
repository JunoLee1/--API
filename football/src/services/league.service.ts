import { api } from './api'
import type { League, CreateLeagueDto, UpdateLeagueDto } from '@/types/league'

export const leagueApi = {
  list: () => api.get<League[]>('/leagues'),
  get: (id: number) => api.get<League>(`/leagues/${id}`),
  create: (dto: CreateLeagueDto) => api.post<League>('/leagues', dto),
  update: (id: number, dto: UpdateLeagueDto) => api.patch<League>(`/leagues/${id}`, dto),
  registerClub: (leagueId: number, clubId: number) =>
    api.post<League>(`/leagues/${leagueId}/clubs`, { clubId }),
  removeClub: (leagueId: number, clubId: number) =>
    api.delete<League>(`/leagues/${leagueId}/clubs/${clubId}`),
}
