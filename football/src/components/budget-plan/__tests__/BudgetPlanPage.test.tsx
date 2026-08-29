/**
 * BudgetPlanPage unit tests.
 *
 * Runner: vitest + @testing-library/react. tsconfig.app.json 이 __tests__ 를
 * exclude 하므로 프로덕션 typecheck 는 깨지 않는다. FE 러너가 도입되면 그대로
 * 통과하도록 표준 API 만 사용.
 *
 * `useCurrentUser` 훅과 `financialReportApi.get` 을 모두 module-level 로 vi.mock
 * 하여 뷰 분기 (persona x planStatus) 만 격리 검증한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { UserDto } from '@/types/auth'
import type { BudgetPlanStatus } from '@/services/budget-plan.service'

// ---------------------------------------------------------------------------
// Mocks (must be declared BEFORE the SUT import so vitest hoists them).
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

// eslint-disable-next-line import/first
import { BudgetPlanPage } from '../BudgetPlanPage'

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

async function renderWithStatus(user: UserDto, status: BudgetPlanStatus) {
  mockUser.value = user
  financialReportGet.mockResolvedValueOnce({ planStatus: status })
  await act(async () => {
    render(<BudgetPlanPage seasonId={7} />)
  })
  // wait for planStatus to settle
  await waitFor(() => {
    expect(screen.getByText('편성 워크플로우')).toBeTruthy()
  })
}

beforeEach(() => {
  financialReportGet.mockReset()
})

afterEach(() => {
  mockUser.value = null
})

describe('BudgetPlanPage view dispatch', () => {
  it('COACHING_STAFF + HEAD_COACH → 팀장/부서장 위저드 placeholder', async () => {
    await renderWithStatus(
      makeUser({ role: 'COACHING_STAFF', coachingRole: 'HEAD_COACH' }),
      'AWAITING_REVIEW'
    )
    const section = document.querySelector('[data-persona="TEAM_LEADER"]')
    expect(section).toBeTruthy()
    // 뱃지도 함께 렌더
    expect(screen.getByText('심사 창 개방')).toBeTruthy()
  })

  it('FRONT_OFFICE + FINANCE_MANAGER → FMReview placeholder', async () => {
    await renderWithStatus(
      makeUser({ role: 'FRONT_OFFICE', frontOfficeRole: 'FINANCE_MANAGER' }),
      'KNAPSACK_EXECUTED'
    )
    expect(document.querySelector('[data-persona="FINANCE_MANAGER"]')).toBeTruthy()
    expect(screen.getByText('Knapsack 실행 완료')).toBeTruthy()
  })

  it('GM → GM placeholder', async () => {
    await renderWithStatus(makeUser({ role: 'GM' }), 'FINALIZED')
    expect(document.querySelector('[data-persona="GM"]')).toBeTruthy()
    expect(screen.getByText('확정')).toBeTruthy()
  })

  it('ADMIN → 뱃지 + 기본 정보', async () => {
    await renderWithStatus(makeUser({ role: 'ADMIN' }), 'DRAFT')
    expect(document.querySelector('[data-persona="ADMIN"]')).toBeTruthy()
    expect(screen.getByText('초안')).toBeTruthy()
  })

  it('FRONT_OFFICE + non-FINANCE role (예: SCOUT) → 팀장/부서장 위저드로 취급', async () => {
    await renderWithStatus(
      makeUser({ role: 'FRONT_OFFICE', frontOfficeRole: 'SCOUT' }),
      'CAPACITY_FAILED'
    )
    expect(document.querySelector('[data-persona="TEAM_LEADER"]')).toBeTruthy()
    expect(screen.getByText('예산 부족')).toBeTruthy()
  })

  it('그 외 (일반 코치) → 접근 불가 안내 + 뱃지', async () => {
    await renderWithStatus(
      makeUser({ role: 'COACHING_STAFF', coachingRole: 'ASSISTANT_COACH' }),
      'RE_PLANNING'
    )
    expect(document.querySelector('[data-persona="OTHER"]')).toBeTruthy()
    expect(screen.getByText('재편성 중')).toBeTruthy()
  })
})
