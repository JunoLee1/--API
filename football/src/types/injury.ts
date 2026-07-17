export type BodyPart =
  | 'HEAD_FACE' | 'NECK_SHOULDER' | 'TORSO_BACK'
  | 'THIGH_FRONT' | 'THIGH_BACK' | 'KNEE'
  | 'SHIN_CALF' | 'ANKLE' | 'FOOT_TOE' | 'OTHER'

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  HEAD_FACE:      '머리/얼굴',
  NECK_SHOULDER:  '목/어깨',
  TORSO_BACK:     '몸통/허리',
  THIGH_FRONT:    '허벅지(앞)',
  THIGH_BACK:     '허벅지(뒤)',
  KNEE:           '무릎',
  SHIN_CALF:      '정강이/종아리',
  ANKLE:          '발목',
  FOOT_TOE:       '발/발가락',
  OTHER:          '기타',
}

export const BODY_PARTS: BodyPart[] = [
  'HEAD_FACE', 'NECK_SHOULDER', 'TORSO_BACK',
  'THIGH_FRONT', 'THIGH_BACK', 'KNEE',
  'SHIN_CALF', 'ANKLE', 'FOOT_TOE', 'OTHER',
]

export type InjuryCause = 'TRAINING' | 'MATCH' | 'OTHER'
export type InjuryStatus =
  | 'OCCURRED'
  | 'DIAGNOSED'
  | 'REHABILITATING'
  | 'READY_TO_RETURN'
  | 'RETURNED'
export type HospitalType = 'ACCREDITED' | 'GENERAL'

export interface Injury {
  id: number
  bodyPart: BodyPart
  cause: InjuryCause
  status: InjuryStatus
  occurredAt: string
  expectedReturnDate: string | null
  playerId: string
  medicalStaffId: number
  hospitalType: HospitalType | null
  hospitalId: number | null
  customHospitalName: string | null
  hospital: { id: number; name: string } | null
}

export interface InjuryDetail extends Injury {
  player: { playerName: string; position: string }
  medicalStaff: { username: string }
}

export const CAUSE_LABEL: Record<InjuryCause, string> = {
  TRAINING: '훈련 중',
  MATCH: '경기 중',
  OTHER: '기타',
}

export const INJURY_STATUS_LABEL: Record<InjuryStatus, string> = {
  OCCURRED: '발생',
  DIAGNOSED: '진단 완료',
  REHABILITATING: '재활 중',
  READY_TO_RETURN: '복귀 준비',
  RETURNED: '복귀 완료',
}

export const INJURY_STATUS_STYLE: Record<InjuryStatus, string> = {
  OCCURRED: 'bg-red-100 text-red-800 border-red-200',
  DIAGNOSED: 'bg-orange-100 text-orange-800 border-orange-200',
  REHABILITATING: 'bg-amber-100 text-amber-800 border-amber-200',
  READY_TO_RETURN: 'bg-blue-100 text-blue-800 border-blue-200',
  RETURNED: 'bg-green-100 text-green-800 border-green-200',
}

export type RehabStage =
  | 'INITIAL_TREATMENT'
  | 'ACUTE_TREATMENT'
  | 'REHABILITATION'
  | 'RETURN_TRAINING'
  | 'CLEARED'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type SecurityLevel = 'INTERNAL' | 'MEDICAL' | 'PRIVATE'

export interface InjuryReport {
  id: number
  injuryId: number
  diagnosisName: string | null
  treatmentContent: string | null
  rehabStage: RehabStage | null
  trainingReturnDate: string | null
  matchAvailable: boolean | null
  reinjuryRisk: RiskLevel | null
  medicalOpinion: string | null
  securityLevel: SecurityLevel
  createdById: number
  updatedById: number | null
  createdAt: string
  updatedAt: string
  createdBy: { id: number; nickname: string }
  updatedBy: { id: number; nickname: string } | null
  coachSignedAt: string | null
  coachSignedById: number | null
  coachSigner: { id: number; nickname: string } | null
  trainerSignedAt: string | null
  trainerSignedById: number | null
  trainerSigner: { id: number; nickname: string } | null
  medicalSignedAt: string | null
  medicalSignedById: number | null
  medicalSigner: { id: number; nickname: string } | null
}

export const REHAB_STAGE_LABEL: Record<RehabStage, string> = {
  INITIAL_TREATMENT: '초기 처치',
  ACUTE_TREATMENT: '급성기 치료',
  REHABILITATION: '재활 운동',
  RETURN_TRAINING: '복귀 훈련',
  CLEARED: '완전 복귀',
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  LOW: '낮음',
  MEDIUM: '중간',
  HIGH: '높음',
}

export const RISK_LEVEL_STYLE: Record<RiskLevel, string> = {
  LOW: 'bg-green-50 text-green-700 border-green-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-red-50 text-red-700 border-red-200',
}

export const SECURITY_LEVEL_LABEL: Record<SecurityLevel, string> = {
  INTERNAL: '내부',
  MEDICAL: '의료팀만',
  PRIVATE: '선수 + 의료팀',
}

export interface InjuryAssessment {
  id: number
  injuryId: number
  painLevel: number
  hasSwelling: boolean
  romScore: number
  strengthScore: number
  sprintScore: number
  jumpScore: number
  psychScore: number
  positionRiskScore: number
  medicalScore: number
  functionalScore: number
  modifierScore: number
  totalScore: number
  assessedAt: string
}

export type ExternalReportTarget =
  | 'EDUCATION_OFFICE' | 'SCHOOL_SAFETY'
  | 'LEAGUE' | 'FEDERATION' | 'INSURANCE'

export type ExternalReportStatus =
  | 'PENDING_SUBMISSION' | 'SUBMITTED' | 'SUPPLEMENT_REQUESTED' | 'COMPLETED'

export const EXTERNAL_REPORT_TARGET_LABEL: Record<ExternalReportTarget, string> = {
  EDUCATION_OFFICE: '교육청',
  SCHOOL_SAFETY:    '학교안전공제회',
  LEAGUE:           '리그 연맹',
  FEDERATION:       '협회',
  INSURANCE:        '보험사',
}

export const EXTERNAL_REPORT_STATUS_LABEL: Record<ExternalReportStatus, string> = {
  PENDING_SUBMISSION:   '제출 대기',
  SUBMITTED:            '제출 완료',
  SUPPLEMENT_REQUESTED: '보완 요청',
  COMPLETED:            '완료',
}

export const EXTERNAL_REPORT_STATUS_STYLE: Record<ExternalReportStatus, string> = {
  PENDING_SUBMISSION:   'bg-orange-50 text-orange-700 border-orange-200',
  SUBMITTED:            'bg-blue-50 text-blue-700 border-blue-200',
  SUPPLEMENT_REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED:            'bg-green-50 text-green-700 border-green-200',
}

export interface ExternalReport {
  id: number
  injuryId: number
  target: ExternalReportTarget
  status: ExternalReportStatus
  reportData: Record<string, unknown>
  dueDate: string | null
  createdAt: string
}
