import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { PlanRequestLineDraft, TriggerType } from '@/components/budget-plan/types'
import { financialReportApi, type FinancialReport } from './financial-report.service'
import { budgetPlanApi as budgetPlanFRApi } from './financial-report.service'
import type { BudgetPlan } from '@/types/budget'

// ============================================================================
// Wire types — mirror apps/api/src/budget-plan/*.ts
// ============================================================================

/**
 * FinancialReport.planStatus 상태 머신 (백엔드 Prisma enum BudgetPlanStatus).
 * FE 는 UI 표시/전이 가능 액션 판정 용도로만 소비한다.
 *
 * 백엔드 enum (schema.prisma):
 *   DRAFT | CAPACITY_FAILED | AWAITING_REVIEW | KNAPSACK_EXECUTED
 *   | AWAITING_GM_APPROVAL | FINALIZED | RE_PLANNING
 *
 * CAPACITY_FAILED 는 편성 시작 시 가용 예산 부족 (트리거 X capacity 검증 실패).
 * RE_PLANNING 은 GM 이 FINALIZED 이후 재편성을 결정한 임시 상태.
 */
export type BudgetPlanStatus =
  | 'DRAFT'
  | 'CAPACITY_FAILED'
  | 'AWAITING_REVIEW'
  | 'KNAPSACK_EXECUTED'
  | 'AWAITING_GM_APPROVAL'
  | 'FINALIZED'
  | 'RE_PLANNING'

/** BudgetPlanRequest.status */
export type BudgetPlanRequestStatus = 'DRAFT' | 'SUBMITTED' | 'PROCESSED'

/** BudgetOverrideLog.status */
export type BudgetOverrideStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/**
 * Wire line — 서버가 삼키는 최종 payload shape.
 * PlanRequestLineDraft (문자열 delta) 는 UI 편의용이라 submit 직전에 이 shape 로 변환한다.
 */
export interface SubmitLineDto {
  categoryId: number
  triggers: TriggerType[]
  standardDelta: number
  premiumDelta: number
  evidenceUrl?: string
  comment?: string
}

/**
 * 리스트 조회 응답 (`GET /financial-reports/:seasonId/plan-requests`).
 * 서버는 `include: { lines: true }` 로 반환한다.
 */
export interface BudgetPlanRequestLineDto {
  id: number
  requestId: number
  categoryId: number
  triggers: TriggerType[]
  standardDelta: number
  premiumDelta: number
  evidenceUrl: string | null
  comment: string | null
  createdAt: string
}

export interface BudgetPlanRequestDto {
  id: number
  financialReportId: number
  requestedById: number
  scope: 'TEAM' | 'DEPARTMENT'
  ownerType: string
  ownerId: number
  status: BudgetPlanRequestStatus
  submittedAt: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
  lines: BudgetPlanRequestLineDto[]
}

export interface OverrideRequestDto {
  categoryId: number
  amount: number
  reason: string
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * PlanRequestLineDraft (문자열 form state) → wire SubmitLineDto (숫자).
 * 빈 문자열은 0 으로 변환. NaN 방어는 여기서 처리한다.
 */
function draftLineToWire(draft: PlanRequestLineDraft): SubmitLineDto {
  const std = parseInt(draft.standardDelta, 10)
  const prem = parseInt(draft.premiumDelta, 10)
  return {
    categoryId: draft.categoryId,
    triggers: draft.triggers,
    standardDelta: Number.isFinite(std) ? std : 0,
    premiumDelta: Number.isFinite(prem) ? prem : 0,
    ...(draft.evidenceUrl ? { evidenceUrl: draft.evidenceUrl } : {}),
    ...(draft.comment ? { comment: draft.comment } : {}),
  }
}

// ============================================================================
// Service — 9 endpoint wrappers
// ============================================================================

/**
 * 편성 워크플로우 서비스. 백엔드 `apps/api/src/budget-plan/plan-request.routes.ts`
 * 의 9 개 라우트를 감싼다. 응답 body 는 axios .data 랩핑 없이 그대로 반환
 * (football 서비스 관례).
 *
 * 상태 전이 요약 (spec 2026-08-29):
 *   DRAFT --openReview--> AWAITING_REVIEW
 *   AWAITING_REVIEW --submitPlanRequest--> (팀장/부서장 신청 누적)
 *   AWAITING_REVIEW --executeKnapsack--> KNAPSACK_EXECUTED
 *   KNAPSACK_EXECUTED --finalize--> FINALIZED (또는 self-approval 시 AWAITING_GM_APPROVAL)
 *   AWAITING_GM_APPROVAL --gmApprove--> FINALIZED
 *   FINALIZED --rePlan--> AWAITING_REVIEW
 *   FINALIZED --requestOverride--> BudgetOverrideLog(PENDING)
 *   PENDING --reviewOverride--> APPROVED | REJECTED
 */
export const budgetPlanApi = {
  /** FM: DRAFT → AWAITING_REVIEW, 14 일 심사창 개방. 204. */
  openReview: (seasonId: number) =>
    api.post<void>(`/financial-reports/${seasonId}/open-review`, {}),

  /**
   * 팀장/부서장: 편성 신청서 제출 (스코프 자동 판정).
   * PlanRequestLineDraft 는 UI form state (string delta) — wire 로 변환해서 보낸다.
   * 서버는 body.lines 만 소비하며 scope/ownerType/ownerId 는 요청자 컨텍스트에서 유추한다.
   */
  submitPlanRequest: (seasonId: number, lines: PlanRequestLineDraft[]) => {
    const wireLines = lines.map(draftLineToWire)
    return api.post<BudgetPlanRequestDto>(
      `/financial-reports/${seasonId}/plan-requests`,
      { lines: wireLines },
    )
  },

  /** FM: 심사 신청 현황 조회. lines include. */
  listPlanRequests: (seasonId: number) =>
    api.get<BudgetPlanRequestDto[]>(
      `/financial-reports/${seasonId}/plan-requests`,
    ),

  /** FM: knapsack 실행 (마감 or 전원 신청 후). AWAITING_REVIEW → KNAPSACK_EXECUTED. 204. */
  executeKnapsack: (seasonId: number) =>
    api.post<void>(`/financial-reports/${seasonId}/execute-knapsack`, {}),

  /**
   * FM: KNAPSACK_EXECUTED → FINALIZED (또는 self-approval 시 AWAITING_GM_APPROVAL).
   * 204.
   */
  finalize: (seasonId: number) =>
    api.post<void>(`/financial-reports/${seasonId}/finalize`, {}),

  /** GM: AWAITING_GM_APPROVAL → FINALIZED. 204. */
  gmApprove: (seasonId: number) =>
    api.post<void>(`/financial-reports/${seasonId}/gm-approve`, {}),

  /** GM: FINALIZED → AWAITING_REVIEW 재개방 (reason 필수). 204. */
  rePlan: (seasonId: number, reason: string) =>
    api.post<void>(`/financial-reports/${seasonId}/re-plan`, { reason }),

  /**
   * FINALIZED 상태에서 이의 신청 (팀장/부서장 스코프 검증).
   * 반환: `{ id }` — 생성된 BudgetOverrideLog.id. 201.
   */
  requestOverride: (
    seasonId: number,
    dto: OverrideRequestDto,
  ) =>
    api.post<{ id: number }>(
      `/financial-reports/${seasonId}/override-request`,
      dto,
    ),

  /**
   * FM: BudgetOverrideLog 심사. APPROVED 시 capacity 재검증 후 knapsackAllocated
   * 를 dto.amount 로 대체한다. 204.
   */
  reviewOverride: (
    logId: number,
    decision: 'APPROVED' | 'REJECTED',
    note?: string,
  ) =>
    api.post<void>(`/budget-override-logs/${logId}/review`, {
      decision,
      ...(note !== undefined ? { note } : {}),
    }),
}

// ============================================================================
// React Query — hooks + query keys
// ============================================================================

/**
 * Query key 계층. FR-스코프의 mutation 은 항상 세 계열을 함께 invalidate 해야 한다.
 * (재무보고서 자체 상태 planStatus 변화 + plan-request 리스트 갱신 + BudgetPlan 재조회).
 */
export const budgetPlanKeys = {
  requests: (seasonId: number) =>
    ['budget-plan', 'requests', seasonId] as const,
  financialReport: (seasonId: number) =>
    ['financial-report', seasonId] as const,
  budgetPlan: (seasonId: number) =>
    ['budget-plan', 'plan', seasonId] as const,
}

/**
 * seasonId 스코프 mutation 이 성공했을 때 관련 캐시를 한 번에 무효화한다.
 * 개별 훅에서 `onSuccess: () => invalidateSeason(qc, seasonId)` 형태로 재사용.
 */
function invalidateSeason(
  qc: ReturnType<typeof useQueryClient>,
  seasonId: number,
) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: budgetPlanKeys.requests(seasonId) }),
    qc.invalidateQueries({ queryKey: budgetPlanKeys.financialReport(seasonId) }),
    qc.invalidateQueries({ queryKey: budgetPlanKeys.budgetPlan(seasonId) }),
  ])
}

/**
 * 편성 워크플로우 UI 가 소비하는 FinancialReport (planStatus 포함) 조회.
 * seasonId 가 falsy 인 경우 자동 disable.
 */
export function useFinancialReport(seasonId: number | null | undefined) {
  return useQuery<FinancialReport | null>({
    queryKey: budgetPlanKeys.financialReport(seasonId ?? 0),
    queryFn: async () => {
      try {
        return await financialReportApi.get(seasonId as number)
      } catch {
        // 404 (미생성) 를 null 로 흡수 — 상태별 UI 분기를 상위에서 처리.
        return null
      }
    },
    enabled: Number.isFinite(seasonId as number) && (seasonId as number) > 0,
    staleTime: 60 * 1000,
  })
}

/**
 * BudgetPlan (BudgetCategoryPlan + tiers) 조회.
 * 팀장 wizard 는 basicCost (name === "Basic" tier cost) 만 필요하지만
 * 확장 여지를 위해 전체 plan 을 캐시한다.
 */
export function useBudgetPlan(seasonId: number | null | undefined) {
  return useQuery<BudgetPlan | null>({
    queryKey: budgetPlanKeys.budgetPlan(seasonId ?? 0),
    queryFn: async () => {
      try {
        return await budgetPlanFRApi.get(seasonId as number)
      } catch {
        return null
      }
    },
    enabled: Number.isFinite(seasonId as number) && (seasonId as number) > 0,
    staleTime: 60 * 1000,
  })
}

export function useOpenReview(seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => budgetPlanApi.openReview(seasonId),
    onSuccess: () => invalidateSeason(qc, seasonId),
  })
}

export function useSubmitPlanRequest(seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lines: PlanRequestLineDraft[]) =>
      budgetPlanApi.submitPlanRequest(seasonId, lines),
    onSuccess: () => invalidateSeason(qc, seasonId),
  })
}

/**
 * 심사 신청 현황 리스트 조회. FM 화면에서 5 분 stale 로 poll.
 * seasonId 가 falsy 인 경우 자동 disable.
 */
export function usePlanRequests(seasonId: number | null | undefined) {
  return useQuery({
    queryKey: budgetPlanKeys.requests(seasonId ?? 0),
    queryFn: () => budgetPlanApi.listPlanRequests(seasonId as number),
    enabled: Number.isFinite(seasonId as number) && (seasonId as number) > 0,
    staleTime: 5 * 60 * 1000,
  })
}

export function useExecuteKnapsack(seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => budgetPlanApi.executeKnapsack(seasonId),
    onSuccess: () => invalidateSeason(qc, seasonId),
  })
}

export function useFinalize(seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => budgetPlanApi.finalize(seasonId),
    onSuccess: () => invalidateSeason(qc, seasonId),
  })
}

export function useGmApprove(seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => budgetPlanApi.gmApprove(seasonId),
    onSuccess: () => invalidateSeason(qc, seasonId),
  })
}

export function useRePlan(seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => budgetPlanApi.rePlan(seasonId, reason),
    onSuccess: () => invalidateSeason(qc, seasonId),
  })
}

export function useRequestOverride(seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: OverrideRequestDto) =>
      budgetPlanApi.requestOverride(seasonId, dto),
    onSuccess: () => invalidateSeason(qc, seasonId),
  })
}

/**
 * reviewOverride 는 logId 기반이라 seasonId 를 즉시 알 수 없다.
 * 호출측에서 관련 seasonId 를 알고 있으므로 mutation variable 에 담아 넘기고
 * onSuccess 에서 그 seasonId 로 invalidate 한다.
 */
export interface ReviewOverrideVars {
  logId: number
  decision: 'APPROVED' | 'REJECTED'
  note?: string
  /** 결과 반영을 위한 seasonId — 호출측이 알고 있어야 한다. */
  seasonId: number
}

export function useReviewOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ logId, decision, note }: ReviewOverrideVars) =>
      budgetPlanApi.reviewOverride(logId, decision, note),
    onSuccess: (_data, { seasonId }) => invalidateSeason(qc, seasonId),
  })
}
