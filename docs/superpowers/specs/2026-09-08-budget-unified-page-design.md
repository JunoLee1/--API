# 예산 통합 페이지 설계

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 사이드바에 분리된 "운영비 예산"·"예산 관리" 두 항목을 단일 `/budget` 탭 페이지로 통합해 UX 혼동을 해소한다.

**Architecture:** 기존 세 페이지(BudgetPlanPage, BudgetListPage, BudgetAutoPage)는 내부 로직 변경 없이 신규 `BudgetPage.tsx` 컨테이너의 탭 콘텐츠로 임포트. 탭 식별은 `?tab=` query param으로 구동.

**Tech Stack:** React/Vite + React Router + 기존 스택

---

## 1. 라우팅 & URL 구조

### 신규 경로

| 경로 | 컴포넌트 | 용도 |
|------|---------|------|
| `/budget` | `BudgetPage.tsx` (신규) | 탭 컨테이너 |
| `/budget/:id` | `BudgetDetailPage.tsx` (기존 유지) | 예산안 상세 |

### 탭 식별자

| `?tab=` | 탭 이름 | 기존 경로 |
|---------|---------|---------|
| `plan` | 편성 계획 | `/admin/budget-plan` |
| `execution` | 예산안 실행 | `/finance/budget` |
| `auto` | 자동 산출 | `/finance/budget/auto` |

탭 param 미지정 기본값:
- ADMIN·FRONT_OFFICE → `plan`
- GM·SUPER_ADMIN → `execution`

### 기존 경로 리다이렉트 (`App.tsx`)

| 기존 | 신규 |
|------|------|
| `/admin/budget-plan` | `/budget?tab=plan` |
| `/finance/budget` | `/budget?tab=execution` |
| `/finance/budget/auto` | `/budget?tab=auto` |
| `/finance/budget/:id` | `/budget/:id` |

---

## 2. AppShell 네비게이션

### 변경 전
```
재무
├── 운영비 예산   → /admin/budget-plan   (ADMIN, FRONT_OFFICE)
├── 예산 관리     → /finance/budget      (ADMIN, SUPER_ADMIN, GM, FRONT_OFFICE)
```

### 변경 후
```
재무
├── 예산          → /budget              (ADMIN, SUPER_ADMIN, GM, FRONT_OFFICE)
```

- 기존 두 항목 제거, 신규 항목 1개 추가
- i18n 키: `nav.item.budget` (신규) — `nav.item.budgetPlan`, `nav.item.budgetControl` 삭제
- 활성 하이라이트: pathname이 `/budget` 또는 `/budget/` 로 시작하면 활성

---

## 3. BudgetPage 탭 구성

### 컴포넌트 구조

```
BudgetPage.tsx
├── 탭 헤더 (useSearchParams 기반)
│   ├── "편성 계획"   — ADMIN·FRONT_OFFICE만 노출
│   ├── "예산안 실행" — 전체 노출
│   └── "자동 산출"   — 전체 노출
└── 탭 콘텐츠
    ├── tab=plan      → <BudgetPlanPageContent />
    ├── tab=execution → <BudgetListPageContent />
    └── tab=auto      → <BudgetAutoPageContent />
```

### 권한 처리

- 권한 없는 탭은 탭 헤더에서 **완전히 숨김** (비활성 표시 아님)
- URL의 `tab` param이 권한 밖 탭을 가리키면 해당 역할의 기본 탭으로 `<Navigate replace>` 처리

### 탭 전환

- `useSearchParams()`로 `tab` 읽기/쓰기
- 탭 클릭 → `setSearchParams({ tab: '...' })` → URL 반영
- 브라우저 뒤로가기로 이전 탭 복귀 가능

### 기존 페이지 컴포넌트 처리

BudgetPlanPage, BudgetListPage, BudgetAutoPage는 독립 라우트로서의 export를 유지하되, 각 내부 JSX를 `BudgetPage`에서 직접 임포트해 렌더. 기존 페이지 파일의 로직(훅, 핸들러, 상태)은 변경하지 않는다.

---

## 4. Wizard CTA (편성 완료 후)

편성 Wizard 마지막 단계 확정 완료 시 **버튼 + 토스트 동시 적용**.

### B — 완료 화면 버튼

Wizard 완료 화면의 기존 "닫기" 버튼 옆에 추가:

```
[닫기]  [예산안 확인하기 →]
```

"예산안 확인하기" 클릭 → `navigate('/budget?tab=execution')`.

**적용 위치:** `BudgetPlanWizard.tsx` 완료 단계 JSX.

### C — 토스트

확정 API 성공 콜백에서:

```typescript
toast.success('편성이 확정됐습니다.', {
  action: {
    label: '예산안 확인하기',
    onClick: () => navigate('/budget?tab=execution'),
  },
})
```

**적용 위치:** 확정 핸들러 (finalize / gmApprove 성공 콜백).

---

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `football/src/pages/budget/BudgetPage.tsx` | 신규 — 탭 컨테이너 |
| `football/src/App.tsx` | `/budget`, `/budget/:id` 라우트 추가; 기존 4개 경로 `<Navigate>` 리다이렉트로 교체 |
| `football/src/layouts/AppShell.tsx` | nav 항목 2개 → 1개 교체; i18n 키 변경 |
| `football/src/components/budget-plan/BudgetPlanWizard.tsx` | 완료 화면 버튼 + 토스트 추가 |
| `football/src/i18n/ko/nav.json` (또는 해당 i18n 파일) | `nav.item.budget` 추가; `nav.item.budgetPlan`, `nav.item.budgetControl` 삭제 |
