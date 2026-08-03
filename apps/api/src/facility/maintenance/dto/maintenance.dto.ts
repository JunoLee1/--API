import type { MaintenancePriority, MaintenanceStatus } from "../../../generated/enums";

export interface CreateMaintenanceDto {
  title: string;
  description: string;
  priority: MaintenancePriority;
  sourceInspectionId?: number;
  estimatedCost?: number;
}

export interface UpdateMaintenanceDto {
  title?: string;
  description?: string;
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;
  postIncidentReport?: string;
  estimatedCost?: number;
  actualCost?: number;
}

export interface MaintenanceListQuery {
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
}
