import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigate } from 'react-router-dom'
import { type NotificationItem } from '@/services/notification.service'

interface Props {
  notifications: NotificationItem[]
  loading: boolean
}

const ACTION_LABELS: Record<string, string> = {
  RECALL_APPROVAL_REQUESTED: 'Recall 승인 대기',
  TRAINING_SESSION_CONFIRM_REQUESTED: '훈련 세션 확인 요청',
  TACTICAL_ANALYSIS_CONFIRM_REQUESTED: '전술 분석 확인 요청',
  INJURY_READY_TO_RETURN: '부상 복귀 가능',
  CONTRACT_EXPIRY: '계약 만료 임박',
  PERFORMANCE_BONUS_ACHIEVED: '성과 보너스 달성',
  EQUIPMENT_LOW_STOCK: '장비 재고 부족',
  TRAINING_ATTENDANCE_WARNING: '훈련 출석 경고',
  PLAYER_EXTERNAL_ID_UNMAPPED: '선수 외부 ID 미매핑',
  LOAN_OUT_EXPIRED: '임대 만료',
}

export function ActionQueueCard({ notifications, loading }: Props) {
  const navigate = useNavigate()
  const unread = notifications.filter((n) => n.readAt === null)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          처리 대기 항목
          {unread.length > 0 && (
            <span className="ml-2 text-xs font-bold text-destructive">{unread.length}건</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : unread.length === 0 ? (
          <p className="text-sm text-muted-foreground">처리할 항목이 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {unread.slice(0, 5).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="w-full text-left text-sm hover:underline truncate"
                  onClick={() => navigate('/notifications')}
                >
                  {ACTION_LABELS[n.type] ?? n.title} — {n.body}
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
                  +{unread.length - 5}건 더 보기
                </button>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
