/**
 * GmReplanPanel unit tests (issue #432).
 *
 * Runner: vitest + @testing-library/react. football/package.json 에 아직 test
 * runner 가 설치되어 있지 않지만 (형제 컴포넌트 테스트와 동일한 상황), 러너가
 * 도입되는 순간 이 파일은 그대로 통과해야 한다. tsconfig.app.json 이
 * __tests__ 를 exclude 하므로 프로덕션 typecheck 는 깨지 않는다.
 *
 * 검증 항목 (issue #432 Acceptance 매핑):
 *   1) `재편성 트리거` 버튼은 planStatus === "FINALIZED" 일 때만 활성.
 *   2) 버튼 클릭 시 Dialog 가 열린다.
 *   3) reason 이 10자 미만이면 실행 버튼이 비활성.
 *   4) reason 이 유효할 때 useRePlan.mutate 가 그 문자열로 호출된다.
 *   5) 서버 코드 (403 / INVALID_PLAN_STATUS_TRANSITION) → 한국어 toast.
 *   6) 비-GM 유저는 no-permission 페일오버를 렌더한다 (destructive UI 회피).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GmReplanPanel } from '../GmReplanPanel'
import type { BudgetPlanStatus } from '@/services/budget-plan.service'
import type { Role, UserDto } from '@/types/auth'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
type MutateFn = (
  vars: unknown,
  opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void },
) => void

interface MockMutation {
  mutate: ReturnType<typeof vi.fn<Parameters<MutateFn>, void>>
  isPending: boolean
}

const rePlanMock: MockMutation = { mutate: vi.fn(), isPending: false }

vi.mock('@/services/budget-plan.service', async () => {
  // 실제 서비스 파일의 타입 (`BudgetPlanStatus`) 은 통과시키고 훅만 스텁한다.
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/services/budget-plan.service',
  )
  return {
    ...actual,
    useRePlan: () => rePlanMock,
  }
})

let mockCurrentUserRole: Role = 'GM'
let mockCurrentUserLoading = false
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => {
    const user: UserDto | null =
      mockCurrentUserRole === null
        ? null
        : {
            id: 99,
            email: 'gm@example.com',
            username: 'gm',
            nickname: 'GM',
            role: mockCurrentUserRole,
            coachingRole: null,
            frontOfficeRole: null,
            departmentCategories: [],
            teamId: null,
            clubId: null,
            isOutOfOffice: false,
            language: 'ko',
          }
    return { user, loading: mockCurrentUserLoading, refetch: vi.fn() }
  },
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
function renderPanel(planStatus: BudgetPlanStatus) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <GmReplanPanel seasonId={1} planStatus={planStatus} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  rePlanMock.mutate.mockReset()
  rePlanMock.isPending = false
  mockCurrentUserRole = 'GM'
  mockCurrentUserLoading = false
  toastError.mockReset()
  toastSuccess.mockReset()
})

// ---------------------------------------------------------------------------
// (1) 버튼 enable rule
// ---------------------------------------------------------------------------
describe('GmReplanPanel — 재편성 트리거 버튼 활성 규칙', () => {
  const cases: Array<{ status: BudgetPlanStatus; enabled: boolean }> = [
    { status: 'DRAFT', enabled: false },
    { status: 'CAPACITY_FAILED', enabled: false },
    { status: 'AWAITING_REVIEW', enabled: false },
    { status: 'KNAPSACK_EXECUTED', enabled: false },
    { status: 'AWAITING_GM_APPROVAL', enabled: false },
    { status: 'FINALIZED', enabled: true },
    { status: 'RE_PLANNING', enabled: false },
  ]

  cases.forEach(({ status, enabled }) => {
    it(`${status} → 버튼 ${enabled ? 'enabled' : 'disabled'}`, () => {
      renderPanel(status)
      const btn = screen.getByTestId('gm-re-plan-trigger') as HTMLButtonElement
      expect(btn.disabled).toBe(!enabled)
    })
  })

  it('비활성 상태에서는 tooltip 문구가 노출된다', () => {
    renderPanel('AWAITING_REVIEW')
    const btn = screen.getByTestId('gm-re-plan-trigger')
    expect(btn.getAttribute('title')).toBe('확정된 편성만 재편성 가능')
  })
})

// ---------------------------------------------------------------------------
// (2) Dialog 열기 + reason 검증
// ---------------------------------------------------------------------------
describe('GmReplanPanel — Dialog + reason 검증', () => {
  it('버튼 클릭 시 Dialog 가 열린다', () => {
    renderPanel('FINALIZED')
    fireEvent.click(screen.getByTestId('gm-re-plan-trigger'))
    expect(screen.getByTestId('gm-re-plan-reason')).toBeTruthy()
    expect(screen.getByTestId('gm-re-plan-submit')).toBeTruthy()
  })

  it('reason 이 10자 미만이면 실행 버튼이 비활성이다', () => {
    renderPanel('FINALIZED')
    fireEvent.click(screen.getByTestId('gm-re-plan-trigger'))

    const submitBtn = screen.getByTestId('gm-re-plan-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)

    // 9자 → 여전히 비활성
    const textarea = screen.getByTestId('gm-re-plan-reason') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '짧은사유짧은사' } })
    expect(submitBtn.disabled).toBe(true)

    // 10자 → 활성
    fireEvent.change(textarea, {
      target: { value: '스폰서 계약 변경으로 인한 재편성' },
    })
    expect(submitBtn.disabled).toBe(false)
  })

  it('빈 문자열/공백만 있으면 실행 버튼이 비활성이다', () => {
    renderPanel('FINALIZED')
    fireEvent.click(screen.getByTestId('gm-re-plan-trigger'))

    const submitBtn = screen.getByTestId('gm-re-plan-submit') as HTMLButtonElement
    const textarea = screen.getByTestId('gm-re-plan-reason') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: '          ' } })
    expect(submitBtn.disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// (3) mutate 호출
// ---------------------------------------------------------------------------
describe('GmReplanPanel — mutate 호출', () => {
  it('실행 버튼 클릭 시 rePlan.mutate 가 trimmed reason 과 함께 호출된다', () => {
    renderPanel('FINALIZED')
    fireEvent.click(screen.getByTestId('gm-re-plan-trigger'))

    const textarea = screen.getByTestId('gm-re-plan-reason') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: '  월드컵 특수 대비 예산 재편성이 필요합니다  ' },
    })
    fireEvent.click(screen.getByTestId('gm-re-plan-submit'))

    expect(rePlanMock.mutate).toHaveBeenCalledTimes(1)
    expect(rePlanMock.mutate.mock.calls[0]![0]).toBe(
      '월드컵 특수 대비 예산 재편성이 필요합니다',
    )
  })

  it('mutate 성공 시 성공 toast 가 노출된다', () => {
    rePlanMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.(undefined)
    })
    renderPanel('FINALIZED')
    fireEvent.click(screen.getByTestId('gm-re-plan-trigger'))
    const textarea = screen.getByTestId('gm-re-plan-reason') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: '재편성 사유 예시 문구입니다' },
    })
    fireEvent.click(screen.getByTestId('gm-re-plan-submit'))

    expect(toastSuccess).toHaveBeenCalledWith('재편성이 시작되었습니다')
  })
})

// ---------------------------------------------------------------------------
// (4) 에러 코드 매핑
// ---------------------------------------------------------------------------
describe('GmReplanPanel — 에러 코드 매핑', () => {
  it('INVALID_PLAN_STATUS_TRANSITION → 상태 안내 toast', () => {
    rePlanMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('INVALID_PLAN_STATUS_TRANSITION'))
    })
    renderPanel('FINALIZED')
    fireEvent.click(screen.getByTestId('gm-re-plan-trigger'))
    const textarea = screen.getByTestId('gm-re-plan-reason') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: '재편성 사유 예시 문구입니다' },
    })
    fireEvent.click(screen.getByTestId('gm-re-plan-submit'))

    expect(toastError).toHaveBeenCalledWith(
      '이미 재편성 중이거나 확정 상태가 아닙니다',
    )
  })

  it('FORBIDDEN → GM 권한 안내 toast', () => {
    rePlanMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('FORBIDDEN'))
    })
    renderPanel('FINALIZED')
    fireEvent.click(screen.getByTestId('gm-re-plan-trigger'))
    const textarea = screen.getByTestId('gm-re-plan-reason') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: '재편성 사유 예시 문구입니다' },
    })
    fireEvent.click(screen.getByTestId('gm-re-plan-submit'))

    expect(toastError).toHaveBeenCalledWith('GM 권한이 필요합니다')
  })

  it('매핑되지 않은 코드는 원문 그대로 표시된다', () => {
    rePlanMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('UNEXPECTED_CODE'))
    })
    renderPanel('FINALIZED')
    fireEvent.click(screen.getByTestId('gm-re-plan-trigger'))
    const textarea = screen.getByTestId('gm-re-plan-reason') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: '재편성 사유 예시 문구입니다' },
    })
    fireEvent.click(screen.getByTestId('gm-re-plan-submit'))

    expect(toastError).toHaveBeenCalledWith('UNEXPECTED_CODE')
  })
})

// ---------------------------------------------------------------------------
// (5) 비-GM guard
// ---------------------------------------------------------------------------
describe('GmReplanPanel — 비-GM 가드', () => {
  it('FRONT_OFFICE 유저는 no-permission 페일오버를 렌더한다', () => {
    mockCurrentUserRole = 'FRONT_OFFICE'
    renderPanel('FINALIZED')
    expect(screen.getByTestId('gm-re-plan-no-permission')).toBeTruthy()
    // destructive 버튼 은 렌더되지 않는다
    expect(screen.queryByTestId('gm-re-plan-trigger')).toBeNull()
  })

  it('COACHING_STAFF 유저도 페일오버', () => {
    mockCurrentUserRole = 'COACHING_STAFF'
    renderPanel('FINALIZED')
    expect(screen.getByTestId('gm-re-plan-no-permission')).toBeTruthy()
  })

  it('ADMIN 유저도 페일오버 (GM 만 허용)', () => {
    mockCurrentUserRole = 'ADMIN'
    renderPanel('FINALIZED')
    expect(screen.getByTestId('gm-re-plan-no-permission')).toBeTruthy()
  })

  it('user=null 이어도 안전하게 페일오버', () => {
    mockCurrentUserRole = null as unknown as Role
    renderPanel('FINALIZED')
    expect(screen.getByTestId('gm-re-plan-no-permission')).toBeTruthy()
  })

  it('useCurrentUser 로딩 중에는 아무것도 렌더하지 않는다', () => {
    mockCurrentUserLoading = true
    const { container } = renderPanel('FINALIZED')
    expect(container.firstChild).toBeNull()
  })
})
