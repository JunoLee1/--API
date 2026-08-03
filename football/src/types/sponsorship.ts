export type SponsorType = 'TITLE' | 'KIT' | 'STADIUM_NAMING' | 'DIGITAL' | 'OTHER'
export type PaymentSchedule = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
export type SponsorshipPaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE'

export interface SponsorshipPayment {
  id: number
  sponsorshipId: number
  dueDate: string
  amount: number
  paidAt: string | null
  status: SponsorshipPaymentStatus
  createdAt: string
  updatedAt: string
}

export interface Sponsorship {
  id: number
  sponsorName: string
  type: SponsorType
  totalFee: number
  contractStart: string
  contractEnd: string
  paymentSchedule: PaymentSchedule
  attachedContractId: number | null
  createdById: number
  createdAt: string
  updatedAt: string
  createdBy: { id: number; username: string }
  payments?: SponsorshipPayment[]
}

export interface SponsorshipListResponse {
  data: Sponsorship[]
  total: number
  page: number
  totalPages: number
}

export interface CreateSponsorshipDto {
  sponsorName: string
  type: SponsorType
  totalFee: number
  contractStart: string   // ISO date string e.g. "2026-01-01"
  contractEnd: string
  paymentSchedule: PaymentSchedule
}

export interface UpdateSponsorshipDto {
  sponsorName?: string
  type?: SponsorType
  totalFee?: number
  contractStart?: string
  contractEnd?: string
  paymentSchedule?: PaymentSchedule
}

export const SPONSOR_TYPE_LABEL: Record<SponsorType, string> = {
  TITLE: '타이틀',
  KIT: '유니폼',
  STADIUM_NAMING: '경기장 명명',
  DIGITAL: '디지털',
  OTHER: '기타',
}

export const SPONSOR_TYPE_STYLE: Record<SponsorType, string> = {
  TITLE: 'bg-purple-100 text-purple-800 border-purple-200',
  KIT: 'bg-blue-100 text-blue-800 border-blue-200',
  STADIUM_NAMING: 'bg-green-100 text-green-800 border-green-200',
  DIGITAL: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  OTHER: 'bg-gray-100 text-gray-600 border-gray-200',
}

export const PAYMENT_SCHEDULE_LABEL: Record<PaymentSchedule, string> = {
  MONTHLY: '월납',
  QUARTERLY: '분기납',
  ANNUAL: '연납',
}

export const PAYMENT_STATUS_LABEL: Record<SponsorshipPaymentStatus, string> = {
  PENDING: '미납',
  PAID: '납부완료',
  OVERDUE: '연체',
}

export const PAYMENT_STATUS_STYLE: Record<SponsorshipPaymentStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PAID: 'bg-green-100 text-green-800 border-green-200',
  OVERDUE: 'bg-red-100 text-red-800 border-red-200',
}
