import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { planReportApi } from '@/services/plan-report.service'
import type { PlanReport } from '@/types/plan-report'
import { TEMPLATE_TYPE_LABELS, EXTRA_FIELDS_CONFIG } from '@/types/plan-report'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중', REVIEWING: '검토중', APPROVED: '승인완료', REJECTED: '반려',
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  REVIEWING: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
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

  const reload = () => planReportApi.get(Number(id)).then(setPlan)

  useEffect(() => { reload() }, [id])

  if (!plan) return <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>

  const isHead = user?.id === plan.department.headId
  const isAdminLike = ['ADMIN', 'SUPER_ADMIN', 'GM'].includes(user?.role ?? '')
  const extraFields = EXTRA_FIELDS_CONFIG[plan.templateType]

  const handleApprove = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.approve(plan.id)); toast.success('승인되었습니다') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '오류가 발생했습니다') } finally { setLoading(false) }
  }

  const handleReject = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.reject(plan.id, rejectReason)); setShowRejectBox(false); toast.success('반려되었습니다') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '오류가 발생했습니다') } finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.submit(plan.id)); toast.success('결재 상신되었습니다') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '오류가 발생했습니다') } finally { setLoading(false) }
  }

  const handleResult = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.submitResult(plan.id, resultContent)); setShowResultBox(false); toast.success('결과보고 제출되었습니다') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '오류가 발생했습니다') } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{plan.title}</h1>
          <p className="text-sm text-muted-foreground">{plan.department.name} · {TEMPLATE_TYPE_LABELS[plan.templateType]}</p>
        </div>
        <span className={`inline-flex items-center rounded border px-2 py-1 text-sm font-medium ${STATUS_COLORS[plan.status]}`}>
          {STATUS_LABELS[plan.status]}
        </span>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 space-y-6 max-w-2xl">
        {plan.rejectionReason && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            반려 사유: {plan.rejectionReason}
          </div>
        )}

        {/* 기본 정보 */}
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-y-2">
            <span className="text-muted-foreground">추진 목적</span><span>{plan.purpose}</span>
            <span className="text-muted-foreground">추진 기간</span><span>{plan.startDate.slice(0, 10)} ~ {plan.endDate.slice(0, 10)}</span>
            <span className="text-muted-foreground">예산</span><span>{plan.budget.toLocaleString()}원</span>
            <span className="text-muted-foreground">기대효과</span><span>{plan.expectedEffect}</span>
            <span className="text-muted-foreground">주요 리스크</span><span>{plan.risks}</span>
            <span className="text-muted-foreground">결과보고 예정일</span><span>{plan.resultDueDate.slice(0, 10)}</span>
            {plan.requiredApproverLevel && <><span className="text-muted-foreground">요구 승인선</span><span>{plan.requiredApproverLevel}</span></>}
          </div>
        </div>

        {/* 업무별 추가 정보 */}
        {extraFields.length > 0 && plan.extraFields && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{TEMPLATE_TYPE_LABELS[plan.templateType]} 추가 정보</p>
            <div className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              {extraFields.map(f => (
                <>
                  <span key={`${f.key}-dt`} className="text-muted-foreground">{f.label}</span>
                  <span key={`${f.key}-dd`}>{String(plan.extraFields![f.key] ?? '-')}</span>
                </>
              ))}
            </div>
          </div>
        )}

        {/* 결재 조건 */}
        <div className="flex flex-wrap gap-1.5">
          {plan.hasNewStaff && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 border-amber-200">신규인력</span>}
          {plan.hasContract && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 border-amber-200">계약포함</span>}
          {plan.hasExternalLease && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 border-amber-200">외부임대</span>}
          {plan.hasPersonalInfo && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 border-amber-200">개인정보</span>}
          {plan.isNewBusiness && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-red-100 text-red-800 border-red-200">신규사업</span>}
        </div>

        {/* 협조 부서 */}
        {plan.reviews.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">협조 부서 검토 ({plan.reviews.filter(r => r.status === 'CONFIRMED').length}/{plan.reviews.length})</p>
            {plan.reviews.map(r => (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                <span>{r.reviewerDept.name}</span>
                <span className={r.status === 'CONFIRMED' ? 'text-green-600' : 'text-muted-foreground'}>
                  {r.status === 'CONFIRMED' ? `✓ ${r.confirmedBy?.username}` : '대기중'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 첨부자료 */}
        {plan.attachments.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">첨부자료</p>
            {plan.attachments.map((a, i) => (
              <a key={i} href={a} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline truncate">{a}</a>
            ))}
          </div>
        )}

        {/* 결과보고 */}
        {plan.status === 'APPROVED' && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">결과보고</p>
            {plan.resultContent ? (
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">제출일: {plan.resultSubmittedAt?.slice(0, 10)}</p>
                <p className="whitespace-pre-wrap">{plan.resultContent}</p>
              </div>
            ) : isHead ? (
              showResultBox ? (
                <div className="space-y-2">
                  <Textarea rows={4} placeholder="결과를 입력하세요" value={resultContent} onChange={e => setResultContent(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleResult} disabled={loading}>제출</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowResultBox(false)}>취소</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowResultBox(true)}>결과보고 작성</Button>
              )
            ) : (
              <p className="text-sm text-muted-foreground">미제출</p>
            )}
          </div>
        )}

        {/* vault 경로 */}
        {plan.vaultPath && <p className="text-xs text-muted-foreground">Vault: {plan.vaultPath}</p>}

        {/* 액션 버튼 */}
        <div className="flex gap-2 pt-2">
          {plan.status === 'DRAFT' && isHead && (
            <Button onClick={handleSubmit} disabled={loading}>결재 상신</Button>
          )}
          {plan.status === 'DRAFT' && (
            <Button variant="outline" onClick={() => navigate(`/finance/plan-reports/${plan.id}/edit`)}>수정</Button>
          )}
          {plan.status === 'REVIEWING' && isAdminLike && (
            <>
              <Button onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">승인</Button>
              <Button variant="outline" onClick={() => setShowRejectBox(!showRejectBox)} disabled={loading}>반려</Button>
            </>
          )}
        </div>

        {showRejectBox && (
          <div className="flex gap-2">
            <Input placeholder="반려 사유" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <Button variant="destructive" onClick={handleReject} disabled={loading}>확인</Button>
          </div>
        )}
      </div>
    </div>
  )
}
