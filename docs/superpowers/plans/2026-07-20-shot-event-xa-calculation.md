# Shot Event & Auto xA Calculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 경기별 슈팅 이벤트를 기록하고, 이를 바탕으로 PlayerMatchStats의 xG와 xA를 포지션별 가중치를 적용해 자동 계산한다.

**Architecture:** `ShotEvent` 테이블에 슈팅 이벤트(슈터·어시스터·xG·결과·분)를 저장하고, 이벤트가 생성/삭제될 때마다 해당 경기의 `PlayerMatchStats.xG`와 `xA`를 재계산해 업데이트한다. xA는 `shot.xG × XA_WEIGHT[assisterPosition]`으로 산정한다. 멀티 포지션 선수(예: LW 70% + SS 30%)를 위해 `ShotEvent`에 `assisterPositionOverride` 필드를 두어 해당 슈팅 시점의 어시스터 포지션을 명시할 수 있게 한다 — 없으면 선수의 기본 포지션 사용. 프론트엔드는 MatchDetailPage에 슈팅 이벤트 카드를 추가해 ADMIN·COACHING_STAFF가 입력/삭제할 수 있게 한다.

**Tech Stack:** Prisma (PostgreSQL), Express/TypeScript, React + TailwindCSS, Shadcn UI

---

## 멀티 포지션 xA 가중치 공식

```
xA_weighted = Σ (shot.xG × XA_WEIGHT[assisterPositionOverride ?? assister.position])
```

`assisterPositionOverride`가 설정된 경우 (해당 슈팅 시점에 어시스터가 다른 포지션을 맡았을 때) 그 값을 우선 사용. 설정되지 않으면 선수의 등록 포지션으로 자동 폴백.

예: 손흥민이 LW로 어시스트 → xG=0.5 → xA += 0.5 × 1.0 = 0.50  
     손흥민이 SS로 어시스트 → xG=0.6 → xA += 0.6 × 1.1 = 0.66  
     합계 xA = 1.16

---

## xA 포지션별 가중치 (상수)

```typescript
const XA_WEIGHT: Record<string, number> = {
  STRIKER: 0.7,                       // CF: 결정이 주 임무
  SHADOW_STRIKER: 1.1,                // SS/AMF: 기회 창출 주 임무
  WINGER: 1.0,                        // 크로스·어시스트 빈도 높음
  CENTRAL_ATTACK_MIDFIELDER: 1.1,     // 기회 창출 핵심
  RIGHT_ATTACK_MIDFIELDER: 1.0,
  LEFT_ATTACK_MIDFIELDER: 1.0,
  CENTRAL_DEFENSIVE_MIDFIELDER: 0.6,  // 수비 주 임무
  LEFT_DEFENSIVE_MIDFIELDER: 0.6,
  RIGHT_DEFENSIVE_MIDFIELDER: 0.6,
  CENTER_BACK: 0.5,
  LEFT_WING_BACK: 0.5,
  LEFT_FULL_BACK: 0.5,
  RIGHT_WING_BACK: 0.5,
  RIGHT_FULL_BACK: 0.5,
  GOALKEEPER: 0.5,
}
```

---

## 파일 구조

| 역할 | 파일 | 작업 |
|------|------|------|
| DB 스키마 | `apps/api/prisma/schema.prisma` | `ShotResult` enum + `ShotEvent` 모델 추가 |
| DTO | `apps/api/src/match/dto/match.dto.ts` | `CreateShotEventDto` 추가 |
| Repo | `apps/api/src/match/match.repo.ts` | 슈팅 CRUD + `recalculateXgXa` 메서드 추가 |
| Service | `apps/api/src/match/match.service.ts` | 슈팅 서비스 메서드 추가 |
| Controller | `apps/api/src/match/match.controller.ts` | 슈팅 컨트롤러 메서드 추가 |
| Routes | `apps/api/src/match/match.routes.ts` | `/matches/:id/shots` 라우트 추가 |
| FE 타입 | `football/src/types/match.ts` | `ShotEvent` 타입 + `ShotResult` 추가 |
| FE 서비스 | `football/src/services/match.service.ts` | shots API 메서드 추가 |
| FE 페이지 | `football/src/pages/matches/MatchDetailPage.tsx` | 슈팅 이벤트 카드 + AddShotDialog 추가 |

---

## Task 1: Prisma 스키마 — ShotEvent 모델 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `ShotResult` enum과 `ShotEvent` 모델을 schema.prisma에 추가**

`apps/api/prisma/schema.prisma` 안에서 `model TeamMatchStats` 바로 앞에 다음을 삽입:

```prisma
enum ShotResult {
  GOAL
  ON_TARGET
  OFF_TARGET
  BLOCKED
}

model ShotEvent {
  id                     Int        @id @default(autoincrement())
  matchId                Int
  shooterId              String
  assisterId             String?
  assisterPositionOverride String?  // 해당 슈팅 시점 어시스터 포지션 (미설정 시 선수 기본값 사용)
  xG                     Float
  result                 ShotResult
  minute                 Int?

  match    Match   @relation(fields: [matchId], references: [id], onDelete: Cascade)
  shooter  Player  @relation("ShotShooter",  fields: [shooterId],  references: [id])
  assister Player? @relation("ShotAssister", fields: [assisterId], references: [id])
}
```

그리고 `model Match { ... }` 블록 안에 (다른 relation 필드들과 함께):
```prisma
  shotEvents ShotEvent[]
```

그리고 `model Player { ... }` 블록 안에:
```prisma
  shotsAsShooter  ShotEvent[] @relation("ShotShooter")
  shotsAsAssister ShotEvent[] @relation("ShotAssister")
```

- [ ] **Step 2: 마이그레이션 실행**

```bash
cd apps/api
npx prisma migrate dev --name shot_events
```

Expected: `migrations/20260720_shot_events/migration.sql` 생성됨, `✔ Your database is now in sync with your schema.`

- [ ] **Step 3: Prisma 클라이언트 재생성 확인**

```bash
cd apps/api
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(shot-event): add ShotEvent model and ShotResult enum"
```

---

## Task 2: DTO 추가

**Files:**
- Modify: `apps/api/src/match/dto/match.dto.ts`

- [ ] **Step 1: `CreateShotEventDto` 인터페이스를 match.dto.ts에 추가**

`apps/api/src/match/dto/match.dto.ts` 파일 맨 아래에 추가:

```typescript
export type ShotResultType = 'GOAL' | 'ON_TARGET' | 'OFF_TARGET' | 'BLOCKED';
export const VALID_SHOT_RESULTS: ShotResultType[] = ['GOAL', 'ON_TARGET', 'OFF_TARGET', 'BLOCKED'];

export interface CreateShotEventDto {
  shooterId: string;
  assisterId?: string;
  assisterPositionOverride?: string; // 멀티 포지션 선수용 포지션 오버라이드
  xG: number;
  result: ShotResultType;
  minute?: number;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/api/src/match/dto/match.dto.ts
git commit -m "feat(shot-event): add CreateShotEventDto"
```

---

## Task 3: Repo — 슈팅 이벤트 CRUD + xG/xA 재계산

**Files:**
- Modify: `apps/api/src/match/match.repo.ts`

- [ ] **Step 1: XA_WEIGHT 상수와 슈팅 메서드를 match.repo.ts에 추가**

`apps/api/src/match/match.repo.ts` 파일 상단 import 직후, `MatchRepository` 클래스 선언 바로 위에 상수 추가:

```typescript
const XA_WEIGHT: Record<string, number> = {
  STRIKER: 0.7,
  SHADOW_STRIKER: 1.1,
  WINGER: 1.0,
  CENTRAL_ATTACK_MIDFIELDER: 1.1,
  RIGHT_ATTACK_MIDFIELDER: 1.0,
  LEFT_ATTACK_MIDFIELDER: 1.0,
  CENTRAL_DEFENSIVE_MIDFIELDER: 0.6,
  LEFT_DEFENSIVE_MIDFIELDER: 0.6,
  RIGHT_DEFENSIVE_MIDFIELDER: 0.6,
  CENTER_BACK: 0.5,
  LEFT_WING_BACK: 0.5,
  LEFT_FULL_BACK: 0.5,
  RIGHT_WING_BACK: 0.5,
  RIGHT_FULL_BACK: 0.5,
  GOALKEEPER: 0.5,
}
```

그리고 `MatchRepository` 클래스 맨 아래 `upsertTeamStats` 다음에 추가:

```typescript
  findShotEvents(matchId: number) {
    return this.prisma.shotEvent.findMany({
      where: { matchId },
      include: {
        shooter:  { select: { id: true, playerName: true, position: true } },
        assister: { select: { id: true, playerName: true, position: true } },
      },
      orderBy: [{ minute: 'asc' }, { id: 'asc' }],
    });
  }

  createShotEvent(matchId: number, dto: CreateShotEventDto) {
    return this.prisma.shotEvent.create({
      data: {
        matchId,
        shooterId:               dto.shooterId,
        assisterId:              dto.assisterId ?? null,
        assisterPositionOverride: dto.assisterPositionOverride ?? null,
        xG:                      dto.xG,
        result:                  dto.result as import('../generated/enums').ShotResult,
        minute:                  dto.minute ?? null,
      },
      include: {
        shooter:  { select: { id: true, playerName: true, position: true } },
        assister: { select: { id: true, playerName: true, position: true } },
      },
    });
  }

  deleteShotEvent(id: number) {
    return this.prisma.shotEvent.delete({ where: { id } });
  }

  async recalculateXgXa(matchId: number): Promise<void> {
    const shots = await this.prisma.shotEvent.findMany({
      where: { matchId },
      include: {
        shooter:  { select: { id: true, position: true } },
        assister: { select: { id: true, position: true } },
      },
    });

    const xgMap: Record<string, number> = {};
    const xaMap: Record<string, number> = {};

    for (const shot of shots) {
      xgMap[shot.shooterId] = (xgMap[shot.shooterId] ?? 0) + shot.xG;
      if (shot.assisterId && shot.assister) {
        // 포지션 오버라이드 → 멀티 포지션 선수 지원 (없으면 등록 포지션 폴백)
        const effectivePosition = shot.assisterPositionOverride ?? shot.assister.position;
        const weight = XA_WEIGHT[effectivePosition] ?? 0.7;
        xaMap[shot.assisterId] = (xaMap[shot.assisterId] ?? 0) + shot.xG * weight;
      }
    }

    const playerIds = new Set([...Object.keys(xgMap), ...Object.keys(xaMap)]);
    for (const playerId of playerIds) {
      const stat = await this.prisma.playerMatchStats.findFirst({ where: { matchId, playerId } });
      if (stat) {
        await this.prisma.playerMatchStats.update({
          where: { id: stat.id },
          data: {
            xG: xgMap[playerId] != null ? Math.round(xgMap[playerId] * 100) / 100 : null,
            xA: xaMap[playerId] != null ? Math.round(xaMap[playerId] * 100) / 100 : null,
          },
        });
      }
    }
  }
```

import 추가 (파일 상단):
```typescript
import { CreateShotEventDto } from "./dto/match.dto";
```

- [ ] **Step 2: API 서버 기동 확인 (타입 에러 없는지)**

```bash
cd apps/api
npx ts-node-dev --transpile-only src/server.ts &
# 3초 후 Ctrl+C 또는 lsof -ti:3001 | xargs kill
```

Expected: 타입 에러 없이 기동

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/match/match.repo.ts
git commit -m "feat(shot-event): add repo methods for shot events and xG/xA recalculation"
```

---

## Task 4: Service + Controller + Routes

**Files:**
- Modify: `apps/api/src/match/match.service.ts`
- Modify: `apps/api/src/match/match.controller.ts`
- Modify: `apps/api/src/match/match.routes.ts`

- [ ] **Step 1: match.service.ts에 슈팅 서비스 메서드 추가**

import에 `CreateShotEventDto`, `VALID_SHOT_RESULTS` 추가:
```typescript
import {
  CreateMatchDto, UpdateMatchDto, MatchListQuery,
  UpsertPlayerStatsDto, UpsertTeamStatsDto, VALID_COMPETITION_TYPES,
  CreateShotEventDto, VALID_SHOT_RESULTS,
} from "./dto/match.dto";
```

`MatchService` 클래스 맨 아래에 추가:
```typescript
  getShotEvents(matchId: number) {
    return this.repo.findShotEvents(matchId);
  }

  async createShotEvent(matchId: number, dto: CreateShotEventDto) {
    const match = await this.repo.findById(matchId);
    if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
    if (!VALID_SHOT_RESULTS.includes(dto.result)) throw new AppError(400, "INVALID_SHOT_RESULT");
    if (typeof dto.xG !== 'number' || dto.xG < 0 || dto.xG > 1) {
      throw new AppError(400, "INVALID_XG_VALUE");
    }
    const event = await this.repo.createShotEvent(matchId, dto);
    await this.repo.recalculateXgXa(matchId);
    return event;
  }

  async deleteShotEvent(matchId: number, eventId: number) {
    await this.repo.deleteShotEvent(eventId);
    await this.repo.recalculateXgXa(matchId);
  }
```

- [ ] **Step 2: match.controller.ts에 슈팅 컨트롤러 메서드 추가**

`MatchController` 클래스 맨 아래에 추가:
```typescript
  getShotEvents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getShotEvents(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  createShotEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!STATS_ROLES.includes(req.user!.role as StatsRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createShotEvent(Number(req.params["id"]), req.body));
    } catch (err) {
      next(err);
    }
  };

  deleteShotEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!STATS_ROLES.includes(req.user!.role as StatsRole)) throw new AppError(403, "FORBIDDEN");
      await this.service.deleteShotEvent(Number(req.params["id"]), Number(req.params["eventId"]));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
```

- [ ] **Step 3: match.routes.ts에 슈팅 라우트 추가**

`export default router;` 바로 위에 추가:
```typescript
// 슈팅 이벤트 (조회는 모두, 생성/삭제는 ADMIN·COACHING_STAFF)
router.get("/:id/shots",               auth, controller.getShotEvents);
router.post("/:id/shots",              auth, controller.createShotEvent);
router.delete("/:id/shots/:eventId",   auth, controller.deleteShotEvent);
```

- [ ] **Step 4: 수동 테스트**

```bash
# 서버 실행 상태에서
TOKEN="..." # 로그인 후 토큰
curl -X POST http://localhost:3001/matches/1/shots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shooterId":"<player-id>","xG":0.45,"result":"GOAL"}'
```

Expected: 201 + ShotEvent JSON 반환, DB의 PlayerMatchStats.xG 업데이트됨

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/match/match.service.ts \
        apps/api/src/match/match.controller.ts \
        apps/api/src/match/match.routes.ts
git commit -m "feat(shot-event): add shot event API endpoints with xG/xA recalculation"
```

---

## Task 5: 프론트엔드 타입 + 서비스

**Files:**
- Modify: `football/src/types/match.ts`
- Modify: `football/src/services/match.service.ts`

- [ ] **Step 1: `ShotEvent` 타입을 match.ts에 추가**

`football/src/types/match.ts` 파일 안에 `MatchDetail` interface 바로 위에 추가:

```typescript
export type ShotResult = 'GOAL' | 'ON_TARGET' | 'OFF_TARGET' | 'BLOCKED'

export const SHOT_RESULT_LABEL: Record<ShotResult, string> = {
  GOAL:       '골',
  ON_TARGET:  '유효슈팅',
  OFF_TARGET: '빗나감',
  BLOCKED:    '블록',
}

export const SHOT_RESULT_STYLE: Record<ShotResult, string> = {
  GOAL:       'bg-emerald-100 text-emerald-800 border-emerald-200',
  ON_TARGET:  'bg-blue-100 text-blue-800 border-blue-200',
  OFF_TARGET: 'bg-slate-100 text-slate-600 border-slate-200',
  BLOCKED:    'bg-orange-100 text-orange-800 border-orange-200',
}

export interface ShotEvent {
  id:                      number
  matchId:                 number
  xG:                      number
  result:                  ShotResult
  minute:                  number | null
  assisterPositionOverride: string | null
  shooter:                 { id: string; playerName: string; position: string }
  assister:                { id: string; playerName: string; position: string } | null
}
```

그리고 `MatchDetail` interface에 `shotEvents` 필드 추가:
```typescript
export interface MatchDetail extends Match {
  playerMatchStats: PlayerMatchStat[]
  teamMatchStats: TeamMatchStat | null
  shotEvents?: ShotEvent[]   // <- 추가
}
```

- [ ] **Step 2: `matchApi`에 shots 메서드 추가**

`football/src/services/match.service.ts`의 `matchApi` 객체 맨 아래 (마지막 메서드 다음, `}` 닫기 전)에 추가:

```typescript
  getShots: (matchId: number) =>
    api.get<ShotEvent[]>(`/matches/${matchId}/shots`),

  createShot: (
    matchId: number,
    payload: {
      shooterId: string
      assisterId?: string
      assisterPositionOverride?: string
      xG: number
      result: ShotResult
      minute?: number
    },
  ) => api.post<ShotEvent>(`/matches/${matchId}/shots`, payload),

  deleteShot: (matchId: number, eventId: number) =>
    api.delete(`/matches/${matchId}/shots/${eventId}`),
```

import에 타입 추가:
```typescript
import type { Match, MatchDetail, CompetitionType, ShotEvent, ShotResult } from '@/types/match'
```

- [ ] **Step 3: 커밋**

```bash
git add football/src/types/match.ts football/src/services/match.service.ts
git commit -m "feat(shot-event): add frontend types and API service methods"
```

---

## Task 6: MatchDetailPage — 슈팅 이벤트 카드 + AddShotDialog

**Files:**
- Modify: `football/src/pages/matches/MatchDetailPage.tsx`

MatchDetailPage는 현재 765줄이다. 이 Task에서:
1. `shotEvents` 상태와 fetch 로직 추가
2. `AddShotDialog` 컴포넌트 추가 (파일 내 local component)
3. "슈팅 이벤트" 카드를 "선수 기록" 카드 바로 앞에 삽입

- [ ] **Step 1: import 추가**

`MatchDetailPage.tsx` 상단 import 블록에 추가:
```typescript
import type { ShotEvent, ShotResult } from '@/types/match'
import { SHOT_RESULT_LABEL, SHOT_RESULT_STYLE } from '@/types/match'
import { Trash2, Plus } from 'lucide-react'
```

- [ ] **Step 2: `shotEvents` 상태 및 fetch 로직 추가**

`MatchDetailPage` 함수 내 다른 `useState` 선언들과 함께 추가:
```typescript
const [shotEvents, setShotEvents] = useState<ShotEvent[]>([])
const [shotOpen, setShotOpen] = useState(false)
const [deletingShot, setDeletingShot] = useState<number | null>(null)
```

`fetchMatch` 함수가 호출된 후 (또는 `useEffect` 안에서 `fetchMatch()` 호출 다음 라인에 별도 fetch 추가):
```typescript
const fetchShots = () => {
  if (!id) return
  matchApi.getShots(Number(id))
    .then(setShotEvents)
    .catch(() => {})
}
```

`useEffect` 안에서 `fetchMatch()` 호출 다음에 `fetchShots()` 추가:
```typescript
useEffect(() => {
  fetchMatch()
  fetchShots()
}, [id])
```

`handleDeleteShot`:
```typescript
const handleDeleteShot = async (eventId: number) => {
  setDeletingShot(eventId)
  try {
    await matchApi.deleteShot(Number(id), eventId)
    fetchShots()
    fetchMatch()  // xG/xA 업데이트 반영
    toast.success('슈팅 이벤트가 삭제되었습니다.')
  } catch {
    toast.error('삭제에 실패했습니다.')
  } finally {
    setDeletingShot(null)
  }
}
```

- [ ] **Step 3: `AddShotDialog` 컴포넌트를 `MatchDetailPage` 함수 위에 추가**

`MatchDetailPage` 함수 선언 바로 위 (파일 중반부, `PlayerRadar` 함수 아래)에:

```typescript
const SHOT_RESULTS: ShotResult[] = ['GOAL', 'ON_TARGET', 'OFF_TARGET', 'BLOCKED']

const POSITIONS_FOR_XA = [
  'STRIKER','SHADOW_STRIKER','WINGER',
  'CENTRAL_ATTACK_MIDFIELDER','RIGHT_ATTACK_MIDFIELDER','LEFT_ATTACK_MIDFIELDER',
  'CENTRAL_DEFENSIVE_MIDFIELDER','LEFT_DEFENSIVE_MIDFIELDER','RIGHT_DEFENSIVE_MIDFIELDER',
  'CENTER_BACK','LEFT_WING_BACK','LEFT_FULL_BACK','RIGHT_WING_BACK','RIGHT_FULL_BACK','GOALKEEPER',
] as const

function AddShotDialog({
  open,
  onOpenChange,
  matchId,
  players,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  matchId: number
  players: { id: string; playerName: string; position: string }[]
  onSaved: () => void
}) {
  const [shooterId, setShooterId] = useState('')
  const [assisterId, setAssisterId] = useState('')
  const [assisterPositionOverride, setAssisterPositionOverride] = useState('')
  const [xG, setXg] = useState('')
  const [result, setResult] = useState<ShotResult>('ON_TARGET')
  const [minute, setMinute] = useState('')
  const [saving, setSaving] = useState(false)

  const assisterDefaultPos = players.find(p => p.id === assisterId)?.position ?? ''

  const reset = () => {
    setShooterId(''); setAssisterId(''); setAssisterPositionOverride('')
    setXg(''); setResult('ON_TARGET'); setMinute('')
  }

  const handleSave = async () => {
    if (!shooterId) { toast.error('슈터를 선택하세요.'); return }
    const xgVal = parseFloat(xG)
    if (isNaN(xgVal) || xgVal < 0 || xgVal > 1) { toast.error('xG는 0~1 사이 숫자를 입력하세요.'); return }
    setSaving(true)
    try {
      await matchApi.createShot(matchId, {
        shooterId,
        assisterId: assisterId || undefined,
        assisterPositionOverride:
          assisterId && assisterPositionOverride && assisterPositionOverride !== assisterDefaultPos
            ? assisterPositionOverride
            : undefined,
        xG: xgVal,
        result,
        minute: minute ? Number(minute) : undefined,
      })
      toast.success('슈팅 이벤트가 저장되었습니다.')
      reset()
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">슈팅 이벤트 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">슈터 *</Label>
            <Select value={shooterId} onValueChange={setShooterId}>
              <SelectTrigger className="h-8 text-sm">
                {shooterId
                  ? <span>{players.find(p => p.id === shooterId)?.playerName ?? shooterId}</span>
                  : <span className="text-muted-foreground">선수 선택</span>}
              </SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">어시스터</Label>
            <Select value={assisterId} onValueChange={(v) => { setAssisterId(v); setAssisterPositionOverride('') }}>
              <SelectTrigger className="h-8 text-sm">
                {assisterId
                  ? <span>{players.find(p => p.id === assisterId)?.playerName ?? assisterId}</span>
                  : <span className="text-muted-foreground">없음</span>}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">없음</SelectItem>
                {players.filter(p => p.id !== shooterId).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {assisterId && (
            <div className="space-y-1">
              <Label className="text-xs">
                어시스터 포지션 오버라이드
                <span className="ml-1 text-muted-foreground font-normal">(기본: {POSITION_ABBR[assisterDefaultPos as Position] ?? assisterDefaultPos})</span>
              </Label>
              <Select
                value={assisterPositionOverride || assisterDefaultPos}
                onValueChange={setAssisterPositionOverride}
              >
                <SelectTrigger className="h-8 text-sm">
                  <span>{POSITION_ABBR[(assisterPositionOverride || assisterDefaultPos) as Position] ?? (assisterPositionOverride || assisterDefaultPos)}</span>
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS_FOR_XA.map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      <span className="font-mono text-xs">{POSITION_ABBR[pos as Position]}</span>
                      <span className="ml-2 text-muted-foreground">{POSITION_LABEL[pos as Position]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">xG (0~1) *</Label>
              <Input
                className="h-8 text-sm"
                placeholder="0.35"
                value={xG}
                onChange={(e) => setXg(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">분 (선택)</Label>
              <Input
                className="h-8 text-sm"
                placeholder="67"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">결과 *</Label>
            <Select value={result} onValueChange={(v) => setResult(v as ShotResult)}>
              <SelectTrigger className="h-8 text-sm">
                <span>{SHOT_RESULT_LABEL[result]}</span>
              </SelectTrigger>
              <SelectContent>
                {SHOT_RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>{SHOT_RESULT_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" disabled={saving} onClick={handleSave}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: "슈팅 이벤트" 카드를 JSX에 삽입**

`{/* 선수 기록 */}` 주석 바로 위 (현재 line 666)에 다음 카드 삽입:

```tsx
{/* 슈팅 이벤트 */}
{(shotEvents.length > 0 || canInputStats) && (
  <div className="rounded-xl border bg-white p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">슈팅 이벤트</div>
      {canInputStats && (
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setShotOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />추가
        </Button>
      )}
    </div>
    {shotEvents.length === 0 ? (
      <p className="text-xs text-slate-400 text-center py-2">슈팅 이벤트가 없습니다.</p>
    ) : (
      <div className="space-y-1.5">
        {shotEvents.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-400 w-6 text-right shrink-0">
              {e.minute != null ? `${e.minute}'` : '—'}
            </span>
            <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${SHOT_RESULT_STYLE[e.result]}`}>
              {SHOT_RESULT_LABEL[e.result]}
            </span>
            <span className="font-medium text-slate-800 shrink-0">{e.shooter.playerName}</span>
            {e.assister && (
              <span className="text-slate-400">→ {e.assister.playerName}</span>
            )}
            <span className="ml-auto text-slate-400 shrink-0">xG {e.xG.toFixed(2)}</span>
            {canInputStats && (
              <button
                className="text-slate-300 hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
                disabled={deletingShot === e.id}
                onClick={() => handleDeleteShot(e.id)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: `AddShotDialog` 마운트 추가**

`{match && ( <> ... </> )}` 블록 안에 기존 다이얼로그들과 함께 추가:

```tsx
{canInputStats && match && (
  <AddShotDialog
    open={shotOpen}
    onOpenChange={setShotOpen}
    matchId={match.id}
    players={match.playerMatchStats.map(s => s.player as { id: string; playerName: string; position: string })}
    onSaved={() => { fetchShots(); fetchMatch() }}
  />
)}
```

- [ ] **Step 6: 개발 서버에서 동작 확인**

```bash
cd football
npm run dev
```

1. 경기 상세 페이지 접속
2. "슈팅 이벤트" 카드 보이는지 확인
3. "추가" 버튼 클릭 → 다이얼로그에서 슈터/xG/결과 입력 후 저장
4. 이벤트 리스트에 표시되는지, 선수 기록의 xG가 업데이트되는지 확인
5. 삭제 버튼으로 이벤트 삭제 → xG 재계산 확인
6. 어시스터가 있는 슈팅 저장 → StatsTab에서 해당 선수 xA 값 업데이트 확인

- [ ] **Step 7: 커밋**

```bash
git add football/src/pages/matches/MatchDetailPage.tsx
git commit -m "feat(shot-event): add shot event card and AddShotDialog to MatchDetailPage"
```

---

## Self-Review

**Spec coverage:**
- [x] ShotEvent 테이블 (matchId, shooterId, assisterId?, xG, result, minute?) → Task 1
- [x] 포지션별 xA 가중치 테이블 → Task 3 (XA_WEIGHT 상수)
- [x] 이벤트 저장 시 xG/xA 자동 재계산 → Task 3 (`recalculateXgXa`), Task 4 (서비스에서 create/delete 후 호출)
- [x] 슈팅 조회/생성/삭제 API → Task 4
- [x] FE 타입/서비스 → Task 5
- [x] MatchDetailPage 슈팅 이벤트 카드 → Task 6
- [x] 삭제 후 xG/xA 재계산 → `handleDeleteShot`에서 `fetchMatch()` 재호출

**Placeholder scan:** 없음 — 모든 스텝에 실제 코드 포함.

**Type consistency:**
- `ShotEvent` 타입 (FE): Task 5 정의, Task 6에서 사용 ✓
- `ShotResult` 타입: Task 5 정의, `SHOT_RESULT_LABEL/STYLE` 사용 ✓
- `matchApi.getShots/createShot/deleteShot`: Task 5 정의, Task 6에서 호출 ✓
- `AddShotDialog` props: `matchId: number`, `players`, `onSaved` — Task 6에서 일치 ✓
- `recalculateXgXa(matchId)`: Task 3 Repo, Task 4 Service에서 호출 ✓
