import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { notificationApi, type NotificationItem } from '@/services/notification.service'

const NOTIFICATION_ROUTES: Record<string, string> = {
  CONTRACT_EXPIRY: '/contracts',
  PERFORMANCE_BONUS_ACHIEVED: '/contracts',
  INJURY_READY_TO_RETURN: '/injuries',
  TRAINING_ATTENDANCE_WARNING: '/training/attendance',
  LOAN_OUT_EXPIRED: '/transfers',
  PLAYER_EXTERNAL_ID_UNMAPPED: '/matches',
  RECALL_APPROVAL_REQUESTED: '/transfers',
  TACTICAL_ANALYSIS_CONFIRM_REQUESTED: '/matches/analysis',
  TRAINING_SESSION_CONFIRM_REQUESTED: '/training',
  EQUIPMENT_LOW_STOCK: '/equipment',
}

interface Props {
  unreadCount: number
  onUnreadCountChange: (count: number) => void // 읽지 않는 개수가 바뀔때마다 호출됨
  iconSize?: 'sm' | 'md'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function NotificationPopover({ unreadCount, onUnreadCountChange, iconSize = 'sm' }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await notificationApi.my()
      setItems(data)
      onUnreadCountChange(data.filter((n) => !n.readAt).length)// 읽지 않는 알림 메시지 필터링후 갯수 조회 
    } catch {
      // 조회 실패 시 기존 목록 유지
    } finally {
      setLoading(false)
    }
  }, [onUnreadCountChange])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) void fetchNotifications()
  }

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id)
      const updated = items.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      )
      setItems(updated)
      onUnreadCountChange(updated.filter((n) => !n.readAt).length) // 알림 메시지를 읽은 경우 나머지 읽지 않는 메시지 갯수를 찾아서 업데이트
    } catch {
      // 실패 시 무시
    }
  }

  const handleItemClick = (item: NotificationItem) => {
    if (item.readAt === null) {
      void handleMarkRead(item.id)
    }
    const target = NOTIFICATION_ROUTES[item.type]
    setOpen(false)
    if (target) navigate(target)
  }

  const bellSize = iconSize === 'md' ? 'h-5 w-5' : 'h-4 w-4'

  return (
    <Popover open={open} onOpenChange={handleOpenChange}> 
      <PopoverTrigger asChild>
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="알림">
            <Bell className={bellSize} />
          </Button>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground pointer-events-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold">알림</p>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            새 알림이 없습니다
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y">
            {items.map((item) => {
              const unread = item.readAt === null
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-accent/50 ${
                      unread ? 'bg-accent/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {unread && (
                        <span className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-destructive" />
                      )}
                      <div className={`flex-1 min-w-0 ${!unread ? 'pl-4' : ''}`}>
                        <p
                          className={`text-sm truncate ${unread ? 'font-semibold' : 'font-normal text-muted-foreground'}`}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {item.body}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="border-t">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block text-xs text-muted-foreground text-center py-2 hover:text-foreground transition-colors"
          >
            전체 목록 보기 →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
