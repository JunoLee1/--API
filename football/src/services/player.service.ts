import { api } from './api'
import type {
  Player,
  PlayerDetail,
  PlayerListQuery,
  CreatePlayerPayload,
  UpdatePlayerPayload,
  PlayerStatus,
} from '@/types/player'

function buildQuery(q: PlayerListQuery): string {
  const params = new URLSearchParams()
  if (q.status) params.set('status', q.status)
  if (q.position) params.set('position', q.position)
  if (q.level) params.set('level', q.level)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const playerApi = {
  list: (query: PlayerListQuery = {}) =>
    api.get<Player[]>(`/players${buildQuery(query)}`),

  get: (id: string) =>
    api.get<PlayerDetail>(`/players/${id}`),

  create: (payload: CreatePlayerPayload) =>
    api.post<Player>('/players', payload),

  update: (id: string, payload: UpdatePlayerPayload) =>
    api.patch<Player>(`/players/${id}`, payload),

  updateStatus: (id: string, status: PlayerStatus) =>
    api.patch<{ id: string; status: PlayerStatus }>(`/players/${id}/status`, { status }),

  delete: (id: string) =>
    api.delete<void>(`/players/${id}`),
}
