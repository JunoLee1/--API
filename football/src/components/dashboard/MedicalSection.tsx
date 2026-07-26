import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MedicalDashboardStats } from '@/types/dashboard'

interface Props {
  data: MedicalDashboardStats
  role: string | null | undefined
}

function KpiCard({
  label,
  value,
  unit,
  color = 'default',
}: {
  label: string
  value: number | string
  unit?: string
  color?: 'default' | 'red' | 'amber' | 'green' | 'blue'
}) {
  const valueClass =
    color === 'red' ? 'text-destructive' :
    color === 'amber' ? 'text-amber-500' :
    color === 'green' ? 'text-green-600' :
    color === 'blue' ? 'text-blue-600' :
    ''
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${valueClass}`}>
          {value}
          {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  )
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-sm text-right shrink-0 font-medium">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-sm text-right tabular-nums shrink-0">{count}</span>
    </div>
  )
}

export function MedicalSection({ data, role }: Props) {
  const { t } = useTranslation('common')
  const isHeadCoach = role === 'HEAD_COACH'
  const pos = data.injuriesByPosition
  const maxPos = Math.max(pos.GK, pos.DF, pos.MF, pos.FW, 1)
  const posEntries = ([
    ['GK', pos.GK],
    ['DF', pos.DF],
    ['MF', pos.MF],
    ['FW', pos.FW],
  ] as [string, number][]).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-6">
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {t('dashboard.medical.sectionTitle')}
        </h3>

        {/* 부상 현황 */}
        <div className="space-y-3 mb-6">
          <p className="text-xs font-medium text-muted-foreground">{t('dashboard.medical.injuryStatus')}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <KpiCard label={t('dashboard.medical.kpi.currentInjured')} value={data.currentInjuredCount} unit={t('dashboard.medical.kpi.unit.person')} color="red" />
            <KpiCard label={t('dashboard.medical.kpi.weekNewInjury')} value={data.weekNewInjuryCount} unit={t('dashboard.medical.kpi.unit.case')} color="amber" />
            <KpiCard label={t('dashboard.medical.kpi.returningIn7Days')} value={data.returningIn7DaysCount} unit={t('dashboard.medical.kpi.unit.person')} color="green" />
            {!isHeadCoach && (
              <KpiCard label={t('dashboard.medical.kpi.reinjuryRisk')} value={data.reinjuryRiskCount} unit={t('dashboard.medical.kpi.unit.person')} color="amber" />
            )}
          </div>
        </div>

        {/* 행정 현황 */}
        <div className="space-y-3 mb-6">
          <p className="text-xs font-medium text-muted-foreground">{t('dashboard.medical.adminStatus')}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {!isHeadCoach && (
              <KpiCard label={t('dashboard.medical.kpi.incompleteDoc')} value={data.incompleteDocCount} unit={t('dashboard.medical.kpi.unit.case')} color="amber" />
            )}
            <KpiCard label={t('dashboard.medical.kpi.pendingApproval')} value={data.pendingApprovalCount} unit={t('dashboard.medical.kpi.unit.case')} color="amber" />
            {!isHeadCoach && (
              <KpiCard
                label={t('dashboard.medical.kpi.avgRecoveryDays')}
                value={data.avgRecoveryDays != null ? data.avgRecoveryDays : '—'}
                unit={data.avgRecoveryDays != null ? t('dashboard.medical.kpi.unit.day') : undefined}
                color="blue"
              />
            )}
          </div>
        </div>

        {/* 포지션별 부상 추이 */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">{t('dashboard.medical.positionTrend')}</p>
          <div className="space-y-2 max-w-sm">
            {posEntries.map(([posLabel, count]) => (
              <BarRow key={posLabel} label={posLabel} count={count} max={maxPos} />
            ))}
            {posEntries.every(([, count]) => count === 0) && (
              <p className="text-sm text-muted-foreground">{t('dashboard.medical.noInjuryData')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
