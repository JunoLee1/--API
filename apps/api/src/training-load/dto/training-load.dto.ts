export interface UpsertTrainingLoadDto {
  playerId: string;
  sessionId: number;
  rpe?: number;
  load?: number;
}

export interface TrainingLoadQuery {
  sessionId?: number;
  playerId?: string;
}

export interface WeeklySummaryQuery {
  playerId: string;
  weekStart: string;
}
