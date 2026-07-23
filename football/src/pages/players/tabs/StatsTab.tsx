import { useEffect, useState } from 'react'
import { playerApi } from '@/services/player.service'
import type { MatchStat, TrainingResultEntry, RadarData } from '@/types/player'
import { PlayerRadarChart } from '@/components/player/RadarChart'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const ATTENDANCE_KO: Record<string, string> = {
  PRESENT: '출석',
  ABSENT_AUTHORIZED: '공결',
  ABSENT_UNAUTHORIZED: '무단결석',
  LATE_AUTHORIZED: '공지각',
  LATE_UNAUTHORIZED: '무단지각',
}

const SESSION_TYPE_KO: Record<string, string> = {
  INDIVIDUAL_SKILL: '개인 기술',
  TACTICAL_DEFENSIVE: '수비 전술',
  TACTICAL_ATTACKING: '공격 전술',
  TACTICAL_FULL_TEAM: '팀 전술',
  PHYSICAL: '체력',
  PSYCHOLOGICAL_SOCIAL: '심리/사회',
  SET_PIECE: '세트피스',
  GOALKEEPER: '골키퍼',
}

function fmt(v: number | null | undefined, digits = 0): string {
  if (v == null) return '-'
  return v.toFixed(digits)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

interface Props {
  playerId: string
}

export function StatsTab({ playerId }: Props) {
  const [matchStats, setMatchStats] = useState<MatchStat[]>([])
  const [trainingResults, setTrainingResults] = useState<TrainingResultEntry[]>([])
  const [radar, setRadar] = useState<RadarData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      playerApi.getMatchStats(playerId),
      playerApi.getTrainingResults(playerId),
      playerApi.getRadar(playerId),
    ])
      .then(([ms, tr, rd]) => {
        setMatchStats(ms)
        setTrainingResults(tr)
        setRadar(rd)
      })
      .finally(() => setLoading(false))
  }, [playerId])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      {/* 레이더 차트 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">능력치 레이더</h3>
        {radar ? (
          <PlayerRadarChart data={radar} />
        ) : (
          <p className="text-sm text-muted-foreground">데이터를 불러오지 못했습니다.</p>
        )}
      </section>

      <Separator />

      {/* 경기 스탯 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">경기 기록 ({matchStats.length}경기)</h3>
        {matchStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">등록된 경기 기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2 pr-3">날짜</th>
                  <th className="text-right pr-3">골</th>
                  <th className="text-right pr-3">도움</th>
                  <th className="text-right pr-3">xG</th>
                  <th className="text-right pr-3">xA</th>
                  <th className="text-right pr-3">패스%</th>
                  <th className="text-right pr-3">태클%</th>
                  <th className="text-right">출전</th>
                </tr>
              </thead>
              <tbody>
                {matchStats.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-3 text-muted-foreground">{formatDate(s.match.date)}</td>
                    <td className="text-right pr-3 font-medium">{fmt(s.goals)}</td>
                    <td className="text-right pr-3">{fmt(s.assists)}</td>
                    <td className="text-right pr-3">
                      {(s.xG != null && s.xG > 0)
                        ? s.xG.toFixed(2)
                        : (s.goals != null && s.goals > 0)
                          ? <span className="text-orange-500 font-bold">⚠</span>
                          : '-'}
                    </td>
                    <td className="text-right pr-3">
                      {(s.xA != null && s.xA > 0)
                        ? s.xA.toFixed(2)
                        : (s.assists != null && s.assists > 0)
                          ? <span className="text-orange-500 font-bold">⚠</span>
                          : '-'}
                    </td>
                    <td className="text-right pr-3">
                      {(s.passAccuracy != null && s.passAccuracy > 0)
                        ? `${s.passAccuracy.toFixed(0)}%`
                        : (s.minutesPlayed != null && s.minutesPlayed > 0)
                          ? <span className="text-orange-500 font-bold">⚠</span>
                          : '-'}
                    </td>
                    <td className="text-right pr-3">{fmt(s.tackleSuccessRate, 0)}{s.tackleSuccessRate != null ? '%' : ''}</td>
                    <td className="text-right">{s.minutesPlayed != null ? `${s.minutesPlayed}'` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Separator />

      {/* 훈련 결과 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">훈련 기록 (최근 {trainingResults.length}건)</h3>
        {trainingResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">등록된 훈련 기록이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {trainingResults.map((r) => (
              <div key={r.id} className="rounded-md border px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{formatDate(r.session.date)} · {SESSION_TYPE_KO[r.session.sessionType] ?? r.session.sessionType}</p>
                  <p className="text-sm font-medium truncate">{r.session.goal}</p>
                  {r.feedback && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.feedback}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.performanceScore != null && (
                    <span className="text-sm font-semibold">{r.performanceScore}점</span>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {ATTENDANCE_KO[r.attendance] ?? r.attendance}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
