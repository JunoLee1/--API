import { useEffect, useState, Fragment } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { planReportApi } from '@/services/plan-report.service'
import type { PlanReport } from '@/types/plan-report'
import { TEMPLATE_TYPE_LABELS, EXTRA_FIELDS_CONFIG } from '@/types/plan-report'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Skeleton } from '@/components/ui/skeleton'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중', REVIEWING: '검토중', APPROVED: '승인완료', REJECTED: '반려',
}

export function PlanReportDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [plan, setPlan] = useState<PlanReport | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [resultContent, setResultContent] = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [showResultBox, setShowResultBox] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    planReportApi.get(Number(id))
      .then(setPlan)
      .catch(() => setError('보고서를 불러오지 못했습니다'))
  }, [id])

  if (error) return <div className="p-6 text-red-500">{error}</div>
  if (!plan) return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )

  const isHead = plan.department.headId !== null && user?.id === plan.department.headId
  const isAdminLike = ['ADMIN', 'SUPER_ADMIN', 'GM'].includes(user?.role ?? '')
  const extraFields = EXTRA_FIELDS_CONFIG[plan.templateType]

  const handleApprove = async () => {
    setLoading(true)
    try {
      setPlan(await planReportApi.approve(plan.id))
    } catch {
      toast.error('승인에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setLoading(true)
    try {
      setPlan(await planReportApi.reject(plan.id, rejectReason))
      setShowRejectBox(false)
    } catch {
      toast.error('반려에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      setPlan(await planReportApi.submit(plan.id))
    } catch {
      toast.error('결재 상신에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleResult = async () => {
    if (!resultContent.trim()) return
    setLoading(true)
    try {
      setPlan(await planReportApi.submitResult(plan.id, resultContent))
      setShowResultBox(false)
    } catch {
      toast.error('결과보고 제출에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{plan.title}</h1>
        <div className="flex gap-2 items-center">
          <span className="badge badge-lg">{STATUS_LABELS[plan.status]}</span>
          <span className="badge badge-outline">{TEMPLATE_TYPE_LABELS[plan.templateType]}</span>
        </div>
      </div>

      {plan.rejectionReason && (
        <div className="alert alert-warning">
          <span>반려 사유: {plan.rejectionReason}</span>
        </div>
      )}

      {/* 공통 정보 */}
      <section className="card bg-base-100 shadow p-6">
        <h2 className="text-lg font-semibold mb-4">기본 정보</h2>
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="font-medium text-gray-500">주관 부서</dt><dd>{plan.department.name}</dd>
          <dt className="font-medium text-gray-500">추진 목적</dt><dd>{plan.purpose}</dd>
          <dt className="font-medium text-gray-500">추진 기간</dt>
          <dd>{plan.startDate.slice(0, 10)} ~ {plan.endDate.slice(0, 10)}</dd>
          <dt className="font-medium text-gray-500">예산</dt><dd>{plan.budget.toLocaleString()}원</dd>
          <dt className="font-medium text-gray-500">기대효과</dt><dd>{plan.expectedEffect}</dd>
          <dt className="font-medium text-gray-500">주요 리스크</dt><dd>{plan.risks}</dd>
          <dt className="font-medium text-gray-500">결과보고 예정일</dt><dd>{plan.resultDueDate.slice(0, 10)}</dd>
          {plan.requiredApproverLevel && (
            <><dt className="font-medium text-gray-500">요구 승인선</dt><dd>{plan.requiredApproverLevel}</dd></>
          )}
        </dl>
        {plan.attachments.length > 0 && (
          <div className="mt-4">
            <p className="font-medium text-gray-500 text-sm mb-1">첨부자료</p>
            {plan.attachments.map((a, i) => (
              <a key={i} href={a} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline truncate">{a}</a>
            ))}
          </div>
        )}
      </section>

      {/* 업무별 추가 정보 */}
      {extraFields.length > 0 && plan.extraFields && (
        <section className="card bg-base-100 shadow p-6">
          <h2 className="text-lg font-semibold mb-4">{TEMPLATE_TYPE_LABELS[plan.templateType]} 추가 정보</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            {extraFields.map(f => (
              <Fragment key={f.key}>
                <dt className="font-medium text-gray-500">{f.label}</dt>
                <dd>{String(plan.extraFields![f.key] ?? '-')}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      )}

      {/* 결재 조건 플래그 */}
      <section className="card bg-base-100 shadow p-6">
        <h2 className="text-lg font-semibold mb-3">결재 조건</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {plan.hasNewStaff && <span className="badge badge-warning">신규인력</span>}
          {plan.hasContract && <span className="badge badge-warning">계약포함</span>}
          {plan.hasExternalLease && <span className="badge badge-warning">외부임대</span>}
          {plan.hasPersonalInfo && <span className="badge badge-warning">개인정보</span>}
          {plan.isNewBusiness && <span className="badge badge-error">신규사업</span>}
          {!plan.hasNewStaff && !plan.hasContract && !plan.hasExternalLease && !plan.hasPersonalInfo && !plan.isNewBusiness && (
            <span className="text-gray-400">해당 없음</span>
          )}
        </div>
      </section>

      {/* 협조 부서 검토 현황 */}
      {plan.reviews.length > 0 && (
        <section className="card bg-base-100 shadow p-6">
          <h2 className="text-lg font-semibold mb-3">협조 부서 검토 ({plan.reviews.filter(r => r.status === 'CONFIRMED').length}/{plan.reviews.length})</h2>
          {plan.reviews.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm">{r.reviewerDept.name}</span>
              <span className={`badge ${r.status === 'CONFIRMED' ? 'badge-success' : 'badge-ghost'}`}>
                {r.status === 'CONFIRMED' ? `확인: ${r.confirmedBy?.username}` : '대기중'}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* 결과보고 */}
      {plan.status === 'APPROVED' && (
        <section className="card bg-base-100 shadow p-6">
          <h2 className="text-lg font-semibold mb-3">결과보고</h2>
          {plan.resultContent ? (
            <div>
              <p className="text-sm text-gray-500 mb-1">제출일: {plan.resultSubmittedAt?.slice(0, 10)}</p>
              <p className="whitespace-pre-wrap text-sm">{plan.resultContent}</p>
            </div>
          ) : isHead ? (
            showResultBox ? (
              <div className="space-y-2">
                <textarea className="textarea textarea-bordered w-full" rows={4} placeholder="결과를 입력하세요"
                  value={resultContent} onChange={e => setResultContent(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={handleResult} disabled={loading}>제출</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowResultBox(false)}>취소</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={() => setShowResultBox(true)}>결과보고 작성</button>
            )
          ) : (
            <p className="text-sm text-gray-400">결과보고 미제출</p>
          )}
        </section>
      )}

      {plan.vaultPath && (
        <div className="text-xs text-gray-400">Vault: {plan.vaultPath}</div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-3 justify-end">
        {plan.status === 'DRAFT' && (
          <>
            <Link to={`/finance/plan-reports/${plan.id}/edit`} className="btn btn-outline">수정</Link>
            {isHead && (
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>결재 상신</button>
            )}
          </>
        )}
        {plan.status === 'REVIEWING' && isAdminLike && (
          <>
            <button className="btn btn-success" onClick={handleApprove} disabled={loading}>승인</button>
            <button className="btn btn-error btn-outline" onClick={() => setShowRejectBox(!showRejectBox)}>반려</button>
          </>
        )}
      </div>

      {showRejectBox && (
        <div className="flex gap-2">
          <input className="input input-bordered flex-1" placeholder="반려 사유" value={rejectReason}
            onChange={e => setRejectReason(e.target.value)} />
          <button className="btn btn-error" onClick={handleReject} disabled={loading}>확인</button>
        </div>
      )}
    </div>
  )
}
