import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { budgetPlanApi } from '@/services/financial-report.service'
import { seasonApi } from '@/services/season.service'
import type { BudgetPlan, UpsertBudgetPlanPayload, OperatingCategory } from '@/types/budget'
import { ALL_OPERATING_CATEGORIES, OPERATING_CATEGORY_LABEL } from '@/types/budget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const defaultCategories = () =>
  Object.fromEntries(
    ALL_OPERATING_CATEGORIES.map((c) => [c, { mandatoryMinimum: '', tiers: defaultTiers() }])
  ) as Record<OperatingCategory, CategoryRow>

export function BudgetPlanPage() {
  const { t } = useTranslation('admin')
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [plan, setPlan] = useState<BudgetPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [optimizing, setOptimizing] = useState(false)

  const [totalBudget, setTotalBudget] = useState('')
  const [contingency, setContingency] = useState('')
  const [categories, setCategories] = useState<Record<OperatingCategory, CategoryRow>>(defaultCategories)

  const [overrideCategory, setOverrideCategory] = useState<OperatingCategory>('TRAVEL')
  const [overrideAmount, setOverrideAmount] = useState('')
  const [overrideReason, setOverrideReason] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const season = await seasonApi.active()
        if (!season) { setLoading(false); return }
        setSeasonId(season.id)
        const p = await budgetPlanApi.get(season.id).catch(() => null)
        if (p) {
          setPlan(p)
          setTotalBudget(p.totalOperatingBudget?.toString() ?? '')
          setContingency(p.contingencyReserve?.toString() ?? '0')
          const newCats = defaultCategories()
          for (const cp of p.budgetCategoryPlans) {
            newCats[cp.category] = {
              mandatoryMinimum: cp.mandatoryMinimum.toString(),
              tiers: cp.tiers.length > 0
                ? cp.tiers.map((tier) => ({ name: tier.name, cost: tier.cost.toString(), value: tier.value.toString() }))
                : defaultTiers(),
            }
          }
          setCategories(newCats)
        }
      } catch { toast.error(t('budget.loadFailed')) }
      finally { setLoading(false) }
    })()
  }, [])

  const discretionaryPool = () => {
    const total = parseInt(totalBudget, 10) || 0
    const cont = parseInt(contingency, 10) || 0
    const mandatory = ALL_OPERATING_CATEGORIES.reduce(
      (s, c) => s + (parseInt(categories[c].mandatoryMinimum, 10) || 0), 0
    )
    return total - cont - mandatory
  }

  const handleSave = async () => {
    if (!seasonId) return
    setSaving(true)
    try {
      const payload: UpsertBudgetPlanPayload = {
        totalOperatingBudget: parseInt(totalBudget, 10),
        contingencyReserve: parseInt(contingency, 10) || 0,
        categories: ALL_OPERATING_CATEGORIES.map((cat) => ({
          category: cat,
          mandatoryMinimum: parseInt(categories[cat].mandatoryMinimum, 10) || 0,
          tiers: categories[cat].tiers
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
      </div>

      <div className="px-6 py-4 space-y-6 max-w-4xl">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t('budget.totalSection')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('budget.totalOperatingBudget')}</Label>
              <Input type="number" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="50000000" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('budget.contingencyReserve')}</Label>
              <Input type="number" value={contingency} onChange={(e) => setContingency(e.target.value)} placeholder="5000000" />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('budget.discretionaryPool')}:{' '}
            <span className={`font-semibold ${discretionaryPool() < 0 ? 'text-destructive' : 'text-primary'}`}>
              {fmt(discretionaryPool())}
            </span>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold">{t('budget.categoriesSection')}</h2>
          {ALL_OPERATING_CATEGORIES.map((cat) => {
            const catPlan = plan?.budgetCategoryPlans.find((c) => c.category === cat)
            const actual = plan?.actuals?.[cat] ?? 0
            return (
              <div key={cat} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{OPERATING_CATEGORY_LABEL[cat]}</span>
                  {catPlan?.knapsackAllocated != null && (
                    <Badge variant="outline" className="text-xs">
                      배분: {fmt(catPlan.knapsackAllocated)} | 실적: {fmt(actual)}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('budget.mandatoryMinimum')}</Label>
                  <Input
                    type="number"
                    className="h-7 text-sm"
                    value={categories[cat].mandatoryMinimum}
                    onChange={(e) => setCategories((p) => ({ ...p, [cat]: { ...p[cat], mandatoryMinimum: e.target.value } }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('budget.tiers')}</Label>
                  {categories[cat].tiers.map((tier, i) => {
                    const planTier = catPlan?.tiers[i]
                    return (
                      <div key={i} className={`grid grid-cols-3 gap-2 p-2 rounded ${planTier?.isSelected ? 'bg-primary/10 border border-primary/30' : ''}`}>
                        <Input className="h-7 text-xs" value={tier.name} onChange={(e) => updateTier(cat, i, 'name', e.target.value)} placeholder="Basic" />
                        <Input className="h-7 text-xs" type="number" value={tier.cost} onChange={(e) => updateTier(cat, i, 'cost', e.target.value)} placeholder="비용(원)" />
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
              {ALL_OPERATING_CATEGORIES.map((c) => (
                <option key={c} value={c}>{OPERATING_CATEGORY_LABEL[c]}</option>
              ))}
            </select>
            <Input type="number" placeholder={t('budget.overrideAmount')} value={overrideAmount} onChange={(e) => setOverrideAmount(e.target.value)} />
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
                    <TableCell className="text-xs">{OPERATING_CATEGORY_LABEL[log.category]}</TableCell>
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
    </div>
  )
}
