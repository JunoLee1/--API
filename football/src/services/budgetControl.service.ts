import { api } from './api'
import type { BudgetHeader, BudgetHeaderSummary, BudgetLine, BudgetAdjustment, AvailableBudget } from '@/types/budget-control'

export const budgetControlApi = {
  getAll: (seasonId?: number) => {
    const q = seasonId ? `?seasonId=${seasonId}` : ''
    return api.get<BudgetHeaderSummary[]>(`/budget-control${q}`)
  },
  getById: (id: number) =>
    api.get<BudgetHeader>(`/budget-control/${id}`),
  create: (data: { seasonId: number; name: string; totalBudget: number; note?: string }) =>
    api.post<BudgetHeader>('/budget-control', data),
  update: (id: number, data: { name?: string; totalBudget?: number; note?: string }) =>
    api.patch<BudgetHeader>(`/budget-control/${id}`, data),
  submit: (id: number) =>
    api.post<BudgetHeader>(`/budget-control/${id}/submit`, {}),
  approve: (id: number) =>
    api.post<BudgetHeader>(`/budget-control/${id}/approve`, {}),
  getAvailable: (id: number) =>
    api.get<AvailableBudget>(`/budget-control/${id}/available`),
  addLine: (id: number, data: { category: string; year: number; month?: number; originalAmount: number; departmentId?: number; note?: string }) =>
    api.post<BudgetLine>(`/budget-control/${id}/lines`, data),
  updateLine: (id: number, lineId: number, data: { originalAmount?: number; note?: string }) =>
    api.patch<BudgetLine>(`/budget-control/${id}/lines/${lineId}`, data),
  deleteLine: (id: number, lineId: number) =>
    api.delete(`/budget-control/${id}/lines/${lineId}`),
  requestAdjustment: (id: number, data: { type: string; amount: number; reason: string; fromLineId?: number; toLineId?: number }) =>
    api.post<BudgetAdjustment>(`/budget-control/${id}/adjustments`, data),
  approveAdjustment: (id: number, adjId: number) =>
    api.post<BudgetAdjustment>(`/budget-control/${id}/adjustments/${adjId}/approve`, {}),
  rejectAdjustment: (id: number, adjId: number) =>
    api.post<BudgetAdjustment>(`/budget-control/${id}/adjustments/${adjId}/reject`, {}),
}
