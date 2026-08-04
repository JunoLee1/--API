import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { reportApi } from '@/services/report.service'
import type { ReportType } from '@/types/report'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Paperclip, X } from 'lucide-react'

const ALL_TYPES: ReportType[] = ['PERFORMANCE', 'MEDICAL', 'TRAINING', 'HR', 'FINANCIAL', 'ASSET']

export function ReportFormPage() {
  const { t } = useTranslation('report')
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const isAdmin = user?.role === 'ADMIN'
  const foRole = user?.frontOfficeRole
  const TYPES = ALL_TYPES.filter((tp) => {
    if (tp === 'HR') return isAdmin || foRole === 'HR_MANAGER' || foRole === 'HR_STAFF'
    if (tp === 'FINANCIAL') return isAdmin || user?.role === 'GM' || foRole === 'FINANCE_MANAGER' || foRole === 'FINANCE_STAFF'
    if (tp === 'ASSET') return isAdmin || foRole === 'ASSET_MANAGER' || foRole === 'ASSET_STAFF'
    return true
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<ReportType>(() => TYPES[0] ?? 'PERFORMANCE')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async (asDraft: boolean) => {
    if (!title.trim()) { toast.error(t('form.titleRequired')); return }
    if (!content.trim()) { toast.error(t('form.contentRequired')); return }
    setSaving(true)
    try {
      const report = await reportApi.create({ type, title: title.trim(), content: content.trim(), file: file ?? undefined })
      if (!asDraft) {
        await reportApi.submit(report.id)
        toast.success(t('form.submitted'))
      } else {
        toast.success(t('form.draftSaved'))
      }
      navigate('/reports')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('form.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('form.title')}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-5">
          <div className="space-y-1.5">
            <Label>{t('form.typeLabel')} *</Label>
            <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
              <SelectTrigger className="w-48">
                <SelectValue>{t(`type.${type}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((tp) => (
                  <SelectItem key={tp} value={tp}>{t(`type.${tp}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('form.titleLabel')} *</Label>
            <Input
              placeholder={t('form.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('form.contentLabel')} *</Label>
            <Textarea
              placeholder={t('form.contentPlaceholder')}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('form.attachLabel')}</Label>
            {file ? (
              <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-4 w-4 mr-1.5" />{t('form.attachButton')}
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate('/reports')} disabled={saving}>{t('form.cancel')}</Button>
            <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>{t('form.saveDraft')}</Button>
            <Button onClick={() => handleSave(false)} disabled={saving}>
              {saving ? t('form.processing') : t('form.submit')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
