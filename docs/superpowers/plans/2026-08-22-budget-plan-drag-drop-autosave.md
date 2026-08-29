> ⚠️ **SUPERSEDED by [2026-08-29-budget-plan-ui-align-with-spec.md](2026-08-29-budget-plan-ui-align-with-spec.md)**
> 편성 워크플로우 spec 배포 이후 티어가 고정 3단계 (Basic/Standard/Premium) 로 확정되어 티어 D&D 정렬 목표 무의미. 카테고리 D&D 유지 여부는 supersede 문서 참조. Auto-save 는 신 plan 에도 유지 (draft 자동 저장 통합).

# BudgetPlanPage — D&D 정렬 + Auto-save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BudgetPlanPage 위저드에 (1) 카테고리 블록과 세부 옵션을 마우스로 드래그해서 재정렬하는 기능, (2) 페이지 이동 시 자동 저장 기능을 추가한다.

**Precondition:** PR-1 (`2026-08-22-budget-plan-dynamic-form-wizard.md`)이 완료되어 머지된 상태.

**Architecture:**
- Prisma: `BudgetCategoryPlan.sortOrder`, `BudgetTier.sortOrder` 각각 `Int @default(0)` 추가. 마이그레이션에서 기존 6 카테고리에 enum 순서대로 0~5 배정.
- Frontend: `dnd-kit` 라이브러리 도입. `CategoryEditor`에 카테고리 핸들, `TierRow`에 옵션 핸들 추가.
- Auto-save: wizard `goNext`/`goPrev` 트리거 시점에 `upsertBudgetPlan` 호출 (debounce 없음, bulk save).

**Tech Stack:** Prisma migration, `@dnd-kit/core` + `@dnd-kit/sortable`, React state.

---

## File Structure

**Modified (backend):**
- `apps/api/prisma/schema.prisma` — `sortOrder` 필드 추가
- `apps/api/src/financial-report/financial-report.repo.ts` — `upsertBudgetPlan`이 `sortOrder` 저장, `getBudgetPlan`이 `orderBy: sortOrder` 반환
- `apps/api/src/financial-report/dto/*` (또는 repo 내부 DTO) — payload에 `sortOrder` 필드

**New (backend):**
- `apps/api/prisma/migrations/2026NNNN_add_budget_sort_order/migration.sql`

**Modified (frontend):**
- `football/src/components/budget-plan/BudgetPlanWizard.tsx` — page navigation 시 auto-save 호출
- `football/src/components/budget-plan/CategoryEditor.tsx` — 카테고리에 D&D 핸들, tiers를 SortableContext로 래핑
- `football/src/components/budget-plan/TierRow.tsx` — D&D 핸들 추가 (`useSortable` hook)
- `football/src/components/budget-plan/BudgetCategoryPage.tsx` — 카테고리 리스트를 SortableContext로 래핑
- `football/src/components/budget-plan/types.ts` — draft에 sortOrder 반영

**Dependencies (new):**
```bash
cd football && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/2026NNNN_add_budget_sort_order/migration.sql`

- [ ] **Step 1: schema.prisma 수정**

`BudgetCategoryPlan`에 sortOrder 추가:
```prisma
model BudgetCategoryPlan {
  id                Int               @id @default(autoincrement())
  financialReportId Int
  category          OperatingCategory
  mandatoryMinimum  Int               @default(0)
  knapsackAllocated Int?
  sortOrder         Int               @default(0)   // ← new
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  // ... (unchanged relations)
}
```

`BudgetTier`에도 sortOrder 추가:
```prisma
model BudgetTier {
  id             Int                @id @default(autoincrement())
  categoryPlanId Int
  name           String
  cost           Int
  value          Int
  isSelected     Boolean            @default(false)
  sortOrder      Int                @default(0)     // ← new
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  categoryPlan   BudgetCategoryPlan @relation(fields: [categoryPlanId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: 마이그레이션 SQL 작성**

```sql
-- apps/api/prisma/migrations/2026NNNN_add_budget_sort_order/migration.sql
ALTER TABLE "BudgetCategoryPlan" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BudgetTier"         ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill: 기존 BudgetCategoryPlan에 enum 순서(MEDICAL/MEAL/TRAVEL/EQUIPMENT/SCOUTING/YOUTH)로 sortOrder 부여
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 0 WHERE "category" = 'MEDICAL';
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 1 WHERE "category" = 'MEAL';
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 2 WHERE "category" = 'TRAVEL';
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 3 WHERE "category" = 'EQUIPMENT';   -- PR D 후 SPORTS_EQUIPMENT
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 4 WHERE "category" = 'SCOUTING';
UPDATE "BudgetCategoryPlan" SET "sortOrder" = 5 WHERE "category" = 'YOUTH';

-- Backfill: 기존 BudgetTier는 id 순서대로 sortOrder 부여 (categoryPlanId 그룹 내)
UPDATE "BudgetTier" t
SET "sortOrder" = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "categoryPlanId" ORDER BY id) AS rn
  FROM "BudgetTier"
) sub
WHERE t.id = sub.id;
```

- [ ] **Step 3: DB 적용 + Prisma resolve + generate**

```bash
cd apps/api
psql football -f prisma/migrations/2026NNNN_add_budget_sort_order/migration.sql
npx prisma migrate resolve --applied 2026NNNN_add_budget_sort_order
npx prisma generate
```

> **주의**: main 브랜치와 DB desync 상황이 있을 수 있음. 앞선 세션의 `finance-dashboard-migrations` PR 스타일로 raw SQL 우회 + resolve 조합 사용.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(budget-plan): add sortOrder columns to BudgetCategoryPlan/BudgetTier"
```

---

## Task 2: Repository — sortOrder 저장/로드

**Files:**
- Modify: `apps/api/src/financial-report/financial-report.repo.ts`

- [ ] **Step 1: `UpsertBudgetPlanDto`에 sortOrder 필드 추가**

파일 상단 DTO 인터페이스:
```typescript
export interface UpsertBudgetPlanDto {
  totalOperatingBudget: number
  contingencyReserve: number
  playerSalaryBudget?: number
  categories: {
    category: OperatingCategory
    mandatoryMinimum: number
    sortOrder: number                      // ← new
    tiers: { name: string; cost: number; value: number; sortOrder: number }[]  // ← new
  }[]
}
```

- [ ] **Step 2: `upsertBudgetPlan`에서 sortOrder 저장**

카테고리 upsert 시:
```typescript
const plan = await this.prisma.budgetCategoryPlan.upsert({
  where: { financialReportId_category: { financialReportId: report.id, category: cat.category } },
  create: { financialReportId: report.id, category: cat.category, mandatoryMinimum: cat.mandatoryMinimum, sortOrder: cat.sortOrder },
  update: { mandatoryMinimum: cat.mandatoryMinimum, sortOrder: cat.sortOrder },
  select: { id: true },
})
```

Tier createMany 시:
```typescript
await this.prisma.budgetTier.createMany({
  data: cat.tiers.map((t) => ({
    categoryPlanId: plan.id,
    name: t.name,
    cost: t.cost,
    value: t.value,
    sortOrder: t.sortOrder,       // ← new
  })),
})
```

- [ ] **Step 3: `getBudgetPlan`에서 sortOrder 순으로 반환**

```typescript
async getBudgetPlan(seasonId: number) {
  return this.prisma.financialReport.findFirst({
    where: { seasonId },
    include: {
      budgetCategoryPlans: {
        orderBy: { sortOrder: 'asc' },      // ← new
        include: {
          tiers: {
            orderBy: { sortOrder: 'asc' },  // ← new
          },
        },
      },
    },
  })
}
```

- [ ] **Step 4: TypeScript + 회귀 테스트**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep financial-report | head -5
npx jest src/financial-report --no-coverage 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/financial-report
git commit -m "feat(budget-plan): persist and return sortOrder in upsertBudgetPlan/getBudgetPlan"
```

---

## Task 3: Frontend — dnd-kit 설치 + draft에 sortOrder 반영

**Files:**
- Modify: `football/package.json`
- Modify: `football/src/components/budget-plan/types.ts`

- [ ] **Step 1: 의존성 설치**

```bash
cd football && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: draft 타입에 sortOrder 반영**

```typescript
// football/src/components/budget-plan/types.ts

export interface DraftTier {
  name: string
  cost: string
  value: string
  // sortOrder는 배열 순서로 표현. 별도 필드 없이 map index를 sortOrder로 삼음.
}

export interface DraftCategoryOrdered {
  category: OperatingCategory
  data: DraftCategory
}

export interface DraftBudgetPlan {
  totalBudget: string
  contingency: string
  playerSalaryBudget: string
  categories: DraftCategoryOrdered[]      // ← Record 대신 순서 있는 배열
}
```

> **주요 변경**: `categories`가 `Record<OperatingCategory, DraftCategory>` → `DraftCategoryOrdered[]` (배열). 배열 순서가 곧 sortOrder. `CategoryEditor`/`BudgetCategoryPage`/`BudgetPlanWizard` 시그니처 조정 필요.

- [ ] **Step 3: `serverToDraft`/`draftToPayload` 업데이트**

```typescript
export function serverToDraft(p: BudgetPlan | null): DraftBudgetPlan {
  const catsFromServer = (p?.budgetCategoryPlans ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map<DraftCategoryOrdered>((cp) => ({
      category: cp.category,
      data: {
        mandatoryMinimum: cp.mandatoryMinimum.toString(),
        tiers: cp.tiers
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((t) => ({ name: t.name, cost: t.cost.toString(), value: t.value.toString() })),
      },
    }))

  // 서버에 없는 카테고리는 뒤에 빈 상태로 추가
  const seenCats = new Set(catsFromServer.map((c) => c.category))
  const missing = ALL_OPERATING_CATEGORIES.filter((c) => !seenCats.has(c))
    .map<DraftCategoryOrdered>((c) => ({ category: c, data: emptyCategory() }))

  return {
    totalBudget: p?.totalOperatingBudget?.toString() ?? '',
    contingency: p?.contingencyReserve?.toString() ?? '0',
    playerSalaryBudget: p?.playerSalaryBudget?.toString() ?? '',
    categories: [...catsFromServer, ...missing],
  }
}

export function draftToPayload(d: DraftBudgetPlan): UpsertBudgetPlanPayload {
  return {
    totalOperatingBudget: parseInt(d.totalBudget, 10) || 0,
    contingencyReserve: parseInt(d.contingency, 10) || 0,
    playerSalaryBudget: d.playerSalaryBudget ? parseInt(d.playerSalaryBudget, 10) : undefined,
    categories: d.categories.map((c, catIdx) => ({
      category: c.category,
      mandatoryMinimum: parseInt(c.data.mandatoryMinimum, 10) || 0,
      sortOrder: catIdx,
      tiers: c.data.tiers
        .filter((t) => t.name.trim() && t.cost && t.value)
        .map((t, tierIdx) => ({
          name: t.name.trim(),
          cost: parseInt(t.cost, 10) || 0,
          value: parseInt(t.value, 10) || 0,
          sortOrder: tierIdx,
        })),
    })),
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add football/package.json football/pnpm-lock.yaml football/src/components/budget-plan/types.ts
git commit -m "feat(budget-plan): install dnd-kit and reshape draft categories as ordered array"
```

---

## Task 4: TierRow — D&D 핸들 추가

**Files:**
- Modify: `football/src/components/budget-plan/TierRow.tsx`

- [ ] **Step 1: `useSortable` hook 도입**

```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import type { DraftTier } from './types'

interface Props {
  id: string                // dnd-kit id (e.g., `${category}-tier-${index}`)
  tier: DraftTier
  index: number
  onChange: (tier: DraftTier) => void
  onRemove: () => void
}

export function TierRow({ id, tier, index, onChange, onRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-[24px_1fr_120px_100px_auto] gap-2 items-center">
      <button
        {...attributes}
        {...listeners}
        aria-label="옵션 드래그"
        className="cursor-grab active:cursor-grabbing text-muted-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input placeholder="옵션 이름" value={tier.name} onChange={(e) => onChange({ ...tier, name: e.target.value })} />
      <Input type="number" placeholder="비용" value={tier.cost} onChange={(e) => onChange({ ...tier, cost: e.target.value })} />
      <Input type="number" placeholder="가치" value={tier.value} onChange={(e) => onChange({ ...tier, value: e.target.value })} />
      <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add football/src/components/budget-plan/TierRow.tsx
git commit -m "feat(budget-plan): add drag handle to TierRow"
```

---

## Task 5: CategoryEditor — tier D&D 컨텍스트

**Files:**
- Modify: `football/src/components/budget-plan/CategoryEditor.tsx`

- [ ] **Step 1: SortableContext + DndContext + arrayMove**

```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus } from 'lucide-react'
// ... 기존 imports

interface Props {
  id: string                // dnd-kit id (`category-${OperatingCategory}`)
  category: OperatingCategory
  data: DraftCategory
  onChange: (next: DraftCategory) => void
}

export function CategoryEditor({ id, category, data, onChange }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const tierIds = data.tiers.map((_, i) => `${category}-tier-${i}`)

  const handleTierDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = tierIds.indexOf(String(active.id))
    const newIdx = tierIds.indexOf(String(over.id))
    if (oldIdx < 0 || newIdx < 0) return
    onChange({ ...data, tiers: arrayMove(data.tiers, oldIdx, newIdx) })
  }

  // ... updateTier, removeTier, addTier 기존과 동일

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <button {...attributes} {...listeners} aria-label="카테고리 드래그"
                  className="cursor-grab active:cursor-grabbing text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </button>
          <CardTitle className="text-base flex-1">{OPERATING_CATEGORY_LABEL[category]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* mandatoryMinimum input — 기존 그대로 */}
          <div className="space-y-2">
            {/* Tier list with SortableContext */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTierDragEnd}>
              <SortableContext items={tierIds} strategy={verticalListSortingStrategy}>
                {data.tiers.map((t, i) => (
                  <TierRow
                    key={tierIds[i]}
                    id={tierIds[i]}
                    tier={t}
                    index={i}
                    onChange={(next) => updateTier(i, next)}
                    onRemove={() => removeTier(i)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <Button variant="outline" size="sm" onClick={addTier} className="w-full">
              <Plus className="h-4 w-4 mr-1" />옵션 추가
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add football/src/components/budget-plan/CategoryEditor.tsx
git commit -m "feat(budget-plan): add drag handle to CategoryEditor and sortable tier list"
```

---

## Task 6: BudgetCategoryPage — 카테고리 D&D 컨텍스트

**Files:**
- Modify: `football/src/components/budget-plan/BudgetCategoryPage.tsx`

- [ ] **Step 1: 카테고리 리스트를 SortableContext로 래핑**

```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CategoryEditor } from './CategoryEditor'
import type { OperatingCategory } from '@/types/budget'
import type { DraftBudgetPlan, DraftCategoryOrdered } from './types'

interface Props {
  draft: DraftBudgetPlan
  pageCategoryIds: string[]   // e.g. ["category-MEDICAL", "category-MEAL", ...]
  onChange: (next: DraftBudgetPlan) => void
}

export function BudgetCategoryPage({ draft, pageCategoryIds, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleCategoryDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const allCatIds = draft.categories.map((c) => `category-${c.category}`)
    const oldIdx = allCatIds.indexOf(String(active.id))
    const newIdx = allCatIds.indexOf(String(over.id))
    if (oldIdx < 0 || newIdx < 0) return
    onChange({ ...draft, categories: arrayMove(draft.categories, oldIdx, newIdx) })
  }

  const updateCategory = (cat: OperatingCategory, nextData: DraftCategoryOrdered['data']) => {
    onChange({
      ...draft,
      categories: draft.categories.map((c) => (c.category === cat ? { ...c, data: nextData } : c)),
    })
  }

  const items = draft.categories.filter((c) => pageCategoryIds.includes(`category-${c.category}`))

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
      <SortableContext items={pageCategoryIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {items.map((c) => (
            <CategoryEditor
              key={c.category}
              id={`category-${c.category}`}
              category={c.category}
              data={c.data}
              onChange={(next) => updateCategory(c.category, next)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
```

> **주의**: 카테고리 D&D는 **페이지 안 카테고리끼리만** 재정렬 (페이지 간 이동 없음). 5개/page 유지 위해서.

- [ ] **Step 2: Commit**

```bash
git add football/src/components/budget-plan/BudgetCategoryPage.tsx
git commit -m "feat(budget-plan): make categories sortable within a wizard page"
```

---

## Task 7: BudgetPlanWizard — auto-save on page navigation

**Files:**
- Modify: `football/src/components/budget-plan/BudgetPlanWizard.tsx`

- [ ] **Step 1: onSave prop 도입 + goNext/goPrev에서 호출**

```tsx
interface Props {
  initialDraft: DraftBudgetPlan
  onSubmit: (final: DraftBudgetPlan) => Promise<void>        // 최종 저장 (마지막 [완료])
  onAutoSave?: (draft: DraftBudgetPlan) => Promise<void>     // ← new: 페이지 이동 시
  submitting?: boolean
}

export function BudgetPlanWizard({ initialDraft, onSubmit, onAutoSave, submitting }: Props) {
  const [draft, setDraft] = useState<DraftBudgetPlan>(initialDraft)
  const [pageIndex, setPageIndex] = useState(0)
  const [autoSaving, setAutoSaving] = useState(false)

  // ... categoryPages, totalPages, isLast, isFirst

  const withAutoSave = async (fn: () => void) => {
    if (onAutoSave) {
      setAutoSaving(true)
      try { await onAutoSave(draft) } catch { /* silent — wizard flow 지속 */ }
      finally { setAutoSaving(false) }
    }
    fn()
  }

  const goNext = () => withAutoSave(() => setPageIndex((i) => Math.min(i + 1, totalPages - 1)))
  const goPrev = () => withAutoSave(() => setPageIndex((i) => Math.max(i - 1, 0)))

  // Category page 계산 시 pageCategoryIds 전달
  const currentPageCategoryIds =
    pageIndex === 0
      ? []
      : categoryPages[pageIndex - 1].map((c) => `category-${c}`)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium">{pageIndex + 1}</span> <span>/</span> <span>{totalPages}</span>
        {autoSaving && <span className="text-xs text-primary animate-pulse">저장 중...</span>}
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all"
               style={{ width: `${((pageIndex + 1) / totalPages) * 100}%` }} />
        </div>
      </div>

      {pageIndex === 0
        ? <BudgetSummaryPage draft={draft} onChange={setDraft} />
        : <BudgetCategoryPage draft={draft} pageCategoryIds={currentPageCategoryIds} onChange={setDraft} />}

      {/* Navigation — 기존과 동일, autoSaving일 때 disabled */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={goPrev} disabled={isFirst || autoSaving}>이전</Button>
        {isLast
          ? <Button onClick={() => onSubmit(draft)} disabled={submitting || autoSaving}>완료 및 저장</Button>
          : <Button onClick={goNext} disabled={autoSaving}>다음</Button>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: BudgetPlanPage에서 onAutoSave 전달**

```tsx
// football/src/pages/admin/BudgetPlanPage.tsx
const handleAutoSave = async (draft: DraftBudgetPlan) => {
  if (!seasonId) return
  await budgetPlanApi.upsert(seasonId, draftToPayload(draft))
  // 성공/실패 toast는 wizard가 silent 처리 (최종 저장에만 toast)
}

// ...
<BudgetPlanWizard
  initialDraft={initialDraft}
  onSubmit={handleSubmit}
  onAutoSave={handleAutoSave}
  submitting={saving}
/>
```

- [ ] **Step 3: Commit**

```bash
git add football/src/components/budget-plan/BudgetPlanWizard.tsx football/src/pages/admin/BudgetPlanPage.tsx
git commit -m "feat(budget-plan): auto-save on wizard page navigation"
```

---

## Task 8: TypeScript + 브라우저 확인

- [ ] **Step 1: TypeScript**

```bash
cd football && npx tsc --noEmit 2>&1 | grep -i budget-plan | head -10
cd apps/api && npx tsc --noEmit 2>&1 | grep -E "financial-report|budget" | head -5
```

- [ ] **Step 2: 백엔드 회귀 테스트**

```bash
cd apps/api && npx jest src/financial-report --no-coverage 2>&1 | tail -10
```

- [ ] **Step 3: 브라우저 시나리오**

- [ ] Wizard 페이지 1에서 예산 요약 입력 → [다음] 클릭 시 "저장 중..." 스피너 → 페이지 2로 이동
- [ ] 페이지 2에서 카테고리 3개 순서 D&D로 재정렬 → [다음] → 저장 → 페이지 3
- [ ] 각 카테고리에서 옵션 2~3개 추가, 옵션 순서 D&D 재정렬 → [이전] → 저장 → 페이지 2로 돌아옴, 순서 유지
- [ ] [완료 및 저장] → 새로고침 → 카테고리·옵션 순서·값 모두 유지 확인
- [ ] 페이지 이동 중 auto-save 실패 시 wizard 흐름은 계속 진행 (silent)되는지 확인

---

## Task 9: PR 생성 + 머지

- [ ] **Step 1: 브랜치, push, PR**

```bash
git checkout -b feat/budget-plan-drag-drop-autosave
# ... 모든 커밋 완료 후
git push -u origin feat/budget-plan-drag-drop-autosave
gh pr create --title "feat(budget-plan): drag-and-drop reordering + auto-save on page navigation" \
  --body "..."
```

---

## Self-Review

**Spec coverage:**
- ✅ 카테고리 블록 D&D 정렬 (페이지 내)
- ✅ 옵션 D&D 정렬 (카테고리 내)
- ✅ 좌측 손잡이(≡) 아이콘
- ✅ Auto-save: wizard 페이지 이동 시 (`goNext`/`goPrev`) bulk save. Debounce 없음
- ✅ Prisma `sortOrder` 필드 추가 + 기존 데이터 backfill
- ✅ `upsertBudgetPlan`이 sortOrder 저장, `getBudgetPlan`이 정렬 반환

**Non-goals:**
- 페이지 간 카테고리 이동 (5개/page 유지) → 다른 페이지로 옮기고 싶으면 Wizard 재설계 필요, 이번 스코프 밖
- Debounce auto-save (편집 중 실시간) — 서버 상태 흐름 복잡, 이번 스코프 밖
- 낙관적 잠금 / 충돌 감지 — 단일 사용자 편집 가정, 다중 사용자 편집 시 last-write-wins

**Follow-ups (별도 이슈):**
- 카테고리 페이지 간 이동 (5개/page 벗어나기)
- 모바일 터치 D&D (`TouchSensor` 추가)
- Auto-save 실패 시 사용자 피드백 (silent이 아니라 페이지 하단 toast?)
- Undo/redo (sortOrder 변경 포함)
