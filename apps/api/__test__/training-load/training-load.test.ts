import { isWeeklyOverload, WEEKLY_LOAD_THRESHOLD } from "../../src/training-load/training-load.service";

describe("isWeeklyOverload", () => {
  it("임계값 미만이면 false", () => {
    expect(isWeeklyOverload(499)).toBe(false);
  });
  it("임계값 정확히 500이면 true", () => {
    expect(isWeeklyOverload(WEEKLY_LOAD_THRESHOLD["DEFAULT"]!)).toBe(true);
  });
  it("임계값 초과이면 true", () => {
    expect(isWeeklyOverload(600)).toBe(true);
  });
  it("0이면 false", () => {
    expect(isWeeklyOverload(0)).toBe(false);
  });
});
