import { useCallback, useEffect, useState } from 'react'
import { hiringDispatchApi } from '@/services/hiring-dispatch.service'
import type {
  HiringDispatchFilter,
  HiringDispatchListItem,
  HiringDispatchStatus,
} from '@/types/hiring-dispatch'

/**
 * Loads HiringDispatch list rows via `/hiring-dispatches?filter=...`.
 *
 * The filter param is the load-bearing switch (backend
 * `HiringDispatchService.list`):
 *   - `'me'`                 : rows the caller created (default when omitted)
 *   - `'pending-budget'`     : CREATED (재무 재검증 대기)
 *   - `'pending-dispatch'`   : BUDGET_REVERIFIED (임원 승인 대기)
 *   - `'pending-execution'`  : DISPATCH_APPROVED (HR 실행 대기)
 *   - `'all'`                : admin-only global list
 *
 * Errors are surfaced via `error` (backend Error(code)) rather than thrown —
 * pages can decide whether to toast or render empty state. Mirrors
 * useAssetRequests exactly so refactors touch both symmetrically.
 */
export function useHiringDispatches(
  filter?: HiringDispatchFilter,
  status?: HiringDispatchStatus | string,
) {
  const [dispatches, setDispatches] = useState<HiringDispatchListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    return hiringDispatchApi
      .list(filter, status)
      .then((rows) => {
        setDispatches(rows)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'LOAD_FAILED')
        setDispatches([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [filter, status])

  useEffect(() => {
    let cancelled = false
    hiringDispatchApi
      .list(filter, status)
      .then((rows) => {
        if (!cancelled) setDispatches(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'LOAD_FAILED')
          setDispatches([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filter, status])

  return { dispatches, loading, error, reload }
}
