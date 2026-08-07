import { LeagueLevel } from "../generated/enums";

export interface CreateLeagueDto {
  name: string;
  level: LeagueLevel;
  year: number;
  countryId?: number;
}

export interface UpdateLeagueDto {
  name?: string;
  isActive?: boolean;
}
