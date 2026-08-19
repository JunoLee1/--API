import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { settlementApi } from '@/services/monthlySettlement.service'
import type { MonthlySettlementDetail } from '@/types/monthly-settlement'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'
import { RevenueAdjustmentSheet, FIELD_LABELS } from '@/components/RevenueAdjustmentSheet'
import type { RevenueField } from '@/types/revenue-adjustment'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  PENDING_FIRST: '1차 결재 대기',
  FIRST_APPROVED: '1차 승인',
  APPROVED: '최종 승인',
  REJECTED: '반려',
}

const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  DRAFT: 'outline', PENDING_FIRST: 'secondary', FIRST_APPROVED: 'secondary',
  APPROVED: 'default', REJECTED: 'destructive',
}

export default function MonthlySettlementDetailPage() {
  const { year, month } = useParams<{ year: string; month: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [report, setReport] = useState<MonthlySettlementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [sheetField, setSheetField] = useState<RevenueField | null>(null)

  const isFinanceStaff = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'FINANCE_STAFF'
  const isFinanceManager = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'FINANCE_MANAGER'
  const isAdminLike = user?.role === 'ADMIN' || user?.role === 'GM' || user?.role === 'SUPER_ADMIN'
  const canReadFinance = isAdminLike || isFinanceManager || isFinanceStaff

  useEffect(() => {
    if (!year || !month) return
    // Load by listing and finding, or use getById if we stored the id
    // Since URL is /reports/monthly/:year/:month we need to list and find
    settlementApi.list()
      .then(list => {
        const found = list.find(s => s.year === Number(year) && s.month === Number(month))
        if (!found) { toast.error('결산 보고서를 찾을 수 없습니다.'); return undefined }
        return settlementApi.getById(found.id)
      })
      .then(detail => {
        if (detail) { setReport(detail); setNote(detail.note ?? '') }
      })
      .catch(() => toast.error('보고서를 불러올 수 없습니다.'))
      .finally(() => setLoading(false))
  }, [year, month])

  const refresh = async (id: number) => {
    const updated = await settlementApi.getById(id)
    setReport(updated)
    setNote(updated.note ?? '')
  }

  const act = async (fn: () => Promise<MonthlySettlementDetail>) => {
    if (!report) return
    setActing(true)
    try {
      const updated = await fn()
      setReport(updated)
      setNote(updated.note ?? '')
      toast.success('처리됐습니다.')
    } catch {
      toast.error('처리에 실패했습니다.')
    } finally {
      setActing(false)
    }
  }

  const handleSaveNote = async () => {
    if (!report) return
    await act(() => settlementApi.updateNote(report.id, note))
  }

  const handleReject = async () => {
    if (!report || !rejectReason.trim()) { toast.error('반려 사유를 입력하세요.'); return }
    await act(() => settlementApi.reject(report.id, rejectReason))
    setShowRejectInput(false)
    setRejectReason('')
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">불러오는 중...</div>
  if (!report || !canReadFinance) return <div className="p-6 text-sm text-muted-foreground">보고서를 찾을 수 없습니다.</div>

  const snap = report.snapshotJson
  const isEditable = report.status === 'DRAFT' || report.status === 'PENDING_FIRST'

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{report.year}년 {report.month}월 월말 결산</h1>
          <p className="text-sm text-muted-foreground">{report.season.name}</p>
        </div>
        <Badge variant={STATUS_VARIANT[report.status] ?? 'outline'}>
          {STATUS_LABEL[report.status] ?? report.status}
        </Badge>
      </div>

      {/* P&L 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">총수익</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold tabular-nums">{report.totalRevenue.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">총지출</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold tabular-nums">{report.totalExpense.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">순이익</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${report.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {report.netIncome.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 수익 현황 */}
      {snap.revenue && Object.keys(snap.revenue).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">수익 현황</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>카테고리</TableHead>
                  <TableHead className="text-right">금액(원)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(snap.revenue).map(([cat, amt]) => (
                  <TableRow
                    key={cat}
                    onClick={() => setSheetField(cat as RevenueField)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>{FIELD_LABELS[cat as RevenueField] ?? cat}</TableCell>
                    <TableCell className="text-right tabular-nums">{(amt as number).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 운영비 예산 vs 실적 */}
      {snap.budgetComparison && Object.keys(snap.budgetComparison).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">운영비 예산 vs 실적</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>카테고리</TableHead>
                  <TableHead className="text-right">예산(원)</TableHead>
                  <TableHead className="text-right">실적(원)</TableHead>
                  <TableHead className="text-right">잔액(원)</TableHead>
                  <TableHead className="w-16">초과</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(snap.budgetComparison).map(([cat, v]) => (
                  <TableRow key={cat}>
                    <TableCell>{cat}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.budget.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.actual.toLocaleString()}</TableCell>
                    <TableCell className={`text-right tabular-nums ${v.variance > 0 ? 'text-red-600' : ''}`}>
                      {v.variance.toLocaleString()}
                    </TableCell>
                    <TableCell>{v.variance > 0 ? <Badge variant="destructive" className="text-xs">초과</Badge> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 메모 */}
      <Card>
        <CardHeader><CardTitle className="text-base">메모</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            disabled={!isEditable || !canReadFinance}
            rows={3}
            placeholder="결산 관련 메모를 입력하세요"
          />
          {isEditable && canReadFinance && (
            <Button size="sm" variant="outline" onClick={() => void handleSaveNote()} disabled={acting}>
              저장
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 반려 사유 */}
      {report.status === 'REJECTED' && report.rejectionReason && (
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-base text-destructive">반려 사유</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{report.rejectionReason}</p></CardContent>
        </Card>
      )}

      {/* 결재 버튼 영역 */}
      <div className="flex flex-wrap gap-2">
        {/* FINANCE_STAFF: DRAFT → submit */}
        {(isFinanceStaff || isAdminLike) && report.status === 'DRAFT' && (
          <Button onClick={() => void act(() => settlementApi.submitFirst(report.id))} disabled={acting}>
            결재 상신
          </Button>
        )}

        {/* FINANCE_MANAGER: PENDING_FIRST → approve-first or reject */}
        {(isFinanceManager || isAdminLike) && report.status === 'PENDING_FIRST' && (
          <>
            <Button onClick={() => void act(() => settlementApi.approveFirst(report.id))} disabled={acting}>
              1차 승인
            </Button>
            <Button variant="destructive" onClick={() => setShowRejectInput(v => !v)} disabled={acting}>
              반려
            </Button>
          </>
        )}

        {/* GM/ADMIN: FIRST_APPROVED → approve or reject */}
        {isAdminLike && report.status === 'FIRST_APPROVED' && (
          <>
            <Button onClick={() => void act(() => settlementApi.approve(report.id))} disabled={acting}>
              최종 승인
            </Button>
            <Button variant="destructive" onClick={() => setShowRejectInput(v => !v)} disabled={acting}>
              반려
            </Button>
          </>
        )}

        {/* APPROVED: Excel download */}
        {report.status === 'APPROVED' && (
          <a href={settlementApi.exportUrl(report.id)} download>
            <Button variant="outline">Excel 다운로드</Button>
          </a>
        )}

        {/* REJECTED: regenerate */}
        {report.status === 'REJECTED' && (isFinanceStaff || isAdminLike) && (
          <Button
            variant="outline"
            onClick={() => void act(() => settlementApi.generate({
              seasonId: report.seasonId, year: report.year, month: report.month,
            }).then(d => { void refresh(report.id); return d }))}
            disabled={acting}
          >
            재생성
          </Button>
        )}
      </div>

      {/* 반려 사유 입력 */}
      {showRejectInput && (
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-base text-destructive">반려 사유 입력</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={2}
              placeholder="반려 사유를 입력하세요"
            />
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={() => void handleReject()} disabled={acting}>
                반려 확인
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowRejectInput(false); setRejectReason('') }}>
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 수익 드릴다운 시트 */}
      {sheetField && report && (
        <RevenueAdjustmentSheet
          open={sheetField !== null}
          onClose={() => setSheetField(null)}
          field={sheetField}
          fieldLabel={FIELD_LABELS[sheetField]}
          targetType="monthly"
          targetId={report.id}
          year={report.year}
          month={report.month}
          canAddAdjustment={isFinanceManager || isAdminLike}
        />
      )}
    </div>
  )
}
