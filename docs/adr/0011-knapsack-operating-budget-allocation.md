# ADR 0011: 0/1 Knapsack으로 운영비 재량 예산 배분

**Status:** Accepted  
**Date:** 2026-07-31

## Context

GM이 시즌 초 운영비를 카테고리별로 배분해야 한다. 총 운영예산에서 의무 최소치와 예비비를 제외한 재량 예산(Discretionary Pool)을 MEDICAL·MEAL·TRAVEL·EQUIPMENT·SCOUTING·YOUTH 6개 카테고리에 어떻게 배분할지가 문제.

## Decision

**0/1 Knapsack + 티어 방식**을 채택한다.

- 각 카테고리에 Basic / Standard / Premium 3개 티어를 정의 (비용 + GM 설정 가치점수)
- Knapsack이 재량 예산(Capacity) 안에서 가치합 최대인 티어 조합을 선택
- 시즌 초 1회 실행(Static). 긴급지출은 BudgetOverrideLog로 수동 기록
- 신규 시즌 생성 시 직전 시즌 BudgetCategoryPlan 자동 복사

## Alternatives Considered

**분수 Knapsack (연속 배분):** 수학적으로 최적이나 "스카우팅 £87.3k" 같은 결과는 GM이 해석·승인하기 어렵고 실제 의사결정 단위와 맞지 않아 기각.

**동적 재최적화:** 긴급지출마다 Knapsack 재실행 → Knapsack이 자동으로 다른 카테고리 예산을 깎는 결과가 예측 불가능해 GM 신뢰를 잃음. 예산 계획은 숫자 최적화보다 의사결정 기록이 우선이므로 기각.

**GM 직접 금액 입력:** Knapsack 없이 GM이 각 카테고리에 금액 직접 입력 → 최적화 가치 없음. 기각.

## Consequences

- `FinancialReport`에 `totalOperatingBudget`, `contingencyReserve` 필드 추가
- `BudgetCategoryPlan`, `BudgetTier`, `BudgetOverrideLog` 신규 모델 추가
- `OperatingExpense` 신규 모델 (TRAVEL·EQUIPMENT·SCOUTING·YOUTH 지출 단순 기록)
- 실적 집계는 Pull 방식 — 조회 시 MedicalExpense·MealExpense·OperatingExpense 합산
- 카테고리별 지출 한도 초과 시 WageCapService 패턴으로 경고 (차단 아님)
