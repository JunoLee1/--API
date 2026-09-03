import {
  computeSigningBonusAnnual,
  computeSigningBonusForSeason,
} from "../../src/lib/signing-bonus";

const contract = (
  signingBonus: number,
  startDate: string,
  endDate: string,
) => ({
  signingBonus: BigInt(signingBonus),
  startDate: new Date(startDate),
  endDate: new Date(endDate),
});

describe("computeSigningBonusAnnual", () => {
  it("amortizes over 3-year contract duration", () => {
    const c = contract(90_000_000, "2024-01-01", "2026-12-31");
    // ceil(3 years) = 3 → 30M/year
    expect(computeSigningBonusAnnual(c)).toBe(30_000_000);
  });

  it("rounds up partial years (2.5y → ceil=3)", () => {
    const c = contract(90_000_000, "2024-01-01", "2026-06-30");
    // duration ≈ 2.5 years → ceil = 3 → 30M/year
    expect(computeSigningBonusAnnual(c)).toBe(30_000_000);
  });

  it("uses 1 as minimum divisor for sub-1-year contracts", () => {
    const c = contract(12_000_000, "2026-03-01", "2026-08-31");
    // duration < 1 year → ceil = 1 → 12M/year
    expect(computeSigningBonusAnnual(c)).toBe(12_000_000);
  });

  it("returns 0 when signingBonus is 0", () => {
    const c = contract(0, "2025-01-01", "2027-12-31");
    expect(computeSigningBonusAnnual(c)).toBe(0);
  });
});

describe("computeSigningBonusForSeason", () => {
  const season = { start: new Date("2026-01-01"), end: new Date("2026-12-31") };

  it("returns annual amount when contract fully overlaps with season", () => {
    const c = contract(90_000_000, "2024-01-01", "2026-12-31"); // 3y → 30M/y
    expect(computeSigningBonusForSeason(c, season.start, season.end)).toBe(30_000_000);
  });

  it("returns annual amount when contract partially overlaps (starts mid-season)", () => {
    const c = contract(60_000_000, "2026-06-01", "2028-05-31"); // 2y → 30M/y
    expect(computeSigningBonusForSeason(c, season.start, season.end)).toBe(30_000_000);
  });

  it("returns 0 when contract ends before season starts", () => {
    const c = contract(60_000_000, "2024-01-01", "2025-12-31");
    expect(computeSigningBonusForSeason(c, season.start, season.end)).toBe(0);
  });

  it("returns 0 when contract starts after season ends", () => {
    const c = contract(60_000_000, "2027-01-01", "2029-12-31");
    expect(computeSigningBonusForSeason(c, season.start, season.end)).toBe(0);
  });

  it("returns 0 when signingBonus is 0", () => {
    const c = contract(0, "2025-01-01", "2027-12-31");
    expect(computeSigningBonusForSeason(c, season.start, season.end)).toBe(0);
  });
});
