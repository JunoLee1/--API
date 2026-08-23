import { GripVertical, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { DraftTier } from './types'

interface Props {
  /** dnd-kit identity — must be unique within the parent SortableContext. */
  id: string
  tier: DraftTier
  index: number
  onChange: (tier: DraftTier) => void
  onRemove: () => void
}

export function TierRow({ id, tier, index, onChange, onRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[24px_1fr_120px_100px_auto] gap-2 items-center"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`옵션 ${index + 1} 순서 변경`}
        className="cursor-grab active:cursor-grabbing text-muted-foreground flex items-center justify-center"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        placeholder="옵션 이름 (예: 기본 방화벽 유지보수)"
        value={tier.name}
        onChange={(e) => onChange({ ...tier, name: e.target.value })}
        aria-label={`옵션 ${index + 1} 이름`}
      />
      <Input
        type="number"
        placeholder="비용"
        value={tier.cost}
        onChange={(e) => onChange({ ...tier, cost: e.target.value })}
        aria-label={`옵션 ${index + 1} 비용`}
      />
      <Input
        type="number"
        placeholder="가치"
        value={tier.value}
        onChange={(e) => onChange({ ...tier, value: e.target.value })}
        aria-label={`옵션 ${index + 1} 가치`}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`옵션 ${index + 1} 삭제`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  )
}
