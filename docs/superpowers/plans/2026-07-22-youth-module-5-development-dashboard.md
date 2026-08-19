# 유소년 모듈 Plan 5: 육성 모니터링 대시보드

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** TD/ADMIN 대시보드에 유소년 팀별 Position Diversity Index(PDI) 현황 섹션을 추가한다. 팀별 평균 PDI를 조회하고, 단일 포지션 출전 비율이 80% 이상인 선수를 편중 경보로 표시한다.

**Architecture:** BE에 `GET /dashboard/youth-development` 엔드포인트를 추가해 YOUTH 팀별 선수 PDI 집계 데이터를 반환한다. Plan 2의 `GET /players/:id/position-diversity`와 동일한 LineupSlot + PlayerMatchStats.minutesPlayed 집계이지만, 팀 전체를 한 번에 조회한다. FE는 DashboardPage에 조건부 렌더(role=TD or ADMIN) `YouthDevelopmentSection` 컴포넌트를 추가한다. 80% 이상 편중 선수는 빨간 배지로 하이라이트.

**Tech Stack:** Prisma `$queryRaw` (cross-table 집계), React + Tailwind (FE 테이블)

**의존성:** Plan 1 완료 후 실행 (GUARDIAN/YouthRegistration 스키마 필요 없음. TeamType.YOUTH는 이미 schema.prisma에 존재).

---

## 파일 맵

### BE — 수정
- `apps/api/src/dashboard/dashboard.repo.ts` — `getYouthDevelopmentStats()` 메서드 추가
- `apps/api/src/dashboard/dashboard.service.ts` — TD/ADMIN 케이스에 `youthDevelopment` 포함
- `apps/api/src/dashboard/dashboard.routes.ts` — `GET /youth-development` 엔드포인트 추가

### BE — 테스트
- `apps/api/__test__/dashboard/dashboard.youth.test.ts`

### FE — 수정
- `football/src/types/dashboard.ts` — `YouthDevelopmentStats`, `PlayerPdiEntry`, `TeamPdiSummary` 타입 추가; `TdStats` + `AdminStats` 확장
- `football/src/services/dashboard.service.ts` — `youthDevelopment()` API 호출 추가
- `football/src/pages/dashboard/DashboardPage.tsx` — TD/ADMIN에 `YouthDevelopmentSection` 추가
- `football/src/pages/dashboard/dashboardConfig.ts` — `showYouthDevelopment` flag 추가

### FE — 신규
- `football/src/components/dashboard/YouthDevelopmentSection.tsx`

---

## Task 1: BE — `getYouthDevelopmentStats()` 구현

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.repo.ts`

- [x] **Step 1: 현재 dashboard.repo.ts 임포트/구조 확인**

```bash
head -20 apps/api/src/dashboard/dashboard.repo.ts
grep -n "import\|constructor\|prisma" apps/api/src/dashboard/dashboard.repo.ts | head -10
```

- [x] **Step 2: `getYouthDevelopmentStats` 메서드 추가**

`dashboard.repo.ts`의 마지막 메서드 뒤에 추가:

```typescript
async getYouthDevelopmentStats() {
  // YOUTH 팀 소속 선수별 포지션별 출전 분수 집계
  const rows = await this.prisma.$queryRaw<
    Array<{
      playerId: number
      playerName: string
      teamId: number
      teamName: string
      slotKey: string
      totalMinutes: number
    }>
  >`
    SELECT
      p.id                    AS "playerId",
      p.name                  AS "playerName",
      t.id                    AS "teamId",
      t.name                  AS "teamName",
      ls."slotKey"            AS "slotKey",
      COALESCE(SUM(pms."minutesPlayed"), 0)::int AS "totalMinutes"
    FROM "Player" p
    JOIN "Team" t ON t.id = p."teamId"
    LEFT JOIN "MatchSquad" ms ON ms."playerId" = p.id
    LEFT JOIN "Match" m ON m.id = ms."matchId"
    LEFT JOIN "MatchLineup" ml ON ml."matchId" = m.id AND ml."teamId" = t.id
    LEFT JOIN "LineupSlot" ls ON ls."lineupId" = ml.id AND ls."playerId" = p.id
    LEFT JOIN "PlayerMatchStats" pms ON pms."matchId" = m.id AND pms."playerId" = p.id
    WHERE t.type = 'YOUTH'
      AND ls."slotKey" IS NOT NULL
      AND pms."minutesPlayed" IS NOT NULL
      AND pms."minutesPlayed" > 0
    GROUP BY p.id, p.name, t.id, t.name, ls."slotKey"
    ORDER BY t.id, p.id
  `;

  // 선수별 집계
  const byPlayer = new Map<
    number,
    {
      playerId: number;
      playerName: string;
      teamId: number;
      teamName: string;
      slots: Map<string, number>;
      totalMinutes: number;
    }
  >();

  for (const row of rows) {
    if (!byPlayer.has(row.playerId)) {
      byPlayer.set(row.playerId, {
        playerId: row.playerId,
        playerName: row.playerName,
        teamId: row.teamId,
        teamName: row.teamName,
        slots: new Map(),
        totalMinutes: 0,
      });
    }
    const entry = byPlayer.get(row.playerId)!;
    entry.slots.set(row.slotKey, row.totalMinutes);
    entry.totalMinutes += row.totalMinutes;
  }

  // PlayerPdiEntry 빌드
  const players = Array.from(byPlayer.values()).map((entry) => {
    const slotDistribution: Record<string, number> = {};
    let maxPct = 0;
    let biasedSlot: string | null = null;

    for (const [slot, minutes] of entry.slots.entries()) {
      const pct = entry.totalMinutes > 0 ? minutes / entry.totalMinutes : 0;
      slotDistribution[slot] = Math.round(pct * 100);
      if (pct > maxPct) {
        maxPct = pct;
        biasedSlot = slot;
      }
    }

    return {
      playerId: entry.playerId,
      playerName: entry.playerName,
      teamId: entry.teamId,
      teamName: entry.teamName,
      totalMinutes: entry.totalMinutes,
      slotDistribution,
      biasedSlot,
      biasedPct: Math.round(maxPct * 100),
      isBiased: maxPct >= 0.8,
    };
  });

  // 팀별 요약
  const byTeam = new Map<
    number,
    { teamId: number; teamName: string; players: typeof players }
  >();
  for (const p of players) {
    if (!byTeam.has(p.teamId)) {
      byTeam.set(p.teamId, {
        teamId: p.teamId,
        teamName: p.teamName,
        players: [],
      });
    }
    byTeam.get(p.teamId)!.players.push(p);
  }

  const teams = Array.from(byTeam.values()).map((t) => ({
    teamId: t.teamId,
    teamName: t.teamName,
    playerCount: t.players.length,
    biasedPlayerCount: t.players.filter((p) => p.isBiased).length,
    players: t.players,
  }));

  return { teams };
}
```

- [x] **Step 3: 타입스크립트 오류 없음 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -A2 "dashboard.repo" | head -20
```

- [x] **Step 4: Commit**

```bash
git add apps/api/src/dashboard/dashboard.repo.ts
git commit -m "feat(dashboard): YOUTH 팀별 PDI 집계 쿼리 추가"
```

---

## Task 2: BE — Service + Routes 연결

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.service.ts`
- Modify: `apps/api/src/dashboard/dashboard.routes.ts`

- [x] **Step 1: dashboard.service.ts 현재 구조 확인**

```bash
grep -n "getStats\|case\|TD\|ADMIN\|getTd\|getAdmin" apps/api/src/dashboard/dashboard.service.ts
```

- [x] **Step 2: dashboard.service.ts에 `getYouthDevelopmentStats` 위임 메서드 추가**

`DashboardService` 클래스에 메서드 추가:

```typescript
getYouthDevelopmentStats() {
  return this.repo.getYouthDevelopmentStats();
}
```

- [x] **Step 3: dashboard.routes.ts 현재 구조 확인**

```bash
cat apps/api/src/dashboard/dashboard.routes.ts
```

- [x] **Step 4: dashboard.routes.ts에 엔드포인트 추가**

기존 라우트 파일에서 `/stats` 라우트 패턴을 따라 추가. 아래는 일반적인 패턴:

```typescript
// GET /dashboard/youth-development  (TD, ADMIN 전용)
.get('/youth-development', authMiddleware, async (c) => {
  const user = c.get('user')
  if (
    !(user.role === 'ADMIN' ||
      (user.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'TD'))
  ) {
    return c.json({ message: 'Forbidden' }, 403)
  }
  const data = await service.getYouthDevelopmentStats()
  return c.json(data)
})
```

실제 미들웨어 이름과 `c.get('user')` 패턴은 기존 라우트 파일 참고.

- [x] **Step 5: 타입스크립트 오류 없음 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -A2 "dashboard" | head -20
```

- [x] **Step 6: Commit**

```bash
git add apps/api/src/dashboard/dashboard.service.ts apps/api/src/dashboard/dashboard.routes.ts
git commit -m "feat(dashboard): youth-development 엔드포인트 추가 (TD/ADMIN 전용)"
```

---

## Task 3: BE — 테스트

**Files:**
- Create: `apps/api/__test__/dashboard/dashboard.youth.test.ts`

- [x] **Step 1: 기존 dashboard 테스트 패턴 확인**

```bash
ls apps/api/__test__/dashboard/ 2>/dev/null || ls apps/api/__test__/ | head -10
```

- [x] **Step 2: 테스트 파일 작성**

```typescript
// apps/api/__test__/dashboard/dashboard.youth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '../generated/client'
import { DashboardRepository } from '../../src/dashboard/dashboard.repo'

const prisma = new PrismaClient()
const repo = new DashboardRepository(prisma)

// 테스트 데이터 ID 추적
let youthTeamId: number
let player1Id: number
let player2Id: number
let matchId: number

beforeAll(async () => {
  // 최소 필요 데이터 삽입
  const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } })
    ?? await prisma.season.create({
      data: { name: 'Test Season 2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'ACTIVE' }
    })

  const youthTeam = await prisma.team.create({
    data: { name: 'YOUTH A Test', type: 'YOUTH', seasonId: season.id }
  })
  youthTeamId = youthTeam.id

  const [p1, p2] = await Promise.all([
    prisma.player.create({ data: { name: 'YouthPlayer1', position: 'STRIKER', teamId: youthTeamId } }),
    prisma.player.create({ data: { name: 'YouthPlayer2', position: 'GOALKEEPER', teamId: youthTeamId } }),
  ])
  player1Id = p1.id
  player2Id = p2.id

  // 매치 + 라인업 + 통계 생성
  const match = await prisma.match.create({
    data: {
      date: new Date('2026-07-01'),
      homeTeamId: youthTeamId,
      awayTeamId: youthTeamId,
      homeTeamName: 'YOUTH A Test',
      awayTeamName: 'Opponent',
      competitionType: 'FRIENDLY',
      status: 'FINISHED',
    }
  })
  matchId = match.id

  const lineup = await prisma.matchLineup.create({
    data: { matchId: match.id, teamId: youthTeamId, formation: '4-3-3' }
  })

  await Promise.all([
    prisma.lineupSlot.create({ data: { lineupId: lineup.id, playerId: player1Id, slotKey: 'ST', position: 1 } }),
    prisma.lineupSlot.create({ data: { lineupId: lineup.id, playerId: player2Id, slotKey: 'GK', position: 0 } }),
  ])

  // player1: ST 90분 (80%+) → biased
  await prisma.playerMatchStats.createMany({
    data: [
      { matchId: match.id, playerId: player1Id, minutesPlayed: 90 },
      { matchId: match.id, playerId: player2Id, minutesPlayed: 90 },
    ]
  })
})

afterAll(async () => {
  await prisma.playerMatchStats.deleteMany({ where: { matchId } })
  await prisma.lineupSlot.deleteMany({ where: { lineup: { matchId } } })
  await prisma.matchLineup.deleteMany({ where: { matchId } })
  await prisma.match.deleteMany({ where: { id: matchId } })
  await prisma.player.deleteMany({ where: { id: { in: [player1Id, player2Id] } } })
  await prisma.team.deleteMany({ where: { id: youthTeamId } })
  await prisma.$disconnect()
})

describe('DashboardRepository.getYouthDevelopmentStats', () => {
  it('YOUTH 팀 목록을 반환한다', async () => {
    const result = await repo.getYouthDevelopmentStats()
    expect(result.teams.length).toBeGreaterThan(0)
  })

  it('생성한 YOUTH 팀이 결과에 포함된다', async () => {
    const result = await repo.getYouthDevelopmentStats()
    const team = result.teams.find((t) => t.teamId === youthTeamId)
    expect(team).toBeDefined()
    expect(team!.playerCount).toBe(2)
  })

  it('player1 (90분 ST) isBiased=true 이다', async () => {
    const result = await repo.getYouthDevelopmentStats()
    const team = result.teams.find((t) => t.teamId === youthTeamId)!
    const p1 = team.players.find((p) => p.playerId === player1Id)!
    expect(p1.isBiased).toBe(true)
    expect(p1.biasedPct).toBe(100)
    expect(p1.biasedSlot).toBe('ST')
  })

  it('biasedPlayerCount는 isBiased 선수 수와 일치한다', async () => {
    const result = await repo.getYouthDevelopmentStats()
    const team = result.teams.find((t) => t.teamId === youthTeamId)!
    const actualBiased = team.players.filter((p) => p.isBiased).length
    expect(team.biasedPlayerCount).toBe(actualBiased)
  })
})
```

- [x] **Step 3: 테스트 실행**

```bash
cd apps/api && npx vitest run __test__/dashboard/dashboard.youth.test.ts 2>&1
```

Expected: 4 tests PASS

- [x] **Step 4: Commit**

```bash
git add apps/api/__test__/dashboard/dashboard.youth.test.ts
git commit -m "test(dashboard): YOUTH PDI 집계 통합 테스트"
```

---

## Task 4: FE — 타입 + API 서비스

**Files:**
- Modify: `football/src/types/dashboard.ts`
- Modify: `football/src/services/dashboard.service.ts`

- [x] **Step 1: 현재 dashboard.service.ts(FE) 확인**

```bash
cat football/src/services/dashboard.service.ts
```

- [x] **Step 2: `football/src/types/dashboard.ts`에 타입 추가**

기존 파일 맨 아래에 추가:

```typescript
export interface PlayerPdiEntry {
  playerId: number
  playerName: string
  teamId: number
  teamName: string
  totalMinutes: number
  slotDistribution: Record<string, number>  // slotKey → percentage (0-100)
  biasedSlot: string | null
  biasedPct: number
  isBiased: boolean
}

export interface TeamPdiSummary {
  teamId: number
  teamName: string
  playerCount: number
  biasedPlayerCount: number
  players: PlayerPdiEntry[]
}

export interface YouthDevelopmentStats {
  teams: TeamPdiSummary[]
}
```

- [x] **Step 3: TdStats, AdminStats에 `youthDevelopment` 선택 필드 추가**

기존 `TdStats` 인터페이스에 필드 추가:

```typescript
export interface TdStats {
  activeTransferCount: number
  prospectCount: number
  injuredPlayerCount: number
  youthDevelopment?: YouthDevelopmentStats
}
```

기존 `AdminStats` 인터페이스에 필드 추가:

```typescript
// AdminStats 찾아서 youthDevelopment?: YouthDevelopmentStats 추가
```

실제 `AdminStats` 정의를 먼저 확인:
```bash
grep -n "AdminStats" football/src/types/dashboard.ts | head -5
```

- [x] **Step 4: `football/src/services/dashboard.service.ts`에 `youthDevelopment()` 메서드 추가**

```typescript
youthDevelopment(): Promise<YouthDevelopmentStats> {
  return apiClient.get('/dashboard/youth-development')
}
```

`apiClient` import와 반환 패턴은 기존 `stats()` 메서드를 참고.

- [x] **Step 5: 타입스크립트 체크**

```bash
cd football && npx tsc --noEmit 2>&1 | grep -A2 "dashboard" | head -20
```

- [x] **Step 6: Commit**

```bash
git add football/src/types/dashboard.ts football/src/services/dashboard.service.ts
git commit -m "feat(dashboard): YouthDevelopmentStats FE 타입 + API 서비스"
```

---

## Task 5: FE — YouthDevelopmentSection 컴포넌트

**Files:**
- Create: `football/src/components/dashboard/YouthDevelopmentSection.tsx`

- [x] **Step 1: 기존 대시보드 컴포넌트 구조 참고**

```bash
ls football/src/components/dashboard/
cat football/src/components/dashboard/MedicalSection.tsx | head -40
```

- [x] **Step 2: 컴포넌트 작성**

```typescript
// football/src/components/dashboard/YouthDevelopmentSection.tsx
import type { YouthDevelopmentStats } from '@/types/dashboard'

interface Props {
  data: YouthDevelopmentStats
}

export function YouthDevelopmentSection({ data }: Props) {
  if (data.teams.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        유소년 팀 경기 데이터가 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">유소년 포지션 편중 현황</h3>
      {data.teams.map((team) => (
        <div key={team.teamId} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{team.teamName}</span>
            <span className="text-sm text-muted-foreground">
              {team.playerCount}명 중{' '}
              <span className={team.biasedPlayerCount > 0 ? 'text-red-500 font-semibold' : ''}>
                {team.biasedPlayerCount}명 편중
              </span>
            </span>
          </div>
          {team.players.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b">
                  <th className="text-left py-1 font-normal">선수</th>
                  <th className="text-right py-1 font-normal">주 포지션</th>
                  <th className="text-right py-1 font-normal">편중도</th>
                  <th className="text-right py-1 font-normal">총 출전</th>
                </tr>
              </thead>
              <tbody>
                {team.players.map((player) => (
                  <tr key={player.playerId} className="border-b last:border-0">
                    <td className="py-1.5">{player.playerName}</td>
                    <td className="text-right py-1.5 text-muted-foreground">
                      {player.biasedSlot ?? '—'}
                    </td>
                    <td className="text-right py-1.5">
                      {player.isBiased ? (
                        <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
                          {player.biasedPct}%
                          <span className="text-xs">⚠</span>
                        </span>
                      ) : (
                        <span>{player.biasedPct}%</span>
                      )}
                    </td>
                    <td className="text-right py-1.5 text-muted-foreground">
                      {player.totalMinutes}분
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [x] **Step 3: 타입스크립트 체크**

```bash
cd football && npx tsc --noEmit 2>&1 | grep -A2 "YouthDevelopment" | head -20
```

- [x] **Step 4: Commit**

```bash
git add football/src/components/dashboard/YouthDevelopmentSection.tsx
git commit -m "feat(dashboard): YouthDevelopmentSection 컴포넌트 추가"
```

---

## Task 6: FE — DashboardPage + dashboardConfig 통합

**Files:**
- Modify: `football/src/pages/dashboard/dashboardConfig.ts`
- Modify: `football/src/pages/dashboard/DashboardPage.tsx`

- [x] **Step 1: dashboardConfig.ts에 `showYouthDevelopment` 추가**

`DashboardConfig` 인터페이스에 필드 추가:

```typescript
export interface DashboardConfig {
  statCards: StatCardConfig[]
  showActionQueue: boolean
  showSchedule: boolean
  showRanking: boolean
  recentFeedTitle?: string
  showMedicalSection: boolean
  showYouthDevelopment: boolean  // TD, ADMIN 전용
}
```

TD 설정 블록에 `showYouthDevelopment: true` 추가:

```typescript
if (frontOfficeRole === 'TD') {
  return {
    statCards: [
      { label: '진행 중 이적', getValue: (s) => (s as TdStats).activeTransferCount, unit: '건' },
      { label: '등록된 Prospect', getValue: (s) => (s as TdStats).prospectCount, unit: '명' },
      { label: '부상 선수', getValue: (s) => (s as TdStats).injuredPlayerCount, unit: '명' },
    ],
    showActionQueue: true,
    showSchedule: true,
    recentFeedTitle: '최근 Prospect',
    showRanking: false,
    showMedicalSection: false,
    showYouthDevelopment: true,
  }
}
```

ADMIN 설정 블록에 `showYouthDevelopment: true` 추가:

```typescript
if (role === 'ADMIN') {
  return {
    // ...기존 설정 유지...
    showYouthDevelopment: true,
  }
}
```

나머지 모든 role 블록에 `showYouthDevelopment: false` 추가 (각 return 객체에 삽입).

- [x] **Step 2: DashboardPage.tsx 수정**

import 추가:

```typescript
import { YouthDevelopmentSection } from '@/components/dashboard/YouthDevelopmentSection'
import { dashboardApi } from '@/services/dashboard.service'
import type { YouthDevelopmentStats } from '@/types/dashboard'
```

state 추가:

```typescript
const [youthDev, setYouthDev] = useState<YouthDevelopmentStats | null>(null)
const [youthDevLoading, setYouthDevLoading] = useState(false)
```

`useEffect` 내부에 조건부 fetch 추가 (기존 `dashboardApi.stats()` 호출 바로 아래):

```typescript
if (config.showYouthDevelopment) {
  setYouthDevLoading(true)
  dashboardApi.youthDevelopment()
    .then(setYouthDev)
    .catch(() => null)
    .finally(() => setYouthDevLoading(false))
}
```

단, `useEffect` 의존성 배열에 `config`를 추가하면 무한 루프가 생기므로, `config.showYouthDevelopment`를 `useEffect` 외부에서 상수로 뽑아두거나 `user` 기반 조건으로 대체:

```typescript
const showYouthDev = user?.role === 'ADMIN' || (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'TD')
```

그리고 `useEffect` 내부:

```typescript
if (showYouthDev) {
  setYouthDevLoading(true)
  dashboardApi.youthDevelopment()
    .then(setYouthDev)
    .catch(() => null)
    .finally(() => setYouthDevLoading(false))
}
```

렌더 영역에 `YouthDevelopmentSection` 추가 (의료 섹션 아래, grid 위):

```tsx
{config.showYouthDevelopment && (
  youthDevLoading
    ? <div className="text-sm text-muted-foreground">유소년 현황 불러오는 중...</div>
    : youthDev && <YouthDevelopmentSection data={youthDev} />
)}
```

- [x] **Step 3: 타입스크립트 체크**

```bash
cd football && npx tsc --noEmit 2>&1 | head -30
```

Expected: 오류 없음

- [x] **Step 4: Commit**

```bash
git add football/src/pages/dashboard/dashboardConfig.ts football/src/pages/dashboard/DashboardPage.tsx
git commit -m "feat(dashboard): TD/ADMIN 대시보드에 유소년 포지션 편중 현황 섹션 추가"
```

---

## Task 7: 전체 검증

**Files:** 없음 (검증만)

- [x] **Step 1: BE 전체 타입스크립트 체크**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -30
```

Expected: 오류 없음

- [x] **Step 2: FE 전체 타입스크립트 체크**

```bash
cd football && npx tsc --noEmit 2>&1 | head -30
```

Expected: 오류 없음

- [x] **Step 3: 테스트 실행**

```bash
cd apps/api && npx vitest run __test__/dashboard/ 2>&1 | tail -20
```

Expected: 전체 PASS

- [x] **Step 4: Commit (변경사항 없으면 skip)**

모든 검증 통과 확인.
