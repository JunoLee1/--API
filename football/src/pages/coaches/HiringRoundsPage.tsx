import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { coachApi } from '@/services/coach.service'
import type { CoachHiringRound, CoachingRole, HiringRoundStatus } from '@/types/coach'
import { COACHING_ROLE_LABEL, ROUND_STATUS_LABEL } from '@/types/coach'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'

const ALL_ROLES: CoachingRole[] = [
  'HEAD_COACH', 'ASSISTANT_COACH', 'DEFENSIVE_COACH',
  'ATTACKING_COACH', 'GOALKEEPER_COACH', 'PHYSICAL_COACH', 'SET_PIECE_COACH',
]

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface CreateRoundDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateRoundDialog({ open, onOpenChange, onSaved }: CreateRoundDialogProps) {
  const [targetRole, setTargetRole] = useState<CoachingRole | ''>('')
  const [threshold, setThreshold] = useState('70')
  const [deadline, setDeadline] = useState('')
  const [budget, setBudget] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!targetRole) { toast.error('채용 대상 역할을 선택해주세요.'); return }
    setSaving(true)
    try {
      await coachApi.createRound({
        targetRole,
        fitScoreThreshold: Number(threshold) || 70,
        ...(deadline && { deadline }),
        ...(budget && { budget: Number(budget) }),
        ...(notes.trim() && { notes: notes.trim() }),
      })
      toast.success('채용 라운드가 개설됐습니다.')
      setTargetRole(''); setThreshold('70'); setDeadline(''); setBudget(''); setNotes('')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>채용 라운드 개설</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>채용 대상 역할 *</Label>
            <Select value={targetRole} onValueChange={(v) => setTargetRole(v as CoachingRole)}>
              <SelectTrigger><SelectValue placeholder="역할 선택" /></SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{COACHING_ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>자동 숏리스트 임계값 (fitScore)</Label>
            <Input type="number" min="0" max="100" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>마감일</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>예산 (원)</Label>
            <Input type="number" placeholder="예: 300000000" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '개설'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function HiringRoundsPage() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [rounds, setRounds] = useState<CoachHiringRound[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const isGM = user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'GM'
  const canRead =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD'))

  const fetchRounds = () => {
    setLoading(true)
    coachApi.listRounds()
      .then(setRounds)
      .catch(() => toast.error('채용 라운드를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { void fetchRounds() }, [])

  const handleClose = async (round: CoachHiringRound, status: HiringRoundStatus) => {
    try {
      await coachApi.updateRoundStatus(round.id, status)
      toast.success(status === 'CLOSED' ? '라운드가 종료됐습니다.' : '라운드가 취소됐습니다.')
      fetchRounds()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        접근 권한이 없습니다.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">코치 채용 라운드</h1>
          <p className="text-sm text-muted-foreground mt-0.5">GM이 개설하는 채용 단위</p>
        </div>
        {isGM && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />라운드 개설
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : rounds.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            개설된 채용 라운드가 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>대상 역할</TableHead>
                <TableHead className="w-20">임계값</TableHead>
                <TableHead className="w-28">상태</TableHead>
                <TableHead className="w-24">후보 수</TableHead>
                <TableHead className="w-28">마감일</TableHead>
                <TableHead className="w-28 text-muted-foreground">개설일</TableHead>
                <TableHead className="w-20 text-muted-foreground">개설자</TableHead>
                {isGM && <TableHead className="w-36" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/coaches?roundId=${r.id}`)}
                >
                  <TableCell className="font-medium">{COACHING_ROLE_LABEL[r.targetRole]}</TableCell>
                  <TableCell className="font-mono text-sm">{r.fitScoreThreshold}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${
                      r.status === 'OPEN' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      r.status === 'CLOSED' ? 'bg-green-100 text-green-700 border-green-200' :
                      'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {ROUND_STATUS_LABEL[r.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{r._count.coaches}명</TableCell>
                  <TableCell className="text-sm">{formatDate(r.deadline)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.createdBy.nickname}
                  </TableCell>
                  {isGM && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {r.status === 'OPEN' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => handleClose(r, 'CLOSED')}>종료</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleClose(r, 'CANCELLED')}>취소</Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateRoundDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchRounds() }}
      />
    </div>
  )
}
