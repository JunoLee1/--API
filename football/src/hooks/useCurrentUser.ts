import { useCallback, useEffect, useState } from 'react'
import { authApi } from '@/services/auth.service'
import type { UserDto } from '@/types/auth'

export function useCurrentUser() {
  const [user, setUser] = useState<UserDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    authApi
      .me()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refetch = useCallback(async () => {
    try {
      const u = await authApi.me()
      setUser(u)
    } catch {
      setUser(null)
    }
  }, [])

  return { user, loading, refetch }
}
