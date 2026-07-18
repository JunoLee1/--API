# Visual Squad Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 감독/단장이 포메이션 기반 가용 선수 배치를 시각화하고, 빈 슬롯에서 스카우팅으로 즉시 연결할 수 있는 팀 빌더 페이지를 구현한다.

**Architecture:** BE에 `GET /injuries/active` 엔드포인트 1개를 추가하고, FE는 선수 목록·활성 부상·최근 전술 분석 세 API를 조합해 가용 선수를 계산한다. 포메이션 슬롯 배치는 우선순위 큐(정확 포지션 → 레벨 → 인접 포지션)로 초기화되며, HTML5 드래그 앤 드롭으로 수동 교체한다.

**Tech Stack:** Prisma, Express, TypeScript, React + Vite, shadcn/ui, react-router-dom, HTML5 Drag API

---

## 파일 구조

**신규 생성:**
- `apps/api/src/injury/` — repo/service/controller/routes 소규모 추가
- `football/src/components/squad/formation-layouts.ts` — 포메이션별 슬롯 좌표 정적 config
- `football/src/components/squad/adjacent-positions.ts` — 인접 포지션 맵
- `football/src/components/squad/squad-utils.ts` — getCandidates, buildInitialPlacement
- `football/src/components/squad/FootballPitch.tsx` — 피치 배경 + 그리드 오버레이
- `football/src/components/squad/FormationSlot.tsx` — 슬롯 컴포넌트 (채워진/제안/빈)
- `football/src/components/squad/PlayerBench.tsx` — 우측 패널 가용 선수 목록
- `football/src/pages/squad/SquadPlannerPage.tsx` — 메인 페이지

**수정:**
- `apps/api/src/injury/injury.repo.ts` — `findActive()` 추가
- `apps/api/src/injury/injury.service.ts` — `getActive()` 추가
- `apps/api/src/injury/injury.controller.ts` — `getActive` 핸들러 추가
- `apps/api/src/injury/injury.routes.ts` — `GET /active` 라우트 추가
- `apps/api/__test__/injury/injury.controller.test.ts` — `getActive` 테스트 추가
- `football/src/services/injury.service.ts` — `active()` 메서드 추가
- `football/src/App.tsx` — `/squad` 라우트 추가
- `football/src/layouts/AppShell.tsx` — 사이드바 메뉴 추가
- `football/src/pages/prospects/ProspectsPage.tsx` — `useSearchParams` 연동

---

## Task 1: BE — `GET /injuries/active` 엔드포인트

**Files:**
- Modify: `apps/api/src/injury/injury.repo.ts`
- Modify: `apps/api/src/injury/injury.service.ts`
- Modify: `apps/api/src/injury/injury.controller.ts`
- Modify: `apps/api/src/injury/injury.routes.ts`
- Modify: `apps/api/__test__/injury/injury.controller.test.ts`

- [ ] **Step 1: injury.repo.ts에 `findActive()` 추가**

`confirm` 메서드 위 (또는 `getStats` 뒤)에 추가:

```typescript
findActive() {
  return this.prisma.injury.findMany({
    where: { status: { in: ["OCCURRED", "DIAGNOSED", "REHABILITATING"] } },
    select: { playerId: true, status: true },
  });
}
```

- [ ] **Step 2: injury.service.ts에 `getActive()` 추가**

`getStats()` 메서드 바로 아래에 추가:

```typescript
getActive() {
  return this.repo.findActive();
}
```

- [ ] **Step 3: injury.controller.ts에 `getActive` 핸들러 추가**

`getStats` 핸들러 바로 아래에 추가:

```typescript
getActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json(await this.service.getActive());
  } catch (err) { next(err); }
};
```

- [ ] **Step 4: injury.routes.ts에 라우트 추가**

`router.get("/stats", ...)` 바로 아래, `router.get("/:id", ...)` 보다 **앞에** 추가:

```typescript
// 활성 부상 선수 목록 (가용 선수 필터링용)
router.get("/active", auth, controller.getActive);
```

- [ ] **Step 5: 테스트 작성**

`apps/api/__test__/injury/injury.controller.test.ts`의 `mockService` 객체에 `getActive` 추가 후 describe 블록 추가:

```typescript
// mockService 객체에 추가:
getActive: jest.fn<() => Promise<any[]>>().mockResolvedValue([
  { playerId: 'player-1', status: 'REHABILITATING' },
]),
```

파일 맨 아래 추가:

```typescript
describe("InjuryController - getActive", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ADMIN can get active injuries → 200", async () => {
    const req = mockReq({});
    const res = mockRes();
    await controller.getActive(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.getActive).toHaveBeenCalled();
  });

  test("returns active injury list", async () => {
    const req = mockReq({});
    const res = mockRes();
    await controller.getActive(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith([
      { playerId: 'player-1', status: 'REHABILITATING' },
    ]);
  });
});
```

- [ ] **Step 6: 테스트 실행**

```bash
cd apps/api && npx jest __test__/injury/injury.controller.test.ts --verbose
```

Expected: 전체 PASS

- [ ] **Step 7: TypeScript 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "injury.*error\|error TS" | grep -v country
```

Expected: 출력 없음

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/injury/ apps/api/__test__/injury/injury.controller.test.ts
git commit -m "feat(injury): add GET /injuries/active endpoint for squad planner"
```

---

## Task 2: FE — 정적 config + 유틸리티 (formation-layouts, adjacent-positions, squad-utils)

**Files:**
- Create: `football/src/components/squad/formation-layouts.ts`
- Create: `football/src/components/squad/adjacent-positions.ts`
- Create: `football/src/components/squad/squad-utils.ts`

- [ ] **Step 1: `formation-layouts.ts` 생성**

```typescript
import type { Position } from '@/types/player'

export interface GridZone {
  col: 1 | 2 | 3 | 4 | 5
  row: 1 | 2 | 3
}

export interface SlotDef {
  key: string
  position: Position
  top: number    // % from top (GK = 88%)
  left: number   // % from left
  gridZone: GridZone
}

export const SUPPORTED_FORMATIONS = [
  '4-3-3', '4-4-2', '4-2-3-1', '4-1-4-1',
  '3-5-2', '3-4-3', '5-3-2', '5-4-1',
] as const
export type SupportedFormation = typeof SUPPORTED_FORMATIONS[number]

export const FORMATION_LAYOUTS: Record<SupportedFormation, SlotDef[]> = {
  '4-3-3': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 72, left: 15, gridZone: { col: 1, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 35, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 65, gridZone: { col: 4, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 72, left: 85, gridZone: { col: 5, row: 3 } },
    { key: 'LCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 25, gridZone: { col: 2, row: 2 } },
    { key: 'CM',  position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 50, gridZone: { col: 3, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 75, gridZone: { col: 4, row: 2 } },
    { key: 'LW',  position: 'WINGER',                        top: 28, left: 18, gridZone: { col: 1, row: 1 } },
    { key: 'ST',  position: 'STRIKER',                       top: 20, left: 50, gridZone: { col: 3, row: 1 } },
    { key: 'RW',  position: 'WINGER',                        top: 28, left: 82, gridZone: { col: 5, row: 1 } },
  ],
  '4-4-2': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 72, left: 15, gridZone: { col: 1, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 35, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 65, gridZone: { col: 4, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 72, left: 85, gridZone: { col: 5, row: 3 } },
    { key: 'LM',  position: 'LEFT_ATTACK_MIDFIELDER',        top: 52, left: 12, gridZone: { col: 1, row: 2 } },
    { key: 'LCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 37, gridZone: { col: 2, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 63, gridZone: { col: 4, row: 2 } },
    { key: 'RM',  position: 'RIGHT_ATTACK_MIDFIELDER',       top: 52, left: 88, gridZone: { col: 5, row: 2 } },
    { key: 'LST', position: 'STRIKER',                       top: 22, left: 35, gridZone: { col: 2, row: 1 } },
    { key: 'RST', position: 'STRIKER',                       top: 22, left: 65, gridZone: { col: 4, row: 1 } },
  ],
  '4-2-3-1': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 72, left: 15, gridZone: { col: 1, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 35, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 65, gridZone: { col: 4, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 72, left: 85, gridZone: { col: 5, row: 3 } },
    { key: 'LDM', position: 'LEFT_DEFENSIVE_MIDFIELDER',     top: 60, left: 35, gridZone: { col: 2, row: 2 } },
    { key: 'RDM', position: 'RIGHT_DEFENSIVE_MIDFIELDER',    top: 60, left: 65, gridZone: { col: 4, row: 2 } },
    { key: 'LAM', position: 'LEFT_ATTACK_MIDFIELDER',        top: 42, left: 18, gridZone: { col: 1, row: 2 } },
    { key: 'CAM', position: 'CENTRAL_ATTACK_MIDFIELDER',     top: 42, left: 50, gridZone: { col: 3, row: 2 } },
    { key: 'RAM', position: 'RIGHT_ATTACK_MIDFIELDER',       top: 42, left: 82, gridZone: { col: 5, row: 2 } },
    { key: 'ST',  position: 'STRIKER',                       top: 20, left: 50, gridZone: { col: 3, row: 1 } },
  ],
  '4-1-4-1': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 72, left: 15, gridZone: { col: 1, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 35, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 65, gridZone: { col: 4, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 72, left: 85, gridZone: { col: 5, row: 3 } },
    { key: 'CDM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 62, left: 50, gridZone: { col: 3, row: 2 } },
    { key: 'LM',  position: 'LEFT_ATTACK_MIDFIELDER',        top: 48, left: 12, gridZone: { col: 1, row: 2 } },
    { key: 'LCM', position: 'CENTRAL_ATTACK_MIDFIELDER',     top: 48, left: 37, gridZone: { col: 2, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_ATTACK_MIDFIELDER',     top: 48, left: 63, gridZone: { col: 4, row: 2 } },
    { key: 'RM',  position: 'RIGHT_ATTACK_MIDFIELDER',       top: 48, left: 88, gridZone: { col: 5, row: 2 } },
    { key: 'ST',  position: 'STRIKER',                       top: 20, left: 50, gridZone: { col: 3, row: 1 } },
  ],
  '3-5-2': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 25, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'CB3', position: 'CENTER_BACK',                   top: 72, left: 75, gridZone: { col: 4, row: 3 } },
    { key: 'LWB', position: 'LEFT_WING_BACK',                top: 58, left: 10, gridZone: { col: 1, row: 2 } },
    { key: 'LCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 32, gridZone: { col: 2, row: 2 } },
    { key: 'CM',  position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 50, gridZone: { col: 3, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 68, gridZone: { col: 4, row: 2 } },
    { key: 'RWB', position: 'RIGHT_WING_BACK',               top: 58, left: 90, gridZone: { col: 5, row: 2 } },
    { key: 'LST', position: 'STRIKER',                       top: 22, left: 35, gridZone: { col: 2, row: 1 } },
    { key: 'RST', position: 'STRIKER',                       top: 22, left: 65, gridZone: { col: 4, row: 1 } },
  ],
  '3-4-3': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'CB1', position: 'CENTER_BACK',                   top: 72, left: 25, gridZone: { col: 2, row: 3 } },
    { key: 'CB2', position: 'CENTER_BACK',                   top: 72, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'CB3', position: 'CENTER_BACK',                   top: 72, left: 75, gridZone: { col: 4, row: 3 } },
    { key: 'LM',  position: 'LEFT_ATTACK_MIDFIELDER',        top: 52, left: 12, gridZone: { col: 1, row: 2 } },
    { key: 'LCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 37, gridZone: { col: 2, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 63, gridZone: { col: 4, row: 2 } },
    { key: 'RM',  position: 'RIGHT_ATTACK_MIDFIELDER',       top: 52, left: 88, gridZone: { col: 5, row: 2 } },
    { key: 'LW',  position: 'WINGER',                        top: 28, left: 18, gridZone: { col: 1, row: 1 } },
    { key: 'ST',  position: 'STRIKER',                       top: 22, left: 50, gridZone: { col: 3, row: 1 } },
    { key: 'RW',  position: 'WINGER',                        top: 28, left: 82, gridZone: { col: 5, row: 1 } },
  ],
  '5-3-2': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LWB', position: 'LEFT_WING_BACK',                top: 70, left: 8,  gridZone: { col: 1, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 74, left: 25, gridZone: { col: 2, row: 3 } },
    { key: 'CB',  position: 'CENTER_BACK',                   top: 76, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 74, left: 75, gridZone: { col: 4, row: 3 } },
    { key: 'RWB', position: 'RIGHT_WING_BACK',               top: 70, left: 92, gridZone: { col: 5, row: 3 } },
    { key: 'LCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 25, gridZone: { col: 2, row: 2 } },
    { key: 'CM',  position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 50, gridZone: { col: 3, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_DEFENSIVE_MIDFIELDER',  top: 52, left: 75, gridZone: { col: 4, row: 2 } },
    { key: 'LST', position: 'STRIKER',                       top: 22, left: 35, gridZone: { col: 2, row: 1 } },
    { key: 'RST', position: 'STRIKER',                       top: 22, left: 65, gridZone: { col: 4, row: 1 } },
  ],
  '5-4-1': [
    { key: 'GK',  position: 'GOALKEEPER',                    top: 88, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'LWB', position: 'LEFT_WING_BACK',                top: 70, left: 8,  gridZone: { col: 1, row: 3 } },
    { key: 'LB',  position: 'LEFT_FULL_BACK',                top: 74, left: 25, gridZone: { col: 2, row: 3 } },
    { key: 'CB',  position: 'CENTER_BACK',                   top: 76, left: 50, gridZone: { col: 3, row: 3 } },
    { key: 'RB',  position: 'RIGHT_FULL_BACK',               top: 74, left: 75, gridZone: { col: 4, row: 3 } },
    { key: 'RWB', position: 'RIGHT_WING_BACK',               top: 70, left: 92, gridZone: { col: 5, row: 3 } },
    { key: 'LM',  position: 'LEFT_ATTACK_MIDFIELDER',        top: 50, left: 12, gridZone: { col: 1, row: 2 } },
    { key: 'LCM', position: 'CENTRAL_ATTACK_MIDFIELDER',     top: 50, left: 37, gridZone: { col: 2, row: 2 } },
    { key: 'RCM', position: 'CENTRAL_ATTACK_MIDFIELDER',     top: 50, left: 63, gridZone: { col: 4, row: 2 } },
    { key: 'RM',  position: 'RIGHT_ATTACK_MIDFIELDER',       top: 50, left: 88, gridZone: { col: 5, row: 2 } },
    { key: 'ST',  position: 'STRIKER',                       top: 20, left: 50, gridZone: { col: 3, row: 1 } },
  ],
}
```

- [ ] **Step 2: `adjacent-positions.ts` 생성**

```typescript
import type { Position } from '@/types/player'

export const ADJACENT_POSITIONS: Partial<Record<Position, Position[]>> = {
  CENTER_BACK:                  ['LEFT_FULL_BACK', 'RIGHT_FULL_BACK'],
  LEFT_FULL_BACK:               ['LEFT_WING_BACK', 'CENTER_BACK'],
  RIGHT_FULL_BACK:              ['RIGHT_WING_BACK', 'CENTER_BACK'],
  LEFT_WING_BACK:               ['LEFT_FULL_BACK', 'WINGER'],
  RIGHT_WING_BACK:              ['RIGHT_FULL_BACK', 'WINGER'],
  CENTRAL_DEFENSIVE_MIDFIELDER: ['LEFT_DEFENSIVE_MIDFIELDER', 'RIGHT_DEFENSIVE_MIDFIELDER', 'CENTRAL_ATTACK_MIDFIELDER'],
  LEFT_DEFENSIVE_MIDFIELDER:    ['CENTRAL_DEFENSIVE_MIDFIELDER'],
  RIGHT_DEFENSIVE_MIDFIELDER:   ['CENTRAL_DEFENSIVE_MIDFIELDER'],
  CENTRAL_ATTACK_MIDFIELDER:    ['LEFT_ATTACK_MIDFIELDER', 'RIGHT_ATTACK_MIDFIELDER', 'CENTRAL_DEFENSIVE_MIDFIELDER'],
  LEFT_ATTACK_MIDFIELDER:       ['CENTRAL_ATTACK_MIDFIELDER', 'WINGER'],
  RIGHT_ATTACK_MIDFIELDER:      ['CENTRAL_ATTACK_MIDFIELDER', 'WINGER'],
  WINGER:                       ['LEFT_ATTACK_MIDFIELDER', 'RIGHT_ATTACK_MIDFIELDER'],
  STRIKER:                      ['SHADOW_STRIKER'],
  SHADOW_STRIKER:               ['STRIKER', 'CENTRAL_ATTACK_MIDFIELDER'],
}
```

- [ ] **Step 3: `squad-utils.ts` 생성**

```typescript
import type { Player, PlayerLevel, Position } from '@/types/player'
import type { SlotDef } from './formation-layouts'
import { ADJACENT_POSITIONS } from './adjacent-positions'

const LEVEL_PRIORITY: Record<PlayerLevel, number> = {
  YOUTH: 0, ROOKIE: 1, SENIOR: 2, VETERAN: 3,
}

export function getCandidates(
  slotPosition: Position,
  availablePlayers: Player[],
  alreadyPlaced: Set<string>,
): Player[] {
  const unplaced = availablePlayers.filter((p) => !alreadyPlaced.has(p.id))
  const exact = unplaced
    .filter((p) => p.position === slotPosition)
    .sort((a, b) => LEVEL_PRIORITY[b.level] - LEVEL_PRIORITY[a.level])
  const adjacentPositions = ADJACENT_POSITIONS[slotPosition] ?? []
  const fallback = unplaced
    .filter((p) => p.position !== slotPosition && adjacentPositions.includes(p.position))
    .sort((a, b) => LEVEL_PRIORITY[b.level] - LEVEL_PRIORITY[a.level])
  return [...exact, ...fallback]
}

export function buildInitialPlacement(
  slots: SlotDef[],
  availablePlayers: Player[],
): Record<string, string | null> {
  const placement: Record<string, string | null> = {}
  const placed = new Set<string>()
  for (const slot of slots) {
    const candidates = getCandidates(slot.position, availablePlayers, placed)
    if (candidates.length > 0) {
      placement[slot.key] = candidates[0].id
      placed.add(candidates[0].id)
    } else {
      placement[slot.key] = null
    }
  }
  return placement
}
```

- [ ] **Step 4: TypeScript 컴파일 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "squad\|error TS"
```

Expected: 출력 없음

- [ ] **Step 5: Commit**

```bash
git add football/src/components/squad/formation-layouts.ts \
        football/src/components/squad/adjacent-positions.ts \
        football/src/components/squad/squad-utils.ts
git commit -m "feat(squad): add formation layouts, adjacent positions, and slot utility functions"
```

---

## Task 3: FE 컴포넌트 — FootballPitch + FormationSlot

**Files:**
- Create: `football/src/components/squad/FootballPitch.tsx`
- Create: `football/src/components/squad/FormationSlot.tsx`

- [ ] **Step 1: `FootballPitch.tsx` 생성**

```tsx
import type { ReactNode } from 'react'

const GRID_COL_LABELS = ['LC', 'LHS', 'CTR', 'RHS', 'RC']
const GRID_ROW_LABELS = ['ATT', 'MID', 'DEF']

interface FootballPitchProps {
  viewMode: 'formation' | 'grid'
  children: ReactNode
}

export function FootballPitch({ viewMode, children }: FootballPitchProps) {
  return (
    <div
      className="relative w-full rounded-lg overflow-hidden select-none"
      style={{ aspectRatio: '2/3', background: 'linear-gradient(180deg, #1a6b2e 0%, #1e7a34 50%, #1a6b2e 100%)' }}
    >
      {/* 피치 라인 */}
      <div className="absolute inset-0 pointer-events-none">
        {/* 외곽 */}
        <div className="absolute inset-[3%] border border-white/40 rounded-sm" />
        {/* 센터라인 */}
        <div className="absolute left-[3%] right-[3%] border-t border-white/40" style={{ top: '50%' }} />
        {/* 센터서클 */}
        <div
          className="absolute border border-white/40 rounded-full"
          style={{ width: '22%', height: '14%', top: '43%', left: '39%' }}
        />
        {/* 페널티 에어리어 (상단) */}
        <div
          className="absolute border border-white/40 border-t-0"
          style={{ width: '52%', height: '17%', top: '3%', left: '24%' }}
        />
        {/* 페널티 에어리어 (하단) */}
        <div
          className="absolute border border-white/40 border-b-0"
          style={{ width: '52%', height: '17%', bottom: '3%', left: '24%' }}
        />
      </div>

      {/* 스페인 그리드 오버레이 */}
      {viewMode === 'grid' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* 세로 구분선 (5열) */}
          {[20, 40, 60, 80].map((pct) => (
            <div
              key={pct}
              className="absolute top-0 bottom-0 border-l border-white/20"
              style={{ left: `${pct}%` }}
            />
          ))}
          {/* 가로 구분선 (3행) */}
          {[33.3, 66.6].map((pct) => (
            <div
              key={pct}
              className="absolute left-0 right-0 border-t border-white/20"
              style={{ top: `${pct}%` }}
            />
          ))}
          {/* 열 레이블 (상단) */}
          {GRID_COL_LABELS.map((label, i) => (
            <div
              key={label}
              className="absolute top-1 text-[9px] font-bold text-white/50 text-center"
              style={{ left: `${i * 20}%`, width: '20%' }}
            >
              {label}
            </div>
          ))}
          {/* 행 레이블 (우측) */}
          {GRID_ROW_LABELS.map((label, i) => (
            <div
              key={label}
              className="absolute right-1 text-[9px] font-bold text-white/50"
              style={{ top: `${i * 33.3 + 13}%` }}
            >
              {label}
            </div>
          ))}
        </div>
      )}

      {/* 슬롯들 */}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: `FormationSlot.tsx` 생성**

```tsx
import { useNavigate } from 'react-router-dom'
import type { Player, Position } from '@/types/player'
import { POSITION_ABBR } from '@/types/player'
import type { SlotDef } from './formation-layouts'

const DRAG_KEY = 'text/squad-player'

interface FormationSlotProps {
  slotDef: SlotDef
  placedPlayer: Player | null
  suggestedPlayer: Player | null  // getCandidates()[0] or null
  onConfirmSuggestion: (slotKey: string, playerId: string) => void
  onDrop: (toSlotKey: string, playerId: string, fromSlotKey: string | null) => void
  onRemove: (slotKey: string) => void
}

export function FormationSlot({
  slotDef,
  placedPlayer,
  suggestedPlayer,
  onConfirmSuggestion,
  onDrop,
  onRemove,
}: FormationSlotProps) {
  const navigate = useNavigate()
  const style = {
    position: 'absolute' as const,
    top: `${slotDef.top}%`,
    left: `${slotDef.left}%`,
    transform: 'translate(-50%, -50%)',
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData(DRAG_KEY)
    if (!raw) return
    const { playerId, fromSlotKey } = JSON.parse(raw) as { playerId: string; fromSlotKey: string | null }
    onDrop(slotDef.key, playerId, fromSlotKey)
  }

  // 채워진 슬롯
  if (placedPlayer) {
    return (
      <div
        style={style}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ playerId: placedPlayer.id, fromSlotKey: slotDef.key }))
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDoubleClick={() => onRemove(slotDef.key)}
        title="드래그로 이동 / 더블클릭으로 해제"
        className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing z-10"
      >
        <div className="bg-green-800/90 border-2 border-green-400 rounded-full px-2 py-1 text-white text-[10px] font-bold whitespace-nowrap shadow-lg">
          {POSITION_ABBR[placedPlayer.position]}
        </div>
        <div className="bg-green-900/80 border border-green-500/60 rounded px-1.5 py-0.5 text-white text-[9px] whitespace-nowrap max-w-[64px] truncate shadow">
          {placedPlayer.playerName}
        </div>
      </div>
    )
  }

  // 제안 슬롯 (큐 1순위)
  if (suggestedPlayer) {
    return (
      <div
        style={style}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => onConfirmSuggestion(slotDef.key, suggestedPlayer.id)}
        title={`${suggestedPlayer.playerName} 배치 확정`}
        className="flex flex-col items-center gap-0.5 cursor-pointer opacity-60 hover:opacity-90 transition-opacity z-10"
      >
        <div className="bg-green-800/50 border-2 border-dashed border-green-400/70 rounded-full px-2 py-1 text-white/80 text-[10px] font-bold whitespace-nowrap shadow">
          {POSITION_ABBR[suggestedPlayer.position]}
        </div>
        <div className="bg-green-900/40 border border-dashed border-green-500/40 rounded px-1.5 py-0.5 text-white/70 text-[9px] whitespace-nowrap max-w-[64px] truncate">
          {suggestedPlayer.playerName}
        </div>
      </div>
    )
  }

  // 빈 슬롯 (Void)
  return (
    <div
      style={style}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => navigate(`/prospects?position=${slotDef.position}`)}
      title={`${POSITION_ABBR[slotDef.position]} 영입 후보 찾기`}
      className="flex flex-col items-center gap-0.5 cursor-pointer z-10 group"
    >
      <div className="bg-red-900/40 border-2 border-dashed border-red-500 rounded-full w-10 h-10 flex items-center justify-center shadow group-hover:bg-red-900/60 transition-colors">
        <span className="text-red-300 text-xs font-bold">?</span>
      </div>
      <div className="bg-red-900/30 border border-dashed border-red-500/60 rounded px-1.5 py-0.5 text-red-300 text-[9px] font-semibold">
        {POSITION_ABBR[slotDef.position]}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "squad\|error TS"
```

Expected: 출력 없음

- [ ] **Step 4: Commit**

```bash
git add football/src/components/squad/FootballPitch.tsx \
        football/src/components/squad/FormationSlot.tsx
git commit -m "feat(squad): add FootballPitch and FormationSlot components"
```

---

## Task 4: FE 컴포넌트 — PlayerBench

**Files:**
- Create: `football/src/components/squad/PlayerBench.tsx`

- [ ] **Step 1: `PlayerBench.tsx` 생성**

```tsx
import type { Player } from '@/types/player'
import { POSITION_ABBR, POSITION_ZONE, POSITION_LABEL } from '@/types/player'
import type { InjuryStatus } from '@/types/injury'

const DRAG_KEY = 'text/squad-player'

const ZONE_LABEL = { GK: '골키퍼', DEF: '수비', MID: '미드필더', FWD: '공격' } as const
const ZONE_ORDER = ['GK', 'DEF', 'MID', 'FWD'] as const

interface InjuredPlayer {
  playerId: string
  status: InjuryStatus
}

interface PlayerBenchProps {
  availablePlayers: Player[]
  placedIds: Set<string>
  injuredPlayers: InjuredPlayer[]
  allPlayers: Player[]
  onBenchDrop: (playerId: string, fromSlotKey: string) => void
}

function PlayerChip({
  player,
  draggable: isDraggable,
  dim,
}: {
  player: Player
  draggable: boolean
  dim?: boolean
}) {
  return (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable ? (e) => {
        e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ playerId: player.id, fromSlotKey: null }))
        e.dataTransfer.effectAllowed = 'move'
      } : undefined}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${
        dim
          ? 'bg-muted/30 border-border/30 text-muted-foreground cursor-not-allowed'
          : isDraggable
          ? 'bg-card border-border hover:border-green-500 cursor-grab active:cursor-grabbing'
          : 'bg-card border-border text-muted-foreground cursor-default'
      }`}
    >
      <span className="font-mono text-[10px] w-7 text-center shrink-0 text-muted-foreground">
        {POSITION_ABBR[player.position]}
      </span>
      <span className="truncate flex-1">{player.playerName}</span>
    </div>
  )
}

export function PlayerBench({
  availablePlayers,
  placedIds,
  injuredPlayers,
  allPlayers,
  onBenchDrop,
}: PlayerBenchProps) {
  const unplaced = availablePlayers.filter((p) => !placedIds.has(p.id))
  const injuredIds = new Set(injuredPlayers.map((i) => i.playerId))
  const injuredFullPlayers = allPlayers.filter((p) => injuredIds.has(p.id))

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData(DRAG_KEY)
    if (!raw) return
    const { playerId, fromSlotKey } = JSON.parse(raw) as { playerId: string; fromSlotKey: string | null }
    if (fromSlotKey) onBenchDrop(playerId, fromSlotKey)
  }

  return (
    <div
      className="flex flex-col h-full border-l bg-card overflow-y-auto"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="px-3 py-2 border-b shrink-0">
        <p className="text-xs font-semibold text-foreground">벤치</p>
        <p className="text-[10px] text-muted-foreground">{unplaced.length}명 미배치</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {ZONE_ORDER.map((zone) => {
          const zonePlayers = unplaced.filter((p) => POSITION_ZONE[p.position] === zone)
          if (zonePlayers.length === 0) return null
          return (
            <div key={zone}>
              <p className="text-[10px] font-semibold text-muted-foreground px-1 mb-1">
                {ZONE_LABEL[zone]}
              </p>
              <div className="space-y-1">
                {zonePlayers.map((p) => (
                  <PlayerChip key={p.id} player={p} draggable />
                ))}
              </div>
            </div>
          )
        })}

        {injuredFullPlayers.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-red-400 px-1 mb-1">부상</p>
            <div className="space-y-1">
              {injuredFullPlayers.map((p) => (
                <PlayerChip key={p.id} player={p} draggable={false} dim />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "squad\|error TS"
```

Expected: 출력 없음

- [ ] **Step 3: Commit**

```bash
git add football/src/components/squad/PlayerBench.tsx
git commit -m "feat(squad): add PlayerBench component"
```

---

## Task 5: FE 페이지 — SquadPlannerPage

**Files:**
- Create: `football/src/pages/squad/SquadPlannerPage.tsx`

- [ ] **Step 1: `SquadPlannerPage.tsx` 생성**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { playerApi } from '@/services/player.service'
import { injuryApi } from '@/services/injury.service'
import { tacticalApi } from '@/services/tactical.service'
import type { Player } from '@/types/player'
import type { InjuryStatus } from '@/types/injury'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FootballPitch } from '@/components/squad/FootballPitch'
import { FormationSlot } from '@/components/squad/FormationSlot'
import { PlayerBench } from '@/components/squad/PlayerBench'
import {
  FORMATION_LAYOUTS,
  SUPPORTED_FORMATIONS,
  type SupportedFormation,
} from '@/components/squad/formation-layouts'
import { getCandidates, buildInitialPlacement } from '@/components/squad/squad-utils'

type ViewMode = 'formation' | 'grid'

interface ActiveInjury {
  playerId: string
  status: InjuryStatus
}

export function SquadPlannerPage() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [activeInjuries, setActiveInjuries] = useState<ActiveInjury[]>([])
  const [formation, setFormation] = useState<SupportedFormation>('4-3-3')
  const [viewMode, setViewMode] = useState<ViewMode>('formation')
  const [placement, setPlacement] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)

  // 가용 선수: ACTIVE + 비유스 + 부상 아님
  const injuredIds = useMemo(
    () => new Set(activeInjuries.map((i) => i.playerId)),
    [activeInjuries],
  )

  const availablePlayers = useMemo(
    () => allPlayers.filter(
      (p) => p.status === 'ACTIVE' && p.level !== 'YOUTH' && !injuredIds.has(p.id),
    ),
    [allPlayers, injuredIds],
  )

  useEffect(() => {
    Promise.all([
      playerApi.list({ status: 'ACTIVE' }),
      injuryApi.active(),
      tacticalApi.list(),
    ])
      .then(([players, injuries, analyses]) => {
        setAllPlayers(players)
        setActiveInjuries(injuries)
        // 최근 전술 분석의 포메이션을 기본값으로
        const lastFormation = analyses[0]?.formation
        const supported = SUPPORTED_FORMATIONS.find((f) => f === lastFormation)
        if (supported) setFormation(supported)
      })
      .catch(() => toast.error('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  // 포메이션 변경 시 initial placement 재계산
  useEffect(() => {
    if (!loading) {
      const slots = FORMATION_LAYOUTS[formation]
      setPlacement(buildInitialPlacement(slots, availablePlayers))
    }
  }, [formation, loading, availablePlayers])

  const slots = FORMATION_LAYOUTS[formation]

  const placedIds = useMemo(
    () => new Set(Object.values(placement).filter((id): id is string => id !== null)),
    [placement],
  )

  const handleConfirmSuggestion = (slotKey: string, playerId: string) => {
    setPlacement((prev) => ({ ...prev, [slotKey]: playerId }))
  }

  const handleDrop = (toSlotKey: string, playerId: string, fromSlotKey: string | null) => {
    setPlacement((prev) => {
      const next = { ...prev }
      // fromSlot → toSlot: 교체
      if (fromSlotKey) {
        const displaced = next[toSlotKey] ?? null
        next[toSlotKey] = playerId
        next[fromSlotKey] = displaced
      } else {
        // 벤치 → 슬롯: 덮어쓰기 (이전 슬롯 선수 벤치로)
        next[toSlotKey] = playerId
      }
      return next
    })
  }

  const handleRemove = (slotKey: string) => {
    setPlacement((prev) => ({ ...prev, [slotKey]: null }))
  }

  const handleBenchDrop = (_playerId: string, fromSlotKey: string) => {
    setPlacement((prev) => ({ ...prev, [fromSlotKey]: null }))
  }

  const handleFormationChange = (f: string) => {
    setFormation(f as SupportedFormation)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  const filledCount = Object.values(placement).filter(Boolean).length
  const voidCount = slots.length - filledCount

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">팀 빌더</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            가용 {availablePlayers.length}명 &nbsp;·&nbsp; 부상 {injuredIds.size}명
            {voidCount > 0 && (
              <span className="ml-2 text-red-400 font-medium">빈 슬롯 {voidCount}개</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={formation} onValueChange={handleFormationChange}>
            <SelectTrigger className="w-32">
              <SelectValue>{formation}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_FORMATIONS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('formation')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'formation'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              포메이션
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              스페인 그리드
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 피치 */}
        <div className="flex-1 p-4 overflow-auto flex items-start justify-center">
          <div className="w-full max-w-xs">
            <FootballPitch viewMode={viewMode}>
              {slots.map((slotDef) => {
                const placedId = placement[slotDef.key] ?? null
                const placedPlayer = placedId
                  ? (allPlayers.find((p) => p.id === placedId) ?? null)
                  : null
                const suggestedPlayer = placedId
                  ? null
                  : (getCandidates(slotDef.position, availablePlayers, placedIds)[0] ?? null)
                return (
                  <FormationSlot
                    key={slotDef.key}
                    slotDef={slotDef}
                    placedPlayer={placedPlayer}
                    suggestedPlayer={suggestedPlayer}
                    onConfirmSuggestion={handleConfirmSuggestion}
                    onDrop={handleDrop}
                    onRemove={handleRemove}
                  />
                )
              })}
            </FootballPitch>
          </div>
        </div>

        {/* 벤치 패널 */}
        <div className="w-44 shrink-0">
          <PlayerBench
            availablePlayers={availablePlayers}
            placedIds={placedIds}
            injuredPlayers={activeInjuries}
            allPlayers={allPlayers}
            onBenchDrop={handleBenchDrop}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "squad\|error TS"
```

Expected: 출력 없음

- [ ] **Step 3: Commit**

```bash
git add football/src/pages/squad/SquadPlannerPage.tsx
git commit -m "feat(squad): add SquadPlannerPage with formation + grid view"
```

---

## Task 6: FE 배선 — 라우팅 + 네비게이션 + injuryApi + ProspectsPage

**Files:**
- Modify: `football/src/services/injury.service.ts`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/pages/prospects/ProspectsPage.tsx`

- [ ] **Step 1: injury.service.ts에 `active()` 추가**

기존 `injuryApi` 객체에 `active` 메서드 추가:

```typescript
active: () =>
  api.get<{ playerId: string; status: InjuryStatus }[]>('/injuries/active'),
```

`InjuryStatus`는 이미 import되어 있음. 없으면 import 라인에 추가.

- [ ] **Step 2: App.tsx에 `/squad` 라우트 추가**

import 추가:

```typescript
import { SquadPlannerPage } from '@/pages/squad/SquadPlannerPage'
```

라우트 추가 (예: `<Route path="/matches/analysis" ...>` 아래):

```tsx
<Route path="/squad" element={<SquadPlannerPage />} />
```

- [ ] **Step 3: AppShell.tsx 사이드바 메뉴 추가**

`lucide-react` import에 `LayoutGrid` 추가:

```typescript
import {
  // ... 기존 아이콘들 ...
  LayoutGrid,
} from 'lucide-react'
```

`NAV_ITEMS` 배열의 `경기·분석` 섹션 마지막 항목 뒤에 추가:

```typescript
{
  to: '/squad',
  label: '팀 빌더',
  icon: LayoutGrid,
  section: '경기·분석',
  roles: ['ADMIN', 'COACHING_STAFF'],
},
```

- [ ] **Step 4: ProspectsPage.tsx — `useSearchParams` 연동**

`react-router-dom` import에 `useSearchParams` 추가:

```typescript
import { useSearchParams } from 'react-router-dom'
```

`ProspectsPage` 함수 상단에서 `position` state 초기화 변경:

```typescript
// 기존:
const [position, setPosition] = useState<Position | ''>('')

// 변경 후:
const [searchParams] = useSearchParams()
const [position, setPosition] = useState<Position | ''>(
  (searchParams.get('position') as Position) ?? ''
)
```

- [ ] **Step 5: TypeScript 전체 컴파일 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: 출력 없음

- [ ] **Step 6: Commit**

```bash
git add football/src/services/injury.service.ts \
        football/src/App.tsx \
        football/src/layouts/AppShell.tsx \
        football/src/pages/prospects/ProspectsPage.tsx
git commit -m "feat(squad): wire routing, nav, injuryApi.active, prospects position filter"
```

---

## Self-Review

**Spec coverage:**
- ✅ 포메이션 시각화 (FootballPitch + FormationSlot)
- ✅ 가용 선수 필터 (ACTIVE + 비유스 + 비부상)
- ✅ 최근 TacticalAnalysis formation 기본값
- ✅ 빈 슬롯 "Void Effect" (빨간 점선 + "?")
- ✅ 빈 슬롯 클릭 → `/prospects?position=...`
- ✅ 드래그 앤 드롭 (벤치→슬롯, 슬롯→슬롯, 슬롯→벤치)
- ✅ 우선순위 큐 (정확 매칭 → 레벨 → 인접 포지션)
- ✅ 스페인 5×3 그리드 오버레이 토글
- ✅ PlayerBench (포지션존 그룹 + 부상 섹션)
- ✅ `GET /injuries/active` BE 엔드포인트
- ✅ ProspectsPage position 쿼리 파라미터 연동
- ✅ 사이드바 메뉴 추가 (`경기·분석` 섹션)

**Placeholder 없음** — 모든 단계 실제 코드 포함

**Type consistency:**
- `DRAG_KEY = 'text/squad-player'` — FormationSlot과 PlayerBench 양쪽에서 동일하게 사용
- `getCandidates(slotDef.position, availablePlayers, placedIds)` — squad-utils 시그니처와 일치
- `buildInitialPlacement(slots, availablePlayers)` — squad-utils 시그니처와 일치
- `InjuryStatus` import — injury.service.ts와 SquadPlannerPage 모두 `@/types/injury`에서
- `FORMATION_LAYOUTS[formation]` — `SupportedFormation` 타입으로 key 보장
