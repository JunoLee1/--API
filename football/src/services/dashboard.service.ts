import { api } from './api'
import type { DashboardStats, YouthDevelopmentStats } from '@/types/dashboard'
import type { AcademyFinanceStats } from '@/types/academy-fee'

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
  youthDevelopment: () =>
    api.get<YouthDevelopmentStats>('/dashboard/youth-development'),
  academyFinance: () =>
    api.get<AcademyFinanceStats>('/dashboard/academy-finance'),
}
