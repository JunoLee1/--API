import { api } from './api'
import type { EmployeeContract } from '@/types/employee-contract'

/**
 * Client for `/api/employee-contracts` (#371). Mirrors the routes wired in
 * `apps/api/src/employee-contract/employee-contract.routes.ts` 1:1.
 *
 * Errors: the shared `request()` in ./api throws Error(code) with the
 * backend error code (e.g. INVALID_STATE_TRANSITION:DRAFT->SIGNED,
 * CONTRACT_NOT_ISSUED). Pages map codes → Korean strings via a
 * `messageForCode` helper alongside the component (see the pattern in
 * HiringDispatchApprovalPage.tsx).
 */
export const employeeContractApi = {
  /** Create a new DRAFT row for a dispatch. */
  create(hiringDispatchId: number) {
    return api.post<EmployeeContract>('/employee-contracts', { hiringDispatchId })
  },

  /** DRAFT → ISSUED. Requires a contract file (PDF/JPG/PNG, 10MB max). */
  issue(id: number, file: File) {
    const form = new FormData()
    form.append('file', file)
    return api.patchForm<EmployeeContract>(`/employee-contracts/${id}/issue`, form)
  },

  /**
   * ISSUED → SIGNED. Uploads the signed scan + records the calendar date
   * the candidate actually signed (HR-provided; `signedConfirmedAt` on the
   * server captures the marking time). Single action per Q4.
   */
  sign(id: number, file: File, signedAt: string) {
    const form = new FormData()
    form.append('file', file)
    form.append('signedAt', signedAt)
    return api.patchForm<EmployeeContract>(`/employee-contracts/${id}/sign`, form)
  },

  /** any non-CANCELLED → CANCELLED. `cancelReason` is required, ≤ 2000 chars. */
  cancel(id: number, cancelReason: string) {
    return api.patch<EmployeeContract>(`/employee-contracts/${id}/cancel`, {
      cancelReason,
    })
  },

  /**
   * Full history for a dispatch, newest first. CANCELLED rows are included
   * so the FE can render the audit trail; the "current" row for gating is
   * the first non-CANCELLED entry.
   */
  listByDispatch(hiringDispatchId: number) {
    return api.get<EmployeeContract[]>(
      `/employee-contracts/dispatch/${hiringDispatchId}`,
    )
  },
}
