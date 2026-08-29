# OperatingExpense 결재 워크플로우 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `OperatingExpense`에 6-상태 결재 플로우(PENDING → FIRST_APPROVED → APPROVED → PAID / REJECTED / CANCELLED)를 추가하고, 금액 기준(100만원)으로 1단계·2단계 결재를 분기하며, BudgetLine 카테고리별 가용예산 트랜잭션 체크로 예산 통제를 실현한다.

**Architecture:** 기존 `OperatingExpense` 테이블에 `status`, `budgetLineId` 등 결재 관련 필드를 추가한다. Repository에서 `$transaction` 안에서 BudgetLine 잔액 재계산 + 레코드 생성을 원자적으로 처리한다. Service는 금액 임계값(1,000,000)으로 1단계/2단계를 분기하고, 각 전이마다 NotificationRepository로 알림을 발송한다.

**Tech Stack:** Prisma 5, Express, TypeScript, Jest (unit, mock repo)

---

## File Map

| 파일 | 변경 |
|------|------|
| `apps/api/prisma/schema.prisma` | `ExpenseStatus` enum 추가, `OperatingExpense` 필드 추가, `BudgetLine.category` String→enum, User named relations 추가, BudgetLine→OperatingExpense 역관계 추가 |
| `apps/api/prisma/migrations/<ts>_expense_approval/migration.sql` | auto-generated |
| `apps/api/src/notification/notification.repo.ts` | `createForFinanceStaff()` 추가 |
| `apps/api/src/operating-expense/operating-expense.repo.ts` | 전면 재작성 — BudgetLine 기반 잔액 체크, 결재 전이 메서드 |
| `apps/api/src/operating-expense/operating-expense.service.ts` | 전면 재작성 — 결재 플로우, 임계값 분기, 알림 |
| `apps/api/src/operating-expense/operating-expense.controller.ts` | 결재 액션 메서드 추가 |
| `apps/api/src/operating-expense/operating-expense.routes.ts` | 결재 엔드포인트 추가 |
| `apps/api/__test__/operating-expense/operating-expense.service.test.ts` | 신규 생성 |

---

## Task 1: Prisma Schema — ExpenseStatus enum + OperatingExpense 필드 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: ExpenseStatus enum 추가**

`schema.prisma`에서 `OverrideStatus` enum 아래에 추가:

```prisma
enum ExpenseStatus {
  PENDING
  FIRST_APPROVED
  APPROVED
  PAID
  REJECTED
  CANCELLED
}
```

- [ ] **Step 2: OperatingExpense 모델에 새 필드 추가**

기존 `accountCode AccountCode?` 관계 줄 바로 앞에 삽입:

```prisma
  status             ExpenseStatus     @default(PENDING)
  budgetLineId       Int
  firstApprovedById  Int?
  firstApprovedAt    DateTime?
  approvedById       Int?
  approvedAt         DateTime?
  rejectedById       Int?
  rejectedAt         DateTime?
  rejectionReason    String?
  cancelledById      Int?
  cancelledAt        DateTime?
  cancellationReason String?
```

그리고 관계 블록에 추가:

```prisma
  budgetLine         BudgetLine        @relation(fields: [budgetLineId], references: [id])
  firstApprovedBy    User?             @relation("OperatingExpenseFirstApprover", fields: [firstApprovedById], references: [id])
  approvedBy         User?             @relation("OperatingExpenseApprover", fields: [approvedById], references: [id])
  rejectedBy         User?             @relation("OperatingExpenseRejecter", fields: [rejectedById], references: [id])
  cancelledBy        User?             @relation("OperatingExpenseCanceller", fields: [cancelledById], references: [id])
```

- [ ] **Step 3: BudgetLine.category String → OperatingCategory enum**

`BudgetLine` 모델에서:
```prisma
// 변경 전
category       String

// 변경 후
category       OperatingCategory
```

그리고 역관계 추가:
```prisma
  operatingExpenses  OperatingExpense[]
```

- [ ] **Step 4: User 모델에 named relations 추가**

User 모델의 `paidExpenses` 줄 아래에 추가:

```prisma
  firstApprovedExpenses  OperatingExpense[] @relation("OperatingExpenseFirstApprover")
  approvedExpenses       OperatingExpense[] @relation("OperatingExpenseApprover")
  rejectedExpenses       OperatingExpense[] @relation("OperatingExpenseRejecter")
  cancelledExpenses      OperatingExpense[] @relation("OperatingExpenseCanceller")
```

- [ ] **Step 5: 마이그레이션 생성**

```bash
cd apps/api
npx prisma migrate dev --name expense_approval
```

마이그레이션 생성 직전에 Prisma가 `BudgetLine.category`의 기존 데이터 변환을 물어볼 경우, 생성된 migration.sql 파일을 열어 enum 타입 캐스팅 SQL이 포함되었는지 확인한다. 자동 생성이 안 될 경우 migration.sql에 수동으로 추가:

```sql
-- BudgetLine.category 기존 데이터 대문자 통일 후 enum 적용
UPDATE "BudgetLine" SET category = UPPER(category);
ALTER TABLE "BudgetLine" ALTER COLUMN category TYPE "OperatingCategory" USING category::"OperatingCategory";
-- OperatingExpense.status 기본값 세팅 (기존 행)
UPDATE "OperatingExpense" SET status = 'APPROVED'::"ExpenseStatus" WHERE "paidAt" IS NOT NULL;
UPDATE "OperatingExpense" SET status = 'PAID'::"ExpenseStatus" WHERE "paidAt" IS NOT NULL;
-- 기존 행은 budgetLineId가 없으므로 임시 nullable로 마이그레이션 후 NOT NULL 설정
-- (실제 환경에 데이터가 없다면 단순 ADD COLUMN으로 충분)
```

> 개발 환경에 실데이터가 없다면 `npx prisma migrate dev --name expense_approval` 단독 실행으로 충분하다.

- [ ] **Step 6: 타입 생성 확인**

```bash
npx prisma generate
```

`ExpenseStatus` enum이 `apps/api/src/generated/client/index.d.ts`에 나타나는지 확인.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(schema): add ExpenseStatus enum and approval fields to OperatingExpense"
```

---

## Task 2: NotificationRepository — createForFinanceStaff 추가

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`

- [ ] **Step 1: 테스트 작성 (없으므로 smoke check로 대체)**

`createForFinanceManager` 바로 아래에 추가:

```typescript
createForFinanceStaff(type: string, getMsg: MsgFactory, entityId?: number) {
  return this.createForWhere(
    { role: "FRONT_OFFICE", frontOfficeRole: { in: ["FINANCE_STAFF", "FINANCE_MANAGER"] }, isDeleted: false },
    type, getMsg, entityId
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/notification/notification.repo.ts
git commit -m "feat(notification): add createForFinanceStaff helper"
```

---

## Task 3: OperatingExpenseRepository 재작성

**Files:**
- Modify: `apps/api/src/operating-expense/operating-expense.repo.ts`

- [ ] **Step 1: 테스트 작성 (failing)**

`apps/api/__test__/operating-expense/` 디렉토리를 만들고 `operating-expense.service.test.ts`는 Task 7에서 작성한다. Repository는 Prisma 직접 의존이라 서비스 레이어 테스트로 간접 커버.

- [ ] **Step 2: 전체 파일 교체**

```typescript
import { PrismaClient, OperatingCategory, ExpenseStatus, Prisma } from "../generated/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export class OperatingExpenseRepository {
  constructor(private prisma: PrismaClient) {}

  findBySeasonId(seasonId: number) {
    return this.prisma.operatingExpense.findMany({
      where: { seasonId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, username: true } },
        budgetLine: { select: { id: true, category: true, originalAmount: true } },
      },
      orderBy: { date: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.operatingExpense.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, username: true } },
        budgetLine: { select: { id: true, category: true, originalAmount: true, budgetHeaderId: true } },
      },
    });
  }

  findBudgetLine(budgetLineId: number) {
    return this.prisma.budgetLine.findUnique({ where: { id: budgetLineId } });
  }

  // PENDING + FIRST_APPROVED + APPROVED = commitment (잠금 금액)
  // PAID = actual (집행 완료)
  // 두 합산을 합쳐 사용 중 금액 계산
  async sumUsedByBudgetLine(budgetLineId: number, tx?: Tx): Promise<number> {
    const client = tx ?? this.prisma;
    const result = await (client as PrismaClient).operatingExpense.aggregate({
      where: {
        budgetLineId,
        deletedAt: null,
        status: { in: ["PENDING", "FIRST_APPROVED", "APPROVED", "PAID"] },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  async createWithBudgetCheck(data: {
    seasonId: number;
    category: OperatingCategory;
    amount: number;
    date: Date;
    note?: string | null;
    createdById: number;
    budgetLineId: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.budgetLine.findUnique({ where: { id: data.budgetLineId } });
      if (!line) throw new Error("BUDGET_LINE_NOT_FOUND");
      if (line.category !== data.category) throw new Error("CATEGORY_MISMATCH");

      const used = await (this.sumUsedByBudgetLine as any)(data.budgetLineId, tx);
      if (used + data.amount > line.originalAmount) throw new Error("BUDGET_EXCEEDED");

      return tx.operatingExpense.create({
        data: {
          seasonId: data.seasonId,
          category: data.category,
          amount: data.amount,
          date: data.date,
          note: data.note ?? null,
          createdById: data.createdById,
          budgetLineId: data.budgetLineId,
          status: "PENDING",
        },
        include: {
          createdBy: { select: { id: true, username: true } },
          budgetLine: { select: { id: true, category: true, originalAmount: true } },
        },
      });
    });
  }

  updateStatus(
    id: number,
    data: Partial<{
      status: ExpenseStatus;
      firstApprovedById: number;
      firstApprovedAt: Date;
      approvedById: number;
      approvedAt: Date;
      rejectedById: number;
      rejectedAt: Date;
      rejectionReason: string;
      cancelledById: number;
      cancelledAt: Date;
      cancellationReason: string;
      paidAt: Date;
      paidById: number;
    }>
  ) {
    return this.prisma.operatingExpense.update({ where: { id }, data });
  }

  softDelete(id: number, reason: string) {
    return this.prisma.operatingExpense.update({
      where: { id },
      data: { deletedAt: new Date(), deletionReason: reason },
    });
  }

  purgeExpired() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 10);
    return this.prisma.operatingExpense.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
  }
}
```

> `sumUsedByBudgetLine`을 트랜잭션 내부에서 호출하려면 `tx` 인스턴스를 직접 `aggregate`에 넘긴다. 위 코드에서 `createWithBudgetCheck` 안의 합산은 `tx.operatingExpense.aggregate`로 인라인 처리한다(아래 수정 참고).

**`createWithBudgetCheck` 내부 합산 인라인 수정:**

```typescript
const { _sum } = await tx.operatingExpense.aggregate({
  where: {
    budgetLineId: data.budgetLineId,
    deletedAt: null,
    status: { in: ["PENDING", "FIRST_APPROVED", "APPROVED", "PAID"] },
  },
  _sum: { amount: true },
});
const used = _sum.amount ?? 0;
if (used + data.amount > line.originalAmount) throw new Error("BUDGET_EXCEEDED");
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/operating-expense/operating-expense.repo.ts
git commit -m "feat(operating-expense): rewrite repo with BudgetLine-based budget check"
```

---

## Task 4: OperatingExpenseService — 상수 + create()

**Files:**
- Modify: `apps/api/src/operating-expense/operating-expense.service.ts`

- [ ] **Step 1: 파일 상단 상수 + import 정의**

```typescript
import { AppError } from "../lib/appError";
import { OperatingExpenseRepository } from "./operating-expense.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { OperatingCategory } from "../generated/client";
import { canReadFinance, canWriteFinance } from "../lib/permissions";

export const APPROVAL_THRESHOLD = 1_000_000;
```

- [ ] **Step 2: 테스트 작성 (Task 7보다 먼저 — create 테스트만)**

`apps/api/__test__/operating-expense/operating-expense.service.test.ts` 생성:

```typescript
import { OperatingExpenseService, APPROVAL_THRESHOLD } from "../../src/operating-expense/operating-expense.service";
import { AppError } from "../../src/lib/appError";
import type { OperatingExpenseRepository } from "../../src/operating-expense/operating-expense.repo";
import type { NotificationRepository } from "../../src/notification/notification.repo";

const makeLine = (overrides = {}) => ({
  id: 1, budgetHeaderId: 1, departmentId: null, category: "TRAVEL",
  year: 2026, month: null, originalAmount: 5_000_000,
  note: null, createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
});

const makeExpense = (overrides = {}) => ({
  id: 1, seasonId: 1, category: "TRAVEL" as const, amount: 300_000,
  date: new Date(), note: null, createdById: 10,
  status: "PENDING" as const, budgetLineId: 1,
  firstApprovedById: null, firstApprovedAt: null,
  approvedById: null, approvedAt: null,
  rejectedById: null, rejectedAt: null, rejectionReason: null,
  cancelledById: null, cancelledAt: null, cancellationReason: null,
  paidAt: null, paidById: null,
  deletedAt: null, deletionReason: null, accountCodeId: null,
  createdAt: new Date(), updatedAt: new Date(),
  createdBy: { id: 10, username: "staff" },
  budgetLine: { id: 1, category: "TRAVEL", originalAmount: 5_000_000 },
  ...overrides,
});

const makeRepo = (overrides: Partial<OperatingExpenseRepository> = {}): OperatingExpenseRepository => ({
  findBySeasonId: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(null),
  findBudgetLine: jest.fn().mockResolvedValue(makeLine()),
  sumUsedByBudgetLine: jest.fn().mockResolvedValue(0),
  createWithBudgetCheck: jest.fn().mockResolvedValue(makeExpense()),
  updateStatus: jest.fn().mockResolvedValue(makeExpense()),
  softDelete: jest.fn().mockResolvedValue({}),
  purgeExpired: jest.fn().mockResolvedValue({}),
  ...overrides,
} as unknown as OperatingExpenseRepository);

const makeNotifRepo = (): NotificationRepository => ({
  createForFinanceStaff: jest.fn().mockResolvedValue(undefined),
  createForFinanceManager: jest.fn().mockResolvedValue(undefined),
  createForUser: jest.fn().mockResolvedValue(undefined),
} as unknown as NotificationRepository);

const makeService = (repo = makeRepo(), notif = makeNotifRepo()) =>
  new OperatingExpenseService(repo, notif);

describe("OperatingExpenseService.create", () => {
  const baseInput = {
    seasonId: 1, category: "TRAVEL" as const, amount: 300_000,
    date: "2026-08-22", note: undefined, createdById: 10, budgetLineId: 1,
  };

  it("throws 400 when amount <= 0", async () => {
    await expect(makeService().create({ ...baseInput, amount: 0 }))
      .rejects.toThrow(new AppError(400, "INVALID_AMOUNT"));
  });

  it("throws 404 when BudgetLine not found", async () => {
    const repo = makeRepo({ findBudgetLine: jest.fn().mockResolvedValue(null) });
    await expect(makeService(repo).create(baseInput))
      .rejects.toThrow(new AppError(404, "BUDGET_LINE_NOT_FOUND"));
  });

  it("throws 409 when repo raises BUDGET_EXCEEDED", async () => {
    const repo = makeRepo({
      createWithBudgetCheck: jest.fn().mockRejectedValue(new Error("BUDGET_EXCEEDED")),
    });
    await expect(makeService(repo).create(baseInput))
      .rejects.toThrow(new AppError(409, "BUDGET_EXCEEDED"));
  });

  it("returns expense and notifies FINANCE_STAFF on success", async () => {
    const notif = makeNotifRepo();
    const result = await makeService(makeRepo(), notif).create(baseInput);
    expect(result.status).toBe("PENDING");
    expect(notif.createForFinanceStaff).toHaveBeenCalledWith(
      "EXPENSE_PENDING", expect.any(Function), 1
    );
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd apps/api
npx jest __test__/operating-expense/operating-expense.service.test.ts --no-coverage
```

Expected: FAIL (OperatingExpenseService 시그니처 변경 전)

- [ ] **Step 4: Service create() 구현**

```typescript
export class OperatingExpenseService {
  constructor(
    private repo: OperatingExpenseRepository,
    private notifRepo: NotificationRepository,
  ) {}

  list(seasonId: number) {
    return this.repo.findBySeasonId(seasonId);
  }

  async create(data: {
    seasonId: number;
    category: OperatingCategory;
    amount: number;
    date: string;
    note?: string;
    createdById: number;
    budgetLineId: number;
  }) {
    if (data.amount <= 0) throw new AppError(400, "INVALID_AMOUNT");

    const line = await this.repo.findBudgetLine(data.budgetLineId);
    if (!line) throw new AppError(404, "BUDGET_LINE_NOT_FOUND");

    let expense;
    try {
      expense = await this.repo.createWithBudgetCheck({
        ...data,
        date: new Date(data.date),
        note: data.note ?? null,
      });
    } catch (err: any) {
      if (err.message === "BUDGET_EXCEEDED") throw new AppError(409, "BUDGET_EXCEEDED");
      if (err.message === "CATEGORY_MISMATCH") throw new AppError(400, "CATEGORY_MISMATCH");
      if (err.message === "BUDGET_LINE_NOT_FOUND") throw new AppError(404, "BUDGET_LINE_NOT_FOUND");
      throw err;
    }

    await this.notifRepo.createForFinanceStaff(
      "EXPENSE_PENDING",
      (lang) => ({
        title: lang === "en" ? "New Expense Request" : "지출 기안 접수",
        body: lang === "en"
          ? `₩${expense.amount.toLocaleString()} ${expense.category} expense pending approval.`
          : `₩${expense.amount.toLocaleString()} ${expense.category} 지출 기안이 결재 대기 중입니다.`,
      }),
      expense.id,
    );

    return expense;
  }
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest __test__/operating-expense/operating-expense.service.test.ts --no-coverage
```

Expected: PASS (describe "create" 4개)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/operating-expense/operating-expense.service.ts \
        apps/api/__test__/operating-expense/operating-expense.service.test.ts
git commit -m "feat(operating-expense): add create() with BudgetLine budget check and PENDING status"
```

---

## Task 5: Service — 결재 전이 메서드

**Files:**
- Modify: `apps/api/src/operating-expense/operating-expense.service.ts`
- Modify: `apps/api/__test__/operating-expense/operating-expense.service.test.ts`

- [ ] **Step 1: firstApprove() 테스트 추가**

```typescript
describe("OperatingExpenseService.firstApprove", () => {
  it("throws 404 when expense not found", async () => {
    await expect(makeService().firstApprove(99, 5, "FRONT_OFFICE", "FINANCE_STAFF"))
      .rejects.toThrow(new AppError(404, "NOT_FOUND"));
  });

  it("throws 400 when status is not PENDING", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeExpense({ status: "APPROVED" })) });
    await expect(makeService(repo).firstApprove(1, 5, "FRONT_OFFICE", "FINANCE_STAFF"))
      .rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });

  it("throws 400 when amount < threshold (should use approve directly)", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ amount: 500_000 })),
    });
    await expect(makeService(repo).firstApprove(1, 5, "FRONT_OFFICE", "FINANCE_STAFF"))
      .rejects.toThrow(new AppError(400, "USE_SINGLE_STAGE_APPROVE"));
  });

  it("throws 403 when self-approval attempted", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ amount: 2_000_000, createdById: 5 })),
    });
    await expect(makeService(repo).firstApprove(1, 5, "FRONT_OFFICE", "FINANCE_STAFF"))
      .rejects.toThrow(new AppError(403, "SELF_APPROVAL_FORBIDDEN"));
  });

  it("transitions to FIRST_APPROVED and notifies FINANCE_MANAGER", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ amount: 2_000_000, createdById: 10 })),
      updateStatus: jest.fn().mockResolvedValue(makeExpense({ status: "FIRST_APPROVED", amount: 2_000_000 })),
    });
    const result = await makeService(repo, notif).firstApprove(1, 5, "FRONT_OFFICE", "FINANCE_STAFF");
    expect(result.status).toBe("FIRST_APPROVED");
    expect(notif.createForFinanceManager).toHaveBeenCalledWith(
      "EXPENSE_FIRST_APPROVED", expect.any(Function), 1
    );
  });
});

describe("OperatingExpenseService.approve", () => {
  it("throws 403 when < threshold and approver is not FINANCE_STAFF level", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ amount: 500_000, status: "PENDING" })),
    });
    await expect(makeService(repo).approve(1, 5, "PLAYER", null))
      .rejects.toThrow(new AppError(403, "FORBIDDEN"));
  });

  it("1-stage: PENDING → APPROVED when amount < threshold and FINANCE_STAFF approves", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ amount: 500_000, createdById: 10, status: "PENDING" })),
      updateStatus: jest.fn().mockResolvedValue(makeExpense({ status: "APPROVED", amount: 500_000 })),
    });
    const result = await makeService(repo, notif).approve(1, 5, "FRONT_OFFICE", "FINANCE_STAFF");
    expect(result.status).toBe("APPROVED");
    expect(notif.createForUser).toHaveBeenCalledWith(10, "EXPENSE_APPROVED", expect.any(Function), 1);
  });

  it("2-stage: requires FIRST_APPROVED status when amount >= threshold", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ amount: 2_000_000, status: "PENDING" })),
    });
    await expect(makeService(repo).approve(1, 5, "FRONT_OFFICE", "FINANCE_MANAGER"))
      .rejects.toThrow(new AppError(400, "REQUIRES_FIRST_APPROVAL"));
  });

  it("2-stage: FIRST_APPROVED → APPROVED when FINANCE_MANAGER approves", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ amount: 2_000_000, createdById: 10, status: "FIRST_APPROVED" })),
      updateStatus: jest.fn().mockResolvedValue(makeExpense({ status: "APPROVED", amount: 2_000_000 })),
    });
    const result = await makeService(repo, notif).approve(1, 5, "FRONT_OFFICE", "FINANCE_MANAGER");
    expect(result.status).toBe("APPROVED");
    expect(notif.createForUser).toHaveBeenCalledWith(10, "EXPENSE_APPROVED", expect.any(Function), 1);
  });

  it("throws 403 when 2-stage and approver is not FINANCE_MANAGER", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ amount: 2_000_000, status: "FIRST_APPROVED" })),
    });
    await expect(makeService(repo).approve(1, 5, "FRONT_OFFICE", "FINANCE_STAFF"))
      .rejects.toThrow(new AppError(403, "FORBIDDEN"));
  });

  it("throws 403 on self-approval", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ amount: 500_000, createdById: 5, status: "PENDING" })),
    });
    await expect(makeService(repo).approve(1, 5, "FRONT_OFFICE", "FINANCE_STAFF"))
      .rejects.toThrow(new AppError(403, "SELF_APPROVAL_FORBIDDEN"));
  });
});

describe("OperatingExpenseService.reject", () => {
  it("throws 400 when status is not PENDING or FIRST_APPROVED", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeExpense({ status: "APPROVED" })) });
    await expect(makeService(repo).reject(1, 5, "거부 사유", "FRONT_OFFICE", "FINANCE_STAFF"))
      .rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });

  it("transitions to REJECTED and notifies creator", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ status: "PENDING", createdById: 10 })),
      updateStatus: jest.fn().mockResolvedValue(makeExpense({ status: "REJECTED" })),
    });
    await makeService(repo, notif).reject(1, 5, "예산 부족", "FRONT_OFFICE", "FINANCE_STAFF");
    expect(notif.createForUser).toHaveBeenCalledWith(10, "EXPENSE_REJECTED", expect.any(Function), 1);
  });
});

describe("OperatingExpenseService.cancel", () => {
  it("throws 400 when status is not APPROVED", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeExpense({ status: "PENDING" })) });
    await expect(makeService(repo).cancel(1, 10, "취소 사유", "FRONT_OFFICE", "FINANCE_STAFF"))
      .rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });

  it("throws 403 when not creator and not FINANCE_MANAGER", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeExpense({ status: "APPROVED", createdById: 10 })) });
    await expect(makeService(repo).cancel(1, 99, "취소", "FRONT_OFFICE", "FINANCE_STAFF"))
      .rejects.toThrow(new AppError(403, "FORBIDDEN"));
  });

  it("creator can cancel own APPROVED expense", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ status: "APPROVED", createdById: 10 })),
      updateStatus: jest.fn().mockResolvedValue(makeExpense({ status: "CANCELLED" })),
    });
    await makeService(repo, notif).cancel(1, 10, "취소 사유", "FRONT_OFFICE", "FINANCE_STAFF");
    expect(notif.createForUser).toHaveBeenCalledWith(10, "EXPENSE_CANCELLED", expect.any(Function), 1);
  });
});

describe("OperatingExpenseService.markPaid", () => {
  it("throws 400 when status is not APPROVED", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeExpense({ status: "PENDING" })) });
    await expect(makeService(repo).markPaid(1, 5))
      .rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });

  it("transitions to PAID and notifies creator", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeExpense({ status: "APPROVED", createdById: 10 })),
      updateStatus: jest.fn().mockResolvedValue(makeExpense({ status: "PAID" })),
    });
    await makeService(repo, notif).markPaid(1, 5);
    expect(notif.createForUser).toHaveBeenCalledWith(10, "EXPENSE_PAID", expect.any(Function), 1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx jest __test__/operating-expense/operating-expense.service.test.ts --no-coverage
```

Expected: FAIL (메서드 없음)

- [ ] **Step 3: 결재 전이 메서드 구현 (service.ts에 추가)**

```typescript
  async firstApprove(id: number, approverId: number, role: string, foRole: string | null | undefined) {
    if (!canReadFinance(role, foRole)) throw new AppError(403, "FORBIDDEN");
    const expense = await this.repo.findById(id);
    if (!expense || expense.deletedAt) throw new AppError(404, "NOT_FOUND");
    if (expense.status !== "PENDING") throw new AppError(400, "INVALID_STATUS");
    if (expense.amount < APPROVAL_THRESHOLD) throw new AppError(400, "USE_SINGLE_STAGE_APPROVE");
    if (expense.createdById === approverId) throw new AppError(403, "SELF_APPROVAL_FORBIDDEN");

    const updated = await this.repo.updateStatus(id, {
      status: "FIRST_APPROVED",
      firstApprovedById: approverId,
      firstApprovedAt: new Date(),
    });

    await this.notifRepo.createForFinanceManager(
      "EXPENSE_FIRST_APPROVED",
      (lang) => ({
        title: lang === "en" ? "Expense Awaiting Final Approval" : "지출 기안 최종 결재 대기",
        body: lang === "en"
          ? `₩${expense.amount.toLocaleString()} ${expense.category} expense requires your approval.`
          : `₩${expense.amount.toLocaleString()} ${expense.category} 기안이 최종 결재를 기다립니다.`,
      }),
      expense.id,
    );
    return updated;
  }

  async approve(id: number, approverId: number, role: string, foRole: string | null | undefined) {
    const expense = await this.repo.findById(id);
    if (!expense || expense.deletedAt) throw new AppError(404, "NOT_FOUND");

    if (expense.amount < APPROVAL_THRESHOLD) {
      // 1단계: FINANCE_STAFF 이상, PENDING 상태
      if (!canReadFinance(role, foRole)) throw new AppError(403, "FORBIDDEN");
      if (expense.status !== "PENDING") throw new AppError(400, "INVALID_STATUS");
    } else {
      // 2단계: FINANCE_MANAGER만, FIRST_APPROVED 상태
      if (!canWriteFinance(role, foRole)) throw new AppError(403, "FORBIDDEN");
      if (expense.status !== "FIRST_APPROVED") throw new AppError(400, "REQUIRES_FIRST_APPROVAL");
    }

    if (expense.createdById === approverId) throw new AppError(403, "SELF_APPROVAL_FORBIDDEN");

    const updated = await this.repo.updateStatus(id, {
      status: "APPROVED",
      approvedById: approverId,
      approvedAt: new Date(),
    });

    await this.notifRepo.createForUser(
      expense.createdById,
      "EXPENSE_APPROVED",
      (lang) => ({
        title: lang === "en" ? "Expense Approved" : "지출 기안 승인",
        body: lang === "en"
          ? `Your ₩${expense.amount.toLocaleString()} ${expense.category} expense has been approved.`
          : `₩${expense.amount.toLocaleString()} ${expense.category} 지출 기안이 승인됐습니다.`,
      }),
      expense.id,
    );
    return updated;
  }

  async reject(id: number, rejectorId: number, reason: string, role: string, foRole: string | null | undefined) {
    if (!canReadFinance(role, foRole)) throw new AppError(403, "FORBIDDEN");
    const expense = await this.repo.findById(id);
    if (!expense || expense.deletedAt) throw new AppError(404, "NOT_FOUND");
    if (!["PENDING", "FIRST_APPROVED"].includes(expense.status)) throw new AppError(400, "INVALID_STATUS");

    const updated = await this.repo.updateStatus(id, {
      status: "REJECTED",
      rejectedById: rejectorId,
      rejectedAt: new Date(),
      rejectionReason: reason,
    });

    await this.notifRepo.createForUser(
      expense.createdById,
      "EXPENSE_REJECTED",
      (lang) => ({
        title: lang === "en" ? "Expense Rejected" : "지출 기안 반려",
        body: lang === "en"
          ? `Your expense was rejected: ${reason}`
          : `지출 기안이 반려됐습니다: ${reason}`,
      }),
      expense.id,
    );
    return updated;
  }

  async cancel(id: number, cancellerId: number, reason: string, role: string, foRole: string | null | undefined) {
    const expense = await this.repo.findById(id);
    if (!expense || expense.deletedAt) throw new AppError(404, "NOT_FOUND");
    if (expense.status !== "APPROVED") throw new AppError(400, "INVALID_STATUS");

    const isSelf = expense.createdById === cancellerId;
    const isManager = canWriteFinance(role, foRole);
    if (!isSelf && !isManager) throw new AppError(403, "FORBIDDEN");

    const updated = await this.repo.updateStatus(id, {
      status: "CANCELLED",
      cancelledById: cancellerId,
      cancelledAt: new Date(),
      cancellationReason: reason,
    });

    await this.notifRepo.createForUser(
      expense.createdById,
      "EXPENSE_CANCELLED",
      (lang) => ({
        title: lang === "en" ? "Expense Cancelled" : "지출 기안 취소",
        body: lang === "en"
          ? `Expense of ₩${expense.amount.toLocaleString()} has been cancelled.`
          : `₩${expense.amount.toLocaleString()} 지출 기안이 취소됐습니다.`,
      }),
      expense.id,
    );
    return updated;
  }

  async markPaid(id: number, paidById: number) {
    const expense = await this.repo.findById(id);
    if (!expense || expense.deletedAt) throw new AppError(404, "NOT_FOUND");
    if (expense.status !== "APPROVED") throw new AppError(400, "INVALID_STATUS");

    const updated = await this.repo.updateStatus(id, {
      status: "PAID",
      paidAt: new Date(),
      paidById,
    });

    await this.notifRepo.createForUser(
      expense.createdById,
      "EXPENSE_PAID",
      (lang) => ({
        title: lang === "en" ? "Expense Paid" : "지출 지급 완료",
        body: lang === "en"
          ? `₩${expense.amount.toLocaleString()} ${expense.category} expense has been paid.`
          : `₩${expense.amount.toLocaleString()} ${expense.category} 지출이 지급됐습니다.`,
      }),
      expense.id,
    );
    return updated;
  }

  async delete(id: number, requesterId: number, requesterRole: string, reason: string) {
    const expense = await this.repo.findById(id);
    if (!expense) throw new AppError(404, "NOT_FOUND");
    if (expense.deletedAt) throw new AppError(404, "NOT_FOUND");
    if (expense.status !== "PENDING") throw new AppError(400, "ONLY_PENDING_DELETABLE");
    if (expense.createdById !== requesterId && requesterRole !== "ADMIN") throw new AppError(403, "FORBIDDEN");
    return this.repo.softDelete(id, reason);
  }

  purgeExpired() {
    return this.repo.purgeExpired();
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest __test__/operating-expense/operating-expense.service.test.ts --no-coverage
```

Expected: PASS (전체)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/operating-expense/operating-expense.service.ts \
        apps/api/__test__/operating-expense/operating-expense.service.test.ts
git commit -m "feat(operating-expense): add approval flow (firstApprove/approve/reject/cancel/markPaid)"
```

---

## Task 6: Controller + Routes

**Files:**
- Modify: `apps/api/src/operating-expense/operating-expense.controller.ts`
- Modify: `apps/api/src/operating-expense/operating-expense.routes.ts`

- [ ] **Step 1: Controller에 결재 액션 메서드 추가**

기존 `delete` 메서드 아래에 추가:

```typescript
  firstApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: approverId } = requireUser(req);
      const id = Number(req.params["id"]);
      const result = await this.service.firstApprove(id, approverId, role, frontOfficeRole);
      res.json(result);
    } catch (err) { next(err); }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: approverId } = requireUser(req);
      const id = Number(req.params["id"]);
      const result = await this.service.approve(id, approverId, role, frontOfficeRole);
      res.json(result);
    } catch (err) { next(err); }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: rejectorId } = requireUser(req);
      const id = Number(req.params["id"]);
      const { reason } = req.body as { reason?: string };
      if (!reason?.trim()) throw new AppError(400, "REJECTION_REASON_REQUIRED");
      const result = await this.service.reject(id, rejectorId, reason.trim(), role, frontOfficeRole);
      res.json(result);
    } catch (err) { next(err); }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: cancellerId } = requireUser(req);
      const id = Number(req.params["id"]);
      const { reason } = req.body as { reason?: string };
      if (!reason?.trim()) throw new AppError(400, "CANCELLATION_REASON_REQUIRED");
      const result = await this.service.cancel(id, cancellerId, reason.trim(), role, frontOfficeRole);
      res.json(result);
    } catch (err) { next(err); }
  };
```

- [ ] **Step 2: Routes 업데이트**

`operating-expense.routes.ts`의 `router.patch("/:id/pay", ...)` 아래에 추가:

```typescript
router.post("/:id/first-approve", auth, controller.firstApprove);
router.post("/:id/approve", auth, controller.approve);
router.post("/:id/reject", auth, controller.reject);
router.post("/:id/cancel", auth, controller.cancel);
```

기존 `router.post("/", auth, controller.create)` 호출 시그니처도 `budgetLineId`를 body에서 받도록 controller.create 내부 구조 분해에 추가:

```typescript
// controller.create body 구조분해에 추가
const { seasonId, category, amount, date, note, budgetLineId } = req.body as {
  seasonId: number;
  category: OperatingCategory;
  amount: number;
  date: string;
  note?: string;
  budgetLineId: number;
};
// service 호출 변경
const expense = await this.service.create({
  seasonId, category, amount, date, budgetLineId,
  ...(note !== undefined && { note }),
  createdById: userId,
});
```

> `overrideReason` 파라미터는 BudgetLine 기반 체크로 전환되어 더 이상 사용되지 않으므로 제거.

- [ ] **Step 3: Service 생성자 Routes에서 업데이트**

`operating-expense.routes.ts` 상단 서비스 초기화:

```typescript
import { NotificationRepository } from "../notification/notification.repo";

const repo = new OperatingExpenseRepository(getPrisma());
const notifRepo = new NotificationRepository(getPrisma());
const service = new OperatingExpenseService(repo, notifRepo);
```

- [ ] **Step 4: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/operating-expense/
git commit -m "feat(operating-expense): add approval action endpoints (first-approve/approve/reject/cancel)"
```

---

## Task 7: 전체 테스트 통과 + 기존 테스트 회귀 검사

**Files:**
- Check: `apps/api/__test__/`

- [ ] **Step 1: 전체 테스트 실행**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: 기존 테스트 포함 전체 통과. 실패가 있으면 에러 메시지를 읽고 수정.

- [ ] **Step 2: budget-control 테스트 확인 (회귀)**

`sumCommitmentAndActual`이 제거됐으므로 budget-control 테스트에서 해당 메서드를 참조하는 코드가 있으면 제거:

```bash
npx jest __test__/budget-control/ --no-coverage
```

Expected: PASS

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "test(operating-expense): full approval flow test suite passing"
```

---

## Self-Review

### Spec Coverage

| 요구사항 | 커버 Task |
|----------|-----------|
| ExpenseStatus 6개 상태 | Task 1 |
| budgetLineId NOT NULL | Task 1 |
| BudgetLine.category String→enum (F6) | Task 1 |
| User named relations | Task 1 |
| createForFinanceStaff | Task 2 |
| BudgetLine 기반 가용예산 체크 | Task 3 |
| $transaction 동시성 보호 | Task 3 |
| APPROVAL_THRESHOLD 상수 | Task 4 |
| create() PENDING + 알림 | Task 4 |
| firstApprove() 셀프승인 금지 | Task 5 |
| approve() 1단계/2단계 분기 | Task 5 |
| reject() PENDING/FIRST_APPROVED에서 | Task 5 |
| cancel() APPROVED에서, 기안자/MANAGER | Task 5 |
| markPaid() APPROVED 상태 검증 | Task 5 |
| 알림 6개 전이 전체 | Task 4, 5 |
| 엔드포인트 4개 추가 | Task 6 |
| budgetLineId body 파라미터 | Task 6 |
| 회귀 테스트 | Task 7 |

### Placeholder 없음 ✓
### 타입 일관성 ✓ (`ExpenseStatus`, `OperatingCategory` — Task 1 enum 기준으로 이후 모든 Task 참조)
