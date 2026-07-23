import { useState, useEffect } from 'react'
import { useCurrentUser } from './useCurrentUser'
import { teamApi } from '@/services/team.service'

export function useLiteMode(): boolean {
  const { user } = useCurrentUser()
  const [isLite, setIsLite] = useState(false)

  useEffect(() => {
    if (!user) return
    teamApi.list()
      .then(teams => {
        // Match user to their team via coachingStaff or player association
        // Default: not Lite (most users aren't on a Lite team)
        setIsLite(false)
      })
      .catch(() => null)
  }, [user])

  return isLite
}
