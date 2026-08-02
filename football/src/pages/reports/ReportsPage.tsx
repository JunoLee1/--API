import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { reportApi } from '@/services/report.service'
import type { Report, ReportType, ReportStatus } from '@/types/report'
import {
  REPORT_TYPE_STYLE,
  REPORT_STATUS_STYLE,
} from '@/types/report'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'

const ALL_TYPES: ReportType[] = ['PERFORMANCE', 'MEDICAL', 'TRAINING', 'HR', 'FINANCIAL']
const ALL_STATUSES: ReportStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']
const PAGE_SIZE = 10

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

const FO_CREATE_ROLES = ['GM', 'HR_MANAGER', 'FINANCE_MANAGER']

export function ReportsPage() {
  const { t } = useTranslation('report')
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState<ReportType | ''>('')
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('')
  const [page, setPage] = useState(1)

  const isGM = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'GM'
  const isHeadCoach = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'HEAD_COACH'
  const canCreate =
    user?.role === 'ADMIN' ||
    user?.role === 'COACHING_STAFF' ||
    (user?.role === 'FRONT_OFFICE' && FO_CREATE_ROLES.includes(user.frontOfficeRole ?? ''))

  const fetchReports = useCallback(() => {
    setLoading(true)
    setPage(1)
    reportApi
      .list({ type: typeFilter || undefined, status: statusFilter || undefined })
      .then(setReports)
      .catch(() => toast.error(t('page.loadFailed')))
      .finally(() => setLoading(false))
  }, [t, typeFilter, statusFilter])

  useEffect(() => { fetchReports() }, [fetchReports])

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = reports.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // 역할에 따른 설명 문구
  const descText = isGM
    ? 'GM 결재 대기 보고서 포함 전체 목록'
    : isHeadCoach
    ? '훈련 보고서 결재 대기 포함 목록'
    : '내가 작성한 보고서 목록'

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t('page.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{descText}</p>
          </div>
          {canCreate && (
            <Button size="sm" onClick={() => navigate('/reports/new')}>
              <Plus className="h-4 w-4 mr-1" />{t('page.addButton')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ReportType | '')}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder={t('page.col.type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('page.filterAll')}</SelectItem>
              {ALL_TYPES.map((tp) => (
                <SelectItem key={tp} value={tp}>{t(`type.${tp}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReportStatus | '')}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder={t('page.col.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('page.filterAll')}</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('page.noData')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('page.col.title')}</TableHead>
                <TableHead className="w-20">{t('page.col.type')}</TableHead>
                <TableHead className="w-24">{t('page.col.status')}</TableHead>
                <TableHead className="w-24 text-muted-foreground">{t('page.col.author')}</TableHead>
                <TableHead className="w-24 tabular-nums text-muted-foreground">{t('page.col.created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/reports/${r.id}`)}
                >
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${REPORT_TYPE_STYLE[r.type]}`}>
                      {t(`type.${r.type}`)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${REPORT_STATUS_STYLE[r.status]}`}>
                      {t(`status.${r.status}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.author.nickname}</TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">{formatDate(r.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {!loading && reports.length > PAGE_SIZE && (
        <div className="border-t px-6 py-3 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, reports.length)} / {reports.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs tabular-nums px-1">{safePage} / {totalPages}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
