# Sponsorship Actual + Expected revenue 병기 구현 plan

**Date:** 2026-09-01
**Status:** Ready-for-agent (grill Q1~Q7 완료)
**Origin issue:** #325
**Related:** [ADR 0024](../../adr/0024-sponsorship-actual-expected-revenue.md)

## 결정 사항 요약

| # | 결정 |
|---|---|
| Q1 | Hybrid: Actual + Expected 병렬 노출 |
| Q2 | Expected = Σ SponsorshipPayment.amount WHERE dueDate ∈ season window (status 무관) |
| Q3 | CAGR base = Actual (cash) |
| Q4-B | Sponsorship 만 이번 impl (다른 revenue field 는 별도) |
| Q5 | 하위 field 신설 (breaking 없음): `expectedRevenueSponsorship: number` 추가 |
| Q6 | FE = BudgetAutoPage 병기 + Dashboard 배지 (다른 페이지는 별도) |
| Q7 | Backend 1 + Frontend 1 (2 slice) |

## Slice 1 — Backend

### Schema + Migration
```prisma
model FinancialReport {
  ...
  plannedRevenueSponsorship  Int  // 기존, Actual (cash by paidAt in window)
  expectedRevenueSponsorship Int? // 신규, Expected (accrual by dueDate in window)
  ...
}
```
- Nullable 로 backward compat
- Migration: `ALTER TABLE "FinancialReport" ADD COLUMN "expectedRevenueSponsorship" INTEGER;`
- Backfill: 기존 row 각각 SponsorshipPayment aggregate 실행

### `apps/api/src/lib/season-actuals.ts`
`SeasonRevenueActuals` 인터페이스 확장:
```ts
export interface SeasonRevenueActuals {
  plannedRevenueTicket: number;
  plannedRevenueSponsorship: number;      // Actual (existing)
  expectedRevenueSponsorship: number;     // NEW
  plannedRevenueMerchandise: number;
  ...
}
```

`getSeasonRevenueActuals()` 에 추가 쿼리:
```ts
prisma.sponsorshipPayment.aggregate({
  where: { dueDate: { gte: season.startDate, lte: season.endDate } },
  _sum: { amount: true },
})
```

### `apps/api/src/financial-report/financial-report.service.ts`
- `autoFillRevenueFromPrevSeasons()` 의 `RevenueBreakdownDto` 에 `expectedRevenueSponsorship` 추가
- N 시즌 평균 로직에서 field 동일 처리 (Math.round(sum/n))
- `sumBreakdown` 등 통계 함수는 Actual (`plannedRevenueSponsorship`) 만 계속 (기본 총액)

### Backfill 스크립트
`apps/api/prisma/scripts/backfill-expected-sponsorship.ts`:
- 모든 FinancialReport 순회
- 각 seasonId 기준 `getSeasonRevenueActuals()` 호출 → `expectedRevenueSponsorship` update
- Idempotent (매 실행마다 재계산)

### 테스트
- `season-actuals.test.ts` 확장: dueDate PENDING/OVERDUE 도 expected 에 포함, PAID 는 actual+expected 양쪽
- `financial-report.service.test.ts` 확장: autoFill 시 expected 필드 평균

## Slice 2 — Frontend

### 타입
`football/src/services/financial-report.service.ts`:
```ts
export interface FinancialReport {
  ...
  plannedRevenueSponsorship: number
  expectedRevenueSponsorship?: number  // NEW, optional (backward compat)
  ...
}
```

### `BudgetAutoPage.tsx`
스폰서십 카드 UI 확장:
- 기존: `predicted` (Actual CAGR 결과)
- 신규: `expected` value 병기 (backend 응답에 미포함 시 fallback null)
- 실제 예제:
```tsx
<div>
  <span className="text-2xl">₩{fmt(pred.predicted)}</span>
  {expected != null && expected > actual && (
    <Badge variant="outline" className="ml-2 text-amber-600">
      미수금 ₩{fmt(expected - actual)}
    </Badge>
  )}
</div>
```

**주의**: BudgetAutoPage 는 CAGR 기반 예측이라 Actual 만 참조. Expected 는 참고 표시.

### Dashboard (선택 페이지 grep 필요)
Sponsorship widget 에 작은 배지:
```tsx
{expected > actual && <span className="text-xs text-muted-foreground">미수금 {fmt(expected - actual)}</span>}
```

### 테스트
- `BudgetAutoPage.test.tsx` 확장: expected > actual 시 배지 렌더, 동일하면 미노출
- Dashboard sponsorship widget 테스트 (있으면)

## Acceptance

### Slice 1 (BE)
- [ ] `expectedRevenueSponsorship Int?` schema + migration
- [ ] `getSeasonRevenueActuals` expected 쿼리
- [ ] `financial-report.service` breakdown 확장
- [ ] Backfill 스크립트
- [ ] Unit + integration 테스트

### Slice 2 (FE)
- [ ] FinancialReport TS 타입 확장
- [ ] BudgetAutoPage 배지
- [ ] Dashboard sponsorship widget 배지
- [ ] Unit 테스트

## Non-goals
- 다른 revenue field accrual (별도 이슈)
- Sponsorship payment schedule 자동 생성
- Overseas payment 환율 재계산 (currency 별 처리는 별도)
- OpsReport / RevenueAdjustment 등 다른 sponsorship 표시처 (별도 wave)
