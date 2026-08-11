import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { planReportApi } from '@/services/plan-report.service'
import type { PlanReport, PlanTemplateType } from '@/types/plan-report'
import { TEMPLATE_TYPE_LABELS } from '@/types/plan-report'
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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중', REVIEWING: '검토중', APPROVED: '승인완료', REJECTED: '반려',
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  REVIEWING: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
}
const PLAN_TEMPLATE_TYPES: PlanTemplateType[] = ['GENERAL', 'HR', 'MARKETING', 'GOODS', 'SQUAD', 'MEDICAL', 'IT']

export function PlanReportListPage() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<PlanReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    setLoading(true)
    planReportApi.list({
      ...(filterStatus && { status: filterStatus }),
      ...(filterType && { templateType: filterType }),
    })
      .then(setPlans)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filterStatus, filterType])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">계획보고서</h1>
        <Button size="sm" onClick={() => navigate('/finance/plan-reports/new')}>
          <Plus className="h-4 w-4 mr-1" />새 보고서
        </Button>
      </div>

      <div className="px-6 py-3 border-b shrink-0 flex gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue>{filterType ? TEMPLATE_TYPE_LABELS[filterType as PlanTemplateType] : '전체 업무'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">전체 업무</SelectItem>
            {PLAN_TEMPLATE_TYPES.map(t => (
              <SelectItem key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue>{filterStatus ? STATUS_LABELS[filterStatus] : '전체 상태'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">전체 상태</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">보고서가 없습니다</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>사업명</TableHead>
                <TableHead className="w-24">업무</TableHead>
                <TableHead className="w-32">주관 부서</TableHead>
                <TableHead className="w-32 tabular-nums">예산</TableHead>
                <TableHead className="w-24">상태</TableHead>
                <TableHead className="w-24 text-muted-foreground">생성일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(p => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/finance/plan-reports/${p.id}`)}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-purple-100 text-purple-800 border-purple-200">
                      {TEMPLATE_TYPE_LABELS[p.templateType]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{p.department.name}</TableCell>
                  <TableCell className="text-sm tabular-nums">{p.budget.toLocaleString()}원</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.createdAt.slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
