# Budget Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a budget automation system that pulls 3–5 seasons of historical revenue/expense data, calculates CAGR + inflation adjustments, applies strategic goal weighting, and returns a recommended budget proposal as a preview or creates it as a DRAFT BudgetHeader.

**Architecture:** New `budget-automation` module (BE) with two POST endpoints — `/preview` (read-only calculation) and `/apply` (transactional BudgetHeader + BudgetLine creation). Frontend adds a dedicated `/finance/budget/auto` page where FINANCE_STAFF can preview scenarios and FINANCE_MANAGER can apply them. CAGR is computed per revenue category (from `FinancialReport`) and per expense category (from `OperatingExpense` APPROVED+PAID actuals).

**Tech Stack:** Express + Prisma (PrismaPg adapter), TypeScript, React + shadcn/ui, ts-jest for unit tests. Worktree: `.claude/worktrees/feat-expense-approval/`.

---

## File Structure

**New files (backend):**
- `apps/api/src/budget-automation/dto/budget-automation.dto.ts` — request/response DTO types
- `apps/api/src/budget-automation/budget-automation.repo.ts` — DB queries (historical data, create header+lines)
- `apps/api/src/budget-automation/budget-automation.service.ts` — CAGR logic, weighting, orchestration
- `apps/api/src/budget-automation/budget-automation.routes.ts` — POST /preview, POST /apply

**Modified (backend):**
- `apps/api/src/apiRouter.ts` — register `/budget-automation` router

**New files (tests):**
- `apps/api/__test__/budget-automation/budget-automation.service.test.ts`

**New files (frontend):**
- `football/src/types/budget-automation.ts` — TS types matching API response
- `football/src/services/budgetAutomation.service.ts` — API calls
- `football/src/pages/finance/BudgetAutoPage.tsx` — preview + apply UI

**Modified (frontend):**
- `football/src/App.tsx` — add `/finance/budget/auto` route

---

## Task 1: Backend DTO types

**Files:**
- Create: `apps/api/src/budget-automation/dto/budget-automation.dto.ts`

- [ ] **Step 1: Create the DTO file**

```typescript
// apps/api/src/budget-automation/dto/budget-automation.dto.ts

import { OperatingCategory } from "../../generated/client";

export type GoalWeight = "AGGRESSIVE" | "MAINTAIN" | "CONSERVATIVE";

export const GOAL_MULTIPLIER: Record<GoalWeight, number> = {
  AGGRESSIVE: 1.2,
  MAINTAIN: 1.0,
  CONSERVATIVE: 0.8,
};

export const REVENUE_KEYS = [
  "revenueTicket",
  "revenueSponsorship",
  "revenueBroadcast",
  "revenueMerchandise",
  "revenueSubsidy",
  "revenueParentCompany",
  "revenueAcademyFee",
  "revenueOther",
] as const;

export type RevenueKey = (typeof REVENUE_KEYS)[number];

export interface BudgetPreviewRequestDto {
  targetSeasonId: number;
  lookback?: number;       // default 3
  inflation?: number;      // default 0.03
  revenueGoal: GoalWeight;
  expenseGoal: GoalWeight;
  categoryOverrides?: Partial<Record<OperatingCategory, GoalWeight>>;
}

export interface BudgetApplyRequestDto extends BudgetPreviewRequestDto {
  name: string;
  note?: string;
}

export type WarningCode = "INSUFFICIENT_DATA" | "LOW_UTILIZATION" | "HIGH_VOLATILITY";

export interface CategoryPrediction {
  predicted: number;
  cagr: number;
  dataPoints: number;
  warning?: WarningCode;
}

export interface BudgetPreviewResponse {
  revenue: {
    total: number;
    byCategory: Record<RevenueKey, CategoryPrediction>;
  };
  expense: {
    total: number;
    byCategory: Record<OperatingCategory, CategoryPrediction>;
  };
  parameters: {
    targetSeasonId: number;
    lookback: number;
    inflation: number;
    revenueGoal: GoalWeight;
    expenseGoal: GoalWeight;
    categoryOverrides: Partial<Record<OperatingCategory, GoalWeight>>;
    seasonsUsed: number;
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep budget-automation
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/budget-automation/dto/budget-automation.dto.ts
git commit -m "feat: add budget-automation DTO types"
```

---

## Task 2: Backend Repository

**Files:**
- Create: `apps/api/src/budget-automation/budget-automation.repo.ts`

- [ ] **Step 1: Create the repo file**

```typescript
// apps/api/src/budget-automation/budget-automation.repo.ts

import { PrismaClient, OperatingCategory } from "../generated/client";

export class BudgetAutomationRepository {
  constructor(private prisma: PrismaClient) {}

  getTargetSeason(seasonId: number) {
    return this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, name: true, startDate: true },
    });
  }

  getPastSeasons(beforeDate: Date, limit: number) {
    return this.prisma.season.findMany({
      where: { startDate: { lt: beforeDate } },
      orderBy: { startDate: "desc" },
      take: limit,
      select: { id: true, name: true, startDate: true },
    });
  }

  getFinancialReports(seasonIds: number[]) {
    return this.prisma.financialReport.findMany({
      where: { seasonId: { in: seasonIds } },
      select: {
        seasonId: true,
        revenueTicket: true,
        revenueSponsorship: true,
        revenueBroadcast: true,
        revenueMerchandise: true,
        revenueSubsidy: true,
        revenueParentCompany: true,
        revenueAcademyFee: true,
        revenueOther: true,
      },
    });
  }

  getExpenseActualsByCategory(seasonIds: number[]) {
    return this.prisma.operatingExpense.groupBy({
      by: ["seasonId", "category"],
      where: {
        seasonId: { in: seasonIds },
        status: { in: ["APPROVED", "PAID"] },
        deletedAt: null,
      },
      _sum: { amount: true },
    });
  }

  async getLatestApprovedBudgetLines(seasonId: number) {
    const header = await this.prisma.budgetHeader.findFirst({
      where: { seasonId, status: { in: ["APPROVED", "LOCKED"] } },
      include: { lines: { select: { category: true, originalAmount: true } } },
      orderBy: { createdAt: "desc" },
    });
    return header?.lines ?? [];
  }

  createHeaderWithLines(
    data: {
      seasonId: number;
      name: string;
      totalBudget: number;
      note?: string;
      createdById: number;
    },
    lines: Array<{ category: OperatingCategory; originalAmount: number; year: number }>
  ) {
    return this.prisma.$transaction(async (tx) => {
      const header = await tx.budgetHeader.create({
        data: {
          seasonId: data.seasonId,
          name: data.name,
          totalBudget: data.totalBudget,
          note: data.note ?? null,
          createdById: data.createdById,
        },
      });
      await tx.budgetLine.createMany({
        data: lines.map((l) => ({
          budgetHeaderId: header.id,
          category: l.category,
          originalAmount: l.originalAmount,
          year: l.year,
        })),
      });
      return tx.budgetHeader.findUniqueOrThrow({
        where: { id: header.id },
        include: { lines: true },
      });
    });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep budget-automation
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/budget-automation/budget-automation.repo.ts
git commit -m "feat: add budget-automation repository"
```

---

## Task 3: Service unit tests

**Files:**
- Create: `apps/api/__test__/budget-automation/budget-automation.service.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// apps/api/__test__/budget-automation/budget-automation.service.test.ts

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
    // TRAVEL: 24M base, CAGR ≈ 9.5% over 2 years, ×1.03 inflation, ×1.0
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest __test__/budget-automation --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../../src/budget-automation/budget-automation.service'`

- [ ] **Step 3: Commit the tests**

```bash
git add apps/api/__test__/budget-automation/budget-automation.service.test.ts
git commit -m "test: add budget-automation service unit tests (red)"
```

---

## Task 4: Backend Service

**Files:**
- Create: `apps/api/src/budget-automation/budget-automation.service.ts`

- [ ] **Step 1: Create the service**

```typescript
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
  type RevenueKey,
} from "./dto/budget-automation.dto";

function computeCagr(chronoValues: number[]): { cagr: number; warning?: "INSUFFICIENT_DATA" | "HIGH_VOLATILITY" } {
  const nonZero = chronoValues.filter((v) => v > 0);
  if (nonZero.length < 2) return { cagr: 0, warning: "INSUFFICIENT_DATA" };

  const earliest = nonZero[0];
  const latest = nonZero[nonZero.length - 1];
  const n = nonZero.length - 1;
  const cagr = Math.pow(latest / earliest, 1 / n) - 1;

  const hasHighVol = nonZero.some((v, i) => {
    if (i === 0) return false;
    return Math.abs((v - nonZero[i - 1]) / nonZero[i - 1]) > 0.3;
  });

  return { cagr, warning: hasHighVol ? "HIGH_VOLATILITY" : undefined };
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
    const mostRecentSeasonId = pastSeasonIds[0];

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
      const base = chronoValues[chronoValues.length - 1];
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
    // Build lookup: category → seasonId → actual amount
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
      const base = chronoValues[chronoValues.length - 1];
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

    const lines = (Object.entries(previewResult.expense.byCategory) as [OperatingCategory, CategoryPrediction][]).map(
      ([cat, pred]) => ({
        category: cat,
        originalAmount: pred.predicted,
        year,
      })
    );

    const totalBudget = lines.reduce((sum, l) => sum + l.originalAmount, 0);

    return this.repo.createHeaderWithLines(
      {
        seasonId: dto.targetSeasonId,
        name: dto.name,
        totalBudget,
        note: dto.note,
        createdById,
      },
      lines
    );
  }
}
```

- [ ] **Step 2: Run tests — expect green**

```bash
cd apps/api && npx jest __test__/budget-automation --no-coverage 2>&1 | tail -15
```

Expected: all tests PASS (9/9).

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep budget-automation
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/budget-automation/budget-automation.service.ts
git commit -m "feat: add budget-automation service with CAGR + goal weighting"
```

---

## Task 5: Backend Routes + apiRouter registration

**Files:**
- Create: `apps/api/src/budget-automation/budget-automation.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: Create the routes file**

```typescript
// apps/api/src/budget-automation/budget-automation.routes.ts

import { Router, type Request, type Response, type NextFunction } from "express";
import { auth } from "../lib/authMiddleware";
import { AppError } from "../lib/appError";
import { canReadFinance, canWriteFinance } from "../lib/permissions";
import { getPrisma } from "../lib/prisma";
import { BudgetAutomationRepository } from "./budget-automation.repo";
import { BudgetAutomationService } from "./budget-automation.service";
import type { BudgetPreviewRequestDto, BudgetApplyRequestDto } from "./dto/budget-automation.dto";

const router = Router();
const repo = new BudgetAutomationRepository(getPrisma());
const service = new BudgetAutomationService(repo);

const checkRead = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canReadFinance(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
};

const checkWrite = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteFinance(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
};

// POST /budget-automation/preview — FINANCE_STAFF + FINANCE_MANAGER
router.post("/preview", auth, checkRead, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as BudgetPreviewRequestDto;
    if (!body.targetSeasonId) throw new AppError(400, "TARGET_SEASON_REQUIRED");
    if (!body.revenueGoal || !body.expenseGoal) throw new AppError(400, "GOAL_REQUIRED");
    const result = await service.preview(body);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /budget-automation/apply — FINANCE_MANAGER only
router.post("/apply", auth, checkWrite, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as BudgetApplyRequestDto;
    if (!body.targetSeasonId) throw new AppError(400, "TARGET_SEASON_REQUIRED");
    if (!body.revenueGoal || !body.expenseGoal) throw new AppError(400, "GOAL_REQUIRED");
    if (!body.name?.trim()) throw new AppError(400, "NAME_REQUIRED");
    const result = await service.apply({ ...body, name: body.name.trim() }, req.user!.id);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 2: Register in apiRouter.ts**

In `apps/api/src/apiRouter.ts`, add after the `budgetControlRouter` import line (line 65):

```typescript
import budgetAutomationRouter from "./budget-automation/budget-automation.routes";
```

And after the `apiRouter.use("/budget-control", budgetControlRouter);` line (line 140):

```typescript
apiRouter.use("/budget-automation", budgetAutomationRouter);
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep budget-automation
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/budget-automation/budget-automation.routes.ts apps/api/src/apiRouter.ts
git commit -m "feat: add budget-automation routes and register in apiRouter"
```

---

## Task 6: Frontend types + service

**Files:**
- Create: `football/src/types/budget-automation.ts`
- Create: `football/src/services/budgetAutomation.service.ts`

- [ ] **Step 1: Create frontend types**

```typescript
// football/src/types/budget-automation.ts

export type GoalWeight = 'AGGRESSIVE' | 'MAINTAIN' | 'CONSERVATIVE'
export type OperatingCategory = 'MEDICAL' | 'MEAL' | 'TRAVEL' | 'EQUIPMENT' | 'SCOUTING' | 'YOUTH'
export type RevenueKey =
  | 'revenueTicket'
  | 'revenueSponsorship'
  | 'revenueBroadcast'
  | 'revenueMerchandise'
  | 'revenueSubsidy'
  | 'revenueParentCompany'
  | 'revenueAcademyFee'
  | 'revenueOther'

export interface CategoryPrediction {
  predicted: number
  cagr: number
  dataPoints: number
  warning?: 'INSUFFICIENT_DATA' | 'LOW_UTILIZATION' | 'HIGH_VOLATILITY'
}

export interface BudgetPreviewResponse {
  revenue: {
    total: number
    byCategory: Record<RevenueKey, CategoryPrediction>
  }
  expense: {
    total: number
    byCategory: Record<OperatingCategory, CategoryPrediction>
  }
  parameters: {
    targetSeasonId: number
    lookback: number
    inflation: number
    revenueGoal: GoalWeight
    expenseGoal: GoalWeight
    categoryOverrides: Partial<Record<OperatingCategory, GoalWeight>>
    seasonsUsed: number
  }
}

export interface BudgetPreviewRequest {
  targetSeasonId: number
  lookback?: number
  inflation?: number
  revenueGoal: GoalWeight
  expenseGoal: GoalWeight
  categoryOverrides?: Partial<Record<OperatingCategory, GoalWeight>>
}

export interface BudgetApplyRequest extends BudgetPreviewRequest {
  name: string
  note?: string
}
```

- [ ] **Step 2: Create the API service**

```typescript
// football/src/services/budgetAutomation.service.ts

import { api } from './api'
import type { BudgetPreviewRequest, BudgetPreviewResponse, BudgetApplyRequest } from '@/types/budget-automation'
import type { BudgetHeader } from '@/types/budget-control'

export const budgetAutomationApi = {
  preview: (data: BudgetPreviewRequest) =>
    api.post<BudgetPreviewResponse>('/budget-automation/preview', data),
  apply: (data: BudgetApplyRequest) =>
    api.post<BudgetHeader>('/budget-automation/apply', data),
}
```

- [ ] **Step 3: Verify TypeScript in frontend**

```bash
cd football && npx tsc --noEmit 2>&1 | grep budget-automation
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add football/src/types/budget-automation.ts football/src/services/budgetAutomation.service.ts
git commit -m "feat: add budget-automation frontend types and API service"
```

---

## Task 7: Frontend page + route

**Files:**
- Create: `football/src/pages/finance/BudgetAutoPage.tsx`
- Modify: `football/src/App.tsx`

- [ ] **Step 1: Create the page**

```tsx
// football/src/pages/finance/BudgetAutoPage.tsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ArrowLeft, Wand2 } from 'lucide-react'
import { budgetAutomationApi } from '@/services/budgetAutomation.service'
import { budgetControlApi } from '@/services/budgetControl.service'
import { seasonApi } from '@/services/season.service'
import type { BudgetPreviewResponse, GoalWeight, OperatingCategory, BudgetPreviewRequest } from '@/types/budget-automation'
import type { Season } from '@/types/season'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEffect } from 'react'
import { canWriteFinance } from '@/lib/permissions'

const GOAL_LABELS: Record<GoalWeight, string> = {
  AGGRESSIVE: '공격적 투자 (×1.2)',
  MAINTAIN: '현상 유지 (×1.0)',
  CONSERVATIVE: '긴축 재정 (×0.8)',
}

const EXPENSE_CATS: OperatingCategory[] = ['MEDICAL', 'MEAL', 'TRAVEL', 'EQUIPMENT', 'SCOUTING', 'YOUTH']
const REVENUE_KEYS = ['revenueTicket', 'revenueSponsorship', 'revenueBroadcast', 'revenueMerchandise', 'revenueSubsidy', 'revenueParentCompany', 'revenueAcademyFee', 'revenueOther'] as const

const REVENUE_LABELS: Record<string, string> = {
  revenueTicket: '티켓 수입',
  revenueSponsorship: '스폰서십',
  revenueBroadcast: '중계권',
  revenueMerchandise: '머천다이즈',
  revenueSubsidy: '보조금',
  revenueParentCompany: '모기업 지원',
  revenueAcademyFee: '아카데미 수강료',
  revenueOther: '기타',
}

const EXPENSE_LABELS: Record<OperatingCategory, string> = {
  MEDICAL: '의료',
  MEAL: '식비',
  TRAVEL: '출장',
  EQUIPMENT: '장비',
  SCOUTING: '스카우팅',
  YOUTH: '유스',
}

const WARNING_LABEL: Record<string, string> = {
  INSUFFICIENT_DATA: '데이터 부족',
  LOW_UTILIZATION: '낮은 집행률',
  HIGH_VOLATILITY: '높은 변동성',
}

function fmt(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n)
}

function CagrBadge({ cagr }: { cagr: number }) {
  const pct = (cagr * 100).toFixed(1)
  return (
    <span className={`text-xs font-mono ${cagr >= 0 ? 'text-green-600' : 'text-red-500'}`}>
      {cagr >= 0 ? '+' : ''}{pct}%
    </span>
  )
}

export default function BudgetAutoPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const canApply = user ? canWriteFinance(user.role, user.frontOfficeRole) : false

  const [seasons, setSeasons] = useState<Season[]>([])
  const [targetSeasonId, setTargetSeasonId] = useState('')
  const [lookback, setLookback] = useState('3')
  const [inflation, setInflation] = useState('3')
  const [revenueGoal, setRevenueGoal] = useState<GoalWeight>('MAINTAIN')
  const [expenseGoal, setExpenseGoal] = useState<GoalWeight>('MAINTAIN')
  const [categoryOverrides, setCategoryOverrides] = useState<Partial<Record<OperatingCategory, GoalWeight>>>({})
  const [preview, setPreview] = useState<BudgetPreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [applyName, setApplyName] = useState('')
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    seasonApi.getAll().then(setSeasons).catch(() => null)
  }, [])

  const handlePreview = async () => {
    if (!targetSeasonId) { toast.error('시즌을 선택하세요'); return }
    setLoading(true)
    try {
      const req: BudgetPreviewRequest = {
        targetSeasonId: Number(targetSeasonId),
        lookback: Number(lookback),
        inflation: Number(inflation) / 100,
        revenueGoal,
        expenseGoal,
        categoryOverrides: Object.keys(categoryOverrides).length > 0 ? categoryOverrides : undefined,
      }
      const result = await budgetAutomationApi.preview(req)
      setPreview(result)
      setApplyName(`${seasons.find(s => s.id === Number(targetSeasonId))?.name ?? ''} 자동 산출 예산안`)
    } catch {
      toast.error('예측 계산 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!preview || !applyName.trim()) { toast.error('예산안 이름을 입력하세요'); return }
    setApplying(true)
    try {
      const header = await budgetAutomationApi.apply({
        targetSeasonId: Number(targetSeasonId),
        lookback: Number(lookback),
        inflation: Number(inflation) / 100,
        revenueGoal,
        expenseGoal,
        categoryOverrides: Object.keys(categoryOverrides).length > 0 ? categoryOverrides : undefined,
        name: applyName.trim(),
      })
      toast.success('예산안이 생성되었습니다')
      navigate(`/finance/budget/${header.id}`)
    } catch {
      toast.error('예산안 생성 중 오류가 발생했습니다')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/finance/budget')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">예산 자동 산출</h1>
      </div>

      {/* Parameters */}
      <Card>
        <CardHeader><CardTitle>파라미터 설정</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>대상 시즌</Label>
            <Select value={targetSeasonId} onValueChange={setTargetSeasonId}>
              <SelectTrigger><SelectValue placeholder="시즌 선택" /></SelectTrigger>
              <SelectContent>
                {seasons.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>과거 참조 시즌 수</Label>
            <Select value={lookback} onValueChange={setLookback}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['2','3','4','5'].map(v => <SelectItem key={v} value={v}>{v}시즌</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>물가 상승률 (%)</Label>
            <Input type="number" value={inflation} onChange={e => setInflation(e.target.value)} min={0} max={20} step={0.5} />
          </div>
          <div />
          <div className="space-y-1">
            <Label>수익 목표</Label>
            <Select value={revenueGoal} onValueChange={v => setRevenueGoal(v as GoalWeight)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(GOAL_LABELS) as GoalWeight[]).map(g => (
                  <SelectItem key={g} value={g}>{GOAL_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>지출 목표</Label>
            <Select value={expenseGoal} onValueChange={v => setExpenseGoal(v as GoalWeight)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(GOAL_LABELS) as GoalWeight[]).map(g => (
                  <SelectItem key={g} value={g}>{GOAL_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Category overrides */}
      <Card>
        <CardHeader><CardTitle>카테고리별 지출 목표 (선택)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {EXPENSE_CATS.map(cat => (
              <div key={cat} className="space-y-1">
                <Label>{EXPENSE_LABELS[cat]}</Label>
                <Select
                  value={categoryOverrides[cat] ?? ''}
                  onValueChange={v => {
                    const next = { ...categoryOverrides }
                    if (v) next[cat] = v as GoalWeight; else delete next[cat]
                    setCategoryOverrides(next)
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="기본값 사용" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">기본값 사용</SelectItem>
                    {(Object.keys(GOAL_LABELS) as GoalWeight[]).map(g => (
                      <SelectItem key={g} value={g}>{GOAL_LABELS[g]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handlePreview} disabled={loading} className="w-full">
        <Wand2 className="mr-2 h-4 w-4" />
        {loading ? '계산 중...' : '예산 자동 산출'}
      </Button>

      {/* Preview results */}
      {preview && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>수익 예측 <span className="text-muted-foreground text-sm font-normal">({preview.parameters.seasonsUsed}시즌 기준)</span></CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">카테고리</th>
                    <th className="text-right py-1">CAGR</th>
                    <th className="text-right py-1">예측 금액</th>
                    <th className="text-right py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {REVENUE_KEYS.map(key => {
                    const p = preview.revenue.byCategory[key]
                    return (
                      <tr key={key} className="border-b last:border-0">
                        <td className="py-1.5">{REVENUE_LABELS[key]}</td>
                        <td className="text-right"><CagrBadge cagr={p.cagr} /></td>
                        <td className="text-right font-mono">₩{fmt(p.predicted)}</td>
                        <td className="text-right">
                          {p.warning && (
                            <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />{WARNING_LABEL[p.warning]}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="font-semibold">
                    <td className="pt-2">합계</td>
                    <td />
                    <td className="text-right pt-2 font-mono">₩{fmt(preview.revenue.total)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>지출 예측</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">카테고리</th>
                    <th className="text-right py-1">CAGR</th>
                    <th className="text-right py-1">예측 금액</th>
                    <th className="text-right py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {EXPENSE_CATS.map(cat => {
                    const p = preview.expense.byCategory[cat]
                    return (
                      <tr key={cat} className="border-b last:border-0">
                        <td className="py-1.5">{EXPENSE_LABELS[cat]}</td>
                        <td className="text-right"><CagrBadge cagr={p.cagr} /></td>
                        <td className="text-right font-mono">₩{fmt(p.predicted)}</td>
                        <td className="text-right">
                          {p.warning && (
                            <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />{WARNING_LABEL[p.warning]}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="font-semibold">
                    <td className="pt-2">합계</td>
                    <td />
                    <td className="text-right pt-2 font-mono">₩{fmt(preview.expense.total)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {canApply && (
            <Card>
              <CardHeader><CardTitle>예산안 확정</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>예산안 이름</Label>
                  <Input value={applyName} onChange={e => setApplyName(e.target.value)} placeholder="예) 2026/27 시즌 예산안" />
                </div>
                <Button onClick={handleApply} disabled={applying} className="w-full">
                  {applying ? '생성 중...' : '이 안으로 예산안 생성 (DRAFT)'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Check that `canWriteFinance` is exported from `@/lib/permissions`**

```bash
grep -n "canWriteFinance" /Users/juno/work/football/football/src/lib/permissions.ts 2>/dev/null \
  || grep -rn "canWriteFinance" /Users/juno/work/football/football/src/ --include="*.ts" | head -5
```

If `canWriteFinance` is not in a frontend `permissions.ts`, replace the canApply logic in the page with:

```tsx
const canApply = user?.frontOfficeRole === 'FINANCE_MANAGER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
```

- [ ] **Step 3: Add route in App.tsx**

In `football/src/App.tsx`, add the import after line 84 (`import BudgetDetailPage`):

```tsx
import BudgetAutoPage from '@/pages/finance/BudgetAutoPage'
```

And after line 238 (`<Route path="/finance/budget/:id" ...`):

```tsx
<Route path="/finance/budget/auto" element={<BudgetAutoPage />} />
```

- [ ] **Step 4: Add "자동 산출" button in BudgetListPage**

In `football/src/pages/finance/BudgetListPage.tsx`, find the existing "새 예산 생성" `<Button>` and add a sibling button before it:

```tsx
import { useNavigate } from 'react-router-dom'
// inside component:
const navigate = useNavigate()

// In the JSX, next to the existing create button:
<Button variant="outline" onClick={() => navigate('/finance/budget/auto')}>
  자동 산출
</Button>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd football && npx tsc --noEmit 2>&1 | grep -i budget
```

Expected: no errors related to budget-automation files.

- [ ] **Step 6: Commit**

```bash
git add football/src/pages/finance/BudgetAutoPage.tsx football/src/App.tsx football/src/pages/finance/BudgetListPage.tsx
git commit -m "feat: add budget automation frontend page and route"
```

---

## Self-Review

**Spec coverage:**
- ✅ Past data auto-link: `getFinancialReports` (revenue categories) + `getExpenseActualsByCategory` (OperatingExpense APPROVED/PAID)
- ✅ CAGR calculation: `computeCagr()` with 3-year default lookback
- ✅ Inflation parameter: `inflation` field, default 0.03, applied as `× (1 + inflation)`
- ✅ Strategic goal weighting: `AGGRESSIVE/MAINTAIN/CONSERVATIVE` → 1.2/1.0/0.8
- ✅ Category overrides: `categoryOverrides` in request body
- ✅ Preview endpoint: `POST /budget-automation/preview` (canReadFinance)
- ✅ Apply endpoint: `POST /budget-automation/apply` (canWriteFinance, creates DRAFT BudgetHeader)
- ✅ Warning flags: INSUFFICIENT_DATA, LOW_UTILIZATION, HIGH_VOLATILITY
- ✅ Frontend page at `/finance/budget/auto`
- ✅ Redirects to BudgetDetailPage after apply

**Type consistency check:**
- `GoalWeight` defined in DTO (Task 1) → used in service (Task 4) → mirrored in frontend types (Task 6) ✅
- `GOAL_MULTIPLIER` lives in DTO and imported in service ✅
- `BudgetPreviewResponse` shape in DTO matches frontend type ✅
- `createHeaderWithLines` signature in repo (Task 2) matches service call (Task 4) ✅
