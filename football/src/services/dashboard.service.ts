import { api } from './api'
import type { DashboardStats, YouthDevelopmentStats } from '@/types/dashboard'

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
  youthDevelopment: (): Promise<YouthDevelopmentStats> =>
    api.get<YouthDevelopmentStats>('/dashboard/youth-development').then(r => r.data),
}
