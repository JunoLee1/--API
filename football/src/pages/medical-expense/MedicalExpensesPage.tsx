import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { medicalExpenseApi } from '@/services/medical-expense.service'
import { reportApi } from '@/services/report.service'
import type { MedicalExpense } from '@/types/medical-expense'
import {
  EXPENSE_STATUS_STYLE,
} from '@/types/medical-expense'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, ClipboardList } from 'lucide-react'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatAmount(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export function MedicalExpensesPage() {
  const { t } = useTranslation('medical')
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState<MedicalExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [reportSheetOpen, setReportSheetOpen] = useState(false)
  const [reportTitle, setReportTitle] = useState('')
  const [reportContent, setReportContent] = useState('')
  const [reportSaving, setReportSaving] = useState(false)

  const isMedical =
    user?.coachingRole === 'MEDICAL' || user?.coachingRole === 'MEDICAL_DIRECTOR'

  const resetReportForm = () => { setReportTitle(''); setReportContent('') }

  const handleReportSave = async (andSubmit: boolean) => {
    if (!reportTitle.trim()) { toast.error(t('report.titleRequired')); return }
    if (!reportContent.trim()) { toast.error(t('report.contentRequired')); return }
    setReportSaving(true)
    try {
      const report = await reportApi.create({ type: 'MEDICAL', title: reportTitle.trim(), content: reportContent.trim() })
      if (andSubmit) {
        await reportApi.submit(report.id)
        toast.success(t('report.submitted'))
      } else {
        toast.success(t('report.draftSaved'))
      }
      setReportSheetOpen(false)
      resetReportForm()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('report.saveFailed'))
    } finally {
      setReportSaving(false)
    }
  }

  const fetchExpenses = useCallback(() => {
    setLoading(true)
    medicalExpenseApi
      .list()
      .then(setExpenses)
      .catch(() => toast.error(t('expense.loadFailed')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('expense.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMedical ? t('expense.subtitleMy') : t('expense.subtitleAll')}
          </p>
        </div>
        {isMedical && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setReportSheetOpen(true)}>
              <ClipboardList className="h-4 w-4 mr-1" />{t('expense.writeReportBtn')}
            </Button>
            <Button size="sm" onClick={() => navigate('/medical-expenses/new')}>
              <Plus className="h-4 w-4 mr-1" />{t('expense.addBtn')}
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('expense.noData')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-24">{t('expense.col.receiptDate')}</TableHead>
                <TableHead className="w-24">{t('expense.col.submitter')}</TableHead>
                <TableHead className="w-28">{t('expense.col.player')}</TableHead>
                <TableHead className="w-20">{t('expense.col.category')}</TableHead>
                <TableHead className="w-28 text-right">{t('expense.col.amount')}</TableHead>
                <TableHead className="w-20">{t('expense.col.payer')}</TableHead>
                <TableHead className="w-24">{t('expense.col.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow
                  key={e.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/medical-expenses/${e.id}`)}
                >
                  <TableCell className="tabular-nums">{formatDate(e.receiptDate)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.submittedBy.nickname}</TableCell>
                  <TableCell className="text-sm">
                    {e.player?.playerName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{t(`expense.costCategory.${e.costCategory}`)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatAmount(e.totalAmount)}
                  </TableCell>
                  <TableCell>{t(`expense.payerType.${e.payerType}`)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${EXPENSE_STATUS_STYLE[e.status]}`}>
                      {t(`expense.status.${e.status}`)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Sheet open={reportSheetOpen} onOpenChange={(v) => { setReportSheetOpen(v); if (!v) resetReportForm() }}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('report.title')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>{t('report.titleLabel')}</Label>
              <Input
                placeholder={t('report.titlePlaceholder')}
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('report.contentLabel')}</Label>
              <Textarea
                placeholder={t('report.contentPlaceholder')}
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleReportSave(false)} disabled={reportSaving}>
                {reportSaving ? t('report.saving') : t('report.saveDraft')}
              </Button>
              <Button className="flex-1" onClick={() => handleReportSave(true)} disabled={reportSaving}>
                {reportSaving ? t('report.submitting') : t('report.submit')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
