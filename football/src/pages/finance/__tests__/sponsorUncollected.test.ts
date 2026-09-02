/**
 * computeSponsorUncollected unit tests (ADR 0024, issue #477).
 *
 * Sponsorship 미수금 배지 (BudgetAutoPage / DashboardCharts) 렌더 조건 격리.
 * 배지 = returned value > 0.
 */
import { describe, expect, it } from 'vitest'
import { computeSponsorUncollected } from '../sponsorUncollected'

describe('computeSponsorUncollected (ADR 0024 배지 조건)', () => {
  it('expected > actual → 차액 반환 (배지 렌더)', () => {
    expect(computeSponsorUncollected(30000, 80000)).toBe(50000)
  })

  it('expected === actual → 0 (배지 미노출)', () => {
    expect(computeSponsorUncollected(50000, 50000)).toBe(0)
  })

  it('expected < actual (오버 결제) → 0 (배지 미노출, 음수 방지)', () => {
    expect(computeSponsorUncollected(80000, 50000)).toBe(0)
  })

  it('expected == null → 0 (기존 row backfill 안 됨 케이스, 배지 미노출)', () => {
    expect(computeSponsorUncollected(30000, null)).toBe(0)
  })

  it('expected == undefined → 0 (API 응답에 field 부재, 배지 미노출)', () => {
    expect(computeSponsorUncollected(30000, undefined)).toBe(0)
  })

  it('actual == null 이면 0 으로 취급 → expected 그대로 반환', () => {
    expect(computeSponsorUncollected(null, 80000)).toBe(80000)
  })

  it('actual == undefined 이면 0 으로 취급 → expected 그대로 반환', () => {
    expect(computeSponsorUncollected(undefined, 80000)).toBe(80000)
  })

  it('둘 다 null → 0', () => {
    expect(computeSponsorUncollected(null, null)).toBe(0)
  })

  it('actual 0, expected 0 → 0', () => {
    expect(computeSponsorUncollected(0, 0)).toBe(0)
  })
})
