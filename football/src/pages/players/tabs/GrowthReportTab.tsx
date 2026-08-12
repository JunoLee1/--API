import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { growthReportApi } from '@/services/growthReport.service'
import type { GrowthEvaluation, PlayerBadge, PositionAverage } from '@/types/growth-report'
import { GrowthRadarChart } from '@/components/player/GrowthRadarChart'
import { GrowthEvaluationFormDialog } from '../GrowthEvaluationFormDialog'
import { BadgeAwardDialog } from '../BadgeAwardDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Award } from 'lucide-react'

interface Props {
  playerId: string
  canCoach: boolean
}

export function GrowthReportTab({ playerId, canCoach }: Props) {
  const { t } = useTranslation('player')
  const [evaluations, setEvaluations] = useState<GrowthEvaluation[]>([])
  const [badges, setBadges] = useState<PlayerBadge[]>([])
  const [positionAvg, setPositionAvg] = useState<PositionAverage | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GrowthEvaluation | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [badgeOpen, setBadgeOpen] = useState(false)

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      growthReportApi.getEvaluationsByPlayer(playerId),
      growthReportApi.getBadgesByPlayer(playerId),
    ])
      .then(([evs, bgs]) => {
        setEvaluations(evs)
        setBadges(bgs)
        if (evs.length > 0 && !selected) setSelected(evs[0]!)
      })
      .catch(() => toast.error(t('growthReport.loadFailed')))
      .finally(() => setLoading(false))

    growthReportApi.getPositionAverage(playerId)
      .then(setPositionAvg)
      .catch(() => {})
  }

  useEffect(() => {
    fetchAll()
  }, [playerId])

  const handlePublish = async (id: number) => {
    try {
      await growthReportApi.publishEvaluation(id)
      toast.success(t('growthReport.publishSaved'))
      fetchAll()
    } catch {
      toast.error(t('growthReport.publishFailed'))
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const evalFields = selected ? [
    { label: t('growthReport.attitude'), score: selected.attitudeScore, comment: selected.attitudeComment },
    { label: t('growthReport.fundamentals'), score: selected.fundamentalsScore, comment: selected.fundamentalsComment },
    { label: t('growthReport.spatial'), score: selected.spatialScore, comment: selected.spatialComment },
    { label: t('growthReport.physical'), score: selected.physicalScore, comment: selected.physicalComment },
  ] : []

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{t('growthReport.title')}</h3>
        {canCoach && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBadgeOpen(true)}>
              <Award className="h-3.5 w-3.5 mr-1.5" />
              {t('growthReport.awardBadge')}
            </Button>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('growthReport.writeEval')}
            </Button>
          </div>
        )}
      </div>

      {/* evaluation list + radar */}
      {evaluations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t('growthReport.empty')}
        </div>
      ) : (
        <div className="grid md:grid-cols-[200px_1fr] gap-4">
          {/* period list */}
          <div className="space-y-1">
            {evaluations.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelected(ev)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selected?.id === ev.id
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted'
                }`}
              >
                <div>{t('growthReport.period', { year: ev.year, month: ev.month })}</div>
                <div className={`text-xs mt-0.5 ${selected?.id === ev.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {ev.isPublished ? t('growthReport.published') : t('growthReport.unpublished')}
                </div>
              </button>
            ))}
          </div>

          {/* selected evaluation detail */}
          {selected && (
            <div className="rounded-lg border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">
                    {t('growthReport.evalTitle', { period: t('growthReport.period', { year: selected.year, month: selected.month }) })}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('growthReport.writtenBy', { coach: selected.coach.nickname })}</p>
                </div>
                {canCoach && !selected.isPublished && (
                  <Button size="sm" variant="outline" onClick={() => void handlePublish(selected.id)}>
                    {t('growthReport.publish')}
                  </Button>
                )}
                {selected.isPublished && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{t('growthReport.publishedBadge')}</span>
                )}
              </div>

              <div className="flex justify-center">
                <GrowthRadarChart
                  attitudeScore={selected.attitudeScore}
                  fundamentalsScore={selected.fundamentalsScore}
                  spatialScore={selected.spatialScore}
                  physicalScore={selected.physicalScore}
                />
              </div>

              <div className="space-y-3">
                {evalFields.map(({ label, score, comment }) => (
                  <div key={label} className="flex gap-3">
                    <div className="flex-shrink-0 w-16 text-xs font-medium text-muted-foreground pt-0.5">{label}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="h-1.5 rounded-full bg-muted flex-1">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: `${(score / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold w-6 text-right">{score}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{comment}</p>
                    </div>
                  </div>
                ))}
              </div>

              {positionAvg && (
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{t('growthReport.positionAvg')}</span>
                    {positionAvg.sampleCount < 3 && (
                      <span className="text-xs text-amber-600 font-medium">
                        {t('growthReport.sampleInsufficient', { count: positionAvg.sampleCount })}
                      </span>
                    )}
                  </div>
                  {[
                    { label: t('growthReport.attitude'), playerScore: selected.attitudeScore, avgScore: positionAvg.avgAttitudeScore },
                    { label: t('growthReport.fundamentals'), playerScore: selected.fundamentalsScore, avgScore: positionAvg.avgFundamentalsScore },
                    { label: t('growthReport.spatial'), playerScore: selected.spatialScore, avgScore: positionAvg.avgSpatialScore },
                    { label: t('growthReport.physical'), playerScore: selected.physicalScore, avgScore: positionAvg.avgPhysicalScore },
                  ].map(({ label, playerScore, avgScore }) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-muted-foreground shrink-0">{label}</span>
                      <span className="font-semibold w-5 text-right">{playerScore}</span>
                      {avgScore != null && (
                        <>
                          <span className="text-muted-foreground">vs</span>
                          <span className={`w-5 text-right ${positionAvg.sampleCount < 3 ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                            {avgScore.toFixed(1)}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* badges section */}
      {badges.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">{t('growthReport.badgesTitle')}</h4>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <div
                key={b.id}
                title={b.note ?? undefined}
                className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-3 py-1 text-xs font-medium"
              >
                <Award className="h-3 w-3" />
                {t(`badge.${b.badgeType}`)}
              </div>
            ))}
          </div>
        </div>
      )}

      {canCoach && (
        <>
          <GrowthEvaluationFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            playerId={playerId}
            onSaved={fetchAll}
          />
          <BadgeAwardDialog
            open={badgeOpen}
            onOpenChange={setBadgeOpen}
            playerId={playerId}
            onSaved={fetchAll}
          />
        </>
      )}
    </div>
  )
}
