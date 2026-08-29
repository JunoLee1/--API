import { cn } from '@/lib/utils'
import type { TriggerType } from './types'

// #425: 로컬 정의를 걷어내고 shared union (`./types`) 을 그대로 사용한다.
// 기존 소비자가 `TriggerMultiSelect` 에서 re-import 하던 경우를 고려해 re-export.
export type { TriggerType }

/**
 * 가중(weighted) 트리거 - 예산 규모에 곱해서 반영. amber 계열 border.
 * 가산(additive) 트리거 - 고정 금액으로 더해서 반영. teal 계열 border.
 */
type TriggerCategory = 'weighted' | 'additive'

interface TriggerMeta {
  code: TriggerType
  label: string
  category: TriggerCategory
}

/** 순서 = ADR 0019 문서상 나열 순서 (가중 3종 → 가산 2종) */
const TRIGGERS: readonly TriggerMeta[] = [
  { code: 'MULTI_LOCATION', label: '다중거점 관리', category: 'weighted' },
  { code: 'DIRECT_BUSINESS', label: '사업 직접비', category: 'weighted' },
  { code: 'PUBLIC_UTILITY', label: '공공요금', category: 'weighted' },
  { code: 'HOME_MATCH', label: '홈경기 현장지원', category: 'additive' },
  { code: 'WEEKEND_OVERTIME', label: '주말 야근', category: 'additive' },
] as const

/**
 * category 별 border 색. selected/unselected 두 상태 모두에서 border 로 두 그룹을
 * 시각적으로 구분한다. filled(selected) 상태에서도 border 가 남도록 별도 조합.
 */
const CATEGORY_STYLES: Record<
  TriggerCategory,
  { selected: string; unselected: string; legendDot: string; legendLabel: string }
> = {
  weighted: {
    selected:
      'bg-amber-500 text-white border-amber-600 hover:bg-amber-500/90 dark:bg-amber-600 dark:border-amber-500',
    unselected:
      'bg-transparent text-amber-800 border-amber-400 hover:bg-amber-50 dark:text-amber-200 dark:border-amber-500/60 dark:hover:bg-amber-950/40',
    legendDot: 'bg-amber-500 border-amber-600',
    legendLabel: '가중',
  },
  additive: {
    selected:
      'bg-teal-600 text-white border-teal-700 hover:bg-teal-600/90 dark:bg-teal-700 dark:border-teal-600',
    unselected:
      'bg-transparent text-teal-800 border-teal-400 hover:bg-teal-50 dark:text-teal-200 dark:border-teal-500/60 dark:hover:bg-teal-950/40',
    legendDot: 'bg-teal-600 border-teal-700',
    legendLabel: '가산',
  },
}

interface Props {
  value: TriggerType[]
  onChange: (next: TriggerType[]) => void
  disabled?: boolean
}

/**
 * TriggerMultiSelect
 *
 * ADR 0019 편성 트리거 5종을 chip 형태로 다중 선택. 가중(MULTI_LOCATION,
 * DIRECT_BUSINESS, PUBLIC_UTILITY) 그룹과 가산(HOME_MATCH, WEEKEND_OVERTIME)
 * 그룹을 border color 로 구분하고, chip 하단에 두 카테고리 legend 를 표시.
 *
 * Chip primitive 는 shadcn `Badge` 대신 native `<button type="button">` 을
 * 사용했다 - Badge 는 `<span>` 기반 useRender 구조라 keyboard/aria-pressed
 * semantics 를 얹기 번거로워서 button 이 더 자연스럽다.
 */
export function TriggerMultiSelect({ value, onChange, disabled = false }: Props) {
  const selected = new Set(value)

  const toggle = (code: TriggerType) => {
    if (disabled) return
    const next = selected.has(code)
      ? value.filter((v) => v !== code)
      : [...value, code]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="편성 트리거 선택"
        className="flex flex-wrap gap-2"
      >
        {TRIGGERS.map((t) => {
          const isSelected = selected.has(t.code)
          const styles = CATEGORY_STYLES[t.category]
          return (
            <button
              key={t.code}
              type="button"
              onClick={() => toggle(t.code)}
              disabled={disabled}
              aria-pressed={isSelected}
              data-trigger-code={t.code}
              data-category={t.category}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                'disabled:pointer-events-none disabled:opacity-50',
                isSelected ? styles.selected : styles.unselected,
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Legend: 두 카테고리 의미 설명 */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {(['weighted', 'additive'] as const).map((cat) => {
          const s = CATEGORY_STYLES[cat]
          return (
            <div key={cat} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn('inline-block h-2.5 w-2.5 rounded-full border', s.legendDot)}
              />
              <span>{s.legendLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
