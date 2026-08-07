import { LeagueLevel, Confederation } from "../generated/enums";

export interface CreateLeagueDto {
  name: string;
  level: LeagueLevel;
  year: number;
  countryId?: number;
  confederation?: Confederation;
}

export interface UpdateLeagueDto {
  name?: string;
  isActive?: boolean;
  countryId?: number | null;
  confederation?: Confederation | null;
}
