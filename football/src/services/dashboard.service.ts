import { api } from './api'
import type { DashboardStats } from '@/types/dashboard'

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
}
