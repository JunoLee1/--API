> ⚠️ **SUPERSEDED by [2026-08-29-budget-plan-ui-align-with-spec.md](2026-08-29-budget-plan-ui-align-with-spec.md)**
> 편성 워크플로우 spec (ADR 0011/0019/0020, 2026-08-29) 이 자동 티어 승격·트리거 기반 입력을 확정. 이 plan 의 "자유 티어 개수/이름/value 입력" 방향은 spec 과 정면 충돌. 신 spec 반영은 supersede 문서 참조.

# BudgetPlanPage — Dynamic Form + Wizard UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BudgetPlanPage`에서 하드코딩된 3티어(Basic/Standard/Premium) 입력창을 제거하고, 각 카테고리에 사용자가 원하는 만큼 옵션(tier)을 자유롭게 추가·삭제·이름 지정할 수 있게 만든다. 동시에 스크롤로 길게 나열된 카테고리를 wizard 형태(첫 페이지 예산 요약, 이후 카테고리 5개/page)로 재구성해 인지 부하를 낮춘다.

**Architecture:** 순수 프론트엔드 리팩. Prisma 스키마 변경 없음(기존 `BudgetTier`는 이미 자유 개수 지원). `upsertBudgetPlan` 백엔드 endpoint 재사용. Wizard state는 React `useState`로 관리(draft), 마지막 페이지 [완료] 버튼에서 한 번에 서버 저장.

**Tech Stack:** React + TypeScript, shadcn/ui (Button/Input/Card/Dialog), i18next. Zero new dependencies.

**Scope 제한:**
- Drag & Drop 정렬은 이 plan 밖 (별도: `2026-08-22-budget-plan-drag-drop-autosave.md`)
- Auto-save (편집 중 debounce)는 이 plan 밖. 마지막 [완료] 클릭 시만 저장.

---

## File Structure

**Modified:**
- `football/src/pages/admin/BudgetPlanPage.tsx` — 전면 재작성 (~500 lines)

**New (component 분리):**
- `football/src/components/budget-plan/BudgetPlanWizard.tsx` — 위저드 shell (page navigation, draft state)
- `football/src/components/budget-plan/BudgetSummaryPage.tsx` — 페이지 1 (totalBudget/contingency/playerSalaryBudget)
- `football/src/components/budget-plan/BudgetCategoryPage.tsx` — 페이지 2+ (카테고리 5개씩)
- `football/src/components/budget-plan/CategoryEditor.tsx` — 개별 카테고리 편집 (mandatoryMinimum + tier 목록 + [+옵션 추가])
- `football/src/components/budget-plan/TierRow.tsx` — 개별 tier 편집 (name/cost/value + 삭제 버튼)

**참고 (변경 없음):**
- `football/src/services/financial-report.service.ts` (`budgetPlanApi.upsert` 재사용)
- `football/src/types/budget.ts` (`ALL_OPERATING_CATEGORIES`, `OPERATING_CATEGORY_LABEL`)

---

## Task 1: Draft state 타입 및 helper 분리

**Files:**
- Create: `football/src/components/budget-plan/types.ts`

- [ ] **Step 1: draft 타입 정의**

```typescript
// football/src/components/budget-plan/types.ts
import type { OperatingCategory } from '@/types/budget'

export interface DraftTier {
  name: string
  cost: string    // form input이라 string 유지
  value: string
}

export interface DraftCategory {
  mandatoryMinimum: string
  tiers: DraftTier[]   // 빈 배열도 유효 (default 0개)
}

export interface DraftBudgetPlan {
  totalBudget: string
  contingency: string
  playerSalaryBudget: string
  categories: Record<OperatingCategory, DraftCategory>
}

export const emptyTier = (): DraftTier => ({ name: '', cost: '', value: '' })
export const emptyCategory = (): DraftCategory => ({ mandatoryMinimum: '', tiers: [] })
```

- [ ] **Step 2: 기존 서버 state → draft 변환 helper**

```typescript
// 같은 파일에 추가
import type { BudgetPlan, OperatingCategory as _ } from '@/types/budget'
import { ALL_OPERATING_CATEGORIES } from '@/types/budget'

export function serverToDraft(p: BudgetPlan | null): DraftBudgetPlan {
  const cats: Record<OperatingCategory, DraftCategory> = Object.fromEntries(
    ALL_OPERATING_CATEGORIES.map((c) => [c, emptyCategory()])
  ) as Record<OperatingCategory, DraftCategory>

  if (p) {
    for (const cp of p.budgetCategoryPlans) {
      cats[cp.category] = {
        mandatoryMinimum: cp.mandatoryMinimum.toString(),
        tiers: cp.tiers.map((t) => ({
          name: t.name,
          cost: t.cost.toString(),
          value: t.value.toString(),
        })),
      }
    }
  }

  return {
    totalBudget: p?.totalOperatingBudget?.toString() ?? '',
    contingency: p?.contingencyReserve?.toString() ?? '0',
    playerSalaryBudget: p?.playerSalaryBudget?.toString() ?? '',
    categories: cats,
  }
}
```

- [ ] **Step 3: draft → API payload 변환 helper**

```typescript
// 같은 파일에 추가
import type { UpsertBudgetPlanPayload } from '@/types/budget'

export function draftToPayload(d: DraftBudgetPlan): UpsertBudgetPlanPayload {
  return {
    totalOperatingBudget: parseInt(d.totalBudget, 10) || 0,
    contingencyReserve: parseInt(d.contingency, 10) || 0,
    playerSalaryBudget: d.playerSalaryBudget ? parseInt(d.playerSalaryBudget, 10) : undefined,
    categories: ALL_OPERATING_CATEGORIES.map((cat) => ({
      category: cat,
      mandatoryMinimum: parseInt(d.categories[cat].mandatoryMinimum, 10) || 0,
      tiers: d.categories[cat].tiers
        .filter((t) => t.name.trim() && t.cost && t.value)  // 빈 tier 제외
        .map((t) => ({
          name: t.name.trim(),
          cost: parseInt(t.cost, 10) || 0,
          value: parseInt(t.value, 10) || 0,
        })),
    })),
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add football/src/components/budget-plan/types.ts
git commit -m "feat(budget-plan): add draft state types and server↔draft helpers"
```

---

## Task 2: TierRow 컴포넌트 (개별 tier 편집)

**Files:**
- Create: `football/src/components/budget-plan/TierRow.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// football/src/components/budget-plan/TierRow.tsx
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { DraftTier } from './types'

interface Props {
  tier: DraftTier
  index: number
  onChange: (tier: DraftTier) => void
  onRemove: () => void
}

export function TierRow({ tier, index, onChange, onRemove }: Props) {
  return (
    <div className="grid grid-cols-[1fr_120px_100px_auto] gap-2 items-center">
      <Input
        placeholder={`옵션 이름 (예: 기본 방화벽 유지보수)`}
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
      <Button variant="ghost" size="icon" onClick={onRemove} aria-label="옵션 삭제">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add football/src/components/budget-plan/TierRow.tsx
git commit -m "feat(budget-plan): add TierRow component for editing individual tier"
```

---

## Task 3: CategoryEditor 컴포넌트

**Files:**
- Create: `football/src/components/budget-plan/CategoryEditor.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// football/src/components/budget-plan/CategoryEditor.tsx
import { Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { OPERATING_CATEGORY_LABEL, type OperatingCategory } from '@/types/budget'
import { TierRow } from './TierRow'
import { emptyTier, type DraftCategory, type DraftTier } from './types'

interface Props {
  category: OperatingCategory
  data: DraftCategory
  onChange: (next: DraftCategory) => void
}

export function CategoryEditor({ category, data, onChange }: Props) {
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{OPERATING_CATEGORY_LABEL[category]}</CardTitle>
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
```

- [ ] **Step 2: Commit**

```bash
git add football/src/components/budget-plan/CategoryEditor.tsx
git commit -m "feat(budget-plan): add CategoryEditor with dynamic tier list"
```

---

## Task 4: BudgetSummaryPage 컴포넌트 (Wizard 1페이지)

**Files:**
- Create: `football/src/components/budget-plan/BudgetSummaryPage.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// football/src/components/budget-plan/BudgetSummaryPage.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DraftBudgetPlan } from './types'

interface Props {
  draft: DraftBudgetPlan
  onChange: (next: DraftBudgetPlan) => void
}

export function BudgetSummaryPage({ draft, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>예산 요약</CardTitle>
        <p className="text-sm text-muted-foreground">
          시즌 전체 운영 예산과 예비비, 선수 급여 예산을 설정합니다
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>총 운영 예산 (원)</Label>
          <Input
            type="number"
            placeholder="1000000000"
            value={draft.totalBudget}
            onChange={(e) => onChange({ ...draft, totalBudget: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>예비비 (원)</Label>
          <Input
            type="number"
            placeholder="0"
            value={draft.contingency}
            onChange={(e) => onChange({ ...draft, contingency: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>선수 급여 예산 (원) — 선택</Label>
          <Input
            type="number"
            placeholder="선택 입력"
            value={draft.playerSalaryBudget}
            onChange={(e) => onChange({ ...draft, playerSalaryBudget: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add football/src/components/budget-plan/BudgetSummaryPage.tsx
git commit -m "feat(budget-plan): add BudgetSummaryPage (wizard page 1)"
```

---

## Task 5: BudgetCategoryPage 컴포넌트 (Wizard 2+페이지)

**Files:**
- Create: `football/src/components/budget-plan/BudgetCategoryPage.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// football/src/components/budget-plan/BudgetCategoryPage.tsx
import { CategoryEditor } from './CategoryEditor'
import type { OperatingCategory } from '@/types/budget'
import type { DraftBudgetPlan, DraftCategory } from './types'

interface Props {
  draft: DraftBudgetPlan
  categories: OperatingCategory[]   // 이 페이지에 표시할 카테고리 (최대 5개)
  onChange: (next: DraftBudgetPlan) => void
}

export function BudgetCategoryPage({ draft, categories, onChange }: Props) {
  const updateCategory = (cat: OperatingCategory, next: DraftCategory) => {
    onChange({
      ...draft,
      categories: { ...draft.categories, [cat]: next },
    })
  }

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <CategoryEditor
          key={cat}
          category={cat}
          data={draft.categories[cat]}
          onChange={(next) => updateCategory(cat, next)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add football/src/components/budget-plan/BudgetCategoryPage.tsx
git commit -m "feat(budget-plan): add BudgetCategoryPage (wizard page 2+)"
```

---

## Task 6: BudgetPlanWizard 컴포넌트 (shell)

**Files:**
- Create: `football/src/components/budget-plan/BudgetPlanWizard.tsx`

- [ ] **Step 1: Wizard shell 작성**

```tsx
// football/src/components/budget-plan/BudgetPlanWizard.tsx
import { useState, useMemo } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ALL_OPERATING_CATEGORIES, type OperatingCategory } from '@/types/budget'
import { BudgetSummaryPage } from './BudgetSummaryPage'
import { BudgetCategoryPage } from './BudgetCategoryPage'
import type { DraftBudgetPlan } from './types'

const CATEGORIES_PER_PAGE = 5

interface Props {
  initialDraft: DraftBudgetPlan
  onSubmit: (final: DraftBudgetPlan) => Promise<void>
  submitting?: boolean
}

export function BudgetPlanWizard({ initialDraft, onSubmit, submitting }: Props) {
  const [draft, setDraft] = useState<DraftBudgetPlan>(initialDraft)
  const [pageIndex, setPageIndex] = useState(0)

  const categoryPages = useMemo<OperatingCategory[][]>(() => {
    const pages: OperatingCategory[][] = []
    for (let i = 0; i < ALL_OPERATING_CATEGORIES.length; i += CATEGORIES_PER_PAGE) {
      pages.push(ALL_OPERATING_CATEGORIES.slice(i, i + CATEGORIES_PER_PAGE))
    }
    return pages
  }, [])

  const totalPages = 1 + categoryPages.length   // 요약 페이지 + 카테고리 페이지들
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
          categories={categoryPages[pageIndex - 1]}
          onChange={setDraft}
        />
      )}

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
```

- [ ] **Step 2: Commit**

```bash
git add football/src/components/budget-plan/BudgetPlanWizard.tsx
git commit -m "feat(budget-plan): add BudgetPlanWizard shell with page navigation"
```

---

## Task 7: BudgetPlanPage 재작성

**Files:**
- Modify: `football/src/pages/admin/BudgetPlanPage.tsx`

- [ ] **Step 1: 기존 파일 전면 재작성**

```tsx
// football/src/pages/admin/BudgetPlanPage.tsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { budgetPlanApi } from '@/services/financial-report.service'
import { seasonApi } from '@/services/season.service'
import type { BudgetPlan } from '@/types/budget'
import { BudgetPlanWizard } from '@/components/budget-plan/BudgetPlanWizard'
import { serverToDraft, draftToPayload, type DraftBudgetPlan } from '@/components/budget-plan/types'
import { Skeleton } from '@/components/ui/skeleton'

export function BudgetPlanPage() {
  const { t } = useTranslation('admin')
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [initialDraft, setInitialDraft] = useState<DraftBudgetPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const season = await seasonApi.active()
        if (!season) { setLoading(false); return }
        setSeasonId(season.id)
        const p: BudgetPlan | null = await budgetPlanApi.get(season.id).catch(() => null)
        setInitialDraft(serverToDraft(p))
      } catch {
        toast.error(t('budget.loadFailed'))
      } finally {
        setLoading(false)
      }
    })()
  }, [t])

  const handleSubmit = async (draft: DraftBudgetPlan) => {
    if (!seasonId) return
    setSaving(true)
    try {
      await budgetPlanApi.upsert(seasonId, draftToPayload(draft))
      toast.success(t('budget.saved'))
      // reload
      const p = await budgetPlanApi.get(seasonId)
      setInitialDraft(serverToDraft(p))
    } catch {
      toast.error(t('budget.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!seasonId || !initialDraft) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">활성 시즌이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">운영비 예산 계획</h1>
        <p className="text-sm text-muted-foreground mt-1">
          시즌 예산과 카테고리별 옵션을 단계별로 편집합니다
        </p>
      </div>
      <BudgetPlanWizard
        initialDraft={initialDraft}
        onSubmit={handleSubmit}
        submitting={saving}
      />
    </div>
  )
}
```

> **주의**: 기존 파일에 있던 `optimizing`, `autoGenDialog`, `overrideCategory` 등 기능(knapsack 최적화, 자동 생성, 예산 초과 override)은 이번 리팩에서 **제거되지 않고 별도로 처리**되어야 함. 이 plan의 Task 8에서 그 기능을 wizard에 통합할지 별도 페이지로 뺄지 결정.

- [ ] **Step 2: Commit**

```bash
git add football/src/pages/admin/BudgetPlanPage.tsx
git commit -m "refactor(budget-plan): rewrite BudgetPlanPage as wizard shell"
```

---

## Task 8: 기존 기능 재통합 (optimizing / autoGen / override)

**Context:** 기존 `BudgetPlanPage`는 다음 기능도 있었음:
- Knapsack 최적화 (`budgetPlanApi.optimize`)
- 자동 생성 (revenue % 기반)
- Override 요청 dialog

**Files:**
- Modify: `football/src/pages/admin/BudgetPlanPage.tsx`

- [ ] **Step 1: 재통합 방향 결정**

두 옵션:
- (a) Wizard 마지막 페이지 하단에 "고급 기능" 섹션으로 배치
- (b) 별도 페이지 `/admin/budget-plan/advanced`로 이동 (링크만 wizard에서 제공)

**추천 (a)** — 사용자가 wizard 완료 후 같은 화면에서 이어서 사용

- [ ] **Step 2: (a) 선택 시) 마지막 페이지 렌더 확장**

`BudgetPlanWizard.tsx`에서 `isLast && pageIndex > 0` 시 category page 아래에 "고급" 카드 추가 렌더. 기존 `optimizing/autoGen/override` UI 코드를 (`git log`에서 리커버) 이 카드에 배치.

- [ ] **Step 3: Commit**

```bash
git add football/src/pages/admin/BudgetPlanPage.tsx football/src/components/budget-plan/BudgetPlanWizard.tsx
git commit -m "feat(budget-plan): reintegrate optimize/auto-gen/override into wizard final page"
```

---

## Task 9: 타입 확인 + 시각 회귀 테스트

**Files:**
- (verification only)

- [ ] **Step 1: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep -i budget-plan | head -10
```

Expected: no output.

- [ ] **Step 2: dev server + 브라우저 확인**

```bash
# 이미 5173/5174에서 실행 중일 것. 재확인:
# 1. /finance/dashboard로 로그인
# 2. /admin/budget-plan 이동
# 3. Wizard 첫 페이지 예산 요약 입력
# 4. [다음] → 카테고리 페이지 (5개)
# 5. 각 카테고리에서 [+ 옵션 추가] × 2~3번
# 6. Name/Cost/Value 입력
# 7. [다음] → 나머지 카테고리 (6번째 = 카테고리 1개만)
# 8. [완료 및 저장]
# 9. 새로고침 후 데이터 유지 확인
```

- [ ] **Step 3: 삭제·이전 페이지·취소 흐름 확인**
- [+] 옵션 추가 후 [🗑] 삭제
- [이전] 페이지 이동 시 편집 데이터 유지
- 완료 후 재로드 시 tier 순서·이름 그대로

---

## Task 10: PR 생성

- [ ] **Step 1: 브랜치, push, PR**

```bash
git checkout -b feat/budget-plan-dynamic-wizard
# ... 모든 커밋 완료 후
git push -u origin feat/budget-plan-dynamic-wizard
gh pr create --title "feat(budget-plan): dynamic form + wizard UI" \
  --body "..." # (일반 template)
```

- [ ] **Step 2: 머지 후 다음 plan (D&D + Auto-save) 진행**

`docs/superpowers/plans/2026-08-22-budget-plan-drag-drop-autosave.md` 참조

---

## Self-Review

**Spec coverage:**
- ✅ Dynamic form: [+옵션 추가] 버튼, Name 필드, 삭제 버튼, default 0 tier
- ✅ Wizard: 첫 페이지 예산 요약, 이후 카테고리 5개/page
- ✅ 저장: 마지막 페이지 [완료]에서 upsertBudgetPlan 호출
- ✅ Draft state: React useState로 wizard 안에 유지 (페이지 이동 편집 지속)
- ✅ 스키마 무관: 기존 BudgetTier 자유 개수 스키마 재사용
- ⏸ D&D 정렬 → PR-2 (별도 plan)
- ⏸ Auto-save (편집 중) → PR-2 (별도 plan). 이 plan은 [완료] 클릭 시만 저장

**Non-goals:**
- Prisma 스키마 변경 없음
- 백엔드 upsertBudgetPlan 시그니처 변경 없음
- 국제화 문자열 추가 최소 (기존 t() 키 재사용)

**Follow-ups (별도 이슈):**
- 옵션 개수 제한 (예: 카테고리당 최대 20개?)
- Undo/redo
- Wizard 편집 중 서버 저장이 아닌 localStorage 백업
