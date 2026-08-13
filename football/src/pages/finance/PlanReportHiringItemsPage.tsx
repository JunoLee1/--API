import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { hiringSurveyApi } from '@/services/hiring-survey.service'
import { planReportApi } from '@/services/plan-report.service'
import type { HiringPlanItem, SurveyPriority } from '@/types/hiring-survey'
import { PRIORITY_LABELS } from '@/types/hiring-survey'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const EMPTY_NEW = { roleTitle: '', headcount: 1, quarter: '' as '' | '1' | '2' | '3' | '4', priority: 'MEDIUM' as SurveyPriority, estimatedBudget: '' }

export function PlanReportHiringItemsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const planId = Number(id)
  const [items, setItems] = useState<HiringPlanItem[]>([])
  const [newForm, setNewForm] = useState(EMPTY_NEW)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<typeof EMPTY_NEW>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void hiringSurveyApi.listHiringItems(planId).then(setItems)
  }, [planId])

  const handleAdd = async () => {
    if (!newForm.roleTitle.trim()) { toast.error('직책명을 입력하세요.'); return }
    setSaving(true)
    try {
      const created = await hiringSurveyApi.createHiringItem(planId, {
        roleTitle: newForm.roleTitle,
        headcount: newForm.headcount,
        quarter: newForm.quarter ? Number(newForm.quarter) : undefined,
        priority: newForm.priority,
        estimatedBudget: newForm.estimatedBudget ? Number(newForm.estimatedBudget) : undefined,
      })
      setItems((prev) => [...prev, created])
      setNewForm(EMPTY_NEW)
      toast.success('항목이 추가됐습니다.')
    } catch { toast.error('추가에 실패했습니다.') }
    finally { setSaving(false) }
  }

  const handleUpdate = async (itemId: number) => {
    setSaving(true)
    try {
      const updated = await hiringSurveyApi.updateHiringItem(planId, itemId, {
        roleTitle: editForm.roleTitle,
        headcount: editForm.headcount ? Number(editForm.headcount) : undefined,
        quarter: editForm.quarter !== undefined ? (editForm.quarter ? Number(editForm.quarter) : null) : undefined,
        priority: editForm.priority,
        estimatedBudget: editForm.estimatedBudget !== undefined ? (editForm.estimatedBudget ? Number(editForm.estimatedBudget) : null) : undefined,
      })
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)))
      setEditingId(null)
      toast.success('항목이 수정됐습니다.')
    } catch { toast.error('수정에 실패했습니다.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (itemId: number) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    await hiringSurveyApi.deleteHiringItem(planId, itemId)
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    toast.success('삭제됐습니다.')
  }

  const handleSubmitPlan = async () => {
    try {
      await planReportApi.submit(planId)
      toast.success('계획서가 상신됐습니다.')
      navigate(`/finance/plan-reports/${planId}`)
    } catch { toast.error('상신에 실패했습니다.') }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">채용 계획 항목 편집</h1>
        <Button onClick={() => void handleSubmitPlan()}>계획서 상신 →</Button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-3">
            {editingId === item.id ? (
              <div className="space-y-2">
                <Input value={editForm.roleTitle ?? item.roleTitle} onChange={(e) => setEditForm({ ...editForm, roleTitle: e.target.value })} placeholder="직책명" />
                <div className="flex gap-2">
                  <Input type="number" value={editForm.headcount ?? item.headcount} onChange={(e) => setEditForm({ ...editForm, headcount: Number(e.target.value) })} className="w-24" />
                  <Select value={editForm.quarter ?? String(item.quarter ?? '')} onValueChange={(v) => setEditForm({ ...editForm, quarter: v as '' | '1' | '2' | '3' | '4' })}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="시기" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">연간</SelectItem>
                      {(['1','2','3','4'] as const).map((q) => <SelectItem key={q} value={q}>Q{q}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={editForm.priority ?? item.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v as SurveyPriority })}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_LABELS) as SurveyPriority[]).map((p) => (
                        <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void handleUpdate(item.id)} disabled={saving}>저장</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>취소</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.roleTitle}</p>
                  <p className="text-sm text-gray-500">
                    {item.headcount}명 · {item.quarter ? `Q${item.quarter}` : '연간'} · {PRIORITY_LABELS[item.priority]}
                    {item.estimatedBudget ? ` · 예산 ${item.estimatedBudget.toLocaleString()}원` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditingId(item.id); setEditForm({}) }}>수정</Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => void handleDelete(item.id)}>삭제</Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-400 text-center py-4">조사 응답에서 자동 생성된 항목이 없습니다.</p>}
      </div>

      <div className="border-t pt-4">
        <h2 className="font-semibold mb-2">항목 직접 추가</h2>
        <div className="flex gap-2 flex-wrap">
          <Input value={newForm.roleTitle} onChange={(e) => setNewForm({ ...newForm, roleTitle: e.target.value })} placeholder="직책명" className="w-40" />
          <Input type="number" value={newForm.headcount} onChange={(e) => setNewForm({ ...newForm, headcount: Number(e.target.value) })} className="w-20" />
          <Select value={newForm.quarter} onValueChange={(v) => setNewForm({ ...newForm, quarter: v as '' | '1' | '2' | '3' | '4' })}>
            <SelectTrigger className="w-28"><SelectValue placeholder="시기" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">연간</SelectItem>
              {(['1','2','3','4'] as const).map((q) => <SelectItem key={q} value={q}>Q{q}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={newForm.priority} onValueChange={(v) => setNewForm({ ...newForm, priority: v as SurveyPriority })}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_LABELS) as SurveyPriority[]).map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void handleAdd()} disabled={saving}>추가</Button>
        </div>
      </div>
    </div>
  )
}
