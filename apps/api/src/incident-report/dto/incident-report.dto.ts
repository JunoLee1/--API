import { IncidentType, IncidentReportStatus } from "../../generated/enums";

export interface CreateIncidentReportDto {
  playerId: string;
  teamId: number;
  type: IncidentType;
  matchId?: number;
  sessionId?: number;
  description: string;
}

export interface SignIncidentReportDto {
  role: "SUPERVISOR" | "MEDICAL";
}

export interface IncidentReportListQuery {
  teamId?: number;
  status?: IncidentReportStatus;
  playerId?: string;
}
