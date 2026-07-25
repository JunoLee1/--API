import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { youthRegistrationApi } from '@/services/youthRegistration.service'
import type { CreateYouthRegistrationPayload } from '@/types/youth-registration'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  teams: { id: number; name: string }[]
}

export function YouthRegistrationFormDialog({ open, onClose, onCreated, teams }: Props) {
  const { t } = useTranslation('youth')
  const [form, setForm] = useState<CreateYouthRegistrationPayload>({
    playerName: '',
    birthDate: '',
    teamId: teams[0]?.id ?? 0,
    guardianEmail: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      await youthRegistrationApi.create(form)
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e?.message ?? t('registrationDialog.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('registrationDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('registrationDialog.playerNameLabel')}</Label>
            <Input value={form.playerName} onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))} />
          </div>
          <div>
            <Label>{t('registrationDialog.birthDateLabel')}</Label>
            <Input
              type="date"
              value={form.birthDate ? form.birthDate.split('T')[0] : ''}
              onChange={e => setForm(f => ({ ...f, birthDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
            />
          </div>
          {teams.length > 0 && (
            <div>
              <Label>{t('registrationDialog.teamLabel')}</Label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.teamId}
                onChange={e => setForm(f => ({ ...f, teamId: Number(e.target.value) }))}
              >
                {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label>{t('registrationDialog.guardianEmailLabel')}</Label>
            <Input type="email" value={form.guardianEmail} onChange={e => setForm(f => ({ ...f, guardianEmail: e.target.value }))} />
          </div>
          <div>
            <Label>{t('registrationDialog.jerseyLabel')}</Label>
            <Input
              type="number"
              min={1}
              max={99}
              value={form.preferredJerseyNumber ?? ''}
              onChange={e => setForm(f => ({ ...f, preferredJerseyNumber: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{t('registrationDialog.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? t('registrationDialog.submitting') : t('registrationDialog.submit')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
