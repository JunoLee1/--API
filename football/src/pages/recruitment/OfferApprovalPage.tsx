import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { recruitmentApi } from '@/services/recruitment.service'
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_STYLE,
  OFFER_APPROVAL_STAGE_LABEL,
  type JobApplication,
  type OfferApprovalStage,
} from '@/types/recruitment'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CheckCircle2, XCircle } from 'lucide-react'

/**
 * Offer 3-stage approval page — one queue per stage (LEADER / DEPT_HEAD / HR).
 * The backend filters `/recruitment/applications/offer-approvals/:stage` to
 * rows the current user is authorised to act on, so the FE doesn't have to
 * repeat the LEADER/DEPT_HEAD/HR check.
 *
 * On approve/reject the backend advances the status; we reload the list so
 * the row disappears from the current queue. Approve/reject failures leave
 * the row in place and surface a toast — the user retries after refresh.
 */

/** Maps a backend AppError code to a user-facing Korean message. */
function messageForCode(code: string, fallback: string): string {
  switch (code) {
    case 'NOT_LEADER':
      return '팀장 결재 권한이 없습니다.'
    case 'NOT_DEPT_HEAD':
      return '부서장 결재 권한이 없습니다.'
    case 'FORBIDDEN':
      return 'HR 결재 권한이 없습니다.'
    case 'INVALID_STATUS':
      return '이미 다른 결재가 진행된 요청입니다. 새로고침 후 다시 시도해주세요.'
    case 'SELF_APPROVAL_FORBIDDEN':
      return '본인이 요청한 오퍼는 결재할 수 없습니다.'
    case 'REASON_REQUIRED':
      return '반려 사유를 입력해주세요.'
    case 'JOB_APPLICATION_NOT_FOUND':
      return '지원자를 찾을 수 없습니다.'
    default:
      return fallback
  }
}

const STAGE_META: Record<
  OfferApprovalStage,
  { title: string; tabLabel: string; description: string }
> = {
  LEADER: {
    title: '팀장 결재함',
    tabLabel: '팀장',
    description:
      '팀장으로 배정된 부서의 오퍼 대기 지원자입니다. 승인하면 부서장 결재로 넘어갑니다.',
  },
  DEPT_HEAD: {
    title: '부서장 결재함',
    tabLabel: '부서장',
    description:
      '부서장으로 배정된 부서의 오퍼 대기 지원자입니다. 승인하면 HR 결재로 넘어갑니다.',
  },
  HR: {
    title: 'HR 최종 결재함',
    tabLabel: 'HR',
    description:
      '팀장·부서장 결재를 거친 최종 오퍼 대기 목록입니다. HR 승인 시 지원자에게 오퍼가 발송됩니다.',
  },
}

function ApprovalList({ stage }: { stage: OfferApprovalStage }) {
  const [rows, setRows] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [rowActingId, setRowActingId] = useState<number | null>(null)

  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    return recruitmentApi
      .listOfferApprovals(stage)
      .then((data) => {
        setRows(data)
      })
      .catch((err) => {
        const code = err instanceof Error ? err.message : ''
        toast.error(messageForCode(code, code || '결재함 조회에 실패했습니다.'))
        setRows([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [stage])

  useEffect(() => {
    let cancelled = false
    recruitmentApi
      .listOfferApprovals(stage)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((err) => {
        if (!cancelled) {
          const code = err instanceof Error ? err.message : ''
          toast.error(messageForCode(code, code || '결재함 조회에 실패했습니다.'))
          setRows([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [stage])

  const approveOne = async (id: number) => {
    setRowActingId(id)
    try {
      if (stage === 'LEADER') await recruitmentApi.offerLeaderApprove(id)
      else if (stage === 'DEPT_HEAD') await recruitmentApi.offerDeptHeadApprove(id)
      else await recruitmentApi.offerHrApprove(id)
      toast.success(stage === 'HR' ? '오퍼가 발송되었습니다.' : '승인되었습니다.')
      await reload()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForCode(code, code || '승인에 실패했습니다.'))
    } finally {
      setRowActingId(null)
    }
  }

  const openReject = (id: number) => {
    setRejectingId(id)
    setRejectReason('')
  }

  const submitReject = async () => {
    if (!rejectingId) return
    const reason = rejectReason.trim()
    if (!reason) {
      toast.error('반려 사유를 입력해주세요.')
      return
    }
    setRowActingId(rejectingId)
    try {
      if (stage === 'LEADER') await recruitmentApi.offerLeaderReject(rejectingId, reason)
      else if (stage === 'DEPT_HEAD') await recruitmentApi.offerDeptHeadReject(rejectingId, reason)
      else await recruitmentApi.offerHrReject(rejectingId, reason)
      toast.success('반려되었습니다.')
      setRejectingId(null)
      setRejectReason('')
      await reload()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForCode(code, code || '반려에 실패했습니다.'))
    } finally {
      setRowActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        결재 대기 중인 지원자가 없습니다.
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>업데이트</TableHead>
            <TableHead>지원자</TableHead>
            <TableHead>공고</TableHead>
            <TableHead>부서</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="w-44 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((app) => {
            const acting = rowActingId === app.id
            const deptName = app.posting?.department?.name ?? '—'
            return (
              <TableRow key={app.id}>
                <TableCell className="tabular-nums text-sm">
                  {new Date(app.updatedAt).toLocaleDateString('ko-KR')}
                </TableCell>
                <TableCell className="text-sm">{app.applicantName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {app.posting?.title ?? `#${app.postingId}`}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{deptName}</TableCell>
                <TableCell>
                  <Badge className={APPLICATION_STATUS_STYLE[app.status]}>
                    {APPLICATION_STATUS_LABEL[app.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      disabled={acting}
                      onClick={() => void approveOne(app.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {stage === 'HR' ? '오퍼 발송' : '승인'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-700 hover:bg-red-50 hover:text-red-800"
                      disabled={acting}
                      onClick={() => openReject(app.id)}
                    >
                      <XCircle className="h-3 w-3 mr-1" />반려
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Dialog
        open={rejectingId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejectingId(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>오퍼 결재 반려</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              반려 사유를 입력해주세요. 반려는 되돌릴 수 없습니다.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="예: 예산 부족으로 이번 시즌 오퍼 보류 요청드립니다."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingId(null)
                setRejectReason('')
              }}
              disabled={rowActingId !== null}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submitReject()}
              disabled={rowActingId !== null}
            >
              반려
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function OfferApprovalPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">채용 오퍼 결재함</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          팀장 → 부서장 → HR 3단계 결재 대기 지원자를 관리합니다. 백엔드가 권한을 검증해 본인이
          담당하는 지원자만 노출됩니다.
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="LEADER">
          <TabsList className="mb-4">
            {(['LEADER', 'DEPT_HEAD', 'HR'] as const).map((stage) => (
              <TabsTrigger key={stage} value={stage}>
                {OFFER_APPROVAL_STAGE_LABEL[stage]}
              </TabsTrigger>
            ))}
          </TabsList>
          {(['LEADER', 'DEPT_HEAD', 'HR'] as const).map((stage) => (
            <TabsContent key={stage} value={stage}>
              <p className="text-xs text-muted-foreground mb-3">{STAGE_META[stage].description}</p>
              <ApprovalList stage={stage} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
