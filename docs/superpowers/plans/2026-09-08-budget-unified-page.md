# 예산 통합 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "운영비 예산"·"예산 관리" 두 개의 분리된 사이드바 항목을 `/budget?tab=` URL 기반 탭 페이지로 통합해 UX 혼동을 해소한다.

**Architecture:** 신규 `BudgetPage.tsx` 컨테이너가 `useSearchParams`로 탭을 구동하고, 기존 세 페이지(BudgetPlanPage / BudgetListPage / BudgetAutoPage)를 내부 로직 변경 없이 렌더한다. 기존 경로는 `<Navigate>`로 리다이렉트.

**Tech Stack:** React 18 + React Router v6 + sonner + useCurrentUser hook

---

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `football/src/pages/budget/BudgetPage.tsx` | 신규 — 탭 컨테이너 |
| `football/src/App.tsx` | `/budget`, `/budget/:id` 추가, 기존 4개 경로 `<Navigate>` 교체 |
| `football/src/layouts/AppShell.tsx` | budgetPlan·budgetControl 항목 제거, budget 항목 추가 |
| `football/src/locales/ko/common.json` | `nav.item.budget` 추가, `budgetPlan`·`budgetControl` 삭제 |
| `football/src/locales/en/common.json` | 동일 |
| `football/src/components/budget-plan/BudgetPlanWizard.tsx` | 제출 완료 후 toast action + 읽기전용 카드 링크 버튼 추가 |

---

## Task 1: BudgetPage 탭 컨테이너

**Files:**
- Create: `football/src/pages/budget/BudgetPage.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// football/src/pages/budget/BudgetPage.tsx
import { Navigate, useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { BudgetPlanPage } from '@/pages/admin/BudgetPlanPage'
import BudgetListPage from '@/pages/finance/BudgetListPage'
import BudgetAutoPage from '@/pages/finance/BudgetAutoPage'

type Tab = 'plan' | 'execution' | 'auto'

const TABS: { id: Tab; label: string; adminOnly: boolean }[] = [
  { id: 'plan',      label: '편성 계획',   adminOnly: true  },
  { id: 'execution', label: '예산안 실행', adminOnly: false },
  { id: 'auto',      label: '자동 산출',   adminOnly: false },
]

export default function BudgetPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useCurrentUser()

  const canSeePlan = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'
  const defaultTab: Tab = canSeePlan ? 'plan' : 'execution'
  const rawTab = searchParams.get('tab') as Tab | null

  // 권한 없는 탭 접근 시 기본 탭으로 리다이렉트
  if (rawTab === 'plan' && !canSeePlan) {
    return <Navigate to={`/budget?tab=${defaultTab}`} replace />
  }

  const tab: Tab = rawTab ?? defaultTab
  const visibleTabs = TABS.filter(t => !t.adminOnly || canSeePlan)

  return (
    <div className="flex flex-col h-full">
      {/* 탭 헤더 */}
      <div className="border-b px-6 flex gap-0">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSearchParams({ tab: t.id })}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'plan'      && canSeePlan && <BudgetPlanPage />}
      {tab === 'execution' && <BudgetListPage />}
      {tab === 'auto'      && <BudgetAutoPage />}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "BudgetPage" | head -20
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
cd /Users/juno/work/football && git add football/src/pages/budget/BudgetPage.tsx
git commit -m "feat(fe): 예산 통합 탭 컨테이너 BudgetPage 추가"
```

---

## Task 2: App.tsx 라우팅 변경

**Files:**
- Modify: `football/src/App.tsx`

- [ ] **Step 1: import 추가 + 기존 import 정리**

파일 상단 import 구역에서:

```typescript
// 추가
import BudgetPage from '@/pages/budget/BudgetPage'
```

기존 `import { BudgetPlanPage }`, `import BudgetListPage`, `import BudgetDetailPage`, `import BudgetAutoPage` 는 **그대로 유지** (리다이렉트 route에서 더이상 사용 안 하지만 BudgetPage 내부에서 임포트됨 — App.tsx의 직접 import는 제거해도 무방하나, 기존 패턴 유지를 위해 두는 게 안전. 단, lint 에러 발생 시 제거할 것).

실제로 App.tsx에서 직접 렌더하지 않으므로 아래 4개 import를 제거:
```typescript
// 삭제
import { BudgetPlanPage } from '@/pages/admin/BudgetPlanPage'
import BudgetListPage from '@/pages/finance/BudgetListPage'
import BudgetDetailPage from '@/pages/finance/BudgetDetailPage'
import BudgetAutoPage from '@/pages/finance/BudgetAutoPage'
```

그리고 `BudgetDetailPage`는 `/budget/:id`에서 직접 사용하므로 다시 import:
```typescript
import BudgetDetailPage from '@/pages/finance/BudgetDetailPage'
```

결국 App.tsx에 남길 import:
```typescript
import BudgetPage from '@/pages/budget/BudgetPage'
import BudgetDetailPage from '@/pages/finance/BudgetDetailPage'
```

- [ ] **Step 2: 라우트 교체**

아래 4개 기존 라우트를:
```tsx
<Route path="/admin/budget-plan" element={<BudgetPlanPage />} />
// ...
<Route path="/finance/budget" element={<BudgetListPage />} />
<Route path="/finance/budget/auto" element={<BudgetAutoPage />} />
<Route path="/finance/budget/:id" element={<BudgetDetailPage />} />
```

다음으로 교체 (신규 라우트 2개 + 리다이렉트 4개):
```tsx
{/* 예산 통합 페이지 */}
<Route path="/budget" element={<BudgetPage />} />
<Route path="/budget/:id" element={<BudgetDetailPage />} />

{/* 기존 경로 리다이렉트 */}
<Route path="/admin/budget-plan" element={<Navigate to="/budget?tab=plan" replace />} />
<Route path="/finance/budget" element={<Navigate to="/budget?tab=execution" replace />} />
<Route path="/finance/budget/auto" element={<Navigate to="/budget?tab=auto" replace />} />
<Route path="/finance/budget/:id" element={<NavigateToBudgetDetail />} />
```

마지막 `/finance/budget/:id` 리다이렉트를 위해 동적 id를 넘기는 헬퍼 컴포넌트 추가:
```tsx
function NavigateToBudgetDetail() {
  const { id } = useParams()
  return <Navigate to={`/budget/${id}`} replace />
}
```

이 함수를 App.tsx 내 (혹은 파일 상단) 에 추가하고 `useParams`를 import에 추가 (이미 있을 가능성 높음):
```typescript
import { ..., useParams } from 'react-router-dom'
```

- [ ] **Step 3: TypeScript 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -30
```

Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
cd /Users/juno/work/football && git add football/src/App.tsx
git commit -m "feat(fe): /budget 통합 라우트 추가, 기존 예산 경로 리다이렉트"
```

---

## Task 3: AppShell 네비 + i18n 변경

**Files:**
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/locales/ko/common.json`
- Modify: `football/src/locales/en/common.json`

### AppShell.tsx

- [ ] **Step 1: 기존 두 nav 항목 제거 후 단일 항목으로 교체**

현재 (제거할 두 블록):
```typescript
{
  to: '/admin/budget-plan',
  label: 'nav.item.budgetPlan',
  icon: PieChart,
  section: 'nav.section.management',
  subSection: 'nav.subsection.finance',
  roles: ['ADMIN', 'FRONT_OFFICE'],
  frontOfficeRoles: ['FINANCE_MANAGER', 'TD'],
},
// ...
{
  to: '/finance/budget',
  label: 'nav.item.budgetControl',
  icon: Wallet,
  section: 'nav.section.management',
  subSection: 'nav.subsection.finance',
  roles: ['ADMIN', 'SUPER_ADMIN', 'GM', 'FRONT_OFFICE'],
  frontOfficeRoles: ['FINANCE_MANAGER', 'FINANCE_STAFF'],
},
```

위 두 블록을 삭제하고, 두 블록이 있던 자리 중 첫 번째 위치(budgetPlan 자리)에 단일 항목 삽입:
```typescript
{
  to: '/budget',
  label: 'nav.item.budget',
  icon: Wallet,
  section: 'nav.section.management',
  subSection: 'nav.subsection.finance',
  roles: ['ADMIN', 'SUPER_ADMIN', 'GM', 'FRONT_OFFICE'],
},
```

`PieChart` icon이 더 이상 사용되지 않으면 해당 import도 제거 (다른 항목에서 사용 중이면 유지).

- [ ] **Step 2: 활성 경로 매칭 확인**

AppShell의 nav 항목 활성 하이라이트 로직이 `to` 와 현재 `pathname` 비교 방식을 확인. 보통 `useLocation`으로 `pathname.startsWith(item.to)` 방식. `/budget`으로 시작하는 경로(`/budget`, `/budget/123`)가 모두 활성화되는지 확인 — 기존 로직이 `startsWith` 방식이라면 자동으로 처리됨.

### i18n 파일

- [ ] **Step 3: ko/common.json 수정**

`"budgetPlan": "운영비 예산"` → 삭제
`"budgetControl": "예산 관리"` → 삭제
아래 추가 (nav.item 오브젝트 내 적절한 위치):
```json
"budget": "예산"
```

- [ ] **Step 4: en/common.json 동일 수정**

`"budgetPlan"` → 삭제
`"budgetControl"` → 삭제
아래 추가:
```json
"budget": "Budget"
```

- [ ] **Step 5: TypeScript 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
cd /Users/juno/work/football && git add football/src/layouts/AppShell.tsx \
  football/src/locales/ko/common.json football/src/locales/en/common.json
git commit -m "feat(fe): 사이드바 예산 항목 통합 (운영비 예산 + 예산 관리 → 예산)"
```

---

## Task 4: BudgetPlanWizard CTA

**Files:**
- Modify: `football/src/components/budget-plan/BudgetPlanWizard.tsx`

### C — 제출 완료 toast action

- [ ] **Step 1: useNavigate import 추가**

파일 상단 import에 추가:
```typescript
import { useNavigate } from 'react-router-dom'
```

컴포넌트 함수 내에 추가:
```typescript
const navigate = useNavigate()
```

- [ ] **Step 2: handleSubmit의 toast 수정**

현재 (~line 257):
```typescript
toast.success('편성 요청이 접수되었습니다')
```

아래로 교체:
```typescript
toast.success('편성 요청이 접수되었습니다.', {
  action: {
    label: '예산안 확인하기',
    onClick: () => navigate('/budget?tab=execution'),
  },
})
```

### B — 읽기 전용 카드 링크 버튼

- [ ] **Step 3: 읽기 전용 카드에 Link 버튼 추가**

`planStatus !== 'AWAITING_REVIEW'` 일 때 렌더하는 `<CardContent>` 내부 (`</CardContent>` 직전) 에 추가:

현재 CardContent 닫기 태그 직전:
```tsx
          {/* TODO(#428): PlanStatusBadge + 상세 액션 카드로 교체 */}
        </CardContent>
```

아래로 교체:
```tsx
          {/* TODO(#428): PlanStatusBadge + 상세 액션 카드로 교체 */}
          <div className="pt-2">
            <Link
              to="/budget?tab=execution"
              className="text-sm text-primary underline underline-offset-2"
            >
              예산안 확인하기 →
            </Link>
          </div>
        </CardContent>
```

`Link` import 추가 (이미 있으면 스킵):
```typescript
import { Link } from 'react-router-dom'
```

- [ ] **Step 4: TypeScript 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음

- [ ] **Step 5: 커밋**

```bash
cd /Users/juno/work/football && git add football/src/components/budget-plan/BudgetPlanWizard.tsx
git commit -m "feat(fe): 편성 제출 완료 후 예산안 확인 CTA 추가"
```

---

## 전체 검증

- [ ] `/budget` 접근 → 역할별 기본 탭 확인 (FRONT_OFFICE → 편성 계획, GM → 예산안 실행)
- [ ] `/admin/budget-plan` → `/budget?tab=plan` 리다이렉트 확인
- [ ] `/finance/budget` → `/budget?tab=execution` 리다이렉트 확인
- [ ] `/finance/budget/123` → `/budget/123` 리다이렉트 확인
- [ ] 사이드바에 "예산" 항목 하나만 표시, GM 계정에서도 보임
- [ ] 편성 요청 제출 후 toast에 "예산안 확인하기" 링크 표시, 클릭 시 실행 탭 이동
- [ ] 읽기 전용 카드에 "예산안 확인하기 →" 링크 표시
