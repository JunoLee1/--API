export interface AssessmentInput {
  painLevel: number;
  hasSwelling: boolean;
  romScore: number;
  strengthScore: number;
  sprintScore: number;
  jumpScore: number;
  psychScore: number;
  positionRiskScore: number;
}

export interface ScoreResult {
  medicalScore: number;
  functionalScore: number;
  modifierScore: number;
  totalScore: number;
}

export function calculateMedicalScore(
  painLevel: number,
  hasSwelling: boolean,
  romScore: number
): number {
  const pain = (painLevel / 10) * 20;
  const swelling = hasSwelling ? 10 : 0;
  const rom = ((100 - romScore) / 100) * 10;
  return pain + swelling + rom;
}

export function calculateFunctionalScore(
  strengthScore: number,
  sprintScore: number,
  jumpScore: number
): number {
  const avg = (strengthScore + sprintScore + jumpScore) / 3;
  return ((100 - avg) / 100) * 40;
}

export function calculateModifierScore(
  psychScore: number,
  positionRiskScore: number
): number {
  const avg = (psychScore + positionRiskScore) / 2;
  return (avg / 100) * 20;
}

export function calculateTotalScore(input: AssessmentInput): ScoreResult {
  const medicalScore = calculateMedicalScore(input.painLevel, input.hasSwelling, input.romScore);
  const functionalScore = calculateFunctionalScore(input.strengthScore, input.sprintScore, input.jumpScore);
  const modifierScore = calculateModifierScore(input.psychScore, input.positionRiskScore);
  return {
    medicalScore,
    functionalScore,
    modifierScore,
    totalScore: medicalScore + functionalScore + modifierScore,
  };
}

export const SCORE_THRESHOLD = 80;
