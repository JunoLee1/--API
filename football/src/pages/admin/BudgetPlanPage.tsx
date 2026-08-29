import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { seasonApi } from '@/services/season.service'
import type { WageCapKPI } from '@/types/season'
import { useExpenseCategories } from '@/hooks/useExpenseCategories'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { BudgetPlanWizard } from '@/components/budget-plan/BudgetPlanWizard'
import { AvailableBudgetCard } from '@/components/finance/AvailableBudgetCard'
import {
  useFinancialReport,
  useBudgetPlan,
} from '@/services/budget-plan.service'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * BudgetPlanPage — 팀장/부서장 편성 요청 진입점.
 *
 * #427 이전 이 페이지는 FinanceManager 의 전체 편성 wizard (D&D + tier 편집 + advanced
 * panel) 였으나, ADR 0019 편성 워크플로우 도입으로 wizard 의 responsibility 가
 * 요청자 (팀장/부서장) 입력으로 재정의됐다. FM 의 sign-off/knapsack/finalize
 * UI 는 후속 이슈에서 별도 페이지 (예: finance/BudgetPlanReviewPage) 로 분리 예정.
 */
export function BudgetPlanPage() {
  const { t } = useTranslation('admin')
  const { rows: categoryRows, loading: catLoading } = useExpenseCategories()
  const { user: currentUser, loading: userLoading } = useCurrentUser()

  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [kpi, setKpi] = useState<WageCapKPI | null>(null)
  const [loading, setLoading] = useState(true)

  const { data: financialReport } = useFinancialReport(seasonId)
  const { data: budgetPlan } = useBudgetPlan(seasonId)

  useEffect(() => {
    void (async () => {
      try {
        const season = await seasonApi.active()
        if (!season) {
          setLoading(false)
          return
        }
        setSeasonId(season.id)
        await seasonApi.getWageCapKPI().then(setKpi).catch(() => {})
      } catch {
        toast.error(t('budget.loadFailed'))
      } finally {
        setLoading(false)
      }
    })()
  }, [t])

  if (loading || catLoading || userLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!seasonId) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">{t('budget.noActiveSeason')}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">{t('budget.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          시즌 편성 요청. 세부 지출 라인은{' '}
          <Link to="/finance/budget" className="underline underline-offset-2">
            예산 관리
          </Link>
          에서 관리하세요.
        </p>
      </div>
      {kpi && <AvailableBudgetCard kpi={kpi} />}
      <BudgetPlanWizard
        seasonId={seasonId}
        planStatus={financialReport?.planStatus}
        categories={categoryRows}
        budgetPlan={budgetPlan}
        currentUser={currentUser}
      />
    </div>
  )
}
