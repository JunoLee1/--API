import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { matchApi } from '@/services/match.service'
import type { MatchDetail } from '@/types/match'
import { COMPETITION_LABEL } from '@/types/match'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Pencil } from 'lucide-react'
import { playerApi } from '@/services/player.service'
import { POSITION_ABBR, POSITION_ZONE } from '@/types/player'
import type { Player, Position } from '@/types/player'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ZONE_STYLE: Record<string, string> = {
  GK: 'bg-amber-100 text-amber-800 border-amber-200',
  DEF: 'bg-blue-100 text-blue-800 border-blue-200',
  MID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  FWD: 'bg-rose-100 text-rose-800 border-rose-200',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

interface StatRowProps {
  label: string
  homeVal: number
  awayVal: number | null
  homeMax?: number
  fmt?: (v: number) => string
  homeColor?: string
  awayColor?: string
  sub?: string
}

function StatRow({ label, homeVal, awayVal, homeMax, fmt, homeColor = '#2563eb', awayColor = '#dc2626', sub }: StatRowProps) {
  const total = awayVal != null ? homeVal + awayVal : (homeMax ?? homeVal)
  const homePct = total > 0 ? Math.round((homeVal / total) * 100) : 50
  const awayPct = 100 - homePct
  const display = fmt ?? ((v: number) => String(v))
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] font-bold" style={{ color: homeColor }}>{display(homeVal)}</span>
        <span className="text-[10px] text-slate-500">{label}{sub ? ` (${sub})` : ''}</span>
        {awayVal != null
          ? <span className="text-[11px] font-bold" style={{ color: awayColor }}>{display(awayVal)}</span>
          : <span className="text-[11px] text-slate-300">—</span>}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: '#e2e8f0' }}>
        <div style={{ width: `${homePct}%`, background: homeColor }} />
        {awayVal != null && <div style={{ width: `${awayPct}%`, background: awayColor }} />}
      </div>
    </div>
  )
}

type TeamStatsForm = {
  possession: string
  shots: string
  shotsOnTarget: string
  passes: string
  passAccuracy: string
  fouls: string
  yellowCards: string
  redCards: string
  xG: string
  corners: string
  offsides: string
  tackles: string
  interceptions: string
  clearances: string
}

const TEAM_STATS_FIELDS: { key: keyof TeamStatsForm; label: string; float?: boolean }[] = [
  { key: 'possession', label: '점유율 (%)' },
  { key: 'shots', label: '슈팅' },
  { key: 'shotsOnTarget', label: '유효 슈팅' },
  { key: 'xG', label: 'xG', float: true },
  { key: 'passes', label: '패스' },
  { key: 'passAccuracy', label: '패스 성공률 (%)', float: true },
  { key: 'corners', label: '코너킥' },
  { key: 'fouls', label: '파울' },
  { key: 'yellowCards', label: '경고' },
  { key: 'redCards', label: '퇴장' },
  { key: 'offsides', label: '오프사이드' },
  { key: 'tackles', label: '태클' },
  { key: 'interceptions', label: '인터셉트' },
  { key: 'clearances', label: '클리어링' },
]

function makeEmptyForm(ts?: MatchDetail['teamMatchStats']): TeamStatsForm {
  if (!ts) return { possession: '', shots: '', shotsOnTarget: '', passes: '', passAccuracy: '', fouls: '', yellowCards: '', redCards: '', xG: '', corners: '', offsides: '', tackles: '', interceptions: '', clearances: '' }
  return {
    possession: String(ts.possession),
    shots: String(ts.shots),
    shotsOnTarget: String(ts.shotsOnTarget),
    passes: String(ts.passes),
    passAccuracy: String(ts.passAccuracy),
    fouls: String(ts.fouls),
    yellowCards: String(ts.yellowCards),
    redCards: String(ts.redCards),
    xG: String(ts.xG),
    corners: String(ts.corners),
    offsides: String(ts.offsides),
    tackles: String(ts.tackles),
    interceptions: String(ts.interceptions),
    clearances: String(ts.clearances),
  }
}

interface TeamStatsDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  match: MatchDetail
  onSaved: () => void
}

function TeamStatsDialog({ open, onOpenChange, match, onSaved }: TeamStatsDialogProps) {
  const [form, setForm] = useState<TeamStatsForm>(() => makeEmptyForm(match.teamMatchStats ?? undefined))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(makeEmptyForm(match.teamMatchStats ?? undefined))
  }, [open, match.teamMatchStats])

  const set = (key: keyof TeamStatsForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await matchApi.upsertTeamStats(match.id, {
        possession: Number(form.possession),
        shots: Number(form.shots),
        shotsOnTarget: Number(form.shotsOnTarget),
        passes: Number(form.passes),
        passAccuracy: Number(form.passAccuracy),
        fouls: Number(form.fouls),
        yellowCards: Number(form.yellowCards),
        redCards: Number(form.redCards),
        xG: Number(form.xG),
        corners: Number(form.corners),
        offsides: Number(form.offsides),
        tackles: Number(form.tackles),
        interceptions: Number(form.interceptions),
        clearances: Number(form.clearances),
      })
      toast.success('팀 통계가 저장됐습니다.')
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
        <DialogHeader><DialogTitle>팀 통계 입력 ({match.homeTeamName})</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 py-1 max-h-[60vh] overflow-y-auto pr-1">
          {TEAM_STATS_FIELDS.map(({ key, label, float: isFloat }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                min={0}
                step={isFloat ? '0.01' : '1'}
                value={form[key]}
                onChange={set(key)}
                placeholder="0"
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type PlayerStatsForm = {
  playerId: string
  minutesPlayed: string
  goals: string
  assists: string
  xG: string
  xA: string
  shots: string
  passAccuracy: string
  keyPasses: string
  tackles: string
  interceptions: string
  clearances: string
  saves: string
  cleanSheet: boolean
}

const PLAYER_STAT_FIELDS: { key: keyof Omit<PlayerStatsForm, 'playerId' | 'cleanSheet'>; label: string; float?: boolean }[] = [
  { key: 'minutesPlayed', label: '출전(분)' },
  { key: 'goals', label: '득점' },
  { key: 'assists', label: '도움' },
  { key: 'xG', label: 'xG', float: true },
  { key: 'xA', label: 'xA', float: true },
  { key: 'shots', label: '슈팅' },
  { key: 'passAccuracy', label: '패스 성공률(%)', float: true },
  { key: 'keyPasses', label: '키패스' },
  { key: 'tackles', label: '태클' },
  { key: 'interceptions', label: '인터셉트' },
  { key: 'clearances', label: '클리어링' },
  { key: 'saves', label: '선방' },
]

const EMPTY_PLAYER_FORM: PlayerStatsForm = {
  playerId: '', minutesPlayed: '', goals: '', assists: '', xG: '', xA: '',
  shots: '', passAccuracy: '', keyPasses: '', tackles: '', interceptions: '',
  clearances: '', saves: '', cleanSheet: false,
}

interface PlayerStatsDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  match: MatchDetail
  onSaved: () => void
}

function PlayerStatsDialog({ open, onOpenChange, match, onSaved }: PlayerStatsDialogProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [form, setForm] = useState<PlayerStatsForm>(EMPTY_PLAYER_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      playerApi.list({ status: 'ACTIVE' }).then(setPlayers).catch(() => null)
      setForm(EMPTY_PLAYER_FORM)
    }
  }, [open])

  // 선수 선택 시 기존 기록 자동 채움
  const handlePlayerChange = (playerId: string) => {
    const existing = match.playerMatchStats.find((s) => s.playerId === playerId)
    if (existing) {
      setForm({
        playerId,
        minutesPlayed: existing.minutesPlayed != null ? String(existing.minutesPlayed) : '',
        goals: existing.goals != null ? String(existing.goals) : '',
        assists: existing.assists != null ? String(existing.assists) : '',
        xG: existing.xG != null ? String(existing.xG) : '',
        xA: existing.xA != null ? String(existing.xA) : '',
        shots: existing.shots != null ? String(existing.shots) : '',
        passAccuracy: existing.passAccuracy != null ? String(existing.passAccuracy) : '',
        keyPasses: existing.keyPasses != null ? String(existing.keyPasses) : '',
        tackles: existing.tackles != null ? String(existing.tackles) : '',
        interceptions: existing.interceptions != null ? String(existing.interceptions) : '',
        clearances: existing.clearances != null ? String(existing.clearances) : '',
        saves: existing.saves != null ? String(existing.saves) : '',
        cleanSheet: existing.cleanSheet ?? false,
      })
    } else {
      setForm({ ...EMPTY_PLAYER_FORM, playerId })
    }
  }

  const setField = (key: keyof Omit<PlayerStatsForm, 'playerId' | 'cleanSheet'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const num = (v: string) => v !== '' ? Number(v) : undefined

  const handleSave = async () => {
    if (!form.playerId) { toast.error('선수를 선택해주세요.'); return }
    setSaving(true)
    try {
      await matchApi.upsertPlayerStats(match.id, {
        playerId: form.playerId,
        minutesPlayed: num(form.minutesPlayed),
        goals: num(form.goals),
        assists: num(form.assists),
        xG: num(form.xG),
        xA: num(form.xA),
        shots: num(form.shots),
        passAccuracy: num(form.passAccuracy),
        keyPasses: num(form.keyPasses),
        tackles: num(form.tackles),
        interceptions: num(form.interceptions),
        clearances: num(form.clearances),
        saves: num(form.saves),
        cleanSheet: form.cleanSheet || undefined,
      })
      toast.success('선수 기록이 저장됐습니다.')
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
        <DialogHeader><DialogTitle>선수 기록 입력</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label className="text-xs">선수</Label>
            <Select value={form.playerId} onValueChange={handlePlayerChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="선수 선택..." />
              </SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {PLAYER_STAT_FIELDS.map(({ key, label, float: isFloat }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  min={0}
                  step={isFloat ? '0.01' : '1'}
                  value={form[key]}
                  onChange={setField(key)}
                  placeholder="—"
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              id="cleanSheet"
              type="checkbox"
              checked={form.cleanSheet}
              onChange={(e) => setForm((prev) => ({ ...prev, cleanSheet: e.target.checked }))}
              className="rounded border-border"
            />
            <Label htmlFor="cleanSheet" className="text-xs cursor-pointer">클린시트</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ScoreDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  match: MatchDetail
  onSaved: () => void
}

function ScoreDialog({ open, onOpenChange, match, onSaved }: ScoreDialogProps) {
  const [homeScore, setHomeScore] = useState(String(match.homeScore ?? ''))
  const [awayScore, setAwayScore] = useState(String(match.awayScore ?? ''))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await matchApi.update(match.id, {
        homeScore: homeScore !== '' ? Number(homeScore) : undefined,
        awayScore: awayScore !== '' ? Number(awayScore) : undefined,
      })
      toast.success('스코어가 입력됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>스코어 입력</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>{match.homeTeamName}</Label>
            <Input type="number" min={0} value={homeScore} onChange={(e) => setHomeScore(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>{match.awayTeamName}</Label>
            <Input type="number" min={0} value={awayScore} onChange={(e) => setAwayScore(e.target.value)} placeholder="0" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [match, setMatch] = useState<MatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [scoreOpen, setScoreOpen] = useState(false)
  const [teamStatsOpen, setTeamStatsOpen] = useState(false)
  const [playerStatsOpen, setPlayerStatsOpen] = useState(false)

  const canWrite = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'
  const canInputStats = canWrite || user?.role === 'COACHING_STAFF'

  const fetchMatch = () => {
    if (!id) return
    matchApi.get(Number(id))
      .then(setMatch)
      .catch(() => toast.error('경기 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchMatch() }, [id])

  if (loading) return (
    <div className="p-6 space-y-4 max-w-3xl">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  if (!match) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <p className="text-sm">경기를 찾을 수 없습니다.</p>
      <Button variant="ghost" size="sm" onClick={() => navigate('/matches')}>목록으로</Button>
    </div>
  )

  const ts = match.teamMatchStats

  const OUR_TEAM = 'FC Seoul'
  const ourIsHome = match.homeTeamName === OUR_TEAM
  const ourScore = ourIsHome ? match.homeScore : match.awayScore
  const oppScore = ourIsHome ? match.awayScore : match.homeScore
  const hasScore = ourScore != null && oppScore != null
  const resultLabel = hasScore
    ? ourScore! > oppScore! ? '승' : ourScore! === oppScore! ? '무' : '패'
    : null
  const resultClass = resultLabel === '승' ? 'text-green-400' : resultLabel === '무' ? 'text-slate-300' : 'text-red-400'

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/matches')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        {canInputStats && (
          <>
            <Button variant="outline" size="sm" onClick={() => setPlayerStatsOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />선수 기록 입력
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTeamStatsOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />팀 통계 입력
            </Button>
          </>
        )}
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => setScoreOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />스코어 입력
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* 스코어 헤더 */}
          <div
            className="rounded-xl text-white px-5 py-6"
            style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)' }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="bg-white/15 text-blue-200 rounded px-2 py-0.5 text-[10px]">
                {COMPETITION_LABEL[match.competitionType]}
              </span>
              <span className="text-blue-300 text-[10px]">{formatDate(match.date)}</span>
            </div>
            <div className="flex items-center justify-between px-2">
              <div className="flex-1 text-right">
                <div className="text-base font-bold">{match.homeTeamName}</div>
                <div className="text-[10px] text-blue-200 mt-0.5">홈</div>
              </div>
              <div className="mx-5 text-center bg-white/10 rounded-xl px-5 py-2.5">
                <div className="text-[30px] font-extrabold tabular-nums leading-none tracking-wide">
                  {hasScore ? `${match.homeScore} : ${match.awayScore}` : 'vs'}
                </div>
                {hasScore && resultLabel && (
                  <div className={cn('text-[10px] font-semibold mt-1', resultClass)}>
                    FT · {resultLabel}
                  </div>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="text-base font-bold">{match.awayTeamName}</div>
                <div className="text-[10px] text-blue-200 mt-0.5">원정</div>
              </div>
            </div>
            {/* 득점자 */}
            {hasScore && match.playerMatchStats.some((s) => (s.goals ?? 0) > 0) && (
              <div className="flex justify-center gap-2 flex-wrap mt-4">
                {match.playerMatchStats
                  .filter((s) => (s.goals ?? 0) > 0)
                  .map((s) => (
                    <span key={s.id} className="text-xs bg-white/10 text-blue-100 rounded-full px-3 py-1">
                      ⚽ {s.player.playerName}{(s.goals ?? 0) > 1 ? ` ×${s.goals}` : ''}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* 팀 통계 비교 바 */}
          {ts && (
            <div className="rounded-xl border bg-white p-4">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center mb-3">팀 통계</div>
              {/* 점유율: 합=100이므로 유일한 진짜 비교 바 */}
              <StatRow
                label="점유율"
                homeVal={ts.possession}
                awayVal={100 - ts.possession}
                fmt={(v) => `${v}%`}
              />
              {/* 슈팅: 홈 단일값 */}
              <StatRow
                label="슈팅"
                homeVal={ts.shots}
                awayVal={null}
                homeMax={ts.shots}
                sub={`유효 ${ts.shotsOnTarget}회`}
              />
              {/* 패스 성공률: 홈 단일값 */}
              <StatRow
                label="패스 성공률"
                homeVal={ts.passAccuracy}
                awayVal={null}
                homeMax={100}
                fmt={(v) => `${v}%`}
              />
              {/* xG: 홈 단일값, 초록 바 */}
              <StatRow
                label="xG"
                homeVal={ts.xG}
                awayVal={null}
                homeMax={Math.max(ts.xG, 3)}
                fmt={(v) => v.toFixed(2)}
                homeColor="#10b981"
              />
            </div>
          )}

          {/* 보조 통계 칩 (3열) */}
          {ts && (
            <div className="grid grid-cols-3 gap-2">
              {([
                { label: '코너킥', value: ts.corners, accent: false },
                { label: '경고', value: ts.yellowCards, accent: true },
                { label: '파울', value: ts.fouls, accent: false },
              ] as const).map(({ label, value, accent }) => (
                <div key={label} className="rounded-lg border bg-white p-3 text-center">
                  <div className={cn('text-sm font-bold tabular-nums', accent ? 'text-amber-500' : 'text-slate-900')}>
                    {value}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* 선수 기록 */}
          {match.playerMatchStats.length > 0 && (
            <div className="rounded-xl border bg-white p-4">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-3">선수 기록</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wide">선수</th>
                      <th className="pb-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-center w-10">득점</th>
                      <th className="pb-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-center w-10">도움</th>
                      <th className="pb-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-center w-12">xG</th>
                      <th className="pb-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-center w-14">출전</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.playerMatchStats.map((s) => {
                      const pos = s.player.position as Position
                      const zone = POSITION_ZONE[pos]
                      return (
                        <tr key={s.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-1.5 flex items-center gap-1.5">
                            <span className={`inline-flex rounded border px-1 py-0.5 text-[10px] font-mono font-semibold shrink-0 ${ZONE_STYLE[zone]}`}>
                              {POSITION_ABBR[pos]}
                            </span>
                            <span className={cn('text-[11px]', (s.goals ?? 0) > 0 ? 'font-semibold text-slate-900' : 'text-slate-700')}>
                              {s.player.playerName}
                            </span>
                          </td>
                          <td className={cn('text-center tabular-nums text-[11px]', (s.goals ?? 0) > 0 ? 'font-bold text-slate-900' : 'text-slate-400')}>
                            {s.goals ?? '—'}
                          </td>
                          <td className={cn('text-center tabular-nums text-[11px]', (s.assists ?? 0) > 0 ? 'font-bold text-slate-900' : 'text-slate-400')}>
                            {s.assists ?? '—'}
                          </td>
                          <td className={cn('text-center tabular-nums text-[11px]',
                            s.xG != null && s.xG >= 1.5 ? 'text-emerald-600 font-semibold' : 'text-slate-400')}>
                            {s.xG != null ? s.xG.toFixed(2) : '—'}
                          </td>
                          <td className="text-center tabular-nums text-[11px] text-slate-400">
                            {s.minutesPlayed != null ? `${s.minutesPlayed}'` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {match && (
        <>
          {canWrite && <ScoreDialog open={scoreOpen} onOpenChange={setScoreOpen} match={match} onSaved={() => { setScoreOpen(false); fetchMatch() }} />}
          {canInputStats && <TeamStatsDialog open={teamStatsOpen} onOpenChange={setTeamStatsOpen} match={match} onSaved={() => { setTeamStatsOpen(false); fetchMatch() }} />}
          {canInputStats && <PlayerStatsDialog open={playerStatsOpen} onOpenChange={setPlayerStatsOpen} match={match} onSaved={() => { setPlayerStatsOpen(false); fetchMatch() }} />}
        </>
      )}
    </div>
  )
}
