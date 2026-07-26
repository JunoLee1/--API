import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { safeguardApi } from '@/services/safeguard.service'

export function SafeguardButton() {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (description.trim().length < 10) {
      setError(t('safeguardButton.descriptionRequired'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      await safeguardApi.submit({
        description: description.trim(),
        ...(contactInfo.trim() && { contactInfo: contactInfo.trim() }),
      })
      setSubmitted(true)
      setDescription('')
      setContactInfo('')
    } catch {
      setError(t('safeguardButton.errorSubmitting'))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setSubmitted(false)
    setError(null)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 active:scale-95 transition-transform flex items-center justify-center text-xl"
        title={t('safeguardButton.title')}
        aria-label={t('safeguardButton.ariaLabel')}
      >
        🚨
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">🚨 {t('safeguardButton.dialogTitle')}</DialogTitle>
          </DialogHeader>

          {submitted ? (
            <div className="space-y-4 text-center py-4">
              <p className="text-green-600 font-semibold">{t('safeguardButton.successTitle')}</p>
              <p className="text-sm text-muted-foreground">
                {t('safeguardButton.successBody')}<br />
                {t('safeguardButton.successAnonymity')}
              </p>
              <Button onClick={handleClose}>{t('safeguardButton.close')}</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('safeguardButton.intro')}
              </p>
              <div>
                <Label>{t('safeguardButton.descriptionLabel')} <span className="text-red-500">*</span></Label>
                <Textarea
                  rows={5}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('safeguardButton.descriptionRequired')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('safeguardButton.contactLabel')}</Label>
                <input
                  type="text"
                  className="w-full mt-1 border rounded px-3 py-2 text-sm"
                  value={contactInfo}
                  onChange={e => setContactInfo(e.target.value)}
                  placeholder={t('safeguardButton.contactPlaceholder')}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>{t('safeguardButton.cancel')}</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => void handleSubmit()}
                  disabled={loading}
                >
                  {loading ? t('safeguardButton.submitting') : t('safeguardButton.submit')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
