const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

interface ContractBonusShape {
  signingBonus: bigint;
  startDate: Date;
  endDate: Date;
}

export function computeSigningBonusAnnual(c: ContractBonusShape): number {
  const bonus = Number(c.signingBonus);
  if (bonus === 0) return 0;
  const years = (c.endDate.getTime() - c.startDate.getTime()) / MS_PER_YEAR;
  const divisor = Math.max(1, Math.ceil(years));
  return Math.round(bonus / divisor);
}

export function computeSigningBonusForSeason(
  c: ContractBonusShape,
  seasonStart: Date,
  seasonEnd: Date,
): number {
  if (c.endDate <= seasonStart || c.startDate >= seasonEnd) return 0;
  return computeSigningBonusAnnual(c);
}
