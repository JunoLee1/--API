import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { trainingApi } from '@/services/training.service'
import { seasonApi } from '@/services/season.service'
import type { CoachingRole } from '@/types/auth'
import type { TrainingSession, SessionType, ContentPhase } from '@/types/training'
import { SESSION_TYPE_LABEL, SESSION_TYPE_STYLE, PHASE_LABEL } from '@/types/training'
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
import { Plus, CheckCircle, Clock, Trash2 } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { MiniCalendar } from '@/components/ui/mini-calendar'

const SESSION_TYPES = Object.keys(SESSION_TYPE_LABEL) as SessionType[]
const PHASES = Object.keys(PHASE_LABEL) as ContentPhase[]
const PAGE_SIZE = 10

const DEFAULT_SESSION_TYPE: Partial<Record<CoachingRole, SessionType>> = {
  DEFENSIVE_COACH: 'TACTICAL_DEFENSIVE',
  ATTACKING_COACH: 'TACTICAL_ATTACKING',
  PHYSICAL_COACH: 'PHYSICAL',
  GOALKEEPER_COACH: 'INDIVIDUAL_SKILL',
}

type ContentRow = { phase: ContentPhase; description: string }

const SESSION_CONTENT_TEMPLATE: Record<SessionType, ContentRow[]> = {
  TACTICAL_DEFENSIVE: [
    { phase: 'WARMUP', description: '준비운동 및 스트레칭' },
    { phase: 'DRILL', description: '수비 블록 훈련' },
    { phase: 'TACTICAL', description: '수비 진형 조직' },
    { phase: 'GAME', description: '수비 압박 모의게임' },
  ],
  TACTICAL_ATTACKING: [
    { phase: 'WARMUP', description: '준비운동 및 스트레칭' },
    { phase: 'DRILL', description: '공격 조합 훈련' },
    { phase: 'TACTICAL', description: '공격 전개 패턴' },
    { phase: 'GAME', description: '공격 모의게임' },
  ],
  TACTICAL_FULL_TEAM: [
    { phase: 'WARMUP', description: '준비운동 및 스트레칭' },
    { phase: 'DRILL', description: '포지션별 드릴' },
    { phase: 'TACTICAL', description: '전술 훈련' },
    { phase: 'GAME', description: '전술 모의게임' },
  ],
  PHYSICAL: [
    { phase: 'WARMUP', description: '준비운동 및 스트레칭' },
    { phase: 'DRILL', description: '체력 훈련' },
    { phase: 'GAME', description: '마무리 훈련' },
  ],
  INDIVIDUAL_SKILL: [
    { phase: 'WARMUP', description: '준비운동 및 스트레칭' },
    { phase: 'DRILL', description: '개인기 훈련' },
    { phase: 'DRILL', description: '포지션별 집중 훈련' },
  ],
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface CreateSessionDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  seasons: Season[]
  activeSeason: Season | null
  onSaved: () => void
  coachingRole?: CoachingRole | null
}

function CreateSessionDialog({ open, onOpenChange, seasons, activeSeason, onSaved, coachingRole }: CreateSessionDialogProps) {
  const defaultType: SessionType =
    (coachingRole && DEFAULT_SESSION_TYPE[coachingRole]) ?? 'TACTICAL_FULL_TEAM'

  const [date, setDate] = useState('')
  const [goal, setGoal] = useState('')
  const [sessionType, setSessionType] = useState<SessionType>(defaultType)
  const [seasonId, setSeasonId] = useState<string>(activeSeason ? String(activeSeason.id) : '')
  const [contents, setContents] = useState<ContentRow[]>(() => SESSION_CONTENT_TEMPLATE[defaultType])
  const [newPhase, setNewPhase] = useState<ContentPhase>('WARMUP')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const t = (coachingRole && DEFAULT_SESSION_TYPE[coachingRole]) ?? 'TACTICAL_FULL_TEAM'
      setSessionType(t)
      setContents(SESSION_CONTENT_TEMPLATE[t])
      setDate('')
      setGoal('')
      setSeasonId(activeSeason ? String(activeSeason.id) : '')
      setNewDesc('')
    }
  }, [open])

  const addContent = () => {
    if (!newDesc.trim()) return
    setContents((prev) => [...prev, { phase: newPhase, description: newDesc.trim() }])
    setNewDesc('')
  }

  const removeContent = (i: number) => setContents((prev) => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!date || !goal.trim() || !seasonId) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await trainingApi.create({
        date,
        goal: goal.trim(),
        sessionType,
        seasonId: Number(seasonId),
        ...(contents.length > 0 ? { contents } : {}),
      })
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
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>훈련 세션 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
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
            <Select
              value={sessionType}
              onValueChange={(v) => {
                const t = v as SessionType
                setSessionType(t)
                setContents(SESSION_CONTENT_TEMPLATE[t])
              }}
              items={SESSION_TYPE_LABEL}
            >
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

          {/* 세션 구성 */}
          <div className="space-y-1.5">
            <Label>세션 구성 <span className="text-muted-foreground font-normal">(선택)</span></Label>
            {contents.length > 0 && (
              <div className="space-y-1 mb-2">
                {contents.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                    <span className="text-xs text-muted-foreground bg-background border rounded px-1.5 py-0.5 shrink-0">
                      {PHASE_LABEL[c.phase]}
                    </span>
                    <span className="flex-1 truncate">{c.description}</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => removeContent(i)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Select value={newPhase} onValueChange={(v) => setNewPhase(v as ContentPhase)}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PHASES.map((p) => <SelectItem key={p} value={p}>{PHASE_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                className="flex-1 h-8 text-sm"
                placeholder="내용 입력 후 추가"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addContent() } }}
              />
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={addContent} disabled={!newDesc.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
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
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)

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

  const sessionDates = [...new Set(sessions.map(s => s.date.slice(0, 10)))]

  const filteredSessions = selectedDate
    ? sessions.filter(s => s.date.slice(0, 10) === selectedDate)
    : sessions

  const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE)
  const paged = filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">훈련 일정</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedDate ? `${filteredSessions.length}개 세션` : `전체 ${sessions.length}개 세션`}
          </p>
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

      <div className="flex-1 overflow-auto flex gap-4 p-4 min-h-0">
        <MiniCalendar
          sessionDates={sessionDates}
          selectedDate={selectedDate}
          onSelect={(d) => { setSelectedDate(d); setPage(1) }}
        />

        <div className="flex-1 min-w-0 overflow-auto">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {selectedDate
                ? `${new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 세션${filteredSessions.length === 0 ? ' — 없음' : ''}`
                : '전체 세션'}
            </span>
            {selectedDate && (
              <button className="text-xs underline" onClick={() => { setSelectedDate(null); setPage(1) }}>
                전체 목록 보기
              </button>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-sm text-muted-foreground">
              <span>{selectedDate ? '오늘 훈련 세션이 없습니다.' : '등록된 훈련 세션이 없습니다.'}</span>
              {selectedDate && (
                <button className="text-xs underline" onClick={() => { setSelectedDate(null); setPage(1) }}>
                  전체 목록 보기
                </button>
              )}
            </div>
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
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={filteredSessions.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <CreateSessionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        seasons={seasons}
        activeSeason={activeSeason}
        coachingRole={user?.coachingRole}
        onSaved={() => {
          setCreateOpen(false)
          const sid = selectedSeasonId === 'ALL' ? undefined : Number(selectedSeasonId)
          fetchSessions(sid)
        }}
      />
    </div>
  )
}
