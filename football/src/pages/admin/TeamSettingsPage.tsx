import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { clubApi } from '@/services/club.service'
import { Button } from '@/components/ui/button'
import type { Club } from '@/types/team'

export default function TeamSettingsPage() {
  const { t } = useTranslation('admin')
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { navigate('/dashboard'); return }
    clubApi.list().then(setClubs).finally(() => setLoading(false))
  }, [user])

  const toggleLite = async (club: Club) => {
    const updated = await clubApi.update(club.id, { isLite: !club.isLite })
    setClubs(prev => prev.map(c => c.id === club.id ? updated : c))
  }

  if (loading) return <p className="p-6 text-muted-foreground">{t('teamSettingsPage.loading')}</p>

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{t('teamSettingsPage.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('teamSettingsPage.description')}</p>
      <div className="space-y-3">
        {clubs.map(club => (
          <div key={club.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{club.name}</p>
                <p className="text-xs text-muted-foreground">
                  {club.isLite ? t('teamSettingsPage.liteActive') : t('teamSettingsPage.liteInactive')}
                </p>
              </div>
              <Button
                size="sm"
                variant={club.isLite ? 'default' : 'outline'}
                onClick={() => toggleLite(club)}
              >
                {club.isLite ? t('teamSettingsPage.disableLite') : t('teamSettingsPage.enableLite')}
              </Button>
            </div>
            {club.teams.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {club.teams.map(team => (
                  <span key={team.id} className="text-xs bg-muted px-2 py-1 rounded">
                    {team.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {clubs.length === 0 && <p className="text-muted-foreground">{t('teamSettingsPage.noTeams')}</p>}
      </div>
    </div>
  )
}
