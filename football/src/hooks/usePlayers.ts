import { useEffect, useState } from 'react'
import { playerApi } from '@/services/player.service'
import type { Player } from '@/types/player'

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    playerApi
      .list()
      .then(setPlayers)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  return { players, loading }
}
