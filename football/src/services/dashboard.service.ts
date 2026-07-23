import { api } from './api'
import type { DashboardStats, YouthDevelopmentStats } from '@/types/dashboard'
import type { AcademyFinanceStats } from '@/types/academy-fee'

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
  youthDevelopment: () =>
    api.get<YouthDevelopmentStats>('/dashboard/youth-development'),
  academyFinance: (year?: number, month?: number) => {
    const qs = new URLSearchParams()
    if (year) qs.set('year', String(year))
    if (month) qs.set('month', String(month))
    const q = qs.toString()
    return api.get<AcademyFinanceStats>(`/dashboard/academy-finance${q ? `?${q}` : ''}`)
  },
}
