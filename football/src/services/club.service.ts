import { api } from './api'
import type { Club } from '@/types/team'

export interface UpdateClubPayload {
  name?: string
  isActive?: boolean
  isLite?: boolean
}

export const clubApi = {
  list: () => api.get<Club[]>('/clubs'),
  getById: (id: number) => api.get<Club>(`/clubs/${id}`),
  create: (payload: { name: string }) => api.post<Club>('/clubs', payload),
  update: (id: number, payload: UpdateClubPayload) => api.patch<Club>(`/clubs/${id}`, payload),
}
