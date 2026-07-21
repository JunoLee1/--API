import { useEffect, useState } from 'react'
import { playerApi } from '@/services/player.service'
import type { MatchStat, TrainingResultEntry } from '@/types/player'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function calcAttendanceRate(results: TrainingResultEntry[]): number {
  if (results.length === 0) return 0
  const present = results.filter((r) =>
    r.attendance === 'PRESENT' || r.attendance === 'LATE_AUTHORIZED' || r.attendance === 'ABSENT_AUTHORIZED'
  ).length
  return Math.round((present / results.length) * 100)
}

function calcVideoCompletionRate(results: TrainingResultEntry[]): number {
  // performanceScore > 0을 영상 완료 기준으로 사용 (영상과제 완료 여부는 추후 VideoAssignment 연동)
  if (results.length === 0) return 0
  const completed = results.filter((r) => r.performanceScore != null && r.performanceScore > 0).length
  return Math.round((completed / results.length) * 100)
}

interface Props {
  playerId: string
}

export function MotivationTab({ playerId }: Props) {
  const [matchStats, setMatchStats] = useState<MatchStat[]>([])
  const [trainingResults, setTrainingResults] = useState<TrainingResultEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      playerApi.getMatchStats(playerId),
      playerApi.getTrainingResults(playerId),
    ])
      .then(([ms, tr]) => {
        setMatchStats(ms)
        setTrainingResults(tr)
      })
      .finally(() => setLoading(false))
  }, [playerId])

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  // (A) 훈련-경기 상관관계 차트 데이터 (최근 10경기와 훈련 점수 추세 오버레이)
  const correlationData = matchStats.slice(0, 10).reverse().map((ms, i) => {
    const training = trainingResults[i]
    return {
      date: formatDate(ms.match.date),
      경기점수: ms.goals != null ? (ms.goals * 20 + (ms.assists ?? 0) * 10) : null,
      훈련점수: training?.performanceScore ?? null,
    }
  })

  // (B) 출석률 + 훈련 성실도
  const attendanceRate = calcAttendanceRate(trainingResults)
  const completionRate = calcVideoCompletionRate(trainingResults)

  // (C) 최근 5경기 vs 시즌 전체 평균 (xG 기준)
  const allXg = matchStats.map((s) => s.xG ?? 0)
  const seasonAvgXg = allXg.length ? allXg.reduce((a, b) => a + b, 0) / allXg.length : 0
  const recent5Xg = allXg.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(allXg.slice(0, 5).length, 1)
  const xgDiff = seasonAvgXg > 0 ? ((recent5Xg - seasonAvgXg) / seasonAvgXg) * 100 : 0

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      {/* (A) 훈련-경기 상관관계 */}
      <section>
        <h3 className="text-sm font-semibold mb-1">훈련과 경기 성과 추세</h3>
        <p className="text-xs text-muted-foreground mb-3">최근 10경기 기준</p>
        {correlationData.length === 0 ? (
          <p className="text-sm text-muted-foreground">데이터가 부족합니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={correlationData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="경기점수" stroke="#3b82f6" dot={false} connectNulls />
              <Line type="monotone" dataKey="훈련점수" stroke="#10b981" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* (B) 훈련 성실도 배지 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">훈련 성실도</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{attendanceRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">출석률</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{completionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">훈련 완료율</p>
          </div>
        </div>
      </section>

      {/* (C) 현재 폼 vs 시즌 평균 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">현재 폼 (최근 5경기 xG)</h3>
        <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">최근 5경기 평균 xG</p>
            <p className="text-2xl font-bold">{recent5Xg.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">시즌 평균 대비</p>
            <p className={`text-xl font-semibold ${xgDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {xgDiff >= 0 ? '+' : ''}{xgDiff.toFixed(1)}%
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
