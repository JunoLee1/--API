import { api } from './api'
import type { AccountCode } from '@/types/account-code'

export const accountCodeApi = {
  list: () => api.get<AccountCode[]>('/account-codes'),
  create: (data: { code: string; name: string; type: 'REVENUE' | 'EXPENSE' }) =>
    api.post<AccountCode>('/account-codes', data),
  update: (id: number, data: { name?: string; type?: 'REVENUE' | 'EXPENSE' }) =>
    api.put<AccountCode>(`/account-codes/${id}`, data),
  delete: (id: number) => api.delete<void>(`/account-codes/${id}`),
}
