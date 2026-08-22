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

export interface DonutData {
  season: Record<string, number>
  monthly: Record<string, number>
}

export interface TrendEntry {
  year: number
  month: number
  totalRevenue: number
  totalExpense: number
  netIncome: number
}

export interface GaugeData {
  revenueAchievement: { actual: number; target: number }
  budgetConsumption: { spent: number; approved: number }
  monthlyContribution: { monthly: number; annualTarget: number }
}

export interface FinanceDashboard {
  donut: DonutData
  trend: TrendEntry[]
  gauges: GaugeData
}

export const dashboardApi = {
  stats: (teamType?: 'FIRST_TEAM' | 'YOUTH') =>
    api.get<DashboardStats>(`/dashboard/stats${teamType ? `?teamType=${teamType}` : ''}`),
  youthDevelopment: () =>
    api.get<YouthDevelopmentStats>('/dashboard/youth-development'),
  academyFinance: (year?: number, month?: number) =>
    api.get<AcademyFinanceStats>(`/dashboard/academy-finance${year && month ? `?year=${year}&month=${month}` : ''}`),
  getCoachDashboard: () => api.get<CoachDashboard>('/dashboard/coach'),
  getFinance: (params: { seasonId?: number; year?: number; month?: number }) => {
    const parts: string[] = []
    if (params.seasonId !== undefined) parts.push(`seasonId=${params.seasonId}`)
    if (params.year !== undefined) parts.push(`year=${params.year}`)
    if (params.month !== undefined) parts.push(`month=${params.month}`)
    const qs = parts.length ? `?${parts.join('&')}` : ''
    return api.get<FinanceDashboard>(`/dashboard/finance${qs}`)
  },
}
