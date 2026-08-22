import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { budgetControlApi } from '@/services/budgetControl.service'
import { seasonApi } from '@/services/season.service'
import type { BudgetHeaderSummary, BudgetStatus } from '@/types/budget-control'
import type { Season } from '@/types/season'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Plus } from 'lucide-react'

const STATUS_VARIANT: Record<BudgetStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline', SUBMITTED: 'secondary', APPROVED: 'default', LOCKED: 'destructive',
}

function CreateBudgetDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void
}) {
  const { t } = useTranslation('finance')
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonId, setSeasonId] = useState('')
  const [name, setName] = useState('')
  const [totalBudget, setTotalBudget] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) seasonApi.list().then(setSeasons).catch(() => {})
  }, [open])

  const handleSubmit = async () => {
    if (!seasonId || !name || !totalBudget) { toast.error(t('budget.requiredFields')); return }
    setSaving(true)
    try {
      await budgetControlApi.create({
        seasonId: Number(seasonId),
        name,
        totalBudget: Number(totalBudget.replace(/,/g, '')),
      })
      toast.success(t('budget.registered'))
      onCreated()
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('budget.registerFailed'))
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('budget.compose')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('budget.fields.season')}</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue placeholder={t('budget.dialog.seasonSelect')} /></SelectTrigger>
              <SelectContent>
                {seasons.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('budget.fields.name')}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('budget.dialog.namePlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('budget.fields.totalApproved')}</Label>
            <Input
              inputMode="numeric"
              value={totalBudget ? Number(totalBudget.replace(/,/g, '')).toLocaleString('ko-KR') : ''}
              onChange={e => setTotalBudget(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t('budget.dialog.amountPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('budget.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? t('budget.composing') : t('budget.register')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function BudgetListPage() {
  const { t } = useTranslation('finance')
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [budgets, setBudgets] = useState<BudgetHeaderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'FINANCE_MANAGER')

  const load = () => {
    setLoading(true)
    budgetControlApi.getAll()
      .then(setBudgets)
      .catch(() => toast.error(t('budget.errors.loadFailed')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('budget.title')}</h1>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/finance/budget/auto')}>
              자동 산출
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />{t('budget.compose')}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t('budget.loading')}</p>
      ) : (
        <div className="space-y-2">
          {budgets.map(b => (
            <div
              key={b.id}
              className="border rounded-lg p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30"
              onClick={() => navigate(`/finance/budget/${b.id}`)}
            >
              <div className="flex-1">
                <p className="font-medium">{b.name}</p>
                <p className="text-sm text-muted-foreground">
                  {b.season.name} · v{b.version} · {b.totalBudget.toLocaleString()}원 · {b.createdBy.username}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[b.status]}>{t(`budget.status.${b.status}`)}</Badge>
            </div>
          ))}
          {budgets.length === 0 && <p className="text-muted-foreground">{t('budget.empty')}</p>}
        </div>
      )}

      {canWrite && (
        <CreateBudgetDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      )}
    </div>
  )
}
