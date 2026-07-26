export type PositionGroup = "FWD" | "MID" | "CB" | "DEF" | "GK";

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
  CENTER_BACK: "CB",
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
  passesAttempted?: number | null;
  passesCompleted?: number | null;
  penaltyConversionRate?: number | null;
  freeKickConversionRate?: number | null;
  tackleSuccessRate?: number | null;
  interceptions?: number | null;
  clearances?: number | null;
  aerialDuelSuccessRate?: number | null;
  crossesCompleted?: number | null;
  saves?: number | null;
  shotsAllowed?: number | null;
  ballRecoveries?: number | null;
  turnovers?: number | null;
  longPassesAttempted?: number | null;
  longPassesCompleted?: number | null;
};


export function computeRadarScores(
  position: string,
  avg: StatRow,
  teamAvg: StatRow | null,
): Record<string, number> {
  const group = POSITION_GROUP[position] ?? "MID";
  // passAccuracy를 DB 필드가 아닌 passesAttempted/Completed로 직접 계산
  const computedPassAcc =
    avg.passesAttempted != null && avg.passesAttempted > 0
      ? ((avg.passesCompleted ?? 0) / avg.passesAttempted) * 100
      : avg.passAccuracy ?? null;
  const passing = clamp(scale(computedPassAcc, 100) - clamp(scale(avg.turnovers, 6) * 35));
  const stability = clamp(scale(avg.ballRecoveries, 10) * 100 * 0.4 + clamp(100 - scale(avg.turnovers, 6) * 100) * 0.6);

  // CB 전용: 롱패스 정확도(60%) + 단패스(40%) → 데이터 없으면 일반 passing fallback
  const longPassAcc =
    avg.longPassesAttempted != null && avg.longPassesAttempted > 0
      ? clamp(((avg.longPassesCompleted ?? 0) / avg.longPassesAttempted) * 100)
      : null;
  const cbDistribution =
    longPassAcc != null
      ? clamp(scale(longPassAcc, 100) * 0.6 + scale(avg.passAccuracy, 100) * 0.4)
      : passing;

  switch (group) {
    case "FWD":
      return {
        shooting: clamp(scale(avg.xG, 1.5) * 0.5 + scale(avg.goals, 10) * 0.5),
        creation: clamp(scale(avg.xA, 1.0) * 0.5 + scale(avg.assists, 8) * 0.5),
        speed: scale(avg.sprint, 36),
        chance: scale(avg.clearCutChanceRate, 1.0),
        passing,
        stability,
        setpiece: clamp(
          scale(avg.penaltyConversionRate, 1.0) * 0.5 +
          scale(avg.freeKickConversionRate, 1.0) * 0.5,
        ),
      };
    case "MID":
      return {
        passing,
        creation: clamp(scale(avg.xA, 1.0) * 0.5 + scale(avg.assists, 8) * 0.5),
        defending: clamp(
          scale(avg.tackleSuccessRate, 100) * 0.5 +
          scale(avg.interceptions, 5) * 0.5,
        ),
        speed: scale(avg.sprint, 36),
        shooting: clamp(scale(avg.xG, 1.5) * 0.5 + scale(avg.goals, 10) * 0.5),
        stability,
        setpiece: scale(avg.freeKickConversionRate, 1.0),
      };
    case "CB":
      return {
        tackling: scale(avg.tackleSuccessRate, 100),
        interception: scale(avg.interceptions, 5),
        clearing: scale(avg.clearances, 8),
        aerial: scale(avg.aerialDuelSuccessRate, 1.0),
        distribution: cbDistribution,
        stability,
        speed: scale(avg.sprint, 36),
      };
    case "DEF":
      return {
        tackling: scale(avg.tackleSuccessRate, 100),
        interception: scale(avg.interceptions, 5),
        clearing: scale(avg.clearances, 8),
        aerial: scale(avg.aerialDuelSuccessRate, 1.0),
        passing,
        stability,
        speed: scale(avg.sprint, 36),
      };
    case "GK": {
      const saveRate =
        avg.saves != null && avg.shotsAllowed != null
          ? clamp(((avg.saves - avg.shotsAllowed) / Math.max(avg.saves, 1)) * 100 + 50)
          : 0;
      return {
        saving: saveRate,
        passing,
        stability,
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
    "passesAttempted", "passesCompleted",
    "penaltyConversionRate", "freeKickConversionRate",
    "tackleSuccessRate", "interceptions", "clearances",
    "aerialDuelSuccessRate", "crossesCompleted", "saves", "shotsAllowed",
    "ballRecoveries", "turnovers",
    "longPassesAttempted", "longPassesCompleted",
  ];

  for (const key of keys) {
    const vals = matchStats.map((s) => s[key]).filter((v): v is number => v != null);
    (avg as any)[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  const scores = computeRadarScores(position, avg, null);
  const tags = computeTags(scores, null);

  return { scores, ...tags };
}
