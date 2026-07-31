import { api } from './api'

export interface FinancialReport {
  id: number
  seasonId: number
  totalRevenue: number
  note: string | null
  createdAt: string
  updatedAt: string
}

export const financialReportApi = {
  get: (seasonId: number) =>
    api.get<FinancialReport>(`/financial-reports/${seasonId}`),

  set: (seasonId: number, payload: { totalRevenue: number; note?: string }) =>
    api.post<FinancialReport>(`/financial-reports/${seasonId}`, payload),

  uploadCSV: (seasonId: number, file: File, note?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (note) form.append('note', note)
    return api.postForm<FinancialReport>(`/financial-reports/${seasonId}/csv`, form)
  },
}
