import { api } from './api'
import type { PlayerCallup, CreateCallupDto } from '@/types/player-callup'

export const callupApi = {
  list: (status?: string) =>
    api.get<PlayerCallup[]>(`/player-callups${status ? `?status=${status}` : ''}`),

  getById: (id: number) =>
    api.get<PlayerCallup>(`/player-callups/${id}`),

  create: (payload: CreateCallupDto) =>
    api.post<PlayerCallup>('/player-callups', payload),

  approve: (id: number) =>
    api.patch<PlayerCallup>(`/player-callups/${id}/approve`, {}),

  reject: (id: number, reason: string) =>
    api.patch<PlayerCallup>(`/player-callups/${id}/reject`, { reason }),

  complete: (id: number) =>
    api.patch<PlayerCallup>(`/player-callups/${id}/complete`, {}),
}
