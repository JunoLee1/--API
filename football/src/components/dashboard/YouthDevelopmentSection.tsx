import type { YouthDevelopmentStats } from '@/types/dashboard'

interface Props {
  data: YouthDevelopmentStats
}

export function YouthDevelopmentSection({ data }: Props) {
  if (data.teams.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        유소년 팀 경기 데이터가 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">유소년 포지션 편중 현황</h3>
      {data.teams.map(team => (
        <div key={team.teamId} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{team.teamName}</span>
            <span className="text-sm text-muted-foreground">
              {team.playerCount}명 중{' '}
              <span className={team.biasedPlayerCount > 0 ? 'text-red-500 font-semibold' : ''}>
                {team.biasedPlayerCount}명 편중
              </span>
            </span>
          </div>
          {team.players.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b">
                  <th className="text-left py-1 font-normal">선수</th>
                  <th className="text-right py-1 font-normal">주 포지션</th>
                  <th className="text-right py-1 font-normal">편중도</th>
                  <th className="text-right py-1 font-normal">총 출전</th>
                </tr>
              </thead>
              <tbody>
                {team.players.map(player => (
                  <tr key={player.playerId} className="border-b last:border-0">
                    <td className="py-1.5">{player.playerName}</td>
                    <td className="text-right py-1.5 text-muted-foreground">{player.biasedSlot ?? '—'}</td>
                    <td className="text-right py-1.5">
                      {player.isBiased ? (
                        <span className="text-red-500 font-semibold">{player.biasedPct}% ⚠</span>
                      ) : (
                        <span>{player.biasedPct}%</span>
                      )}
                    </td>
                    <td className="text-right py-1.5 text-muted-foreground">{player.totalMinutes}분</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}
