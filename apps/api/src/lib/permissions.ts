import { Role } from '../generated/enums'

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
