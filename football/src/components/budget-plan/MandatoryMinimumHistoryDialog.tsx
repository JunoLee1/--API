import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useMinimumHistory,
  type MandatoryMinimumChangeLogDto,
  type MinimumChangeStatus,
  type MinimumEvidenceType,
} from '@/services/mandatory-minimum.service'

// ============================================================================
// MandatoryMinimumHistoryDialog — issue #453 (F4)
// ----------------------------------------------------------------------------
// FM/GM/SUPER_ADMIN 이 특정 categoryPlan 에 대한 mandatoryMinimum 변경 이력
// 전체를 timeline 으로 조회. 서버는 proposedAt DESC 로 정렬해 내려주고,
// 응답에는 proposedBy / reviewedBy / categoryPlan(+expenseCategory) 가
// include 되어 있다 (see `useMinimumHistory` 주석).
//
// 권한 재검증은 하지 않는다 — 백엔드가 이미 403 을 반환하므로 프론트에서
// 이중으로 role 을 좁히면 정합성 위험만 늘어난다 (Q6).
// ============================================================================

export interface MandatoryMinimumHistoryDialogProps {
  /** BudgetCategoryPlan.id — history endpoint 스코프. */
  categoryPlanId: number
  /** Dialog header 에 표시할 카테고리 라벨 (예: "선수 급여"). */
  categoryLabel: string
  /** Dialog 를 여는 trigger UI (Button/링크 등). */
  trigger: React.ReactNode
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** ₩ formatter — Intl.NumberFormat 로 천 단위 콤마 (음수는 자체 부호 처리). */
const wonFmt = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

function formatWon(n: number): string {
  return wonFmt.format(Math.round(n))
}

/**
 * ISO date string → `yyyy-MM-dd HH:mm` (한국 로케일 기준, 실제 저장은 UTC).
 * 파싱 실패 시 원문 그대로 반환.
 */
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

/** ISO date string → `yyyy-MM-dd`. */
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Status pill — 4 색상. classNames 는 PlanStatusBadge 의 hex-없는 tailwind
// 색상 네임 관례를 그대로 따라간다 (Q6 회신).
// ---------------------------------------------------------------------------

interface StatusPillConfig {
  label: string
  className: string
}

const STATUS_PILL: Record<MinimumChangeStatus, StatusPillConfig> = {
  PENDING: {
    label: '심사 대기',
    className:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
  },
  APPROVED: {
    label: '승인',
    className:
      'bg-green-100 text-green-900 border-green-300 dark:bg-green-950 dark:text-green-100 dark:border-green-800',
  },
  REJECTED: {
    label: '반려',
    className:
      'bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-800',
  },
  CANCELED: {
    label: '자동 취소',
    className:
      'bg-gray-100 text-gray-900 border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700',
  },
}

function StatusPill({ status }: { status: MinimumChangeStatus }) {
  const cfg = STATUS_PILL[status]
  return (
    <Badge
      variant="outline"
      className={cn(cfg.className)}
      data-status={status}
      data-testid={`mm-history-status-${status}`}
    >
      {cfg.label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Evidence type badge — 3 종. FE 는 표시만 담당, 매핑은 백엔드 enum 을 따른다.
// ---------------------------------------------------------------------------

const EVIDENCE_LABEL: Record<MinimumEvidenceType, string> = {
  CONTRACT: '계약서',
  LEGAL: '법령',
  FIXED_COST: '고정 비용',
}

function EvidencePill({ type }: { type: MinimumEvidenceType }) {
  return (
    <Badge
      variant="secondary"
      data-evidence-type={type}
      data-testid={`mm-history-evidence-${type}`}
    >
      {EVIDENCE_LABEL[type]}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Delta pill — prev → new 증감을 색상으로 시각화 (증가 amber, 감소 green,
// 동일 gray). 액수 절대값은 wonFmt 로 포맷하고 부호는 자체 처리.
// ---------------------------------------------------------------------------

function DeltaPill({
  previousAmount,
  newAmount,
}: {
  previousAmount: number
  newAmount: number
}) {
  const delta = newAmount - previousAmount
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '±'
  const abs = Math.abs(delta)
  const color =
    delta > 0
      ? 'text-amber-700 dark:text-amber-300'
      : delta < 0
      ? 'text-green-700 dark:text-green-300'
      : 'text-muted-foreground'
  return (
    <span
      className={cn('text-xs font-medium', color)}
      data-testid="mm-history-delta"
    >
      {sign} {formatWon(abs)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Timeline entry — 한 로그 = 한 카드. Header (금액 변화 + delta + status),
// Body (evidenceType/URL + reason + effectiveDate), Footer (제안/심사자 + 심사 메모).
// ---------------------------------------------------------------------------

function TimelineEntry({ log }: { log: MandatoryMinimumChangeLogDto }) {
  return (
    <Card size="sm" data-testid={`mm-history-entry-${log.id}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground">
              {formatWon(log.previousAmount)}
            </span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="text-sm font-semibold">
              {formatWon(log.newAmount)}
            </span>
            <DeltaPill
              previousAmount={log.previousAmount}
              newAmount={log.newAmount}
            />
          </div>
          <StatusPill status={log.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <EvidencePill type={log.evidenceType} />
          {log.evidenceUrl && (
            <a
              href={log.evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-foreground"
              data-testid="mm-history-evidence-url"
            >
              증빙 자료
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
          <span
            className="text-muted-foreground"
            data-testid="mm-history-effective-date"
          >
            적용일 {formatDate(log.effectiveDate)}
          </span>
        </div>
        <p
          className="text-sm text-foreground whitespace-pre-wrap"
          data-testid="mm-history-reason"
        >
          {log.reason}
        </p>
        <div
          className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground"
          data-testid="mm-history-actor-block"
        >
          <span data-testid="mm-history-proposed-by">
            제안:{' '}
            {log.proposedBy?.username ??
              log.proposedBy?.email ??
              `#${log.proposedById}`}{' '}
            · {formatDateTime(log.proposedAt)}
          </span>
          {log.reviewedById != null && log.reviewedAt && (
            <span data-testid="mm-history-reviewed-by">
              심사:{' '}
              {log.reviewedBy?.username ??
                log.reviewedBy?.email ??
                `#${log.reviewedById}`}{' '}
              · {formatDateTime(log.reviewedAt)}
            </span>
          )}
        </div>
        {log.reviewNote && (
          <p
            className="rounded-md bg-muted/50 p-2 text-foreground"
            data-testid="mm-history-review-note"
          >
            심사 메모: {log.reviewNote}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트.
// ---------------------------------------------------------------------------

/**
 * 카테고리별 mandatoryMinimum 변경 이력 Dialog.
 *
 * - `useMinimumHistory(categoryPlanId)` 로 전체 이력을 조회 (서버 정렬 DESC).
 * - 상태별 pill 4 종 + evidenceType 뱃지 + 증빙 URL 링크.
 * - 로딩/에러/빈 상태 모두 명시 UI 로 표현.
 *
 * 백엔드 권한 가드가 있으므로 프론트에서 role 을 재검증하지 않는다 (Q6).
 */
export function MandatoryMinimumHistoryDialog({
  categoryPlanId,
  categoryLabel,
  trigger,
}: MandatoryMinimumHistoryDialogProps) {
  const [open, setOpen] = useState(false)
  // 열려 있을 때만 fetch — 목록/차트 등 백그라운드 조회를 줄인다.
  const historyQuery = useMinimumHistory(categoryPlanId, { enabled: open })
  const logs = historyQuery.data ?? []

  return (
    <>
      <span
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        role="button"
        tabIndex={0}
        data-testid="mm-history-trigger"
      >
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-lg"
          data-testid="mm-history-dialog"
        >
          <DialogHeader>
            <DialogTitle>
              최저 편성액 변경 이력 · {categoryLabel}
            </DialogTitle>
          </DialogHeader>

          <div
            className="max-h-[70vh] space-y-3 overflow-y-auto pr-1"
            data-testid="mm-history-timeline"
          >
            {historyQuery.isLoading && (
              <div
                className="space-y-2"
                data-testid="mm-history-loading"
              >
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            )}

            {!historyQuery.isLoading && historyQuery.isError && (
              <p
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                data-testid="mm-history-error"
              >
                이력을 불러오지 못했습니다.
              </p>
            )}

            {!historyQuery.isLoading &&
              !historyQuery.isError &&
              logs.length === 0 && (
                <p
                  className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground"
                  data-testid="mm-history-empty"
                >
                  변경 이력이 없습니다.
                </p>
              )}

            {!historyQuery.isLoading &&
              !historyQuery.isError &&
              logs.length > 0 &&
              logs.map((log) => <TimelineEntry key={log.id} log={log} />)}
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              data-testid="mm-history-close"
            >
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
