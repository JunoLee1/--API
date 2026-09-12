# 예산 통합 페이지 — 이슈 초안

> 원본 플랜: `docs/superpowers/plans/2026-09-08-budget-unified-page.md`
> 아래 두 블록을 각각 GitHub 이슈 본문으로 복붙.

---

## 이슈 1 — [Bug] 예산 통합 페이지: 권한 판정이 두 곳에 흩어져 어긋남

**라벨 제안:** `bug`, `frontend`, `auth`
**우선순위:** 높음 (통합 머지 전 반드시 해결)

### 배경

`/budget?tab=` 통합 페이지(`BudgetPage.tsx`)를 도입하면서, 권한 판정 로직이
`AppShell.tsx`(메뉴 노출)와 `BudgetPage.tsx`(탭 노출) **두 곳에 각각** 존재하게 됨.
두 규칙이 서로 다르게 작성되어 아래 3가지 문제가 동시에 발생.

### 문제 1 — `loading` 미처리로 리다이렉트가 즉시 깨짐

`useCurrentUser`는 `{ user, loading, refetch }`를 반환하며 초기값은
`user = null`, `loading = true`. 플랜의 `BudgetPage`는 `loading`을 확인하지 않음.

첫 렌더 시점에 `user === null` → `canSeePlan === false` →
`?tab=plan` 요청이 즉시 `<Navigate to="/budget?tab=execution" replace />`로 튕김.

**영향:** `/admin/budget-plan` 리다이렉트로 들어온 ADMIN 사용자가
편성 계획 탭에 절대 도달하지 못함. `replace`라 히스토리도 남지 않음.
`?tab=plan` 북마크도 동일하게 깨짐.

**해결 방향:** `loading === true` 동안 권한 판정 및 리다이렉트를 보류.
표시할 대체 UI(스켈레톤/null)는 기존 페이지 패턴을 따를 것.

### 문제 2 — FRONT_OFFICE 하위 역할 권한 확대

`AppShell`은 `roles` + `frontOfficeRoles` 2단 체크를 사용.

| 기존 nav 항목 | roles | frontOfficeRoles |
|---|---|---|
| 운영비 예산 | ADMIN, FRONT_OFFICE | TD, FINANCE_MANAGER |
| 예산 관리 | ADMIN, SUPER_ADMIN, GM, FRONT_OFFICE | FINANCE_MANAGER, FINANCE_STAFF |

플랜의 통합 nav 항목은 `frontOfficeRoles`를 **누락**함
→ `ASSET_STAFF`, `SCOUT`, `HR_STAFF` 등 모든 FO 하위 역할에게 "예산" 메뉴 노출.

또한 `BudgetPage`의 `canSeePlan`은 `user?.role === 'FRONT_OFFICE'`만 확인
→ `FINANCE_STAFF`가 기존에 접근 불가였던 **편성 계획 탭에 접근 가능**해짐.

**해결 방향:** 통합 항목에 `frontOfficeRoles` 명시.
탭별 가시성 판정도 동일한 2단 규칙을 사용하도록 통일.

### 문제 3 — SUPER_ADMIN이 편성 계획 탭을 볼 수 없음

통합 nav `roles`에는 `SUPER_ADMIN`이 포함되지만
`canSeePlan`(ADMIN, FRONT_OFFICE)에는 없음.
ADMIN 상위 권한이 기능을 사용하지 못하는 것이 의도인지 확인 필요.

### 근본 원인 / 제안

세 문제 모두 **권한 규칙의 단일 출처(single source of truth)가 없다**는 하나의 원인에서 파생.
탭 기반 통합 페이지를 추가할 때마다 같은 버그가 재발할 구조.

- [ ] 역할 → 접근 가능 리소스 판정을 한 곳으로 추출 (예: `lib/permissions.ts` 또는 훅)
- [ ] `AppShell` nav 필터와 `BudgetPage` 탭 필터가 동일 함수를 호출
- [ ] `loading` 상태를 판정 함수 시그니처에 포함
- [ ] 역할별 접근 매트릭스를 테스트로 고정

### 검증 체크리스트

- [ ] ADMIN / SUPER_ADMIN / GM / FO(TD, FINANCE_MANAGER, FINANCE_STAFF, ASSET_STAFF) 각각 로그인 시 사이드바 "예산" 노출 여부
- [ ] 각 역할이 `/budget?tab=plan` 직접 진입 시 기대 동작
- [ ] 새로고침(F5) 후에도 탭이 유지되는지
- [ ] `/admin/budget-plan` → `/budget?tab=plan` 리다이렉트가 ADMIN에서 정상 동작

---

## 이슈 2 — [Improve] 예산 통합 페이지: 탭 상태·i18n·접근성 보완

**라벨 제안:** `enhancement`, `frontend`, `a11y`, `i18n`
**우선순위:** 중간 (이슈 1 해결 후)

### 1. 잘못된 탭 값 처리 없음

`searchParams.get('tab') as Tab | null` — 타입 단언일 뿐 런타임 검증이 아님.
`?tab=xxx` 진입 시 세 조건이 모두 false가 되어 **탭 헤더만 있고 본문이 빈 화면**.

- [ ] 허용 값 화이트리스트 검증 후 미일치 시 기본 탭으로 정규화

### 2. `setSearchParams({ tab })`가 나머지 쿼리를 제거

객체를 통째로 넘기므로 기존 쿼리 파라미터가 전부 소실.
현재 `BudgetListPage`는 `useSearchParams`를 쓰지 않아 증상이 없으나,
목록에 필터·페이지네이션이 URL로 들어오는 순간 터짐.

- [ ] 함수형 업데이트로 기존 파라미터를 보존하도록 변경

### 3. 탭 전환 시 언마운트로 상태·데이터 소실

조건부 렌더 구조라 탭을 오갈 때마다 필터·스크롤·작성 중인 폼이 초기화되고 API 재요청 발생.
특히 편성 위저드 작성 중 탭 이탈 시 입력 손실.

- [ ] 허용 가능한 손실인지 판단 → 필요 시 상태 보존 또는 이탈 경고

### 4. `/budget/:id` 상세에 탭 헤더 없음

목록으로 돌아갈 UI가 브라우저 뒤로가기뿐.
(사이드바 활성 표시는 `AppShell`의 `startsWith(to + '/')` 로직으로 정상 동작 확인됨.)

- [ ] 상세 화면에 목록 복귀 경로 제공

### 5. i18n 역행

`locales/*/common.json`을 수정하면서 정작 아래는 한글 하드코딩:
- `TABS`의 `label` (`'편성 계획'`, `'예산안 실행'`, `'자동 산출'`)
- 제출 완료 toast 문구 및 액션 라벨
- 읽기 전용 카드의 "예산안 확인하기 →" 링크

**영향:** 영문 사용자에게 탭 라벨만 한글로 표시.

- [ ] 해당 문자열을 i18n 키로 이전

### 6. 접근성

- [ ] `role="tablist"` / `role="tab"` / `aria-selected` 부여
- [ ] 좌우 화살표 키 탭 이동 지원

---

## 이슈 외 — 플랜 문서 자체 수정 (별도 이슈 불필요)

- `Task 2 Step 1`의 import 서술이 "그대로 유지" → "4개 삭제" → "다시 import"로 자기모순.
  실행 에이전트가 혼란하므로 **최종 상태만** 남길 것.
- 리다이렉트 4개의 **제거 기준·시점**이 문서에 없음.
  외부 링크·알림 메일에 박힌 URL 여부를 확인하고 영구 유지인지 명시할 것.
