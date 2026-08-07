import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'

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

type Status = 'danger' | 'warn' | 'ok'

function getStatus(item: KpiItem): Status {
  const { value, warnBelow, warnAbove, dangerAbove } = item
  if (dangerAbove !== undefined && value > dangerAbove) return 'danger'
  if (warnAbove !== undefined && value > warnAbove) return 'warn'
  if (warnBelow !== undefined && value < warnBelow) return 'warn'
  return 'ok'
}

const STATUS_STYLE: Record<Status, { card: string; text: string; Icon: React.ElementType }> = {
  danger: {
    card: 'border-red-200 bg-red-50',
    text: 'text-red-600',
    Icon: AlertCircle,
  },
  warn: {
    card: 'border-yellow-200 bg-yellow-50',
    text: 'text-yellow-700',
    Icon: AlertTriangle,
  },
  ok: {
    card: 'border-green-200 bg-green-50',
    text: 'text-green-700',
    Icon: CheckCircle2,
  },
}

function KpiCard(item: KpiItem) {
  const status = getStatus(item)
  const { card, text, Icon } = STATUS_STYLE[status]

  return (
    <div className={`rounded-lg border p-4 text-center ${card}`}>
      <div className="flex items-center justify-center gap-1 mb-1">
        <Icon className={`h-4 w-4 ${text}`} aria-hidden="true" />
        <p className={`text-2xl font-bold ${text}`}>{item.value.toLocaleString()}{item.unit}</p>
      </div>
      <p className="text-xs text-muted-foreground">{item.label}</p>
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
  const gridClass = kpis.length <= 3
    ? 'grid grid-cols-2 gap-3 sm:grid-cols-3'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className={gridClass}>
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>
    </div>
  )
}
