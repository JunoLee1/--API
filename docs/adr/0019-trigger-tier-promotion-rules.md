# ADR 0019: 편성 워크플로우 트리거 → 티어 승격 룰

**Status:** Accepted
**Date:** 2026-08-29
**Related:** [ADR 0011](0011-knapsack-operating-budget-allocation.md)

## Context

[ADR 0011](0011-knapsack-operating-budget-allocation.md) 이 Knapsack + Basic/Standard/Premium 티어 방식을 결정했지만, **어떤 카테고리에 어떤 티어가 후보로 올라가는지** 는 미정. 팀장·부서장이 "우리는 Premium 원한다" 를 직접 선택하면 모두가 Premium 을 요구하여 우선순위 정보가 소실된다.

편성 워크플로우 grill 세션 (2026-08-29) 에서 티어 승격 결정 주체를 3가지 후보로 검토:
- (i) 팀장 직접 티어 선택
- (ii) 상대 우선순위 점수 (1-10)
- (iii) 트리거 근거 → 시스템이 승격
- (iv) 시스템이 사전 배정, 팀장은 재량 예산만 우선순위

(iii) 선택. 트리거는 "객관적으로 검증 가능한 근거" 이므로 팀 간 캘리브레이션 문제가 없고, ADR 0011 의 "객관적 트리거" 원칙과 일관.

## Decision

**하드코딩된 결정론적 승격 룰**을 채택한다. 룰 자체는 이 ADR 로 관리.

### 트리거 유형

| 유형 | 성격 | 예시 |
|------|------|------|
| **가중 사유** (배율) | 지속적/구조적 비용 | 다중거점 관리, 사업 직접비, 공공요금 |
| **가산 사유** (정액) | 이벤트/일회성 비용 | 홈경기 현장지원, 주말 야근 |

### 승격 룰

| 팀장 제출 트리거 | 후보 티어 | Knapsack 후보 여부 |
|------------------|-----------|-------------------|
| 없음 (미신청 포함) | Basic 만 | X (강제 배정) |
| 가중 사유 ≥1 | Basic + Standard | Standard 후보 |
| 가산 사유 ≥1 | Basic + Standard + Premium | Standard + Premium 후보 |
| 가중 ≥1 AND 가산 ≥1 | Basic + Standard + Premium | Standard + Premium 후보 (value multiplier 상승 — [ADR 0020](0020-trigger-multiplier-values.md) 참조) |

### 예산 티어 cost 계산

- `Basic.cost` = `budget-automation.preview()` 결과 (CAGR × inflation × GoalWeight)
- `Standard.cost` = `Basic.cost + 팀장 제출 Standard 델타`
- `Premium.cost` = `Standard.cost + 팀장 제출 Premium 델타`

**불변식**: 모든 카테고리에서 `Basic.cost ≥ mandatoryMinimum`. 위반 시 CAPACITY_FAILED alert.

### 승격 실행 시점

편성 워크플로우 3단계 `KNAPSACK_EXECUTED` 진입 직전. 승격 결과는 `BudgetTier` 레코드로 저장 (기존 스키마 재사용).

## Alternatives Considered

**팀장 직접 티어 선택 (i):** 팀장이 항목별로 "Premium 원함" 표시. 모두가 Premium 요구 → 우선순위 정보 없음. 기각.

**상대 우선순위 점수 (ii):** 팀장이 1-10 점 부여. 팀 A의 8점 = 팀 B의 5점? 팀 간 캘리브레이션 불가. ADR 0011 "객관적" 원칙 위배. 기각.

**시스템 사전 배정 + 재량 우선순위 (iv):** 시스템이 카테고리별 티어 미리 배정, 팀장은 재량 예산 항목만 우선순위. 팀장 인풋이 knapsack 에 반영 안 됨. 재량 부분이 사실상 폐기됨. 기각.

**매 시즌 FinanceManager 파라미터 조정:** 룰이 데이터. 시즌마다 조정 가능하지만 팀장 입장에서 "작년엔 되던 게 올해는 안 됨" 발생 → GM 신뢰 손실 (ADR 0011 rejected "동적 재최적화" 와 동일 리스크). 기각.

## Consequences

**신규 스키마**
- `enum TriggerType { MULTI_LOCATION, DIRECT_BUSINESS, PUBLIC_UTILITY, HOME_MATCH, WEEKEND_OVERTIME }`
- `BudgetPlanRequestLine.triggers: TriggerType[]` (팀장 제출)

**로직 변경**
- `BudgetPlanService.promoteTiers(request: BudgetPlanRequest[]): BudgetCategoryPlan[]` 신규 서비스
- Knapsack 입력 생성 시 승격 룰 적용

**미변경**
- `apps/api/src/budget/knapsack.service.ts` — 티어 배열 인풋 받는 구조 그대로 (ADR 0011 유지)
- `BudgetCategoryPlan`, `BudgetTier` 스키마 — 그대로

**모니터링**
- 카테고리별 트리거 분포 대시보드 (어느 트리거가 자주 쓰이는지 → 룰 조정 판단 자료)
- Basic.cost < mandatoryMinimum 위반 카테고리 alert
