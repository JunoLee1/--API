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
        const userTeam = teams.find(t => t.id === user.teamId)
        setIsLite(userTeam?.club?.isLite ?? false)
      })
      .catch(() => null)
  }, [user])

  return isLite
}
