import { api } from './api'
import type {
  Player,
  PlayerDetail,
  PlayerListQuery,
  CreatePlayerPayload,
  UpdatePlayerPayload,
  PlayerStatus,
  JerseyNumber,
  TeamJerseyEntry,
  MarketValueEntry,
  MatchStat,
  TrainingResultEntry,
  RadarData,
  PositionDiversityEntry,
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

  getMatchStats: (id: string, seasonId?: number) =>
    api.get<MatchStat[]>(`/players/${id}/match-stats${seasonId ? `?seasonId=${seasonId}` : ''}`),

  getTrainingResults: (id: string, params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const q = qs.toString()
    return api.get<TrainingResultEntry[]>(`/players/${id}/training-results${q ? `?${q}` : ''}`)
  },

  getRadar: (id: string) =>
    api.get<RadarData>(`/players/${id}/radar`),

  getPositionDiversity: (id: string) =>
    api.get<PositionDiversityEntry[]>(`/players/${id}/position-diversity`),

  getJerseyNumbers: (id: string) =>
    api.get<JerseyNumber[]>(`/players/${id}/jersey-numbers`),

  getTeamJerseys: (teamId: number) =>
    api.get<TeamJerseyEntry[]>(`/players/jersey/teams/${teamId}`),

  assignJersey: (id: string, body: { number: number; teamId: number }) =>
    api.post<JerseyNumber>(`/players/${id}/jersey-numbers/assign`, body),

  releaseJersey: (id: string, body: { teamId: number; number: number }) =>
    api.post<JerseyNumber>(`/players/${id}/jersey-numbers/release`, body),

  getMarketValueHistory: (id: string) =>
    api.get<MarketValueEntry[]>(`/players/${id}/market-value/history`),

  updateMarketValue: (id: string, value: number) =>
    api.patch<{ playerId: string; currentMarketValue: number }>(`/players/${id}/market-value`, { value }),
}
