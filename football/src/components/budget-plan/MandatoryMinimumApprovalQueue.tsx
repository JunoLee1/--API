import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ExternalLink } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  mandatoryMinimumKeys,
  usePendingMinimums,
  useReviewMinimum,
  type MandatoryMinimumChangeLogDto,
  type MinimumEvidenceType,
} from '@/services/mandatory-minimum.service'
import type { CategoryScope } from '@/types/expense-category'

// ============================================================================
// MandatoryMinimumApprovalQueue — F3 (#452)
// ----------------------------------------------------------------------------
// GM 페르소나 승인 대기함. F1 (#450) 서비스 훅 (`usePendingMinimums`,
// `useReviewMinimum`) 을 소비해서, FinanceManager 가 제안한 카테고리별
// mandatoryMinimum 변경 로그를 카드 목록으로 렌더하고 승인/반려 dialog 로
// 처리한다. GmReplanPanel 의 재편성 트리거 카드 상단에 embed 되어, GM 은 우선
// 대기 중인 minimum 변경부터 확인하고 필요 시 재편성을 실행한다.
//
// 주요 결정:
//   - 승인 dialog 는 reviewNote optional, 반려 dialog 는 min 5 char 강제
//     (`REVIEW_NOTE_REQUIRED_FOR_REJECT` 를 UI 에서 사전 차단).
//   - ALREADY_REVIEWED (409) → toast + pending 캐시 즉시 invalidate 해서 다른
//     GM 이 이미 처리한 항목을 화면에서 사라지게 한다.
//   - proposedAt 은 `date-fns/formatDistanceToNow(locale=ko)` 로 상대 시간
//     ("3시간 전"), 절대시간은 title 로 보완.
//   - 증감 delta 색상: **증액 = red** (지출 증가 위험), **감액 = green**
//     (지출 절감). 접근성용으로 부호/화살표(↑↓) 도 함께 표시.
// ============================================================================

interface Props {
  seasonId: number
}

// ---------------------------------------------------------------------------
// 라벨 / 색상 상수
// ---------------------------------------------------------------------------
const EVIDENCE_LABEL: Record<MinimumEvidenceType, string> = {
  CONTRACT: '계약서',
  LEGAL: '법정 의무',
  FIXED_COST: '고정비',
}

const EVIDENCE_BADGE_CLASS: Record<MinimumEvidenceType, string> = {
  CONTRACT:
    'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800',
  LEGAL:
    'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-100 dark:border-violet-800',
  FIXED_COST:
    'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800',
}

// FinanceManagerReview.tsx 와 동일 팔레트 (팀 = teal, 부서 = amber).
const SCOPE_LABEL: Record<'TEAM' | 'DEPARTMENT', string> = {
  TEAM: '팀',
  DEPARTMENT: '부서',
}
const SCOPE_BADGE_CLASS: Record<'TEAM' | 'DEPARTMENT', string> = {
  TEAM: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950 dark:text-teal-100 dark:border-teal-800',
  DEPARTMENT:
    'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
}

const REJECT_NOTE_MIN_LENGTH = 5

// ---------------------------------------------------------------------------
// 에러 코드 → 한국어 안내
// ---------------------------------------------------------------------------
const ERROR_MESSAGE: Record<string, string> = {
  ALREADY_REVIEWED: '이미 처리된 제안입니다',
  REVIEW_NOTE_REQUIRED_FOR_REJECT: '반려 시 사유를 입력해야 합니다',
  FORBIDDEN: 'GM 권한이 필요합니다',
}

function translateError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  return ERROR_MESSAGE[raw] ?? raw ?? '알 수 없는 오류가 발생했습니다'
}

// ---------------------------------------------------------------------------
// 포매팅 헬퍼
// ---------------------------------------------------------------------------
function formatKrw(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

/** ISO 문자열을 안전하게 파싱 (실패 시 원문 반환). */
function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ko })
  } catch {
    return iso
  }
}

/** yyyy-MM-dd 만 안전 추출. */
function shortDate(iso: string): string {
  try {
    const d = parseISO(iso)
    if (Number.isNaN(d.getTime())) return iso
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return iso
  }
}

/** 절대 시간을 title tooltip 용으로. */
function absoluteTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR')
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// 델타 계산 & 표시
// ---------------------------------------------------------------------------
interface Delta {
  amount: number
  direction: 'up' | 'down' | 'flat'
  colorClass: string
  arrow: string
  sign: '+' | '-' | ''
}

function computeDelta(previous: number, next: number): Delta {
  const raw = next - previous
  if (raw > 0) {
    // 증액 = 지출 확대 = 위험 신호 → red
    return {
      amount: raw,
      direction: 'up',
      colorClass: 'text-red-700 dark:text-red-300',
      arrow: '↑',
      sign: '+',
    }
  }
  if (raw < 0) {
    // 감액 = 지출 절감 → green
    return {
      amount: Math.abs(raw),
      direction: 'down',
      colorClass: 'text-green-700 dark:text-green-300',
      arrow: '↓',
      sign: '-',
    }
  }
  return {
    amount: 0,
    direction: 'flat',
    colorClass: 'text-muted-foreground',
    arrow: '',
    sign: '',
  }
}

// ---------------------------------------------------------------------------
// Reason 접기/펼치기 (3줄 truncate)
// ---------------------------------------------------------------------------
const REASON_TRUNCATE_LIMIT = 160

function ReasonBlock({ reason, logId }: { reason: string; logId: number }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = reason.length > REASON_TRUNCATE_LIMIT
  const display = expanded || !isLong ? reason : reason.slice(0, REASON_TRUNCATE_LIMIT) + '…'
  return (
    <div className="space-y-1">
      <p
        className="text-sm whitespace-pre-wrap break-words"
        data-testid={`mm-reason-${logId}`}
      >
        {display}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          data-testid={`mm-reason-toggle-${logId}`}
        >
          {expanded ? '접기' : '더 보기'}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 승인/반려 dialog
// ---------------------------------------------------------------------------
interface ReviewDialogProps {
  open: boolean
  target: {
    log: MandatoryMinimumChangeLogDto
    decision: 'APPROVED' | 'REJECTED'
  } | null
  submitting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (note: string) => void
}

function ReviewDialog({
  open,
  target,
  submitting,
  onOpenChange,
  onSubmit,
}: ReviewDialogProps) {
  const [note, setNote] = useState('')
  const trimmed = note.trim()
  const requireNote = target?.decision === 'REJECTED'
  const disabled =
    submitting ||
    (requireNote && trimmed.length < REJECT_NOTE_MIN_LENGTH)

  const isApprove = target?.decision === 'APPROVED'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setNote('')
      }}
    >
      <DialogContent data-testid="mm-review-dialog">
        <DialogHeader>
          <DialogTitle>
            {isApprove
              ? 'mandatoryMinimum 변경 승인'
              : 'mandatoryMinimum 변경 반려'}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? '이 mandatoryMinimum 변경을 승인하시겠습니까? 승인 시 해당 카테고리의 최소값이 즉시 반영됩니다.'
              : `반려 사유를 최소 ${REJECT_NOTE_MIN_LENGTH}자 이상 입력해주세요. 사유는 제안자에게 전달됩니다.`}
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
            <div className="font-semibold">
              {target.log.categoryPlan?.expenseCategory.label ??
                `카테고리 #${target.log.categoryPlanId}`}
            </div>
            <div className="tabular-nums">
              {formatKrw(target.log.previousAmount)}{' → '}
              {formatKrw(target.log.newAmount)}
            </div>
          </div>
        )}

        <div className="space-y-2 py-2">
          <Label htmlFor="mm-review-note">
            심사 메모{' '}
            {requireNote
              ? `(필수, 최소 ${REJECT_NOTE_MIN_LENGTH}자)`
              : '(선택)'}
          </Label>
          <Textarea
            id="mm-review-note"
            data-testid="mm-review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              requireNote
                ? '반려 사유를 구체적으로 기재해주세요'
                : '심사 메모 (선택)'
            }
            disabled={submitting}
          />
          {requireNote && (
            <p
              className="text-xs text-muted-foreground"
              data-testid="mm-review-note-hint"
            >
              {trimmed.length}/{REJECT_NOTE_MIN_LENGTH}자 이상 입력해주세요
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            data-testid="mm-review-cancel"
          >
            취소
          </Button>
          <Button
            variant={isApprove ? 'default' : 'destructive'}
            onClick={() => onSubmit(trimmed)}
            disabled={disabled}
            data-testid="mm-review-submit"
          >
            {submitting
              ? '처리 중…'
              : isApprove
                ? '승인 확정'
                : '반려 확정'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 로그 카드 (한 건)
// ---------------------------------------------------------------------------
function LogCard({
  log,
  reviewing,
  onOpen,
}: {
  log: MandatoryMinimumChangeLogDto
  reviewing: boolean
  onOpen: (log: MandatoryMinimumChangeLogDto, decision: 'APPROVED' | 'REJECTED') => void
}) {
  const category = log.categoryPlan?.expenseCategory
  // `scope` 는 F1 DTO 에 아직 정식으로 포함되어 있지 않다 (백엔드 select 가
  // { id, code, label } 만 include). 후속 slice 에서 서버가 scope 도 include
  // 하도록 확장되면 그 시점에 DTO 를 갱신하고 이 캐스트를 제거한다. 값이
  // 없으면 뱃지 자체가 렌더되지 않으므로 안전.
  const scope: CategoryScope | undefined = (
    category as { scope?: CategoryScope } | undefined
  )?.scope
  const delta = computeDelta(log.previousAmount, log.newAmount)
  const proposer =
    log.proposedBy?.username ??
    log.proposedBy?.email ??
    `#${log.proposedById}`

  return (
    <Card data-testid={`mm-log-card-${log.id}`} data-log-id={log.id}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">
              {category?.label ?? `카테고리 #${log.categoryPlanId}`}
            </CardTitle>
            {scope && (
              <Badge
                variant="outline"
                className={cn('border', SCOPE_BADGE_CLASS[scope])}
                data-scope-badge={scope}
              >
                {SCOPE_LABEL[scope]}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn('border', EVIDENCE_BADGE_CLASS[log.evidenceType])}
              data-evidence-type={log.evidenceType}
            >
              {EVIDENCE_LABEL[log.evidenceType]}
            </Badge>
          </div>
          <div
            className="text-xs text-muted-foreground text-right space-y-0.5"
            data-testid={`mm-log-meta-${log.id}`}
          >
            <div>
              제안자{' '}
              <span className="font-medium text-foreground" data-testid={`mm-proposer-${log.id}`}>
                {proposer}
              </span>
            </div>
            <div title={absoluteTime(log.proposedAt)}>
              {relativeTime(log.proposedAt)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 금액 delta */}
        <div className="rounded-md border p-3 space-y-1">
          <div className="text-xs text-muted-foreground">최소 편성 금액 변경</div>
          <div className="flex flex-wrap items-baseline gap-2 tabular-nums">
            <span
              className="text-sm text-muted-foreground line-through"
              data-testid={`mm-previous-${log.id}`}
            >
              {formatKrw(log.previousAmount)}
            </span>
            <span className="text-xs text-muted-foreground">→</span>
            <span
              className="text-base font-semibold"
              data-testid={`mm-new-${log.id}`}
            >
              {formatKrw(log.newAmount)}
            </span>
            {delta.direction !== 'flat' && (
              <span
                className={cn('text-sm font-medium', delta.colorClass)}
                data-testid={`mm-delta-${log.id}`}
                data-delta-direction={delta.direction}
              >
                {delta.arrow} {delta.sign}
                {formatKrw(delta.amount)}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            적용 예정일:{' '}
            <span className="tabular-nums" data-testid={`mm-effective-${log.id}`}>
              {shortDate(log.effectiveDate)}
            </span>
          </div>
        </div>

        {/* 증빙 링크 */}
        {log.evidenceUrl && (
          <div className="text-sm">
            <a
              href={log.evidenceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
              data-testid={`mm-evidence-url-${log.id}`}
            >
              증빙 문서 열기
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        )}

        {/* 사유 */}
        <ReasonBlock reason={log.reason} logId={log.id} />

        {/* 액션 */}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onOpen(log, 'REJECTED')}
            disabled={reviewing}
            data-testid={`mm-reject-${log.id}`}
          >
            반려
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
            onClick={() => onOpen(log, 'APPROVED')}
            disabled={reviewing}
            data-testid={`mm-approve-${log.id}`}
          >
            승인
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------
export function MandatoryMinimumApprovalQueue({ seasonId }: Props) {
  const query = usePendingMinimums(seasonId)
  const reviewMutation = useReviewMinimum(seasonId)
  const qc = useQueryClient()

  const [target, setTarget] = useState<{
    log: MandatoryMinimumChangeLogDto
    decision: 'APPROVED' | 'REJECTED'
  } | null>(null)

  const logs: MandatoryMinimumChangeLogDto[] = query.data ?? []

  const handleOpen = (
    log: MandatoryMinimumChangeLogDto,
    decision: 'APPROVED' | 'REJECTED',
  ) => setTarget({ log, decision })

  const handleSubmit = (note: string) => {
    if (!target) return
    const { log, decision } = target

    if (decision === 'REJECTED' && note.length < REJECT_NOTE_MIN_LENGTH) {
      // dialog 에서 이미 disable 되어 있지만 방어적으로 한 번 더.
      return
    }

    reviewMutation.mutate(
      {
        logId: log.id,
        decision,
        note: note.length > 0 ? note : undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            decision === 'APPROVED'
              ? '제안이 승인되었습니다'
              : '제안이 반려되었습니다',
          )
          setTarget(null)
        },
        onError: (err) => {
          const raw = err instanceof Error ? err.message : String(err ?? '')
          toast.error(translateError(err))
          if (raw === 'ALREADY_REVIEWED') {
            // 다른 GM 이 먼저 처리 → 목록 강제 refresh 하여 사라지게 한다.
            void qc.invalidateQueries({
              queryKey: mandatoryMinimumKeys.pending(seasonId),
            })
            setTarget(null)
          }
        },
      },
    )
  }

  return (
    <section
      data-persona="GM"
      data-testid="mm-approval-queue"
      className="space-y-3"
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              mandatoryMinimum 승인 대기함
              <span className="ml-2 text-xs text-muted-foreground">
                ({logs.length}건)
              </span>
            </CardTitle>
            <span className="text-xs text-muted-foreground">시즌 #{seasonId}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.isLoading && (
            <div className="space-y-2" data-testid="mm-queue-loading">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {query.isError && !query.isLoading && (
            <div
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100 dark:border-red-800"
              data-testid="mm-queue-error"
            >
              승인 대기 목록을 불러오지 못했습니다: {translateError(query.error)}
            </div>
          )}

          {!query.isLoading && !query.isError && logs.length === 0 && (
            <p
              className="text-sm text-muted-foreground"
              data-testid="mm-queue-empty"
            >
              승인 대기 중인 mandatoryMinimum 변경 제안이 없습니다.
            </p>
          )}

          {logs.length > 0 && (
            <div className="space-y-3">
              {logs.map((log) => (
                <LogCard
                  key={log.id}
                  log={log}
                  reviewing={reviewMutation.isPending}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ReviewDialog
        open={target !== null}
        target={target}
        submitting={reviewMutation.isPending}
        onOpenChange={(next) => {
          if (!next && !reviewMutation.isPending) setTarget(null)
        }}
        onSubmit={handleSubmit}
      />
    </section>
  )
}
