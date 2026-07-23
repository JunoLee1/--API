import { api } from './api'
import type { AcademyFee, AcademyFinanceStats } from '@/types/academy-fee'

export const academyFeeApi = {
  getAll: (params?: { status?: string; teamId?: number; year?: number; month?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.teamId) qs.set('teamId', String(params.teamId))
    if (params?.year) qs.set('year', String(params.year))
    if (params?.month) qs.set('month', String(params.month))
    const q = qs.toString()
    return api.get<AcademyFee[]>(`/academy-fees${q ? `?${q}` : ''}`)
  },
  getByPlayer: (playerId: string) =>
    api.get<AcademyFee[]>(`/academy-fees/player/${playerId}`),
  submitProof: (id: number, paymentProofUrl: string) =>
    api.patch<AcademyFee>(`/academy-fees/${id}/submit-proof`, { paymentProofUrl }),
  approve: (id: number) =>
    api.patch<AcademyFee>(`/academy-fees/${id}/approve`, {}),
  issue: (year: number, month: number, amount: number) =>
    api.post<{ success: boolean }>('/academy-fees/issue', { year, month, amount }),
  getStats: (year?: number, month?: number) => {
    const qs = new URLSearchParams()
    if (year) qs.set('year', String(year))
    if (month) qs.set('month', String(month))
    const q = qs.toString()
    return api.get<AcademyFinanceStats>(`/academy-fees/stats${q ? `?${q}` : ''}`)
  },
}
