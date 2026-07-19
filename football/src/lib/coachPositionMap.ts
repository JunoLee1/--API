// football/src/lib/coachPositionMap.ts
import type { CoachingRole } from '@/types/auth'
import type { Position } from '@/types/player'

export const COACH_POSITION_MAP: Partial<Record<CoachingRole, Position[]>> = {
  DEFENSIVE_COACH: [
    'CENTER_BACK',
    'LEFT_WING_BACK',
    'LEFT_FULL_BACK',
    'RIGHT_WING_BACK',
    'RIGHT_FULL_BACK',
  ],
  ATTACKING_COACH: [
    'STRIKER',
    'SHADOW_STRIKER',
    'WINGER',
    'CENTRAL_ATTACK_MIDFIELDER',
    'RIGHT_ATTACK_MIDFIELDER',
    'LEFT_ATTACK_MIDFIELDER',
  ],
  GOALKEEPER_COACH: ['GOALKEEPER'],
}

export function getCoachPositions(coachingRole: CoachingRole | null | undefined): Position[] | null {
  if (!coachingRole) return null
  return COACH_POSITION_MAP[coachingRole] ?? null
}
