import { api } from './api'

export interface SquadPlanDto {
  id: number
  seasonId: number
  formation: string
  slots: Record<string, string | null>
  updatedAt: string
  updatedBy: { nickname: string | null }
}

export interface SaveSquadPlanPayload {
  seasonId: number
  formation: string
  slots: Record<string, string | null>
}

export const squadPlanApi = {
  get: (seasonId: number) =>
    api.get<SquadPlanDto | null>(`/squad-plan?seasonId=${seasonId}`),

  save: (payload: SaveSquadPlanPayload) =>
    api.put<SquadPlanDto>('/squad-plan', payload),
}
