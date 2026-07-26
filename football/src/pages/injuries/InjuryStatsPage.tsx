import { useEffect, useState } from 'react'
import { injuryApi } from '@/services/injury.service'
import { reportApi } from '@/services/report.service'
import { Skeleton } from '@/components/ui/skeleton'
import type { InjuryCause, BodyPart } from '@/types/injury'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ClipboardList } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Stats = {
  activeCount: number
  byBodyPart: Record<string, number>
  byCause: Record<string, number>
  avgRecoveryDays: number | null
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-right shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-sm text-right tabular-nums shrink-0">{count}</span>
    </div>
  )
}

export function InjuryStatsPage() {
  const { t } = useTranslation('medical')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user } = useCurrentUser()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const isMedical =
    user?.coachingRole === 'MEDICAL' || user?.coachingRole === 'MEDICAL_DIRECTOR'

  const resetForm = () => { setTitle(''); setContent('') }

  const insertStatsSnapshot = () => {
    if (!stats) return
    const bodyPartEntries = Object.entries(stats.byBodyPart).sort(([, a], [, b]) => b - a)
    const causeEntries = Object.entries(stats.byCause).sort(([, a], [, b]) => b - a)
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    const totalCount = bodyPartEntries.reduce((s, [, n]) => s + n, 0)

    const lines: string[] = [
      t('stats.snapshotHeader', { date: today }),
      t('stats.snapshotActive', { count: stats.activeCount }),
      stats.avgRecoveryDays != null
        ? t('stats.snapshotAvgRecovery', { days: stats.avgRecoveryDays })
        : t('stats.snapshotAvgRecoveryNone'),
      t('stats.snapshotTotal', { count: totalCount }),
    ]
    if (bodyPartEntries.length > 0) {
      lines.push('', t('stats.snapshotBodyPartHeader'))
      bodyPartEntries.forEach(([part, count]) => lines.push(t('stats.snapshotCount', { label: t(`injuries.bodyPart.${part as BodyPart}`), count })))
    }
    if (causeEntries.length > 0) {
      lines.push('', t('stats.snapshotCauseHeader'))
      causeEntries.forEach(([cause, count]) => {
        lines.push(t('stats.snapshotCount', { label: t(`injuries.cause.${cause as InjuryCause}`), count }))
      })
    }

    setContent((prev) => (prev ? prev + '\n\n' + lines.join('\n') : lines.join('\n')))
  }

  const handleSave = async (andSubmit: boolean) => {
    if (!title.trim()) { toast.error(t('report.titleRequired')); return }
    if (!content.trim()) { toast.error(t('report.contentRequired')); return }
    setSaving(true)
    try {
      const report = await reportApi.create({ type: 'MEDICAL', title: title.trim(), content: content.trim() })
      if (andSubmit) {
        await reportApi.submit(report.id)
        toast.success(t('report.submitted'))
      } else {
        toast.success(t('report.draftSaved'))
      }
      setSheetOpen(false)
      resetForm()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('report.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    injuryApi
      .stats()
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('stats.loadFailed')))
      .finally(() => setLoading(false))
  }, [])

  const bodyPartEntries = stats
    ? Object.entries(stats.byBodyPart).sort(([, a], [, b]) => b - a)
    : []
  const causeEntries = stats
    ? Object.entries(stats.byCause).sort(([, a], [, b]) => b - a)
    : []
  const maxBodyPart = bodyPartEntries[0]?.[1] ?? 1
  const maxCause = causeEntries[0]?.[1] ?? 1

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('stats.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('stats.subtitle')}</p>
        </div>
        {isMedical && (
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <ClipboardList className="h-4 w-4 mr-1" />{t('stats.writeReportBtn')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : stats ? (
          <div className="space-y-8 max-w-2xl">
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label={t('stats.activeInjuries')} value={stats.activeCount} sub={t('stats.activeSub')} />
              <StatCard
                label={t('stats.avgRecovery')}
                value={stats.avgRecoveryDays != null ? t('stats.avgRecoveryValue', { days: stats.avgRecoveryDays }) : '—'}
                sub={t('stats.avgRecoverySub')}
              />
              <StatCard
                label={t('stats.totalRecords')}
                value={bodyPartEntries.reduce((s, [, n]) => s + n, 0)}
                sub={t('stats.totalSub')}
              />
            </div>

            {/* 부위별 */}
            {bodyPartEntries.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">{t('stats.byBodyPart')}</h2>
                <div className="space-y-2">
                  {bodyPartEntries.map(([part, count]) => (
                    <BarRow key={part} label={t(`injuries.bodyPart.${part as BodyPart}`)} count={count} max={maxBodyPart} />
                  ))}
                </div>
              </div>
            )}

            {/* 원인별 */}
            {causeEntries.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">{t('stats.byCause')}</h2>
                <div className="space-y-2">
                  {causeEntries.map(([cause, count]) => (
                    <BarRow
                      key={cause}
                      label={t(`injuries.cause.${cause as InjuryCause}`)}
                      count={count}
                      max={maxCause}
                    />
                  ))}
                </div>
              </div>
            )}

            {bodyPartEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('stats.noData')}</p>
            )}
          </div>
        ) : null}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) resetForm() }}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('report.title')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>{t('report.titleLabel')}</Label>
              <Input
                placeholder={t('report.titlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t('report.contentLabel')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={insertStatsSnapshot}
                  disabled={!stats}
                >
                  {t('report.insertStats')}
                </Button>
              </div>
              <Textarea
                placeholder={t('report.contentPlaceholder')}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? t('report.saving') : t('report.saveDraft')}
              </Button>
              <Button className="flex-1" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? t('report.submitting') : t('report.submit')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
