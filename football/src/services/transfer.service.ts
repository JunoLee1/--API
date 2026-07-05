import { api } from './api'
import type { Transfer, Recall, RecallStatus, TransferType } from '@/types/transfer'

export const transferApi = {
  byPlayer: (playerId: string) =>
    api.get<Transfer[]>(`/transfers/player/${playerId}`),

  get: (id: number) =>
    api.get<Transfer>(`/transfers/${id}`),

  create: (payload: {
    playerId: string
    type: TransferType
    date: string
    startDate?: string
    endDate?: string
    fee?: number
    fromClub?: string
    toClub?: string
  }) => api.post<Transfer>('/transfers', payload),

  recalls: (status?: RecallStatus) =>
    api.get<Recall[]>(`/transfers/recalls${status ? `?status=${status}` : ''}`),

  createRecall: (transferId: number) =>
    api.post<Recall>('/transfers/recalls', { transferId }),

  updateRecallStatus: (id: number, status: 'APPROVED' | 'REJECTED') =>
    api.patch<Recall>(`/transfers/recalls/${id}/status`, { status }),
}
