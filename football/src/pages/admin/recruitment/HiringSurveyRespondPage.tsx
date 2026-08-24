import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { hiringSurveyApi } from '@/services/hiring-survey.service'
import type { HiringNeedsSurvey, SurveyPriority } from '@/types/hiring-survey'
import { PRIORITY_LABELS } from '@/types/hiring-survey'
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

export function HiringSurveyRespondPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<HiringNeedsSurvey | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void hiringSurveyApi.get(Number(id)).then(setSurvey)
  }, [id])

  if (!survey) return <div className="p-6">로딩 중...</div>
  if (survey.status !== 'OPEN') return <div className="p-6 text-red-500">이미 마감된 조사입니다.</div>

  const handleSubmit = async () => {
    if (!form.roleTitle.trim()) { toast.error('직책명을 입력하세요.'); return }
    if (form.headcount < 1) { toast.error('필요 인원은 1명 이상이어야 합니다.'); return }
    if (!form.reason.trim()) { toast.error('사유를 입력하세요.'); return }

    setSaving(true)
    try {
      await hiringSurveyApi.respond(Number(id), {
        roleTitle: form.roleTitle,
        headcount: form.headcount,
        quarter: form.quarter ? Number(form.quarter) : undefined,
        priority: form.priority,
        estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) : undefined,
        reason: form.reason,
      })
      toast.success('응답이 제출됐습니다.')
      navigate(-1)
    } catch {
      toast.error('제출에 실패했습니다.')
    } finally {
      setSaving(false)
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
      </div>

      <div className="flex gap-2">
        <Button onClick={() => void handleSubmit()} disabled={saving}>제출</Button>
        <Button variant="outline" onClick={() => navigate(-1)}>취소</Button>
      </div>
    </div>
  )
}
