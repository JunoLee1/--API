export interface AuditLogActor {
  id: number
  username: string
  nickname: string | null
  role: string
}

export interface AuditLogEntry {
  id: number
  action: string
  targetId: string | null
  detail: string | null
  createdAt: string
  actor: AuditLogActor
}

export interface AuditLogListResponse {
  logs: AuditLogEntry[]
  total: number
}

export interface AuditLogFilters {
  actorId?: number
  action?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}
