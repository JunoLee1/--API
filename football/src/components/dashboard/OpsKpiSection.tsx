import { useState } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'
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
        className={`rounded-lg border p-4 text-center w-full cursor-pointer hover:opacity-90 transition-opacity ${card}`}
      >
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

const FINANCE_KPIS = (data: Record<string, number>): KpiItem[] => [
  { label: '회비 수납율', value: data['feeCollectionRate'] ?? 0, unit: '%', warnBelow: 80 },
  { label: '미납률', value: data['feeDelinquencyRate'] ?? 0, unit: '%', warnAbove: 10 },
  { label: '예산 집행률', value: data['budgetExecutionRate'] ?? 0, unit: '%', warnAbove: 90, dangerAbove: 100 },
  { label: '예외 승인 건수', value: data['overrideCount'] ?? 0, unit: '건', warnAbove: 0 },
  { label: '월말 정산 완료율', value: data['monthlySettlementRate'] ?? 0, unit: '%', warnBelow: 100 },
]

const HR_KPIS = (
  data: Record<string, number>,
  onAttendanceClick: () => void,
  onNoticeClick: () => void,
): KpiItem[] => [
  { label: '등록 완료율', value: data['registrationRate'] ?? 0, unit: '%', warnBelow: 90 },
  { label: '출석률 (프로)', value: data['attendanceRate'] ?? 0, unit: '%', warnBelow: 80, onClick: onAttendanceClick },
  { label: '공지 열람률', value: data['noticeReadRate'] ?? 0, unit: '%', warnBelow: 60, onClick: onNoticeClick },
]

function NoticeUnreadDrillTable({ items }: { items: NoticeUnreadDrillItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead className="text-right">미열람 건수</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={2} className="text-center text-muted-foreground">
              데이터가 없습니다
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

function AttendanceDrillTable({ items }: { items: AttendanceDrillItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>선수</TableHead>
          <TableHead className="text-right">출석</TableHead>
          <TableHead className="text-right">지각</TableHead>
          <TableHead className="text-right">무단결석</TableHead>
          <TableHead className="text-right">공결</TableHead>
          <TableHead className="text-right">실효결석</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              데이터가 없습니다
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
  )
}

export function OpsKpiSection({ role, data, year, month }: Props) {
  const [drill, setDrill] = useState<DrillType>(null)

  const { data: noticeUnreadData, isLoading: noticeLoading } = useQuery({
    queryKey: ['drill-notice-unread', year, month],
    queryFn: () => opsReportApi.getDrillNoticeUnread(year, month),
    enabled: drill === 'notice-unread',
  })

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['drill-attendance', year, month],
    queryFn: () => opsReportApi.getDrillAttendance(year, month),
    enabled: drill === 'attendance',
  })

  const isHr = role === 'HR_MANAGER'
  const kpis = isHr
    ? HR_KPIS(data, () => setDrill('attendance'), () => setDrill('notice-unread'))
    : FINANCE_KPIS(data)
  const title = isHr ? '운영 KPI' : '재무 KPI'
  const gridClass = kpis.length <= 3
    ? 'grid grid-cols-2 gap-3 sm:grid-cols-3'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'

  const sheetTitle = drill === 'notice-unread' ? '공지 미열람자 목록' : '선수별 출석 현황'
  const isLoading = drill === 'notice-unread' ? noticeLoading : attendanceLoading

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
                <p className="text-sm text-muted-foreground">불러오는 중...</p>
              ) : drill === 'notice-unread' ? (
                <NoticeUnreadDrillTable items={noticeUnreadData ?? []} />
              ) : drill === 'attendance' ? (
                <AttendanceDrillTable items={attendanceData ?? []} />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
