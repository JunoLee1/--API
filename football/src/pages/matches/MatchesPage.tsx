import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { matchApi } from '@/services/match.service'
import { seasonApi } from '@/services/season.service'
import type { Match, CompetitionType } from '@/types/match'
import { COMPETITION_LABEL, COMPETITION_STYLE } from '@/types/match'
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
import { Plus } from 'lucide-react'

const COMP_TYPES = Object.keys(COMPETITION_LABEL) as CompetitionType[]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

interface CreateMatchDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  seasons: Season[]
  activeSeason: Season | null
  onSaved: () => void
  friendlyOnly?: boolean
}

function CreateMatchDialog({ open, onOpenChange, seasons, activeSeason, onSaved, friendlyOnly = false }: CreateMatchDialogProps) {
  const [date, setDate] = useState('')
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [competitionType, setCompetitionType] = useState<CompetitionType>(friendlyOnly ? 'FRIENDLY' : 'LEAGUE')
  const [seasonId, setSeasonId] = useState<string>(activeSeason ? String(activeSeason.id) : '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!date || !home.trim() || !away.trim() || !seasonId) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await matchApi.create({ date, homeTeamName: home.trim(), awayTeamName: away.trim(), competitionType, seasonId: Number(seasonId) })
      toast.success('경기가 등록됐습니다.')
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
        <DialogHeader><DialogTitle>경기 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>날짜 *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>홈 팀 *</Label>
              <Input placeholder="홈 팀명" value={home} onChange={(e) => setHome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>원정 팀 *</Label>
              <Input placeholder="원정 팀명" value={away} onChange={(e) => setAway(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>대회 *</Label>
            {friendlyOnly ? (
              <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                {COMPETITION_LABEL['FRIENDLY']}
              </div>
            ) : (
              <Select value={competitionType} onValueChange={(v) => setCompetitionType(v as CompetitionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMP_TYPES.map((t) => <SelectItem key={t} value={t}>{COMPETITION_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>시즌 *</Label>
            <Select value={seasonId} onValueChange={(v) => { if (v) setSeasonId(v) }}>
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

export function MatchesPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [matches, setMatches] = useState<Match[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('ALL')
  const [compFilter, setCompFilter] = useState<CompetitionType | 'ALL'>('ALL')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const canCreateFriendly = user?.role === 'FRONT_OFFICE' || user?.role === 'COACHING_STAFF'

  useEffect(() => {
    seasonApi.list().then((list) => {
      setSeasons(list)
      const active = list.find((s) => s.status === 'ACTIVE') ?? null
      setActiveSeason(active)
      if (active) setSelectedSeasonId(String(active.id))
    }).catch(() => null)
  }, [])

  const fetchMatches = () => {
    setLoading(true)
    matchApi.list({
      seasonId: selectedSeasonId !== 'ALL' ? Number(selectedSeasonId) : undefined,
      competitionType: compFilter !== 'ALL' ? compFilter : undefined,
    })
      .then(setMatches)
      .catch(() => toast.error('경기 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchMatches() }, [selectedSeasonId, compFilter])

  const scoreDisplay = (m: Match) => {
    if (m.homeScore == null || m.awayScore == null) return <span className="text-muted-foreground text-xs">미정</span>
    return <span className="font-mono font-semibold tabular-nums">{m.homeScore} : {m.awayScore}</span>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">경기 목록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 {matches.length}경기</p>
        </div>
        {canCreateFriendly && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />친선/연습경기 추가
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={selectedSeasonId} onValueChange={(v) => { if (v) setSelectedSeasonId(v) }}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 시즌</SelectItem>
            {seasons.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={compFilter} onValueChange={(v) => setCompFilter(v as CompetitionType | 'ALL')}>
          <SelectTrigger className="w-32 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 대회</SelectItem>
            {COMP_TYPES.map((t) => <SelectItem key={t} value={t}>{COMPETITION_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : matches.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">등록된 경기가 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-24">날짜</TableHead>
                <TableHead className="w-24">대회</TableHead>
                <TableHead>홈</TableHead>
                <TableHead className="w-20 text-center">스코어</TableHead>
                <TableHead>원정</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/matches/${m.id}`)}>
                  <TableCell className="tabular-nums text-muted-foreground">{formatDate(m.date)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${COMPETITION_STYLE[m.competitionType]}`}>
                      {COMPETITION_LABEL[m.competitionType]}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{m.homeTeamName}</TableCell>
                  <TableCell className="text-center">{scoreDisplay(m)}</TableCell>
                  <TableCell>{m.awayTeamName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateMatchDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        seasons={seasons}
        activeSeason={activeSeason}
        onSaved={() => { setCreateOpen(false); fetchMatches() }}
        friendlyOnly={canCreateFriendly}
      />
    </div>
  )
}
