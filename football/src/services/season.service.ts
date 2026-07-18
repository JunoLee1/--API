import { api } from './api'
import type { Season } from '@/types/season'

export const seasonApi = {
  list: (status?: string) =>
    api.get<Season[]>(`/seasons${status ? `?status=${status}` : ''}`),

  active: () => api.get<Season | null>('/seasons/active'),

  create: (payload: { name: string; startDate: string; endDate: string }) =>
    api.post<Season>('/seasons', payload),

  activate: (id: number) => api.patch<Season>(`/seasons/${id}/activate`, {}),

  close: (id: number) => api.patch<Season>(`/seasons/${id}/close`, {}),
}
