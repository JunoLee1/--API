import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { departmentPlanApi } from '@/services/department-plan.service'
import { planReviewApi } from '@/services/plan-review.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { DepartmentAnnualPlan } from '@/types/department-plan'
import {
  PLAN_STATUS_LABEL,
  PLAN_STATUS_CLASS,
  OPERATING_CATEGORY_LABEL,
  type OperatingCategory,
} from '@/types/department-plan'
import { isAdminLike } from '@/lib/permissions'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

export function DepartmentPlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()

  const [plan, setPlan] = useState<DepartmentAnnualPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)

  // 교차 검토 confirm 다이얼로그
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmComment, setConfirmComment] = useState('')
  const [confirming, setConfirming] = useState(false)

  const load = () => {
    setLoading(true)
    departmentPlanApi.get(Number(id))
      .then(setPlan)
      .catch(() => toast.error('계획서를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const canApproveReject = !!user && isAdminLike(user.role) && plan?.status === 'REVIEWING'
  const isDepartmentHead = !!user && !!plan && plan.department.headId === user.id
  const canSubmit = isDepartmentHead && plan?.status === 'DRAFT'
  const canEdit = !!plan && plan.status === 'DRAFT'

  // 교차 검토: 현재 유저가 검토자 부서 소속이고 PENDING인 리뷰가 있는지
  // (reviews 배열에서 userId로 직접 판단 불가 — 검토 부서 멤버십은 서버에서 검증)
  // FE에서는 "내 부서의 리뷰가 PENDING이면 버튼 표시"를 위해 후처리
  const myPendingReview = plan?.reviews?.find(
    (r) => r.status === 'PENDING'
    // 유저가 어떤 부서에 속하는지 FE에서 특정하기 어려우므로 PENDING인 리뷰가 있으면 시도 가능
    // 서버에서 NOT_A_REVIEWER 로 걸러짐
  ) ?? null
  const canConfirmReview = !!plan && plan.status === 'REVIEWING' && !!myPendingReview && !isAdminLike(user?.role ?? '')

  const handleSubmit = async () => {
    if (!plan) return
    setActing(true)
    try {
      await departmentPlanApi.submit(plan.id)
      toast.success('검토 요청이 제출됐습니다.')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '제출 실패')
    } finally {
      setActing(false)
    }
  }

  const handleApprove = async () => {
    if (!plan) return
    setActing(true)
    try {
      await departmentPlanApi.approve(plan.id)
      toast.success('계획서가 승인됐습니다.')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '승인 실패')
    } finally {
      setActing(false)
    }
  }

  const handleReject = async () => {
    if (!plan || !rejectReason.trim()) {
      toast.error('반려 사유를 입력해주세요.')
      return
    }
    setActing(true)
    try {
      await departmentPlanApi.reject(plan.id, rejectReason)
      toast.success('계획서가 반려됐습니다.')
      setRejectOpen(false)
      setRejectReason('')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '반려 실패')
    } finally {
      setActing(false)
    }
  }

  const handleConfirmReview = async () => {
    if (!plan) return
    setConfirming(true)
    try {
      await planReviewApi.confirm(plan.id, confirmComment.trim() || undefined)
      toast.success('검토가 확인됐습니다.')
      setConfirmOpen(false)
      setConfirmComment('')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '확인 실패')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="p-6 text-center text-muted-foreground">계획서를 찾을 수 없습니다.</div>
    )
  }

  const totalBudget = plan.budgetItems.reduce((s, b) => s + b.amount, 0)

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{plan.department.name} 연간 계획서</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PLAN_STATUS_CLASS[plan.status]}`}>
              {PLAN_STATUS_LABEL[plan.status]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">작성자: {plan.createdBy.username}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {canEdit && (
            <Button variant="outline" onClick={() => navigate(`/finance/department-plans/${plan.id}/edit`)}>
              수정
            </Button>
          )}
          {canSubmit && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => void handleSubmit()}
              disabled={acting}
            >
              검토 요청 제출
            </Button>
          )}
          {canConfirmReview && (
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => setConfirmOpen(true)}
            >
              검토 확인
            </Button>
          )}
          {canApproveReject && (
            <>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => void handleApprove()}
                disabled={acting || plan?.allReviewsComplete === false}
                title={plan?.allReviewsComplete === false ? '모든 부서 검토 완료 후 승인 가능' : undefined}
              >
                승인
              </Button>
              <Button
                variant="destructive"
                onClick={() => setRejectOpen(true)}
                disabled={acting}
              >
                반려
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 반려 사유 */}
      {plan.rejectionReason && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">반려 사유</p>
          <p>{plan.rejectionReason}</p>
        </div>
      )}

      {/* 교차 검토 미완료 경고 (GM/ADMIN에게만) */}
      {canApproveReject && plan.allReviewsComplete === false && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 text-sm text-yellow-800">
          <p className="font-semibold mb-1">승인 불가</p>
          <p>모든 부서 검토 완료 후 승인 가능합니다. ({plan.reviewProgress.confirmed}/{plan.reviewProgress.total} 완료)</p>
        </div>
      )}

      {/* 교차 검토 현황 */}
      {plan.status === 'REVIEWING' && plan.reviews && plan.reviews.length > 0 && (
        <section className="border rounded-lg overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-base">교차 검토 현황</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {plan.reviewProgress.confirmed} / {plan.reviewProgress.total} 완료
              </span>
              {plan.allReviewsComplete ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                  검토 완료
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                  검토 중
                </span>
              )}
            </div>
          </div>
          {/* 진행률 바 */}
          <div className="px-4 pt-3">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{
                  width: plan.reviewProgress.total > 0
                    ? `${(plan.reviewProgress.confirmed / plan.reviewProgress.total) * 100}%`
                    : '0%',
                }}
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>검토 부서</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>확인자</TableHead>
                <TableHead>확인일</TableHead>
                <TableHead>코멘트</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.reviews.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.reviewerDept.name}</TableCell>
                  <TableCell>
                    {r.status === 'CONFIRMED' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        확인됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                        대기 중
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.confirmedBy?.username ?? '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.confirmedAt ? new Date(r.confirmedAt).toLocaleString('ko-KR') : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.comment ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* 워크플로우 타임라인 */}
      <div className="border rounded-lg p-4 space-y-2 text-sm">
        <h2 className="font-semibold text-base mb-2">워크플로우</h2>
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          <span>생성일</span>
          <span>{new Date(plan.createdAt).toLocaleString('ko-KR')}</span>
          {plan.submittedAt && (
            <>
              <span>제출일</span>
              <span>{new Date(plan.submittedAt).toLocaleString('ko-KR')}</span>
            </>
          )}
          {plan.reviewedAt && (
            <>
              <span>검토일</span>
              <span>
                {new Date(plan.reviewedAt).toLocaleString('ko-KR')}
                {plan.reviewedBy && ` (${plan.reviewedBy.username})`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 목표 */}
      {plan.objectives.length > 0 && (
        <section className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-base">목표 (Objectives)</h2>
          <ul className="space-y-1">
            {plan.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 분기별 마일스톤 */}
      {plan.milestones.length > 0 && (
        <section className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold text-base">분기별 마일스톤</h2>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((q) => {
              const ms = plan.milestones.find((m) => m.quarter === q)
              return (
                <div key={q} className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground">Q{q}</p>
                  <p className="text-sm">{ms?.text ?? <span className="text-muted-foreground">-</span>}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* KPI */}
      {plan.kpiItems.length > 0 && (
        <section className="border rounded-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-base">KPI 항목</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>지표명</TableHead>
                <TableHead>목표값</TableHead>
                <TableHead>분기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.kpiItems.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.title}</TableCell>
                  <TableCell>{k.targetValue}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {k.quarter !== null ? `Q${k.quarter}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* 예산 */}
      {plan.budgetItems.length > 0 && (
        <section className="border rounded-lg overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-base">카테고리별 예산</h2>
            <span className="text-sm font-semibold">합계: ₩{totalBudget.toLocaleString()}</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>카테고리</TableHead>
                <TableHead className="text-right">금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.budgetItems.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{OPERATING_CATEGORY_LABEL[b.category as OperatingCategory]}</TableCell>
                  <TableCell className="text-right font-medium">₩{b.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* 검토 확인 다이얼로그 */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o) { setConfirmOpen(false); setConfirmComment('') } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>검토 확인</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              계획서를 검토했음을 확인합니다. 코멘트는 선택 사항입니다.
            </p>
            <div className="space-y-1">
              <Label>코멘트 (선택)</Label>
              <Textarea
                value={confirmComment}
                onChange={(e) => setConfirmComment(e.target.value)}
                placeholder="검토 의견을 입력하세요 (선택)"
                rows={3}
              />
            </div>
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={confirming}
              onClick={() => void handleConfirmReview()}
            >
              {confirming ? '처리 중...' : '확인'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 반려 다이얼로그 */}
      <Dialog open={rejectOpen} onOpenChange={(o) => { if (!o) setRejectOpen(false) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>계획서 반려</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              반려 후 계획서는 작성 중(DRAFT) 상태로 돌아가며, 부서가 반려 사유를 확인 후 수정할 수 있습니다.
            </p>
            <div className="space-y-1">
              <Label>반려 사유 <span className="text-red-500">*</span></Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력하세요"
              />
            </div>
            <Button
              className="w-full"
              variant="destructive"
              disabled={acting || !rejectReason.trim()}
              onClick={() => void handleReject()}
            >
              {acting ? '처리 중...' : '반려 처리'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
