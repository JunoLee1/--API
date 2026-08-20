# 감독 뷰 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** HEAD_COACH 역할에 맞게 메뉴를 정리하고, 대시보드에 "오늘 훈련·부상자·다음 경기" 3-box를 추가하며, 영어로 노출되던 훈련 상태값을 한국어로 교체한다.

**Architecture:** 순수 프론트엔드 변경. 신규 API 없음. AppShell nav 필터 수정 + 신규 `CoachQuickView` 컴포넌트를 `DashboardPage`에 HEAD_COACH 조건부 삽입. 기존 `trainingApi.list()`, `injuryApi.active()`, `matchApi.list()` 재사용하여 클라이언트에서 필터링.

**Tech Stack:** React, TypeScript, shadcn/ui (Card, Skeleton), react-router-dom, react-i18next

---

## 파일 변경 맵

| 파일 | 역할 |
|------|------|
| `football/src/types/training.ts` | SESSION_TYPE_LABEL, ATTENDANCE_LABEL, PHASE_LABEL 한국어 교체 |
| `football/src/layouts/AppShell.tsx` | `/equipment` roles에서 COACHING_STAFF 제거; `/training/dashboard` → `/training/analysis` |
| `football/src/App.tsx` | route `/training/dashboard` → `/training/analysis` |
| `football/src/components/dashboard/CoachQuickView.tsx` | 신규 — 3-box 컴포넌트 |
| `football/src/pages/dashboard/DashboardPage.tsx` | HEAD_COACH 조건 시 CoachQuickView 삽입 |

---

## Task 1: 훈련 상태값 한국어 교체

**Files:**
- Modify: `football/src/types/training.ts`

- [x] **Step 1: SESSION_TYPE_LABEL 교체**

`football/src/types/training.ts`에서 아래 상수를 찾아 교체:

```typescript
export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  INDIVIDUAL_SKILL: '개인 기술',
  TACTICAL_DEFENSIVE: '수비 전술',
  TACTICAL_ATTACKING: '공격 전술',
  TACTICAL_FULL_TEAM: '전체 전술',
  PHYSICAL: '체력',
  PSYCHOLOGICAL_SOCIAL: '심리·사회',
  SET_PIECE: '세트피스',
}
```

- [x] **Step 2: ATTENDANCE_LABEL 교체**

같은 파일에서:

```typescript
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: '출석',
  ABSENT_UNAUTHORIZED: '무단 결석',
  LATE_UNAUTHORIZED: '무단 지각',
  ABSENT_AUTHORIZED: '승인 결석',
}
```

- [x] **Step 3: PHASE_LABEL 교체**

같은 파일에서:

```typescript
export const PHASE_LABEL: Record<ContentPhase, string> = {
  WARMUP: '워밍업',
  DRILL: '드릴',
  TACTICAL: '전술',
  GAME: '게임',
}
```

- [x] **Step 4: 커밋**

```bash
git add football/src/types/training.ts
git commit -m "fix(i18n): 훈련 상태값·세션 타입·출결 라벨 한국어 교체"
```

---

## Task 2: 메뉴 정리 + 경로 변경

**Files:**
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/App.tsx`

- [x] **Step 1: /equipment에서 COACHING_STAFF 제거**

`football/src/layouts/AppShell.tsx`에서 `/equipment` 항목을 찾아 수정:

```typescript
// 변경 전
{
  to: '/equipment',
  label: 'nav.item.equipment',
  icon: Package,
  section: 'nav.section.management',
  subSection: 'nav.subsection.facilityAssets',
  roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'],
},

// 변경 후
{
  to: '/equipment',
  label: 'nav.item.equipment',
  icon: Package,
  section: 'nav.section.management',
  subSection: 'nav.subsection.facilityAssets',
  roles: ['ADMIN', 'FRONT_OFFICE'],
},
```

- [x] **Step 2: /training/dashboard → /training/analysis (AppShell nav)**

같은 파일에서 `/training/dashboard` 항목을 찾아 수정:

```typescript
// 변경 전
{
  to: '/training/dashboard',
  label: 'nav.item.coachDashboard',
  icon: LayoutDashboard,
  section: 'nav.section.training',
  roles: ['COACHING_STAFF'],
},

// 변경 후
{
  to: '/training/analysis',
  label: 'nav.item.coachDashboard',
  icon: LayoutDashboard,
  section: 'nav.section.training',
  roles: ['COACHING_STAFF'],
},
```

- [x] **Step 3: App.tsx 라우트 경로 변경**

`football/src/App.tsx`에서:

```typescript
// 변경 전
<Route path="/training/dashboard" element={<CoachDashboardPage />} />

// 변경 후
<Route path="/training/analysis" element={<CoachDashboardPage />} />
```

- [x] **Step 4: 커밋**

```bash
git add football/src/layouts/AppShell.tsx football/src/App.tsx
git commit -m "fix(nav): COACHING_STAFF 장비 메뉴 숨김, 훈련 분석 경로 변경"
```

---

## Task 3: CoachQuickView 컴포넌트 작성

**Files:**
- Create: `football/src/components/dashboard/CoachQuickView.tsx`

- [x] **Step 1: 컴포넌트 파일 생성**

`football/src/components/dashboard/CoachQuickView.tsx` 신규 생성:

```typescript
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { trainingApi } from '@/services/training.service'
import { injuryApi } from '@/services/injury.service'
import { matchApi } from '@/services/match.service'
import type { TrainingSession, TrainingParticipant } from '@/types/training'
import type { Match } from '@/types/match'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

function TodayTrainingBox({ seasonId }: { seasonId: number | undefined }) {
  const [session, setSession] = useState<TrainingSession | null | undefined>(undefined)
  const [absentees, setAbsentees] = useState<string[]>([])

  useEffect(() => {
    if (!seasonId) return
    trainingApi.list(seasonId).then((sessions) => {
      const today = sessions.find((s) => s.date.slice(0, 10) === todayStr())
      setSession(today ?? null)
      if (today) {
        trainingApi.get(today.id).then((detail) => {
          const absent = (detail.participants ?? [])
            .filter((p: TrainingParticipant) =>
              p.attendance === 'ABSENT_UNAUTHORIZED' || p.attendance === 'ABSENT_AUTHORIZED'
            )
            .map((p: TrainingParticipant) => p.playerName)
          setAbsentees(absent)
        }).catch(() => null)
      }
    }).catch(() => setSession(null))
  }, [seasonId])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">오늘 훈련</CardTitle>
      </CardHeader>
      <CardContent>
        {session === undefined ? (
          <Skeleton className="h-8 w-24" />
        ) : session === null ? (
          <p className="text-lg font-semibold text-muted-foreground">오늘 훈련 없음</p>
        ) : absentees.length === 0 ? (
          <p className="text-lg font-semibold text-green-600">전원 출석</p>
        ) : (
          <>
            <p className="text-2xl font-bold text-red-600">결석 {absentees.length}명</p>
            <p className="text-xs text-muted-foreground mt-1">{absentees.join(', ')}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function InjuryStatusBox() {
  const [total, setTotal] = useState<number | null>(null)
  const [returning, setReturning] = useState<string[]>([])

  useEffect(() => {
    injuryApi.active().then((injuries) => {
      setTotal(injuries.length)
      const soon = injuries
        .filter((i) => {
          if (!i.expectedReturnDate) return false
          const days = daysUntil(i.expectedReturnDate)
          return days >= 0 && days <= 7
        })
        .map((i) => i.playerName ?? i.playerId)
      setReturning(soon)
    }).catch(() => setTotal(0))
  }, [])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">부상자</CardTitle>
      </CardHeader>
      <CardContent>
        {total === null ? (
          <Skeleton className="h-8 w-24" />
        ) : total === 0 ? (
          <p className="text-lg font-semibold text-green-600">부상자 없음</p>
        ) : (
          <>
            <p className="text-2xl font-bold">{total}명</p>
            {returning.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                복귀 임박: {returning.join(', ')}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function NextMatchBox({ seasonId }: { seasonId: number | undefined }) {
  const [next, setNext] = useState<Match | null | undefined>(undefined)

  useEffect(() => {
    if (!seasonId) return
    matchApi.list({ seasonId }).then((matches) => {
      const upcoming = matches
        .filter((m) => m.homeScore === null && new Date(m.date) > new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      setNext(upcoming[0] ?? null)
    }).catch(() => setNext(null))
  }, [seasonId])

  const opponent = next
    ? (next.homeTeamName === 'FC Seoul' ? next.awayTeamName : next.homeTeamName)
    : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">다음 경기</CardTitle>
      </CardHeader>
      <CardContent>
        {next === undefined ? (
          <Skeleton className="h-8 w-24" />
        ) : next === null ? (
          <p className="text-lg font-semibold text-muted-foreground">예정 경기 없음</p>
        ) : (
          <>
            <p className="text-2xl font-bold">D-{daysUntil(next.date)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              vs {opponent} · {new Date(next.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function CoachQuickView({ seasonId }: { seasonId: number | undefined }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <TodayTrainingBox seasonId={seasonId} />
      <InjuryStatusBox />
      <NextMatchBox seasonId={seasonId} />
    </div>
  )
}
```

- [x] **Step 2: injury.service.ts에서 active() 반환 타입 확인**

`football/src/services/injury.service.ts`를 열어 `active()` 반환값에 `playerName`, `expectedReturnDate`가 있는지 확인. 없으면 `injuryApi.active()` 호출 후 playerId를 쓰는 부분을 수정하거나 타입을 보완.

실제 반환 타입:
```typescript
// football/src/services/injury.service.ts 에서 확인
// active: () => api.get<{ playerId: string; status: InjuryStatus }[]>('/injuries/active')
```

`playerName`이 없는 경우 `InjuryStatusBox`에서 `i.playerName ?? i.playerId` 대신 `i.playerId`만 사용:

```typescript
.map((i) => i.playerId)
```

- [x] **Step 3: TrainingParticipant 타입에 playerName 확인**

`football/src/types/training.ts`에서 `TrainingParticipant` 혹은 `TrainingSessionDetail`의 participants 배열 타입을 확인. `playerName`이 없으면 `playerId`로 대체:

```typescript
// playerName 없을 시
.map((p: TrainingParticipant) => p.playerName ?? p.playerId)
```

- [x] **Step 4: 커밋**

```bash
git add football/src/components/dashboard/CoachQuickView.tsx
git commit -m "feat(dashboard): CoachQuickView 3-box 컴포넌트 추가"
```

---

## Task 4: DashboardPage에 CoachQuickView 통합

**Files:**
- Modify: `football/src/pages/dashboard/DashboardPage.tsx`

- [x] **Step 1: import 추가**

`DashboardPage.tsx` 상단 import 블록에 추가:

```typescript
import { CoachQuickView } from '@/components/dashboard/CoachQuickView'
```

- [x] **Step 2: currentSeasonId state 확인**

`DashboardPage.tsx`에서 `seasonId`를 담는 state 변수명 확인. 이미 있으면 재사용. 없으면:

```typescript
const [currentSeasonId, setCurrentSeasonId] = useState<number | undefined>(undefined)
```

그리고 기존 `seasonApi` 호출에서 seasonId를 설정하는 부분에 추가:

```typescript
seasonApi.getActive().then((s) => {
  setCurrentSeasonId(s?.id)
  // ... 기존 코드
}).catch(() => null)
```

- [x] **Step 3: HEAD_COACH 조건부 렌더링 삽입**

`DashboardPage.tsx`의 return 블록에서 `{/* 숫자 카드 */}` 바로 위에 삽입:

```tsx
{/* 감독 즉시 뷰 */}
{user.role === 'COACHING_STAFF' && user.coachingRole === 'HEAD_COACH' && (
  <CoachQuickView seasonId={currentSeasonId} />
)}

{/* 숫자 카드 */}
<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
  ...
```

- [x] **Step 4: 커밋**

```bash
git add football/src/pages/dashboard/DashboardPage.tsx
git commit -m "feat(dashboard): HEAD_COACH 대시보드에 CoachQuickView 3-box 삽입"
```

---

## Task 5: 수동 검증

- [x] **Step 1: 개발 서버 실행**

```bash
cd football && npm run dev
```

- [x] **Step 2: COACHING_STAFF / HEAD_COACH 계정으로 로그인 후 확인**

- [x] 사이드바에 장비 관리 메뉴가 보이지 않는지 확인
- [x] 훈련 메뉴 아래 "코치 대시보드" 클릭 시 `/training/analysis` 경로로 열리는지 확인
- [x] 대시보드 진입 시 stat cards 위에 3-box(오늘 훈련 / 부상자 / 다음 경기)가 표시되는지 확인
- [x] 훈련 세션 타입 배지가 한국어로 표시되는지 확인 (예: "수비 전술")
- [x] 출결 상태가 한국어로 표시되는지 확인 (예: "출석", "무단 결석")

- [x] **Step 3: FRONT_OFFICE 계정으로 로그인 후 장비 메뉴 정상 표시 확인**

COACHING_STAFF에서만 제거됐고 FRONT_OFFICE는 그대로인지 확인.

- [x] **Step 4: 최종 커밋 + PR 생성**

```bash
git push -u origin feat/coach-view
gh pr create \
  --title "feat(coach-view): 감독 뷰 — 메뉴 정리 + 3-box 대시보드 + i18n 한국어" \
  --body "$(cat <<'EOF'
## Summary
- COACHING_STAFF에서 장비 관리 메뉴 숨김
- /training/dashboard → /training/analysis 경로 변경 (대시보드 단일화)
- HEAD_COACH 대시보드 상단에 CoachQuickView 3-box 추가 (오늘 훈련·부상자·다음 경기)
- 훈련 세션 타입, 출결 상태, 훈련 단계 라벨 한국어 교체

## Test plan
- [x] HEAD_COACH 로그인 → 사이드바 장비 메뉴 없음 확인
- [x] 대시보드 3-box 정상 렌더링 확인
- [x] 훈련 페이지 한국어 라벨 확인
- [x] FRONT_OFFICE 로그인 → 장비 메뉴 정상 표시 확인

🤖 Generated with Claude Code
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- [x] 메뉴 정리 (장비 숨김) → Task 2
- [x] 보고서 유지 → 변경 없음 (이미 COACHING_STAFF 포함)
- [x] 3-box (오늘 훈련·부상자·다음 경기) → Task 3
- [x] 3-box 상단 배치 + 기존 카드 유지 → Task 4
- [x] /training/dashboard 경로 변경 → Task 2
- [x] i18n 한국어 → Task 1
- [x] 스쿼드 플래너 저장 제외 → 미포함 (의도적)

**Placeholder scan:** 없음. 모든 코드 블록 구체적.

**Type consistency:**
- `CoachQuickView`는 Task 3에서 정의하고 Task 4에서 import — 일치
- `trainingApi.list(seasonId)`, `injuryApi.active()`, `matchApi.list({ seasonId })` — 기존 서비스 시그니처와 일치
- `user.coachingRole === 'HEAD_COACH'` — auth.ts의 `CoachingRole` 타입과 일치

**주의:** Task 3 Step 2-3에서 `playerName` 필드 존재 여부를 실제 타입 파일에서 확인하고 없으면 `playerId`로 대체해야 함. 실행 중 타입 에러 발생 시 즉시 수정.
