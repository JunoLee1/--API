import { api } from './api'
import type { HiringDocReviewStatus, HiringDocument } from '@/types/hiring-document'

/**
 * Target descriptor — XOR (matches BE contract in
 * `apps/api/src/hiring-document/dto/hiring-document.dto.ts`).
 */
export type HiringDocTarget =
  | { applicationId: number; hiringDispatchId?: never }
  | { applicationId?: never; hiringDispatchId: number }

/**
 * Client for `/api/hiring-documents`. Uses multipart for upload (matches
 * multer + diskStorage on the server); everything else is JSON.
 */
export const hiringDocumentApi = {
  /**
   * Upload a single file. Creates a new PENDING row (append-only Q7).
   */
  upload(target: HiringDocTarget, docType: string, file: File): Promise<HiringDocument> {
    const form = new FormData()
    form.append('docType', docType)
    if ('applicationId' in target && target.applicationId !== undefined) {
      form.append('applicationId', String(target.applicationId))
    }
    if ('hiringDispatchId' in target && target.hiringDispatchId !== undefined) {
      form.append('hiringDispatchId', String(target.hiringDispatchId))
    }
    form.append('file', file)
    return api.postForm<HiringDocument>('/hiring-documents', form)
  },

  review(id: number, status: Exclude<HiringDocReviewStatus, 'PENDING'>, reviewNotes?: string): Promise<HiringDocument> {
    return api.patch<HiringDocument>(`/hiring-documents/${id}/review`, {
      status,
      ...(reviewNotes !== undefined && { reviewNotes }),
    })
  },

  /**
   * Latest row per docType. Use this to power the "current state" table.
   */
  listCurrent(target: HiringDocTarget): Promise<HiringDocument[]> {
    const params = new URLSearchParams()
    if ('applicationId' in target && target.applicationId !== undefined) {
      params.set('applicationId', String(target.applicationId))
    }
    if ('hiringDispatchId' in target && target.hiringDispatchId !== undefined) {
      params.set('hiringDispatchId', String(target.hiringDispatchId))
    }
    return api.get<HiringDocument[]>(`/hiring-documents?${params.toString()}`)
  },

  /**
   * Full history for a single docType. Newest first.
   */
  listHistory(target: HiringDocTarget, docType: string): Promise<HiringDocument[]> {
    const params = new URLSearchParams()
    if ('applicationId' in target && target.applicationId !== undefined) {
      params.set('applicationId', String(target.applicationId))
    }
    if ('hiringDispatchId' in target && target.hiringDispatchId !== undefined) {
      params.set('hiringDispatchId', String(target.hiringDispatchId))
    }
    params.set('docType', docType)
    return api.get<HiringDocument[]>(`/hiring-documents/history?${params.toString()}`)
  },
}
