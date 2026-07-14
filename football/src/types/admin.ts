import type { Role, CoachingRole, FrontOfficeRole } from '@/types/auth'

export interface AdminUserDto {
  id: number
  email: string
  username: string
  nickname: string
  role: Role
  coachingRole: CoachingRole | null
  frontOfficeRole: FrontOfficeRole | null
  isDeleted: boolean
  isOutOfOffice: boolean
  player: { id: string; playerName: string } | null
}

export interface PlayerWithoutAccountDto {
  id: string
  playerName: string
  status: string
  position: string | null
}

export interface ListUsersQuery {
  username?: string
  role?: Role
  coachingRole?: CoachingRole
  frontOfficeRole?: FrontOfficeRole
  isDeleted?: boolean
}

export interface UpdateUserRoleDto {
  role: Role
  coachingRole?: CoachingRole | null
  frontOfficeRole?: FrontOfficeRole | null
}
