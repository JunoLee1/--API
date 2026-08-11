import { Request } from "express";
import { Role } from '../generated/enums'
import { AppError } from './appError'

export const Permission = {
  SYSTEM_MANAGE: 'SYSTEM_MANAGE',
  FINANCE_APPROVE: 'FINANCE_APPROVE',
  VIEW_TEAM_RANKING: 'VIEW_TEAM_RANKING',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [Permission.SYSTEM_MANAGE, Permission.FINANCE_APPROVE, Permission.VIEW_TEAM_RANKING],
  SUPER_ADMIN: [Permission.SYSTEM_MANAGE, Permission.FINANCE_APPROVE, Permission.VIEW_TEAM_RANKING],
  GM: [Permission.FINANCE_APPROVE, Permission.VIEW_TEAM_RANKING],
  FRONT_OFFICE: [Permission.VIEW_TEAM_RANKING],
  COACHING_STAFF: [Permission.VIEW_TEAM_RANKING],
  PLAYER: [Permission.VIEW_TEAM_RANKING],
  AGENT: [],
  GUARDIAN: [],
}

export const isSuperAdmin = (user: Express.User): boolean =>
  user.role === 'SUPER_ADMIN'

export const isAdminLike = (role: string): boolean =>
  role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'GM'

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function requireSuperAdmin(req: Request): void {
  if (req.user?.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'FORBIDDEN')
  }
}

export const canReadFinance = (role: string, foRole?: string | null, deptCategories?: string[]): boolean =>
  isAdminLike(role) ||
  (role === 'FRONT_OFFICE' && (foRole === 'FINANCE_MANAGER' || foRole === 'FINANCE_STAFF')) ||
  (deptCategories?.includes('FINANCE') ?? false)

export const canWriteFinance = (role: string, foRole?: string | null, deptCategories?: string[]): boolean =>
  isAdminLike(role) ||
  (role === 'FRONT_OFFICE' && (foRole === 'FINANCE_MANAGER' || foRole === 'FINANCE_STAFF')) ||
  (deptCategories?.includes('FINANCE') ?? false)

export const canReadHR = (role: string, foRole?: string | null, deptCategories?: string[]): boolean =>
  isAdminLike(role) ||
  (role === 'FRONT_OFFICE' && (foRole === 'HR_MANAGER' || foRole === 'HR_STAFF')) ||
  (deptCategories?.includes('HR') ?? false)

export const canWriteHR = (role: string, foRole?: string | null, deptCategories?: string[]): boolean =>
  isAdminLike(role) ||
  (role === 'FRONT_OFFICE' && foRole === 'HR_MANAGER') ||
  (deptCategories?.includes('HR') ?? false)

export const canManageTD = (role: string, foRole?: string | null): boolean =>
  isAdminLike(role) ||
  (role === 'FRONT_OFFICE' && foRole === 'TD')

export const canReadActiveInjury = (role: string, coachingRole?: string | null): boolean =>
  isAdminLike(role) ||
  role === 'COACHING_STAFF' ||
  (role === 'FRONT_OFFICE' && coachingRole === 'TD')

export const canReadInjuryReport = (role: string, coachingRole?: string | null): boolean =>
  isAdminLike(role) ||
  (role === 'COACHING_STAFF' && (coachingRole === 'MEDICAL' || coachingRole === 'MEDICAL_DIRECTOR'))

export const isHeadCoach = (role: string, coachingRole?: string | null): boolean =>
  role === 'COACHING_STAFF' && coachingRole === 'HEAD_COACH'

export function canApprovePlan(userRole: string, requiredLevel: string | null): boolean {
  switch (requiredLevel ?? 'HEAD') {
    case 'HEAD':
    case 'GM':
      return isAdminLike(userRole)
    case 'ADMIN':
      return userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'
    default:
      return false
  }
}
