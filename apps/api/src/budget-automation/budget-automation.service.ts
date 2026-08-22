// apps/api/src/budget-automation/budget-automation.service.ts

import { OperatingCategory } from "../generated/client";
import { AppError } from "../lib/appError";
import type { BudgetAutomationRepository } from "./budget-automation.repo";
import {
  GOAL_MULTIPLIER,
  REVENUE_KEYS,
  type BudgetApplyRequestDto,
  type BudgetPreviewRequestDto,
  type BudgetPreviewResponse,
  type CategoryPrediction,
  type GoalWeight,
} from "./dto/budget-automation.dto";

function computeCagr(chronoValues: number[]): { cagr: number; warning?: "INSUFFICIENT_DATA" | "HIGH_VOLATILITY" } {
  const nonZero = chronoValues.filter((v) => v > 0);
  if (nonZero.length < 2) return { cagr: 0, warning: "INSUFFICIENT_DATA" };

  const earliest = nonZero[0]!;
  const latest = nonZero[nonZero.length - 1]!;
  const n = nonZero.length - 1;
  const cagr = Math.pow(latest / earliest, 1 / n) - 1;

  const hasHighVol = nonZero.some((v, i) => {
    if (i === 0) return false;
    return Math.abs((v - nonZero[i - 1]!) / nonZero[i - 1]!) > 0.3;
  });

  if (hasHighVol) return { cagr, warning: "HIGH_VOLATILITY" as const };
  return { cagr };
}

function predict(base: number, cagr: number, inflation: number, goal: GoalWeight): number {
  return Math.round(base * (1 + cagr) * (1 + inflation) * GOAL_MULTIPLIER[goal]);
}

export class BudgetAutomationService {
  constructor(private repo: BudgetAutomationRepository) {}

  async preview(dto: BudgetPreviewRequestDto): Promise<BudgetPreviewResponse> {
    const lookback = dto.lookback ?? 3;
    const inflation = dto.inflation ?? 0.03;

    const targetSeason = await this.repo.getTargetSeason(dto.targetSeasonId);
    if (!targetSeason) throw new AppError(404, "SEASON_NOT_FOUND");

    const pastSeasons = await this.repo.getPastSeasons(targetSeason.startDate, lookback);
    if (pastSeasons.length === 0) throw new AppError(400, "NO_HISTORICAL_DATA");

    // pastSeasons is ordered DESC (most recent first); reverse for chronological order
    const chronoSeasonIds = pastSeasons.map((s) => s.id).reverse();
    const pastSeasonIds = pastSeasons.map((s) => s.id);
    const mostRecentSeasonId = pastSeasonIds[0]!;

    const [financialReports, expenseRows, budgetLines] = await Promise.all([
      this.repo.getFinancialReports(pastSeasonIds),
      this.repo.getExpenseActualsByCategory(pastSeasonIds),
      this.repo.getLatestApprovedBudgetLines(mostRecentSeasonId),
    ]);

    const frMap = new Map(financialReports.map((fr) => [fr.seasonId, fr]));

    // ── Revenue predictions ────────────────────────────────────────────────
    const revenueByCat: Record<string, CategoryPrediction> = {};
    let revenueTotal = 0;

    for (const key of REVENUE_KEYS) {
      const chronoValues = chronoSeasonIds.map((id) => Number(frMap.get(id)?.[key] ?? 0));
      const { cagr, warning } = computeCagr(chronoValues);
      const base = chronoValues[chronoValues.length - 1] ?? 0;
      const predicted = predict(base, cagr, inflation, dto.revenueGoal);
      revenueTotal += predicted;
      revenueByCat[key] = {
        predicted,
        cagr: Math.round(cagr * 10000) / 10000,
        dataPoints: chronoValues.filter((v) => v > 0).length,
        ...(warning ? { warning } : {}),
      };
    }

    // ── Expense predictions ────────────────────────────────────────────────
    const expenseMap: Record<string, Record<number, number>> = {};
    for (const row of expenseRows) {
      const cat = row.category as string;
      if (!expenseMap[cat]) expenseMap[cat] = {};
      expenseMap[cat][row.seasonId] = Number(row._sum.amount ?? 0);
    }

    const budgetByCat = new Map(budgetLines.map((l) => [l.category as string, l.originalAmount]));

    const expenseByCat: Record<string, CategoryPrediction> = {};
    let expenseTotal = 0;

    for (const cat of Object.values(OperatingCategory)) {
      const chronoValues = chronoSeasonIds.map((id) => expenseMap[cat]?.[id] ?? 0);
      const { cagr, warning: cagrWarning } = computeCagr(chronoValues);
      const base = chronoValues[chronoValues.length - 1] ?? 0;
      const goalForCat = dto.categoryOverrides?.[cat as OperatingCategory] ?? dto.expenseGoal;
      const predicted = predict(base, cagr, inflation, goalForCat);
      expenseTotal += predicted;

      const budgeted = budgetByCat.get(cat) ?? 0;
      const recentActual = expenseMap[cat]?.[mostRecentSeasonId] ?? 0;
      const isLowUtil = budgeted > 0 && recentActual < budgeted * 0.5;

      const warning = isLowUtil ? "LOW_UTILIZATION" : cagrWarning;

      expenseByCat[cat] = {
        predicted,
        cagr: Math.round(cagr * 10000) / 10000,
        dataPoints: chronoValues.filter((v) => v > 0).length,
        ...(warning ? { warning } : {}),
      };
    }

    return {
      revenue: {
        total: revenueTotal,
        byCategory: revenueByCat as BudgetPreviewResponse["revenue"]["byCategory"],
      },
      expense: {
        total: expenseTotal,
        byCategory: expenseByCat as BudgetPreviewResponse["expense"]["byCategory"],
      },
      parameters: {
        targetSeasonId: dto.targetSeasonId,
        lookback,
        inflation,
        revenueGoal: dto.revenueGoal,
        expenseGoal: dto.expenseGoal,
        categoryOverrides: dto.categoryOverrides ?? {},
        seasonsUsed: chronoSeasonIds.length,
      },
    };
  }

  async apply(dto: BudgetApplyRequestDto, createdById: number) {
    const previewResult = await this.preview(dto);
    const targetSeason = await this.repo.getTargetSeason(dto.targetSeasonId);
    const year = new Date(targetSeason!.startDate).getFullYear();

    const lines = (
      Object.entries(previewResult.expense.byCategory) as [OperatingCategory, CategoryPrediction][]
    ).map(([cat, pred]) => ({
      category: cat,
      originalAmount: pred.predicted,
      year,
    }));

    const totalBudget = lines.reduce((sum, l) => sum + l.originalAmount, 0);

    return this.repo.createHeaderWithLines(
      {
        seasonId: dto.targetSeasonId,
        name: dto.name,
        totalBudget,
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        createdById,
      },
      lines
    );
  }
}
