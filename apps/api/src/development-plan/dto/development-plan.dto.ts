export interface CreatePlanDto {
  playerId: string;
  seasonId: number;
  goals: string;
  notes?: string;
}

export interface UpdatePlanDto {
  goals?: string;
  notes?: string;
}

export interface PlanListQuery {
  playerId?: string;
  seasonId?: number;
}
