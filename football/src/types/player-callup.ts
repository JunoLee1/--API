export type PlayerCallupStatus = 'REQUESTED' | 'DOCS_SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED'

export const CALLUP_STATUS_LABEL: Record<PlayerCallupStatus, string> = {
  REQUESTED: '요청',
  DOCS_SUBMITTED: '서류제출',
  APPROVED: '승인',
  REJECTED: '거절',
  COMPLETED: '완료',
}

export const CALLUP_STATUS_STYLE: Record<PlayerCallupStatus, string> = {
  REQUESTED: 'border-yellow-300 text-yellow-700 bg-yellow-50',
  DOCS_SUBMITTED: 'border-blue-300 text-blue-700 bg-blue-50',
  APPROVED: 'border-green-300 text-green-700 bg-green-50',
  REJECTED: 'border-red-300 text-red-700 bg-red-50',
  COMPLETED: 'border-gray-300 text-gray-600 bg-gray-50',
}

export interface PlayerCallup {
  id: number
  status: PlayerCallupStatus
  reason: string
  startDate: string
  endDate: string | null
  createdAt: string
  youthCoachConfirmed: boolean
  medicalConfirmed: boolean
  player: { id: string; playerName: string; position: string }
  fromTeam: { id: number; name: string }
  toTeam: { id: number; name: string }
  requestedBy: { id: number; nickname: string }
  approvedBy: { id: number; nickname: string } | null
}

export interface CreateCallupDto {
  playerId: string
  fromTeamId: number
  toTeamId: number
  reason: string
  startDate: string
  endDate?: string
}
