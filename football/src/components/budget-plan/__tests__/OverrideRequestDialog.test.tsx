/**
 * OverrideRequestDialog unit tests.
 *
 * Runner: vitest + @testing-library/react. football/package.json 에 vitest 가
 * 아직 install 되어 있지 않지만 (형제 컴포넌트 테스트와 동일 상황), 러너 도입 시
 * 이 파일은 그대로 통과해야 한다. tsconfig.app.json 이 __tests__ 를 exclude
 * 하므로 프로덕션 typecheck 는 깨지 않는다.
 *
 * 검증 항목 (issue #431 Acceptance 매핑):
 *   1) 트리거 클릭 시 Dialog 가 열린다.
 *   2) 카테고리 selector 가 scope 로 필터된다.
 *   3) 사유 min-length 미만이면 제출 버튼이 비활성.
 *   4) 유효한 payload 로 제출 시 useRequestOverride().mutate 가 호출된다.
 *   5) 에러 코드 (OVERRIDE_EXCEEDS_TOTAL_BUDGET / CATEGORY_SCOPE_MISMATCH 등)
 *      가 한국어 toast 로 변환된다.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OverrideRequestDialog } from '../OverrideRequestDialog'

// ---------------------------------------------------------------------------
// Mocks — service hook + toast + expense categories
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

const requestOverrideMock: MockMutation = { mutate: vi.fn(), isPending: false }

vi.mock('@/services/budget-plan.service', () => ({
  useRequestOverride: () => requestOverrideMock,
}))

// useExpenseCategories: TEAM 2 개 + DEPARTMENT 1 개 + inactive 1 개.
vi.mock('@/hooks/useExpenseCategories', () => ({
  useExpenseCategories: () => ({
    rows: [
      { id: 101, code: 'utilities', label: '공공요금', sortOrder: 0, isActive: true, scope: 'TEAM' },
      { id: 102, code: 'match_ops', label: '경기 운영', sortOrder: 1, isActive: true, scope: 'TEAM' },
      { id: 201, code: 'facility', label: '시설', sortOrder: 2, isActive: true, scope: 'DEPARTMENT' },
      { id: 301, code: 'legacy', label: '레거시', sortOrder: 3, isActive: false, scope: 'TEAM' },
    ],
    loading: false,
    labelOf: (code: string) => code,
  }),
}))

// sonner
const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (msg: string) => toastSuccess(msg),
    error: (msg: string) => toastError(msg),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderDialog(scope: 'TEAM' | 'DEPARTMENT' = 'TEAM') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <OverrideRequestDialog
        seasonId={1}
        scope={scope}
        trigger={<button data-testid="my-trigger">이의 신청</button>}
      />
    </QueryClientProvider>,
  )
}

function openDialog() {
  const trigger = screen.getByTestId('override-request-trigger')
  fireEvent.click(trigger)
}

beforeEach(() => {
  requestOverrideMock.mutate.mockReset()
  requestOverrideMock.isPending = false
  toastSuccess.mockReset()
  toastError.mockReset()
})

// ---------------------------------------------------------------------------
// (1) 트리거 → dialog 오픈
// ---------------------------------------------------------------------------
describe('OverrideRequestDialog — 트리거 & 오픈', () => {
  it('trigger 클릭 시 dialog 가 렌더된다', () => {
    renderDialog('TEAM')
    // 트리거는 항상 렌더
    expect(screen.getByTestId('my-trigger')).toBeTruthy()
    // 초기에는 dialog 미표시
    expect(screen.queryByTestId('override-request-dialog')).toBeNull()

    openDialog()

    expect(screen.getByTestId('override-request-dialog')).toBeTruthy()
    // Title
    expect(screen.getByText('카테고리별 이의 신청')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// (2) 카테고리 selector scope 필터
// ---------------------------------------------------------------------------
describe('OverrideRequestDialog — 카테고리 selector', () => {
  it('scope=TEAM 이면 TEAM 활성 카테고리만 옵션에 노출된다', () => {
    renderDialog('TEAM')
    openDialog()

    const select = screen.getByTestId(
      'override-category-select',
    ) as HTMLSelectElement
    const optionValues = Array.from(select.options).map((o) => o.value)
    // placeholder + 101, 102 만 (201 DEPARTMENT 제외, 301 inactive 제외)
    expect(optionValues).toContain('101')
    expect(optionValues).toContain('102')
    expect(optionValues).not.toContain('201')
    expect(optionValues).not.toContain('301')
  })

  it('scope=DEPARTMENT 이면 DEPARTMENT 활성 카테고리만 노출된다', () => {
    renderDialog('DEPARTMENT')
    openDialog()

    const select = screen.getByTestId(
      'override-category-select',
    ) as HTMLSelectElement
    const optionValues = Array.from(select.options).map((o) => o.value)
    expect(optionValues).toContain('201')
    expect(optionValues).not.toContain('101')
    expect(optionValues).not.toContain('102')
    expect(optionValues).not.toContain('301')
  })
})

// ---------------------------------------------------------------------------
// (3) 사유 min-length + 금액 검증
// ---------------------------------------------------------------------------
describe('OverrideRequestDialog — 유효성 검사', () => {
  it('사유가 10자 미만이면 제출 버튼이 비활성이다', () => {
    renderDialog('TEAM')
    openDialog()

    const select = screen.getByTestId(
      'override-category-select',
    ) as HTMLSelectElement
    fireEvent.change(select, { target: { value: '101' } })
    fireEvent.change(screen.getByTestId('override-amount-input'), {
      target: { value: '500000' },
    })
    fireEvent.change(screen.getByTestId('override-reason-input'), {
      target: { value: '짧다' },
    })

    const submit = screen.getByTestId('override-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    // 10자 이상으로 늘리면 활성
    fireEvent.change(screen.getByTestId('override-reason-input'), {
      target: { value: '충분히 상세한 사유입니다' },
    })
    expect(submit.disabled).toBe(false)
  })

  it('금액이 0 이하이거나 미입력이면 제출 버튼이 비활성이다', () => {
    renderDialog('TEAM')
    openDialog()

    const select = screen.getByTestId(
      'override-category-select',
    ) as HTMLSelectElement
    fireEvent.change(select, { target: { value: '101' } })
    fireEvent.change(screen.getByTestId('override-reason-input'), {
      target: { value: '충분히 상세한 사유입니다' },
    })

    const submit = screen.getByTestId('override-submit') as HTMLButtonElement
    // amount 미입력
    expect(submit.disabled).toBe(true)

    // 0 입력
    fireEvent.change(screen.getByTestId('override-amount-input'), {
      target: { value: '0' },
    })
    expect(submit.disabled).toBe(true)

    // 양수 입력
    fireEvent.change(screen.getByTestId('override-amount-input'), {
      target: { value: '10000' },
    })
    expect(submit.disabled).toBe(false)
  })

  it('카테고리 미선택이면 제출 버튼이 비활성이다', () => {
    renderDialog('TEAM')
    openDialog()

    fireEvent.change(screen.getByTestId('override-amount-input'), {
      target: { value: '10000' },
    })
    fireEvent.change(screen.getByTestId('override-reason-input'), {
      target: { value: '충분히 상세한 사유입니다' },
    })

    const submit = screen.getByTestId('override-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// (4) 제출 payload
// ---------------------------------------------------------------------------
describe('OverrideRequestDialog — 제출', () => {
  it('유효한 값으로 제출 시 mutate 가 정확한 payload 로 호출된다', () => {
    renderDialog('TEAM')
    openDialog()

    fireEvent.change(screen.getByTestId('override-category-select'), {
      target: { value: '101' },
    })
    fireEvent.change(screen.getByTestId('override-amount-input'), {
      target: { value: '500000' },
    })
    fireEvent.change(screen.getByTestId('override-reason-input'), {
      target: { value: '월드컵 준비 특별 지출 필요' },
    })

    fireEvent.click(screen.getByTestId('override-submit'))

    expect(requestOverrideMock.mutate).toHaveBeenCalledTimes(1)
    const [payload] = requestOverrideMock.mutate.mock.calls[0]!
    expect(payload).toEqual({
      categoryId: 101,
      amount: 500000,
      reason: '월드컵 준비 특별 지출 필요',
    })
  })

  it('제출 성공 시 성공 toast + onSuccess 콜백 + dialog close', () => {
    const onSuccess = vi.fn()
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={qc}>
        <OverrideRequestDialog
          seasonId={1}
          scope="TEAM"
          onSuccess={onSuccess}
          trigger={<button>열기</button>}
        />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByTestId('override-request-trigger'))

    requestOverrideMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.({ id: 42 })
    })

    fireEvent.change(screen.getByTestId('override-category-select'), {
      target: { value: '101' },
    })
    fireEvent.change(screen.getByTestId('override-amount-input'), {
      target: { value: '100000' },
    })
    fireEvent.change(screen.getByTestId('override-reason-input'), {
      target: { value: '충분히 상세한 사유입니다' },
    })
    fireEvent.click(screen.getByTestId('override-submit'))

    expect(toastSuccess).toHaveBeenCalledWith('이의 신청이 접수되었습니다')
    expect(onSuccess).toHaveBeenCalledWith({
      id: 42,
      categoryId: 101,
      amount: 100000,
      reason: '충분히 상세한 사유입니다',
    })
    // dialog 는 close
    expect(screen.queryByTestId('override-request-dialog')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// (5) 에러 코드 → 한국어 toast
// ---------------------------------------------------------------------------
describe('OverrideRequestDialog — 에러 코드 매핑', () => {
  it('OVERRIDE_EXCEEDS_TOTAL_BUDGET → 총 예산 초과 안내', () => {
    renderDialog('TEAM')
    openDialog()

    requestOverrideMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('OVERRIDE_EXCEEDS_TOTAL_BUDGET'))
    })

    fireEvent.change(screen.getByTestId('override-category-select'), {
      target: { value: '101' },
    })
    fireEvent.change(screen.getByTestId('override-amount-input'), {
      target: { value: '99999999' },
    })
    fireEvent.change(screen.getByTestId('override-reason-input'), {
      target: { value: '초과 금액 요청 테스트' },
    })
    fireEvent.click(screen.getByTestId('override-submit'))

    expect(toastError).toHaveBeenCalledWith(
      '총 예산 초과 — 승인이 불가할 수 있습니다',
    )
  })

  it('INVALID_PLAN_STATUS_TRANSITION → 상태 전이 실패 안내', () => {
    renderDialog('TEAM')
    openDialog()

    requestOverrideMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('INVALID_PLAN_STATUS_TRANSITION'))
    })

    fireEvent.change(screen.getByTestId('override-category-select'), {
      target: { value: '101' },
    })
    fireEvent.change(screen.getByTestId('override-amount-input'), {
      target: { value: '10000' },
    })
    fireEvent.change(screen.getByTestId('override-reason-input'), {
      target: { value: '유효한 사유입니다' },
    })
    fireEvent.click(screen.getByTestId('override-submit'))

    expect(toastError).toHaveBeenCalledWith(
      '지금은 이의 신청을 할 수 없습니다 (편성이 확정 상태여야 합니다)',
    )
  })

  it('매핑되지 않은 에러 코드는 원문 그대로 표시된다', () => {
    renderDialog('TEAM')
    openDialog()

    requestOverrideMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('MYSTERY_CODE'))
    })

    fireEvent.change(screen.getByTestId('override-category-select'), {
      target: { value: '101' },
    })
    fireEvent.change(screen.getByTestId('override-amount-input'), {
      target: { value: '10000' },
    })
    fireEvent.change(screen.getByTestId('override-reason-input'), {
      target: { value: '유효한 사유입니다' },
    })
    fireEvent.click(screen.getByTestId('override-submit'))

    expect(toastError).toHaveBeenCalledWith('MYSTERY_CODE')
  })
})
