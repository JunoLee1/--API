/**
 * PlanStatusBadge unit tests.
 *
 * Runner: vitest + @testing-library/react. tsconfig.app.json 이 __tests__ 를
 * exclude 하므로 프로덕션 typecheck 는 깨지 않는다. FE 러너가 도입되면 그대로
 * 통과하도록 표준 API 만 사용.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlanStatusBadge } from '../PlanStatusBadge'
import type { BudgetPlanStatus } from '@/services/budget-plan.service'

const LABEL: Record<BudgetPlanStatus, string> = {
  DRAFT: '초안',
  CAPACITY_FAILED: '예산 부족',
  AWAITING_REVIEW: '심사 창 개방',
  KNAPSACK_EXECUTED: 'Knapsack 실행 완료',
  AWAITING_GM_APPROVAL: 'GM 승인 대기',
  FINALIZED: '확정',
  RE_PLANNING: '재편성 중',
}

const ALL_STATUSES: BudgetPlanStatus[] = [
  'DRAFT',
  'CAPACITY_FAILED',
  'AWAITING_REVIEW',
  'KNAPSACK_EXECUTED',
  'AWAITING_GM_APPROVAL',
  'FINALIZED',
  'RE_PLANNING',
]

describe('PlanStatusBadge', () => {
  it.each(ALL_STATUSES)('renders %s with the matching Korean label', (status) => {
    const { unmount } = render(<PlanStatusBadge status={status} />)
    // data-plan-status 로 상태 로케이트 → 라벨 매치
    const badge = screen.getByText(LABEL[status])
    expect(badge).toBeTruthy()
    // 아이콘 (svg) 이 함께 렌더된다
    const wrapper = badge.closest('[data-plan-status]')
    expect(wrapper?.getAttribute('data-plan-status')).toBe(status)
    expect(wrapper?.querySelector('svg')).toBeTruthy()
    unmount()
  })

  it('renders all 7 statuses with distinct labels', () => {
    const labels = new Set(ALL_STATUSES.map((s) => LABEL[s]))
    expect(labels.size).toBe(7)
  })

  it('passes custom className through to the underlying Badge', () => {
    render(<PlanStatusBadge status="DRAFT" className="ml-2 custom-marker" />)
    const wrapper = screen
      .getByText('초안')
      .closest('[data-plan-status]') as HTMLElement
    expect(wrapper.className).toContain('custom-marker')
    expect(wrapper.className).toContain('ml-2')
  })
})
