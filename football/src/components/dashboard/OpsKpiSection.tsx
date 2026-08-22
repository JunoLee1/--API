import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { opsReportApi } from '@/services/ops-report.service'
import type { NoticeUnreadDrillItem, AttendanceDrillItem } from '@/types/ops-report'

interface KpiItem {
  label: string
  value: number
  unit: string
  warnBelow?: number
  warnAbove?: number
  dangerAbove?: number
  onClick?: () => void
}

interface Props {
  role: 'FINANCE_MANAGER' | 'HR_MANAGER' | 'ADMIN'
  data: Record<string, number>
  year: number
  month: number
}

type Status = 'danger' | 'warn' | 'ok'
type DrillType = 'notice-unread' | 'attendance' | null

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
  const clickable = !!item.onClick

  if (clickable) {
    return (
      <button
        type="button"
        onClick={item.onClick}
        aria-label={`${item.label} 상세 보기`}
        className={`relative rounded-lg border p-4 text-center w-full cursor-pointer hover:opacity-90 transition-opacity ${card}`}
      >
        <ChevronRight className="absolute top-2 right-2 h-3 w-3 text-muted-foreground" aria-hidden="true" />
        <div className="flex items-center justify-center gap-1 mb-1">
          <Icon className={`h-4 w-4 ${text}`} aria-hidden="true" />
          <p className={`text-2xl font-bold ${text}`}>{item.value.toLocaleString()}{item.unit}</p>
        </div>
        <p className="text-xs text-muted-foreground">{item.label}</p>
      </button>
    )
  }

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

const FINANCE_KPIS = (data: Record<string, number>, t: (k: string) => string): KpiItem[] => [
  { label: t('dashboard.opsKpi.feeCollectionRate'), value: data['feeCollectionRate'] ?? 0, unit: '%', warnBelow: 80 },
  { label: t('dashboard.opsKpi.feeDelinquencyRate'), value: data['feeDelinquencyRate'] ?? 0, unit: '%', warnAbove: 10 },
  { label: t('dashboard.opsKpi.budgetExecutionRate'), value: data['budgetExecutionRate'] ?? 0, unit: '%', warnAbove: 90, dangerAbove: 100 },
  { label: t('dashboard.opsKpi.overrideCount'), value: data['overrideCount'] ?? 0, unit: t('dashboard.opsKpi.overrideUnit'), warnAbove: 0 },
  { label: t('dashboard.opsKpi.monthlySettlementRate'), value: data['monthlySettlementRate'] ?? 0, unit: '%', warnBelow: 100 },
]

const HR_KPIS = (
  data: Record<string, number>,
  t: (k: string) => string,
  onAttendanceClick: () => void,
  onNoticeClick: () => void,
): KpiItem[] => [
  { label: t('dashboard.opsKpi.registrationRate'), value: data['registrationRate'] ?? 0, unit: '%', warnBelow: 90 },
  { label: t('dashboard.opsKpi.attendanceRate'), value: data['attendanceRate'] ?? 0, unit: '%', warnBelow: 80, onClick: onAttendanceClick },
  { label: t('dashboard.opsKpi.noticeReadRate'), value: data['noticeReadRate'] ?? 0, unit: '%', warnBelow: 60, onClick: onNoticeClick },
]

function NoticeUnreadDrillTable({ items, t }: { items: NoticeUnreadDrillItem[]; t: (k: string) => string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('dashboard.opsKpi.drillCol.name')}</TableHead>
          <TableHead className="text-right">{t('dashboard.opsKpi.drillCol.unreadCount')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={2} className="text-center text-muted-foreground">
              {t('dashboard.opsKpi.drillCol.noData')}
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow key={item.userId}>
              <TableCell>{item.name}</TableCell>
              <TableCell className="text-right">{item.unreadCount.toLocaleString()}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

function AttendanceDrillTable({ items, t }: { items: AttendanceDrillItem[]; t: (k: string) => string }) {
  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('dashboard.opsKpi.drillCol.player')}</TableHead>
          <TableHead className="text-right">{t('dashboard.opsKpi.drillCol.present')}</TableHead>
          <TableHead className="text-right">{t('dashboard.opsKpi.drillCol.lateUnauth')}</TableHead>
          <TableHead className="text-right">{t('dashboard.opsKpi.drillCol.absentUnauth')}</TableHead>
          <TableHead className="text-right">{t('dashboard.opsKpi.drillCol.authorizedAbsence')}</TableHead>
          <TableHead className="text-right">{t('dashboard.opsKpi.drillCol.effectiveAbsences')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              {t('dashboard.opsKpi.drillCol.noData')}
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow key={item.playerId}>
              <TableCell>{item.playerName}</TableCell>
              <TableCell className="text-right">{item.present}</TableCell>
              <TableCell className="text-right">{item.lateUnauth}</TableCell>
              <TableCell className="text-right">{item.absentUnauth}</TableCell>
              <TableCell className="text-right">{item.authorizedAbsence}</TableCell>
              <TableCell className="text-right">{item.effectiveAbsences}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
    </div>
  )
}

export function OpsKpiSection({ role, data, year, month }: Props) {
  const { t } = useTranslation('common')
  const [drill, setDrill] = useState<DrillType>(null)

  const { data: noticeUnreadData, isLoading: noticeLoading, isError: noticeError } = useQuery({
    queryKey: ['drill-notice-unread', year, month],
    queryFn: () => opsReportApi.getDrillNoticeUnread(year, month),
    enabled: drill === 'notice-unread',
  })

  const { data: attendanceData, isLoading: attendanceLoading, isError: attendanceError } = useQuery({
    queryKey: ['drill-attendance', year, month],
    queryFn: () => opsReportApi.getDrillAttendance(year, month),
    enabled: drill === 'attendance',
  })

  const isHr = role === 'HR_MANAGER'
  const kpis = isHr
    ? HR_KPIS(data, t, () => setDrill('attendance'), () => setDrill('notice-unread'))
    : FINANCE_KPIS(data, t)
  const title = isHr
    ? t('dashboard.opsKpi.hrTitle', { year, month })
    : t('dashboard.opsKpi.financeTitle', { year, month })
  const gridClass = kpis.length <= 3
    ? 'grid grid-cols-2 gap-3 sm:grid-cols-3'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'

  const sheetTitle =
    drill === 'notice-unread' ? t('dashboard.opsKpi.noticeUnreadTitle') :
    drill === 'attendance' ? t('dashboard.opsKpi.attendanceDrillTitle') : ''
  const isLoading = drill === 'notice-unread' ? noticeLoading : attendanceLoading
  const isError = drill === 'notice-unread' ? noticeError : attendanceError

  return (
    <>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className={gridClass}>
          {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </div>
      </div>

      {isHr && (
        <Sheet open={drill !== null} onOpenChange={(open) => { if (!open) setDrill(null) }}>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{sheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : isError ? (
                <p className="text-sm text-destructive py-4 text-center">{t('dashboard.opsKpi.drillCol.loadFailed')}</p>
              ) : drill === 'notice-unread' ? (
                <NoticeUnreadDrillTable items={noticeUnreadData ?? []} t={t} />
              ) : drill === 'attendance' ? (
                <AttendanceDrillTable items={attendanceData ?? []} t={t} />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
