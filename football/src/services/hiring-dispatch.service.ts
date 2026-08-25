import { api } from './api'
import type {
  BudgetReverifyPayload,
  CreateHiringDispatchPayload,
  HiringDispatch,
  HiringDispatchFilter,
  HiringDispatchListItem,
  HiringDispatchStatus,
} from '@/types/hiring-dispatch'

/**
 * Client for `/api/hiring-dispatches`. Mirrors the routes wired in
 * `apps/api/src/hiring-dispatch/hiring-dispatch.routes.ts` 1:1.
 *
 * Errors: the shared `request()` in ./api throws Error(code) with the backend
 * error code (e.g. TO_EXCEEDED, SELF_APPROVAL_FORBIDDEN). Pages/hooks catch
 * and map codes to Korean UI strings — see HiringDispatchPage for the pattern.
 */
export const hiringDispatchApi = {
  list(filter?: HiringDispatchFilter, status?: HiringDispatchStatus | string) {
    const params = new URLSearchParams()
    if (filter) params.set('filter', filter)
    if (status) params.set('status', status)
    const qs = params.toString()
    return api.get<HiringDispatchListItem[]>(
      `/hiring-dispatches${qs ? `?${qs}` : ''}`,
    )
  },

  get(id: number) {
    return api.get<HiringDispatch>(`/hiring-dispatches/${id}`)
  },

  create(payload: CreateHiringDispatchPayload) {
    return api.post<HiringDispatch>('/hiring-dispatches', payload)
  },

  budgetReverify(id: number, overrides: BudgetReverifyPayload = {}) {
    return api.patch<HiringDispatch>(
      `/hiring-dispatches/${id}/budget-reverify`,
      overrides,
    )
  },

  budgetReject(id: number, reason: string) {
    return api.patch<HiringDispatch>(`/hiring-dispatches/${id}/budget-reject`, {
      reason,
    })
  },

  dispatchApprove(id: number) {
    return api.patch<HiringDispatch>(
      `/hiring-dispatches/${id}/dispatch-approve`,
      {},
    )
  },

  dispatchReject(id: number, reason: string) {
    return api.patch<HiringDispatch>(
      `/hiring-dispatches/${id}/dispatch-reject`,
      { reason },
    )
  },

  dispatch(id: number) {
    return api.patch<HiringDispatch>(`/hiring-dispatches/${id}/dispatch`, {})
  },

  cancel(id: number, reason: string) {
    return api.patch<HiringDispatch>(`/hiring-dispatches/${id}/cancel`, {
      reason,
    })
  },

  complete(id: number) {
    return api.patch<HiringDispatch>(`/hiring-dispatches/${id}/complete`, {})
  },
}
