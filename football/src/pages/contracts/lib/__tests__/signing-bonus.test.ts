import { describe, expect, it } from 'vitest'
import { computeSigningBonusAnnual } from '../signing-bonus'

describe('computeSigningBonusAnnual', () => {
  it('amortizes over 3-year contract', () => {
    // 90M / 3y = 30M/y
    expect(computeSigningBonusAnnual(90_000_000, '2024-01-01', '2026-12-31')).toBe(30_000_000)
  })

  it('rounds up partial years (2.5y → ceil=3)', () => {
    // 90M / ceil(2.5) = 90M / 3 = 30M
    expect(computeSigningBonusAnnual(90_000_000, '2024-01-01', '2026-06-30')).toBe(30_000_000)
  })

  it('uses 1 as minimum divisor for sub-1-year contracts', () => {
    expect(computeSigningBonusAnnual(12_000_000, '2026-03-01', '2026-08-31')).toBe(12_000_000)
  })

  it('returns 0 when signingBonus is 0', () => {
    expect(computeSigningBonusAnnual(0, '2025-01-01', '2027-12-31')).toBe(0)
  })
})
