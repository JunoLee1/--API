import { useEffect, useState, type ComponentProps } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { budgetPlanApi } from '@/services/financial-report.service'
import { seasonApi } from '@/services/season.service'
import type { BudgetPlan, UpsertBudgetPlanPayload, OperatingCategory } from '@/types/budget'
import { useExpenseCategories } from '@/hooks/useExpenseCategories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

interface TierRow { name: string; cost: string; value: string }
interface CategoryRow { mandatoryMinimum: string; tiers: TierRow[] }

const defaultTiers = (): TierRow[] => [
  { name: 'Basic', cost: '', value: '' },
  { name: 'Standard', cost: '', value: '' },
  { name: 'Premium', cost: '', value: '' },
]

const buildDefaultCategories = (codes: string[]): Record<OperatingCategory, CategoryRow> =>
  Object.fromEntries(
    codes.map((c) => [c, { mandatoryMinimum: '', tiers: defaultTiers() }])
  ) as Record<OperatingCategory, CategoryRow>

type CurrencyInputProps = Omit<ComponentProps<typeof Input>, 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

function CurrencyInput({ value, onChange, type = 'text', ...props }: CurrencyInputProps) {
  return (
    <Input
      type={type}
      {...props}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function BudgetPlanPage() {
  const { t } = useTranslation('admin')
  const { rows: allCategories, labelOf, loading: catLoading } = useExpenseCategories()
  const catCodes = allCategories.map((c) => c.code)

  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [plan, setPlan] = useState<BudgetPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [optimizing, setOptimizing] = useState(false)

  const [totalBudget, setTotalBudget] = useState('')
  const [contingency, setContingency] = useState('')
  const [playerSalaryBudget, setPlayerSalaryBudget] = useState('')
  const [categories, setCategories] = useState<Record<OperatingCategory, CategoryRow>>({} as Record<OperatingCategory, CategoryRow>)

  const [overrideCategory, setOverrideCategory] = useState<OperatingCategory>('TRAVEL')
  const [overrideAmount, setOverrideAmount] = useState('')
  const [overrideReason, setOverrideReason] = useState('')

  const [autoGenDialog, setAutoGenDialog] = useState<'closed' | 'confirm' | 'form'>('closed')
  const [autoGenRate, setAutoGenRate] = useState('10')
  const [autoGenContingency, setAutoGenContingency] = useState('0')
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [zeroWarnings, setZeroWarnings] = useState<string[]>([])

  useEffect(() => {
    if (catLoading || catCodes.length === 0) return
    void (async () => {
      try {
        const season = await seasonApi.active()
        if (!season) { setLoading(false); return }
        setSeasonId(season.id)
        const p = await budgetPlanApi.get(season.id).catch(() => null)
        const newCats = buildDefaultCategories(catCodes)
        if (p) {
          setPlan(p)
          setTotalBudget(p.totalOperatingBudget?.toString() ?? '')
          setContingency(p.contingencyReserve?.toString() ?? '0')
          setPlayerSalaryBudget(p.playerSalaryBudget?.toString() ?? '')
          for (const cp of p.budgetCategoryPlans) {
            newCats[cp.category] = {
              mandatoryMinimum: cp.mandatoryMinimum.toString(),
              tiers: cp.tiers.length > 0
                ? cp.tiers.map((tier) => ({ name: tier.name, cost: tier.cost.toString(), value: tier.value.toString() }))
                : defaultTiers(),
            }
          }
        }
        setCategories(newCats)
      } catch { toast.error(t('budget.loadFailed')) }
      finally { setLoading(false) }
    })()
  }, [catLoading, catCodes.length])

  const discretionaryPool = () => {
    const total = parseInt(totalBudget, 10) || 0
    const cont = parseInt(contingency, 10) || 0
    const mandatory = catCodes.reduce(
      (s, c) => s + (parseInt(categories[c]?.mandatoryMinimum ?? '', 10) || 0), 0
    )
    return total - cont - mandatory
  }

  const handleSave = async () => {
    if (!seasonId) return
    setSaving(true)
    try {
      const psb = parseInt(playerSalaryBudget, 10)
      const payload: UpsertBudgetPlanPayload = {
        totalOperatingBudget: parseInt(totalBudget, 10),
        contingencyReserve: parseInt(contingency, 10) || 0,
        playerSalaryBudget: isNaN(psb) ? undefined : psb,
        categories: catCodes.map((cat) => ({
          category: cat,
          mandatoryMinimum: parseInt(categories[cat]?.mandatoryMinimum ?? '', 10) || 0,
          tiers: (categories[cat]?.tiers ?? [])
            .filter((tier) => tier.cost && tier.value)
            .map((tier) => ({ name: tier.name, cost: parseInt(tier.cost, 10), value: parseInt(tier.value, 10) })),
        })),
      }
      const p = await budgetPlanApi.save(seasonId, payload)
      setPlan(p)
      toast.success(t('budget.saved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('budget.saveFailed'))
    } finally { setSaving(false) }
  }

  const handleOptimize = async () => {
    if (!seasonId) return
    setOptimizing(true)
    try {
      await budgetPlanApi.optimize(seasonId)
      const p = await budgetPlanApi.get(seasonId)
      setPlan(p)
      toast.success(t('budget.optimized'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('budget.optimizeFailed'))
    } finally { setOptimizing(false) }
  }

  const handleOverride = async () => {
    if (!seasonId) return
    try {
      await budgetPlanApi.addOverride(seasonId, {
        category: overrideCategory,
        amount: parseInt(overrideAmount, 10),
        reason: overrideReason,
      })
      const p = await budgetPlanApi.get(seasonId)
      setPlan(p)
      setOverrideAmount('')
      setOverrideReason('')
      toast.success(t('budget.overrideLogged'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('budget.overrideFailed'))
    }
  }

  const handleAutoGenerate = async () => {
    if (!seasonId) return
    setAutoGenerating(true)
    try {
      const result = await budgetPlanApi.autoGenerate(seasonId, {
        growthRate: parseFloat(autoGenRate) / 100,
        contingencyRate: parseFloat(autoGenContingency) / 100 || undefined,
      })
      setZeroWarnings(result.zeroCategories)
      const p = await budgetPlanApi.get(seasonId)
      setPlan(p)
      setTotalBudget(p.totalOperatingBudget?.toString() ?? '')
      setContingency(p.contingencyReserve?.toString() ?? '0')
      setPlayerSalaryBudget(p.playerSalaryBudget?.toString() ?? '')
      const newCats = buildDefaultCategories(catCodes)
      for (const cp of p.budgetCategoryPlans) {
        newCats[cp.category] = {
          mandatoryMinimum: cp.mandatoryMinimum.toString(),
          tiers: cp.tiers.length > 0
            ? cp.tiers.map((tier) => ({ name: tier.name, cost: tier.cost.toString(), value: tier.value.toString() }))
            : defaultTiers(),
        }
      }
      setCategories(newCats)
      setAutoGenDialog('closed')
      toast.success(t('budget.autoGenerated'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('budget.autoGenerateFailed'))
    } finally { setAutoGenerating(false) }
  }

  const updateTier = (cat: OperatingCategory, i: number, field: keyof TierRow, val: string) => {
    setCategories((prev) => {
      const next = { ...prev }
      const tiers = [...next[cat].tiers]
      tiers[i] = { ...tiers[i], [field]: val }
      next[cat] = { ...next[cat], tiers }
      return next
    })
  }

  if (loading) return (
    <div className="p-6 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  )
  if (!seasonId) return <div className="p-6 text-sm text-muted-foreground">{t('budget.noActiveSeason')}</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">{t('budget.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('budget.subtitle')}</p>
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAutoGenDialog(plan ? 'confirm' : 'form')}
          >
            {t('budget.autoGenerate')}
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 space-y-6 max-w-4xl">
        {zeroWarnings.length > 0 && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-2 text-sm text-yellow-800">
            {t('budget.zeroCategoriesWarning')}{' '}
            {zeroWarnings.map((c) => labelOf(c)).join(', ')}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t('budget.totalSection')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('budget.totalOperatingBudget')}</Label>
              <CurrencyInput value={totalBudget} onChange={setTotalBudget} placeholder="50,000,000" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('budget.contingencyReserve')}</Label>
              <CurrencyInput value={contingency} onChange={setContingency} placeholder="5,000,000" />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('budget.discretionaryPool')}:{' '}
            <span className={`font-semibold ${discretionaryPool() < 0 ? 'text-destructive' : 'text-primary'}`}>
              {fmt(discretionaryPool())}
            </span>
          </div>
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('budget.playerSalaryBudget')}</Label>
              {plan?.actuals?.['PLAYER_SALARY'] != null && (
                <Badge variant="outline" className="text-xs">
                  {t('budget.actual')}: {fmt(plan.actuals['PLAYER_SALARY'])}
                  {playerSalaryBudget && !isNaN(parseInt(playerSalaryBudget, 10)) && (
                    <span className={`ml-1 ${plan.actuals['PLAYER_SALARY'] > parseInt(playerSalaryBudget, 10) ? 'text-destructive' : 'text-green-600'}`}>
                      {plan.actuals['PLAYER_SALARY'] > parseInt(playerSalaryBudget, 10) ? '▲' : '▼'}{' '}
                      {fmt(Math.abs(plan.actuals['PLAYER_SALARY'] - parseInt(playerSalaryBudget, 10)))}
                    </span>
                  )}
                </Badge>
              )}
            </div>
            <CurrencyInput value={playerSalaryBudget} onChange={setPlayerSalaryBudget} placeholder="0" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold">{t('budget.categoriesSection')}</h2>
          {catCodes.map((cat) => {
            const catPlan = plan?.budgetCategoryPlans.find((c) => c.category === cat)
            const actual = plan?.actuals?.[cat] ?? 0
            const catRow = categories[cat] ?? { mandatoryMinimum: '', tiers: defaultTiers() }
            return (
              <div key={cat} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{labelOf(cat)}</span>
                  {catPlan?.knapsackAllocated != null && (
                    <Badge variant="outline" className="text-xs">
                      배분: {fmt(catPlan.knapsackAllocated)} | 실적: {fmt(actual)}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('budget.mandatoryMinimum')}</Label>
                  <CurrencyInput
                    className="h-7 text-sm"
                    value={catRow.mandatoryMinimum}
                    onChange={(v) => setCategories((p) => ({ ...p, [cat]: { ...(p[cat] ?? { tiers: defaultTiers() }), mandatoryMinimum: v } }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('budget.tiers')}</Label>
                  {catRow.tiers.map((tier, i) => {
                    const planTier = catPlan?.tiers[i]
                    return (
                      <div key={i} className={`grid grid-cols-3 gap-2 p-2 rounded ${planTier?.isSelected ? 'bg-primary/10 border border-primary/30' : ''}`}>
                        <Input className="h-7 text-xs" value={tier.name} onChange={(e) => updateTier(cat, i, 'name', e.target.value)} placeholder="Basic" />
                        <CurrencyInput className="h-7 text-xs" value={tier.cost} onChange={(v) => updateTier(cat, i, 'cost', v)} placeholder="비용(원)" />
                        <Input className="h-7 text-xs" type="number" value={tier.value} onChange={(e) => updateTier(cat, i, 'value', e.target.value)} placeholder="가치점수" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>{saving ? t('budget.saving') : t('budget.save')}</Button>
          <Button variant="outline" onClick={handleOptimize} disabled={optimizing}>
            {optimizing ? t('budget.optimizing') : t('budget.optimize')}
          </Button>
        </div>

        <section className="space-y-3 border-t pt-4">
          <h2 className="text-sm font-semibold">{t('budget.overrideSection')}</h2>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={overrideCategory}
              onChange={(e) => setOverrideCategory(e.target.value as OperatingCategory)}
            >
              {allCategories.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <CurrencyInput placeholder={t('budget.overrideAmount')} value={overrideAmount} onChange={setOverrideAmount} />
            <Input placeholder={t('budget.overrideReason')} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={handleOverride}>{t('budget.logOverride')}</Button>

          {(plan?.overrideLogs ?? []).length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t('budget.col.category')}</TableHead>
                  <TableHead className="text-xs">{t('budget.col.amount')}</TableHead>
                  <TableHead className="text-xs">{t('budget.col.reason')}</TableHead>
                  <TableHead className="text-xs">{t('budget.col.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan!.overrideLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{labelOf(log.category)}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmt(log.amount)}</TableCell>
                    <TableCell className="text-xs">{log.reason}</TableCell>
                    <TableCell className="text-xs tabular-nums">{new Date(log.createdAt).toLocaleDateString('ko-KR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      {/* 덮어쓰기 확인 다이얼로그 */}
      <Dialog open={autoGenDialog === 'confirm'} onOpenChange={(o) => !o && setAutoGenDialog('closed')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('budget.autoGenerateConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('budget.autoGenerateConfirmDesc')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoGenDialog('closed')}>{t('budget.autoGenerateCancel')}</Button>
            <Button onClick={() => setAutoGenDialog('form')}>{t('budget.autoGenerateConfirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 파라미터 입력 다이얼로그 */}
      <Dialog open={autoGenDialog === 'form'} onOpenChange={(o) => !o && setAutoGenDialog('closed')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('budget.autoGenerate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('budget.growthRate')}</Label>
              <CurrencyInput value={autoGenRate} onChange={setAutoGenRate} placeholder="10" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('budget.contingencyRateLabel')}</Label>
              <CurrencyInput value={autoGenContingency} onChange={setAutoGenContingency} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoGenDialog('closed')}>{t('budget.autoGenerateCancel')}</Button>
            <Button onClick={handleAutoGenerate} disabled={autoGenerating}>
              {autoGenerating ? t('budget.autoGenerating') : t('budget.autoGenerate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
