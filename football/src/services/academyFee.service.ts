import { api } from './api'
import type { AcademyFee, AcademyFinanceStats, FeeReceipt } from '@/types/academy-fee'

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
  uploadProof: (id: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.postForm<AcademyFee>(`/academy-fees/${id}/upload-proof`, formData)
  },
  tossConfirm: (id: number, paymentKey: string, orderId: string, amount: number) =>
    api.post<AcademyFee>(`/academy-fees/${id}/toss-confirm`, { paymentKey, orderId, amount }),
  getReceipt: (id: number) =>
    api.get<FeeReceipt>(`/academy-fees/${id}/receipt`),
  adminSubmit: (id: number, paymentProofUrl?: string) =>
    api.patch<AcademyFee>(`/academy-fees/${id}/admin-submit`, { paymentProofUrl }),
  staffUploadProof: (id: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.postForm<AcademyFee>(`/academy-fees/${id}/staff-upload-proof`, formData)
  },
}
