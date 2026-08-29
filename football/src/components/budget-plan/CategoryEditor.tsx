import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { TriggerMultiSelect } from './TriggerMultiSelect'
import type { PlanRequestLineDraft, TriggerType } from './types'
import { calcTierValue, hasAdditiveTrigger } from './trigger-rules'

interface Props {
  category: {
    id: number
    code: string
    label: string
    scope: 'TEAM' | 'DEPARTMENT'
  }
  /** 자동화 예산 Basic 티어 원가 (원). 서버 preview 결과에서 온다. */
  basicCost: number
  line: PlanRequestLineDraft
  onChange: (line: PlanRequestLineDraft) => void
  disabled?: boolean
}

/** 안전한 정수 파싱 - 빈 문자열/NaN 은 0. */
function toInt(s: string): number {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

const SCOPE_LABEL: Record<Props['category']['scope'], string> = {
  TEAM: '팀 스코프',
  DEPARTMENT: '부서 스코프',
}

const SCOPE_BADGE_CLASS: Record<Props['category']['scope'], string> = {
  // 팀 = teal, 부서 = amber (ADR 0019 색상 관례와 정합)
  TEAM: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950 dark:text-teal-100 dark:border-teal-800',
  DEPARTMENT:
    'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
}

/**
 * 팀장/부서장이 카테고리 하나에 대해 편성 요청 한 줄을 입력하는 카드.
 *
 * 데이터 흐름:
 *   basicCost (자동화 예산, 서버) + line.standardDelta / line.premiumDelta (사용자 입력)
 *   → tier value = round(delta × Σ TRIGGER_MULTIPLIER)  [ADR 0020]
 *
 * ADR 0019 게이트:
 *   - 트리거 하나도 없으면 델타 자체를 입력 못 하게 잠근다 (Basic 전용)
 *   - Premium 델타는 가산 트리거 (HOME_MATCH / WEEKEND_OVERTIME) 있을 때만 활성
 *
 * `disabled` prop 은 상위 (예: 마감 후 lock, 심사 진행 중 등) 에서 전체 차단할 때 사용.
 */
export function CategoryEditor({
  category,
  basicCost,
  line,
  onChange,
  disabled = false,
}: Props) {
  const noTriggers = line.triggers.length === 0
  const additivePresent = hasAdditiveTrigger(line.triggers)

  const standardDeltaNum = toInt(line.standardDelta)
  const premiumDeltaNum = toInt(line.premiumDelta)

  const standardCost = basicCost + standardDeltaNum
  const standardValue = calcTierValue(standardDeltaNum, line.triggers)
  const premiumCost = standardCost + premiumDeltaNum
  const premiumValue = calcTierValue(premiumDeltaNum, line.triggers)

  const setTriggers = (triggers: TriggerType[]) => {
    // 가산 트리거가 사라졌는데 premiumDelta 가 남아 있으면 서버 승격 룰과 안 맞음.
    // 사용자 데이터 손실 방지를 위해 즉시 지우지는 않고, UI 에서 자연히 disabled 되어
    // 서브밋 직전에 draft-to-payload 단계에서 무시된다.
    onChange({ ...line, triggers })
  }

  return (
    <Card
      data-category-code={category.code}
      data-category-id={category.id}
      data-category-scope={category.scope}
    >
      <CardHeader className="flex flex-row items-center gap-2 pb-2 space-y-0">
        <CardTitle className="text-base flex-1">{category.label}</CardTitle>
        <Badge
          variant="outline"
          className={cn('border', SCOPE_BADGE_CLASS[category.scope])}
          data-scope-badge={category.scope}
        >
          {SCOPE_LABEL[category.scope]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 1) Basic cost 미리보기 (read-only) */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">기본 원가</span>
            <span className="text-sm font-medium tabular-nums">
              ₩{basicCost.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            자동화 예산 미리보기 (budget-automation)
          </p>
        </div>

        {/* 2) 트리거 선택 */}
        <div className="space-y-1">
          <Label>편성 트리거</Label>
          <TriggerMultiSelect
            value={line.triggers}
            onChange={setTriggers}
            disabled={disabled}
          />
        </div>

        {/* 3) 표준 델타 */}
        <div className="space-y-1">
          <Label htmlFor={`standard-delta-${category.id}`}>표준 델타 (₩)</Label>
          <Input
            id={`standard-delta-${category.id}`}
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={line.standardDelta}
            onChange={(e) => onChange({ ...line, standardDelta: e.target.value })}
            disabled={disabled || noTriggers}
            aria-describedby={`standard-hint-${category.id}`}
          />
          {noTriggers && (
            <p
              id={`standard-hint-${category.id}`}
              className="text-xs text-muted-foreground"
            >
              트리거를 하나 이상 선택해야 표준 델타를 입력할 수 있어요 (ADR 0019).
            </p>
          )}
        </div>

        {/* 4) 프리미엄 델타 */}
        <div className="space-y-1">
          <Label htmlFor={`premium-delta-${category.id}`}>프리미엄 델타 (₩)</Label>
          <Input
            id={`premium-delta-${category.id}`}
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={line.premiumDelta}
            onChange={(e) => onChange({ ...line, premiumDelta: e.target.value })}
            disabled={disabled || !additivePresent}
            aria-describedby={`premium-hint-${category.id}`}
          />
          {!additivePresent && (
            <p
              id={`premium-hint-${category.id}`}
              className="text-xs text-muted-foreground"
            >
              가산 트리거 (홈경기 현장지원 / 주말 야근) 가 있을 때만 프리미엄 델타를
              입력할 수 있어요.
            </p>
          )}
        </div>

        {/* 5) Value preview */}
        {!noTriggers && (
          <div
            className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm"
            data-preview-block="true"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Standard cost</span>
              <span
                className="font-medium tabular-nums"
                data-preview="standard-cost"
              >
                ₩{standardCost.toLocaleString()}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Standard value</span>
              <span
                className="font-medium tabular-nums"
                data-preview="standard-value"
              >
                ₩{standardValue.toLocaleString()}
              </span>
            </div>
            {additivePresent && (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">Premium cost</span>
                  <span
                    className="font-medium tabular-nums"
                    data-preview="premium-cost"
                  >
                    ₩{premiumCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">Premium value</span>
                  <span
                    className="font-medium tabular-nums"
                    data-preview="premium-value"
                  >
                    ₩{premiumValue.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* 6) 증빙 URL (optional) */}
        <div className="space-y-1">
          <Label htmlFor={`evidence-${category.id}`}>증빙 URL</Label>
          <Input
            id={`evidence-${category.id}`}
            type="url"
            placeholder="https://..."
            value={line.evidenceUrl ?? ''}
            onChange={(e) => {
              const v = e.target.value
              // 빈 문자열이면 optional 필드에서 제외 (draft payload 를 지저분하게 만들지 않음)
              const next = { ...line }
              if (v === '') delete next.evidenceUrl
              else next.evidenceUrl = v
              onChange(next)
            }}
            disabled={disabled}
          />
        </div>

        {/* 7) 메모 (optional) */}
        <div className="space-y-1">
          <Label htmlFor={`comment-${category.id}`}>메모</Label>
          <Textarea
            id={`comment-${category.id}`}
            placeholder="심사에 참고할 사유·근거를 적어주세요"
            value={line.comment ?? ''}
            onChange={(e) => {
              const v = e.target.value
              const next = { ...line }
              if (v === '') delete next.comment
              else next.comment = v
              onChange(next)
            }}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  )
}
