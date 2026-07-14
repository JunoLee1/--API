import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { prospectApi } from '@/services/prospect.service'
import type { Prospect, ProspectStatus, CreateProspectDto } from '@/types/prospect'
import { STATUS_LABEL, STATUS_STYLE } from '@/types/prospect'
import type { Position } from '@/types/player'
import { POSITION_LABEL } from '@/types/player'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Plus } from 'lucide-react'

const STATUSES: ProspectStatus[] = ['ACTIVE', 'SIGNED', 'ARCHIVED']

const POSITIONS: Position[] = [
  'GOALKEEPER',
  'STRIKER',
  'SHADOW_STRIKER',
  'WINGER',
  'CENTRAL_ATTACK_MIDFIELDER',
  'RIGHT_ATTACK_MIDFIELDER',
  'LEFT_ATTACK_MIDFIELDER',
  'CENTRAL_DEFENSIVE_MIDFIELDER',
  'LEFT_DEFENSIVE_MIDFIELDER',
  'RIGHT_DEFENSIVE_MIDFIELDER',
  'CENTER_BACK',
  'LEFT_WING_BACK',
  'LEFT_FULL_BACK',
  'RIGHT_WING_BACK',
  'RIGHT_FULL_BACK',
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface CreateProspectDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateProspectDialog({ open, onOpenChange, onSaved }: CreateProspectDialogProps) {
  const [name, setName] = useState('')
  const [nationality, setNationality] = useState('')
  const [position, setPosition] = useState<Position | ''>('')
  const [currentTeam, setCurrentTeam] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('이름을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto: CreateProspectDto = {
        name: name.trim(),
        ...(nationality.trim() && { nationality: nationality.trim() }),
        ...(position && { position }),
        ...(currentTeam.trim() && { currentTeam: currentTeam.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
      }
      await prospectApi.create(dto)
      toast.success('영입 후보가 등록됐습니다.')
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
        <DialogHeader><DialogTitle>영입 후보 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이름 *</Label>
            <Input placeholder="선수 이름" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>국적</Label>
            <Input placeholder="예: 대한민국" value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>포지션</Label>
            <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
              <SelectTrigger><SelectValue placeholder="포지션 선택" /></SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>{POSITION_LABEL[p]} ({p})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>현 소속팀</Label>
            <Input placeholder="예: FC 서울" value={currentTeam} onChange={(e) => setCurrentTeam(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea
              placeholder="스카우트 노트"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
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

export function ProspectsPage() {
  const { user } = useCurrentUser()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'ALL'>('ACTIVE')
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'FRONT_OFFICE' ||
    user?.coachingRole === 'HEAD_COACH'

  const fetchProspects = (status?: ProspectStatus) =>
    prospectApi
      .list(status)
      .then(setProspects)
      .catch(() => toast.error('영입 후보 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))

  useEffect(() => {
    const status = statusFilter === 'ALL' ? undefined : statusFilter
    setLoading(true)
    void fetchProspects(status)
  }, [statusFilter])

  const handleStatusChange = async (id: number, status: ProspectStatus) => {
    try {
      await prospectApi.update(id, { status })
      toast.success('상태가 변경됐습니다.')
      setProspects((prev) => prev.map((p) => p.id === id ? { ...p, status } : p))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '변경에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">영입 후보</h1>
          <p className="text-sm text-muted-foreground mt-0.5">스카우트 추적 중인 선수 목록</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />후보 등록
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProspectStatus | 'ALL')}>
          <SelectTrigger className="w-32 h-8 text-sm bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : prospects.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">등록된 영입 후보가 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>이름</TableHead>
                <TableHead className="w-24">포지션</TableHead>
                <TableHead>소속팀</TableHead>
                <TableHead className="w-20">국적</TableHead>
                <TableHead className="w-24">상태</TableHead>
                <TableHead className="w-28 text-muted-foreground">등록일</TableHead>
                <TableHead className="w-28 text-muted-foreground">등록자</TableHead>
                {canWrite && <TableHead className="w-36" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-sm">{p.position ?? '—'}</TableCell>
                  <TableCell className="text-sm">{p.currentTeam ?? '—'}</TableCell>
                  <TableCell className="text-sm">{p.nationality ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(p.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.createdBy?.nickname ?? '—'}
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      {p.status === 'ACTIVE' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleStatusChange(p.id, 'SIGNED')}
                          >
                            영입 완료
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleStatusChange(p.id, 'ARCHIVED')}
                          >
                            종료
                          </Button>
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

      {canWrite && (
        <CreateProspectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={() => {
            setCreateOpen(false)
            setLoading(true)
            const status = statusFilter === 'ALL' ? undefined : statusFilter
            void fetchProspects(status)
          }}
        />
      )}
    </div>
  )
}
