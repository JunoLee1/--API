import { WageCapService } from "../../src/contract/wage-cap.service";

const makeSeason = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  status: "ACTIVE",
  wageCapType: "FIXED",
  wageCapValue: 10_000_000,
  startDate: new Date("2025-01-01"),
  endDate: new Date("2025-12-31"),
  ...overrides,
});

const makeService = (season: unknown, contracts: { salary: number }[]) => {
  const prisma = {
    season: { findFirst: jest.fn().mockResolvedValue(season) },
    contract: { findMany: jest.fn().mockResolvedValue(contracts) },
  };
  return new WageCapService(prisma as any);
};

describe("WageCapService.check", () => {
  it("returns OK when no active season", async () => {
    const svc = makeService(null, []);
    expect(await svc.check(1_000_000)).toEqual({ status: "OK" });
  });

  it("returns OK when season has no wage cap set", async () => {
    const svc = makeService(makeSeason({ wageCapType: null, wageCapValue: null }), []);
    expect(await svc.check(1_000_000)).toEqual({ status: "OK" });
  });

  it("returns OK when projected salary is under cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 5_000_000 }]);
    // 5M existing + 3M new = 8M projected, cap 10M → OK
    expect(await svc.check(3_000_000)).toEqual({ status: "OK" });
  });

  it("returns OK when projected equals cap exactly", async () => {
    const svc = makeService(makeSeason(), [{ salary: 7_000_000 }]);
    // 7M + 3M = 10M = cap → OK
    expect(await svc.check(3_000_000)).toEqual({ status: "OK" });
  });

  it("returns WARNING when exactly 10% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 8_000_000 }]);
    // 8M + 3M = 11M, cap 10M → 10% over → WARNING
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBe(10);
  });

  it("returns WARNING for 5% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 7_500_000 }]);
    // 7.5M + 3M = 10.5M, cap 10M → 5% over → WARNING
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBe(5);
  });

  it("returns BLOCKED when just over 10% (10.1%)", async () => {
    const svc = makeService(makeSeason(), [{ salary: 8_010_000 }]);
    // 8.01M + 3M = 11.01M, cap 10M → 10.1% over → BLOCKED
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("BLOCKED");
    expect((result as { status: "BLOCKED"; percentOver: number }).percentOver).toBeCloseTo(10.1, 1);
  });

  it("returns BLOCKED when >10% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 9_000_000 }]);
    // 9M + 3M = 12M, cap 10M → 20% over → BLOCKED
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("BLOCKED");
    expect((result as { status: "BLOCKED"; percentOver: number }).percentOver).toBe(20);
  });

  it("skips check for RATIO type (Plan C)", async () => {
    const svc = makeService(makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }), []);
    // RATIO requires FinancialReport (Plan C) — always OK for now
    expect(await svc.check(999_999_999)).toEqual({ status: "OK" });
  });
});
