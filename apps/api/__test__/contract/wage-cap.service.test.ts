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

const makeService = (
  season: unknown,
  contracts: { salary: number }[],
  financialReport?: { totalRevenue: number } | null,
) => {
  const prisma = {
    season: { findFirst: jest.fn().mockResolvedValue(season) },
    contract: { findMany: jest.fn().mockResolvedValue(contracts) },
    financialReport: { findUnique: jest.fn().mockResolvedValue(financialReport ?? null) },
  };
  return new WageCapService(prisma as any);
};

describe("WageCapService.check — FIXED", () => {
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
    expect(await svc.check(3_000_000)).toEqual({ status: "OK" });
  });

  it("returns OK when projected equals cap exactly", async () => {
    const svc = makeService(makeSeason(), [{ salary: 7_000_000 }]);
    expect(await svc.check(3_000_000)).toEqual({ status: "OK" });
  });

  it("returns WARNING when exactly 10% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 8_000_000 }]);
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBe(10);
  });

  it("returns WARNING for 5% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 7_500_000 }]);
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBe(5);
  });

  it("returns BLOCKED when just over 10% (10.1%)", async () => {
    const svc = makeService(makeSeason(), [{ salary: 8_010_000 }]);
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("BLOCKED");
    expect((result as { status: "BLOCKED"; percentOver: number }).percentOver).toBeCloseTo(10.1, 1);
  });

  it("returns BLOCKED when >10% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 9_000_000 }]);
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("BLOCKED");
    expect((result as { status: "BLOCKED"; percentOver: number }).percentOver).toBe(20);
  });
});

describe("WageCapService.check — RATIO", () => {
  it("returns OK when no financial report exists", async () => {
    const svc = makeService(makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }), [], null);
    expect(await svc.check(999_999_999)).toEqual({ status: "OK" });
  });

  it("returns OK when projected is under RATIO cap", async () => {
    // revenue=10M, ratio=0.5 → cap=5M; existing=2M, new=2M → projected=4M → OK
    const svc = makeService(
      makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }),
      [{ salary: 2_000_000 }],
      { totalRevenue: 10_000_000 },
    );
    expect(await svc.check(2_000_000)).toEqual({ status: "OK" });
  });

  it("returns WARNING for RATIO when 5% over cap", async () => {
    // revenue=10M, ratio=0.5 → cap=5M; existing=2.75M, new=2.5M → projected=5.25M → 5% over
    const svc = makeService(
      makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }),
      [{ salary: 2_750_000 }],
      { totalRevenue: 10_000_000 },
    );
    const result = await svc.check(2_500_000);
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBe(5);
  });

  it("returns BLOCKED for RATIO when 20% over cap", async () => {
    // revenue=10M, ratio=0.5 → cap=5M; existing=4M, new=2M → projected=6M → 20% over
    const svc = makeService(
      makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }),
      [{ salary: 4_000_000 }],
      { totalRevenue: 10_000_000 },
    );
    const result = await svc.check(2_000_000);
    expect(result.status).toBe("BLOCKED");
    expect((result as { status: "BLOCKED"; percentOver: number }).percentOver).toBe(20);
  });
});
