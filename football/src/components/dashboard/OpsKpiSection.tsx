interface KpiItem {
  label: string
  value: number
  unit: string
  warnBelow?: number
  warnAbove?: number
  dangerAbove?: number
}

interface Props {
  role: 'FINANCE_MANAGER' | 'HR_MANAGER' | 'ADMIN'
  data: Record<string, number>
}

function KpiCard({ label, value, unit, warnBelow, warnAbove, dangerAbove }: KpiItem) {
  const color =
    (dangerAbove !== undefined && value > dangerAbove) ? 'text-red-600' :
    (warnAbove !== undefined && value > warnAbove) ? 'text-yellow-600' :
    (warnBelow !== undefined && value < warnBelow) ? 'text-yellow-600' :
    'text-green-600'

  return (
    <div className="rounded-lg border p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}{unit}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

const FINANCE_KPIS = (data: Record<string, number>): KpiItem[] => [
  { label: '회비 수납율', value: data['feeCollectionRate'] ?? 0, unit: '%', warnBelow: 80 },
  { label: '미납률', value: data['feeDelinquencyRate'] ?? 0, unit: '%', warnAbove: 10 },
  { label: '예산 집행률', value: data['budgetExecutionRate'] ?? 0, unit: '%', warnAbove: 90, dangerAbove: 100 },
  { label: '예외 승인 건수', value: data['overrideCount'] ?? 0, unit: '건', warnAbove: 0 },
  { label: '월말 정산 완료율', value: data['monthlySettlementRate'] ?? 0, unit: '%', warnBelow: 100 },
]

const HR_KPIS = (data: Record<string, number>): KpiItem[] => [
  { label: '등록 완료율', value: data['registrationRate'] ?? 0, unit: '%', warnBelow: 90 },
  { label: '출석률 (프로)', value: data['attendanceRate'] ?? 0, unit: '%', warnBelow: 80 },
  { label: '공지 열람률', value: data['noticeReadRate'] ?? 0, unit: '%', warnBelow: 60 },
]

export function OpsKpiSection({ role, data }: Props) {
  const kpis = role === 'HR_MANAGER' ? HR_KPIS(data) : FINANCE_KPIS(data)
  const title = role === 'HR_MANAGER' ? '운영 KPI' : '재무 KPI'

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>
    </div>
  )
}
