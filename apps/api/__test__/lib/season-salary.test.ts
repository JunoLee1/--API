import { getSeasonPlayerSalary, getSeasonStaffSalary } from "../../src/lib/season-salary";

const seasonRow = {
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-12-31"),
};

const makePrisma = (overrides: Record<string, unknown> = {}) =>
  ({
    season: { findUnique: jest.fn().mockResolvedValue(seasonRow) },
    contract: { findMany: jest.fn().mockResolvedValue([]) },
    staffSalary: { findMany: jest.fn().mockResolvedValue([]) },
    payrollRun: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { grossPay: 0 } }),
    },
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("getSeasonPlayerSalary", () => {
  it("returns 0 when no contracts", async () => {
    expect(await getSeasonPlayerSalary(makePrisma(), 1)).toBe(0);
  });

  it("returns 0 when season not found", async () => {
    const p = makePrisma({ season: { findUnique: jest.fn().mockResolvedValue(null) } });
    expect(await getSeasonPlayerSalary(p, 1)).toBe(0);
  });

  it("overlaps contract with season correctly (full year)", async () => {
    const p = makePrisma({
      contract: {
        findMany: jest.fn().mockResolvedValue([
          {
            salary: 120_000_000,
            startDate: new Date("2026-01-01"),
            endDate: new Date("2026-12-31"),
          },
        ]),
      },
    });
    const v = await getSeasonPlayerSalary(p, 1);
    // full year overlap → 120M (allow ±2M for 30.44 day/month approximation)
    expect(v).toBeGreaterThan(118_000_000);
    expect(v).toBeLessThan(122_000_000);
  });
});

describe("getSeasonStaffSalary", () => {
  it("planned mode uses StaffSalary + allowances", async () => {
    const p = makePrisma({
      staffSalary: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            baseSalary: 60_000_000,
            effectiveFrom: new Date("2026-01-01"),
            effectiveTo: null,
            allowances: [{ amount: 200_000 }], // monthly
          },
        ]),
      },
    });
    const v = await getSeasonStaffSalary(p, 1, "planned");
    // 60M annual + 200k * 12 = 62.4M (±1.5M tolerance)
    expect(v).toBeGreaterThan(61_000_000);
    expect(v).toBeLessThan(63_500_000);
  });

  it("actual mode uses PayrollRun sum (CONFIRMED status)", async () => {
    const p = makePrisma({
      payrollRun: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { grossPay: 30_000_000 } }),
      },
      staffSalary: { findMany: jest.fn().mockResolvedValue([]) }, // fallback anchor
    });
    const v = await getSeasonStaffSalary(p, 1, "actual");
    expect(v).toBe(30_000_000);
  });

  it("actual mode falls back to planned when PayrollRun sum is null", async () => {
    const p = makePrisma({
      payrollRun: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { grossPay: null } }),
      },
      staffSalary: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            baseSalary: 60_000_000,
            effectiveFrom: new Date("2026-01-01"),
            effectiveTo: null,
            allowances: [],
          },
        ]),
      },
    });
    const v = await getSeasonStaffSalary(p, 1, "actual");
    expect(v).toBeGreaterThan(59_000_000);
  });
});
