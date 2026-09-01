import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useMinimumHistory,
  useProposeMinimum,
  type MinimumEvidenceType,
  type MandatoryMinimumChangeLogDto,
} from '@/services/mandatory-minimum.service'

// ---------------------------------------------------------------------------
// mm-propose Dialog — issue #451 F2 (ADR 0022)
// ----------------------------------------------------------------------------
// FinanceManager 가 카테고리별 mandatoryMinimum 을 제안하는 폼. 서버 API 는
// service.ts 의 useProposeMinimum(categoryPlanId, seasonId) mutation 을 통해
// 호출된다. 이 Dialog 는 다음 규칙을 강제한다:
//
//   - reason: min 10자 (백엔드는 non-empty 만 검사하지만 FE UX 로 강화)
//   - newAmount: ≥ 0 정수 (서버는 0 이상 허용 — grill Q3)
//   - evidenceUrl: evidenceType 이 CONTRACT/LEGAL 이면 required. FIXED_COST 는 optional.
//
// 최근 REJECTED 이력이 있으면 상단 amber card 로 reviewNote 를 노출해 재제안
// UX 를 지원한다 (Q10). useMinimumHistory(categoryPlanId) 응답의 첫 REJECTED 를 사용.
// ---------------------------------------------------------------------------

/** reason 최소 길이. OverrideRequestDialog 와 동일 관례. */
export const REASON_MIN_LENGTH = 10

// ---------------------------------------------------------------------------
// 서버 에러 코드 → 한국어 안내. api.ts 의 `throw new Error(body.code)` 규약에
// 따라 mutation.onError 콜백은 message === code 를 받는다. 매핑되지 않은 코드는
// 원문 그대로 노출.
// ---------------------------------------------------------------------------
const ERROR_MESSAGE: Record<string, string> = {
  CATEGORY_PLAN_NOT_FOUND: '카테고리 편성 계획을 찾을 수 없습니다',
  REASON_REQUIRED: '사유를 입력해주세요',
  EVIDENCE_URL_REQUIRED: '근거 URL 이 필요합니다 (계약서/법령 유형)',
  INVALID_EVIDENCE_TYPE: '유효하지 않은 근거 유형입니다',
  AMOUNT_MUST_BE_NON_NEGATIVE: '금액은 0 이상이어야 합니다',
  FORBIDDEN: '권한이 없습니다',
}

function translateError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  return ERROR_MESSAGE[raw] ?? raw ?? '알 수 없는 오류가 발생했습니다'
}

// ---------------------------------------------------------------------------
// evidenceType label — 서버 enum 원문 그대로 사용하되 UI 는 한국어로.
// URL required 여부는 EVIDENCE_URL_REQUIRED_TYPES 로 별도 관리.
// ---------------------------------------------------------------------------
const EVIDENCE_TYPE_LABEL: Record<MinimumEvidenceType, string> = {
  CONTRACT: '계약서',
  LEGAL: '법령',
  FIXED_COST: '고정비',
}

/** URL 이 required 인 evidenceType. FIXED_COST 는 optional. */
const EVIDENCE_URL_REQUIRED_TYPES: readonly MinimumEvidenceType[] = [
  'CONTRACT',
  'LEGAL',
]

function isEvidenceUrlRequired(t: MinimumEvidenceType): boolean {
  return EVIDENCE_URL_REQUIRED_TYPES.includes(t)
}

/** 오늘 날짜 (yyyy-mm-dd, 로컬 tz). effectiveDate default. */
function todayIsoDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface MandatoryMinimumProposalDialogProps {
  categoryPlan: {
    id: number
    mandatoryMinimum: number
    expenseCategory: { code: string; label: string }
  }
  seasonId: number
  /** Dialog 를 여는 trigger UI (Button 등). OverrideRequestDialog 와 동일 관례. */
  trigger: React.ReactNode
  /** 제안 성공 후 부모에게 알린다. */
  onSuccess?: () => void
}

/**
 * FM 이 카테고리별 mandatoryMinimum 변경을 제안하는 Dialog.
 *
 * - 상단: 카테고리 label + 현재 mandatoryMinimum (₩)
 * - Recent REJECTED 이력이 있으면 amber card 로 reviewNote 노출 (Q10)
 * - Form: newAmount + evidenceType select + evidenceUrl + reason + effectiveDate
 * - Submit → useProposeMinimum().mutate; 성공 시 dialog close + toast + onSuccess
 * - 에러: 서버 code 를 한국어로 매핑해 sonner toast
 */
export function MandatoryMinimumProposalDialog({
  categoryPlan,
  seasonId,
  trigger,
  onSuccess,
}: MandatoryMinimumProposalDialogProps) {
  const [open, setOpen] = useState(false)
  const [newAmount, setNewAmount] = useState('')
  const [evidenceType, setEvidenceType] =
    useState<MinimumEvidenceType>('CONTRACT')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [reason, setReason] = useState('')
  const [effectiveDate, setEffectiveDate] = useState<string>(todayIsoDate())

  const mutation = useProposeMinimum(categoryPlan.id, seasonId)
  // Dialog 가 열려 있을 때만 history 를 fetch — 닫힌 상태에서는 낭비.
  const historyQuery = useMinimumHistory(categoryPlan.id, { enabled: open })

  // 최근 REJECTED 이력 (server: proposedAt DESC → 첫 REJECTED 를 사용).
  const lastRejected: MandatoryMinimumChangeLogDto | undefined = useMemo(() => {
    const rows = historyQuery.data ?? []
    return rows.find((r) => r.status === 'REJECTED')
  }, [historyQuery.data])

  // ------------------------------------------------------------------------
  // Client validation
  // ------------------------------------------------------------------------
  const parsedAmount = Number.parseInt(newAmount, 10)
  const amountValid =
    newAmount !== '' && Number.isFinite(parsedAmount) && parsedAmount >= 0
  const reasonTrimmed = reason.trim()
  const reasonValid = reasonTrimmed.length >= REASON_MIN_LENGTH
  const urlRequired = isEvidenceUrlRequired(evidenceType)
  const urlTrimmed = evidenceUrl.trim()
  // URL 검증: required 유형이면 non-empty 필수. FIXED_COST 는 optional.
  const urlValid = urlRequired ? urlTrimmed.length > 0 : true
  const effectiveDateValid = effectiveDate.length > 0

  const submitDisabled =
    mutation.isPending ||
    !amountValid ||
    !reasonValid ||
    !urlValid ||
    !effectiveDateValid

  const resetForm = () => {
    setNewAmount('')
    setEvidenceType('CONTRACT')
    setEvidenceUrl('')
    setReason('')
    setEffectiveDate(todayIsoDate())
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && !mutation.isPending) {
      resetForm()
    }
  }

  const handleSubmit = () => {
    if (submitDisabled) return
    // 서버 payload: evidenceUrl 은 optional. urlRequired 유형은 위에서 이미 검증했고,
    // FIXED_COST 에서 empty 이면 필드 자체를 생략해 서버가 null 로 저장하도록.
    mutation.mutate(
      {
        newAmount: parsedAmount,
        evidenceType,
        ...(urlTrimmed.length > 0 ? { evidenceUrl: urlTrimmed } : {}),
        reason: reasonTrimmed,
        effectiveDate,
      },
      {
        onSuccess: () => {
          toast.success('제안이 접수되었습니다')
          onSuccess?.()
          setOpen(false)
          resetForm()
        },
        onError: (err) => {
          toast.error(translateError(err))
        },
      },
    )
  }

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
        data-testid="mm-propose-trigger"
        data-category-plan-id={categoryPlan.id}
      >
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent data-testid="mm-propose-dialog">
          <DialogHeader>
            <DialogTitle>
              최소 배정액 제안 — {categoryPlan.expenseCategory.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 현재값 안내 */}
            <div className="rounded-md border bg-muted px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">현재 최소 배정액</span>
                <span
                  className="font-semibold tabular-nums"
                  data-testid="mm-current-amount"
                >
                  ₩{categoryPlan.mandatoryMinimum.toLocaleString('ko-KR')}
                </span>
              </div>
            </div>

            {/* 최근 REJECTED 이력 안내 (Q10 재제안 UX) */}
            {lastRejected && (
              <div
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800"
                data-testid="mm-last-rejected"
              >
                <div className="font-semibold mb-1">
                  이전 제안이 반려되었습니다
                </div>
                {lastRejected.reviewNote ? (
                  <div
                    className="text-xs"
                    data-testid="mm-last-rejected-note"
                  >
                    반려 사유: {lastRejected.reviewNote}
                  </div>
                ) : (
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    반려 사유가 기록되어 있지 않습니다.
                  </div>
                )}
                <div className="text-xs mt-1 text-amber-800 dark:text-amber-200 tabular-nums">
                  이전 제안 금액: ₩
                  {lastRejected.newAmount.toLocaleString('ko-KR')}
                </div>
              </div>
            )}

            {/* newAmount */}
            <div className="space-y-1">
              <Label htmlFor="mm-new-amount">제안 금액 (원)</Label>
              <Input
                id="mm-new-amount"
                data-testid="mm-new-amount-input"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="예) 3000000"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                disabled={mutation.isPending}
              />
              {newAmount !== '' && !amountValid && (
                <p className="text-xs text-red-600">
                  0 이상의 정수를 입력하세요.
                </p>
              )}
            </div>

            {/* evidenceType */}
            <div className="space-y-1">
              <Label htmlFor="mm-evidence-type">근거 유형</Label>
              <select
                id="mm-evidence-type"
                data-testid="mm-evidence-type-select"
                className="w-full border rounded px-2 py-1 text-sm bg-background"
                value={evidenceType}
                onChange={(e) => {
                  setEvidenceType(e.target.value as MinimumEvidenceType)
                }}
                disabled={mutation.isPending}
              >
                {(Object.keys(EVIDENCE_TYPE_LABEL) as MinimumEvidenceType[]).map(
                  (t) => (
                    <option key={t} value={t}>
                      {EVIDENCE_TYPE_LABEL[t]}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* evidenceUrl */}
            <div className="space-y-1">
              <Label htmlFor="mm-evidence-url">
                근거 URL {urlRequired ? '(필수)' : '(선택)'}
              </Label>
              <Input
                id="mm-evidence-url"
                data-testid="mm-evidence-url-input"
                type="url"
                placeholder="https://…"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                disabled={mutation.isPending}
              />
              {urlRequired && urlTrimmed.length === 0 && (
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="mm-evidence-url-required-hint"
                >
                  {EVIDENCE_TYPE_LABEL[evidenceType]} 유형은 근거 URL 이 필수입니다.
                </p>
              )}
            </div>

            {/* reason */}
            <div className="space-y-1">
              <Label htmlFor="mm-reason">
                사유 (최소 {REASON_MIN_LENGTH}자)
              </Label>
              <Textarea
                id="mm-reason"
                data-testid="mm-reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="변경 사유를 상세히 입력하세요"
                rows={4}
                disabled={mutation.isPending}
              />
              <p
                className="text-xs text-muted-foreground"
                data-testid="mm-reason-counter"
              >
                {reasonTrimmed.length} / {REASON_MIN_LENGTH}자
              </p>
            </div>

            {/* effectiveDate */}
            <div className="space-y-1">
              <Label htmlFor="mm-effective-date">시행 일자</Label>
              <Input
                id="mm-effective-date"
                data-testid="mm-effective-date-input"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
              data-testid="mm-cancel"
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitDisabled}
              data-testid="mm-submit"
            >
              {mutation.isPending ? '제안 중…' : '제안하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
