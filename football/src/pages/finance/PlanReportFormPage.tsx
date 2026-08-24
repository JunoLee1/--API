import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { planReportApi } from '@/services/plan-report.service'
import { departmentApi } from '@/services/department.service'
import type { PlanTemplateType } from '@/types/plan-report'
import { TEMPLATE_TYPE_LABELS, EXTRA_FIELDS_CONFIG } from '@/types/plan-report'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

interface Dept { id: number; name: string }

const PLAN_TEMPLATE_TYPES: PlanTemplateType[] = ['GENERAL', 'HR', 'MARKETING', 'GOODS', 'SQUAD', 'MEDICAL', 'IT']

const EMPTY_FORM = {
  title: '', purpose: '', departmentId: 0, startDate: '', endDate: '',
  budget: '', expectedEffect: '', risks: '', resultDueDate: '',
  templateType: 'GENERAL' as PlanTemplateType,
  attachments: [] as string[],
  extraFields: {} as Record<string, unknown>,
  hasNewStaff: false, hasContract: false, hasExternalLease: false,
  hasPersonalInfo: false, isNewBusiness: false,
}

export function PlanReportFormPage() {
  const { t } = useTranslation('finance')
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY_FORM)
  const [departments, setDepartments] = useState<Dept[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    departmentApi.list().then(setDepartments)
    if (isEdit) {
      planReportApi.get(Number(id)).then(p => {
        setForm({
          title: p.title, purpose: p.purpose, departmentId: p.departmentId,
          startDate: p.startDate.slice(0, 10), endDate: p.endDate.slice(0, 10),
          budget: String(p.budget), expectedEffect: p.expectedEffect, risks: p.risks,
          resultDueDate: p.resultDueDate.slice(0, 10),
          templateType: p.templateType, attachments: p.attachments,
          extraFields: (p.extraFields as Record<string, unknown>) ?? {},
          hasNewStaff: p.hasNewStaff, hasContract: p.hasContract,
          hasExternalLease: p.hasExternalLease, hasPersonalInfo: p.hasPersonalInfo,
          isNewBusiness: p.isNewBusiness,
        })
      })
    }
  }, [id, isEdit])

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const setExtra = (key: string, value: unknown) =>
    setForm(prev => ({ ...prev, extraFields: { ...prev.extraFields, [key]: value } }))

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error(t('planReport.errors.titleRequired')); return }
    if (!form.departmentId) { toast.error(t('planReport.errors.departmentRequired')); return }
    setSaving(true)
    try {
      const data = {
        ...form,
        budget: Number(form.budget),
        extraFields: Object.keys(form.extraFields).length ? form.extraFields : undefined,
      }
      const plan = isEdit
        ? await planReportApi.update(Number(id), data)
        : await planReportApi.create(data)
      toast.success(isEdit ? t('planReport.actions.saved') : t('planReport.actions.created'))
      navigate(`/finance/plan-reports/${plan.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('planReport.actions.saveFailed'))
    } finally { setSaving(false) }
  }

  const extraFields = EXTRA_FIELDS_CONFIG[form.templateType]

  const CONDITIONS = [
    { key: 'hasNewStaff' as const, label: t('planReport.conditions.hasNewStaff') },
    { key: 'hasContract' as const, label: t('planReport.conditions.hasContract') },
    { key: 'hasExternalLease' as const, label: t('planReport.conditions.hasExternalLease') },
    { key: 'hasPersonalInfo' as const, label: t('planReport.conditions.hasPersonalInfo') },
    { key: 'isNewBusiness' as const, label: t('planReport.conditions.isNewBusiness') },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">{isEdit ? t('planReport.edit') : t('planReport.new')}</h1>
      </div>
      <div className="flex-1 overflow-auto px-6 py-6 space-y-6 max-w-2xl">
        <div className="space-y-1.5">
          <Label>{t('planReport.fields.title')}</Label>
          <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder={t('planReport.fields.titlePlaceholder')} />
        </div>

        <div className="space-y-1.5">
          <Label>{t('planReport.fields.type')}</Label>
          <Select value={form.templateType} onValueChange={v => { set('templateType', v as PlanTemplateType); set('extraFields', {}) }}>
            <SelectTrigger><SelectValue>{TEMPLATE_TYPE_LABELS[form.templateType]}</SelectValue></SelectTrigger>
            <SelectContent>
              {PLAN_TEMPLATE_TYPES.map(type => <SelectItem key={type} value={type} label={TEMPLATE_TYPE_LABELS[type]}>{TEMPLATE_TYPE_LABELS[type]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('planReport.fields.purpose')}</Label>
          <Textarea value={form.purpose} onChange={e => set('purpose', e.target.value)} rows={3} />
        </div>

        <div className="space-y-1.5">
          <Label>{t('planReport.fields.department')}</Label>
          <Select value={String(form.departmentId)} onValueChange={v => set('departmentId', Number(v))}>
            <SelectTrigger><SelectValue>{departments.find(d => d.id === form.departmentId)?.name || t('planReport.fields.departmentSelect')}</SelectValue></SelectTrigger>
            <SelectContent>
              {departments.map(d => <SelectItem key={d.id} value={String(d.id)} label={d.name}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t('planReport.fields.startDate')}</Label>
            <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('planReport.fields.endDate')}</Label>
            <Input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t('planReport.fields.budget')}</Label>
          <Input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder={t('planReport.fields.budgetPlaceholder')} />
        </div>

        <div className="space-y-1.5">
          <Label>{t('planReport.fields.expectedEffect')}</Label>
          <Textarea value={form.expectedEffect} onChange={e => set('expectedEffect', e.target.value)} rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label>{t('planReport.fields.risks')}</Label>
          <Textarea value={form.risks} onChange={e => set('risks', e.target.value)} rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label>{t('planReport.fields.resultDueDate')}</Label>
          <Input type="date" value={form.resultDueDate} onChange={e => set('resultDueDate', e.target.value)} />
        </div>

        {/* 업무별 추가 양식 */}
        {extraFields.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-3">{TEMPLATE_TYPE_LABELS[form.templateType]} {t('planReport.fields.extraInfo')}</p>
            <div className="space-y-3">
              {extraFields.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Input
                    type={f.type}
                    value={(form.extraFields[f.key] as string | number) ?? ''}
                    onChange={e => setExtra(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 첨부자료 */}
        <div className="pt-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('planReport.fields.attachmentsUrl')}</p>
          <div className="flex gap-2 mb-2">
            <Input className="flex-1" placeholder={t('planReport.attachments.urlPlaceholder')} value={newUrl} onChange={e => setNewUrl(e.target.value)} />
            <Button variant="outline" type="button" onClick={() => {
              if (newUrl.trim()) { set('attachments', [...form.attachments, newUrl.trim()]); setNewUrl('') }
            }}>{t('planReport.fields.attachmentsAdd')}</Button>
          </div>
          {form.attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 mt-1 text-sm">
              <span className="flex-1 truncate text-muted-foreground">{a}</span>
              <button type="button" className="text-destructive text-xs" onClick={() =>
                set('attachments', form.attachments.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>

        {/* 조건부 결재 */}
        <div className="pt-2">
          <p className="text-xs font-medium text-muted-foreground mb-3">{t('planReport.fields.approvalConditions')}</p>
          <div className="space-y-2">
            {CONDITIONS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox checked={form[key]} onCheckedChange={v => set(key, Boolean(v))} id={key} />
                <label htmlFor={key} className="text-sm cursor-pointer">{label}</label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>{t('planReport.actions.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t('planReport.actions.saving') : t('planReport.actions.save')}</Button>
        </div>
      </div>
    </div>
  )
}
