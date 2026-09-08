// football/src/pages/budget/BudgetPage.tsx
import { Navigate, useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { BudgetPlanPage } from '@/pages/admin/BudgetPlanPage'
import BudgetListPage from '@/pages/finance/BudgetListPage'
import BudgetAutoPage from '@/pages/finance/BudgetAutoPage'

type Tab = 'plan' | 'execution' | 'auto'

const TABS: { id: Tab; label: string; adminOnly: boolean }[] = [
  { id: 'plan',      label: '편성 계획',   adminOnly: true  },
  { id: 'execution', label: '예산안 실행', adminOnly: false },
  { id: 'auto',      label: '자동 산출',   adminOnly: false },
]

export default function BudgetPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useCurrentUser()

  const canSeePlan = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'
  const defaultTab: Tab = canSeePlan ? 'plan' : 'execution'
  const rawTab = searchParams.get('tab') as Tab | null

  // 권한 없는 탭 접근 시 기본 탭으로 리다이렉트
  if (rawTab === 'plan' && !canSeePlan) {
    return <Navigate to={`/budget?tab=${defaultTab}`} replace />
  }

  const tab: Tab = rawTab ?? defaultTab
  const visibleTabs = TABS.filter(t => !t.adminOnly || canSeePlan)

  return (
    <div className="flex flex-col h-full">
      {/* 탭 헤더 */}
      <div className="border-b px-6 flex gap-0">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSearchParams({ tab: t.id })}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'plan'      && canSeePlan && <BudgetPlanPage />}
      {tab === 'execution' && <BudgetListPage />}
      {tab === 'auto'      && <BudgetAutoPage />}
    </div>
  )
}
