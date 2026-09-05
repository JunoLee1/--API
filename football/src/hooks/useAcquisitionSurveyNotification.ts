import { useEffect } from 'react'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'

interface AcquisitionSurveyEvent {
  type: string
  surveyId: number
  title: string
  body: string
  createdAt: string
}

export function useAcquisitionSurveyNotification(onNew: () => void) {
  useEffect(() => {
    const socket = getSocket()

    socket.on('notification:acquisition-survey', (data: AcquisitionSurveyEvent) => {
      toast.info(data.title, { description: data.body })
      onNew()
    })

    return () => {
      socket.off('notification:acquisition-survey')
    }
  }, [onNew])
}
