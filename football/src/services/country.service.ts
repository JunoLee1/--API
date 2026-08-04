import { api } from './api'
import type { CountryItem } from '@/types/country'

export const countryApi = {
  list: async () => {
    const res = await api.get<{ message: string; data: CountryItem[] }>('/countries')
    return res.data ?? []
  },
}
