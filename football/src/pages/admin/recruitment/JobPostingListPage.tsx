import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { recruitmentApi } from '@/services/recruitment.service'
import type { JobPosting, JobPostingStatus } from '@/types/recruitment'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const STATUS_COLORS: Record<JobPostingStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  OPEN: 'default',
  CLOSED: 'secondary',
}

export function JobPostingListPage() {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { user } = useCurrentUser()

  const [postings, setPostings] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', headcount: '1' })

  const canWrite =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' &&
      (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'HR_MANAGER'))

  const load = async () => {
    try {
      setPostings(await recruitmentApi.listPostings())
    } catch {
      toast.error(t('recruitment.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error(t('recruitment.requiredFields'))
      return
    }
    setSaving(true)
    try {
      await recruitmentApi.createPosting({
        title: form.title.trim(),
        description: form.description.trim(),
        headcount: Number(form.headcount) || 1,
      })
      setOpen(false)
      setForm({ title: '', description: '', headcount: '1' })
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('recruitment.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const STATUS_LABEL: Record<JobPostingStatus, string> = {
    DRAFT: t('recruitment.statusDraft'),
    OPEN: t('recruitment.statusOpen'),
    CLOSED: t('recruitment.statusClosed'),
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('recruitment.postingsTitle')}</h1>
        {canWrite && (
          <Button onClick={() => setOpen(true)}>{t('recruitment.createPosting')}</Button>
        )}
      </div>

      {postings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('recruitment.noPostings')}</p>
      ) : (
        <div className="space-y-2">
          {postings.map((p) => (
            <div
              key={p.id}
              className="border rounded-lg p-4 hover:bg-muted/30 cursor-pointer"
              onClick={() => navigate(`/admin/recruitment/postings/${p.id}`)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('recruitment.headcount')}: {p.headcount}명
                    {p.department && ` · ${p.department.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_COLORS[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>
              {p.applications.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('recruitment.applicantCount', { count: p.applications.length })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('recruitment.createPosting')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('recruitment.postingTitle')} *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder={t('recruitment.postingTitlePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('recruitment.postingDesc')} *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('recruitment.headcount')}</Label>
              <Input
                type="number"
                min={1}
                value={form.headcount}
                onChange={(e) => setForm((p) => ({ ...p, headcount: e.target.value }))}
              />
            </div>
            <Button className="w-full" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? t('recruitment.saving') : t('recruitment.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
