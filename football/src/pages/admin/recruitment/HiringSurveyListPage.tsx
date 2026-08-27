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

const STATUS_LABEL: Record<string, string> = { DRAFT: '초안', OPEN: '진행중', CLOSED: '마감' }
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

export function HiringSurveyListPage() {
  const navigate = useNavigate()
  const [surveys, setSurveys] = useState<HiringNeedsSurvey[]>([])
  const [departments, setDepartments] = useState<Dept[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', deadlineAt: '', targetDeptIds: [] as number[] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void hiringSurveyApi.list().then(setSurveys)
    void departmentApi.list().then(setDepartments)
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
            <Button onClick={() => void handleCreate()} disabled={saving}>생성</Button>
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
              onClick={() =>
                navigate(
                  s.status === 'DRAFT'
                    ? `/admin/recruitment/surveys/${s.id}/edit`
                    : `/admin/recruitment/surveys/${s.id}`,
                )
              }
              className="border rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
            >
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-gray-500">
                  응답 {respondedCount}/{totalCount}개 부서 ·{' '}
                  {s.status === 'OPEN'
                    ? `마감 D-${deadlineDays}일`
                    : s.status === 'DRAFT'
                      ? '초안 · open 대기'
                      : '마감됨'}
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
