import { useEffect, useState, useCallback } from 'react'
import { api } from '@/services/api'

export interface PartnerAlert {
  type: string
  title: string
  body: string
  daysLeft: number
  contractId: number
  playerId: string
  playerName: string
  endDate: string
  managedBy: string | null
}

const POLL_INTERVAL = 1000 * 60 * 5

export function usePartnerNotification(role: string | undefined) {
  const [alerts, setAlerts] = useState<PartnerAlert[]>([])

  const fetch = useCallback(() => {
    if (role !== 'ADMIN') return
    api.get<PartnerAlert[]>('/notifications/partners').then(setAlerts).catch(() => null)
  }, [role])

  useEffect(() => {
    fetch()
    if (role !== 'ADMIN') return
    const timer = setInterval(fetch, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [fetch, role])

  return alerts
}
