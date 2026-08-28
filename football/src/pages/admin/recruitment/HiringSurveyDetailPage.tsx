import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { hiringSurveyApi } from '@/services/hiring-survey.service'
import type { HiringNeedsSurvey, SurveyCloseBlockingDetail } from '@/types/hiring-survey'
import { PRIORITY_LABELS, RESPONSE_STATUS_LABELS } from '@/types/hiring-survey'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SurveyResponseStatusBadge } from '@/components/hiring-survey/SurveyResponseStatusBadge'

export function HiringSurveyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [survey, setSurvey] = useState<HiringNeedsSurvey | null>(null)
  const [closing, setClosing] = useState(false)
  const [closeBlockers, setCloseBlockers] = useState<SurveyCloseBlockingDetail[] | null>(null)

  useEffect(() => {
    void hiringSurveyApi.get(Number(id)).then(setSurvey)
  }, [id])

  if (!survey) return <div className="p-6">로딩 중...</div>

  const respondedDeptIds = new Set(survey.responses.map((r) => r.departmentId))
  const deadlineDays = Math.ceil((new Date(survey.deadlineAt).getTime() - Date.now()) / 86400000)

  // For 팀장 CTA — server enforces LEADER role, this button just navigates.
  // For 부서장 CTA — direct comparison since headId is exposed in the payload.
  const targetDeptsForUser = user?.id
    ? survey.targetDepartments.filter((t) => t.department.headId === user.id)
    : []

  const handleClose = async () => {
    if (!confirm('조사를 마감하면 계획 항목이 자동 생성됩니다. 계속하시겠습니까?')) return
    setClosing(true)
    setCloseBlockers(null)
    try {
      const planReport = await hiringSurveyApi.close(Number(id))
      toast.success('조사가 마감됐습니다. 채용 계획서로 이동합니다.')
      navigate(`/finance/plan-reports/${planReport.id}/hiring-items`)
    } catch (err: any) {
      const code = err?.response?.data?.code || err?.response?.data?.error
      const detail = err?.response?.data?.detail?.blocking as SurveyCloseBlockingDetail[] | undefined
      if (code === 'RESPONSES_NOT_APPROVED' && detail?.length) {
        setCloseBlockers(detail)
        toast.error('모든 부서 응답이 승인되지 않아 마감할 수 없습니다.')
      } else {
        toast.error('마감에 실패했습니다.')
      }
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{survey.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            마감일: {new Date(survey.deadlineAt).toLocaleDateString('ko-KR')}
            {survey.status === 'OPEN' && deadlineDays >= 0 && (
              <span className={`ml-2 font-medium ${deadlineDays <= 3 ? 'text-red-500' : 'text-gray-600'}`}>
                (D-{deadlineDays})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {survey.status === 'OPEN' && (
            <Button onClick={() => navigate(`/admin/recruitment/surveys/${survey.id}/respond`)}>
              팀장 응답 작성
            </Button>
          )}
          {survey.status === 'OPEN' && targetDeptsForUser.length > 0 && (
            <Button variant="outline" onClick={() => navigate(`/admin/recruitment/surveys/${survey.id}/approve`)}>
              부서장 결재함
            </Button>
          )}
          {survey.status === 'OPEN' && (
            <Button variant="destructive" onClick={() => void handleClose()} disabled={closing}>
              지금 마감
            </Button>
          )}
        </div>
      </div>

      {closeBlockers && closeBlockers.length > 0 && (
        <div className="border border-red-300 bg-red-50 rounded-lg p-3 space-y-1">
          <p className="font-medium text-red-800">마감 불가 — 아래 부서 응답 결재가 필요합니다.</p>
          <ul className="text-sm text-red-700 list-disc pl-5">
            {closeBlockers.map((b) => (
              <li key={b.departmentId}>
                {b.departmentName} — {b.status === 'MISSING' ? '미응답' : RESPONSE_STATUS_LABELS[b.status as keyof typeof RESPONSE_STATUS_LABELS] ?? b.status}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-semibold">부서별 응답 현황</h2>
        {survey.targetDepartments.map((t) => {
          const response = survey.responses.find((r) => r.departmentId === t.departmentId)
          const responded = respondedDeptIds.has(t.departmentId)
          return (
            <div key={t.departmentId} className="border rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{t.department.name}</p>
                {response && (
                  <p className="text-sm text-gray-500">
                    {response.roleTitle} · {response.headcount}명 ·{' '}
                    {response.quarter ? `Q${response.quarter}` : '연간'} ·{' '}
                    우선순위: {PRIORITY_LABELS[response.priority]}
                  </p>
                )}
                {response?.status === 'REJECTED' && response.rejectionReason && (
                  <p className="text-sm text-red-600 mt-1">반려 사유: {response.rejectionReason}</p>
                )}
              </div>
              {response ? (
                <SurveyResponseStatusBadge status={response.status} />
              ) : (
                <Badge className={responded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                  미응답
                </Badge>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
