import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { matchApi } from '@/services/match.service'
import type { MatchDetail } from '@/types/match'
import { COMPETITION_LABEL, COMPETITION_STYLE } from '@/types/match'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
import { POSITION_ABBR, POSITION_ZONE } from '@/types/player'
import type { Position } from '@/types/player'

const ZONE_STYLE: Record<string, string> = {
  GK: 'bg-amber-100 text-amber-800 border-amber-200',
  DEF: 'bg-blue-100 text-blue-800 border-blue-200',
  MID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  FWD: 'bg-rose-100 text-rose-800 border-rose-200',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
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

  const canWrite = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'

  const fetchMatch = () => {
    if (!id) return
    matchApi.get(Number(id))
      .then(setMatch)
      .catch(() => toast.error('경기 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchMatch() }, [id])

  if (loading) return <div className="p-6 space-y-4 max-w-3xl"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>

  if (!match) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <p className="text-sm">경기를 찾을 수 없습니다.</p>
      <Button variant="ghost" size="sm" onClick={() => navigate('/matches')}>목록으로</Button>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/matches')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => setScoreOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />스코어 입력
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">
          {/* 경기 헤더 */}
          <div className="rounded-lg border bg-card p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${COMPETITION_STYLE[match.competitionType]}`}>
                {COMPETITION_LABEL[match.competitionType]}
              </span>
              <span className="text-sm text-muted-foreground">{formatDate(match.date)}</span>
            </div>
            <div className="flex items-center justify-center gap-6">
              <span className="text-lg font-semibold">{match.homeTeamName}</span>
              <span className="text-3xl font-mono font-bold tabular-nums">
                {match.homeScore != null && match.awayScore != null
                  ? `${match.homeScore} : ${match.awayScore}`
                  : 'vs'}
              </span>
              <span className="text-lg font-semibold">{match.awayTeamName}</span>
            </div>
          </div>

          {/* 팀 스탯 */}
          {match.teamMatchStats && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-2">팀 통계</h3>
              <Separator className="mb-3" />
              <div className="grid grid-cols-3 gap-2 text-sm">
                {[
                  ['점유율', `${match.teamMatchStats.possession}%`],
                  ['슈팅', String(match.teamMatchStats.shots)],
                  ['유효 슈팅', String(match.teamMatchStats.shotsOnTarget)],
                  ['패스', String(match.teamMatchStats.passes)],
                  ['패스 정확도', `${match.teamMatchStats.passAccuracy}%`],
                  ['xG', match.teamMatchStats.xG.toFixed(2)],
                  ['코너킥', String(match.teamMatchStats.corners)],
                  ['파울', String(match.teamMatchStats.fouls)],
                  ['경고', String(match.teamMatchStats.yellowCards)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="tabular-nums font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 선수 스탯 */}
          {match.playerMatchStats.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-2">선수 기록</h3>
              <Separator className="mb-2" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="pb-2 font-medium">선수</th>
                      <th className="pb-2 font-medium text-center w-12">득점</th>
                      <th className="pb-2 font-medium text-center w-12">도움</th>
                      <th className="pb-2 font-medium text-center w-12">xG</th>
                      <th className="pb-2 font-medium text-center w-16">출전(분)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.playerMatchStats.map((s) => {
                      const pos = s.player.position as Position
                      const zone = POSITION_ZONE[pos]
                      return (
                        <tr key={s.id} className="border-b border-border/50 last:border-0">
                          <td className="py-2 flex items-center gap-2">
                            <span className={`inline-flex rounded border px-1 py-0.5 text-[10px] font-mono font-semibold shrink-0 ${ZONE_STYLE[zone]}`}>
                              {POSITION_ABBR[pos]}
                            </span>
                            {s.player.playerName}
                          </td>
                          <td className="text-center tabular-nums">{s.goals ?? '—'}</td>
                          <td className="text-center tabular-nums">{s.assists ?? '—'}</td>
                          <td className="text-center tabular-nums">{s.xG != null ? s.xG.toFixed(2) : '—'}</td>
                          <td className="text-center tabular-nums">{s.minutesPlayed ?? '—'}</td>
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

      {canWrite && match && (
        <ScoreDialog open={scoreOpen} onOpenChange={setScoreOpen} match={match} onSaved={() => { setScoreOpen(false); fetchMatch() }} />
      )}
    </div>
  )
}
