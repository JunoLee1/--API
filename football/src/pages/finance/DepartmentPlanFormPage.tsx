import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { departmentPlanApi } from '@/services/department-plan.service'
import { seasonApi } from '@/services/season.service'
import { departmentApi } from '@/services/department.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { DepartmentAnnualPlan } from '@/types/department-plan'
import type { Season } from '@/types/season'
import type { Department } from '@/services/department.service'
import {
  OPERATING_CATEGORIES,
  OPERATING_CATEGORY_LABEL,
  type OperatingCategory,
} from '@/types/department-plan'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

type KpiDraft = { title: string; targetValue: string; quarter: string }

function emptyBudget(): Record<OperatingCategory, string> {
  return {
    MEDICAL: '', MEAL: '', TRAVEL: '', EQUIPMENT: '', SCOUTING: '', YOUTH: '',
  }
}

export function DepartmentPlanFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { user } = useCurrentUser()

  const [seasons, setSeasons] = useState<Season[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // form state
  const [seasonId, setSeasonId] = useState<string>('')
  const [departmentId, setDepartmentId] = useState<string>('')
  const [objectives, setObjectives] = useState<string[]>([''])
  const [milestones, setMilestones] = useState<{ q1: string; q2: string; q3: string; q4: string }>({ q1: '', q2: '', q3: '', q4: '' })
  const [kpiItems, setKpiItems] = useState<KpiDraft[]>([{ title: '', targetValue: '', quarter: '' }])
  const [budget, setBudget] = useState<Record<OperatingCategory, string>>(emptyBudget())
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)

  const [existingPlan, setExistingPlan] = useState<DepartmentAnnualPlan | null>(null)

  useEffect(() => {
    Promise.all([seasonApi.list(), departmentApi.list()]).then(([s, d]) => {
      setSeasons(s)
      setDepartments(d.filter((dept) => dept.isActive))
      if (!isEdit) {
        const active = s.find((x) => x.status === 'ACTIVE') ?? s[0]
        if (active) setSeasonId(active.id.toString())
      }
    }).catch(() => toast.error('초기 데이터를 불러오지 못했습니다.'))
  }, [isEdit])

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    departmentPlanApi.get(Number(id)).then((plan) => {
      setExistingPlan(plan)
      setSeasonId(plan.seasonId.toString())
      setDepartmentId(plan.departmentId.toString())
      setObjectives(plan.objectives.length > 0 ? plan.objectives : [''])
      const ms = { q1: '', q2: '', q3: '', q4: '' }
      for (const m of plan.milestones) {
        if (m.quarter === 1) ms.q1 = m.text
        else if (m.quarter === 2) ms.q2 = m.text
        else if (m.quarter === 3) ms.q3 = m.text
        else if (m.quarter === 4) ms.q4 = m.text
      }
      setMilestones(ms)
      const budgetDraft = emptyBudget()
      for (const b of plan.budgetItems) {
        budgetDraft[b.category] = b.amount.toString()
      }
      setBudget(budgetDraft)
      setKpiItems(
        plan.kpiItems.length > 0
          ? plan.kpiItems.map((k) => ({
              title: k.title,
              targetValue: k.targetValue,
              quarter: k.quarter !== null ? String(k.quarter) : '',
            }))
          : [{ title: '', targetValue: '', quarter: '' }]
      )
      if (plan.rejectionReason) setRejectionReason(plan.rejectionReason)
    }).catch(() => toast.error('계획서를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const buildPayload = () => {
    const milestonesArr = [
      { quarter: 1 as const, text: milestones.q1 },
      { quarter: 2 as const, text: milestones.q2 },
      { quarter: 3 as const, text: milestones.q3 },
      { quarter: 4 as const, text: milestones.q4 },
    ].filter((m) => m.text.trim())

    const budgetItemsArr = OPERATING_CATEGORIES
      .map((cat) => ({ category: cat, amount: Number(budget[cat]) }))
      .filter((b) => b.amount > 0)

    const kpiArr = kpiItems
      .filter((k) => k.title.trim() && k.targetValue.trim())
      .map((k) => ({
        title: k.title,
        targetValue: k.targetValue,
        quarter: k.quarter ? Number(k.quarter) : null,
      }))

    return {
      objectives: objectives.filter((o) => o.trim()),
      milestones: milestonesArr,
      budgetItems: budgetItemsArr,
      kpiItems: kpiArr,
    }
  }

  const handleSave = async () => {
    if (!seasonId || !departmentId) {
      toast.error('시즌과 부서를 선택해주세요.')
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await departmentPlanApi.update(Number(id), buildPayload())
        toast.success('저장됐습니다.')
      } else {
        const plan = await departmentPlanApi.create({
          seasonId: Number(seasonId),
          departmentId: Number(departmentId),
          ...buildPayload(),
        })
        toast.success('계획서가 생성됐습니다.')
        navigate(`/finance/department-plans/${plan.id}`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!isEdit || !existingPlan) return
    setSubmitting(true)
    try {
      await departmentPlanApi.submit(existingPlan.id)
      toast.success('검토 요청이 제출됐습니다.')
      navigate(`/finance/department-plans/${existingPlan.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '제출 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const isDepartmentHead = !!user && !!existingPlan && existingPlan.department.headId === user.id
  const canSubmit = isEdit && isDepartmentHead && existingPlan?.status === 'DRAFT'

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{isEdit ? '계획서 수정' : '새 계획서 작성'}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">부서 연간 목표·예산·KPI를 입력하세요.</p>
      </div>

      {/* 반려 사유 */}
      {rejectionReason && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">반려 사유</p>
          <p>{rejectionReason}</p>
        </div>
      )}

      {/* 섹션 1: 기본정보 */}
      <section className="space-y-4 border rounded-lg p-4">
        <h2 className="font-semibold text-base">기본 정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>시즌</Label>
            <Select
              value={seasonId}
              onValueChange={setSeasonId}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="시즌 선택" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>부서</Label>
            <Select
              value={departmentId}
              onValueChange={setDepartmentId}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="부서 선택" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* 섹션 2: 목표 */}
      <section className="space-y-3 border rounded-lg p-4">
        <h2 className="font-semibold text-base">목표 (Objectives)</h2>
        <div className="space-y-2">
          {objectives.map((obj, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={obj}
                onChange={(e) => {
                  const next = [...objectives]
                  next[i] = e.target.value
                  setObjectives(next)
                }}
                placeholder={`목표 ${i + 1}`}
              />
              {objectives.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive shrink-0"
                  onClick={() => setObjectives(objectives.filter((_, j) => j !== i))}
                >
                  삭제
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setObjectives([...objectives, ''])}>
          + 목표 추가
        </Button>
      </section>

      {/* 섹션 3: 분기별 마일스톤 */}
      <section className="space-y-3 border rounded-lg p-4">
        <h2 className="font-semibold text-base">분기별 마일스톤</h2>
        <div className="grid grid-cols-2 gap-3">
          {(['q1', 'q2', 'q3', 'q4'] as const).map((q, idx) => (
            <div key={q} className="space-y-1">
              <Label>Q{idx + 1}</Label>
              <Input
                value={milestones[q]}
                onChange={(e) => setMilestones((prev) => ({ ...prev, [q]: e.target.value }))}
                placeholder={`Q${idx + 1} 마일스톤`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* 섹션 4: KPI */}
      <section className="space-y-3 border rounded-lg p-4">
        <h2 className="font-semibold text-base">KPI 항목</h2>
        <div className="space-y-3">
          {kpiItems.map((kpi, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
              <div className="space-y-1">
                {i === 0 && <Label className="text-xs text-muted-foreground">지표명</Label>}
                <Input
                  value={kpi.title}
                  onChange={(e) => {
                    const next = [...kpiItems]
                    next[i] = { ...kpi, title: e.target.value }
                    setKpiItems(next)
                  }}
                  placeholder="예: 부상률 감소"
                />
              </div>
              <div className="space-y-1">
                {i === 0 && <Label className="text-xs text-muted-foreground">목표값</Label>}
                <Input
                  value={kpi.targetValue}
                  onChange={(e) => {
                    const next = [...kpiItems]
                    next[i] = { ...kpi, targetValue: e.target.value }
                    setKpiItems(next)
                  }}
                  placeholder="예: 20% 이하"
                />
              </div>
              <div className="space-y-1">
                {i === 0 && <Label className="text-xs text-muted-foreground">분기</Label>}
                <Select
                  value={kpi.quarter || '__none__'}
                  onValueChange={(v) => {
                    const next = [...kpiItems]
                    next[i] = { ...kpi, quarter: v === '__none__' ? '' : v }
                    setKpiItems(next)
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-</SelectItem>
                    {[1, 2, 3, 4].map((q) => (
                      <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={i === 0 ? 'pt-5' : ''}>
                {kpiItems.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setKpiItems(kpiItems.filter((_, j) => j !== i))}
                  >
                    삭제
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setKpiItems([...kpiItems, { title: '', targetValue: '', quarter: '' }])}
        >
          + KPI 추가
        </Button>
      </section>

      {/* 섹션 5: 예산 */}
      <section className="space-y-3 border rounded-lg p-4">
        <h2 className="font-semibold text-base">카테고리별 예산</h2>
        <div className="grid grid-cols-2 gap-3">
          {OPERATING_CATEGORIES.map((cat) => (
            <div key={cat} className="space-y-1">
              <Label>{OPERATING_CATEGORY_LABEL[cat]}</Label>
              <Input
                type="number"
                min={0}
                value={budget[cat]}
                onChange={(e) => setBudget((prev) => ({ ...prev, [cat]: e.target.value }))}
                placeholder="₩ 금액"
              />
            </div>
          ))}
        </div>
      </section>

      {/* 하단 버튼 */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => navigate(-1)}>취소</Button>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? '저장 중...' : '임시저장'}
        </Button>
        {canSubmit && (
          <Button
            variant="default"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? '제출 중...' : '검토 요청 제출'}
          </Button>
        )}
      </div>
    </div>
  )
}
