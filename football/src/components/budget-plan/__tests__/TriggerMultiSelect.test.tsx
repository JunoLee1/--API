/**
 * TriggerMultiSelect unit tests.
 *
 * Runner: vitest + @testing-library/react (표준 Vite 조합).
 * football/package.json 에는 아직 test runner 가 설치되어 있지 않다 -
 * FE 전반적으로 unit test 인프라가 없는 상태. 러너가 도입되면 이 파일이
 * 그대로 통과하도록 표준 API 만 사용했다.
 *
 * tsc --noEmit 은 tsconfig.app.json 에서 __tests__ 를 exclude 하므로
 * 이 파일의 미설치 import 는 프로덕션 typecheck 를 깨지 않는다.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { TriggerMultiSelect, type TriggerType } from '../TriggerMultiSelect'

/**
 * Controlled 래퍼 - 실제 사용 형태와 동일하게 부모가 state 를 소유한다.
 * onChange 콜백은 spy 로 감시하되 새 value 를 실제 반영해 다음 클릭에도
 * 정상 동작하게 한다.
 */
function Harness({
  initial = [],
  onChangeSpy,
  disabled,
}: {
  initial?: TriggerType[]
  onChangeSpy?: (next: TriggerType[]) => void
  disabled?: boolean
}) {
  const [value, setValue] = useState<TriggerType[]>(initial)
  return (
    <TriggerMultiSelect
      value={value}
      disabled={disabled}
      onChange={(next) => {
        onChangeSpy?.(next)
        setValue(next)
      }}
    />
  )
}

describe('TriggerMultiSelect', () => {
  it('5 개의 chip 을 렌더링한다', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: '다중거점 관리' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '사업 직접비' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '공공요금' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '홈경기 현장지원' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '주말 야근' })).toBeTruthy()
  })

  it('a11y: role="group" + aria-label 이 컨테이너에 걸려 있다', () => {
    render(<Harness />)
    const group = screen.getByRole('group', { name: '편성 트리거 선택' })
    expect(group).toBeTruthy()
  })

  it('선택되지 않은 chip 클릭 시 value 에 추가된다', () => {
    const onChange = vi.fn()
    render(<Harness onChangeSpy={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '홈경기 현장지원' }))
    expect(onChange).toHaveBeenLastCalledWith(['HOME_MATCH'])
  })

  it('이미 선택된 chip 클릭 시 value 에서 제거된다', () => {
    const onChange = vi.fn()
    render(<Harness initial={['MULTI_LOCATION', 'PUBLIC_UTILITY']} onChangeSpy={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '다중거점 관리' }))
    expect(onChange).toHaveBeenLastCalledWith(['PUBLIC_UTILITY'])
  })

  it('선택된 chip 은 aria-pressed=true 로 반영된다', () => {
    render(<Harness initial={['WEEKEND_OVERTIME']} />)
    const selectedChip = screen.getByRole('button', { name: '주말 야근' })
    const unselectedChip = screen.getByRole('button', { name: '홈경기 현장지원' })
    expect(selectedChip.getAttribute('aria-pressed')).toBe('true')
    expect(unselectedChip.getAttribute('aria-pressed')).toBe('false')
  })

  it('disabled 프롭이 true 이면 클릭이 onChange 를 호출하지 않는다', () => {
    const onChange = vi.fn()
    render(<Harness disabled onChangeSpy={onChange} />)
    const chip = screen.getByRole('button', { name: '다중거점 관리' })
    // disabled 속성 자체가 걸려 있어 fireEvent.click 은 아무 것도 발생시키지 않음
    expect((chip as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(chip)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('가중 vs 가산 chip 은 서로 다른 data-category 를 갖는다 (border color 구분 근거)', () => {
    render(<Harness />)
    const weighted = screen.getByRole('button', { name: '사업 직접비' })
    const additive = screen.getByRole('button', { name: '홈경기 현장지원' })
    expect(weighted.getAttribute('data-category')).toBe('weighted')
    expect(additive.getAttribute('data-category')).toBe('additive')
  })
})
