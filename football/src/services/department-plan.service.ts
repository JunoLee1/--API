import { api } from './api'
import type { DepartmentAnnualPlan } from '@/types/department-plan'

export type BudgetSummaryItem = {
  departmentId: number
  departmentName: string
  category: string
  total: number
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `?${qs}` : ''
}

export const departmentPlanApi = {
  list: (params?: { seasonId?: number; departmentId?: number; status?: string }) =>
    api.get<DepartmentAnnualPlan[]>(`/department-plans${buildQuery({ ...params })}`),

  get: (id: number) =>
    api.get<DepartmentAnnualPlan>(`/department-plans/${id}`),

  create: (data: {
    seasonId: number
    departmentId: number
    objectives?: string[]
    milestones?: { quarter: number; text: string }[]
    budgetItems?: { category: string; amount: number }[]
    kpiItems?: { title: string; targetValue: string; quarter?: number | null }[]
  }) => api.post<DepartmentAnnualPlan>('/department-plans', data),

  update: (id: number, data: {
    objectives?: string[]
    milestones?: { quarter: number; text: string }[]
    budgetItems?: { category: string; amount: number }[]
    kpiItems?: { title: string; targetValue: string; quarter?: number | null }[]
  }) => api.put<DepartmentAnnualPlan>(`/department-plans/${id}`, data),

  submit: (id: number) =>
    api.post<DepartmentAnnualPlan>(`/department-plans/${id}/submit`),

  approve: (id: number) =>
    api.post<DepartmentAnnualPlan>(`/department-plans/${id}/approve`),

  reject: (id: number, reason: string) =>
    api.post<DepartmentAnnualPlan>(`/department-plans/${id}/reject`, { reason }),

  budgetSummary: (seasonId: number) =>
    api.get<BudgetSummaryItem[]>(`/department-plans/budget-summary?seasonId=${seasonId}`),
}
