import { api } from './api'
import type { BudgetPlan, UpsertBudgetPlanPayload, OptimizeResult } from '@/types/budget'

export interface RevenueBreakdown {
  revenueTicket: number
  revenueSponsorship: number
  revenueBroadcast: number
  revenueMerchandise: number
  revenueSubsidy: number
  revenueParentCompany: number
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
  revenueOther?: number
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
    api.put<FinancialReport>(`/financial-report/${seasonId}/revenue`, breakdown),

  setFromPrevSeason: (seasonId: number, prevSeasonId: number) =>
    api.post<FinancialReport>(`/financial-report/${seasonId}/from-prev-season`, { prevSeasonId }),
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
}
