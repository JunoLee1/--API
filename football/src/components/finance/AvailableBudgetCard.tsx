import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WageCapKPI } from '@/types/season'

interface Props {
  kpi: WageCapKPI
  showOverrideButton?: boolean
  onOverride?: () => void
}

const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(Math.round(n))

/**
 * Shared "가용 예산" (available budget) KPI card.
 * Formula: (수익 + 전년도 이월금) − (선수 급여 + 직원 급여). Planned+Actual side-by-side.
 * Rendered on Dashboard, FinancialReportPage, and the last page of BudgetPlanWizard.
 */
export function AvailableBudgetCard({ kpi, showOverrideButton, onOverride }: Props) {
  const avail = kpi.availableBudget
  const co = kpi.carryOverFromPrev
  const rev = kpi.revenue
  const ps = kpi.playerSalary
  const ss = kpi.staffSalary
  if (!avail || !co || !rev || !ps || !ss) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          가용 예산 데이터 없음
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">가용 예산</CardTitle>
        {co.isAutoCalculated ? (
          <Badge variant="outline" className="text-xs">이월 자동</Badge>
        ) : (
          <Badge className="text-xs">이월 수동 조정</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">계획 (Planned)</div>
            <div className={`text-xl font-mono ${avail.planned < 0 ? 'text-red-600' : ''}`}>
              ₩{fmt(avail.planned)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">실측 (Actual)</div>
            <div className={`text-xl font-mono ${avail.actual < 0 ? 'text-red-600' : ''}`}>
              ₩{fmt(avail.actual)}
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
          <div>수익: 계획 ₩{fmt(rev.planned)} / 실측 ₩{fmt(rev.actual)}</div>
          <div>
            이월금: ₩{fmt(co.amount)}
            {co.overriddenAt && co.overrideReason ? <> ({co.overrideReason})</> : null}
          </div>
          <div>선수 급여: ₩{fmt(ps.planned)}</div>
          <div>직원 급여: 계획 ₩{fmt(ss.planned)} / 실측 ₩{fmt(ss.actual)}</div>
        </div>
        {showOverrideButton && onOverride && (
          <button
            type="button"
            className="w-full text-xs text-primary underline mt-2"
            onClick={onOverride}
          >
            이월금 수동 조정
          </button>
        )}
      </CardContent>
    </Card>
  )
}
