import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { onboardingTemplateApi } from '@/services/onboarding-template.service'
import type {
  OnboardingTemplate,
  OnboardingTemplateTask,
} from '@/types/onboarding-template'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowDown, ArrowUp, Trash2, Plus } from 'lucide-react'

/**
 * OnboardingTemplateManagementPage
 *
 * Route: `/departments/:departmentId/onboarding-template`
 *
 * Owned by department heads + HR + admin-like. Renders the Department 1:1
 * template as a form: template name + an ordered list of tasks (title,
 * description, dueDaysFromStart, requiresVerification, optional). Save is
 * PUT-upsert; a fresh page create the template on first save.
 */
export default function OnboardingTemplateManagementPage() {
  const params = useParams<{ departmentId?: string }>()
  const departmentId = Number(params.departmentId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [template, setTemplate] = useState<OnboardingTemplate | null>(null)
  const [name, setName] = useState('')
  const [tasks, setTasks] = useState<OnboardingTemplateTask[]>([])

  const load = useCallback(async () => {
    if (!Number.isFinite(departmentId) || departmentId <= 0) return
    setLoading(true)
    try {
      const t = await onboardingTemplateApi.get(departmentId)
      setTemplate(t)
      setName(t.name)
      setTasks(
        t.tasks.map((task) => ({
          ...task,
          requiresVerification: !!task.requiresVerification,
          optional: !!task.optional,
        })),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ERROR'
      if (msg === 'TEMPLATE_NOT_FOUND') {
        // Fresh page — no template yet. Prep empty defaults.
        setTemplate(null)
        setName('')
        setTasks([])
      } else {
        toast.error(`온보딩 템플릿 로드 실패: ${msg}`)
      }
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  const addTask = () => {
    setTasks((prev) => [
      ...prev,
      { title: '', requiresVerification: false, optional: false },
    ])
  }

  const removeTask = (idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx))
  }

  const moveTask = (idx: number, dir: -1 | 1) => {
    setTasks((prev) => {
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const copy = [...prev]
      const tmp = copy[idx]!
      copy[idx] = copy[next]!
      copy[next] = tmp
      return copy
    })
  }

  const updateTask = (idx: number, patch: Partial<OnboardingTemplateTask>) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('템플릿 이름을 입력해주세요')
      return
    }
    // Trim titles + strip empty tasks to match the service validator.
    const payload = tasks
      .map((t) => ({
        ...t,
        title: t.title.trim(),
        description: t.description?.trim() || undefined,
      }))
      .filter((t) => t.title.length > 0)

    if (payload.length !== tasks.length) {
      toast.error('제목이 빈 태스크가 있습니다')
      return
    }
    setSaving(true)
    try {
      const saved = await onboardingTemplateApi.upsert(departmentId, {
        name: name.trim(),
        tasks: payload,
      })
      setTemplate(saved)
      toast.success('온보딩 템플릿을 저장했습니다')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ERROR'
      toast.error(`저장 실패: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">직무 온보딩 템플릿</h1>
          <p className="text-sm text-muted-foreground mt-1">
            부서 ID {departmentId} · {template ? '수정' : '신규 생성'}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </Button>
      </header>

      <Card className="p-4 space-y-3">
        <div>
          <Label htmlFor="template-name">템플릿 이름</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 개발팀 온보딩 (2026)"
            maxLength={200}
          />
        </div>
      </Card>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">태스크 목록 ({tasks.length})</h2>
          <Button variant="outline" size="sm" onClick={addTask}>
            <Plus className="w-4 h-4 mr-1" />
            태스크 추가
          </Button>
        </div>
        {tasks.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            아직 태스크가 없습니다. "태스크 추가"를 눌러 시작하세요.
          </Card>
        ) : (
          <div className="space-y-3">
            {tasks.map((task, idx) => (
              <Card key={idx} className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-muted font-mono">
                    #{idx + 1}
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveTask(idx, -1)}
                    disabled={idx === 0}
                    aria-label="위로"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveTask(idx, 1)}
                    disabled={idx === tasks.length - 1}
                    aria-label="아래로"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTask(idx)}
                    aria-label="삭제"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
                <div>
                  <Label htmlFor={`task-title-${idx}`}>제목</Label>
                  <Input
                    id={`task-title-${idx}`}
                    value={task.title}
                    onChange={(e) => updateTask(idx, { title: e.target.value })}
                    placeholder="예: 환영 오리엔테이션"
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor={`task-desc-${idx}`}>설명 (선택)</Label>
                  <Textarea
                    id={`task-desc-${idx}`}
                    value={task.description ?? ''}
                    onChange={(e) => updateTask(idx, { description: e.target.value })}
                    placeholder="상세 안내가 필요할 때 입력"
                    maxLength={2000}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor={`task-due-${idx}`}>기한 (입사 후 N일, 선택)</Label>
                    <Input
                      id={`task-due-${idx}`}
                      type="number"
                      min={0}
                      max={365}
                      value={task.dueDaysFromStart ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw === '') {
                          updateTask(idx, { dueDaysFromStart: undefined })
                        } else {
                          const n = Number(raw)
                          if (Number.isFinite(n)) updateTask(idx, { dueDaysFromStart: n })
                        }
                      }}
                      placeholder="예: 7"
                    />
                  </div>
                  <label className="flex items-center gap-2 mt-6">
                    <Checkbox
                      checked={task.requiresVerification}
                      onCheckedChange={(v) => updateTask(idx, { requiresVerification: v === true })}
                    />
                    <span className="text-sm">HR/부서장 검증 필요</span>
                  </label>
                  <label className="flex items-center gap-2 mt-6">
                    <Checkbox
                      checked={task.optional}
                      onCheckedChange={(v) => updateTask(idx, { optional: v === true })}
                    />
                    <span className="text-sm">선택 (건너뛰기 가능)</span>
                  </label>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
