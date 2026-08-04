# Super Admin 전사 계정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `SUPER_ADMIN` 역할을 가진 전사 계정이 팀을 선택해 해당 팀 데이터를 ADMIN 권한으로 관리할 수 있게 한다.

**Architecture:** Prisma `Role` enum에 `SUPER_ADMIN` 추가 → 백엔드 공통 `authMiddleware`가 `X-Team-Id` 헤더를 읽어 `req.user.teamId`를 주입 → 프론트 `api.ts`가 localStorage에서 선택된 팀 ID를 읽어 모든 요청에 헤더 첨부 → 사이드바 상단 드롭다운으로 팀 전환, 전환 시 `window.location.reload()`.

**Tech Stack:** Prisma (PostgreSQL), Express/Passport-JWT, React + React Router, localStorage

---

## File Map

**Backend (apps/api/):**
- Modify: `prisma/schema.prisma` — Role enum에 SUPER_ADMIN 추가
- Create: `apps/api/src/lib/authMiddleware.ts` — 통합 auth 미들웨어 (passport + superAdmin teamId 주입)
- Create: `apps/api/src/lib/permissions.ts` — `isSuperAdmin` 유틸
- Modify: `apps/api/src/lib/express.d.ts` — Role import (prisma 재생성 후 자동 반영)
- Modify: 44개 `*.routes.ts` — `const auth = passport.authenticate(...)` → `import { auth } from '../lib/authMiddleware'`
- Modify: `apps/api/src/team/team.controller.ts` — `canManage`에 SUPER_ADMIN 허용

**Frontend (football/src/):**
- Modify: `football/src/types/auth.ts` — Role에 `'SUPER_ADMIN'` 추가, ROLE_LABEL에 추가
- Modify: `football/src/services/api.ts` — 모든 fetch에 `X-Team-Id` 헤더 주입
- Create: `football/src/services/team.service.ts` — `GET /teams` API
- Create: `football/src/pages/team-select/TeamSelectPage.tsx` — 팀 선택 페이지
- Modify: `football/src/App.tsx` — `/team-select` 라우트 + SUPER_ADMIN guard
- Modify: `football/src/layouts/AppShell.tsx` — 사이드바 상단 팀 전환 드롭다운

---

### Task 1: Prisma migration — SUPER_ADMIN Role 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma:14-21`

- [ ] **Step 1: schema.prisma 수정**

```prisma
// apps/api/prisma/schema.prisma
enum Role {
  ADMIN
  SUPER_ADMIN
  FRONT_OFFICE
  COACHING_STAFF
  PLAYER
  AGENT
  GUARDIAN
}
```

- [ ] **Step 2: migration 생성**

```bash
cd apps/api
npx prisma migrate dev --name add_super_admin_role
```

Expected: `20260803_add_super_admin_role` 마이그레이션 파일 생성, Prisma Client 재생성

- [ ] **Step 3: TypeScript 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(super-admin): add SUPER_ADMIN to Role enum"
```

---

### Task 2: 공통 authMiddleware 생성

**Files:**
- Create: `apps/api/src/lib/authMiddleware.ts`
- Create: `apps/api/src/lib/permissions.ts`

- [ ] **Step 1: authMiddleware.ts 작성**

```typescript
// apps/api/src/lib/authMiddleware.ts
import passport from "passport";
import { Request, Response, NextFunction } from "express";

export const auth = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(
    "accessToken",
    { session: false },
    (err: unknown, user: Express.User | false) => {
      if (err || !user) {
        return res.status(401).json({ code: "UNAUTHORIZED" });
      }
      req.user = user;
      if (user.role === "SUPER_ADMIN") {
        const hdr = req.headers["x-team-id"];
        if (hdr) req.user.teamId = Number(hdr);
      }
      next();
    }
  )(req, res, next);
};
```

- [ ] **Step 2: permissions.ts 작성**

```typescript
// apps/api/src/lib/permissions.ts
export const isSuperAdmin = (user: Express.User): boolean =>
  user.role === "SUPER_ADMIN";
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/authMiddleware.ts apps/api/src/lib/permissions.ts
git commit -m "feat(super-admin): add shared authMiddleware with teamId injection"
```

---

### Task 3: 44개 routes 파일 — auth import 교체

**Files:**
- Modify: 44개 `apps/api/src/**/*.routes.ts`

각 파일의 `const auth = passport.authenticate("accessToken", { session: false });` 줄을 삭제하고 파일 상단에 import를 추가한다. `passport` import가 해당 목적으로만 쓰였다면 그 import도 제거한다.

- [ ] **Step 1: 스크립트로 일괄 교체**

```bash
cd /Users/juno/work/football

# 1. 각 파일에서 const auth = passport.authenticate(...) 줄 삭제
grep -rl 'const auth = passport.authenticate("accessToken", { session: false });' apps/api/src/ \
  | grep '\.routes\.ts$' \
  | xargs sed -i '' '/const auth = passport.authenticate("accessToken", { session: false });/d'

# 2. 각 파일에 authMiddleware import 추가 (passport import 줄 바로 뒤, 없으면 첫 번째 import 뒤)
# 각 파일의 상대 경로 깊이에 따라 ../lib 또는 ../../lib 경로가 다름
# 깊이 = apps/api/src/<module>/<file>.ts → ../lib
# 깊이 = apps/api/src/<module>/<sub>/<file>.ts → ../../lib

for f in $(grep -rl 'from "passport"' apps/api/src/ | grep '\.routes\.ts$'); do
  # 이미 authMiddleware import가 있으면 skip
  grep -q 'authMiddleware' "$f" && continue
  
  # 파일 경로 깊이 계산
  depth=$(echo "$f" | awk -F/ '{print NF}')
  # apps/api/src/X/X.routes.ts = depth 5, src/X/Y/X.routes.ts = depth 6
  if [ "$depth" -le 5 ]; then
    rel="../lib/authMiddleware"
  else
    rel="../../lib/authMiddleware"
  fi
  
  # 첫 번째 import 줄 뒤에 authMiddleware import 삽입
  sed -i '' "1s/^/import { auth } from \"${rel}\";\n/" "$f"
done
```

- [ ] **Step 2: passport import 단독 사용 여부 확인 후 정리**

```bash
# passport를 auth 외 다른 목적으로 쓰는 파일 찾기 (auth.routes.ts 등은 제외하지 말 것)
grep -rn "passport\." apps/api/src/ | grep '\.routes\.ts' | grep -v 'authMiddleware'
```

위 결과에서 `passport.` 참조가 남은 파일은 직접 열어 확인한다. `passport` import가 auth 목적으로만 있었다면 해당 import 줄도 제거한다.

- [ ] **Step 3: TypeScript 빌드로 누락/중복 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -50
```

Expected: 오류 없음. 오류가 있으면 해당 파일을 수동으로 수정한다.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/
git commit -m "refactor(super-admin): replace local auth constant with shared authMiddleware in all routes"
```

---

### Task 4: team.controller — SUPER_ADMIN 접근 허용

**Files:**
- Modify: `apps/api/src/team/team.controller.ts:5-6`

- [ ] **Step 1: canManage 함수 수정**

현재 코드 (`apps/api/src/team/team.controller.ts` 상단):
```typescript
const canManage = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && foRole === "GM");
```

변경 후:
```typescript
import { isSuperAdmin } from "../lib/permissions";

const canManage = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  role === "SUPER_ADMIN" ||
  (role === "FRONT_OFFICE" && foRole === "GM");
```

- [ ] **Step 2: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/team/team.controller.ts
git commit -m "feat(super-admin): allow SUPER_ADMIN to access team management"
```

---

### Task 5: FE types — SUPER_ADMIN Role 추가

**Files:**
- Modify: `football/src/types/auth.ts:1`

- [ ] **Step 1: Role 타입과 ROLE_LABEL 수정**

```typescript
// football/src/types/auth.ts
export type Role = 'ADMIN' | 'SUPER_ADMIN' | 'FRONT_OFFICE' | 'COACHING_STAFF' | 'PLAYER' | 'AGENT' | 'GUARDIAN'

// ... (CoachingRole, FrontOfficeRole 등 변경 없음)

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  FRONT_OFFICE: 'Front Office',
  COACHING_STAFF: 'Coaching Staff',
  PLAYER: 'Player',
  AGENT: 'Agent',
  GUARDIAN: 'Guardian',
}
```

- [ ] **Step 2: TypeScript 확인**

```bash
cd football && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add football/src/types/auth.ts
git commit -m "feat(super-admin): add SUPER_ADMIN to FE Role type"
```

---

### Task 6: api.ts — X-Team-Id 헤더 자동 주입

**Files:**
- Modify: `football/src/services/api.ts:41-49` (`doFetch` 함수)

SUPER_ADMIN이 팀을 선택하면 `localStorage.setItem('superAdminTeamId', String(teamId))`로 저장한다. 모든 API 요청에서 이 값을 읽어 헤더에 추가한다.

- [ ] **Step 1: doFetch 함수에 헤더 주입 추가**

현재:
```typescript
async function doFetch(method: HttpMethod, path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}
```

변경 후:
```typescript
function getSuperAdminHeaders(): Record<string, string> {
  const teamId = localStorage.getItem('superAdminTeamId')
  return teamId ? { 'X-Team-Id': teamId } : {}
}

async function doFetch(method: HttpMethod, path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getSuperAdminHeaders() },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}
```

- [ ] **Step 2: `requestForm` 함수도 동일하게 수정**

```typescript
async function requestForm<T>(method: 'POST' | 'PATCH', path: string, form: FormData): Promise<T> {
  // ...
  const doForm = () =>
    fetch(`${BASE_URL}${path}`, { method, credentials: 'include', body: form, headers: getSuperAdminHeaders() })
  // ...
}
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd football && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add football/src/services/api.ts
git commit -m "feat(super-admin): inject X-Team-Id header from localStorage in all API requests"
```

---

### Task 7: team.service.ts 생성

**Files:**
- Create: `football/src/services/team.service.ts`

- [ ] **Step 1: 파일 작성**

```typescript
// football/src/services/team.service.ts
import { api } from './api'

export interface Team {
  id: number
  name: string
  type: 'FIRST_TEAM' | 'YOUTH'
  ageGroup: string | null
  isActive: boolean
  isLite: boolean
}

export const teamApi = {
  list: () => api.get<Team[]>('/teams'),
}
```

- [ ] **Step 2: TypeScript 확인**

```bash
cd football && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add football/src/services/team.service.ts
git commit -m "feat(super-admin): add team API service"
```

---

### Task 8: TeamSelectPage 생성

**Files:**
- Create: `football/src/pages/team-select/TeamSelectPage.tsx`

이 페이지는 SUPER_ADMIN이 로그인 후 진입하는 팀 선택 화면이다. 팀을 선택하면 `localStorage.setItem('superAdminTeamId', String(team.id))`로 저장하고 `window.location.href = '/'`로 대시보드로 이동한다.

- [ ] **Step 1: 파일 작성**

```typescript
// football/src/pages/team-select/TeamSelectPage.tsx
import { useEffect, useState } from 'react'
import { teamApi, Team } from '@/services/team.service'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2 } from 'lucide-react'

export function TeamSelectPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    teamApi.list()
      .then((data) => setTeams(data.filter((t) => t.isActive)))
      .catch(() => toast.error('팀 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (team: Team) => {
    localStorage.setItem('superAdminTeamId', String(team.id))
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">구단 선택</h1>
          <p className="text-sm text-muted-foreground">관리할 구단을 선택하세요.</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">등록된 구단이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {teams.map((team) => (
              <Button
                key={team.id}
                variant="outline"
                className="w-full h-14 justify-start gap-3 text-left"
                onClick={() => handleSelect(team)}
              >
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{team.name}</p>
                  {team.ageGroup && (
                    <p className="text-xs text-muted-foreground">{team.ageGroup}</p>
                  )}
                </div>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 확인**

```bash
cd football && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add football/src/pages/team-select/TeamSelectPage.tsx
git commit -m "feat(super-admin): add TeamSelectPage"
```

---

### Task 9: App.tsx — 라우트 + SUPER_ADMIN guard

**Files:**
- Modify: `football/src/App.tsx`

SUPER_ADMIN이 `superAdminTeamId`를 선택하지 않은 채 다른 페이지에 접근하면 `/team-select`로 리디렉트한다.

- [ ] **Step 1: TeamSelectPage import 추가**

```typescript
// App.tsx 상단 imports에 추가
import { TeamSelectPage } from '@/pages/team-select/TeamSelectPage'
```

- [ ] **Step 2: SUPER_ADMIN guard 컴포넌트 추가**

`App.tsx`의 `<Routes>` 바깥에 아래 컴포넌트를 추가한다:

```typescript
function SuperAdminGuard({ user, children }: { user: UserDto | null; children: React.ReactNode }) {
  const location = useLocation()
  if (
    user?.role === 'SUPER_ADMIN' &&
    !localStorage.getItem('superAdminTeamId') &&
    location.pathname !== '/team-select'
  ) {
    return <Navigate to="/team-select" replace />
  }
  return <>{children}</>
}
```

- [ ] **Step 3: /team-select 라우트 추가 + guard 적용**

기존 라우팅 구조에서 `<AppShell>` 내부의 보호된 라우트들을 `<SuperAdminGuard>` 로 감싼다:

```typescript
// App.tsx Routes 내에서 AppShell 적용 부분
<Route element={<AppShell />}>
  <Route element={<SuperAdminGuard user={user}>{/* outlet */}<Outlet /></SuperAdminGuard>}>
    {/* 기존 라우트들 */}
    <Route path="/" element={<DashboardPage />} />
    {/* ... 나머지 라우트들 ... */}
  </Route>
</Route>
<Route path="/team-select" element={<TeamSelectPage />} />
```

`user` 는 `App.tsx`에서 `useCurrentUser()`로 가져온 값을 사용한다. App.tsx가 현재 `user`를 어떻게 관리하는지 확인 후 그 변수를 전달한다.

- [ ] **Step 4: TypeScript 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 5: Commit**

```bash
git add football/src/App.tsx
git commit -m "feat(super-admin): add /team-select route and SUPER_ADMIN redirect guard"
```

---

### Task 10: AppShell — 팀 전환 드롭다운

**Files:**
- Modify: `football/src/layouts/AppShell.tsx`

SUPER_ADMIN만 보이는 팀 전환 드롭다운을 사이드바 상단 로고 아래에 추가한다. 팀 전환 시 `localStorage.setItem('superAdminTeamId', String(newTeamId))`후 `window.location.reload()`.

- [ ] **Step 1: Select 컴포넌트 및 teamApi import 추가**

```typescript
// AppShell.tsx 상단에 추가
import { teamApi, Team } from '@/services/team.service'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
```

- [ ] **Step 2: AppShell 컴포넌트 내 state 추가**

`AppShell` 함수 내에 아래를 추가한다:

```typescript
const [teams, setTeams] = useState<Team[]>([])
const currentTeamId = localStorage.getItem('superAdminTeamId')

useEffect(() => {
  if (user?.role === 'SUPER_ADMIN') {
    teamApi.list()
      .then((data) => setTeams(data.filter((t) => t.isActive)))
      .catch(() => {})
  }
}, [user?.role])

const handleTeamSwitch = (teamId: string) => {
  localStorage.setItem('superAdminTeamId', teamId)
  window.location.reload()
}
```

- [ ] **Step 3: 사이드바 헤더 아래에 드롭다운 삽입**

데스크탑 사이드바의 로고 `<div>` 바로 아래에 추가한다 (현재 `AppShell.tsx:681` 근처):

```typescript
{/* 기존 로고 div */}
<div className="px-4 h-14 border-b flex items-center shrink-0">
  <h1 className="text-base font-semibold tracking-tight">Football ERP</h1>
</div>

{/* SUPER_ADMIN 팀 전환 드롭다운 */}
{user?.role === 'SUPER_ADMIN' && (
  <div className="px-3 py-2 border-b shrink-0">
    <Select value={currentTeamId ?? ''} onValueChange={handleTeamSwitch}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="구단 선택..." />
      </SelectTrigger>
      <SelectContent>
        {teams.map((t) => (
          <SelectItem key={t.id} value={String(t.id)}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

- [ ] **Step 4: 모바일 사이드바(Sheet)에도 동일하게 추가**

AppShell의 모바일 Sheet 사이드바에도 동일한 드롭다운 블록을 추가한다. Sheet 내부에서 데스크탑과 동일한 위치를 찾아 삽입.

- [ ] **Step 5: nav 항목 필터링 — SUPER_ADMIN은 모든 항목 표시**

SUPER_ADMIN은 특정 role/frontOfficeRole 제한 없이 모든 nav 항목을 볼 수 있어야 한다.

현재 `canShowNavItem` (또는 동등한 함수, `AppShell.tsx:530` 근처):

```typescript
if (!item.roles.includes(user.role)) return false
```

수정:

```typescript
if (user.role === 'SUPER_ADMIN') return true   // 모든 항목 표시
if (!item.roles.includes(user.role)) return false
```

- [ ] **Step 6: TypeScript 확인**

```bash
cd football && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add football/src/layouts/AppShell.tsx
git commit -m "feat(super-admin): add team switcher dropdown in AppShell sidebar"
```

---

### Task 11: PR 생성 및 머지

**Files:** 없음 (git 작업만)

- [ ] **Step 1: 브랜치 push**

```bash
git push -u origin feat/super-admin
```

- [ ] **Step 2: PR 생성**

```bash
gh pr create \
  --title "feat(super-admin): SUPER_ADMIN 전사 계정 구현" \
  --body "## Summary
- Prisma Role enum에 SUPER_ADMIN 추가
- 공통 authMiddleware: X-Team-Id 헤더를 req.user.teamId로 주입
- 44개 routes 파일 → 공통 authMiddleware 사용
- FE: localStorage 기반 팀 선택, X-Team-Id 헤더 자동 주입
- 사이드바 팀 전환 드롭다운 (SUPER_ADMIN 전용)
- 팀 미선택 시 /team-select 강제 리디렉트

## Test plan
- [ ] SUPER_ADMIN 계정 생성 후 로그인 → /team-select 리디렉트 확인
- [ ] 팀 선택 후 대시보드 진입 → 해당 팀 데이터 표시 확인
- [ ] 사이드바 드롭다운으로 팀 전환 → reload 후 새 팀 데이터 확인
- [ ] 일반 ADMIN/FRONT_OFFICE 계정은 /team-select 미노출 확인
- [ ] GET /teams: SUPER_ADMIN은 전체 팀 조회 가능 확인"
```

- [ ] **Step 3: 머지**

PR 검토 후 머지

---

## 구현 후 주의사항

**write 권한이 필요한 컨트롤러:** 데이터 읽기(GET)는 `req.user.teamId` 주입으로 자동 처리된다. 쓰기(POST/PATCH/DELETE) 중 `role === 'ADMIN'` 만 체크하는 곳은 `|| role === 'SUPER_ADMIN'`을 추가해야 한다. 필요 시 `isSuperAdmin(req.user!)` 유틸을 임포트해서 사용한다.

```typescript
// 패턴 예시
import { isSuperAdmin } from "../lib/permissions";

// 기존
if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");

// 변경 후
if (req.user!.role !== "ADMIN" && !isSuperAdmin(req.user!)) throw new AppError(403, "FORBIDDEN");
```
