# Match Starting Lineup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 경기별 포메이션·선발·후보 라인업을 COACHING_STAFF/HEAD_COACH가 구성하고, HEAD_COACH가 확정하는 기능을 BE부터 FE까지 구현한다.

**Architecture:** BE는 MatchLineup + LineupSlot 두 테이블 신규 추가. PUT /:id/lineup은 트랜잭션으로 기존 슬롯 전체 삭제 후 재생성(replace). FE는 기존 FootballPitch 컴포넌트를 재사용하고 HTML5 native drag & drop으로 선수를 슬롯에 배치한다.

**Tech Stack:** Express + Prisma (BE), React + HTML5 DnD + 기존 squad 컴포넌트 재사용 (FE), Jest (테스트)

---

## File Structure

**BE (신규)**
- `apps/api/src/match/dto/lineup.dto.ts` — SaveLineupDto, LineupSlotDto
- `apps/api/src/match/match.lineup.repo.ts` — Prisma 쿼리
- `apps/api/src/match/match.lineup.service.ts` — 비즈니스 로직
- `apps/api/src/match/match.lineup.controller.ts` — HTTP 핸들러

**BE (수정)**
- `apps/api/prisma/schema.prisma` — MatchLineup + LineupSlot 모델 추가, 관계 추가
- `apps/api/src/match/match.routes.ts` — lineup 라우트 등록

**테스트 (신규)**
- `apps/api/__test__/match/match.lineup.service.test.ts`

**FE (신규)**
- `football/src/types/lineup.ts`
- `football/src/services/lineup.service.ts`

**FE (수정)**
- `football/src/pages/matches/MatchLineupPage.tsx` — 플레이스홀더 → 실제 구현

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: Match 모델 끝에 lineup 관계 추가**

`apps/api/prisma/schema.prisma`의 Match 모델 (line ~744)에서 `shotEvents ShotEvent[]` 다음 줄에 추가:

```prisma
  matchLineup      MatchLineup?
```

- [x] **Step 2: Player 모델에 lineupSlots 관계 추가**

Player 모델에 `matchSquads MatchSquad[]` 줄 다음에 추가:

```prisma
  lineupSlots      LineupSlot[]
```

- [x] **Step 3: User 모델에 lineupConfirmations 관계 추가**

User 모델에 `squadConfirmations MatchSquad[]` 줄 다음에 추가:

```prisma
  lineupConfirmations MatchLineup[] @relation("LineupConfirmations")
```

- [x] **Step 4: MatchLineup + LineupSlot 모델 추가**

`schema.prisma` 파일 끝 (MatchSquad 모델 이후)에 추가:

```prisma
model MatchLineup {
  id            Int        @id @default(autoincrement())
  matchId       Int        @unique
  formation     String
  isConfirmed   Boolean    @default(false)
  confirmedAt   DateTime?
  confirmedById Int?

  match       Match       @relation(fields: [matchId], references: [id])
  confirmedBy User?       @relation("LineupConfirmations", fields: [confirmedById], references: [id])
  slots       LineupSlot[]

  @@index([matchId])
}

model LineupSlot {
  id        Int     @id @default(autoincrement())
  lineupId  Int
  playerId  String
  slotKey   String
  isStarter Boolean @default(true)

  lineup  MatchLineup @relation(fields: [lineupId], references: [id], onDelete: Cascade)
  player  Player      @relation(fields: [playerId], references: [id])

  @@unique([lineupId, slotKey])
  @@unique([lineupId, playerId])
  @@index([lineupId])
}
```

- [x] **Step 5: Migration 실행**

```bash
cd apps/api && npx prisma migrate dev --name add_match_lineup
```

Expected: `✔ Generated Prisma Client` 출력, 에러 없음.

- [x] **Step 6: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(lineup): MatchLineup + LineupSlot 스키마 추가"
```

---

### Task 2: BE DTO

**Files:**
- Create: `apps/api/src/match/dto/lineup.dto.ts`

- [x] **Step 1: DTO 파일 작성**

```typescript
// apps/api/src/match/dto/lineup.dto.ts

export interface LineupSlotDto {
  playerId: string;
  slotKey: string;
  isStarter: boolean;
}

export interface SaveLineupDto {
  formation: string;
  slots: LineupSlotDto[];
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/match/dto/lineup.dto.ts
git commit -m "feat(lineup): lineup DTO 추가"
```

---

### Task 3: BE Service (TDD)

**Files:**
- Create: `apps/api/__test__/match/match.lineup.service.test.ts`
- Create: `apps/api/src/match/match.lineup.service.ts`

- [x] **Step 1: 실패 테스트 작성**

```typescript
// apps/api/__test__/match/match.lineup.service.test.ts
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { MatchLineupService } from "../../src/match/match.lineup.service";

const mockRepo = {
  findByMatch: jest.fn<() => Promise<any>>(),
  saveLineup: jest.fn<() => Promise<any>>(),
  confirmLineup: jest.fn<() => Promise<any>>(),
} as any;

const service = new MatchLineupService(mockRepo);

const validDto = {
  formation: "4-3-3",
  slots: [
    { playerId: "p1", slotKey: "GK", isStarter: true },
    { playerId: "p2", slotKey: "LB", isStarter: true },
  ],
};

describe("MatchLineupService - saveLineup", () => {
  beforeEach(() => jest.clearAllMocks());

  test("유효한 dto로 저장 성공 시 repo.saveLineup 호출", async () => {
    mockRepo.saveLineup.mockResolvedValue({ id: 1, matchId: 10, formation: "4-3-3", slots: [] });
    await service.saveLineup(10, validDto);
    expect(mockRepo.saveLineup).toHaveBeenCalledWith(10, validDto);
  });

  test("지원하지 않는 포메이션이면 400 INVALID_FORMATION", async () => {
    await expect(service.saveLineup(10, { ...validDto, formation: "3-3-3" }))
      .rejects.toMatchObject({ statusCode: 400, message: "INVALID_FORMATION" });
    expect(mockRepo.saveLineup).not.toHaveBeenCalled();
  });

  test("중복 playerId면 409 DUPLICATE_PLAYER", async () => {
    const dto = {
      formation: "4-3-3",
      slots: [
        { playerId: "p1", slotKey: "GK", isStarter: true },
        { playerId: "p1", slotKey: "LB", isStarter: true },
      ],
    };
    await expect(service.saveLineup(10, dto))
      .rejects.toMatchObject({ statusCode: 409, message: "DUPLICATE_PLAYER" });
  });

  test("중복 slotKey면 409 DUPLICATE_SLOT", async () => {
    const dto = {
      formation: "4-3-3",
      slots: [
        { playerId: "p1", slotKey: "GK", isStarter: true },
        { playerId: "p2", slotKey: "GK", isStarter: true },
      ],
    };
    await expect(service.saveLineup(10, dto))
      .rejects.toMatchObject({ statusCode: 409, message: "DUPLICATE_SLOT" });
  });
});

describe("MatchLineupService - confirmLineup", () => {
  beforeEach(() => jest.clearAllMocks());

  test("라인업 없으면 404 LINEUP_NOT_FOUND", async () => {
    mockRepo.findByMatch.mockResolvedValue(null);
    await expect(service.confirmLineup(10, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "LINEUP_NOT_FOUND" });
    expect(mockRepo.confirmLineup).not.toHaveBeenCalled();
  });

  test("라인업 있으면 confirmLineup 호출 성공", async () => {
    mockRepo.findByMatch.mockResolvedValue({ id: 1, matchId: 10 });
    mockRepo.confirmLineup.mockResolvedValue({ id: 1, isConfirmed: true });
    await service.confirmLineup(10, 5);
    expect(mockRepo.confirmLineup).toHaveBeenCalledWith(10, 5);
  });
});
```

- [x] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage
```

Expected: `Cannot find module '../../src/match/match.lineup.service'`

- [x] **Step 3: Service 구현**

```typescript
// apps/api/src/match/match.lineup.service.ts
import { MatchLineupRepository } from "./match.lineup.repo";
import { AppError } from "../lib/appError";
import type { SaveLineupDto } from "./dto/lineup.dto";

const SUPPORTED_FORMATIONS = [
  "4-3-3", "4-4-2", "4-2-3-1", "4-1-4-1",
  "3-5-2", "3-4-3", "5-3-2", "5-4-1",
];

export class MatchLineupService {
  constructor(private repo: MatchLineupRepository) {}

  getLineup(matchId: number) {
    return this.repo.findByMatch(matchId);
  }

  saveLineup(matchId: number, dto: SaveLineupDto) {
    if (!SUPPORTED_FORMATIONS.includes(dto.formation)) {
      throw new AppError(400, "INVALID_FORMATION");
    }
    const playerIds = dto.slots.map((s) => s.playerId);
    if (new Set(playerIds).size !== playerIds.length) {
      throw new AppError(409, "DUPLICATE_PLAYER");
    }
    const slotKeys = dto.slots.map((s) => s.slotKey);
    if (new Set(slotKeys).size !== slotKeys.length) {
      throw new AppError(409, "DUPLICATE_SLOT");
    }
    return this.repo.saveLineup(matchId, dto);
  }

  async confirmLineup(matchId: number, confirmedById: number) {
    const lineup = await this.repo.findByMatch(matchId);
    if (!lineup) throw new AppError(404, "LINEUP_NOT_FOUND");
    return this.repo.confirmLineup(matchId, confirmedById);
  }
}
```

- [x] **Step 4: 테스트 실행 — PASS 확인**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage
```

Expected: `Tests: 5 passed, 5 total`

- [x] **Step 5: Commit**

```bash
git add apps/api/src/match/match.lineup.service.ts apps/api/__test__/match/match.lineup.service.test.ts
git commit -m "feat(lineup): MatchLineupService 구현 + 테스트"
```

---

### Task 4: BE Repo

**Files:**
- Create: `apps/api/src/match/match.lineup.repo.ts`

- [x] **Step 1: Repo 작성**

```typescript
// apps/api/src/match/match.lineup.repo.ts
import { PrismaClient } from "../generated/client";
import type { SaveLineupDto } from "./dto/lineup.dto";

const PLAYER_SELECT = { id: true, playerName: true, position: true } as const;

export class MatchLineupRepository {
  constructor(private prisma: PrismaClient) {}

  findByMatch(matchId: number) {
    return this.prisma.matchLineup.findUnique({
      where: { matchId },
      include: {
        slots: {
          include: { player: { select: PLAYER_SELECT } },
        },
      },
    });
  }

  async saveLineup(matchId: number, dto: SaveLineupDto) {
    return this.prisma.$transaction(async (tx) => {
      const lineup = await tx.matchLineup.upsert({
        where: { matchId },
        create: { matchId, formation: dto.formation },
        update: { formation: dto.formation },
      });
      await tx.lineupSlot.deleteMany({ where: { lineupId: lineup.id } });
      if (dto.slots.length > 0) {
        await tx.lineupSlot.createMany({
          data: dto.slots.map((s) => ({
            lineupId: lineup.id,
            playerId: s.playerId,
            slotKey: s.slotKey,
            isStarter: s.isStarter,
          })),
        });
      }
      return tx.matchLineup.findUnique({
        where: { id: lineup.id },
        include: {
          slots: {
            include: { player: { select: PLAYER_SELECT } },
          },
        },
      });
    });
  }

  confirmLineup(matchId: number, confirmedById: number) {
    return this.prisma.matchLineup.update({
      where: { matchId },
      data: { isConfirmed: true, confirmedAt: new Date(), confirmedById },
    });
  }
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/match/match.lineup.repo.ts
git commit -m "feat(lineup): MatchLineupRepository 구현"
```

---

### Task 5: BE Controller + Routes

**Files:**
- Create: `apps/api/src/match/match.lineup.controller.ts`
- Modify: `apps/api/src/match/match.routes.ts`

- [x] **Step 1: Controller 작성**

```typescript
// apps/api/src/match/match.lineup.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { MatchLineupService } from "./match.lineup.service";
import type { SaveLineupDto } from "./dto/lineup.dto";

const EDIT_ROLES = ["ADMIN", "COACHING_STAFF", "HEAD_COACH"] as const;
const CONFIRM_ROLES = ["ADMIN", "HEAD_COACH"] as const;

export class MatchLineupController {
  constructor(private service: MatchLineupService) {}

  getLineup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matchId = Number(req.params["id"]);
      const lineup = await this.service.getLineup(matchId);
      res.json(lineup ?? null);
    } catch (err) { next(err); }
  };

  saveLineup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!EDIT_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["id"]);
      const dto = req.body as SaveLineupDto;
      const result = await this.service.saveLineup(matchId, dto);
      res.json(result);
    } catch (err) { next(err); }
  };

  confirmLineup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CONFIRM_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["id"]);
      const result = await this.service.confirmLineup(matchId, req.user!.id);
      res.json(result);
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 2: match.routes.ts에 lineup 라우트 등록**

`apps/api/src/match/match.routes.ts`에서 import 블록 끝 (getPrisma import 위)에 추가:

```typescript
import { MatchLineupRepository } from "./match.lineup.repo";
import { MatchLineupService } from "./match.lineup.service";
import { MatchLineupController } from "./match.lineup.controller";
```

그리고 `export default router;` 바로 위에 추가:

```typescript
const lineupRepo = new MatchLineupRepository(getPrisma());
const lineupService = new MatchLineupService(lineupRepo);
const lineupController = new MatchLineupController(lineupService);

router.get("/:id/lineup", auth, lineupController.getLineup);
router.put("/:id/lineup", auth, lineupController.saveLineup);
router.post("/:id/lineup/confirm", auth, lineupController.confirmLineup);
```

- [x] **Step 3: 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 에러 없음.

- [x] **Step 4: Commit**

```bash
git add apps/api/src/match/match.lineup.controller.ts apps/api/src/match/match.routes.ts
git commit -m "feat(lineup): lineup 컨트롤러 + 라우트 등록"
```

---

### Task 6: FE Types + Service

**Files:**
- Create: `football/src/types/lineup.ts`
- Create: `football/src/services/lineup.service.ts`

- [x] **Step 1: 타입 정의**

```typescript
// football/src/types/lineup.ts
import type { SupportedFormation } from '@/components/squad/formation-layouts'

export interface LineupPlayer {
  id: string
  playerName: string
  position: string
}

export interface LineupSlotData {
  slotKey: string
  isStarter: boolean
  player: LineupPlayer
}

export interface MatchLineup {
  matchId: number
  formation: SupportedFormation
  isConfirmed: boolean
  confirmedAt: string | null
  slots: LineupSlotData[]
}

export interface SaveLineupPayload {
  formation: string
  slots: {
    playerId: string
    slotKey: string
    isStarter: boolean
  }[]
}

// 드래그 payload 타입 (JSON.stringify로 전달)
export interface LineupDragPayload {
  playerId: string
  playerName: string
  position: string
  src: 'POOL' | 'BENCH'
  srcKey?: string  // BENCH일 때 인덱스(string)
  srcSlotKey?: string  // SLOT일 때 slotKey (POOL/BENCH drag에선 없음)
}
```

- [x] **Step 2: API 서비스 작성**

```typescript
// football/src/services/lineup.service.ts
import { api } from './api'
import type { MatchLineup, SaveLineupPayload } from '@/types/lineup'

export const lineupApi = {
  get: (matchId: number) =>
    api.get<MatchLineup | null>(`/matches/${matchId}/lineup`),

  save: (matchId: number, payload: SaveLineupPayload) =>
    api.put<MatchLineup>(`/matches/${matchId}/lineup`, payload),

  confirm: (matchId: number) =>
    api.post<{ isConfirmed: boolean; confirmedAt: string }>(`/matches/${matchId}/lineup/confirm`, {}),
}
```

- [x] **Step 3: Commit**

```bash
git add football/src/types/lineup.ts football/src/services/lineup.service.ts
git commit -m "feat(lineup): FE 타입 + lineupApi 서비스"
```

---

### Task 7: FE MatchLineupPage

**Files:**
- Modify: `football/src/pages/matches/MatchLineupPage.tsx`

드래그 전송 키: `'text/lineup-player'` (FormationSlot의 `'text/squad-player'`와 분리)

- [x] **Step 1: 전체 페이지 구현**

```tsx
// football/src/pages/matches/MatchLineupPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { FootballPitch } from '@/components/squad/FootballPitch'
import {
  FORMATION_LAYOUTS,
  SUPPORTED_FORMATIONS,
  type SupportedFormation,
} from '@/components/squad/formation-layouts'
import { POSITION_ABBR } from '@/types/player'
import type { Player } from '@/types/player'
import { playerApi } from '@/services/player.service'
import { lineupApi } from '@/services/lineup.service'
import type { LineupPlayer, LineupDragPayload } from '@/types/lineup'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const DRAG_KEY = 'text/lineup-player'

// slotKey → LineupPlayer 매핑
type SlotMap = Record<string, LineupPlayer>

function toLineupPlayer(p: Player): LineupPlayer {
  return { id: p.id, playerName: p.playerName, position: p.position }
}

// 피치 슬롯 컴포넌트
function PitchSlot({
  slotDef,
  player,
  onDrop,
  onRemove,
}: {
  slotDef: { key: string; position: string; top: number; left: number }
  player: LineupPlayer | null
  onDrop: (slotKey: string, payload: LineupDragPayload) => void
  onRemove: (slotKey: string) => void
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
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
    onDrop(slotDef.key, JSON.parse(raw) as LineupDragPayload)
  }

  if (player) {
    return (
      <div
        style={style}
        draggable
        onDragStart={(e) => {
          const payload: LineupDragPayload = {
            playerId: player.id,
            playerName: player.playerName,
            position: player.position,
            src: 'POOL',
            srcSlotKey: slotDef.key,
          }
          e.dataTransfer.setData(DRAG_KEY, JSON.stringify(payload))
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDoubleClick={() => onRemove(slotDef.key)}
        title="더블클릭으로 해제"
        className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing z-10"
      >
        <div className="bg-green-800/90 border-2 border-green-400 rounded-full px-2 py-1 text-white text-[10px] font-bold whitespace-nowrap shadow-lg">
          {POSITION_ABBR[player.position as keyof typeof POSITION_ABBR] ?? player.position}
        </div>
        <div className="bg-green-900/80 border border-green-500/60 rounded px-1.5 py-0.5 text-white text-[9px] whitespace-nowrap max-w-[64px] truncate shadow">
          {player.playerName}
        </div>
      </div>
    )
  }

  return (
    <div
      style={style}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex flex-col items-center gap-0.5 z-10 group"
    >
      <div className="bg-white/10 border-2 border-dashed border-white/40 rounded-full w-10 h-10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
        <span className="text-white/50 text-[9px] font-bold">
          {POSITION_ABBR[slotDef.position as keyof typeof POSITION_ABBR] ?? slotDef.position}
        </span>
      </div>
      <div className="text-white/40 text-[9px]">{slotDef.key}</div>
    </div>
  )
}

export function MatchLineupPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const matchId = Number(id)

  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [formation, setFormation] = useState<SupportedFormation>('4-3-3')
  const [slots, setSlots] = useState<SlotMap>({})
  const [bench, setBench] = useState<LineupPlayer[]>([])
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const canEdit =
    user?.role === 'ADMIN' ||
    user?.role === 'COACHING_STAFF' ||
    user?.role === 'HEAD_COACH'
  const canConfirm = user?.role === 'ADMIN' || user?.role === 'HEAD_COACH'

  useEffect(() => {
    Promise.all([
      playerApi.list({ status: 'ACTIVE' }),
      lineupApi.get(matchId),
    ])
      .then(([players, lineup]) => {
        setAllPlayers(players)
        if (lineup) {
          setFormation(lineup.formation)
          setIsConfirmed(lineup.isConfirmed)
          const slotMap: SlotMap = {}
          const benchList: LineupPlayer[] = []
          for (const s of lineup.slots) {
            if (s.isStarter) {
              slotMap[s.slotKey] = s.player
            } else {
              benchList.push(s.player)
            }
          }
          setSlots(slotMap)
          setBench(benchList)
        }
      })
      .catch(() => toast.error('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [matchId])

  const placedIds = useMemo(() => {
    const ids = new Set(Object.values(slots).map((p) => p.id))
    bench.forEach((p) => ids.add(p.id))
    return ids
  }, [slots, bench])

  const pool = useMemo(
    () => allPlayers.filter((p) => p.status === 'ACTIVE' && !placedIds.has(p.id)),
    [allPlayers, placedIds],
  )

  const starterCount = Object.keys(slots).length

  // 슬롯 드롭: pool/bench/other-slot → this slot
  const handleSlotDrop = (targetSlotKey: string, payload: LineupDragPayload) => {
    setSlots((prev) => {
      const next = { ...prev }
      const existing = next[targetSlotKey]
      // 소스가 다른 슬롯인 경우 swap
      if (payload.srcSlotKey && payload.srcSlotKey !== targetSlotKey) {
        if (existing) {
          next[payload.srcSlotKey] = existing
        } else {
          delete next[payload.srcSlotKey]
        }
      }
      next[targetSlotKey] = {
        id: payload.playerId,
        playerName: payload.playerName,
        position: payload.position,
      }
      return next
    })
    // 벤치에서 왔으면 벤치에서 제거
    if (payload.src === 'BENCH' && payload.srcKey !== undefined) {
      setBench((prev) => prev.filter((_, i) => String(i) !== payload.srcKey))
    }
    setDirty(true)
  }

  // 슬롯 더블클릭: 선수 제거 → pool로 복귀
  const handleSlotRemove = (slotKey: string) => {
    setSlots((prev) => {
      const next = { ...prev }
      delete next[slotKey]
      return next
    })
    setDirty(true)
  }

  // 벤치 드롭
  const handleBenchDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData(DRAG_KEY)
    if (!raw) return
    const payload = JSON.parse(raw) as LineupDragPayload
    const player: LineupPlayer = {
      id: payload.playerId,
      playerName: payload.playerName,
      position: payload.position,
    }
    // 슬롯에서 왔으면 슬롯에서 제거
    if (payload.srcSlotKey) {
      setSlots((prev) => {
        const next = { ...prev }
        delete next[payload.srcSlotKey!]
        return next
      })
    }
    // 이미 벤치에 있으면 중복 추가 방지
    setBench((prev) =>
      prev.some((p) => p.id === player.id) ? prev : [...prev, player],
    )
    setDirty(true)
  }

  // 포메이션 변경: 슬롯 초기화
  const handleFormationChange = (f: SupportedFormation) => {
    setFormation(f)
    setSlots({})
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const slotPayloads = [
        ...Object.entries(slots).map(([slotKey, p]) => ({
          playerId: p.id,
          slotKey,
          isStarter: true,
        })),
        ...bench.map((p, i) => ({
          playerId: p.id,
          slotKey: `BENCH_${i}`,
          isStarter: false,
        })),
      ]
      const result = await lineupApi.save(matchId, { formation, slots: slotPayloads })
      setIsConfirmed(result?.isConfirmed ?? false)
      setDirty(false)
      toast.success('라인업이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await lineupApi.confirm(matchId)
      setIsConfirmed(true)
      toast.success('라인업이 확정되었습니다.')
    } catch {
      toast.error('확정에 실패했습니다.')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const pitchSlots = FORMATION_LAYOUTS[formation]

  return (
    <div className="flex flex-col h-full">
      {/* 상단 헤더 */}
      <div className="border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/matches/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">라인업 관리</span>
        <div className="flex-1" />
        <Select
          value={formation}
          onValueChange={(v) => handleFormationChange(v as SupportedFormation)}
          disabled={!canEdit}
        >
          <SelectTrigger className="h-8 w-28 text-xs">
            <span>{formation}</span>
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_FORMATIONS.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit && (
          <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        )}
        {canConfirm && !isConfirmed && (
          <Button size="sm" disabled={dirty || confirming} onClick={handleConfirm}>
            <Check className="h-3.5 w-3.5 mr-1.5" />
            {confirming ? '확정 중...' : '라인업 확정'}
          </Button>
        )}
        {isConfirmed && (
          <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />확정됨
          </span>
        )}
      </div>

      {/* 메인 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌: 선수 풀 */}
        <div className="w-48 shrink-0 border-r flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              선수 풀
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{pool.length}명 대기</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {pool.map((p) => (
              <div
                key={p.id}
                draggable={canEdit}
                onDragStart={(e) => {
                  const payload: LineupDragPayload = {
                    playerId: p.id,
                    playerName: p.playerName,
                    position: p.position,
                    src: 'POOL',
                  }
                  e.dataTransfer.setData(DRAG_KEY, JSON.stringify(payload))
                  e.dataTransfer.effectAllowed = 'move'
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg border bg-background p-2 text-[11px]',
                  canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                )}
              >
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
                  {POSITION_ABBR[p.position as keyof typeof POSITION_ABBR] ?? '?'}
                </div>
                <span className="truncate font-medium">{p.playerName}</span>
              </div>
            ))}
            {pool.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center pt-4">모든 선수가 배치됨</p>
            )}
          </div>
        </div>

        {/* 우: 피치 + 벤치 */}
        <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
          {/* 피치 */}
          <div className="max-w-xs mx-auto w-full">
            <FootballPitch viewMode="formation">
              {pitchSlots.map((slotDef) => (
                <PitchSlot
                  key={slotDef.key}
                  slotDef={slotDef}
                  player={slots[slotDef.key] ?? null}
                  onDrop={canEdit ? handleSlotDrop : () => {}}
                  onRemove={canEdit ? handleSlotRemove : () => {}}
                />
              ))}
            </FootballPitch>
          </div>

          {/* 벤치 */}
          <div className="rounded-xl border p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              후보 벤치 <span className="font-normal">({bench.length}/7)</span>
            </p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={canEdit ? handleBenchDrop : undefined}
              className={cn(
                'min-h-12 rounded-lg border-2 border-dashed p-2 flex flex-wrap gap-1.5',
                canEdit ? 'border-muted-foreground/30' : 'border-muted/20',
              )}
            >
              {bench.map((p, i) => (
                <div
                  key={p.id}
                  draggable={canEdit}
                  onDragStart={(e) => {
                    const payload: LineupDragPayload = {
                      playerId: p.id,
                      playerName: p.playerName,
                      position: p.position,
                      src: 'BENCH',
                      srcKey: String(i),
                    }
                    e.dataTransfer.setData(DRAG_KEY, JSON.stringify(payload))
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  className="flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[10px] cursor-grab"
                >
                  <span>{p.playerName}</span>
                  {canEdit && (
                    <button
                      className="text-muted-foreground hover:text-destructive ml-0.5"
                      onClick={() => {
                        setBench((prev) => prev.filter((_, idx) => idx !== i))
                        setDirty(true)
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {bench.length === 0 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  선수를 여기로 드래그하면 후보로 등록됩니다
                </span>
              )}
            </div>
          </div>

          {/* 상태 바 */}
          <div className="text-[10px] text-muted-foreground flex items-center gap-2">
            <span>선발 {starterCount}/11</span>
            {dirty && <span className="text-amber-600">· 저장되지 않은 변경사항</span>}
            {isConfirmed && !dirty && <span className="text-green-600">· 확정됨</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [x] **Step 2: TypeScript 타입 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 에러 없음.

- [x] **Step 3: 브라우저에서 동작 확인**

1. 코칭스태프 계정으로 로그인 후 경기 상세 → "라인업 관리" 버튼 클릭
2. 선수 풀에서 선수 카드를 피치 슬롯으로 드래그해서 배치 확인
3. 포메이션 변경 시 슬롯 초기화 확인
4. "저장" 버튼 클릭 → 성공 토스트 확인
5. 페이지 새로고침 후 배치 상태 유지 확인

- [x] **Step 4: Commit**

```bash
git add football/src/pages/matches/MatchLineupPage.tsx
git commit -m "feat(lineup): MatchLineupPage 드래그앤드롭 라인업 관리 구현"
```

---

### Task 8: 전체 테스트 실행

- [x] **Step 1: BE 전체 테스트**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: 기존 테스트 포함 모두 PASS.

- [x] **Step 2: FE 타입 최종 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 에러 없음.

- [x] **Step 3: 최종 commit**

```bash
git add -A
git commit -m "feat(lineup): 경기 스타팅 라인업 기능 완성"
```
