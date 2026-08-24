import { api } from './api'
import type {
  AssetRequest,
  AssetRequestFilter,
  AssetRequestListItem,
  AssetRequestStatus,
  CreateAssetRequestPayload,
} from '@/types/asset-request'

/**
 * Client for `/api/asset-requests`. Mirrors the routes wired in
 * `apps/api/src/asset-request/asset-request.routes.ts` 1:1.
 *
 * Errors: the shared `request()` in ./api throws Error(code) with the backend
 * error code (e.g. BUDGET_EXCEEDED, NOT_LEADER). Pages/hooks catch and map
 * codes to Korean UI strings — see OperatingExpensePage for the pattern.
 */
export const assetRequestApi = {
  list(filter?: AssetRequestFilter, status?: AssetRequestStatus | string) {
    const params = new URLSearchParams()
    if (filter) params.set('filter', filter)
    if (status) params.set('status', status)
    const qs = params.toString()
    return api.get<AssetRequestListItem[]>(`/asset-requests${qs ? `?${qs}` : ''}`)
  },

  get(id: number) {
    return api.get<AssetRequest>(`/asset-requests/${id}`)
  },

  create(payload: CreateAssetRequestPayload) {
    return api.post<AssetRequest>('/asset-requests', payload)
  },

  submit(id: number) {
    return api.patch<AssetRequest>(`/asset-requests/${id}/submit`, {})
  },

  leaderApprove(id: number) {
    return api.patch<AssetRequest>(`/asset-requests/${id}/leader-approve`, {})
  },

  leaderReject(id: number, reason: string) {
    return api.patch<AssetRequest>(`/asset-requests/${id}/leader-reject`, { reason })
  },

  approve(id: number) {
    return api.patch<AssetRequest>(`/asset-requests/${id}/approve`, {})
  },

  reject(id: number, reason: string) {
    return api.patch<AssetRequest>(`/asset-requests/${id}/reject`, { reason })
  },

  cancel(id: number) {
    return api.patch<AssetRequest>(`/asset-requests/${id}/cancel`, {})
  },

  fulfill(id: number) {
    return api.patch<AssetRequest>(`/asset-requests/${id}/fulfill`, {})
  },
}
