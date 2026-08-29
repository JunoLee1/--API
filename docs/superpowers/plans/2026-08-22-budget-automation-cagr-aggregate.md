# Budget Automation — CAGR from Live Actuals Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `budget-automation` revenue CAGR computation to use **live actuals** aggregated from source-of-record tables (`SalesRecord` / `SponsorshipPayment` / `LedgerEntry`) instead of the `plannedRevenue*` fields on `FinancialReport`. Post PR #312 rename, those fields are explicitly PLANNED values, not actuals — so computing CAGR on them is a semantic mismatch (planned CAGR ≠ actual growth trend). This plan reuses the `getSeasonRevenueActuals(seasonId)` helper introduced by PR B.

**Architecture:** Pure backend refactor of `apps/api/src/budget-automation/`. No schema change, no DTO shape change, no frontend touch, no expense-side CAGR change (already reads real source). The service's revenue branch swaps `frMap.get(id)?.[key]` for `perSeasonActuals[i][key]` where `perSeasonActuals` comes from the shared helper. The unused repo method `getFinancialReports` is removed. Existing test suite is rewritten to mock the new helper flow.

**Tech Stack:** Express + Prisma (PrismaPg adapter), TypeScript, ts-jest. Zero new dependencies. No frontend changes.

**Precondition (blocking):** This plan depends on **PR B** — `docs/superpowers/plans/2026-08-22-auto-fill-n-season-average.md` — which introduces `getSeasonRevenueActuals(seasonId)` at `apps/api/src/lib/season-actuals.ts` returning an object keyed by the same 8 `plannedRevenue*` field names (BROADCAST/SUBSIDY/PARENT_COMPANY always `0` since no system-of-record). PR B **must be merged first**. Do not start this plan until `apps/api/src/lib/season-actuals.ts` exists on `main`.

**Scope 제한:**
- Expense CAGR (uses `OperatingExpense.groupBy`) — unchanged
- `apply()` method — unchanged
- 4-parameter DTO (`targetSeasonId` / `lookback` / `inflation` / goals) — unchanged
- `WarningCode` enum — unchanged
- Frontend `BudgetAutoPage` — unchanged
- Dashboard revenue split (`dashboard.routes.ts`) — already handled by PR B

---

## File Structure

**Modified (backend):**
- `apps/api/src/budget-automation/budget-automation.repo.ts` — remove `getFinancialReports`
- `apps/api/src/budget-automation/budget-automation.service.ts` — replace `frMap` lookup with per-season helper calls
- `apps/api/src/budget-automation/budget-automation.routes.ts` — (only if constructor injection is chosen) inject helper into service

**Modified (tests):**
- `apps/api/__test__/budget-automation/budget-automation.service.test.ts` — swap `getFinancialReports` mocks for helper mocks; add a BROADCAST/SUBSIDY/PARENT_COMPANY `INSUFFICIENT_DATA` case

**참고 (변경 없음):**
- `apps/api/src/budget-automation/dto/budget-automation.dto.ts` (`REVENUE_KEYS` stays as-is — the 8 `plannedRevenue*` names are still the response-shape keys, only the *source* changes)
- `apps/api/src/lib/season-actuals.ts` (PR B — used, not modified)

---

## Task 1: Verify PR B precondition and read helper contract

**Files:**
- (read-only)

- [ ] **Step 1: Confirm PR B is merged and helper file exists**

```bash
cd /Users/juno/work/football
git checkout main && git pull
ls -la apps/api/src/lib/season-actuals.ts
```

Expected: file exists. If not, STOP — resolve PR B first (`docs/superpowers/plans/2026-08-22-auto-fill-n-season-average.md`).

- [ ] **Step 2: Read helper signature**

```bash
head -30 apps/api/src/lib/season-actuals.ts
```

Confirm the helper is exported as `getSeasonRevenueActuals(seasonId: number): Promise<Record<RevenueKey, number>>` (or an equivalent shape keyed by the 8 `plannedRevenue*` names). If the shape differs, adjust Task 3's code fence accordingly before proceeding.

- [ ] **Step 3: Confirm dependent callers of `getFinancialReports`**

```bash
grep -rn "getFinancialReports" apps/api --include="*.ts"
```

Expected: only two hits — `budget-automation.repo.ts` (definition) and `budget-automation.service.ts` (single caller) plus test file mocks. If any other caller appears, STOP and update this plan to cover them.

---

## Task 2: Remove `getFinancialReports` from the repository

**Files:**
- Modify: `apps/api/src/budget-automation/budget-automation.repo.ts`

- [ ] **Step 1: Delete the method**

Remove lines 22–37 (the entire `getFinancialReports(seasonIds: number[])` method) from `apps/api/src/budget-automation/budget-automation.repo.ts`. The remaining methods (`getTargetSeason`, `getPastSeasons`, `getExpenseActualsByCategory`, `getLatestApprovedBudgetLines`, `createHeaderWithLines`) stay untouched.

- [ ] **Step 2: Verify no dangling imports**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -i budget-automation | head -20
```

Expected: at least one error pointing to `budget-automation.service.ts` line 57 (which still calls the deleted method). That's expected — Task 3 fixes it. No unrelated errors should appear.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/budget-automation/budget-automation.repo.ts
git commit -m "refactor(budget-automation): remove unused getFinancialReports repo method"
```

---

## Task 3: Rewrite `BudgetAutomationService.preview` revenue branch

**Files:**
- Modify: `apps/api/src/budget-automation/budget-automation.service.ts`

- [ ] **Step 1: Import helper**

At the top of `apps/api/src/budget-automation/budget-automation.service.ts`, add:

```typescript
import { getSeasonRevenueActuals } from "../lib/season-actuals";
```

Place it after the existing `import { OperatingCategory } from "../generated/client";` and before the `AppError` import (grouping external module imports before local ones is fine either way — match existing style).

- [ ] **Step 2: Replace the `Promise.all` block and revenue loop**

Locate this block in `preview()` (currently lines 56–80):

```typescript
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
```

Replace with:

```typescript
const [perSeasonActuals, expenseRows, budgetLines] = await Promise.all([
  Promise.all(chronoSeasonIds.map((id) => getSeasonRevenueActuals(id))),
  this.repo.getExpenseActualsByCategory(pastSeasonIds),
  this.repo.getLatestApprovedBudgetLines(mostRecentSeasonId),
]);

// perSeasonActuals[i] corresponds to chronoSeasonIds[i] (oldest → newest)

// ── Revenue predictions ────────────────────────────────────────────────
const revenueByCat: Record<string, CategoryPrediction> = {};
let revenueTotal = 0;

for (const key of REVENUE_KEYS) {
  const chronoValues = perSeasonActuals.map((a) => Number(a[key] ?? 0));
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
```

Key changes:
- `this.repo.getFinancialReports(pastSeasonIds)` → `Promise.all(chronoSeasonIds.map((id) => getSeasonRevenueActuals(id)))`
- `frMap.get(id)?.[key]` → `a[key]` (`a` is already the actuals object for that season)
- The outer loop no longer uses `chronoSeasonIds` for the value lookup — it uses index alignment via `perSeasonActuals[i] ↔ chronoSeasonIds[i]`
- `frMap` deleted (no longer needed)

The expense branch (lines 82–115) and the `return` block (117–135) stay **exactly as-is**.

- [ ] **Step 3: Verify types**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -i budget-automation
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/budget-automation/budget-automation.service.ts
git commit -m "refactor(budget-automation): compute revenue CAGR from live actuals via helper"
```

---

## Task 4: Update the service test suite

**Files:**
- Modify: `apps/api/__test__/budget-automation/budget-automation.service.test.ts`

**Decision:** module-level `jest.mock` for the helper (no constructor-injection change to the service). Rationale: minimises call-site diff (routes file untouched) and matches how the codebase mocks other module-level utilities.

- [ ] **Step 1: Mock the helper at the top of the file**

Above the existing `import { BudgetAutomationService }` line, add:

```typescript
jest.mock("../../src/lib/season-actuals", () => ({
  getSeasonRevenueActuals: jest.fn(),
}));

import { getSeasonRevenueActuals } from "../../src/lib/season-actuals";
const mockedGetSeasonRevenueActuals = getSeasonRevenueActuals as jest.MockedFunction<typeof getSeasonRevenueActuals>;
```

- [ ] **Step 2: Rename `makeReport` and rewire default mock**

Replace the current `makeReport` helper (which was building a `FinancialReport` shape) with an actuals-shape helper:

```typescript
const makeActuals = (overrides: Partial<Record<string, number>> = {}): Record<string, number> => ({
  plannedRevenueTicket: 100_000_000,
  plannedRevenueSponsorship: 50_000_000,
  plannedRevenueBroadcast: 0,     // manual-only, no system-of-record
  plannedRevenueMerchandise: 10_000_000,
  plannedRevenueSubsidy: 0,       // manual-only
  plannedRevenueParentCompany: 0, // manual-only
  plannedRevenueAcademyFee: 0,
  plannedRevenueOther: 0,
  ...overrides,
});
```

> Note: the current `makeReport` uses the old `revenueTicket` (pre-rename) names — which means the test file may already be stale vs post-#312. Verify by running `npm test -- budget-automation` on `main` before starting; if the existing tests pass with the pre-rename names, the rename hasn't touched the DTO's `REVENUE_KEYS`. Either way, the new `makeActuals` above uses the **current** DTO keys (`plannedRevenue*`).

- [ ] **Step 3: Remove `getFinancialReports` from `makeRepo`**

In the `makeRepo` factory, delete the `getFinancialReports: jest.fn().mockResolvedValue([...])` line (and the two per-test overrides that still supply it). The repo mock should no longer include this method.

- [ ] **Step 4: Add a `beforeEach` to set default helper behaviour**

Immediately below the `baseRequest` constant, add:

```typescript
beforeEach(() => {
  mockedGetSeasonRevenueActuals.mockReset();
  // Default: three seasons of revenue actuals (called once per seasonId in chrono order)
  mockedGetSeasonRevenueActuals
    .mockResolvedValueOnce(makeActuals())   // SEASON_2024
    .mockResolvedValueOnce(makeActuals())   // SEASON_2025
    .mockResolvedValueOnce(makeActuals());  // SEASON_2026
});
```

- [ ] **Step 5: Fix the `INSUFFICIENT_DATA` test to override the helper**

The existing test "sets INSUFFICIENT_DATA warning when only 1 season available" currently overrides `getFinancialReports`. Rewrite it to override the helper:

```typescript
it("sets INSUFFICIENT_DATA warning when only 1 season available", async () => {
  mockedGetSeasonRevenueActuals.mockReset();
  mockedGetSeasonRevenueActuals.mockResolvedValueOnce(makeActuals());
  const repo = makeRepo({
    getPastSeasons: jest.fn().mockResolvedValue([SEASON_2026]),
    getExpenseActualsByCategory: jest.fn().mockResolvedValue([
      makeExpenseRow(SEASON_2026.id, "TRAVEL", 24_000_000),
    ]),
  });
  const result = await new BudgetAutomationService(repo).preview(baseRequest);
  expect(result.expense.byCategory["TRAVEL"].warning).toBe("INSUFFICIENT_DATA");
});
```

- [ ] **Step 6: Preserve all other existing test cases**

The following tests should continue to pass unchanged in intent (only `getFinancialReports` mock removed — the helper `beforeEach` supplies the values):
- throws 404 when target season not found
- throws 400 when no historical seasons exist
- returns predictions with MAINTAIN goal (×1.0) applied
- applies AGGRESSIVE goal (×1.2) to expense
- applies categoryOverrides over expenseGoal
- sets LOW_UTILIZATION warning when actual < 50% of budget
- uses inflation parameter to increase predictions
- includes parameters echo in response
- `apply()` — calls createHeaderWithLines with correct totalBudget

For any test that constructs a fresh repo via `makeRepo({ ... })` inside the test body, remember it will consume the `beforeEach`-primed helper mock queue. If a test needs a different revenue actuals shape, call `mockedGetSeasonRevenueActuals.mockReset()` at the top of that test and re-queue values.

- [ ] **Step 7: Run tests**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/budget-automation/budget-automation.service.test.ts
```

Expected: all existing tests green.

- [ ] **Step 8: Commit**

```bash
git add apps/api/__test__/budget-automation/budget-automation.service.test.ts
git commit -m "test(budget-automation): mock getSeasonRevenueActuals helper instead of repo"
```

---

## Task 5: Add a manual-only revenue category regression test

**Files:**
- Modify: `apps/api/__test__/budget-automation/budget-automation.service.test.ts`

**Context:** Because `getSeasonRevenueActuals` returns `0` for BROADCAST/SUBSIDY/PARENT_COMPANY (no system-of-record yet), CAGR for these three keys always resolves to `INSUFFICIENT_DATA`. This is CORRECT and documents the manual-only nature — but a test should pin that behaviour so a future PR doesn't silently "fix" it by faking values.

- [ ] **Step 1: Add the test**

Inside the `describe("BudgetAutomationService.preview", ...)` block, append:

```typescript
it("returns INSUFFICIENT_DATA for manual-only revenue categories (BROADCAST, SUBSIDY, PARENT_COMPANY)", async () => {
  // Default beforeEach primes three seasons where those three keys = 0
  const result = await new BudgetAutomationService(makeRepo()).preview(baseRequest);

  expect(result.revenue.byCategory["plannedRevenueBroadcast"].warning).toBe("INSUFFICIENT_DATA");
  expect(result.revenue.byCategory["plannedRevenueSubsidy"].warning).toBe("INSUFFICIENT_DATA");
  expect(result.revenue.byCategory["plannedRevenueParentCompany"].warning).toBe("INSUFFICIENT_DATA");

  // Non-manual categories with actuals > 0 should NOT have INSUFFICIENT_DATA
  expect(result.revenue.byCategory["plannedRevenueTicket"].warning).not.toBe("INSUFFICIENT_DATA");
  expect(result.revenue.byCategory["plannedRevenueSponsorship"].warning).not.toBe("INSUFFICIENT_DATA");
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/budget-automation/budget-automation.service.test.ts
```

Expected: all tests green including the new one.

- [ ] **Step 3: Commit**

```bash
git add apps/api/__test__/budget-automation/budget-automation.service.test.ts
git commit -m "test(budget-automation): pin INSUFFICIENT_DATA for manual-only revenue categories"
```

---

## Task 6: Type-check whole api package + broader test sweep

**Files:**
- (verification only)

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 2: Run adjacent test suites that touch financial data**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/budget-automation __test__/dashboard __test__/ops-report 2>&1 | tail -30
```

Expected: all pass. If dashboard/ops-report tests fail, they likely depend on the `getFinancialReports` repo method through a different path — investigate before proceeding (should not happen per Task 1 Step 3 grep, but double-check).

- [ ] **Step 3: (No commit — verification step)**

---

## Task 7: (Optional) Document the actuals source in API response

**Files:**
- Modify: `apps/api/src/budget-automation/budget-automation.service.ts`
- Modify: `apps/api/src/budget-automation/dto/budget-automation.dto.ts`

**Context:** Downstream consumers reading the `preview` response cannot tell whether `revenue.byCategory[key].predicted` was derived from planned or actual values. Adding a small marker to the `parameters` block makes the source explicit and helps debugging.

- [ ] **Step 1: Extend `BudgetPreviewResponse["parameters"]`**

In `apps/api/src/budget-automation/dto/budget-automation.dto.ts`, add one field to the `parameters` interface:

```typescript
parameters: {
  targetSeasonId: number;
  lookback: number;
  inflation: number;
  revenueGoal: GoalWeight;
  expenseGoal: GoalWeight;
  categoryOverrides: Partial<Record<OperatingCategory, GoalWeight>>;
  seasonsUsed: number;
  revenueSource: "actuals";   // NEW — reserved for future modes (e.g. "planned" or "hybrid")
};
```

- [ ] **Step 2: Populate in service**

In `preview()`, extend the returned `parameters` object with `revenueSource: "actuals" as const`.

- [ ] **Step 3: Update `parameters echo` test**

Extend the existing "includes parameters echo in response" test with `expect(result.parameters.revenueSource).toBe("actuals");`.

- [ ] **Step 4: Verify + commit**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit && npx jest __test__/budget-automation
git add apps/api/src/budget-automation/dto/budget-automation.dto.ts apps/api/src/budget-automation/budget-automation.service.ts apps/api/__test__/budget-automation/budget-automation.service.test.ts
git commit -m "feat(budget-automation): expose revenueSource='actuals' in preview parameters"
```

> **Skip this task** if the executor deems it out-of-scope for the refactor. It's genuinely optional — the semantic fix is already complete after Task 6.

---

## Task 8: Branch, push, open PR

- [ ] **Step 1: Create branch (if not already on one)**

```bash
git checkout -b feat/budget-automation-actuals-cagr
```

- [ ] **Step 2: Push**

```bash
git push -u origin feat/budget-automation-actuals-cagr
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "refactor(budget-automation): compute revenue CAGR from live actuals (helper shared)" --body "$(cat <<'EOF'
## Summary
- Swap revenue CAGR source from `FinancialReport.plannedRevenue*` (planned values, post PR #312 rename) to live aggregates via the shared `getSeasonRevenueActuals(seasonId)` helper from PR B.
- Remove now-unused `BudgetAutomationRepository.getFinancialReports`.
- Rewrite service test suite to mock the helper at module level; add regression test pinning INSUFFICIENT_DATA for the three manual-only revenue categories (BROADCAST / SUBSIDY / PARENT_COMPANY).

## Why
- Planned CAGR ≠ actual growth trend — computing CAGR on planned values gave misleading forecasts.
- Reuses the helper introduced by PR B (auto-fill dashboard n-season average), keeping revenue-aggregation logic in one place.

## Depends on
- PR B — `docs/superpowers/plans/2026-08-22-auto-fill-n-season-average.md` (must be merged first; introduces `apps/api/src/lib/season-actuals.ts`).

## Test plan
- [ ] `npx tsc --noEmit` in `apps/api` — clean
- [ ] `npx jest __test__/budget-automation` — all pass including new regression test
- [ ] Manual smoke: `POST /budget-automation/preview` with a real seasonId returns revenue predictions where BROADCAST/SUBSIDY/PARENT_COMPANY carry `INSUFFICIENT_DATA` and other categories reflect SalesRecord/SponsorshipPayment/LedgerEntry aggregates
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Uses actuals aggregate for revenue CAGR (grill decision Q3) — replaces `frMap.get(id)?.[key]` with `perSeasonActuals[i][key]`
- Reuses PR B's `getSeasonRevenueActuals` helper — no duplicated aggregation logic
- DTO shape unchanged — `REVENUE_KEYS` (the 8 `plannedRevenue*` names) stays as the response key set; only the source of the numbers changes
- `apply()` unchanged — still delegates to `preview()` then persists via `createHeaderWithLines`
- Expense CAGR unchanged — already sourced from `OperatingExpense.groupBy` (real actuals)
- Existing test cases preserved with same intent; only mock target changes

**Non-goals:**
- No Prisma schema change
- No DTO shape change (Task 7 is optional and additive-only)
- No auto-fill / dashboard-refactor logic change (owned by PR B / issues #311)
- No frontend changes
- No change to the `apply()` transactional persistence path

**Known limitation (accepted per grill decision):**
- `plannedRevenueBroadcast`, `plannedRevenueSubsidy`, `plannedRevenueParentCompany` will always report `INSUFFICIENT_DATA` warning and predicted value derived from a base of `0` — because no system-of-record table backs them yet. Task 5's regression test pins this behaviour explicitly. Users will see these three categories as "manual entry required" in the frontend (existing behaviour post PR B dashboard rework).

**Follow-ups (out of scope):**
- Consider a `broadcastForecast` / `subsidyForecast` / `parentCompanySubsidyForecast` mini-domain (manual `create/list` for expected inflows) if repeated UX friction confirms these three fields need forward-looking projection
- Consider extending `revenueSource` (Task 7 marker) into a first-class enum once a "hybrid" mode is genuinely needed (e.g. actuals for current season + planned for target)
- Consider extracting `computeCagr` into a shared `apps/api/src/lib/cagr.ts` if a second module later needs the same growth-rate math
