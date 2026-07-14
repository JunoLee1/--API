export type PartnerType = 'MANUFACTURER' | 'HOSPITAL'
export type PartnerContractStatus = 'ACTIVE' | 'EXPIRED' | 'TERMINATED'

export interface Partner {
  id: number
  type: PartnerType
  name: string
  country: string | null
  website: string | null
  address: string | null
  phone: string | null
  createdAt: string
  contracts?: PartnerContract[]
}

export interface PartnerContract {
  id: number
  partnerId: number
  status: PartnerContractStatus
  startDate: string
  endDate: string
  sponsorshipFee: number | null
  discountRate: number | null
  notes: string | null
  createdAt: string
}

export interface CreatePartnerDto {
  type: PartnerType
  name: string
  country?: string
  website?: string
  address?: string
  phone?: string
}

export interface CreatePartnerContractDto {
  startDate: string
  endDate: string
  sponsorshipFee?: number
  discountRate?: number
  notes?: string
}

export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  MANUFACTURER: '제조사',
  HOSPITAL: '협진병원',
}

export const CONTRACT_STATUS_LABEL: Record<PartnerContractStatus, string> = {
  ACTIVE: '유효',
  EXPIRED: '만료',
  TERMINATED: '해지',
}

export const CONTRACT_STATUS_STYLE: Record<PartnerContractStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  EXPIRED: 'bg-gray-100 text-gray-500 border-gray-200',
  TERMINATED: 'bg-red-100 text-red-800 border-red-200',
}
