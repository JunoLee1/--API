import type { TriggerType } from './types'

/**
 * ADR 0019/0020 편성 트리거 승격 룰 (FE mirror).
 *
 * 소스: `apps/api/src/budget-plan/promotion.ts` — 상수 값 및 함수 시맨틱을
 * 그대로 반영해 두면, 팀장이 예산 요청을 입력하는 시점에서 서버 승격 후
 * 계산될 tier value 를 미리 보여줄 수 있다.
 *
 * 가중(weighted): 델타 비용에 곱해서 tier value 로 반영.
 * 가산(additive): 트리거 존재 여부가 Premium 티어 승격 가능성을 여는 게이트.
 *   ADR 0020 규정상 backend 는 additive 트리거에도 별도 multiplier 를 두지만,
 *   Premium 델타는 additive 트리거 존재 시에만 입력할 수 있게 UI 레벨에서
 *   제어한다.
 */

/**
 * 트리거별 multiplier. 서버 값과 반드시 일치해야 한다.
 *   - MULTI_LOCATION: 1.0  (가중, 다지역 훈련장)
 *   - DIRECT_BUSINESS: 1.2 (가중, 직영 사업)
 *   - PUBLIC_UTILITY: 1.2  (가중, 공공요금)
 *   - HOME_MATCH: 1.5      (가산, 홈경기 현장지원)
 *   - WEEKEND_OVERTIME: 1.3 (가산, 주말 초과근무)
 */
export const TRIGGER_MULTIPLIER: Record<TriggerType, number> = {
  MULTI_LOCATION: 1.0,
  DIRECT_BUSINESS: 1.2,
  PUBLIC_UTILITY: 1.2,
  HOME_MATCH: 1.5,
  WEEKEND_OVERTIME: 1.3,
}

/** ADR 0019: 가산 트리거 (Premium 승격 게이트) */
export const ADDITIVE_TRIGGERS: readonly TriggerType[] = [
  'HOME_MATCH',
  'WEEKEND_OVERTIME',
] as const

/** ADR 0019: 가중 트리거 (Standard 승격 게이트, value multiplier) */
export const WEIGHTED_TRIGGERS: readonly TriggerType[] = [
  'MULTI_LOCATION',
  'DIRECT_BUSINESS',
  'PUBLIC_UTILITY',
] as const

const ADDITIVE_SET = new Set<TriggerType>(ADDITIVE_TRIGGERS)
const WEIGHTED_SET = new Set<TriggerType>(WEIGHTED_TRIGGERS)

export function isAdditiveTrigger(t: TriggerType): boolean {
  return ADDITIVE_SET.has(t)
}

export function isWeightedTrigger(t: TriggerType): boolean {
  return WEIGHTED_SET.has(t)
}

export function hasAdditiveTrigger(triggers: readonly TriggerType[]): boolean {
  return triggers.some(isAdditiveTrigger)
}

export function hasWeightedTrigger(triggers: readonly TriggerType[]): boolean {
  return triggers.some(isWeightedTrigger)
}

/**
 * ADR 0020: tier value = round(deltaCost × Σ multiplier).
 * backend `calculateTierValue` 와 동일하게 트리거가 없으면 0.
 *
 * NOTE: backend 는 multiplier 합이 0 이면 결과가 0 이지만, UI 미리보기에서
 * "트리거는 없지만 델타를 입력한" 예외 케이스에서도 사용자에게 델타 자체는
 * 보이도록 basic-only case 는 상위 컴포넌트에서 별도로 처리한다.
 */
export function calcTierValue(
  deltaCost: number,
  triggers: readonly TriggerType[]
): number {
  const weightSum = triggers.reduce((sum, t) => sum + TRIGGER_MULTIPLIER[t], 0)
  return Math.round(deltaCost * weightSum)
}
