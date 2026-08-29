/**
 * FinanceManagerReview unit tests.
 *
 * Runner: vitest + @testing-library/react. football/package.json 에 아직 test
 * runner 가 설치되어 있지 않지만 (형제 컴포넌트 테스트와 동일한 상황), 러너가
 * 도입되는 순간 이 파일은 그대로 통과해야 한다. tsconfig.app.json 이
 * __tests__ 를 exclude 하므로 프로덕션 typecheck 는 깨지 않는다.
 *
 * 검증 항목 (issue #429 Acceptance 매핑):
 *   1) 신청 현황이 owner (scope + id) 기준으로 그룹핑되어 렌더된다.
 *   2) planStatus 별 4 개 액션 버튼의 enable/disable 규칙이 정확하다.
 *   3) KNAPSACK_EXECUTED + FM 본인 신청 존재 시 self-approval 경고가 노출된다.
 *   4) 재편성 Dialog 가 열리고, reason 이 비면 실행 버튼이 비활성.
 *   5) mutation 이 서버 코드로 실패하면 mapped 한국어 toast 문구가 전달된다.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FinanceManagerReview } from '../FinanceManagerReview'
import type {
  BudgetPlanRequestDto,
  BudgetPlanStatus,
} from '@/services/budget-plan.service'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// service 훅을 통째로 mock. mutation 은 스파이 함수를 리턴해서 컴포넌트가
// mutate(undefined, { onError }) 를 부를 때 실제 콜백을 실행할 수 있도록 한다.
// ---------------------------------------------------------------------------
type MutateFn = (
  vars: unknown,
  opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void },
) => void

interface MockMutation {
  mutate: ReturnType<typeof vi.fn<Parameters<MutateFn>, void>>
  isPending: boolean
}

const openReviewMock: MockMutation = { mutate: vi.fn(), isPending: false }
const executeKnapsackMock: MockMutation = { mutate: vi.fn(), isPending: false }
const finalizeMock: MockMutation = { mutate: vi.fn(), isPending: false }
const rePlanMock: MockMutation = { mutate: vi.fn(), isPending: false }

let mockRequests: BudgetPlanRequestDto[] = []
let mockRequestsLoading = false
let mockRequestsError: Error | null = null

vi.mock('@/services/budget-plan.service', () => ({
  useOpenReview: () => openReviewMock,
  useExecuteKnapsack: () => executeKnapsackMock,
  useFinalize: () => finalizeMock,
  useRePlan: () => rePlanMock,
  usePlanRequests: () => ({
    data: mockRequests,
    isLoading: mockRequestsLoading,
    isError: mockRequestsError !== null,
    error: mockRequestsError,
  }),
}))

// useCurrentUser: FM(id=42) 를 기본으로 반환. 테스트마다 재할당 가능.
let mockCurrentUserId: number | null = 42
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user:
      mockCurrentUserId == null
        ? null
        : {
            id: mockCurrentUserId,
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

// useExpenseCategories: 두 개의 dummy category 만.
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

// sonner toast — 스파이만.
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
function makeRequest(
  overrides: Partial<BudgetPlanRequestDto> = {},
): BudgetPlanRequestDto {
  return {
    id: 1,
    financialReportId: 100,
    requestedById: 11,
    scope: 'TEAM',
    ownerType: 'TEAM',
    ownerId: 7,
    status: 'SUBMITTED',
    submittedAt: '2026-08-29T10:00:00.000Z',
    processedAt: null,
    createdAt: '2026-08-29T09:00:00.000Z',
    updatedAt: '2026-08-29T10:00:00.000Z',
    lines: [
      {
        id: 501,
        requestId: 1,
        categoryId: 101,
        triggers: ['MULTI_LOCATION'],
        standardDelta: 1000,
        premiumDelta: 0,
        evidenceUrl: null,
        comment: null,
        createdAt: '2026-08-29T10:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

function renderReview(
  planStatus: BudgetPlanStatus | 'CAPACITY_FAILED' | 'RE_PLANNING',
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
  openReviewMock.isPending = false
  executeKnapsackMock.isPending = false
  finalizeMock.isPending = false
  rePlanMock.isPending = false
  mockRequests = []
  mockRequestsLoading = false
  mockRequestsError = null
  mockCurrentUserId = 42
  toastError.mockReset()
  toastSuccess.mockReset()
})

// ---------------------------------------------------------------------------
// (1) 신청 현황 그룹핑 + 라인 렌더
// ---------------------------------------------------------------------------
describe('FinanceManagerReview — 신청 현황 렌더', () => {
  it('scope + ownerId 로 그룹핑해 owner 별 카드가 렌더된다', () => {
    mockRequests = [
      makeRequest({ id: 1, scope: 'TEAM', ownerId: 7, requestedById: 11 }),
      makeRequest({ id: 2, scope: 'TEAM', ownerId: 7, requestedById: 11 }),
      makeRequest({ id: 3, scope: 'DEPARTMENT', ownerId: 3, requestedById: 22 }),
    ]

    renderReview('AWAITING_REVIEW')

    const teamGroup = screen.getByText('팀 #7').closest('[data-owner-group]')
    expect(teamGroup).not.toBeNull()
    // 같은 owner 아래에 2 개의 request block
    expect(
      teamGroup?.querySelectorAll('[data-request-id]').length,
    ).toBe(2)

    // DEPARTMENT 그룹은 별개
    expect(screen.getByText('부서 #3')).toBeTruthy()
  })

  it('라인의 카테고리 라벨과 트리거 chip 이 노출된다', () => {
    mockRequests = [
      makeRequest({
        lines: [
          {
            id: 501,
            requestId: 1,
            categoryId: 101,
            triggers: ['MULTI_LOCATION', 'HOME_MATCH'],
            standardDelta: 3000,
            premiumDelta: 1500,
            evidenceUrl: 'https://example.com/doc',
            comment: '심사에 참고할 사유',
            createdAt: '2026-08-29T10:00:00.000Z',
          },
        ],
      }),
    ]

    renderReview('AWAITING_REVIEW')

    // 카테고리 라벨 (mock labelOf → '공공요금')
    expect(screen.getByText('공공요금')).toBeTruthy()
    // 트리거 chip 2 종
    expect(screen.getByText('다중거점 관리')).toBeTruthy()
    expect(screen.getByText('홈경기 현장지원')).toBeTruthy()
    // 증빙 URL 링크
    const link = screen.getByRole('link', { name: '링크' })
    expect(link.getAttribute('href')).toBe('https://example.com/doc')
    // 메모 truncated with title tooltip
    const comment = screen.getByText('심사에 참고할 사유')
    expect(comment.getAttribute('title')).toBe('심사에 참고할 사유')
  })

  it('신청이 없으면 빈 상태 문구가 표시된다', () => {
    mockRequests = []
    renderReview('DRAFT')
    expect(screen.getByTestId('requests-empty')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// (2) planStatus 별 액션 버튼 활성/비활성
// ---------------------------------------------------------------------------
describe('FinanceManagerReview — 액션 버튼 규칙', () => {
  const cases: Array<{
    status: BudgetPlanStatus | 'CAPACITY_FAILED' | 'RE_PLANNING'
    requests: BudgetPlanRequestDto[]
    expected: {
      openReview: boolean
      knapsack: boolean
      finalize: boolean
      rePlan: boolean
    }
  }> = [
    {
      status: 'DRAFT',
      requests: [],
      expected: { openReview: true, knapsack: false, finalize: false, rePlan: false },
    },
    {
      status: 'AWAITING_REVIEW',
      requests: [makeRequest()],
      expected: { openReview: false, knapsack: true, finalize: false, rePlan: false },
    },
    {
      // AWAITING_REVIEW 이지만 request 0 → knapsack 비활성
      status: 'AWAITING_REVIEW',
      requests: [],
      expected: { openReview: false, knapsack: false, finalize: false, rePlan: false },
    },
    {
      status: 'KNAPSACK_EXECUTED',
      requests: [makeRequest()],
      expected: { openReview: false, knapsack: false, finalize: true, rePlan: false },
    },
    {
      status: 'FINALIZED',
      requests: [],
      expected: { openReview: false, knapsack: false, finalize: false, rePlan: true },
    },
    {
      status: 'AWAITING_GM_APPROVAL',
      requests: [makeRequest()],
      expected: { openReview: false, knapsack: false, finalize: false, rePlan: false },
    },
  ]

  cases.forEach(({ status, requests, expected }) => {
    it(`${status} + ${requests.length}건 → openReview=${expected.openReview}, knapsack=${expected.knapsack}, finalize=${expected.finalize}, rePlan=${expected.rePlan}`, () => {
      mockRequests = requests
      renderReview(status)

      const openReviewBtn = screen.getByTestId('btn-open-review') as HTMLButtonElement
      const knapsackBtn = screen.getByTestId('btn-execute-knapsack') as HTMLButtonElement
      const finalizeBtn = screen.getByTestId('btn-finalize') as HTMLButtonElement
      const rePlanBtn = screen.getByTestId('btn-re-plan') as HTMLButtonElement

      expect(openReviewBtn.disabled).toBe(!expected.openReview)
      expect(knapsackBtn.disabled).toBe(!expected.knapsack)
      expect(finalizeBtn.disabled).toBe(!expected.finalize)
      expect(rePlanBtn.disabled).toBe(!expected.rePlan)
    })
  })
})

// ---------------------------------------------------------------------------
// (3) Self-approval 경고
// ---------------------------------------------------------------------------
describe('FinanceManagerReview — self-approval 경고', () => {
  it('KNAPSACK_EXECUTED 이고 현재 FM 이 신청자 리스트에 있으면 경고를 노출한다', () => {
    mockCurrentUserId = 42
    mockRequests = [
      makeRequest({ id: 1, requestedById: 42, scope: 'DEPARTMENT', ownerId: 3 }),
    ]
    renderReview('KNAPSACK_EXECUTED')
    expect(screen.getByTestId('self-approval-warning')).toBeTruthy()
    // 확정 버튼은 여전히 enabled
    const finalizeBtn = screen.getByTestId('btn-finalize') as HTMLButtonElement
    expect(finalizeBtn.disabled).toBe(false)
  })

  it('현재 FM 이 신청자에 없으면 경고를 노출하지 않는다', () => {
    mockCurrentUserId = 42
    mockRequests = [makeRequest({ requestedById: 11 })]
    renderReview('KNAPSACK_EXECUTED')
    expect(screen.queryByTestId('self-approval-warning')).toBeNull()
  })

  it('planStatus 가 KNAPSACK_EXECUTED 가 아니면 경고를 노출하지 않는다', () => {
    mockCurrentUserId = 42
    mockRequests = [makeRequest({ requestedById: 42 })]
    renderReview('AWAITING_REVIEW')
    expect(screen.queryByTestId('self-approval-warning')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// (4) 재편성 Dialog
// ---------------------------------------------------------------------------
describe('FinanceManagerReview — 재편성 Dialog', () => {
  it('재편성 버튼 클릭 시 Dialog 가 열리고, reason 이 비면 실행 버튼이 비활성이다', () => {
    renderReview('FINALIZED')
    fireEvent.click(screen.getByTestId('btn-re-plan'))

    const submitBtn = screen.getByTestId('re-plan-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
    // reason 입력 → 활성화
    const textarea = screen.getByLabelText(/사유/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '월드컵 특수 반영' } })
    expect(submitBtn.disabled).toBe(false)
  })

  it('실행 버튼 클릭 시 rePlan.mutate 가 reason 과 함께 호출된다', () => {
    renderReview('FINALIZED')
    fireEvent.click(screen.getByTestId('btn-re-plan'))
    const textarea = screen.getByLabelText(/사유/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '스폰서 계약 변경' } })
    fireEvent.click(screen.getByTestId('re-plan-submit'))
    expect(rePlanMock.mutate).toHaveBeenCalledTimes(1)
    expect(rePlanMock.mutate.mock.calls[0]![0]).toBe('스폰서 계약 변경')
  })
})

// ---------------------------------------------------------------------------
// (5) 에러 코드 → 한국어 toast
// ---------------------------------------------------------------------------
describe('FinanceManagerReview — 에러 코드 매핑', () => {
  it('INVALID_PLAN_STATUS_TRANSITION → 상태 전이 실패 안내', () => {
    // openReview 를 DRAFT 에서 트리거하고, mutate 콜백이 onError 를 호출하도록 설정
    openReviewMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('INVALID_PLAN_STATUS_TRANSITION'))
    })
    renderReview('DRAFT')
    fireEvent.click(screen.getByTestId('btn-open-review'))
    expect(toastError).toHaveBeenCalledWith(
      '지금은 이 액션을 실행할 수 없습니다 (상태 전이 실패)',
    )
  })

  it('SELF_APPROVAL_REQUIRES_GM → 본인 신청 확정은 GM 승인이 필요합니다', () => {
    finalizeMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('SELF_APPROVAL_REQUIRES_GM'))
    })
    mockRequests = [makeRequest()]
    renderReview('KNAPSACK_EXECUTED')
    fireEvent.click(screen.getByTestId('btn-finalize'))
    expect(toastError).toHaveBeenCalledWith('본인 신청 확정은 GM 승인이 필요합니다')
  })

  it('KNAPSACK_CAPACITY_FAILED → 예산 부족 안내', () => {
    executeKnapsackMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('KNAPSACK_CAPACITY_FAILED'))
    })
    mockRequests = [makeRequest()]
    renderReview('AWAITING_REVIEW')
    fireEvent.click(screen.getByTestId('btn-execute-knapsack'))
    expect(toastError).toHaveBeenCalledWith('예산 부족 — GM 알림 발송됨')
  })

  it('매핑되지 않은 코드는 원문 그대로 표시된다', () => {
    executeKnapsackMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('SOMETHING_WEIRD'))
    })
    mockRequests = [makeRequest()]
    renderReview('AWAITING_REVIEW')
    fireEvent.click(screen.getByTestId('btn-execute-knapsack'))
    expect(toastError).toHaveBeenCalledWith('SOMETHING_WEIRD')
  })
})

// ---------------------------------------------------------------------------
// (extra) 로딩·에러 상태
// ---------------------------------------------------------------------------
describe('FinanceManagerReview — 리스트 로딩/에러', () => {
  it('로딩 중에는 Skeleton 이 표시된다', () => {
    mockRequestsLoading = true
    renderReview('AWAITING_REVIEW')
    expect(screen.getByTestId('requests-loading')).toBeTruthy()
  })

  it('에러 시 에러 배너가 표시된다', () => {
    mockRequestsError = new Error('SERVER_ERROR')
    renderReview('AWAITING_REVIEW')
    const banner = screen.getByTestId('requests-error')
    expect(within(banner).getByText(/SERVER_ERROR/)).toBeTruthy()
  })
})
