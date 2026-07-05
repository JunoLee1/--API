import { api } from './api'
import type { ContractSummary, ContractDetail, ContractStatus } from '@/types/contract'

export const contractApi = {
  byPlayer: (playerId: string) =>
    api.get<ContractSummary[]>(`/contracts/player/${playerId}`),

  get: (id: number) =>
    api.get<ContractDetail>(`/contracts/${id}`),

  create: (payload: {
    playerId: string
    startDate: string
    endDate: string
    salary: number
    managedById?: number
  }) => api.post<ContractDetail>('/contracts', payload),

  updateStatus: (id: number, status: ContractStatus) =>
    api.patch<ContractDetail>(`/contracts/${id}/status`, { status }),
}
