import { api } from './api'
import type { Match, MatchDetail, CompetitionType } from '@/types/match'

export const matchApi = {
  list: (params?: { seasonId?: number; competitionType?: CompetitionType }) => {
    const qs = new URLSearchParams()
    if (params?.seasonId) qs.set('seasonId', String(params.seasonId))
    if (params?.competitionType) qs.set('competitionType', params.competitionType)
    const q = qs.toString()
    return api.get<Match[]>(`/matches${q ? `?${q}` : ''}`)
  },

  get: (id: number) =>
    api.get<MatchDetail>(`/matches/${id}`),

  create: (payload: {
    date: string
    homeTeamName: string
    awayTeamName: string
    competitionType: CompetitionType
    seasonId: number
    externalId?: string
  }) => api.post<Match>('/matches', payload),

  update: (
    id: number,
    payload: {
      date?: string
      homeTeamName?: string
      awayTeamName?: string
      homeScore?: number
      awayScore?: number
      competitionType?: CompetitionType
    },
  ) => api.patch<Match>(`/matches/${id}`, payload),

  upsertTeamStats: (
    id: number,
    payload: {
      possession: number
      shots: number
      shotsOnTarget: number
      passes: number
      passAccuracy: number
      fouls: number
      yellowCards: number
      redCards: number
      xG: number
      corners: number
      offsides: number
      tackles: number
      interceptions: number
      clearances: number
    },
  ) => api.put(`/matches/${id}/team-stats`, payload),
}
