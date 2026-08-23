import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { operatingExpenseApi, EXPENSE_COST_TYPE_LABEL, ALL_EXPENSE_COST_TYPES, type ExpenseCostType } from '@/services/operating-expense.service'
import { seasonApi } from '@/services/season.service'
import type { OperatingExpense, OperatingCategory } from '@/types/budget'
import type { Season } from '@/types/season'
import { useExpenseCategories } from '@/hooks/useExpenseCategories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Trash2, Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export function OperatingExpensePage() {
  const { t } = useTranslation('admin')
  const { rows: allCategories, labelOf } = useExpenseCategories()
  const formCategories = allCategories.filter((c) => c.code !== 'MEDICAL')
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [expenses, setExpenses] = useState<OperatingExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    category: 'TRAVEL' as OperatingCategory,
    costType: 'VARIABLE' as ExpenseCostType,
    amount: '',
    date: '',
    note: '',
  })
  const [saving, setSaving] = useState(false)

  const load = async (sid: number) => {
    const list = await operatingExpenseApi.list(sid)
    setExpenses(list)
  }

  useEffect(() => {
    void (async () => {
      try {
        const [list, active] = await Promise.all([seasonApi.list(), seasonApi.active()])
        setSeasons(list)
        const defaultId = active?.id ?? list[0]?.id ?? null
        if (!defaultId) { setLoading(false); return }
        setSeasonId(defaultId)
        await load(defaultId)
      } catch { toast.error(t('operatingExpense.loadFailed')) }
      finally { setLoading(false) }
    })()
  }, [])

  const handleSeasonChange = async (id: number) => {
    setSeasonId(id)
    setLoading(true)
    try { await load(id) }
    catch { toast.error(t('operatingExpense.loadFailed')) }
    finally { setLoading(false) }
  }

  const handleCreate = async () => {
    if (!seasonId || !form.amount || !form.date) {
      toast.error(t('operatingExpense.required'))
      return
    }
    setSaving(true)
    try {
      await operatingExpenseApi.create({
        seasonId,
        category: form.category,
        costType: form.costType,
        amount: parseInt(form.amount, 10),
        date: form.date,
        note: form.note || undefined,
      })
      await load(seasonId)
      setCreateOpen(false)
      setForm({ category: 'TRAVEL', costType: 'VARIABLE', amount: '', date: '', note: '' })
      toast.success(t('operatingExpense.created'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('operatingExpense.createFailed'))
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!seasonId) return
    try {
      await operatingExpenseApi.delete(id)
      await load(seasonId)
      toast.success(t('operatingExpense.deleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('operatingExpense.deleteFailed'))
    }
  }

  if (loading) return (
    <div className="p-6 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  )
  if (seasons.length === 0) return <div className="p-6 text-sm text-muted-foreground">{t('operatingExpense.noActiveSeason')}</div>

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t('operatingExpense.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('operatingExpense.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2.5 py-1 text-sm bg-transparent"
            value={seasonId ?? ''}
            onChange={(e) => void handleSeasonChange(Number(e.target.value))}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />{t('operatingExpense.add')}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {expenses.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('operatingExpense.empty')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('operatingExpense.col.date')}</TableHead>
                <TableHead>{t('operatingExpense.col.category')}</TableHead>
                <TableHead>{t('operatingExpense.col.amount')}</TableHead>
                <TableHead>{t('operatingExpense.col.note')}</TableHead>
                <TableHead>{t('operatingExpense.col.by')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="tabular-nums text-sm">{new Date(e.date).toLocaleDateString('ko-KR')}</TableCell>
                  <TableCell className="text-sm">{labelOf(e.category)}</TableCell>
                  <TableCell className="tabular-nums font-medium text-sm">{fmt(e.amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.note ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.createdBy.username}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('operatingExpense.createTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t('operatingExpense.col.category')}</Label>
              <select
                className="w-full border rounded px-3 py-1.5 text-sm"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as OperatingCategory }))}
              >
                {formCategories.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>비용 성격</Label>
              <select
                className="w-full border rounded px-3 py-1.5 text-sm"
                value={form.costType}
                onChange={(e) => setForm((p) => ({ ...p, costType: e.target.value as ExpenseCostType }))}
              >
                {ALL_EXPENSE_COST_TYPES.map((t) => (
                  <option key={t} value={t}>{EXPENSE_COST_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('operatingExpense.col.amount')}</Label>
              <Input type="text" inputMode="numeric" value={form.amount ? Number(form.amount).toLocaleString('ko-KR') : ''} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="1,000,000" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('operatingExpense.col.date')}</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('operatingExpense.col.note')}</Label>
              <Input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder={t('operatingExpense.notePlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>{t('operatingExpense.cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? t('operatingExpense.saving') : t('operatingExpense.submit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
