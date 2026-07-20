import { describe, test, expect } from "@jest/globals";
import { computeRadarScores, computeTags, POSITION_GROUP } from "../../src/player/radar.service";

const fwdStats = {
  xG: 0.8, goals: 5, xA: 0.4, assists: 3,
  sprint: 32.1, clearCutChanceRate: 0.75,
  passAccuracy: 78, penaltyConversionRate: 1.0,
  freeKickConversionRate: 0.5,
};

describe("computeRadarScores - FWD", () => {
  test("공격수 6축 점수 반환 (0-100 범위)", () => {
    const scores = computeRadarScores("striker", fwdStats as any, null);
    expect(Object.keys(scores)).toHaveLength(6);
    Object.values(scores).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe("computeTags", () => {
  test("점수 >= 70이면 강점", () => {
    const scores = { shooting: 80, passing: 60, speed: 45, chance: 70, creation: 55, setpiece: 30 };
    const tags = computeTags(scores, null);
    expect(tags.strengths).toContain("shooting");
  });

  test("점수 <= 40이면 약점", () => {
    const scores = { shooting: 80, passing: 60, speed: 45, chance: 70, creation: 55, setpiece: 30 };
    const tags = computeTags(scores, null);
    expect(tags.weaknesses).toContain("setpiece");
  });
});

describe("POSITION_GROUP", () => {
  test("striker → FWD", () => expect(POSITION_GROUP["striker"]).toBe("FWD"));
  test("centralDefensiveMiddleFielder → MID", () => expect(POSITION_GROUP["centralDefensiveMiddleFielder"]).toBe("MID"));
  test("centerBack → DEF", () => expect(POSITION_GROUP["centerBack"]).toBe("DEF"));
  test("goalKeeper → GK", () => expect(POSITION_GROUP["goalKeeper"]).toBe("GK"));
});
