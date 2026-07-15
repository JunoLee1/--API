import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { medicalExpenseApi } from '@/services/medical-expense.service'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'

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

  const isMedical = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'MEDICAL'

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
          <Button size="sm" onClick={() => navigate('/medical-expenses/new')}>
            <Plus className="h-4 w-4 mr-1" />비용 등록
          </Button>
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
    </div>
  )
}
