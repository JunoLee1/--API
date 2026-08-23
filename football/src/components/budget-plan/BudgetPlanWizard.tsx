import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BudgetSummaryPage } from './BudgetSummaryPage'
import { BudgetCategoryPage, type CategoryPageItem } from './BudgetCategoryPage'
import type { DraftBudgetPlan } from './types'
import { AvailableBudgetCard } from '@/components/finance/AvailableBudgetCard'
import { seasonApi } from '@/services/season.service'
import type { WageCapKPI } from '@/types/season'

const CATEGORIES_PER_PAGE = 5

interface Props {
  initialDraft: DraftBudgetPlan
  /** Category codes+labels in canonical (sortOrder) order. Used only for the
   * label lookup — the wizard's page slicing follows the draft's own order so
   * drag-and-drop reordering is preserved across page navigations. */
  categories: CategoryPageItem[]
  onSubmit: (final: DraftBudgetPlan) => Promise<void>
  /** Optional silent auto-save invoked whenever the user navigates between
   * wizard pages. Failures are swallowed so the flow keeps moving. */
  onAutoSave?: (draft: DraftBudgetPlan) => Promise<void>
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
  onAutoSave,
  submitting,
  renderAdvancedOnLastPage,
}: Props) {
  const [draft, setDraft] = useState<DraftBudgetPlan>(initialDraft)
  const [pageIndex, setPageIndex] = useState(0)
  const [autoSaving, setAutoSaving] = useState(false)
  // Read-only 참고 카드용 KPI — 편성 상한이 아닌 정보 표시 목적.
  const [wageCapKpi, setWageCapKpi] = useState<WageCapKPI | null>(null)

  useEffect(() => {
    seasonApi.getWageCapKPI().then(setWageCapKpi).catch(() => setWageCapKpi(null))
  }, [])

  // Fast lookup for canonical labels; the draft only carries codes.
  const labelByCode = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.code, c.label)
    return m
  }, [categories])

  // Slice pages from the draft's own order so drag-and-drop reordering is
  // visible after the user navigates away and back.
  const categoryPages = useMemo<CategoryPageItem[][]>(() => {
    const all: CategoryPageItem[] = draft.categories.map((c) => ({
      code: c.code,
      label: labelByCode.get(c.code) ?? c.code,
    }))
    const pages: CategoryPageItem[][] = []
    for (let i = 0; i < all.length; i += CATEGORIES_PER_PAGE) {
      pages.push(all.slice(i, i + CATEGORIES_PER_PAGE))
    }
    return pages
  }, [draft.categories, labelByCode])

  // Summary page + N category pages. When no categories exist at all we still
  // show at least the summary page.
  const totalPages = 1 + categoryPages.length
  const isLast = pageIndex === totalPages - 1
  const isFirst = pageIndex === 0

  const withAutoSave = async (advance: () => void) => {
    if (onAutoSave) {
      setAutoSaving(true)
      try {
        await onAutoSave(draft)
      } catch {
        // Silent — auto-save failure must not block wizard navigation.
      } finally {
        setAutoSaving(false)
      }
    }
    advance()
  }

  const goNext = () =>
    withAutoSave(() => setPageIndex((i) => Math.min(i + 1, totalPages - 1)))
  const goPrev = () =>
    withAutoSave(() => setPageIndex((i) => Math.max(i - 1, 0)))
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
        {autoSaving && (
          <span className="text-xs text-primary animate-pulse" role="status">
            저장 중...
          </span>
        )}
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

      {/* Read-only 가용 예산 참고 카드 — 편성 상한이 아닌 정보 표시 목적. */}
      {isLast && wageCapKpi && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground px-1">
            참고: 이 값은 편성 상한이 아니며 정보 표시입니다
          </div>
          <AvailableBudgetCard kpi={wageCapKpi} />
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={isFirst || autoSaving}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          이전
        </Button>
        {isLast ? (
          <Button onClick={submit} disabled={submitting || autoSaving}>
            <Check className="h-4 w-4 mr-1" />
            {submitting ? '저장 중...' : '완료 및 저장'}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={autoSaving}>
            다음
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
