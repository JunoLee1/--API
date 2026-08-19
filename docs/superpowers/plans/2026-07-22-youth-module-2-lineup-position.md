# 유소년 모듈 Plan 2: 라인업 포지션 기능 (Mismatch 경고 + PDI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** FIRST_TEAM 라인업에 포지션 Mismatch 비차단 경고 배지를 추가하고, 유소년 선수 상세 페이지에 Position Diversity Index 시각화를 구현한다.

**Architecture:** (1) Mismatch — FE 전용. `formation-layouts.ts`의 `slotDef.position`과 `Player.position`을 비교해 ⚠ 배지 렌더. `Match.team.type`을 라인업 API에 포함해 YOUTH 팀은 배지 숨김. (2) PDI — 새 BE 엔드포인트 `GET /players/:id/position-diversity`가 `LineupSlot + PlayerMatchStats.minutesPlayed`를 온디맨드 집계해 반환. FE는 파이차트로 시각화.

**Tech Stack:** React (FE 배지), Recharts/내장 SVG (파이차트), Prisma raw query or groupBy (PDI 집계)

**의존성:** Plan 1 완료 후 실행 권장 (GUARDIAN 역할은 무관하나 같은 브랜치)

---

## 파일 맵

### BE — 수정
- `apps/api/src/match/match.lineup.repo.ts` — `findMatchInfo`에 `team.type` 추가
- `apps/api/src/player/player.routes.ts` — PDI 엔드포인트 추가
- `apps/api/src/player/player.service.ts` — `getPositionDiversity()` 메서드 추가
- `apps/api/src/player/player.repo.ts` — PDI 집계 쿼리 추가

### BE — 테스트
- `apps/api/__test__/player/player.pdi.test.ts`

### FE — 수정
- `football/src/types/lineup.ts` — `MatchLineup`에 `teamType` 필드 추가
- `football/src/pages/matches/MatchLineupPage.tsx` — Mismatch 배지 렌더링
- `football/src/pages/players/PlayerDetailPage.tsx` — PDI 탭/섹션 추가

### FE — 신규
- `football/src/components/players/PositionDiversityChart.tsx`
- `football/src/services/playerPdi.service.ts`

---

## Task 1: BE — `findMatchInfo`에 team.type 포함

**Files:**
- Modify: `apps/api/src/match/match.lineup.repo.ts:59-65`

- [x] **Step 1: 현재 findMatchInfo 확인**

```bash
grep -n "findMatchInfo\|homeTeamName\|teamId\|team" apps/api/src/match/match.lineup.repo.ts
```

- [x] **Step 2: findMatchInfo 수정**

`findMatchInfo` 메서드의 `select`에 `team` 포함:

```typescript
findMatchInfo(matchId: number) {
  return this.prisma.match.findUnique({
    where: { id: matchId },
    select: {
      homeTeamName: true,
      awayTeamName: true,
      date: true,
      venue: true,
      team: { select: { id: true, type: true } },
    },
  });
}
```

- [x] **Step 3: match.lineup.service.ts에서 matchInfo 사용 확인**

`confirmLineup` 메서드가 `matchInfo`를 알림 발송에 쓰고 있으므로 타입 변경 확인:

```bash
grep -n "matchInfo\." apps/api/src/match/match.lineup.service.ts
```

타입 에러 없으면 통과. 에러 있으면 `matchInfo.team?.type` 패턴으로 optional 처리.

- [x] **Step 4: MatchLineup GET API 응답에 teamType 포함**

`apps/api/src/match/match.lineup.service.ts`의 `getLineup` 메서드를 수정해 team.type을 응답에 포함:

```typescript
async getLineup(matchId: number) {
  const lineup = await this.repo.findByMatch(matchId);
  const matchInfo = await this.repo.findMatchInfo(matchId);
  const teamType = matchInfo?.team?.type ?? null;

  if (lineup) return { ...lineup, teamType };

  const squadMembers = await this.repo.findSquadPlayers(matchId);
  if (squadMembers.length === 0) return null;

  return {
    matchId,
    formation: "4-3-3" as const,
    isConfirmed: false,
    confirmedAt: null,
    teamType,
    slots: squadMembers.map((sq, i) => ({
      slotKey: `BENCH_${i}`,
      isStarter: false,
      player: sq.player,
    })),
  };
}
```

- [x] **Step 5: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [x] **Step 6: Commit**

```bash
git add apps/api/src/match/match.lineup.repo.ts apps/api/src/match/match.lineup.service.ts
git commit -m "feat(youth): lineup API에 teamType 포함"
```

---

## Task 2: FE — MatchLineup 타입 업데이트 + Mismatch 배지

**Files:**
- Modify: `football/src/types/lineup.ts`
- Modify: `football/src/pages/matches/MatchLineupPage.tsx`

- [x] **Step 1: lineup.ts에 teamType 추가**

`football/src/types/lineup.ts`의 `MatchLineup` 인터페이스에 필드 추가:

```typescript
export interface MatchLineup {
  matchId: number
  formation: SupportedFormation
  isConfirmed: boolean
  confirmedAt: string | null
  teamType: 'FIRST_TEAM' | 'YOUTH' | null  // NEW
  slots: LineupSlotData[]
}
```

- [x] **Step 2: SlotCard 컴포넌트에 Mismatch 배지 추가**

`MatchLineupPage.tsx`의 `SlotCard` 컴포넌트 props에 `showMismatch` 추가 후 배지 렌더링:

```typescript
interface SlotCardProps {
  player: LineupPlayer
  slotDef: { key: string; position: string; top: number; left: number }
  onDrop: (slotKey: string, payload: LineupDragPayload) => void
  onRemove: (slotKey: string) => void
  showMismatch: boolean   // NEW
}

function SlotCard({ player, slotDef, onDrop, onRemove, showMismatch }: SlotCardProps) {
  const isMismatch = showMismatch && player.position !== slotDef.position

  return (
    <div style={{ ... }} /* 기존 스타일 유지 */
      onDragOver={...}
      onDrop={...}
    >
      {/* 기존 player 카드 내용 유지 */}
      {isMismatch && (
        <div
          className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold"
          title={`포지션 불일치: 선수 ${player.position} / 슬롯 ${slotDef.position}`}
        >
          ⚠
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 3: MatchLineupPage에서 showMismatch 결정**

`MatchLineupPage` 컴포넌트 내부에서 `lineup.teamType`으로 분기:

```typescript
// lineup 상태 로드 후
const showMismatch = lineup?.teamType === 'FIRST_TEAM'

// SlotCard 렌더링 시
<SlotCard
  key={slotDef.key}
  player={slottedPlayer}
  slotDef={slotDef}
  onDrop={handleDrop}
  onRemove={handleSlotRemove}
  showMismatch={showMismatch}   // NEW
/>
```

- [x] **Step 4: 브라우저 확인**

```bash
cd football && npm run dev
```

1. FIRST_TEAM 경기 라인업 페이지에서 다른 포지션의 선수를 슬롯에 드롭 → ⚠ 배지 표시 확인
2. YOUTH 팀 경기 라인업 → 배지 없음 확인
3. 저장은 양쪽 다 정상 동작 확인 (비차단)

- [x] **Step 5: Commit**

```bash
git add football/src/types/lineup.ts football/src/pages/matches/MatchLineupPage.tsx
git commit -m "feat(youth): FIRST_TEAM 라인업 포지션 Mismatch 비차단 경고 배지"
```

---

## Task 3: BE — Position Diversity Index 엔드포인트

**Files:**
- Modify: `apps/api/src/player/player.repo.ts`
- Modify: `apps/api/src/player/player.service.ts`
- Modify: `apps/api/src/player/player.routes.ts`
- Create: `apps/api/__test__/player/player.pdi.test.ts`

- [x] **Step 1: failing test 작성**

`apps/api/__test__/player/player.pdi.test.ts` 생성:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { PlayerService } from "../../src/player/player.service";

const mockRepo = {
  findById: jest.fn(),
  getPositionDiversity: jest.fn(),
  // 기존 메서드들 필요 시 추가
} as any;

const service = new PlayerService(mockRepo);

describe("PlayerService - getPositionDiversity", () => {
  beforeEach(() => jest.clearAllMocks());

  test("YOUTH 선수의 포지션 다양성 집계를 반환한다", async () => {
    mockRepo.findById.mockResolvedValue({ id: "player-1", team: { type: "YOUTH" } });
    mockRepo.getPositionDiversity.mockResolvedValue([
      { position: "STRIKER", totalMinutes: 180 },
      { position: "WINGER", totalMinutes: 60 },
    ]);

    const result = await service.getPositionDiversity("player-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ position: "STRIKER", minutes: 180, percentage: 75 });
    expect(result[1]).toMatchObject({ position: "WINGER", minutes: 60, percentage: 25 });
  });

  test("FIRST_TEAM 선수는 빈 배열 반환", async () => {
    mockRepo.findById.mockResolvedValue({ id: "player-2", team: { type: "FIRST_TEAM" } });

    const result = await service.getPositionDiversity("player-2");

    expect(result).toEqual([]);
    expect(mockRepo.getPositionDiversity).not.toHaveBeenCalled();
  });

  test("선수가 없으면 404", async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.getPositionDiversity("nonexistent")).rejects.toMatchObject({
      statusCode: 404,
      code: "PLAYER_NOT_FOUND",
    });
  });

  test("출전 기록 없으면 빈 배열", async () => {
    mockRepo.findById.mockResolvedValue({ id: "player-3", team: { type: "YOUTH" } });
    mockRepo.getPositionDiversity.mockResolvedValue([]);

    const result = await service.getPositionDiversity("player-3");
    expect(result).toEqual([]);
  });
});
```

- [x] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd apps/api && npx jest __test__/player/player.pdi.test.ts --no-coverage
```

Expected: FAIL — `getPositionDiversity is not a function`

- [x] **Step 3: player.repo.ts에 getPositionDiversity 추가**

`apps/api/src/player/player.repo.ts`에 메서드 추가:

```typescript
async getPositionDiversity(playerId: string): Promise<{ position: string; totalMinutes: number }[]> {
  // formation-layouts의 slotKey → Position 매핑을 활용
  // LineupSlot.slotKey의 앞 부분(GK, CB, LB, ST 등)으로 포지션 추론 대신
  // LineupSlot → MatchLineup → Match → PlayerMatchStats 조인
  const rows = await this.prisma.$queryRaw<{ position: string; total_minutes: number }[]>`
    SELECT
      ls."slotKey" AS position,
      COALESCE(SUM(pms."minutesPlayed"), 0) AS total_minutes
    FROM "LineupSlot" ls
    INNER JOIN "MatchLineup" ml ON ml.id = ls."lineupId"
    LEFT JOIN "PlayerMatchStats" pms
      ON pms."matchId" = ml."matchId" AND pms."playerId" = ls."playerId"
    WHERE ls."playerId" = ${playerId}
      AND ls."isStarter" = true
    GROUP BY ls."slotKey"
    HAVING COALESCE(SUM(pms."minutesPlayed"), 0) > 0
    ORDER BY total_minutes DESC
  `;

  return rows.map(r => ({ position: r.position, totalMinutes: Number(r.total_minutes) }));
}
```

> **Note:** slotKey(예: "GK", "CB1", "LW")를 Position enum 값으로 변환하는 매핑은 FE의 formation-layouts.ts와 동일한 로직이 필요하나, PDI 집계는 slotKey 자체를 그룹 키로 써도 의미가 통하므로 FE에서 매핑해서 표시한다.

- [x] **Step 4: player.service.ts에 getPositionDiversity 추가**

```typescript
async getPositionDiversity(playerId: string) {
  const player = await this.repo.findById(playerId);
  if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");

  if (player.team?.type !== "YOUTH") return [];

  const rows = await this.repo.getPositionDiversity(playerId);
  const totalMinutes = rows.reduce((sum, r) => sum + r.totalMinutes, 0);

  if (totalMinutes === 0) return [];

  return rows.map(r => ({
    position: r.position,
    minutes: r.totalMinutes,
    percentage: Math.round((r.totalMinutes / totalMinutes) * 100),
  }));
}
```

- [x] **Step 5: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/player/player.pdi.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [x] **Step 6: player.routes.ts에 엔드포인트 등록**

`apps/api/src/player/player.routes.ts`에 추가 (기존 `router.get("/:id", ...)` 아래):

```typescript
router.get("/:id/position-diversity", auth, controller.getPositionDiversity);
```

`player.controller.ts`에 메서드 추가:

```typescript
getPositionDiversity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await this.service.getPositionDiversity(req.params.id);
    res.json(data);
  } catch (e) { next(e); }
};
```

- [x] **Step 7: Commit**

```bash
git add apps/api/src/player/ apps/api/__test__/player/player.pdi.test.ts
git commit -m "feat(youth): Position Diversity Index API (GET /players/:id/position-diversity)"
```

---

## Task 4: FE — PositionDiversityChart 컴포넌트 + PlayerDetailPage 통합

**Files:**
- Create: `football/src/services/playerPdi.service.ts`
- Create: `football/src/components/players/PositionDiversityChart.tsx`
- Modify: `football/src/pages/players/PlayerDetailPage.tsx`

- [x] **Step 1: PDI API 서비스**

`football/src/services/playerPdi.service.ts` 생성:

```typescript
import api from '@/lib/api'

export interface PositionDiversityEntry {
  position: string
  minutes: number
  percentage: number
}

export const playerPdiApi = {
  get: (playerId: string) =>
    api.get<PositionDiversityEntry[]>(`/players/${playerId}/position-diversity`).then(r => r.data),
}
```

- [x] **Step 2: 파이차트 컴포넌트 작성**

`football/src/components/players/PositionDiversityChart.tsx` 생성:

```typescript
import type { PositionDiversityEntry } from '@/services/playerPdi.service'

const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

interface Props {
  data: PositionDiversityEntry[]
}

export function PositionDiversityChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">출전 기록이 없습니다.</p>
  }

  const cx = 80
  const cy = 80
  const r = 60
  let startAngle = -Math.PI / 2

  const slices = data.map((entry, i) => {
    const angle = (entry.percentage / 100) * 2 * Math.PI
    const endAngle = startAngle + angle
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    const result = { path, color: COLORS[i % COLORS.length]!, entry, endAngle }
    startAngle = endAngle
    return result
  })

  return (
    <div className="flex items-start gap-6">
      <svg width={160} height={160} viewBox="0 0 160 160">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth={1} />
        ))}
      </svg>
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-muted-foreground w-24">{s.entry.position}</span>
            <span className="font-medium">{s.entry.percentage}%</span>
            <span className="text-muted-foreground text-xs">({s.entry.minutes}분)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [x] **Step 3: PlayerDetailPage에 PDI 섹션 추가**

`football/src/pages/players/PlayerDetailPage.tsx`에서:

1. import 추가:
```typescript
import { playerPdiApi, type PositionDiversityEntry } from '@/services/playerPdi.service'
import { PositionDiversityChart } from '@/components/players/PositionDiversityChart'
```

2. 상태 추가:
```typescript
const [pdiData, setPdiData] = useState<PositionDiversityEntry[]>([])
```

3. `useEffect` 내 player 로드 후 PDI 조회:
```typescript
if (playerData.team?.type === 'YOUTH') {
  playerPdiApi.get(playerData.id)
    .then(setPdiData)
    .catch(() => setPdiData([]))
}
```

4. 선수 상세 탭/섹션 내 YOUTH 팀 선수일 때 PDI 섹션 렌더:
```typescript
{player?.team?.type === 'YOUTH' && (
  <section className="mt-6 p-4 border rounded-lg">
    <h3 className="text-sm font-semibold mb-3">포지션 다양성 지표 (PDI)</h3>
    <PositionDiversityChart data={pdiData} />
  </section>
)}
```

- [x] **Step 4: 브라우저 확인**

유소년 선수 상세 페이지:
- PDI 섹션 렌더링 확인
- 출전 기록 없으면 "출전 기록이 없습니다" 메시지 확인

성인 선수 상세 페이지:
- PDI 섹션 미표시 확인

- [x] **Step 5: Commit**

```bash
git add football/src/services/playerPdi.service.ts football/src/components/players/PositionDiversityChart.tsx football/src/pages/players/PlayerDetailPage.tsx
git commit -m "feat(youth): Position Diversity Index FE - 파이차트 시각화"
```

---

## Task 5: 전체 테스트

- [x] **Step 1: BE 테스트**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: 기존 + 신규 전체 PASS

- [x] **Step 2: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit && cd ../football && npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(youth): Plan 2 완료 - Mismatch 경고 + PDI"
```
