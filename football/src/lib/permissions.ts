export function isAdminLike(role: string): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'GM'
}

export function canReadFinance(role: string, frontOfficeRole?: string | null): boolean {
  return (
    isAdminLike(role) ||
    (role === 'FRONT_OFFICE' && (frontOfficeRole === 'FINANCE_MANAGER' || frontOfficeRole === 'FINANCE_STAFF'))
  )
}
