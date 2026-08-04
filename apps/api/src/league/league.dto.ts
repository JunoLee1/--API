import { LeagueLevel } from "../generated/enums";

export interface CreateLeagueDto {
  name: string;
  level: LeagueLevel;
  year: number;
}

export interface UpdateLeagueDto {
  name?: string;
  isActive?: boolean;
}
