import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TeamRanking } from '@/services/analysis.service'

interface Props {
  ranking: TeamRanking | null
  loading: boolean
}

export function RankingCard({ ranking, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">리그 순위</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : !ranking ? (
          <p className="text-sm text-muted-foreground">순위 정보가 없습니다</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums">{ranking.rank}</span>
              <span className="text-sm text-muted-foreground">위</span>
              <span className="ml-auto text-sm font-semibold tabular-nums">{ranking.points}점</span>
            </div>
            <div className="grid grid-cols-4 text-center text-xs text-muted-foreground border rounded-md divide-x overflow-hidden">
              <div className="py-1.5">
                <div className="font-semibold text-foreground tabular-nums">{ranking.played}</div>
                <div>경기</div>
              </div>
              <div className="py-1.5">
                <div className="font-semibold text-foreground tabular-nums">{ranking.won}</div>
                <div>승</div>
              </div>
              <div className="py-1.5">
                <div className="font-semibold text-foreground tabular-nums">{ranking.drawn}</div>
                <div>무</div>
              </div>
              <div className="py-1.5">
                <div className="font-semibold text-foreground tabular-nums">{ranking.lost}</div>
                <div>패</div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>득점 {ranking.goalsFor} · 실점 {ranking.goalsAgainst}</span>
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
