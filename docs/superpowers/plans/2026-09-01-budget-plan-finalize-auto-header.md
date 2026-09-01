# 편성 FINALIZED → BudgetHeader auto-gen 구현 plan

**Date:** 2026-09-01
**Status:** Ready-for-agent (grill Q1~Q8 완료)
**Origin issue:** #456 (critical)
**Related:** [ADR 0023](../../adr/0023-budget-plan-finalize-auto-budget-header.md)

## 목적

편성 워크플로우 확정 시점에 지출 통제 데이터 (`BudgetHeader`/`BudgetLine`) 자동 생성하여 편성 결과가 실제 지출 결재에 반영되도록. **하나의 backend 슬라이스** (Q8).

## 결정 사항 (grill 2026-09-01)

| # | 결정 |
|---|---|
| Q1 | 통합 전략: A — 편성 FINALIZED 훅으로 BudgetHeader/Line 자동 생성 |
| Q2 | 훅 발화: In-tx sync (finalize/gmApprove 트랜잭션 안) |
| Q3 | 재편성 시 기존 v1 → LOCKED, 새 v2 신규 생성 |
| Q4 | OperatingExpense.create 검증: seasonId+categoryId 전체 지출 (모든 version 합산) vs 최신 APPROVED header |
| Q5-B | BudgetLine.departmentId=null MVP (부서별 세분화는 별도 이슈) |
| Q6 | 마이그레이션: 신규 FINALIZED 전이만 적용 |
| Q7 | budget-automation.apply 유지 (planning tool) |
| Q8 | Backend 단일 슬라이스 |

## Scope

### 1. 신규 서비스 헬퍼

`apps/api/src/budget-plan/auto-header.ts` (신설):

```ts
export async function autoGenBudgetHeaderFromPlan(
  seasonId: number,
  actorUserId: number,
  tx: Prisma.TransactionClient,
): Promise<{ headerId: number; lineCount: number }> {
  // 1. FinancialReport + BudgetCategoryPlan[] fetch
  //    include: { budgetCategoryPlans: { include: { expenseCategory: true } } }
  // 2. Season 정보 (year, name)
  // 3. 기존 활성 APPROVED BudgetHeader 조회 → 있으면 status=LOCKED 로 전이
  // 4. max(version)+1 로 새 BudgetHeader.create
  //    - status=APPROVED, approvedById=actor, approvedAt=now
  //    - name: `${year} 시즌 편성 확정 v${version}`
  //    - totalBudget: Σ(originalAmount)
  // 5. 각 카테고리별 BudgetLine.createMany:
  //    - categoryId
  //    - originalAmount = mandatoryMinimum + (knapsackAllocated ?? 0)
  //    - departmentId: null (MVP)
  //    - year
  // 6. return { headerId, lineCount }
}
```

**Idempotency**: finalize / gmApprove 는 planStatus 전이가 이미 idempotent 하니 이 헬퍼는 매번 새 version 생성. 실수로 두 번 호출되면 v2, v3 등 다수 생성될 수 있음 — 이는 상위 호출 로직에서 방지.

### 2. plan-request.service.ts 편집

**finalize() (self-approval 아닌 경로)**:
```ts
await this.prisma.$transaction(async (tx) => {
  // 기존 로직: planStatus → FINALIZED
  await tx.financialReport.update({ ... });
  
  // 추가: BudgetHeader auto-gen
  await autoGenBudgetHeaderFromPlan(seasonId, actorUserId, tx);
});
// post-tx notify (기존)
```

**gmApprove() (self-approval 승인 경로)**:
동일 로직 삽입.

**rePlan() (재편성)**:
기존 로직은 planStatus 리셋만. BudgetHeader 는 아직 LOCK 안 함 (아직 확정 안 됐으므로).
- 사용자가 다시 finalize 하면 autoGenBudgetHeaderFromPlan 이 자동 v1 LOCK + v2 생성

### 3. OperatingExpense.create 검증 변경

`apps/api/src/operating-expense/operating-expense.repo.ts::createWithBudgetCheck` 재작성:

**기존**:
```ts
const { _sum } = await client.operatingExpense.aggregate({
  where: { budgetLineId: data.budgetLineId, deletedAt: null, status: {...} },
  _sum: { amount: true },
});
if (used + data.amount > line.originalAmount) throw new Error("BUDGET_EXCEEDED");
```

**신규**:
```ts
// budgetLineId 필터 제거 → seasonId+categoryId 로 전체 version 합산
const { _sum } = await client.operatingExpense.aggregate({
  where: { seasonId: data.seasonId, categoryId: data.categoryId, deletedAt: null, status: {...} },
  _sum: { amount: true },
});
// ceiling = 최신 APPROVED BudgetHeader 의 해당 category BudgetLine
const activeLine = await client.budgetLine.findFirst({
  where: {
    budgetHeader: { seasonId: data.seasonId, status: "APPROVED" },
    categoryId: data.categoryId,
  },
  orderBy: { budgetHeader: { version: "desc" } },
});
if (!activeLine) throw new Error("BUDGET_LINE_NOT_FOUND");
if (used + data.amount > activeLine.originalAmount) throw new Error("BUDGET_EXCEEDED");
```

- data.budgetLineId 는 그대로 저장 (호환)
- **주의**: `budgetLine.originalAmount` 는 v2 (신규) 값, `used` 는 v1+v2 전체 지출 → 오버스펜딩 방지 (Q4 결정)

### 4. update() 검증도 동일 규칙

`operating-expense.service.ts::update` 의 ceiling 검증 (`plan.mandatoryMinimum + knapsackAllocated`) 도 유지 (별도 소스 참조하지만 결과 동일).

### 5. 테스트

**auto-header.test.ts (신설)**:
- 첫 확정 → BudgetHeader v1 생성, line 카테고리 수만큼
- 재편성 후 재확정 → v1 LOCKED, v2 생성
- mandatoryMinimum=0 + knapsackAllocated=null 카테고리도 line 생성 (originalAmount=0)
- Category 없는 시즌 → 빈 header (edge)

**plan-request.finalize.test.ts 확장**:
- FINALIZED 전이 시 BudgetHeader 존재 검증
- gmApprove 경로도 동일

**operating-expense.create.test.ts 확장**:
- v1 이 없으면 여전히 BUDGET_LINE_NOT_FOUND (기존 매칭 로직 대체)
- v1 에서 300M, v2 확정 후 v2 originalAmount 500M 이면 200M 여유 (300 이미 지출 반영)

## Non-goals

- 부서별 BudgetLine 세분화 (별도 이슈)
- 기존 시즌 backfill (요구 발생 시 별도)
- FE 대시보드 신규 (기존 대시보드는 knapsackAllocated 기반, 데이터 정합 유지)
- `budget-automation.apply` disable (Q7)

## Acceptance

- [ ] `autoGenBudgetHeaderFromPlan` 헬퍼 신설
- [ ] `plan-request.service::finalize()` + `gmApprove()` in-tx 통합
- [ ] `operating-expense.repo::createWithBudgetCheck` 재작성
- [ ] 재편성 시 v1 → LOCKED 전이 로직
- [ ] Unit + integration 테스트 pass
- [ ] TS 0 new errors
- [ ] `docs/superpowers/plans/2026-09-01-budget-plan-finalize-auto-header.md` (이 문서) 참조

## Follow-up (별도 이슈)

- 부서별 BudgetLine 세분화 (BudgetPlanRequest.ownerType/ownerId → 분배)
- 기존 시즌 backfill 스크립트
- FE "편성 확정 예산 vs 실측 지출" 대시보드 뷰
