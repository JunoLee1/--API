import type { FacilityZone, InspectionType, InspectionResult } from "../../../generated/enums";

export interface CreateInspectionDto {
  type: InspectionType;
  facilityZone: FacilityZone;
  result: InspectionResult;
  sanitationScore?: number;
  isStatutory?: boolean;
  certificateUrl?: string;
  statutoryDeadline?: string;
  inspectedAt?: string;
  notes?: string;
}

export interface UpdateInspectionDto {
  type?: InspectionType;
  facilityZone?: FacilityZone;
  result?: InspectionResult;
  sanitationScore?: number;
  isStatutory?: boolean;
  certificateUrl?: string;
  statutoryDeadline?: string;
  inspectedAt?: string;
  notes?: string;
}

export interface InspectionListQuery {
  zone?: FacilityZone;
  type?: InspectionType;
  result?: InspectionResult;
}
