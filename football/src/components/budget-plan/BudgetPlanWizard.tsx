import { useState, useMemo, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BudgetSummaryPage } from './BudgetSummaryPage'
import { BudgetCategoryPage, type CategoryPageItem } from './BudgetCategoryPage'
import type { DraftBudgetPlan } from './types'

const CATEGORIES_PER_PAGE = 5

interface Props {
  initialDraft: DraftBudgetPlan
  /** Category codes+labels in canonical (sortOrder) order */
  categories: CategoryPageItem[]
  onSubmit: (final: DraftBudgetPlan) => Promise<void>
  submitting?: boolean
  /**
   * Optional slot rendered under the category editors on the *last* wizard
   * page — used to reintegrate advanced features (knapsack optimize, auto-
   * generate, override log) that live outside the pure editing flow.
   * Receives the current draft so it can render context-dependent UI.
   */
  renderAdvancedOnLastPage?: (draft: DraftBudgetPlan) => ReactNode
}

export function BudgetPlanWizard({
  initialDraft,
  categories,
  onSubmit,
  submitting,
  renderAdvancedOnLastPage,
}: Props) {
  const [draft, setDraft] = useState<DraftBudgetPlan>(initialDraft)
  const [pageIndex, setPageIndex] = useState(0)

  const categoryPages = useMemo<CategoryPageItem[][]>(() => {
    const pages: CategoryPageItem[][] = []
    for (let i = 0; i < categories.length; i += CATEGORIES_PER_PAGE) {
      pages.push(categories.slice(i, i + CATEGORIES_PER_PAGE))
    }
    return pages
  }, [categories])

  // Summary page + N category pages. When no categories exist at all we still
  // show at least the summary page.
  const totalPages = 1 + categoryPages.length
  const isLast = pageIndex === totalPages - 1
  const isFirst = pageIndex === 0

  const goNext = () => setPageIndex((i) => Math.min(i + 1, totalPages - 1))
  const goPrev = () => setPageIndex((i) => Math.max(i - 1, 0))
  const submit = async () => {
    await onSubmit(draft)
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium">{pageIndex + 1}</span>
        <span>/</span>
        <span>{totalPages}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((pageIndex + 1) / totalPages) * 100}%` }}
          />
        </div>
      </div>

      {/* Page content */}
      {pageIndex === 0 ? (
        <BudgetSummaryPage draft={draft} onChange={setDraft} />
      ) : (
        <BudgetCategoryPage
          draft={draft}
          items={categoryPages[pageIndex - 1] ?? []}
          onChange={setDraft}
        />
      )}

      {/* Advanced features live on the last page, below the editors */}
      {isLast && renderAdvancedOnLastPage?.(draft)}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={goPrev} disabled={isFirst}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          이전
        </Button>
        {isLast ? (
          <Button onClick={submit} disabled={submitting}>
            <Check className="h-4 w-4 mr-1" />
            {submitting ? '저장 중...' : '완료 및 저장'}
          </Button>
        ) : (
          <Button onClick={goNext}>
            다음
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
