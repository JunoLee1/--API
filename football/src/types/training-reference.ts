import type { SessionType } from '@/types/training'

export type ReferenceSource = 'INTERNAL' | 'EXTERNAL'

export interface TrainingReference {
  id: number
  sessionType: SessionType
  title: string
  url: string
  source: ReferenceSource
  tags: string[]
  createdAt: string
  addedBy: { id: number; nickname: string }
}

export interface TrainingReferenceRecommendation {
  session: {
    id: number
    date: string
    goal: string
    sessionType: SessionType
  }
  avgScore: number | null
}

export const REFERENCE_SOURCE_LABEL: Record<ReferenceSource, string> = {
  INTERNAL: '내부',
  EXTERNAL: '외부',
}
