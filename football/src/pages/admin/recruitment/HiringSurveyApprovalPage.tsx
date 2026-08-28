import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { hiringSurveyApi } from '@/services/hiring-survey.service'
import type { HiringNeedsSurvey, SurveyResponse } from '@/types/hiring-survey'
import { PRIORITY_LABELS } from '@/types/hiring-survey'
import { SurveyResponseStatusBadge } from '@/components/hiring-survey/SurveyResponseStatusBadge'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

/**
 * 부서장 (Department.headId) approval queue for `SurveyResponse` records.
 * Shows every SUBMITTED response for departments this user heads, plus a
 * read-only view of any already-approved / rejected items for their departments
 * for reference. Reject dialog forces a `rejectionReason`.
 */
export function HiringSurveyApprovalPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [survey, setSurvey] = useState<HiringNeedsSurvey | null>(null)
  const [busy, setBusy] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<SurveyResponse | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const refetch = async () => {
    const fresh = await hiringSurveyApi.get(Number(id))
    setSurvey(fresh)
  }

  useEffect(() => {
    void refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Only depts the current user is head of.
  const myDeptIds = useMemo(() => {
    if (!user?.id || !survey) return new Set<number>()
    return new Set(
      survey.targetDepartments
        .filter((t) => t.department.headId === user.id)
        .map((t) => t.departmentId),
    )
  }, [user, survey])

  const responsesForMe = useMemo(() => {
    if (!survey) return [] as SurveyResponse[]
    return survey.responses.filter((r) => myDeptIds.has(r.departmentId))
  }, [survey, myDeptIds])

  if (!survey) return <div className="p-6">로딩 중...</div>

  if (myDeptIds.size === 0) {
    return (
      <div className="p-6 space-y-4 max-w-3xl">
        <h1 className="text-2xl font-bold">부서장 결재함</h1>
        <p className="text-sm text-red-500">
          이 조사에서 결재할 부서가 없습니다. (부서장 권한이 있는 부서만 표시됩니다.)
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>돌아가기</Button>
      </div>
    )
  }

  const handleApprove = async (r: SurveyResponse) => {
    setBusy(true)
    try {
      await hiringSurveyApi.approveResponse(survey.id, r.id)
      toast.success('승인 되었습니다.')
      await refetch()
    } catch {
      toast.error('승인에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const openReject = (r: SurveyResponse) => {
    setRejectTarget(r)
    setRejectionReason('')
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    if (!rejectionReason.trim()) { toast.error('반려 사유를 입력하세요.'); return }
    setBusy(true)
    try {
      await hiringSurveyApi.rejectResponse(survey.id, rejectTarget.id, rejectionReason.trim())
      toast.success('반려 되었습니다. 팀장에게 알림이 발송됐습니다.')
      setRejectTarget(null)
      await refetch()
    } catch {
      toast.error('반려에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">부서장 결재함</h1>
        <p className="text-sm text-gray-500 mt-1">{survey.title}</p>
      </div>

      <div className="space-y-3">
        {responsesForMe.length === 0 && (
          <p className="text-sm text-gray-500">결재 대기 중인 응답이 없습니다.</p>
        )}
        {responsesForMe.map((r) => {
          const dept = survey.targetDepartments.find((t) => t.departmentId === r.departmentId)?.department
          const isPending = r.status === 'SUBMITTED'
          return (
            <div key={r.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{dept?.name ?? `부서 #${r.departmentId}`}</span>
                    <SurveyResponseStatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {r.roleTitle} · {r.headcount}명 · {r.quarter ? `Q${r.quarter}` : '연간'} · 우선순위: {PRIORITY_LABELS[r.priority]}
                    {r.estimatedBudget != null && (
                      <> · 예산 ₩{r.estimatedBudget.toLocaleString()}</>
                    )}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">사유: {r.reason}</p>
                  {r.status === 'REJECTED' && r.rejectionReason && (
                    <p className="text-sm text-red-600 mt-1">반려 사유: {r.rejectionReason}</p>
                  )}
                  {r.status === 'APPROVED' && r.approvedBy && (
                    <p className="text-sm text-green-600 mt-1">
                      {r.approvedBy.username} 승인 · {r.approvedAt ? new Date(r.approvedAt).toLocaleString('ko-KR') : ''}
                    </p>
                  )}
                </div>
                {isPending && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => void handleApprove(r)} disabled={busy}>
                      승인
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openReject(r)} disabled={busy}>
                      반려
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>응답 반려</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>반려 사유 *</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="예산 재검토 필요, 우선순위 조정 필요 등"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={busy}>취소</Button>
            <Button variant="destructive" onClick={() => void submitReject()} disabled={busy}>반려</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
