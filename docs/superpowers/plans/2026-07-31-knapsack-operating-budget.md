# Knapsack 운영비 예산 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** GM이 시즌 초 운영비를 카테고리별 티어(Basic/Standard/Premium)로 정의하고, 0/1 Knapsack으로 재량 예산을 최적 배분하며, 실제 지출과 비교하는 대시보드를 구현한다.

**Architecture:** `KnapsackService`(순수 계산)를 별도 파일로 분리해 단위 테스트. `FinancialReport`에 `totalOperatingBudget`·`contingencyReserve` 추가, `BudgetCategoryPlan`·`BudgetTier`·`BudgetOverrideLog` 신규 모델. TRAVEL/EQUIPMENT/SCOUTING/YOUTH 지출은 신규 `OperatingExpense` 모듈로 단순 기록. 실적 집계는 Pull 방식(조회 시 합산).

**Tech Stack:** Prisma (PostgreSQL), Express + TypeScript (BE), React + TypeScript + shadcn/ui + sonner (FE), Jest (BE 단위 테스트)

---

## 파일 맵

### Task 1: 스키마 + 마이그레이션
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260731000003_knapsack_budget/migration.sql`

### Task 2: KnapsackService (단위 테스트 포함)
- Create: `apps/api/src/budget/knapsack.service.ts`
- Create: `apps/api/__test__/budget/knapsack.service.test.ts`

### Task 3: Budget Plan BE (FinancialReport 확장)
- Modify: `apps/api/src/financial-report/financial-report.repo.ts`
- Modify: `apps/api/src/financial-report/financial-report.service.ts`
- Modify: `apps/api/src/financial-report/financial-report.controller.ts`
- Modify: `apps/api/src/financial-report/financial-report.routes.ts`

### Task 4: OperatingExpense BE
- Create: `apps/api/src/operating-expense/operating-expense.repo.ts`
- Create: `apps/api/src/operating-expense/operating-expense.service.ts`
- Create: `apps/api/src/operating-expense/operating-expense.controller.ts`
- Create: `apps/api/src/operating-expense/operating-expense.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

### Task 5: FE 타입 + 서비스
- Create: `football/src/types/budget.ts`
- Modify: `football/src/services/financial-report.service.ts`
- Create: `football/src/services/operating-expense.service.ts`

### Task 6: FE BudgetPlanPage
- Create: `football/src/pages/admin/BudgetPlanPage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/locales/ko/admin.json`

### Task 7: FE OperatingExpensePage
- Create: `football/src/pages/admin/OperatingExpensePage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/locales/ko/admin.json`

---

## Task 1: 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260731000003_knapsack_budget/migration.sql`

- [x] **Step 1: schema.prisma 수정**

`FinancialReport` 모델에 필드 추가:

```prisma
model FinancialReport {
  id                   Int      @id @default(autoincrement())
  seasonId             Int      @unique
  totalRevenue         Int
  totalOperatingBudget Int?
  contingencyReserve   Int?     @default(0)
  note                 String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  season               Season   @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  budgetCategoryPlans  BudgetCategoryPlan[]
  overrideLogs         BudgetOverrideLog[]
}
```

파일 끝(Department 모델 아래)에 신규 모델 추가:

```prisma
enum OperatingCategory {
  MEDICAL
  MEAL
  TRAVEL
  EQUIPMENT
  SCOUTING
  YOUTH
}

model BudgetCategoryPlan {
  id                Int               @id @default(autoincrement())
  financialReportId Int
  category          OperatingCategory
  mandatoryMinimum  Int               @default(0)
  knapsackAllocated Int?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  financialReport   FinancialReport   @relation(fields: [financialReportId], references: [id], onDelete: Cascade)
  tiers             BudgetTier[]

  @@unique([financialReportId, category])
}

model BudgetTier {
  id             Int                @id @default(autoincrement())
  categoryPlanId Int
  name           String
  cost           Int
  value          Int
  isSelected     Boolean            @default(false)
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  categoryPlan   BudgetCategoryPlan @relation(fields: [categoryPlanId], references: [id], onDelete: Cascade)
}

model BudgetOverrideLog {
  id                Int               @id @default(autoincrement())
  financialReportId Int
  category          OperatingCategory
  amount            Int
  reason            String
  createdById       Int
  createdAt         DateTime          @default(now())
  financialReport   FinancialReport   @relation(fields: [financialReportId], references: [id], onDelete: Cascade)
  createdBy         User              @relation("BudgetOverrideLogCreator", fields: [createdById], references: [id])
}

model OperatingExpense {
  id          Int               @id @default(autoincrement())
  seasonId    Int
  category    OperatingCategory
  amount      Int
  date        DateTime
  note        String?
  createdById Int
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  season      Season            @relation(fields: [seasonId], references: [id])
  createdBy   User              @relation("OperatingExpenseCreator", fields: [createdById], references: [id])
}
```

`User` 모델에 relation 추가 (기존 relation 목록 끝에):

```prisma
  budgetOverrideLogs BudgetOverrideLog[] @relation("BudgetOverrideLogCreator")
  operatingExpenses  OperatingExpense[]  @relation("OperatingExpenseCreator")
```

`Season` 모델에 relation 추가:

```prisma
  operatingExpenses OperatingExpense[]
```

- [x] **Step 2: 마이그레이션 SQL 작성**

```bash
mkdir -p /Users/juno/work/football/apps/api/prisma/migrations/20260731000003_knapsack_budget
```

`apps/api/prisma/migrations/20260731000003_knapsack_budget/migration.sql`:

```sql
-- FinancialReport에 예산 필드 추가
ALTER TABLE "FinancialReport"
  ADD COLUMN "totalOperatingBudget" INTEGER,
  ADD COLUMN "contingencyReserve"   INTEGER NOT NULL DEFAULT 0;

-- OperatingCategory enum
CREATE TYPE "OperatingCategory" AS ENUM ('MEDICAL','MEAL','TRAVEL','EQUIPMENT','SCOUTING','YOUTH');

-- BudgetCategoryPlan
CREATE TABLE "BudgetCategoryPlan" (
  "id"                SERIAL NOT NULL,
  "financialReportId" INTEGER NOT NULL,
  "category"          "OperatingCategory" NOT NULL,
  "mandatoryMinimum"  INTEGER NOT NULL DEFAULT 0,
  "knapsackAllocated" INTEGER,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetCategoryPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BudgetCategoryPlan_financialReportId_category_key"
  ON "BudgetCategoryPlan"("financialReportId","category");
ALTER TABLE "BudgetCategoryPlan"
  ADD CONSTRAINT "BudgetCategoryPlan_financialReportId_fkey"
  FOREIGN KEY ("financialReportId") REFERENCES "FinancialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BudgetTier
CREATE TABLE "BudgetTier" (
  "id"             SERIAL NOT NULL,
  "categoryPlanId" INTEGER NOT NULL,
  "name"           TEXT NOT NULL,
  "cost"           INTEGER NOT NULL,
  "value"          INTEGER NOT NULL,
  "isSelected"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetTier_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "BudgetTier"
  ADD CONSTRAINT "BudgetTier_categoryPlanId_fkey"
  FOREIGN KEY ("categoryPlanId") REFERENCES "BudgetCategoryPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BudgetOverrideLog
CREATE TABLE "BudgetOverrideLog" (
  "id"                SERIAL NOT NULL,
  "financialReportId" INTEGER NOT NULL,
  "category"          "OperatingCategory" NOT NULL,
  "amount"            INTEGER NOT NULL,
  "reason"            TEXT NOT NULL,
  "createdById"       INTEGER NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetOverrideLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "BudgetOverrideLog"
  ADD CONSTRAINT "BudgetOverrideLog_financialReportId_fkey"
  FOREIGN KEY ("financialReportId") REFERENCES "FinancialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetOverrideLog"
  ADD CONSTRAINT "BudgetOverrideLog_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;

-- OperatingExpense
CREATE TABLE "OperatingExpense" (
  "id"          SERIAL NOT NULL,
  "seasonId"    INTEGER NOT NULL,
  "category"    "OperatingCategory" NOT NULL,
  "amount"      INTEGER NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "note"        TEXT,
  "createdById" INTEGER NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperatingExpense_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "OperatingExpense"
  ADD CONSTRAINT "OperatingExpense_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON UPDATE CASCADE;
ALTER TABLE "OperatingExpense"
  ADD CONSTRAINT "OperatingExpense_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
```

- [x] **Step 3: 마이그레이션 적용**

```bash
cd /Users/juno/work/football/apps/api
PGPASSWORD=1234 psql -U postgres -d football -f prisma/migrations/20260731000003_knapsack_budget/migration.sql
DATABASE_URL="postgresql://postgres:1234@localhost:5432/football" \
  npx prisma migrate resolve --applied 20260731000003_knapsack_budget
DATABASE_URL="postgresql://postgres:1234@localhost:5432/football" \
  npx prisma generate
```

Expected: `migrate resolve` 성공, `prisma generate` 완료

- [x] **Step 4: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [x] **Step 5: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations/20260731000003_knapsack_budget/
git commit -m "feat(budget): Knapsack 운영비 스키마 — BudgetCategoryPlan·BudgetTier·OperatingExpense"
```

---

## Task 2: KnapsackService (단위 테스트 포함)

**Files:**
- Create: `apps/api/src/budget/knapsack.service.ts`
- Create: `apps/api/__test__/budget/knapsack.service.test.ts`

**배경:** Multiple-choice Knapsack (MCKP). 카테고리 수 ≤ 6, 티어 수 ≤ 3이므로 4^6 = 4096 조합 브루트포스로 충분. 순수 계산(Prisma 의존 없음).

- [x] **Step 1: 테스트 파일 작성**

```typescript
// apps/api/__test__/budget/knapsack.service.test.ts
import { KnapsackService } from "../../src/budget/knapsack.service";

describe("KnapsackService.solve", () => {
  const svc = new KnapsackService();

  it("returns empty when capacity is 0", () => {
    const result = svc.solve({
      capacity: 0,
      groups: [{ categoryPlanId: 1, category: "SCOUTING", tiers: [{ tierId: 1, cost: 100, value: 5 }] }],
    });
    expect(result.selectedTiers).toHaveLength(0);
    expect(result.totalCost).toBe(0);
    expect(result.totalValue).toBe(0);
  });

  it("returns empty when no groups", () => {
    const result = svc.solve({ capacity: 1_000_000, groups: [] });
    expect(result.selectedTiers).toHaveLength(0);
  });

  it("selects the only tier that fits", () => {
    const result = svc.solve({
      capacity: 500_000,
      groups: [{
        categoryPlanId: 1,
        category: "SCOUTING",
        tiers: [
          { tierId: 1, cost: 300_000, value: 5 },
          { tierId: 2, cost: 600_000, value: 9 }, // 초과
        ],
      }],
    });
    expect(result.selectedTiers).toHaveLength(1);
    expect(result.selectedTiers[0].tierId).toBe(1);
    expect(result.totalCost).toBe(300_000);
    expect(result.totalValue).toBe(5);
  });

  it("selects higher-value tier when both fit", () => {
    const result = svc.solve({
      capacity: 1_000_000,
      groups: [{
        categoryPlanId: 1,
        category: "SCOUTING",
        tiers: [
          { tierId: 1, cost: 300_000, value: 5 },
          { tierId: 2, cost: 600_000, value: 9 },
        ],
      }],
    });
    expect(result.selectedTiers[0].tierId).toBe(2);
    expect(result.totalValue).toBe(9);
  });

  it("picks optimal combination across two groups", () => {
    // capacity: 700_000
    // Group A: tier1(300k,val5) tier2(500k,val8)
    // Group B: tier3(200k,val6) tier4(400k,val7)
    // 조합 비교:
    //   A2+B3 = 500+200=700, 가치=14  ← 최적
    //   A1+B4 = 300+400=700, 가치=12
    //   A1+B3 = 300+200=500, 가치=11
    const result = svc.solve({
      capacity: 700_000,
      groups: [
        {
          categoryPlanId: 1, category: "SCOUTING",
          tiers: [
            { tierId: 1, cost: 300_000, value: 5 },
            { tierId: 2, cost: 500_000, value: 8 },
          ],
        },
        {
          categoryPlanId: 2, category: "TRAVEL",
          tiers: [
            { tierId: 3, cost: 200_000, value: 6 },
            { tierId: 4, cost: 400_000, value: 7 },
          ],
        },
      ],
    });
    expect(result.totalCost).toBe(700_000);
    expect(result.totalValue).toBe(14);
    expect(result.selectedTiers.map((t) => t.tierId).sort()).toEqual([2, 3]);
  });

  it("skips group when no tier fits", () => {
    const result = svc.solve({
      capacity: 100_000,
      groups: [{
        categoryPlanId: 1,
        category: "SCOUTING",
        tiers: [{ tierId: 1, cost: 500_000, value: 10 }],
      }],
    });
    expect(result.selectedTiers).toHaveLength(0);
    expect(result.totalValue).toBe(0);
  });

  it("handles 6 groups correctly (real-world scale)", () => {
    const groups = [
      { categoryPlanId: 1, category: "MEDICAL",   tiers: [{ tierId: 1, cost: 3_000_000, value: 10 }, { tierId: 2, cost: 5_000_000, value: 15 }] },
      { categoryPlanId: 2, category: "MEAL",       tiers: [{ tierId: 3, cost: 2_000_000, value: 7  }, { tierId: 4, cost: 3_000_000, value: 9  }] },
      { categoryPlanId: 3, category: "TRAVEL",     tiers: [{ tierId: 5, cost: 4_000_000, value: 8  }, { tierId: 6, cost: 7_000_000, value: 12 }] },
      { categoryPlanId: 4, category: "EQUIPMENT",  tiers: [{ tierId: 7, cost: 2_000_000, value: 6  }] },
      { categoryPlanId: 5, category: "SCOUTING",   tiers: [{ tierId: 8, cost: 3_000_000, value: 9  }, { tierId: 9, cost: 6_000_000, value: 14 }] },
      { categoryPlanId: 6, category: "YOUTH",      tiers: [{ tierId: 10, cost: 2_000_000, value: 5 }] },
    ];
    const result = svc.solve({ capacity: 20_000_000, groups });
    expect(result.totalCost).toBeLessThanOrEqual(20_000_000);
    expect(result.selectedTiers.length).toBeGreaterThan(0);
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/budget/knapsack.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `FAIL` — "Cannot find module '../../src/budget/knapsack.service'"

- [x] **Step 3: KnapsackService 구현**

```typescript
// apps/api/src/budget/knapsack.service.ts

export interface KnapsackTier {
  tierId: number;
  cost: number;
  value: number;
}

export interface KnapsackGroup {
  categoryPlanId: number;
  category: string;
  tiers: KnapsackTier[];
}

export interface KnapsackInput {
  capacity: number;
  groups: KnapsackGroup[];
}

export interface SelectedTier {
  tierId: number;
  categoryPlanId: number;
  allocated: number;
}

export interface KnapsackResult {
  selectedTiers: SelectedTier[];
  totalCost: number;
  totalValue: number;
}

export class KnapsackService {
  // Multiple-choice Knapsack: 카테고리당 최대 1개 티어 선택
  // N≤6, K≤3 → 4^6=4096 브루트포스
  solve(input: KnapsackInput): KnapsackResult {
    const { capacity, groups } = input;
    if (capacity <= 0 || groups.length === 0) {
      return { selectedTiers: [], totalCost: 0, totalValue: 0 };
    }

    let bestValue = 0;
    let bestSelection: (KnapsackTier | null)[] = groups.map(() => null);
    const selection: (KnapsackTier | null)[] = groups.map(() => null);

    const search = (idx: number, remaining: number, value: number) => {
      if (idx === groups.length) {
        if (value > bestValue) {
          bestValue = value;
          bestSelection = [...selection];
        }
        return;
      }
      // 이 카테고리 skip
      selection[idx] = null;
      search(idx + 1, remaining, value);

      // 티어 선택
      for (const tier of groups[idx].tiers) {
        if (tier.cost <= remaining) {
          selection[idx] = tier;
          search(idx + 1, remaining - tier.cost, value + tier.value);
          selection[idx] = null;
        }
      }
    };

    search(0, capacity, 0);

    const selectedTiers: SelectedTier[] = [];
    for (let i = 0; i < groups.length; i++) {
      const tier = bestSelection[i];
      if (tier !== null) {
        selectedTiers.push({
          tierId: tier.tierId,
          categoryPlanId: groups[i].categoryPlanId,
          allocated: tier.cost,
        });
      }
    }

    return {
      selectedTiers,
      totalCost: selectedTiers.reduce((s, t) => s + t.allocated, 0),
      totalValue: bestValue,
    };
  }
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/budget/knapsack.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `PASS` — 6 tests passing

- [x] **Step 5: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/budget/knapsack.service.ts \
        apps/api/__test__/budget/knapsack.service.test.ts
git commit -m "feat(budget): KnapsackService — MCKP 브루트포스 구현 + 단위 테스트"
```

---

## Task 3: Budget Plan BE (FinancialReport 확장)

**Files:**
- Modify: `apps/api/src/financial-report/financial-report.repo.ts`
- Modify: `apps/api/src/financial-report/financial-report.service.ts`
- Modify: `apps/api/src/financial-report/financial-report.controller.ts`
- Modify: `apps/api/src/financial-report/financial-report.routes.ts`

**신규 엔드포인트:**
- `GET  /financial-reports/:seasonId/budget` — 예산 플랜 + 실적 조회
- `PUT  /financial-reports/:seasonId/budget` — 예산 플랜 저장(카테고리·티어 upsert)
- `POST /financial-reports/:seasonId/budget/optimize` — Knapsack 실행 후 결과 저장
- `POST /financial-reports/:seasonId/budget/override` — BudgetOverrideLog 추가

- [x] **Step 1: repo 확장**

`apps/api/src/financial-report/financial-report.repo.ts` 전체 교체:

```typescript
import { PrismaClient, OperatingCategory } from "../generated/client";

export interface UpsertBudgetPlanDto {
  totalOperatingBudget: number;
  contingencyReserve: number;
  categories: {
    category: OperatingCategory;
    mandatoryMinimum: number;
    tiers: { name: string; cost: number; value: number }[];
  }[];
}

export class FinancialReportRepository {
  constructor(private prisma: PrismaClient) {}

  async upsert(seasonId: number, totalRevenue: number, note?: string) {
    const noteVal = note ?? null;
    return this.prisma.financialReport.upsert({
      where: { seasonId },
      create: { seasonId, totalRevenue, note: noteVal },
      update: { totalRevenue, note: noteVal },
    });
  }

  async findBySeasonId(seasonId: number) {
    return this.prisma.financialReport.findUnique({ where: { seasonId } });
  }

  async upsertBudgetPlan(seasonId: number, dto: UpsertBudgetPlanDto) {
    const report = await this.prisma.financialReport.upsert({
      where: { seasonId },
      create: { seasonId, totalRevenue: 0, totalOperatingBudget: dto.totalOperatingBudget, contingencyReserve: dto.contingencyReserve },
      update: { totalOperatingBudget: dto.totalOperatingBudget, contingencyReserve: dto.contingencyReserve },
      select: { id: true },
    });

    for (const cat of dto.categories) {
      const plan = await this.prisma.budgetCategoryPlan.upsert({
        where: { financialReportId_category: { financialReportId: report.id, category: cat.category } },
        create: { financialReportId: report.id, category: cat.category, mandatoryMinimum: cat.mandatoryMinimum },
        update: { mandatoryMinimum: cat.mandatoryMinimum },
        select: { id: true },
      });

      // 기존 티어 전부 삭제 후 재생성 (단순하고 일관성 유지)
      await this.prisma.budgetTier.deleteMany({ where: { categoryPlanId: plan.id } });
      if (cat.tiers.length > 0) {
        await this.prisma.budgetTier.createMany({
          data: cat.tiers.map((t) => ({ categoryPlanId: plan.id, name: t.name, cost: t.cost, value: t.value })),
        });
      }
    }

    return this.getBudgetPlan(seasonId);
  }

  async getBudgetPlan(seasonId: number) {
    const report = await this.prisma.financialReport.findUnique({
      where: { seasonId },
      include: {
        budgetCategoryPlans: {
          include: { tiers: { orderBy: { cost: "asc" } } },
          orderBy: { category: "asc" },
        },
        overrideLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    return report;
  }

  async saveOptimizeResult(
    reportId: number,
    selections: { tierId: number; categoryPlanId: number; allocated: number }[]
  ) {
    // 모든 티어 isSelected 초기화
    await this.prisma.budgetTier.updateMany({
      where: { categoryPlan: { financialReportId: reportId } },
      data: { isSelected: false },
    });
    // 선택된 티어 업데이트
    for (const sel of selections) {
      await this.prisma.budgetTier.update({
        where: { id: sel.tierId },
        data: { isSelected: true },
      });
      await this.prisma.budgetCategoryPlan.update({
        where: { id: sel.categoryPlanId },
        data: { knapsackAllocated: sel.allocated },
      });
    }
  }

  async addOverrideLog(
    reportId: number,
    category: OperatingCategory,
    amount: number,
    reason: string,
    createdById: number
  ) {
    return this.prisma.budgetOverrideLog.create({
      data: { financialReportId: reportId, category, amount, reason, createdById },
    });
  }

  async getActuals(seasonId: number) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { startDate: true, endDate: true },
    });
    if (!season) return null;

    const [medical, meal, operating] = await Promise.all([
      // MEDICAL: 승인된 MedicalExpense (receiptDate 기준)
      this.prisma.medicalExpense.groupBy({
        by: [],
        where: { status: "APPROVED", receiptDate: { gte: season.startDate, lte: season.endDate } },
        _sum: { totalAmount: true },
      }),
      // MEAL: MealExpense.date 기준
      this.prisma.mealExpense.aggregate({
        where: { date: { gte: season.startDate, lte: season.endDate } },
        _sum: { amount: true },
      }),
      // TRAVEL/EQUIPMENT/SCOUTING/YOUTH: OperatingExpense
      this.prisma.operatingExpense.groupBy({
        by: ["category"],
        where: { seasonId },
        _sum: { amount: true },
      }),
    ]);

    const result: Record<string, number> = {
      MEDICAL: medical[0]?._sum?.totalAmount ?? 0,
      MEAL: meal._sum?.amount ?? 0,
    };
    for (const row of operating) {
      result[row.category] = row._sum?.amount ?? 0;
    }
    return result;
  }
}
```

- [x] **Step 2: service 확장**

`apps/api/src/financial-report/financial-report.service.ts` 전체 교체:

```typescript
import { AppError } from "../lib/appError";
import { FinancialReportRepository, UpsertBudgetPlanDto } from "./financial-report.repo";
import { KnapsackService } from "../budget/knapsack.service";
import { OperatingCategory } from "../generated/client";

export class FinancialReportService {
  constructor(
    private repo: FinancialReportRepository,
    private knapsack: KnapsackService,
  ) {}

  async set(seasonId: number, totalRevenue: number, note?: string) {
    if (totalRevenue <= 0) throw new AppError(400, "INVALID_REVENUE");
    return this.repo.upsert(seasonId, totalRevenue, note);
  }

  async setFromCSV(seasonId: number, csvContent: string, note?: string) {
    const totalRevenue = this.parseCSV(csvContent);
    return this.repo.upsert(seasonId, totalRevenue, note);
  }

  async get(seasonId: number) {
    const report = await this.repo.findBySeasonId(seasonId);
    if (!report) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    return report;
  }

  async upsertBudgetPlan(seasonId: number, dto: UpsertBudgetPlanDto) {
    if (dto.totalOperatingBudget <= 0) throw new AppError(400, "INVALID_BUDGET");
    if (dto.contingencyReserve < 0) throw new AppError(400, "INVALID_CONTINGENCY");
    return this.repo.upsertBudgetPlan(seasonId, dto);
  }

  async getBudgetPlan(seasonId: number) {
    const plan = await this.repo.getBudgetPlan(seasonId);
    if (!plan) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    return plan;
  }

  async optimize(seasonId: number) {
    const plan = await this.repo.getBudgetPlan(seasonId);
    if (!plan) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    if (!plan.totalOperatingBudget) throw new AppError(400, "BUDGET_NOT_SET");

    const mandatoryTotal = plan.budgetCategoryPlans.reduce(
      (s, c) => s + c.mandatoryMinimum, 0
    );
    const capacity = plan.totalOperatingBudget - mandatoryTotal - (plan.contingencyReserve ?? 0);
    if (capacity <= 0) throw new AppError(400, "DISCRETIONARY_POOL_EMPTY");

    const groups = plan.budgetCategoryPlans
      .filter((c) => c.tiers.length > 0)
      .map((c) => ({
        categoryPlanId: c.id,
        category: c.category,
        tiers: c.tiers.map((t) => ({ tierId: t.id, cost: t.cost, value: t.value })),
      }));

    const result = this.knapsack.solve({ capacity, groups });
    await this.repo.saveOptimizeResult(plan.id, result.selectedTiers);

    return { ...result, capacity, mandatoryTotal };
  }

  async addOverride(
    seasonId: number,
    category: OperatingCategory,
    amount: number,
    reason: string,
    createdById: number
  ) {
    const plan = await this.repo.getBudgetPlan(seasonId);
    if (!plan) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    if (amount <= 0) throw new AppError(400, "INVALID_AMOUNT");
    if (!reason.trim()) throw new AppError(400, "REASON_REQUIRED");
    return this.repo.addOverrideLog(plan.id, category, amount, reason, createdById);
  }

  async getActuals(seasonId: number) {
    return this.repo.getActuals(seasonId);
  }

  private parseCSV(content: string): number {
    const lines = content.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let total = 0;
    for (const line of lines) {
      const cols = line.split(",");
      const lastCol = cols[cols.length - 1];
      if (!lastCol) continue;
      const raw = lastCol.trim().replace(/[^0-9.]/g, "");
      const amount = parseFloat(raw);
      if (!isNaN(amount) && amount > 0) total += Math.round(amount);
    }
    if (total === 0) throw new AppError(400, "CSV_NO_VALID_AMOUNTS");
    return total;
  }
}
```

- [x] **Step 3: controller 확장**

`apps/api/src/financial-report/financial-report.controller.ts` 에 아래 메서드 추가 (기존 set/setFromCSV/get 유지):

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { FinancialReportService } from "./financial-report.service";
import { OperatingCategory } from "../generated/client";

const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" && (foRole === "GM" || foRole === "FINANCE_MANAGER"));

const canRead = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" && (foRole === "GM" || foRole === "TD" || foRole === "FINANCE_MANAGER"));

export class FinancialReportController {
  constructor(private service: FinancialReportService) {}

  set = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const { totalRevenue, note } = req.body as { totalRevenue: number; note?: string };
      if (!Number.isInteger(totalRevenue)) throw new AppError(400, "INVALID_REVENUE");
      const report = await this.service.set(seasonId, totalRevenue, note);
      res.status(200).json(report);
    } catch (err) { next(err); }
  };

  setFromCSV = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      if (!req.file) throw new AppError(400, "FILE_REQUIRED");
      const csvContent = req.file.buffer.toString("utf-8");
      const note = (req.body as { note?: string }).note;
      const report = await this.service.setFromCSV(seasonId, csvContent, note);
      res.status(200).json(report);
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const report = await this.service.get(seasonId);
      res.status(200).json(report);
    } catch (err) { next(err); }
  };

  getBudgetPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const [plan, actuals] = await Promise.all([
        this.service.getBudgetPlan(seasonId),
        this.service.getActuals(seasonId),
      ]);
      res.status(200).json({ ...plan, actuals });
    } catch (err) { next(err); }
  };

  upsertBudgetPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const plan = await this.service.upsertBudgetPlan(seasonId, req.body);
      res.status(200).json(plan);
    } catch (err) { next(err); }
  };

  optimize = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const result = await this.service.optimize(seasonId);
      res.status(200).json(result);
    } catch (err) { next(err); }
  };

  addOverride = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const { category, amount, reason } = req.body as { category: OperatingCategory; amount: number; reason: string };
      const log = await this.service.addOverride(seasonId, category, amount, reason, userId);
      res.status(201).json(log);
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 4: routes 확장**

`apps/api/src/financial-report/financial-report.routes.ts` 전체 교체:

```typescript
import { Router } from "express";
import passport from "passport";
import multer from "multer";
import { FinancialReportController } from "./financial-report.controller";
import { FinancialReportService } from "./financial-report.service";
import { FinancialReportRepository } from "./financial-report.repo";
import { KnapsackService } from "../budget/knapsack.service";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new FinancialReportRepository(getPrisma());
const knapsack = new KnapsackService();
const service = new FinancialReportService(repo, knapsack);
const controller = new FinancialReportController(service);

const auth = passport.authenticate("accessToken", { session: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1 * 1024 * 1024 } });

router.post("/:seasonId",             auth, controller.set);
router.post("/:seasonId/csv",         auth, upload.single("file"), controller.setFromCSV);
router.get("/:seasonId",              auth, controller.get);
router.get("/:seasonId/budget",       auth, controller.getBudgetPlan);
router.put("/:seasonId/budget",       auth, controller.upsertBudgetPlan);
router.post("/:seasonId/budget/optimize", auth, controller.optimize);
router.post("/:seasonId/budget/override", auth, controller.addOverride);

export default router;
```

- [x] **Step 5: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [x] **Step 6: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/financial-report/
git commit -m "feat(budget): Budget Plan BE — Knapsack optimize·override 엔드포인트"
```

---

## Task 4: OperatingExpense BE

**Files:**
- Create: `apps/api/src/operating-expense/operating-expense.repo.ts`
- Create: `apps/api/src/operating-expense/operating-expense.service.ts`
- Create: `apps/api/src/operating-expense/operating-expense.controller.ts`
- Create: `apps/api/src/operating-expense/operating-expense.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

**엔드포인트:** `GET /operating-expenses?seasonId=`, `POST /operating-expenses`, `DELETE /operating-expenses/:id`

- [x] **Step 1: repo 작성**

```typescript
// apps/api/src/operating-expense/operating-expense.repo.ts
import { PrismaClient, OperatingCategory } from "../generated/client";

export class OperatingExpenseRepository {
  constructor(private prisma: PrismaClient) {}

  findBySeasonId(seasonId: number) {
    return this.prisma.operatingExpense.findMany({
      where: { seasonId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
  }

  create(data: {
    seasonId: number;
    category: OperatingCategory;
    amount: number;
    date: Date;
    note?: string;
    createdById: number;
  }) {
    return this.prisma.operatingExpense.create({
      data: { ...data, note: data.note ?? null },
      include: { createdBy: { select: { name: true } } },
    });
  }

  findById(id: number) {
    return this.prisma.operatingExpense.findUnique({ where: { id } });
  }

  delete(id: number) {
    return this.prisma.operatingExpense.delete({ where: { id } });
  }
}
```

- [x] **Step 2: service 작성**

```typescript
// apps/api/src/operating-expense/operating-expense.service.ts
import { AppError } from "../lib/appError";
import { OperatingExpenseRepository } from "./operating-expense.repo";
import { OperatingCategory } from "../generated/client";

export class OperatingExpenseService {
  constructor(private repo: OperatingExpenseRepository) {}

  list(seasonId: number) {
    return this.repo.findBySeasonId(seasonId);
  }

  create(data: {
    seasonId: number;
    category: OperatingCategory;
    amount: number;
    date: string;
    note?: string;
    createdById: number;
  }) {
    if (data.amount <= 0) throw new AppError(400, "INVALID_AMOUNT");
    const discretionary: OperatingCategory[] = ["TRAVEL", "EQUIPMENT", "SCOUTING", "YOUTH"];
    if (!discretionary.includes(data.category)) {
      throw new AppError(400, "INVALID_CATEGORY: TRAVEL/EQUIPMENT/SCOUTING/YOUTH만 허용");
    }
    return this.repo.create({ ...data, date: new Date(data.date) });
  }

  async delete(id: number, requesterId: number, requesterRole: string) {
    const expense = await this.repo.findById(id);
    if (!expense) throw new AppError(404, "NOT_FOUND");
    if (expense.createdById !== requesterId && requesterRole !== "ADMIN") {
      throw new AppError(403, "FORBIDDEN");
    }
    return this.repo.delete(id);
  }
}
```

- [x] **Step 3: controller 작성**

```typescript
// apps/api/src/operating-expense/operating-expense.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { OperatingExpenseService } from "./operating-expense.service";
import { OperatingCategory } from "../generated/client";

const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" && (foRole === "GM" || foRole === "FINANCE_MANAGER"));

const canRead = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" && (foRole === "GM" || foRole === "TD" || foRole === "FINANCE_MANAGER"));

export class OperatingExpenseController {
  constructor(private service: OperatingExpenseService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const expenses = await this.service.list(seasonId);
      res.json(expenses);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { seasonId, category, amount, date, note } = req.body as {
        seasonId: number;
        category: OperatingCategory;
        amount: number;
        date: string;
        note?: string;
      };
      const expense = await this.service.create({ seasonId, category, amount, date, note, createdById: userId });
      res.status(201).json(expense);
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      await this.service.delete(id, userId, role);
      res.status(204).end();
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 4: routes 작성**

```typescript
// apps/api/src/operating-expense/operating-expense.routes.ts
import { Router } from "express";
import passport from "passport";
import { OperatingExpenseController } from "./operating-expense.controller";
import { OperatingExpenseService } from "./operating-expense.service";
import { OperatingExpenseRepository } from "./operating-expense.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new OperatingExpenseRepository(getPrisma());
const service = new OperatingExpenseService(repo);
const controller = new OperatingExpenseController(service);
const auth = passport.authenticate("accessToken", { session: false });

router.get("/",     auth, controller.list);
router.post("/",    auth, controller.create);
router.delete("/:id", auth, controller.delete);

export default router;
```

- [x] **Step 5: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts`에서 기존 router 등록 목록 끝에 추가:

```typescript
import operatingExpenseRouter from "./operating-expense/operating-expense.routes";
// ...
apiRouter.use("/operating-expenses", operatingExpenseRouter);
```

- [x] **Step 6: TypeScript 확인 + Commit**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

```bash
cd /Users/juno/work/football
git add apps/api/src/operating-expense/ apps/api/src/apiRouter.ts
git commit -m "feat(budget): OperatingExpense BE — TRAVEL/EQUIPMENT/SCOUTING/YOUTH 지출 기록 API"
```

---

## Task 5: FE 타입 + 서비스

**Files:**
- Create: `football/src/types/budget.ts`
- Modify: `football/src/services/financial-report.service.ts`
- Create: `football/src/services/operating-expense.service.ts`

- [x] **Step 1: budget.ts 타입 작성**

```typescript
// football/src/types/budget.ts

export type OperatingCategory = 'MEDICAL' | 'MEAL' | 'TRAVEL' | 'EQUIPMENT' | 'SCOUTING' | 'YOUTH'

export const OPERATING_CATEGORY_LABEL: Record<OperatingCategory, string> = {
  MEDICAL: '의료·재활',
  MEAL: '식대',
  TRAVEL: '이동·숙박',
  EQUIPMENT: '장비·유니폼',
  SCOUTING: '스카우팅·영입',
  YOUTH: '유소년 개발',
}

export const ALL_OPERATING_CATEGORIES: OperatingCategory[] = [
  'MEDICAL', 'MEAL', 'TRAVEL', 'EQUIPMENT', 'SCOUTING', 'YOUTH',
]

export interface BudgetTier {
  id: number
  categoryPlanId: number
  name: string
  cost: number
  value: number
  isSelected: boolean
}

export interface BudgetCategoryPlan {
  id: number
  financialReportId: number
  category: OperatingCategory
  mandatoryMinimum: number
  knapsackAllocated: number | null
  tiers: BudgetTier[]
}

export interface BudgetOverrideLog {
  id: number
  category: OperatingCategory
  amount: number
  reason: string
  createdAt: string
}

export interface BudgetPlan {
  id: number
  seasonId: number
  totalRevenue: number
  totalOperatingBudget: number | null
  contingencyReserve: number | null
  budgetCategoryPlans: BudgetCategoryPlan[]
  overrideLogs: BudgetOverrideLog[]
  actuals: Record<string, number> | null
}

export interface UpsertBudgetPlanPayload {
  totalOperatingBudget: number
  contingencyReserve: number
  categories: {
    category: OperatingCategory
    mandatoryMinimum: number
    tiers: { name: string; cost: number; value: number }[]
  }[]
}

export interface OptimizeResult {
  selectedTiers: { tierId: number; categoryPlanId: number; allocated: number }[]
  totalCost: number
  totalValue: number
  capacity: number
  mandatoryTotal: number
}

export interface OperatingExpense {
  id: number
  seasonId: number
  category: OperatingCategory
  amount: number
  date: string
  note: string | null
  createdAt: string
  createdBy: { name: string }
}
```

- [x] **Step 2: financial-report.service.ts 확장**

기존 파일 끝에 추가:

```typescript
import type { BudgetPlan, UpsertBudgetPlanPayload, OptimizeResult } from '@/types/budget'

// financialReportApi 객체에 추가:
export const budgetPlanApi = {
  get: (seasonId: number) =>
    api.get<BudgetPlan>(`/financial-reports/${seasonId}/budget`),

  save: (seasonId: number, payload: UpsertBudgetPlanPayload) =>
    api.put<BudgetPlan>(`/financial-reports/${seasonId}/budget`, payload),

  optimize: (seasonId: number) =>
    api.post<OptimizeResult>(`/financial-reports/${seasonId}/budget/optimize`, {}),

  addOverride: (seasonId: number, payload: { category: string; amount: number; reason: string }) =>
    api.post(`/financial-reports/${seasonId}/budget/override`, payload),
}
```

- [x] **Step 3: operating-expense.service.ts 작성**

```typescript
// football/src/services/operating-expense.service.ts
import { api } from './api'
import type { OperatingCategory, OperatingExpense } from '@/types/budget'

export const operatingExpenseApi = {
  list: (seasonId: number) =>
    api.get<OperatingExpense[]>(`/operating-expenses?seasonId=${seasonId}`),

  create: (payload: {
    seasonId: number
    category: OperatingCategory
    amount: number
    date: string
    note?: string
  }) => api.post<OperatingExpense>('/operating-expenses', payload),

  delete: (id: number) =>
    api.delete(`/operating-expenses/${id}`),
}
```

- [x] **Step 4: Commit**

```bash
cd /Users/juno/work/football
git add football/src/types/budget.ts \
        football/src/services/financial-report.service.ts \
        football/src/services/operating-expense.service.ts
git commit -m "feat(budget): FE 타입 + API 서비스 — BudgetPlan·OperatingExpense"
```

---

## Task 6: FE BudgetPlanPage

**Files:**
- Create: `football/src/pages/admin/BudgetPlanPage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/locales/ko/admin.json`

**UI 구성:**
1. 총 운영예산 + 예비비 입력
2. 카테고리별 mandatoryMinimum + 3티어(이름·비용·가치점수) 입력
3. 재량 예산 실시간 계산 표시
4. "Knapsack 최적화" 버튼 → 선택 티어 하이라이트
5. 카테고리별 배분액 vs 실적 비교 테이블
6. 긴급지출 Override 로그 폼

- [x] **Step 1: BudgetPlanPage.tsx 작성**

```typescript
// football/src/pages/admin/BudgetPlanPage.tsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { budgetPlanApi } from '@/services/financial-report.service'
import { seasonApi } from '@/services/season.service'
import type { BudgetPlan, UpsertBudgetPlanPayload, OperatingCategory } from '@/types/budget'
import { ALL_OPERATING_CATEGORIES, OPERATING_CATEGORY_LABEL } from '@/types/budget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

interface TierRow { name: string; cost: string; value: string }
interface CategoryRow { mandatoryMinimum: string; tiers: TierRow[] }

const defaultTiers = (): TierRow[] => [
  { name: 'Basic', cost: '', value: '' },
  { name: 'Standard', cost: '', value: '' },
  { name: 'Premium', cost: '', value: '' },
]

export function BudgetPlanPage() {
  const { t } = useTranslation('admin')
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [plan, setPlan] = useState<BudgetPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [optimizing, setOptimizing] = useState(false)

  const [totalBudget, setTotalBudget] = useState('')
  const [contingency, setContingency] = useState('')
  const [categories, setCategories] = useState<Record<OperatingCategory, CategoryRow>>(
    () => Object.fromEntries(
      ALL_OPERATING_CATEGORIES.map((c) => [c, { mandatoryMinimum: '', tiers: defaultTiers() }])
    ) as Record<OperatingCategory, CategoryRow>
  )

  const [overrideCategory, setOverrideCategory] = useState<OperatingCategory>('TRAVEL')
  const [overrideAmount, setOverrideAmount] = useState('')
  const [overrideReason, setOverrideReason] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const season = await seasonApi.active()
        if (!season) { setLoading(false); return }
        setSeasonId(season.id)
        const p = await budgetPlanApi.get(season.id).catch(() => null)
        if (p) {
          setPlan(p)
          setTotalBudget(p.totalOperatingBudget?.toString() ?? '')
          setContingency(p.contingencyReserve?.toString() ?? '0')
          const newCats = { ...categories }
          for (const cp of p.budgetCategoryPlans) {
            newCats[cp.category] = {
              mandatoryMinimum: cp.mandatoryMinimum.toString(),
              tiers: cp.tiers.length > 0
                ? cp.tiers.map((t) => ({ name: t.name, cost: t.cost.toString(), value: t.value.toString() }))
                : defaultTiers(),
            }
          }
          setCategories(newCats)
        }
      } catch { toast.error(t('budget.loadFailed')) }
      finally { setLoading(false) }
    })()
  }, [])

  const discretionaryPool = () => {
    const total = parseInt(totalBudget, 10) || 0
    const cont = parseInt(contingency, 10) || 0
    const mandatory = ALL_OPERATING_CATEGORIES.reduce(
      (s, c) => s + (parseInt(categories[c].mandatoryMinimum, 10) || 0), 0
    )
    return total - cont - mandatory
  }

  const handleSave = async () => {
    if (!seasonId) return
    setSaving(true)
    try {
      const payload: UpsertBudgetPlanPayload = {
        totalOperatingBudget: parseInt(totalBudget, 10),
        contingencyReserve: parseInt(contingency, 10) || 0,
        categories: ALL_OPERATING_CATEGORIES.map((cat) => ({
          category: cat,
          mandatoryMinimum: parseInt(categories[cat].mandatoryMinimum, 10) || 0,
          tiers: categories[cat].tiers
            .filter((t) => t.cost && t.value)
            .map((t) => ({ name: t.name, cost: parseInt(t.cost, 10), value: parseInt(t.value, 10) })),
        })),
      }
      const p = await budgetPlanApi.save(seasonId, payload)
      setPlan(p)
      toast.success(t('budget.saved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('budget.saveFailed'))
    } finally { setSaving(false) }
  }

  const handleOptimize = async () => {
    if (!seasonId) return
    setOptimizing(true)
    try {
      await budgetPlanApi.optimize(seasonId)
      const p = await budgetPlanApi.get(seasonId)
      setPlan(p)
      toast.success(t('budget.optimized'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('budget.optimizeFailed'))
    } finally { setOptimizing(false) }
  }

  const handleOverride = async () => {
    if (!seasonId) return
    try {
      await budgetPlanApi.addOverride(seasonId, {
        category: overrideCategory,
        amount: parseInt(overrideAmount, 10),
        reason: overrideReason,
      })
      const p = await budgetPlanApi.get(seasonId)
      setPlan(p)
      setOverrideAmount('')
      setOverrideReason('')
      toast.success(t('budget.overrideLogged'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('budget.overrideFailed'))
    }
  }

  const updateTier = (cat: OperatingCategory, i: number, field: keyof TierRow, val: string) => {
    setCategories((prev) => {
      const next = { ...prev }
      const tiers = [...next[cat].tiers]
      tiers[i] = { ...tiers[i], [field]: val }
      next[cat] = { ...next[cat], tiers }
      return next
    })
  }

  if (loading) return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  if (!seasonId) return <div className="p-6 text-sm text-muted-foreground">{t('budget.noActiveSeason')}</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">{t('budget.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('budget.subtitle')}</p>
      </div>

      <div className="px-6 py-4 space-y-6 max-w-4xl">
        {/* 총 예산 설정 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t('budget.totalSection')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('budget.totalOperatingBudget')}</Label>
              <Input type="number" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="50000000" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('budget.contingencyReserve')}</Label>
              <Input type="number" value={contingency} onChange={(e) => setContingency(e.target.value)} placeholder="5000000" />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('budget.discretionaryPool')}: <span className={`font-semibold ${discretionaryPool() < 0 ? 'text-destructive' : 'text-primary'}`}>{fmt(discretionaryPool())}</span>
          </div>
        </section>

        {/* 카테고리별 설정 */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">{t('budget.categoriesSection')}</h2>
          {ALL_OPERATING_CATEGORIES.map((cat) => {
            const catPlan = plan?.budgetCategoryPlans.find((c) => c.category === cat)
            const actual = plan?.actuals?.[cat] ?? 0
            return (
              <div key={cat} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{OPERATING_CATEGORY_LABEL[cat]}</span>
                  {catPlan?.knapsackAllocated != null && (
                    <Badge variant="outline" className="text-xs">
                      배분: {fmt(catPlan.knapsackAllocated)} | 실적: {fmt(actual)}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('budget.mandatoryMinimum')}</Label>
                  <Input
                    type="number"
                    className="h-7 text-sm"
                    value={categories[cat].mandatoryMinimum}
                    onChange={(e) => setCategories((p) => ({ ...p, [cat]: { ...p[cat], mandatoryMinimum: e.target.value } }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('budget.tiers')}</Label>
                  {categories[cat].tiers.map((tier, i) => {
                    const planTier = catPlan?.tiers[i]
                    return (
                      <div key={i} className={`grid grid-cols-3 gap-2 p-2 rounded ${planTier?.isSelected ? 'bg-primary/10 border border-primary/30' : ''}`}>
                        <Input className="h-7 text-xs" value={tier.name} onChange={(e) => updateTier(cat, i, 'name', e.target.value)} placeholder="Basic" />
                        <Input className="h-7 text-xs" type="number" value={tier.cost} onChange={(e) => updateTier(cat, i, 'cost', e.target.value)} placeholder="비용(원)" />
                        <Input className="h-7 text-xs" type="number" value={tier.value} onChange={(e) => updateTier(cat, i, 'value', e.target.value)} placeholder="가치점수" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>{saving ? t('budget.saving') : t('budget.save')}</Button>
          <Button variant="outline" onClick={handleOptimize} disabled={optimizing}>
            {optimizing ? t('budget.optimizing') : t('budget.optimize')}
          </Button>
        </div>

        {/* Override 로그 */}
        <section className="space-y-3 border-t pt-4">
          <h2 className="text-sm font-semibold">{t('budget.overrideSection')}</h2>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={overrideCategory}
              onChange={(e) => setOverrideCategory(e.target.value as OperatingCategory)}
            >
              {ALL_OPERATING_CATEGORIES.map((c) => <option key={c} value={c}>{OPERATING_CATEGORY_LABEL[c]}</option>)}
            </select>
            <Input type="number" placeholder={t('budget.overrideAmount')} value={overrideAmount} onChange={(e) => setOverrideAmount(e.target.value)} />
            <Input placeholder={t('budget.overrideReason')} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={handleOverride}>{t('budget.logOverride')}</Button>

          {(plan?.overrideLogs ?? []).length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t('budget.col.category')}</TableHead>
                  <TableHead className="text-xs">{t('budget.col.amount')}</TableHead>
                  <TableHead className="text-xs">{t('budget.col.reason')}</TableHead>
                  <TableHead className="text-xs">{t('budget.col.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan!.overrideLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{OPERATING_CATEGORY_LABEL[log.category]}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmt(log.amount)}</TableCell>
                    <TableCell className="text-xs">{log.reason}</TableCell>
                    <TableCell className="text-xs tabular-nums">{new Date(log.createdAt).toLocaleDateString('ko-KR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  )
}
```

- [x] **Step 2: App.tsx에 라우트 추가**

`football/src/App.tsx`에서 기존 admin 라우트 목록에 추가:

```typescript
import { BudgetPlanPage } from '@/pages/admin/BudgetPlanPage'
// ...
<Route path="/admin/budget-plan" element={<BudgetPlanPage />} />
```

- [x] **Step 3: AppShell.tsx에 nav 항목 추가**

`football/src/layouts/AppShell.tsx`에서 `/admin/financial-report` 항목 아래에 추가:

```typescript
{ to: '/admin/budget-plan', label: 'nav.item.budgetPlan', icon: PieChart, section: 'nav.section.management', roles: ['ADMIN', 'FRONT_OFFICE'], frontOfficeRoles: ['GM', 'FINANCE_MANAGER', 'TD'] },
```

상단 import에 `PieChart` 추가: `import { ..., PieChart } from 'lucide-react'`

- [x] **Step 4: i18n 추가**

`football/src/locales/ko/admin.json`에 `budget` 키 추가:

```json
"budget": {
  "title": "운영비 예산 계획",
  "subtitle": "Knapsack 최적화로 시즌 운영비를 카테고리별로 배분합니다",
  "loadFailed": "예산 플랜 로드 실패",
  "saveFailed": "저장 실패",
  "saved": "예산 플랜 저장 완료",
  "optimized": "Knapsack 최적화 완료",
  "optimizeFailed": "최적화 실패",
  "saving": "저장 중...",
  "optimize": "Knapsack 최적화",
  "optimizing": "최적화 중...",
  "save": "저장",
  "noActiveSeason": "활성 시즌이 없습니다",
  "totalSection": "총 예산 설정",
  "totalOperatingBudget": "총 운영예산",
  "contingencyReserve": "예비비",
  "discretionaryPool": "재량 예산",
  "categoriesSection": "카테고리별 설정",
  "mandatoryMinimum": "의무 최소치",
  "tiers": "티어 (이름 / 비용 / 가치점수)",
  "overrideSection": "긴급지출 Override 로그",
  "overrideAmount": "금액",
  "overrideReason": "사유",
  "logOverride": "Override 기록",
  "overrideLogged": "Override 기록 완료",
  "overrideFailed": "Override 기록 실패",
  "col": {
    "category": "카테고리",
    "amount": "금액",
    "reason": "사유",
    "date": "일자"
  }
}
```

`football/src/locales/ko/common.json`에 추가:

```json
"nav.item.budgetPlan": "운영비 예산"
```

- [x] **Step 5: TypeScript + Vite 빌드 확인**

```bash
cd /Users/juno/work/football/football
npx tsc --noEmit 2>&1 | head -20
npx vite build 2>&1 | grep -E "error|✓ built"
```

Expected: 에러 없음, `✓ built in ...`

- [x] **Step 6: Commit**

```bash
cd /Users/juno/work/football
git add football/src/pages/admin/BudgetPlanPage.tsx \
        football/src/App.tsx \
        football/src/layouts/AppShell.tsx \
        football/src/locales/
git commit -m "feat(budget): FE BudgetPlanPage — 티어 설정·Knapsack 최적화·Override 로그"
```

---

## Task 7: FE OperatingExpensePage

**Files:**
- Create: `football/src/pages/admin/OperatingExpensePage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/locales/ko/admin.json`

- [x] **Step 1: OperatingExpensePage.tsx 작성**

```typescript
// football/src/pages/admin/OperatingExpensePage.tsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { operatingExpenseApi } from '@/services/operating-expense.service'
import { seasonApi } from '@/services/season.service'
import type { OperatingExpense, OperatingCategory } from '@/types/budget'
import { OPERATING_CATEGORY_LABEL } from '@/types/budget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Trash2, Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const DISCRETIONARY_CATEGORIES: OperatingCategory[] = ['TRAVEL', 'EQUIPMENT', 'SCOUTING', 'YOUTH']

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export function OperatingExpensePage() {
  const { t } = useTranslation('admin')
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [expenses, setExpenses] = useState<OperatingExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ category: 'TRAVEL' as OperatingCategory, amount: '', date: '', note: '' })
  const [saving, setSaving] = useState(false)

  const load = async (sid: number) => {
    const list = await operatingExpenseApi.list(sid)
    setExpenses(list)
  }

  useEffect(() => {
    void (async () => {
      try {
        const season = await seasonApi.active()
        if (!season) { setLoading(false); return }
        setSeasonId(season.id)
        await load(season.id)
      } catch { toast.error(t('operatingExpense.loadFailed')) }
      finally { setLoading(false) }
    })()
  }, [])

  const handleCreate = async () => {
    if (!seasonId || !form.amount || !form.date) {
      toast.error(t('operatingExpense.required'))
      return
    }
    setSaving(true)
    try {
      await operatingExpenseApi.create({
        seasonId,
        category: form.category,
        amount: parseInt(form.amount, 10),
        date: form.date,
        note: form.note || undefined,
      })
      await load(seasonId)
      setCreateOpen(false)
      setForm({ category: 'TRAVEL', amount: '', date: '', note: '' })
      toast.success(t('operatingExpense.created'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('operatingExpense.createFailed'))
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!seasonId) return
    try {
      await operatingExpenseApi.delete(id)
      await load(seasonId)
      toast.success(t('operatingExpense.deleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('operatingExpense.deleteFailed'))
    }
  }

  if (loading) return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  if (!seasonId) return <div className="p-6 text-sm text-muted-foreground">{t('operatingExpense.noActiveSeason')}</div>

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t('operatingExpense.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('operatingExpense.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />{t('operatingExpense.add')}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {expenses.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('operatingExpense.empty')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('operatingExpense.col.date')}</TableHead>
                <TableHead>{t('operatingExpense.col.category')}</TableHead>
                <TableHead>{t('operatingExpense.col.amount')}</TableHead>
                <TableHead>{t('operatingExpense.col.note')}</TableHead>
                <TableHead>{t('operatingExpense.col.by')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="tabular-nums text-sm">{new Date(e.date).toLocaleDateString('ko-KR')}</TableCell>
                  <TableCell className="text-sm">{OPERATING_CATEGORY_LABEL[e.category]}</TableCell>
                  <TableCell className="tabular-nums font-medium text-sm">{fmt(e.amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.note ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.createdBy.name}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('operatingExpense.createTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t('operatingExpense.col.category')}</Label>
              <select
                className="w-full border rounded px-3 py-1.5 text-sm"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as OperatingCategory }))}
              >
                {DISCRETIONARY_CATEGORIES.map((c) => <option key={c} value={c}>{OPERATING_CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('operatingExpense.col.amount')}</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="1000000" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('operatingExpense.col.date')}</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('operatingExpense.col.note')}</Label>
              <Input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder={t('operatingExpense.notePlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>{t('operatingExpense.cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? t('operatingExpense.saving') : t('operatingExpense.submit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [x] **Step 2: App.tsx + AppShell.tsx 업데이트**

`football/src/App.tsx`에 추가:

```typescript
import { OperatingExpensePage } from '@/pages/admin/OperatingExpensePage'
// ...
<Route path="/admin/operating-expenses" element={<OperatingExpensePage />} />
```

`football/src/layouts/AppShell.tsx`에서 `/admin/budget-plan` 아래에 추가:

```typescript
{ to: '/admin/operating-expenses', label: 'nav.item.operatingExpenses', icon: Receipt, section: 'nav.section.management', roles: ['ADMIN', 'FRONT_OFFICE'], frontOfficeRoles: ['GM', 'FINANCE_MANAGER', 'TD'] },
```

`import { ..., Receipt } from 'lucide-react'` 추가

- [x] **Step 3: i18n 추가**

`football/src/locales/ko/admin.json`에 `operatingExpense` 키 추가:

```json
"operatingExpense": {
  "title": "운영비 지출 기록",
  "subtitle": "이동·장비·스카우팅·유소년 지출을 기록합니다",
  "add": "지출 추가",
  "createTitle": "운영비 지출 등록",
  "empty": "등록된 지출이 없습니다",
  "loadFailed": "지출 목록 로드 실패",
  "createFailed": "등록 실패",
  "deleteFailed": "삭제 실패",
  "created": "지출 등록 완료",
  "deleted": "삭제 완료",
  "required": "카테고리·금액·날짜는 필수입니다",
  "noActiveSeason": "활성 시즌이 없습니다",
  "saving": "저장 중...",
  "submit": "등록",
  "cancel": "취소",
  "notePlaceholder": "메모 (선택)",
  "col": {
    "date": "일자",
    "category": "카테고리",
    "amount": "금액",
    "note": "메모",
    "by": "등록자"
  }
}
```

`football/src/locales/ko/common.json`에 추가:

```json
"nav.item.operatingExpenses": "운영비 지출"
```

- [x] **Step 4: TypeScript + Vite 빌드 확인**

```bash
cd /Users/juno/work/football/football
npx tsc --noEmit 2>&1 | head -20
npx vite build 2>&1 | grep -E "error|✓ built"
```

Expected: 에러 없음, `✓ built in ...`

- [x] **Step 5: Commit**

```bash
cd /Users/juno/work/football
git add football/src/pages/admin/OperatingExpensePage.tsx \
        football/src/App.tsx \
        football/src/layouts/AppShell.tsx \
        football/src/locales/
git commit -m "feat(budget): FE OperatingExpensePage — 재량 운영비 CRUD"
```

---

## Self-Review

**Spec coverage:**
- [x] 총 운영예산 + 예비비 입력 → Task 3 (BE upsertBudgetPlan) + Task 6 (FE)
- [x] 카테고리별 의무 최소치 → BudgetCategoryPlan.mandatoryMinimum
- [x] 0/1 Knapsack 티어 최적화 → Task 2 (KnapsackService) + Task 3 (optimize endpoint)
- [x] 직전 시즌 복사 → 미포함 (향후 별도 엔드포인트 추가 예정, 첫 시즌은 수동 입력)
- [x] Override 로그 → BudgetOverrideLog + Task 3/6
- [x] TRAVEL/EQUIPMENT/SCOUTING/YOUTH 지출 기록 → Task 4/7 (OperatingExpense)
- [x] Pull 집계 (actuals) → Task 3 (getActuals: MedicalExpense + MealExpense + OperatingExpense 합산)
- [x] GM + FINANCE_MANAGER 쓰기, TD 읽기 → canWrite/canRead 함수

**타입 일관성:**
- `KnapsackService` 타입 → Task 2에서 정의, Task 3 service에서 사용
- `OperatingCategory` → 스키마 enum, FE `budget.ts`에 미러링, 양쪽 동일 값
- `BudgetPlan` 인터페이스 → Task 5에서 정의, Task 6에서 소비
- `UpsertBudgetPlanDto` (BE) ↔ `UpsertBudgetPlanPayload` (FE) → 필드명 일치

**직전 시즌 복사 미포함 사유:** 첫 시즌에는 데이터가 없어 복사할 대상이 없음. Task 3 repo에 `copyFromPreviousSeason(seasonId)` 메서드를 추후 추가하면 됨.
