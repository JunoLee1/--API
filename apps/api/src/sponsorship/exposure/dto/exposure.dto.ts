import type { ExposureChannel } from "../../../generated/enums";

export interface CreateExposureEventDto {
  channel: ExposureChannel;
  occurredAt: string;
  exposureCount?: number;
  fanReach?: number;
  mediaValue?: number;
  notes?: string;
}
