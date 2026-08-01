import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { recruitmentApi } from '@/services/recruitment.service'
import type { JobPosting, JobApplication } from '@/types/recruitment'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const STATUS_LABEL: Record<string, string> = {
  APPLIED: '지원', SCREENING: '서류검토', INTERVIEW_1: '1차면접',
  INTERVIEW_2: '2차면접', REFERENCE_CHECK: '레퍼런스체크',
  OFFERED: '합격통보', HIRED: '채용완료', ONBOARDED: '온보딩', REJECTED: '불합격',
}

const APP_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  OFFERED: 'default', HIRED: 'default', ONBOARDED: 'default',
  REJECTED: 'destructive',
}

export function JobPostingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')
  const { user } = useCurrentUser()

  const [posting, setPosting] = useState<JobPosting | null>(null)
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const postingId = Number(id)

  const canWrite =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' &&
      (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'HR_MANAGER'))
  const canApprove =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'GM')

  const load = async () => {
    try {
      const [p, apps] = await Promise.all([
        recruitmentApi.getPosting(postingId),
        recruitmentApi.listApplications(postingId),
      ])
      setPosting(p)
      setApplications(apps)
    } catch {
      toast.error(t('recruitment.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [postingId])

  const handleApprove = async () => {
    setSaving(true)
    try {
      setPosting(await recruitmentApi.approvePosting(postingId))
      toast.success(t('recruitment.approved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('recruitment.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async () => {
    if (!confirm(t('recruitment.confirmClose'))) return
    setSaving(true)
    try {
      setPosting(await recruitmentApi.closePosting(postingId))
      toast.success(t('recruitment.closed'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('recruitment.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>
  if (!posting) return <div className="p-6 text-sm text-destructive">공고를 찾을 수 없습니다.</div>

  const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'outline'> = {
    DRAFT: 'outline', OPEN: 'default', CLOSED: 'secondary',
  }
  const STATUS_TEXT: Record<string, string> = {
    DRAFT: t('recruitment.statusDraft'),
    OPEN: t('recruitment.statusOpen'),
    CLOSED: t('recruitment.statusClosed'),
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="space-y-1">
        <button
          onClick={() => navigate('/admin/recruitment')}
          className="text-sm text-muted-foreground hover:underline"
        >
          {t('recruitment.backToList')}
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{posting.title}</h1>
          <Badge variant={STATUS_COLORS[posting.status]}>{STATUS_TEXT[posting.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('recruitment.headcount')}: {posting.headcount}명
          {posting.department && ` · ${posting.department.name}`}
        </p>
        <p className="text-sm mt-2">{posting.description}</p>
      </div>

      {(canApprove || canWrite) && posting.status !== 'CLOSED' && (
        <div className="flex gap-2">
          {canApprove && posting.status === 'DRAFT' && (
            <Button onClick={() => void handleApprove()} disabled={saving}>
              {t('recruitment.approvePosting')}
            </Button>
          )}
          {canWrite && posting.status === 'OPEN' && (
            <Button variant="outline" onClick={() => void handleClose()} disabled={saving}>
              {t('recruitment.closePosting')}
            </Button>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">
          {t('recruitment.applications')} ({applications.length})
        </h2>
        {applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('recruitment.noApplications')}</p>
        ) : (
          <div className="space-y-2">
            {applications.map((app) => (
              <div
                key={app.id}
                className="border rounded-lg p-3 hover:bg-muted/30 cursor-pointer"
                onClick={() => navigate(`/admin/recruitment/applications/${app.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{app.applicantName}</p>
                    <p className="text-sm text-muted-foreground">{app.email}</p>
                  </div>
                  <Badge variant={APP_VARIANT[app.status] ?? 'secondary'}>
                    {STATUS_LABEL[app.status] ?? app.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
