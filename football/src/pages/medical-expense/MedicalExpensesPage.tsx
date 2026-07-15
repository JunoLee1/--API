import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { medicalExpenseApi } from '@/services/medical-expense.service'
import { reportApi } from '@/services/report.service'
import type { MedicalExpense } from '@/types/medical-expense'
import {
  COST_CATEGORY_LABEL,
  PAYER_TYPE_LABEL,
  EXPENSE_STATUS_LABEL,
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
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState<MedicalExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [reportSheetOpen, setReportSheetOpen] = useState(false)
  const [reportTitle, setReportTitle] = useState('')
  const [reportContent, setReportContent] = useState('')
  const [reportSaving, setReportSaving] = useState(false)

  const isMedical = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'MEDICAL'

  const resetReportForm = () => { setReportTitle(''); setReportContent('') }

  const handleReportSave = async (andSubmit: boolean) => {
    if (!reportTitle.trim()) { toast.error('제목을 입력해주세요.'); return }
    if (!reportContent.trim()) { toast.error('내용을 입력해주세요.'); return }
    setReportSaving(true)
    try {
      const report = await reportApi.create({ type: 'MEDICAL', title: reportTitle.trim(), content: reportContent.trim() })
      if (andSubmit) {
        await reportApi.submit(report.id)
        toast.success('의무보고서가 상신됐습니다.')
      } else {
        toast.success('의무보고서 초안이 저장됐습니다.')
      }
      setReportSheetOpen(false)
      resetReportForm()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setReportSaving(false)
    }
  }

  const fetchExpenses = useCallback(() => {
    setLoading(true)
    medicalExpenseApi
      .list()
      .then(setExpenses)
      .catch(() => toast.error('의료비 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">의료비 결재</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMedical ? '내가 신청한 의료비 목록' : '전체 의료비 결재 목록'}
          </p>
        </div>
        {isMedical && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setReportSheetOpen(true)}>
              <ClipboardList className="h-4 w-4 mr-1" />의무보고서 작성
            </Button>
            <Button size="sm" onClick={() => navigate('/medical-expenses/new')}>
              <Plus className="h-4 w-4 mr-1" />비용 등록
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
            등록된 의료비 내역이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-24">영수증 날짜</TableHead>
                <TableHead className="w-24">신청자</TableHead>
                <TableHead className="w-28">대상 선수</TableHead>
                <TableHead className="w-20">항목</TableHead>
                <TableHead className="w-28 text-right">금액</TableHead>
                <TableHead className="w-20">납부주체</TableHead>
                <TableHead className="w-24">상태</TableHead>
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
                  <TableCell>{COST_CATEGORY_LABEL[e.costCategory]}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatAmount(e.totalAmount)}
                  </TableCell>
                  <TableCell>{PAYER_TYPE_LABEL[e.payerType]}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${EXPENSE_STATUS_STYLE[e.status]}`}>
                      {EXPENSE_STATUS_LABEL[e.status]}
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
            <SheetTitle>의무보고서 작성</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>제목 *</Label>
              <Input
                placeholder="예: 2026-07 의료 현황 보고"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>내용 *</Label>
              <Textarea
                placeholder="의료 현황, 의견, 조치 사항 등을 입력해주세요."
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleReportSave(false)} disabled={reportSaving}>
                {reportSaving ? '저장 중...' : '임시 저장'}
              </Button>
              <Button className="flex-1" onClick={() => handleReportSave(true)} disabled={reportSaving}>
                {reportSaving ? '처리 중...' : '상신'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
