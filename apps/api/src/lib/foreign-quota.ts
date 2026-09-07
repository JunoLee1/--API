import { LeagueLevel } from "../generated/enums";

export const FOREIGN_QUOTA: Partial<Record<LeagueLevel, number>> = {
  [LeagueLevel.K_LEAGUE_1]: 5,
  [LeagueLevel.K_LEAGUE_2]: 4,
};

export function getForeignQuota(leagueLevel: LeagueLevel | null | undefined): number {
  if (!leagueLevel) return Infinity;
  return FOREIGN_QUOTA[leagueLevel] ?? Infinity;
}
