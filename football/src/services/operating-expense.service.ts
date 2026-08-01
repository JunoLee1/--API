import { api } from './api'
import type { OperatingCategory, OperatingExpense } from '@/types/budget'

export const operatingExpenseApi = {
  list: (seasonId: number) =>
    api.get<OperatingExpense[]>(`/operating-expenses?seasonId=${seasonId}`),

  create: (payload: {
    seasonId: number
    category: OperatingCategory
    amount: number
    date: string
    note?: string
  }) => api.post<OperatingExpense>('/operating-expenses', payload),

  delete: (id: number) =>
    api.delete(`/operating-expenses/${id}`),
}
