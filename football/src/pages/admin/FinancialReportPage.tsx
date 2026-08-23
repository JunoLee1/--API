import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { financialReportApi, type FinancialReport } from '@/services/financial-report.service'
import { seasonApi } from '@/services/season.service'
import type { WageCapKPI } from '@/types/season'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AvailableBudgetCard } from '@/components/finance/AvailableBudgetCard'
import { CarryOverOverrideDialog } from '@/components/finance/CarryOverOverrideDialog'
import { useCurrentUser } from '@/hooks/useCurrentUser'

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

/**
 * Mirrors the backend's canWriteFinance predicate — Admin-like roles plus
 * the FINANCE_MANAGER front-office role can mutate financial data (including
 * the manual carryover override).
 */
function canWriteFinance(role: string, foRole: string | null | undefined): boolean {
  return (
    role === 'ADMIN' ||
    role === 'CLUB_ADMIN' ||
    (role === 'FRONT_OFFICE' && foRole === 'FINANCE_MANAGER')
  )
}

export function FinancialReportPage() {
  const { t } = useTranslation('admin')
  const { user } = useCurrentUser()
  const [activeSeason, setActiveSeason] = useState<{ id: number; name: string } | null>(null)
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [kpi, setKpi] = useState<WageCapKPI | null>(null)
  const [revenue, setRevenue] = useState('')
  const [note, setNote] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)

  const canWrite = user ? canWriteFinance(user.role, user.frontOfficeRole) : false

  const fetchAll = async () => {
    try {
      const season = await seasonApi.active()
      if (!season) { setActiveSeason(null); return }
      setActiveSeason(season)
      const [rep, k] = await Promise.allSettled([
        financialReportApi.get(season.id),
        seasonApi.getWageCapKPI(),
      ])
      setReport(rep.status === 'fulfilled' ? rep.value : null)
      setKpi(k.status === 'fulfilled' ? k.value : null)
      if (rep.status === 'fulfilled') setRevenue(rep.value.totalRevenue.toString())
    } catch {
      toast.error(t('financialReport.loadFailed'))
    }
  }

  useEffect(() => { void fetchAll() }, [])

  const handleManualSave = async () => {
    if (!activeSeason) return
    const totalRevenue = parseInt(revenue, 10)
    if (isNaN(totalRevenue) || totalRevenue <= 0) {
      toast.error(t('financialReport.invalidRevenue'))
      return
    }
    setSaving(true)
    try {
      await financialReportApi.set(activeSeason.id, { totalRevenue, note: note || undefined })
      toast.success(t('financialReport.saved'))
      void fetchAll()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('financialReport.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleAutoFill = async () => {
    if (!activeSeason) return
    setAutoFilling(true)
    try {
      const report = await financialReportApi.autoFillRevenue(activeSeason.id)
      setRevenue(report.totalRevenue.toString())
      toast.success(t('financialReport.autoFilled'))
      void fetchAll()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('PREV_SEASON_NOT_FOUND')) {
        toast.error(t('financialReport.noPrevSeason'))
      } else {
        toast.error(t('financialReport.autoFillFailed'))
      }
    } finally {
      setAutoFilling(false)
    }
  }

  const handleCSVUpload = async () => {
    if (!activeSeason || !csvFile) return
    setSaving(true)
    try {
      await financialReportApi.uploadCSV(activeSeason.id, csvFile, note || undefined)
      toast.success(t('financialReport.csvSaved'))
      setCsvFile(null)
      void fetchAll()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('financialReport.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleOverrideSubmit = async (amount: number, reason: string) => {
    if (!activeSeason) return
    try {
      await financialReportApi.overrideCarryOver(activeSeason.id, { amount, reason })
      toast.success('이월금이 수동 조정되었습니다')
      void fetchAll()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '이월금 조정 실패')
      throw err
    }
  }

  if (!activeSeason) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">{t('financialReport.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('financialReport.noActiveSeason')}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold">{t('financialReport.title')} — {activeSeason.name}</h1>

      {kpi && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t('financialReport.kpi.totalPayroll'), value: fmt(kpi.totalPayroll) },
            { label: t('financialReport.kpi.cap'), value: kpi.cap != null ? fmt(kpi.cap) : '-' },
            { label: t('financialReport.kpi.percentUsed'), value: kpi.percentUsed != null ? `${kpi.percentUsed}%` : '-' },
            { label: t('financialReport.kpi.remaining'), value: kpi.remaining != null ? fmt(kpi.remaining) : '-' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border p-3 space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {kpi && (
        <AvailableBudgetCard
          kpi={kpi}
          showOverrideButton={canWrite}
          onOverride={() => setOverrideDialogOpen(true)}
        />
      )}

      <CarryOverOverrideDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        currentAmount={kpi?.carryOverFromPrev?.amount ?? 0}
        onSubmit={handleOverrideSubmit}
      />

      <div className="space-y-3 border rounded-lg p-4">
        <h2 className="text-sm font-semibold">{t('financialReport.autoFillTitle')}</h2>
        <p className="text-xs text-muted-foreground">{t('financialReport.autoFillHint')}</p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void handleAutoFill()}
          disabled={autoFilling || saving}
        >
          {autoFilling ? t('financialReport.autoFilling') : t('financialReport.autoFill')}
        </Button>
      </div>

      <div className="space-y-3 border rounded-lg p-4">
        <h2 className="text-sm font-semibold">{t('financialReport.manualEntry')}</h2>
        {report && (
          <p className="text-xs text-muted-foreground">
            {t('financialReport.lastUpdated', { date: new Date(report.updatedAt).toLocaleDateString('ko-KR') })}
          </p>
        )}
        <div className="space-y-1.5">
          <Label>{t('financialReport.totalRevenue')}</Label>
          <Input type="number" min={1} value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="1000000000" />
        </div>
        <div className="space-y-1.5">
          <Label>{t('financialReport.note')}</Label>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('financialReport.notePlaceholder')} />
        </div>
        <Button onClick={() => void handleManualSave()} disabled={saving} className="w-full">
          {t('financialReport.save')}
        </Button>
      </div>

      <div className="space-y-3 border rounded-lg p-4">
        <h2 className="text-sm font-semibold">{t('financialReport.csvUpload')}</h2>
        <p className="text-xs text-muted-foreground">{t('financialReport.csvHint')}</p>
        <div className="space-y-1.5">
          <Label>{t('financialReport.csvFile')}</Label>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button
          onClick={() => void handleCSVUpload()}
          disabled={saving || !csvFile}
          variant="outline"
          className="w-full"
        >
          {t('financialReport.csvSubmit')}
        </Button>
      </div>
    </div>
  )
}
