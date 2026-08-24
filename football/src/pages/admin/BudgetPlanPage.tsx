import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { budgetPlanApi } from '@/services/financial-report.service'
import { seasonApi } from '@/services/season.service'
import type { BudgetPlan } from '@/types/budget'
import type { WageCapKPI } from '@/types/season'
import { useExpenseCategories } from '@/hooks/useExpenseCategories'
import { BudgetPlanWizard } from '@/components/budget-plan/BudgetPlanWizard'
import type { CategoryPageItem } from '@/components/budget-plan/BudgetCategoryPage'
import { BudgetAdvancedPanel } from '@/components/budget-plan/BudgetAdvancedPanel'
import { AvailableBudgetCard } from '@/components/finance/AvailableBudgetCard'
import {
  serverToDraft,
  draftToPayload,
  type DraftBudgetPlan,
} from '@/components/budget-plan/types'
import { Skeleton } from '@/components/ui/skeleton'

export function BudgetPlanPage() {
  const { t } = useTranslation('admin')
  const { rows: categoryRows, loading: catLoading, labelOf } = useExpenseCategories()

  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [plan, setPlan] = useState<BudgetPlan | null>(null)
  const [initialDraft, setInitialDraft] = useState<DraftBudgetPlan | null>(null)
  const [kpi, setKpi] = useState<WageCapKPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Increment after every server reload so the wizard remounts with a fresh
  // draft (its internal useState is seeded from initialDraft only on mount).
  const [reloadCounter, setReloadCounter] = useState(0)

  const categoryCodes = useMemo(() => categoryRows.map((c) => c.code), [categoryRows])
  const categoryItems = useMemo<CategoryPageItem[]>(
    () => categoryRows.map((c) => ({ code: c.code, label: c.label })),
    [categoryRows]
  )

  const reloadPlan = useCallback(
    async (sid: number) => {
      const p = await budgetPlanApi.get(sid).catch(() => null)
      setPlan(p)
      setInitialDraft(serverToDraft(p, categoryCodes))
      setReloadCounter((n) => n + 1)
    },
    [categoryCodes]
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
        await reloadPlan(season.id)
        // KPI is a nice-to-have. Failing to load it must not block the wizard,
        // so swallow the error and leave the card unrendered.
        await seasonApi.getWageCapKPI().then(setKpi).catch(() => {})
      } catch {
        toast.error(t('budget.loadFailed'))
      } finally {
        setLoading(false)
      }
    })()
    // Deliberately re-run when category list finishes loading so serverToDraft
    // has the correct code list to seed empty entries.
  }, [catLoading, reloadPlan, t])

  const handleSubmit = async (draft: DraftBudgetPlan) => {
    if (!seasonId) return
    setSaving(true)
    try {
      await budgetPlanApi.save(seasonId, draftToPayload(draft))
      toast.success(t('budget.saved'))
      await reloadPlan(seasonId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('budget.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // Silent bulk save fired on wizard page navigation. Failures are swallowed
  // by the wizard so the flow keeps moving; user-facing toasts only come from
  // the final "완료 및 저장" submit above.
  //
  // Skip when totalOperatingBudget is not yet set — the backend rejects <= 0
  // with 400 INVALID_BUDGET, and there is nothing to persist for an empty
  // draft anyway. Real submit still runs through handleSubmit above.
  const handleAutoSave = useCallback(
    async (draft: DraftBudgetPlan) => {
      if (!seasonId) return
      const payload = draftToPayload(draft)
      if (payload.totalOperatingBudget <= 0) return
      await budgetPlanApi.save(seasonId, payload)
    },
    [seasonId]
  )

  const handleAdvancedMutated = useCallback(async () => {
    if (!seasonId) return
    await reloadPlan(seasonId)
  }, [seasonId, reloadPlan])

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
          시즌 카테고리별 배분 계획을 설정합니다. 세부 지출 라인은{' '}
          <Link to="/finance/budget" className="underline underline-offset-2">
            예산 관리
          </Link>
          에서 관리하세요.
        </p>
      </div>
      {kpi && <AvailableBudgetCard kpi={kpi} />}
      <BudgetPlanWizard
        key={`${seasonId}:${reloadCounter}`}
        initialDraft={initialDraft}
        categories={categoryItems}
        onSubmit={handleSubmit}
        onAutoSave={handleAutoSave}
        submitting={saving}
        renderAdvancedOnLastPage={() => (
          <BudgetAdvancedPanel
            seasonId={seasonId}
            plan={plan}
            categories={categoryRows}
            labelOf={labelOf}
            onServerMutated={handleAdvancedMutated}
          />
        )}
      />
    </div>
  )
}
