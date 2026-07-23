import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { growthReportApi } from '@/services/growthReport.service'
import type { GrowthEvaluation, PlayerBadge } from '@/types/growth-report'
import { BADGE_LABEL } from '@/types/growth-report'
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

function formatPeriod(year: number, month: number) {
  return `${year}년 ${month}월`
}

export function GrowthReportTab({ playerId, canCoach }: Props) {
  const [evaluations, setEvaluations] = useState<GrowthEvaluation[]>([])
  const [badges, setBadges] = useState<PlayerBadge[]>([])
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
      .catch(() => toast.error('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
  }, [playerId])

  const handlePublish = async (id: number) => {
    try {
      await growthReportApi.publishEvaluation(id)
      toast.success('보고서가 발행됐습니다.')
      fetchAll()
    } catch {
      toast.error('발행에 실패했습니다.')
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

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">성장 보고서</h3>
        {canCoach && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBadgeOpen(true)}>
              <Award className="h-3.5 w-3.5 mr-1.5" />
              배지 수여
            </Button>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              평가 작성
            </Button>
          </div>
        )}
      </div>

      {/* 평가 목록 + 레이더 */}
      {evaluations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          아직 작성된 성장 평가가 없습니다.
        </div>
      ) : (
        <div className="grid md:grid-cols-[200px_1fr] gap-4">
          {/* 좌측: 기간 목록 */}
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
                <div>{formatPeriod(ev.year, ev.month)}</div>
                <div className={`text-xs mt-0.5 ${selected?.id === ev.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {ev.isPublished ? '발행됨' : '미발행'}
                </div>
              </button>
            ))}
          </div>

          {/* 우측: 선택된 평가 상세 */}
          {selected && (
            <div className="rounded-lg border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{formatPeriod(selected.year, selected.month)} 성장 평가</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">작성: {selected.coach.nickname}</p>
                </div>
                {canCoach && !selected.isPublished && (
                  <Button size="sm" variant="outline" onClick={() => void handlePublish(selected.id)}>
                    발행
                  </Button>
                )}
                {selected.isPublished && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">발행됨</span>
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
                {[
                  { label: '태도', score: selected.attitudeScore, comment: selected.attitudeComment },
                  { label: '기본기', score: selected.fundamentalsScore, comment: selected.fundamentalsComment },
                  { label: '공간인식', score: selected.spatialScore, comment: selected.spatialComment },
                  { label: '체력', score: selected.physicalScore, comment: selected.physicalComment },
                ].map(({ label, score, comment }) => (
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
            </div>
          )}
        </div>
      )}

      {/* 배지 섹션 */}
      {badges.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">수여된 배지</h4>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <div
                key={b.id}
                title={b.note ?? undefined}
                className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-3 py-1 text-xs font-medium"
              >
                <Award className="h-3 w-3" />
                {BADGE_LABEL[b.badgeType]}
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
