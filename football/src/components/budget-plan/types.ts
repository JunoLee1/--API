import type { BudgetPlan, UpsertBudgetPlanPayload } from '@/types/budget'

// ----- Draft state (form-friendly, all strings) -----

export interface DraftTier {
  name: string
  cost: string // form input이라 string 유지
  value: string
  // sortOrder는 배열 index로 표현 (별도 필드 없음)
}

export interface DraftCategory {
  mandatoryMinimum: string
  tiers: DraftTier[] // 빈 배열도 유효 (default 0개)
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

export const emptyTier = (): DraftTier => ({ name: '', cost: '', value: '' })
export const emptyCategory = (): DraftCategory => ({ mandatoryMinimum: '', tiers: [] })

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
