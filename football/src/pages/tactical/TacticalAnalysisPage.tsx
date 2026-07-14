import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { tacticalApi } from '@/services/tactical.service'
import { matchApi } from '@/services/match.service'
import type { TacticalAnalysis, TacticalPhase, CreateTacticalDto } from '@/types/tactical'
import {
  PHASE_LABEL,
  PHASE_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
} from '@/types/tactical'
import type { Match } from '@/types/match'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Check } from 'lucide-react'

const PHASES: TacticalPhase[] = ['PRE_MATCH', 'POST_MATCH']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function matchLabel(m: Match) {
  return `${formatDate(m.date)} ${m.homeTeamName} vs ${m.awayTeamName}`
}

interface CreateDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  matches: Match[]
  onSaved: () => void
}

function CreateAnalysisDialog({ open, onOpenChange, matches, onSaved }: CreateDialogProps) {
  const [matchId, setMatchId] = useState<string>('')
  const [phase, setPhase] = useState<TacticalPhase>('PRE_MATCH')
  const [formation, setFormation] = useState('')
  const [opponentAnalysis, setOpponentAnalysis] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!matchId) { toast.error('경기를 선택해주세요.'); return }
    setSaving(true)
    try {
      const dto: CreateTacticalDto = {
        matchId: Number(matchId),
        phase,
        ...(formation.trim() && { formation: formation.trim() }),
        ...(opponentAnalysis.trim() && { opponentAnalysis: opponentAnalysis.trim() }),
      }
      await tacticalApi.create(dto)
      toast.success('전술 분석이 등록됐습니다.')
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
        <DialogHeader><DialogTitle>전술 분석 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>경기 *</Label>
            <Select value={matchId} onValueChange={(v) => { if (v) setMatchId(v) }}>
              <SelectTrigger><SelectValue placeholder="경기 선택" /></SelectTrigger>
              <SelectContent>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{matchLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>분석 시점 *</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v as TacticalPhase)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PHASES.map((p) => <SelectItem key={p} value={p}>{PHASE_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>포메이션</Label>
            <Input placeholder="예: 4-3-3" value={formation} onChange={(e) => setFormation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>상대 분석</Label>
            <Textarea
              placeholder="상대팀 분석 내용"
              value={opponentAnalysis}
              onChange={(e) => setOpponentAnalysis(e.target.value)}
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

export function TacticalAnalysisPage() {
  const { user } = useCurrentUser()
  const [analyses, setAnalyses] = useState<TacticalAnalysis[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite =
    user?.role === 'COACHING_STAFF' &&
    (user?.coachingRole === 'HEAD_COACH' || user?.coachingRole === 'ASSISTANT_COACH')

  const canConfirm = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'

  const fetchAnalyses = () =>
    tacticalApi
      .list()
      .then(setAnalyses)
      .catch(() => toast.error('전술 분석 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))

  useEffect(() => {
    void fetchAnalyses()
    matchApi.list().then(setMatches).catch(() => null)
  }, [])

  const handleConfirm = async (id: number) => {
    try {
      await tacticalApi.confirm(id)
      toast.success('전술 분석이 확정됐습니다.')
      setAnalyses((prev) => prev.map((a) => a.id === id ? { ...a, status: 'CONFIRMED' } : a))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '확정에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">전술 분석</h1>
          <p className="text-sm text-muted-foreground mt-0.5">경기 전·후 전술 분석 목록</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />전술 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : analyses.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">등록된 전술 분석이 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>경기</TableHead>
                <TableHead className="w-24">시점</TableHead>
                <TableHead className="w-28">포메이션</TableHead>
                <TableHead className="w-20">상태</TableHead>
                <TableHead className="w-24 text-muted-foreground">작성자</TableHead>
                {canConfirm && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="text-sm">
                      {a.match.homeTeamName} vs {a.match.awayTeamName}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(a.match.date)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${PHASE_STYLE[a.phase]}`}>
                      {PHASE_LABEL[a.phase]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{a.formation ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLE[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.createdBy.nickname}</TableCell>
                  {canConfirm && (
                    <TableCell>
                      {a.status === 'DRAFT' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleConfirm(a.id)}>
                          <Check className="h-3 w-3 mr-1" />확정
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

      <CreateAnalysisDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        matches={matches}
        onSaved={() => {
          setCreateOpen(false)
          setLoading(true)
          void fetchAnalyses()
        }}
      />
    </div>
  )
}
