import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { hiringSurveyApi } from '@/services/hiring-survey.service'
import type { HiringNeedsSurvey } from '@/types/hiring-survey'
import { PRIORITY_LABELS } from '@/types/hiring-survey'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function HiringSurveyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<HiringNeedsSurvey | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    void hiringSurveyApi.get(Number(id)).then(setSurvey)
  }, [id])

  if (!survey) return <div className="p-6">로딩 중...</div>

  const respondedDeptIds = new Set(survey.responses.map((r) => r.departmentId))
  const deadlineDays = Math.ceil((new Date(survey.deadlineAt).getTime() - Date.now()) / 86400000)

  const handleClose = async () => {
    if (!confirm('조사를 마감하면 계획 항목이 자동 생성됩니다. 계속하시겠습니까?')) return
    setClosing(true)
    try {
      const planReport = await hiringSurveyApi.close(Number(id))
      toast.success('조사가 마감됐습니다. 채용 계획서로 이동합니다.')
      navigate(`/finance/plan-reports/${planReport.id}/hiring-items`)
    } catch {
      toast.error('마감에 실패했습니다.')
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
        {survey.status === 'OPEN' && (
          <Button variant="destructive" onClick={() => void handleClose()} disabled={closing}>
            지금 마감
          </Button>
        )}
      </div>

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
              </div>
              <Badge className={responded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                {responded ? '응답 완료' : '미응답'}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
