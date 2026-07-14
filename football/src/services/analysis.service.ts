import { api } from './api'

export interface TeamRanking {
  rank: number
  teamName: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
}

export const analysisApi = {
  getRankings: (params?: { seasonId?: number; competitionType?: string }) => {
    const qs = new URLSearchParams()
    if (params?.seasonId) qs.set('seasonId', String(params.seasonId))
    if (params?.competitionType) qs.set('competitionType', params.competitionType)
    const q = qs.toString()
    return api.get<TeamRanking[]>(`/analysis/rankings${q ? `?${q}` : ''}`)
  },
}
