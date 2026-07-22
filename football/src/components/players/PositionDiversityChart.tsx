import { useEffect, useState } from 'react'
import { playerApi } from '@/services/player.service'
import type { PositionDiversityEntry } from '@/types/player'
import { Skeleton } from '@/components/ui/skeleton'

const BAR_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
]

interface Props {
  playerId: string
}

export function PositionDiversityChart({ playerId }: Props) {
  const [data, setData] = useState<PositionDiversityEntry[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    playerApi
      .getPositionDiversity(playerId)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [playerId])

  if (loading) return <Skeleton className="h-24 w-full" />

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        출전 기록이 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {data.map((entry, i) => (
        <div key={entry.position} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono font-semibold text-foreground">{entry.position}</span>
            <span className="text-muted-foreground">
              {entry.minutes}분 · {entry.percentage}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{ width: `${entry.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
