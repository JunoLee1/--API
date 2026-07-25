import { api } from './api'
import type { SecondaryPosition } from '@/types/secondary-position'
import type { Position } from '@/types/player'

export const secondaryPositionApi = {
  list: (playerId: string) =>
    api.get<SecondaryPosition[]>(`/players/${playerId}/secondary-positions`),

  upsert: (playerId: string, position: Position, fitnessTarget: number) =>
    api.put<SecondaryPosition>(`/players/${playerId}/secondary-positions`, { position, fitnessTarget }),

  delete: (playerId: string, position: Position) =>
    api.delete<void>(`/players/${playerId}/secondary-positions/${position}`),
}
