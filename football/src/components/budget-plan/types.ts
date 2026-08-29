import type { BudgetPlan, UpsertBudgetPlanPayload } from '@/types/budget'

// ----- Draft state (form-friendly, all strings) -----

export interface DraftCategory {
  mandatoryMinimum: string
  // NOTE: tier 편집은 팀장(요청) 흐름에서 제거됐지만, FM(확정) 경로에서
  // 여전히 서버로부터 tier 목록을 읽어와 draftToPayload로 되돌려주기 때문에
  // 익명 shape으로 인라인해 둔다. 팀장 요청 라인 draft는 PlanRequestLineDraft 참조.
  tiers: {
    name: string
    cost: string
    value: string
  }[]
}

/** A category slot in the draft. Array position is the sortOrder. */
export interface DraftCategoryOrdered {
  code: string
  data: DraftCategory
}

// Categories are now DB-backed (ADR-0012). Order is user-controlled via
// drag-and-drop; array position IS the sortOrder we persist.
export interface DraftBudgetPlan {
  totalBudget: string
  contingency: string
  playerSalaryBudget: string
  categories: DraftCategoryOrdered[]
}

export const emptyCategory = (): DraftCategory => ({ mandatoryMinimum: '', tiers: [] })

// ----- Team-leader plan request line draft (ADR 0019) -----

/**
 * 5종 트리거 (ADR 0019). 팀장이 요청 라인에 붙여 사유를 표현한다.
 * - MULTI_LOCATION: 다지역 훈련장
 * - DIRECT_BUSINESS: 직영 사업
 * - PUBLIC_UTILITY: 공공 성격
 * - HOME_MATCH: 홈경기 관련
 * - WEEKEND_OVERTIME: 주말 초과근무
 */
export type TriggerType =
  | 'MULTI_LOCATION'
  | 'DIRECT_BUSINESS'
  | 'PUBLIC_UTILITY'
  | 'HOME_MATCH'
  | 'WEEKEND_OVERTIME'

/**
 * 팀장 예산 편성 요청 한 줄 (draft state).
 * standard/premium delta는 form input이라 string 유지.
 */
export interface PlanRequestLineDraft {
  categoryId: number
  triggers: TriggerType[]
  standardDelta: string
  premiumDelta: string
  evidenceUrl?: string
  comment?: string
}

export const emptyLine = (categoryId: number): PlanRequestLineDraft => ({
  categoryId,
  triggers: [],
  standardDelta: '',
  premiumDelta: '',
})

// ----- Conversions -----

/**
 * Build a draft from the server-side BudgetPlan.
 * `categoryCodes` is the list of active category codes (from useExpenseCategories);
 * every code gets an initial empty DraftCategory even if the server has no plan yet.
 *
 * Ordering: server plans that already exist keep their persisted sortOrder
 * (implicit via `budgetCategoryPlans` order — the API returns them
 * `orderBy: sortOrder asc`). Any category codes the server has no plan for
 * are appended at the end in the `categoryCodes` argument order.
 */
export function serverToDraft(
  plan: BudgetPlan | null,
  categoryCodes: string[]
): DraftBudgetPlan {
  const fromServer: DraftCategoryOrdered[] = (plan?.budgetCategoryPlans ?? []).map(
    (cp) => ({
      code: cp.category,
      data: {
        mandatoryMinimum: cp.mandatoryMinimum.toString(),
        tiers: cp.tiers.map((t) => ({
          name: t.name,
          cost: t.cost.toString(),
          value: t.value.toString(),
        })),
      },
    })
  )

  const seen = new Set(fromServer.map((c) => c.code))
  const missing: DraftCategoryOrdered[] = categoryCodes
    .filter((code) => !seen.has(code))
    .map((code) => ({ code, data: emptyCategory() }))

  return {
    totalBudget: plan?.totalOperatingBudget?.toString() ?? '',
    contingency: plan?.contingencyReserve?.toString() ?? '0',
    playerSalaryBudget: plan?.playerSalaryBudget?.toString() ?? '',
    categories: [...fromServer, ...missing],
  }
}

/**
 * Serialize a draft to the API payload.
 * Empty/incomplete tiers are dropped (server treats missing tiers as "no options").
 * Array positions become the `sortOrder` on the wire.
 */
export function draftToPayload(draft: DraftBudgetPlan): UpsertBudgetPlanPayload {
  const psb = parseInt(draft.playerSalaryBudget, 10)
  return {
    totalOperatingBudget: parseInt(draft.totalBudget, 10) || 0,
    contingencyReserve: parseInt(draft.contingency, 10) || 0,
    playerSalaryBudget: draft.playerSalaryBudget && !isNaN(psb) ? psb : undefined,
    categories: draft.categories.map<UpsertBudgetPlanPayload['categories'][number]>((c, catIdx) => {
      return {
        category: c.code,
        mandatoryMinimum: parseInt(c.data.mandatoryMinimum, 10) || 0,
        sortOrder: catIdx,
        tiers: c.data.tiers
          .filter((t) => t.name.trim() && t.cost && t.value)
          .map((t, tierIdx) => ({
            name: t.name.trim(),
            cost: parseInt(t.cost, 10) || 0,
            value: parseInt(t.value, 10) || 0,
            sortOrder: tierIdx,
          })),
      }
    }),
  }
}
