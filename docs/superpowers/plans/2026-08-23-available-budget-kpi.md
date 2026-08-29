# 총 가용 예산 KPI (WageCapKPI 확장) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `WageCapKPI`(`/seasons/active/wage-cap-kpi`)를 확장해 사용자 공식 `총 가용 예산 = (당해 수익 + 전년도 이월금) − (∑선수 급여 + ∑직원 급여)`을 KPI로 제공한다. Planned(계획) + Actual(실측) 두 뷰 병기. Dashboard + FinancialReportPage + BudgetPlanPage(참고 카드) 세 곳에 노출.

**Architecture:** `FinancialReport`에 `carryOverFromPrev` 계열 4개 필드 추가 (자동 계산 + 수동 override). 신규 helper 2개(`season-salary.ts`, `season-carryover.ts`) 도입. `findActiveWithKPI` 응답 확장 (backwards-compatible). `closeSeason()` 훅에서 자동 이월. FE 3곳에 카드 추가.

**Tech Stack:** Prisma migration, TypeScript, React + shadcn/ui, jest.

**Scope 제한:**
- 편성 상한 강제 X (KPI 성격만) — Grill Q1 (c) 결정
- BudgetPlanPage에는 read-only 참고 카드만, 편집·검증 로직 없음
- `carryOverFromPrev` 자동 계산은 CLOSED 시즌 → 다음 시즌 방향으로만 (역방향 없음)

---

## File Structure

**Backend (new):**
- `apps/api/src/lib/season-salary.ts` — helper
- `apps/api/src/lib/season-carryover.ts` — helper
- `apps/api/__test__/lib/season-salary.test.ts`
- `apps/api/__test__/lib/season-carryover.test.ts`
- `apps/api/prisma/migrations/20260823010000_add_carry_over_from_prev/migration.sql`

**Backend (modified):**
- `apps/api/prisma/schema.prisma` — `FinancialReport` 4 field + `User` relation
- `apps/api/src/season/season.repo.ts` — `findActiveWithKPI` 확장
- `apps/api/src/season/season.service.ts` — `closeSeason` 훅 추가
- `apps/api/src/financial-report/financial-report.controller.ts` — override endpoint
- `apps/api/src/financial-report/financial-report.service.ts` — override method
- `apps/api/src/financial-report/financial-report.routes.ts` — `PATCH /:seasonId/carryover`

**Frontend (new):**
- `football/src/components/finance/AvailableBudgetCard.tsx` — 공용 KPI 카드
- `football/src/components/finance/CarryOverOverrideDialog.tsx` — 수동 조정 dialog

**Frontend (modified):**
- `football/src/types/season.ts` — `WageCapKPI` 확장
- `football/src/services/season.service.ts` — 변경 없음 (같은 endpoint)
- `football/src/services/financial-report.service.ts` — `overrideCarryOver` 추가
- `football/src/pages/admin/FinancialReportPage.tsx` — 카드 추가 + dialog 연결
- `football/src/pages/finance/DashboardCharts.tsx` — 4번째 gauge
- `football/src/components/budget-plan/BudgetPlanWizard.tsx` — 마지막 페이지에 참고 카드

---

## Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260823010000_add_carry_over_from_prev/migration.sql`

- [ ] **Step 1: schema.prisma에 필드 추가**

`FinancialReport` 모델에 추가 (기존 필드 아래):
```prisma
model FinancialReport {
  // ... 기존 필드
  carryOverFromPrev        Float     @default(0)
  carryOverOverriddenById  Int?
  carryOverOverriddenAt    DateTime?
  carryOverOverrideReason  String?
  // ... 기존 relations
  carryOverOverriddenBy    User?     @relation("CarryOverOverrider", fields: [carryOverOverriddenById], references: [id])
}
```

`User` 모델에 relation 추가:
```prisma
model User {
  // ... 기존
  carryOverOverrides FinancialReport[] @relation("CarryOverOverrider")
}
```

- [ ] **Step 2: 마이그레이션 SQL**

```sql
-- apps/api/prisma/migrations/20260823010000_add_carry_over_from_prev/migration.sql
ALTER TABLE "FinancialReport"
  ADD COLUMN "carryOverFromPrev"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "carryOverOverriddenById"  INTEGER,
  ADD COLUMN "carryOverOverriddenAt"    TIMESTAMP(3),
  ADD COLUMN "carryOverOverrideReason"  TEXT;

ALTER TABLE "FinancialReport"
  ADD CONSTRAINT "FinancialReport_carryOverOverriddenById_fkey"
  FOREIGN KEY ("carryOverOverriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: DB 적용 + Prisma resolve**

```bash
cd apps/api
psql football -f prisma/migrations/20260823010000_add_carry_over_from_prev/migration.sql
npx prisma migrate resolve --applied 20260823010000_add_carry_over_from_prev
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(schema): add carryOverFromPrev + override fields to FinancialReport"
```

---

## Task 2: season-salary helper + tests

**Files:**
- Create: `apps/api/src/lib/season-salary.ts`
- Create: `apps/api/__test__/lib/season-salary.test.ts`

- [ ] **Step 1: helper 구현**

```typescript
// apps/api/src/lib/season-salary.ts
import type { PrismaClient } from "../generated/client";

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

async function overlapPlayerSalary(prisma: PrismaClient, seasonId: number): Promise<number> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { startDate: true, endDate: true },
  });
  if (!season) return 0;
  const contracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: season.endDate },
      endDate: { gte: season.startDate },
    },
    select: { salary: true, startDate: true, endDate: true },
  });
  return contracts.reduce((sum, c) => {
    const overlapStart = c.startDate > season.startDate ? c.startDate : season.startDate;
    const overlapEnd   = c.endDate   < season.endDate   ? c.endDate   : season.endDate;
    if (overlapEnd <= overlapStart) return sum;
    const months = (overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_MONTH;
    return sum + (c.salary / 12) * months;
  }, 0);
}

async function plannedStaffSalary(prisma: PrismaClient, seasonId: number): Promise<number> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { startDate: true, endDate: true },
  });
  if (!season) return 0;
  const salaries = await prisma.staffSalary.findMany({
    where: {
      effectiveFrom: { lte: season.endDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: season.startDate } }],
    },
    select: { id: true, baseSalary: true, effectiveFrom: true, effectiveTo: true, allowances: { select: { amount: true } } },
  });
  return salaries.reduce((sum, s) => {
    const from = s.effectiveFrom > season.startDate ? s.effectiveFrom : season.startDate;
    const to   = s.effectiveTo && s.effectiveTo < season.endDate ? s.effectiveTo : season.endDate;
    if (to <= from) return sum;
    const months = (to.getTime() - from.getTime()) / MS_PER_MONTH;
    const baseAnnual = Number(s.baseSalary);
    const allowanceMonthly = s.allowances.reduce((a, x) => a + Number(x.amount), 0);
    return sum + (baseAnnual / 12 + allowanceMonthly) * months;
  }, 0);
}

async function actualStaffSalary(prisma: PrismaClient, seasonId: number): Promise<number> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { startDate: true, endDate: true },
  });
  if (!season) return 0;
  const runs = await prisma.payrollRun.aggregate({
    where: { month: { gte: season.startDate, lte: season.endDate }, status: "PAID" },
    _sum: { grossPay: true },
  });
  return Number(runs._sum.grossPay ?? 0);
}

export async function getSeasonPlayerSalary(prisma: PrismaClient, seasonId: number): Promise<number> {
  return Math.round(await overlapPlayerSalary(prisma, seasonId));
}

export async function getSeasonStaffSalary(
  prisma: PrismaClient,
  seasonId: number,
  mode: "planned" | "actual"
): Promise<number> {
  const planned = await plannedStaffSalary(prisma, seasonId);
  if (mode === "planned") return Math.round(planned);
  const actual = await actualStaffSalary(prisma, seasonId);
  return Math.round(actual > 0 ? actual : planned);   // fallback to planned
}
```

- [ ] **Step 2: 단위 테스트**

```typescript
// apps/api/__test__/lib/season-salary.test.ts
import { getSeasonPlayerSalary, getSeasonStaffSalary } from "../../src/lib/season-salary";

const seasonRow = { startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") };

const makePrisma = (overrides: any = {}) => ({
  season: { findUnique: jest.fn().mockResolvedValue(seasonRow) },
  contract: { findMany: jest.fn().mockResolvedValue([]) },
  staffSalary: { findMany: jest.fn().mockResolvedValue([]) },
  payrollRun: { aggregate: jest.fn().mockResolvedValue({ _sum: { grossPay: 0 } }) },
  ...overrides,
}) as any;

describe("getSeasonPlayerSalary", () => {
  it("returns 0 when no contracts", async () => {
    expect(await getSeasonPlayerSalary(makePrisma(), 1)).toBe(0);
  });
  it("overlaps contract with season correctly", async () => {
    const p = makePrisma({
      contract: { findMany: jest.fn().mockResolvedValue([
        { salary: 120_000_000, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
      ]) },
    });
    // full year overlap → 120M
    const v = await getSeasonPlayerSalary(p, 1);
    expect(v).toBeGreaterThan(118_000_000);
    expect(v).toBeLessThan(122_000_000);
  });
});

describe("getSeasonStaffSalary", () => {
  it("planned mode uses StaffSalary + allowances", async () => {
    const p = makePrisma({
      staffSalary: { findMany: jest.fn().mockResolvedValue([
        {
          id: 1, baseSalary: 60_000_000,
          effectiveFrom: new Date("2026-01-01"), effectiveTo: null,
          allowances: [{ amount: 200_000 }],  // monthly
        },
      ]) },
    });
    const v = await getSeasonStaffSalary(p, 1, "planned");
    // 60M annual + 200k*12 = 62.4M ~
    expect(v).toBeGreaterThan(61_000_000);
    expect(v).toBeLessThan(63_500_000);
  });
  it("actual mode uses PayrollRun sum", async () => {
    const p = makePrisma({
      payrollRun: { aggregate: jest.fn().mockResolvedValue({ _sum: { grossPay: 30_000_000 } }) },
      staffSalary: { findMany: jest.fn().mockResolvedValue([]) },   // fallback anchor
    });
    const v = await getSeasonStaffSalary(p, 1, "actual");
    expect(v).toBe(30_000_000);
  });
  it("actual mode falls back to planned when PayrollRun empty", async () => {
    const p = makePrisma({
      payrollRun: { aggregate: jest.fn().mockResolvedValue({ _sum: { grossPay: null } }) },
      staffSalary: { findMany: jest.fn().mockResolvedValue([
        { id: 1, baseSalary: 60_000_000, effectiveFrom: new Date("2026-01-01"), effectiveTo: null, allowances: [] },
      ]) },
    });
    const v = await getSeasonStaffSalary(p, 1, "actual");
    expect(v).toBeGreaterThan(59_000_000);
  });
});
```

- [ ] **Step 3: `cd apps/api && npx jest __test__/lib/season-salary --no-coverage`** — 5/5 통과

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/season-salary.ts apps/api/__test__/lib/season-salary.test.ts
git commit -m "feat(finance): add season-salary helper (player + staff, planned/actual)"
```

---

## Task 3: season-carryover helper + tests

**Files:**
- Create: `apps/api/src/lib/season-carryover.ts`
- Create: `apps/api/__test__/lib/season-carryover.test.ts`

- [ ] **Step 1: helper 구현**

```typescript
// apps/api/src/lib/season-carryover.ts
import type { PrismaClient } from "../generated/client";

export async function computeSeasonNetIncome(prisma: PrismaClient, seasonId: number): Promise<number> {
  const agg = await prisma.monthlySettlementReport.aggregate({
    where: { seasonId, status: "APPROVED" },
    _sum: { totalRevenue: true, totalExpense: true },
  });
  const rev = Number(agg._sum.totalRevenue ?? 0);
  const exp = Number(agg._sum.totalExpense ?? 0);
  return Math.round(rev - exp);
}

export async function applyCarryOverToNextSeason(prisma: PrismaClient, closedSeasonId: number): Promise<{ applied: boolean; nextSeasonId?: number; amount?: number }> {
  const closed = await prisma.season.findUnique({ where: { id: closedSeasonId }, select: { endDate: true } });
  if (!closed) return { applied: false };

  const next = await prisma.season.findFirst({
    where: { startDate: { gt: closed.endDate } },
    orderBy: { startDate: "asc" },
    select: { id: true },
  });
  if (!next) return { applied: false };

  // 기존 override 있으면 덮어쓰지 않음
  const existing = await prisma.financialReport.findUnique({
    where: { seasonId: next.id },
    select: { carryOverOverriddenById: true },
  });
  if (existing?.carryOverOverriddenById) return { applied: false, nextSeasonId: next.id };

  const amount = await computeSeasonNetIncome(prisma, closedSeasonId);
  await prisma.financialReport.upsert({
    where: { seasonId: next.id },
    create: { seasonId: next.id, totalRevenue: 0, carryOverFromPrev: amount },
    update: { carryOverFromPrev: amount, carryOverOverriddenById: null, carryOverOverriddenAt: null, carryOverOverrideReason: null },
  });
  return { applied: true, nextSeasonId: next.id, amount };
}
```

- [ ] **Step 2: 단위 테스트**

```typescript
// apps/api/__test__/lib/season-carryover.test.ts
import { computeSeasonNetIncome, applyCarryOverToNextSeason } from "../../src/lib/season-carryover";

const makePrisma = (overrides: any = {}) => ({
  monthlySettlementReport: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalRevenue: 0, totalExpense: 0 } }) },
  season: {
    findUnique: jest.fn().mockResolvedValue({ endDate: new Date("2025-12-31") }),
    findFirst: jest.fn().mockResolvedValue({ id: 2 }),
  },
  financialReport: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
  },
  ...overrides,
}) as any;

describe("computeSeasonNetIncome", () => {
  it("returns 0 when no reports", async () => {
    expect(await computeSeasonNetIncome(makePrisma(), 1)).toBe(0);
  });
  it("returns revenue - expense", async () => {
    const p = makePrisma({
      monthlySettlementReport: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalRevenue: 100_000_000, totalExpense: 60_000_000 } }) },
    });
    expect(await computeSeasonNetIncome(p, 1)).toBe(40_000_000);
  });
});

describe("applyCarryOverToNextSeason", () => {
  it("skips when no next season", async () => {
    const p = makePrisma({ season: { findUnique: jest.fn().mockResolvedValue({ endDate: new Date("2025-12-31") }), findFirst: jest.fn().mockResolvedValue(null) } });
    const r = await applyCarryOverToNextSeason(p, 1);
    expect(r.applied).toBe(false);
  });
  it("skips write when next season has manual override", async () => {
    const p = makePrisma({
      financialReport: {
        findUnique: jest.fn().mockResolvedValue({ carryOverOverriddenById: 5 }),
        upsert: jest.fn(),
      },
    });
    const r = await applyCarryOverToNextSeason(p, 1);
    expect(r.applied).toBe(false);
    expect(p.financialReport.upsert).not.toHaveBeenCalled();
  });
  it("upserts carryOverFromPrev on next season when no override", async () => {
    const p = makePrisma({
      monthlySettlementReport: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalRevenue: 100_000_000, totalExpense: 60_000_000 } }) },
    });
    const r = await applyCarryOverToNextSeason(p, 1);
    expect(r.applied).toBe(true);
    expect(r.amount).toBe(40_000_000);
    expect(p.financialReport.upsert).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: `cd apps/api && npx jest __test__/lib/season-carryover --no-coverage`** — 5/5 통과

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/season-carryover.ts apps/api/__test__/lib/season-carryover.test.ts
git commit -m "feat(finance): add season-carryover helper (netIncome + applyCarryOverToNextSeason)"
```

---

## Task 4: WageCapKPI 응답 확장 (backwards-compatible)

**Files:**
- Modify: `apps/api/src/season/season.repo.ts`

- [ ] **Step 1: findActiveWithKPI 확장**

기존 함수 마지막의 return 문 앞에 신규 helper 호출 병렬 추가:
```typescript
const [
  currentRevenueActuals,
  playerSalary,
  staffPlanned,
  staffActual,
  fr,
] = await Promise.all([
  // 신규 helper import: import { getSeasonRevenueActuals } from "../lib/season-actuals";
  //                    import { getSeasonPlayerSalary, getSeasonStaffSalary } from "../lib/season-salary";
  getSeasonRevenueActuals(this.prisma, season.id),
  getSeasonPlayerSalary(this.prisma, season.id),
  getSeasonStaffSalary(this.prisma, season.id, "planned"),
  getSeasonStaffSalary(this.prisma, season.id, "actual"),
  this.prisma.financialReport.findUnique({
    where: { seasonId: season.id },
    select: {
      carryOverFromPrev: true,
      carryOverOverriddenById: true,
      carryOverOverriddenAt: true,
      carryOverOverrideReason: true,
    },
  }),
]);

const revenuePlanned = totalRevenue ?? 0;
const revenueActual =
  currentRevenueActuals.plannedRevenueTicket +
  currentRevenueActuals.plannedRevenueSponsorship +
  currentRevenueActuals.plannedRevenueBroadcast +
  currentRevenueActuals.plannedRevenueMerchandise +
  currentRevenueActuals.plannedRevenueSubsidy +
  currentRevenueActuals.plannedRevenueParentCompany +
  currentRevenueActuals.plannedRevenueAcademyFee +
  currentRevenueActuals.plannedRevenueOther;
const carry = Number(fr?.carryOverFromPrev ?? 0);

return {
  // ── 기존 필드 (backwards-compat, 반드시 유지) ─────────────
  wageCapType: season.wageCapType,
  wageCapValue: season.wageCapValue,
  totalRevenue,
  cap,
  totalPayroll,
  percentUsed: cap != null ? Math.round((totalPayroll / cap) * 1000) / 10 : null,
  remaining: cap != null ? cap - totalPayroll : null,
  // ── 신규 필드 (available budget) ───────────────────────────
  revenue: { planned: revenuePlanned, actual: Math.round(revenueActual) },
  carryOverFromPrev: {
    amount: carry,
    isAutoCalculated: !fr?.carryOverOverriddenById,
    overriddenAt: fr?.carryOverOverriddenAt ?? null,
    overriddenById: fr?.carryOverOverriddenById ?? null,
    overrideReason: fr?.carryOverOverrideReason ?? null,
  },
  playerSalary: { planned: playerSalary, actual: playerSalary },
  staffSalary: { planned: staffPlanned, actual: staffActual },
  availableBudget: {
    planned: revenuePlanned + carry - playerSalary - staffPlanned,
    actual: Math.round(revenueActual) + carry - playerSalary - staffActual,
  },
};
```

- [ ] **Step 2: TS 확인 + Commit**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep season | head -5
git add apps/api/src/season/season.repo.ts
git commit -m "feat(season): extend WageCapKPI with availableBudget breakdown (backwards-compat)"
```

---

## Task 5: closeSeason 훅에서 자동 이월

**Files:**
- Modify: `apps/api/src/season/season.service.ts`

- [ ] **Step 1: 현재 closeSeason 구조 확인**

```bash
grep -B2 -A15 "closeSeason" /Users/juno/work/football/apps/api/src/season/season.service.ts
```

- [ ] **Step 2: 자동 이월 훅 삽입**

`closeSeason(id)` 함수의 반환 직전에:
```typescript
import { applyCarryOverToNextSeason } from "../lib/season-carryover";
// ...
async closeSeason(id: number) {
  const closed = await this.repo.closeSeason(id);
  try {
    await applyCarryOverToNextSeason(getPrisma(), id);
  } catch (err) {
    console.warn(`[closeSeason] carryover 자동 적용 실패 (seasonId=${id})`, err);
  }
  return closed;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/season/season.service.ts
git commit -m "feat(season): auto-carry netIncome to next season on closeSeason"
```

---

## Task 6: PATCH /financial-reports/:seasonId/carryover (수동 override)

**Files:**
- Modify: `apps/api/src/financial-report/financial-report.service.ts`
- Modify: `apps/api/src/financial-report/financial-report.controller.ts`
- Modify: `apps/api/src/financial-report/financial-report.routes.ts`

- [ ] **Step 1: service method**

```typescript
async overrideCarryOver(seasonId: number, dto: { amount: number; reason: string }, userId: number) {
  if (!dto.reason?.trim()) throw new AppError(400, "REASON_REQUIRED");
  if (typeof dto.amount !== "number" || !Number.isFinite(dto.amount)) throw new AppError(400, "INVALID_AMOUNT");
  return this.repo.upsertFinancialReportCarryOver(seasonId, {
    amount: dto.amount,
    overriddenById: userId,
    reason: dto.reason.trim(),
  });
}
```

- [ ] **Step 2: repo method**

```typescript
// financial-report.repo.ts
async upsertFinancialReportCarryOver(seasonId: number, data: { amount: number; overriddenById: number; reason: string }) {
  return this.prisma.financialReport.upsert({
    where: { seasonId },
    create: {
      seasonId, totalRevenue: 0,
      carryOverFromPrev: data.amount,
      carryOverOverriddenById: data.overriddenById,
      carryOverOverriddenAt: new Date(),
      carryOverOverrideReason: data.reason,
    },
    update: {
      carryOverFromPrev: data.amount,
      carryOverOverriddenById: data.overriddenById,
      carryOverOverriddenAt: new Date(),
      carryOverOverrideReason: data.reason,
    },
    select: {
      seasonId: true, carryOverFromPrev: true,
      carryOverOverriddenById: true, carryOverOverriddenAt: true, carryOverOverrideReason: true,
    },
  });
}
```

- [ ] **Step 3: controller + route**

```typescript
// controller
overrideCarryOver = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole, id: userId } = requireUser(req);
    if (!canWriteFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
    const seasonId = Number(req.params["seasonId"]);
    const result = await this.service.overrideCarryOver(seasonId, req.body, userId);
    res.json(result);
  } catch (err) { next(err); }
};
// routes
router.patch("/:seasonId/carryover", auth, controller.overrideCarryOver);
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/financial-report
git commit -m "feat(financial-report): PATCH /:seasonId/carryover for manual override"
```

---

## Task 7: FE type + 공용 카드 컴포넌트

**Files:**
- Modify: `football/src/types/season.ts`
- Create: `football/src/components/finance/AvailableBudgetCard.tsx`

- [ ] **Step 1: `WageCapKPI` 확장 (backwards-compat, 새 필드 optional)**

```typescript
export interface WageCapKPI {
  // 기존
  wageCapType: WageCapType | null
  wageCapValue: number | null
  totalRevenue: number | null
  cap: number | null
  totalPayroll: number
  percentUsed: number | null
  remaining: number | null
  // 신규
  revenue?: { planned: number; actual: number }
  carryOverFromPrev?: {
    amount: number
    isAutoCalculated: boolean
    overriddenAt: string | null
    overriddenById: number | null
    overrideReason: string | null
  }
  playerSalary?: { planned: number; actual: number }
  staffSalary?: { planned: number; actual: number }
  availableBudget?: { planned: number; actual: number }
}
```

- [ ] **Step 2: 공용 카드 컴포넌트**

```tsx
// football/src/components/finance/AvailableBudgetCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WageCapKPI } from '@/types/season'

interface Props {
  kpi: WageCapKPI
  showOverrideButton?: boolean
  onOverride?: () => void
}

const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(Math.round(n))

export function AvailableBudgetCard({ kpi, showOverrideButton, onOverride }: Props) {
  const avail = kpi.availableBudget
  const co = kpi.carryOverFromPrev
  const rev = kpi.revenue
  const ps = kpi.playerSalary
  const ss = kpi.staffSalary
  if (!avail || !co || !rev || !ps || !ss) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">가용 예산 데이터 없음</CardContent></Card>
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">가용 예산</CardTitle>
        {co.isAutoCalculated
          ? <Badge variant="outline" className="text-xs">이월 자동</Badge>
          : <Badge className="text-xs">이월 수동 조정</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">계획 (Planned)</div>
            <div className={`text-xl font-mono ${avail.planned < 0 ? 'text-red-600' : ''}`}>₩{fmt(avail.planned)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">실측 (Actual)</div>
            <div className={`text-xl font-mono ${avail.actual < 0 ? 'text-red-600' : ''}`}>₩{fmt(avail.actual)}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
          <div>수익: 계획 ₩{fmt(rev.planned)} / 실측 ₩{fmt(rev.actual)}</div>
          <div>이월금: ₩{fmt(co.amount)} {co.overriddenAt && <>({co.overrideReason})</>}</div>
          <div>선수 급여: ₩{fmt(ps.planned)}</div>
          <div>직원 급여: 계획 ₩{fmt(ss.planned)} / 실측 ₩{fmt(ss.actual)}</div>
        </div>
        {showOverrideButton && onOverride && (
          <button className="w-full text-xs text-primary underline mt-2" onClick={onOverride}>
            이월금 수동 조정
          </button>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add football/src/types/season.ts football/src/components/finance/AvailableBudgetCard.tsx
git commit -m "feat(finance): add AvailableBudgetCard shared component + WageCapKPI type extension"
```

---

## Task 8: FinancialReportPage — 카드 + override dialog

**Files:**
- Modify: `football/src/pages/admin/FinancialReportPage.tsx`
- Modify: `football/src/services/financial-report.service.ts`
- Create: `football/src/components/finance/CarryOverOverrideDialog.tsx`

- [ ] **Step 1: service method**

```typescript
// financial-report.service.ts
overrideCarryOver: (seasonId: number, data: { amount: number; reason: string }) =>
  api.patch(`/financial-reports/${seasonId}/carryover`, data),
```

- [ ] **Step 2: dialog 컴포넌트**

```tsx
// CarryOverOverrideDialog.tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  currentAmount: number
  onSubmit: (amount: number, reason: string) => Promise<void>
}

export function CarryOverOverrideDialog({ open, onOpenChange, currentAmount, onSubmit }: Props) {
  const [amount, setAmount] = useState(currentAmount.toString())
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    try {
      await onSubmit(Number(amount), reason.trim())
      onOpenChange(false)
    } finally { setSaving(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>이월금 수동 조정</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>이월금 (원)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>사유</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 리스크 준비금 차감" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={submit} disabled={saving || !reason.trim()}>{saving ? '저장 중...' : '조정'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: FinancialReportPage에 카드 + dialog 통합**

기존 WageCapKPI 카드 아래에 `<AvailableBudgetCard>` 배치. `showOverrideButton={canWriteFinance}` + `onOverride={() => setDialogOpen(true)}`. Dialog submit 시 `financialReportApi.overrideCarryOver(activeSeason.id, ...)` 호출 → `fetchAll()` 재갱신.

- [ ] **Step 4: Commit**

```bash
git add football/src/pages/admin/FinancialReportPage.tsx football/src/services/financial-report.service.ts football/src/components/finance/CarryOverOverrideDialog.tsx
git commit -m "feat(financial-report-page): available budget card + carryover override dialog"
```

---

## Task 9: DashboardCharts — 4번째 gauge

**Files:**
- Modify: `football/src/pages/finance/DashboardCharts.tsx`

- [ ] **Step 1: 카드 추가**

기존 gauges 카드 아래에 `<AvailableBudgetCard kpi={wageCapKpi} />` (또는 gauges 그리드에 합쳐 4개 카드). `seasonApi.getWageCapKPI()` 로 fetch. Loading/error 처리.

- [ ] **Step 2: Commit**

```bash
git add football/src/pages/finance/DashboardCharts.tsx
git commit -m "feat(dashboard): add 4th gauge card (available budget)"
```

---

## Task 10: BudgetPlanWizard — 마지막 페이지 참고 카드 (Grill Q9 재조정)

**Files:**
- Modify: `football/src/components/budget-plan/BudgetPlanWizard.tsx`

- [ ] **Step 1: 마지막 페이지에 카드 배치**

`isLast === true`일 때 `renderAdvancedOnLastPage` slot 위 또는 아래에:
```tsx
{isLast && wageCapKpi && (
  <div className="space-y-1">
    <div className="text-xs text-muted-foreground px-1">참고: 이 값은 편성 상한이 아니며 정보 표시입니다</div>
    <AvailableBudgetCard kpi={wageCapKpi} />
  </div>
)}
```

`wageCapKpi`는 prop 또는 wizard 안에서 fetch. 후자가 단순 (Wizard 자체 초기 로드 시 `seasonApi.getWageCapKPI()` 호출).

- [ ] **Step 2: Commit**

```bash
git add football/src/components/budget-plan/BudgetPlanWizard.tsx
git commit -m "feat(budget-plan): show read-only available budget card on last wizard page"
```

---

## Task 11: 통합 검증 + PR

- [ ] **Step 1: TS + jest**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -E "season|financial-report|carry" | head -5
cd apps/api && npx jest __test__/lib __test__/financial-report --no-coverage 2>&1 | tail -10
cd football && npx tsc --noEmit 2>&1 | grep -E "WageCap|carry|budget-plan|AvailableBudget" | head -5
```

- [ ] **Step 2: curl 스모크**

```bash
# admin 토큰 획득 후 (예: from cookies or Authorization header)
curl -s http://localhost:3001/api/seasons/active/wage-cap-kpi -H "Cookie: <admin session>" | python3 -m json.tool | head -30
# 새 필드 revenue/carryOverFromPrev/playerSalary/staffSalary/availableBudget 존재 확인
```

- [ ] **Step 3: 브라우저**
- FinancialReportPage → 가용 예산 카드 표시 + 이월금 수동 조정 dialog 동작
- Dashboard → 4번째 gauge 표시
- BudgetPlanPage wizard 마지막 페이지 → 참고 카드 표시 + "편성 상한 아님" 문구

- [ ] **Step 4: PR 생성 + 머지**

```bash
git checkout -b feat/available-budget-kpi
git push -u origin feat/available-budget-kpi
gh pr create --title "feat(finance): available budget KPI (WageCapKPI extended + carryover)" \
             --body "..." # (Grill Q1-Q10 요약 첨부)
gh pr merge <PR#> --squash --delete-branch
```

---

## Self-Review

**Spec coverage:**
- ✅ Q1 (c) KPI 성격 — WageCapKPI 확장, 강제 X
- ✅ Q2 Planned + Actual 두 뷰 — 모든 요소 병기
- ✅ Q3 이월금 = netIncome, FinancialReport 필드, 자동+수동
- ✅ Q4 선수 급여 = getActuals 안분 재사용 (helper 분리)
- ✅ Q5 직원 급여 = StaffSalary+allowance planned, PayrollRun actual, fallback
- ✅ Q6 WageCapKPI 확장 (새 endpoint X)
- ✅ Q7 backwards-compat (기존 4필드 유지)
- ✅ Q8 closeSeason 훅
- ✅ Q9 재조정: Dashboard + FinancialReport + BudgetPlan 참고 카드 (5번)

**Non-goals:**
- 편성 상한 강제
- Ledger 실시간 계산
- KPI 캐싱 정책 (기본 no-cache; 필요 시 나중에)

**Follow-ups:**
- StaffSalary/PayrollRun seed는 별도 plan `2026-08-23-staff-salary-seed.md` (병렬 진행)
- Player 실지급 이력(LedgerEntry PLAYER_SALARY) 도입 시 `getSeasonPlayerSalary` actual mode 추가
- KPI 응답 캐싱 (5분 in-memory) — 실측 aggregate 부하 관찰 후
