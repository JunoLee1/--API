import { useEffect } from 'react'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'

interface PlayerContractEvent {
  type: string
  title: string
  body: string
  createdAt: string
}

export function usePlayerNotification(onNew: () => void) {
  useEffect(() => {
    const socket = getSocket()

    socket.on('notification:player-contract', (data: PlayerContractEvent) => {
      toast.info(data.title, { description: data.body })
      onNew()
    })

    return () => {
      socket.off('notification:player-contract')
    }
  }, [onNew])
}
