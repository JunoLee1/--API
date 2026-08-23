import { GripVertical, Plus } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { TierRow } from './TierRow'
import { emptyTier, type DraftCategory, type DraftTier } from './types'

interface Props {
  /** dnd-kit identity for this card in the parent SortableContext. */
  id: string
  /** Category code (from ExpenseCategory table) */
  code: string
  /** Human-readable label (from useExpenseCategories().labelOf) */
  label: string
  data: DraftCategory
  onChange: (next: DraftCategory) => void
}

export function CategoryEditor({ id, code, label, data, onChange }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const cardStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Small activationConstraint so click-to-focus on inputs still works.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const tierIds = data.tiers.map((_, i) => `${code}-tier-${i}`)

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

  const handleTierDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = tierIds.indexOf(String(active.id))
    const newIdx = tierIds.indexOf(String(over.id))
    if (oldIdx < 0 || newIdx < 0) return
    onChange({ ...data, tiers: arrayMove(data.tiers, oldIdx, newIdx) })
  }

  return (
    <div ref={setNodeRef} style={cardStyle}>
      <Card data-category-code={code}>
        <CardHeader className="flex flex-row items-center gap-2 pb-2 space-y-0">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`${label} 카테고리 순서 변경`}
            className="cursor-grab active:cursor-grabbing text-muted-foreground flex items-center justify-center"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <CardTitle className="text-base flex-1">{label}</CardTitle>
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

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleTierDragEnd}
            >
              <SortableContext items={tierIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {data.tiers.map((t, i) => (
                    <TierRow
                      key={tierIds[i]}
                      id={tierIds[i]!}
                      tier={t}
                      index={i}
                      onChange={(next) => updateTier(i, next)}
                      onRemove={() => removeTier(i)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <Button variant="outline" size="sm" onClick={addTier} className="w-full">
              <Plus className="h-4 w-4 mr-1" />
              옵션 추가
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
