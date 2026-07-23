import { api } from './api'
import type { YouthRegistration, CreateYouthRegistrationPayload } from '@/types/youth-registration'

export const youthRegistrationApi = {
  getAll: (params?: { teamId?: number; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.teamId) qs.set('teamId', String(params.teamId))
    if (params?.status) qs.set('status', params.status)
    const q = qs.toString()
    return api.get<YouthRegistration[]>(`/youth-registrations${q ? `?${q}` : ''}`)
  },

  getById: (id: number) =>
    api.get<YouthRegistration>(`/youth-registrations/${id}`),

  create: (payload: CreateYouthRegistrationPayload) =>
    api.post<YouthRegistration>('/youth-registrations', payload),

  guardianApprove: (id: number) =>
    api.patch<YouthRegistration>(`/youth-registrations/${id}/guardian-approve`, {}),

  reject: (id: number, rejectionReason: string) =>
    api.patch<YouthRegistration>(`/youth-registrations/${id}/reject`, { rejectionReason }),

  contract: (id: number, nationalityId: number) =>
    api.patch<YouthRegistration>(`/youth-registrations/${id}/contract`, { nationalityId }),
}
