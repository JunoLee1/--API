import { api } from './api'
import type { SalesRecord, TicketMatchSummary, CreateSalesRecordDto } from '@/types/sales'

export const salesApi = {
  list: () =>
    api.get<SalesRecord[]>('/sales'),

  byMatch: (matchId: number) =>
    api.get<SalesRecord[]>(`/sales/by-match/${matchId}`),

  create: (dto: CreateSalesRecordDto) =>
    api.post<SalesRecord>('/sales', dto),

  delete: (id: number) =>
    api.delete<void>(`/sales/${id}`),

  ticketSummary: (seasonId: number) =>
    api.get<TicketMatchSummary[]>(`/sales/ticket-summary?seasonId=${seasonId}`),

  seasonTicketTotal: (seasonId: number) =>
    api.get<{ total: number }>(`/sales/ticket-season-total?seasonId=${seasonId}`),
}
