import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { budgetControlApi } from '@/services/budgetControl.service'
import type { BudgetHeader, BudgetLine, AvailableBudget, BudgetStatus, AdjustmentType } from '@/types/budget-control'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ArrowLeft, Plus } from 'lucide-react'

const STATUS_LABEL: Record<BudgetStatus, string> = {
  DRAFT: '초안', SUBMITTED: '결재 중', APPROVED: '확정', LOCKED: '잠금',
}

const ADJ_LABEL: Record<AdjustmentType, string> = {
  CARRYOVER: '이월', INCREASE: '증액', DECREASE: '삭감', TRANSFER: '전용',
}

function AddLineDialog({ headerId, open, onOpenChange, onAdded }: {
  headerId: number; open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void
}) {
  const [category, setCategory] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!category || !year || !amount) { toast.error('카테고리, 연도, 금액을 입력하세요.'); return }
    setSaving(true)
    try {
      await budgetControlApi.addLine(headerId, {
        category,
        year: Number(year),
        month: month ? Number(month) : undefined,
        originalAmount: Number(amount.replace(/,/g, '')),
        note: note || undefined,
      })
      toast.success('예산 라인이 추가됐습니다.')
      onAdded()
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '추가 실패')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>예산 라인 추가</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>카테고리</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="예: TRAVEL, MEDICAL" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>연도</Label>
              <Input type="number" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>월 (선택)</Label>
              <Input type="number" value={month} onChange={e => setMonth(e.target.value)} min={1} max={12} placeholder="전체" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>금액 (원)</Label>
            <Input
              inputMode="numeric"
              value={amount ? Number(amount.replace(/,/g, '')).toLocaleString('ko-KR') : ''}
              onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="예: 10,000,000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>비고</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? '추가 중...' : '추가'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [header, setHeader] = useState<BudgetHeader | null>(null)
  const [available, setAvailable] = useState<AvailableBudget | null>(null)
  const [loading, setLoading] = useState(true)
  const [addLineOpen, setAddLineOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'FINANCE_MANAGER')

  const isDraft = header?.status === 'DRAFT'

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [h, av] = await Promise.all([
        budgetControlApi.getById(Number(id)),
        budgetControlApi.getAvailable(Number(id)),
      ])
      setHeader(h)
      setAvailable(av)
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [id])

  const handleSubmit = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      await budgetControlApi.submit(Number(id))
      toast.success('결재 요청됐습니다.')
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '실패')
    } finally { setSubmitting(false) }
  }

  const handleApprove = async () => {
    if (!id) return
    try {
      await budgetControlApi.approve(Number(id))
      toast.success('예산이 확정됐습니다.')
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '실패')
    }
  }

  const handleDeleteLine = async (line: BudgetLine) => {
    if (!id || !confirm(`"${line.category}" 라인을 삭제하시겠습니까?`)) return
    try {
      await budgetControlApi.deleteLine(Number(id), line.id)
      toast.success('삭제됐습니다.')
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">불러오는 중...</div>
  if (!header) return <div className="p-6 text-muted-foreground">예산을 찾을 수 없습니다.</div>

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/finance/budget')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{header.name}</h1>
            <Badge variant="outline">{STATUS_LABEL[header.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {header.season.name} · v{header.version} · 총 {header.totalBudget.toLocaleString()}원
          </p>
        </div>
        <div className="flex gap-2">
          {canWrite && isDraft && (
            <Button size="sm" variant="outline" onClick={handleSubmit} disabled={submitting}>
              결재 요청
            </Button>
          )}
          {canWrite && header.status === 'SUBMITTED' && (
            <Button size="sm" onClick={handleApprove}>확정</Button>
          )}
        </div>
      </div>

      {/* 가용예산 요약 */}
      {available && (
        <div className="border rounded-lg p-4 bg-muted/20">
          <h2 className="text-sm font-semibold mb-3">가용예산 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-muted-foreground">승인예산</p><p className="font-medium">{available.approvedBudget.toLocaleString()}원</p></div>
            <div><p className="text-muted-foreground">이월·증액</p><p className="font-medium text-green-600">+{(available.carryover + available.increase).toLocaleString()}원</p></div>
            <div><p className="text-muted-foreground">삭감·집행</p><p className="font-medium text-red-500">−{(available.decrease + available.commitment + available.actual).toLocaleString()}원</p></div>
            <div><p className="text-muted-foreground font-semibold">가용예산</p><p className="text-lg font-bold">{available.available.toLocaleString()}원</p></div>
          </div>
        </div>
      )}

      {/* 예산 라인 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">예산 라인</h2>
          {canWrite && isDraft && (
            <Button size="sm" onClick={() => setAddLineOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />라인 추가
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {header.lines.map(line => (
            <div key={line.id} className="border rounded p-3 flex items-center gap-3">
              <div className="flex-1">
                <span className="font-medium text-sm">{line.category}</span>
                <span className="text-muted-foreground text-xs ml-2">
                  {line.year}년 {line.month ? `${line.month}월` : '연간'}
                  {line.department ? ` · ${line.department.name}` : ''}
                </span>
              </div>
              <span className="font-medium text-sm">{line.originalAmount.toLocaleString()}원</span>
              {canWrite && isDraft && (
                <Button size="sm" variant="ghost" onClick={() => handleDeleteLine(line)} className="text-destructive hover:text-destructive">삭제</Button>
              )}
            </div>
          ))}
          {header.lines.length === 0 && <p className="text-sm text-muted-foreground">등록된 라인이 없습니다.</p>}
        </div>
      </div>

      {/* 조정 이력 */}
      <div>
        <h2 className="font-semibold mb-3">조정 이력</h2>
        <div className="space-y-2">
          {header.adjustments.map(adj => (
            <div key={adj.id} className="border rounded p-3 flex items-center gap-3 text-sm">
              <Badge variant="outline">{ADJ_LABEL[adj.type]}</Badge>
              <span className="flex-1">{adj.reason}</span>
              <span className="font-medium">{adj.amount.toLocaleString()}원</span>
              <Badge variant={adj.status === 'APPROVED' ? 'default' : adj.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                {adj.status === 'APPROVED' ? '승인' : adj.status === 'REJECTED' ? '반려' : '대기'}
              </Badge>
              {canWrite && adj.status === 'PENDING' && (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => budgetControlApi.approveAdjustment(header.id, adj.id).then(() => load())}>승인</Button>
                  <Button size="sm" variant="outline" onClick={() => budgetControlApi.rejectAdjustment(header.id, adj.id).then(() => load())}>반려</Button>
                </div>
              )}
            </div>
          ))}
          {header.adjustments.length === 0 && <p className="text-sm text-muted-foreground">조정 이력이 없습니다.</p>}
        </div>
      </div>

      {canWrite && isDraft && (
        <AddLineDialog headerId={header.id} open={addLineOpen} onOpenChange={setAddLineOpen} onAdded={load} />
      )}
    </div>
  )
}
