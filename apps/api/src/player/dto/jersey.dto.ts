import { JerseyNumberStatus } from "../../generated/client";

export interface AssignJerseyDto {
  number: number;
  playerId?: string;
  status?: JerseyNumberStatus;
}

export interface UpdateJerseyStatusDto {
  status: JerseyNumberStatus;
  playerId?: string | null;
}
