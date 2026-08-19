import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { settlementApi } from '@/services/monthlySettlement.service'
import type { MonthlySettlementSummary } from '@/types/monthly-settlement'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'

const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  DRAFT: 'outline',
  PENDING_FIRST: 'secondary',
  FIRST_APPROVED: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  PENDING_FIRST: '1차 결재 대기',
  FIRST_APPROVED: '1차 승인',
  APPROVED: '최종 승인',
  REJECTED: '반려',
}

export function MonthlySettlementTab() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [settlements, setSettlements] = useState<MonthlySettlementSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const canGenerate =
    user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' &&
      (user.frontOfficeRole === 'FINANCE_MANAGER' || user.frontOfficeRole === 'FINANCE_STAFF'))

  useEffect(() => {
    settlementApi.list()
      .then(setSettlements)
      .catch(() => toast.error('월말 결산 목록을 불러올 수 없습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()

  const handleGenerate = async () => {
    // Generate for previous month (same logic as cron)
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

    // We need a seasonId — use the first settlement's seasonId or ask user
    // If no settlements exist yet, we can't auto-generate without seasonId
    // Use the most recent settlement's seasonId if available
    const seasonId = settlements[0]?.seasonId
    if (!seasonId) {
      toast.error('시즌 정보가 없습니다. 백엔드 Cron이 먼저 실행되어야 합니다.')
      return
    }

    setGenerating(true)
    try {
      const report = await settlementApi.generate({ seasonId, year: prevYear, month: prevMonth })
      setSettlements(prev => {
        const exists = prev.find(s => s.id === report.id)
        if (exists) return prev.map(s => s.id === report.id ? { ...s, ...report } : s)
        return [report, ...prev]
      })
      toast.success(`${prevYear}년 ${prevMonth}월 결산 초안이 생성됐습니다.`)
    } catch {
      toast.error('보고서 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">불러오는 중...</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-semibold">월말 결산</h2>
          <p className="text-xs text-muted-foreground mt-0.5">월별 수익·운영비·P&amp;L 자동 집계 및 3단계 전자결재</p>
        </div>
        {canGenerate && (
          <Button size="sm" variant="outline" onClick={() => void handleGenerate()} disabled={generating}>
            <Plus className="h-4 w-4 mr-1" />
            {generating ? '생성 중...' : '결산 초안 생성'}
          </Button>
        )}
      </div>

      {settlements.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          월말 결산 보고서가 없습니다.
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>기간</TableHead>
                <TableHead className="w-32">상태</TableHead>
                <TableHead className="w-32 text-right">총수익</TableHead>
                <TableHead className="w-32 text-right">총지출</TableHead>
                <TableHead className="w-32 text-right">순이익</TableHead>
                <TableHead className="w-24 text-muted-foreground">작성자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/reports/monthly/${s.year}/${s.month}`)}
                >
                  <TableCell className="font-medium">{s.year}년 {s.month}월</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[s.status] ?? 'outline'}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.totalRevenue.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.totalExpense.toLocaleString()}</TableCell>
                  <TableCell className={`text-right tabular-nums ${s.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {s.netIncome.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.createdBy.username}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
