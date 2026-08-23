import { FinancialReportService } from "../../src/financial-report/financial-report.service";
import { KnapsackService } from "../../src/budget/knapsack.service";
import type { FinancialReportRepository } from "../../src/financial-report/financial-report.repo";
import type { ExpenseCategoryService } from "../../src/expense-category/expense-category.service";

// Fixed test category ids matching the seed data.
const CAT_IDS: Record<string, number> = {
  MEDICAL: 1, MEAL: 2, TRAVEL: 3, SPORTS_EQUIPMENT: 4, SCOUTING: 5,
  YOUTH: 6, IT_SECURITY: 7, FACILITY_EQUIPMENT: 8, STAFF_RECRUITMENT: 9,
};
const ACTIVE_CATEGORIES = Object.entries(CAT_IDS).map(([code, id], idx) => ({
  id, code, label: code, sortOrder: idx, isActive: true,
}));

// Mock getPrisma
const mockPrisma = {
  season: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};
jest.mock("../../src/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

function makeRepo(overrides: Partial<FinancialReportRepository> = {}): FinancialReportRepository {
  return {
    findBySeasonId: jest.fn(),
    upsert: jest.fn(),
    upsertBudgetPlan: jest.fn().mockResolvedValue({}),
    getBudgetPlan: jest.fn(),
    saveOptimizeResult: jest.fn(),
    addOverrideLog: jest.fn(),
    getActuals: jest.fn(),
    ...overrides,
  } as unknown as FinancialReportRepository;
}

const makeCategoryService = (): ExpenseCategoryService => ({
  listActive: jest.fn().mockResolvedValue(ACTIVE_CATEGORIES),
  listAll: jest.fn().mockResolvedValue(ACTIVE_CATEGORIES),
  resolveCategoryId: jest.fn(async (code: string) => CAT_IDS[code]!),
  resolveCategoryCode: jest.fn(async (id: number) => Object.keys(CAT_IDS).find((k) => CAT_IDS[k] === id)!),
  isValidCode: jest.fn(async (code: string) => code in CAT_IDS),
  invalidateCache: jest.fn(),
} as unknown as ExpenseCategoryService);

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.season.findUnique.mockResolvedValue({ endDate: new Date("2026-12-31") });
  mockPrisma.season.findFirst.mockResolvedValue({ id: 1 });
});

describe("FinancialReportService.autoGenerateBudgetPlan", () => {
  it("전년도 실적에 growthRate 적용하여 mandatoryMinimum 계산", async () => {
    const prevActuals = { MEDICAL: 10_000_000, MEAL: 5_000_000, TRAVEL: 0, SPORTS_EQUIPMENT: 3_000_000, SCOUTING: 0, YOUTH: 2_000_000 };
    const repo = makeRepo({ getActuals: jest.fn().mockResolvedValue(prevActuals) });
    const svc = new FinancialReportService(repo, new KnapsackService(), makeCategoryService());

    await svc.autoGenerateBudgetPlan(2, { growthRate: 0.1, contingencyRate: 0 });

    const callArg = (repo.upsertBudgetPlan as jest.Mock).mock.calls[0][1];
    // Note: post-cutover, categories are keyed by categoryId, not code.
    const findByCode = (code: string) =>
      callArg.categories.find((c: any) => c.categoryId === CAT_IDS[code]);
    expect(findByCode("MEDICAL").mandatoryMinimum).toBe(11_000_000);
    expect(findByCode("MEAL").mandatoryMinimum).toBe(5_500_000);
    expect(findByCode("TRAVEL").mandatoryMinimum).toBe(0);
  });

  it("contingencyRate 적용하여 totalOperatingBudget, contingencyReserve 계산", async () => {
    const prevActuals = { MEDICAL: 10_000_000, MEAL: 0, TRAVEL: 0, SPORTS_EQUIPMENT: 0, SCOUTING: 0, YOUTH: 0 };
    const repo = makeRepo({ getActuals: jest.fn().mockResolvedValue(prevActuals) });
    const svc = new FinancialReportService(repo, new KnapsackService(), makeCategoryService());

    await svc.autoGenerateBudgetPlan(2, { growthRate: 0, contingencyRate: 0.1 });

    const callArg = (repo.upsertBudgetPlan as jest.Mock).mock.calls[0][1];
    // mandatoryTotal = 10_000_000
    // contingencyReserve = 10_000_000 * 0.1 = 1_000_000
    // totalOperatingBudget = 10_000_000 + 1_000_000 = 11_000_000
    expect(callArg.totalOperatingBudget).toBe(11_000_000);  // same total, same value
    expect(callArg.contingencyReserve).toBe(1_000_000);     // 1_000_000 not 1_100_000
  });

  it("실적 없는 카테고리를 zeroCategories에 포함", async () => {
    const prevActuals = { MEDICAL: 5_000_000, MEAL: 0, TRAVEL: 0, SPORTS_EQUIPMENT: 0, SCOUTING: 0, YOUTH: 0 };
    const repo = makeRepo({ getActuals: jest.fn().mockResolvedValue(prevActuals) });
    const svc = new FinancialReportService(repo, new KnapsackService(), makeCategoryService());

    const result = await svc.autoGenerateBudgetPlan(2, { growthRate: 0.1, contingencyRate: 0 });

    expect(result.zeroCategories).toContain("MEAL");
    expect(result.zeroCategories).toContain("TRAVEL");
    expect(result.zeroCategories).not.toContain("MEDICAL");
  });

  it("전년도 시즌이 없으면 PREV_SEASON_NOT_FOUND 에러", async () => {
    mockPrisma.season.findFirst.mockResolvedValue(null);
    const repo = makeRepo({ getActuals: jest.fn() });
    const svc = new FinancialReportService(repo, new KnapsackService(), makeCategoryService());

    await expect(svc.autoGenerateBudgetPlan(2, { growthRate: 0.1 })).rejects.toMatchObject({ code: "PREV_SEASON_NOT_FOUND" });
  });
});
