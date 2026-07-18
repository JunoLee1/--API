export type DevelopmentPlanStatus = "DRAFT" | "ACTIVE" | "REVIEWED";

export interface DevelopmentPlan {
  id: number;
  playerId: string;
  coachId: number;
  seasonId: number;
  goals: string;
  notes: string | null;
  status: DevelopmentPlanStatus;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  player: { playerName: string; position: string };
  coach: { id: number; username: string; nickname: string | null };
  season: { id: number; name: string };
}

export interface CreateDevelopmentPlanPayload {
  playerId: string;
  seasonId: number;
  goals: string;
  notes?: string;
}

export interface UpdateDevelopmentPlanPayload {
  goals?: string;
  notes?: string;
}

export const PLAN_STATUS_LABEL: Record<DevelopmentPlanStatus, string> = {
  DRAFT: "작성 중",
  ACTIVE: "활성",
  REVIEWED: "검토 완료",
};
