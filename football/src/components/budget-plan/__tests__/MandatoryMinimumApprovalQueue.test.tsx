/**
 * MandatoryMinimumApprovalQueue unit tests (issue #452).
 *
 * Runner: vitest + @testing-library/react. football/package.json 에 아직 test
 * runner 가 설치되어 있지 않지만 (형제 컴포넌트 테스트와 동일한 상황), 러너가
 * 도입되는 순간 이 파일은 그대로 통과해야 한다. tsconfig.app.json 이
 * __tests__ 를 exclude 하므로 프로덕션 typecheck 는 깨지 않는다.
 *
 * 검증 항목 (issue #452 Acceptance 매핑):
 *   1) PENDING mandatoryMinimum 로그 목록 렌더 (2 건).
 *   2) 빈 상태 empty state 렌더.
 *   3) 승인 dialog 열림 → 확정 → mutate({ decision: APPROVED }) 호출.
 *   4) 반려 dialog note 5 char 미만 → 제출 버튼 disabled.
 *   5) 반려 note 5+ char → 확정 → mutate({ decision: REJECTED, note }) 호출.
 *   6) ALREADY_REVIEWED → toast + pending 캐시 invalidate.
 *   7) FORBIDDEN → toast.
 *   8) 증감 delta 색상 (증액 red / 감액 green) 확인.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MandatoryMinimumApprovalQueue } from '../MandatoryMinimumApprovalQueue'
import type { MandatoryMinimumChangeLogDto } from '@/services/mandatory-minimum.service'

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
  mutate: ReturnType<typeof vi.fn<Parameters<MutateFn>, void>>
  isPending: boolean
}

const reviewMock: MockMutation = { mutate: vi.fn(), isPending: false }

let mockPending: MandatoryMinimumChangeLogDto[] = []
let mockLoading = false
let mockError: Error | null = null

// invalidateQueries 는 실제 QueryClient 인스턴스에서 spy.
const invalidateSpy = vi.fn()

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  )
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: (arg: unknown) => {
        invalidateSpy(arg)
        return Promise.resolve()
      },
    }),
  }
})

vi.mock('@/services/mandatory-minimum.service', async () => {
  const actual = await vi.importActual<
    typeof import('@/services/mandatory-minimum.service')
  >('@/services/mandatory-minimum.service')
  return {
    ...actual,
    usePendingMinimums: () => ({
      data: mockPending,
      isLoading: mockLoading,
      isError: mockError !== null,
      error: mockError,
    }),
    useReviewMinimum: () => reviewMock,
  }
})

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
  overrides: Partial<MandatoryMinimumChangeLogDto> = {},
): MandatoryMinimumChangeLogDto {
  return {
    id: 1,
    categoryPlanId: 501,
    previousAmount: 1_000_000,
    newAmount: 1_500_000,
    evidenceType: 'CONTRACT',
    evidenceUrl: 'https://example.com/contract-1.pdf',
    reason: '월드컵 특수 대비 공공요금 인상',
    effectiveDate: '2026-09-01T00:00:00.000Z',
    status: 'PENDING',
    proposedById: 42,
    proposedAt: '2026-08-29T10:00:00.000Z',
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    proposedBy: {
      id: 42,
      email: 'fm@example.com',
      username: 'fm.kim',
    },
    categoryPlan: {
      id: 501,
      mandatoryMinimum: 1_000_000,
      expenseCategory: {
        id: 101,
        code: 'utilities',
        label: '공공요금',
      },
    },
    ...overrides,
  }
}

function renderQueue(seasonId = 1) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MandatoryMinimumApprovalQueue seasonId={seasonId} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  reviewMock.mutate.mockReset()
  reviewMock.isPending = false
  mockPending = []
  mockLoading = false
  mockError = null
  invalidateSpy.mockReset()
  toastError.mockReset()
  toastSuccess.mockReset()
})

// ---------------------------------------------------------------------------
// (1) 목록 렌더
// ---------------------------------------------------------------------------
describe('MandatoryMinimumApprovalQueue — 목록 렌더', () => {
  it('PENDING 로그가 카드 목록으로 렌더된다', () => {
    mockPending = [
      makeLog({ id: 1, categoryPlanId: 501, newAmount: 1_500_000 }),
      makeLog({
        id: 2,
        categoryPlanId: 502,
        previousAmount: 2_000_000,
        newAmount: 1_500_000,
        evidenceType: 'LEGAL',
        evidenceUrl: null,
        reason: '노무 이슈로 인건비 최소값 조정',
        categoryPlan: {
          id: 502,
          mandatoryMinimum: 2_000_000,
          expenseCategory: { id: 102, code: 'payroll', label: '인건비' },
        },
      }),
    ]
    renderQueue(7)

    // 시즌 라벨
    expect(screen.getByText('시즌 #7')).toBeTruthy()

    // 두 카드 존재
    const card1 = screen.getByTestId('mm-log-card-1')
    const card2 = screen.getByTestId('mm-log-card-2')
    expect(card1).toBeTruthy()
    expect(card2).toBeTruthy()

    // 카테고리 라벨
    expect(card1.textContent).toContain('공공요금')
    expect(card2.textContent).toContain('인건비')

    // 제안자 (username 우선)
    expect(screen.getByTestId('mm-proposer-1').textContent).toBe('fm.kim')

    // 금액 표시
    expect(screen.getByTestId('mm-previous-1').textContent).toBe('₩1,000,000')
    expect(screen.getByTestId('mm-new-1').textContent).toBe('₩1,500,000')

    // 증빙 링크 (첫 카드) 는 있고 두 번째 카드는 없다
    expect(screen.getByTestId('mm-evidence-url-1')).toBeTruthy()
    expect(screen.queryByTestId('mm-evidence-url-2')).toBeNull()

    // 적용 예정일 (yyyy-MM-dd)
    expect(screen.getByTestId('mm-effective-1').textContent).toBe('2026-09-01')
  })

  it('빈 목록 이면 empty state 문구가 표시된다', () => {
    mockPending = []
    renderQueue()
    expect(screen.getByTestId('mm-queue-empty')).toBeTruthy()
    expect(screen.getByTestId('mm-queue-empty').textContent).toContain(
      '승인 대기 중인 mandatoryMinimum 변경 제안이 없습니다',
    )
  })

  it('loading 이면 skeleton 이 렌더된다', () => {
    mockLoading = true
    renderQueue()
    expect(screen.getByTestId('mm-queue-loading')).toBeTruthy()
    // 카드 자체는 없다
    expect(screen.queryByTestId('mm-queue-empty')).toBeNull()
  })

  it('error 상태 이면 error 배너가 렌더된다', () => {
    mockError = new Error('SERVER_ERROR')
    renderQueue()
    expect(screen.getByTestId('mm-queue-error')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// (2) 증감 delta 색상
// ---------------------------------------------------------------------------
describe('MandatoryMinimumApprovalQueue — 증감 delta 색상', () => {
  it('증액 (newAmount > previousAmount) → red', () => {
    mockPending = [makeLog({ id: 10, previousAmount: 1_000_000, newAmount: 1_500_000 })]
    renderQueue()

    const delta = screen.getByTestId('mm-delta-10')
    expect(delta.getAttribute('data-delta-direction')).toBe('up')
    expect(delta.className).toMatch(/text-red-700/)
    expect(delta.textContent).toContain('+')
    expect(delta.textContent).toContain('₩500,000')
  })

  it('감액 (newAmount < previousAmount) → green', () => {
    mockPending = [makeLog({ id: 11, previousAmount: 2_000_000, newAmount: 1_500_000 })]
    renderQueue()

    const delta = screen.getByTestId('mm-delta-11')
    expect(delta.getAttribute('data-delta-direction')).toBe('down')
    expect(delta.className).toMatch(/text-green-700/)
    expect(delta.textContent).toContain('-')
    expect(delta.textContent).toContain('₩500,000')
  })

  it('동일 (newAmount == previousAmount) → delta 뱃지 없음', () => {
    mockPending = [makeLog({ id: 12, previousAmount: 1_000_000, newAmount: 1_000_000 })]
    renderQueue()
    expect(screen.queryByTestId('mm-delta-12')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// (3) 승인 flow
// ---------------------------------------------------------------------------
describe('MandatoryMinimumApprovalQueue — 승인 flow', () => {
  it('[승인] 클릭 → dialog open', () => {
    mockPending = [makeLog({ id: 7 })]
    renderQueue()

    fireEvent.click(screen.getByTestId('mm-approve-7'))
    expect(screen.getByTestId('mm-review-dialog')).toBeTruthy()

    // 승인은 note 없이도 제출 활성
    const submitBtn = screen.getByTestId('mm-review-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
  })

  it('승인 확정 → useReviewMinimum.mutate 호출 (decision: APPROVED, note undefined)', () => {
    mockPending = [makeLog({ id: 7 })]
    renderQueue(9)

    fireEvent.click(screen.getByTestId('mm-approve-7'))
    fireEvent.click(screen.getByTestId('mm-review-submit'))

    expect(reviewMock.mutate).toHaveBeenCalledTimes(1)
    const [payload] = reviewMock.mutate.mock.calls[0]!
    expect(payload).toMatchObject({ logId: 7, decision: 'APPROVED' })
    expect((payload as { note?: string }).note).toBeUndefined()
  })

  it('승인 확정 (note 포함) → mutate note 전달', () => {
    mockPending = [makeLog({ id: 8 })]
    renderQueue()

    fireEvent.click(screen.getByTestId('mm-approve-8'))
    fireEvent.change(screen.getByTestId('mm-review-note'), {
      target: { value: '증빙 확인 완료' },
    })
    fireEvent.click(screen.getByTestId('mm-review-submit'))

    expect(reviewMock.mutate).toHaveBeenCalledTimes(1)
    const [payload] = reviewMock.mutate.mock.calls[0]!
    expect(payload).toEqual({
      logId: 8,
      decision: 'APPROVED',
      note: '증빙 확인 완료',
    })
  })

  it('승인 성공 → 성공 toast', () => {
    mockPending = [makeLog({ id: 55 })]
    reviewMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.(undefined)
    })
    renderQueue()

    fireEvent.click(screen.getByTestId('mm-approve-55'))
    fireEvent.click(screen.getByTestId('mm-review-submit'))

    expect(toastSuccess).toHaveBeenCalledWith('제안이 승인되었습니다')
  })
})

// ---------------------------------------------------------------------------
// (4) 반려 flow
// ---------------------------------------------------------------------------
describe('MandatoryMinimumApprovalQueue — 반려 flow', () => {
  it('[반려] 클릭 → dialog open + note 미입력 시 제출 비활성', () => {
    mockPending = [makeLog({ id: 9 })]
    renderQueue()

    fireEvent.click(screen.getByTestId('mm-reject-9'))
    const submitBtn = screen.getByTestId('mm-review-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
  })

  it('note 4 char (< 5) → 여전히 비활성', () => {
    mockPending = [makeLog({ id: 9 })]
    renderQueue()

    fireEvent.click(screen.getByTestId('mm-reject-9'))
    fireEvent.change(screen.getByTestId('mm-review-note'), {
      target: { value: '짧아요' },
    })
    // 트림 후 4자 이하 케이스
    const submitBtn = screen.getByTestId('mm-review-submit') as HTMLButtonElement
    // '짧아요' = 3자 → disabled
    expect(submitBtn.disabled).toBe(true)
  })

  it('공백만 있으면 (trim 후 0) 비활성', () => {
    mockPending = [makeLog({ id: 9 })]
    renderQueue()
    fireEvent.click(screen.getByTestId('mm-reject-9'))
    fireEvent.change(screen.getByTestId('mm-review-note'), {
      target: { value: '          ' },
    })
    const submitBtn = screen.getByTestId('mm-review-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
  })

  it('note 5 char 이상 → 활성 → mutate 호출 (REJECTED + note)', () => {
    mockPending = [makeLog({ id: 9 })]
    renderQueue()

    fireEvent.click(screen.getByTestId('mm-reject-9'))
    fireEvent.change(screen.getByTestId('mm-review-note'), {
      target: { value: '증빙 부족' }, // 5자
    })

    const submitBtn = screen.getByTestId('mm-review-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)

    fireEvent.click(submitBtn)

    expect(reviewMock.mutate).toHaveBeenCalledTimes(1)
    const [payload] = reviewMock.mutate.mock.calls[0]!
    expect(payload).toEqual({
      logId: 9,
      decision: 'REJECTED',
      note: '증빙 부족',
    })
  })

  it('반려 성공 → 성공 toast', () => {
    mockPending = [makeLog({ id: 12 })]
    reviewMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.(undefined)
    })
    renderQueue()

    fireEvent.click(screen.getByTestId('mm-reject-12'))
    fireEvent.change(screen.getByTestId('mm-review-note'), {
      target: { value: '반려 사유 상세 기재' },
    })
    fireEvent.click(screen.getByTestId('mm-review-submit'))

    expect(toastSuccess).toHaveBeenCalledWith('제안이 반려되었습니다')
  })
})

// ---------------------------------------------------------------------------
// (5) 에러 코드 매핑 + ALREADY_REVIEWED conflict
// ---------------------------------------------------------------------------
describe('MandatoryMinimumApprovalQueue — 에러 코드 매핑', () => {
  it('ALREADY_REVIEWED → toast + pending 캐시 invalidate', () => {
    mockPending = [makeLog({ id: 40 })]
    reviewMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('ALREADY_REVIEWED'))
    })
    renderQueue(11)

    fireEvent.click(screen.getByTestId('mm-approve-40'))
    fireEvent.click(screen.getByTestId('mm-review-submit'))

    expect(toastError).toHaveBeenCalledWith('이미 처리된 제안입니다')
    // pending 캐시 invalidate 가 호출됐는지 (queryKey 안에 seasonId 11 이 포함)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    const [invArg] = invalidateSpy.mock.calls[0]!
    const key = (invArg as { queryKey: readonly unknown[] }).queryKey
    expect(key).toContain('pending')
    expect(key).toContain(11)
  })

  it('FORBIDDEN → GM 권한 안내 toast', () => {
    mockPending = [makeLog({ id: 41 })]
    reviewMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('FORBIDDEN'))
    })
    renderQueue()

    fireEvent.click(screen.getByTestId('mm-approve-41'))
    fireEvent.click(screen.getByTestId('mm-review-submit'))

    expect(toastError).toHaveBeenCalledWith('GM 권한이 필요합니다')
  })

  it('REVIEW_NOTE_REQUIRED_FOR_REJECT → 서버 fallback toast (원칙적으로 client 사전 차단)', () => {
    mockPending = [makeLog({ id: 42 })]
    reviewMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('REVIEW_NOTE_REQUIRED_FOR_REJECT'))
    })
    renderQueue()

    fireEvent.click(screen.getByTestId('mm-reject-42'))
    fireEvent.change(screen.getByTestId('mm-review-note'), {
      target: { value: '반려 사유 상세 기재' },
    })
    fireEvent.click(screen.getByTestId('mm-review-submit'))

    expect(toastError).toHaveBeenCalledWith('반려 시 사유를 입력해야 합니다')
  })

  it('매핑되지 않은 코드는 원문 그대로 표시된다', () => {
    mockPending = [makeLog({ id: 43 })]
    reviewMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('UNEXPECTED_CODE'))
    })
    renderQueue()

    fireEvent.click(screen.getByTestId('mm-approve-43'))
    fireEvent.click(screen.getByTestId('mm-review-submit'))

    expect(toastError).toHaveBeenCalledWith('UNEXPECTED_CODE')
  })
})

// ---------------------------------------------------------------------------
// (6) proposer fallback
// ---------------------------------------------------------------------------
describe('MandatoryMinimumApprovalQueue — proposer fallback', () => {
  it('username 이 null 이면 email 로 fallback', () => {
    mockPending = [
      makeLog({
        id: 100,
        proposedBy: {
          id: 42,
          email: 'no-name@example.com',
          username: null,
        },
      }),
    ]
    renderQueue()
    expect(screen.getByTestId('mm-proposer-100').textContent).toBe(
      'no-name@example.com',
    )
  })

  it('proposedBy 자체가 없으면 id 로 fallback', () => {
    mockPending = [
      makeLog({
        id: 101,
        proposedById: 999,
        proposedBy: undefined,
      }),
    ]
    renderQueue()
    expect(screen.getByTestId('mm-proposer-101').textContent).toBe('#999')
  })
})
