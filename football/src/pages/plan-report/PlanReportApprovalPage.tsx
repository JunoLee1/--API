import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle } from 'lucide-react'
import { planReportApi } from '@/services/plan-report.service'
import { planReviewApi } from '@/services/plan-review.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { departmentApi } from '@/services/department.service'
import type { PlanReport, PlanReview } from '@/types/plan-report'
import type { Department } from '@/services/department.service'
import { TEMPLATE_TYPE_LABELS } from '@/types/plan-report'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function fmtWon(n: number) {
  return `${n.toLocaleString('ko-KR')}원`
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  REVIEWING: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  REVIEWING: '검토중',
  APPROVED: '승인',
  REJECTED: '반려',
}

interface PlanWithReviews {
  plan: PlanReport
  reviews: PlanReview[]
}

// Section 1: dept-review tab — plans where user's dept is a reviewer AND that review is PENDING
function DeptReviewSection({
  items,
  userDeptIds,
  onAction,
}: {
  items: PlanWithReviews[]
  userDeptIds: number[]
  onAction: () => Promise<void>
}) {
  const [rejectTarget, setRejectTarget] = useState<{ planId: number; reviewerDeptId: number } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState<number | null>(null)

  // Filter: plans where at least one of user's depts is a reviewer with PENDING status
  const pending = items.filter(({ reviews }) =>
    reviews.some(
      (r) => userDeptIds.includes(r.reviewerDeptId) && r.status === 'PENDING',
    ),
  )

  const handleConfirm = async (planId: number) => {
    setActing(planId)
    try {
      await planReviewApi.confirm(planId)
      toast.success('검토 확정되었습니다')
      await onAction()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '확정에 실패했습니다')
    } finally {
      setActing(null)
    }
  }

  const openReject = (planId: number, reviewerDeptId: number) => {
    setRejectTarget({ planId, reviewerDeptId })
    setRejectReason('')
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason) {
      toast.error('반려 사유를 입력해주세요')
      return
    }
    setActing(rejectTarget.planId)
    try {
      await planReviewApi.reject(rejectTarget.planId, rejectTarget.reviewerDeptId, reason)
      toast.success('반려되었습니다')
      setRejectTarget(null)
      setRejectReason('')
      await onAction()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '반려에 실패했습니다')
    } finally {
      setActing(null)
    }
  }

  if (pending.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        검토 대기 중인 계획서가 없습니다.
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>제출일</TableHead>
            <TableHead>제목</TableHead>
            <TableHead>부서</TableHead>
            <TableHead>유형</TableHead>
            <TableHead className="text-right">예산</TableHead>
            <TableHead>검토 부서</TableHead>
            <TableHead className="w-40 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map(({ plan, reviews }) => {
            const myReviews = reviews.filter(
              (r) => userDeptIds.includes(r.reviewerDeptId) && r.status === 'PENDING',
            )
            return myReviews.map((review) => (
              <TableRow key={`${plan.id}-${review.reviewerDeptId}`}>
                <TableCell className="tabular-nums text-sm">
                  {plan.submittedAt
                    ? new Date(plan.submittedAt).toLocaleDateString('ko-KR')
                    : new Date(plan.createdAt).toLocaleDateString('ko-KR')}
                </TableCell>
                <TableCell className="text-sm font-medium max-w-xs truncate">{plan.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{plan.department.name}</TableCell>
                <TableCell className="text-sm">{TEMPLATE_TYPE_LABELS[plan.templateType]}</TableCell>
                <TableCell className="tabular-nums text-sm text-right">{fmtWon(plan.budget)}</TableCell>
                <TableCell className="text-sm">{review.reviewerDept.name}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      disabled={acting === plan.id}
                      onClick={() => void handleConfirm(plan.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />확정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-700 hover:bg-red-50 hover:text-red-800"
                      disabled={acting === plan.id}
                      onClick={() => openReject(plan.id, review.reviewerDeptId)}
                    >
                      <XCircle className="h-3 w-3 mr-1" />반려
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          })}
        </TableBody>
      </Table>

      {/* Reject dialog */}
      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>계획서 검토 반려</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              반려 사유를 입력해주세요. 제출자에게 전달됩니다.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="예: 예산 근거가 부족합니다. 상세 항목을 추가해 주세요."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null)
                setRejectReason('')
              }}
              disabled={acting !== null}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submitReject()}
              disabled={acting !== null}
            >
              반려
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Section 2: final-approval tab — REVIEWING plans with all reviews CONFIRMED, user can approve
function FinalApprovalSection({
  items,
  canFinalApprove,
  onAction,
}: {
  items: PlanWithReviews[]
  canFinalApprove: boolean
  onAction: () => Promise<void>
}) {
  const [rejectTarget, setRejectTarget] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState<number | null>(null)

  // Plans in REVIEWING status where all reviews are CONFIRMED
  const ready = items.filter(
    ({ plan, reviews }) =>
      plan.status === 'REVIEWING' &&
      reviews.length > 0 &&
      reviews.every((r) => r.status === 'CONFIRMED'),
  )

  const handleApprove = async (planId: number) => {
    setActing(planId)
    try {
      await planReportApi.approve(planId)
      toast.success('최종 승인되었습니다')
      await onAction()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '승인에 실패했습니다')
    } finally {
      setActing(null)
    }
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason) {
      toast.error('반려 사유를 입력해주세요')
      return
    }
    setActing(rejectTarget)
    try {
      await planReportApi.reject(rejectTarget, reason)
      toast.success('반려되었습니다')
      setRejectTarget(null)
      setRejectReason('')
      await onAction()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '반려에 실패했습니다')
    } finally {
      setActing(null)
    }
  }

  if (ready.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        최종 승인 대기 중인 계획서가 없습니다.
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>제출일</TableHead>
            <TableHead>제목</TableHead>
            <TableHead>부서</TableHead>
            <TableHead>유형</TableHead>
            <TableHead className="text-right">예산</TableHead>
            <TableHead>승인 레벨</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="w-44 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ready.map(({ plan }) => (
            <TableRow key={plan.id}>
              <TableCell className="tabular-nums text-sm">
                {plan.submittedAt
                  ? new Date(plan.submittedAt).toLocaleDateString('ko-KR')
                  : new Date(plan.createdAt).toLocaleDateString('ko-KR')}
              </TableCell>
              <TableCell className="text-sm font-medium max-w-xs truncate">{plan.title}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{plan.department.name}</TableCell>
              <TableCell className="text-sm">{TEMPLATE_TYPE_LABELS[plan.templateType]}</TableCell>
              <TableCell className="tabular-nums text-sm text-right">{fmtWon(plan.budget)}</TableCell>
              <TableCell className="text-sm">{plan.requiredApproverLevel ?? '—'}</TableCell>
              <TableCell>
                <Badge className={STATUS_STYLE[plan.status]}>{STATUS_LABEL[plan.status]}</Badge>
              </TableCell>
              <TableCell className="text-right">
                {canFinalApprove ? (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      disabled={acting === plan.id}
                      onClick={() => void handleApprove(plan.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />승인
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-700 hover:bg-red-50 hover:text-red-800"
                      disabled={acting === plan.id}
                      onClick={() => {
                        setRejectTarget(plan.id)
                        setRejectReason('')
                      }}
                    >
                      <XCircle className="h-3 w-3 mr-1" />반려
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">승인 권한 없음</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Reject dialog */}
      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>계획서 최종 반려</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">반려 사유를 입력해주세요.</p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="반려 사유"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null)
                setRejectReason('')
              }}
              disabled={acting !== null}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submitReject()}
              disabled={acting !== null}
            >
              반려
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PlanReportApprovalPage() {
  const { user } = useCurrentUser()
  const [items, setItems] = useState<PlanWithReviews[]>([])
  const [loading, setLoading] = useState(true)
  // Departments led by or containing the current user as head (for review gating)
  const [userDepts, setUserDepts] = useState<Department[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const plans = await planReportApi.list({ status: 'REVIEWING' })
      const withReviews = await Promise.all(
        plans.map(async (plan) => {
          try {
            const reviews = await planReviewApi.list(plan.id)
            return { plan, reviews }
          } catch {
            return { plan, reviews: [] }
          }
        }),
      )
      setItems(withReviews)
    } catch {
      toast.error('계획서 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!user) return
    departmentApi
      .list()
      .then((depts) => {
        // User's dept: departments where they are listed as head
        // TODO: extend if backend exposes user.departmentId directly
        setUserDepts(depts.filter((d) => d.headId === user.id))
      })
      .catch(() => null)
  }, [user])

  // Final approval: ADMIN/SUPER_ADMIN/GM can always approve.
  // HEAD/GM levels: the department head (headId) can approve HEAD-level plans.
  const canFinalApprove =
    user !== null &&
    ['ADMIN', 'SUPER_ADMIN', 'GM'].includes(user.role)

  const userDeptIds = userDepts.map((d) => d.id)

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-6 py-4 shrink-0">
          <h1 className="text-lg font-semibold tracking-tight">기획보고서 결재함</h1>
        </div>
        <div className="p-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">기획보고서 결재함</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          부서 검토 확정 및 최종 승인을 처리할 계획서 목록입니다.
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="dept-review">
          <TabsList className="mb-4">
            <TabsTrigger value="dept-review">부서 리뷰 대기</TabsTrigger>
            <TabsTrigger value="final-approval">최종 승인 대기</TabsTrigger>
          </TabsList>

          <TabsContent value="dept-review">
            <DeptReviewSection
              items={items}
              userDeptIds={userDeptIds}
              onAction={loadData}
            />
          </TabsContent>

          <TabsContent value="final-approval">
            <FinalApprovalSection
              items={items}
              canFinalApprove={canFinalApprove}
              onAction={loadData}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
