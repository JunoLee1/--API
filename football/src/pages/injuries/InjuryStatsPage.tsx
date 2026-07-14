import { useEffect, useState } from 'react'
import { injuryApi } from '@/services/injury.service'
import { Skeleton } from '@/components/ui/skeleton'
import { CAUSE_LABEL } from '@/types/injury'
import type { InjuryCause } from '@/types/injury'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { medicalExpenseApi } from '@/services/medical-expense.service'
import type { ExpenseCostCategory, ExpensePayerType } from '@/types/medical-expense'
import { COST_CATEGORY_LABEL, PAYER_TYPE_LABEL } from '@/types/medical-expense'
import { Plus } from 'lucide-react'

type Stats = {
  activeCount: number
  byBodyPart: Record<string, number>
  byCause: Record<string, number>
  avgRecoveryDays: number | null
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-right shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-sm text-right tabular-nums shrink-0">{count}</span>
    </div>
  )
}

export function InjuryStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user } = useCurrentUser()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [receiptDate, setReceiptDate] = useState('')
  const [costCategory, setCostCategory] = useState<ExpenseCostCategory>('OUTPATIENT')
  const [totalAmount, setTotalAmount] = useState('')
  const [payerType, setPayerType] = useState<ExpensePayerType>('CLUB')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | undefined>()

  const isMedical = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'MEDICAL'

  const resetForm = () => {
    setReceiptDate(''); setCostCategory('OUTPATIENT'); setTotalAmount('')
    setPayerType('CLUB'); setDescription(''); setFile(undefined)
  }

  const handleSave = async (andSubmit: boolean) => {
    if (!receiptDate || !totalAmount) { toast.error('날짜와 금액을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto = { receiptDate, costCategory, totalAmount: Number(totalAmount), payerType, description: description || undefined, file }
      const saved = await medicalExpenseApi.create(dto)
      if (andSubmit) {
        await medicalExpenseApi.submit(saved.id)
        toast.success('의료비가 상신됐습니다.')
      } else {
        toast.success('의료비 초안이 저장됐습니다.')
      }
      setSheetOpen(false)
      resetForm()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    injuryApi
      .stats()
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const bodyPartEntries = stats
    ? Object.entries(stats.byBodyPart).sort(([, a], [, b]) => b - a)
    : []
  const causeEntries = stats
    ? Object.entries(stats.byCause).sort(([, a], [, b]) => b - a)
    : []
  const maxBodyPart = bodyPartEntries[0]?.[1] ?? 1
  const maxCause = causeEntries[0]?.[1] ?? 1

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">부상 통계</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 부상 이력 집계</p>
        </div>
        {isMedical && (
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />의료비 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : stats ? (
          <div className="space-y-8 max-w-2xl">
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="현재 활성 부상" value={stats.activeCount} sub="복귀 완료 제외" />
              <StatCard
                label="평균 회복 기간"
                value={stats.avgRecoveryDays != null ? `${stats.avgRecoveryDays}일` : '—'}
                sub="예상 복귀일 기준"
              />
              <StatCard
                label="총 부상 기록"
                value={bodyPartEntries.reduce((s, [, n]) => s + n, 0)}
                sub="전체 이력"
              />
            </div>

            {/* 부위별 */}
            {bodyPartEntries.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">부상 부위별</h2>
                <div className="space-y-2">
                  {bodyPartEntries.map(([part, count]) => (
                    <BarRow key={part} label={part} count={count} max={maxBodyPart} />
                  ))}
                </div>
              </div>
            )}

            {/* 원인별 */}
            {causeEntries.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">발생 원인별</h2>
                <div className="space-y-2">
                  {causeEntries.map(([cause, count]) => (
                    <BarRow
                      key={cause}
                      label={CAUSE_LABEL[cause as InjuryCause] ?? cause}
                      count={count}
                      max={maxCause}
                    />
                  ))}
                </div>
              </div>
            )}

            {bodyPartEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">부상 데이터가 없습니다.</p>
            )}
          </div>
        ) : null}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) resetForm() }}>
        <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>의료비 등록</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>영수증 날짜 *</Label>
              <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>비용 항목 *</Label>
              <Select value={costCategory} onValueChange={(v) => setCostCategory(v as ExpenseCostCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['OUTPATIENT', 'EXAMINATION', 'SURGERY', 'REHABILITATION', 'MEDICATION'] as ExpenseCostCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>{COST_CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>금액 (원) *</Label>
              <Input type="number" min={0} placeholder="예: 50000" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>납부 주체 *</Label>
              <Select value={payerType} onValueChange={(v) => setPayerType(v as ExpensePayerType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['CLUB', 'ASSOCIATION', 'INDIVIDUAL'] as ExpensePayerType[]).map((p) => (
                    <SelectItem key={p} value={p}>{PAYER_TYPE_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>비고</Label>
              <Textarea placeholder="추가 설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>영수증 파일 (선택)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0])} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? '저장 중...' : '임시 저장'}
              </Button>
              <Button className="flex-1" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? '처리 중...' : '상신'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
