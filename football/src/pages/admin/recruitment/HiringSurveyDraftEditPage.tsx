import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { hiringSurveyApi } from '@/services/hiring-survey.service'
import { departmentApi } from '@/services/department.service'
import type { HiringNeedsSurvey } from '@/types/hiring-survey'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfirm } from '@/lib/confirm-dialog'

interface Dept { id: number; name: string }

const toDateInput = (iso: string) => iso.slice(0, 10)

export function HiringSurveyDraftEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [survey, setSurvey] = useState<HiringNeedsSurvey | null>(null)
  const [departments, setDepartments] = useState<Dept[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', deadlineAt: '', targetDeptIds: [] as number[] })
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    void (async () => {
      try {
        const [s, depts] = await Promise.all([
          hiringSurveyApi.get(Number(id)),
          departmentApi.list(),
        ])
        setSurvey(s)
        setDepartments(depts)
        setForm({
          title: s.title,
          deadlineAt: toDateInput(s.deadlineAt),
          targetDeptIds: s.targetDepartments.map((t) => t.departmentId),
        })
      } catch {
        toast.error('불러오기에 실패했습니다.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const toggleDept = (deptId: number) => {
    setForm((f) => ({
      ...f,
      targetDeptIds: f.targetDeptIds.includes(deptId)
        ? f.targetDeptIds.filter((d) => d !== deptId)
        : [...f.targetDeptIds, deptId],
    }))
  }

  const handleSave = async () => {
    if (!id) return
    if (!form.title.trim()) { toast.error('제목을 입력하세요.'); return }
    if (!form.deadlineAt) { toast.error('마감일을 입력하세요.'); return }
    if (!form.targetDeptIds.length) { toast.error('대상 부서를 선택하세요.'); return }
    setSaving(true)
    try {
      const updated = await hiringSurveyApi.updateDraft(Number(id), {
        title: form.title,
        deadlineAt: form.deadlineAt,
        targetDeptIds: form.targetDeptIds,
      })
      setSurvey(updated)
      toast.success('저장됐습니다.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpen = async () => {
    if (!id) return
    const ok = await confirm({
      title: '조사를 open 하시겠습니까?',
      description: 'open 후에는 편집이 불가하며 대상 부서장에게 응답 요청 알림이 발송됩니다.',
    })
    if (!ok) return
    setOpening(true)
    try {
      await hiringSurveyApi.open(Number(id))
      toast.success('조사가 open 됐습니다.')
      navigate('/admin/recruitment/surveys')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'open 에 실패했습니다.')
    } finally {
      setOpening(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    const ok = await confirm({
      title: '이 초안을 삭제하시겠습니까?',
      description: '삭제된 초안은 복구할 수 없습니다.',
      variant: 'destructive',
      confirmText: '삭제',
    })
    if (!ok) return
    setDeleting(true)
    try {
      await hiringSurveyApi.deleteDraft(Number(id))
      toast.success('초안이 삭제됐습니다.')
      navigate('/admin/recruitment/surveys')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="p-6">로딩 중...</div>
  if (!survey) return <div className="p-6 text-red-500">조사를 찾을 수 없습니다.</div>
  if (survey.status !== 'DRAFT') {
    return (
      <div className="p-6 space-y-4">
        <p className="text-red-500">이 조사는 초안 상태가 아닙니다 (현재: {survey.status}).</p>
        <Button variant="outline" onClick={() => navigate('/admin/recruitment/surveys')}>목록으로</Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">채용 수요 조사 초안 편집</h1>
        <Button variant="outline" onClick={() => navigate('/admin/recruitment/surveys')}>목록으로</Button>
      </div>

      <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
        <div>
          <Label>조사 제목</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="2027년 채용 수요 조사"
          />
        </div>
        <div>
          <Label>마감일</Label>
          <Input
            type="date"
            value={form.deadlineAt}
            onChange={(e) => setForm({ ...form, deadlineAt: e.target.value })}
          />
        </div>
        <div>
          <Label>대상 부서 선택</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {departments.map((d) => (
              <button
                key={d.id}
                type="button"
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
          <Button onClick={() => void handleSave()} disabled={saving}>저장</Button>
          <Button onClick={() => void handleOpen()} disabled={opening}>
            {opening ? 'Open 중...' : 'Open Survey'}
          </Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? '삭제 중...' : 'Delete Draft'}
          </Button>
        </div>
      </div>
    </div>
  )
}
