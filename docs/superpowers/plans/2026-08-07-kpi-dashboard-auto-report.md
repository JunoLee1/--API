# KPI 대시보드 + 자동화 보고서 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 운영/재무팀 8개 KPI를 역할별 대시보드에 표시하고, 월말 cron으로 운영 지표 스냅샷을 저장해 자동화 보고서를 제공한다.

**Architecture:** Prisma `MonthlyOperationsSnapshot` 모델에 JSON으로 8개 KPI를 월별 저장. cron `0 0 1 * *`이 전월 집계 후 upsert. `/ops-report` API가 스냅샷 반환(없으면 실시간 집계). 프론트는 대시보드 KPI 카드와 연간 라인 차트로 표시.

**Tech Stack:** Prisma, Express/Hono, node-cron, React, recharts ^3.9.2, TypeScript

---

## File Map

**BE — 신규**
- `apps/api/prisma/schema.prisma` — `MonthlyOperationsSnapshot`, `MonthlyBudgetSnapshot` 모델 추가
- `apps/api/src/ops-report/ops-report.repo.ts`
- `apps/api/src/ops-report/ops-report.service.ts`
- `apps/api/src/ops-report/ops-report.routes.ts`
- `apps/api/src/ops-report/ops-report.controller.ts`
- `apps/api/src/jobs/monthlyOperationsReport.ts`
- `apps/api/src/jobs/monthlyBudgetReport.ts`

**BE — 수정**
- `apps/api/src/server.ts` — 두 잡 등록
- `apps/api/src/dashboard/dashboard.repo.ts` — FINANCE_MANAGER/HR_MANAGER stats 확장

**FE — 신규**
- `football/src/services/ops-report.service.ts`
- `football/src/types/ops-report.ts`
- `football/src/components/dashboard/OpsKpiSection.tsx`

**FE — 수정**
- `football/src/pages/dashboard/dashboardConfig.ts` — `showOpsKpi` 플래그
- `football/src/pages/dashboard/DashboardPage.tsx` — OpsKpiSection 렌더링
- `football/src/pages/reports/ReportsPage.tsx` — 연간 보고 탭 추가

---

### Task 1: Prisma 스키마 — MonthlyOperationsSnapshot + MonthlyBudgetSnapshot

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: 스키마에 두 모델 추가**

`apps/api/prisma/schema.prisma` 끝에 추가:

```prisma
model MonthlyBudgetSnapshot {
  id           Int      @id @default(autoincrement())
  seasonId     Int
  year         Int
  month        Int
  snapshotData Json
  totalBudget  Int
  totalActual  Int
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  season       Season   @relation(fields: [seasonId], references: [id])

  @@unique([seasonId, year, month])
}

model MonthlyOperationsSnapshot {
  id           Int      @id @default(autoincrement())
  seasonId     Int
  year         Int
  month        Int
  snapshotData Json
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  season       Season   @relation(fields: [seasonId], references: [id])

  @@unique([seasonId, year, month])
}
```

- [x] **Step 2: Migration 생성·적용**

```bash
cd apps/api
npx prisma migrate dev --name add_monthly_snapshots
```

Expected: migration 파일 생성, DB 적용 완료

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add MonthlyBudgetSnapshot and MonthlyOperationsSnapshot models"
```

---

### Task 2: ops-report 레포 + 서비스

**Files:**
- Create: `apps/api/src/ops-report/ops-report.repo.ts`
- Create: `apps/api/src/ops-report/ops-report.service.ts`

- [x] **Step 1: 레포 작성**

`apps/api/src/ops-report/ops-report.repo.ts`:

```typescript
import { PrismaClient } from "../generated/client";

export interface OpsSnapshotData {
  feeCollectionRate: number;
  feeDelinquencyRate: number;
  monthlySettlementRate: number;
  budgetExecutionRate: number;
  overrideCount: number;
  registrationRate: number;
  attendanceRate: number;
  noticeReadRate: number;
}

export class OpsReportRepository {
  constructor(private prisma: PrismaClient) {}

  async upsertOpsSnapshot(seasonId: number, year: number, month: number, data: OpsSnapshotData) {
    return this.prisma.monthlyOperationsSnapshot.upsert({
      where: { seasonId_year_month: { seasonId, year, month } },
      update: { snapshotData: data as object, updatedAt: new Date() },
      create: { seasonId, year, month, snapshotData: data as object },
    });
  }

  async findOpsSnapshot(seasonId: number, year: number, month: number) {
    return this.prisma.monthlyOperationsSnapshot.findUnique({
      where: { seasonId_year_month: { seasonId, year, month } },
    });
  }

  async findOpsSnapshotsBySeason(seasonId: number) {
    return this.prisma.monthlyOperationsSnapshot.findMany({
      where: { seasonId },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
  }

  async upsertBudgetSnapshot(
    seasonId: number, year: number, month: number,
    snapshotData: object, totalBudget: number, totalActual: number,
  ) {
    return this.prisma.monthlyBudgetSnapshot.upsert({
      where: { seasonId_year_month: { seasonId, year, month } },
      update: { snapshotData, totalBudget, totalActual, updatedAt: new Date() },
      create: { seasonId, year, month, snapshotData, totalBudget, totalActual },
    });
  }

  async findBudgetSnapshot(seasonId: number, year: number, month: number) {
    return this.prisma.monthlyBudgetSnapshot.findUnique({
      where: { seasonId_year_month: { seasonId, year, month } },
    });
  }

  async findBudgetSnapshotsBySeason(seasonId: number) {
    return this.prisma.monthlyBudgetSnapshot.findMany({
      where: { seasonId },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
  }
}
```

- [x] **Step 2: 서비스 작성 — 실시간 KPI 계산 로직**

`apps/api/src/ops-report/ops-report.service.ts`:

```typescript
import { PrismaClient } from "../generated/client";
import { OpsReportRepository, OpsSnapshotData } from "./ops-report.repo";

const DISCRETIONARY_CATEGORIES = ["TRAVEL", "EQUIPMENT", "SCOUTING", "YOUTH"] as const;

export class OpsReportService {
  constructor(
    private repo: OpsReportRepository,
    private prisma: PrismaClient,
  ) {}

  async computeOpsKpi(seasonId: number, year: number, month: number): Promise<OpsSnapshotData> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [
      totalFees, paidFees, delinquentFees,
      totalBudgetCeiling, totalActualSpend,
      overrideCount,
      totalRegistrations, approvedRegistrations,
      totalSessions, presentResults,
      totalNotifications, readNotifications,
    ] = await Promise.all([
      this.prisma.academyFee.count({ where: { createdAt: { gte: start, lt: end } } }),
      this.prisma.academyFee.count({ where: { createdAt: { gte: start, lt: end }, status: "PAID" } }),
      this.prisma.academyFee.count({ where: { createdAt: { gte: start, lt: end }, status: { in: ["OVERDUE", "LOCKED"] } } }),
      this.prisma.budgetCategoryPlan.findMany({
        where: { financialReport: { seasonId } },
        select: { mandatoryMinimum: true, knapsackAllocated: true },
      }).then((plans) => plans.reduce((sum, p) => sum + p.mandatoryMinimum + (p.knapsackAllocated ?? 0), 0)),
      this.prisma.operatingExpense.aggregate({
        where: { seasonId },
        _sum: { amount: true },
      }).then((r) => r._sum.amount ?? 0),
      this.prisma.budgetOverrideLog.count({
        where: { financialReport: { seasonId }, createdAt: { gte: start, lt: end } },
      }),
      this.prisma.youthRegistration.count({ where: { season: { id: seasonId } } }),
      this.prisma.youthRegistration.count({ where: { season: { id: seasonId }, status: "CONTRACTED" } }),
      this.prisma.trainingSession.findMany({
        where: { date: { gte: start, lt: end }, isApproved: true },
        select: { id: true },
      }).then((s) => s.length),
      this.prisma.trainingResult.count({
        where: {
          session: { date: { gte: start, lt: end }, isApproved: true },
          attendanceStatus: "PRESENT",
        },
      }),
      this.prisma.notification.count({ where: { createdAt: { gte: start, lt: end } } }),
      this.prisma.notification.count({ where: { createdAt: { gte: start, lt: end }, readAt: { not: null } } }),
    ]);

    const rate = (num: number, den: number) => den === 0 ? 0 : Math.round((num / den) * 1000) / 10;

    return {
      feeCollectionRate: rate(paidFees, totalFees),
      feeDelinquencyRate: rate(delinquentFees, totalFees),
      monthlySettlementRate: rate(paidFees, totalFees),
      budgetExecutionRate: rate(totalActualSpend, totalBudgetCeiling),
      overrideCount,
      registrationRate: rate(approvedRegistrations, totalRegistrations),
      attendanceRate: totalSessions === 0 ? 0 : rate(presentResults, totalSessions * 25), // 25: 팀 인원 근사
      noticeReadRate: rate(readNotifications, totalNotifications),
    };
  }

  async getOpsSnapshot(seasonId: number, year: number, month: number): Promise<OpsSnapshotData> {
    const existing = await this.repo.findOpsSnapshot(seasonId, year, month);
    if (existing) return existing.snapshotData as OpsSnapshotData;
    return this.computeOpsKpi(seasonId, year, month);
  }

  async getAnnualOpsReport(seasonId: number) {
    const snapshots = await this.repo.findOpsSnapshotsBySeason(seasonId);
    return snapshots.map((s) => ({
      year: s.year,
      month: s.month,
      data: s.snapshotData as OpsSnapshotData,
    }));
  }

  async computeBudgetSnapshot(seasonId: number, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const plans = await this.prisma.budgetCategoryPlan.findMany({
      where: { financialReport: { seasonId } },
      select: { category: true, mandatoryMinimum: true, knapsackAllocated: true },
    });

    const snapshotData: Record<string, { budget: number; actual: number }> = {};
    let totalBudget = 0;
    let totalActual = 0;

    for (const plan of plans) {
      const budget = plan.mandatoryMinimum + (plan.knapsackAllocated ?? 0);
      const actual = await this.prisma.operatingExpense.aggregate({
        where: { seasonId, category: plan.category, date: { gte: start, lt: end } },
        _sum: { amount: true },
      }).then((r) => r._sum.amount ?? 0);
      snapshotData[plan.category] = { budget, actual };
      totalBudget += budget;
      totalActual += actual;
    }

    return { snapshotData, totalBudget, totalActual };
  }

  async getBudgetSnapshot(seasonId: number, year: number, month: number) {
    const existing = await this.repo.findBudgetSnapshot(seasonId, year, month);
    if (existing) return existing;
    const { snapshotData, totalBudget, totalActual } = await this.computeBudgetSnapshot(seasonId, year, month);
    return { snapshotData, totalBudget, totalActual };
  }

  async getAnnualBudgetReport(seasonId: number) {
    return this.repo.findBudgetSnapshotsBySeason(seasonId);
  }
}
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/ops-report/
git commit -m "feat: add OpsReportRepository and OpsReportService with KPI calculation"
```

---

### Task 3: ops-report 컨트롤러 + 라우트

**Files:**
- Create: `apps/api/src/ops-report/ops-report.controller.ts`
- Create: `apps/api/src/ops-report/ops-report.routes.ts`

- [x] **Step 1: 컨트롤러 작성**

`apps/api/src/ops-report/ops-report.controller.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { requireUser } from "../lib/authMiddleware";
import { canReadFinance } from "../lib/permissions";
import { OpsReportService } from "./ops-report.service";

const canRead = (role: string, foRole: string | null | undefined) =>
  canReadFinance(role, foRole) ||
  (role === "FRONT_OFFICE" && foRole === "HR_MANAGER");

export class OpsReportController {
  constructor(private service: OpsReportService) {}

  getOpsKpi = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      const year = Number(req.query["year"]) || new Date().getFullYear();
      const month = Number(req.query["month"]) || new Date().getMonth(); // 전월
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getOpsSnapshot(seasonId, year, month);
      res.json(data);
    } catch (err) { next(err); }
  };

  getAnnualOps = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getAnnualOpsReport(seasonId);
      res.json(data);
    } catch (err) { next(err); }
  };

  getBudgetKpi = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      const year = Number(req.query["year"]) || new Date().getFullYear();
      const month = Number(req.query["month"]) || new Date().getMonth();
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getBudgetSnapshot(seasonId, year, month);
      res.json(data);
    } catch (err) { next(err); }
  };

  getAnnualBudget = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const data = await this.service.getAnnualBudgetReport(seasonId);
      res.json(data);
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 2: 라우트 작성**

`apps/api/src/ops-report/ops-report.routes.ts`:

```typescript
import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { OpsReportRepository } from "./ops-report.repo";
import { OpsReportService } from "./ops-report.service";
import { OpsReportController } from "./ops-report.controller";

const router = Router();
const repo = new OpsReportRepository(getPrisma());
const service = new OpsReportService(repo, getPrisma());
const controller = new OpsReportController(service);

router.get("/ops/kpi",       auth, controller.getOpsKpi);
router.get("/ops/annual",    auth, controller.getAnnualOps);
router.get("/budget/kpi",    auth, controller.getBudgetKpi);
router.get("/budget/annual", auth, controller.getAnnualBudget);

export default router;
```

- [x] **Step 3: server.ts에 라우트 등록**

`apps/api/src/server.ts`에서 다른 라우터 등록 패턴 옆에 추가:

```typescript
import opsReportRouter from "./ops-report/ops-report.routes";
// ...
app.use("/api/reports", opsReportRouter);
```

- [x] **Step 4: TypeScript 체크**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "ops-report"
```

Expected: 출력 없음

- [x] **Step 5: Commit**

```bash
git add apps/api/src/ops-report/ apps/api/src/server.ts
git commit -m "feat: add ops-report routes for KPI and budget snapshots"
```

---

### Task 4: Cron Jobs — monthlyOperationsReport + monthlyBudgetReport

**Files:**
- Create: `apps/api/src/jobs/monthlyOperationsReport.ts`
- Create: `apps/api/src/jobs/monthlyBudgetReport.ts`
- Modify: `apps/api/src/server.ts`

- [x] **Step 1: monthlyOperationsReport 잡 작성**

`apps/api/src/jobs/monthlyOperationsReport.ts`:

```typescript
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { OpsReportRepository } from "../ops-report/ops-report.repo";
import { OpsReportService } from "../ops-report/ops-report.service";

export async function runMonthlyOperationsReport() {
  const prisma = getPrisma();
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth(); // 전월

  const seasons = await prisma.season.findMany({ where: { isActive: true }, select: { id: true } });
  const repo = new OpsReportRepository(prisma);
  const service = new OpsReportService(repo, prisma);

  for (const season of seasons) {
    const data = await service.computeOpsKpi(season.id, year, month);
    await repo.upsertOpsSnapshot(season.id, year, month, data);
  }
}

export function startMonthlyOperationsReportJob() {
  cron.schedule("0 0 1 * *", () => { runMonthlyOperationsReport().catch(console.error); });
}
```

- [x] **Step 2: monthlyBudgetReport 잡 작성**

`apps/api/src/jobs/monthlyBudgetReport.ts`:

```typescript
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { OpsReportRepository } from "../ops-report/ops-report.repo";
import { OpsReportService } from "../ops-report/ops-report.service";

export async function runMonthlyBudgetReport() {
  const prisma = getPrisma();
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();

  const seasons = await prisma.season.findMany({ where: { isActive: true }, select: { id: true } });
  const repo = new OpsReportRepository(prisma);
  const service = new OpsReportService(repo, prisma);

  for (const season of seasons) {
    const { snapshotData, totalBudget, totalActual } = await service.computeBudgetSnapshot(season.id, year, month);
    await repo.upsertBudgetSnapshot(season.id, year, month, snapshotData, totalBudget, totalActual);
  }
}

export function startMonthlyBudgetReportJob() {
  cron.schedule("0 0 1 * *", () => { runMonthlyBudgetReport().catch(console.error); });
}
```

- [x] **Step 3: server.ts에 두 잡 등록**

```typescript
import { startMonthlyOperationsReportJob } from "./jobs/monthlyOperationsReport";
import { startMonthlyBudgetReportJob } from "./jobs/monthlyBudgetReport";
// 기존 startMonthlyDepreciationJob() 등 옆에:
startMonthlyOperationsReportJob();
startMonthlyBudgetReportJob();
```

- [x] **Step 4: TypeScript 체크**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -E "ops-report|monthlyOps|monthlyBudget"
```

Expected: 출력 없음

- [x] **Step 5: Commit**

```bash
git add apps/api/src/jobs/ apps/api/src/server.ts
git commit -m "feat: add monthly operations and budget report cron jobs"
```

---

### Task 5: 프론트엔드 — 타입 + API 서비스

**Files:**
- Create: `football/src/types/ops-report.ts`
- Create: `football/src/services/ops-report.service.ts`

- [x] **Step 1: 타입 정의**

`football/src/types/ops-report.ts`:

```typescript
export interface OpsSnapshotData {
  feeCollectionRate: number;
  feeDelinquencyRate: number;
  monthlySettlementRate: number;
  budgetExecutionRate: number;
  overrideCount: number;
  registrationRate: number;
  attendanceRate: number;
  noticeReadRate: number;
}

export interface BudgetSnapshotData {
  snapshotData: Record<string, { budget: number; actual: number }>;
  totalBudget: number;
  totalActual: number;
}

export interface AnnualOpsEntry {
  year: number;
  month: number;
  data: OpsSnapshotData;
}
```

- [x] **Step 2: API 서비스 작성**

`football/src/services/ops-report.service.ts`:

```typescript
import { api } from './api'
import type { OpsSnapshotData, BudgetSnapshotData, AnnualOpsEntry } from '@/types/ops-report'

export const opsReportApi = {
  getOpsKpi: (seasonId: number, year: number, month: number) =>
    api.get<OpsSnapshotData>(`/reports/ops/kpi?seasonId=${seasonId}&year=${year}&month=${month}`),

  getAnnualOps: (seasonId: number) =>
    api.get<AnnualOpsEntry[]>(`/reports/ops/annual?seasonId=${seasonId}`),

  getBudgetKpi: (seasonId: number, year: number, month: number) =>
    api.get<BudgetSnapshotData>(`/reports/budget/kpi?seasonId=${seasonId}&year=${year}&month=${month}`),

  getAnnualBudget: (seasonId: number) =>
    api.get<BudgetSnapshotData[]>(`/reports/budget/annual?seasonId=${seasonId}`),
}
```

- [x] **Step 3: TypeScript 체크**

```bash
cd football && npx tsc --noEmit 2>&1 | grep "ops-report"
```

Expected: 출력 없음

- [x] **Step 4: Commit**

```bash
git add football/src/types/ops-report.ts football/src/services/ops-report.service.ts
git commit -m "feat: add ops-report frontend types and API service"
```

---

### Task 6: OpsKpiSection 대시보드 컴포넌트

**Files:**
- Create: `football/src/components/dashboard/OpsKpiSection.tsx`

- [x] **Step 1: 컴포넌트 작성**

`football/src/components/dashboard/OpsKpiSection.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

interface KpiItem {
  label: string
  value: number
  unit: string
  warnBelow?: number
  warnAbove?: number
  dangerAbove?: number
}

interface Props {
  role: 'FINANCE_MANAGER' | 'HR_MANAGER' | 'ADMIN'
  data: Record<string, number>
}

function KpiCard({ label, value, unit, warnBelow, warnAbove, dangerAbove }: KpiItem) {
  const color =
    (dangerAbove !== undefined && value > dangerAbove) ? 'text-red-600' :
    (warnAbove !== undefined && value > warnAbove) ? 'text-yellow-600' :
    (warnBelow !== undefined && value < warnBelow) ? 'text-yellow-600' :
    'text-green-600'

  return (
    <div className="rounded-lg border p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}{unit}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

const FINANCE_KPIS = (data: Record<string, number>): KpiItem[] => [
  { label: '회비 수납율', value: data['feeCollectionRate'] ?? 0, unit: '%', warnBelow: 80 },
  { label: '미납률', value: data['feeDelinquencyRate'] ?? 0, unit: '%', warnAbove: 10 },
  { label: '예산 집행률', value: data['budgetExecutionRate'] ?? 0, unit: '%', warnAbove: 90, dangerAbove: 100 },
  { label: '예외 승인 건수', value: data['overrideCount'] ?? 0, unit: '건', warnAbove: 0 },
  { label: '월말 정산 완료율', value: data['monthlySettlementRate'] ?? 0, unit: '%', warnBelow: 100 },
]

const HR_KPIS = (data: Record<string, number>): KpiItem[] => [
  { label: '등록 완료율', value: data['registrationRate'] ?? 0, unit: '%', warnBelow: 90 },
  { label: '출석률 (프로)', value: data['attendanceRate'] ?? 0, unit: '%', warnBelow: 80 },
  { label: '공지 열람률', value: data['noticeReadRate'] ?? 0, unit: '%', warnBelow: 60 },
]

export function OpsKpiSection({ role, data }: Props) {
  const { t } = useTranslation('common')
  const kpis = role === 'HR_MANAGER' ? HR_KPIS(data) : FINANCE_KPIS(data)
  const title = role === 'HR_MANAGER' ? '운영 KPI' : '재무 KPI'

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/components/dashboard/OpsKpiSection.tsx
git commit -m "feat: add OpsKpiSection dashboard component"
```

---

### Task 7: dashboardConfig + DashboardPage 연결

**Files:**
- Modify: `football/src/pages/dashboard/dashboardConfig.ts`
- Modify: `football/src/pages/dashboard/DashboardPage.tsx`

- [x] **Step 1: dashboardConfig에 showOpsKpi 추가**

`dashboardConfig.ts`의 `DashboardConfig` 인터페이스에:

```typescript
showOpsKpi?: 'finance' | 'hr' | 'all'
```

`FINANCE_MANAGER` 블록:

```typescript
showOpsKpi: 'finance',
```

`HR_MANAGER` 블록:

```typescript
showOpsKpi: 'hr',
```

ADMIN 블록 (role === 'ADMIN'):

```typescript
showOpsKpi: 'all',
```

- [x] **Step 2: DashboardPage에 OpsKpiSection 추가**

`DashboardPage.tsx` import 추가:

```typescript
import { OpsKpiSection } from '@/components/dashboard/OpsKpiSection'
import { opsReportApi } from '@/services/ops-report.service'
import type { OpsSnapshotData } from '@/types/ops-report'
```

state 추가:

```typescript
const [opsKpi, setOpsKpi] = useState<OpsSnapshotData | null>(null)
```

`seasonApi.active()` 체인 내부, tasks 배열에 추가:

```typescript
if (config.showOpsKpi) {
  const now = new Date()
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const month = now.getMonth() === 0 ? 12 : now.getMonth()
  tasks.push(
    opsReportApi.getOpsKpi(season.id, year, month)
      .then(setOpsKpi)
      .catch(() => null)
  )
}
```

렌더링 (AcademyFinanceSection 아래):

```tsx
{config.showOpsKpi && opsKpi && (
  <OpsKpiSection
    role={user.frontOfficeRole === 'HR_MANAGER' ? 'HR_MANAGER' : 'FINANCE_MANAGER'}
    data={opsKpi as unknown as Record<string, number>}
  />
)}
```

- [x] **Step 3: TypeScript 체크**

```bash
cd football && npx tsc --noEmit 2>&1 | grep -E "dashboard|OpsKpi"
```

Expected: 출력 없음

- [x] **Step 4: Commit**

```bash
git add football/src/pages/dashboard/
git commit -m "feat: wire OpsKpiSection into dashboard by role"
```

---

### Task 8: ReportsPage 연간 보고 탭

**Files:**
- Modify: `football/src/pages/reports/ReportsPage.tsx`

- [x] **Step 1: 기존 ReportsPage 읽기**

```bash
cat football/src/pages/reports/ReportsPage.tsx
```

- [x] **Step 2: 연간 KPI 라인 차트 섹션 추가**

기존 import에 추가:

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { opsReportApi } from '@/services/ops-report.service'
import { seasonApi } from '@/services/season.service'
import type { AnnualOpsEntry } from '@/types/ops-report'
```

state 추가:

```typescript
const [annualOps, setAnnualOps] = useState<AnnualOpsEntry[]>([])
```

useEffect에 추가:

```typescript
seasonApi.active().then((season) => {
  if (!season) return
  opsReportApi.getAnnualOps(season.id).then(setAnnualOps).catch(() => null)
})
```

차트 섹션 JSX (기존 섹션 아래):

```tsx
{annualOps.length > 0 && (
  <div className="space-y-3">
    <h3 className="text-lg font-semibold">연간 운영 KPI 추이</h3>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={annualOps.map((e) => ({
        label: `${e.year}-${String(e.month).padStart(2, '0')}`,
        수납율: e.data.feeCollectionRate,
        미납률: e.data.feeDelinquencyRate,
        예산집행률: e.data.budgetExecutionRate,
        출석률: e.data.attendanceRate,
      }))}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis unit="%" domain={[0, 100]} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="수납율" stroke="#22c55e" dot={false} />
        <Line type="monotone" dataKey="미납률" stroke="#ef4444" dot={false} />
        <Line type="monotone" dataKey="예산집행률" stroke="#3b82f6" dot={false} />
        <Line type="monotone" dataKey="출석률" stroke="#f59e0b" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
```

- [x] **Step 3: TypeScript 체크**

```bash
cd football && npx tsc --noEmit 2>&1 | grep "reports"
```

Expected: 출력 없음

- [x] **Step 4: Commit**

```bash
git add football/src/pages/reports/ReportsPage.tsx
git commit -m "feat: add annual KPI trend chart to reports page"
```
