import { api } from './api'
import type { DashboardStats, YouthDevelopmentStats } from '@/types/dashboard'
import type { AcademyFinanceStats } from '@/types/academy-fee'

export interface CoachDashboard {
  sessionDate: string | null
  isToday: boolean
  absentPlayers: {
    playerId: string
    playerName: string
    position: string | null
    attendance: string
    sessionDate: string
  }[]
  injuredPlayers: {
    playerId: string
    playerName: string
    position: string | null
    bodyPart: string
    cause: string
    status: string
    expectedReturnDate: string | null
    daysUntilReturn: number | null
  }[]
  nextMatch: {
    id: number
    date: string
    homeTeamName: string
    awayTeamName: string
    venue: string | null
    daysUntilMatch: number
  } | null
}

export const dashboardApi = {
  stats: (teamType?: 'FIRST_TEAM' | 'YOUTH') =>
    api.get<DashboardStats>(`/dashboard/stats${teamType ? `?teamType=${teamType}` : ''}`),
  youthDevelopment: () =>
    api.get<YouthDevelopmentStats>('/dashboard/youth-development'),
  academyFinance: () =>
    api.get<AcademyFinanceStats>('/dashboard/academy-finance'),
  getCoachDashboard: () => api.get<CoachDashboard>('/dashboard/coach'),
}
