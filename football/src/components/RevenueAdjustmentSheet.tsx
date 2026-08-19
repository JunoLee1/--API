import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { revenueAdjustmentApi } from '@/services/revenueAdjustment.service'
import type { RevenueField, DrilldownResult, DrilldownLedgerEntry, RevenueAdjustment } from '@/types/revenue-adjustment'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const FIELD_LABELS: Record<RevenueField, string> = {
  TICKET: '입장권수익',
  SPONSORSHIP: '스폰서십수익',
  BROADCAST: '방송권수익',
  MERCHANDISE: '상품수익',
  SUBSIDY: '보조금수익',
  PARENT_COMPANY: '모기업지원',
  ACADEMY_FEE: '아카데미수익',
  OTHER: '기타수익',
}

// Fields that come from external data (no ledger entries)
const EXTERNAL_FIELDS: RevenueField[] = ['BROADCAST', 'SUBSIDY', 'PARENT_COMPANY']

interface RevenueAdjustmentSheetProps {
  open: boolean
  onClose: () => void
  field: RevenueField
  fieldLabel: string
  targetType: 'monthly' | 'financial'
  targetId: number
  year: number
  month?: number
  canAddAdjustment: boolean
}

export function RevenueAdjustmentSheet({
  open,
  onClose,
  field,
  fieldLabel,
  targetType,
  targetId,
  year,
  month,
  canAddAdjustment,
}: RevenueAdjustmentSheetProps) {
  const [result, setResult] = useState<DrilldownResult | null>(null)
  const [delta, setDelta] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const buildDrilldownParams = () => ({
    field,
    year,
    ...(month !== undefined && { month }),
    ...(targetType === 'monthly' ? { monthlyReportId: targetId } : { financialReportId: targetId }),
  })

  useEffect(() => {
    if (!open) return
    revenueAdjustmentApi
      .drilldown(buildDrilldownParams())
      .then(setResult)
      .catch(() => toast.error('드릴다운 데이터를 불러올 수 없습니다.'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, field, year, month, targetId, targetType])

  const handleSubmit = async () => {
    const deltaNum = Number(delta)
    if (!deltaNum || deltaNum === 0) {
      toast.error('금액을 입력하세요.')
      return
    }
    setSubmitting(true)
    try {
      await revenueAdjustmentApi.create({
        field,
        delta: deltaNum,
        memo: memo || undefined,
        ...(targetType === 'monthly' ? { monthlyReportId: targetId } : { financialReportId: targetId }),
      })
      toast.success('보정이 추가됐습니다.')
      setDelta('')
      setMemo('')
      const updated = await revenueAdjustmentApi.drilldown(buildDrilldownParams())
      setResult(updated)
    } catch {
      toast.error('보정 추가에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const adjustments: RevenueAdjustment[] =
    result?.adjustments ??
    (result?.type === 'adjustments' ? (result.items as RevenueAdjustment[]) : [])

  const ledgerItems: DrilldownLedgerEntry[] =
    result?.type === 'ledger' ? (result.items as DrilldownLedgerEntry[]) : []

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-[520px] max-w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{fieldLabel} 드릴다운</SheetTitle>
        </SheetHeader>

        <div className="px-5 py-4 space-y-6">
          {/* 원천 거래 목록 */}
          <section>
            <h3 className="text-sm font-semibold mb-2">원천 거래 목록</h3>
            {EXTERNAL_FIELDS.includes(field) ? (
              <p className="text-sm text-muted-foreground">외부 데이터 항목입니다</p>
            ) : result?.type === 'ledger' && ledgerItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead className="text-right">금액(원)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ko-KR') : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{item.description ?? item.category}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {Number(item.amountKrw).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">원천 거래 없음</p>
            )}
          </section>

          {/* 보정 내역 */}
          <section>
            <h3 className="text-sm font-semibold mb-2">보정 내역</h3>
            {adjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">보정 내역 없음</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead className="text-right">금액(원)</TableHead>
                    <TableHead>메모</TableHead>
                    <TableHead>작성자</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map(adj => (
                    <TableRow key={adj.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(adj.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className={`text-sm font-medium ${adj.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {adj.delta > 0 ? '+' : '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {Math.abs(adj.delta).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{adj.memo ?? '-'}</TableCell>
                      <TableCell className="text-sm">{adj.createdBy.username}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {/* 보정 추가 폼 */}
          {canAddAdjustment && (
            <section className="border rounded-md p-4 space-y-3">
              <h3 className="text-sm font-semibold">보정 추가</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    금액 (음수 입력 시 차감)
                  </label>
                  <Input
                    type="number"
                    placeholder="예: 500000 또는 -200000"
                    value={delta}
                    onChange={e => setDelta(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">메모 (선택)</label>
                  <Input
                    type="text"
                    placeholder="보정 사유"
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting}>
                  {submitting ? '처리 중...' : '보정 추가'}
                </Button>
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
