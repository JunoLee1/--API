import { createDraftForNextSeason } from "../../src/budget-plan/draft";
import type { PrismaClient } from "../../src/generated/client";

type Prisma = Pick<PrismaClient, "season" | "financialReport" | "budgetCategoryPlan" | "budgetTier">;

const makePrisma = (opts: {
  totalOperatingBudget?: number | null;
  contingencyReserve?: number | null;
  mandatoryMinimums?: Record<number, number>;
  hasExistingReport?: boolean;
}): Prisma => {
  const updates: any[] = [];
  const upserts: any[] = [];
  const budgets = {
    total: opts.totalOperatingBudget ?? 1_000_000,
    contingency: opts.contingencyReserve ?? 100_000,
  };
  const mandatory = opts.mandatoryMinimums ?? { 1: 0, 2: 0 };

  return {
    season: {
      findUnique: jest.fn().mockResolvedValue({ endDate: new Date("2026-05-31") }),
      findFirst: jest.fn().mockResolvedValue({ id: 5 }),
    } as any,
    financialReport: {
      findUnique: jest.fn().mockResolvedValue(
        opts.hasExistingReport ? { id: 100, planStatus: "FINALIZED" } : null,
      ),
      upsert: jest.fn().mockImplementation((args: any) => {
        upserts.push(args);
        return Promise.resolve({
          id: 100,
          seasonId: args.where.seasonId,
          totalOperatingBudget: budgets.total,
          contingencyReserve: budgets.contingency,
          ...args.create,
          planStatus: args.create.planStatus,
        });
      }),
      update: jest.fn().mockImplementation((args: any) => {
        updates.push(args);
        return Promise.resolve({
          id: args.where.id,
          planStatus: args.data.planStatus,
          note: args.data.note ?? null,
        });
      }),
    } as any,
    budgetCategoryPlan: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([
        { id: 201, categoryId: 1, mandatoryMinimum: mandatory[1] ?? 0 },
        { id: 202, categoryId: 2, mandatoryMinimum: mandatory[2] ?? 0 },
      ]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    } as any,
    budgetTier: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    } as any,
    __updates: updates,
    __upserts: upserts,
  } as any;
};

const makeBudgetAuto = (
  maintainCost: number,
  conservativeCost: number = Math.floor(maintainCost * 0.8),
) => {
  return {
    preview: jest.fn().mockImplementation((dto: any) => {
      const isConservative =
        dto.revenueGoal === "CONSERVATIVE" && dto.expenseGoal === "CONSERVATIVE";
      const each = isConservative ? conservativeCost : maintainCost;
      return Promise.resolve({
        revenue: { total: 0, byCategory: {} },
        expense: {
          total: each * 2,
          byCategory: {
            MEDICAL: { predicted: each, cagr: 0, dataPoints: 3 },
            MEAL: { predicted: each, cagr: 0, dataPoints: 3 },
          },
        },
        parameters: {
          targetSeasonId: 5,
          lookback: 3,
          inflation: 0.03,
          revenueGoal: dto.revenueGoal,
          expenseGoal: dto.expenseGoal,
          categoryOverrides: {},
          seasonsUsed: 3,
        },
      });
    }),
  } as any;
};

const makeCategoryService = () =>
  ({
    resolveCategoryId: jest.fn().mockImplementation((code: string) => {
      const map: Record<string, number> = { MEDICAL: 1, MEAL: 2 };
      return Promise.resolve(map[code] ?? 999);
    }),
  }) as any;

describe("createDraftForNextSeason with capacity cascade (#401)", () => {
  test("capacity ≥ 0 (여유) → planStatus=DRAFT, CONSERVATIVE 재시도 없음", async () => {
    const prisma = makePrisma({ totalOperatingBudget: 1_000_000 });
    const budgetAuto = makeBudgetAuto(300_000);

    await createDraftForNextSeason(prisma as PrismaClient, budgetAuto, makeCategoryService(), 1);

    // capacity = 1_000_000 - (300_000 * 2) - 100_000 = 300_000 (양수)
    expect(budgetAuto.preview).toHaveBeenCalledTimes(1);
    expect((prisma as any).__upserts[0].create.planStatus).toBe("DRAFT");
  });

  test("MAINTAIN 결과 capacity < 0 → CONSERVATIVE 재시도 → 성공 → DRAFT", async () => {
    const prisma = makePrisma({ totalOperatingBudget: 700_000 });
    // MAINTAIN: 400_000 each → sum 800_000 + reserve 100_000 = 900_000 > 700_000 (fail)
    // CONSERVATIVE: 320_000 each → sum 640_000 + reserve 100_000 = 740_000 > 700_000 (여전히 fail)
    // 재조정: CONSERVATIVE 250_000 each → sum 500_000 + reserve 100_000 = 600_000 ≤ 700_000 (성공)
    const budgetAuto = makeBudgetAuto(400_000, 250_000);

    const result = await createDraftForNextSeason(
      prisma as PrismaClient,
      budgetAuto,
      makeCategoryService(),
      1,
    );

    expect(budgetAuto.preview).toHaveBeenCalledTimes(2);
    expect(budgetAuto.preview).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ revenueGoal: "MAINTAIN", expenseGoal: "MAINTAIN" }),
    );
    expect(budgetAuto.preview).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ revenueGoal: "CONSERVATIVE", expenseGoal: "CONSERVATIVE" }),
    );
    // CONSERVATIVE 성공 시 planStatus=DRAFT 그대로 (별도 update 불필요)
    expect(result?.planStatus).toBe("DRAFT");
  });

  test("CONSERVATIVE 재시도도 여전히 capacity < 0 → planStatus=CAPACITY_FAILED + note 기록", async () => {
    const prisma = makePrisma({ totalOperatingBudget: 300_000 });
    // MAINTAIN: 400_000 each → 800_000 + 100_000 = 900_000 (fail)
    // CONSERVATIVE: 320_000 each → 640_000 + 100_000 = 740_000 (여전히 fail)
    const budgetAuto = makeBudgetAuto(400_000);

    await createDraftForNextSeason(prisma as PrismaClient, budgetAuto, makeCategoryService(), 1);

    expect(budgetAuto.preview).toHaveBeenCalledTimes(2);
    const lastUpdate = (prisma as any).__updates.at(-1);
    expect(lastUpdate.data.planStatus).toBe("CAPACITY_FAILED");
    expect(lastUpdate.data.note).toMatch(/capacity/i);
    expect(lastUpdate.data.note).toContain("300000");
  });

  test("Basic.cost < mandatoryMinimum → planStatus=CAPACITY_FAILED + note 에 위반 categoryIds", async () => {
    const prisma = makePrisma({
      totalOperatingBudget: 10_000_000,
      mandatoryMinimums: { 1: 500_000, 2: 0 },
    });
    // MAINTAIN Basic = 300_000. category 1 은 mandatoryMinimum=500_000 위반
    const budgetAuto = makeBudgetAuto(300_000);

    await createDraftForNextSeason(prisma as PrismaClient, budgetAuto, makeCategoryService(), 1);

    const lastUpdate = (prisma as any).__updates.at(-1);
    expect(lastUpdate.data.planStatus).toBe("CAPACITY_FAILED");
    expect(lastUpdate.data.note).toMatch(/BASIC_BELOW_MANDATORY_MIN/);
    expect(lastUpdate.data.note).toContain("1");
  });
});
