# ADR 0020: 편성 워크플로우 Trigger Multiplier 값

**Status:** Accepted
**Date:** 2026-08-29
**Related:** [ADR 0011](0011-knapsack-operating-budget-allocation.md), [ADR 0019](0019-trigger-tier-promotion-rules.md)

## Context

[ADR 0019](0019-trigger-tier-promotion-rules.md) 이 트리거 → 티어 승격 룰을 정했지만, Knapsack 이 최적화할 **`BudgetTier.value` 계산식** 은 미정.

편성 워크플로우 grill 세션 (2026-08-29) 에서 value 계산 방식을 4가지 후보로 검토:
- (i) 팀장 우선순위 점수 (1-10)
- (ii) 트리거 개수 × 티어 레벨
- (iii) 카테고리별 FinanceManager 사전 가중치
- (iv) `Δcost × Σ trigger_multiplier`

(iv) 선택. "델타 1원당 정당화된 가치" = trigger_multiplier 로, Knapsack 이 marginal value/cost 밀도가 높은 델타를 우선 선택. 각 트리거의 multiplier 값을 이 ADR 로 관리.

## Decision

### value 계산식

```
value(Standard) = (Standard.cost − Basic.cost) × Σ trigger_multiplier
value(Premium)  = (Premium.cost − Standard.cost) × Σ trigger_multiplier
value(Basic)    = 무관 (항상 강제 배정, Knapsack 후보 아님)
```

`Σ trigger_multiplier` = 팀장이 해당 카테고리에 제출한 모든 트리거의 multiplier 합.

### Multiplier 초기 값

| 트리거 | 유형 | Multiplier | 근거 |
|--------|------|-----------|------|
| `MULTI_LOCATION` (다중거점 관리) | 가중 | **1.0** | 기본 가중. 지속적 관리 비용의 baseline |
| `DIRECT_BUSINESS` (사업 직접비) | 가중 | **1.2** | 수익 창출 직접 기여, 우선순위 상향 |
| `PUBLIC_UTILITY` (공공요금) | 가중 | **1.2** | 계약 조정 어려움 (전기·수도·통신). 미확보 시 서비스 중단 리스크 |
| `HOME_MATCH` (홈경기 현장지원) | 가산 | **1.5** | 관중·미디어 노출, 대체 불가 이벤트 |
| `WEEKEND_OVERTIME` (주말 야근) | 가산 | **1.3** | 인건비 프리미엄 (근로기준법 기준). 회피 어렵지만 홈경기 대비 낮음 |

### 결합 규칙

- 같은 카테고리에 여러 트리거 제출 → **합산**. 예: `HOME_MATCH + WEEKEND_OVERTIME = 1.5 + 1.3 = 2.8`
- 승격 룰 ([ADR 0019](0019-trigger-tier-promotion-rules.md)) 에 의해 티어 후보가 결정된 후, 각 델타에 이 합산 multiplier 를 곱함

### Multiplier 조정 정책

- 초기 값은 파일럿 시즌 (2027) 동안 유지
- 시즌 종료 후 카테고리별 트리거 사용 분포·knapsack 선택 편향 분석 → 다음 ADR 로 갱신
- 시즌 중 변경 금지 (팀장 예측 가능성 유지, [ADR 0011](0011-knapsack-operating-budget-allocation.md) "동적 재최적화 rejected" 원칙과 일관)

## Alternatives Considered

**팀장 우선순위 점수 (i):** 캘리브레이션 불가. 기각 (ADR 0019 와 동일 이유).

**트리거 개수 = value (ii):** `value = 트리거 수 × 티어 레벨`. 객관적이지만 "트리거만 많이 걸면 이김" 왜곡. 트리거 유형별 실제 우선순위 차이 반영 안 됨. 기각.

**카테고리별 사전 가중치 (iii):** FinanceManager 가 매 시즌 MEDICAL=1.5, MEAL=1.0 등 세팅. 결정권 재무팀 집중, 팀장 인풋이 value 계산에서 사라짐. 기각.

**Δcost 배제, multiplier 만 사용:** `value = Σ multiplier`. cost 무관하므로 knapsack 이 큰 델타 선호 (multiplier 낮아도 큰 돈이 이김). 델타 대비 정당화가 없음. 기각.

## Consequences

**신규 로직**
- `BudgetPlanService.calculateTierValue(tier: BudgetTier, prevTierCost: Int, triggers: TriggerType[]): Int`
- 상수 테이블: `TRIGGER_MULTIPLIER: Record<TriggerType, number>` (이 ADR 값 하드코딩)

**모니터링**
- 시즌 종료 시 트리거별 사용 카운트 리포트
- Knapsack 선택 vs 미선택 티어의 value/cost 밀도 분포 분석
- 이상 편향 발견 시 다음 ADR 후보

**미변경**
- Knapsack MCKP 알고리즘 (ADR 0011) — value 인풋 계산만 이 ADR 로 정의, 알고리즘 자체 그대로
