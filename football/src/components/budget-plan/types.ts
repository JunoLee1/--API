import type { BudgetPlan, UpsertBudgetPlanPayload, OperatingCategory } from '@/types/budget'

// ----- Draft state (form-friendly, all strings) -----

export interface DraftTier {
  name: string
  cost: string // form input이라 string 유지
  value: string
}

export interface DraftCategory {
  mandatoryMinimum: string
  tiers: DraftTier[] // 빈 배열도 유효 (default 0개)
}

// Categories are now DB-backed (ADR-0012); keyed by category `code` (string).
export interface DraftBudgetPlan {
  totalBudget: string
  contingency: string
  playerSalaryBudget: string
  categories: Record<string, DraftCategory>
}

export const emptyTier = (): DraftTier => ({ name: '', cost: '', value: '' })
export const emptyCategory = (): DraftCategory => ({ mandatoryMinimum: '', tiers: [] })

// ----- Conversions -----

/**
 * Build a draft from the server-side BudgetPlan.
 * `categoryCodes` is the list of active category codes (from useExpenseCategories);
 * every code gets an initial empty DraftCategory even if the server has no plan yet.
 */
export function serverToDraft(
  plan: BudgetPlan | null,
  categoryCodes: string[]
): DraftBudgetPlan {
  const categories: Record<string, DraftCategory> = {}
  for (const code of categoryCodes) {
    categories[code] = emptyCategory()
  }

  if (plan) {
    for (const cp of plan.budgetCategoryPlans) {
      categories[cp.category] = {
        mandatoryMinimum: cp.mandatoryMinimum.toString(),
        tiers: cp.tiers.map((t) => ({
          name: t.name,
          cost: t.cost.toString(),
          value: t.value.toString(),
        })),
      }
    }
  }

  return {
    totalBudget: plan?.totalOperatingBudget?.toString() ?? '',
    contingency: plan?.contingencyReserve?.toString() ?? '0',
    playerSalaryBudget: plan?.playerSalaryBudget?.toString() ?? '',
    categories,
  }
}

/**
 * Serialize a draft to the API payload.
 * Empty/incomplete tiers are dropped (server treats missing tiers as "no options").
 */
export function draftToPayload(
  draft: DraftBudgetPlan,
  categoryCodes: string[]
): UpsertBudgetPlanPayload {
  const psb = parseInt(draft.playerSalaryBudget, 10)
  return {
    totalOperatingBudget: parseInt(draft.totalBudget, 10) || 0,
    contingencyReserve: parseInt(draft.contingency, 10) || 0,
    playerSalaryBudget: draft.playerSalaryBudget && !isNaN(psb) ? psb : undefined,
    categories: categoryCodes.map<UpsertBudgetPlanPayload['categories'][number]>((code) => {
      const cat: OperatingCategory = code
      const c = draft.categories[code] ?? emptyCategory()
      return {
        category: cat,
        mandatoryMinimum: parseInt(c.mandatoryMinimum, 10) || 0,
        tiers: c.tiers
          .filter((t) => t.name.trim() && t.cost && t.value)
          .map((t) => ({
            name: t.name.trim(),
            cost: parseInt(t.cost, 10) || 0,
            value: parseInt(t.value, 10) || 0,
          })),
      }
    }),
  }
}
