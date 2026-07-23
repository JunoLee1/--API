export type BadgeType =
  | 'PASSION_KING'
  | 'SPACE_WIZARD'
  | 'BEST_PASSER'
  | 'TEAM_PLAYER'
  | 'MOST_IMPROVED'
  | 'DEFENSIVE_WALL'
  | 'GOAL_MACHINE'

export const BADGE_LABEL: Record<BadgeType, string> = {
  PASSION_KING: '열정왕',
  SPACE_WIZARD: '공간마법사',
  BEST_PASSER: '패스마스터',
  TEAM_PLAYER: '팀플레이어',
  MOST_IMPROVED: '최고성장',
  DEFENSIVE_WALL: '수비의 벽',
  GOAL_MACHINE: '득점기계',
}

export interface GrowthEvaluation {
  id: number
  playerId: string
  player: { id: string; playerName: string; guardianId: number | null }
  coachId: number
  coach: { id: number; username: string; nickname: string }
  year: number
  month: number
  isPublished: boolean
  publishedAt: string | null
  attitudeScore: number
  attitudeComment: string
  fundamentalsScore: number
  fundamentalsComment: string
  spatialScore: number
  spatialComment: string
  physicalScore: number
  physicalComment: string
  createdAt: string
  updatedAt: string
}

export interface PlayerBadge {
  id: number
  playerId: string
  player: { id: string; playerName: string }
  coachId: number
  coach: { id: number; username: string; nickname: string }
  sessionId: number | null
  session: { id: number; date: string } | null
  badgeType: BadgeType
  awardedAt: string
  note: string | null
}

export interface CreateGrowthEvaluationPayload {
  playerId: string
  year: number
  month: number
  attitudeScore: number
  attitudeComment: string
  fundamentalsScore: number
  fundamentalsComment: string
  spatialScore: number
  spatialComment: string
  physicalScore: number
  physicalComment: string
}

export interface AwardBadgePayload {
  playerId: string
  sessionId?: number
  badgeType: BadgeType
  note?: string
}
