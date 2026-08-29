/**
 * BudgetPlanWizard unit tests.
 *
 * Runner: vitest + @testing-library/react. tsconfig.app.json 이 __tests__ 를
 * exclude 하므로 프로덕션 typecheck 는 깨지 않는다.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  BudgetPlanWizard,
  draftStorageKey,
  isEmptyLine,
  inferRequesterScope,
  basicCostByCategoryCode,
} from '../BudgetPlanWizard'
import { emptyLine, type PlanRequestLineDraft } from '../types'
import type { ExpenseCategory } from '@/types/expense-category'
import type { BudgetPlan } from '@/types/budget'
import type { UserDto } from '@/types/auth'
import type { BudgetPlanStatus } from '@/services/budget-plan.service'

// ----- Test doubles -----

// api.post 를 그대로 두면 fetch 를 때려서 테스트가 깨진다 → module-level mock.
const submitCalls: Array<{ path: string; body: unknown }> = []
vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(async (path: string, body: unknown) => {
      submitCalls.push({ path, body })
      return { id: 1, status: 'SUBMITTED', lines: [] }
    }),
    // #431: FINALIZED 분기의 OverrideRequestDialog 가 useExpenseCategories 를
    // 마운트하므로 promise 를 반환해야 hook catch 가 조용히 [] 로 fallback 한다.
    get: vi.fn(async () => []),
    put: vi.fn(),
    patch: vi.fn(),
    postForm: vi.fn(),
    delete: vi.fn(),
  },
}))

// sonner 는 side-effect 없이 조용히.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const SEASON_ID = 42

const TEAM_CATEGORY: ExpenseCategory = {
  id: 101,
  code: 'utilities',
  label: '공공요금',
  sortOrder: 1,
  isActive: true,
  scope: 'TEAM',
}

const DEPT_CATEGORY: ExpenseCategory = {
  id: 102,
  code: 'facility',
  label: '시설',
  sortOrder: 2,
  isActive: true,
  scope: 'DEPARTMENT',
}

const INACTIVE_CATEGORY: ExpenseCategory = {
  id: 103,
  code: 'disabled',
  label: '비활성',
  sortOrder: 3,
  isActive: false,
  scope: 'TEAM',
}

const HEAD_COACH_USER: UserDto = {
  id: 1,
  email: 'coach@x',
  username: 'coach',
  nickname: '코치',
  role: 'COACHING_STAFF',
  coachingRole: 'HEAD_COACH',
  frontOfficeRole: null,
  departmentCategories: [],
  teamId: 1,
  clubId: 1,
  isOutOfOffice: false,
  language: 'ko',
}

const DEPT_HEAD_USER: UserDto = {
  ...HEAD_COACH_USER,
  role: 'FRONT_OFFICE',
  coachingRole: null,
  frontOfficeRole: 'HR_MANAGER',
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function renderWizard(props: {
  planStatus?: BudgetPlanStatus
  categories?: ExpenseCategory[]
  budgetPlan?: BudgetPlan | null
  currentUser?: UserDto | null
  onSubmitSuccess?: () => void
  seasonId?: number
}) {
  return render(
    <BudgetPlanWizard
      seasonId={props.seasonId ?? SEASON_ID}
      planStatus={props.planStatus}
      categories={props.categories ?? [TEAM_CATEGORY]}
      budgetPlan={props.budgetPlan ?? null}
      currentUser={props.currentUser ?? HEAD_COACH_USER}
      onSubmitSuccess={props.onSubmitSuccess}
    />,
    { wrapper }
  )
}

beforeEach(() => {
  submitCalls.length = 0
  window.localStorage.clear()
})
afterEach(() => {
  window.localStorage.clear()
  vi.clearAllMocks()
})

// ============================================================================
// Pure helpers
// ============================================================================

describe('BudgetPlanWizard helpers', () => {
  it('draftStorageKey 는 seasonId 별로 분리된다', () => {
    expect(draftStorageKey(1)).not.toBe(draftStorageKey(2))
    expect(draftStorageKey(42)).toBe('budget-plan-wizard:draft:42')
  })

  it('isEmptyLine: 트리거 없고 델타 0 이면 true', () => {
    expect(isEmptyLine(emptyLine(1))).toBe(true)
  })

  it('isEmptyLine: 트리거가 있으면 false', () => {
    expect(
      isEmptyLine({ ...emptyLine(1), triggers: ['MULTI_LOCATION'] })
    ).toBe(false)
  })

  it('isEmptyLine: 표준 델타가 0 이 아니면 false', () => {
    expect(
      isEmptyLine({ ...emptyLine(1), standardDelta: '5000' })
    ).toBe(false)
  })

  it('isEmptyLine: 프리미엄 델타가 0 이 아니면 false', () => {
    expect(
      isEmptyLine({ ...emptyLine(1), premiumDelta: '1000' })
    ).toBe(false)
  })

  it('inferRequesterScope: HEAD_COACH → TEAM', () => {
    expect(inferRequesterScope(HEAD_COACH_USER)).toBe('TEAM')
  })

  it('inferRequesterScope: 그 외 → DEPARTMENT', () => {
    expect(inferRequesterScope(DEPT_HEAD_USER)).toBe('DEPARTMENT')
  })

  it('inferRequesterScope: null 사용자 → null', () => {
    expect(inferRequesterScope(null)).toBe(null)
    expect(inferRequesterScope(undefined)).toBe(null)
  })

  it('basicCostByCategoryCode: Basic tier 없으면 0', () => {
    const plan: BudgetPlan = {
      id: 1,
      seasonId: 1,
      totalRevenue: 0,
      totalOperatingBudget: null,
      contingencyReserve: null,
      playerSalaryBudget: null,
      budgetCategoryPlans: [
        {
          id: 1,
          financialReportId: 1,
          category: 'utilities',
          mandatoryMinimum: 0,
          knapsackAllocated: null,
          tiers: [],
        },
      ],
      overrideLogs: [],
      actuals: null,
    }
    const m = basicCostByCategoryCode(plan)
    expect(m.get('utilities')).toBe(0)
  })

  it('basicCostByCategoryCode: Basic tier cost 를 뽑는다', () => {
    const plan: BudgetPlan = {
      id: 1,
      seasonId: 1,
      totalRevenue: 0,
      totalOperatingBudget: null,
      contingencyReserve: null,
      playerSalaryBudget: null,
      budgetCategoryPlans: [
        {
          id: 1,
          financialReportId: 1,
          category: 'utilities',
          mandatoryMinimum: 0,
          knapsackAllocated: null,
          tiers: [
            { id: 1, categoryPlanId: 1, name: 'Basic', cost: 250_000, value: 250_000, isSelected: true },
            { id: 2, categoryPlanId: 1, name: 'Standard', cost: 300_000, value: 400_000, isSelected: false },
          ],
        },
      ],
      overrideLogs: [],
      actuals: null,
    }
    expect(basicCostByCategoryCode(plan).get('utilities')).toBe(250_000)
  })

  it('basicCostByCategoryCode: null plan → empty map', () => {
    expect(basicCostByCategoryCode(null).size).toBe(0)
  })
})

// ============================================================================
// planStatus branching
// ============================================================================

describe('BudgetPlanWizard planStatus branching', () => {
  it.each([
    ['DRAFT', '심사 창 개방 대기'],
    ['CAPACITY_FAILED', '예산 부족 — GM 알림 발송됨'],
    ['KNAPSACK_EXECUTED', '재무팀 확정 대기'],
    ['AWAITING_GM_APPROVAL', 'GM 승인 대기'],
    ['FINALIZED', '편성 확정'],
    ['RE_PLANNING', 'GM 재편성 지시 — 새 심사 창 개방'],
  ] as const)('%s → read-only summary + 안내 문구 "%s"', (status, expectedText) => {
    renderWizard({ planStatus: status as BudgetPlanStatus })
    expect(screen.getByTestId('wizard-readonly')).toBeTruthy()
    expect(screen.getByText(expectedText)).toBeTruthy()
    expect(screen.queryByTestId('wizard-open')).toBeNull()
  })

  it('AWAITING_REVIEW → wizard 오픈 (CategoryEditor 렌더)', () => {
    renderWizard({ planStatus: 'AWAITING_REVIEW' })
    expect(screen.getByTestId('wizard-open')).toBeTruthy()
    // 카테고리 라벨이 렌더됨
    expect(screen.getByText('공공요금')).toBeTruthy()
    // Submit 버튼 (categories = 1, so single page → isLast)
    expect(screen.getByTestId('wizard-submit')).toBeTruthy()
  })

  it('planStatus undefined → read-only + "상태 정보를 불러오는 중" 표시', () => {
    renderWizard({ planStatus: undefined })
    expect(screen.getByTestId('wizard-readonly')).toBeTruthy()
    expect(screen.getByText(/상태 정보를 불러오는 중/)).toBeTruthy()
  })
})

// ============================================================================
// scope 필터
// ============================================================================

describe('BudgetPlanWizard scope 필터', () => {
  it('HEAD_COACH → TEAM scope 카테고리만 렌더', () => {
    renderWizard({
      planStatus: 'AWAITING_REVIEW',
      categories: [TEAM_CATEGORY, DEPT_CATEGORY],
      currentUser: HEAD_COACH_USER,
    })
    expect(screen.getByText('공공요금')).toBeTruthy()
    expect(screen.queryByText('시설')).toBeNull()
  })

  it('부서장 → DEPARTMENT scope 카테고리만 렌더', () => {
    renderWizard({
      planStatus: 'AWAITING_REVIEW',
      categories: [TEAM_CATEGORY, DEPT_CATEGORY],
      currentUser: DEPT_HEAD_USER,
    })
    expect(screen.queryByText('공공요금')).toBeNull()
    expect(screen.getByText('시설')).toBeTruthy()
  })

  it('isActive=false 카테고리는 제외', () => {
    renderWizard({
      planStatus: 'AWAITING_REVIEW',
      categories: [TEAM_CATEGORY, INACTIVE_CATEGORY],
      currentUser: HEAD_COACH_USER,
    })
    expect(screen.getByText('공공요금')).toBeTruthy()
    expect(screen.queryByText('비활성')).toBeNull()
  })

  it('스코프 카테고리가 하나도 없으면 empty 카드', () => {
    renderWizard({
      planStatus: 'AWAITING_REVIEW',
      categories: [DEPT_CATEGORY],
      currentUser: HEAD_COACH_USER,
    })
    expect(screen.getByTestId('wizard-empty')).toBeTruthy()
  })
})

// ============================================================================
// Pagination (5/page)
// ============================================================================

describe('BudgetPlanWizard pagination', () => {
  function makeCategories(n: number): ExpenseCategory[] {
    return Array.from({ length: n }, (_, i) => ({
      id: 1000 + i,
      code: `code-${i}`,
      label: `카테고리 ${i}`,
      sortOrder: i,
      isActive: true,
      scope: 'TEAM' as const,
    }))
  }

  it('5개 이하: 다음 버튼 대신 제출 버튼', () => {
    renderWizard({
      planStatus: 'AWAITING_REVIEW',
      categories: makeCategories(5),
    })
    expect(screen.getByTestId('wizard-submit')).toBeTruthy()
    expect(screen.queryByTestId('wizard-next')).toBeNull()
  })

  it('6개 이상: 첫 페이지 = 다음 버튼, 카테고리 5개 + 6번째는 안 보임', () => {
    renderWizard({
      planStatus: 'AWAITING_REVIEW',
      categories: makeCategories(7),
    })
    expect(screen.getByTestId('wizard-next')).toBeTruthy()
    expect(screen.queryByTestId('wizard-submit')).toBeNull()
    // 6번째, 7번째는 두 번째 페이지
    expect(screen.queryByText('카테고리 5')).toBeNull()
    expect(screen.queryByText('카테고리 6')).toBeNull()
    // 첫 카테고리 표시
    expect(screen.getByText('카테고리 0')).toBeTruthy()
  })

  it('다음 → 마지막 페이지에서 제출 버튼 노출', () => {
    renderWizard({
      planStatus: 'AWAITING_REVIEW',
      categories: makeCategories(7),
    })
    fireEvent.click(screen.getByTestId('wizard-next'))
    expect(screen.getByTestId('wizard-submit')).toBeTruthy()
    expect(screen.getByText('카테고리 5')).toBeTruthy()
    expect(screen.getByText('카테고리 6')).toBeTruthy()
  })
})

// ============================================================================
// Auto-save (localStorage)
// ============================================================================

describe('BudgetPlanWizard localStorage', () => {
  it('라인 변경 시 localStorage 에 저장된다', () => {
    renderWizard({ planStatus: 'AWAITING_REVIEW' })
    const trigger = screen.getByRole('button', { name: '다중거점 관리' })
    fireEvent.click(trigger)

    const raw = window.localStorage.getItem(draftStorageKey(SEASON_ID))
    expect(raw).toBeTruthy()
    const stored = JSON.parse(raw!) as Record<string, PlanRequestLineDraft>
    const line = stored[String(TEAM_CATEGORY.id)]
    expect(line.triggers).toContain('MULTI_LOCATION')
  })

  it('마운트 시 localStorage 에서 복원 + 안내 배너 표시', () => {
    const saved: Record<number, PlanRequestLineDraft> = {
      [TEAM_CATEGORY.id]: {
        ...emptyLine(TEAM_CATEGORY.id),
        triggers: ['DIRECT_BUSINESS'],
        standardDelta: '7777',
      },
    }
    window.localStorage.setItem(draftStorageKey(SEASON_ID), JSON.stringify(saved))

    renderWizard({ planStatus: 'AWAITING_REVIEW' })

    expect(screen.getByTestId('restored-notice')).toBeTruthy()
    // 복원된 표준 델타 값이 input 에 반영됐는지
    const standardInput = screen.getByLabelText(/표준 델타/) as HTMLInputElement
    expect(standardInput.value).toBe('7777')
  })

  it('seasonId 별로 draft 가 분리된다', () => {
    // 시즌 999 에 저장했지만 wizard 는 42 로 렌더 → 복원되지 않는다.
    window.localStorage.setItem(
      draftStorageKey(999),
      JSON.stringify({ 101: { ...emptyLine(101), standardDelta: '11111' } })
    )
    renderWizard({ planStatus: 'AWAITING_REVIEW', seasonId: 42 })
    const standardInput = screen.getByLabelText(/표준 델타/) as HTMLInputElement
    expect(standardInput.value).not.toBe('11111')
  })
})

// ============================================================================
// Submit
// ============================================================================

describe('BudgetPlanWizard submit', () => {
  it('빈 라인 (트리거 0 + 델타 0) 은 제출에서 자동 제외된다', async () => {
    // 여러 카테고리 중 하나만 트리거를 넣는다.
    const cats: ExpenseCategory[] = [
      TEAM_CATEGORY,
      { ...TEAM_CATEGORY, id: 999, code: 'other', label: '기타' },
    ]
    const onSuccess = vi.fn()
    renderWizard({
      planStatus: 'AWAITING_REVIEW',
      categories: cats,
      onSubmitSuccess: onSuccess,
    })

    // 첫 카테고리에 트리거만 클릭 → 라인 채워짐
    const triggerBtn = screen.getAllByRole('button', { name: '다중거점 관리' })[0]
    fireEvent.click(triggerBtn)

    // 제출
    fireEvent.click(screen.getByTestId('wizard-submit'))

    await waitFor(() => expect(submitCalls.length).toBeGreaterThan(0))
    const body = submitCalls[0].body as { lines: Array<{ categoryId: number }> }
    expect(body.lines.length).toBe(1)
    expect(body.lines[0].categoryId).toBe(TEAM_CATEGORY.id)
  })

  it('제출 성공 후 localStorage 가 clear 되고 onSubmitSuccess 콜백 발화', async () => {
    const onSuccess = vi.fn()
    renderWizard({ planStatus: 'AWAITING_REVIEW', onSubmitSuccess: onSuccess })

    fireEvent.click(screen.getByRole('button', { name: '다중거점 관리' }))
    // localStorage 에 뭔가 저장돼 있어야 함
    expect(window.localStorage.getItem(draftStorageKey(SEASON_ID))).toBeTruthy()

    fireEvent.click(screen.getByTestId('wizard-submit'))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(window.localStorage.getItem(draftStorageKey(SEASON_ID))).toBeNull()
  })

  it('제출 payload path 는 /financial-reports/{seasonId}/plan-requests', async () => {
    renderWizard({ planStatus: 'AWAITING_REVIEW' })
    fireEvent.click(screen.getByRole('button', { name: '다중거점 관리' }))
    fireEvent.click(screen.getByTestId('wizard-submit'))
    await waitFor(() => expect(submitCalls.length).toBeGreaterThan(0))
    expect(submitCalls[0].path).toBe(`/financial-reports/${SEASON_ID}/plan-requests`)
  })

  it('모든 라인이 비어 있으면 제출하지 않는다', async () => {
    renderWizard({ planStatus: 'AWAITING_REVIEW' })
    fireEvent.click(screen.getByTestId('wizard-submit'))
    // Wait a tick to give any async effects a chance
    await new Promise((r) => setTimeout(r, 0))
    expect(submitCalls.length).toBe(0)
  })
})

// ============================================================================
// Basic cost integration
// ============================================================================

describe('BudgetPlanWizard basicCost prop', () => {
  it('BudgetPlan Basic tier cost 를 CategoryEditor 에 전달한다', () => {
    const plan: BudgetPlan = {
      id: 1,
      seasonId: SEASON_ID,
      totalRevenue: 0,
      totalOperatingBudget: null,
      contingencyReserve: null,
      playerSalaryBudget: null,
      budgetCategoryPlans: [
        {
          id: 10,
          financialReportId: 1,
          category: 'utilities',
          mandatoryMinimum: 0,
          knapsackAllocated: null,
          tiers: [
            { id: 1, categoryPlanId: 10, name: 'Basic', cost: 555_555, value: 555_555, isSelected: true },
          ],
        },
      ],
      overrideLogs: [],
      actuals: null,
    }
    renderWizard({ planStatus: 'AWAITING_REVIEW', budgetPlan: plan })
    // Basic cost 표시가 555,555 로 나와야 함
    expect(screen.getByText('₩555,555')).toBeTruthy()
  })
})
