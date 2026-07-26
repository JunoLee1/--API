import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { playerApi } from '@/services/player.service'
import type { MatchStat, TrainingResultEntry, RadarData } from '@/types/player'
import { PlayerRadarChart } from '@/components/player/RadarChart'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

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
  const { t } = useTranslation('player')
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
      {/* radar chart */}
      <section>
        <h3 className="text-sm font-semibold mb-3">{t('statsTab.radarTitle')}</h3>
        {radar ? (
          <PlayerRadarChart data={radar} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('statsTab.radarError')}</p>
        )}
      </section>

      <Separator />

      {/* match stats */}
      <section>
        <h3 className="text-sm font-semibold mb-3">{t('statsTab.matchTitle', { count: matchStats.length })}</h3>
        {matchStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('statsTab.noMatchStats')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2 pr-4 sticky left-0 bg-background">{t('statsTab.tableHeaders.date')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.min')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.goals')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.assists')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.shots')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.shotsOnTarget')}</th>
                  <th className="text-right pr-3">xG</th>
                  <th className="text-right pr-3">xA</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.keyPasses')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.passRate')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.tackles')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.tackleRate')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.intercept')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.clearances')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.recovery')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.turnover')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.groundRate')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.aerialRate')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.longPass')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.shotBlocked')}</th>
                  <th className="text-right pr-3">{t('statsTab.tableHeaders.saves')}</th>
                  <th className="text-right">{t('statsTab.tableHeaders.distance')}</th>
                </tr>
              </thead>
              <tbody>
                {matchStats.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-4 text-muted-foreground sticky left-0 bg-background">{formatDate(s.match.date)}</td>
                    <td className="text-right pr-3">{s.minutesPlayed != null ? `${s.minutesPlayed}'` : '-'}</td>
                    <td className="text-right pr-3 font-medium">{fmt(s.goals)}</td>
                    <td className="text-right pr-3">{fmt(s.assists)}</td>
                    <td className="text-right pr-3">{fmt(s.shots)}</td>
                    <td className="text-right pr-3">{fmt(s.shotsOnTarget)}</td>
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
                    <td className="text-right pr-3">{fmt(s.keyPasses)}</td>
                    <td className="text-right pr-3">
                      {(() => { const att = (s.passesAttempted ?? 0) + (s.longPassesAttempted ?? 0); const cmp = (s.passesCompleted ?? 0) + (s.longPassesCompleted ?? 0); return att > 0 ? `${Math.round(cmp / att * 100)}%` : '-' })()}
                    </td>
                    <td className="text-right pr-3">{fmt(s.tackles)}</td>
                    <td className="text-right pr-3">{s.tackleSuccessRate != null ? `${s.tackleSuccessRate}%` : '-'}</td>
                    <td className="text-right pr-3">{fmt(s.interceptions)}</td>
                    <td className="text-right pr-3">{fmt(s.clearances)}</td>
                    <td className="text-right pr-3">{fmt(s.ballRecoveries)}</td>
                    <td className="text-right pr-3">{fmt(s.turnovers)}</td>
                    <td className="text-right pr-3">{s.groundDuelSuccessRate != null ? `${s.groundDuelSuccessRate}%` : '-'}</td>
                    <td className="text-right pr-3">{s.aerialDuelSuccessRate != null ? `${s.aerialDuelSuccessRate}%` : '-'}</td>
                    <td className="text-right pr-3">
                      {(s.longPassesAttempted != null && s.longPassesAttempted > 0)
                        ? `${s.longPassesCompleted ?? 0}/${s.longPassesAttempted} (${Math.round((s.longPassesCompleted ?? 0) / s.longPassesAttempted * 100)}%)`
                        : '-'}
                    </td>
                    <td className="text-right pr-3">{fmt(s.shotBlocked)}</td>
                    <td className="text-right pr-3">{fmt(s.saves)}</td>
                    <td className="text-right">
                      {(s.distanceCovered != null || s.sprint != null)
                        ? <span className="text-[10px] leading-tight">
                            {s.distanceCovered != null ? `${s.distanceCovered.toFixed(1)}km` : '—'}<br />
                            {s.sprint != null ? t('statsTab.sprint', { count: Math.round(s.sprint) }) : '—'}
                          </span>
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Separator />

      {/* training results */}
      <section>
        <h3 className="text-sm font-semibold mb-3">{t('statsTab.trainingTitle', { count: trainingResults.length })}</h3>
        {trainingResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('statsTab.noTrainingStats')}</p>
        ) : (
          <div className="space-y-2">
            {trainingResults.map((r) => (
              <div key={r.id} className="rounded-md border px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.session.date)} · {t(`trainingType.${r.session.sessionType}`, r.session.sessionType)}
                  </p>
                  <p className="text-sm font-medium truncate">{r.session.goal}</p>
                  {r.feedback && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.feedback}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.performanceScore != null && (
                    <span className="text-sm font-semibold">{t('statsTab.score', { score: r.performanceScore })}</span>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {t(`attendanceStatus.${r.attendance}`, r.attendance)}
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
