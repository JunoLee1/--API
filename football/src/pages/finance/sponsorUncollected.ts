/**
 * Sponsorship 미수금 (Uncollected) 헬퍼 — ADR 0024.
 *
 * Expected (SponsorshipPayment.dueDate 누적) vs Actual (paidAt 누적, cash basis)
 * 의 차액을 계산한다. Actual ≥ Expected 이거나 Expected 가 알 수 없는 경우 0.
 *
 * BudgetAutoPage / DashboardCharts 두 소비처가 동일 조건을 쓰므로 배지 렌더
 * 여부를 한 곳에서 결정 (분기 로직 중복 방지 + 유닛 테스트 가능).
 */
export function computeSponsorUncollected(
  actual: number | null | undefined,
  expected: number | null | undefined,
): number {
  const a = actual ?? 0
  if (expected == null) return 0
  const diff = expected - a
  return diff > 0 ? diff : 0
}
