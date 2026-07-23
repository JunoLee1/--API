export type SafeguardReportStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'RESOLVED'

export interface SafeguardReport {
  id: number
  description: string
  contactInfo: string | null
  accusedUserId: number | null
  accusedUser?: { id: number; username: string; role: string } | null
  status: SafeguardReportStatus
  resolvedNote: string | null
  createdAt: string
}

export interface CreateSafeguardReportPayload {
  description: string
  contactInfo?: string
  accusedUserId?: number
}
