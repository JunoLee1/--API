import { Foot, PlayerLevel, Position } from "../../generated/client";

export interface CreatePlayerRepoDto {
  playerName: string;
  dateOfBirth: Date;
  preferredFoot: Foot;
  height: number;
  weight: number;
  position: Position;
  level: PlayerLevel;
  nationalityId: number;
  externalId?: string;
}

export interface CreatePlayerServiceDto {
  playerName: string;
  dateOfBirth: string;
  preferredFoot: Foot;
  height: number;
  weight: number;
  position: Position;
  level: PlayerLevel;
  nationalityId: number;
  externalId?: string;
}

export interface LinkUserRepoDto {
  playerId: string;
  userId: number;
}

export interface UpdatePlayerServiceDto {
  playerName?: string;
  dateOfBirth?: string;
  preferredFoot?: Foot;
  height?: number;
  weight?: number;
  position?: Position;
  level?: PlayerLevel;
  externalId?: string;
}
