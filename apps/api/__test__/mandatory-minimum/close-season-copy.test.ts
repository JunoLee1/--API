import { describe, test, expect, jest } from "@jest/globals";
import { createDraftForNextSeason } from "../../src/budget-plan/draft";
import type { PrismaClient } from "../../src/generated/client";
import type { BudgetAutomationService } from "../../src/budget-automation/budget-automation.service";
import type { ExpenseCategoryService } from "../../src/expense-category/expense-category.service";

type Prisma = Pick<PrismaClient, "season" | "financialReport" | "budgetCategoryPlan" | "budgetTier">;

/**
 * #448 검증: closeSeason → createDraftForNextSeason 이 이전 시즌 categoryId → mandatoryMinimum 을 복사한다.
 * 이전 시즌에 없는 신규 카테고리는 0 fallback (grill Q3).
 */
const makePrismaMock = (opts: {
  closedEndDate?: Date | null;
  nextSeason?: { id: number } | null;
  prevReport?: { id: number } | null;
  prevPlans?: { categoryId: number; mandatoryMinimum: number }[];
}): Prisma & {
  __createManyCalls: any[];
} => {
  const createManyCalls: any[] = [];
  const findUniqueImpl = jest.fn().mockImplementation(({ where }: any) => {
    // FinancialReport.findUnique is called both:
    //   1) with seasonId=nextSeason.id (existing check)
    //   2) with seasonId=closedSeasonId (loadPreviousMinimums)
    if (opts.nextSeason && where.seasonId === opts.nextSeason.id) {
      return Promise.resolve(null); // no existing report for next
    }
    if (opts.prevReport && opts.closedEndDate) {
      // Assume the closed seasonId is the same as the caller passed
      return Promise.resolve(opts.prevReport);
    }
    return Promise.resolve(null);
  });

  return {
    season: {
      findUnique: jest.fn().mockResolvedValue(
        opts.closedEndDate ? { endDate: opts.closedEndDate } : null,
      ),
      findFirst: jest.fn().mockResolvedValue(opts.nextSeason ?? null),
    } as any,
    financialReport: {
      findUnique: findUniqueImpl,
      upsert: jest.fn().mockImplementation(({ where, create }: any) =>
        Promise.resolve({ id: 100, seasonId: where.seasonId, ...create }),
      ),
      update: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({ id: where.id, planStatus: "DRAFT" }),
      ),
    } as any,
    budgetCategoryPlan: {
      createMany: jest.fn().mockImplementation((args: any) => {
        createManyCalls.push(args);
        return Promise.resolve({ count: args.data.length });
      }),
      findMany: jest.fn().mockImplementation(({ where, select: _select }: any) => {
        const financialReportId = where.financialReportId;
        // loadPreviousMinimums 는 prev report.id 로 조회 → prevPlans 반환
        if (opts.prevReport && financialReportId === opts.prevReport.id) {
          return Promise.resolve(opts.prevPlans ?? []);
        }
        // draft 내부에서 createMany 이후 plans 재조회 (categoryId, mandatoryMinimum select)
        // categoryEntries 는 code=MEDICAL(id=1), MEAL(id=2)
        return Promise.resolve([
          { id: 201, financialReportId, categoryId: 1, mandatoryMinimum: opts.prevPlans?.find(p => p.categoryId === 1)?.mandatoryMinimum ?? 0 },
          { id: 202, financialReportId, categoryId: 2, mandatoryMinimum: opts.prevPlans?.find(p => p.categoryId === 2)?.mandatoryMinimum ?? 0 },
        ]);
      }),
    } as any,
    budgetTier: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    } as any,
    __createManyCalls: createManyCalls,
  };
};

const makeBudgetAutomationMock = (): BudgetAutomationService =>
  ({
    preview: jest.fn().mockResolvedValue({
      revenue: { total: 0, byCategory: {} },
      expense: {
        total: 500,
        byCategory: {
          MEDICAL: { predicted: 300, cagr: 0.05, dataPoints: 3 },
          MEAL: { predicted: 200, cagr: 0.02, dataPoints: 3 },
        },
      },
      parameters: {
        targetSeasonId: 5,
        lookback: 3,
        inflation: 0.03,
        revenueGoal: "MAINTAIN",
        expenseGoal: "MAINTAIN",
        categoryOverrides: {},
        seasonsUsed: 3,
      },
    }),
  }) as any;

const makeCategoryServiceMock = (): ExpenseCategoryService =>
  ({
    resolveCategoryId: jest.fn().mockImplementation((code: string) => {
      const map: Record<string, number> = { MEDICAL: 1, MEAL: 2 };
      const id = map[code];
      if (!id) throw new Error(`UNKNOWN_CATEGORY_CODE: ${code}`);
      return Promise.resolve(id);
    }),
  }) as any;

describe("#448: createDraftForNextSeason copies mandatoryMinimum from previous season", () => {
  test("이전 시즌에 값이 있으면 새 plan 에 이월 (같은 categoryId 매칭)", async () => {
    const prisma = makePrismaMock({
      closedEndDate: new Date("2026-05-31"),
      nextSeason: { id: 5 },
      prevReport: { id: 50 },
      prevPlans: [
        { categoryId: 1, mandatoryMinimum: 500_000 }, // MEDICAL 이월
        { categoryId: 2, mandatoryMinimum: 300_000 }, // MEAL 이월
      ],
    });

    await createDraftForNextSeason(
      prisma as unknown as PrismaClient,
      makeBudgetAutomationMock(),
      makeCategoryServiceMock(),
      1,
    );

    const create = prisma.__createManyCalls[0];
    const mm = new Map(create.data.map((d: any) => [d.categoryId, d.mandatoryMinimum]));
    expect(mm.get(1)).toBe(500_000);
    expect(mm.get(2)).toBe(300_000);
  });

  test("이전 시즌에 없는 신규 카테고리 → 0 fallback (grill Q3)", async () => {
    const prisma = makePrismaMock({
      closedEndDate: new Date("2026-05-31"),
      nextSeason: { id: 5 },
      prevReport: { id: 50 },
      prevPlans: [
        { categoryId: 1, mandatoryMinimum: 500_000 }, // MEDICAL 이월
        // MEAL 은 새 카테고리 (이전에 없음) → 0
      ],
    });

    await createDraftForNextSeason(
      prisma as unknown as PrismaClient,
      makeBudgetAutomationMock(),
      makeCategoryServiceMock(),
      1,
    );

    const create = prisma.__createManyCalls[0];
    const mm = new Map(create.data.map((d: any) => [d.categoryId, d.mandatoryMinimum]));
    expect(mm.get(1)).toBe(500_000);
    expect(mm.get(2)).toBe(0);
  });

  test("이전 시즌 FinancialReport 없음 → 전체 0 fallback", async () => {
    const prisma = makePrismaMock({
      closedEndDate: new Date("2026-05-31"),
      nextSeason: { id: 5 },
      prevReport: null,
    });

    await createDraftForNextSeason(
      prisma as unknown as PrismaClient,
      makeBudgetAutomationMock(),
      makeCategoryServiceMock(),
      1,
    );

    const create = prisma.__createManyCalls[0];
    for (const d of create.data as any[]) {
      expect(d.mandatoryMinimum).toBe(0);
    }
  });
});
