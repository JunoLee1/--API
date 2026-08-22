import { api } from './api'

export interface SoftwareLicense {
  id: number
  name: string
  vendor: string
  totalSeats: number
  usedSeats: number
  expiresAt: string | null
  renewalCost: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateSoftwareLicenseDto {
  name: string
  vendor: string
  totalSeats: number
  expiresAt?: string
  renewalCost?: number
}

export const softwareLicenseApi = {
  list: () => api.get<SoftwareLicense[]>('/software-licenses'),
  create: (dto: CreateSoftwareLicenseDto) => api.post<SoftwareLicense>('/software-licenses', dto),
  assign: (id: number, userId: number) => api.post<SoftwareLicense>(`/software-licenses/${id}/assign`, { userId }),
  revoke: (id: number, userId: number) => api.delete<SoftwareLicense>(`/software-licenses/${id}/assign/${userId}`),
}
