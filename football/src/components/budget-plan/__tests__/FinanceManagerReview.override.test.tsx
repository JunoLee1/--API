/**
 * FinanceManagerReview — override 심사 확장 unit tests (issue #431).
 *
 * 검증 항목:
 *   1) PENDING BudgetOverrideLog 목록이 렌더된다 (카테고리, 금액, 사유, 신청자, 일시).
 *   2) [승인] 버튼 → OverrideReviewDialog (승인) → useReviewOverride.mutate 호출.
 *   3) [반려] 버튼 → OverrideReviewDialog (반려, note 필수) → mutate 호출.
 *   4) OVERRIDE_EXCEEDS_TOTAL_BUDGET 응답 시 한국어 toast.
 *   5) pending 이 0 이면 빈 문구 표시.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FinanceManagerReview } from '../FinanceManagerReview'
import type {
  BudgetOverrideLogDto,
  BudgetPlanRequestDto,
  BudgetPlanStatus,
} from '@/services/budget-plan.service'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
type MutateFn = (
  vars: unknown,
  opts?: {
    onSuccess?: (data: unknown) => void
    onError?: (err: unknown) => void
  },
) => void

interface MockMutation {
  mutate: ReturnType<typeof vi.fn<MutateFn>>
  isPending: boolean
}

const openReviewMock: MockMutation = { mutate: vi.fn(), isPending: false }
const executeKnapsackMock: MockMutation = { mutate: vi.fn(), isPending: false }
const finalizeMock: MockMutation = { mutate: vi.fn(), isPending: false }
const rePlanMock: MockMutation = { mutate: vi.fn(), isPending: false }
const reviewOverrideMock: MockMutation = { mutate: vi.fn(), isPending: false }

let mockRequests: BudgetPlanRequestDto[] = []
let mockPendingLogs: BudgetOverrideLogDto[] = []

vi.mock('@/services/budget-plan.service', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/services/budget-plan.service',
  )
  return {
    ...actual,
    useOpenReview: () => openReviewMock,
    useExecuteKnapsack: () => executeKnapsackMock,
    useFinalize: () => finalizeMock,
    useRePlan: () => rePlanMock,
    useReviewOverride: () => reviewOverrideMock,
    usePlanRequests: () => ({
      data: mockRequests,
      isLoading: false,
      isError: false,
      error: null,
    }),
    usePendingOverrideLogs: () => ({
      data: mockPendingLogs,
      isLoading: false,
      isError: false,
      error: null,
    }),
    // #451 상단 mm 관리 섹션 — override 테스트는 mm 을 검증하지 않음.
    useBudgetPlan: () => ({
      data: null,
      isLoading: false,
      isError: false,
    }),
  }
})

// mm 관리 섹션의 usePendingMinimums 도 스텁 (override 테스트 무관).
vi.mock('@/services/mandatory-minimum.service', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/services/mandatory-minimum.service',
  )
  return {
    ...actual,
    usePendingMinimums: () => ({
      data: [],
      isLoading: false,
      isError: false,
    }),
    usePendingMinimumsCount: () => 0,
  }
})

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      id: 42,
      email: 'fm@example.com',
      username: 'fm',
      nickname: 'FM',
      role: 'FRONT_OFFICE',
      coachingRole: null,
      frontOfficeRole: 'FINANCE_MANAGER',
      departmentCategories: [],
      teamId: null,
      clubId: null,
      isOutOfOffice: false,
      language: 'ko',
    },
    loading: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/useExpenseCategories', () => ({
  useExpenseCategories: () => ({
    rows: [
      { id: 101, code: 'utilities', label: '공공요금', sortOrder: 0, isActive: true },
      { id: 102, code: 'match_ops', label: '경기 운영', sortOrder: 1, isActive: true },
    ],
    loading: false,
    labelOf: (code: string) =>
      ({ utilities: '공공요금', match_ops: '경기 운영' })[code] ?? code,
  }),
}))

const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (msg: string) => toastError(msg),
    success: (msg: string) => toastSuccess(msg),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeLog(
  overrides: Partial<BudgetOverrideLogDto> = {},
): BudgetOverrideLogDto {
  return {
    id: 1,
    financialReportId: 100,
    categoryId: 101,
    amount: 500000,
    reason: '월드컵 특수 지출',
    status: 'PENDING',
    createdById: 88,
    createdAt: '2026-08-29T10:00:00.000Z',
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    expenseCategory: { code: 'utilities', label: '공공요금' },
    ...overrides,
  }
}

function renderReview(
  planStatus: BudgetPlanStatus | 'CAPACITY_FAILED' | 'RE_PLANNING' = 'FINALIZED',
) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <FinanceManagerReview seasonId={1} planStatus={planStatus} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  openReviewMock.mutate.mockReset()
  executeKnapsackMock.mutate.mockReset()
  finalizeMock.mutate.mockReset()
  rePlanMock.mutate.mockReset()
  reviewOverrideMock.mutate.mockReset()
  reviewOverrideMock.isPending = false
  mockRequests = []
  mockPendingLogs = []
  toastError.mockReset()
  toastSuccess.mockReset()
})

// ---------------------------------------------------------------------------
// (1) PENDING 리스트 렌더
// ---------------------------------------------------------------------------
describe('FinanceManagerReview — override PENDING 렌더', () => {
  it('PENDING 로그가 표에 렌더된다', () => {
    mockPendingLogs = [
      makeLog({ id: 1, amount: 1000000, reason: '월드컵 준비', createdById: 88 }),
      makeLog({
        id: 2,
        amount: 500000,
        reason: '홈경기 추가',
        createdById: 99,
        expenseCategory: { code: 'match_ops', label: '경기 운영' },
      }),
    ]
    renderReview('FINALIZED')

    const row1 = screen.getByTestId('override-approve-1').closest('tr')
    expect(row1).not.toBeNull()
    expect(row1?.textContent).toContain('공공요금')
    expect(row1?.textContent).toContain('₩1,000,000')
    expect(row1?.textContent).toContain('월드컵 준비')
    expect(row1?.textContent).toContain('#88')

    const row2 = screen.getByTestId('override-approve-2').closest('tr')
    expect(row2?.textContent).toContain('경기 운영')
    expect(row2?.textContent).toContain('₩500,000')
    expect(row2?.textContent).toContain('#99')
  })

  it('PENDING 로그가 없으면 빈 문구가 표시된다', () => {
    mockPendingLogs = []
    renderReview('FINALIZED')
    expect(screen.getByTestId('override-logs-empty')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// (2) 승인 flow
// ---------------------------------------------------------------------------
describe('FinanceManagerReview — 승인 flow', () => {
  it('[승인] 클릭 → dialog open → 제출 시 useReviewOverride.mutate 호출', () => {
    mockPendingLogs = [makeLog({ id: 7 })]
    renderReview('FINALIZED')

    fireEvent.click(screen.getByTestId('override-approve-7'))
    expect(screen.getByTestId('override-review-dialog')).toBeTruthy()
    // 승인은 note 없이도 활성
    const submitBtn = screen.getByTestId(
      'override-review-submit',
    ) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
    // 노트는 optional 이지만 입력 후 제출
    fireEvent.change(screen.getByTestId('override-review-note'), {
      target: { value: 'OK' },
    })
    fireEvent.click(submitBtn)

    expect(reviewOverrideMock.mutate).toHaveBeenCalledTimes(1)
    const [payload] = reviewOverrideMock.mutate.mock.calls[0]!
    expect(payload).toEqual({
      logId: 7,
      decision: 'APPROVED',
      note: 'OK',
      seasonId: 1,
    })
  })

  it('승인 시 note 미입력 이면 note undefined 로 전달된다', () => {
    mockPendingLogs = [makeLog({ id: 3 })]
    renderReview('FINALIZED')

    fireEvent.click(screen.getByTestId('override-approve-3'))
    fireEvent.click(screen.getByTestId('override-review-submit'))

    expect(reviewOverrideMock.mutate).toHaveBeenCalledTimes(1)
    const [payload] = reviewOverrideMock.mutate.mock.calls[0]!
    expect(payload).toMatchObject({
      logId: 3,
      decision: 'APPROVED',
      seasonId: 1,
    })
    // note undefined
    expect((payload as { note?: string }).note).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// (3) 반려 flow
// ---------------------------------------------------------------------------
describe('FinanceManagerReview — 반려 flow', () => {
  it('[반려] 클릭 → note 필수 → 미입력 시 제출 비활성', () => {
    mockPendingLogs = [makeLog({ id: 9 })]
    renderReview('FINALIZED')

    fireEvent.click(screen.getByTestId('override-reject-9'))
    const submitBtn = screen.getByTestId(
      'override-review-submit',
    ) as HTMLButtonElement
    // note 미입력 → 반려 비활성
    expect(submitBtn.disabled).toBe(true)
  })

  it('note 입력 후 반려 시 mutate 가 REJECTED 로 호출된다', () => {
    mockPendingLogs = [makeLog({ id: 9 })]
    renderReview('FINALIZED')

    fireEvent.click(screen.getByTestId('override-reject-9'))
    fireEvent.change(screen.getByTestId('override-review-note'), {
      target: { value: '예산 초과 우려' },
    })
    fireEvent.click(screen.getByTestId('override-review-submit'))

    expect(reviewOverrideMock.mutate).toHaveBeenCalledTimes(1)
    const [payload] = reviewOverrideMock.mutate.mock.calls[0]!
    expect(payload).toEqual({
      logId: 9,
      decision: 'REJECTED',
      note: '예산 초과 우려',
      seasonId: 1,
    })
  })
})

// ---------------------------------------------------------------------------
// (4) 에러 코드 매핑
// ---------------------------------------------------------------------------
describe('FinanceManagerReview — override 에러 코드 매핑', () => {
  it('OVERRIDE_EXCEEDS_TOTAL_BUDGET → 한국어 toast', () => {
    mockPendingLogs = [makeLog({ id: 42 })]
    renderReview('FINALIZED')

    reviewOverrideMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('OVERRIDE_EXCEEDS_TOTAL_BUDGET'))
    })

    fireEvent.click(screen.getByTestId('override-approve-42'))
    fireEvent.click(screen.getByTestId('override-review-submit'))

    expect(toastError).toHaveBeenCalledWith('총 예산 초과 — 승인 불가')
  })

  it('INVALID_OVERRIDE_STATUS_TRANSITION → 이미 심사된 안내', () => {
    mockPendingLogs = [makeLog({ id: 43 })]
    renderReview('FINALIZED')

    reviewOverrideMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('INVALID_OVERRIDE_STATUS_TRANSITION'))
    })

    fireEvent.click(screen.getByTestId('override-reject-43'))
    fireEvent.change(screen.getByTestId('override-review-note'), {
      target: { value: '사유' },
    })
    fireEvent.click(screen.getByTestId('override-review-submit'))

    expect(toastError).toHaveBeenCalledWith(
      '이미 심사된 이의 신청입니다 (다시 심사할 수 없음)',
    )
  })

  it('승인 성공 → 성공 toast', () => {
    mockPendingLogs = [makeLog({ id: 55 })]
    renderReview('FINALIZED')

    reviewOverrideMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.(undefined)
    })

    fireEvent.click(screen.getByTestId('override-approve-55'))
    fireEvent.click(screen.getByTestId('override-review-submit'))

    expect(toastSuccess).toHaveBeenCalledWith(
      '이의 신청이 승인되었습니다 — knapsackAllocated 가 조정됩니다',
    )
  })

  it('반려 성공 → 성공 toast', () => {
    mockPendingLogs = [makeLog({ id: 56 })]
    renderReview('FINALIZED')

    reviewOverrideMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.(undefined)
    })

    fireEvent.click(screen.getByTestId('override-reject-56'))
    fireEvent.change(screen.getByTestId('override-review-note'), {
      target: { value: '반려 사유' },
    })
    fireEvent.click(screen.getByTestId('override-review-submit'))

    expect(toastSuccess).toHaveBeenCalledWith('이의 신청이 반려되었습니다')
  })
})
