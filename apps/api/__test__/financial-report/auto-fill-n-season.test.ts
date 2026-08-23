import { FinancialReportService } from "../../src/financial-report/financial-report.service";
import { KnapsackService } from "../../src/budget/knapsack.service";
import type { FinancialReportRepository } from "../../src/financial-report/financial-report.repo";
import type { ExpenseCategoryService } from "../../src/expense-category/expense-category.service";

const makeCategoryService = (): ExpenseCategoryService => ({
  listActive: jest.fn().mockResolvedValue([]),
  listAll: jest.fn().mockResolvedValue([]),
  resolveCategoryId: jest.fn(),
  resolveCategoryCode: jest.fn(),
  isValidCode: jest.fn().mockResolvedValue(true),
  invalidateCache: jest.fn(),
} as unknown as ExpenseCategoryService);

const mockPrisma = {
  season: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};
jest.mock("../../src/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

const mockGetActuals = jest.fn();
jest.mock("../../src/lib/season-actuals", () => ({
  getSeasonRevenueActuals: (id: number) => mockGetActuals(id),
}));

function makeRepo(): FinancialReportRepository {
  return {
    findBySeasonId: jest.fn(),
    upsert: jest.fn().mockResolvedValue({}),
    upsertBudgetPlan: jest.fn(),
    getBudgetPlan: jest.fn(),
    saveOptimizeResult: jest.fn(),
    addOverrideLog: jest.fn(),
    getActuals: jest.fn(),
  } as unknown as FinancialReportRepository;
}

const ZERO_MANUAL = {
  plannedRevenueBroadcast: 0,
  plannedRevenueSubsidy: 0,
  plannedRevenueParentCompany: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.season.findUnique.mockResolvedValue({ startDate: new Date("2027-01-01") });
});

describe("FinancialReportService.autoFillRevenueFromPrevSeasons", () => {
  it("averages 3 CLOSED seasons by field (default lookback=3)", async () => {
    mockPrisma.season.findMany.mockResolvedValue([{ id: 30 }, { id: 20 }, { id: 10 }]);
    mockGetActuals
      .mockResolvedValueOnce({ plannedRevenueTicket: 300, plannedRevenueSponsorship: 900, plannedRevenueMerchandise: 60, plannedRevenueOther: 30, plannedRevenueAcademyFee: 120, ...ZERO_MANUAL })
      .mockResolvedValueOnce({ plannedRevenueTicket: 200, plannedRevenueSponsorship: 600, plannedRevenueMerchandise: 30, plannedRevenueOther: 0,  plannedRevenueAcademyFee: 90,  ...ZERO_MANUAL })
      .mockResolvedValueOnce({ plannedRevenueTicket: 100, plannedRevenueSponsorship: 300, plannedRevenueMerchandise: 0,  plannedRevenueOther: 0,  plannedRevenueAcademyFee: 60,  ...ZERO_MANUAL });

    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService(), makeCategoryService());

    await svc.autoFillRevenueFromPrevSeasons(99);

    expect(mockPrisma.season.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "CLOSED", endDate: { lt: new Date("2027-01-01") } }),
      take: 3,
    }));
    const [seasonIdArg, totalArg, noteArg, breakdownArg] = (repo.upsert as jest.Mock).mock.calls[0];
    expect(seasonIdArg).toBe(99);
    expect(breakdownArg.plannedRevenueTicket).toBe(200);       // (300+200+100)/3
    expect(breakdownArg.plannedRevenueSponsorship).toBe(600);  // (900+600+300)/3
    expect(breakdownArg.plannedRevenueMerchandise).toBe(30);   // (60+30+0)/3
    expect(breakdownArg.plannedRevenueOther).toBe(10);         // (30+0+0)/3
    expect(breakdownArg.plannedRevenueAcademyFee).toBe(90);    // (120+90+60)/3
    expect(breakdownArg.plannedRevenueBroadcast).toBe(0);
    expect(totalArg).toBe(200 + 600 + 30 + 10 + 90);
    expect(noteArg).toContain("3개 CLOSED 시즌");
  });

  it("falls back to however many CLOSED seasons exist when fewer than lookback", async () => {
    mockPrisma.season.findMany.mockResolvedValue([{ id: 5 }]);   // only 1
    mockGetActuals.mockResolvedValueOnce({
      plannedRevenueTicket: 100, plannedRevenueSponsorship: 200, plannedRevenueMerchandise: 0,
      plannedRevenueOther: 0, plannedRevenueAcademyFee: 0, ...ZERO_MANUAL,
    });

    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService(), makeCategoryService());
    await svc.autoFillRevenueFromPrevSeasons(99, 3);

    const [, , noteArg, breakdownArg] = (repo.upsert as jest.Mock).mock.calls[0];
    expect(breakdownArg.plannedRevenueTicket).toBe(100);   // /1 not /3
    expect(noteArg).toContain("1개 CLOSED 시즌");
  });

  it("throws NO_PREV_SEASON when 0 CLOSED seasons exist", async () => {
    mockPrisma.season.findMany.mockResolvedValue([]);
    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService(), makeCategoryService());
    await expect(svc.autoFillRevenueFromPrevSeasons(99)).rejects.toMatchObject({
      statusCode: 404, code: "NO_PREV_SEASON",
    });
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("throws SEASON_NOT_FOUND when target season missing", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(null);
    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService(), makeCategoryService());
    await expect(svc.autoFillRevenueFromPrevSeasons(99)).rejects.toMatchObject({
      statusCode: 404, code: "SEASON_NOT_FOUND",
    });
  });

  it("respects lookback=5 override", async () => {
    mockPrisma.season.findMany.mockResolvedValue([{ id: 50 }, { id: 40 }, { id: 30 }, { id: 20 }, { id: 10 }]);
    mockGetActuals.mockResolvedValue({
      plannedRevenueTicket: 100, plannedRevenueSponsorship: 0, plannedRevenueMerchandise: 0,
      plannedRevenueOther: 0, plannedRevenueAcademyFee: 0, ...ZERO_MANUAL,
    });

    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService(), makeCategoryService());
    await svc.autoFillRevenueFromPrevSeasons(99, 5);

    expect(mockPrisma.season.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(mockGetActuals).toHaveBeenCalledTimes(5);
  });

  it("rejects invalid lookback (<1 or non-integer)", async () => {
    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService(), makeCategoryService());
    await expect(svc.autoFillRevenueFromPrevSeasons(99, 0)).rejects.toMatchObject({
      statusCode: 400, code: "INVALID_LOOKBACK",
    });
  });
});
