import { Foot, Position, PlayerLevel, PlayerStatus, TeamType } from "../../generated/enums";

export interface CreatePlayerDto {
  playerName: string;
  dateOfBirth: string;
  preferredFoot: Foot;
  height: number;
  weight: number;
  position: Position;
  level: PlayerLevel;
  nationalityId: number;
  externalId?: string;
  userId?: number;
  agentId?: number;
}

export interface UpdatePlayerDto {
  playerName?: string;
  dateOfBirth?: string;
  preferredFoot?: Foot;
  height?: number;
  weight?: number;
  position?: Position;
  level?: PlayerLevel;
  nationalityId?: number;
  externalId?: string;
  agentId?: number;
  allergies?: string[];
  foodPreferences?: string | null;
}

export interface UpdatePlayerStatusDto {
  status: PlayerStatus;
}

export interface PlayerListQuery {
  status?: PlayerStatus;
  position?: Position;
  level?: PlayerLevel;
  nationalityId?: number;
  excludeYouth?: boolean;
  teamType?: TeamType;
}
