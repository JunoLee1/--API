import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { youthRegistrationApi } from '@/services/youthRegistration.service'
import type { YouthRegistration, YouthRegistrationStatus } from '@/types/youth-registration'
import { YouthRegistrationFormDialog } from './YouthRegistrationFormDialog'

const STATUS_VARIANT: Record<YouthRegistrationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  GUARDIAN_APPROVED: 'secondary',
  CONTRACTED: 'default',
  REJECTED: 'destructive',
}

export default function YouthRegistrationPage() {
  const { t } = useTranslation('youth')
  const [registrations, setRegistrations] = useState<YouthRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await youthRegistrationApi.getAll()
      setRegistrations(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const uniqueTeams = [...new Map(registrations.map(r => [r.teamId, r.team])).values()]

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('registrationPage.title')}</h1>
        <Button onClick={() => setDialogOpen(true)}>{t('registrationPage.addButton')}</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t('registrationPage.loading')}</p>
      ) : registrations.length === 0 ? (
        <p className="text-muted-foreground">{t('registrationPage.noData')}</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4">{t('registrationPage.col.player')}</th>
              <th className="py-2 pr-4">{t('registrationPage.col.team')}</th>
              <th className="py-2 pr-4">{t('registrationPage.col.guardian')}</th>
              <th className="py-2 pr-4">{t('registrationPage.col.jerseyNumber')}</th>
              <th className="py-2">{t('registrationPage.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map(r => (
              <tr key={r.id} className="border-b hover:bg-muted/40">
                <td className="py-2 pr-4 font-medium">{r.playerName}</td>
                <td className="py-2 pr-4">{r.team.name}</td>
                <td className="py-2 pr-4">{r.guardian?.email ?? '-'}</td>
                <td className="py-2 pr-4">{r.preferredJerseyNumber ?? '-'}</td>
                <td className="py-2">
                  <Badge variant={STATUS_VARIANT[r.status]}>{t(`registrationPage.status.${r.status}`)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <YouthRegistrationFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
        teams={uniqueTeams}
      />
    </div>
  )
}
