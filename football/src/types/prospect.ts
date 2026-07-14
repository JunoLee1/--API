import type { Position } from './player'

export type ProspectStatus = 'ACTIVE' | 'MEDICAL_TEST' | 'CONTRACT_PENDING' | 'SIGNED' | 'ARCHIVED'
export type VisaEligibility = 'NOT_REQUIRED' | 'CONFIRMED' | 'UNCERTAIN'
export type WorkPermitStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'

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
  createdBy: { nickname: string } | null
  visaRequired: boolean
  visaEligibility: VisaEligibility | null
}

export interface CreateProspectDto {
  name: string
  nationality?: string
  position?: Position
  currentTeam?: string
  notes?: string
}

export interface UpdateProspectDto extends Partial<CreateProspectDto> {
  visaRequired?: boolean
  visaEligibility?: VisaEligibility
}

export interface SignProspectDto {
  dateOfBirth: string
  height: number
  weight: number
  nationalityId: number
  preferredFoot?: 'LEFT' | 'RIGHT' | 'BOTH'
  position?: Position
  contractStartDate: string
  contractEndDate: string
  salary: number
  managedById?: number
  workPermitStatus?: WorkPermitStatus
  workPermitExpiry?: string
}

export const STATUS_LABEL: Record<ProspectStatus, string> = {
  ACTIVE: '추적 중',
  MEDICAL_TEST: '메디컬 테스트',
  CONTRACT_PENDING: '계약 협상 중',
  SIGNED: '영입 완료',
  ARCHIVED: '종료',
}

export const STATUS_STYLE: Record<ProspectStatus, string> = {
  ACTIVE: 'bg-blue-100 text-blue-800 border-blue-200',
  MEDICAL_TEST: 'bg-purple-100 text-purple-800 border-purple-200',
  CONTRACT_PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  SIGNED: 'bg-green-100 text-green-800 border-green-200',
  ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const VISA_ELIGIBILITY_LABEL: Record<VisaEligibility, string> = {
  NOT_REQUIRED: '해당 없음',
  CONFIRMED: '취득 가능',
  UNCERTAIN: '불확실',
}

export const WORK_PERMIT_LABEL: Record<WorkPermitStatus, string> = {
  NOT_REQUIRED: '해당 없음',
  PENDING: '신청 중',
  APPROVED: '승인',
  REJECTED: '거절',
}
