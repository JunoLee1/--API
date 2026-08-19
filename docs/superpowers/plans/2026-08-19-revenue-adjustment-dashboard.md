# Revenue Adjustment + Dashboard Charts Implementation Plan

**Date:** 2026-08-19  
**Grill answers:** Q1=C, Q2=C, Q3=B, Q4=D, Q5=A, Q6=C, Q7=C, Q8=B, Q9=C+D

---

## 1. 설계 요약

| 항목 | 결정 |
|------|------|
| 적용 범위 | FinancialReport(시즌) + MonthlySettlementReport(월) 양쪽 |
| 저장 방식 | `RevenueAdjustment` 모델 + `LedgerEntry` 1:1 연결 |
| 보정 방식 | 8개 수익 항목 전부 ±delta (원본 덮어쓰기 금지) |
| 드릴다운 | ticket/merch/academy/sponsorship/other → LedgerEntry, broadcast/subsidy/parentCompany → Adjustment only |
| 스냅샷 | 상신(PENDING_FIRST) 시점, 반려 → DRAFT 복귀 후 재계산 시 덮어씀 |
| 계정과목 | `AccountCode` DB 테이블, `LedgerEntry` + `OperatingExpense` 양쪽 FK |
| 도넛 차트 | 8개 수익 항목, 시즌/월 토글 |
| 성장 추이 | 최근 12개월, 막대(수익+비용) + 꺾은선(순이익) |
| 게이지 | 3개: 수익달성률 + 예산소진율 + 월기여도 |

---

## 2. Prisma 스키마

### 2-1. AccountCode

```prisma
enum AccountCodeType {
  REVENUE
  EXPENSE
}

model AccountCode {
  id        Int             @id @default(autoincrement())
  code      String          @unique   // e.g. "4101", "5201"
  name      String                    // e.g. "입장권수익", "식비"
  type      AccountCodeType
  createdAt DateTime        @default(now())

  ledgerEntries     LedgerEntry[]
  operatingExpenses OperatingExpense[]
}
```

**LedgerEntry에 FK 추가:**
```prisma
model LedgerEntry {
  // ... existing fields ...
  accountCodeId Int?
  accountCode   AccountCode? @relation(fields: [accountCodeId], references: [id])
}
```

**OperatingExpense에 FK 추가:**
```prisma
model OperatingExpense {
  // ... existing fields ...
  accountCodeId Int?
  accountCode   AccountCode? @relation(fields: [accountCodeId], references: [id])
}
```

### 2-2. RevenueField enum

```prisma
enum RevenueField {
  TICKET
  SPONSORSHIP
  BROADCAST
  MERCHANDISE
  SUBSIDY
  PARENT_COMPANY
  ACADEMY_FEE
  OTHER
}
```

### 2-3. RevenueAdjustment

```prisma
model RevenueAdjustment {
  id                Int          @id @default(autoincrement())
  financialReportId Int?
  monthlyReportId   Int?
  field             RevenueField
  delta             Int          // ±원
  memo              String?
  createdById       Int
  createdAt         DateTime     @default(now())
  ledgerEntryId     Int?         @unique

  financialReport MonthlySettlementReport? @relation("MonthlyAdj", fields: [monthlyReportId], references: [id])
  financialRep    FinancialReport?          @relation("SeasonAdj",  fields: [financialReportId], references: [id])
  ledgerEntry     LedgerEntry?              @relation(fields: [ledgerEntryId], references: [id])
  createdBy       User                      @relation(fields: [createdById], references: [id])

  @@check(name: "must_have_target", constraint: "\"financialReportId\" IS NOT NULL OR \"monthlyReportId\" IS NOT NULL")
}
```

**FinancialReport에 역관계 추가:**
```prisma
model FinancialReport {
  // ...
  revenueAdjustments RevenueAdjustment[] @relation("SeasonAdj")
}
```

**MonthlySettlementReport에 역관계 추가:**
```prisma
model MonthlySettlementReport {
  // ...
  revenueAdjustments RevenueAdjustment[] @relation("MonthlyAdj")
}
```

---

## 3. Migration SQL

```sql
-- AccountCode
CREATE TYPE "AccountCodeType" AS ENUM ('REVENUE', 'EXPENSE');

CREATE TABLE "AccountCode" (
  "id"        SERIAL PRIMARY KEY,
  "code"      TEXT NOT NULL UNIQUE,
  "name"      TEXT NOT NULL,
  "type"      "AccountCodeType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FK on LedgerEntry
ALTER TABLE "LedgerEntry"
  ADD COLUMN "accountCodeId" INTEGER REFERENCES "AccountCode"("id");

-- FK on OperatingExpense
ALTER TABLE "OperatingExpense"
  ADD COLUMN "accountCodeId" INTEGER REFERENCES "AccountCode"("id");

-- RevenueField enum
CREATE TYPE "RevenueField" AS ENUM (
  'TICKET','SPONSORSHIP','BROADCAST','MERCHANDISE',
  'SUBSIDY','PARENT_COMPANY','ACADEMY_FEE','OTHER'
);

-- RevenueAdjustment
CREATE TABLE "RevenueAdjustment" (
  "id"                SERIAL PRIMARY KEY,
  "financialReportId" INTEGER REFERENCES "FinancialReport"("id"),
  "monthlyReportId"   INTEGER REFERENCES "MonthlySettlementReport"("id"),
  "field"             "RevenueField" NOT NULL,
  "delta"             INTEGER NOT NULL,
  "memo"              TEXT,
  "createdById"       INTEGER NOT NULL REFERENCES "User"("id"),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ledgerEntryId"     INTEGER UNIQUE REFERENCES "LedgerEntry"("id"),
  CONSTRAINT "must_have_target"
    CHECK ("financialReportId" IS NOT NULL OR "monthlyReportId" IS NOT NULL)
);
```

---

## 4. 계정과목 매핑 (기본 seed)

```typescript
// seed data
const ACCOUNT_CODES = [
  { code: '4101', name: '입장권수익',   type: 'REVENUE' },
  { code: '4102', name: '스폰서십수익', type: 'REVENUE' },
  { code: '4103', name: '방송권수익',   type: 'REVENUE' },
  { code: '4104', name: '상품수익',     type: 'REVENUE' },
  { code: '4105', name: '보조금수익',   type: 'REVENUE' },
  { code: '4106', name: '모기업지원',   type: 'REVENUE' },
  { code: '4107', name: '유소년아카데미수익', type: 'REVENUE' },
  { code: '4108', name: '기타수익',     type: 'REVENUE' },
  { code: '5101', name: '식비',         type: 'EXPENSE' },
  { code: '5102', name: '교통비',       type: 'EXPENSE' },
  { code: '5103', name: '장비비',       type: 'EXPENSE' },
  { code: '5104', name: '스카우팅비',   type: 'EXPENSE' },
  { code: '5105', name: '유소년육성비', type: 'EXPENSE' },
]
```

---

## 5. RevenueField ↔ LedgerEntry category 매핑 (BE 상수)

```typescript
// apps/api/src/revenue-adjustment/revenue-field.map.ts
import { LedgerEntryCategory, RevenueField } from '../generated/client'

export const FIELD_TO_CATEGORY: Partial<Record<RevenueField, LedgerEntryCategory>> = {
  TICKET:      'TICKET_SALES',
  SPONSORSHIP: 'SPONSORSHIP',
  MERCHANDISE: 'MERCHANDISE',
  ACADEMY_FEE: 'ACADEMY_FEE',
  OTHER:       'OTHER',
  // BROADCAST, SUBSIDY, PARENT_COMPANY → undefined (외부 데이터, 드릴다운 없음)
}
```

---

## 6. BE 모듈: `src/revenue-adjustment/`

### 6-1. Repository

```typescript
// revenue-adjustment.repo.ts
export class RevenueAdjustmentRepository {
  constructor(private prisma: PrismaClient) {}

  findByFinancialReport(financialReportId: number) {
    return this.prisma.revenueAdjustment.findMany({
      where: { financialReportId },
      include: { createdBy: { select: { username: true } }, ledgerEntry: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  findByMonthlyReport(monthlyReportId: number) {
    return this.prisma.revenueAdjustment.findMany({
      where: { monthlyReportId },
      include: { createdBy: { select: { username: true } }, ledgerEntry: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  create(data: {
    financialReportId?: number
    monthlyReportId?: number
    field: RevenueField
    delta: number
    memo?: string
    createdById: number
  }) {
    return this.prisma.$transaction(async (tx) => {
      // LedgerEntry 자동 생성 (delta > 0: INCOME, delta < 0: ADJUSTMENT)
      const le = await tx.ledgerEntry.create({
        data: {
          type: data.delta > 0 ? 'INCOME' : 'EXPENSE',
          category: FIELD_TO_CATEGORY[data.field] ?? 'OTHER',
          amount: Math.abs(data.delta),
          description: `수익보정[${data.field}] ${data.memo ?? ''}`.trim(),
          seasonId: await resolveSeasonId(tx, data),
          createdById: data.createdById,
          isAdjustment: true,
        },
      })
      return tx.revenueAdjustment.create({
        data: { ...data, ledgerEntryId: le.id },
      })
    })
  }

  sumByField(target: { financialReportId?: number; monthlyReportId?: number }) {
    return this.prisma.revenueAdjustment.groupBy({
      by: ['field'],
      where: target,
      _sum: { delta: true },
    })
  }
}
```

### 6-2. Service

```typescript
// revenue-adjustment.service.ts
export class RevenueAdjustmentService {
  constructor(private repo: RevenueAdjustmentRepository) {}

  async create(data: CreateAdjDto & { createdById: number }) {
    if (data.delta === 0) throw new AppError(400, 'DELTA_ZERO')
    return this.repo.create(data)
  }

  async drilldown(params: {
    target: 'financial' | 'monthly'
    targetId: number
    field: RevenueField
    year: number
    month?: number
  }) {
    const category = FIELD_TO_CATEGORY[params.field]
    if (!category) {
      // 외부 데이터 필드: Adjustment 내역만
      return { type: 'adjustments', items: await this.repo.findByField(params) }
    }
    // LedgerEntry 드릴다운
    const entries = await getLedgerEntries({ category, year: params.year, month: params.month })
    const adjustments = await this.repo.findByField(params)
    return { type: 'ledger', items: entries, adjustments }
  }
}
```

### 6-3. Routes

```typescript
// revenue-adjustment.routes.ts
const router = new Hono()

// POST /revenue-adjustment
router.post('/', auth(), async (c) => {
  const body = await c.req.json()
  const user = c.get('user')
  if (!['ADMIN', 'FINANCE_MANAGER', 'GM'].includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN')
  }
  const result = await service.create({ ...body, createdById: user.id })
  return c.json(result, 201)
})

// GET /revenue-adjustment/drilldown
router.get('/drilldown', auth(), async (c) => {
  const { target, targetId, field, year, month } = c.req.query()
  const result = await service.drilldown({
    target: target as 'financial' | 'monthly',
    targetId: Number(targetId),
    field: field as RevenueField,
    year: Number(year),
    month: month ? Number(month) : undefined,
  })
  return c.json(result)
})

// GET /revenue-adjustment?financialReportId=&monthlyReportId=
router.get('/', auth(), async (c) => {
  const { financialReportId, monthlyReportId } = c.req.query()
  const items = financialReportId
    ? await repo.findByFinancialReport(Number(financialReportId))
    : await repo.findByMonthlyReport(Number(monthlyReportId))
  return c.json(items)
})
```

---

## 7. 계정과목 관리 BE (ADMIN 전용)

```typescript
// account-code.routes.ts
router.get('/', auth(), async (c) => c.json(await repo.findAll()))
router.post('/', auth(), adminOnly, async (c) => {
  const body = await c.req.json()
  return c.json(await repo.create(body), 201)
})
router.put('/:id', auth(), adminOnly, async (c) => {
  const body = await c.req.json()
  return c.json(await repo.update(Number(c.req.param('id')), body))
})
router.delete('/:id', auth(), adminOnly, async (c) => {
  await repo.delete(Number(c.req.param('id')))
  return c.body(null, 204)
})
```

---

## 8. FE Types

```typescript
// types/revenue-adjustment.ts
export type RevenueField =
  | 'TICKET' | 'SPONSORSHIP' | 'BROADCAST' | 'MERCHANDISE'
  | 'SUBSIDY' | 'PARENT_COMPANY' | 'ACADEMY_FEE' | 'OTHER'

export interface RevenueAdjustment {
  id: number
  financialReportId?: number
  monthlyReportId?: number
  field: RevenueField
  delta: number
  memo?: string
  createdAt: string
  createdBy: { username: string }
}

export interface DrilldownResult {
  type: 'ledger' | 'adjustments'
  items: LedgerEntry[] | RevenueAdjustment[]
  adjustments?: RevenueAdjustment[]
}

// types/account-code.ts
export interface AccountCode {
  id: number
  code: string
  name: string
  type: 'REVENUE' | 'EXPENSE'
}
```

---

## 9. FE 컴포넌트

### 9-1. RevenueAdjustmentSheet (드릴다운 + 보정 추가)

```
RevenueAdjustmentSheet
├── props: field, targetType, targetId, year, month?
├── Sheet (slide-over)
│   ├── 원천 거래 목록 (LedgerEntry or Adjustment only)
│   ├── 보정 내역 목록 (RevenueAdjustment list)
│   └── 보정 추가 폼 (delta, memo)
```

- FINANCE_MANAGER/GM/ADMIN만 보정 추가 버튼 노출
- BROADCAST/SUBSIDY/PARENT_COMPANY는 LedgerEntry 섹션 숨김

### 9-2. 대시보드 차트 (DashboardCharts 컴포넌트)

```
DashboardCharts
├── DonutChart (수익 포트폴리오)
│   ├── toggle: 시즌 전체 / 특정 월
│   └── 8개 revenueField 슬라이스
├── BarLineChart (성장 추이)
│   ├── X: 최근 12개월
│   ├── Bar: totalRevenue (파랑), totalExpense (빨강)
│   └── Line: netIncome (초록), 우측 Y축
└── GaugeGroup (달성률)
    ├── Gauge 1: 수익달성률 = 누적수익 / 시즌목표수익
    ├── Gauge 2: 예산소진율 = 누적지출 / BudgetHeader.totalBudget
    └── Gauge 3: 월기여도 = 이번달수익 / 연간목표수익
```

**차트 라이브러리:** 기존 프로젝트 사용 라이브러리 확인 후 Recharts 또는 Chart.js 사용

### 9-3. AccountCode 관리 페이지 (ADMIN)

```
/settings/account-codes
├── AccountCode 목록 테이블 (code, name, type)
├── 추가 폼 (inline row 또는 Dialog)
└── 수정/삭제 (ADMIN 전용)
```

---

## 10. BE 대시보드 집계 API

```typescript
// GET /dashboard/finance?seasonId=&year=&month=
// Response:
{
  donut: {
    season: Record<RevenueField, number>,  // 시즌 누적
    monthly: Record<RevenueField, number>, // 해당 월
  },
  trend: Array<{
    year: number, month: number,
    totalRevenue: number, totalExpense: number, netIncome: number
  }>,  // 최근 12개월
  gauges: {
    revenueAchievement: { actual: number, target: number },  // 누적수익 / 목표수익
    budgetConsumption:  { spent: number, approved: number }, // 누적지출 / 승인예산
    monthlyContribution: { monthly: number, annualTarget: number },
  }
}
```

---

## 11. 파일 변경 맵

| 파일 | 변경 |
|------|------|
| `prisma/schema.prisma` | AccountCode, RevenueAdjustment 모델 추가; LedgerEntry·OperatingExpense FK |
| `prisma/migrations/…` | migration SQL |
| `prisma/seed.ts` | AccountCode 기본 데이터 |
| `src/revenue-adjustment/revenue-adjustment.repo.ts` | 신규 |
| `src/revenue-adjustment/revenue-adjustment.service.ts` | 신규 |
| `src/revenue-adjustment/revenue-adjustment.routes.ts` | 신규 |
| `src/revenue-adjustment/revenue-field.map.ts` | 신규 |
| `src/account-code/account-code.routes.ts` | 신규 |
| `src/account-code/account-code.repo.ts` | 신규 |
| `src/dashboard/dashboard.routes.ts` | 신규 |
| `src/apiRouter.ts` | 3개 라우터 등록 |
| `football/src/types/revenue-adjustment.ts` | 신규 |
| `football/src/types/account-code.ts` | 신규 |
| `football/src/services/revenueAdjustment.service.ts` | 신규 |
| `football/src/services/accountCode.service.ts` | 신규 |
| `football/src/services/dashboard.service.ts` | 신규 |
| `football/src/pages/reports/MonthlySettlementDetailPage.tsx` | RevenueAdjustmentSheet 통합 |
| `football/src/pages/reports/DashboardCharts.tsx` | 신규 (도넛+막대꺾은선+게이지) |
| `football/src/pages/settings/AccountCodesPage.tsx` | 신규 (ADMIN) |
| `football/src/App.tsx` | `/settings/account-codes` 라우트 등록 |

---

## 12. 스냅샷 로직 (MonthlySettlementReport)

```typescript
// settlement-report.service.ts
async submit(id: number, submitterId: number) {
  const report = await this.repo.findById(id)
  if (report.status !== 'DRAFT') throw new AppError(400, 'INVALID_STATUS')

  const snapshot = {
    totalRevenue: report.totalRevenue,
    totalExpense: report.totalExpense,
    netIncome: report.netIncome,
    revenueBreakdown: report.revenueBreakdown,
    submittedAt: new Date().toISOString(),
  }

  return this.repo.update(id, {
    status: 'PENDING_FIRST',
    snapshotJson: snapshot,
    submittedById: submitterId,
    submittedAt: new Date(),
  })
}

async reject(id: number, rejecterId: number, reason: string) {
  // DRAFT 복귀, 스냅샷 유지 (반려 전 숫자 열람 가능)
  return this.repo.update(id, {
    status: 'DRAFT',
    rejectionReason: reason,
    rejectedById: rejecterId,
    rejectedAt: new Date(),
    // snapshotJson은 건드리지 않음 — 재상신 시 덮어씀
  })
}

async regenerate(id: number) {
  // DRAFT 상태에서 수동 재계산
  const report = await this.repo.findById(id)
  if (report.status !== 'DRAFT') throw new AppError(400, 'INVALID_STATUS')
  const fresh = await this.computeAggregates(report.seasonId, report.year, report.month)
  return this.repo.update(id, { ...fresh, snapshotJson: null })
}
```
