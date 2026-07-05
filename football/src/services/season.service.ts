import { api } from './api'
import type { Season } from '@/types/season'

export const seasonApi = {
  list: () => api.get<Season[]>('/seasons'),
  active: () => api.get<Season | null>('/seasons/active'),
}
