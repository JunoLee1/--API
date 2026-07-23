import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { callupApi } from '@/services/player-callup.service'
import type { PlayerCallup, PlayerCallupStatus, CreateCallupDto } from '@/types/player-callup'
import { CALLUP_STATUS_LABEL, CALLUP_STATUS_STYLE } from '@/types/player-callup'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usePlayers } from '@/hooks/usePlayers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'REQUESTED', label: '요청' },
  { value: 'DOCS_SUBMITTED', label: '서류제출' },
  { value: 'APPROVED', label: '승인' },
  { value: 'REJECTED', label: '거절' },
  { value: 'COMPLETED', label: '완료' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

interface CreateDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateDialog({ open, onOpenChange, onSaved }: CreateDialogProps) {
  const { players } = usePlayers()
  const [form, setForm] = useState<Partial<CreateCallupDto>>({})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.playerId || !form.fromTeamId || !form.toTeamId || !form.reason?.trim() || !form.startDate) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await callupApi.create(form as CreateCallupDto)
      toast.success('콜업 요청이 등록됐습니다.')
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
        <DialogHeader><DialogTitle>유소년 콜업 요청</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>선수 *</Label>
            <Select
              value={form.playerId ?? ''}
              onValueChange={(v) => setForm((f) => ({ ...f, playerId: v }))}
            >
              <SelectTrigger><SelectValue placeholder="선수 선택" /></SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>출신 팀 ID *</Label>
            <Input
              type="number"
              placeholder="유소년 팀 ID"
              value={form.fromTeamId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, fromTeamId: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>합류 팀 ID *</Label>
            <Input
              type="number"
              placeholder="1군 팀 ID"
              value={form.toTeamId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, toTeamId: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>사유 *</Label>
            <Textarea
              placeholder="콜업 사유"
              value={form.reason ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>시작일 *</Label>
            <Input
              type="date"
              value={form.startDate ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>종료일 (미입력 시 영구)</Label>
            <Input
              type="date"
              value={form.endDate ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value || undefined }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '요청'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlayerCallupPage() {
  const { user } = useCurrentUser()
  const [callups, setCallups] = useState<PlayerCallup[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const isHeadCoach = user?.coachingRole === 'HEAD_COACH'
  const isGM = user?.frontOfficeRole === 'GM'
  const isMedical = user?.coachingRole === 'MEDICAL'

  const fetchCallups = () => {
    setLoading(true)
    callupApi.list(statusFilter === 'ALL' ? undefined : statusFilter)
      .then(setCallups)
      .catch(() => toast.error('콜업 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCallups() }, [statusFilter])

  const handleApprove = async (id: number) => {
    try {
      await callupApi.approve(id)
      toast.success('승인됐습니다.')
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '승인에 실패했습니다.')
    }
  }

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return
    try {
      await callupApi.reject(rejectId, rejectReason)
      toast.success('거절됐습니다.')
      setRejectId(null)
      setRejectReason('')
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '거절에 실패했습니다.')
    }
  }

  const handleComplete = async (id: number) => {
    try {
      await callupApi.complete(id)
      toast.success('완료 처리됐습니다.')
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '실패했습니다.')
    }
  }

  const handleConfirmYouth = async (id: number) => {
    try {
      await callupApi.confirmYouth(id)
      toast.success('유소년 서류 확인 완료.')
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '실패했습니다.')
    }
  }

  const handleConfirmMedical = async (id: number) => {
    try {
      await callupApi.confirmMedical(id)
      toast.success('의무 서류 확인 완료.')
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '실패했습니다.')
    }
  }

  const showActions = isGM || isHeadCoach || isMedical

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">유소년 콜업</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 {callups.length}건</p>
        </div>
        {isHeadCoach && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />콜업 요청
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-8 text-sm bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : callups.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            콜업 기록이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>선수</TableHead>
                <TableHead>출신팀 → 합류팀</TableHead>
                <TableHead className="w-28">기간</TableHead>
                <TableHead className="w-20 text-center">상태</TableHead>
                <TableHead className="w-32 text-center">서류확인</TableHead>
                {showActions && <TableHead className="w-44" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {callups.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.player.playerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.fromTeam.name} → {c.toTeam.name}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {formatDate(c.startDate)}
                    {c.endDate ? ` ~ ${formatDate(c.endDate)}` : ' ~'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${CALLUP_STATUS_STYLE[c.status as PlayerCallupStatus]}`}>
                      {CALLUP_STATUS_LABEL[c.status as PlayerCallupStatus]}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col gap-0.5 items-center text-xs">
                      <span className={c.youthCoachConfirmed ? 'text-green-600' : 'text-muted-foreground'}>
                        유소년 {c.youthCoachConfirmed ? '✓' : '대기'}
                      </span>
                      <span className={c.medicalConfirmed ? 'text-green-600' : 'text-muted-foreground'}>
                        의무 {c.medicalConfirmed ? '✓' : '대기'}
                      </span>
                    </div>
                  </TableCell>
                  {showActions && (
                    <TableCell className="flex gap-1.5">
                      {isHeadCoach && c.status === 'REQUESTED' && !c.youthCoachConfirmed && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleConfirmYouth(c.id)}>
                          유소년 확인
                        </Button>
                      )}
                      {isMedical && c.status === 'REQUESTED' && !c.medicalConfirmed && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleConfirmMedical(c.id)}>
                          의무 확인
                        </Button>
                      )}
                      {isGM && c.status === 'DOCS_SUBMITTED' && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => handleApprove(c.id)}>
                            승인
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600"
                            onClick={() => setRejectId(c.id)}>
                            거절
                          </Button>
                        </>
                      )}
                      {(isGM || isHeadCoach) && c.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleComplete(c.id)}>
                          완료
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

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchCallups() }}
      />

      <Dialog open={rejectId !== null} onOpenChange={(v) => !v && setRejectId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>거절 사유</DialogTitle></DialogHeader>
          <Textarea
            placeholder="거절 사유를 입력해주세요."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>취소</Button>
            <Button onClick={handleReject} disabled={!rejectReason.trim()}>거절</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
