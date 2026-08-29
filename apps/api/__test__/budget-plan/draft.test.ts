import { createDraftForNextSeason } from "../../src/budget-plan/draft";
import type { PrismaClient } from "../../src/generated/client";
import type { BudgetAutomationService } from "../../src/budget-automation/budget-automation.service";
import type { ExpenseCategoryService } from "../../src/expense-category/expense-category.service";

type Prisma = Pick<PrismaClient, "season" | "financialReport" | "budgetCategoryPlan" | "budgetTier">;

const makePrismaMock = (opts: {
  closedEndDate?: Date | null;
  nextSeason?: { id: number } | null;
  existingReport?: { id: number; planStatus?: string } | null;
}): Prisma => ({
  season: {
    findUnique: jest.fn().mockResolvedValue(
      opts.closedEndDate ? { endDate: opts.closedEndDate } : null,
    ),
    findFirst: jest.fn().mockResolvedValue(opts.nextSeason ?? null),
  } as any,
  financialReport: {
    findUnique: jest.fn().mockResolvedValue(opts.existingReport ?? null),
    upsert: jest.fn().mockImplementation(({ where, create }: any) =>
      Promise.resolve({ id: 100, seasonId: where.seasonId, ...create }),
    ),
    update: jest.fn().mockImplementation(({ where }: any) =>
      Promise.resolve({ id: where.id, planStatus: "DRAFT" }),
    ),
  } as any,
  budgetCategoryPlan: {
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockImplementation(({ where }: any) => {
      const financialReportId = where.financialReportId;
      return Promise.resolve([
        { id: 201, financialReportId, categoryId: 1, mandatoryMinimum: 0 },
        { id: 202, financialReportId, categoryId: 2, mandatoryMinimum: 0 },
      ]);
    }),
  } as any,
  budgetTier: {
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  } as any,
});

const makeBudgetAutomationMock = (
  overrides: Partial<BudgetAutomationService> = {},
): BudgetAutomationService =>
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
    ...overrides,
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

describe("createDraftForNextSeason", () => {
  test("closed season 없음 → null 반환", async () => {
    const prisma = makePrismaMock({ closedEndDate: null });
    const result = await createDraftForNextSeason(
      prisma as PrismaClient,
      makeBudgetAutomationMock(),
      makeCategoryServiceMock(),
      999,
    );
    expect(result).toBeNull();
  });

  test("다음 시즌 없음 → null 반환", async () => {
    const prisma = makePrismaMock({
      closedEndDate: new Date("2026-05-31"),
      nextSeason: null,
    });
    const result = await createDraftForNextSeason(
      prisma as PrismaClient,
      makeBudgetAutomationMock(),
      makeCategoryServiceMock(),
      1,
    );
    expect(result).toBeNull();
  });

  test("다음 시즌 있음 → planStatus=DRAFT + Basic 티어 생성", async () => {
    const prisma = makePrismaMock({
      closedEndDate: new Date("2026-05-31"),
      nextSeason: { id: 5 },
    });
    const budgetAuto = makeBudgetAutomationMock();
    const categoryService = makeCategoryServiceMock();

    const result = await createDraftForNextSeason(
      prisma as PrismaClient,
      budgetAuto,
      categoryService,
      1,
    );

    expect(result).toMatchObject({ nextSeasonId: 5, draftReportId: 100 });
    expect(budgetAuto.preview).toHaveBeenCalledWith(
      expect.objectContaining({ targetSeasonId: 5, revenueGoal: "MAINTAIN", expenseGoal: "MAINTAIN" }),
    );
    expect(prisma.financialReport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seasonId: 5 },
        create: expect.objectContaining({ seasonId: 5, planStatus: "DRAFT" }),
        update: expect.objectContaining({ planStatus: "DRAFT" }),
      }),
    );
    expect(prisma.budgetCategoryPlan.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ financialReportId: 100, categoryId: 1 }),
          expect.objectContaining({ financialReportId: 100, categoryId: 2 }),
        ]),
      }),
    );
    expect(prisma.budgetTier.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ name: "Basic", cost: 300, isSelected: true }),
          expect.objectContaining({ name: "Basic", cost: 200, isSelected: true }),
        ]),
      }),
    );
  });

  test("기존 draft 있음 → 스킵 (재생성 안 함)", async () => {
    const prisma = makePrismaMock({
      closedEndDate: new Date("2026-05-31"),
      nextSeason: { id: 5 },
      existingReport: { id: 50, planStatus: "AWAITING_REVIEW" },
    });
    const budgetAuto = makeBudgetAutomationMock();

    const result = await createDraftForNextSeason(
      prisma as PrismaClient,
      budgetAuto,
      makeCategoryServiceMock(),
      1,
    );

    expect(result).toBeNull();
    expect(budgetAuto.preview).not.toHaveBeenCalled();
    expect(prisma.financialReport.upsert).not.toHaveBeenCalled();
  });

  test("preview 실패 → 예외 propagate (best-effort 는 caller 담당)", async () => {
    const prisma = makePrismaMock({
      closedEndDate: new Date("2026-05-31"),
      nextSeason: { id: 5 },
    });
    const budgetAuto = makeBudgetAutomationMock({
      preview: jest.fn().mockRejectedValue(new Error("NO_HISTORICAL_DATA")),
    } as any);

    await expect(
      createDraftForNextSeason(prisma as PrismaClient, budgetAuto, makeCategoryServiceMock(), 1),
    ).rejects.toThrow("NO_HISTORICAL_DATA");
  });
});
