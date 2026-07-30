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
    expect(await svc.check(1_000_000, new Date(), new Date())).toEqual({ status: "OK" });
  });

  it("returns OK when season has no wage cap set", async () => {
    const svc = makeService(makeSeason({ wageCapType: null, wageCapValue: null }), []);
    expect(await svc.check(1_000_000, new Date(), new Date())).toEqual({ status: "OK" });
  });

  it("returns OK when projected salary is under cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 5_000_000 }]);
    expect(await svc.check(3_000_000, new Date(), new Date())).toEqual({ status: "OK" });
  });

  it("returns OK when projected equals cap exactly", async () => {
    const svc = makeService(makeSeason(), [{ salary: 7_000_000 }]);
    expect(await svc.check(3_000_000, new Date(), new Date())).toEqual({ status: "OK" });
  });

  it("returns WARNING when 1-10% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 8_000_000 }]);
    const result = await svc.check(3_000_000, new Date(), new Date());
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBeCloseTo(10, 0);
  });

  it("returns WARNING for 5% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 7_500_000 }]);
    const result = await svc.check(3_000_000, new Date(), new Date());
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBeCloseTo(5, 0);
  });

  it("returns BLOCKED when >10% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 9_000_000 }]);
    const result = await svc.check(3_000_000, new Date(), new Date());
    expect(result.status).toBe("BLOCKED");
    expect((result as { status: "BLOCKED"; percentOver: number }).percentOver).toBeCloseTo(20, 0);
  });

  it("skips check for RATIO type (Plan C)", async () => {
    const svc = makeService(makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }), []);
    expect(await svc.check(999_999_999, new Date(), new Date())).toEqual({ status: "OK" });
  });
});
