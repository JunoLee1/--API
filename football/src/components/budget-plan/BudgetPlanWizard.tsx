import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CategoryEditor } from './CategoryEditor'
import { OverrideRequestDialog } from './OverrideRequestDialog'
import { emptyLine, type PlanRequestLineDraft } from './types'
import { useSubmitPlanRequest } from '@/services/budget-plan.service'
import type { BudgetPlanStatus } from '@/services/budget-plan.service'
import type { BudgetPlan } from '@/types/budget'
import type { CategoryScope, ExpenseCategory } from '@/types/expense-category'
import type { UserDto } from '@/types/auth'
import { cn } from '@/lib/utils'

const CATEGORIES_PER_PAGE = 5
const DRAFT_KEY_PREFIX = 'budget-plan-wizard:draft:'

/**
 * localStorage 저장 key. 시즌별로 분리해 서로 다른 시즌 draft 가 뒤섞이지 않도록.
 */
export function draftStorageKey(seasonId: number): string {
  return `${DRAFT_KEY_PREFIX}${seasonId}`
}

interface Props {
  seasonId: number
  planStatus: BudgetPlanStatus | undefined
  /** 활성 ExpenseCategory 전체. scope 필터는 wizard 내부에서 처리. */
  categories: ExpenseCategory[]
  /** BudgetPlan (Basic tier lookup 용). null 이면 basicCost = 0 fallback. */
  budgetPlan: BudgetPlan | null | undefined
  /**
   * 현재 사용자 컨텍스트. scope 판정 heuristic:
   *   coachingRole === 'HEAD_COACH' → TEAM
   *   그 외 → DEPARTMENT
   *   서버가 최종 판정하므로 UI 는 best-effort 로 필터.
   */
  currentUser: UserDto | null | undefined
  /** 테스트 주입용 — 프로덕션은 undefined 로 두고 sonner 로 fallback. */
  onSubmitSuccess?: () => void
}

/**
 * 상태별 안내 문구 (AWAITING_REVIEW 이외).
 */
const STATUS_MESSAGE: Record<BudgetPlanStatus, string> = {
  DRAFT: '심사 창 개방 대기',
  CAPACITY_FAILED: '예산 부족 — GM 알림 발송됨',
  AWAITING_REVIEW: '심사 진행 중',
  KNAPSACK_EXECUTED: '재무팀 확정 대기',
  AWAITING_GM_APPROVAL: 'GM 승인 대기',
  FINALIZED: '편성 확정',
  RE_PLANNING: 'GM 재편성 지시 — 새 심사 창 개방',
}

const STATUS_BADGE_CLASS: Record<BudgetPlanStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-900 border-slate-300',
  CAPACITY_FAILED: 'bg-rose-100 text-rose-900 border-rose-300',
  AWAITING_REVIEW: 'bg-blue-100 text-blue-900 border-blue-300',
  KNAPSACK_EXECUTED: 'bg-violet-100 text-violet-900 border-violet-300',
  AWAITING_GM_APPROVAL: 'bg-amber-100 text-amber-900 border-amber-300',
  FINALIZED: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  RE_PLANNING: 'bg-orange-100 text-orange-900 border-orange-300',
}

/**
 * 사용자 role 로부터 요청 스코프를 추정.
 * 최종 판정은 서버 (resolveRequesterScope) 가 하고, wizard 는 카테고리 필터에만 사용한다.
 */
export function inferRequesterScope(user: UserDto | null | undefined): CategoryScope | null {
  if (!user) return null
  if (user.coachingRole === 'HEAD_COACH') return 'TEAM'
  // FRONT_OFFICE 부서장 여부는 FE 에 노출된 정보가 없어 DEPARTMENT 로 낙관 처리.
  // 서버가 NOT_BUDGET_PLAN_REQUESTER (403) 로 걸러낸다.
  return 'DEPARTMENT'
}

/**
 * BudgetPlan.budgetCategoryPlans 에서 카테고리별 Basic tier cost 를 뽑는다.
 * BudgetCategoryPlan.category 는 code 문자열이라 code 로 조인한다.
 * Basic tier 가 없으면 0 반환 (자동화 예산 미실행 상태).
 */
export function basicCostByCategoryCode(plan: BudgetPlan | null | undefined): Map<string, number> {
  const m = new Map<string, number>()
  if (!plan) return m
  for (const cp of plan.budgetCategoryPlans) {
    const basic = cp.tiers.find((t) => t.name === 'Basic')
    m.set(cp.category, basic?.cost ?? 0)
  }
  return m
}

/**
 * localStorage 에서 draft 를 복원. 파싱 실패는 조용히 null 반환.
 */
function loadDraftFromStorage(seasonId: number): Record<number, PlanRequestLineDraft> | null {
  try {
    const raw = window.localStorage.getItem(draftStorageKey(seasonId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as Record<number, PlanRequestLineDraft>
    return null
  } catch {
    return null
  }
}

function saveDraftToStorage(seasonId: number, lineMap: Record<number, PlanRequestLineDraft>): void {
  try {
    window.localStorage.setItem(draftStorageKey(seasonId), JSON.stringify(lineMap))
  } catch {
    // Storage quota / disabled — 조용히 무시.
  }
}

function clearDraftFromStorage(seasonId: number): void {
  try {
    window.localStorage.removeItem(draftStorageKey(seasonId))
  } catch {
    // ignore
  }
}

/**
 * 라인이 "비어 있는가" 판정. 트리거 0 개 + 델타 두 개 모두 0/빈 문자열이면 drop.
 */
export function isEmptyLine(line: PlanRequestLineDraft): boolean {
  if (line.triggers.length > 0) return false
  const std = parseFloat(line.standardDelta || '0')
  const prem = parseFloat(line.premiumDelta || '0')
  if (Number.isFinite(std) && std !== 0) return false
  if (Number.isFinite(prem) && prem !== 0) return false
  return true
}

/**
 * TODO(#428): 실 PlanStatusBadge 로 교체.
 * placeholder — 배포 시점에 #428 이 아직 안 들어왔을 가능성 대비.
 */
function PlanStatusBadgePlaceholder({ status }: { status: BudgetPlanStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn('border', STATUS_BADGE_CLASS[status])}
      data-plan-status={status}
      title={STATUS_MESSAGE[status]}
    >
      {status}
    </Badge>
  )
}

/**
 * 팀장/부서장 편성 요청 wizard.
 *
 * planStatus 별 동작:
 *   - AWAITING_REVIEW: wizard 오픈. 카테고리 스코프 필터 → 5개/페이지 페이지네이션 → 제출
 *   - 그 외: read-only 요약 카드 + 상태 안내 문구
 *
 * localStorage 임시저장:
 *   - key = budget-plan-wizard:draft:{seasonId}
 *   - 라인 변경 시마다 저장, 마운트 시 복원, submit 성공 후 clear
 */
export function BudgetPlanWizard({
  seasonId,
  planStatus,
  categories,
  budgetPlan,
  currentUser,
  onSubmitSuccess,
}: Props) {
  const submitMutation = useSubmitPlanRequest(seasonId)

  const requesterScope = useMemo(() => inferRequesterScope(currentUser), [currentUser])

  // scope 필터 후 활성 카테고리만 렌더.
  const scopedCategories = useMemo(() => {
    const activeOnly = categories.filter((c) => c.isActive)
    if (!requesterScope) return activeOnly
    return activeOnly.filter((c) => !c.scope || c.scope === requesterScope)
  }, [categories, requesterScope])

  const basicCostMap = useMemo(() => basicCostByCategoryCode(budgetPlan ?? null), [budgetPlan])

  // 초기 draft 상태: localStorage 우선, 없으면 emptyLine.
  const [restoredFromStorage, setRestoredFromStorage] = useState(false)
  const [lineMap, setLineMap] = useState<Record<number, PlanRequestLineDraft>>(() => {
    const stored = loadDraftFromStorage(seasonId)
    if (stored) return stored
    return {}
  })

  // 마운트 시 복원 알림 표시 (한 번만).
  useEffect(() => {
    const stored = loadDraftFromStorage(seasonId)
    if (stored && Object.keys(stored).length > 0) {
      setRestoredFromStorage(true)
    }
    // seasonId 변경 시에도 재확인.
  }, [seasonId])

  // 라인 변경 시 localStorage 저장 (auto-save).
  useEffect(() => {
    if (Object.keys(lineMap).length === 0) return
    saveDraftToStorage(seasonId, lineMap)
  }, [seasonId, lineMap])

  // scope 카테고리가 확정되면 아직 lineMap 에 없는 카테고리 id 에 emptyLine 을 채워 넣는다.
  // (초기 렌더 후 categories 가 뒤늦게 로드되는 케이스 커버.)
  useEffect(() => {
    if (scopedCategories.length === 0) return
    setLineMap((prev) => {
      let changed = false
      const next = { ...prev }
      for (const c of scopedCategories) {
        if (!next[c.id]) {
          next[c.id] = emptyLine(c.id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [scopedCategories])

  const setLine = useCallback((categoryId: number, line: PlanRequestLineDraft) => {
    setLineMap((prev) => ({ ...prev, [categoryId]: line }))
  }, [])

  // 페이지네이션 — 5개/페이지.
  const [pageIndex, setPageIndex] = useState(0)
  const categoryPages = useMemo(() => {
    const pages: ExpenseCategory[][] = []
    for (let i = 0; i < scopedCategories.length; i += CATEGORIES_PER_PAGE) {
      pages.push(scopedCategories.slice(i, i + CATEGORIES_PER_PAGE))
    }
    return pages
  }, [scopedCategories])

  const totalPages = Math.max(1, categoryPages.length)
  const isLast = pageIndex === totalPages - 1
  const isFirst = pageIndex === 0
  const currentPage = categoryPages[pageIndex] ?? []

  const handleSubmit = useCallback(async () => {
    const lines = Object.values(lineMap).filter((l) => !isEmptyLine(l))
    if (lines.length === 0) {
      toast.error('제출할 라인이 없습니다 — 트리거를 하나 이상 선택하거나 델타를 입력하세요.')
      return
    }
    try {
      await submitMutation.mutateAsync(lines)
      clearDraftFromStorage(seasonId)
      setLineMap({})
      setRestoredFromStorage(false)
      toast.success('편성 요청이 접수되었습니다')
      onSubmitSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '제출 실패'
      toast.error(msg)
    }
  }, [lineMap, submitMutation, seasonId, onSubmitSuccess])

  // --- Non-AWAITING_REVIEW: read-only summary ---
  if (planStatus !== 'AWAITING_REVIEW') {
    // FINALIZED 상태에서만 카테고리별 이의 신청이 가능하다.
    // 백엔드 `override.service.ts:24` 가 planStatus === 'FINALIZED' 를 강제하므로
    // FE 도 UI 진입을 그 상태로 제한한다. 스코프는 role 로 추정한 requesterScope 를
    // 사용 (팀장 → TEAM, 부서장 → DEPARTMENT).
    const canRequestOverride =
      planStatus === 'FINALIZED' && requesterScope != null

    return (
      <Card data-testid="wizard-readonly" data-plan-status={planStatus ?? 'UNKNOWN'}>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <CardTitle className="text-base flex-1">편성 워크플로우</CardTitle>
          {planStatus && <PlanStatusBadgePlaceholder status={planStatus} />}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {planStatus ? STATUS_MESSAGE[planStatus] : '상태 정보를 불러오는 중...'}
          </p>
          {canRequestOverride && (
            <div
              className="flex flex-col gap-1"
              data-testid="wizard-override-section"
            >
              <p className="text-xs text-muted-foreground">
                확정된 편성에 대해 카테고리별로 이의 신청을 제출할 수 있습니다.
                재무담당(FM) 승인 후 knapsackAllocated 가 자동 조정됩니다.
              </p>
              <OverrideRequestDialog
                seasonId={seasonId}
                scope={requesterScope!}
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="wizard-override-request-btn"
                  >
                    카테고리별 이의 신청
                  </Button>
                }
              />
            </div>
          )}
          {/* TODO(#428): PlanStatusBadge + 상세 액션 카드로 교체 */}
        </CardContent>
      </Card>
    )
  }

  // --- AWAITING_REVIEW: wizard ---
  if (scopedCategories.length === 0) {
    return (
      <Card data-testid="wizard-empty">
        <CardHeader>
          <CardTitle className="text-base">편성 요청</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            요청 가능한 카테고리가 없습니다.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4" data-testid="wizard-open" data-plan-status="AWAITING_REVIEW">
      {/* Header + progress */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <PlanStatusBadgePlaceholder status="AWAITING_REVIEW" />
        <span className="font-medium">{pageIndex + 1}</span>
        <span>/</span>
        <span>{totalPages}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((pageIndex + 1) / totalPages) * 100}%` }}
          />
        </div>
      </div>

      {/* Restore notice */}
      {restoredFromStorage && (
        <div
          role="status"
          data-testid="restored-notice"
          className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
        >
          임시저장 복원됨
        </div>
      )}

      {/* Category editors */}
      <div className="space-y-4">
        {currentPage.map((c) => {
          const line = lineMap[c.id] ?? emptyLine(c.id)
          const basic = basicCostMap.get(c.code) ?? 0
          const scope = c.scope ?? requesterScope ?? 'TEAM'
          return (
            <CategoryEditor
              key={c.id}
              category={{
                id: c.id,
                code: c.code,
                label: c.label,
                scope,
              }}
              basicCost={basic}
              line={line}
              onChange={(next) => setLine(c.id, next)}
              disabled={submitMutation.isPending}
            />
          )
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => setPageIndex((i) => Math.max(i - 1, 0))}
          disabled={isFirst || submitMutation.isPending}
          data-testid="wizard-prev"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          이전
        </Button>
        {isLast ? (
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            data-testid="wizard-submit"
          >
            <Check className="h-4 w-4 mr-1" />
            {submitMutation.isPending ? '제출 중...' : '제출'}
          </Button>
        ) : (
          <Button
            onClick={() => setPageIndex((i) => Math.min(i + 1, totalPages - 1))}
            disabled={submitMutation.isPending}
            data-testid="wizard-next"
          >
            다음
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
