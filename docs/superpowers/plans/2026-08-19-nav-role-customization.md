# Nav 역할별 맞춤형 Implementation Plan

**Date:** 2026-08-19  
**Grill answers:** Q1=D, Q2=D, Q3=D, Q4=D, Q5=A, Q6=D, Q7=A

---

## 1. 설계 요약

| 항목 | 결정 |
|------|------|
| 범위 | 항목 재검토 + 섹션 순서 재배치 + 랜딩 페이지 분리 |
| PLAYER | 훈련일정, 경기일정, 본인 프로필, 본인 부상, 본인 출결만 노출 |
| COACHING_STAFF | 훈련·경기·선수 섹션 최상단, 역할별 랜딩 분리 |
| FRONT_OFFICE | 담당 섹션 최상단, 역할별 랜딩 분리 |
| 랜딩 구현 | index 라우트(`/`)에서 `<Navigate>` 리다이렉트 |
| 섹션 순서 | `getSectionOrder(role, coachingRole?, frontOfficeRole?)` 함수 |

---

## 2. 랜딩 페이지 매핑

```typescript
// football/src/lib/roleLanding.ts
import type { Role, CoachingRole, FrontOfficeRole } from '@/types/user'

export function getDefaultLanding(
  role: Role,
  coachingRole?: CoachingRole | null,
  frontOfficeRole?: FrontOfficeRole | null,
): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
    case 'GM':
    case 'AGENT':
      return '/dashboard'

    case 'PLAYER':
      return '/player/me'

    case 'GUARDIAN':
      return '/guardian'

    case 'COACHING_STAFF':
      if (coachingRole === 'HEAD_COACH' || coachingRole === 'ASSISTANT_COACH')
        return '/coach/dashboard'
      if (coachingRole === 'MEDICAL' || coachingRole === 'MEDICAL_DIRECTOR')
        return '/medical/injuries'
      // GK_COACH, FITNESS, VIDEO_ANALYST 등
      return '/training'

    case 'FRONT_OFFICE':
      if (frontOfficeRole === 'FINANCE_MANAGER' || frontOfficeRole === 'FINANCE_STAFF')
        return '/finance/budget'
      if (frontOfficeRole === 'HR_MANAGER' || frontOfficeRole === 'HR_STAFF')
        return '/reports'
      if (frontOfficeRole === 'MARKETING')
        return '/sponsorship'
      if (frontOfficeRole === 'FACILITY_MANAGER' || frontOfficeRole === 'FACILITY_STAFF')
        return '/facility'
      if (frontOfficeRole === 'ASSET_MANAGER' || frontOfficeRole === 'ASSET_STAFF')
        return '/facility'
      if (frontOfficeRole === 'EQUIPMENT_MANAGER')
        return '/equipment'
      // TD, SCOUT, CONTRACT_MANAGER, TACTICAL_ANALYST, 기타
      return '/dashboard'

    default:
      return '/dashboard'
  }
}
```

---

## 3. 섹션 순서 함수

```typescript
// football/src/lib/sectionOrder.ts
import type { Role, CoachingRole, FrontOfficeRole } from '@/types/user'

const DEFAULT_ORDER = [
  'nav.section.players',
  'nav.section.training',
  'nav.section.matches',
  'nav.section.medical',
  'nav.section.youth',
  'nav.section.finance',
  'nav.section.hr',
  'nav.section.management',
]

export function getSectionOrder(
  role: Role,
  coachingRole?: CoachingRole | null,
  frontOfficeRole?: FrontOfficeRole | null,
): string[] {
  if (role === 'PLAYER') {
    return [
      'nav.section.training',
      'nav.section.matches',
      'nav.section.medical',
    ]
  }

  if (role === 'COACHING_STAFF') {
    if (coachingRole === 'MEDICAL' || coachingRole === 'MEDICAL_DIRECTOR') {
      return [
        'nav.section.medical',
        'nav.section.training',
        'nav.section.players',
        'nav.section.matches',
        'nav.section.youth',
        'nav.section.management',
      ]
    }
    // HEAD_COACH, ASSISTANT, GK_COACH, FITNESS, VIDEO
    return [
      'nav.section.training',
      'nav.section.matches',
      'nav.section.players',
      'nav.section.medical',
      'nav.section.youth',
      'nav.section.management',
    ]
  }

  if (role === 'FRONT_OFFICE') {
    if (frontOfficeRole === 'FINANCE_MANAGER' || frontOfficeRole === 'FINANCE_STAFF') {
      return [
        'nav.section.finance',
        'nav.section.hr',
        'nav.section.players',
        'nav.section.management',
      ]
    }
    if (frontOfficeRole === 'HR_MANAGER' || frontOfficeRole === 'HR_STAFF') {
      return [
        'nav.section.hr',
        'nav.section.finance',
        'nav.section.players',
        'nav.section.management',
      ]
    }
    if (frontOfficeRole === 'MARKETING') {
      return [
        'nav.section.finance',   // 스폰서십 포함
        'nav.section.players',
        'nav.section.management',
      ]
    }
    if (
      frontOfficeRole === 'FACILITY_MANAGER' ||
      frontOfficeRole === 'FACILITY_STAFF' ||
      frontOfficeRole === 'ASSET_MANAGER' ||
      frontOfficeRole === 'ASSET_STAFF' ||
      frontOfficeRole === 'EQUIPMENT_MANAGER'
    ) {
      return [
        'nav.section.management',  // 시설·자산 subSection 포함
        'nav.section.finance',
        'nav.section.players',
      ]
    }
    return DEFAULT_ORDER
  }

  return DEFAULT_ORDER
}
```

---

## 4. PLAYER 노출 항목 재검토

현재 PLAYER에 허용된 항목 중 유지/제거:

| 항목 | 현재 | 변경 |
|------|------|------|
| 대시보드 (`/dashboard`) | ✅ | ❌ 제거 (랜딩이 `/player/me`로 바뀌므로 불필요) |
| 훈련일정 (`/training`) | ✅ | ✅ 유지 |
| 경기일정 (`/matches`) | ✅ | ✅ 유지 |
| 전술분석 (`/analysis`) | ✅ | ❌ 제거 |
| 랭킹 (`/rankings`) | ✅ | ❌ 제거 |
| 본인 프로필 (`/player/me`) | ❌ 없음 | ✅ 추가 |
| 본인 부상 (`/medical/injuries?mine=true`) | ❌ 없음 | ✅ 추가 |
| 본인 출결 (`/training/attendance?mine=true`) | ❌ 없음 | ✅ 추가 |

---

## 5. 파일 변경 맵

| 파일 | 변경 |
|------|------|
| `football/src/lib/roleLanding.ts` | 신규 — `getDefaultLanding()` |
| `football/src/lib/sectionOrder.ts` | 신규 — `getSectionOrder()` |
| `football/src/App.tsx` | index 라우트(`/`)에서 `getDefaultLanding` 기반 `<Navigate>` |
| `football/src/layouts/AppShell.tsx` | `SECTION_ORDER` → `getSectionOrder()` 호출로 교체; PLAYER `roles` 배열 재검토; 본인 프로필·부상·출결 항목 추가 |

---

## 6. 구현 상세

### Task 1: `roleLanding.ts` + `sectionOrder.ts` 생성

위 코드 그대로 `football/src/lib/` 에 생성.

### Task 2: `App.tsx` — index 라우트 리다이렉트

```tsx
// App.tsx index route
import { getDefaultLanding } from '@/lib/roleLanding'

// index route element
function RootRedirect() {
  const { user, loading } = useCurrentUser()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={getDefaultLanding(user.role, user.coachingRole, user.frontOfficeRole)} replace />
}

// routes
{ path: '/', element: <RootRedirect /> }
```

### Task 3: `AppShell.tsx` — 섹션 순서 교체

```tsx
// 기존
const SECTION_ORDER: string[] = [...]

// 변경
import { getSectionOrder } from '@/lib/sectionOrder'

// visibleNavItems 아래에서:
const sectionOrder = getSectionOrder(user.role, user.coachingRole, user.frontOfficeRole)

// navGroups 생성 시:
const navGroups = []
const rootItems = visibleNavItems.filter(i => !i.section)
if (rootItems.length > 0) navGroups.push({ section: null, items: rootItems })
for (const s of sectionOrder) {
  const items = visibleNavItems.filter(i => i.section === s)
  if (items.length > 0) navGroups.push({ section: s, items })
}
// sectionOrder에 없는 섹션도 끝에 추가 (안전망)
const remaining = visibleNavItems
  .filter(i => i.section && !sectionOrder.includes(i.section))
  .map(i => i.section!)
for (const s of [...new Set(remaining)]) {
  const items = visibleNavItems.filter(i => i.section === s)
  if (items.length > 0) navGroups.push({ section: s, items })
}
```

### Task 4: `AppShell.tsx` — PLAYER 항목 추가 + 불필요 항목 제거

```typescript
// NAV_ITEMS에서 PLAYER roles 수정

// 대시보드: PLAYER 제거
{ to: '/dashboard', roles: ['ADMIN', 'SUPER_ADMIN', 'GM', 'FRONT_OFFICE', 'COACHING_STAFF', 'AGENT'] }

// 전술분석: PLAYER 제거
{ to: '/analysis', roles: ['ADMIN', 'COACHING_STAFF'] }

// 랭킹: PLAYER 제거 (또는 유지 — 선택)
{ to: '/rankings', roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'] }

// 본인 프로필 추가
{
  to: '/player/me',
  label: 'nav.item.myProfile',
  icon: User,
  section: null,  // 루트 (섹션 없음)
  roles: ['PLAYER'],
},

// 본인 부상 추가
{
  to: '/medical/injuries',
  label: 'nav.item.myInjuries',
  icon: HeartPulse,
  section: 'nav.section.medical',
  roles: ['PLAYER'],
},

// 본인 출결 추가
{
  to: '/training/attendance',
  label: 'nav.item.myAttendance',
  icon: CalendarCheck,
  section: 'nav.section.training',
  roles: ['PLAYER'],
},
```

### Task 5: i18n 키 추가

```json
// ko/nav.json (또는 해당 translation 파일)
"nav": {
  "item": {
    "myProfile": "내 프로필",
    "myInjuries": "내 부상 기록",
    "myAttendance": "내 출결 현황"
  }
}
```

---

## 7. PLAYER `/player/me` 라우트

PLAYER가 본인 정보를 조회하는 페이지가 없으면 신규 생성 필요:

```tsx
// /player/me → PlayerDetailPage에 본인 playerId로 리다이렉트
function PlayerMeRedirect() {
  const { user } = useCurrentUser()
  // user.playerId가 있으면 해당 선수 상세로 이동
  if (user?.playerId) return <Navigate to={`/players/${user.playerId}`} replace />
  return <div>선수 정보가 연결되지 않았습니다.</div>
}
```

> **Note:** `User` 모델에 `playerId` FK가 있는지 확인 필요. 없으면 별도 연결 테이블 또는 `Player.userId` FK 확인.

---

## 8. 구현 순서

1. `roleLanding.ts` + `sectionOrder.ts` 생성
2. `App.tsx` index 라우트 리다이렉트
3. `AppShell.tsx` 섹션 순서 교체
4. `AppShell.tsx` PLAYER 항목 재검토
5. i18n 키 추가
6. `/player/me` 라우트 처리
