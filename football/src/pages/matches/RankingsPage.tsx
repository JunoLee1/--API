import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { analysisApi } from '@/services/analysis.service'
import { seasonApi } from '@/services/season.service'
import type { TeamRanking } from '@/services/analysis.service'
import type { Season } from '@/types/season'
import type { CompetitionType } from '@/types/match'
import { COMPETITION_LABEL } from '@/types/match'
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
import { cn } from '@/lib/utils'

const OUR_TEAM_NAME = 'FC Seoul'

const RANKABLE_TYPES: CompetitionType[] = ['LEAGUE', 'DOMESTIC_CUP', 'CONTINENTAL', 'PLAYOFF']

export function RankingsPage() {
  const [rankings, setRankings] = useState<TeamRanking[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('ALL')
  const [compType, setCompType] = useState<string>('LEAGUE')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    seasonApi.list().then((list) => {
      setSeasons(list)
      const active = list.find((s) => s.status === 'ACTIVE')
      if (active) setSelectedSeasonId(String(active.id))
    }).catch(() => null)
  }, [])

  useEffect(() => {
    if (selectedSeasonId === 'ALL') return
    setLoading(true)
    analysisApi.getRankings({
      seasonId: Number(selectedSeasonId),
      competitionType: compType,
    })
      .then(setRankings)
      .catch(() => {
        toast.error('순위 정보를 불러오지 못했습니다.')
        setRankings([])
      })
      .finally(() => setLoading(false))
  }, [selectedSeasonId, compType])

  const isOurTeam = (name: string) => name === OUR_TEAM_NAME

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">팀 순위</h1>
        <p className="text-sm text-muted-foreground mt-0.5">리그 스탠딩</p>
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={selectedSeasonId} onValueChange={(v) => { if (v) setSelectedSeasonId(v) }}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 시즌</SelectItem>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={compType} onValueChange={(v) => setCompType(v)}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANKABLE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{COMPETITION_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rankings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <p className="text-sm">순위 데이터가 없습니다.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>팀명</TableHead>
                <TableHead className="w-10 text-center">경기</TableHead>
                <TableHead className="w-10 text-center">승</TableHead>
                <TableHead className="w-10 text-center">무</TableHead>
                <TableHead className="w-10 text-center">패</TableHead>
                <TableHead className="w-12 text-center">득점</TableHead>
                <TableHead className="w-12 text-center">실점</TableHead>
                <TableHead className="w-12 text-center">득실</TableHead>
                <TableHead className="w-14 text-center font-semibold">승점</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankings.map((row) => {
                const ours = isOurTeam(row.teamName)
                return (
                  <TableRow
                    key={row.rank}
                    className={cn(
                      ours && 'bg-blue-50 dark:bg-blue-950/30 font-semibold',
                    )}
                  >
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      {row.rank}
                    </TableCell>
                    <TableCell className={cn('font-medium', ours && 'text-blue-700 dark:text-blue-300')}>
                      {row.teamName}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{row.played}</TableCell>
                    <TableCell className="text-center tabular-nums">{row.won}</TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">{row.drawn}</TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">{row.lost}</TableCell>
                    <TableCell className="text-center tabular-nums">{row.goalsFor}</TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">{row.goalsAgainst}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                    </TableCell>
                    <TableCell className="text-center tabular-nums font-bold">{row.points}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
