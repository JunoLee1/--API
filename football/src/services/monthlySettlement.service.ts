import { api } from './api'
import type { MonthlySettlementSummary, MonthlySettlementDetail } from '@/types/monthly-settlement'

export const settlementApi = {
  list: (seasonId?: number) =>
    api.get<MonthlySettlementSummary[]>(
      `/monthly-settlement${seasonId !== undefined ? `?seasonId=${seasonId}` : ''}`
    ),
  generate: (data: { seasonId: number; year: number; month: number }) =>
    api.post<MonthlySettlementDetail>('/monthly-settlement/generate', data),
  getById: (id: number) =>
    api.get<MonthlySettlementDetail>(`/monthly-settlement/${id}`),
  updateNote: (id: number, note: string) =>
    api.patch<MonthlySettlementDetail>(`/monthly-settlement/${id}/note`, { note }),
  submitFirst: (id: number) =>
    api.post<MonthlySettlementDetail>(`/monthly-settlement/${id}/submit-first`, {}),
  approveFirst: (id: number) =>
    api.post<MonthlySettlementDetail>(`/monthly-settlement/${id}/approve-first`, {}),
  approve: (id: number) =>
    api.post<MonthlySettlementDetail>(`/monthly-settlement/${id}/approve`, {}),
  reject: (id: number, reason: string) =>
    api.post<MonthlySettlementDetail>(`/monthly-settlement/${id}/reject`, { reason }),
  exportUrl: (id: number) => `/api/monthly-settlement/${id}/export`,
}
