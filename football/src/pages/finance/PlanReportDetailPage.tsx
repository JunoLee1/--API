import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { planReportApi } from '@/services/plan-report.service'
import type { PlanReport } from '@/types/plan-report'
import { TEMPLATE_TYPE_LABELS, EXTRA_FIELDS_CONFIG } from '@/types/plan-report'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  REVIEWING: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
}

export function PlanReportDetailPage() {
  const { t } = useTranslation('finance')
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
    try { setPlan(await planReportApi.approve(plan.id)); toast.success(t('planReport.actions.approved')) } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t('planReport.actions.error')) } finally { setLoading(false) }
  }

  const handleReject = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.reject(plan.id, rejectReason)); setShowRejectBox(false); toast.success(t('planReport.actions.rejected')) } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t('planReport.actions.error')) } finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.submit(plan.id)); toast.success(t('planReport.actions.submitted')) } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t('planReport.actions.error')) } finally { setLoading(false) }
  }

  const handleResult = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.submitResult(plan.id, resultContent)); setShowResultBox(false); toast.success(t('planReport.result.submitted')) } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t('planReport.actions.error')) } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{plan.title}</h1>
          <p className="text-sm text-muted-foreground">{plan.department.name} · {TEMPLATE_TYPE_LABELS[plan.templateType]}</p>
        </div>
        <span className={`inline-flex items-center rounded border px-2 py-1 text-sm font-medium ${STATUS_COLORS[plan.status]}`}>
          {t(`planReport.status.${plan.status}`)}
        </span>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 space-y-6 max-w-2xl">
        {plan.rejectionReason && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {t('planReport.fields.rejectionReason')}{plan.rejectionReason}
          </div>
        )}

        {/* 기본 정보 */}
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-y-2">
            <span className="text-muted-foreground">{t('planReport.fields.purposeLabel')}</span><span>{plan.purpose}</span>
            <span className="text-muted-foreground">{t('planReport.fields.periodLabel')}</span><span>{plan.startDate.slice(0, 10)} ~ {plan.endDate.slice(0, 10)}</span>
            <span className="text-muted-foreground">{t('planReport.fields.budgetLabel')}</span><span>{plan.budget.toLocaleString()}원</span>
            <span className="text-muted-foreground">{t('planReport.fields.expectedEffectLabel')}</span><span>{plan.expectedEffect}</span>
            <span className="text-muted-foreground">{t('planReport.fields.risksLabel')}</span><span>{plan.risks}</span>
            <span className="text-muted-foreground">{t('planReport.fields.resultDueDateLabel')}</span><span>{plan.resultDueDate.slice(0, 10)}</span>
            {plan.requiredApproverLevel && <><span className="text-muted-foreground">{t('planReport.fields.requiredApproverLevel')}</span><span>{plan.requiredApproverLevel}</span></>}
          </div>
        </div>

        {/* 업무별 추가 정보 */}
        {extraFields.length > 0 && plan.extraFields && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{TEMPLATE_TYPE_LABELS[plan.templateType]} {t('planReport.fields.extraInfo')}</p>
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
          {plan.hasNewStaff && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 border-amber-200">{t('planReport.badges.hasNewStaff')}</span>}
          {plan.hasContract && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 border-amber-200">{t('planReport.badges.hasContract')}</span>}
          {plan.hasExternalLease && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 border-amber-200">{t('planReport.badges.hasExternalLease')}</span>}
          {plan.hasPersonalInfo && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 border-amber-200">{t('planReport.badges.hasPersonalInfo')}</span>}
          {plan.isNewBusiness && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs bg-red-100 text-red-800 border-red-200">{t('planReport.badges.isNewBusiness')}</span>}
        </div>

        {/* 협조 부서 */}
        {plan.reviews.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('planReport.reviews.title')} ({plan.reviews.filter(r => r.status === 'CONFIRMED').length}/{plan.reviews.length})</p>
            {plan.reviews.map(r => (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                <span>{r.reviewerDept.name}</span>
                <span className={r.status === 'CONFIRMED' ? 'text-green-600' : 'text-muted-foreground'}>
                  {r.status === 'CONFIRMED' ? `✓ ${r.confirmedBy?.username}` : t('planReport.reviews.waiting')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 첨부자료 */}
        {plan.attachments.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('planReport.attachments.title')}</p>
            {plan.attachments.map((a, i) => (
              <a key={i} href={a} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline truncate">{a}</a>
            ))}
          </div>
        )}

        {/* 결과보고 */}
        {plan.status === 'APPROVED' && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('planReport.result.title')}</p>
            {plan.resultContent ? (
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">{t('planReport.result.submittedAt')}{plan.resultSubmittedAt?.slice(0, 10)}</p>
                <p className="whitespace-pre-wrap">{plan.resultContent}</p>
              </div>
            ) : isHead ? (
              showResultBox ? (
                <div className="space-y-2">
                  <Textarea rows={4} placeholder={t('planReport.result.placeholder')} value={resultContent} onChange={e => setResultContent(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleResult} disabled={loading}>{t('planReport.result.submit')}</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowResultBox(false)}>{t('planReport.actions.cancel')}</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowResultBox(true)}>{t('planReport.result.write')}</Button>
              )
            ) : (
              <p className="text-sm text-muted-foreground">{t('planReport.result.notSubmitted')}</p>
            )}
          </div>
        )}

        {/* vault 경로 */}
        {plan.vaultPath && <p className="text-xs text-muted-foreground">{t('planReport.vault')}{plan.vaultPath}</p>}

        {/* 액션 버튼 */}
        <div className="flex gap-2 pt-2">
          {plan.status === 'DRAFT' && isHead && (
            <Button onClick={handleSubmit} disabled={loading}>{t('planReport.actions.submit')}</Button>
          )}
          {plan.status === 'DRAFT' && (
            <Button variant="outline" onClick={() => navigate(`/finance/plan-reports/${plan.id}/edit`)}>{t('planReport.actions.edit')}</Button>
          )}
          {plan.status === 'REVIEWING' && isAdminLike && (
            <>
              <Button onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">{t('planReport.actions.approve')}</Button>
              <Button variant="outline" onClick={() => setShowRejectBox(!showRejectBox)} disabled={loading}>{t('planReport.actions.reject')}</Button>
            </>
          )}
        </div>

        {showRejectBox && (
          <div className="flex gap-2">
            <Input placeholder={t('planReport.rejectPlaceholder')} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <Button variant="destructive" onClick={handleReject} disabled={loading}>{t('planReport.actions.confirm')}</Button>
          </div>
        )}
      </div>
    </div>
  )
}
