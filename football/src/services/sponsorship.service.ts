import { api } from './api'
import type {
  Sponsorship,
  SponsorshipListResponse,
  SponsorshipPayment,
  SponsorshipRoiSummary,
  CreateSponsorshipDto,
  UpdateSponsorshipDto,
  SponsorType,
} from '@/types/sponsorship'

export const sponsorshipApi = {
  list: (params?: { type?: SponsorType; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.type) q.set('type', params.type)
    if (params?.page) q.set('page', String(params.page))
    const qs = q.toString()
    return api.get<SponsorshipListResponse>(`/sponsorships${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) =>
    api.get<Sponsorship>(`/sponsorships/${id}`),

  create: (dto: CreateSponsorshipDto) =>
    api.post<Sponsorship>(`/sponsorships`, dto),

  update: (id: number, dto: UpdateSponsorshipDto) =>
    api.patch<Sponsorship>(`/sponsorships/${id}`, dto),

  getPayments: (id: number) =>
    api.get<SponsorshipPayment[]>(`/sponsorships/${id}/payments`),

  markPaid: (sponsorshipId: number, paymentId: number) =>
    api.patch<SponsorshipPayment>(`/sponsorships/${sponsorshipId}/payments/${paymentId}`, {}),

  getRoiSummary: () =>
    api.get<SponsorshipRoiSummary>(`/sponsorships/roi`),
}
