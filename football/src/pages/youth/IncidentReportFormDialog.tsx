import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { incidentReportApi } from '@/services/incidentReport.service'
import type { CreateIncidentReportPayload } from '@/types/incident-report'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  players: { id: string; playerName: string; teamId: number }[]
}

export function IncidentReportFormDialog({ open, onClose, onCreated, players }: Props) {
  const { t } = useTranslation('youth')
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '')
  const [type, setType] = useState<'MATCH' | 'TRAINING'>('TRAINING')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPlayer = players.find(p => p.id === playerId)

  const handleSubmit = async () => {
    if (!selectedPlayer) return
    setLoading(true)
    setError(null)
    try {
      const payload: CreateIncidentReportPayload = {
        playerId,
        teamId: selectedPlayer.teamId,
        type,
        description,
      }
      await incidentReportApi.create(payload)
      onCreated()
      onClose()
      setDescription('')
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('incidentDialog.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('incidentDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('incidentDialog.playerLabel')}</Label>
            <select className="w-full border rounded px-3 py-2 text-sm mt-1" value={playerId} onChange={e => setPlayerId(e.target.value)}>
              {players.map(p => <option key={p.id} value={p.id}>{p.playerName}</option>)}
            </select>
          </div>
          <div>
            <Label>{t('incidentDialog.typeLabel')}</Label>
            <div className="flex gap-3 mt-1">
              {(['TRAINING', 'MATCH'] as const).map(ty => (
                <label key={ty} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={type === ty} onChange={() => setType(ty)} />
                  {ty === 'TRAINING' ? t('incidentPage.typeTraining') : t('incidentPage.typeMatch')}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>{t('incidentDialog.descriptionLabel')}</Label>
            <Textarea
              rows={5}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('incidentDialog.descriptionPlaceholder')}
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{t('incidentDialog.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={loading || !description.trim()}>
              {loading ? t('incidentDialog.saving') : t('incidentDialog.submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
