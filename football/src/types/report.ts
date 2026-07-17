export type ReportType = 'FINANCIAL' | 'PERFORMANCE' | 'MEDICAL'
export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export interface ReportUser {
  id: number
  nickname: string
  role: string
  coachingRole: string | null
  frontOfficeRole: string | null
}

export interface Report {
  id: number
  type: ReportType
  status: ReportStatus
  title: string
  content: string
  fileUrl: string | null
  fileName: string | null
  rejectionReason: string | null
  authorId: number
  author: ReportUser
  reviewerId: number | null
  reviewer: ReportUser | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  reviewedAt: string | null
}

export interface CreateReportDto {
  type: ReportType
  title: string
  content: string
  file?: File
}

export interface UpdateReportDto {
  title?: string
  content?: string
  file?: File
}

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  FINANCIAL: '재무',
  PERFORMANCE: '성과',
  MEDICAL: '의무보고서',
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  DRAFT: '초안',
  SUBMITTED: '제출됨',
  APPROVED: '승인',
  REJECTED: '반려',
}

export const REPORT_STATUS_STYLE: Record<ReportStatus, string> = {
  DRAFT: 'border-border text-muted-foreground',
  SUBMITTED: 'border-blue-300 text-blue-700 bg-blue-50',
  APPROVED: 'border-green-300 text-green-700 bg-green-50',
  REJECTED: 'border-red-300 text-red-700 bg-red-50',
}

export const REPORT_TYPE_STYLE: Record<ReportType, string> = {
  FINANCIAL: 'border-purple-300 text-purple-700 bg-purple-50',
  PERFORMANCE: 'border-orange-300 text-orange-700 bg-orange-50',
  MEDICAL: 'border-teal-300 text-teal-700 bg-teal-50',
}
