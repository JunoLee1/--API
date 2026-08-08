import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/dashboard.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserX, Activity, Calendar } from 'lucide-react'

const ATTENDANCE_LABEL: Record<string, string> = {
  ABSENT_UNAUTHORIZED: '무단결석',
  LATE_UNAUTHORIZED: '무단지각',
  ABSENT_AUTHORIZED: '공결',
}

const VENUE_LABEL: Record<string, string> = {
  HOME: '홈',
  AWAY: '원정',
  NEUTRAL: '중립',
}

const BODY_PART_LABEL: Record<string, string> = {
  HEAD: '머리',
  NECK: '목',
  SHOULDER: '어깨',
  UPPER_ARM: '상완',
  ELBOW: '팔꿈치',
  FOREARM: '전완',
  WRIST: '손목',
  HAND: '손',
  CHEST: '가슴',
  ABDOMEN: '복부',
  LOWER_BACK: '허리',
  HIP: '엉덩이',
  THIGH: '허벅지',
  KNEE: '무릎',
  SHIN: '정강이',
  ANKLE: '발목',
  FOOT: '발',
  OTHER: '기타',
}

export function CoachDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['coach-dashboard'],
    queryFn: () => dashboardApi.getCoachDashboard(),
    refetchInterval: 60_000,
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">로딩 중...</div>
  if (!data) return null

  const { absentPlayers, injuredPlayers, nextMatch, sessionDate, isToday } = data

  const sessionLabel = isToday
    ? '오늘'
    : sessionDate
      ? new Date(sessionDate).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
      : '최근'

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">코치 대시보드</h1>

      {/* 다음 경기 D-Day */}
      <Card className={nextMatch && nextMatch.daysUntilMatch <= 3 ? 'border-red-400' : ''}>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">다음 경기</CardTitle>
        </CardHeader>
        <CardContent>
          {nextMatch ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">
                  {nextMatch.homeTeamName} vs {nextMatch.awayTeamName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(nextMatch.date).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                  {nextMatch.venue && ` · ${VENUE_LABEL[nextMatch.venue] ?? nextMatch.venue}`}
                </p>
              </div>
              <Badge
                variant={nextMatch.daysUntilMatch <= 3 ? 'destructive' : 'secondary'}
                className="text-xl px-4 py-2"
              >
                D-{nextMatch.daysUntilMatch}
              </Badge>
            </div>
          ) : (
            <p className="text-muted-foreground">예정된 경기 없음</p>
          )}
        </CardContent>
      </Card>

      {/* 출결 이상자 */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <UserX className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-base">{sessionLabel} 훈련 출결 이상</CardTitle>
          {absentPlayers.length > 0 && (
            <Badge variant="outline" className="ml-auto">
              {absentPlayers.length}명
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {absentPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">이상 없음</p>
          ) : (
            <ul className="divide-y">
              {absentPlayers.map((p) => (
                <li key={p.playerId} className="py-2 flex items-center justify-between">
                  <span className="font-medium">{p.playerName}</span>
                  <div className="flex items-center gap-2">
                    {p.position && (
                      <span className="text-xs text-muted-foreground">{p.position}</span>
                    )}
                    <Badge
                      variant={p.attendance === 'ABSENT_UNAUTHORIZED' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {ATTENDANCE_LABEL[p.attendance] ?? p.attendance}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 부상 선수 */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Activity className="h-5 w-5 text-red-500" />
          <CardTitle className="text-base">부상 선수</CardTitle>
          {injuredPlayers.length > 0 && (
            <Badge variant="outline" className="ml-auto">
              {injuredPlayers.length}명
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {injuredPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">부상 선수 없음</p>
          ) : (
            <ul className="divide-y">
              {injuredPlayers.map((p) => (
                <li key={p.playerId} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{p.playerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {BODY_PART_LABEL[p.bodyPart] ?? p.bodyPart}
                    </p>
                  </div>
                  <div className="text-right">
                    {p.daysUntilReturn !== null ? (
                      <Badge
                        variant={p.daysUntilReturn <= 7 ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {p.daysUntilReturn <= 0 ? '복귀 가능' : `D-${p.daysUntilReturn} 복귀`}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        복귀일 미정
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
