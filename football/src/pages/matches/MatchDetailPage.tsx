import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { matchApi } from '@/services/match.service'
import type { MatchDetail, ShotEvent, ShotResult } from '@/types/match'
import { COMPETITION_LABEL, SHOT_RESULT_LABEL, SHOT_RESULT_STYLE } from '@/types/match'
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
import { ArrowLeft, Pencil, Trash2, Plus, Users } from 'lucide-react'
import { playerApi } from '@/services/player.service'
import { POSITION_ABBR, POSITION_ZONE, POSITION_LABEL } from '@/types/player'
import type { Player, Position } from '@/types/player'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'

type PlayerStat = MatchDetail['playerMatchStats'][number]

function buildRadarData(s: PlayerStat) {
  return [
    { axis: '득점',  value: Math.min((s.goals   ?? 0) / 3  * 100, 100) },
    { axis: '도움',  value: Math.min((s.assists  ?? 0) / 3  * 100, 100) },
    { axis: 'xG',   value: Math.min((s.xG       ?? 0) / 3  * 100, 100) },
    { axis: '슈팅',  value: Math.min((s.shots    ?? 0) / 8  * 100, 100) },
    { axis: '패스%', value: (s.passesAttempted != null && s.passesAttempted > 0) ? Math.round((s.passesCompleted ?? 0) / s.passesAttempted * 100) : 0 },
    { axis: '키패스', value: Math.min((s.keyPasses ?? 0) / 8 * 100, 100) },
  ]
}

function PlayerRadar({ s }: { s: PlayerStat }) {
  const data = buildRadarData(s)
  return (
    <ResponsiveContainer width="100%" height={180}>
      <RadarChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: '#64748b' }} />
        <Radar dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} dot={{ r: 2, fill: '#2563eb' }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

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
  yellowCards: string
  redCards: string
  corners: string
  offsides: string
}

const TEAM_STATS_FIELDS: { key: keyof TeamStatsForm; label: string }[] = [
  { key: 'possession', label: '점유율 (%)' },
  { key: 'yellowCards', label: '경고' },
  { key: 'redCards', label: '퇴장' },
  { key: 'corners', label: '코너킥' },
  { key: 'offsides', label: '오프사이드' },
]

function makeEmptyForm(ts?: MatchDetail['teamMatchStats']): TeamStatsForm {
  if (!ts) return { possession: '', yellowCards: '', redCards: '', corners: '', offsides: '' }
  return {
    possession: String(ts.possession),
    yellowCards: String(ts.yellowCards),
    redCards: String(ts.redCards),
    corners: String(ts.corners),
    offsides: String(ts.offsides),
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
        yellowCards: Number(form.yellowCards),
        redCards: Number(form.redCards),
        corners: Number(form.corners),
        offsides: Number(form.offsides),
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
  passesAttempted: string
  passesCompleted: string
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
  { key: 'passesAttempted', label: '패스 시도' },
  { key: 'passesCompleted', label: '패스 성공' },
  { key: 'keyPasses', label: '키패스' },
  { key: 'tackles', label: '태클' },
  { key: 'interceptions', label: '인터셉트' },
  { key: 'clearances', label: '클리어링' },
  { key: 'saves', label: '선방' },
]

const EMPTY_PLAYER_FORM: PlayerStatsForm = {
  playerId: '', minutesPlayed: '', goals: '', assists: '', xG: '', xA: '',
  shots: '', passesAttempted: '', passesCompleted: '', keyPasses: '', tackles: '', interceptions: '',
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
        // xG/xA=0은 미입력과 동일하게 처리 (0.00 그대로 저장 방지)
        xG: (existing.xG != null && existing.xG > 0) ? String(existing.xG) : '',
        xA: (existing.xA != null && existing.xA > 0) ? String(existing.xA) : '',
        shots: existing.shots != null ? String(existing.shots) : '',
        passesAttempted: existing.passesAttempted != null ? String(existing.passesAttempted) : '',
        passesCompleted: existing.passesCompleted != null ? String(existing.passesCompleted) : '',
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
  const numPos = (v: string) => { const n = Number(v); return v !== '' && n > 0 ? n : undefined }

  const [warnShown, setWarnShown] = useState(false)

  const assistsVal  = Number(form.assists)      || 0
  const goalsVal    = Number(form.goals)        || 0
  const minutesVal  = Number(form.minutesPlayed) || 0

  const fieldWarn = (key: string): boolean => {
    if (key === 'xA' && assistsVal > 0 && !form.xA) return true
    if (key === 'xG' && goalsVal   > 0 && !form.xG) return true
    return false
  }

  const handleSave = async () => {
    if (!form.playerId) { toast.error('선수를 선택해주세요.'); return }
    const missing: string[] = []
    if (assistsVal > 0 && !form.xA) missing.push('xA')
    if (goalsVal   > 0 && !form.xG) missing.push('xG')
    if (missing.length > 0 && !warnShown) {
      toast.warning(`${missing.join(', ')} 값이 비어 있습니다. 그대로 저장하려면 한 번 더 누르세요.`)
      setWarnShown(true)
      return
    }
    setWarnShown(false)
    setSaving(true)
    try {
      await matchApi.upsertPlayerStats(match.id, {
        playerId: form.playerId,
        minutesPlayed: num(form.minutesPlayed),
        goals: num(form.goals),
        assists: num(form.assists),
        xG: numPos(form.xG),
        xA: numPos(form.xA),
        shots: num(form.shots),
        passesAttempted: num(form.passesAttempted),
        passesCompleted: num(form.passesCompleted),
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
            {PLAYER_STAT_FIELDS.map(({ key, label, float: isFloat }) => {
              const warn = fieldWarn(key)
              return (
                <div key={key} className="space-y-1">
                  <Label className={cn('text-xs', warn && 'text-orange-600')}>
                    {label}{warn ? ' ⚠' : ''}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={isFloat ? '0.01' : '1'}
                    value={form[key]}
                    onChange={(e) => { setWarnShown(false); setField(key)(e) }}
                    placeholder="—"
                    className={cn('h-8 text-sm', warn && 'border-orange-400 focus-visible:ring-orange-400')}
                  />
                </div>
              )
            })}
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

const SHOT_RESULTS: ShotResult[] = ['GOAL', 'ON_TARGET', 'OFF_TARGET', 'BLOCKED']
const ALL_POSITIONS = [
  'STRIKER','SHADOW_STRIKER','WINGER',
  'CENTRAL_ATTACK_MIDFIELDER','RIGHT_ATTACK_MIDFIELDER','LEFT_ATTACK_MIDFIELDER',
  'CENTRAL_DEFENSIVE_MIDFIELDER','LEFT_DEFENSIVE_MIDFIELDER','RIGHT_DEFENSIVE_MIDFIELDER',
  'CENTER_BACK','LEFT_WING_BACK','LEFT_FULL_BACK','RIGHT_WING_BACK','RIGHT_FULL_BACK','GOALKEEPER',
] as const

function AddShotDialog({
  open,
  onOpenChange,
  matchId,
  players,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  matchId: number
  players: { id: string; playerName: string; position: string }[]
  onSaved: () => void
}) {
  const [shooterId, setShooterId] = useState('')
  const [assisterId, setAssisterId] = useState('')
  const [assisterPositionOverride, setAssisterPositionOverride] = useState('')
  const [xG, setXg] = useState('')
  const [result, setResult] = useState<ShotResult>('ON_TARGET')
  const [minute, setMinute] = useState('')
  const [saving, setSaving] = useState(false)

  const assisterDefaultPos = players.find(p => p.id === assisterId)?.position ?? ''

  const reset = () => {
    setShooterId(''); setAssisterId(''); setAssisterPositionOverride('')
    setXg(''); setResult('ON_TARGET'); setMinute('')
  }

  const handleSave = async () => {
    if (!shooterId) { toast.error('슈터를 선택하세요.'); return }
    const xgVal = parseFloat(xG)
    if (isNaN(xgVal) || xgVal < 0 || xgVal > 1) { toast.error('xG는 0~1 사이 숫자를 입력하세요.'); return }
    setSaving(true)
    try {
      await matchApi.createShot(matchId, {
        shooterId,
        assisterId: assisterId || undefined,
        assisterPositionOverride:
          assisterId && assisterPositionOverride && assisterPositionOverride !== assisterDefaultPos
            ? assisterPositionOverride
            : undefined,
        xG: xgVal,
        result,
        minute: minute ? Number(minute) : undefined,
      })
      toast.success('슈팅 이벤트가 저장되었습니다.')
      reset()
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">슈팅 이벤트 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">슈터 *</Label>
            <Select value={shooterId} onValueChange={setShooterId}>
              <SelectTrigger className="h-8 text-sm">
                {shooterId
                  ? <span>{players.find(p => p.id === shooterId)?.playerName ?? shooterId}</span>
                  : <span className="text-muted-foreground">선수 선택</span>}
              </SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">어시스터</Label>
            <Select value={assisterId} onValueChange={(v) => { setAssisterId(v); setAssisterPositionOverride('') }}>
              <SelectTrigger className="h-8 text-sm">
                {assisterId
                  ? <span>{players.find(p => p.id === assisterId)?.playerName ?? assisterId}</span>
                  : <span className="text-muted-foreground">없음</span>}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">없음</SelectItem>
                {players.filter(p => p.id !== shooterId).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {assisterId && (
            <div className="space-y-1">
              <Label className="text-xs">
                어시스터 포지션 오버라이드
                <span className="ml-1 text-muted-foreground font-normal">(기본: {POSITION_ABBR[assisterDefaultPos as Position] ?? assisterDefaultPos})</span>
              </Label>
              <Select
                value={assisterPositionOverride || assisterDefaultPos}
                onValueChange={setAssisterPositionOverride}
              >
                <SelectTrigger className="h-8 text-sm">
                  <span>{POSITION_ABBR[(assisterPositionOverride || assisterDefaultPos) as Position] ?? (assisterPositionOverride || assisterDefaultPos)}</span>
                </SelectTrigger>
                <SelectContent>
                  {ALL_POSITIONS.map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      <span><span className="font-mono text-xs">{POSITION_ABBR[pos as Position]}</span><span className="ml-2 text-muted-foreground">{POSITION_LABEL[pos as Position]}</span></span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">xG (0~1) *</Label>
              <Input
                className="h-8 text-sm"
                placeholder="0.35"
                value={xG}
                onChange={(e) => setXg(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">분 (선택)</Label>
              <Input
                className="h-8 text-sm"
                placeholder="67"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">결과 *</Label>
            <Select value={result} onValueChange={(v) => setResult(v as ShotResult)}>
              <SelectTrigger className="h-8 text-sm">
                <span>{SHOT_RESULT_LABEL[result]}</span>
              </SelectTrigger>
              <SelectContent>
                {SHOT_RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>{SHOT_RESULT_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" disabled={saving} onClick={handleSave}>
            {saving ? '저장 중...' : '저장'}
          </Button>
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
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(null)
  const [shotEvents, setShotEvents] = useState<ShotEvent[]>([])
  const [shotOpen, setShotOpen] = useState(false)
  const [deletingShot, setDeletingShot] = useState<number | null>(null)

  const canWrite = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'
  const canInputStats = canWrite || user?.role === 'COACHING_STAFF'

  const fetchMatch = () => {
    if (!id) return
    matchApi.get(Number(id))
      .then(setMatch)
      .catch(() => toast.error('경기 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  const fetchShots = () => {
    if (!id) return
    matchApi.getShots(Number(id))
      .then(setShotEvents)
      .catch(() => {})
  }

  const handleDeleteShot = async (eventId: number) => {
    setDeletingShot(eventId)
    try {
      await matchApi.deleteShot(Number(id), eventId)
      fetchShots()
      fetchMatch()
      toast.success('슈팅 이벤트가 삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setDeletingShot(null)
    }
  }

  useEffect(() => { fetchMatch(); fetchShots() }, [id])

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
            <Button variant="outline" size="sm" onClick={() => navigate(`/matches/${id}/lineup`)}>
              <Users className="h-3.5 w-3.5 mr-1.5" />라인업 관리
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPlayerStatsOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />선수 기록 입력
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTeamStatsOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />팀 통계 입력
            </Button>
          </>
        )}
        {canWrite && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScoreOpen(true)}
            disabled={!match.hasSquad}
            title={!match.hasSquad ? '스쿼드를 먼저 등록해야 스코어를 입력할 수 있습니다.' : undefined}
          >
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

          {/* 슈팅 이벤트 */}
          {(shotEvents.length > 0 || canInputStats) && (
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">슈팅 이벤트</div>
                {canInputStats && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setShotOpen(true)}>
                    <Plus className="h-3 w-3 mr-1" />추가
                  </Button>
                )}
              </div>
              {shotEvents.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">슈팅 이벤트가 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {shotEvents.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-400 w-6 text-right shrink-0">
                        {e.minute != null ? `${e.minute}'` : '—'}
                      </span>
                      <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${SHOT_RESULT_STYLE[e.result]}`}>
                        {SHOT_RESULT_LABEL[e.result]}
                      </span>
                      <span className="font-medium text-slate-800 shrink-0">{e.shooter.playerName}</span>
                      {e.assister && (
                        <span className="text-slate-400">→ {e.assister.playerName}</span>
                      )}
                      <span className="ml-auto text-slate-400 shrink-0">xG {e.xG.toFixed(2)}</span>
                      {canInputStats && (
                        <button
                          className="text-slate-300 hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
                          disabled={deletingShot === e.id}
                          onClick={() => handleDeleteShot(e.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
                      const expanded = expandedPlayerId === s.id
                      return (
                        <>
                          <tr
                            key={s.id}
                            className="border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => setExpandedPlayerId(expanded ? null : s.id)}
                          >
                            <td className="py-1.5 flex items-center gap-1.5">
                              <span className={`inline-flex rounded border px-1 py-0.5 text-[10px] font-mono font-semibold shrink-0 ${ZONE_STYLE[zone]}`}>
                                {POSITION_ABBR[pos]}
                              </span>
                              <span className={cn('text-[11px]', (s.goals ?? 0) > 0 ? 'font-semibold text-slate-900' : 'text-slate-700')}>
                                {s.player.playerName}
                              </span>
                              <span className="ml-auto text-[9px] text-slate-300">{expanded ? '▲' : '▼'}</span>
                            </td>
                            <td className={cn('text-center tabular-nums text-[11px]', (s.goals ?? 0) > 0 ? 'font-bold text-slate-900' : 'text-slate-400')}>
                              {s.goals ?? '—'}
                            </td>
                            <td className={cn('text-center tabular-nums text-[11px]', (s.assists ?? 0) > 0 ? 'font-bold text-slate-900' : 'text-slate-400')}>
                              {s.assists ?? '—'}
                            </td>
                            <td className={cn('text-center tabular-nums text-[11px]',
                              s.xG != null && s.xG >= 1.5 ? 'text-emerald-600 font-semibold' : 'text-slate-400')}>
                              {(s.xG != null && s.xG > 0)
                                ? s.xG.toFixed(2)
                                : ((s.goals ?? 0) > 0)
                                  ? <span className="text-orange-500 font-bold">⚠</span>
                                  : '—'}
                            </td>
                            <td className="text-center tabular-nums text-[11px] text-slate-400">
                              {s.minutesPlayed != null ? `${s.minutesPlayed}'` : '—'}
                            </td>
                          </tr>
                          {expanded && (
                            <tr key={`${s.id}-radar`}>
                              <td colSpan={5} className="pb-2 pt-1">
                                <div className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1">
                                  <PlayerRadar s={s} />
                                  <div className="grid grid-cols-3 gap-1 mt-1 px-2 pb-2">
                                    {[
                                      { label: '슈팅', value: s.shots },
                                      { label: '키패스', value: s.keyPasses },
                                      { label: '패스%', value: (s.passesAttempted != null && s.passesAttempted > 0) ? `${Math.round((s.passesCompleted ?? 0) / s.passesAttempted * 100)}%` : null },
                                      { label: '태클', value: s.tackles },
                                      { label: '인터셉트', value: s.interceptions },
                                      { label: '출전(분)', value: s.minutesPlayed != null ? `${s.minutesPlayed}'` : null },
                                    ].map(({ label, value }) => (
                                      <div key={label} className="text-center">
                                        <div className="text-[11px] font-semibold text-slate-700 tabular-nums">{value ?? '—'}</div>
                                        <div className="text-[9px] text-slate-400">{label}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
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
          {canInputStats && (
            <AddShotDialog
              open={shotOpen}
              onOpenChange={setShotOpen}
              matchId={match.id}
              players={match.playerMatchStats.map(s => s.player as { id: string; playerName: string; position: string })}
              onSaved={() => { fetchShots(); fetchMatch() }}
            />
          )}
        </>
      )}
    </div>
  )
}
