import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { teamApi } from '@/services/team.service'
import { teamAdminApi } from '@/services/teamAdmin.service'
import { Button } from '@/components/ui/button'
import type { Team } from '@/types/team'

export default function TeamSettingsPage() {
  const { t } = useTranslation('admin')
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && user.role !== 'ADMIN') { navigate('/dashboard'); return }
    teamApi.list().then(setTeams).finally(() => setLoading(false))
  }, [user])

  const toggleLite = async (team: Team) => {
    await teamAdminApi.setLite(team.id, !team.isLite)
    setTeams(prev => prev.map(teamItem => teamItem.id === team.id ? { ...teamItem, isLite: !teamItem.isLite } : teamItem))
  }

  if (loading) return <p className="p-6 text-muted-foreground">{t('teamSettingsPage.loading')}</p>

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{t('teamSettingsPage.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('teamSettingsPage.description')}</p>
      <div className="space-y-3">
        {teams.map(team => (
          <div key={team.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{team.name}</p>
              <p className="text-xs text-muted-foreground">{team.isLite ? t('teamSettingsPage.liteActive') : t('teamSettingsPage.liteInactive')}</p>
            </div>
            <Button
              size="sm"
              variant={team.isLite ? 'default' : 'outline'}
              onClick={() => toggleLite(team)}
            >
              {team.isLite ? t('teamSettingsPage.disableLite') : t('teamSettingsPage.enableLite')}
            </Button>
          </div>
        ))}
        {teams.length === 0 && <p className="text-muted-foreground">{t('teamSettingsPage.noTeams')}</p>}
      </div>
    </div>
  )
}
