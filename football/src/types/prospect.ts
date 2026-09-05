import type { Position, PlayStyle } from './player'

export type ProspectStatus = 'LONGLIST' | 'SHORTLIST' | 'ACTIVE' | 'MEDICAL_TEST' | 'CONTRACT_PENDING' | 'SIGNED' | 'ARCHIVED'
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
  playStyle: PlayStyle | null
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
  status?: 'LONGLIST' | 'SHORTLIST'
  playStyle?: PlayStyle
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
  LONGLIST: '롱리스트',
  SHORTLIST: '쇼트리스트',
  ACTIVE: '협상 중',
  MEDICAL_TEST: '메디컬 테스트',
  CONTRACT_PENDING: '계약 검토',
  SIGNED: '계약 완료',
  ARCHIVED: '보류',
}

export const STATUS_STYLE: Record<ProspectStatus, string> = {
  LONGLIST: 'bg-slate-100 text-slate-700 border-slate-200',
  SHORTLIST: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ACTIVE: 'bg-blue-100 text-blue-800 border-blue-200',
  MEDICAL_TEST: 'bg-purple-100 text-purple-800 border-purple-200',
  CONTRACT_PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  SIGNED: 'bg-green-100 text-green-800 border-green-200',
  ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const VISA_ELIGIBILITY_LABEL: Record<VisaEligibility, string> = {
  NOT_REQUIRED: 'N/A',
  CONFIRMED: 'Confirmed',
  UNCERTAIN: 'Uncertain',
}

export const WORK_PERMIT_LABEL: Record<WorkPermitStatus, string> = {
  NOT_REQUIRED: 'N/A',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}
