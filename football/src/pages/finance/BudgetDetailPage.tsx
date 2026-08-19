import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { budgetControlApi } from '@/services/budgetControl.service'
import type { BudgetHeader, BudgetLine, AvailableBudget, BudgetStatus, AdjustmentType } from '@/types/budget-control'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ArrowLeft, Plus } from 'lucide-react'

function AddLineDialog({ headerId, open, onOpenChange, onAdded }: {
  headerId: number; open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void
}) {
  const { t } = useTranslation('finance')
  const [category, setCategory] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!category || !year || !amount) { toast.error(t('budget.line.requiredFields')); return }
    setSaving(true)
    try {
      await budgetControlApi.addLine(headerId, {
        category,
        year: Number(year),
        month: month ? Number(month) : undefined,
        originalAmount: Number(amount.replace(/,/g, '')),
        note: note || undefined,
      })
      toast.success(t('budget.line.added'))
      onAdded()
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('budget.line.addFailed'))
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('budget.line.addDialog')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('budget.line.category')}</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder={t('budget.line.categoryPlaceholder')} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>{t('budget.line.year')}</Label>
              <Input type="number" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>{t('budget.line.month')}</Label>
              <Input type="number" value={month} onChange={e => setMonth(e.target.value)} min={1} max={12} placeholder={t('budget.line.monthAll')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('budget.line.amount')}</Label>
            <Input
              inputMode="numeric"
              value={amount ? Number(amount.replace(/,/g, '')).toLocaleString('ko-KR') : ''}
              onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t('budget.line.amountPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('budget.line.note')}</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('budget.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? t('budget.line.adding') : t('budget.line.add2')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function BudgetDetailPage() {
  const { t } = useTranslation('finance')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [header, setHeader] = useState<BudgetHeader | null>(null)
  const [available, setAvailable] = useState<AvailableBudget | null>(null)
  const [loading, setLoading] = useState(true)
  const [addLineOpen, setAddLineOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'FINANCE_MANAGER')

  const isDraft = header?.status === 'DRAFT'

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [h, av] = await Promise.all([
        budgetControlApi.getById(Number(id)),
        budgetControlApi.getAvailable(Number(id)),
      ])
      setHeader(h)
      setAvailable(av)
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [id])

  const handleSubmit = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      await budgetControlApi.submit(Number(id))
      toast.success(t('budget.approval.requested'))
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('budget.failed'))
    } finally { setSubmitting(false) }
  }

  const handleApprove = async () => {
    if (!id) return
    try {
      await budgetControlApi.approve(Number(id))
      toast.success(t('budget.approval.confirmed'))
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('budget.failed'))
    }
  }

  const handleDeleteLine = async (line: BudgetLine) => {
    if (!id || !confirm(`"${line.category}" ${t('budget.line.deleteConfirm')}`)) return
    try {
      await budgetControlApi.deleteLine(Number(id), line.id)
      toast.success(t('budget.line.deleted'))
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('budget.line.deleteFailed'))
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">{t('budget.loading')}</div>
  if (!header) return <div className="p-6 text-muted-foreground">{t('budget.notFound')}</div>

  const statusLabel = (s: BudgetStatus) => t(`budget.status.${s}`)
  const adjLabel = (type: AdjustmentType) => t(`budget.adjustment.type.${type}`)

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/finance/budget')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{header.name}</h1>
            <Badge variant="outline">{statusLabel(header.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {header.season.name} · v{header.version} · {t('budget.fields.total')} {header.totalBudget.toLocaleString()}원
          </p>
        </div>
        <div className="flex gap-2">
          {canWrite && isDraft && (
            <Button size="sm" variant="outline" onClick={handleSubmit} disabled={submitting}>
              {t('budget.approval.request')}
            </Button>
          )}
          {canWrite && header.status === 'SUBMITTED' && (
            <Button size="sm" onClick={handleApprove}>{t('budget.approval.confirm')}</Button>
          )}
        </div>
      </div>

      {/* 가용예산 요약 */}
      {available && (
        <div className="border rounded-lg p-4 bg-muted/20">
          <h2 className="text-sm font-semibold mb-3">{t('budget.available.title')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-muted-foreground">{t('budget.available.approved')}</p><p className="font-medium">{available.approvedBudget.toLocaleString()}원</p></div>
            <div><p className="text-muted-foreground">{t('budget.available.carryoverIncrease')}</p><p className="font-medium text-green-600">+{(available.carryover + available.increase).toLocaleString()}원</p></div>
            <div><p className="text-muted-foreground">{t('budget.available.decreaseCommitment')}</p><p className="font-medium text-red-500">−{(available.decrease + available.commitment + available.actual).toLocaleString()}원</p></div>
            <div><p className="text-muted-foreground font-semibold">{t('budget.available.available')}</p><p className="text-lg font-bold">{available.available.toLocaleString()}원</p></div>
          </div>
        </div>
      )}

      {/* 예산 라인 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{t('budget.line.title')}</h2>
          {canWrite && isDraft && (
            <Button size="sm" onClick={() => setAddLineOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />{t('budget.line.add')}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {header.lines.map(line => (
            <div key={line.id} className="border rounded p-3 flex items-center gap-3">
              <div className="flex-1">
                <span className="font-medium text-sm">{line.category}</span>
                <span className="text-muted-foreground text-xs ml-2">
                  {t('budget.line.yearFormat', { year: line.year })} {line.month ? t('budget.line.monthFormat', { month: line.month }) : t('budget.line.annual')}
                  {line.department ? ` · ${line.department.name}` : ''}
                </span>
              </div>
              <span className="font-medium text-sm">{line.originalAmount.toLocaleString()}원</span>
              {canWrite && isDraft && (
                <Button size="sm" variant="ghost" onClick={() => handleDeleteLine(line)} className="text-destructive hover:text-destructive">{t('budget.line.delete')}</Button>
              )}
            </div>
          ))}
          {header.lines.length === 0 && <p className="text-sm text-muted-foreground">{t('budget.line.empty')}</p>}
        </div>
      </div>

      {/* 조정 이력 */}
      <div>
        <h2 className="font-semibold mb-3">{t('budget.adjustment.title')}</h2>
        <div className="space-y-2">
          {header.adjustments.map(adj => (
            <div key={adj.id} className="border rounded p-3 flex items-center gap-3 text-sm">
              <Badge variant="outline">{adjLabel(adj.type)}</Badge>
              <span className="flex-1">{adj.reason}</span>
              <span className="font-medium">{adj.amount.toLocaleString()}원</span>
              <Badge variant={adj.status === 'APPROVED' ? 'default' : adj.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                {t(`budget.adjustment.status.${adj.status}`)}
              </Badge>
              {canWrite && adj.status === 'PENDING' && (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => budgetControlApi.approveAdjustment(header.id, adj.id).then(() => load()).catch(() => toast.error(t('budget.adjustment.approveFailed')))}>{t('budget.adjustment.approve')}</Button>
                  <Button size="sm" variant="outline" onClick={() => budgetControlApi.rejectAdjustment(header.id, adj.id).then(() => load()).catch(() => toast.error(t('budget.adjustment.rejectFailed')))}>{t('budget.adjustment.reject')}</Button>
                </div>
              )}
            </div>
          ))}
          {header.adjustments.length === 0 && <p className="text-sm text-muted-foreground">{t('budget.adjustment.empty')}</p>}
        </div>
      </div>

      {canWrite && isDraft && (
        <AddLineDialog headerId={header.id} open={addLineOpen} onOpenChange={setAddLineOpen} onAdded={load} />
      )}
    </div>
  )
}
