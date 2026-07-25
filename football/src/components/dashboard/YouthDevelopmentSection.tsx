import { useTranslation } from 'react-i18next'
import type { YouthDevelopmentStats } from '@/types/dashboard'

interface Props {
  data: YouthDevelopmentStats
}

export function YouthDevelopmentSection({ data }: Props) {
  const { t } = useTranslation('common')

  if (data.teams.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        {t('dashboard.youthDev.noData')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('dashboard.youthDev.title')}</h3>
      {data.teams.map(team => (
        <div key={team.teamId} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{team.teamName}</span>
            <span className="text-sm text-muted-foreground">
              {t('dashboard.youthDev.biasedOf', { count: team.playerCount })}{' '}
              <span className={team.biasedPlayerCount > 0 ? 'text-red-500 font-semibold' : ''}>
                {t('dashboard.youthDev.biasedCount', { count: team.biasedPlayerCount })}
              </span>
            </span>
          </div>
          {team.players.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b">
                  <th className="text-left py-1 font-normal">{t('dashboard.youthDev.col.player')}</th>
                  <th className="text-right py-1 font-normal">{t('dashboard.youthDev.col.mainPosition')}</th>
                  <th className="text-right py-1 font-normal">{t('dashboard.youthDev.col.bias')}</th>
                  <th className="text-right py-1 font-normal">{t('dashboard.youthDev.col.totalMinutes')}</th>
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
                    <td className="text-right py-1.5 text-muted-foreground">{player.totalMinutes}{t('dashboard.youthDev.minuteUnit')}</td>
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
