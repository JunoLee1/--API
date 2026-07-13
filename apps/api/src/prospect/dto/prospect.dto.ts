import { Position, ProspectStatus } from "../../generated/enums";

export interface CreateProspectDto {
  name: string;
  nationality: string;
  position: Position;
  currentTeam: string;
  notes?: string;
}

export interface UpdateProspectDto {
  name?: string;
  nationality?: string;
  position?: Position;
  currentTeam?: string;
  notes?: string;
}

export interface UpdateProspectStatusDto {
  status: ProspectStatus;
  convertedPlayerId?: string;
}
