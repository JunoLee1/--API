import { api } from './api'
import type { BudgetPlan, UpsertBudgetPlanPayload, OptimizeResult, AutoGenerateResult } from '@/types/budget'

export interface RevenueBreakdown {
  revenueTicket: number
  revenueSponsorship: number
  revenueBroadcast: number
  revenueMerchandise: number
  revenueSubsidy: number
  revenueParentCompany: number
  revenueAcademyFee: number
  revenueOther: number
}

export interface FinancialReport {
  id: number
  seasonId: number
  totalRevenue: number
  note: string | null
  createdAt: string
  updatedAt: string
  revenueTicket?: number
  revenueSponsorship?: number
  revenueBroadcast?: number
  revenueMerchandise?: number
  revenueSubsidy?: number
  revenueParentCompany?: number
  revenueAcademyFee?: number
  revenueOther?: number
}

export interface PnLRevenueActual {
  ticket: number
  merchandise: number
  other: number
  sponsorship: number
  academyFee: number
  broadcast: number
  subsidy: number
  parentCompany: number
  total: number
}

export interface PnLExpenseActual {
  playerSalary: number
  staffPayroll: number
  operating: number
  operatingByCategory: Record<string, number>
  medical: number
  meals: number
  total: number
}

export interface PnL {
  season: { id: number; name: string; startDate: string; endDate: string }
  plannedRevenue: number | null
  revenue: PnLRevenueActual
  expenses: PnLExpenseActual
  summary: {
    grossProfit: number
    profitMargin: number
    revenueVsPlan: number | null
  }
}

export const financialReportApi = {
  get: (seasonId: number) =>
    api.get<FinancialReport>(`/financial-reports/${seasonId}`),

  set: (seasonId: number, payload: { totalRevenue: number; note?: string }) =>
    api.post<FinancialReport>(`/financial-reports/${seasonId}`, payload),

  uploadCSV: (seasonId: number, file: File, note?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (note) form.append('note', note)
    return api.postForm<FinancialReport>(`/financial-reports/${seasonId}/csv`, form)
  },

  setRevenueBreakdown: (seasonId: number, breakdown: RevenueBreakdown) =>
    api.put<FinancialReport>(`/financial-reports/${seasonId}/revenue`, breakdown),

  setFromPrevSeason: (seasonId: number, prevSeasonId: number) =>
    api.post<FinancialReport>(`/financial-reports/${seasonId}/from-prev-season`, { prevSeasonId }),

  autoFillRevenue: (seasonId: number) =>
    api.post<FinancialReport>(`/financial-reports/${seasonId}/revenue/auto-fill`, {}),

  getPnL: (seasonId: number) =>
    api.get<PnL>(`/financial-reports/${seasonId}/pl`),
}

export const budgetPlanApi = {
  get: (seasonId: number) =>
    api.get<BudgetPlan>(`/financial-reports/${seasonId}/budget`),

  save: (seasonId: number, payload: UpsertBudgetPlanPayload) =>
    api.put<BudgetPlan>(`/financial-reports/${seasonId}/budget`, payload),

  optimize: (seasonId: number) =>
    api.post<OptimizeResult>(`/financial-reports/${seasonId}/budget/optimize`, {}),

  addOverride: (seasonId: number, payload: { category: string; amount: number; reason: string }) =>
    api.post(`/financial-reports/${seasonId}/budget/override`, payload),

  autoGenerate: (seasonId: number, payload: { growthRate: number; contingencyRate?: number }) =>
    api.post<AutoGenerateResult>(`/financial-reports/${seasonId}/budget/auto-generate`, payload),
}
