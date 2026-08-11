import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { planReportApi } from '@/services/plan-report.service'
import type { PlanReport, PlanTemplateType, PlanStatus } from '@/types/plan-report'
import { TEMPLATE_TYPE_LABELS } from '@/types/plan-report'
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
import { Plus } from 'lucide-react'

const STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: '작성중',
  REVIEWING: '검토중',
  APPROVED: '승인',
  REJECTED: '반려',
}

const STATUS_COLORS: Record<PlanStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  REVIEWING: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const TEMPLATE_TYPES: PlanTemplateType[] = ['GENERAL', 'HR', 'MARKETING', 'GOODS', 'SQUAD', 'MEDICAL', 'IT']
const STATUS_TYPES: PlanStatus[] = ['DRAFT', 'REVIEWING', 'APPROVED', 'REJECTED']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export function PlanReportListPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const canCreate = user?.role === 'ADMIN' || (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'GM')

  const [plans, setPlans] = useState<PlanReport[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<PlanTemplateType | ''>('')
  const [statusFilter, setStatusFilter] = useState<PlanStatus | ''>('')

  const fetchPlans = useCallback(() => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (typeFilter) params.templateType = typeFilter
    if (statusFilter) params.status = statusFilter

    planReportApi.list(params)
      .then(setPlans)
      .catch(() => toast.error('계획보고서 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [typeFilter, statusFilter])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">계획보고서</h1>
        {canCreate && (
          <Button size="sm" onClick={() => navigate('/finance/plan-reports/new')}>
            <Plus className="h-4 w-4 mr-1" />새 보고서
          </Button>
        )}
      </div>

      <div className="px-6 py-3 border-b shrink-0 flex gap-3">
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as PlanTemplateType | ''); }}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue>
              {typeFilter ? TEMPLATE_TYPE_LABELS[typeFilter] : '전체 업무'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">전체 업무</SelectItem>
            {TEMPLATE_TYPES.map((tp) => (
              <SelectItem key={tp} value={tp}>{TEMPLATE_TYPE_LABELS[tp]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as PlanStatus | ''); }}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue>
              {statusFilter ? STATUS_LABELS[statusFilter] : '전체 상태'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">전체 상태</SelectItem>
            {STATUS_TYPES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            보고서가 없습니다
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>보고서명</TableHead>
                <TableHead className="w-24">업무</TableHead>
                <TableHead className="w-32">주관부서</TableHead>
                <TableHead className="w-32 tabular-nums text-right">예산</TableHead>
                <TableHead className="w-24">상태</TableHead>
                <TableHead className="w-28 tabular-nums">생성일</TableHead>
                <TableHead className="w-24 text-muted-foreground">작성자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/finance/plan-reports/${p.id}`)}
                >
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-sm">{TEMPLATE_TYPE_LABELS[p.templateType]}</TableCell>
                  <TableCell className="text-sm">{p.department.name}</TableCell>
                  <TableCell className="text-sm tabular-nums text-right">{formatCurrency(p.budget)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.createdBy.username}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
