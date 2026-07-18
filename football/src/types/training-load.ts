export interface TrainingLoad {
  id: number
  playerId: string
  sessionId: number
  rpe: number
  load: number | null
  player: { id: string; playerName: string; position: string }
  session: { id: number; date: string; sessionType: string }
}

export interface WeeklySummary {
  playerId: string
  weekStart: string
  total: number
  overload: boolean
}

export interface UpsertTrainingLoadPayload {
  playerId: string
  sessionId: number
  rpe?: number
  load?: number
}
