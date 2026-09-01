/**
 * CategoryEditor unit tests.
 *
 * Runner: vitest + @testing-library/react. tsconfig.app.json 이 __tests__ 를
 * exclude 하므로 프로덕션 typecheck 는 깨지 않는다. FE 러너가 도입되면 그대로
 * 통과하도록 표준 API 만 사용.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { CategoryEditor } from '../CategoryEditor'
import { emptyLine, type PlanRequestLineDraft, type TriggerType } from '../types'
import { TRIGGER_MULTIPLIER } from '../trigger-rules'

const CATEGORY = {
  id: 42,
  code: 'utilities',
  label: '공공요금',
  scope: 'TEAM' as const,
}

function Harness({
  basicCost = 100_000,
  initial,
  onChangeSpy,
  scope = 'TEAM',
  disabled,
}: {
  basicCost?: number
  initial?: PlanRequestLineDraft
  onChangeSpy?: (line: PlanRequestLineDraft) => void
  scope?: 'TEAM' | 'DEPARTMENT'
  disabled?: boolean
}) {
  const [line, setLine] = useState<PlanRequestLineDraft>(initial ?? emptyLine(CATEGORY.id))
  return (
    <CategoryEditor
      category={{ ...CATEGORY, scope }}
      basicCost={basicCost}
      line={line}
      disabled={disabled}
      onChange={(next) => {
        onChangeSpy?.(next)
        setLine(next)
      }}
    />
  )
}

describe('CategoryEditor', () => {
  it('scope badge, basic cost, 트리거 다중선택이 렌더된다', () => {
    render(<Harness basicCost={250_000} />)

    // scope badge (TEAM)
    const badge = screen.getByText('팀 스코프')
    expect(badge).toBeTruthy()
    expect(badge.getAttribute('data-scope-badge')).toBe('TEAM')

    // basic cost 표시
    expect(screen.getByText('₩250,000')).toBeTruthy()
    expect(screen.getByText('기본 원가')).toBeTruthy()

    // 트리거 그룹 존재
    expect(screen.getByRole('group', { name: '편성 트리거 선택' })).toBeTruthy()

    // 카테고리 라벨 (TriggerMultiSelect 의 PUBLIC_UTILITY chip 과 텍스트 충돌 →
    // Card 헤더 안에서만 찾도록 범위를 좁힌다).
    const card = document.querySelector(
      `[data-category-code="${CATEGORY.code}"]`,
    ) as HTMLElement | null
    expect(card).not.toBeNull()
    expect(within(card!).getAllByText('공공요금').length).toBeGreaterThan(0)
  })

  it('트리거가 하나도 없으면 표준 델타 input 이 disabled 이다', () => {
    render(<Harness />)
    const standardInput = screen.getByLabelText(/표준 델타/) as HTMLInputElement
    expect(standardInput.disabled).toBe(true)
  })

  it('가산 트리거가 없으면 프리미엄 델타 input 이 disabled 이다', () => {
    // 가중 트리거만 걸려 있는 상태
    render(
      <Harness
        initial={{
          ...emptyLine(CATEGORY.id),
          triggers: ['MULTI_LOCATION'],
        }}
      />
    )
    const premiumInput = screen.getByLabelText(/프리미엄 델타/) as HTMLInputElement
    expect(premiumInput.disabled).toBe(true)
    // 반대로 표준 델타는 이제 활성이어야 한다 (트리거가 있음)
    const standardInput = screen.getByLabelText(/표준 델타/) as HTMLInputElement
    expect(standardInput.disabled).toBe(false)
  })

  it('가중 트리거 하나 + delta 1000 → Standard value 미리보기가 정확히 계산된다', () => {
    // MULTI_LOCATION multiplier = 1.0 → value = round(1000 × 1.0) = 1000
    render(
      <Harness
        basicCost={0}
        initial={{
          ...emptyLine(CATEGORY.id),
          triggers: ['MULTI_LOCATION'],
          standardDelta: '1000',
        }}
      />
    )
    // 미리보기 블록 안에서 Standard value 를 찾는다
    const previewBlock = document.querySelector(
      '[data-preview-block="true"]'
    ) as HTMLElement | null
    expect(previewBlock).not.toBeNull()

    // Standard cost = 0 + 1000 = 1000. `₩` 와 숫자가 분리된 span 이라 getByText
    // 는 텍스트를 정확히 못 잡으므로 data-preview 로 직접 조회한다.
    const standardCost = previewBlock!.querySelector(
      '[data-preview="standard-cost"]',
    )
    expect(standardCost?.textContent).toBe('₩1,000')
    const standardValue = previewBlock!.querySelector(
      '[data-preview="standard-value"]',
    )
    expect(standardValue?.textContent).toBe('₩1,000')

    // Sanity check: 상수값이 backend 와 정합 (drift 방지)
    expect(TRIGGER_MULTIPLIER.MULTI_LOCATION).toBe(1.0)
  })

  it('트리거 토글, 표준 델타 입력, 프리미엄 델타 입력 각각에서 onChange 가 발화된다', () => {
    const onChange = vi.fn()

    render(
      <Harness
        initial={{
          ...emptyLine(CATEGORY.id),
          // 가산 트리거가 있어야 프리미엄 델타가 활성 → 입력 이벤트가 반영됨
          triggers: ['HOME_MATCH' as TriggerType],
        }}
        onChangeSpy={onChange}
      />
    )

    // (a) 트리거 토글: 아직 선택되지 않은 chip 클릭
    fireEvent.click(screen.getByRole('button', { name: '다중거점 관리' }))
    const firstCall = onChange.mock.calls[0]?.[0] as PlanRequestLineDraft | undefined
    expect(firstCall).toBeDefined()
    expect(firstCall!.triggers).toContain('HOME_MATCH')
    expect(firstCall!.triggers).toContain('MULTI_LOCATION')

    // (b) 표준 델타 입력
    const standardInput = screen.getByLabelText(/표준 델타/) as HTMLInputElement
    fireEvent.change(standardInput, { target: { value: '5000' } })
    const secondCall = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as
      | PlanRequestLineDraft
      | undefined
    expect(secondCall).toBeDefined()
    expect(secondCall!.standardDelta).toBe('5000')

    // (c) 프리미엄 델타 입력
    const premiumInput = screen.getByLabelText(/프리미엄 델타/) as HTMLInputElement
    expect(premiumInput.disabled).toBe(false)
    fireEvent.change(premiumInput, { target: { value: '2500' } })
    const thirdCall = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as
      | PlanRequestLineDraft
      | undefined
    expect(thirdCall).toBeDefined()
    expect(thirdCall!.premiumDelta).toBe('2500')
  })
})
