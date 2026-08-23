import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { budgetPlanApi } from '@/services/financial-report.service'
import { seasonApi } from '@/services/season.service'
import type { BudgetPlan } from '@/types/budget'
import { useExpenseCategories } from '@/hooks/useExpenseCategories'
import { BudgetPlanWizard } from '@/components/budget-plan/BudgetPlanWizard'
import type { CategoryPageItem } from '@/components/budget-plan/BudgetCategoryPage'
import {
  serverToDraft,
  draftToPayload,
  type DraftBudgetPlan,
} from '@/components/budget-plan/types'
import { Skeleton } from '@/components/ui/skeleton'

export function BudgetPlanPage() {
  const { t } = useTranslation('admin')
  const { rows: categoryRows, loading: catLoading } = useExpenseCategories()

  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [initialDraft, setInitialDraft] = useState<DraftBudgetPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const categoryCodes = useMemo(() => categoryRows.map((c) => c.code), [categoryRows])
  const categoryItems = useMemo<CategoryPageItem[]>(
    () => categoryRows.map((c) => ({ code: c.code, label: c.label })),
    [categoryRows]
  )

  useEffect(() => {
    if (catLoading) return
    void (async () => {
      try {
        const season = await seasonApi.active()
        if (!season) {
          setLoading(false)
          return
        }
        setSeasonId(season.id)
        const p: BudgetPlan | null = await budgetPlanApi.get(season.id).catch(() => null)
        setInitialDraft(serverToDraft(p, categoryCodes))
      } catch {
        toast.error(t('budget.loadFailed'))
      } finally {
        setLoading(false)
      }
    })()
    // Deliberately re-run when category list finishes loading so serverToDraft
    // has the correct code list to seed empty entries.
  }, [catLoading, categoryCodes, t])

  const handleSubmit = async (draft: DraftBudgetPlan) => {
    if (!seasonId) return
    setSaving(true)
    try {
      await budgetPlanApi.save(seasonId, draftToPayload(draft, categoryCodes))
      toast.success(t('budget.saved'))
      // Reload so subsequent edits start from persisted state.
      const p = await budgetPlanApi.get(seasonId)
      setInitialDraft(serverToDraft(p, categoryCodes))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('budget.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading || catLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!seasonId || !initialDraft) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">{t('budget.noActiveSeason')}</p>
      </div>
    )
  }

  // The `key` forces the wizard to reset its internal draft state after a save
  // (initialDraft object identity changes → new mount → fresh useState seed).
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">{t('budget.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          시즌 예산과 카테고리별 옵션을 단계별로 편집합니다
        </p>
      </div>
      <BudgetPlanWizard
        key={seasonId + ':' + (initialDraft.totalBudget || '')}
        initialDraft={initialDraft}
        categories={categoryItems}
        onSubmit={handleSubmit}
        submitting={saving}
      />
    </div>
  )
}
