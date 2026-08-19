import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { budgetControlApi } from '@/services/budgetControl.service'
import type { BudgetHeaderSummary, BudgetStatus } from '@/types/budget-control'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Plus } from 'lucide-react'

const STATUS_VARIANT: Record<BudgetStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline', SUBMITTED: 'secondary', APPROVED: 'default', LOCKED: 'destructive',
}

const STATUS_LABEL: Record<BudgetStatus, string> = {
  DRAFT: '초안', SUBMITTED: '결재 중', APPROVED: '확정', LOCKED: '잠금',
}

function CreateBudgetDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void
}) {
  const [seasonId, setSeasonId] = useState('')
  const [name, setName] = useState('')
  const [totalBudget, setTotalBudget] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!seasonId || !name || !totalBudget) { toast.error('모든 필드를 입력하세요.'); return }
    setSaving(true)
    try {
      await budgetControlApi.create({
        seasonId: Number(seasonId),
        name,
        totalBudget: Number(totalBudget.replace(/,/g, '')),
      })
      toast.success('예산이 등록됐습니다.')
      onCreated()
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '등록 실패')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>예산 편성</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>시즌 ID</Label>
            <Input type="number" value={seasonId} onChange={e => setSeasonId(e.target.value)} placeholder="예: 3" />
          </div>
          <div className="space-y-1.5">
            <Label>예산명</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="예: 2026시즌 운영예산" />
          </div>
          <div className="space-y-1.5">
            <Label>총 승인예산 (원)</Label>
            <Input
              inputMode="numeric"
              value={totalBudget ? Number(totalBudget.replace(/,/g, '')).toLocaleString('ko-KR') : ''}
              onChange={e => setTotalBudget(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="예: 500,000,000"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? '등록 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function BudgetListPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [budgets, setBudgets] = useState<BudgetHeaderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'FINANCE_MANAGER')

  const load = () => {
    setLoading(true)
    budgetControlApi.getAll()
      .then(setBudgets)
      .catch(() => toast.error('예산 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">예산 관리</h1>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />예산 편성
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : (
        <div className="space-y-2">
          {budgets.map(b => (
            <div
              key={b.id}
              className="border rounded-lg p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30"
              onClick={() => navigate(`/finance/budget/${b.id}`)}
            >
              <div className="flex-1">
                <p className="font-medium">{b.name}</p>
                <p className="text-sm text-muted-foreground">
                  {b.season.name} · v{b.version} · {b.totalBudget.toLocaleString()}원 · {b.createdBy.username}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[b.status]}>{STATUS_LABEL[b.status]}</Badge>
            </div>
          ))}
          {budgets.length === 0 && <p className="text-muted-foreground">등록된 예산이 없습니다.</p>}
        </div>
      )}

      {canWrite && (
        <CreateBudgetDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      )}
    </div>
  )
}
