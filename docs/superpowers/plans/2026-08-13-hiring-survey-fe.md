# HR 채용 연간 계획 워크플로우 — 프론트엔드 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 채용 수요 조사 생성·응답·마감 + 채용 계획 항목 편집 + 채용공고 연결 프론트엔드 구현

**Architecture:** `@/services/hiring-survey.service.ts`가 API 레이어, `@/types/hiring-survey.ts`가 타입 레이어, 페이지는 `football/src/pages/admin/recruitment/` 아래에 추가. `App.tsx`에 라우트 등록.

**Tech Stack:** React, React Router, sonner(toast), shadcn/ui, `@/services/api`

**전제조건:** 백엔드 플랜(`2026-08-13-hiring-survey-be.md`) 구현 완료 후 진행

**Spec:** `docs/superpowers/specs/2026-08-13-hiring-survey-annual-plan-design.md`

---

## 파일 구조

```
football/src/types/hiring-survey.ts                                      ← 신규
football/src/services/hiring-survey.service.ts                           ← 신규
football/src/pages/admin/recruitment/HiringSurveyListPage.tsx            ← 신규
football/src/pages/admin/recruitment/HiringSurveyDetailPage.tsx          ← 신규
football/src/pages/admin/recruitment/HiringSurveyRespondPage.tsx         ← 신규
football/src/pages/finance/PlanReportHiringItemsPage.tsx                 ← 신규
football/src/pages/admin/recruitment/JobPostingListPage.tsx              ← 수정: hiringPlanItemId 드롭다운 추가
football/src/App.tsx                                                     ← 수정: 라우트 5개 추가
```

---

## Task 1: 타입 정의

**Files:**
- Create: `football/src/types/hiring-survey.ts`

- [x] **Step 1: 타입 파일 작성**

`football/src/types/hiring-survey.ts`:
```typescript
export type SurveyStatus = 'OPEN' | 'CLOSED'
export type SurveyPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export const PRIORITY_LABELS: Record<SurveyPriority, string> = {
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
}

export interface SurveyTargetDept {
  surveyId: number
  departmentId: number
  department: { id: number; name: string; headId: number | null }
}

export interface SurveyResponse {
  id: number
  surveyId: number
  departmentId: number
  department: { id: number; name: string }
  submittedBy: { id: number; username: string }
  roleTitle: string
  headcount: number
  quarter: number | null
  priority: SurveyPriority
  estimatedBudget: number | null
  reason: string
  createdAt: string
}

export interface HiringNeedsSurvey {
  id: number
  title: string
  deadlineAt: string
  status: SurveyStatus
  createdBy: { id: number; username: string }
  targetDepartments: SurveyTargetDept[]
  responses: SurveyResponse[]
  createdAt: string
}

export interface HiringPlanItem {
  id: number
  planReportId: number
  surveyResponseId: number | null
  roleTitle: string
  headcount: number
  quarter: number | null
  priority: SurveyPriority
  estimatedBudget: number | null
  createdAt: string
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/types/hiring-survey.ts
git commit -m "feat(fe): add hiring-survey type definitions"
```

---

## Task 2: API 서비스 레이어

**Files:**
- Create: `football/src/services/hiring-survey.service.ts`

- [x] **Step 1: 서비스 파일 작성**

`football/src/services/hiring-survey.service.ts`:
```typescript
import { api } from './api'
import type { HiringNeedsSurvey, HiringPlanItem } from '@/types/hiring-survey'

export const hiringSurveyApi = {
  list: (): Promise<HiringNeedsSurvey[]> =>
    api.get('/hiring-surveys'),

  get: (id: number): Promise<HiringNeedsSurvey> =>
    api.get(`/hiring-surveys/${id}`),

  create: (data: { title: string; deadlineAt: string; targetDeptIds: number[] }): Promise<HiringNeedsSurvey> =>
    api.post('/hiring-surveys', data),

  respond: (
    surveyId: number,
    data: {
      roleTitle: string
      headcount: number
      quarter?: number
      priority: string
      estimatedBudget?: number
      reason: string
    }
  ): Promise<void> =>
    api.post(`/hiring-surveys/${surveyId}/respond`, data),

  close: (surveyId: number): Promise<{ id: number }> =>
    api.post(`/hiring-surveys/${surveyId}/close`, {}),

  listHiringItems: (planReportId: number): Promise<HiringPlanItem[]> =>
    api.get(`/plan-reports/${planReportId}/hiring-items`),

  createHiringItem: (planReportId: number, data: {
    roleTitle: string; headcount: number; quarter?: number; priority: string; estimatedBudget?: number
  }): Promise<HiringPlanItem> =>
    api.post(`/plan-reports/${planReportId}/hiring-items`, data),

  updateHiringItem: (planReportId: number, itemId: number, data: {
    roleTitle?: string; headcount?: number; quarter?: number | null; priority?: string; estimatedBudget?: number | null
  }): Promise<HiringPlanItem> =>
    api.patch(`/plan-reports/${planReportId}/hiring-items/${itemId}`, data),

  deleteHiringItem: (planReportId: number, itemId: number): Promise<void> =>
    api.delete(`/plan-reports/${planReportId}/hiring-items/${itemId}`),
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/services/hiring-survey.service.ts
git commit -m "feat(fe): add hiring-survey API service"
```

---

## Task 3: 채용 수요 조사 목록 + 생성 페이지

**Files:**
- Create: `football/src/pages/admin/recruitment/HiringSurveyListPage.tsx`

- [x] **Step 1: 페이지 작성**

`football/src/pages/admin/recruitment/HiringSurveyListPage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { hiringSurveyApi } from '@/services/hiring-survey.service'
import { departmentApi } from '@/services/department.service'
import type { HiringNeedsSurvey } from '@/types/hiring-survey'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface Dept { id: number; name: string }

const STATUS_LABEL: Record<string, string> = { OPEN: '진행중', CLOSED: '마감' }
const STATUS_COLOR: Record<string, string> = { OPEN: 'bg-green-100 text-green-700', CLOSED: 'bg-gray-100 text-gray-500' }

export function HiringSurveyListPage() {
  const navigate = useNavigate()
  const [surveys, setSurveys] = useState<HiringNeedsSurvey[]>([])
  const [departments, setDepartments] = useState<Dept[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', deadlineAt: '', targetDeptIds: [] as number[] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    hiringSurveyApi.list().then(setSurveys)
    departmentApi.list().then(setDepartments)
  }, [])

  const toggleDept = (id: number) => {
    setForm((f) => ({
      ...f,
      targetDeptIds: f.targetDeptIds.includes(id)
        ? f.targetDeptIds.filter((d) => d !== id)
        : [...f.targetDeptIds, id],
    }))
  }

  const handleCreate = async () => {
    if (!form.title.trim() || !form.deadlineAt || !form.targetDeptIds.length) {
      toast.error('제목, 마감일, 대상 부서를 모두 입력하세요.')
      return
    }
    setSaving(true)
    try {
      const created = await hiringSurveyApi.create(form)
      setSurveys((prev) => [created, ...prev])
      setShowForm(false)
      setForm({ title: '', deadlineAt: '', targetDeptIds: [] })
      toast.success('조사가 생성됐습니다.')
    } catch {
      toast.error('생성에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">채용 수요 조사</h1>
        <Button onClick={() => setShowForm(!showForm)}>+ 새 조사</Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
          <div>
            <Label>조사 제목</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="2027년 채용 수요 조사" />
          </div>
          <div>
            <Label>마감일</Label>
            <Input type="date" value={form.deadlineAt} onChange={(e) => setForm({ ...form, deadlineAt: e.target.value })} />
          </div>
          <div>
            <Label>대상 부서 선택</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {departments.map((d) => (
                <button
                  key={d.id}
                  onClick={() => toggleDept(d.id)}
                  className={`px-3 py-1 rounded-full border text-sm transition-colors ${
                    form.targetDeptIds.includes(d.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={saving}>생성</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>취소</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {surveys.map((s) => {
          const respondedCount = s.responses.length
          const totalCount = s.targetDepartments.length
          const deadlineDays = Math.ceil((new Date(s.deadlineAt).getTime() - Date.now()) / 86400000)
          return (
            <div
              key={s.id}
              onClick={() => navigate(`/admin/recruitment/surveys/${s.id}`)}
              className="border rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
            >
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-gray-500">
                  응답 {respondedCount}/{totalCount}개 부서 ·{' '}
                  {s.status === 'OPEN' ? `마감 D-${deadlineDays}일` : '마감됨'}
                </p>
              </div>
              <Badge className={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge>
            </div>
          )
        })}
        {surveys.length === 0 && <p className="text-gray-400 text-center py-8">등록된 조사가 없습니다.</p>}
      </div>
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/admin/recruitment/HiringSurveyListPage.tsx
git commit -m "feat(fe): add HiringSurveyListPage with create form"
```

---

## Task 4: 채용 수요 조사 상세 페이지 (응답 현황 + 마감)

**Files:**
- Create: `football/src/pages/admin/recruitment/HiringSurveyDetailPage.tsx`

- [x] **Step 1: 페이지 작성**

`football/src/pages/admin/recruitment/HiringSurveyDetailPage.tsx`:
```tsx
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
    hiringSurveyApi.get(Number(id)).then(setSurvey)
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
          <Button variant="destructive" onClick={handleClose} disabled={closing}>
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
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/admin/recruitment/HiringSurveyDetailPage.tsx
git commit -m "feat(fe): add HiringSurveyDetailPage with response status and close"
```

---

## Task 5: 부서장 응답 입력 페이지

**Files:**
- Create: `football/src/pages/admin/recruitment/HiringSurveyRespondPage.tsx`

- [x] **Step 1: 페이지 작성**

`football/src/pages/admin/recruitment/HiringSurveyRespondPage.tsx`:
```tsx
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
    hiringSurveyApi.get(Number(id)).then(setSurvey)
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
          <Select value={form.quarter} onValueChange={(v) => setForm({ ...form, quarter: v as any })}>
            <SelectTrigger><SelectValue placeholder="연간 통합" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">연간 통합</SelectItem>
              <SelectItem value="1">Q1 (1~3월)</SelectItem>
              <SelectItem value="2">Q2 (4~6월)</SelectItem>
              <SelectItem value="3">Q3 (7~9월)</SelectItem>
              <SelectItem value="4">Q4 (10~12월)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>우선순위 *</Label>
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as SurveyPriority })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_LABELS) as SurveyPriority[]).map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
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
        <Button onClick={handleSubmit} disabled={saving}>제출</Button>
        <Button variant="outline" onClick={() => navigate(-1)}>취소</Button>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/admin/recruitment/HiringSurveyRespondPage.tsx
git commit -m "feat(fe): add HiringSurveyRespondPage for dept head response"
```

---

## Task 6: 채용 계획 항목 편집 페이지

**Files:**
- Create: `football/src/pages/finance/PlanReportHiringItemsPage.tsx`

- [x] **Step 1: 페이지 작성**

`football/src/pages/finance/PlanReportHiringItemsPage.tsx`:
```tsx
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

const EMPTY_NEW = { roleTitle: '', headcount: 1, quarter: '' as '' | '1'|'2'|'3'|'4', priority: 'MEDIUM' as SurveyPriority, estimatedBudget: '' }

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
    hiringSurveyApi.listHiringItems(planId).then(setItems)
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
        quarter: editForm.quarter ? Number(editForm.quarter) : null,
        priority: editForm.priority,
        estimatedBudget: editForm.estimatedBudget ? Number(editForm.estimatedBudget) : null,
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
        <Button onClick={handleSubmitPlan}>계획서 상신 →</Button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-3">
            {editingId === item.id ? (
              <div className="space-y-2">
                <Input value={editForm.roleTitle ?? item.roleTitle} onChange={(e) => setEditForm({ ...editForm, roleTitle: e.target.value })} placeholder="직책명" />
                <div className="flex gap-2">
                  <Input type="number" value={editForm.headcount ?? item.headcount} onChange={(e) => setEditForm({ ...editForm, headcount: Number(e.target.value) })} className="w-24" />
                  <Select value={editForm.quarter ?? String(item.quarter ?? '')} onValueChange={(v) => setEditForm({ ...editForm, quarter: v as any })}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="시기" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">연간</SelectItem>
                      {['1','2','3','4'].map((q) => <SelectItem key={q} value={q}>Q{q}</SelectItem>)}
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
                  <Button size="sm" onClick={() => handleUpdate(item.id)} disabled={saving}>저장</Button>
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
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(item.id)}>삭제</Button>
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
          <Select value={newForm.quarter} onValueChange={(v) => setNewForm({ ...newForm, quarter: v as any })}>
            <SelectTrigger className="w-28"><SelectValue placeholder="시기" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">연간</SelectItem>
              {['1','2','3','4'].map((q) => <SelectItem key={q} value={q}>Q{q}</SelectItem>)}
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
          <Button onClick={handleAdd} disabled={saving}>추가</Button>
        </div>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/finance/PlanReportHiringItemsPage.tsx
git commit -m "feat(fe): add PlanReportHiringItemsPage for editing plan items"
```

---

## Task 7: JobPosting 생성 폼에 hiringPlanItemId 드롭다운 추가

**Files:**
- Modify: `football/src/pages/admin/recruitment/JobPostingListPage.tsx`

- [x] **Step 1: HiringPlanItem 타입 import 및 상태 추가**

`JobPostingListPage.tsx`의 상단 imports에 추가:
```typescript
import { hiringSurveyApi } from '@/services/hiring-survey.service'
import type { HiringPlanItem } from '@/types/hiring-survey'
import { PRIORITY_LABELS } from '@/types/hiring-survey'
```

컴포넌트 state에 추가:
```typescript
const [hiringItems, setHiringItems] = useState<HiringPlanItem[]>([])
```

공고 생성 폼에서 `planReportId` 선택 시 해당 PlanReport의 HiringPlanItems 로드:
```typescript
// planReportId 변경 핸들러에서
const handlePlanReportChange = async (planReportId: number) => {
  setForm({ ...form, planReportId, hiringPlanItemId: undefined })
  if (planReportId) {
    const items = await hiringSurveyApi.listHiringItems(planReportId)
    setHiringItems(items)
  } else {
    setHiringItems([])
  }
}
```

- [x] **Step 2: hiringPlanItemId 드롭다운 추가**

공고 생성 폼의 `planReportId` Select 아래에 추가:
```tsx
{hiringItems.length > 0 && (
  <div>
    <Label>채용 계획 항목 연결 (선택)</Label>
    <Select
      value={String(form.hiringPlanItemId ?? '')}
      onValueChange={(v) => setForm({ ...form, hiringPlanItemId: v ? Number(v) : undefined })}
    >
      <SelectTrigger>
        <SelectValue placeholder="계획 항목 선택 (선택사항)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">연결 안 함</SelectItem>
        {hiringItems.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {item.roleTitle} · {item.headcount}명 · {PRIORITY_LABELS[item.priority]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

- [x] **Step 3: Commit**

```bash
git add football/src/pages/admin/recruitment/JobPostingListPage.tsx
git commit -m "feat(fe): add hiringPlanItemId selector to JobPosting form"
```

---

## Task 8: App.tsx 라우트 등록

**Files:**
- Modify: `football/src/App.tsx`

- [x] **Step 1: import 추가**

```typescript
import { HiringSurveyListPage } from './pages/admin/recruitment/HiringSurveyListPage'
import { HiringSurveyDetailPage } from './pages/admin/recruitment/HiringSurveyDetailPage'
import { HiringSurveyRespondPage } from './pages/admin/recruitment/HiringSurveyRespondPage'
import { PlanReportHiringItemsPage } from './pages/finance/PlanReportHiringItemsPage'
```

- [x] **Step 2: 라우트 추가**

기존 recruitment 관련 라우트 근처에 추가:
```tsx
<Route path="/admin/recruitment/surveys" element={<HiringSurveyListPage />} />
<Route path="/admin/recruitment/surveys/:id" element={<HiringSurveyDetailPage />} />
<Route path="/admin/recruitment/surveys/:id/respond" element={<HiringSurveyRespondPage />} />
<Route path="/finance/plan-reports/:id/hiring-items" element={<PlanReportHiringItemsPage />} />
```

- [x] **Step 3: 네비게이션 링크 추가**

사이드바 또는 채용 메뉴에서 "채용 수요 조사" 링크를 `/admin/recruitment/surveys`로 추가. (사이드바 컴포넌트 경로는 프로젝트 구조 따라 확인)

- [x] **Step 4: Commit**

```bash
git add football/src/App.tsx
git commit -m "feat(fe): register hiring-survey routes in App.tsx"
```

---

## 최종 확인

- [x] **빌드 오류 없는지 확인**

```bash
cd football
npm run build
```

Expected: 오류 없이 빌드 완료

- [x] **개발 서버에서 골든 패스 수동 테스트**

1. HR_MANAGER로 로그인 → `/admin/recruitment/surveys` 접근
2. "새 조사" → 제목·마감일·대상 부서 입력 후 생성
3. 부서장 계정으로 로그인 → 알림에서 조사 링크 클릭 → 응답 제출
4. HR_MANAGER로 다시 로그인 → 조사 상세에서 응답 현황 확인 → "지금 마감"
5. 채용 계획 항목 편집 페이지로 자동 이동 → 항목 수정 → "계획서 상신"
6. ADMIN으로 로그인 → PlanReport 최종 승인
7. HR_MANAGER 알림 "채용공고 등록 가능" 확인 → JobPosting 생성 시 hiringPlanItemId 선택 가능 확인
