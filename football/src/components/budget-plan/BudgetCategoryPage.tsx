import { CategoryEditor } from './CategoryEditor'
import { emptyCategory, type DraftBudgetPlan, type DraftCategory } from './types'

export interface CategoryPageItem {
  code: string
  label: string
}

interface Props {
  draft: DraftBudgetPlan
  /** Categories to render on this page (max 5) */
  items: CategoryPageItem[]
  onChange: (next: DraftBudgetPlan) => void
}

export function BudgetCategoryPage({ draft, items, onChange }: Props) {
  const updateCategory = (code: string, next: DraftCategory) => {
    onChange({
      ...draft,
      categories: { ...draft.categories, [code]: next },
    })
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <CategoryEditor
          key={item.code}
          code={item.code}
          label={item.label}
          data={draft.categories[item.code] ?? emptyCategory()}
          onChange={(next) => updateCategory(item.code, next)}
        />
      ))}
    </div>
  )
}
