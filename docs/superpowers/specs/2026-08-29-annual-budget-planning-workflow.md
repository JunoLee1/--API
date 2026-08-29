# 연간 재무 계획 편성 워크플로우 구현 PRD

**Date:** 2026-08-29
**Status:** Draft (from grill session 2026-08-29)
**Related ADRs:** [0011](../../adr/0011-knapsack-operating-budget-allocation.md), [0019](../../adr/0019-trigger-tier-promotion-rules.md), [0020](../../adr/0020-trigger-multiplier-values.md)
**Related Spec:** [2026-08-20 finance-budget-persona-painpoints](2026-08-20-finance-budget-persona-painpoints.md)

## Summary

기존 Knapsack 알고리즘 ([ADR 0011](../../adr/0011-knapsack-operating-budget-allocation.md)) 을 감싸는 **입력 수집 프로토콜**을 구현. `closeSeason()` 훅에서 자동 시작 → 팀장·부서장 2주 심사 신청 → 자동 티어 승격 → Knapsack 실행 → FM/GM 승인 → 확정 → 집행. 상태 머신 7단계.

## Motivation

- 기존 `BudgetCategoryPlan.tiers` 필드에 (cost, value) 를 채우는 로직 없음 (스키마는 있음)
- Persona painpoint 스펙 C1 "BudgetHeader ↔ FinancialReport 단절" 해소
- 팀장/부서장 인풋을 객관적 트리거 형태로 수집 → GM 신뢰 유지

## Scope

**포함**
- `closeSeason()` 훅 확장: 다음 시즌 Draft 자동 생성
- 신규 스키마 (BudgetPlanRequest, BudgetPlanRequestLine, PlanStatus, TriggerType)
- `ExpenseCategory.scope` 추가 (TEAM / DEPARTMENT)
- `FinancialReport.planStatus` 추가
- 티어 승격 로직 ([ADR 0019](../../adr/0019-trigger-tier-promotion-rules.md))
- Value 계산 로직 ([ADR 0020](../../adr/0020-trigger-multiplier-values.md))
- Capacity 실패 캐스케이드 (CONSERVATIVE 재계산 → GM alert)
- 재편성 API (이벤트 트리거)
- Self-approval → GM escalate
- 확정 후 이의 신청 (`BudgetOverrideLog` 편성 컨텍스트로 확장)
- 2주 심사 창 알림 (D-7 / D-3 / D-1)

**미포함 (별도 issue)**
- `BudgetPlanPage` UI 대개편 (별도: [[BudgetPlanPage UX Overhaul]])
- Persona painpoint C2 (BudgetOverrideLog status 확장) — 이 스펙에서 기존 필드만 사용
- Persona painpoint C3 (외부 수입 수동 입력 이력)
- 훈련 예산 · 선수 급여 예산 (별도 도메인)

## Schema Changes

### 신규 Enum

```prisma
enum CategoryScope {
  TEAM
  DEPARTMENT
}

enum PlanStatus {
  DRAFT
  CAPACITY_FAILED
  AWAITING_REVIEW
  KNAPSACK_EXECUTED
  AWAITING_GM_APPROVAL
  FINALIZED
  RE_PLANNING
}

enum TriggerType {
  MULTI_LOCATION      // 다중거점 관리 (가중)
  DIRECT_BUSINESS     // 사업 직접비 (가중)
  PUBLIC_UTILITY      // 공공요금 (가중)
  HOME_MATCH          // 홈경기 현장지원 (가산)
  WEEKEND_OVERTIME    // 주말 야근 가산 (가산)
}

enum BudgetPlanRequestStatus {
  DRAFT
  SUBMITTED
  PROCESSED
}
```

### 기존 모델 필드 추가

```prisma
model ExpenseCategory {
  // ... 기존 필드
  scope         CategoryScope  @default(DEPARTMENT)
}

model FinancialReport {
  // ... 기존 필드
  planStatus              PlanStatus  @default(DRAFT)
  planStatusChangedAt     DateTime?
  planStatusChangedById   Int?
  reviewOpenedAt          DateTime?    // AWAITING_REVIEW 진입 시점 (D-0)
  reviewDeadline          DateTime?    // reviewOpenedAt + 14 days
  knapsackExecutedAt      DateTime?
  finalizedAt             DateTime?
  planStatusChangedBy     User?        @relation("PlanStatusChanger", fields: [planStatusChangedById], references: [id])
}
```

### 신규 모델

```prisma
model BudgetPlanRequest {
  id                Int                      @id @default(autoincrement())
  financialReportId Int
  requestedById     Int                       // Team.leader or Department.head
  scope             CategoryScope             // TEAM | DEPARTMENT
  ownerType         String                    // "TEAM" or "DEPARTMENT" (denormalized for query)
  ownerId           Int                       // Team.id or Department.id
  status            BudgetPlanRequestStatus   @default(DRAFT)
  submittedAt       DateTime?
  processedAt       DateTime?
  createdAt         DateTime                  @default(now())
  updatedAt         DateTime                  @updatedAt

  financialReport   FinancialReport           @relation(fields: [financialReportId], references: [id], onDelete: Cascade)
  requestedBy       User                      @relation("BudgetPlanRequester", fields: [requestedById], references: [id])
  lines             BudgetPlanRequestLine[]

  @@unique([financialReportId, ownerType, ownerId])
}

model BudgetPlanRequestLine {
  id             Int              @id @default(autoincrement())
  requestId      Int
  categoryId     Int
  triggers       TriggerType[]    // 다중선택
  standardDelta  Int              @default(0)
  premiumDelta   Int              @default(0)
  evidenceUrl    String?          // S3/Blob URL
  comment        String?
  createdAt      DateTime         @default(now())

  request        BudgetPlanRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  category       ExpenseCategory   @relation(fields: [categoryId], references: [id])

  @@unique([requestId, categoryId])
}
```

## Implementation Steps

### Phase 1 — Schema + Core Services

**1. Prisma migration** (신규 enum + 필드 + 모델)
- `add_planStatus_enum.sql`
- `add_categoryScope_enum.sql`
- `add_triggerType_enum.sql`
- `add_budgetPlanRequest_models.sql`
- Backfill: 기존 `ExpenseCategory.scope` = `DEPARTMENT` (안전 기본값)
- Backfill: 기존 `FinancialReport.planStatus` = `FINALIZED` (이미 확정된 시즌)

**2. `BudgetPlanService.promoteTiers()`**
- 입력: `BudgetPlanRequest[]`, `basicTiers: BudgetCategoryPlan[]`
- 출력: `BudgetTier[]` (Basic + 승격된 Standard/Premium)
- 로직: [ADR 0019](../../adr/0019-trigger-tier-promotion-rules.md) 룰
- Value 계산: [ADR 0020](../../adr/0020-trigger-multiplier-values.md) 상수 테이블

**3. `BudgetPlanService.calculateCapacity()`**
- 입력: `FinancialReport`
- 출력: `Int` (음수 가능)
- 공식: `totalOperatingBudget − Σ Basic.cost − contingencyReserve`

**4. `BudgetPlanService.validateInvariants()`**
- 모든 카테고리 `Basic.cost ≥ mandatoryMinimum` 체크
- 위반 시 `AppError(400, "BASIC_BELOW_MANDATORY_MIN")`

### Phase 2 — closeSeason 훅 확장

**5. `SeasonService.closeSeason()` 훅에 편성 Draft 생성 추가**

```typescript
// apps/api/src/season/season.service.ts
async closeSeason(id: number) {
  // 기존: carryover 자동 적용, waitlist expire
  // 신규:
  try {
    const nextSeason = await this.repo.findNextSeason(id);
    if (nextSeason) {
      const preview = await this.budgetAutomationService.preview({
        targetSeasonId: nextSeason.id,
        lookback: 3,
        inflation: 0.03,
        revenueGoal: "MAINTAIN",
        expenseGoal: "MAINTAIN",
      });
      const draft = await this.budgetPlanService.createDraftFromPreview(nextSeason.id, preview);
      // draft.planStatus = DRAFT
      // FinanceManager 에게 review 알림
      await this.notificationService.notifyBudgetDraftReady(draft);
    }
  } catch (err) {
    console.warn(`[closeSeason] budget draft 자동 생성 실패 (nextSeasonId=?)`, err);
    // best-effort: closeSeason 자체는 성공
  }
}
```

**6. CAPACITY_FAILED 캐스케이드 (Q11)**
- Draft 생성 후 `calculateCapacity()` 검증
- capacity < 0 → GoalWeight=CONSERVATIVE 로 `budget-automation.preview()` 재실행
- 여전히 < 0 → `planStatus = CAPACITY_FAILED`, GM alert 발송
- capacity ≥ 0 → `planStatus = DRAFT` 유지, FM review 대기

### Phase 3 — 심사 신청 API

**7. `POST /financial-reports/:seasonId/plan-requests`** (팀장/부서장)
- 요청자 role 확인: Team.leader 또는 Department.head
- `scope` 자동 결정 (Team leader → TEAM, Department head → DEPARTMENT)
- `BudgetPlanRequest` + `BudgetPlanRequestLine[]` 생성
- 상태: DRAFT → SUBMITTED (제출 시)

**8. `POST /financial-reports/:seasonId/open-review`** (FinanceManager)
- 조건: `planStatus === DRAFT` 이고 FM review 완료
- 액션: `planStatus = AWAITING_REVIEW`, `reviewOpenedAt = now()`, `reviewDeadline = now() + 14 days`
- 알림: 모든 Team.leader / Department.head 에게 심사 창 개방 통지

**9. Cron: 리마인더 (D-7 / D-3 / D-1)**
- `apps/api/src/cron/budget-plan-reminder.ts`
- 매일 실행. `AWAITING_REVIEW` 상태의 `FinancialReport` 대상
- 미신청 팀·부서에 알림

### Phase 4 — Knapsack 실행 및 승인

**10. `POST /financial-reports/:seasonId/execute-knapsack`** (FinanceManager 또는 cron)
- 조건: `planStatus === AWAITING_REVIEW` AND (`now() > reviewDeadline` OR 모든 신청 완료)
- 액션:
  - `BudgetPlanService.promoteTiers()` 호출
  - `KnapsackService.solve()` 호출
  - 결과 `BudgetCategoryPlan.knapsackAllocated` + `BudgetTier.isSelected` 업데이트
  - `planStatus = KNAPSACK_EXECUTED`
- Cron 옵션: 매일 자정 `reviewDeadline` 경과 감지 시 자동 실행

**11. `POST /financial-reports/:seasonId/finalize`** (FinanceManager)
- 조건: `planStatus === KNAPSACK_EXECUTED`
- 로직:
  - FM 자체 부서 (Department.scope=재무) 카테고리 신청 있음 → `planStatus = AWAITING_GM_APPROVAL`
  - 없음 → `planStatus = FINALIZED`, `finalizedAt = now()`
- 알림: 팀장/부서장에게 확정 결과 통지

**12. `POST /financial-reports/:seasonId/gm-approve`** (GM)
- 조건: `planStatus === AWAITING_GM_APPROVAL`
- 액션: `planStatus = FINALIZED`

### Phase 5 — 재편성 및 이의 신청

**13. `POST /financial-reports/:seasonId/re-plan`** (GM)
- 조건: `planStatus === FINALIZED`, 재편성 사유 필수 (reason 파라미터)
- 액션: `planStatus = RE_PLANNING` → `AWAITING_REVIEW` (새 2주 카운트다운)
- 기존 `OperatingExpense` 영향 없음 (집행 워크플로우 분리)

**14. `POST /financial-reports/:seasonId/override-request`** (팀장/부서장)
- `BudgetOverrideLog` 활용 (스키마 그대로)
- `categoryId + amount + reason` 로 이의 신청 → status=PENDING

**15. `POST /budget-override-logs/:id/review`** (FinanceManager)
- 기존 `reviewedBy*` 필드 활용
- APPROVED → 해당 카테고리 `knapsackAllocated` 조정
- REJECTED → reason 기록

## Testing

**Unit**
- `BudgetPlanService.promoteTiers()` — 트리거 조합별 티어 승격 (Q3-A 룰)
- `BudgetPlanService.calculateTierValue()` — multiplier 합산 (ADR 0020)
- `BudgetPlanService.calculateCapacity()` — 음수 감지

**Integration**
- `closeSeason()` → Draft 자동 생성 end-to-end
- CAPACITY_FAILED → CONSERVATIVE 재계산 → 성공/GM alert 두 경로
- FM 자체 신청 있음/없음 → GM escalate 경로 분기
- 재편성 → AWAITING_REVIEW 재개방

**Regression**
- 기존 `KnapsackService.solve()` 계약 변경 없음 (인풋 티어 배열 그대로)
- 기존 `BudgetAutomationService.preview()` 호출 인터페이스 변경 없음

## Rollout

1. Phase 1-2 배포 → 신규 스키마 + closeSeason 훅 (Draft 만 자동 생성, 이후 수동)
2. FinanceManager 파일럿: 1개 시즌 Draft 를 수동으로 knapsack 실행 검증
3. Phase 3-4 배포 → 팀장 신청 UI + 자동 실행
4. Phase 5 배포 → 재편성 + 이의 신청
5. 2027 시즌 전체 편성 사이클 완주 후 [ADR 0020](../../adr/0020-trigger-multiplier-values.md) multiplier 값 재검토

## Open Questions

- **UI 스펙**: `BudgetPlanPage` 는 별도 `BudgetPlanPage UX Overhaul` 로 커버. 이 스펙은 API/데이터 계약만.
- **Multiplier 값 유효성**: 파일럿 시즌 1회 실행 후 데이터로 검증. 현재 값은 grill 세션의 정성적 판단.
- **트리거 자동 조회 (홈경기·주말)**: 시스템이 `MatchSchedule` 에서 자동 부착 가능하지만 초기 버전은 팀장 수동 제출. 파일럿 후 자동화 검토.
- **PlanStatus 이력**: 현재는 최신 상태만. 이력 필요 시 `FinancialReportStateLog` 신설 (Phase 6).
