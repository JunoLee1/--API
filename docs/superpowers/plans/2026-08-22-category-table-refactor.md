# OperatingCategory Enum → ExpenseCategory Table Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `OperatingCategory` Prisma enum을 DB 테이블(`ExpenseCategory`)로 옮겨서, 앞으로는 카테고리 추가가 **data insert** 로만 가능하게(마이그레이션 불필요) 만든다. 이번 컷오버에서 카테고리 3개(`IT_SECURITY`, `FACILITY_EQUIPMENT`, `STAFF_RECRUITMENT`)를 신규 추가하고, 기존 `EQUIPMENT` 를 `SPORTS_EQUIPMENT` 로 이름과 라벨 모두 리네임한다.

**Why table-based (2026-08-22 grill Q10-3):**
- 카테고리 추가마다 Prisma migration + 배포 + FE 상수 갱신이 필요한 현재 구조가 프론트/백엔드 사이의 강한 결합을 만든다.
- 과거 memory note `feedback_prisma_migration_enum_conflict.md` (football PR #119~#125) 에 남은 enum rollback 사고 이력을 앞으로 원천 차단한다. 이번 컷오버 자체는 여전히 enum 을 건드리지만, 이후 카테고리 변경은 SQL insert 한 줄이 된다.
- 향후 admin CRUD 화면 (out-of-scope) 을 붙일 수 있는 확장 지점을 확보한다.

**Architecture:** 백엔드 + 프론트 동시 리팩. 4-step 마이그레이션(add table → parallel column → backfill → drop enum) 을 **2개의 Prisma migration** 으로 분할해 실패 시 부분 상태(partial-state) 가능성을 최소화한다. API wire format 은 `category: "MEDICAL"` (code string) 을 유지하여 FE 를 FK id 로부터 격리한다.

**Tech Stack:** Prisma + PostgreSQL, Express/Hono API, React + TypeScript. Zero new dependencies.

**Scope 제한:**
- 카테고리 admin CRUD UI 는 이 plan 밖 (Follow-up)
- 다국어 label 컬럼(i18n) 은 이 plan 밖 (Follow-up). 지금은 Korean `label` 단일 컬럼
- 팀별 커스텀 카테고리는 이 plan 밖 (Follow-up)

---

## 결정 히스토리 (2026-08-22 grill Q10~Q13)

**재논의 금지.** 실행 시 아래 결정에 의문이 생기면 grill 세션을 먼저 다시 열 것.

- **Q10-3**: enum 대신 table (`ExpenseCategory`)
- **Q10-1B**: 기존 `EQUIPMENT` → `SPORTS_EQUIPMENT` 로 리네임 (enum code AND label)
- **Q11 / Q12**: 신규 3개 카테고리 (아래 코드/라벨 확정)
    - `IT_SECURITY` — "IT·보안"
    - `FACILITY_EQUIPMENT` — "시설·장비 관리"
    - `STAFF_RECRUITMENT` — "직원 채용"
- **Q12**: `STAFF_RECRUITMENT` 는 **선수 스카우팅(`SCOUTING`) 과 완전 별개** 임을 코드/라벨에서 명확히
- **Q13**: 이 세션은 plan 작성만. 실행은 별도 세션.

---

## 시드 데이터 (9행, sortOrder 확정)

**컷오버 시 `ExpenseCategory` 에 정확히 이 9행을 넣는다.**

| sortOrder | code                | label (ko)                |
| --------: | ------------------- | ------------------------- |
|         0 | `MEDICAL`           | 의료·재활                 |
|         1 | `MEAL`              | 식대                      |
|         2 | `TRAVEL`            | 이동·숙박                 |
|         3 | `SPORTS_EQUIPMENT`  | 스포츠 장비·유니폼 (← EQUIPMENT 리네임) |
|         4 | `SCOUTING`          | 스카우팅·영입             |
|         5 | `YOUTH`             | 유소년 개발               |
|         6 | `IT_SECURITY`       | IT·보안 (신규)            |
|         7 | `FACILITY_EQUIPMENT`| 시설·장비 관리 (신규)     |
|         8 | `STAFF_RECRUITMENT` | 직원 채용 (신규)          |

`EQUIPMENT` 는 seed 시점에 이미 `SPORTS_EQUIPMENT` 로 들어간다. Backfill 은 old enum `EQUIPMENT` 값을 `WHERE code = 'SPORTS_EQUIPMENT'` 에 매핑한다.

---

## File Structure

### Backend (`apps/api`)

**Modified — schema:**
- `apps/api/prisma/schema.prisma` — `OperatingCategory` enum 유지(마이그레이션 A 단계) → 제거(마이그레이션 B 단계). `ExpenseCategory` model 추가. `OperatingExpense` / `BudgetCategoryPlan` / `BudgetLine` / `BudgetOverrideLog` 4개 모델에 `categoryId Int?` + `expenseCategory ExpenseCategory?` relation 추가.

**Modified — application code (52 refs 기준, generated 제외):**
- `apps/api/src/operating-expense/operating-expense.controller.ts`
- `apps/api/src/operating-expense/operating-expense.service.ts`
- `apps/api/src/operating-expense/operating-expense.repo.ts`
- `apps/api/src/budget-automation/budget-automation.repo.ts`
- `apps/api/src/budget-automation/budget-automation.service.ts`
- `apps/api/src/budget-automation/dto/budget-automation.dto.ts`
- `apps/api/src/budget-control/dto/budget-control.dto.ts`
- `apps/api/src/financial-report/financial-report.controller.ts`
- `apps/api/src/financial-report/financial-report.service.ts`
- `apps/api/src/financial-report/financial-report.repo.ts`

**New — expense-category module:**
- `apps/api/src/expense-category/expense-category.repo.ts` — Prisma CRUD (read-only for now)
- `apps/api/src/expense-category/expense-category.service.ts` — cache-loaded `resolveCategoryCode(id) / resolveCategoryId(code) / listActive()`
- `apps/api/src/expense-category/expense-category.controller.ts` — `GET /expense-categories`
- `apps/api/src/expense-category/expense-category.routes.ts` — route mount (Follow local router style)

**New — Prisma migrations (2개):**
- `apps/api/prisma/migrations/20260822010000_expense_category_table_add/migration.sql`
- `apps/api/prisma/migrations/20260822010001_expense_category_enum_drop/migration.sql`

### Frontend (`football`)

**Modified:**
- `football/src/types/budget.ts` — `OperatingCategory` type: enum literal union → `string`. `OPERATING_CATEGORY_LABEL` / `ALL_OPERATING_CATEGORIES` const 제거 (또는 fallback 만 유지 — Task 9 결정).
- `football/src/types/budget-automation.ts` — 동일한 union 확장.
- `football/src/pages/finance/BudgetAutoPage.tsx` — 하드코딩 `EXPENSE_CATS`, `EXPENSE_LABELS` 제거, hook 으로 대체.
- `football/src/pages/admin/BudgetPlanPage.tsx` — `ALL_OPERATING_CATEGORIES.map(...)` 을 hook 결과로 대체.
- `football/src/pages/admin/OperatingExpensePage.tsx` — 같은 방식으로 대체 (`FORM_CATEGORIES = ...filter(...!== 'MEDICAL')` 도 hook 데이터에 대해 filter).
- `football/src/services/operating-expense.service.ts` — 타입만 갱신.

**New:**
- `football/src/types/expense-category.ts` — `ExpenseCategory` interface + `ExpenseCategoryCode` union alias.
- `football/src/services/expense-category.service.ts` — `expenseCategoryApi.list()`.
- `football/src/hooks/useExpenseCategories.ts` — React query/context hook (SWR-style cache). 페이지 mount 마다 재호출 방지.

**참고 (변경 없음):**
- `football/src/services/financial-report.service.ts` — wire format 이 `category: string` 이므로 서명 유지.

---

## Task 1: 기존 참조 전수 조사 + 착수 확인

**Files:** (read-only)

- [ ] **Step 1: 백엔드 참조 카운트**

```bash
cd /Users/juno/work/football
grep -rn "OperatingCategory" apps/api/src --include="*.ts" 2>/dev/null \
  | grep -v "/generated/" | wc -l
# 기대치: 대략 22~25 라인 (2026-08-22 시점 실제 22 라인 카운트됨).
# 큰 편차가 나면 grep 이 놓친 파일이 있는지 재확인.
```

- [ ] **Step 2: 백엔드 참조 파일 목록 열거**

```bash
grep -rln "OperatingCategory" apps/api/src --include="*.ts" 2>/dev/null \
  | grep -v "/generated/"
```

기대 파일 (10개):
1. `apps/api/src/operating-expense/operating-expense.controller.ts`
2. `apps/api/src/operating-expense/operating-expense.service.ts`
3. `apps/api/src/operating-expense/operating-expense.repo.ts`
4. `apps/api/src/budget-automation/budget-automation.repo.ts`
5. `apps/api/src/budget-automation/budget-automation.service.ts`
6. `apps/api/src/budget-automation/dto/budget-automation.dto.ts`
7. `apps/api/src/budget-control/dto/budget-control.dto.ts`
8. `apps/api/src/financial-report/financial-report.controller.ts`
9. `apps/api/src/financial-report/financial-report.service.ts`
10. `apps/api/src/financial-report/financial-report.repo.ts`

- [ ] **Step 3: 프론트엔드 참조**

```bash
grep -rn "OperatingCategory\|OPERATING_CATEGORY_LABEL\|ALL_OPERATING_CATEGORIES" \
  football/src 2>/dev/null | wc -l
# 기대치: 대략 30+ 라인
```

기대 파일 (6개):
1. `football/src/types/budget.ts`
2. `football/src/types/budget-automation.ts`
3. `football/src/services/operating-expense.service.ts`
4. `football/src/pages/admin/BudgetPlanPage.tsx`
5. `football/src/pages/admin/OperatingExpensePage.tsx`
6. `football/src/pages/finance/BudgetAutoPage.tsx`

- [ ] **Step 4: schema.prisma 내 enum 사용처 확인**

```bash
grep -n "OperatingCategory\|model BudgetCategoryPlan\|model BudgetOverrideLog\|model OperatingExpense\|model BudgetLine" \
  apps/api/prisma/schema.prisma
```

기대: enum 선언 1행 + 4개 모델의 `category OperatingCategory` 필드 참조 4행. 5행 이상이 나오면 스코프에 없는 새 모델이 생긴 것 → plan 을 재확인.

- [ ] **Step 5: 테스트 fixture 참조 확인**

```bash
grep -rn "'MEDICAL'\|'EQUIPMENT'\|'MEAL'\|'TRAVEL'\|'SCOUTING'\|'YOUTH'" \
  apps/api/src --include="*.test.ts" 2>/dev/null | head -20
```

리스트업 후 Task 11 에서 rename 대상 (`EQUIPMENT` → `SPORTS_EQUIPMENT`) 이 있는지 확인.

- [ ] **Step 6: 브랜치 생성 (아직 커밋 없음)**

```bash
git checkout -b feat/expense-category-table-refactor
```

---

## Task 2: Prisma 스키마 — `ExpenseCategory` model 추가 + relation 필드

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `ExpenseCategory` model 정의 추가 (라인 2504 `enum OperatingCategory` 바로 뒤 or 별도 섹션)**

`enum OperatingCategory` 는 지금 지우지 말 것 (마이그레이션 A/B 단계 중 여전히 사용됨).

```prisma
// ─────────────────────────────────────────────
// Expense Category (table-backed, replacing OperatingCategory enum)
// ─────────────────────────────────────────────

model ExpenseCategory {
  id        Int      @id @default(autoincrement())
  code      String   @unique
  label     String
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  operatingExpenses   OperatingExpense[]
  budgetCategoryPlans BudgetCategoryPlan[]
  budgetLines         BudgetLine[]
  budgetOverrideLogs  BudgetOverrideLog[]
}
```

- [ ] **Step 2: 4개 모델에 nullable `categoryId` + relation 추가**

`OperatingCategory` enum 필드는 그대로 두고 **추가** 만 한다. (dual-column 상태)

```prisma
model OperatingExpense {
  // ... 기존 필드 ...
  category        OperatingCategory   // ← 그대로 유지
  categoryId      Int?                // ← 추가
  // ... 기존 관계 ...
  expenseCategory ExpenseCategory?    @relation(fields: [categoryId], references: [id])
}

model BudgetCategoryPlan {
  // ... 기존 필드 ...
  category          OperatingCategory   // ← 그대로 유지
  categoryId        Int?                // ← 추가
  // ... 기존 관계 ...
  expenseCategory   ExpenseCategory?    @relation(fields: [categoryId], references: [id])
}

model BudgetLine {
  // ... 기존 필드 ...
  category        OperatingCategory   // ← 그대로 유지
  categoryId      Int?                // ← 추가
  // ... 기존 관계 ...
  expenseCategory ExpenseCategory?    @relation(fields: [categoryId], references: [id])
}

model BudgetOverrideLog {
  // ... 기존 필드 ...
  category          OperatingCategory   // ← 그대로 유지
  categoryId        Int?                // ← 추가
  // ... 기존 관계 ...
  expenseCategory   ExpenseCategory?    @relation(fields: [categoryId], references: [id])
}
```

- [ ] **Step 3: Prisma format 확인 (파일 저장은 하되 migrate 는 다음 태스크에서)**

```bash
cd apps/api && npx prisma format
```

format 후 생기는 relation 자동 정렬 변화 커밋.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add ExpenseCategory model + nullable categoryId to 4 referencing models"
```

---

## Task 3: Migration A — CREATE TABLE + seed + backfill (SQL raw)

**Files:**
- Create: `apps/api/prisma/migrations/20260822010000_expense_category_table_add/migration.sql`

`prisma migrate dev` 로 자동 생성한 뒤 seed / backfill SQL 을 **같은 파일** 에 이어붙이면 원자성이 보장된다.

- [ ] **Step 1: Prisma 자동 생성**

```bash
cd apps/api
npx prisma migrate dev --create-only --name expense_category_table_add
```

이렇게 하면 `migration.sql` 이 다음을 포함해야 함 (직접 확인):
- `CREATE TABLE "ExpenseCategory" (...)` + unique index on `code`
- `ALTER TABLE "OperatingExpense" ADD COLUMN "categoryId" INTEGER` + FK
- `ALTER TABLE "BudgetCategoryPlan" ADD COLUMN "categoryId" INTEGER` + FK
- `ALTER TABLE "BudgetLine" ADD COLUMN "categoryId" INTEGER` + FK
- `ALTER TABLE "BudgetOverrideLog" ADD COLUMN "categoryId" INTEGER` + FK

- [ ] **Step 2: 자동 생성된 SQL 아래에 seed + backfill 이어붙이기**

`migration.sql` 끝부분에 append:

```sql
-- ─────────────────────────────────────────────
-- Seed ExpenseCategory rows (9 total: 6 existing + 3 new)
-- EQUIPMENT is renamed to SPORTS_EQUIPMENT at seed time.
-- ─────────────────────────────────────────────
INSERT INTO "ExpenseCategory" ("code", "label", "sortOrder", "isActive", "updatedAt") VALUES
  ('MEDICAL',            '의료·재활',            0, true, NOW()),
  ('MEAL',               '식대',                 1, true, NOW()),
  ('TRAVEL',             '이동·숙박',            2, true, NOW()),
  ('SPORTS_EQUIPMENT',   '스포츠 장비·유니폼',   3, true, NOW()),
  ('SCOUTING',           '스카우팅·영입',        4, true, NOW()),
  ('YOUTH',              '유소년 개발',          5, true, NOW()),
  ('IT_SECURITY',        'IT·보안',              6, true, NOW()),
  ('FACILITY_EQUIPMENT', '시설·장비 관리',       7, true, NOW()),
  ('STAFF_RECRUITMENT',  '직원 채용',            8, true, NOW());

-- ─────────────────────────────────────────────
-- Backfill categoryId for existing rows.
-- Old enum value 'EQUIPMENT' maps to new code 'SPORTS_EQUIPMENT'.
-- All other enum values map to their identical code.
-- ─────────────────────────────────────────────

UPDATE "OperatingExpense" oe
  SET "categoryId" = ec.id
  FROM "ExpenseCategory" ec
  WHERE ec.code = CASE oe.category::text
    WHEN 'EQUIPMENT' THEN 'SPORTS_EQUIPMENT'
    ELSE oe.category::text
  END;

UPDATE "BudgetCategoryPlan" bcp
  SET "categoryId" = ec.id
  FROM "ExpenseCategory" ec
  WHERE ec.code = CASE bcp.category::text
    WHEN 'EQUIPMENT' THEN 'SPORTS_EQUIPMENT'
    ELSE bcp.category::text
  END;

UPDATE "BudgetLine" bl
  SET "categoryId" = ec.id
  FROM "ExpenseCategory" ec
  WHERE ec.code = CASE bl.category::text
    WHEN 'EQUIPMENT' THEN 'SPORTS_EQUIPMENT'
    ELSE bl.category::text
  END;

UPDATE "BudgetOverrideLog" bol
  SET "categoryId" = ec.id
  FROM "ExpenseCategory" ec
  WHERE ec.code = CASE bol.category::text
    WHEN 'EQUIPMENT' THEN 'SPORTS_EQUIPMENT'
    ELSE bol.category::text
  END;
```

> **Note**: `SERIAL` 시퀀스는 `INSERT` 시 자동 값 부여를 사용 (id 컬럼 명시 안 함). Prisma default `@id @default(autoincrement())` 와 호환.

- [ ] **Step 3: Commit (migration 파일만, apply 는 Task 4)**

```bash
git add apps/api/prisma/migrations/20260822010000_expense_category_table_add/
git commit -m "feat(migration): add ExpenseCategory table with seed + backfill (migration A)"
```

---

## Task 4: Scratch DB 검증 (shared DB 건드리기 전)

**Files:** (verification only)

**왜:** memory note `feedback_prisma_migration_enum_conflict.md` 는 shared dev DB 에서 enum rollback 이 무한 스킵 상태에 빠졌던 실제 사고를 기록. 컷오버 전 반드시 scratch DB 에서 검증.

- [ ] **Step 1: Docker Postgres 완전 초기화 + 마이그레이션 재실행**

```bash
cd /Users/juno/work/football
docker compose down -v   # pgdata volume 삭제
docker compose up -d postgres
sleep 5
cd apps/api
npx prisma migrate deploy
```

`deploy` 는 지금까지의 모든 마이그레이션을 순서대로 실행. 오류 없이 통과해야 함.

- [ ] **Step 2: 시드 데이터 정합성 검증 (9행, sortOrder 0..8)**

```bash
docker compose exec postgres psql -U postgres -d football \
  -c 'SELECT id, code, label, "sortOrder", "isActive" FROM "ExpenseCategory" ORDER BY "sortOrder";'
```

기대 출력: 9 rows, code 순서 MEDICAL/MEAL/TRAVEL/SPORTS_EQUIPMENT/SCOUTING/YOUTH/IT_SECURITY/FACILITY_EQUIPMENT/STAFF_RECRUITMENT.

- [ ] **Step 3: (신규 DB 라 backfill 은 no-op — sanity check 만) 대상 4 테이블의 categoryId 컬럼 존재 확인**

```bash
docker compose exec postgres psql -U postgres -d football -c '
SELECT table_name, column_name FROM information_schema.columns
WHERE column_name = ''categoryId''
  AND table_name IN (''OperatingExpense'', ''BudgetCategoryPlan'', ''BudgetLine'', ''BudgetOverrideLog'');'
```

기대: 4행.

- [ ] **Step 4: (existing dev DB 가 있다면) staging clone 으로 backfill dry-run**

```bash
# staging 접속 정보가 있는 경우만
# pg_dump -h STAGING_HOST -U user football > staging_backup.sql
# createdb -h localhost -U postgres football_staging_clone
# psql -h localhost -U postgres football_staging_clone < staging_backup.sql
# psql -h localhost -U postgres football_staging_clone -f apps/api/prisma/migrations/20260822010000_expense_category_table_add/migration.sql
```

이 단계는 optional 이지만 prod-like row 수가 있다면 강력 권장. skip 시 이유를 PR 설명에 명시.

- [ ] **Step 5: 검증 완료 후 dev 는 `prisma migrate reset` 으로 원상 (또는 clean state 유지)**

이 태스크는 커밋 없음.

---

## Task 5: `expense-category` 백엔드 모듈 신설 (repo + service + controller)

**Files:**
- Create: `apps/api/src/expense-category/expense-category.repo.ts`
- Create: `apps/api/src/expense-category/expense-category.service.ts`
- Create: `apps/api/src/expense-category/expense-category.controller.ts`
- Create: `apps/api/src/expense-category/expense-category.routes.ts`

기존 서비스/컨트롤러 스타일(`operating-expense/*`) 을 그대로 따를 것. 아래 요약은 signature-level guide.

- [ ] **Step 1: repo**

```typescript
// apps/api/src/expense-category/expense-category.repo.ts
import { PrismaClient } from '@prisma/client';

export class ExpenseCategoryRepo {
  constructor(private prisma: PrismaClient) {}

  listActive() {
    return this.prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  listAll() {
    return this.prisma.expenseCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  findByCode(code: string) {
    return this.prisma.expenseCategory.findUnique({ where: { code } });
  }
}
```

- [ ] **Step 2: service (in-memory cache — 카테고리는 low-write / read-hot)**

```typescript
// apps/api/src/expense-category/expense-category.service.ts
import { ExpenseCategoryRepo } from './expense-category.repo';

interface CachedCategory { id: number; code: string; label: string; sortOrder: number; isActive: boolean; }

export class ExpenseCategoryService {
  private cache: CachedCategory[] | null = null;
  private byCode = new Map<string, CachedCategory>();
  private byId   = new Map<number, CachedCategory>();

  constructor(private repo: ExpenseCategoryRepo) {}

  private async load() {
    if (this.cache) return;
    const rows = await this.repo.listAll();
    this.cache = rows;
    this.byCode = new Map(rows.map(r => [r.code, r]));
    this.byId   = new Map(rows.map(r => [r.id, r]));
  }

  async listActive() {
    await this.load();
    return this.cache!.filter(c => c.isActive);
  }

  async resolveCategoryId(code: string): Promise<number> {
    await this.load();
    const found = this.byCode.get(code);
    if (!found) throw new Error(`Unknown expense category code: ${code}`);
    return found.id;
  }

  async resolveCategoryCode(id: number): Promise<string> {
    await this.load();
    const found = this.byId.get(id);
    if (!found) throw new Error(`Unknown expense category id: ${id}`);
    return found.code;
  }

  // future admin CRUD 붙일 때 호출
  invalidateCache() { this.cache = null; this.byCode.clear(); this.byId.clear(); }
}
```

- [ ] **Step 3: controller — `GET /expense-categories` 만 노출 (admin CRUD 는 Follow-up)**

```typescript
// apps/api/src/expense-category/expense-category.controller.ts
import { Request, Response } from 'express';
import { ExpenseCategoryService } from './expense-category.service';

export class ExpenseCategoryController {
  constructor(private service: ExpenseCategoryService) {}

  list = async (_req: Request, res: Response) => {
    const rows = await this.service.listActive();
    res.json(rows);   // [{ id, code, label, sortOrder, isActive }, ...]
  };
}
```

- [ ] **Step 4: routes 파일 + 상위 라우터 등록**

기존 모듈이 `apps/api/src/index.ts` 등에서 어떻게 mount 하는지 그대로 따라할 것. 예:

```typescript
// apps/api/src/expense-category/expense-category.routes.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ExpenseCategoryRepo } from './expense-category.repo';
import { ExpenseCategoryService } from './expense-category.service';
import { ExpenseCategoryController } from './expense-category.controller';

export function buildExpenseCategoryRouter(prisma: PrismaClient) {
  const repo = new ExpenseCategoryRepo(prisma);
  const service = new ExpenseCategoryService(repo);
  const controller = new ExpenseCategoryController(service);
  const router = Router();
  router.get('/', controller.list);
  return { router, service };   // service 를 다른 모듈이 DI 받도록 export
}
```

`service` 인스턴스를 export 하는 이유: `operating-expense`, `budget-control` 등에서 `resolveCategoryId(code)` 를 재사용하기 위함.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/expense-category/
# 라우터 등록한 상위 index.ts 도 함께
git add apps/api/src/index.ts   # 또는 실제 라우터 mount 위치
git commit -m "feat(expense-category): add read-only ExpenseCategory API + service cache"
```

---

## Task 6: 백엔드 READ 경로 — dual-read (categoryId 우선, 없으면 enum fallback)

**Files:**
- Modify: `apps/api/src/operating-expense/operating-expense.repo.ts`
- Modify: `apps/api/src/operating-expense/operating-expense.service.ts`
- Modify: `apps/api/src/financial-report/financial-report.repo.ts`
- Modify: `apps/api/src/financial-report/financial-report.service.ts`
- Modify: `apps/api/src/budget-automation/budget-automation.repo.ts`

**목표:** 응답 시 `category` 를 항상 code string 으로 리턴. `categoryId` 가 있으면 map 으로 code 해결, 없으면 old enum 컬럼 값 사용. → 컷오버 마이그레이션 B 전까지 안전한 dual-state.

- [ ] **Step 1: helper 마련 (한 파일에)**

`apps/api/src/expense-category/expense-category.service.ts` 의 `resolveCategoryCode(id)` / `resolveCategoryId(code)` 를 각 모듈에 DI 주입 (repo constructor 파라미터 추가).

- [ ] **Step 2: `OperatingExpense` findMany 등에 `include: { expenseCategory: true }` 추가**

응답 매핑 시:

```typescript
// operating-expense.repo.ts
const rows = await this.prisma.operatingExpense.findMany({
  where: { ... },
  include: { expenseCategory: true, createdBy: true },
});
return rows.map(r => ({
  ...r,
  category: r.expenseCategory?.code ?? r.category,   // dual-read
}));
```

- [ ] **Step 3: 같은 패턴을 `BudgetCategoryPlan`, `BudgetLine`, `BudgetOverrideLog` findMany 에 적용**

`financial-report.repo.ts` 의 조회 함수, `budget-automation.repo.ts` 의 lines 조회.

- [ ] **Step 4: 검색 필터 (`where: { category: 'MEDICAL' }`) 를 dual 로 확장**

```typescript
// 예: category code 로 필터하고 싶을 때
where: {
  OR: [
    { expenseCategory: { code } },
    { category: code as any },   // TODO: 마이그레이션 B 후 이 브랜치 제거
  ],
}
```

혹은 서비스 레이어에서 `categoryId = await service.resolveCategoryId(code)` 하고 `where: { OR: [{ categoryId }, { category: code as any }] }`.

- [ ] **Step 5: 서비스/컨트롤러 응답 타입 확인 — `category: string` 이 나가는지 (기존 enum 리터럴 union 이 아니라 넓은 string)**

TypeScript 에러 발생 시 응답 타입 `category: string` 으로 완화. 아직 DTO 계층은 이 태스크에서 loose 하게 두고 Task 8 에서 정리.

- [ ] **Step 6: TypeScript 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/operating-expense/ apps/api/src/financial-report/ apps/api/src/budget-automation/
git commit -m "refactor(be): dual-read categoryId with enum fallback for OperatingCategory-referencing tables"
```

---

## Task 7: 백엔드 WRITE 경로 — categoryId 필수 저장, enum 컬럼도 이중 기입

**Files:**
- Modify: `apps/api/src/operating-expense/operating-expense.service.ts`
- Modify: `apps/api/src/operating-expense/operating-expense.repo.ts`
- Modify: `apps/api/src/financial-report/financial-report.service.ts`
- Modify: `apps/api/src/budget-automation/budget-automation.service.ts`

- [ ] **Step 1: create/update 진입점에서 code → id 매핑 후 두 컬럼 모두 write**

```typescript
// 예: OperatingExpense.create
async create(input: { category: string; ... }) {
  const categoryId = await this.expenseCategoryService.resolveCategoryId(input.category);
  return this.prisma.operatingExpense.create({
    data: {
      ...input,
      category: input.category as any,   // 여전히 old enum 컬럼도 채움 (dual-write)
      categoryId,
    },
  });
}
```

**dual-write 이유:** 마이그레이션 B 전까지 old enum 컬럼이 NOT NULL 이므로 계속 채워야 함. 마이그레이션 B 이후에는 Task 12 에서 `category` write 를 제거.

- [ ] **Step 2: 같은 패턴을 4개 모델의 create/update 경로 전체에 적용**

`BudgetCategoryPlan`: upsert 흐름 (`upsertBudgetPlan` 등) 도 포함.
`BudgetLine`: `BudgetHeader` 생성 시 자식으로 만들어지는 경로.
`BudgetOverrideLog`: override 요청 처리.

- [ ] **Step 3: `Object.values(OperatingCategory)` 를 순회하는 코드 확인**

`apps/api/src/budget-automation/budget-automation.service.ts:95` 에 `for (const cat of Object.values(OperatingCategory))` 가 있음. 이 loop 은 이제 `await service.listActive()` 결과의 `code` 를 순회하도록 교체.

```typescript
// before
for (const cat of Object.values(OperatingCategory)) { ... }
// after
const categories = await this.expenseCategoryService.listActive();
for (const cat of categories) { const code = cat.code; ... }
```

주의: 이 자리에 새로 추가된 `IT_SECURITY / FACILITY_EQUIPMENT / STAFF_RECRUITMENT` 도 포함됨. budget-automation preview 가 신규 카테고리를 자동으로 인식하게 됨 — Q11 그림과 정확히 일치.

- [ ] **Step 4: `financial-report.service.ts:145` 의 하드코딩 리스트 제거**

```typescript
// before
const ALL_CATS: OperatingCategory[] = ["MEDICAL", "MEAL", "TRAVEL", "EQUIPMENT", "SCOUTING", "YOUTH"];
// after
const ALL_CATS = (await this.expenseCategoryService.listActive()).map(c => c.code);
```

- [ ] **Step 5: TypeScript + 기존 유닛 테스트 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit && npx jest --listTests 2>&1 | head -5
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/operating-expense/ apps/api/src/financial-report/ apps/api/src/budget-automation/
git commit -m "refactor(be): dual-write categoryId + code, replace enum iteration with cached table read"
```

---

## Task 8: DTO / wire format — `category: string` 유지, 서버 내부에서만 id 해결

**Files:**
- Modify: `apps/api/src/budget-automation/dto/budget-automation.dto.ts`
- Modify: `apps/api/src/budget-control/dto/budget-control.dto.ts`
- Modify: `apps/api/src/operating-expense/operating-expense.controller.ts`
- Modify: `apps/api/src/financial-report/financial-report.controller.ts`

**결정:** wire format 은 `category: "MEDICAL"` (code string). 이유:
- FE 를 FK id 로부터 격리
- 기존 API 클라이언트 (모바일/외부 통합 있을 경우) 호환
- 로그/디버깅이 human-readable

- [ ] **Step 1: DTO 타입 `category: OperatingCategory` → `category: string` (또는 `ExpenseCategoryCode` alias)**

```typescript
// budget-automation.dto.ts
// before
categoryOverrides?: Partial<Record<OperatingCategory, GoalWeight>>;
// after
categoryOverrides?: Record<string, GoalWeight>;   // key = category code
```

`byCategory` 리턴 shape 동일. `Object.entries` 로 iterate 하는 코드는 그대로 동작.

- [ ] **Step 2: request 검증 강화 (Zod / class-validator 어느쪽이든)**

기존 union literal 검증 (`z.enum(['MEDICAL', ...])`) 은 이제 DB lookup 으로 대체:

```typescript
// 서비스 진입점
const validCodes = new Set((await service.listActive()).map(c => c.code));
if (!validCodes.has(input.category)) {
  throw new Error(`Invalid category code: ${input.category}`);
}
```

- [ ] **Step 3: 컨트롤러 body 타입 힌트 정리**

`category: OperatingCategory` 로 캐스팅된 곳들 (`operating-expense.controller.ts:37,58,59`) → `category: string`.

- [ ] **Step 4: `import { OperatingCategory } from '@/generated/enums'` 제거 (또는 로컬 alias 만 남김)**

DTO 파일에서 완전히 제거. `budget-control/dto/budget-control.dto.ts` 등.

- [ ] **Step 5: TypeScript + jest smoke test**

```bash
cd apps/api && npx tsc --noEmit && npx jest --testPathPattern="operating-expense|financial-report|budget" 2>&1 | tail -20
```

기대: enum-related 에러 없음. 유닛 테스트 통과 (일부 fixture 는 다음 태스크에서 조정).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/**/dto/ apps/api/src/**/*.controller.ts
git commit -m "refactor(be): DTO wire format uses category code string, drop OperatingCategory enum type imports"
```

---

## Task 9: 프론트엔드 — `expenseCategoryApi.list()` + `useExpenseCategories` 훅

**Files:**
- Create: `football/src/types/expense-category.ts`
- Create: `football/src/services/expense-category.service.ts`
- Create: `football/src/hooks/useExpenseCategories.ts`

- [ ] **Step 1: 타입 정의**

```typescript
// football/src/types/expense-category.ts
export interface ExpenseCategory {
  id: number
  code: string
  label: string
  sortOrder: number
  isActive: boolean
}

// 카테고리 code union 은 이제 컴파일 타임에 고정할 수 없음.
// 좁은 타입이 꼭 필요한 곳은 string literal 대신 string.
export type ExpenseCategoryCode = string
```

- [ ] **Step 2: service**

기존 `football/src/services/*.service.ts` 스타일 (예: `operating-expense.service.ts`) 을 그대로 답습.

```typescript
// football/src/services/expense-category.service.ts
import { api } from './client'   // 기존 axios/fetch wrapper
import type { ExpenseCategory } from '@/types/expense-category'

export const expenseCategoryApi = {
  async list(): Promise<ExpenseCategory[]> {
    return api.get<ExpenseCategory[]>('/expense-categories')
  },
}
```

주의: memory note `feedback_football_api_patterns.md` 에 따라 `.data` 접근 없이 배열을 그대로 리턴할 것.

- [ ] **Step 3: hook (한 번 fetch → 앱 전체에서 공유)**

프로젝트가 SWR 을 쓰는지 React Query 를 쓰는지 확인 후 그 스타일 채용. 없으면 간단한 module-level cache:

```typescript
// football/src/hooks/useExpenseCategories.ts
import { useEffect, useState } from 'react'
import { expenseCategoryApi } from '@/services/expense-category.service'
import type { ExpenseCategory } from '@/types/expense-category'

let cached: ExpenseCategory[] | null = null
let inflight: Promise<ExpenseCategory[]> | null = null

async function fetchOnce() {
  if (cached) return cached
  if (!inflight) inflight = expenseCategoryApi.list().then(rows => { cached = rows; inflight = null; return rows })
  return inflight
}

export function useExpenseCategories() {
  const [rows, setRows] = useState<ExpenseCategory[] | null>(cached)
  useEffect(() => {
    if (rows) return
    void fetchOnce().then(setRows)
  }, [rows])

  const labelOf = (code: string) => rows?.find(r => r.code === code)?.label ?? code
  return { rows: rows ?? [], loading: rows === null, labelOf }
}
```

- [ ] **Step 4: `football/src/types/budget.ts` 정리**

```typescript
// before
export type OperatingCategory = 'MEDICAL' | 'MEAL' | 'TRAVEL' | 'EQUIPMENT' | 'SCOUTING' | 'YOUTH'
export const OPERATING_CATEGORY_LABEL: Record<OperatingCategory, string> = { ... }
export const ALL_OPERATING_CATEGORIES: OperatingCategory[] = [ ... ]

// after — 하위 호환 alias 만 유지 (지우면 컴파일 대량 실패)
import type { ExpenseCategoryCode } from './expense-category'
export type OperatingCategory = ExpenseCategoryCode   // 이제 string. 다음 커밋들에서 제거 예정
// OPERATING_CATEGORY_LABEL, ALL_OPERATING_CATEGORIES 제거 — 이 커밋에서 삭제하고 사용처 다음 태스크에서 fix
```

**Trade-off:** `ALL_OPERATING_CATEGORIES` 를 fallback array 로 유지할 수도 있으나, 신규 3개 카테고리가 하드코딩된 리스트에서 누락되면 조용한 버그가 생김. **삭제 권장.** 오프라인 dev 시엔 API mock 서버가 대응.

- [ ] **Step 5: Commit**

```bash
git add football/src/types/expense-category.ts football/src/services/expense-category.service.ts football/src/hooks/useExpenseCategories.ts football/src/types/budget.ts
git commit -m "feat(fe): add expenseCategoryApi + useExpenseCategories hook, deprecate hardcoded consts"
```

---

## Task 10: 프론트엔드 페이지 리팩 — 하드코딩 카테고리 리스트 제거

**Files:**
- Modify: `football/src/pages/admin/OperatingExpensePage.tsx`
- Modify: `football/src/pages/admin/BudgetPlanPage.tsx`
- Modify: `football/src/pages/finance/BudgetAutoPage.tsx`

각 페이지는 mount 시 `useExpenseCategories()` 호출 → `rows` / `labelOf` 사용.

- [ ] **Step 1: `OperatingExpensePage.tsx`**

```tsx
// before
import { OPERATING_CATEGORY_LABEL, ALL_OPERATING_CATEGORIES } from '@/types/budget'
const FORM_CATEGORIES = ALL_OPERATING_CATEGORIES.filter((c) => c !== 'MEDICAL')

// after
import { useExpenseCategories } from '@/hooks/useExpenseCategories'
// component body
const { rows: allCategories, labelOf } = useExpenseCategories()
const formCategories = allCategories.filter(c => c.code !== 'MEDICAL')
// 테이블 셀
<TableCell>{labelOf(e.category)}</TableCell>
// select
{formCategories.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
```

- [ ] **Step 2: `BudgetPlanPage.tsx`**

`ALL_OPERATING_CATEGORIES.map(...)`, `ALL_OPERATING_CATEGORIES.reduce(...)`, `overrideCategory` state 초기값, override select — 모두 hook 결과로 대체. hook 이 로딩 중이면 loading skeleton 표시.

주의: 이 파일은 별도 plan `2026-08-22-budget-plan-dynamic-form-wizard.md` 에서 전면 재작성 대상이기도 함. 두 plan 이 동시에 진행되면 conflict → 이 plan 이 먼저 merge 되거나, wizard plan 이 이 hook 을 이미 사용하도록 조정. **머지 순서는 이 plan 이 먼저** (스키마 변경이 있으므로).

- [ ] **Step 3: `BudgetAutoPage.tsx`**

```tsx
// before
const EXPENSE_CATS: OperatingCategory[] = ['MEDICAL', 'MEAL', 'TRAVEL', 'EQUIPMENT', 'SCOUTING', 'YOUTH']
const EXPENSE_LABELS: Record<OperatingCategory, string> = { ... }

// after
const { rows: expenseCats, labelOf } = useExpenseCategories()
// 이후 EXPENSE_CATS → expenseCats, EXPENSE_LABELS[c] → labelOf(c.code)
```

- [ ] **Step 4: `football/src/services/operating-expense.service.ts` 시그니처 확인**

`category: OperatingCategory` 는 이제 `category: string` 과 동치이므로 컴파일 통과. 실제로 넘어가는 값은 UI 에서 선택된 code.

- [ ] **Step 5: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep -E "(budget|operating|expense)" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add football/src/pages/
git commit -m "refactor(fe): replace hardcoded category consts with useExpenseCategories hook"
```

---

## Task 11: 테스트 업데이트 (BE + FE fixtures)

**Files:**
- Modify: `apps/api/src/**/*.test.ts` (grep 결과에 따라)
- Modify: `football/src/**/*.test.tsx` (있는 경우)

- [ ] **Step 1: BE 테스트 fixture 에서 `EQUIPMENT` → `SPORTS_EQUIPMENT` 로 갱신**

```bash
cd apps/api
grep -rln "'EQUIPMENT'" src --include="*.test.ts" 2>/dev/null
# 각 파일 열어서 문맥 확인 후 SPORTS_EQUIPMENT 로 교체
```

주의: `EquipmentCategory` (별개 enum!), `EquipmentLoan`, `Equipment*Manager` 등은 관련 없음. **오직 `OperatingCategory` 문맥의 `EQUIPMENT` 만** 교체.

- [ ] **Step 2: BE 유닛 테스트에서 `expenseCategoryService` mock 주입**

`resolveCategoryId('MEDICAL') → 1` 같은 stub. Prisma mock 을 쓰는 곳은 `expenseCategory.findMany` 반환값도 stub 필요.

- [ ] **Step 3: FE 컴포넌트 테스트에서 `useExpenseCategories` mock**

```typescript
// __mocks__/useExpenseCategories.ts
export const useExpenseCategories = () => ({
  rows: [
    { id: 1, code: 'MEDICAL', label: '의료·재활', sortOrder: 0, isActive: true },
    { id: 4, code: 'SPORTS_EQUIPMENT', label: '스포츠 장비·유니폼', sortOrder: 3, isActive: true },
    // ... 9 rows total
  ],
  loading: false,
  labelOf: (code: string) => code,
})
```

- [ ] **Step 4: 테스트 실행**

```bash
cd /Users/juno/work/football/apps/api && npx jest 2>&1 | tail -30
cd /Users/juno/work/football/football && npm test 2>&1 | tail -30
```

기대: 모두 pass. fail 시 원인 파악 후 fixture 갱신.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src football/src
git commit -m "test: update fixtures for ExpenseCategory table, rename EQUIPMENT → SPORTS_EQUIPMENT"
```

---

## Task 12: Migration B — NOT NULL 강제 + DROP enum column + DROP enum type (원자적 컷오버)

**Files:**
- Create: `apps/api/prisma/migrations/20260822010001_expense_category_enum_drop/migration.sql`

**중요:** 이 마이그레이션은 **한 파일** 로 만들어 부분 실패 시 rollback 이 확실히 되게 한다. Prisma 는 하나의 `.sql` 파일 안의 여러 statement 를 트랜잭션으로 감싼다 (implicit BEGIN/COMMIT — Prisma docs).

- [ ] **Step 1: 스키마에서 old enum 필드와 `enum OperatingCategory` 삭제**

```prisma
// apps/api/prisma/schema.prisma

// 삭제
enum OperatingCategory { ... }

// 4개 model 에서 category 필드 삭제, categoryId 를 NOT NULL 로
model OperatingExpense {
  ...
  // category OperatingCategory   ← 삭제
  categoryId      Int              // ← NOT NULL 로 승격
  expenseCategory ExpenseCategory  @relation(fields: [categoryId], references: [id])   // relation 도 non-null
  ...
}
// BudgetCategoryPlan, BudgetLine, BudgetOverrideLog 도 동일 패턴
```

`BudgetCategoryPlan` 의 `@@unique([financialReportId, category])` 제약도 `@@unique([financialReportId, categoryId])` 로 변경.

- [ ] **Step 2: `prisma format` + auto-generate migration**

```bash
cd apps/api
npx prisma migrate dev --create-only --name expense_category_enum_drop
```

- [ ] **Step 3: 생성된 SQL 검토 + 필요 시 수동 편집**

기대 SQL (요약):

```sql
-- 4 tables: NOT NULL 승격
ALTER TABLE "OperatingExpense"   ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "BudgetCategoryPlan" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "BudgetLine"         ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "BudgetOverrideLog"  ALTER COLUMN "categoryId" SET NOT NULL;

-- unique 제약 교체 (BudgetCategoryPlan)
DROP INDEX "BudgetCategoryPlan_financialReportId_category_key";
CREATE UNIQUE INDEX "BudgetCategoryPlan_financialReportId_categoryId_key"
  ON "BudgetCategoryPlan"("financialReportId", "categoryId");

-- 4 tables: old enum column drop
ALTER TABLE "OperatingExpense"   DROP COLUMN "category";
ALTER TABLE "BudgetCategoryPlan" DROP COLUMN "category";
ALTER TABLE "BudgetLine"         DROP COLUMN "category";
ALTER TABLE "BudgetOverrideLog"  DROP COLUMN "category";

-- enum type drop
DROP TYPE "OperatingCategory";
```

- [ ] **Step 4: Safety check 이 SQL 파일 맨 위에 방어적 assert 추가**

```sql
-- Refuse to run if any row still has NULL categoryId (would mean backfill was skipped)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "OperatingExpense" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'Aborting: OperatingExpense has rows with NULL categoryId. Run migration A backfill first.';
  END IF;
  IF EXISTS (SELECT 1 FROM "BudgetCategoryPlan" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'Aborting: BudgetCategoryPlan has rows with NULL categoryId.';
  END IF;
  IF EXISTS (SELECT 1 FROM "BudgetLine" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'Aborting: BudgetLine has rows with NULL categoryId.';
  END IF;
  IF EXISTS (SELECT 1 FROM "BudgetOverrideLog" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'Aborting: BudgetOverrideLog has rows with NULL categoryId.';
  END IF;
END $$;
```

- [ ] **Step 5: Scratch DB 에서 A + B 순차 실행 검증**

```bash
docker compose down -v && docker compose up -d postgres
sleep 5
cd apps/api
npx prisma migrate deploy   # A + B 순차 실행 오류 없어야 함
# psql 로 4 테이블에 category 컬럼이 사라졌는지, OperatingCategory 타입이 없어졌는지 확인
docker compose exec postgres psql -U postgres -d football -c \
  'SELECT column_name FROM information_schema.columns WHERE table_name = ''OperatingExpense'' AND column_name IN (''category'', ''categoryId'');'
# 기대: categoryId 만
docker compose exec postgres psql -U postgres -d football -c \
  "SELECT typname FROM pg_type WHERE typname = 'OperatingCategory';"
# 기대: 0 rows
```

- [ ] **Step 6: Commit (schema + migration 함께)**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260822010001_expense_category_enum_drop/
git commit -m "feat(migration): drop OperatingCategory enum, enforce NOT NULL categoryId (migration B)"
```

---

## Task 13: 백엔드 dual-write 제거 (Migration B 반영)

**Files:**
- Modify: `apps/api/src/operating-expense/*.ts`
- Modify: `apps/api/src/financial-report/*.ts`
- Modify: `apps/api/src/budget-automation/*.ts`
- Modify: `apps/api/src/budget-control/*.ts`

이 시점에서 스키마상 `category` 컬럼은 존재하지 않음. Prisma client 도 regenerate 되어 해당 필드 타입에서 사라져 있어야 함.

- [ ] **Step 1: `prisma generate` 로 client 재생성**

```bash
cd apps/api && npx prisma generate
```

`apps/api/src/generated/enums.ts` 에서 `OperatingCategory` export 가 사라졌을 것.

- [ ] **Step 2: TypeScript 에러 잡기 (남은 enum 참조 = 컴파일 에러)**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -i "OperatingCategory" | head -20
```

각 에러:
- create/update payload 에서 `category: input.category` 라인 제거 (Task 7 dual-write 삭제)
- `where: { OR: [{ expenseCategory: { code } }, { category: code as any }] }` → `where: { expenseCategory: { code } }` (Task 6 fallback 삭제)
- `import { OperatingCategory } from '@/generated/enums'` 남은 것 모두 제거

- [ ] **Step 3: Response mapping 단순화 — `r.expenseCategory?.code ?? r.category` → `r.expenseCategory.code`**

`expenseCategory` relation 이 이제 non-nullable 이므로 `?.` 제거 가능. 다만 `include` 를 안 한 조회 경로가 있으면 여전히 undefined 이므로 조회 함수에서 항상 include 하는지 확인.

- [ ] **Step 4: 유닛 테스트 재실행**

```bash
cd apps/api && npx jest 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "refactor(be): drop dual-write and enum fallback after ExpenseCategory table cutover"
```

---

## Task 14: 문서 / memory 업데이트

**Files:**
- Modify: `docs/adr/` — 신규 ADR
- (내부 memory 는 사용자가 개별 관리)

- [ ] **Step 1: ADR 신규 파일 작성**

```bash
ls docs/adr | tail -3
# 다음 번호 확인 (현재 0011까지 있음 → 0012)
```

`docs/adr/0012-expense-category-table-vs-enum.md` 작성. Template 은 기존 ADR (예: `0011-knapsack-operating-budget-allocation.md`) 답습:

- Context: 카테고리 추가마다 migration/deploy/FE 상수 3-way 갱신 필요, PR #119~#125 enum rollback 사고 이력
- Decision: `OperatingCategory` enum → `ExpenseCategory` table
- Consequences (positive): 신규 카테고리 = SQL insert 한 줄. Admin CRUD 확장 가능. Enum rollback risk 제거.
- Consequences (negative): 컴파일 타임 타입 안전성 약화 (code = string). 매 요청에서 category cache lookup (single-digit ms).
- Migration strategy: 2-step (add + cutover), scratch DB 검증 필수.

- [ ] **Step 2: `CONTEXT.md` 업데이트 (재무 도메인 섹션이 있으면)**

```bash
grep -n "OperatingCategory\|카테고리\|expense" /Users/juno/work/football/CONTEXT.md | head -10
```

관련 섹션에 "카테고리는 이제 `ExpenseCategory` 테이블로 관리 (ADR-0012)" 한 줄 추가.

- [ ] **Step 3: memory note 갱신을 사용자에게 알림**

이 태스크는 실행 agent 가 아니라 **사용자** 가 `feedback_prisma_migration_enum_conflict.md` 를 열어 "resolved by ExpenseCategory table refactor (PR #TBD)" 노트를 추가하는 것을 권장. PR description 에도 언급.

- [ ] **Step 4: Commit**

```bash
git add docs/adr/0012-expense-category-table-vs-enum.md CONTEXT.md
git commit -m "docs: add ADR-0012 for ExpenseCategory table refactor decision"
```

---

## Task 15: 전체 E2E 스모크 (dev 서버)

**Files:** (verification only)

- [ ] **Step 1: dev DB 마이그레이션 재실행 + BE / FE 재시작**

```bash
cd /Users/juno/work/football
# scratch DB 로 완전 초기화 (안전)
docker compose down -v && docker compose up -d postgres
sleep 5
cd apps/api && npx prisma migrate deploy && npx prisma db seed 2>/dev/null || true
cd .. && (apps/api 는 이미 restart, football 도 restart)
```

- [ ] **Step 2: 브라우저 시나리오**

1. `/admin/operating-expense` — 카테고리 select 에 9개 옵션 (신규 3개 포함, `SPORTS_EQUIPMENT` 라벨 확인)
2. 새 지출 등록 → 저장 → 리스트에 정확한 label 표시
3. `/admin/budget-plan` — 카테고리 카드 9개 렌더
4. `/finance/budget-auto` — preview 요청 시 응답 `byCategory` 에 9 key
5. Admin 계정으로 override 요청 생성 → `/admin/budget-plan` 하단 로그에 표시, label 정확

- [ ] **Step 3: API 직접 호출로 wire format 확인**

```bash
curl -s http://localhost:PORT/expense-categories | jq
# 기대: 9 rows with code/label/sortOrder/isActive
curl -s http://localhost:PORT/operating-expense?seasonId=... | jq '.[0].category'
# 기대: "SPORTS_EQUIPMENT" (예전에 EQUIPMENT 였던 것)
```

- [ ] **Step 4: 로그에 warning / enum-related error 없는지 확인**

---

## Task 16: PR 생성

**Files:** (git operations)

- [ ] **Step 1: 커밋 로그 확인**

```bash
git log --oneline main..HEAD
# 기대: 대략 12~14 commits (Task 2~13 커밋 + 문서)
```

- [ ] **Step 2: push + PR**

```bash
git push -u origin feat/expense-category-table-refactor
gh pr create --title "feat: ExpenseCategory table refactor (enum → DB)" --body "$(cat <<'EOF'
## Summary
- `OperatingCategory` Prisma enum → `ExpenseCategory` DB table (ADR-0012)
- 신규 카테고리 3개: `IT_SECURITY`, `FACILITY_EQUIPMENT`, `STAFF_RECRUITMENT`
- 기존 `EQUIPMENT` → `SPORTS_EQUIPMENT` (code + label 리네임)
- 앞으로 카테고리 추가 = SQL insert 한 줄 (마이그레이션 불필요)

## Migration strategy
2-step, 원자적 컷오버:
- **Migration A** (`20260822010000_expense_category_table_add`): `ExpenseCategory` 테이블 + 9행 seed + 4개 테이블에 nullable `categoryId` FK 추가 + backfill
- **Migration B** (`20260822010001_expense_category_enum_drop`): `categoryId` NOT NULL 승격 + old enum column drop + `DROP TYPE OperatingCategory`. 앞부분에 방어적 assert 로 backfill 스킵 감지.

## Review checklist (컷오버 마이그레이션)
- [ ] Migration B 의 assert block 이 존재하는가
- [ ] Scratch DB (`docker compose down -v && up`) 에서 A+B 순차 실행 성공했는가
- [ ] `SELECT * FROM ExpenseCategory ORDER BY "sortOrder"` 이 정확히 9행, code/label 맞는가
- [ ] 기존 EQUIPMENT 데이터가 SPORTS_EQUIPMENT 로 매핑되었는가 (`SELECT DISTINCT category FROM OperatingExpense` 이 아니라 join 으로 확인)
- [ ] 컷오버 후 `pg_type` 에 `OperatingCategory` 가 남아있지 않은가

## Related
- 결정 이력: 2026-08-22 grill Q10~Q13
- Enum rollback 사고 이력: `feedback_prisma_migration_enum_conflict.md` (PR #119~#125). 이 refactor 로 향후 카테고리 변경은 enum 을 건드리지 않음.
- Concurrent plan: `2026-08-22-budget-plan-dynamic-form-wizard.md` — 이 PR 이 먼저 merge 되어야 함 (스키마 우선).
EOF
)"
```

- [ ] **Step 3: PR URL 반환**

---

## 위험 / 안전 노트 (실행 agent 필독)

1. **Enum rollback 이력 (memory `feedback_prisma_migration_enum_conflict.md`, PR #119~#125)** — 과거 shared dev DB 에서 enum 관련 롤백이 무한 스킵 상태를 만든 사고가 있음. 그래서 **Task 4 scratch DB 검증은 optional 이 아니라 mandatory**. Task 4 를 스킵하면 실패 시 PR #119 사고의 재현이 될 수 있음.

2. **Migration A/B 분리의 정확한 이유:** A 실행 후 코드 배포 없이 DB 만 앞선 상태로 있어도 앱은 dual-read/dual-write 로 정상 동작. B 는 코드가 이미 categoryId 를 완전히 사용한 뒤에만 실행. 두 마이그레이션 사이에 코드 배포 창이 있음.

3. **Prisma migration transaction 단위:** `.sql` 파일 하나가 하나의 트랜잭션. 그래서 Migration B 안의 4개 `SET NOT NULL` + 4개 `DROP COLUMN` + `DROP TYPE` 이 원자적. 부분 실패는 없음.

4. **Backfill 매핑 특이 케이스 `EQUIPMENT` → `SPORTS_EQUIPMENT`:** Migration A 의 `CASE WHEN ... THEN 'SPORTS_EQUIPMENT' ELSE ...` 를 반드시 유지. seed 시점에 old code `'EQUIPMENT'` 를 넣지 않아야 함 (넣으면 unique 충돌 or 잘못된 매핑).

5. **Concurrent PR conflict:** 같은 날짜의 `2026-08-22-budget-plan-dynamic-form-wizard.md` 가 `BudgetPlanPage.tsx` 를 재작성함. 이 refactor plan 이 먼저 merge 되어야 하며, wizard plan 이 이 PR 의 hook (`useExpenseCategories`) 을 이미 사용하도록 재조정.

6. **Test DB 는 동일 마이그레이션이 돌아야 함:** CI 에서 `NODE_ENV=test` 로 도는 DB 인스턴스에도 A+B 마이그레이션이 적용되는지 확인. 안 되면 유닛 테스트는 통과하지만 CI 통합 테스트 실패.

---

## Self-Review

**Spec coverage (2026-08-22 grill 결정):**
- Q10-3 table-based: `ExpenseCategory` model 신설 (Task 2), enum drop (Task 12)
- Q11 / Q12 신규 3개 카테고리: seed rows sortOrder 6/7/8 (Task 3 SQL)
- Q10-1B `EQUIPMENT` → `SPORTS_EQUIPMENT`: seed 시점에 이미 새 code 로 삽입, backfill CASE WHEN 으로 old `EQUIPMENT` → `SPORTS_EQUIPMENT` 매핑 (Task 3)
- Q12 `STAFF_RECRUITMENT` 는 `SCOUTING` 과 별개: 두 개가 함께 seed 됨. FE 카테고리 select 에서도 각각 별도 옵션 (Task 10 확인 스텝)
- Q13 이 세션은 plan 만: 코드/스키마 수정 없음. 이 파일이 유일 산출물.

**Migration safety:**
- 2-step split (Task 3 add / Task 12 cutover) 로 partial-state 위험 최소화
- Scratch DB 필수 검증 (Task 4, 12-Step 5)
- Migration B 앞부분에 방어적 assert (Task 12-Step 4) — backfill 스킵된 상태로 컷오버 시 명시적 에러
- 각 마이그레이션은 단일 `.sql` = 단일 트랜잭션

**Non-goals (Follow-up):**
- 카테고리 admin CRUD UI (`POST/PATCH/DELETE /expense-categories`)
- `label_en` / i18n label 테이블 (지금은 Korean `label` 단일 컬럼)
- 팀별 커스텀 카테고리 (`teamId` FK)
- 소프트 삭제 / archive vs isActive 정책 정리

**Follow-ups (별도 이슈):**
- Admin CRUD UI + audit log
- 다국어 label 컬럼 (`label_ko`, `label_en`, `label_ja`)
- `useExpenseCategories` 를 React Query / SWR 로 마이그레이션 (프로젝트가 채택한 경우)
- 카테고리 sortOrder 편집 UI (drag & drop)
