import { Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { TierRow } from './TierRow'
import { emptyTier, type DraftCategory, type DraftTier } from './types'

interface Props {
  /** Category code (from ExpenseCategory table) */
  code: string
  /** Human-readable label (from useExpenseCategories().labelOf) */
  label: string
  data: DraftCategory
  onChange: (next: DraftCategory) => void
}

export function CategoryEditor({ code, label, data, onChange }: Props) {
  const updateTier = (i: number, next: DraftTier) => {
    const tiers = [...data.tiers]
    tiers[i] = next
    onChange({ ...data, tiers })
  }
  const removeTier = (i: number) => {
    onChange({ ...data, tiers: data.tiers.filter((_, idx) => idx !== i) })
  }
  const addTier = () => {
    onChange({ ...data, tiers: [...data.tiers, emptyTier()] })
  }

  return (
    <Card data-category-code={code}>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>필수 최소 예산 (원)</Label>
          <Input
            type="number"
            placeholder="0"
            value={data.mandatoryMinimum}
            onChange={(e) => onChange({ ...data, mandatoryMinimum: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>세부 옵션</Label>
            <span className="text-xs text-muted-foreground">
              {data.tiers.length === 0 ? '옵션 없음' : `${data.tiers.length}개`}
            </span>
          </div>

          {data.tiers.length === 0 && (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
              이 카테고리에 예산 옵션을 추가하세요
            </div>
          )}

          {data.tiers.map((t, i) => (
            <TierRow
              key={i}
              tier={t}
              index={i}
              onChange={(next) => updateTier(i, next)}
              onRemove={() => removeTier(i)}
            />
          ))}

          <Button variant="outline" size="sm" onClick={addTier} className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            옵션 추가
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
