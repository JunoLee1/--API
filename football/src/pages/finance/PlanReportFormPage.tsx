import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { planReportApi } from '@/services/plan-report.service'
import { departmentApi } from '@/services/department.service'
import type { PlanTemplateType } from '@/types/plan-report'
import { TEMPLATE_TYPE_LABELS, EXTRA_FIELDS_CONFIG } from '@/types/plan-report'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'

interface Department {
  id: number
  name: string
}

const EMPTY_FORM = {
  title: '',
  purpose: '',
  departmentId: 0,
  startDate: '',
  endDate: '',
  budget: 0,
  expectedEffect: '',
  risks: '',
  resultDueDate: '',
  templateType: 'GENERAL' as PlanTemplateType,
  attachments: [] as string[],
  extraFields: {} as Record<string, unknown>,
  hasNewStaff: false,
  hasContract: false,
  hasExternalLease: false,
  hasPersonalInfo: false,
  isNewBusiness: false,
}

export function PlanReportFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY_FORM)
  const [departments, setDepartments] = useState<Department[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState('')

  useEffect(() => {
    // Load departments
    departmentApi
      .list()
      .then(depts => setDepartments(depts.map(d => ({ id: d.id, name: d.name }))))
      .catch(() => toast.error('부서 목록을 불러오지 못했습니다.'))
  }, [])

  useEffect(() => {
    if (isEdit) {
      planReportApi
        .get(Number(id))
        .then(p => {
          setForm({
            title: p.title,
            purpose: p.purpose,
            departmentId: p.departmentId,
            startDate: p.startDate.slice(0, 10),
            endDate: p.endDate.slice(0, 10),
            budget: p.budget,
            expectedEffect: p.expectedEffect,
            risks: p.risks,
            resultDueDate: p.resultDueDate.slice(0, 10),
            templateType: p.templateType,
            attachments: p.attachments,
            extraFields: (p.extraFields as Record<string, unknown>) ?? {},
            hasNewStaff: p.hasNewStaff,
            hasContract: p.hasContract,
            hasExternalLease: p.hasExternalLease,
            hasPersonalInfo: p.hasPersonalInfo,
            isNewBusiness: p.isNewBusiness,
          })
        })
        .catch(() => toast.error('계획보고서를 불러오지 못했습니다.'))
        .finally(() => setLoading(false))
    }
  }, [id, isEdit])

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const setExtra = (key: string, value: unknown) =>
    setForm(prev => ({ ...prev, extraFields: { ...prev.extraFields, [key]: value } }))

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await planReportApi.uploadFile(file)
      set('attachments', [...form.attachments, url])
      toast.success('파일이 업로드되었습니다.')
    } catch {
      toast.error('파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.title.trim()) {
      setError('사업명을 입력해주세요.')
      return
    }
    if (!form.purpose.trim()) {
      setError('추진 목적을 입력해주세요.')
      return
    }
    if (form.departmentId === 0) {
      setError('주관 부서를 선택해주세요.')
      return
    }
    if (!form.startDate) {
      setError('추진 시작일을 입력해주세요.')
      return
    }
    if (!form.endDate) {
      setError('추진 종료일을 입력해주세요.')
      return
    }
    if (form.budget <= 0) {
      setError('예산을 입력해주세요.')
      return
    }
    if (!form.expectedEffect.trim()) {
      setError('기대효과를 입력해주세요.')
      return
    }
    if (!form.risks.trim()) {
      setError('주요 리스크를 입력해주세요.')
      return
    }
    if (!form.resultDueDate) {
      setError('결과보고 예정일을 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const data = {
        ...form,
        extraFields: Object.keys(form.extraFields).length ? form.extraFields : undefined,
      }
      const plan = isEdit
        ? await planReportApi.update(Number(id), data)
        : await planReportApi.create(data)
      toast.success(isEdit ? '계획보고서가 수정되었습니다.' : '계획보고서가 작성되었습니다.')
      navigate(`/finance/plan-reports/${plan.id}`)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err?.response?.data?.error ?? '저장에 실패했습니다.')
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const extraFields = EXTRA_FIELDS_CONFIG[form.templateType]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">로드 중...</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">
        {isEdit ? '계획보고서 수정' : '계획보고서 작성'}
      </h1>

      {/* 공통 양식 */}
      <section className="space-y-4 rounded-lg border bg-card p-6 shadow">
        <h2 className="text-lg font-semibold">공통 양식</h2>

        <div>
          <label className="mb-2 block text-sm font-medium">사업명 *</label>
          <input
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="사업명을 입력하세요"
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">업무 유형 *</label>
          <Select
            value={form.templateType}
            onValueChange={v => {
              set('templateType', v as PlanTemplateType)
              set('extraFields', {})
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TEMPLATE_TYPE_LABELS) as PlanTemplateType[]).map(t => (
                <SelectItem key={t} value={t}>
                  {TEMPLATE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">추진 목적 *</label>
          <textarea
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
            placeholder="추진 목적을 입력하세요"
            value={form.purpose}
            onChange={e => set('purpose', e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">주관 부서 *</label>
          <Select
            value={String(form.departmentId)}
            onValueChange={v => set('departmentId', Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="부서를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {departments.map(d => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium">추진 시작일 *</label>
            <input
              type="date"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.startDate}
              onChange={e => set('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">추진 종료일 *</label>
            <input
              type="date"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.endDate}
              onChange={e => set('endDate', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">예산 (원) *</label>
          <input
            type="number"
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="0"
            value={form.budget}
            onChange={e => set('budget', Number(e.target.value))}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">기대효과 *</label>
          <textarea
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
            placeholder="기대효과를 입력하세요"
            value={form.expectedEffect}
            onChange={e => set('expectedEffect', e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">주요 리스크 *</label>
          <textarea
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
            placeholder="주요 리스크를 입력하세요"
            value={form.risks}
            onChange={e => set('risks', e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">결과보고 예정일 *</label>
          <input
            type="date"
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={form.resultDueDate}
            onChange={e => set('resultDueDate', e.target.value)}
          />
        </div>

        {/* 첨부자료 */}
        <div>
          <label className="mb-2 block text-sm font-medium">첨부자료</label>
          <div className="mb-2 flex gap-2">
            <input
              className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="URL 직접 입력"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (newUrl.trim()) {
                  set('attachments', [...form.attachments, newUrl.trim()])
                  setNewUrl('')
                }
              }}
            >
              추가
            </Button>
          </div>
          <input
            type="file"
            className="mb-2 w-full rounded border border-input px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-primary file:px-3 file:py-1 file:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          {form.attachments.map((a, i) => (
            <div key={i} className="mt-1 flex items-center gap-2 rounded bg-muted px-2 py-1 text-sm">
              <span className="flex-1 truncate text-xs">{a}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  set('attachments', form.attachments.filter((_, j) => j !== i))
                }
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 업무별 추가 양식 */}
      {extraFields.length > 0 && (
        <section className="space-y-4 rounded-lg border bg-card p-6 shadow">
          <h2 className="text-lg font-semibold">
            {TEMPLATE_TYPE_LABELS[form.templateType]} 추가 양식
          </h2>
          {extraFields.map(f => (
            <div key={f.key}>
              <label className="mb-2 block text-sm font-medium">{f.label}</label>
              <input
                type={f.type}
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={(form.extraFields[f.key] as string | number) ?? ''}
                onChange={e =>
                  setExtra(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)
                }
              />
            </div>
          ))}
        </section>
      )}

      {/* 조건부 결재 플래그 */}
      <section className="space-y-4 rounded-lg border bg-card p-6 shadow">
        <h2 className="text-lg font-semibold">조건 확인 (결재선 자동 설정)</h2>
        <div className="space-y-3">
          {[
            {
              key: 'hasNewStaff',
              label: '신규 인력 채용이 포함됩니까? (HR 협조)',
            },
            {
              key: 'hasContract',
              label: '외부 계약이 포함됩니까? (구매·법무 협조)',
            },
            {
              key: 'hasExternalLease',
              label: '외부 임대가 포함됩니까? (시설·법무 협조)',
            },
            {
              key: 'hasPersonalInfo',
              label: '개인정보·선수 초상권이 포함됩니까? (법무·개인정보 협조)',
            },
            {
              key: 'isNewBusiness',
              label: '신규 사업입니까? (구단주 승인 필요)',
            },
          ].map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-input accent-primary"
                checked={form[key as keyof typeof EMPTY_FORM] as boolean}
                onChange={e => set(key as keyof typeof EMPTY_FORM, e.target.checked as any)}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  )
}
