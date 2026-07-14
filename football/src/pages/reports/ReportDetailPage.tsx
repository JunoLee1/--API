import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { reportApi } from '@/services/report.service'
import type { Report } from '@/types/report'
import {
  REPORT_TYPE_LABEL,
  REPORT_TYPE_STYLE,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_STYLE,
} from '@/types/report'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ArrowLeft, Download, Check, X } from 'lucide-react'

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function RejectDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!reason.trim()) { toast.error('반려 사유를 입력해주세요.'); return }
    setLoading(true)
    try { await onConfirm(reason.trim()) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>보고서 반려</DialogTitle></DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label>반려 사유 *</Label>
          <Textarea
            placeholder="반려 사유를 입력해주세요."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>취소</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? '처리 중...' : '반려'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [acting, setActing] = useState(false)

  const isGM = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'GM'
  const isAuthor = report?.authorId === user?.id

  useEffect(() => {
    if (!id) return
    reportApi
      .get(Number(id))
      .then(setReport)
      .catch(() => { toast.error('보고서를 불러오지 못했습니다.'); navigate('/reports') })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleSubmit = async () => {
    if (!report) return
    setActing(true)
    try {
      const updated = await reportApi.submit(report.id)
      setReport(updated)
      toast.success('보고서가 제출됐습니다.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '제출에 실패했습니다.')
    } finally {
      setActing(false)
    }
  }

  const handleApprove = async () => {
    if (!report) return
    setActing(true)
    try {
      const updated = await reportApi.approve(report.id)
      setReport(updated)
      toast.success('보고서가 승인됐습니다.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '승인에 실패했습니다.')
    } finally {
      setActing(false)
    }
  }

  const handleReject = async (reason: string) => {
    if (!report) return
    const updated = await reportApi.reject(report.id, reason)
    setReport(updated)
    setRejectOpen(false)
    toast.success('보고서가 반려됐습니다.')
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
              {REPORT_TYPE_LABEL[report.type]}
            </span>
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${REPORT_STATUS_STYLE[report.status]}`}>
              {REPORT_STATUS_LABEL[report.status]}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {isAuthor && report.status === 'DRAFT' && (
            <Button size="sm" onClick={handleSubmit} disabled={acting}>제출</Button>
          )}
          {isGM && report.status === 'SUBMITTED' && (
            <>
              <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => setRejectOpen(true)} disabled={acting}>
                <X className="h-3.5 w-3.5 mr-1" />반려
              </Button>
              <Button size="sm" onClick={handleApprove} disabled={acting}>
                <Check className="h-3.5 w-3.5 mr-1" />승인
              </Button>
            </>
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
            {report.reviewedAt && report.reviewer && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">결재일</p>
                <p>{formatDateTime(report.reviewedAt)} ({report.reviewer.nickname})</p>
              </div>
            )}
          </div>

          {report.rejectionReason && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium mb-0.5">반려 사유</p>
              <p className="whitespace-pre-wrap">{report.rejectionReason}</p>
            </div>
          )}

          <div>
            <p className="text-muted-foreground text-xs mb-1.5">내용</p>
            <div className="rounded border p-4 text-sm whitespace-pre-wrap leading-relaxed min-h-32">
              {report.content}
            </div>
          </div>

          {report.fileUrl && (
            <div>
              <p className="text-muted-foreground text-xs mb-1.5">첨부 파일</p>
              <a
                href={report.fileUrl}
                download={report.fileName ?? true}
                className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                {report.fileName ?? '첨부 파일'}
              </a>
            </div>
          )}
        </div>
      </div>

      <RejectDialog open={rejectOpen} onOpenChange={setRejectOpen} onConfirm={handleReject} />
    </div>
  )
}
