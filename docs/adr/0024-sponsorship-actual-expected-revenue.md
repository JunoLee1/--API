# ADR 0024: Sponsorship revenue Actual + Expected 병기 (Hybrid)

**Status:** Accepted (grill 2026-09-01 Q1~Q7 결정)
**Date:** 2026-09-01
**Related:** [Issue #325](https://github.com/JunoLee1/--API/issues/325), [ADR 0011 Knapsack](0011-knapsack-operating-budget-allocation.md), [ADR 0023 편성 auto-header](0023-budget-plan-finalize-auto-budget-header.md)

## Context

`apps/api/src/lib/season-actuals.ts::getSeasonRevenueActuals()` 의 sponsorship 집계:

```ts
prisma.sponsorshipPayment.aggregate({
  where: { status: "PAID", paidAt: { gte: season.startDate, lte: season.endDate } },
  _sum: { amount: true },
})
```

**Cash basis only** — PAID + paidAt in season window 만 count. 계약 체결 → totalFee 확정 → 미수금 상태에서 accrual 기준 revenue 인식되어야 하지만 무시.

### 파급 범위 (진단 2026-09-01)

- `BudgetAutoPage` revenue preview → CAGR base 이면 시즌 초 무조건 0
- `FinancialReport.plannedRevenueSponsorship` 대시보드 표시
- `autoFillRevenueFromPrevSeasons` 이전 시즌 평균 자동 채움
- `season.repo.findActiveWithKPI` 가용 예산 KPI

시즌 초기·중반에는 실측치 미도달 상태로 UI/CAGR 모두 저평가.

## Decision

### 전략 (Q1 → B: Hybrid)

Actual + Expected 두 필드 병렬 노출. 기존 field (Actual, cash basis) 유지 + 신규 field (Expected, accrual) 추가. 데이터 손실 없이 두 관점 모두 제공.

### Expected 정의 (Q2 → dueDate 기반)

`Expected = Σ SponsorshipPayment.amount WHERE dueDate ∈ [season.startDate, season.endDate]` (status 무관 — PENDING/PAID/OVERDUE 모두 포함).

**Payment schedule 기준** — Sponsorship.paymentSchedule (MONTHLY/QUARTERLY/ANNUAL) 를 따라 미리 생성된 SponsorshipPayment row 의 dueDate 를 신뢰. Pro-rata 안 함.

**Fallback**: SponsorshipPayment row 미존재 계약 → 이번 iteration 미포함 (schedule 미생성 → seed/데이터 정합 이슈로 별도).

### CAGR base (Q3 → Actual)

`budget-automation.service.computeCagr()` base 값은 **Actual (cash)** 기준. 이유:
- 과거 시즌 CAGR = 실제 넘어온 돈 기준 성장률
- 과거 시즌은 대부분 종료 → accrual = actual (수렴)
- 미래 예측은 물가상승률 + goal multiplier 로 별도 조정

### FinancialReport shape (Q5 → 하위 field 신설, breaking 없음)

기존:
```ts
plannedRevenueSponsorship: number  // Actual (cash)
```

신규 (기존 유지 + 하위 field):
```ts
plannedRevenueSponsorship: number   // Actual, 기존과 동일 (breaking 없음)
expectedRevenueSponsorship: number  // Expected, 신규 (accrual by dueDate)
```

기존 소비처는 변경 없이 Actual 값 계속 소비. 새 UI 는 `expectedRevenueSponsorship` 선택 사용.

### FE 반영 범위 (Q6 → BudgetAutoPage + 대시보드 안내)

- **BudgetAutoPage** revenue preview: 스폰서십 카드에 `"실지급 A / 예상 B"` 병기 (Expected > Actual 이면 미수금 amber tag)
- **Dashboard**: 스폰서십 widget 에 작은 배지 (`미수금 X만원`)
- OpsReport / RevenueAdjustment 등 다른 페이지 sponsorship 표시처는 별도 이슈로 wave

### 다른 revenue field (Q4-B → 별도)

Ticket / Merchandise / AcademyFee 등 8 field 는 각각 accrual 정의 다름 (예: Ticket 은 예약 데이터 없음, AcademyFee 는 이미 dueDate 개념 있음). 각 field 별 별도 grill 필요 → 이번 이슈에서 out-of-scope.

## Alternatives Considered

**A. Accrual 단일 (cash view 삭제)** — 미수금도 revenue 인식. But 시즌 중 실제 현금 흐름 확인 불가, CAGR 왜곡 위험, 기존 소비처 전면 수정. 기각.

**C. contractAmount pro-rata** — Sponsorship.totalFee 를 계약 기간 pro-rata 분배. Payment schedule 무시. 실무 정확도 낮음 (분기별 큰 결제 시 왜곡). 기각.

**Q4-B option 2. 전체 revenue field 확장** — 일관성. But 각 field accrual 정의 상이 → 이번 라운드 스코프 초과. 기각.

## Consequences

### Backend

- `getSeasonRevenueActuals()` 반환 타입 확장: `SeasonRevenueActuals` 인터페이스에 `expectedRevenueSponsorship: number` 추가
- `apps/api/src/lib/season-actuals.ts` 에 신규 쿼리 (dueDate range) 추가
- `financial-report.repo.ts::upsert` / `autoFillRevenueFromPrevSeasons` 등에서 expected 필드 저장/평균 계산 (breakdown DTO 확장)
- `FinancialReport` Prisma schema 는 `expectedRevenueSponsorship Int?` 필드 추가 (nullable, backward compat) + migration

### Frontend

- `FinancialReport` TS 타입 확장 (`expectedRevenueSponsorship?: number`)
- `BudgetAutoPage` — 스폰서십 카드 UI 확장
- Dashboard sponsorship widget 배지 추가

### Migration

- `expectedRevenueSponsorship` 컬럼 add (nullable)
- 기존 row backfill: 각 시즌의 SponsorshipPayment aggregate 실행 → 채움
- Prisma migration + one-off backfill script

### Impl 이슈 분할 (Q7 → BE + FE 2 slice)

- **S1 (BE)** — schema + migration + service 계산 + 응답 반영 + 테스트
- **S2 (FE)** — BudgetAutoPage 병기 + Dashboard 배지

## Follow-up

- 다른 revenue field (Ticket / AcademyFee / Merchandise 등) accrual 정의 grill (각 별도 이슈)
- Sponsorship payment schedule 생성 자동화 (계약 등록 시 dueDate row auto-gen)
- Overseas payment 환율 (currency=GBP) 처리 정합
