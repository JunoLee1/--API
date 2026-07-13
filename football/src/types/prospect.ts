import type { Position } from './player'

export type ProspectStatus = 'ACTIVE' | 'SIGNED' | 'ARCHIVED'

export interface Prospect {
  id: number
  name: string
  nationality: string | null
  position: Position | null
  currentTeam: string | null
  notes: string | null
  status: ProspectStatus
  convertedPlayerId: string | null
  createdAt: string
  createdBy: { nickname: string }
}

export interface CreateProspectDto {
  name: string
  nationality?: string
  position?: Position
  currentTeam?: string
  notes?: string
}

export interface UpdateProspectDto extends Partial<CreateProspectDto> {
  status?: ProspectStatus
  convertedPlayerId?: string
}

export const STATUS_LABEL: Record<ProspectStatus, string> = {
  ACTIVE: '추적 중',
  SIGNED: '영입 완료',
  ARCHIVED: '종료',
}

export const STATUS_STYLE: Record<ProspectStatus, string> = {
  ACTIVE: 'bg-blue-100 text-blue-800 border-blue-200',
  SIGNED: 'bg-green-100 text-green-800 border-green-200',
  ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
}
