/**
 * MandatoryMinimumProposalDialog unit tests — issue #451 F2.
 *
 * Runner: vitest + @testing-library/react. tsconfig.app.json 이 __tests__ 를
 * exclude 하므로 프로덕션 typecheck 는 깨지 않는다. 자매 컴포넌트 테스트와
 * 동일한 mock 패턴 (service hook + toast + queryClient wrapper) 을 사용한다.
 *
 * 검증 항목 (issue #451 Acceptance 매핑):
 *   1) 트리거 클릭 시 Dialog 가 렌더된다 (form 전체 노출).
 *   2) evidenceType 별 URL required 규칙 — CONTRACT/LEGAL 시 URL 비어 있으면
 *      submit 비활성 (mutation 미호출), FIXED_COST 는 URL 비어도 submit 가능.
 *   3) reason min 10자 client validation.
 *   4) 유효한 값으로 submit → useProposeMinimum().mutate 가 정확한 payload 로 호출.
 *   5) mutate 성공 시 dialog close + "제안이 접수되었습니다" toast + onSuccess 콜백.
 *   6) 서버 에러 코드 (EVIDENCE_URL_REQUIRED / AMOUNT_MUST_BE_NON_NEGATIVE 등)
 *      가 한국어 toast 로 변환된다.
 *   7) useMinimumHistory 결과에 REJECTED 이력이 있으면 상단 warning card 노출.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MandatoryMinimumProposalDialog } from '../MandatoryMinimumProposalDialog'
import type { MandatoryMinimumChangeLogDto } from '@/services/mandatory-minimum.service'

// ---------------------------------------------------------------------------
// Mocks — service hooks + toast
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

const proposeMock: MockMutation = { mutate: vi.fn(), isPending: false }
let historyRows: MandatoryMinimumChangeLogDto[] = []

vi.mock('@/services/mandatory-minimum.service', async () => {
  // 실제 타입 exports 는 그대로 통과시키기 위해 원본을 가져와 mocked hook 만 덮어쓴다.
  const actual = await vi.importActual<
    typeof import('@/services/mandatory-minimum.service')
  >('@/services/mandatory-minimum.service')
  return {
    ...actual,
    useProposeMinimum: () => proposeMock,
    useMinimumHistory: () => ({
      data: historyRows,
      isLoading: false,
      isError: false,
      error: null,
    }),
  }
})

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
function renderDialog(
  overrides?: Partial<{
    categoryPlanId: number
    mandatoryMinimum: number
    label: string
    code: string
    seasonId: number
    onSuccess: () => void
  }>,
) {
  const opts = {
    categoryPlanId: 77,
    mandatoryMinimum: 1_000_000,
    label: '공공요금',
    code: 'utilities',
    seasonId: 1,
    onSuccess: undefined as (() => void) | undefined,
    ...overrides,
  }
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MandatoryMinimumProposalDialog
        categoryPlan={{
          id: opts.categoryPlanId,
          mandatoryMinimum: opts.mandatoryMinimum,
          expenseCategory: { code: opts.code, label: opts.label },
        }}
        seasonId={opts.seasonId}
        onSuccess={opts.onSuccess}
        trigger={<button data-testid="my-trigger">값 제안</button>}
      />
    </QueryClientProvider>,
  )
}

function openDialog() {
  fireEvent.click(screen.getByTestId('mm-propose-trigger'))
}

function fillValidForm(overrides?: {
  amount?: string
  evidenceType?: 'CONTRACT' | 'LEGAL' | 'FIXED_COST'
  url?: string
  reason?: string
}) {
  const amount = overrides?.amount ?? '3000000'
  const evidenceType = overrides?.evidenceType ?? 'CONTRACT'
  const url = overrides?.url ?? 'https://example.com/contract.pdf'
  const reason = overrides?.reason ?? '월드컵 준비 특수 지출 반영'

  fireEvent.change(screen.getByTestId('mm-new-amount-input'), {
    target: { value: amount },
  })
  fireEvent.change(screen.getByTestId('mm-evidence-type-select'), {
    target: { value: evidenceType },
  })
  fireEvent.change(screen.getByTestId('mm-evidence-url-input'), {
    target: { value: url },
  })
  fireEvent.change(screen.getByTestId('mm-reason-input'), {
    target: { value: reason },
  })
}

function makeHistoryRow(
  overrides: Partial<MandatoryMinimumChangeLogDto> = {},
): MandatoryMinimumChangeLogDto {
  return {
    id: 1,
    categoryPlanId: 77,
    previousAmount: 500_000,
    newAmount: 2_000_000,
    evidenceType: 'CONTRACT',
    evidenceUrl: 'https://example.com/old.pdf',
    reason: '이전 제안 사유',
    effectiveDate: '2026-08-01',
    status: 'PENDING',
    proposedById: 42,
    proposedAt: '2026-08-01T00:00:00.000Z',
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    ...overrides,
  }
}

beforeEach(() => {
  proposeMock.mutate.mockReset()
  proposeMock.isPending = false
  historyRows = []
  toastSuccess.mockReset()
  toastError.mockReset()
})

// ---------------------------------------------------------------------------
// (1) 오픈 + 폼 렌더
// ---------------------------------------------------------------------------
describe('MandatoryMinimumProposalDialog — 오픈 & 폼 렌더', () => {
  it('trigger 클릭 시 Dialog 가 열리고 form 필드가 모두 렌더된다', () => {
    renderDialog()
    // 초기 dialog 미표시
    expect(screen.queryByTestId('mm-propose-dialog')).toBeNull()

    openDialog()

    expect(screen.getByTestId('mm-propose-dialog')).toBeTruthy()
    // 헤더 label
    expect(screen.getByText(/최소 배정액 제안/)).toBeTruthy()
    expect(screen.getByText(/공공요금/)).toBeTruthy()
    // 현재 금액
    expect(screen.getByTestId('mm-current-amount').textContent).toContain(
      '1,000,000',
    )
    // 필드
    expect(screen.getByTestId('mm-new-amount-input')).toBeTruthy()
    expect(screen.getByTestId('mm-evidence-type-select')).toBeTruthy()
    expect(screen.getByTestId('mm-evidence-url-input')).toBeTruthy()
    expect(screen.getByTestId('mm-reason-input')).toBeTruthy()
    expect(screen.getByTestId('mm-effective-date-input')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// (2) evidenceType 별 URL required 규칙
// ---------------------------------------------------------------------------
describe('MandatoryMinimumProposalDialog — evidenceType URL required', () => {
  it('CONTRACT 유형은 URL 이 비면 submit 이 비활성이다 (mutation 미호출)', () => {
    renderDialog()
    openDialog()
    fillValidForm({ url: '' })

    // 필수 안내 노출
    expect(screen.getByTestId('mm-evidence-url-required-hint')).toBeTruthy()

    const submit = screen.getByTestId('mm-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    // 강제 클릭해도 mutation 미호출
    fireEvent.click(submit)
    expect(proposeMock.mutate).not.toHaveBeenCalled()
  })

  it('LEGAL 유형도 URL 이 비면 submit 이 비활성이다', () => {
    renderDialog()
    openDialog()
    fillValidForm({ evidenceType: 'LEGAL', url: '' })
    expect(screen.getByTestId('mm-evidence-url-required-hint')).toBeTruthy()
    const submit = screen.getByTestId('mm-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  it('FIXED_COST 유형은 URL 이 비어 있어도 submit 이 활성이며 mutation 이 호출된다', () => {
    renderDialog()
    openDialog()
    fillValidForm({ evidenceType: 'FIXED_COST', url: '' })
    // 필수 안내는 없음
    expect(screen.queryByTestId('mm-evidence-url-required-hint')).toBeNull()
    const submit = screen.getByTestId('mm-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(false)

    fireEvent.click(submit)
    expect(proposeMock.mutate).toHaveBeenCalledTimes(1)
    const [payload] = proposeMock.mutate.mock.calls[0]!
    // evidenceUrl 은 payload 에서 생략돼야 (undefined-key 제거)
    expect(payload).toEqual({
      newAmount: 3_000_000,
      evidenceType: 'FIXED_COST',
      reason: '월드컵 준비 특수 지출 반영',
      effectiveDate: expect.any(String),
    })
    expect((payload as { evidenceUrl?: string }).evidenceUrl).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// (3) reason min 10자
// ---------------------------------------------------------------------------
describe('MandatoryMinimumProposalDialog — reason min length', () => {
  it('reason 이 10자 미만이면 submit 비활성', () => {
    renderDialog()
    openDialog()
    fillValidForm({ reason: '짧음' })
    const submit = screen.getByTestId('mm-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    // 10자 이상으로 늘리면 활성
    fireEvent.change(screen.getByTestId('mm-reason-input'), {
      target: { value: '충분히 상세한 사유입니다' },
    })
    expect(submit.disabled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// (extra) newAmount 검증 — 0 이상, empty 는 비활성
// ---------------------------------------------------------------------------
describe('MandatoryMinimumProposalDialog — newAmount 검증', () => {
  it('newAmount 가 비어 있으면 submit 비활성', () => {
    renderDialog()
    openDialog()
    fillValidForm({ amount: '' })
    const submit = screen.getByTestId('mm-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  it('newAmount === 0 은 유효 (submit 활성)', () => {
    renderDialog()
    openDialog()
    fillValidForm({ amount: '0' })
    const submit = screen.getByTestId('mm-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(false)
  })

  it('newAmount 음수는 유효 안내가 나오고 submit 비활성', () => {
    renderDialog()
    openDialog()
    fillValidForm({ amount: '-100' })
    const submit = screen.getByTestId('mm-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// (4) 정상 submit — payload 검증
// ---------------------------------------------------------------------------
describe('MandatoryMinimumProposalDialog — 정상 submit', () => {
  it('유효 값으로 제출 시 mutate 가 정확한 payload 로 호출된다', () => {
    renderDialog()
    openDialog()
    fillValidForm()

    fireEvent.click(screen.getByTestId('mm-submit'))

    expect(proposeMock.mutate).toHaveBeenCalledTimes(1)
    const [payload] = proposeMock.mutate.mock.calls[0]!
    expect(payload).toMatchObject({
      newAmount: 3_000_000,
      evidenceType: 'CONTRACT',
      evidenceUrl: 'https://example.com/contract.pdf',
      reason: '월드컵 준비 특수 지출 반영',
    })
    // effectiveDate 는 오늘 default (yyyy-mm-dd)
    expect((payload as { effectiveDate: string }).effectiveDate).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
  })
})

// ---------------------------------------------------------------------------
// (5) 성공 → dialog close + toast + onSuccess
// ---------------------------------------------------------------------------
describe('MandatoryMinimumProposalDialog — 성공 처리', () => {
  it('mutate 성공 시 dialog 가 닫히고 성공 toast + onSuccess 콜백이 실행된다', () => {
    const onSuccess = vi.fn()
    renderDialog({ onSuccess })
    openDialog()

    proposeMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.({ id: 42 })
    })
    fillValidForm()
    fireEvent.click(screen.getByTestId('mm-submit'))

    expect(toastSuccess).toHaveBeenCalledWith('제안이 접수되었습니다')
    expect(onSuccess).toHaveBeenCalledTimes(1)
    // dialog close
    expect(screen.queryByTestId('mm-propose-dialog')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// (6) 에러 코드 → 한국어 toast
// ---------------------------------------------------------------------------
describe('MandatoryMinimumProposalDialog — 에러 코드 매핑', () => {
  const cases: Array<{ code: string; message: string }> = [
    {
      code: 'EVIDENCE_URL_REQUIRED',
      message: '근거 URL 이 필요합니다 (계약서/법령 유형)',
    },
    { code: 'REASON_REQUIRED', message: '사유를 입력해주세요' },
    {
      code: 'AMOUNT_MUST_BE_NON_NEGATIVE',
      message: '금액은 0 이상이어야 합니다',
    },
    {
      code: 'INVALID_EVIDENCE_TYPE',
      message: '유효하지 않은 근거 유형입니다',
    },
    { code: 'FORBIDDEN', message: '권한이 없습니다' },
  ]

  cases.forEach(({ code, message }) => {
    it(`${code} → "${message}"`, () => {
      renderDialog()
      openDialog()
      proposeMock.mutate.mockImplementation((_vars, opts) => {
        opts?.onError?.(new Error(code))
      })
      fillValidForm()
      fireEvent.click(screen.getByTestId('mm-submit'))
      expect(toastError).toHaveBeenCalledWith(message)
    })
  })

  it('매핑되지 않은 에러 코드는 원문 그대로 표시된다', () => {
    renderDialog()
    openDialog()
    proposeMock.mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('MYSTERY_CODE'))
    })
    fillValidForm()
    fireEvent.click(screen.getByTestId('mm-submit'))
    expect(toastError).toHaveBeenCalledWith('MYSTERY_CODE')
  })
})

// ---------------------------------------------------------------------------
// (7) REJECTED 이력 → warning card
// ---------------------------------------------------------------------------
describe('MandatoryMinimumProposalDialog — 최근 REJECTED 이력 노출', () => {
  it('history 에 REJECTED 가 있으면 상단 warning card 가 렌더되고 reviewNote 가 노출된다', () => {
    historyRows = [
      makeHistoryRow({
        id: 10,
        status: 'REJECTED',
        newAmount: 4_000_000,
        reviewNote: '증빙이 부실합니다',
        reviewedAt: '2026-08-15T10:00:00.000Z',
      }),
    ]
    renderDialog()
    openDialog()

    const card = screen.getByTestId('mm-last-rejected')
    expect(card).toBeTruthy()
    // reviewNote 노출
    expect(screen.getByTestId('mm-last-rejected-note').textContent).toContain(
      '증빙이 부실합니다',
    )
    // 이전 제안 금액도 함께 노출
    expect(card.textContent).toContain('4,000,000')
  })

  it('history 는 있지만 REJECTED 가 없으면 warning card 는 노출되지 않는다', () => {
    historyRows = [
      makeHistoryRow({ id: 1, status: 'PENDING' }),
      makeHistoryRow({ id: 2, status: 'APPROVED' }),
    ]
    renderDialog()
    openDialog()
    expect(screen.queryByTestId('mm-last-rejected')).toBeNull()
  })

  it('history 가 비어 있으면 warning card 미노출', () => {
    historyRows = []
    renderDialog()
    openDialog()
    expect(screen.queryByTestId('mm-last-rejected')).toBeNull()
  })

  it('REJECTED 이지만 reviewNote 가 null 이면 fallback 문구가 노출된다', () => {
    historyRows = [
      makeHistoryRow({
        id: 99,
        status: 'REJECTED',
        reviewNote: null,
      }),
    ]
    renderDialog()
    openDialog()
    expect(screen.getByTestId('mm-last-rejected')).toBeTruthy()
    expect(screen.queryByTestId('mm-last-rejected-note')).toBeNull()
    expect(
      screen.getByText(/반려 사유가 기록되어 있지 않습니다/),
    ).toBeTruthy()
  })
})
