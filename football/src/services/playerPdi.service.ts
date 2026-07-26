import { api } from './api'

export interface PositionDiversityEntry {
  position: string
  minutes: number
  percentage: number
}

export const playerPdiApi = {
  get: (playerId: string) =>
    api.get<PositionDiversityEntry[]>(`/players/${playerId}/position-diversity`),
}
