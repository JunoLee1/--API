import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TeamRanking } from '@/services/analysis.service'

interface Props {
  ranking: TeamRanking | null
  loading: boolean
}

export function RankingCard({ ranking, loading }: Props) {
  const { t } = useTranslation('common')

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.ranking.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.ranking.loading')}</p>
        ) : !ranking ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.ranking.empty')}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums">{ranking.rank}</span>
              <span className="text-sm text-muted-foreground">{t('dashboard.ranking.rank')}</span>
              <span className="ml-auto text-sm font-semibold tabular-nums">{ranking.points}{t('dashboard.ranking.points')}</span>
            </div>
            <div className="grid grid-cols-4 text-center text-xs text-muted-foreground border rounded-md divide-x overflow-hidden">
              <div className="py-1.5">
                <div className="font-semibold text-foreground tabular-nums">{ranking.played}</div>
                <div>{t('dashboard.ranking.played')}</div>
              </div>
              <div className="py-1.5">
                <div className="font-semibold text-foreground tabular-nums">{ranking.won}</div>
                <div>{t('dashboard.ranking.won')}</div>
              </div>
              <div className="py-1.5">
                <div className="font-semibold text-foreground tabular-nums">{ranking.drawn}</div>
                <div>{t('dashboard.ranking.drawn')}</div>
              </div>
              <div className="py-1.5">
                <div className="font-semibold text-foreground tabular-nums">{ranking.lost}</div>
                <div>{t('dashboard.ranking.lost')}</div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('dashboard.ranking.goalsFor')} {ranking.goalsFor} · {t('dashboard.ranking.goalsAgainst')} {ranking.goalsAgainst}</span>
              <span className={ranking.goalDiff >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                {ranking.goalDiff > 0 ? `+${ranking.goalDiff}` : ranking.goalDiff}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
