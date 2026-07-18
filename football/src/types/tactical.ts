export type TacticalPhase = 'PRE_MATCH' | 'POST_MATCH'
export type TacticalStatus = 'DRAFT' | 'CONFIRMED'
export type TacticalMediaType = 'image' | 'video'

export interface TacticalMedia {
  id: number
  url: string
  type: TacticalMediaType
  tacticalAnalysisId: number
}

export interface TacticalAnalysis {
  id: number
  matchId: number
  phase: TacticalPhase
  status: TacticalStatus
  formation: string | null
  opponentAnalysis: string | null
  createdById: number
  createdAt: string
  match: {
    homeTeamName: string
    awayTeamName: string
    date: string
    homeScore: number | null
    awayScore: number | null
  }
  createdBy: { nickname: string }
  media?: TacticalMedia[]
}

export interface CreateTacticalDto {
  matchId: number
  phase: TacticalPhase
  formation?: string
  opponentAnalysis?: string
}

export const FORMATION_OPTIONS = [
  '4-3-3',
  '4-4-2',
  '4-2-3-1',
  '4-1-4-1',
  '4-5-1',
  '3-5-2',
  '3-4-3',
  '3-4-2-1',
  '5-3-2',
  '5-4-1',
  '4-3-2-1',
] as const

export const MEDIA_TYPE_LABEL: Record<TacticalMediaType, string> = {
  image: '사진',
  video: '영상',
}

export const PHASE_LABEL: Record<TacticalPhase, string> = {
  PRE_MATCH: '경기 전',
  POST_MATCH: '경기 후',
}

export const PHASE_STYLE: Record<TacticalPhase, string> = {
  PRE_MATCH: 'bg-blue-100 text-blue-800 border-blue-200',
  POST_MATCH: 'bg-purple-100 text-purple-800 border-purple-200',
}

export const STATUS_LABEL: Record<TacticalStatus, string> = {
  DRAFT: '초안',
  CONFIRMED: '확정',
}

export const STATUS_STYLE: Record<TacticalStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-green-100 text-green-800 border-green-200',
}
