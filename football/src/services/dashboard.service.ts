import { api } from './api'
import type { DashboardStats, YouthDevelopmentStats } from '@/types/dashboard'

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
  youthDevelopment: () =>
    api.get<YouthDevelopmentStats>('/dashboard/youth-development'),
}
