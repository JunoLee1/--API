import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { incidentReportApi } from '@/services/incidentReport.service'
import { playerApi } from '@/services/player.service'
import type { IncidentReport } from '@/types/incident-report'
import { IncidentReportFormDialog } from './IncidentReportFormDialog'

const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default'> = {
  DRAFT: 'outline', SUBMITTED: 'secondary', SIGNED: 'default',
}

export default function IncidentReportPage() {
  const { t } = useTranslation('youth')
  const [reports, setReports] = useState<IncidentReport[]>([])
  const [players, setPlayers] = useState<{ id: string; playerName: string; teamId: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setReports(await incidentReportApi.getAll()) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    playerApi.list({ level: 'YOUTH' })
      .then(r => setPlayers(r.data.map(p => ({ id: p.id, playerName: p.playerName, teamId: p.teamId ?? 0 }))))
      .catch(() => {})
  }, [])

  const handleSign = async (id: number, role: 'SUPERVISOR' | 'MEDICAL') => {
    await incidentReportApi.sign(id, role)
    load()
  }

  const handleSubmitReport = async (id: number) => {
    await incidentReportApi.submit(id)
    load()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('incidentPage.title')}</h1>
        <Button onClick={() => setDialogOpen(true)}>{t('incidentPage.addButton')}</Button>
      </div>

      {loading ? <p className="text-muted-foreground">{t('incidentPage.loading')}</p> : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{r.player.playerName}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    ({r.type === 'MATCH' ? t('incidentPage.typeMatch') : t('incidentPage.typeTraining')})
                  </span>
                </div>
                <Badge variant={STATUS_VARIANT[r.status]}>{t(`incidentPage.status.${r.status}`)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{t('incidentPage.supervisorSigned')}: {r.supervisorSigned ? '✅' : '❌'}</span>
                <span>{t('incidentPage.medicalSigned')}: {r.medicalSigned ? '✅' : '❌'}</span>
              </div>
              {r.status === 'DRAFT' && (
                <Button size="sm" variant="outline" onClick={() => handleSubmitReport(r.id)}>{t('incidentPage.submitButton')}</Button>
              )}
              {r.status === 'SUBMITTED' && (
                <div className="flex gap-2">
                  {!r.supervisorSigned && (
                    <Button size="sm" variant="outline" onClick={() => handleSign(r.id, 'SUPERVISOR')}>{t('incidentPage.signSupervisor')}</Button>
                  )}
                  {!r.medicalSigned && (
                    <Button size="sm" variant="outline" onClick={() => handleSign(r.id, 'MEDICAL')}>{t('incidentPage.signMedical')}</Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {reports.length === 0 && <p className="text-muted-foreground">{t('incidentPage.noData')}</p>}
        </div>
      )}

      <IncidentReportFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
        players={players}
      />
    </div>
  )
}
