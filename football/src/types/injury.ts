export type InjuryCause = 'TRAINING' | 'MATCH' | 'OTHER'
export type InjuryStatus =
  | 'OCCURRED'
  | 'DIAGNOSED'
  | 'REHABILITATING'
  | 'READY_TO_RETURN'
  | 'RETURNED'

export interface Injury {
  id: number
  bodyPart: string
  cause: InjuryCause
  status: InjuryStatus
  occurredAt: string
  expectedReturnDate: string | null
  playerId: string
  medicalStaffId: number
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
