/**
 * BudgetPlanPage violation banner tests (issue #453 F4).
 *
 * mandatoryMinimum 위반 배너의 표시/비표시 + GM shortcut 노출을 격리 검증.
 * 기존 BudgetPlanPage.test.tsx 는 뷰 분기만 다루므로 배너 관련은 여기서만.
 *
 * Runner: vitest + @testing-library/react. tsconfig.app.json 이 __tests__ 를
 * exclude 하므로 프로덕션 typecheck 는 깨지 않는다.
 *
 * 검증 항목:
 *   1) basicCost < mm 카테고리 있을 시 배너 노출 + 위반 카운트/chip 정확.
 *   2) basicCost >= mm 뿐이면 배너 미표시.
 *   3) GM role 시 재편성 트리거 shortcut 노출, 그 외 role 은 미노출.
 *   4) 위반 없음 → 배너 자체 렌더되지 않음.
 *   5) `detectMinimumViolations` 순수 함수 단위 스냅샷.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { UserDto } from '@/types/auth'
import type { BudgetPlan } from '@/types/budget'
import type { BudgetPlanStatus } from '@/services/budget-plan.service'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = vi.hoisted<{ value: UserDto | null }>(() => ({ value: null }))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: mockUser.value,
    loading: false,
    refetch: async () => {},
  }),
}))

const financialReportGet = vi.hoisted(() => vi.fn())
vi.mock('@/services/financial-report.service', () => ({
  financialReportApi: {
    get: (seasonId: number) => financialReportGet(seasonId),
  },
}))

// useBudgetPlan 은 실제 서비스에서 import 되므로 스텁으로 대체.
const budgetPlanMock = vi.hoisted<{ data: BudgetPlan | null | undefined }>(() => ({
  data: null,
}))

vi.mock('@/services/budget-plan.service', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/services/budget-plan.service',
  )
  return {
    ...actual,
    useBudgetPlan: () => ({
      data: budgetPlanMock.data,
      isLoading: false,
      isError: false,
    }),
  }
})

// useExpenseCategories — labelOf 만 소비.
vi.mock('@/hooks/useExpenseCategories', () => ({
  useExpenseCategories: () => ({
    rows: [
      { id: 1, code: 'salary', label: '선수 급여', sortOrder: 0, isActive: true, scope: 'TEAM' },
      { id: 2, code: 'facility', label: '시설 유지', sortOrder: 1, isActive: true, scope: 'DEPARTMENT' },
    ],
    loading: false,
    labelOf: (code: string) => {
      if (code === 'salary') return '선수 급여'
      if (code === 'facility') return '시설 유지'
      return code
    },
  }),
}))

// GmReplanPanel 은 무거운 hook 을 가지므로 lightweight 스텁으로 대체 (배너 테스트
// 는 페이지 상단 배너에만 관심이 있음).
vi.mock('../GmReplanPanel', () => ({
  GmReplanPanel: ({ seasonId }: { seasonId: number }) => (
    <section data-testid="gm-re-plan-panel-stub">GM Panel {seasonId}</section>
  ),
}))

// eslint-disable-next-line import/first
import {
  BudgetPlanPage,
  detectMinimumViolations,
} from '../BudgetPlanPage'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeUser(over: Partial<UserDto>): UserDto {
  return {
    id: 1,
    email: 'x@x.com',
    username: 'x',
    nickname: 'x',
    role: 'ADMIN',
    coachingRole: null,
    frontOfficeRole: null,
    departmentCategories: [],
    teamId: null,
    clubId: null,
    isOutOfOffice: false,
    language: 'ko',
    ...over,
  }
}

function makePlan(
  overrides: Array<{
    id: number
    category: string
    mandatoryMinimum: number
    basicCost: number
  }>,
): BudgetPlan {
  return {
    id: 1,
    seasonId: 7,
    totalRevenue: 0,
    totalOperatingBudget: null,
    contingencyReserve: null,
    playerSalaryBudget: null,
    budgetCategoryPlans: overrides.map((o) => ({
      id: o.id,
      financialReportId: 1,
      category: o.category,
      mandatoryMinimum: o.mandatoryMinimum,
      knapsackAllocated: null,
      tiers: [
        {
          id: o.id * 10,
          categoryPlanId: o.id,
          name: 'Basic',
          cost: o.basicCost,
          value: 1,
          isSelected: true,
        },
      ],
    })),
    overrideLogs: [],
    actuals: null,
  }
}

async function renderPage(
  user: UserDto,
  status: BudgetPlanStatus,
  plan: BudgetPlan | null,
) {
  mockUser.value = user
  budgetPlanMock.data = plan
  financialReportGet.mockResolvedValueOnce({ planStatus: status })

  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  await act(async () => {
    render(
      <QueryClientProvider client={qc}>
        <BudgetPlanPage seasonId={7} />
      </QueryClientProvider>,
    )
  })
  await waitFor(() => {
    expect(screen.getByText('편성 워크플로우')).toBeTruthy()
  })
}

beforeEach(() => {
  financialReportGet.mockReset()
  budgetPlanMock.data = null
  mockUser.value = null
})

afterEach(() => {
  mockUser.value = null
  budgetPlanMock.data = null
})

// ---------------------------------------------------------------------------
// (1) detectMinimumViolations 순수 로직
// ---------------------------------------------------------------------------
describe('detectMinimumViolations', () => {
  it('basicCost < mm 항목만 위반으로 판정한다', () => {
    const plan = makePlan([
      { id: 1, category: 'salary', mandatoryMinimum: 1_000_000, basicCost: 500_000 },
      { id: 2, category: 'facility', mandatoryMinimum: 800_000, basicCost: 800_000 },
      { id: 3, category: 'utilities', mandatoryMinimum: 200_000, basicCost: 300_000 },
    ])
    const result = detectMinimumViolations(plan)
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      categoryPlanId: 1,
      categoryCode: 'salary',
      basicCost: 500_000,
      mandatoryMinimum: 1_000_000,
    })
  })

  it('Basic tier 가 없으면 basicCost=0 으로 취급해 mm>0 이면 위반', () => {
    const plan: BudgetPlan = {
      id: 1,
      seasonId: 7,
      totalRevenue: 0,
      totalOperatingBudget: null,
      contingencyReserve: null,
      playerSalaryBudget: null,
      budgetCategoryPlans: [
        {
          id: 1,
          financialReportId: 1,
          category: 'salary',
          mandatoryMinimum: 500_000,
          knapsackAllocated: null,
          tiers: [
            {
              id: 10,
              categoryPlanId: 1,
              name: 'Premium', // Basic 없음
              cost: 999_000,
              value: 1,
              isSelected: true,
            },
          ],
        },
      ],
      overrideLogs: [],
      actuals: null,
    }
    const result = detectMinimumViolations(plan)
    expect(result.length).toBe(1)
    expect(result[0]!.basicCost).toBe(0)
  })

  it('plan 이 null/undefined 이면 빈 배열', () => {
    expect(detectMinimumViolations(null)).toEqual([])
    expect(detectMinimumViolations(undefined)).toEqual([])
  })

  it('mm 이 0 이면 basicCost >= 0 이라 위반 아님', () => {
    const plan = makePlan([
      { id: 1, category: 'salary', mandatoryMinimum: 0, basicCost: 0 },
    ])
    expect(detectMinimumViolations(plan)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// (2) 배너 노출 조건
// ---------------------------------------------------------------------------
describe('BudgetPlanPage — mandatoryMinimum 위반 배너', () => {
  it('위반 카테고리가 있으면 배너가 노출되고 카운트와 chip 이 정확하다', async () => {
    const plan = makePlan([
      { id: 1, category: 'salary', mandatoryMinimum: 1_000_000, basicCost: 500_000 },
      { id: 2, category: 'facility', mandatoryMinimum: 800_000, basicCost: 100_000 },
    ])
    await renderPage(makeUser({ role: 'ADMIN' }), 'FINALIZED', plan)

    const banner = screen.getByTestId('mm-violation-banner')
    expect(banner).toBeTruthy()
    expect(banner.getAttribute('data-violation-count')).toBe('2')
    expect(banner.getAttribute('role')).toBe('alert')
    expect(screen.getByTestId('mm-violation-chip-salary')).toBeTruthy()
    expect(screen.getByTestId('mm-violation-chip-facility')).toBeTruthy()
    // headline 안에 카운트 노출
    const headline = screen.getByTestId('mm-violation-headline')
    expect(headline.textContent).toContain('2개')
  })

  it('위반이 없으면 배너가 렌더되지 않는다', async () => {
    const plan = makePlan([
      { id: 1, category: 'salary', mandatoryMinimum: 500_000, basicCost: 500_000 },
      { id: 2, category: 'facility', mandatoryMinimum: 200_000, basicCost: 300_000 },
    ])
    await renderPage(makeUser({ role: 'ADMIN' }), 'FINALIZED', plan)

    expect(screen.queryByTestId('mm-violation-banner')).toBeNull()
  })

  it('BudgetPlan 데이터가 없으면 배너 미표시', async () => {
    await renderPage(makeUser({ role: 'ADMIN' }), 'FINALIZED', null)
    expect(screen.queryByTestId('mm-violation-banner')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// (3) GM shortcut 노출
// ---------------------------------------------------------------------------
describe('BudgetPlanPage — GM shortcut 노출', () => {
  const violationPlan = makePlan([
    { id: 1, category: 'salary', mandatoryMinimum: 1_000_000, basicCost: 500_000 },
  ])

  it('GM role 이면 "재편성 트리거" shortcut 이 anchor 로 노출된다', async () => {
    await renderPage(makeUser({ role: 'GM' }), 'FINALIZED', violationPlan)
    const shortcut = screen.getByTestId(
      'mm-violation-replan-shortcut',
    ) as HTMLAnchorElement
    expect(shortcut).toBeTruthy()
    // href 가 GmReplanPanel anchor 를 가리킨다
    expect(shortcut.getAttribute('href')).toBe('#gm-replan-panel')
  })

  it('FM 은 shortcut 이 노출되지 않는다', async () => {
    await renderPage(
      makeUser({ role: 'FRONT_OFFICE', frontOfficeRole: 'FINANCE_MANAGER' }),
      'FINALIZED',
      violationPlan,
    )
    // 배너 자체는 노출 (모든 role 에게 표시)
    expect(screen.getByTestId('mm-violation-banner')).toBeTruthy()
    expect(screen.queryByTestId('mm-violation-replan-shortcut')).toBeNull()
  })

  it('ADMIN 도 shortcut 이 노출되지 않는다', async () => {
    await renderPage(makeUser({ role: 'ADMIN' }), 'FINALIZED', violationPlan)
    expect(screen.getByTestId('mm-violation-banner')).toBeTruthy()
    expect(screen.queryByTestId('mm-violation-replan-shortcut')).toBeNull()
  })

  it('TEAM_LEADER (HEAD_COACH) 도 shortcut 이 노출되지 않는다', async () => {
    await renderPage(
      makeUser({ role: 'COACHING_STAFF', coachingRole: 'HEAD_COACH' }),
      'FINALIZED',
      violationPlan,
    )
    expect(screen.getByTestId('mm-violation-banner')).toBeTruthy()
    expect(screen.queryByTestId('mm-violation-replan-shortcut')).toBeNull()
  })
})
