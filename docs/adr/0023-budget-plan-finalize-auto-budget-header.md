# ADR 0023: 편성 확정 → BudgetHeader/Line 자동 생성

**Status:** Accepted (grill 2026-09-01 Q1~Q8 결정)
**Date:** 2026-09-01
**Related:** [ADR 0011 Knapsack](0011-knapsack-operating-budget-allocation.md), [ADR 0013 자산 신청 부서 계층 결재](0013-asset-request-department-approval.md), [ADR 0022 mandatoryMinimum 승인](0022-mandatory-minimum-approval-process.md), [Issue #456](https://github.com/JunoLee1/--API/issues/456)

## Context

편성 워크플로우 (`BudgetPlanRequest` → Knapsack → `BudgetCategoryPlan.knapsackAllocated`)와 운영비 지출 통제 (`OperatingExpense.create` → `BudgetLine.originalAmount` 검증) 가 **완전 병렬 존재**.

- 편성 시스템 확정 값: `BudgetCategoryPlan.knapsackAllocated` — 대시보드/보고서/이의신청 검증에만 사용
- 지출 통제 진실 소스: `BudgetLine.originalAmount` — `budget-automation.apply()` 가 예측치로 별도 생성
- **`OperatingExpense.create()` 는 `BudgetCategoryPlan` 완전 무시**, `BudgetLine.originalAmount` 만 검증

### 실제 시나리오 (2026-08-31 발견)

1. 팀장이 편성에 300M 신청 → GM 300M 로 확정 (`knapsackAllocated=300M`)
2. `budget-automation.apply()` 는 예측치 500M 로 `BudgetLine.originalAmount=500M` 생성
3. FM 이 400M 결재 → `used(0) + 400M > 500M` false → **통과**
4. 실제 편성 확정치 300M 대비 100M 초과, 감사 시점에만 발견

**Gap 성격**: 편성 워크플로우가 실효성 없음 (FE UI 완주해도 실제 통제 X). Persona 페인포인트 spec 의 **C1 (Critical): BudgetHeader ↔ FinancialReport 단절** 재확인.

## Decision

### 통합 전략 (Q1 → A)

편성 FINALIZED 훅으로 **`BudgetHeader`/`BudgetLine` 자동 생성**. 지출 결재 로직 (`OperatingExpense.create`) 변경 없음. `BudgetLine.originalAmount = mandatoryMinimum + knapsackAllocated` (카테고리별 총액).

**두 시스템 유지 이유:**
- `BudgetLine` 은 `AssetRequest` 워크플로우 (ADR 0013) 와 강결합 — 폐기 시 대규모 리팩터
- `budget-automation.apply` 는 편성 이전 planning tool 로 계속 유효 (Q7)

### 훅 발화 시점 (Q2 → In-tx)

`plan-request.service.ts::finalize()` 및 `gmApprove()` 트랜잭션 **안**에서 sync 실행. 편성 확정 = 예산 통제 데이터 확정, 원자적 필수.

BudgetHeader 생성 실패 시 편성 확정도 rollback (데이터 정합 보장).

### 재편성 처리 (Q3 → v1 LOCKED, v2 신규)

GM `rePlan()` → 재확정 시 기존 `BudgetHeader` (APPROVED) 는 `LOCKED` 로 전이 (편집 불가), 새 version 을 신규 생성.

- `BudgetHeader.@@unique([seasonId, version])` 이미 정의됨. auto-increment 는 PR #468 에서 구현
- 감사 이력 유지: 이전 version 은 read-only 로 남김

### 재편성 후 지출 검증 범위 (Q4 → seasonId+categoryId 전체)

v2 확정 이후 `OperatingExpense.create()` 의 `BUDGET_EXCEEDED` 검증:

```
used = SUM(OperatingExpense WHERE seasonId=X AND categoryId=Y AND status IN {PENDING, FIRST_APPROVED, APPROVED, PAID} AND deletedAt=null)
ceiling = 최신 APPROVED BudgetHeader 의 해당 categoryId BudgetLine.originalAmount
```

**모든 version 의 지출 합산**. v1 시점 지출도 v2 예산에서 가산 → 오버스펜딩 방지.

### 부서 귀속 (Q5 → MVP: departmentId=null)

BudgetHeader auto-gen 시 `BudgetLine.departmentId=null` (전사 공용) 하나만 생성. `AssetRequest` 는 기존 fallback 경로 (`departmentId=null`) 사용.

부서별 세분화는 **별도 이슈** (BudgetPlanRequest 의 ownerType/ownerId → BudgetLine 분배 로직, 관련 이슈 #348 스코프).

### 마이그레이션 (Q6 → 신규 전이만)

배포 이후 발생하는 **신규 FINALIZED 전이만 적용**. 이미 FINALIZED 이지만 `BudgetHeader` 없는 시즌은 그대로 두고, 필요 시 기존 `budget-automation.apply` 수동 실행.

Backfill 스크립트는 별도 이슈 (요구 발생 시).

### budget-automation.apply 공존 (Q7 → 유지)

편성 이전 planning tool 로 계속 유효. FINALIZED 후에도 disable 안 함 — 여러 version 생성 가능 (version auto-increment PR #468 반영).

## Alternatives Considered

**B. BudgetLine 폐기, knapsackAllocated 직접 검증** — 진실 소스 하나. But: AssetRequest 워크플로우 + budget-automation 전면 리팩터. 마이그레이션 리스크 큼. 기각.

**C. FM 수동 sync 버튼** — 명시적이지만 실수 위험 (편성 확정했는데 sync 안 눌러서 이전 예산으로 계속 결재). 기각.

**Post-tx fire-and-forget hook** — notify 패턴 재사용. BudgetHeader 생성 실패 시 데이터 불일치. 기각 (Q2 in-tx).

**BudgetHeader v1 update (Q3)** — 감사 이력 없음. 기각.

## Consequences

### 코드 변경

- `apps/api/src/budget-plan/plan-request.service.ts::finalize()` — 트랜잭션 안 `BudgetHeader` auto-gen 로직 추가
- `apps/api/src/budget-plan/plan-request.service.ts::gmApprove()` — 동일 로직 (self-approval 경로)
- 재편성 시 기존 v1 → LOCKED 전이 (별도 시점: 새 v2 생성 직전)
- `OperatingExpense.create()` 검증: `used` 계산에서 `budgetLineId` 필터 제거, `seasonId+categoryId` 조건만 사용 (모든 version 합산)

### 신규 서비스 헬퍼

`budgetHeaderFromPlan(seasonId, tx)`:
1. 활성 `BudgetHeader (status=APPROVED)` 있으면 → `LOCKED` 로 전이
2. 최신 version+1 로 새 header 생성 (`status=APPROVED`, `approvedBy=현재 actor`, `approvedAt=now`)
3. 카테고리별 `originalAmount = mandatoryMinimum + (knapsackAllocated ?? 0)` 로 BudgetLine 생성
4. `departmentId=null` (MVP)
5. `name`: `"{year} 시즌 편성 확정 v{version}"`

### 데이터 무결성

- 편성 확정 후 반드시 `BudgetHeader` 존재 (in-tx)
- 재편성 시 이전 version LOCKED 유지 (감사)
- 지출은 항상 최신 APPROVED header 참조

### 실무 영향

- FM 이 편성 확정 시 별도 예산안 생성 불필요
- FM 이 여전히 `budget-automation` planning 도구 사용 가능 (편성 참고)
- 지출 결재 통제 즉시 유효 (편성 확정 시점부터)

## Follow-up

- 부서별 BudgetLine 세분화 (Q5-B option 2 or #348 스코프)
- 기존 시즌 backfill 스크립트 (요구 발생 시)
- FE 대시보드: "편성 확정 예산 vs 실측 지출" 뷰 (기존 대시보드는 knapsackAllocated 기반이라 데이터 정합 유지)
