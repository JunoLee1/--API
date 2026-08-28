import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { hiringSurveyApi } from '@/services/hiring-survey.service'
import type {
  HiringNeedsSurvey,
  SurveyPriority,
  SurveyResponse,
} from '@/types/hiring-survey'
import { PRIORITY_LABELS } from '@/types/hiring-survey'
import { SurveyResponseStatusBadge } from '@/components/hiring-survey/SurveyResponseStatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const EMPTY_FORM = {
  roleTitle: '',
  headcount: 1,
  quarter: '' as '' | '1' | '2' | '3' | '4',
  priority: 'MEDIUM' as SurveyPriority,
  estimatedBudget: '',
  reason: '',
}

/**
 * 팀장 (LEADER role) response entry page — creates/edits DRAFT and submits it
 * for 부서장 (Department.head) approval. The dept id can arrive via `?deptId`
 * query param; otherwise the leader picks from target departments.
 * REJECTED responses drop back here for edit + resubmit.
 */
export function HiringSurveyRespondPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<HiringNeedsSurvey | null>(null)
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(
    searchParams.get('deptId') ? Number(searchParams.get('deptId')) : null,
  )
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void hiringSurveyApi.get(Number(id)).then(setSurvey)
  }, [id])

  // Existing response for this dept (if any) — controls whether we're editing
  // an in-flight DRAFT/REJECTED vs creating a fresh one.
  const currentResponse: SurveyResponse | null = useMemo(() => {
    if (!survey || selectedDeptId == null) return null
    return survey.responses.find((r) => r.departmentId === selectedDeptId) ?? null
  }, [survey, selectedDeptId])

  // Prefill form when a dept is selected and has an existing response.
  useEffect(() => {
    if (currentResponse) {
      setForm({
        roleTitle: currentResponse.roleTitle,
        headcount: currentResponse.headcount,
        quarter: (currentResponse.quarter ? String(currentResponse.quarter) : '') as '' | '1' | '2' | '3' | '4',
        priority: currentResponse.priority,
        estimatedBudget: currentResponse.estimatedBudget != null ? String(currentResponse.estimatedBudget) : '',
        reason: currentResponse.reason,
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [currentResponse])

  if (!survey) return <div className="p-6">로딩 중...</div>
  if (survey.status !== 'OPEN') return <div className="p-6 text-red-500">이미 마감된 조사입니다.</div>

  const canEdit = !currentResponse || currentResponse.status === 'DRAFT' || currentResponse.status === 'REJECTED'
  const canSubmit = currentResponse && (currentResponse.status === 'DRAFT' || currentResponse.status === 'REJECTED')

  const validate = () => {
    if (selectedDeptId == null) { toast.error('부서를 선택하세요.'); return false }
    if (!form.roleTitle.trim()) { toast.error('직책명을 입력하세요.'); return false }
    if (form.headcount < 1) { toast.error('필요 인원은 1명 이상이어야 합니다.'); return false }
    if (!form.reason.trim()) { toast.error('사유를 입력하세요.'); return false }
    return true
  }

  const handleSaveDraft = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (currentResponse) {
        await hiringSurveyApi.updateResponse(Number(id), currentResponse.id, {
          roleTitle: form.roleTitle,
          headcount: form.headcount,
          quarter: form.quarter ? Number(form.quarter) : null,
          priority: form.priority,
          estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) : null,
          reason: form.reason,
        })
      } else {
        await hiringSurveyApi.respond(Number(id), {
          departmentId: selectedDeptId!,
          roleTitle: form.roleTitle,
          headcount: form.headcount,
          quarter: form.quarter ? Number(form.quarter) : undefined,
          priority: form.priority,
          estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) : undefined,
          reason: form.reason,
        })
      }
      toast.success('임시저장 되었습니다.')
      const fresh = await hiringSurveyApi.get(Number(id))
      setSurvey(fresh)
    } catch {
      toast.error('저장에 실패했습니다. (권한 확인)')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!currentResponse) {
      toast.error('먼저 임시저장 하세요.')
      return
    }
    setSubmitting(true)
    try {
      await hiringSurveyApi.submitResponse(Number(id), currentResponse.id)
      toast.success('부서장 결재 요청이 전송됐습니다.')
      navigate(`/admin/recruitment/surveys/${id}`)
    } catch {
      toast.error('제출에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">채용 수요 응답</h1>
        <p className="text-sm text-gray-500 mt-1">{survey.title}</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>대상 부서 *</Label>
          <Select
            value={selectedDeptId != null ? String(selectedDeptId) : ''}
            onValueChange={(v) => setSelectedDeptId(v ? Number(v) : null)}
          >
            <SelectTrigger><SelectValue placeholder="부서 선택" /></SelectTrigger>
            <SelectContent>
              {survey.targetDepartments.map((t) => (
                <SelectItem key={t.departmentId} value={String(t.departmentId)} label={t.department.name}>
                  {t.department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentResponse && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">현재 상태:</span>
            <SurveyResponseStatusBadge status={currentResponse.status} />
            {currentResponse.status === 'REJECTED' && currentResponse.rejectionReason && (
              <span className="text-sm text-red-500">— {currentResponse.rejectionReason}</span>
            )}
          </div>
        )}

        <fieldset disabled={!canEdit} className="space-y-4">
          <div>
            <Label>채용 직책명 *</Label>
            <Input value={form.roleTitle} onChange={(e) => setForm({ ...form, roleTitle: e.target.value })} placeholder="피지컬 코치" />
          </div>
          <div>
            <Label>필요 인원 *</Label>
            <Input type="number" min={1} value={form.headcount} onChange={(e) => setForm({ ...form, headcount: Number(e.target.value) })} />
          </div>
          <div>
            <Label>희망 입사 시기</Label>
            <Select value={form.quarter} onValueChange={(v) => setForm({ ...form, quarter: v as '' | '1' | '2' | '3' | '4' })}>
              <SelectTrigger><SelectValue placeholder="연간 통합" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="" label="연간 통합">연간 통합</SelectItem>
                <SelectItem value="1" label="Q1 (1~3월)">Q1 (1~3월)</SelectItem>
                <SelectItem value="2" label="Q2 (4~6월)">Q2 (4~6월)</SelectItem>
                <SelectItem value="3" label="Q3 (7~9월)">Q3 (7~9월)</SelectItem>
                <SelectItem value="4" label="Q4 (10~12월)">Q4 (10~12월)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>우선순위 *</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as SurveyPriority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as SurveyPriority[]).map((p) => (
                  <SelectItem key={p} value={p} label={PRIORITY_LABELS[p]}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>예산 추정 (원, 선택)</Label>
            <Input type="number" value={form.estimatedBudget} onChange={(e) => setForm({ ...form, estimatedBudget: e.target.value })} placeholder="50000000" />
          </div>
          <div>
            <Label>채용 사유 *</Label>
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="기존 담당자 퇴직으로 인한 공백" rows={3} />
          </div>
        </fieldset>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => void handleSaveDraft()} disabled={saving || !canEdit} variant="outline">
          임시저장
        </Button>
        <Button onClick={() => void handleSubmit()} disabled={submitting || !canSubmit}>
          부서장에게 제출
        </Button>
        <Button variant="ghost" onClick={() => navigate(-1)}>취소</Button>
      </div>
    </div>
  )
}
