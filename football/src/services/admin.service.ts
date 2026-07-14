import { api } from './api'
import type { AdminUserDto, ListUsersQuery, UpdateUserRoleDto, PlayerWithoutAccountDto } from '@/types/admin'

export const adminApi = {
  listUsers: (query: ListUsersQuery = {}): Promise<AdminUserDto[]> => {
    const params = new URLSearchParams()
    if (query.username) params.set('username', query.username)
    if (query.role) params.set('role', query.role)
    if (query.coachingRole) params.set('coachingRole', query.coachingRole)
    if (query.frontOfficeRole) params.set('frontOfficeRole', query.frontOfficeRole)
    if (query.isDeleted !== undefined) params.set('isDeleted', String(query.isDeleted))
    const qs = params.toString()
    return api.get<AdminUserDto[]>(`/admin/users${qs ? `?${qs}` : ''}`)
  },

  updateRole: (id: number, dto: UpdateUserRoleDto): Promise<AdminUserDto> =>
    api.patch<AdminUserDto>(`/admin/users/${id}/role`, dto),

  deactivate: (id: number): Promise<AdminUserDto> =>
    api.patch<AdminUserDto>(`/admin/users/${id}/deactivate`, {}),

  reactivate: (id: number): Promise<AdminUserDto> =>
    api.patch<AdminUserDto>(`/admin/users/${id}/reactivate`, {}),

  deleteUser: (id: number): Promise<void> =>
    api.delete<void>(`/admin/users/${id}`),

  listPlayersWithoutAccounts: (name?: string): Promise<PlayerWithoutAccountDto[]> => {
    const qs = name ? `?name=${encodeURIComponent(name)}` : ''
    return api.get<PlayerWithoutAccountDto[]>(`/admin/players-without-accounts${qs}`)
  },
}
