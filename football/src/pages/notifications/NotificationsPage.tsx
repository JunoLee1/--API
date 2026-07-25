import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { notificationApi } from '@/services/notification.service'
import type { NotificationItem } from '@/services/notification.service'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatDate(d: string) {
  return new Date(d).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NotificationsPage() {
  const { t } = useTranslation('common')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = () =>
    notificationApi
      .my()
      .then(setNotifications)
      .catch(() => toast.error(t('notificationsPage.loadFailed')))
      .finally(() => setLoading(false))

  useEffect(() => { void fetchNotifications() }, [])

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id)
      setNotifications((prev) =>
        prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n),
      )
    } catch {
      toast.error(t('notificationsPage.markReadFailed'))
    }
  }

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.readAt)
    if (unread.length === 0) return
    setMarkingAll(true)
    try {
      await Promise.all(unread.map((n) => notificationApi.markRead(n.id)))
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
      toast.success(t('notificationsPage.markAllReadSuccess'))
    } catch {
      toast.error(t('notificationsPage.markAllReadFailed'))
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('notificationsPage.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? t('notificationsPage.unreadCount', { count: unreadCount }) : t('notificationsPage.allRead')}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={handleMarkAllRead} disabled={markingAll}>
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
            {t('notificationsPage.markAllRead')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <Bell className="h-8 w-8 opacity-30" />
            <p className="text-sm">{t('notificationsPage.noNotifications')}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={cn(
                  'flex items-start gap-3 px-6 py-4 transition-colors',
                  !n.readAt && 'bg-blue-50/60 dark:bg-blue-950/20',
                )}
              >
                <div className={cn('mt-1 h-2 w-2 rounded-full shrink-0', !n.readAt ? 'bg-blue-500' : 'bg-transparent')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(n.createdAt)}</p>
                </div>
                {!n.readAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-7 text-xs"
                    onClick={() => handleMarkRead(n.id)}
                  >
                    {t('notificationsPage.markRead')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
