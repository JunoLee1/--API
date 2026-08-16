export type LoadUnit = "KG" | "MINUTES" | "DISTANCE_M" | "SETS";

export interface UpsertTrainingLoadDto {
  playerId: string;
  sessionId: number;
  rpe?: number;
  load?: number;
  loadUnit?: LoadUnit;
}

export interface TrainingLoadQuery {
  sessionId?: number;
  playerId?: string;
}

export interface WeeklySummaryQuery {
  playerId: string;
  weekStart: string;
}
