import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { trainingApi } from '@/services/training.service'
import { seasonApi } from '@/services/season.service'
import type { TrainingSessionDetail, AttendanceStatus } from '@/types/training'
import { ATTENDANCE_LABEL, ATTENDANCE_STYLE } from '@/types/training'
import type { Season } from '@/types/season'
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

interface PlayerStat {
  playerId: string
  playerName: string
  present: number
  lateUnauthorized: number
  absentUnauthorized: number
  absentAuthorized: number
  total: number
  score: number
}

const ATTENDANCE_WEIGHT: Record<AttendanceStatus, number> = {
  PRESENT: 1,
  ABSENT_UNAUTHORIZED: 0,
  LATE_UNAUTHORIZED: 1 / 3,
  ABSENT_AUTHORIZED: 1,
}

export function TrainingAttendancePage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<PlayerStat[]>([])
  const [sessionCount, setSessionCount] = useState(0)

  useEffect(() => {
    seasonApi.list().then((list) => {
      setSeasons(list)
      const active = list.find((s) => s.status === 'ACTIVE') ?? null
      setActiveSeason(active)
      if (active) setSelectedSeasonId(String(active.id))
    }).catch(() => null)
  }, [])

  useEffect(() => {
    if (!selectedSeasonId) return
    const seasonId = Number(selectedSeasonId)
    setLoading(true)
    setStats([])

    trainingApi
      .list(seasonId)
      .then(async (sessions) => {
        const approved = sessions.filter((s) => s.isApproved).slice(-15)
        setSessionCount(approved.length)

        if (approved.length === 0) return

        const details: TrainingSessionDetail[] = await Promise.all(
          approved.map((s) => trainingApi.get(s.id)),
        )

        const playerMap = new Map<string, PlayerStat>()

        for (const session of details) {
          for (const result of session.results) {
            const participant = session.participants.find((p) => p.playerId === result.playerId)
            const name = participant?.player.playerName ?? result.playerId

            if (!playerMap.has(result.playerId)) {
              playerMap.set(result.playerId, {
                playerId: result.playerId,
                playerName: name,
                present: 0,
                lateUnauthorized: 0,
                absentUnauthorized: 0,
                absentAuthorized: 0,
                total: 0,
                score: 0,
              })
            }

            const stat = playerMap.get(result.playerId)!
            stat.total++
            if (result.attendance === 'PRESENT') stat.present++
            else if (result.attendance === 'LATE_UNAUTHORIZED') stat.lateUnauthorized++
            else if (result.attendance === 'ABSENT_UNAUTHORIZED') stat.absentUnauthorized++
            else if (result.attendance === 'ABSENT_AUTHORIZED') stat.absentAuthorized++
            stat.score += ATTENDANCE_WEIGHT[result.attendance]
          }
        }

        const sorted = Array.from(playerMap.values()).sort((a, b) => b.score / (b.total || 1) - a.score / (a.total || 1))
        setStats(sorted)
      })
      .catch(() => toast.error('출석 현황을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [selectedSeasonId])

  const attendanceRate = (stat: PlayerStat) => {
    if (stat.total === 0) return '—'
    const rate = (stat.score / stat.total) * 100
    return `${rate.toFixed(0)}%`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">출석 현황</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {sessionCount > 0 ? `최근 ${sessionCount}개 승인 세션 기준` : '승인된 세션 기준'}
        </p>
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select
          value={selectedSeasonId ?? 'NONE'}
          onValueChange={(v) => setSelectedSeasonId(v)}
        >
          <SelectTrigger className="w-36 h-8 text-sm bg-background">
            <SelectValue placeholder="시즌 선택" />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
                {s.id === activeSeason?.id ? ' (현재)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !selectedSeasonId ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">시즌을 선택해주세요.</div>
        ) : stats.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">출석 기록이 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>선수</TableHead>
                <TableHead className="w-24 text-center">출석</TableHead>
                <TableHead className="w-24 text-center">
                  <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${ATTENDANCE_STYLE['LATE_UNAUTHORIZED']}`}>
                    {ATTENDANCE_LABEL['LATE_UNAUTHORIZED']}
                  </span>
                </TableHead>
                <TableHead className="w-24 text-center">
                  <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${ATTENDANCE_STYLE['ABSENT_UNAUTHORIZED']}`}>
                    {ATTENDANCE_LABEL['ABSENT_UNAUTHORIZED']}
                  </span>
                </TableHead>
                <TableHead className="w-24 text-center">공결</TableHead>
                <TableHead className="w-24 text-right">출석률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s) => (
                <TableRow key={s.playerId}>
                  <TableCell className="font-medium">{s.playerName}</TableCell>
                  <TableCell className="text-center tabular-nums">{s.present}</TableCell>
                  <TableCell className="text-center tabular-nums">{s.lateUnauthorized || '—'}</TableCell>
                  <TableCell className="text-center tabular-nums">{s.absentUnauthorized || '—'}</TableCell>
                  <TableCell className="text-center tabular-nums">{s.absentAuthorized || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{attendanceRate(s)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
