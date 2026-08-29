import { useState } from 'react'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useRePlan,
  type BudgetPlanStatus,
} from '@/services/budget-plan.service'
import { PlanStatusBadge } from './PlanStatusBadge'

// ============================================================================
// Widened planStatus (issue #432)
// ----------------------------------------------------------------------------
// `BudgetPlanStatus` 는 이미 7 개 상태를 모두 포함하지만, 재편성 트리거는
// `FINALIZED` 상태에서만 활성화된다. 다른 상태는 disabled 로 유지하고 tooltip
// 대신 hover 시 안내 문구 (title) 로 사유를 알린다 (shadcn Tooltip 컴포넌트가
// 아직 이 코드베이스에 도입돼 있지 않아 native title 로 폴백).
// ============================================================================

interface Props {
  seasonId: number
  planStatus: BudgetPlanStatus
  /**
   * 부모 페이지에서 이미 로드해 둔 FinancialReport.id. 이번 패널의 액션
   * (`useRePlan(seasonId)`) 은 seasonId 만 필요하지만, 후속 slice (재편성 후
   * 상세 뷰, 이의 신청 목록 등) 에서 override log 를 조회할 때 재사용할 수 있도록
   * prop 을 유지한다. 미사용 경고를 피하기 위해 destructuring 만 하고 소비는
   * 하지 않는다.
   */
  financialReportId?: number
}

// ---------------------------------------------------------------------------
// 에러 코드 → 한국어 안내. api.ts 의 `throw new Error(body.code ?? ...)`
// 규약에 따라 mutation onError 는 `Error` 객체를 받고, `.message` 가 곧 서버
// 코드 문자열이다. 매핑에 없으면 원문 그대로 노출.
//
// 백엔드 (`apps/api/src/budget-plan/plan-request.controller.ts` +
// `plan-request.service.ts`) 확인:
//   - `FORBIDDEN` (403) — GM 이 아닐 때
//   - `REASON_REQUIRED` (400) — reason 빈 값
//   - `FINANCIAL_REPORT_NOT_FOUND` (404) — 시즌 보고서 없음
//   - `INVALID_PLAN_STATUS_TRANSITION` (409) — FINALIZED 아닐 때
// ---------------------------------------------------------------------------
const ERROR_MESSAGE: Record<string, string> = {
  INVALID_PLAN_STATUS_TRANSITION:
    '이미 재편성 중이거나 확정 상태가 아닙니다',
  FORBIDDEN: 'GM 권한이 필요합니다',
  REASON_REQUIRED: '재편성 사유를 입력해주세요',
  FINANCIAL_REPORT_NOT_FOUND: '시즌 재무보고서를 찾지 못했습니다',
}

function translateError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  return ERROR_MESSAGE[raw] ?? raw ?? '알 수 없는 오류가 발생했습니다'
}

// ---------------------------------------------------------------------------
// 재편성 Dialog. reason 필수 (min 10 char).
// ---------------------------------------------------------------------------
const REASON_MIN_LENGTH = 10

interface RePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  submitting: boolean
  onSubmit: (reason: string) => void
}

function RePlanDialog({
  open,
  onOpenChange,
  submitting,
  onSubmit,
}: RePlanDialogProps) {
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()
  const disabled = submitting || trimmed.length < REASON_MIN_LENGTH

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setReason('')
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>편성 재편성</DialogTitle>
          <DialogDescription>
            기존 신청은 모두 archive 되고 새 14일 심사 창이 재개방됩니다.
            이 액션은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="gm-re-plan-reason">사유 (필수, 최소 {REASON_MIN_LENGTH}자)</Label>
          <Textarea
            id="gm-re-plan-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="재편성 사유를 구체적으로 기재해주세요 (예: 시즌 중 스폰서 계약 변경 반영)"
            disabled={submitting}
            data-testid="gm-re-plan-reason"
          />
          <p
            className="text-xs text-muted-foreground"
            data-testid="gm-re-plan-reason-hint"
          >
            {trimmed.length}/{REASON_MIN_LENGTH}자 이상 입력해주세요
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={() => onSubmit(trimmed)}
            disabled={disabled}
            data-testid="gm-re-plan-submit"
          >
            {submitting ? '재편성 중…' : '재편성 실행'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트 — GM 페르소나 재편성 지시 패널.
//
// - 헤더: PlanStatusBadge + 시즌 라벨
// - 액션: "재편성 트리거" button (FINALIZED 에서만 활성)
// - Dialog: reason 필수 입력 → useRePlan().mutate({ reason })
// - 비-GM 사용자는 조기 return 으로 렌더 회피 (서버 403 fallback 유지)
// ---------------------------------------------------------------------------
export function GmReplanPanel({
  seasonId,
  planStatus,
  // 미사용 prop — 후속 slice 확장 지점으로 유지 (see Props 주석).
  financialReportId: _financialReportId,
}: Props) {
  const { user, loading: userLoading } = useCurrentUser()
  const rePlan = useRePlan(seasonId)
  const [rePlanOpen, setRePlanOpen] = useState(false)

  // 사용자 로딩 중에는 아무것도 렌더하지 않는다 (부모 페이지가 이미 skeleton 처리).
  if (userLoading) return null

  // ---------------------------------------------------------------------------
  // Client-side role guard.
  //
  // 서버 (`plan-request.controller.rePlan`) 가 이미 `role !== "GM"` 을 403 으로
  // 차단하지만, 비-GM 사용자에게 destructive 버튼 자체를 노출하는 UX 문제를 피하기
  // 위해 여기서 렌더를 회피한다. `useCurrentUser` 는 me 조회가 실패하면 user=null
  // 이 되므로, 그 경우도 함께 반환한다.
  // ---------------------------------------------------------------------------
  if (!user || user.role !== 'GM') {
    return (
      <section
        data-persona="GM"
        data-testid="gm-re-plan-no-permission"
        className="rounded-md border p-4 text-sm text-muted-foreground"
      >
        권한이 없습니다.
      </section>
    )
  }

  const canRePlan = planStatus === 'FINALIZED'
  const buttonEnabled = canRePlan && !rePlan.isPending

  const handleSubmit = (reason: string) => {
    if (reason.length < REASON_MIN_LENGTH) return
    rePlan.mutate(reason, {
      onSuccess: () => {
        toast.success('재편성이 시작되었습니다')
        setRePlanOpen(false)
      },
      onError: (err) => toast.error(translateError(err)),
    })
  }

  return (
    <section
      data-persona="GM"
      data-testid="gm-re-plan-panel"
      className="space-y-4"
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">GM 재편성 지시</CardTitle>
            <div className="flex items-center gap-2">
              <span
                className="text-xs text-muted-foreground"
                data-testid="gm-re-plan-season-label"
              >
                시즌 #{seasonId}
              </span>
              <PlanStatusBadge status={planStatus} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            확정된 편성을 되돌리고 14일 심사 창을 다시 개방합니다.
            이 액션은 되돌릴 수 없으니 사유를 명확히 기록해주세요.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={() => setRePlanOpen(true)}
              disabled={!buttonEnabled}
              title={
                canRePlan
                  ? '확정된 편성을 재편성으로 되돌립니다'
                  : '확정된 편성만 재편성 가능'
              }
              data-testid="gm-re-plan-trigger"
            >
              재편성 트리거
            </Button>
          </div>
        </CardContent>
      </Card>

      <RePlanDialog
        open={rePlanOpen}
        onOpenChange={setRePlanOpen}
        submitting={rePlan.isPending}
        onSubmit={handleSubmit}
      />
    </section>
  )
}
