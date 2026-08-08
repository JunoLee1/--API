import { api } from './api'
import type { SalesRecord, TicketMatchSummary, CreateSalesRecordDto } from '@/types/sales'
import type { RemainingCapacity } from '@/types/match'

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

  createBatch: (dtos: CreateSalesRecordDto[]) =>
    api.post<SalesRecord[]>('/sales/batch', dtos),

  getRemainingCapacity: (matchId: number) =>
    api.get<RemainingCapacity>(`/matches/${matchId}/remaining-capacity`),
}
