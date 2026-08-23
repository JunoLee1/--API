import { KnapsackService } from "../../src/budget/knapsack.service";

describe("KnapsackService.solve", () => {
  const svc = new KnapsackService();

  it("returns empty when capacity is 0", () => {
    const result = svc.solve({
      capacity: 0,
      groups: [{ categoryPlanId: 1, category: "SCOUTING", tiers: [{ tierId: 1, cost: 100, value: 5 }] }],
    });
    expect(result.selectedTiers).toHaveLength(0);
    expect(result.totalCost).toBe(0);
    expect(result.totalValue).toBe(0);
  });

  it("returns empty when no groups", () => {
    const result = svc.solve({ capacity: 1_000_000, groups: [] });
    expect(result.selectedTiers).toHaveLength(0);
  });

  it("selects the only tier that fits", () => {
    const result = svc.solve({
      capacity: 500_000,
      groups: [{
        categoryPlanId: 1,
        category: "SCOUTING",
        tiers: [
          { tierId: 1, cost: 300_000, value: 5 },
          { tierId: 2, cost: 600_000, value: 9 },
        ],
      }],
    });
    expect(result.selectedTiers).toHaveLength(1);
    expect(result.selectedTiers[0].tierId).toBe(1);
    expect(result.totalCost).toBe(300_000);
    expect(result.totalValue).toBe(5);
  });

  it("selects higher-value tier when both fit", () => {
    const result = svc.solve({
      capacity: 1_000_000,
      groups: [{
        categoryPlanId: 1,
        category: "SCOUTING",
        tiers: [
          { tierId: 1, cost: 300_000, value: 5 },
          { tierId: 2, cost: 600_000, value: 9 },
        ],
      }],
    });
    expect(result.selectedTiers[0].tierId).toBe(2);
    expect(result.totalValue).toBe(9);
  });

  it("picks optimal combination across two groups", () => {
    // capacity: 700_000
    // Group A: tier1(300k,val5) tier2(500k,val8)
    // Group B: tier3(200k,val6) tier4(400k,val7)
    // A2+B3 = 500+200=700, value=14  ← optimal
    const result = svc.solve({
      capacity: 700_000,
      groups: [
        {
          categoryPlanId: 1, category: "SCOUTING",
          tiers: [
            { tierId: 1, cost: 300_000, value: 5 },
            { tierId: 2, cost: 500_000, value: 8 },
          ],
        },
        {
          categoryPlanId: 2, category: "TRAVEL",
          tiers: [
            { tierId: 3, cost: 200_000, value: 6 },
            { tierId: 4, cost: 400_000, value: 7 },
          ],
        },
      ],
    });
    expect(result.totalCost).toBe(700_000);
    expect(result.totalValue).toBe(14);
    expect(result.selectedTiers.map((t) => t.tierId).sort()).toEqual([2, 3]);
  });

  it("skips group when no tier fits", () => {
    const result = svc.solve({
      capacity: 100_000,
      groups: [{
        categoryPlanId: 1,
        category: "SCOUTING",
        tiers: [{ tierId: 1, cost: 500_000, value: 10 }],
      }],
    });
    expect(result.selectedTiers).toHaveLength(0);
    expect(result.totalValue).toBe(0);
  });

  it("handles 6 groups correctly (real-world scale)", () => {
    const groups = [
      { categoryPlanId: 1, category: "MEDICAL",   tiers: [{ tierId: 1, cost: 3_000_000, value: 10 }, { tierId: 2, cost: 5_000_000, value: 15 }] },
      { categoryPlanId: 2, category: "MEAL",       tiers: [{ tierId: 3, cost: 2_000_000, value: 7  }, { tierId: 4, cost: 3_000_000, value: 9  }] },
      { categoryPlanId: 3, category: "TRAVEL",     tiers: [{ tierId: 5, cost: 4_000_000, value: 8  }, { tierId: 6, cost: 7_000_000, value: 12 }] },
      { categoryPlanId: 4, category: "SPORTS_EQUIPMENT",  tiers: [{ tierId: 7, cost: 2_000_000, value: 6  }] },
      { categoryPlanId: 5, category: "SCOUTING",   tiers: [{ tierId: 8, cost: 3_000_000, value: 9  }, { tierId: 9, cost: 6_000_000, value: 14 }] },
      { categoryPlanId: 6, category: "YOUTH",      tiers: [{ tierId: 10, cost: 2_000_000, value: 5 }] },
    ];
    const result = svc.solve({ capacity: 20_000_000, groups });
    expect(result.totalCost).toBeLessThanOrEqual(20_000_000);
    expect(result.selectedTiers.length).toBeGreaterThan(0);
  });
});
