import type { FacilityZone, MaintenancePriority } from "../../../generated/enums";

export interface CreatePreventiveScheduleDto {
  facilityZone: FacilityZone;
  title: string;
  description?: string;
  intervalDays: number;
  priority: MaintenancePriority;
  partnerId?: number;
}

export interface UpdatePreventiveScheduleDto {
  title?: string;
  description?: string;
  intervalDays?: number;
  priority?: MaintenancePriority;
  partnerId?: number;
}

export interface PreventiveScheduleListQuery {
  facilityZone?: FacilityZone;
  isActive?: string;
}
