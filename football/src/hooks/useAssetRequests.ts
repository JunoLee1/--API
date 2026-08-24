import { useCallback, useEffect, useState } from 'react'
import { assetRequestApi } from '@/services/asset-request.service'
import type {
  AssetRequestFilter,
  AssetRequestListItem,
  AssetRequestStatus,
} from '@/types/asset-request'

/**
 * Loads AssetRequest list rows via `/asset-requests?filter=...`.
 *
 * The filter param is the load-bearing switch (backend `AssetRequestService.list`):
 *   - `'me'`               : requester's own list (default when filter omitted)
 *   - `'pending-leader'`   : SUBMITTED where user is leaf dept head (팀장)
 *   - `'pending-dept-head'`: LEADER_APPROVED where user is parent dept head
 *   - `'all'`              : admin-only global list
 *
 * Errors are surfaced via `error` (backend Error(code)) rather than thrown —
 * pages can decide whether to toast or render empty state.
 */
export function useAssetRequests(
  filter?: AssetRequestFilter,
  status?: AssetRequestStatus | string,
) {
  const [requests, setRequests] = useState<AssetRequestListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Manual reload for callers (after a mutation). Kept separate from the initial
  // effect so the effect body has no synchronous setState — satisfies
  // react-hooks/set-state-in-effect (see PR #336 era lint rules).
  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    return assetRequestApi
      .list(filter, status)
      .then((rows) => {
        setRequests(rows)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'LOAD_FAILED')
        setRequests([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [filter, status])

  useEffect(() => {
    let cancelled = false
    assetRequestApi
      .list(filter, status)
      .then((rows) => {
        if (!cancelled) setRequests(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'LOAD_FAILED')
          setRequests([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filter, status])

  return { requests, loading, error, reload }
}
