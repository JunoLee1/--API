import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTeamContext } from '@/layouts/AppShell'
import { dashboardApi } from '@/services/dashboard.service'
import { notificationApi, type NotificationItem } from '@/services/notification.service'
import { matchApi } from '@/services/match.service'
import { analysisApi, type TeamRanking } from '@/services/analysis.service'
import { seasonApi } from '@/services/season.service'
import { operatingExpenseApi } from '@/services/operating-expense.service'
import { opsReportApi } from '@/services/ops-report.service'
import { salesApi } from '@/services/sales.service'
import type { OpsSnapshotData } from '@/types/ops-report'
import type { Match } from '@/types/match'
import { COMPETITION_LABEL } from '@/types/match'
import type { DashboardStats, YouthDevelopmentStats } from '@/types/dashboard'
import type { AcademyFinanceStats } from '@/types/academy-fee'
import type { OperatingExpense } from '@/types/budget'
import { getDashboardConfig } from './dashboardConfig'
import { StatCard } from '@/components/dashboard/StatCard'
import { ActionQueueCard } from '@/components/dashboard/ActionQueueCard'
import { ScheduleCard, type ScheduleItem } from '@/components/dashboard/ScheduleCard'
import { RecentFeedCard, type FeedItem } from '@/components/dashboard/RecentFeedCard'
import { RankingCard } from '@/components/dashboard/RankingCard'
import { YouthDevelopmentSection } from '@/components/dashboard/YouthDevelopmentSection'
import { AcademyFinanceSection } from '@/components/dashboard/AcademyFinanceSection'
import { OpsKpiSection } from '@/components/dashboard/OpsKpiSection'
import { CoachQuickView } from '@/components/dashboard/CoachQuickView'

const OUR_TEAM_NAME = 'FC Seoul'

const CATEGORY_LABEL: Record<string, string> = {
  TRAVEL: '출장·원정',
  EQUIPMENT: '장비·용품',
  SCOUTING: '스카우팅',
  YOUTH: '유소년',
}

function toOperatingExpenseFeedItems(expenses: OperatingExpense[]): FeedItem[] {
  return expenses
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      label: `${CATEGORY_LABEL[e.category] ?? e.category} · ${e.amount.toLocaleString()}원`,
      sub: e.note ?? undefined,
      date: e.date,
    }))
}

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

function toFeedItems(matches: Match[], tFn: (key: string) => string): FeedItem[] {
  const now = new Date()
  return matches
    .filter((m) => new Date(m.date) < now && m.homeScore != null && m.awayScore != null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map((m) => {
      const ourIsHome = m.homeTeamName === OUR_TEAM_NAME
      const ourScore = ourIsHome ? m.homeScore! : m.awayScore!
      const oppScore = ourIsHome ? m.awayScore! : m.homeScore!
      const resultKey = ourScore > oppScore ? 'dashboard.matchResult.WIN' : ourScore === oppScore ? 'dashboard.matchResult.DRAW' : 'dashboard.matchResult.LOSS'
      const score = `${m.homeScore} : ${m.awayScore}`
      return {
        id: m.id,
        label: `${m.homeTeamName} vs ${m.awayTeamName}`,
        sub: `${score} · ${tFn(resultKey)} · ${COMPETITION_LABEL[m.competitionType]}`,
        date: m.date,
      }
    })
}

export function DashboardPage() {
  const { t } = useTranslation('common')
  const { user, loading: userLoading } = useCurrentUser()
  const teamCtx = useTeamContext()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [seasonTicketRevenue, setSeasonTicketRevenue] = useState<number | null>(null)
  const [opsKpiYear, setOpsKpiYear] = useState<number>(new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear())
  const [opsKpiMonth, setOpsKpiMonth] = useState<number>(new Date().getMonth() === 0 ? 12 : new Date().getMonth())
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [myRanking, setMyRanking] = useState<TeamRanking | null>(null)
  const [youthDev, setYouthDev] = useState<YouthDevelopmentStats | null>(null)
  const [academyFinance, setAcademyFinance] = useState<AcademyFinanceStats | null>(null)
  const [recentExpenses, setRecentExpenses] = useState<OperatingExpense[]>([])
  const [opsKpi, setOpsKpi] = useState<OpsSnapshotData | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [notiLoading, setNotiLoading] = useState(true)
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [rankingLoading, setRankingLoading] = useState(true)
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [currentSeasonId, setCurrentSeasonId] = useState<number | undefined>(undefined)

  const showYouthDev = user?.role === 'ADMIN' || (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'TD')

  useEffect(() => {
    if (!user) return
    dashboardApi.stats()
      .then(setStats)
      .finally(() => setStatsLoading(false))
    notificationApi.my()
      .then(setNotifications)
      .finally(() => setNotiLoading(false))
    if (teamCtx !== 'YOUTH') {
      matchApi.list()
        .then(setMatches)
        .catch(() => null)
        .finally(() => setMatchesLoading(false))
    } else {
      setMatchesLoading(false)
    }
    const config = getDashboardConfig(user, teamCtx)
    seasonApi.active()
      .then((season) => {
        if (!season) return
        setCurrentSeasonId(season.id)
        const tasks: Promise<unknown>[] = []
        if (teamCtx !== 'YOUTH') {
          tasks.push(
            analysisApi.getRankings({ seasonId: season.id, competitionType: 'LEAGUE' })
              .then((rows) => setMyRanking(rows.find((r) => r.teamName === OUR_TEAM_NAME) ?? null))
              .finally(() => setRankingLoading(false))
          )
        } else {
          setRankingLoading(false)
        }
        if (config.recentFeedTitle === 'dashboard.recentFeed.recentOperatingExpenses') {
          setExpensesLoading(true)
          tasks.push(
            operatingExpenseApi.list(season.id)
              .then(setRecentExpenses)
              .catch(() => null)
              .finally(() => setExpensesLoading(false))
          )
        }
        if (config.showOpsKpi) {
          const now = new Date()
          const kpiYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
          const kpiMonth = now.getMonth() === 0 ? 12 : now.getMonth()
          setOpsKpiYear(kpiYear)
          setOpsKpiMonth(kpiMonth)
          tasks.push(
            opsReportApi.getOpsKpi(season.id, kpiYear, kpiMonth)
              .then(setOpsKpi)
              .catch(() => null)
          )
        }
        if (config.showTicketRevenue) {
          tasks.push(
            salesApi.seasonTicketTotal(season.id)
              .then((r) => setSeasonTicketRevenue(r.total))
              .catch(() => null)
          )
        }
        return Promise.all(tasks)
      })
      .catch(() => null)
      .finally(() => setRankingLoading(false))
    if (showYouthDev) {
      dashboardApi.youthDevelopment().then(setYouthDev).catch(() => null)
    }
    if (config.showAcademyFinance) {
      dashboardApi.academyFinance().then(setAcademyFinance).catch(() => null)
    }
  }, [user, teamCtx])

  if (userLoading) {
    return <div className="p-8 text-muted-foreground">{t('dashboard.loading')}</div>
  }
  if (!user) return null

  const config = getDashboardConfig(user, teamCtx)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">{t('dashboard.title')}</h2>
        <p className="text-muted-foreground text-sm">{t('dashboard.greeting', { name: user.nickname })}</p>
      </div>

      {/* HEAD_COACH 전용 퀵뷰 */}
      {user.role === 'COACHING_STAFF' && user.coachingRole === 'HEAD_COACH' && (
        <CoachQuickView seasonId={currentSeasonId} />
      )}

      {/* 숫자 카드 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {config.statCards.map((card) => (
          <StatCard
            key={card.label}
            label={t(card.label)}
            value={stats ? card.getValue(stats) : '—'}
            unit={card.unit ? t(card.unit) : undefined}
            highlight={card.highlight && stats ? (card.getValue(stats) as number) > 0 : false}
          />
        ))}
        {config.showTicketRevenue && seasonTicketRevenue !== null && (
          <button
            type="button"
            className="text-left hover:opacity-80 transition-opacity cursor-pointer"
            onClick={() => navigate('/finance/ticket-sales')}
          >
            <StatCard
              label="시즌 티켓 수입"
              value={`₩${seasonTicketRevenue.toLocaleString()}`}
            />
          </button>
        )}
      </div>

      {/* 유소년 포지션 편중 섹션 */}
      {config.showYouthDevelopment && youthDev && (
        <YouthDevelopmentSection data={youthDev} />
      )}

      {/* 아카데미 회비 KPI 섹션 */}
      {config.showAcademyFinance && academyFinance && (
        <AcademyFinanceSection data={academyFinance} />
      )}

      {/* 운영/재무 KPI 섹션 */}
      {config.showOpsKpi && opsKpi && (
        <OpsKpiSection
          role={user.frontOfficeRole === 'HR_MANAGER' ? 'HR_MANAGER' : 'FINANCE_MANAGER'}
          data={opsKpi as unknown as Record<string, number>}
          year={opsKpiYear}
          month={opsKpiMonth}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {config.showActionQueue && (
          <ActionQueueCard notifications={notifications} loading={notiLoading} />
        )}
        {config.recentFeedTitle && (() => {
          const isExpenseFeed = config.recentFeedTitle === 'dashboard.recentFeed.recentOperatingExpenses'
          return (
            <RecentFeedCard
              title={t(config.recentFeedTitle)}
              items={isExpenseFeed ? toOperatingExpenseFeedItems(recentExpenses) : toFeedItems(matches, t)}
              loading={isExpenseFeed ? expensesLoading : matchesLoading}
            />
          )
        })()}
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
