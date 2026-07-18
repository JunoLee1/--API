import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { trainingApi } from '@/services/training.service'
import { seasonApi } from '@/services/season.service'
import type { TrainingSession, SessionType } from '@/types/training'
import { SESSION_TYPE_LABEL, SESSION_TYPE_STYLE } from '@/types/training'
import type { Season } from '@/types/season'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, CheckCircle, Clock } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'

const SESSION_TYPES = Object.keys(SESSION_TYPE_LABEL) as SessionType[]
const PAGE_SIZE = 10

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface CreateSessionDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  seasons: Season[]
  activeSeason: Season | null
  onSaved: () => void
}

function CreateSessionDialog({ open, onOpenChange, seasons, activeSeason, onSaved }: CreateSessionDialogProps) {
  const [date, setDate] = useState('')
  const [goal, setGoal] = useState('')
  const [sessionType, setSessionType] = useState<SessionType>('TACTICAL_FULL_TEAM')
  const [seasonId, setSeasonId] = useState<string>(activeSeason ? String(activeSeason.id) : '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!date || !goal.trim() || !seasonId) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await trainingApi.create({ date, goal: goal.trim(), sessionType, seasonId: Number(seasonId) })
      toast.success('훈련 세션이 등록됐습니다.')
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
        <DialogHeader><DialogTitle>훈련 세션 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>날짜 *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>목표 *</Label>
            <Textarea placeholder="이번 세션의 훈련 목표" value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>유형 *</Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)} items={SESSION_TYPE_LABEL}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map((t) => <SelectItem key={t} value={t}>{SESSION_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>시즌 *</Label>
            <Select value={seasonId} onValueChange={(v) => { if (v) setSeasonId(v) }} items={Object.fromEntries(seasons.map((s) => [String(s.id), s.name]))}>
              <SelectTrigger><SelectValue placeholder="시즌 선택" /></SelectTrigger>
              <SelectContent>
                {seasons.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TrainingPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>('ALL')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [page, setPage] = useState(1)

  const canCreate = user?.role === 'ADMIN' || user?.role === 'COACHING_STAFF'
  const canApprove = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'

  useEffect(() => {
    seasonApi.list().then((list) => {
      setSeasons(list)
      const active = list.find((s) => s.status === 'ACTIVE') ?? null
      setActiveSeason(active)
      if (active) setSelectedSeasonId(String(active.id))
    }).catch(() => null)
  }, [])

  const fetchSessions = (seasonId?: number) => {
    setLoading(true)
    setPage(1)
    trainingApi.list(seasonId)
      .then(setSessions)
      .catch(() => toast.error('훈련 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const sid = selectedSeasonId === 'ALL' ? undefined : Number(selectedSeasonId)
    fetchSessions(sid)
  }, [selectedSeasonId])

  const handleApprove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await trainingApi.approve(id)
      toast.success('훈련 세션이 승인됐습니다.')
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, isApproved: true } : s))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '승인에 실패했습니다.')
    }
  }

  const totalPages = Math.ceil(sessions.length / PAGE_SIZE)
  const paged = sessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">훈련 일정</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 {sessions.length}개 세션</p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />훈련 등록
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={selectedSeasonId ?? 'ALL'} onValueChange={(v) => setSelectedSeasonId(v ?? 'ALL')} items={{ ALL: '전체 시즌', ...Object.fromEntries(seasons.map((s) => [String(s.id), s.name])) }}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 시즌</SelectItem>
            {seasons.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">등록된 훈련 세션이 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>날짜</TableHead>
                <TableHead>목표</TableHead>
                <TableHead className="w-32">유형</TableHead>
                <TableHead className="w-24 text-center">승인</TableHead>
                {canApprove && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/training/${s.id}`)}>
                  <TableCell className="tabular-nums">{formatDate(s.date)}</TableCell>
                  <TableCell className="max-w-xs truncate">{s.goal}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${SESSION_TYPE_STYLE[s.sessionType]}`}>
                      {SESSION_TYPE_LABEL[s.sessionType]}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {s.isApproved
                      ? <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                      : <Clock className="h-4 w-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                  {canApprove && (
                    <TableCell>
                      {!s.isApproved && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => handleApprove(s.id, e)}>
                          승인
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={sessions.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <CreateSessionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        seasons={seasons}
        activeSeason={activeSeason}
        onSaved={() => {
          setCreateOpen(false)
          const sid = selectedSeasonId === 'ALL' ? undefined : Number(selectedSeasonId)
          fetchSessions(sid)
        }}
      />
    </div>
  )
}
