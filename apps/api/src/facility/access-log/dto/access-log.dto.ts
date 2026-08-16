import type { FacilityZone } from "../../../generated/enums";

export type AccessAction = "ENTER" | "EXIT";

export interface LogAccessDto {
  zone: FacilityZone;
  action: AccessAction;
  reason?: string;
}

export interface AccessLogListQuery {
  userId?: string;
  zone?: FacilityZone;
  action?: string;
  from?: string;
  to?: string;
}
