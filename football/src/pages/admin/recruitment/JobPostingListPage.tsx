import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { recruitmentApi } from '@/services/recruitment.service'
import { planReportApi, type ApprovedHrReport } from '@/services/plan-report.service'
import { hiringSurveyApi } from '@/services/hiring-survey.service'
import type { JobPosting, JobPostingStatus } from '@/types/recruitment'
import type { HiringPlanItem } from '@/types/hiring-survey'
import { PRIORITY_LABELS } from '@/types/hiring-survey'
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
  const [approvedHrReports, setApprovedHrReports] = useState<ApprovedHrReport[]>([])
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)
  const [hiringItems, setHiringItems] = useState<HiringPlanItem[]>([])
  const [selectedHiringItemId, setSelectedHiringItemId] = useState<number | undefined>(undefined)
  const [form, setForm] = useState({ title: '', description: '', headcount: '1' })

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'HR_MANAGER')

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

  const handleOpenDialog = async () => {
    setOpen(true)
    try {
      setApprovedHrReports(await planReportApi.listApprovedHr())
    } catch {
      toast.error(t('recruitment.loadFailed'))
    }
  }

  const handleSelectReport = async (idStr: string) => {
    const id = Number(idStr)
    const report = approvedHrReports.find((r) => r.id === id) ?? null
    setSelectedReportId(id || null)
    setSelectedHiringItemId(undefined)
    if (report) {
      setForm((p) => ({ ...p, title: report.title }))
      try {
        const items = await hiringSurveyApi.listHiringItems(id)
        setHiringItems(items)
      } catch {
        setHiringItems([])
      }
    } else {
      setHiringItems([])
    }
  }

  const handleCreate = async () => {
    if (!selectedReportId) {
      toast.error(t('recruitment.planReportRequired'))
      return
    }
    if (!form.description.trim()) {
      toast.error(t('recruitment.requiredFields'))
      return
    }
    setSaving(true)
    try {
      const report = approvedHrReports.find((r) => r.id === selectedReportId)!
      await recruitmentApi.createPosting({
        title: form.title.trim() || report.title,
        description: form.description.trim(),
        headcount: Number(form.headcount) || 1,
        departmentId: report.departmentId,
        planReportId: selectedReportId,
        hiringPlanItemId: selectedHiringItemId,
      })
      setOpen(false)
      setForm({ title: '', description: '', headcount: '1' })
      setSelectedReportId(null)
      setSelectedHiringItemId(undefined)
      setHiringItems([])
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
          <Button onClick={() => void handleOpenDialog()}>{t('recruitment.createPosting')}</Button>
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
              <Label>{t('recruitment.planReport')} *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={selectedReportId ?? ''}
                onChange={(e) => void handleSelectReport(e.target.value)}
              >
                <option value="">{t('recruitment.selectPlanReport')}</option>
                {approvedHrReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.department.name})
                  </option>
                ))}
              </select>
              {approvedHrReports.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('recruitment.noApprovedHrReports')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t('recruitment.postingTitle')}</Label>
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
            {hiringItems.length > 0 && (
              <div className="space-y-1.5">
                <Label>채용 계획 항목 연결 (선택)</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={selectedHiringItemId ?? ''}
                  onChange={(e) => setSelectedHiringItemId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">연결 안 함</option>
                  {hiringItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.roleTitle} · {item.headcount}명 · {PRIORITY_LABELS[item.priority]}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
