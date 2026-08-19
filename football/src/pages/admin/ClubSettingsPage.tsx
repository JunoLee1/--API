import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNavigate } from 'react-router-dom'
import { clubSettingsApi, type ClubSettings } from '@/services/club-settings.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function ClubSettingsPage() {
  const { t } = useTranslation('admin')
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [settings, setSettings] = useState<ClubSettings | null>(null)
  const [form, setForm] = useState({ currency: '', ibiBeta: '', maintenanceCostLimit: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      navigate('/dashboard')
      return
    }
    void clubSettingsApi.get()
      .then(s => {
        setSettings(s)
        setForm({
          currency: s.currency,
          ibiBeta: String(s.ibiBeta),
          maintenanceCostLimit: String(s.maintenanceCostLimit),
        })
      })
      .catch(() => toast.error(t('clubSettings.loadFailed')))
  }, [user, navigate])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await clubSettingsApi.update({
        currency: form.currency.toUpperCase().trim() || undefined,
        ibiBeta: Number(form.ibiBeta) > 0 ? Number(form.ibiBeta) : undefined,
        maintenanceCostLimit: form.maintenanceCostLimit ? Number(form.maintenanceCostLimit) : undefined,
      })
      setSettings(updated)
      toast.success(t('clubSettings.saved'))
    } catch {
      toast.error(t('clubSettings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <p className="p-6 text-muted-foreground">{t('clubSettings.loading')}</p>

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('clubSettings.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('clubSettings.description')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('clubSettings.general')}</CardTitle>
          <CardDescription>{t('clubSettings.generalDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('clubSettings.currency')}</Label>
            <Input
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              placeholder="KRW"
              maxLength={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('clubSettings.ibiBeta')}</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              value={form.ibiBeta}
              onChange={e => setForm(f => ({ ...f, ibiBeta: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('clubSettings.maintenanceCostLimit')}</Label>
            <Input
              type="number"
              step="100000"
              min="0"
              value={form.maintenanceCostLimit}
              onChange={e => setForm(f => ({ ...f, maintenanceCostLimit: e.target.value }))}
            />
          </div>
          <div className="pt-2">
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? t('clubSettings.saving') : t('clubSettings.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('clubSettings.readOnly')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('clubSettings.planApprovalLimit')}</span>
            <span>{settings.planApprovalLimit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('clubSettings.complimentaryTicketLimit')}</span>
            <span>{settings.complimentaryTicketLimit}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
