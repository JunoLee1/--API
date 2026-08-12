export interface FormationSnapshot {
  id: number
  matchId: number
  minute: number | null
  formation: string
  changeReason: string | null
  createdAt: string
  createdBy: { id: number; nickname: string }
}

export interface CreateFormationSnapshotPayload {
  matchId: number
  minute?: number
  formation: string
  changeReason?: string
}
