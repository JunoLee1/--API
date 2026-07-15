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
  bodyPart: string
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
  player: { playerName: string }
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
