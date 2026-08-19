import { api } from './api'

export interface ClubSettings {
  id: number
  currency: string
  ibiBeta: number
  planApprovalLimit: number
  maintenanceCostLimit: number
  complimentaryTicketLimit: number
}

export interface UpdateClubSettingsPayload {
  currency?: string
  ibiBeta?: number
  maintenanceCostLimit?: number
}

export const clubSettingsApi = {
  get: () => api.get<ClubSettings>('/club-settings'),
  update: (payload: UpdateClubSettingsPayload) => api.patch<ClubSettings>('/club-settings', payload),
}
