import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { trainingApi } from '@/services/training.service'
import { injuryApi } from '@/services/injury.service'
import { matchApi } from '@/services/match.service'
import { playerApi } from '@/services/player.service'
import type { TrainingSessionDetail } from '@/types/training'
import type { Match } from '@/types/match'

const OUR_TEAM_NAME = 'FC Seoul'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

// ────────────────────────────────────────────────
// Box 1: 오늘 훈련 결석자
// ────────────────────────────────────────────────
function TodayTrainingBox({ seasonId }: { seasonId: number | undefined }) {
  const { t } = useTranslation('common')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<TrainingSessionDetail | null>(null)
  const [noSession, setNoSession] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNoSession(false)
    setDetail(null)

    trainingApi
      .list(seasonId)
      .then((sessions) => {
        const today = todayStr()
        const todaySession = sessions.find((s) => s.date.slice(0, 10) === today)
        if (!todaySession) {
          setNoSession(true)
          return
        }
        return trainingApi.get(todaySession.id).then(setDetail)
      })
      .finally(() => setLoading(false))
  }, [seasonId])

  const absentStatuses = ['ABSENT_UNAUTHORIZED', 'ABSENT_AUTHORIZED'] as const

  const nameMap: Record<string, string> = {}
  if (detail) {
    for (const p of detail.participants) {
      nameMap[p.playerId] = p.player.playerName
    }
  }

  const absentees =
    detail?.results.filter((r) => absentStatuses.includes(r.attendance as typeof absentStatuses[number])) ?? []

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.coachView.todayAbsent')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : noSession ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.coachView.noSession')}</p>
        ) : absentees.length === 0 ? (
          <p className="text-sm font-medium text-green-600">{t('dashboard.coachView.allPresent')}</p>
        ) : (
          <div className="space-y-1">
            <p className="text-2xl font-bold text-red-600">{t('dashboard.coachView.absentCount', { count: absentees.length })}</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {absentees.map((r) => (
                <li key={r.playerId}>{nameMap[r.playerId] ?? r.playerId}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────
// Box 2: 부상자 현황
// ────────────────────────────────────────────────
function InjuryStatusBox() {
  const { t } = useTranslation('common')
  const [loading, setLoading] = useState(true)
  const [injuries, setInjuries] = useState<{ playerId: string }[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>({})

  useEffect(() => {
    setLoading(true)
    Promise.all([injuryApi.active(), playerApi.list()])
      .then(([inj, players]) => {
        setInjuries(inj)
        const map: Record<string, string> = {}
        for (const p of players) map[p.id] = p.playerName
        setNameMap(map)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.coachView.injuryStatus')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : injuries.length === 0 ? (
          <p className="text-sm font-medium text-green-600">{t('dashboard.coachView.noInjuries')}</p>
        ) : (
          <div className="space-y-1">
            <p className="text-2xl font-bold text-orange-600">{t('dashboard.coachView.injuredCount', { count: injuries.length })}</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {injuries.map((i) => (
                <li key={i.playerId}>{nameMap[i.playerId] ?? i.playerId}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────
// Box 3: 다음 경기 D-Day
// ────────────────────────────────────────────────
function NextMatchBox({ seasonId }: { seasonId: number | undefined }) {
  const { t } = useTranslation('common')
  const [loading, setLoading] = useState(true)
  const [nextMatch, setNextMatch] = useState<Match | null>(null)
  const [noMatch, setNoMatch] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNoMatch(false)
    setNextMatch(null)

    matchApi
      .list({ seasonId })
      .then((matches) => {
        const upcoming = matches
          .filter((m) => m.homeScore === null && new Date(m.date).getTime() > Date.now())
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        if (upcoming.length === 0) {
          setNoMatch(true)
        } else {
          setNextMatch(upcoming[0])
        }
      })
      .finally(() => setLoading(false))
  }, [seasonId])

  const opponent = nextMatch
    ? nextMatch.homeTeamName === OUR_TEAM_NAME
      ? nextMatch.awayTeamName
      : nextMatch.homeTeamName
    : null

  const dday = nextMatch ? daysUntil(nextMatch.date) : null

  const matchDateLabel = nextMatch
    ? new Date(nextMatch.date).toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      })
    : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.coachView.nextMatch')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : noMatch ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.coachView.noUpcoming')}</p>
        ) : (
          <div className="space-y-0.5">
            <p className="text-2xl font-bold tabular-nums">
              {dday === 0 ? 'D-Day' : dday !== null && dday > 0 ? `D-${dday}` : `D+${Math.abs(dday!)}`}
            </p>
            <p className="text-sm font-medium">vs {opponent}</p>
            <p className="text-xs text-muted-foreground">{matchDateLabel}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────
export function CoachQuickView({ seasonId }: { seasonId: number | undefined }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <TodayTrainingBox seasonId={seasonId} />
      <InjuryStatusBox />
      <NextMatchBox seasonId={seasonId} />
    </div>
  )
}
