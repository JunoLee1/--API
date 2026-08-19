import type { CoachingRole, FrontOfficeRole, Role } from '@/types/auth'

type NavSection =
  | 'nav.section.playerMgmt'
  | 'nav.section.contractTransfer'
  | 'nav.section.injuryMedical'
  | 'nav.section.training'
  | 'nav.section.matchAnalysis'
  | 'nav.section.youth'
  | 'nav.section.coachingStaff'
  | 'nav.section.docApproval'
  | 'nav.section.management'

const DEFAULT_ORDER: NavSection[] = [
  'nav.section.playerMgmt',
  'nav.section.contractTransfer',
  'nav.section.injuryMedical',
  'nav.section.training',
  'nav.section.matchAnalysis',
  'nav.section.youth',
  'nav.section.coachingStaff',
  'nav.section.docApproval',
  'nav.section.management',
]

export function getSectionOrder(
  role: Role,
  coachingRole?: CoachingRole | null,
  frontOfficeRole?: FrontOfficeRole | null,
): NavSection[] {
  if (role === 'PLAYER') {
    return [
      'nav.section.training',
      'nav.section.matchAnalysis',
      'nav.section.injuryMedical',
    ]
  }

  if (role === 'COACHING_STAFF') {
    if (coachingRole === 'MEDICAL' || coachingRole === 'MEDICAL_DIRECTOR') {
      return [
        'nav.section.injuryMedical',
        'nav.section.training',
        'nav.section.playerMgmt',
        'nav.section.matchAnalysis',
        'nav.section.youth',
        'nav.section.coachingStaff',
        'nav.section.docApproval',
        'nav.section.management',
      ]
    }
    return [
      'nav.section.training',
      'nav.section.matchAnalysis',
      'nav.section.playerMgmt',
      'nav.section.injuryMedical',
      'nav.section.youth',
      'nav.section.coachingStaff',
      'nav.section.docApproval',
      'nav.section.management',
    ]
  }

  if (role === 'FRONT_OFFICE') {
    if (frontOfficeRole === 'FINANCE_MANAGER' || frontOfficeRole === 'FINANCE_STAFF') {
      return [
        'nav.section.management',
        'nav.section.contractTransfer',
        'nav.section.playerMgmt',
        'nav.section.docApproval',
      ]
    }
    if (frontOfficeRole === 'HR_MANAGER' || frontOfficeRole === 'HR_STAFF') {
      return [
        'nav.section.management',
        'nav.section.contractTransfer',
        'nav.section.playerMgmt',
        'nav.section.docApproval',
      ]
    }
    if (
      frontOfficeRole === 'FACILITY_MANAGER' ||
      frontOfficeRole === 'FACILITY_STAFF' ||
      frontOfficeRole === 'ASSET_MANAGER' ||
      frontOfficeRole === 'ASSET_STAFF' ||
      frontOfficeRole === 'EQUIPMENT_MANAGER'
    ) {
      return [
        'nav.section.management',
        'nav.section.playerMgmt',
        'nav.section.docApproval',
      ]
    }
    return DEFAULT_ORDER
  }

  return DEFAULT_ORDER
}
