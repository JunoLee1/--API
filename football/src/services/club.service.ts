import { api } from './api'
import type { Club } from '@/types/team'

export interface CreateClubPayload {
  name: string
  countryId: number
  ownerEmail?: string
  businessRegNumber?: string
  companyNumber?: string
  vatNumber?: string
}

export interface UpdateClubPayload {
  name?: string
  isActive?: boolean
  isLite?: boolean
  ownerEmail?: string
  businessRegNumber?: string
  companyNumber?: string
  vatNumber?: string
}

export const clubApi = {
  list: () => api.get<Club[]>('/clubs'),
  getById: (id: number) => api.get<Club>(`/clubs/${id}`),
  create: (payload: CreateClubPayload) => api.post<Club>('/clubs', payload),
  update: (id: number, payload: UpdateClubPayload) => api.patch<Club>(`/clubs/${id}`, payload),
}
