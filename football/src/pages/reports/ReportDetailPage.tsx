import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { reportApi } from '@/services/report.service'
import type { Report, ReportReview } from '@/types/report'
import { REPORT_TYPE_STYLE, REPORT_STATUS_STYLE, REVIEW_STATUS_STYLE, REVIEW_STATUS_LABEL } from '@/types/report'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ArrowLeft, Download, Check, X, Clock } from 'lucide-react'

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  title = '반려 사유',
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (reason: string) => Promise<void>
  title?: string
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!reason.trim()) { toast.error('사유를 입력해주세요'); return }
    setLoading(true)
    try { await onConfirm(reason.trim()) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label>사유 *</Label>
          <Textarea
            placeholder="반려 사유를 입력하세요"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>취소</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? '처리 중...' : '반려 확정'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReviewStatusIcon({ status }: { status: ReportReview['status'] }) {
  if (status === 'CONFIRMED') return <Check className="h-3.5 w-3.5 text-green-600" />
  if (status === 'REJECTED') return <X className="h-3.5 w-3.5 text-red-600" />
  return <Clock className="h-3.5 w-3.5 text-yellow-600" />
}

function ReviewSection({
  reviews,
  myDeptIds,
  acting,
  onConfirm,
  onReject,
}: {
  reviews: ReportReview[]
  myDeptIds: number[]
  acting: boolean
  onConfirm: (deptId: number) => void
  onReject: (deptId: number) => void
}) {
  if (reviews.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">부서 검토 현황</p>
      <div className="rounded border divide-y">
        {reviews.map((review) => {
          const canAct = myDeptIds.includes(review.reviewerDeptId) && review.status === 'PENDING'
          return (
            <div key={review.id} className="flex items-center gap-3 px-3 py-2.5">
              <ReviewStatusIcon status={review.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{review.reviewerDept.name}</p>
                {review.comment && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{review.comment}</p>
                )}
                {review.confirmedBy && review.confirmedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {review.confirmedBy.nickname} · {formatDateTime(review.confirmedAt)}
                  </p>
                )}
              </div>
              <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${REVIEW_STATUS_STYLE[review.status]}`}>
                {REVIEW_STATUS_LABEL[review.status]}
              </span>
              {canAct && (
                <div className="flex gap-1.5 ml-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50" disabled={acting} onClick={() => onReject(review.reviewerDeptId)}>
                    <X className="h-3 w-3 mr-0.5" />반려
                  </Button>
                  <Button size="sm" className="h-7 text-xs" disabled={acting} onClick={() => onConfirm(review.reviewerDeptId)}>
                    <Check className="h-3 w-3 mr-0.5" />승인
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectingDeptId, setRejectingDeptId] = useState<number | null>(null)
  const [acting, setActing] = useState(false)

  const isAuthor = report?.authorId === user?.id
  const canSubmit = isAuthor && (report?.status === 'DRAFT' || report?.status === 'REJECTED')

  // Departments where this user is head (for review actions)
  const myDeptIds: number[] = []
  if (report?.reviews && user) {
    // Backend already guards this; we just show action buttons for depts whose headId === user.id
    // We derive this from departmentCategories in JWT — but for simplicity we let the backend guard
    // and show action buttons for all PENDING reviews if user has matching dept category
    const userCategories = user.departmentCategories ?? []
    for (const review of report.reviews) {
      if (review.status === 'PENDING' && userCategories.includes(review.reviewerDept.category ?? '')) {
        myDeptIds.push(review.reviewerDeptId)
      }
    }
  }

  useEffect(() => {
    if (!id) return
    reportApi
      .get(Number(id))
      .then(setReport)
      .catch(() => { toast.error('보고서를 불러오지 못했습니다'); navigate('/reports') })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleSubmit = async () => {
    if (!report) return
    setActing(true)
    try {
      setReport(await reportApi.submit(report.id))
      toast.success('보고서가 제출됐습니다')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '제출에 실패했습니다')
    } finally { setActing(false) }
  }

  const handleConfirmReview = async (deptId: number) => {
    if (!report) return
    setActing(true)
    try {
      setReport(await reportApi.confirmReview(report.id, deptId))
      toast.success('승인됐습니다')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '승인에 실패했습니다')
    } finally { setActing(false) }
  }

  const handleRejectReview = async (reason: string) => {
    if (!report || rejectingDeptId === null) return
    setReport(await reportApi.rejectReview(report.id, rejectingDeptId, reason))
    setRejectOpen(false)
    setRejectingDeptId(null)
    toast.success('반려됐습니다')
  }

  const openRejectDialog = (deptId: number) => {
    setRejectingDeptId(deptId)
    setRejectOpen(true)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">{report.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${REPORT_TYPE_STYLE[report.type]}`}>
              {report.type}
            </span>
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${REPORT_STATUS_STYLE[report.status]}`}>
              {report.status === 'REVIEWING'
                ? `검토 중 (${report.reviews.filter((r) => r.status === 'CONFIRMED').length}/${report.reviews.length})`
                : report.status}
            </span>
            {report.department && (
              <Badge variant="outline" className="text-xs">{report.department.name}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <Button size="sm" onClick={handleSubmit} disabled={acting}>제출</Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">작성자</p>
              <p className="font-medium">{report.author.nickname}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">작성일</p>
              <p>{formatDateTime(report.createdAt)}</p>
            </div>
            {report.submittedAt && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">제출일</p>
                <p>{formatDateTime(report.submittedAt)}</p>
              </div>
            )}
            {report.reviewedAt && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">최종 처리일</p>
                <p>{formatDateTime(report.reviewedAt)}</p>
              </div>
            )}
          </div>

          {report.rejectionReason && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium mb-0.5">반려 사유</p>
              <p className="whitespace-pre-wrap">{report.rejectionReason}</p>
            </div>
          )}

          {report.reviews.length > 0 && (
            <>
              <Separator />
              <ReviewSection
                reviews={report.reviews}
                myDeptIds={myDeptIds}
                acting={acting}
                onConfirm={handleConfirmReview}
                onReject={openRejectDialog}
              />
            </>
          )}

          <Separator />

          <div>
            <p className="text-muted-foreground text-xs mb-1.5">본문</p>
            <div className="rounded border p-4 text-sm whitespace-pre-wrap leading-relaxed min-h-32">
              {report.content}
            </div>
          </div>

          {report.fileUrl && (
            <div>
              <p className="text-muted-foreground text-xs mb-1.5">첨부파일</p>
              <a
                href={report.fileUrl}
                download={report.fileName ?? true}
                className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                {report.fileName ?? '파일 다운로드'}
              </a>
            </div>
          )}
        </div>
      </div>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={(v) => { setRejectOpen(v); if (!v) setRejectingDeptId(null) }}
        onConfirm={handleRejectReview}
      />
    </div>
  )
}
