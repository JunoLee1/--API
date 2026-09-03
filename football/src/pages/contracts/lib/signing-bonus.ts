const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25

export function computeSigningBonusAnnual(
  signingBonus: number,
  startISO: string,
  endISO: string,
): number {
  if (signingBonus === 0) return 0
  const years = (new Date(endISO).getTime() - new Date(startISO).getTime()) / MS_PER_YEAR
  const divisor = Math.max(1, Math.ceil(years))
  return Math.round(signingBonus / divisor)
}
