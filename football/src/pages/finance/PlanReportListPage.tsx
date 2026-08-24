import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  REVIEWING: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
}
const PLAN_TEMPLATE_TYPES: PlanTemplateType[] = ['GENERAL', 'HR', 'MARKETING', 'GOODS', 'SQUAD', 'MEDICAL', 'IT']

export function PlanReportListPage() {
  const { t } = useTranslation('finance')
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
        <h1 className="text-lg font-semibold tracking-tight">{t('planReport.title')}</h1>
        <Button size="sm" onClick={() => navigate('/finance/plan-reports/new')}>
          <Plus className="h-4 w-4 mr-1" />{t('planReport.add')}
        </Button>
      </div>

      <div className="px-6 py-3 border-b shrink-0 flex gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue>{filterType ? TEMPLATE_TYPE_LABELS[filterType as PlanTemplateType] : t('planReport.filter.allType')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" label={t('planReport.filter.allType')}>{t('planReport.filter.allType')}</SelectItem>
            {PLAN_TEMPLATE_TYPES.map(type => (
              <SelectItem key={type} value={type} label={TEMPLATE_TYPE_LABELS[type]}>{TEMPLATE_TYPE_LABELS[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue>{filterStatus ? t(`planReport.status.${filterStatus}`) : t('planReport.filter.allStatus')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" label={t('planReport.filter.allStatus')}>{t('planReport.filter.allStatus')}</SelectItem>
            {(['DRAFT', 'REVIEWING', 'APPROVED', 'REJECTED'] as const).map(v => (
              <SelectItem key={v} value={v} label={t(`planReport.status.${v}`)}>{t(`planReport.status.${v}`)}</SelectItem>
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
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">{t('planReport.empty')}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('planReport.table.title')}</TableHead>
                <TableHead className="w-24">{t('planReport.table.type')}</TableHead>
                <TableHead className="w-32">{t('planReport.table.department')}</TableHead>
                <TableHead className="w-32 tabular-nums">{t('planReport.table.budget')}</TableHead>
                <TableHead className="w-24">{t('planReport.table.status')}</TableHead>
                <TableHead className="w-24 text-muted-foreground">{t('planReport.table.createdAt')}</TableHead>
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
                      {t(`planReport.status.${p.status}`)}
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
