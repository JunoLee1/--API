export type PositionGroup = "FWD" | "MID" | "DEF" | "GK";

export const POSITION_GROUP: Record<string, PositionGroup> = {
  STRIKER: "FWD",
  SHADOW_STRIKER: "FWD",
  WINGER: "FWD",
  CENTRAL_ATTACK_MIDFIELDER: "FWD",
  RIGHT_ATTACK_MIDFIELDER: "FWD",
  LEFT_ATTACK_MIDFIELDER: "FWD",
  CENTRAL_DEFENSIVE_MIDFIELDER: "MID",
  LEFT_DEFENSIVE_MIDFIELDER: "MID",
  RIGHT_DEFENSIVE_MIDFIELDER: "MID",
  CENTER_BACK: "DEF",
  LEFT_WING_BACK: "DEF",
  RIGHT_WING_BACK: "DEF",
  LEFT_FULL_BACK: "DEF",
  RIGHT_FULL_BACK: "DEF",
  GOALKEEPER: "GK",
};

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v));
}

function scale(value: number | null | undefined, max: number): number {
  if (value == null) return 0;
  return clamp((value / max) * 100);
}

type StatRow = {
  xG?: number | null;
  xA?: number | null;
  goals?: number | null;
  assists?: number | null;
  sprint?: number | null;
  clearCutChanceRate?: number | null;
  passAccuracy?: number | null;
  penaltyConversionRate?: number | null;
  freeKickConversionRate?: number | null;
  tackleSuccessRate?: number | null;
  interceptions?: number | null;
  clearances?: number | null;
  aerialDuelSuccessRate?: number | null;
  crossesCompleted?: number | null;
  saves?: number | null;
  shotsAllowed?: number | null;
};

export function computeRadarScores(
  position: string,
  avg: StatRow,
  teamAvg: StatRow | null,
): Record<string, number> {
  const group = POSITION_GROUP[position] ?? "MID";

  switch (group) {
    case "FWD":
      return {
        shooting: clamp(scale(avg.xG, 1.5) * 0.5 + scale(avg.goals, 10) * 0.5),
        creation: clamp(scale(avg.xA, 1.0) * 0.5 + scale(avg.assists, 8) * 0.5),
        speed: scale(avg.sprint, 36),
        chance: scale(avg.clearCutChanceRate, 1.0),
        passing: scale(avg.passAccuracy, 100),
        setpiece: clamp(
          scale(avg.penaltyConversionRate, 1.0) * 0.5 +
          scale(avg.freeKickConversionRate, 1.0) * 0.5,
        ),
      };
    case "MID":
      return {
        passing: scale(avg.passAccuracy, 100),
        creation: clamp(scale(avg.xA, 1.0) * 0.5 + scale(avg.assists, 8) * 0.5),
        defending: clamp(
          scale(avg.tackleSuccessRate, 100) * 0.5 +
          scale(avg.interceptions, 5) * 0.5,
        ),
        speed: scale(avg.sprint, 36),
        shooting: clamp(scale(avg.xG, 1.5) * 0.5 + scale(avg.goals, 10) * 0.5),
        setpiece: scale(avg.freeKickConversionRate, 1.0),
      };
    case "DEF":
      return {
        tackling: scale(avg.tackleSuccessRate, 100),
        interception: scale(avg.interceptions, 5),
        clearing: scale(avg.clearances, 8),
        aerial: scale(avg.aerialDuelSuccessRate, 1.0),
        passing: scale(avg.passAccuracy, 100),
        speed: scale(avg.sprint, 36),
      };
    case "GK": {
      const saveRate =
        avg.saves != null && avg.shotsAllowed != null
          ? clamp(((avg.saves - avg.shotsAllowed) / Math.max(avg.saves, 1)) * 100 + 50)
          : 0;
      return {
        saving: saveRate,
        passing: scale(avg.passAccuracy, 100),
        distribution: scale(avg.crossesCompleted, 5),
        shotStopping: scale(avg.saves, 8),
        goalsConceded: avg.shotsAllowed != null ? clamp(100 - avg.shotsAllowed * 10) : 0,
        setpiece: scale(avg.freeKickConversionRate, 1.0),
      };
    }
    default:
      return {};
  }
}

export function computeTags(
  scores: Record<string, number>,
  teamPercentiles: Record<string, number> | null,
): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const [axis, score] of Object.entries(scores)) {
    const inTopQuartile = teamPercentiles ? (teamPercentiles[axis] ?? 0) >= 75 : true;
    const inBottomQuartile = teamPercentiles ? (teamPercentiles[axis] ?? 100) <= 25 : true;

    if (score >= 70 && inTopQuartile) strengths.push(axis);
    if (score <= 40 || (score <= 60 && inBottomQuartile)) weaknesses.push(axis);
  }

  return { strengths, weaknesses };
}

export async function getPlayerRadarData(
  position: string,
  matchStats: StatRow[],
) {
  if (matchStats.length === 0) return null;

  const avg: StatRow = {};
  const keys: (keyof StatRow)[] = [
    "xG", "xA", "goals", "assists", "sprint", "clearCutChanceRate",
    "passAccuracy", "penaltyConversionRate", "freeKickConversionRate",
    "tackleSuccessRate", "interceptions", "clearances",
    "aerialDuelSuccessRate", "crossesCompleted", "saves", "shotsAllowed",
  ];

  for (const key of keys) {
    const vals = matchStats.map((s) => s[key]).filter((v): v is number => v != null);
    (avg as any)[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  const scores = computeRadarScores(position, avg, null);
  const tags = computeTags(scores, null);

  return { scores, ...tags };
}
