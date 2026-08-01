import { computeTurnoverRate, computeAttendanceRate, buildPeriod } from "../../src/hr-report/hr-report.service";

describe("computeTurnoverRate", () => {
  it("returns 0 when no departures", () => {
    expect(computeTurnoverRate(0, 30, 30)).toBe(0);
  });

  it("computes rate correctly", () => {
    // 3 departures, avg headcount = (30 + 27) / 2 = 28.5 → 3/28.5*100 ≈ 10.53
    expect(computeTurnoverRate(3, 30, 27)).toBeCloseTo(10.53, 1);
  });

  it("returns 0 when headcount is 0", () => {
    expect(computeTurnoverRate(0, 0, 0)).toBe(0);
  });
});

describe("computeAttendanceRate", () => {
  it("returns 0 when total is 0", () => {
    expect(computeAttendanceRate(0, 0)).toBe(0);
  });

  it("computes rate correctly", () => {
    expect(computeAttendanceRate(90, 100)).toBe(90);
  });

  it("rounds to 1 decimal", () => {
    expect(computeAttendanceRate(1, 3)).toBeCloseTo(33.3, 1);
  });
});

describe("buildPeriod", () => {
  it("builds correct start/end for a month", () => {
    const p = buildPeriod(2026, 7);
    expect(p.start.getUTCFullYear()).toBe(2026);
    expect(p.start.getUTCMonth()).toBe(6); // July = index 6
    expect(p.start.getUTCDate()).toBe(1);
    expect(p.end.getUTCFullYear()).toBe(2026);
    expect(p.end.getUTCMonth()).toBe(6);
    expect(p.end.getUTCDate()).toBe(31);
  });

  it("builds correct end for February leap year", () => {
    const p = buildPeriod(2024, 2);
    expect(p.end.getUTCDate()).toBe(29);
  });
});
