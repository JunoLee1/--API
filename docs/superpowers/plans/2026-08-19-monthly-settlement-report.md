# 월말 결산 보고서 (MonthlySettlementReport) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매월 말 수익·운영비·P&L을 자동 집계한 웹 보고서를 생성하고, FINANCE_STAFF → FINANCE_MANAGER → GM 3단계 전자결재 후 데이터를 자동 잠금. 외부 제출용 Excel(3 시트) 다운로드 제공.

**Tech Stack:** Express + Prisma + exceljs (BE), React + Vite (FE), node-cron (cron)

---

## 확정 설계 결정 요약

| 항목 | 결정 |
|------|------|
| 보고서 범위 | 수익 + 운영비 + P&L + 예산 대비 실적(variance) |
| 시간 단위 | 월(year + month + seasonId), `@@unique([seasonId, year, month])` |
| DB 모델 | 신규 `MonthlySettlementReport` |
| 데이터 저장 | 집계 컬럼(totalRevenue, totalExpense, netIncome) + `snapshotJson Json` |
| 결재 흐름 | FINANCE_STAFF(초안) → FINANCE_MANAGER(1차) → GM(최종) |
| 자동 잠금 | `LedgerPeriodLock` 생성 + `AcademyFee` PAID→LOCKED |
| Excel 생성 | BE `exceljs`, 시트 3개(수익·운영비·P&L), FE는 anchor 다운로드 |
| UI 위치 | `/reports` 탭 분리: `[일반 보고서]` \| `[월말 결산]` |
| 상세 URL | `/reports/monthly/:year/:month` |
| 메모 | `note String? @db.Text` 단일 필드 |
| 보고서 생성 | Cron `0 0 1 * *` 자동 초안 + 수동 재생성 버튼 |
| 상태값 | `DRAFT → PENDING_FIRST → FIRST_APPROVED → APPROVED → REJECTED` |
| 반려 복귀 | 항상 DRAFT로 복귀, `rejectionReason` 저장 |
| 수익 소스 | `LedgerEntry` (type=INCOME, 월별 필터) |
| 지출 소스 | `OperatingExpense` (date 월별 필터) |

---

## File Map

**Backend (apps/api/):**
- Modify: `apps/api/prisma/schema.prisma` — `MonthlySettlementReport` 모델, `SettlementStatus` 열거형 추가
- Create: `apps/api/prisma/migrations/20260819000004_monthly_settlement_report/migration.sql`
- Create: `apps/api/src/monthly-settlement/dto/monthly-settlement.dto.ts`
- Create: `apps/api/src/monthly-settlement/monthly-settlement.repo.ts`
- Create: `apps/api/src/monthly-settlement/monthly-settlement.service.ts`
- Create: `apps/api/src/monthly-settlement/monthly-settlement.controller.ts`
- Create: `apps/api/src/monthly-settlement/monthly-settlement.routes.ts`
- Create: `apps/api/src/monthly-settlement/monthly-settlement.excel.ts`
- Modify: `apps/api/src/jobs/monthlyBudgetReport.ts` — 월말 결산 초안 자동 생성 추가
- Modify: `apps/api/src/apiRouter.ts` — `/monthly-settlement` 라우트 등록
- Create: `apps/api/__test__/monthly-settlement/monthly-settlement.service.test.ts`

**Frontend (football/src/):**
- Create: `football/src/types/monthly-settlement.ts`
- Create: `football/src/services/monthlySettlement.service.ts`
- Modify: `football/src/pages/reports/ReportsPage.tsx` — `[월말 결산]` 탭 추가
- Create: `football/src/pages/reports/MonthlySettlementTab.tsx` — 월말 결산 목록 탭
- Create: `football/src/pages/reports/MonthlySettlementDetailPage.tsx` — 상세/결재 페이지
- Modify: `football/src/router.tsx` — `/reports/monthly/:year/:month` 라우트 등록

---

## Task 1: Prisma 스키마

**Files:** `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `SettlementStatus` 열거형 추가**

```prisma
enum SettlementStatus {
  DRAFT
  PENDING_FIRST
  FIRST_APPROVED
  APPROVED
  REJECTED
}
```

- [ ] **Step 2: `MonthlySettlementReport` 모델 추가**

```prisma
model MonthlySettlementReport {
  id      Int              @id @default(autoincrement())
  seasonId Int
  year    Int
  month   Int

  status          SettlementStatus @default(DRAFT)
  rejectionReason String?

  // 집계 컬럼 (빠른 트렌드 쿼리용)
  totalRevenue Float @default(0)
  totalExpense Float @default(0)
  netIncome    Float @default(0)

  // 세부 스냅샷
  // { revenue: { TICKET_SALES: N, ACADEMY_FEE: N, SPONSORSHIP: N, UNIFORM_SALES: N, OTHER: N },
  //   expenses: { TRAVEL: N, EQUIPMENT: N, SCOUTING: N, MEAL: N, YOUTH: N, MEDICAL: N },
  //   budgetComparison: { TRAVEL: { budget: N, actual: N, variance: N }, ... },
  //   pnl: { totalRevenue: N, totalExpense: N, netIncome: N } }
  snapshotJson Json @default("{}")

  note String? @db.Text

  // 결재 체인
  createdById        Int
  firstSubmittedById Int?
  firstSubmittedAt   DateTime?
  firstApproverId    Int?
  firstApprovedAt    DateTime?
  approverId         Int?
  approvedAt         DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  season          Season @relation(fields: [seasonId], references: [id])
  createdBy       User   @relation("SettlementCreator", fields: [createdById], references: [id])
  firstSubmittedBy User? @relation("SettlementFirstSubmitter", fields: [firstSubmittedById], references: [id])
  firstApprover   User? @relation("SettlementFirstApprover", fields: [firstApproverId], references: [id])
  approver        User? @relation("SettlementApprover", fields: [approverId], references: [id])

  @@unique([seasonId, year, month])
}
```

Season, User 모델에 역방향 관계 필드 추가:
```prisma
// Season에 추가
monthlySettlements MonthlySettlementReport[]

// User에 추가
settlementsCreated        MonthlySettlementReport[] @relation("SettlementCreator")
settlementsFirstSubmitted MonthlySettlementReport[] @relation("SettlementFirstSubmitter")
settlementsFirstApproved  MonthlySettlementReport[] @relation("SettlementFirstApprover")
settlementsApproved       MonthlySettlementReport[] @relation("SettlementApprover")
```

- [ ] **Step 3: migration 파일 생성 및 적용**

```sql
-- apps/api/prisma/migrations/20260819000004_monthly_settlement_report/migration.sql
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'PENDING_FIRST', 'FIRST_APPROVED', 'APPROVED', 'REJECTED');

CREATE TABLE "MonthlySettlementReport" (
  "id"                 SERIAL PRIMARY KEY,
  "seasonId"           INTEGER NOT NULL,
  "year"               INTEGER NOT NULL,
  "month"              INTEGER NOT NULL,
  "status"             "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
  "rejectionReason"    TEXT,
  "totalRevenue"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalExpense"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netIncome"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "snapshotJson"       JSONB NOT NULL DEFAULT '{}',
  "note"               TEXT,
  "createdById"        INTEGER NOT NULL,
  "firstSubmittedById" INTEGER,
  "firstSubmittedAt"   TIMESTAMP(3),
  "firstApproverId"    INTEGER,
  "firstApprovedAt"    TIMESTAMP(3),
  "approverId"         INTEGER,
  "approvedAt"         TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlySettlementReport_seasonId_year_month_key" UNIQUE ("seasonId", "year", "month"),
  CONSTRAINT "MonthlySettlementReport_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id"),
  CONSTRAINT "MonthlySettlementReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id"),
  CONSTRAINT "MonthlySettlementReport_firstSubmittedById_fkey" FOREIGN KEY ("firstSubmittedById") REFERENCES "User"("id"),
  CONSTRAINT "MonthlySettlementReport_firstApproverId_fkey" FOREIGN KEY ("firstApproverId") REFERENCES "User"("id"),
  CONSTRAINT "MonthlySettlementReport_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id")
);
```

```bash
cd apps/api && npx prisma migrate deploy
npx prisma generate
```

---

## Task 2: DTO

**Files:** `apps/api/src/monthly-settlement/dto/monthly-settlement.dto.ts`

```typescript
export interface GenerateSettlementDto {
  seasonId: number;
  year: number;
  month: number;
}

export interface UpdateNoteDto {
  note: string;
}

export interface RejectDto {
  reason: string;
}
```

---

## Task 3: Repository

**Files:** `apps/api/src/monthly-settlement/monthly-settlement.repo.ts`

```typescript
import { PrismaClient } from "../generated/client";

export class MonthlySettlementRepository {
  constructor(private prisma: PrismaClient) {}

  findByYearMonth(seasonId: number, year: number, month: number) {
    return this.prisma.monthlySettlementReport.findUnique({
      where: { seasonId_year_month: { seasonId, year, month } },
      include: {
        createdBy: { select: { id: true, username: true } },
        firstApprover: { select: { id: true, username: true } },
        approver: { select: { id: true, username: true } },
      },
    });
  }

  findById(id: number) {
    return this.prisma.monthlySettlementReport.findUnique({
      where: { id },
      include: {
        season: { select: { id: true, name: true } },
        createdBy: { select: { id: true, username: true } },
        firstSubmittedBy: { select: { id: true, username: true } },
        firstApprover: { select: { id: true, username: true } },
        approver: { select: { id: true, username: true } },
      },
    });
  }

  findAll(seasonId?: number) {
    return this.prisma.monthlySettlementReport.findMany({
      where: seasonId ? { seasonId } : undefined,
      include: {
        season: { select: { id: true, name: true } },
        createdBy: { select: { id: true, username: true } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  upsertDraft(data: {
    seasonId: number; year: number; month: number;
    totalRevenue: number; totalExpense: number; netIncome: number;
    snapshotJson: object; createdById: number;
  }) {
    return this.prisma.monthlySettlementReport.upsert({
      where: { seasonId_year_month: { seasonId: data.seasonId, year: data.year, month: data.month } },
      create: { ...data, status: "DRAFT" },
      update: {
        totalRevenue: data.totalRevenue,
        totalExpense: data.totalExpense,
        netIncome: data.netIncome,
        snapshotJson: data.snapshotJson,
        status: "DRAFT",
        rejectionReason: null,
      },
    });
  }

  updateNote(id: number, note: string) {
    return this.prisma.monthlySettlementReport.update({ where: { id }, data: { note } });
  }

  updateStatus(id: number, data: {
    status: "PENDING_FIRST" | "FIRST_APPROVED" | "APPROVED" | "REJECTED";
    firstSubmittedById?: number; firstSubmittedAt?: Date;
    firstApproverId?: number; firstApprovedAt?: Date;
    approverId?: number; approvedAt?: Date;
    rejectionReason?: string | null;
  }) {
    return this.prisma.monthlySettlementReport.update({ where: { id }, data });
  }

  // 자동 잠금: AcademyFee PAID → LOCKED
  lockAcademyFees(year: number, month: number) {
    return this.prisma.academyFee.updateMany({
      where: { year, month, status: "PAID" },
      data: { status: "LOCKED" },
    });
  }

  // 자동 잠금: LedgerPeriodLock 생성
  createPeriodLock(year: number, month: number, lockedById: number) {
    return this.prisma.ledgerPeriodLock.upsert({
      where: { year_month: { year, month } },
      create: { year, month, lockedById },
      update: {},
    });
  }
}
```

---

## Task 4: Service

**Files:** `apps/api/src/monthly-settlement/monthly-settlement.service.ts`

핵심 메서드:

```typescript
// 월별 수익·지출 집계 후 스냅샷 생성
async generate(dto: GenerateSettlementDto, createdById: number)

// 메모 수정 (DRAFT, PENDING_FIRST만 가능)
async updateNote(id: number, note: string)

// FINANCE_STAFF → PENDING_FIRST
async submitFirst(id: number, userId: number)

// FINANCE_MANAGER → FIRST_APPROVED
async approveFirst(id: number, approverId: number)

// GM → APPROVED + 자동 잠금
async approve(id: number, approverId: number)

// 반려 → DRAFT + rejectionReason
async reject(id: number, reason: string)

// Excel export용 데이터 반환
async getForExport(id: number)
```

**집계 로직 (`generate` 내부):**

```typescript
// 수익: LedgerEntry type=INCOME, 해당 year+month
const startDate = new Date(year, month - 1, 1);
const endDate   = new Date(year, month, 1);     // exclusive

const revenueRows = await prisma.ledgerEntry.groupBy({
  by: ["category"],
  where: { type: "INCOME", createdAt: { gte: startDate, lt: endDate }, isRefund: false },
  _sum: { amountKrw: true },
});

// 지출: OperatingExpense, 해당 year+month
const expenseRows = await prisma.operatingExpense.groupBy({
  by: ["category"],
  where: {
    date: { gte: startDate, lt: endDate },
    deletedAt: null,
  },
  _sum: { amount: true },
});

// BudgetCategoryPlan: 예산 상한 (getActuals 패턴 동일)
const budgetPlan = await financialReportRepo.getBudgetPlan(seasonId);
```

**승인 + 자동 잠금 (`approve` 내부):**

```typescript
await this.repo.updateStatus(id, { status: "APPROVED", approverId, approvedAt: new Date() });
await Promise.all([
  this.repo.lockAcademyFees(report.year, report.month),
  this.repo.createPeriodLock(report.year, report.month, approverId),
]);
```

**반려 (`reject` 내부):**

```typescript
await this.repo.updateStatus(id, {
  status: "REJECTED",
  rejectionReason: reason,
  firstSubmittedById: null, firstSubmittedAt: null,
  firstApproverId: null, firstApprovedAt: null,
  approverId: null, approvedAt: null,
});
// DRAFT로 복귀 (다음 generate 호출 시 덮어씀)
await this.repo.updateStatus(id, { status: "DRAFT" });
```

---

## Task 5: Excel 생성

**Files:** `apps/api/src/monthly-settlement/monthly-settlement.excel.ts`

```bash
cd apps/api && npm install exceljs
```

```typescript
import ExcelJS from "exceljs";

export async function generateSettlementExcel(report: MonthlySettlementReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const snapshot = report.snapshotJson as any;

  // 시트 1: 수익내역
  const sheet1 = wb.addWorksheet("수익내역");
  sheet1.addRow(["항목", "금액(원)"]);
  for (const [cat, amount] of Object.entries(snapshot.revenue ?? {})) {
    sheet1.addRow([cat, amount]);
  }
  sheet1.addRow(["합계", report.totalRevenue]);

  // 시트 2: 운영비 예산 vs 실적
  const sheet2 = wb.addWorksheet("운영비실적");
  sheet2.addRow(["카테고리", "예산(원)", "실적(원)", "잔액(원)"]);
  for (const [cat, val] of Object.entries(snapshot.budgetComparison ?? {})) {
    const v = val as any;
    sheet2.addRow([cat, v.budget, v.actual, v.variance]);
  }

  // 시트 3: P&L 요약
  const sheet3 = wb.addWorksheet("P&L요약");
  sheet3.addRow(["항목", "금액(원)"]);
  sheet3.addRow(["총수익", report.totalRevenue]);
  sheet3.addRow(["총지출", report.totalExpense]);
  sheet3.addRow(["순이익", report.netIncome]);
  if (report.note) {
    sheet3.addRow([]);
    sheet3.addRow(["메모", report.note]);
  }

  return wb.xlsx.writeBuffer() as Promise<Buffer>;
}
```

---

## Task 6: Controller + Routes

**Files:** `monthly-settlement.controller.ts`, `monthly-settlement.routes.ts`

**API 엔드포인트:**

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/monthly-settlement` | canReadFinance | 목록 (seasonId 필터 가능) |
| POST | `/monthly-settlement/generate` | FINANCE_STAFF | 보고서 생성/재생성 |
| GET | `/monthly-settlement/:id` | canReadFinance | 상세 조회 |
| PATCH | `/monthly-settlement/:id/note` | FINANCE_STAFF | 메모 수정 |
| POST | `/monthly-settlement/:id/submit-first` | FINANCE_STAFF | → PENDING_FIRST |
| POST | `/monthly-settlement/:id/approve-first` | FINANCE_MANAGER | → FIRST_APPROVED |
| POST | `/monthly-settlement/:id/approve` | GM, ADMIN | → APPROVED + 자동 잠금 |
| POST | `/monthly-settlement/:id/reject` | FINANCE_MANAGER, GM, ADMIN | → REJECTED(DRAFT) |
| GET | `/monthly-settlement/:id/export` | canReadFinance | Excel 다운로드 |

**Export 핸들러:**
```typescript
export = async (req, res, next) => {
  const buf = await this.service.exportExcel(Number(req.params.id));
  const report = await this.service.getById(Number(req.params.id));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="settlement-${report.year}-${report.month}.xlsx"`);
  res.send(buf);
};
```

---

## Task 7: Cron 자동 초안 생성

**Files:** `apps/api/src/jobs/monthlyBudgetReport.ts` (기존 파일에 추가)

기존 `runMonthlyBudgetReport()` 아래에 추가:

```typescript
async function generateMonthlySettlementDraft() {
  const prisma = getPrisma();
  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  if (!activeSeason) return;

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) return;

  const service = new MonthlySettlementService(...);
  await service.generate({ seasonId: activeSeason.id, year: prevYear, month: prevMonth }, admin.id);
  console.log(`✅ 월말 결산 초안 자동 생성: ${prevYear}년 ${prevMonth}월`);
}
```

cron 스케줄에 추가 (`0 0 1 * *` 기존 job과 함께):
```typescript
cron.schedule("0 0 1 * *", async () => {
  await runMonthlyBudgetReport();
  await generateMonthlySettlementDraft();
});
```

---

## Task 8: 프론트엔드 타입 + 서비스

**Files:** `football/src/types/monthly-settlement.ts`, `football/src/services/monthlySettlement.service.ts`

```typescript
// types/monthly-settlement.ts
export type SettlementStatus = 'DRAFT' | 'PENDING_FIRST' | 'FIRST_APPROVED' | 'APPROVED' | 'REJECTED'

export interface MonthlySettlementSummary {
  id: number; seasonId: number; year: number; month: number
  status: SettlementStatus; totalRevenue: number; totalExpense: number; netIncome: number
  createdBy: { id: number; username: string }
  season: { id: number; name: string }
  createdAt: string
}

export interface MonthlySettlementDetail extends MonthlySettlementSummary {
  snapshotJson: {
    revenue: Record<string, number>
    expenses: Record<string, number>
    budgetComparison: Record<string, { budget: number; actual: number; variance: number }>
    pnl: { totalRevenue: number; totalExpense: number; netIncome: number }
  }
  note: string | null
  rejectionReason: string | null
  firstApprover: { id: number; username: string } | null
  approver: { id: number; username: string } | null
}
```

```typescript
// services/monthlySettlement.service.ts
export const settlementApi = {
  list: (seasonId?: number) =>
    api.get<MonthlySettlementSummary[]>(`/monthly-settlement${seasonId ? `?seasonId=${seasonId}` : ''}`),
  generate: (data: { seasonId: number; year: number; month: number }) =>
    api.post<MonthlySettlementDetail>('/monthly-settlement/generate', data),
  getById: (id: number) =>
    api.get<MonthlySettlementDetail>(`/monthly-settlement/${id}`),
  updateNote: (id: number, note: string) =>
    api.patch<MonthlySettlementDetail>(`/monthly-settlement/${id}/note`, { note }),
  submitFirst: (id: number) =>
    api.post<MonthlySettlementDetail>(`/monthly-settlement/${id}/submit-first`, {}),
  approveFirst: (id: number) =>
    api.post<MonthlySettlementDetail>(`/monthly-settlement/${id}/approve-first`, {}),
  approve: (id: number) =>
    api.post<MonthlySettlementDetail>(`/monthly-settlement/${id}/approve`, {}),
  reject: (id: number, reason: string) =>
    api.post<MonthlySettlementDetail>(`/monthly-settlement/${id}/reject`, { reason }),
  exportUrl: (id: number) => `/api/monthly-settlement/${id}/export`,
}
```

---

## Task 9: ReportsPage 탭 분리

**Files:** `football/src/pages/reports/ReportsPage.tsx`

기존 보고서 목록을 `[일반 보고서]` 탭으로, 신규 `[월말 결산]` 탭을 추가:

```tsx
const [tab, setTab] = useState<'general' | 'monthly'>('general')

// 탭 헤더
<div className="flex gap-2 border-b mb-4">
  <button onClick={() => setTab('general')} className={tab === 'general' ? 'border-b-2 border-primary font-medium' : ''}>
    일반 보고서
  </button>
  <button onClick={() => setTab('monthly')} className={tab === 'monthly' ? 'border-b-2 border-primary font-medium' : ''}>
    월말 결산
  </button>
</div>

{tab === 'general' && <GeneralReportTab />}
{tab === 'monthly' && <MonthlySettlementTab />}
```

---

## Task 10: MonthlySettlementTab + DetailPage

**Files:** `MonthlySettlementTab.tsx`, `MonthlySettlementDetailPage.tsx`

**`MonthlySettlementTab.tsx`:**
- `settlementApi.list()` 로드
- 각 행: `{year}년 {month}월` + 상태 뱃지 + `[보고서 생성]` 버튼 (FINANCE_STAFF, DRAFT 없을 때)
- 클릭 → `/reports/monthly/:year/:month` 이동
- 상태 뱃지 색상: `DRAFT=outline, PENDING_FIRST=secondary, FIRST_APPROVED=secondary, APPROVED=default, REJECTED=destructive`

**`MonthlySettlementDetailPage.tsx` 섹션 구성:**
1. **수익 현황** — `snapshotJson.revenue` 테이블 (카테고리 | 금액)
2. **운영비 예산 vs 실적** — `snapshotJson.budgetComparison` 테이블 (카테고리 | 예산 | 실적 | 잔액 | 초과여부)
3. **P&L 요약** — 총수익 / 총지출 / 순이익 카드 3개
4. **메모** — `<Textarea>` (DRAFT, PENDING_FIRST 상태에서만 편집 가능)
5. **결재 버튼 영역:**
   ```
   FINANCE_STAFF + DRAFT       → [결재 상신]
   FINANCE_MANAGER + PENDING_FIRST → [1차 승인] [반려]
   GM/ADMIN + FIRST_APPROVED   → [최종 승인] [반려]
   APPROVED                    → [Excel 다운로드] (anchor download)
   REJECTED                    → 반려 사유 표시 + [재생성] 버튼
   ```

**Excel 다운로드 버튼:**
```tsx
<a href={settlementApi.exportUrl(report.id)} download>
  <Button variant="outline">Excel 다운로드</Button>
</a>
```

---

## 상태 전이도

```
           [FINANCE_STAFF]          [FINANCE_MANAGER]       [GM/ADMIN]
DRAFT ──── submit-first ──→ PENDING_FIRST ── approve-first ──→ FIRST_APPROVED ── approve ──→ APPROVED
  ↑                               │                                  │                           │
  └──────── reject ───────────────┘                                  │                           │
  └──────── reject ──────────────────────────────────────────────────┘                           │
                                                                                    자동 잠금 ────┘
                                                               LedgerPeriodLock(year, month) 생성
                                                               AcademyFee(PAID→LOCKED, year, month)
```

---

## 구현 순서

1. Task 1: Prisma 스키마 + migration
2. Task 2-4: DTO + Repo + Service (+ 테스트)
3. Task 5: Excel 생성 (`exceljs` 설치)
4. Task 6: Controller + Routes + apiRouter 등록
5. Task 7: Cron 자동 초안 추가
6. Task 8: FE 타입 + 서비스
7. Task 9: ReportsPage 탭 분리
8. Task 10: MonthlySettlementTab + DetailPage + router 등록
