import { getPrisma } from './prisma'

export async function writeAuditLog(params: {
  actorId: number
  action: string
  targetId?: string | number
  detail?: Record<string, unknown>
}) {
  const prisma = getPrisma()
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetId: params.targetId != null ? String(params.targetId) : null,
      detail: params.detail ? JSON.stringify(params.detail) : null,
    },
  })
}
