export type CoachingRole =
  | 'HEAD_COACH'
  | 'ASSISTANT_COACH'
  | 'DEFENSIVE_COACH'
  | 'ATTACKING_COACH'
  | 'GOALKEEPER_COACH'
  | 'PHYSICAL_COACH'
  | 'SET_PIECE_COACH'

export type CoachStatus =
  | 'CANDIDATE'
  | 'SHORTLISTED'
  | 'APPROVAL_PENDING'
  | 'CONTRACTED'
  | 'RETIRED'
  | 'ARCHIVED'

export type HiringRoundStatus = 'OPEN' | 'CLOSED' | 'CANCELLED'
export type ShortlistSource = 'SYSTEM' | 'MANUAL'
export type TutorType = 'INTERNAL' | 'EXTERNAL'
export type LanguageProficiency = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface CoachHiringRound {
  id: number
  targetRole: CoachingRole
  fitScoreThreshold: number
  status: HiringRoundStatus
  deadline: string | null
  budget: number | null
  notes: string | null
  result: string | null
  createdAt: string
  createdBy: { nickname: string }
  _count: { coaches: number }
}

export interface Coach {
  id: number
  name: string
  nationality: string | null
  coachingRole: CoachingRole
  status: CoachStatus
  shortlistSource: ShortlistSource | null
  notes: string | null
  isDeleted: boolean
  packageLeadId: number | null
  hiringRoundId: number | null
  userId: number | null
  createdAt: string
  updatedAt: string
  packageLead: { id: number; name: string } | null
  headCoachEval: HeadCoachEval | null
  defensiveCoachEval: DefensiveCoachEval | null
  attackingCoachEval: AttackingCoachEval | null
  goalkeeperCoachEval: GoalkeeperCoachEval | null
  tier2Eval: Tier2Eval | null
  tutorAssignments: TutorAssignment[]
}

export interface HeadCoachEval {
  id: number; coachId: number
  possession: number | null; pressingIntensity: number | null
  progressivePassAccuracy: number | null; teamActivity: number | null
  philosophyFitScore: number | null; dataSource: string | null; evaluatedAt: string | null
}

export interface DefensiveCoachEval {
  id: number; coachId: number
  tackleSuccessRate: number | null; clearances: number | null; blocks: number | null
  defensiveErrors: number | null; ballRecovery: number | null; pressingIntensity: number | null
  dataSource: string | null; evaluatedAt: string | null
}

export interface AttackingCoachEval {
  id: number; coachId: number
  xG: number | null; xA: number | null; chanceCreation: number | null
  dribbleSuccessRate: number | null; progressivePassAccuracy: number | null
  shotConversionRate: number | null; goalInvolvement: number | null
  dataSource: string | null; evaluatedAt: string | null
}

export interface GoalkeeperCoachEval {
  id: number; coachId: number
  psxG: number | null; xGConcededDiff: number | null; buildupPassAccuracy: number | null
  dataSource: string | null; evaluatedAt: string | null
}

export interface Tier2Eval {
  id: number; coachId: number
  fitScore: number | null; notes: string | null; evaluatedAt: string | null
}

export interface TutorAssignment {
  id: number; type: TutorType; sessionCount: number
  languageProficiency: LanguageProficiency | null; tacticalImplementationRate: number | null
  externalName: string | null; externalContact: string | null
  internalTutorId: number | null
  internalTutor: { nickname: string } | null
  createdAt: string; updatedAt: string
}

// ── CreateDTOs ───────────────────────────────────────────────────────────────

export interface CreateHiringRoundDto {
  targetRole: CoachingRole
  fitScoreThreshold?: number
  deadline?: string
  budget?: number
  notes?: string
}

export interface CreateCoachDto {
  name: string
  nationality?: string
  coachingRole: CoachingRole
  notes?: string
  hiringRoundId?: number
  packageLeadId?: number
}

export interface CreateTutorDto {
  type: TutorType
  internalTutorId?: number
  externalName?: string
  externalContact?: string
  sessionCount?: number
  languageProficiency?: LanguageProficiency
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const COACHING_ROLE_LABEL: Record<CoachingRole, string> = {
  HEAD_COACH: '감독',
  ASSISTANT_COACH: '수석 코치',
  DEFENSIVE_COACH: '수비 코치',
  ATTACKING_COACH: '공격 코치',
  GOALKEEPER_COACH: 'GK 코치',
  PHYSICAL_COACH: '피지컬 코치',
  SET_PIECE_COACH: '세트피스 코치',
}

export const COACH_STATUS_LABEL: Record<CoachStatus, string> = {
  CANDIDATE: '후보',
  SHORTLISTED: '숏리스트',
  APPROVAL_PENDING: '승인 대기',
  CONTRACTED: '채용 완료',
  RETIRED: '퇴임',
  ARCHIVED: '탈락',
}

export const COACH_STATUS_STYLE: Record<CoachStatus, string> = {
  CANDIDATE: 'bg-gray-100 text-gray-700 border-gray-200',
  SHORTLISTED: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVAL_PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  CONTRACTED: 'bg-green-100 text-green-700 border-green-200',
  RETIRED: 'bg-purple-100 text-purple-700 border-purple-200',
  ARCHIVED: 'bg-red-100 text-red-500 border-red-200',
}

export const ROUND_STATUS_LABEL: Record<HiringRoundStatus, string> = {
  OPEN: '진행 중',
  CLOSED: '완료',
  CANCELLED: '취소',
}

export const LANGUAGE_LABEL: Record<LanguageProficiency, string> = {
  A1: 'A1 (입문)', A2: 'A2 (초급)', B1: 'B1 (중급)',
  B2: 'B2 (상급)', C1: 'C1 (고급)', C2: 'C2 (원어민급)',
}

export const SHORTLIST_SOURCE_LABEL: Record<ShortlistSource, string> = {
  SYSTEM: '자동(시스템)',
  MANUAL: '수동(GM/TD)',
}

export const TIER1_ROLES: CoachingRole[] = [
  'HEAD_COACH', 'DEFENSIVE_COACH', 'ATTACKING_COACH', 'GOALKEEPER_COACH',
]
