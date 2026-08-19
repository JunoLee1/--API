import type { CoachingRole, FrontOfficeRole, Role } from '@/types/auth'

export function getDefaultLanding(
  role: Role,
  coachingRole?: CoachingRole | null,
  frontOfficeRole?: FrontOfficeRole | null,
): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
    case 'GM':
    case 'AGENT':
      return '/dashboard'

    case 'PLAYER':
      return '/player/me'

    case 'GUARDIAN':
      return '/guardian-portal'

    case 'COACHING_STAFF':
      if (coachingRole === 'HEAD_COACH' || coachingRole === 'ASSISTANT_COACH')
        return '/coach-dashboard'
      if (coachingRole === 'MEDICAL' || coachingRole === 'MEDICAL_DIRECTOR')
        return '/injuries'
      return '/training'

    case 'FRONT_OFFICE':
      if (frontOfficeRole === 'FINANCE_MANAGER' || frontOfficeRole === 'FINANCE_STAFF')
        return '/finance/budget'
      if (frontOfficeRole === 'HR_MANAGER' || frontOfficeRole === 'HR_STAFF')
        return '/reports'
      if (frontOfficeRole === 'FACILITY_MANAGER' || frontOfficeRole === 'FACILITY_STAFF')
        return '/facility'
      if (frontOfficeRole === 'ASSET_MANAGER' || frontOfficeRole === 'ASSET_STAFF')
        return '/facility'
      if (frontOfficeRole === 'EQUIPMENT_MANAGER')
        return '/equipment'
      return '/dashboard'

    default:
      return '/dashboard'
  }
}
