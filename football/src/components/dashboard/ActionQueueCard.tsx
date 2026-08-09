import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigate } from 'react-router-dom'
import { type NotificationItem } from '@/services/notification.service'

interface Props {
  notifications: NotificationItem[]
  loading: boolean
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  RECALL_APPROVAL_REQUESTED: 'dashboard.actionQueue.labels.RECALL_APPROVAL_REQUESTED',
  TRAINING_SESSION_CONFIRM_REQUESTED: 'dashboard.actionQueue.labels.TRAINING_SESSION_CONFIRM_REQUESTED',
  TACTICAL_ANALYSIS_CONFIRM_REQUESTED: 'dashboard.actionQueue.labels.TACTICAL_ANALYSIS_CONFIRM_REQUESTED',
  INJURY_READY_TO_RETURN: 'dashboard.actionQueue.labels.INJURY_READY_TO_RETURN',
  CONTRACT_EXPIRY: 'dashboard.actionQueue.labels.CONTRACT_EXPIRY',
  CONTRACT_EXPIRY_90D: 'dashboard.actionQueue.labels.CONTRACT_EXPIRY_90D',
  CONTRACT_EXPIRY_60D: 'dashboard.actionQueue.labels.CONTRACT_EXPIRY_60D',
  CONTRACT_EXPIRY_30D: 'dashboard.actionQueue.labels.CONTRACT_EXPIRY_30D',
  PERFORMANCE_BONUS_ACHIEVED: 'dashboard.actionQueue.labels.PERFORMANCE_BONUS_ACHIEVED',
  EQUIPMENT_LOW_STOCK: 'dashboard.actionQueue.labels.EQUIPMENT_LOW_STOCK',
  TRAINING_ATTENDANCE_WARNING: 'dashboard.actionQueue.labels.TRAINING_ATTENDANCE_WARNING',
  PLAYER_EXTERNAL_ID_UNMAPPED: 'dashboard.actionQueue.labels.PLAYER_EXTERNAL_ID_UNMAPPED',
  LOAN_OUT_EXPIRED: 'dashboard.actionQueue.labels.LOAN_OUT_EXPIRED',
}

export function ActionQueueCard({ notifications, loading }: Props) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const unread = notifications.filter((n) => n.readAt === null)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('dashboard.actionQueue.title')}
          {unread.length > 0 && (
            <span className="ml-2 text-xs font-bold text-destructive">{t('dashboard.actionQueue.more', { count: unread.length })}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.actionQueue.loading')}</p>
        ) : unread.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.actionQueue.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {unread.slice(0, 5).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="w-full text-left text-sm hover:underline truncate"
                  onClick={() => navigate('/notifications')}
                >
                  {ACTION_LABEL_KEYS[n.type] ? t(ACTION_LABEL_KEYS[n.type]) : n.title} — {n.body}
                </button>
              </li>
            ))}
            {unread.length > 5 && (
              <li>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/notifications')}
                >
                  {t('dashboard.actionQueue.more', { count: unread.length - 5 })}
                </button>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
