# 식대 통합 + 스폰서 은행 계좌 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) 식대(`MealExpense`) 페이지를 운영비 지출(`OperatingExpense`)로 완전 흡수하고, (2) 스폰서 등록/상세 폼에 국내·영국 은행 계좌 입력 필드를 추가한다.

**Architecture:**
- 주제 1: `MealExpense` 테이블을 `OperatingExpense(category=MEAL)`로 마이그레이션 후 drop. `FinancialReport` repo의 MEAL 집계 로직을 operatingExpense 쪽으로 이관. FE에서 nav 항목·라우트·페이지·서비스 파일 삭제.
- 주제 2: `Sponsorship` 테이블에 nullable 컬럼 7개 추가(국내 3 + 영국 4). FE 등록 폼과 상세 페이지 양쪽에 bank 섹션 추가.

**Tech Stack:** PostgreSQL · Prisma · Express/Hono · React · react-i18next · Tailwind/shadcn

---

## 파일 변경 맵

### 주제 1 — 식대 → 운영비 통합

| 작업 | 파일 |
|---|---|
| Modify | `apps/api/prisma/schema.prisma` |
| Create | `apps/api/prisma/migrations/20260810000002_migrate_meal_to_operating/migration.sql` |
| Modify | `apps/api/src/apiRouter.ts` |
| Modify | `apps/api/src/financial-report/financial-report.repo.ts` |
| Modify | `apps/api/src/financial-report/financial-report.service.ts` |
| Delete | `apps/api/src/meal-expense/` (4 files) |
| Modify | `football/src/layouts/AppShell.tsx` |
| Modify | `football/src/App.tsx` |
| Modify | `football/src/pages/admin/OperatingExpensePage.tsx` |
| Delete | `football/src/pages/admin/MealExpensePage.tsx` |
| Delete | `football/src/services/meal-expense.service.ts` |
| Modify | `football/src/locales/ko/admin.json` |
| Modify | `football/src/locales/en/admin.json` |

### 주제 2 — 스폰서 은행 계좌

| 작업 | 파일 |
|---|---|
| Modify | `apps/api/prisma/schema.prisma` |
| Create | `apps/api/prisma/migrations/20260810000003_add_sponsor_bank/migration.sql` |
| Modify | `apps/api/src/sponsorship/dto/sponsorship.dto.ts` |
| Modify | `apps/api/src/sponsorship/sponsorship.repo.ts` |
| Modify | `football/src/types/sponsorship.ts` |
| Modify | `football/src/pages/sponsorship/SponsorshipPage.tsx` |
| Modify | `football/src/pages/sponsorship/SponsorshipDetailPage.tsx` |
| Modify | `football/src/locales/ko/sponsorship.json` |
| Modify | `football/src/locales/en/sponsorship.json` |

---

## Task 1: DB 마이그레이션 — MealExpense → OperatingExpense 이전 후 drop

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260810000002_migrate_meal_to_operating/migration.sql`

### 배경

`MealExpense`에는 `seasonId`가 없고 `date`만 있다. 마이그레이션 SQL은 `date`가 포함된 `Season`을 찾아 `seasonId`를 결정한다. 어떤 시즌에도 속하지 않는 식대는 `note`에 원본 날짜를 기록한 채 현재 활성 시즌(있을 경우)에 귀속시키고, 없으면 skip(손실 방지용 로그로 남김)한다.

- [ ] **Step 1: 마이그레이션 SQL 작성**

`apps/api/prisma/migrations/20260810000002_migrate_meal_to_operating/` 디렉터리를 만들고 `migration.sql`을 작성한다.

```sql
-- Step 1: MealExpense 데이터를 OperatingExpense(MEAL)로 이전
INSERT INTO "OperatingExpense" ("seasonId", "category", "amount", "date", "note", "createdById", "createdAt", "updatedAt")
SELECT
  s.id AS "seasonId",
  'MEAL'::"OperatingCategory",
  m."amount",
  m."date",
  m."note",
  m."createdById",
  m."createdAt",
  m."updatedAt"
FROM "MealExpense" m
JOIN "Season" s ON m."date" >= s."startDate" AND m."date" <= s."endDate";

-- Step 2: MealExpense 테이블 drop (외래키 먼저 제거)
ALTER TABLE "User" DROP COLUMN IF EXISTS "mealExpensesCreated";
DROP TABLE IF EXISTS "MealExpense";

-- Step 3: MealExpenseType enum drop
DROP TYPE IF EXISTS "MealExpenseType";
```

- [ ] **Step 2: schema.prisma 에서 MealExpense 관련 코드 제거**

`apps/api/prisma/schema.prisma`에서 다음을 삭제한다:
- `model MealExpense { ... }` 블록 전체
- `enum MealExpenseType { TRAINING MATCH }` 블록
- `User` 모델 내 `mealExpensesCreated MealExpense[] @relation("MealExpenseCreator")` 라인
- `Season` 모델 내 `mealExpenses MealExpense[]` 라인 (있다면)
- `Match` 모델 내 `mealExpenses MealExpense[]` 라인
- `TrainingSession` 모델 내 `mealExpenses MealExpense[]` 라인

- [ ] **Step 3: prisma migrate deploy로 마이그레이션 적용**

```bash
cd apps/api
npx prisma migrate deploy
```

Expected output: `1 migration applied.`

- [ ] **Step 4: prisma generate**

```bash
npx prisma generate
```

Expected: no errors. `@prisma/client`에서 `MealExpense` 타입이 사라진 것을 확인한다.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260810000002_migrate_meal_to_operating/
git commit -m "feat: migrate MealExpense to OperatingExpense(MEAL), drop MealExpense table"
```

---

## Task 2: BE — meal-expense 모듈 제거 + FinancialReport 수정

**Files:**
- Delete: `apps/api/src/meal-expense/` (전체)
- Modify: `apps/api/src/apiRouter.ts`
- Modify: `apps/api/src/financial-report/financial-report.repo.ts`
- Modify: `apps/api/src/financial-report/financial-report.service.ts`

- [ ] **Step 1: meal-expense 디렉터리 삭제**

```bash
rm -rf apps/api/src/meal-expense
```

- [ ] **Step 2: apiRouter.ts 에서 meal-expense 라우터 제거**

`apps/api/src/apiRouter.ts` 에서 다음 두 줄을 삭제한다:
```ts
import mealExpenseRouter from "./meal-expense/meal-expense.routes";
// ...
apiRouter.use("/meal-expenses", mealExpenseRouter);
```

- [ ] **Step 3: financial-report.repo.ts — MEAL 집계를 operatingExpense로 이관**

현재 코드 (`apps/api/src/financial-report/financial-report.repo.ts`):
```ts
const [medical, meal, operating] = await Promise.all([
  this.prisma.medicalExpense.aggregate({ ... }),
  this.prisma.mealExpense.aggregate({
    where: { date: { gte: season.startDate, lte: season.endDate } },
    _sum: { amount: true },
  }),
  this.prisma.operatingExpense.groupBy({
    by: ["category"],
    where: { seasonId },
    _sum: { amount: true },
  }),
]);

const result: Record<string, number> = {
  MEDICAL: medical._sum?.totalAmount ?? 0,
  MEAL: meal._sum?.amount ?? 0,
};
for (const row of operating) {
  result[row.category] = row._sum?.amount ?? 0;
}
```

`mealExpense.aggregate` 호출을 제거하고 MEAL을 operatingExpense groupBy 결과에서 읽도록 변경:
```ts
const [medical, operating] = await Promise.all([
  this.prisma.medicalExpense.aggregate({
    where: { status: "APPROVED", receiptDate: { gte: season.startDate, lte: season.endDate } },
    _sum: { totalAmount: true },
  }),
  this.prisma.operatingExpense.groupBy({
    by: ["category"],
    where: { seasonId },
    _sum: { amount: true },
  }),
]);

const result: Record<string, number> = {
  MEDICAL: medical._sum?.totalAmount ?? 0,
};
for (const row of operating) {
  result[row.category] = row._sum?.amount ?? 0;
}
```

- [ ] **Step 4: financial-report.service.ts — mealExpense 집계 참조 제거**

`financial-report.service.ts`에서 `prisma.mealExpense.aggregate` 호출을 찾아 동일하게 제거한다.

현재:
```ts
prisma.mealExpense.aggregate({
  where: { date: { gte: startDate, lte: endDate } },
  _sum: { amount: true },
}),
```

삭제 후 `meal` 변수 참조도 함께 정리한다(MEAL은 이제 operatingExpense groupBy에서 자동으로 포함된다).

- [ ] **Step 5: 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/apiRouter.ts apps/api/src/financial-report/
git commit -m "feat: remove meal-expense module, fix financial-report to read MEAL from operatingExpense"
```

---

## Task 3: FE — 식대 페이지·서비스·라우트·nav 제거

**Files:**
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/App.tsx`
- Delete: `football/src/pages/admin/MealExpensePage.tsx`
- Delete: `football/src/services/meal-expense.service.ts`

- [ ] **Step 1: MealExpensePage.tsx 삭제**

```bash
rm football/src/pages/admin/MealExpensePage.tsx
rm football/src/services/meal-expense.service.ts
```

- [ ] **Step 2: App.tsx 에서 import와 라우트 제거**

`football/src/App.tsx`에서 다음을 삭제한다:
```ts
// 삭제할 import
import { MealExpensePage } from '@/pages/admin/MealExpensePage'

// 삭제할 라우트
<Route path="/admin/meal-expenses" element={<MealExpensePage />} />
```

- [ ] **Step 3: AppShell.tsx 에서 nav 항목 제거**

`football/src/layouts/AppShell.tsx`에서 다음 블록을 삭제한다:
```ts
{
  to: '/admin/meal-expenses',
  label: 'nav.item.mealExpenses',
  icon: Receipt,
  section: 'nav.section.management',
  subSection: 'nav.subsection.finance',
  roles: ['ADMIN', 'FRONT_OFFICE'],
  frontOfficeRoles: ['FINANCE_MANAGER', 'FINANCE_STAFF'],
},
```

`Receipt` 아이콘 import도 다른 곳에서 쓰이지 않는다면 함께 제거한다.

- [ ] **Step 4: 빌드 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add football/src/layouts/AppShell.tsx football/src/App.tsx
git commit -m "feat: remove meal-expense nav, route, page, and service from FE"
```

---

## Task 4: FE — OperatingExpensePage MEAL 카테고리 포함

**Files:**
- Modify: `football/src/pages/admin/OperatingExpensePage.tsx`
- Modify: `football/src/locales/ko/admin.json`
- Modify: `football/src/locales/en/admin.json`

- [ ] **Step 1: DISCRETIONARY_CATEGORIES 상수 교체**

`football/src/pages/admin/OperatingExpensePage.tsx`:

기존:
```ts
const DISCRETIONARY_CATEGORIES: OperatingCategory[] = ['TRAVEL', 'EQUIPMENT', 'SCOUTING', 'YOUTH']
```

변경 후:
```ts
import { ALL_OPERATING_CATEGORIES } from '@/types/budget'

const FORM_CATEGORIES = ALL_OPERATING_CATEGORIES.filter((c) => c !== 'MEDICAL')
```

파일 내 `DISCRETIONARY_CATEGORIES` 참조를 모두 `FORM_CATEGORIES`로 교체한다.

- [ ] **Step 2: i18n — mealExpense 키 제거 (ko)**

`football/src/locales/ko/admin.json`에서 `"mealExpense": { ... }` 블록 전체를 삭제한다.

- [ ] **Step 3: i18n — mealExpense 키 제거 (en)**

`football/src/locales/en/admin.json`에서 `"mealExpense": { ... }` 블록 전체를 삭제한다.

- [ ] **Step 4: 브라우저에서 운영비 지출 페이지 확인**

개발 서버를 실행하고 `/admin/operating-expenses`를 열어 다음을 확인한다:
- 카테고리 드롭다운에 "식대"가 표시됨
- nav 사이드바에 "식대" 항목이 사라짐
- "식대" 항목 클릭 시 404가 아닌 페이지가 사라진 것을 확인

- [ ] **Step 5: Commit**

```bash
git add football/src/pages/admin/OperatingExpensePage.tsx football/src/locales/
git commit -m "feat: include MEAL in OperatingExpensePage categories"
```

---

## Task 5: DB 마이그레이션 — Sponsorship 은행 계좌 컬럼 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260810000003_add_sponsor_bank/migration.sql`

- [ ] **Step 1: schema.prisma Sponsorship 모델에 컬럼 추가**

`apps/api/prisma/schema.prisma`의 `model Sponsorship` 블록에 다음 nullable 필드를 추가한다 (`deletedAt DateTime?` 바로 위):

```prisma
  // 국내 계좌
  domesticBankName      String?
  domesticAccountNumber String?
  domesticAccountHolder String?
  // 영국 계좌
  ukBankName            String?
  ukSortCode            String?
  ukAccountNumber       String?
  ukSwiftBic            String?
```

- [ ] **Step 2: 마이그레이션 SQL 작성**

`apps/api/prisma/migrations/20260810000003_add_sponsor_bank/migration.sql`:

```sql
ALTER TABLE "Sponsorship"
  ADD COLUMN "domesticBankName"      TEXT,
  ADD COLUMN "domesticAccountNumber" TEXT,
  ADD COLUMN "domesticAccountHolder" TEXT,
  ADD COLUMN "ukBankName"            TEXT,
  ADD COLUMN "ukSortCode"            TEXT,
  ADD COLUMN "ukAccountNumber"       TEXT,
  ADD COLUMN "ukSwiftBic"            TEXT;
```

- [ ] **Step 3: 마이그레이션 적용 + generate**

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

Expected: `1 migration applied.`

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add domestic and UK bank account columns to Sponsorship"
```

---

## Task 6: BE — 스폰서 DTO / Repo 업데이트

**Files:**
- Modify: `apps/api/src/sponsorship/dto/sponsorship.dto.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.repo.ts`

- [ ] **Step 1: DTO에 bank 필드 추가**

`apps/api/src/sponsorship/dto/sponsorship.dto.ts`:

```ts
export interface CreateSponsorshipDto {
  sponsorName: string;
  type: SponsorType;
  totalFee: number;
  contractStart: string;
  contractEnd: string;
  paymentSchedule: PaymentSchedule;
  attachedContractId?: number;
  // 국내 계좌
  domesticBankName?: string;
  domesticAccountNumber?: string;
  domesticAccountHolder?: string;
  // 영국 계좌
  ukBankName?: string;
  ukSortCode?: string;
  ukAccountNumber?: string;
  ukSwiftBic?: string;
}

export interface UpdateSponsorshipDto {
  sponsorName?: string;
  type?: SponsorType;
  totalFee?: number;
  contractStart?: string;
  contractEnd?: string;
  paymentSchedule?: PaymentSchedule;
  attachedContractId?: number;
  // 국내 계좌
  domesticBankName?: string;
  domesticAccountNumber?: string;
  domesticAccountHolder?: string;
  // 영국 계좌
  ukBankName?: string;
  ukSortCode?: string;
  ukAccountNumber?: string;
  ukSwiftBic?: string;
}

export interface SponsorshipListQuery {
  type?: SponsorType;
  page?: string;
}
```

- [ ] **Step 2: Repo create/update에 bank 필드 포함 확인**

`apps/api/src/sponsorship/sponsorship.repo.ts`의 `create`와 `update` 메서드가 DTO spread를 사용하고 있다면 자동으로 반영된다. Prisma `data: dto` 형태로 넘기는지 확인하고, 명시적 필드 목록이 있다면 7개 필드를 추가한다.

예: `data` 객체가 `{ sponsorName, type, totalFee, ... }` 형태로 명시적이라면:
```ts
async create(dto: CreateSponsorshipDto & { createdById: number }) {
  return this.prisma.sponsorship.create({
    data: {
      sponsorName: dto.sponsorName,
      type: dto.type,
      totalFee: dto.totalFee,
      contractStart: new Date(dto.contractStart),
      contractEnd: new Date(dto.contractEnd),
      paymentSchedule: dto.paymentSchedule,
      createdById: dto.createdById,
      domesticBankName: dto.domesticBankName,
      domesticAccountNumber: dto.domesticAccountNumber,
      domesticAccountHolder: dto.domesticAccountHolder,
      ukBankName: dto.ukBankName,
      ukSortCode: dto.ukSortCode,
      ukAccountNumber: dto.ukAccountNumber,
      ukSwiftBic: dto.ukSwiftBic,
    },
    include: { createdBy: { select: { id: true, username: true } }, payments: true },
  })
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/sponsorship/
git commit -m "feat: add bank account fields to sponsorship DTO and repo"
```

---

## Task 7: FE — 스폰서십 타입 + 서비스 업데이트

**Files:**
- Modify: `football/src/types/sponsorship.ts`

- [ ] **Step 1: Sponsorship 인터페이스에 bank 필드 추가**

`football/src/types/sponsorship.ts`의 `Sponsorship` 인터페이스:

```ts
export interface Sponsorship {
  id: number
  sponsorName: string
  type: SponsorType
  totalFee: number
  contractStart: string
  contractEnd: string
  paymentSchedule: PaymentSchedule
  attachedContractId: number | null
  createdById: number
  createdAt: string
  updatedAt: string
  createdBy: { id: number; username: string }
  payments?: SponsorshipPayment[]
  // 국내 계좌
  domesticBankName: string | null
  domesticAccountNumber: string | null
  domesticAccountHolder: string | null
  // 영국 계좌
  ukBankName: string | null
  ukSortCode: string | null
  ukAccountNumber: string | null
  ukSwiftBic: string | null
}
```

`CreateSponsorshipDto`와 `UpdateSponsorshipDto`에도 optional 필드 추가:

```ts
export interface CreateSponsorshipDto {
  sponsorName: string
  type: SponsorType
  totalFee: number
  contractStart: string
  contractEnd: string
  paymentSchedule: PaymentSchedule
  domesticBankName?: string
  domesticAccountNumber?: string
  domesticAccountHolder?: string
  ukBankName?: string
  ukSortCode?: string
  ukAccountNumber?: string
  ukSwiftBic?: string
}

export interface UpdateSponsorshipDto {
  sponsorName?: string
  type?: SponsorType
  totalFee?: number
  contractStart?: string
  contractEnd?: string
  paymentSchedule?: PaymentSchedule
  domesticBankName?: string
  domesticAccountNumber?: string
  domesticAccountHolder?: string
  ukBankName?: string
  ukSortCode?: string
  ukAccountNumber?: string
  ukSwiftBic?: string
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add football/src/types/sponsorship.ts
git commit -m "feat: add bank account fields to Sponsorship types"
```

---

## Task 8: FE — 스폰서 등록 폼(CreateSponsorshipDialog)에 은행 섹션 추가

**Files:**
- Modify: `football/src/pages/sponsorship/SponsorshipPage.tsx`
- Modify: `football/src/locales/ko/sponsorship.json`
- Modify: `football/src/locales/en/sponsorship.json`

- [ ] **Step 1: i18n 키 추가 (ko)**

`football/src/locales/ko/sponsorship.json`의 `"form"` 객체에 추가:

```json
"form": {
  "title": "스폰서십 등록",
  "sponsorName": "스폰서명 *",
  "sponsorNamePlaceholder": "스폰서 이름을 입력하세요",
  "type": "종류 *",
  "totalFee": "계약금액 (원) *",
  "contractStart": "계약 시작일 *",
  "contractEnd": "계약 종료일 *",
  "paymentSchedule": "납부 방식 *",
  "bankSection.domestic": "국내 계좌",
  "bankSection.uk": "영국 계좌",
  "bank.bankName": "은행명",
  "bank.accountNumber": "계좌번호",
  "bank.accountHolder": "예금주",
  "bank.sortCode": "Sort Code",
  "bank.swiftBic": "SWIFT/BIC"
}
```

- [ ] **Step 2: i18n 키 추가 (en)**

`football/src/locales/en/sponsorship.json`의 `"form"` 객체에 추가:

```json
"bankSection.domestic": "Domestic Account",
"bankSection.uk": "UK Account",
"bank.bankName": "Bank Name",
"bank.accountNumber": "Account Number",
"bank.accountHolder": "Account Holder",
"bank.sortCode": "Sort Code",
"bank.swiftBic": "SWIFT / BIC"
```

- [ ] **Step 3: CreateSponsorshipDialog state 확장**

`football/src/pages/sponsorship/SponsorshipPage.tsx`의 `CreateSponsorshipDialog` 컴포넌트 state:

```ts
const [domesticBankName, setDomesticBankName] = useState('')
const [domesticAccountNumber, setDomesticAccountNumber] = useState('')
const [domesticAccountHolder, setDomesticAccountHolder] = useState('')
const [ukBankName, setUkBankName] = useState('')
const [ukSortCode, setUkSortCode] = useState('')
const [ukAccountNumber, setUkAccountNumber] = useState('')
const [ukSwiftBic, setUkSwiftBic] = useState('')
```

`reset()` 함수에 초기화 추가:
```ts
const reset = () => {
  setSponsorName('')
  setType('TITLE')
  setTotalFee('')
  setContractStart('')
  setContractEnd('')
  setPaymentSchedule('ANNUAL')
  setDomesticBankName('')
  setDomesticAccountNumber('')
  setDomesticAccountHolder('')
  setUkBankName('')
  setUkSortCode('')
  setUkAccountNumber('')
  setUkSwiftBic('')
}
```

- [ ] **Step 4: handleSave DTO에 bank 필드 포함**

```ts
const dto: CreateSponsorshipDto = {
  sponsorName: sponsorName.trim(),
  type,
  totalFee: Number(totalFee),
  contractStart,
  contractEnd,
  paymentSchedule,
  ...(domesticBankName && { domesticBankName }),
  ...(domesticAccountNumber && { domesticAccountNumber }),
  ...(domesticAccountHolder && { domesticAccountHolder }),
  ...(ukBankName && { ukBankName }),
  ...(ukSortCode && { ukSortCode }),
  ...(ukAccountNumber && { ukAccountNumber }),
  ...(ukSwiftBic && { ukSwiftBic }),
}
```

- [ ] **Step 5: 폼 UI에 국내/영국 은행 섹션 추가**

기존 `paymentSchedule` 필드 아래에 추가:

```tsx
{/* 국내 계좌 */}
<div className="pt-1">
  <p className="text-xs font-medium text-muted-foreground mb-2">{t('form.bankSection.domestic')}</p>
  <div className="space-y-2">
    <Input
      placeholder={t('form.bank.bankName')}
      value={domesticBankName}
      onChange={(e) => setDomesticBankName(e.target.value)}
    />
    <Input
      placeholder={t('form.bank.accountNumber')}
      value={domesticAccountNumber}
      onChange={(e) => setDomesticAccountNumber(e.target.value)}
    />
    <Input
      placeholder={t('form.bank.accountHolder')}
      value={domesticAccountHolder}
      onChange={(e) => setDomesticAccountHolder(e.target.value)}
    />
  </div>
</div>

{/* 영국 계좌 */}
<div className="pt-1">
  <p className="text-xs font-medium text-muted-foreground mb-2">{t('form.bankSection.uk')}</p>
  <div className="space-y-2">
    <Input
      placeholder={t('form.bank.bankName')}
      value={ukBankName}
      onChange={(e) => setUkBankName(e.target.value)}
    />
    <div className="grid grid-cols-2 gap-2">
      <Input
        placeholder={t('form.bank.sortCode')}
        value={ukSortCode}
        onChange={(e) => setUkSortCode(e.target.value)}
      />
      <Input
        placeholder={t('form.bank.accountNumber')}
        value={ukAccountNumber}
        onChange={(e) => setUkAccountNumber(e.target.value)}
      />
    </div>
    <Input
      placeholder={t('form.bank.swiftBic')}
      value={ukSwiftBic}
      onChange={(e) => setUkSwiftBic(e.target.value)}
    />
  </div>
</div>
```

`DialogContent`에 `className="max-w-md"` → `className="max-w-lg"` 로 넓힌다 (콘텐츠 증가).

- [ ] **Step 6: 브라우저 확인**

스폰서십 등록 다이얼로그를 열어:
- 국내/영국 은행 섹션이 표시되는지 확인
- 모든 bank 필드 비워두고 등록 → 성공
- 국내 계좌만 입력 후 등록 → 성공

- [ ] **Step 7: Commit**

```bash
git add football/src/pages/sponsorship/SponsorshipPage.tsx football/src/locales/
git commit -m "feat: add domestic and UK bank account fields to sponsorship create form"
```

---

## Task 9: FE — 스폰서십 상세 페이지 계좌 정보 섹션 추가

**Files:**
- Modify: `football/src/pages/sponsorship/SponsorshipDetailPage.tsx`
- Modify: `football/src/locales/ko/sponsorship.json`
- Modify: `football/src/locales/en/sponsorship.json`

- [ ] **Step 1: i18n 키 추가 — 상세 페이지용 (ko)**

`football/src/locales/ko/sponsorship.json` 최상위에 추가:

```json
"bank": {
  "sectionTitle": "계좌 정보",
  "domestic": "국내",
  "uk": "영국",
  "bankName": "은행명",
  "accountNumber": "계좌번호",
  "accountHolder": "예금주",
  "sortCode": "Sort Code",
  "swiftBic": "SWIFT/BIC",
  "editButton": "수정",
  "editTitle": "계좌 정보 수정",
  "noInfo": "등록된 계좌 정보가 없습니다.",
  "saved": "계좌 정보가 저장되었습니다.",
  "saveFailed": "저장에 실패했습니다."
}
```

- [ ] **Step 2: i18n 키 추가 — 상세 페이지용 (en)**

`football/src/locales/en/sponsorship.json` 최상위에 추가:

```json
"bank": {
  "sectionTitle": "Bank Accounts",
  "domestic": "Domestic",
  "uk": "UK",
  "bankName": "Bank Name",
  "accountNumber": "Account Number",
  "accountHolder": "Account Holder",
  "sortCode": "Sort Code",
  "swiftBic": "SWIFT / BIC",
  "editButton": "Edit",
  "editTitle": "Edit Bank Accounts",
  "noInfo": "No bank accounts registered.",
  "saved": "Bank accounts saved.",
  "saveFailed": "Failed to save."
}
```

- [ ] **Step 3: BankEditDialog 컴포넌트 추가**

`SponsorshipDetailPage.tsx` 파일 상단 (`SponsorshipDetailPage` 함수 위)에 추가:

```tsx
interface BankEditDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  sponsorship: Sponsorship
  onSaved: (updated: Sponsorship) => void
}

function BankEditDialog({ open, onOpenChange, sponsorship, onSaved }: BankEditDialogProps) {
  const { t } = useTranslation('sponsorship')
  const [form, setForm] = useState({
    domesticBankName: sponsorship.domesticBankName ?? '',
    domesticAccountNumber: sponsorship.domesticAccountNumber ?? '',
    domesticAccountHolder: sponsorship.domesticAccountHolder ?? '',
    ukBankName: sponsorship.ukBankName ?? '',
    ukSortCode: sponsorship.ukSortCode ?? '',
    ukAccountNumber: sponsorship.ukAccountNumber ?? '',
    ukSwiftBic: sponsorship.ukSwiftBic ?? '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        domesticBankName: sponsorship.domesticBankName ?? '',
        domesticAccountNumber: sponsorship.domesticAccountNumber ?? '',
        domesticAccountHolder: sponsorship.domesticAccountHolder ?? '',
        ukBankName: sponsorship.ukBankName ?? '',
        ukSortCode: sponsorship.ukSortCode ?? '',
        ukAccountNumber: sponsorship.ukAccountNumber ?? '',
        ukSwiftBic: sponsorship.ukSwiftBic ?? '',
      })
    }
  }, [open, sponsorship])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await sponsorshipApi.update(sponsorship.id, {
        domesticBankName: form.domesticBankName || undefined,
        domesticAccountNumber: form.domesticAccountNumber || undefined,
        domesticAccountHolder: form.domesticAccountHolder || undefined,
        ukBankName: form.ukBankName || undefined,
        ukSortCode: form.ukSortCode || undefined,
        ukAccountNumber: form.ukAccountNumber || undefined,
        ukSwiftBic: form.ukSwiftBic || undefined,
      })
      toast.success(t('bank.saved'))
      onSaved(updated)
      onOpenChange(false)
    } catch {
      toast.error(t('bank.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('bank.editTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <p className="text-xs font-medium mb-2">{t('bank.domestic')}</p>
            <div className="space-y-2">
              {field(t('bank.bankName'), 'domesticBankName')}
              {field(t('bank.accountNumber'), 'domesticAccountNumber')}
              {field(t('bank.accountHolder'), 'domesticAccountHolder')}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">{t('bank.uk')}</p>
            <div className="space-y-2">
              {field(t('bank.bankName'), 'ukBankName')}
              <div className="grid grid-cols-2 gap-2">
                {field(t('bank.sortCode'), 'ukSortCode')}
                {field(t('bank.accountNumber'), 'ukAccountNumber')}
              </div>
              {field(t('bank.swiftBic'), 'ukSwiftBic')}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중...' : t('bank.editButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

`DialogFooter`를 쓰므로 import에 `DialogFooter` 추가 확인.

- [ ] **Step 4: 상세 페이지에 계좌 정보 섹션 추가**

`SponsorshipDetailPage` 컴포넌트에 state 추가:
```ts
const [bankEditOpen, setBankEditOpen] = useState(false)
```

납부 스케줄 섹션(`<div className="flex-1 overflow-auto">`) 바로 위, 계약 정보 grid 아래에 삽입:

```tsx
{/* 계좌 정보 섹션 */}
<div className="px-6 py-4 border-b">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-medium">{t('bank.sectionTitle')}</h2>
    {canWrite && (
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setBankEditOpen(true)}>
        {t('bank.editButton')}
      </Button>
    )}
  </div>
  {!sponsorship.domesticBankName && !sponsorship.ukBankName ? (
    <p className="text-xs text-muted-foreground">{t('bank.noInfo')}</p>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {sponsorship.domesticBankName && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">{t('bank.domestic')}</p>
          <p>{sponsorship.domesticBankName}</p>
          {sponsorship.domesticAccountNumber && <p className="tabular-nums text-muted-foreground">{sponsorship.domesticAccountNumber}</p>}
          {sponsorship.domesticAccountHolder && <p className="text-muted-foreground">{sponsorship.domesticAccountHolder}</p>}
        </div>
      )}
      {sponsorship.ukBankName && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">{t('bank.uk')}</p>
          <p>{sponsorship.ukBankName}</p>
          {sponsorship.ukSortCode && <p className="tabular-nums text-muted-foreground">{t('bank.sortCode')}: {sponsorship.ukSortCode}</p>}
          {sponsorship.ukAccountNumber && <p className="tabular-nums text-muted-foreground">{sponsorship.ukAccountNumber}</p>}
          {sponsorship.ukSwiftBic && <p className="text-muted-foreground">SWIFT: {sponsorship.ukSwiftBic}</p>}
        </div>
      )}
    </div>
  )}
</div>
```

컴포넌트 최하단(return 끝)에 다이얼로그 렌더링 추가:

```tsx
{sponsorship && (
  <BankEditDialog
    open={bankEditOpen}
    onOpenChange={setBankEditOpen}
    sponsorship={sponsorship}
    onSaved={(updated) => setSponsorship(updated)}
  />
)}
```

- [ ] **Step 5: 브라우저 확인**

스폰서십 상세 페이지에서:
- 계좌 정보 섹션이 납부 스케줄 위에 표시되는지 확인
- 계좌 미등록 시 "등록된 계좌 정보가 없습니다" 표시
- "수정" 버튼 클릭 → BankEditDialog 열림
- 국내 계좌 입력 후 저장 → 섹션에 계좌 정보 표시
- canWrite가 false인 사용자는 "수정" 버튼 미노출

- [ ] **Step 6: Commit**

```bash
git add football/src/pages/sponsorship/SponsorshipDetailPage.tsx football/src/locales/
git commit -m "feat: add bank account section to sponsorship detail page"
```

---

## Task 10: 최종 빌드 + 통합 확인

- [ ] **Step 1: BE 전체 빌드**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: FE 전체 빌드**

```bash
cd football && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: BE 테스트 실행**

```bash
cd apps/api && npx jest
```

Expected: all tests pass.

- [ ] **Step 4: 통합 시나리오 체크리스트**

| 시나리오 | 확인 |
|---|---|
| nav에 "식대" 항목 없음 | ☐ |
| `/admin/meal-expenses` 접근 시 404 또는 리다이렉트 | ☐ |
| 운영비 지출 폼에 "식대" 카테고리 표시 | ☐ |
| 기존 식대 데이터가 운영비 지출 목록에 MEAL로 표시 | ☐ |
| 스폰서 등록 폼에 국내/영국 bank 섹션 표시 | ☐ |
| 스폰서 상세 페이지에 계좌 정보 섹션 표시 | ☐ |
| canWrite 없는 유저는 은행 수정 버튼 미노출 | ☐ |
| FinancialReport MEAL 합계가 올바르게 집계 | ☐ |

- [ ] **Step 5: 최종 Commit**

```bash
git add -A
git commit -m "chore: final cleanup and build verification"
```
