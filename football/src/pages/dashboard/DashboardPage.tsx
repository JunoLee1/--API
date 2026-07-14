import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { dashboardApi } from '@/services/dashboard.service'
import { notificationApi, type NotificationItem } from '@/services/notification.service'
import type { DashboardStats } from '@/types/dashboard'
import { getDashboardConfig } from './dashboardConfig'
import { StatCard } from '@/components/dashboard/StatCard'
import { ActionQueueCard } from '@/components/dashboard/ActionQueueCard'
import { ScheduleCard } from '@/components/dashboard/ScheduleCard'
import { RecentFeedCard } from '@/components/dashboard/RecentFeedCard'

export function DashboardPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [notiLoading, setNotiLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    dashboardApi.stats()
      .then(setStats)
      .finally(() => setStatsLoading(false))
    notificationApi.my()
      .then(setNotifications)
      .finally(() => setNotiLoading(false))
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {config.showActionQueue && (
          <ActionQueueCard notifications={notifications} loading={notiLoading} />
        )}
        {config.recentFeedTitle && (
          <RecentFeedCard
            title={config.recentFeedTitle}
            items={[]}
            loading={false}
          />
        )}
        {config.showSchedule && (
          <ScheduleCard items={[]} loading={false} />
        )}
      </div>
    </div>
  )
}
