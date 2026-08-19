import { api } from './api'
import type { RevenueAdjustment, DrilldownResult, RevenueField } from '@/types/revenue-adjustment'

export const revenueAdjustmentApi = {
  list: (params: { financialReportId?: number; monthlyReportId?: number }) => {
    const q = params.financialReportId !== undefined
      ? `financialReportId=${params.financialReportId}`
      : `monthlyReportId=${params.monthlyReportId}`
    return api.get<RevenueAdjustment[]>(`/revenue-adjustment?${q}`)
  },
  drilldown: (params: {
    field: RevenueField
    year: number
    month?: number
    financialReportId?: number
    monthlyReportId?: number
  }) => {
    const parts: string[] = [`field=${params.field}`, `year=${params.year}`]
    if (params.month !== undefined) parts.push(`month=${params.month}`)
    if (params.financialReportId !== undefined) parts.push(`financialReportId=${params.financialReportId}`)
    if (params.monthlyReportId !== undefined) parts.push(`monthlyReportId=${params.monthlyReportId}`)
    return api.get<DrilldownResult>(`/revenue-adjustment/drilldown?${parts.join('&')}`)
  },
  create: (data: {
    field: RevenueField
    delta: number
    memo?: string
    financialReportId?: number
    monthlyReportId?: number
  }) => api.post<RevenueAdjustment>('/revenue-adjustment', data),
}
