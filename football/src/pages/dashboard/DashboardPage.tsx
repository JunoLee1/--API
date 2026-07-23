import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { dashboardApi } from '@/services/dashboard.service'
import { notificationApi, type NotificationItem } from '@/services/notification.service'
import { matchApi } from '@/services/match.service'
import { analysisApi, type TeamRanking } from '@/services/analysis.service'
import { seasonApi } from '@/services/season.service'
import type { Match } from '@/types/match'
import { COMPETITION_LABEL } from '@/types/match'
import type { DashboardStats, YouthDevelopmentStats } from '@/types/dashboard'
import type { AcademyFinanceStats } from '@/types/academy-fee'
import { getDashboardConfig } from './dashboardConfig'
import { StatCard } from '@/components/dashboard/StatCard'
import { ActionQueueCard } from '@/components/dashboard/ActionQueueCard'
import { ScheduleCard, type ScheduleItem } from '@/components/dashboard/ScheduleCard'
import { RecentFeedCard, type FeedItem } from '@/components/dashboard/RecentFeedCard'
import { RankingCard } from '@/components/dashboard/RankingCard'
import { YouthDevelopmentSection } from '@/components/dashboard/YouthDevelopmentSection'
import { AcademyFinanceSection } from '@/components/dashboard/AcademyFinanceSection'

const OUR_TEAM_NAME = 'FC Seoul'

function toScheduleItems(matches: Match[]): ScheduleItem[] {
  const now = new Date()
  return matches
    .filter((m) => new Date(m.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3)
    .map((m) => ({
      id: m.id,
      label: `${m.homeTeamName} vs ${m.awayTeamName}`,
      date: m.date,
    }))
}

function toFeedItems(matches: Match[]): FeedItem[] {
  const now = new Date()
  return matches
    .filter((m) => new Date(m.date) < now && m.homeScore != null && m.awayScore != null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map((m) => {
      const ourIsHome = m.homeTeamName === OUR_TEAM_NAME
      const ourScore = ourIsHome ? m.homeScore! : m.awayScore!
      const oppScore = ourIsHome ? m.awayScore! : m.homeScore!
      const result = ourScore > oppScore ? '승' : ourScore === oppScore ? '무' : '패'
      const score = `${m.homeScore} : ${m.awayScore}`
      return {
        id: m.id,
        label: `${m.homeTeamName} vs ${m.awayTeamName}`,
        sub: `${score} · ${result} · ${COMPETITION_LABEL[m.competitionType]}`,
        date: m.date,
      }
    })
}

export function DashboardPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [myRanking, setMyRanking] = useState<TeamRanking | null>(null)
  const [youthDev, setYouthDev] = useState<YouthDevelopmentStats | null>(null)
  const [academyFinance, setAcademyFinance] = useState<AcademyFinanceStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [notiLoading, setNotiLoading] = useState(true)
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [rankingLoading, setRankingLoading] = useState(true)

  const showYouthDev = user?.role === 'ADMIN' || (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'TD')

  useEffect(() => {
    if (!user) return
    dashboardApi.stats()
      .then(setStats)
      .finally(() => setStatsLoading(false))
    notificationApi.my()
      .then(setNotifications)
      .finally(() => setNotiLoading(false))
    matchApi.list()
      .then(setMatches)
      .catch(() => null)
      .finally(() => setMatchesLoading(false))
    seasonApi.active()
      .then((season) => {
        if (!season) return
        return analysisApi.getRankings({ seasonId: season.id, competitionType: 'LEAGUE' })
          .then((rows) => setMyRanking(rows.find((r) => r.teamName === OUR_TEAM_NAME) ?? null))
      })
      .catch(() => null)
      .finally(() => setRankingLoading(false))
    if (showYouthDev) {
      dashboardApi.youthDevelopment().then(setYouthDev).catch(() => null)
    }
    const config = getDashboardConfig(user)
    if (config.showAcademyFinance) {
      dashboardApi.academyFinance().then(setAcademyFinance).catch(() => null)
    }
  }, [user])

  if (userLoading) {
    return <div className="p-8 text-muted-foreground">불러오는 중...</div>
  }
  if (!user) return null

  const config = getDashboardConfig(user)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">대시보드</h2>
        <p className="text-muted-foreground text-sm">{user.nickname}님, 안녕하세요</p>
      </div>

      {/* 숫자 카드 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {config.statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={stats ? card.getValue(stats) : '—'}
            unit={card.unit}
            highlight={card.highlight && stats ? (card.getValue(stats) as number) > 0 : false}
          />
        ))}
      </div>

      {/* 유소년 포지션 편중 섹션 */}
      {config.showYouthDevelopment && youthDev && (
        <YouthDevelopmentSection data={youthDev} />
      )}

      {/* 아카데미 회비 KPI 섹션 */}
      {config.showAcademyFinance && academyFinance && (
        <AcademyFinanceSection data={academyFinance} />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {config.showActionQueue && (
          <ActionQueueCard notifications={notifications} loading={notiLoading} />
        )}
        {config.recentFeedTitle && (
          <RecentFeedCard
            title={config.recentFeedTitle}
            items={toFeedItems(matches)}
            loading={matchesLoading}
          />
        )}
        {config.showSchedule && (
          <ScheduleCard items={toScheduleItems(matches)} loading={matchesLoading} />
        )}
        {config.showRanking && (
          <RankingCard ranking={myRanking} loading={rankingLoading} />
        )}
      </div>
    </div>
  )
}
