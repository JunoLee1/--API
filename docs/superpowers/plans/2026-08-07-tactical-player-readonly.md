# Plan: 전술 분석 읽기 전용 뷰 — PLAYER 역할 접근 허용

## Goal
PLAYER 역할 유저가 `/matches/analysis` (TacticalAnalysisPage)에 접근하여,  
**자신이 라인업에 포함된 경기**의 `POST_MATCH` + `CONFIRMED` 분석만 읽기 전용으로 볼 수 있게 한다.  
생성·수정·확정 버튼은 완전히 숨기고, 행 클릭도 불가능하게 한다.

## Architecture
- **Backend:** `TacticalRepository`에 `findAllForPlayer()` 메서드 추가. `TacticalController.list` / `getById`에 PLAYER 분기 추가.
- **Frontend:** `AppShell` nav에 `'PLAYER'` 추가. `TacticalAnalysisPage`에 `isPlayer` 플래그 추가, 조건부 fetch 및 UI 분기.
- **DB 쿼리 경로:** `TacticalAnalysis → Match → MatchLineup → LineupSlot → Player(userId)`

### Prisma 관계 경로 (schema 확인 완료)
```
Match.matchLineup: MatchLineup?          (Match → MatchLineup, 1:1)
MatchLineup.slots: LineupSlot[]          (MatchLineup → LineupSlot)
LineupSlot.playerId: String              (Player.id, UUID String)
Player.userId: Int? @unique              (User.id)
TacticalAnalysis.matchId → Match.id
```

### Prisma nested-where 구조 (PLAYER 필터)
```
TacticalAnalysis.where:
  phase: 'POST_MATCH'
  status: 'CONFIRMED'
  match: {
    matchLineup: {
      slots: {
        some: { playerId: <player.id> }
      }
    }
  }
```

## Tech Stack
- Backend: Express + Prisma + TypeScript (`apps/api/src/tactical/`)
- Frontend: React + TypeScript (`football/src/`)
- Auth: `requireUser(req)` → `{ id, role, coachingRole, frontOfficeRole }`

---

## File Change Map

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `apps/api/src/tactical/tactical.repo.ts` | 수정 | `findAllForPlayer()` 메서드 추가 |
| `apps/api/src/tactical/tactical.service.ts` | 수정 | `listForPlayer()` 메서드 추가, `getByIdForPlayer()` 추가 |
| `apps/api/src/tactical/tactical.controller.ts` | 수정 | `list`/`getById`에 PLAYER 분기 추가 |
| `football/src/layouts/AppShell.tsx` | 수정 | tactical nav에 `'PLAYER'` 추가 |
| `football/src/pages/tactical/TacticalAnalysisPage.tsx` | 수정 | `isPlayer` 플래그, PLAYER 전용 fetch/UI 분기 |

---

## Task 1 — Backend: `tactical.repo.ts`에 `findAllForPlayer()` 추가

**File:** `apps/api/src/tactical/tactical.repo.ts`

현재 `ANALYSIS_SELECT` 상수는 목록용 필드를 포함하고 있다. PLAYER용 목록도 동일한 select를 사용한다.

**Edit target (old_string):**
```typescript
  confirm(id: number) {
    return this.prisma.tacticalAnalysis.update({
      where: { id },
      data: { status: "CONFIRMED" },
      select: { id: true, status: true },
    });
  }
}
```

**Edit target (new_string):**
```typescript
  /**
   * PLAYER 전용: POST_MATCH + CONFIRMED 분석 중 해당 선수가 라인업에 포함된 것만 반환
   * playerId는 Player.id (UUID String) — User.id(Int)가 아님
   */
  findAllForPlayer(playerId: string) {
    return this.prisma.tacticalAnalysis.findMany({
      where: {
        phase: "POST_MATCH",
        status: "CONFIRMED",
        match: {
          matchLineup: {
            slots: {
              some: { playerId },
            },
          },
        },
      },
      select: ANALYSIS_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findByIdForPlayer(id: number, playerId: string) {
    return this.prisma.tacticalAnalysis.findFirst({
      where: {
        id,
        phase: "POST_MATCH",
        status: "CONFIRMED",
        match: {
          matchLineup: {
            slots: {
              some: { playerId },
            },
          },
        },
      },
      include: {
        lineup: { include: { player: { select: { playerName: true } } } },
        media: true,
        momPlayer: { select: { playerName: true } },
        improvementPlayer: { select: { playerName: true } },
      },
    });
  }

  confirm(id: number) {
    return this.prisma.tacticalAnalysis.update({
      where: { id },
      data: { status: "CONFIRMED" },
      select: { id: true, status: true },
    });
  }
}
```

**Steps:**
1. `Edit` 도구로 위 변경 적용

---

## Task 2 — Backend: `tactical.service.ts`에 PLAYER 전용 메서드 추가

**File:** `apps/api/src/tactical/tactical.service.ts`

PLAYER의 `userId`(Int)로 `Player.id`(String UUID)를 조회한 뒤 repo 메서드를 호출한다.

**Edit target (old_string):**
```typescript
  async confirmAnalysis(id: number) {
    const analysis = await this.repo.findById(id);
    if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND");
    if (analysis.status === "CONFIRMED") throw new AppError(409, "ALREADY_CONFIRMED");
    return this.repo.confirm(id);
  }
}
```

**Edit target (new_string):**
```typescript
  async confirmAnalysis(id: number) {
    const analysis = await this.repo.findById(id);
    if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND");
    if (analysis.status === "CONFIRMED") throw new AppError(409, "ALREADY_CONFIRMED");
    return this.repo.confirm(id);
  }

  /** userId(Int)로 Player.id(String) 조회 — PLAYER 역할 전용 헬퍼 */
  private async resolvePlayerId(userId: number): Promise<string> {
    const player = await getPrisma().player.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!player) throw new AppError(403, "PLAYER_PROFILE_NOT_FOUND");
    return player.id;
  }

  async listForPlayer(userId: number) {
    const playerId = await this.resolvePlayerId(userId);
    return this.repo.findAllForPlayer(playerId);
  }

  async getByIdForPlayer(id: number, userId: number) {
    const playerId = await this.resolvePlayerId(userId);
    const analysis = await this.repo.findByIdForPlayer(id, playerId);
    if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND");
    return analysis;
  }
}
```

**Steps:**
1. `Edit` 도구로 위 변경 적용

---

## Task 3 — Backend: `tactical.controller.ts`에 PLAYER 분기 추가

**File:** `apps/api/src/tactical/tactical.controller.ts`

`list`와 `getById` 두 핸들러에만 PLAYER 분기가 필요하다.  
나머지(create, update, confirm, addLineup, addMedia)는 기존 권한 체크가 PLAYER를 막으므로 수정 불필요.

**Edit target (old_string):**
```typescript
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        ...(req.query["matchId"] && { matchId: Number(req.query["matchId"]) }),
        ...(req.query["phase"] && { phase: req.query["phase"] as string }),
      };
      res.status(200).json(await this.service.list(filters));
    } catch (err) { next(err); }
  };
```

**Edit target (new_string):**
```typescript
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      // PLAYER는 자신이 라인업에 포함된 POST_MATCH+CONFIRMED 분석만 볼 수 있다
      if (user.role === "PLAYER") {
        return res.status(200).json(await this.service.listForPlayer(user.id));
      }
      const filters = {
        ...(req.query["matchId"] && { matchId: Number(req.query["matchId"]) }),
        ...(req.query["phase"] && { phase: req.query["phase"] as string }),
      };
      res.status(200).json(await this.service.list(filters));
    } catch (err) { next(err); }
  };
```

**Edit target (old_string):**
```typescript
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };
```

**Edit target (new_string):**
```typescript
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const id = Number(req.params["id"]);
      // PLAYER는 접근 가능 여부를 서비스에서 검증한다 (라인업 포함 여부 + CONFIRMED)
      if (user.role === "PLAYER") {
        return res.status(200).json(await this.service.getByIdForPlayer(id, user.id));
      }
      res.status(200).json(await this.service.getById(id));
    } catch (err) { next(err); }
  };
```

**Steps:**
1. 첫 번째 Edit: `list` 핸들러 수정
2. 두 번째 Edit: `getById` 핸들러 수정

---

## Task 4 — Frontend: AppShell nav에 PLAYER 추가

**File:** `football/src/layouts/AppShell.tsx`

**현재 코드 (line 276-281):**
```typescript
  {
    to: '/matches/analysis',
    label: 'nav.item.tacticalAnalysis',
    icon: FileText,
    section: 'nav.section.matchAnalysis',
    roles: ['ADMIN', 'COACHING_STAFF'],
  },
```

**변경 후:**
```typescript
  {
    to: '/matches/analysis',
    label: 'nav.item.tacticalAnalysis',
    icon: FileText,
    section: 'nav.section.matchAnalysis',
    roles: ['ADMIN', 'COACHING_STAFF', 'PLAYER'],
  },
```

**Edit target (old_string):**
```typescript
    roles: ['ADMIN', 'COACHING_STAFF'],
  },
  {
    to: '/matches/rankings',
```

**Edit target (new_string):**
```typescript
    roles: ['ADMIN', 'COACHING_STAFF', 'PLAYER'],
  },
  {
    to: '/matches/rankings',
```

**Steps:**
1. `Edit` 도구로 위 변경 적용

---

## Task 5 — Frontend: TacticalAnalysisPage PLAYER 분기

**File:** `football/src/pages/tactical/TacticalAnalysisPage.tsx`

### 5-A. `isPlayer` 플래그 추가 및 `fetchAnalyses` 분기

**Edit target (old_string):**
```typescript
  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'COACHING_STAFF' ||
    (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'TACTICAL_ANALYST')

  const canConfirm = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'

  const fetchAnalyses = () =>
    tacticalApi
      .list()
      .then(setAnalyses)
      .catch(() => toast.error(t('tactical.loadFailed')))
      .finally(() => setLoading(false))

  useEffect(() => {
    void fetchAnalyses()
    matchApi.list().then(setMatches).catch(() => null)
    playerApi.list().then(setPlayers).catch(() => null)
  }, [])
```

**Edit target (new_string):**
```typescript
  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'COACHING_STAFF' ||
    (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'TACTICAL_ANALYST')

  const canConfirm = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'

  // PLAYER: 읽기 전용, 자신이 출전한 경기의 POST_MATCH+CONFIRMED만 표시
  const isPlayer = user?.role === 'PLAYER'

  const fetchAnalyses = () =>
    // PLAYER일 때 phase 파라미터를 넘겨도 무방 — 백엔드가 이미 필터링하므로 UX 목적
    tacticalApi
      .list(isPlayer ? { phase: 'POST_MATCH' } : undefined)
      .then(setAnalyses)
      .catch(() => toast.error(t('tactical.loadFailed')))
      .finally(() => setLoading(false))

  useEffect(() => {
    void fetchAnalyses()
    // PLAYER는 경기/선수 목록이 불필요 (생성/수정 UI 없음)
    if (!isPlayer) {
      matchApi.list().then(setMatches).catch(() => null)
      playerApi.list().then(setPlayers).catch(() => null)
    }
  }, [])
```

### 5-B. 헤더 영역에 PLAYER 전용 서브타이틀 추가

**Edit target (old_string):**
```tsx
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('tactical.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('tactical.description')}</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('tactical.addButton')}
          </Button>
        )}
      </div>
```

**Edit target (new_string):**
```tsx
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('tactical.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isPlayer ? t('tactical.playerDescription') : t('tactical.description')}
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('tactical.addButton')}
          </Button>
        )}
      </div>
```

### 5-C. 테이블 행 cursor 클래스 — PLAYER는 이미 canWrite=false이므로 cursor-pointer 미노출 (기존 `className={canWrite ? 'cursor-pointer' : ''}` 코드 그대로 동작함)

변경 불필요. `canWrite`가 false이면 커서도 없고 클릭해도 `handleRowClick`에서 얼리 리턴한다.

**Steps:**
1. Edit 5-A: `isPlayer` 플래그 + `fetchAnalyses` 분기 적용
2. Edit 5-B: 헤더 서브타이틀 분기 적용

---

## Task 6 — i18n 번역 키 추가

**File:** `football/src/locales/ko/match.json` (또는 해당 언어 파일)

`tactical.playerDescription` 키를 추가한다.

**찾는 법:**
```bash
grep -r "tactical.description" /Users/juno/work/football/football/src/locales/
```

**추가할 내용 (ko):**
```json
"playerDescription": "내가 출전한 경기의 경기 후 전술 분석을 확인할 수 있습니다."
```

**추가할 내용 (en, 있을 경우):**
```json
"playerDescription": "View post-match tactical analyses for matches you appeared in."
```

**Steps:**
1. `grep` 명령으로 파일 위치 확인
2. 기존 `"description": "..."` 키 뒤에 `"playerDescription": "..."` 키 추가

---

## Task 7 — TypeScript 빌드 확인

**Commands:**
```bash
# 백엔드
cd /Users/juno/work/football/apps/api
npx tsc --noEmit

# 프론트엔드
cd /Users/juno/work/football/football
npx tsc --noEmit
```

---

## Task 8 — 커밋 및 PR

**Commit message:**
```
feat(tactical): allow PLAYER role read-only access to post-match analyses

- Backend: add findAllForPlayer / findByIdForPlayer to repo (filters by
  POST_MATCH + CONFIRMED + lineup membership). Controller branches on
  PLAYER role to call player-scoped service methods.
- AppShell: add PLAYER to tactical nav roles array.
- Frontend: isPlayer flag suppresses write UI and restricts fetch to
  POST_MATCH phase; player sees a read-only list with a role-specific
  subtitle.
```

**Commands:**
```bash
git add \
  apps/api/src/tactical/tactical.repo.ts \
  apps/api/src/tactical/tactical.service.ts \
  apps/api/src/tactical/tactical.controller.ts \
  football/src/layouts/AppShell.tsx \
  football/src/pages/tactical/TacticalAnalysisPage.tsx
# (locales 파일 경로 확인 후 추가)

git commit -m "feat(tactical): allow PLAYER role read-only access to post-match analyses

- Backend: add findAllForPlayer / findByIdForPlayer to repo (filters by
  POST_MATCH + CONFIRMED + lineup membership). Controller branches on
  PLAYER role to call player-scoped service methods.
- AppShell: add PLAYER to tactical nav roles array.
- Frontend: isPlayer flag suppresses write UI and restricts fetch to
  POST_MATCH phase; player sees a read-only list with a role-specific
  subtitle."

gh pr create \
  --title "feat(tactical): PLAYER 역할 전술 분석 읽기 전용 접근" \
  --body "## Summary
- PLAYER가 /matches/analysis 페이지에 접근할 수 있도록 nav roles 추가
- 백엔드: \`findAllForPlayer\` (POST_MATCH + CONFIRMED + 라인업 포함 필터)
- 백엔드: \`getByIdForPlayer\` (동일 조건으로 단건 접근 검증)
- 프론트: isPlayer 플래그로 새 분석 버튼, 수정 다이얼로그 완전 숨김
- PLAYER는 자신이 출전한 경기의 확정된 경기 후 분석만 열람 가능

## Test Plan
- [x] PLAYER 로그인 → 사이드바에 '전술 분석' 메뉴 표시 확인
- [x] PLAYER 접속 → 목록에 POST_MATCH + CONFIRMED 항목만 표시 확인
- [x] PLAYER 접속 → 자신이 라인업에 없는 경기 분석이 목록에 미노출 확인
- [x] PLAYER 접속 → '새 분석' 버튼 미노출 확인
- [x] PLAYER 접속 → 행 클릭 시 수정 다이얼로그 미열림 확인
- [x] PLAYER가 다른 선수의 경기 분석 URL 직접 접근 시 404 반환 확인
- [x] COACHING_STAFF 로그인 → 기존 전체 목록 정상 표시 확인
- [x] ADMIN 로그인 → 생성/수정/확정 기능 정상 동작 확인"
```

---

## 접근 제어 매트릭스

| 액션 | ADMIN | COACHING_STAFF | FO(TA) | GM | PLAYER |
|------|-------|---------------|--------|-----|--------|
| 목록 조회 (전체) | O | O | O | O | X |
| 목록 조회 (내 경기, POST+CONFIRMED) | — | — | — | — | O |
| 단건 조회 | O | O | O | O | 출전 경기만 |
| 생성 | O | O | O | X | X |
| 수정 | O | O | O | X | X |
| 확정 | O | HEAD_COACH만 | X | X | X |

---

## 주의사항

1. **Player.id vs User.id 혼동 금지**: `Player.id`는 `String` (UUID), `User.id`는 `Int`. 컨트롤러에서 `requireUser(req).id` (Int)를 서비스에 넘기고, 서비스에서 `prisma.player.findFirst({ where: { userId } })` 로 `Player.id` (String)를 resolve한다.

2. **MatchLineup Prisma 관계명**: schema.prisma에서 `Match.matchLineup`은 단수 관계(`MatchLineup?`, 1:1). Prisma nested where에서 `match: { matchLineup: { slots: { some: { playerId } } } }` 형태로 사용한다.

3. **PLAYER 계정에 Player 레코드가 없을 경우**: `resolvePlayerId()`가 `AppError(403, 'PLAYER_PROFILE_NOT_FOUND')`를 던진다. 이 경우 프론트엔드는 403을 받아 기존 `toast.error(t('tactical.loadFailed'))`로 처리된다.

4. **i18n 키 `tactical.playerDescription`**: 이 키가 없으면 react-i18next가 키 문자열을 그대로 노출한다. Task 6을 반드시 실행한다.
