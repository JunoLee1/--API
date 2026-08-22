import { BudgetAutomationService } from "../../src/budget-automation/budget-automation.service";
import { AppError } from "../../src/lib/appError";
import { BudgetAutomationRepository } from "../../src/budget-automation/budget-automation.repo";

const SEASON_2024 = { id: 10, name: "2023/24", startDate: new Date("2023-07-01") };
const SEASON_2025 = { id: 11, name: "2024/25", startDate: new Date("2024-07-01") };
const SEASON_2026 = { id: 12, name: "2025/26", startDate: new Date("2025-07-01") };
const TARGET_SEASON = { id: 13, name: "2026/27", startDate: new Date("2026-07-01") };

const makeReport = (seasonId: number, overrides = {}) => ({
  seasonId,
  revenueTicket: 100_000_000,
  revenueSponsorship: 50_000_000,
  revenueBroadcast: 30_000_000,
  revenueMerchandise: 10_000_000,
  revenueSubsidy: 5_000_000,
  revenueParentCompany: 0,
  revenueAcademyFee: 0,
  revenueOther: 0,
  ...overrides,
});

const makeExpenseRow = (seasonId: number, category: string, amount: number) => ({
  seasonId,
  category,
  _sum: { amount },
});

const makeRepo = (overrides: Partial<BudgetAutomationRepository> = {}): BudgetAutomationRepository => ({
  getTargetSeason: jest.fn().mockResolvedValue(TARGET_SEASON),
  getPastSeasons: jest.fn().mockResolvedValue([SEASON_2026, SEASON_2025, SEASON_2024]),
  getFinancialReports: jest.fn().mockResolvedValue([
    makeReport(SEASON_2024.id),
    makeReport(SEASON_2025.id),
    makeReport(SEASON_2026.id),
  ]),
  getExpenseActualsByCategory: jest.fn().mockResolvedValue([
    makeExpenseRow(SEASON_2024.id, "TRAVEL", 20_000_000),
    makeExpenseRow(SEASON_2025.id, "TRAVEL", 22_000_000),
    makeExpenseRow(SEASON_2026.id, "TRAVEL", 24_000_000),
    makeExpenseRow(SEASON_2024.id, "SCOUTING", 10_000_000),
    makeExpenseRow(SEASON_2025.id, "SCOUTING", 11_000_000),
    makeExpenseRow(SEASON_2026.id, "SCOUTING", 12_000_000),
  ]),
  getLatestApprovedBudgetLines: jest.fn().mockResolvedValue([
    { category: "TRAVEL", originalAmount: 30_000_000 },
    { category: "SCOUTING", originalAmount: 25_000_000 },
  ]),
  createHeaderWithLines: jest.fn().mockResolvedValue({ id: 99, lines: [] }),
  ...overrides,
} as unknown as BudgetAutomationRepository);

const baseRequest = {
  targetSeasonId: 13,
  revenueGoal: "MAINTAIN" as const,
  expenseGoal: "MAINTAIN" as const,
};

describe("BudgetAutomationService.preview", () => {
  it("throws 404 when target season not found", async () => {
    const repo = makeRepo({ getTargetSeason: jest.fn().mockResolvedValue(null) });
    await expect(new BudgetAutomationService(repo).preview(baseRequest))
      .rejects.toThrow(new AppError(404, "SEASON_NOT_FOUND"));
  });

  it("throws 400 when no historical seasons exist", async () => {
    const repo = makeRepo({ getPastSeasons: jest.fn().mockResolvedValue([]) });
    await expect(new BudgetAutomationService(repo).preview(baseRequest))
      .rejects.toThrow(new AppError(400, "NO_HISTORICAL_DATA"));
  });

  it("returns predictions with MAINTAIN goal (×1.0) applied", async () => {
    const result = await new BudgetAutomationService(makeRepo()).preview(baseRequest);
    expect(result.expense.byCategory["TRAVEL"].predicted).toBeGreaterThan(24_000_000);
    expect(result.expense.byCategory["TRAVEL"].dataPoints).toBe(3);
  });

  it("applies AGGRESSIVE goal (×1.2) to expense", async () => {
    const r1 = await new BudgetAutomationService(makeRepo()).preview({ ...baseRequest, expenseGoal: "MAINTAIN" });
    const r2 = await new BudgetAutomationService(makeRepo()).preview({ ...baseRequest, expenseGoal: "AGGRESSIVE" });
    expect(r2.expense.byCategory["TRAVEL"].predicted)
      .toBeCloseTo(r1.expense.byCategory["TRAVEL"].predicted * 1.2, -4);
  });

  it("applies categoryOverrides over expenseGoal", async () => {
    const r1 = await new BudgetAutomationService(makeRepo()).preview({ ...baseRequest, expenseGoal: "MAINTAIN" });
    const r2 = await new BudgetAutomationService(makeRepo()).preview({
      ...baseRequest,
      expenseGoal: "MAINTAIN",
      categoryOverrides: { TRAVEL: "CONSERVATIVE" },
    });
    expect(r2.expense.byCategory["TRAVEL"].predicted)
      .toBeCloseTo(r1.expense.byCategory["TRAVEL"].predicted * (0.8 / 1.0), -4);
  });

  it("sets INSUFFICIENT_DATA warning when only 1 season available", async () => {
    const repo = makeRepo({
      getPastSeasons: jest.fn().mockResolvedValue([SEASON_2026]),
      getFinancialReports: jest.fn().mockResolvedValue([makeReport(SEASON_2026.id)]),
      getExpenseActualsByCategory: jest.fn().mockResolvedValue([
        makeExpenseRow(SEASON_2026.id, "TRAVEL", 24_000_000),
      ]),
    });
    const result = await new BudgetAutomationService(repo).preview(baseRequest);
    expect(result.expense.byCategory["TRAVEL"].warning).toBe("INSUFFICIENT_DATA");
  });

  it("sets LOW_UTILIZATION warning when actual < 50% of budget", async () => {
    const repo = makeRepo({
      getLatestApprovedBudgetLines: jest.fn().mockResolvedValue([
        { category: "TRAVEL", originalAmount: 100_000_000 }, // budget 100M, actual 24M < 50%
      ]),
    });
    const result = await new BudgetAutomationService(repo).preview(baseRequest);
    expect(result.expense.byCategory["TRAVEL"].warning).toBe("LOW_UTILIZATION");
  });

  it("uses inflation parameter to increase predictions", async () => {
    const r0 = await new BudgetAutomationService(makeRepo()).preview({ ...baseRequest, inflation: 0 });
    const r1 = await new BudgetAutomationService(makeRepo()).preview({ ...baseRequest, inflation: 0.1 });
    expect(r1.expense.byCategory["TRAVEL"].predicted)
      .toBeGreaterThan(r0.expense.byCategory["TRAVEL"].predicted);
  });

  it("includes parameters echo in response", async () => {
    const result = await new BudgetAutomationService(makeRepo()).preview(baseRequest);
    expect(result.parameters.targetSeasonId).toBe(13);
    expect(result.parameters.lookback).toBe(3);
    expect(result.parameters.inflation).toBe(0.03);
    expect(result.parameters.seasonsUsed).toBe(3);
  });
});

describe("BudgetAutomationService.apply", () => {
  it("calls createHeaderWithLines with correct totalBudget", async () => {
    const repo = makeRepo();
    await new BudgetAutomationService(repo).apply(
      { ...baseRequest, name: "2026/27 예산안" },
      5
    );
    const [headerData] = (repo.createHeaderWithLines as jest.Mock).mock.calls[0];
    expect(headerData.name).toBe("2026/27 예산안");
    expect(headerData.createdById).toBe(5);
    expect(headerData.totalBudget).toBeGreaterThan(0);
  });
});
