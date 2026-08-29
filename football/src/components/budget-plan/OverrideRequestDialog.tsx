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
import { useExpenseCategories } from '@/hooks/useExpenseCategories'
import {
  useRequestOverride,
  type BudgetOverrideLogDto,
} from '@/services/budget-plan.service'
import type { CategoryScope } from '@/types/expense-category'

/**
 * 이의 신청 사유 최소 길이. 백엔드는 trim 후 non-empty 만 검사하지만 (`override.
 * service.ts:29`) FE UX 로는 의미있는 근거를 요구해 min 10 자를 강제한다.
 */
export const REASON_MIN_LENGTH = 10

// ---------------------------------------------------------------------------
// 에러 코드 → 한국어 안내. `apps/api/src/budget-plan/override.service.ts` 의
// AppError code 문자열을 그대로 매핑한다. api.ts 의 `throw new Error(body.code)`
// 규약에 따라 mutation onError 콜백은 message === code 를 갖는다.
//
// OVERRIDE_EXCEEDS_TOTAL_BUDGET 은 이의 신청 시점이 아닌 FM 승인 시점에서만
// 발생하지만, 방어적으로 매핑에 넣어둔다 (승인 UI 와 문구 공유).
// ---------------------------------------------------------------------------
const ERROR_MESSAGE: Record<string, string> = {
  INVALID_PLAN_STATUS_TRANSITION:
    '지금은 이의 신청을 할 수 없습니다 (편성이 확정 상태여야 합니다)',
  AMOUNT_MUST_BE_POSITIVE: '금액은 양수여야 합니다',
  REASON_REQUIRED: '사유를 입력하세요',
  INVALID_CATEGORY_ID: '유효한 카테고리를 선택하세요',
  INVALID_AMOUNT: '유효한 금액을 입력하세요',
  UNKNOWN_CATEGORY: '알 수 없는 카테고리입니다',
  CATEGORY_SCOPE_MISMATCH: '선택한 카테고리 스코프가 요청자와 일치하지 않습니다',
  FINANCIAL_REPORT_NOT_FOUND: '해당 시즌 재무보고서를 찾을 수 없습니다',
  NOT_BUDGET_PLAN_REQUESTER: '편성 신청 권한이 없습니다',
  OVERRIDE_EXCEEDS_TOTAL_BUDGET: '총 예산 초과 — 승인이 불가할 수 있습니다',
}

function translateError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  return ERROR_MESSAGE[raw] ?? raw ?? '알 수 없는 오류가 발생했습니다'
}

export interface OverrideRequestDialogProps {
  seasonId: number
  /**
   * 요청자 스코프 — 카테고리 selector 를 이 스코프로 필터한다.
   * HEAD_COACH → TEAM, 그 외 (FRONT_OFFICE 부서장) → DEPARTMENT.
   */
  scope: CategoryScope
  /** Dialog 를 여는 trigger UI (Button 등). */
  trigger: React.ReactNode
  /** 신청 성공 후 부모에게 알린다. logId 만 서버가 반환하지만 편의를 위해 partial DTO 를 전달. */
  onSuccess?: (log: Pick<BudgetOverrideLogDto, 'id' | 'categoryId' | 'amount' | 'reason'>) => void
}

/**
 * 팀장/부서장이 FINALIZED 편성에 대해 카테고리별 이의 신청을 제출하는 Dialog.
 *
 * - 카테고리 selector: `useExpenseCategories()` 를 scope 로 필터 (isActive 만).
 * - 금액: `<Input type="number">`, KRW 단위.
 * - 사유: `<Textarea>`, min {@link REASON_MIN_LENGTH} 자.
 * - 제출: {@link useRequestOverride}. 성공 시 dialog close + onSuccess + toast.
 * - 실패: 서버 code 를 한국어로 매핑해 sonner toast.
 *
 * `trigger` 는 사용자가 직접 컨트롤. 클릭 시 dialog 가 열리며, 여기서는 open 상태만 관리한다.
 */
export function OverrideRequestDialog({
  seasonId,
  scope,
  trigger,
  onSuccess,
}: OverrideRequestDialogProps) {
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const { rows: allCategories, loading: categoriesLoading } = useExpenseCategories()
  const mutation = useRequestOverride(seasonId)

  // scope 필터 후 활성 카테고리만.
  const categories = useMemo(() => {
    return allCategories.filter(
      (c) => c.isActive && (!c.scope || c.scope === scope),
    )
  }, [allCategories, scope])

  const parsedAmount = Number.parseInt(amount, 10)
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0
  const reasonTrimmed = reason.trim()
  const reasonValid = reasonTrimmed.length >= REASON_MIN_LENGTH
  const categoryValid = categoryId != null

  const submitDisabled =
    mutation.isPending || !amountValid || !reasonValid || !categoryValid

  const resetForm = () => {
    setCategoryId(null)
    setAmount('')
    setReason('')
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && !mutation.isPending) {
      resetForm()
    }
  }

  const handleSubmit = () => {
    if (!categoryValid || !amountValid || !reasonValid) return
    mutation.mutate(
      {
        categoryId: categoryId!,
        amount: parsedAmount,
        reason: reasonTrimmed,
      },
      {
        onSuccess: (result) => {
          toast.success('이의 신청이 접수되었습니다')
          onSuccess?.({
            id: result.id,
            categoryId: categoryId!,
            amount: parsedAmount,
            reason: reasonTrimmed,
          })
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
        data-testid="override-request-trigger"
        data-scope={scope}
      >
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent data-testid="override-request-dialog">
          <DialogHeader>
            <DialogTitle>카테고리별 이의 신청</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Category selector — 백엔드 override.service.ts 는 category.scope 를
                requester scope 와 매칭하므로 UI 는 미리 필터한 뒤 선택지만 노출. */}
            <div className="space-y-1">
              <Label htmlFor="override-category">카테고리</Label>
              <select
                id="override-category"
                data-testid="override-category-select"
                className="w-full border rounded px-2 py-1 text-sm bg-background"
                value={categoryId ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setCategoryId(v ? Number.parseInt(v, 10) : null)
                }}
                disabled={mutation.isPending || categoriesLoading}
              >
                <option value="">— 카테고리 선택 —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} data-scope={c.scope ?? scope}>
                    {c.label}
                  </option>
                ))}
              </select>
              {!categoriesLoading && categories.length === 0 && (
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="override-no-categories"
                >
                  {scope === 'TEAM' ? '팀' : '부서'} 스코프 카테고리가 없습니다.
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <Label htmlFor="override-amount">금액 (원)</Label>
              <Input
                id="override-amount"
                data-testid="override-amount-input"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="예) 500000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={mutation.isPending}
              />
              {amount && !amountValid && (
                <p className="text-xs text-red-600">양수 정수를 입력하세요.</p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <Label htmlFor="override-reason">
                사유 (최소 {REASON_MIN_LENGTH}자)
              </Label>
              <Textarea
                id="override-reason"
                data-testid="override-reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="이의 신청 사유를 상세히 입력하세요"
                rows={4}
                disabled={mutation.isPending}
              />
              <p
                className="text-xs text-muted-foreground"
                data-testid="override-reason-counter"
              >
                {reasonTrimmed.length} / {REASON_MIN_LENGTH}자
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
              data-testid="override-cancel"
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitDisabled}
              data-testid="override-submit"
            >
              {mutation.isPending ? '신청 중…' : '신청'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
