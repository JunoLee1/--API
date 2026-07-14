import { api } from './api'
import type { Hospital } from '@/types/hospital'

export const hospitalApi = {
  list: () => api.get<Hospital[]>('/hospitals'),

  create: (payload: { name: string; address?: string; phone?: string }) =>
    api.post<Hospital>('/hospitals', payload),
}
