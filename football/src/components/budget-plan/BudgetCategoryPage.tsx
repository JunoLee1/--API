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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CategoryEditor } from './CategoryEditor'
import { emptyCategory, type DraftBudgetPlan, type DraftCategory } from './types'

export interface CategoryPageItem {
  code: string
  label: string
}

interface Props {
  draft: DraftBudgetPlan
  /** Categories to render on this page (max 5) — page slice, in draft order. */
  items: CategoryPageItem[]
  onChange: (next: DraftBudgetPlan) => void
}

/**
 * Renders one wizard page of categories with drag-and-drop reordering.
 * Reordering is scoped to the page (5 categories max) — categories do NOT
 * jump between pages, matching the wizard's CATEGORIES_PER_PAGE contract.
 */
export function BudgetCategoryPage({ draft, items, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const pageCodes = items.map((it) => it.code)
  const dndIds = pageCodes.map((code) => `category-${code}`)

  const updateCategory = (code: string, next: DraftCategory) => {
    onChange({
      ...draft,
      categories: draft.categories.map((c) =>
        c.code === code ? { ...c, data: next } : c
      ),
    })
  }

  const handleCategoryDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return

    // Local page indices for the moved item and the drop target.
    const activeCode = String(active.id).replace(/^category-/, '')
    const overCode = String(over.id).replace(/^category-/, '')
    const localOld = pageCodes.indexOf(activeCode)
    const localNew = pageCodes.indexOf(overCode)
    if (localOld < 0 || localNew < 0) return

    // Translate to global indices in the draft's category list so arrayMove
    // preserves off-page categories in their existing slots.
    const globalOld = draft.categories.findIndex((c) => c.code === activeCode)
    const globalNew = draft.categories.findIndex((c) => c.code === overCode)
    if (globalOld < 0 || globalNew < 0) return

    onChange({
      ...draft,
      categories: arrayMove(draft.categories, globalOld, globalNew),
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleCategoryDragEnd}
    >
      <SortableContext items={dndIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {items.map((item) => {
            const entry = draft.categories.find((c) => c.code === item.code)
            return (
              <CategoryEditor
                key={item.code}
                id={`category-${item.code}`}
                code={item.code}
                label={item.label}
                data={entry?.data ?? emptyCategory()}
                onChange={(next) => updateCategory(item.code, next)}
              />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}
