import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { coachApi } from '@/services/coach.service'
import type { Coach, CoachingRole, CoachStatus } from '@/types/coach'
import {
  COACHING_ROLE_LABEL, COACH_STATUS_LABEL, COACH_STATUS_STYLE,
  SHORTLIST_SOURCE_LABEL,
} from '@/types/coach'
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
import { ArrowLeft, Plus } from 'lucide-react'

const ALL_ROLES: CoachingRole[] = [
  'HEAD_COACH', 'ASSISTANT_COACH', 'DEFENSIVE_COACH',
  'ATTACKING_COACH', 'GOALKEEPER_COACH', 'PHYSICAL_COACH', 'SET_PIECE_COACH',
]
const ALL_STATUSES: (CoachStatus | 'ALL')[] = [
  'ALL', 'CANDIDATE', 'SHORTLISTED', 'APPROVAL_PENDING', 'CONTRACTED', 'RETIRED', 'ARCHIVED',
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface CreateCoachDialogProps {
  roundId: number | undefined
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateCoachDialog({ roundId, open, onOpenChange, onSaved }: CreateCoachDialogProps) {
  const [name, setName] = useState('')
  const [nationality, setNationality] = useState('')
  const [coachingRole, setCoachingRole] = useState<CoachingRole | ''>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('이름을 입력해주세요.'); return }
    if (!coachingRole) { toast.error('역할을 선택해주세요.'); return }
    setSaving(true)
    try {
      await coachApi.create({
        name: name.trim(),
        coachingRole,
        ...(nationality.trim() && { nationality: nationality.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
        ...(roundId !== undefined && { hiringRoundId: roundId }),
      })
      toast.success('코치 후보가 등록됐습니다.')
      setName(''); setNationality(''); setCoachingRole(''); setNotes('')
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
        <DialogHeader><DialogTitle>코치 후보 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이름 *</Label>
            <Input placeholder="코치 이름" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>역할 *</Label>
            <Select value={coachingRole} onValueChange={(v) => setCoachingRole(v as CoachingRole)}>
              <SelectTrigger>
                <SelectValue placeholder="역할 선택">
                  {(value: string | null) => value ? COACHING_ROLE_LABEL[value as CoachingRole] : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{COACHING_ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>국적</Label>
            <Input placeholder="예: 스페인" value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

export function CoachListPage() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roundId = searchParams.get('roundId') ? Number(searchParams.get('roundId')) : undefined

  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<CoachStatus | 'ALL'>('ALL')
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite =
    user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD')
  const isGM = user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'GM'
  const canRead =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD'))

  const fetchCoaches = () => {
    setLoading(true)
    coachApi.list({
      ...(roundId !== undefined && { roundId }),
      ...(statusFilter !== 'ALL' && { status: statusFilter }),
    })
      .then(setCoaches)
      .catch(() => toast.error('코치 후보 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { void fetchCoaches() }, [roundId, statusFilter])

  const handleTransition = async (coach: Coach, status: CoachStatus) => {
    try {
      const shortlistSource = status === 'SHORTLISTED' ? 'MANUAL' as const : undefined
      await coachApi.updateStatus(coach.id, status, shortlistSource)
      toast.success(`'${COACH_STATUS_LABEL[status]}'로 변경됐습니다.`)
      void fetchCoaches()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '변경에 실패했습니다.')
    }
  }

  const renderActions = (coach: Coach) => {
    if (!canWrite && !isGM) return null
    switch (coach.status) {
      case 'CANDIDATE':
        return canWrite ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'SHORTLISTED') }}>
              숏리스트
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'ARCHIVED') }}>
              탈락
            </Button>
          </div>
        ) : null
      case 'SHORTLISTED':
        return canWrite ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'APPROVAL_PENDING') }}>
              승인 요청
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'ARCHIVED') }}>
              탈락
            </Button>
          </div>
        ) : null
      case 'APPROVAL_PENDING':
        return (
          <div className="flex gap-1">
            {isGM && (
              <Button size="sm" className="h-7 text-xs"
                onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'CONTRACTED') }}>
                최종 승인
              </Button>
            )}
            {canWrite && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'ARCHIVED') }}>
                탈락
              </Button>
            )}
          </div>
        )
      default:
        return null
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
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate('/coaches/rounds')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">코치 후보</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {roundId ? `라운드 #${roundId}` : '전체 후보'}
            </p>
          </div>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />후보 등록
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CoachStatus | 'ALL')}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background">
            <SelectValue>
              {(value: string | null) => value === 'ALL' ? '전체' : value ? COACH_STATUS_LABEL[value as CoachStatus] : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === 'ALL' ? '전체' : COACH_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : coaches.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            등록된 코치 후보가 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>이름</TableHead>
                <TableHead className="w-28">역할</TableHead>
                <TableHead className="w-20">국적</TableHead>
                <TableHead className="w-28">상태</TableHead>
                <TableHead className="w-32">숏리스트 경위</TableHead>
                <TableHead className="w-28 text-muted-foreground">등록일</TableHead>
                {(canWrite || isGM) && <TableHead className="w-44" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/coaches/${c.id}`)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{COACHING_ROLE_LABEL[c.coachingRole]}</TableCell>
                  <TableCell className="text-sm">{c.nationality ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${COACH_STATUS_STYLE[c.status]}`}>
                      {COACH_STATUS_LABEL[c.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.shortlistSource ? SHORTLIST_SOURCE_LABEL[c.shortlistSource] : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  {(canWrite || isGM) && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {renderActions(c)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateCoachDialog
        roundId={roundId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchCoaches() }}
      />
    </div>
  )
}
