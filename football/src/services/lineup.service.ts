import { api } from './api'
import type { MatchLineup, SaveLineupPayload } from '@/types/lineup'

export const lineupApi = {
  get: (matchId: number) =>
    api.get<MatchLineup | null>(`/matches/${matchId}/lineup`),

  save: (matchId: number, payload: SaveLineupPayload) =>
    api.put<MatchLineup>(`/matches/${matchId}/lineup`, payload),

  confirm: (matchId: number) =>
    api.post<{ isConfirmed: boolean; confirmedAt: string }>(`/matches/${matchId}/lineup/confirm`, {}),
}
