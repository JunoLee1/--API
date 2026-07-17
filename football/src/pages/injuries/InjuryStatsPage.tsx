import { useEffect, useState } from 'react'
import { injuryApi } from '@/services/injury.service'
import { reportApi } from '@/services/report.service'
import { Skeleton } from '@/components/ui/skeleton'
import { CAUSE_LABEL, BODY_PART_LABEL } from '@/types/injury'
import type { InjuryCause, BodyPart } from '@/types/injury'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ClipboardList } from 'lucide-react'

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
      `## 부상 현황 요약 (${today})`,
      `- 현재 활성 부상: ${stats.activeCount}건`,
      `- 평균 회복 기간: ${stats.avgRecoveryDays != null ? `${stats.avgRecoveryDays}일` : '데이터 없음'}`,
      `- 총 부상 기록: ${totalCount}건`,
    ]
    if (bodyPartEntries.length > 0) {
      lines.push('', '### 부상 부위별')
      bodyPartEntries.forEach(([part, count]) => lines.push(`- ${BODY_PART_LABEL[part as BodyPart] ?? part}: ${count}건`))
    }
    if (causeEntries.length > 0) {
      lines.push('', '### 발생 원인별')
      causeEntries.forEach(([cause, count]) => {
        const label = CAUSE_LABEL[cause as InjuryCause] ?? cause
        lines.push(`- ${label}: ${count}건`)
      })
    }

    setContent((prev) => (prev ? prev + '\n\n' + lines.join('\n') : lines.join('\n')))
  }

  const handleSave = async (andSubmit: boolean) => {
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return }
    if (!content.trim()) { toast.error('내용을 입력해주세요.'); return }
    setSaving(true)
    try {
      const report = await reportApi.create({ type: 'MEDICAL', title: title.trim(), content: content.trim() })
      if (andSubmit) {
        await reportApi.submit(report.id)
        toast.success('의무보고서가 상신됐습니다.')
      } else {
        toast.success('의무보고서 초안이 저장됐습니다.')
      }
      setSheetOpen(false)
      resetForm()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    injuryApi
      .stats()
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'))
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
          <h1 className="text-lg font-semibold tracking-tight">부상 통계</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 부상 이력 집계</p>
        </div>
        {isMedical && (
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <ClipboardList className="h-4 w-4 mr-1" />의무보고서 작성
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
              <StatCard label="현재 활성 부상" value={stats.activeCount} sub="복귀 완료 제외" />
              <StatCard
                label="평균 회복 기간"
                value={stats.avgRecoveryDays != null ? `${stats.avgRecoveryDays}일` : '—'}
                sub="예상 복귀일 기준"
              />
              <StatCard
                label="총 부상 기록"
                value={bodyPartEntries.reduce((s, [, n]) => s + n, 0)}
                sub="전체 이력"
              />
            </div>

            {/* 부위별 */}
            {bodyPartEntries.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">부상 부위별</h2>
                <div className="space-y-2">
                  {bodyPartEntries.map(([part, count]) => (
                    <BarRow key={part} label={BODY_PART_LABEL[part as BodyPart] ?? part} count={count} max={maxBodyPart} />
                  ))}
                </div>
              </div>
            )}

            {/* 원인별 */}
            {causeEntries.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">발생 원인별</h2>
                <div className="space-y-2">
                  {causeEntries.map(([cause, count]) => (
                    <BarRow
                      key={cause}
                      label={CAUSE_LABEL[cause as InjuryCause] ?? cause}
                      count={count}
                      max={maxCause}
                    />
                  ))}
                </div>
              </div>
            )}

            {bodyPartEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">부상 데이터가 없습니다.</p>
            )}
          </div>
        ) : null}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) resetForm() }}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>의무보고서 작성</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>제목 *</Label>
              <Input
                placeholder="예: 2026-07 부상 현황 보고"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>내용 *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={insertStatsSnapshot}
                  disabled={!stats}
                >
                  현재 통계 삽입
                </Button>
              </div>
              <Textarea
                placeholder="부상 현황, 의견, 조치 사항 등을 입력해주세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? '저장 중...' : '임시 저장'}
              </Button>
              <Button className="flex-1" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? '처리 중...' : '상신'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
