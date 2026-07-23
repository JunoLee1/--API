export interface CreateSafeguardReportDto {
  description: string
  contactInfo?: string
  accusedUserId?: number
}

export interface UpdateSafeguardStatusDto {
  status: 'UNDER_REVIEW' | 'RESOLVED'
  resolvedNote?: string
}

export function validateCreateSafeguardReport(body: unknown): CreateSafeguardReportDto {
  const b = body as Record<string, unknown>
  if (typeof b.description !== 'string' || b.description.trim().length < 10) {
    throw { statusCode: 400, code: 'INVALID_DESCRIPTION' }
  }
  return {
    description: b.description.trim(),
    contactInfo: typeof b.contactInfo === 'string' ? b.contactInfo : undefined,
    accusedUserId: typeof b.accusedUserId === 'number' ? b.accusedUserId : undefined,
  }
}

export function validateUpdateSafeguardStatus(body: unknown): UpdateSafeguardStatusDto {
  const b = body as Record<string, unknown>
  const VALID = ['UNDER_REVIEW', 'RESOLVED'] as const
  if (!VALID.includes(b.status as any)) {
    throw { statusCode: 400, code: 'INVALID_STATUS' }
  }
  return {
    status: b.status as 'UNDER_REVIEW' | 'RESOLVED',
    resolvedNote: typeof b.resolvedNote === 'string' ? b.resolvedNote : undefined,
  }
}
