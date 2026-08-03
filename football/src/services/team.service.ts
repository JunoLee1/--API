import { api } from './api'

export interface Team {
  id: number
  name: string
  type: 'FIRST_TEAM' | 'YOUTH'
  ageGroup: string | null
  isActive: boolean
  isLite: boolean
}

export const teamApi = {
  list: () => api.get<Team[]>('/teams'),
}
