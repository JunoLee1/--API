import { api } from './api'
import type {
  DepartmentAssetKit,
  UpsertDepartmentAssetKitPayload,
} from '@/types/department-asset-kit'

/**
 * Client for `/api/department-asset-kits/:departmentId` (#373).
 *
 * `get` returns `null` when the department has no kit configured — the
 * backend serializes this as JSON `null`. Callers rendering the editor
 * should treat null as "create-new" mode.
 */
export const departmentAssetKitApi = {
  get(departmentId: number) {
    return api.get<DepartmentAssetKit | null>(
      `/department-asset-kits/${departmentId}`,
    )
  },

  upsert(departmentId: number, payload: UpsertDepartmentAssetKitPayload) {
    return api.put<DepartmentAssetKit>(
      `/department-asset-kits/${departmentId}`,
      payload,
    )
  },

  remove(departmentId: number) {
    return api.delete<DepartmentAssetKit>(
      `/department-asset-kits/${departmentId}`,
    )
  },
}
