import { api } from './api'
import type { Prospect, CreateProspectDto, UpdateProspectDto, ProspectStatus } from '@/types/prospect'

export const prospectApi = {
  list: (status?: ProspectStatus) =>
    api.get<Prospect[]>(`/prospects${status ? `?status=${status}` : ''}`),

  get: (id: number) => api.get<Prospect>(`/prospects/${id}`),

  create: (dto: CreateProspectDto) => api.post<Prospect>('/prospects', dto),

  update: (id: number, dto: UpdateProspectDto) =>
    api.patch<Prospect>(`/prospects/${id}`, dto),
}
