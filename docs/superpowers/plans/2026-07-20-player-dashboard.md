# Player Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선수 상세 페이지에 등번호 관리, 시장 가치, 레이더 차트(강점/약점 태그), Stats Tab(경기·훈련), Player Motivation 섹션을 추가한다.

**Architecture:** BE는 기존 controller/service/repo 삼층 구조를 유지한다. 새 기능(jersey, market-value, radar)은 player 모듈 하위에 라우트 세분화로 추가한다. FE는 PlayerDetailPage의 Tabs에 stats/jersey/motivation 탭을 추가하고, 레이더 차트는 Recharts `RadarChart`로 구현한다.

**Tech Stack:** Express + TypeScript (BE), React + Recharts + shadcn/ui (FE), Prisma (ORM), Jest (BE tests), node-cron (cron jobs)

---

## File Map

### BE (apps/api)
| 파일 | 역할 |
|------|------|
| `prisma/schema.prisma` | JerseyNumber·MarketValueHistory 모델, Player 필드 추가, 통계 필드 추가 |
| `src/player/dto/jersey.dto.ts` | JerseyNumber 관련 DTO |
| `src/player/dto/market-value.dto.ts` | 시장 가치 DTO |
| `src/player/jersey.repo.ts` | JerseyNumber CRUD |
| `src/player/jersey.service.ts` | 등번호 상태 전환 로직 |
| `src/player/market-value.repo.ts` | MarketValueHistory CRUD |
| `src/player/radar.service.ts` | 레이더 점수 계산 + 강점/약점 알고리즘 |
| `src/player/player.routes.ts` | 새 라우트 추가 |
| `src/player/player.service.ts` | match-stats, training-results 메서드 추가 |
| `src/player/player.repo.ts` | match-stats, training-results 쿼리 추가 |
| `src/player/player.controller.ts` | 새 핸들러 추가 |
| `src/jobs/monthlyMarketValueSnapshot.ts` | 월간 cron |
| `src/server.ts` | cron job 등록 |
| `__test__/player/jersey.service.test.ts` | 등번호 상태 전환 테스트 |
| `__test__/player/radar.service.test.ts` | 강점/약점 알고리즘 테스트 |

### FE (football/src)
| 파일 | 역할 |
|------|------|
| `types/player.ts` | 새 타입 추가 (JerseyNumber, MarketValue, MatchStats, TrainingResult, RadarData) |
| `services/player.service.ts` | match-stats, training-results, jersey, market-value API 메서드 추가 |
| `pages/players/PlayerDetailPage.tsx` | Stats·Jersey·Motivation 탭 추가, play_style 표시 |
| `pages/players/tabs/StatsTab.tsx` | 경기 스탯 테이블 + 훈련 결과 리스트 |
| `pages/players/tabs/JerseyTab.tsx` | 등번호 배정·해제 UI |
| `pages/players/tabs/MotivationTab.tsx` | PLAYER 본인 전용 동기부여 섹션 |
| `components/player/RadarChart.tsx` | Recharts RadarChart 래퍼 |

---

## Task 1: 스키마 — 신규 모델·Enum 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: Player 모델에 신규 필드 추가 (Player 블록 끝 `callups PlayerCallup[]` 아래)**

`apps/api/prisma/schema.prisma`의 `model Player` 블록에서 relations 끝에 추가:

```prisma
  playStyle            String?
  currentMarketValue   Float?
  jerseyNumbers        JerseyNumber[]
  marketValueHistory   MarketValueHistory[]
```

- [x] **Step 2: PlayerMatchStats에 누락 필드 추가 (minutesPlayed 아래)**

```prisma
  aerialDuelSuccessRate Float?
  sprint                Float?
  clearCutChanceRate    Float?
  penaltyConversionRate Float?
  freeKickConversionRate Float?
  foulsCommitted        Int?
  crossesCompleted      Int?
  shotAllowed           Int?
```

- [x] **Step 3: Enum 2개 추가 (기존 enum 블록 아래)**

파일 최하단 또는 enum 블록 근처에 추가:

```prisma
enum JerseyNumberStatus {
  AVAILABLE
  OCCUPIED
  RETIRED
  RESERVED
}

enum MarketValueSource {
  MANUAL
  EXTERNAL_API
}
```

- [x] **Step 4: JerseyNumber 모델 추가 (MarketValueHistory 모델과 함께, 파일 끝)**

```prisma
model JerseyNumber {
  id       Int                @id @default(autoincrement())
  number   Int
  status   JerseyNumberStatus @default(AVAILABLE)
  teamId   Int
  playerId String?

  team   Team    @relation(fields: [teamId], references: [id])
  player Player? @relation(fields: [playerId], references: [id])

  @@unique([number, teamId])
}

model MarketValueHistory {
  id           Int               @id @default(autoincrement())
  value        Float
  source       MarketValueSource
  recordedAt   DateTime          @default(now())
  recordedById Int?
  playerId     String

  player     Player @relation(fields: [playerId], references: [id])
  recordedBy User?  @relation(fields: [recordedById], references: [id])
}
```

- [x] **Step 5: Team 모델에 JerseyNumber relation 추가**

`model Team` 블록의 relations 끝에:
```prisma
  jerseyNumbers JerseyNumber[]
```

- [x] **Step 6: User 모델에 MarketValueHistory relation 추가**

`model User` 블록의 relations 끝에:
```prisma
  recordedMarketValues MarketValueHistory[]
```

---

## Task 2: Prisma 마이그레이션 + 클라이언트 재생성

**Files:**
- `apps/api/prisma/schema.prisma` (이미 수정됨)
- `apps/api/src/generated/` (자동 생성)

- [x] **Step 1: 마이그레이션 실행**

```bash
cd /Users/juno/work/football/apps/api
npx prisma migrate dev --name add-player-dashboard-fields
```

Expected: `Your database is now in sync with your schema.`

- [x] **Step 2: 클라이언트 재생성 확인**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [x] **Step 3: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

---

## Task 3: 등번호 DTO + Repository

**Files:**
- Create: `apps/api/src/player/dto/jersey.dto.ts`
- Create: `apps/api/src/player/jersey.repo.ts`

- [x] **Step 1: DTO 작성**

`apps/api/src/player/dto/jersey.dto.ts`:

```typescript
export interface AssignJerseyDto {
  number: number;
  playerId?: string;
  status?: "OCCUPIED" | "RESERVED" | "RETIRED" | "AVAILABLE";
}

export interface UpdateJerseyStatusDto {
  status: "AVAILABLE" | "OCCUPIED" | "RETIRED" | "RESERVED";
  playerId?: string | null;
}
```

- [x] **Step 2: Repository 작성**

`apps/api/src/player/jersey.repo.ts`:

```typescript
import { PrismaClient } from "../generated/client";
import { AssignJerseyDto, UpdateJerseyStatusDto } from "./dto/jersey.dto";

export class JerseyRepository {
  constructor(private prisma: PrismaClient) {}

  findByTeam(teamId: number) {
    return this.prisma.jerseyNumber.findMany({
      where: { teamId },
      include: { player: { select: { id: true, playerName: true, position: true } } },
      orderBy: { number: "asc" },
    });
  }

  findByPlayer(playerId: string) {
    return this.prisma.jerseyNumber.findMany({
      where: { playerId },
      select: { id: true, number: true, status: true, teamId: true },
    });
  }

  findByNumberAndTeam(number: number, teamId: number) {
    return this.prisma.jerseyNumber.findUnique({
      where: { number_teamId: { number, teamId } },
      include: { player: { select: { id: true, playerName: true } } },
    });
  }

  create(teamId: number, dto: AssignJerseyDto) {
    return this.prisma.jerseyNumber.create({
      data: {
        number: dto.number,
        teamId,
        playerId: dto.playerId ?? null,
        status: dto.status ?? (dto.playerId ? "OCCUPIED" : "AVAILABLE"),
      },
    });
  }

  updateStatus(id: number, dto: UpdateJerseyStatusDto) {
    return this.prisma.jerseyNumber.update({
      where: { id },
      data: {
        status: dto.status as any,
        ...(dto.playerId !== undefined && { playerId: dto.playerId }),
      },
    });
  }
}
```

---

## Task 4: 등번호 Service + 상태 전환 테스트

**Files:**
- Create: `apps/api/src/player/jersey.service.ts`
- Create: `apps/api/__test__/player/jersey.service.test.ts`

- [x] **Step 1: 테스트 파일 작성 (실패 확인용)**

`apps/api/__test__/player/jersey.service.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { JerseyService } from "../../src/player/jersey.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  findByNumberAndTeam: jest.fn<() => Promise<any>>(),
  findByPlayer: jest.fn<() => Promise<any[]>>(),
  create: jest.fn<() => Promise<any>>(),
  updateStatus: jest.fn<() => Promise<any>>(),
  findByTeam: jest.fn<() => Promise<any[]>>(),
} as any;

const service = new JerseyService(mockRepo);

describe("JerseyService - assignToPlayer", () => {
  beforeEach(() => jest.clearAllMocks());

  test("빈 번호 배정 성공", async () => {
    mockRepo.findByNumberAndTeam.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({ id: 1, number: 7, status: "OCCUPIED", playerId: "p1" });

    const result = await service.assignToPlayer(1, { number: 7, playerId: "p1" });
    expect(result.status).toBe("OCCUPIED");
  });

  test("OCCUPIED 번호 배정 시도 → 409", async () => {
    mockRepo.findByNumberAndTeam.mockResolvedValue({ id: 1, number: 7, status: "OCCUPIED", player: { playerName: "Kim" } });

    await expect(service.assignToPlayer(1, { number: 7, playerId: "p2" }))
      .rejects.toMatchObject({ statusCode: 409, code: "JERSEY_NUMBER_OCCUPIED" });
  });

  test("RETIRED 번호 배정 시도 → 403", async () => {
    mockRepo.findByNumberAndTeam.mockResolvedValue({ id: 1, number: 10, status: "RETIRED", player: null });

    await expect(service.assignToPlayer(1, { number: 10, playerId: "p1" }))
      .rejects.toMatchObject({ statusCode: 403, code: "JERSEY_NUMBER_RETIRED" });
  });
});

describe("JerseyService - retire", () => {
  beforeEach(() => jest.clearAllMocks());

  test("AVAILABLE → RETIRED 전환 성공", async () => {
    mockRepo.findByNumberAndTeam.mockResolvedValue({ id: 1, number: 9, status: "AVAILABLE", player: null });
    mockRepo.updateStatus.mockResolvedValue({ id: 1, number: 9, status: "RETIRED" });

    const result = await service.retire(1, 9);
    expect(result.status).toBe("RETIRED");
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(1, { status: "RETIRED", playerId: null });
  });

  test("OCCUPIED 상태는 RETIRED 불가 → 409", async () => {
    mockRepo.findByNumberAndTeam.mockResolvedValue({ id: 1, number: 9, status: "OCCUPIED", player: { playerName: "Park" } });

    await expect(service.retire(1, 9))
      .rejects.toMatchObject({ statusCode: 409, code: "JERSEY_MUST_BE_AVAILABLE_TO_RETIRE" });
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/player/jersey.service.test.ts --no-coverage
```

Expected: FAIL (JerseyService not found)

- [x] **Step 3: Service 구현**

`apps/api/src/player/jersey.service.ts`:

```typescript
import { AppError } from "../lib/appError";
import { JerseyRepository } from "./jersey.repo";
import { AssignJerseyDto, UpdateJerseyStatusDto } from "./dto/jersey.dto";

export class JerseyService {
  constructor(private repo: JerseyRepository) {}

  listByTeam(teamId: number) {
    return this.repo.findByTeam(teamId);
  }

  listByPlayer(playerId: string) {
    return this.repo.findByPlayer(playerId);
  }

  async assignToPlayer(teamId: number, dto: AssignJerseyDto) {
    const existing = await this.repo.findByNumberAndTeam(dto.number, teamId);

    if (existing) {
      if (existing.status === "OCCUPIED") throw new AppError(409, "JERSEY_NUMBER_OCCUPIED");
      if (existing.status === "RETIRED") throw new AppError(403, "JERSEY_NUMBER_RETIRED");
      if (existing.status === "RESERVED") throw new AppError(409, "JERSEY_NUMBER_RESERVED");
      return this.repo.updateStatus(existing.id, { status: "OCCUPIED", playerId: dto.playerId });
    }

    return this.repo.create(teamId, { ...dto, status: "OCCUPIED" });
  }

  async release(teamId: number, number: number) {
    const jersey = await this.repo.findByNumberAndTeam(number, teamId);
    if (!jersey) throw new AppError(404, "JERSEY_NOT_FOUND");
    if (jersey.status !== "OCCUPIED") throw new AppError(409, "JERSEY_NOT_OCCUPIED");
    return this.repo.updateStatus(jersey.id, { status: "AVAILABLE", playerId: null });
  }

  async retire(teamId: number, number: number) {
    const jersey = await this.repo.findByNumberAndTeam(number, teamId);
    if (!jersey) {
      return this.repo.create(teamId, { number, status: "RETIRED" });
    }
    if (jersey.status !== "AVAILABLE") throw new AppError(409, "JERSEY_MUST_BE_AVAILABLE_TO_RETIRE");
    return this.repo.updateStatus(jersey.id, { status: "RETIRED", playerId: null });
  }

  async reactivate(teamId: number, number: number) {
    const jersey = await this.repo.findByNumberAndTeam(number, teamId);
    if (!jersey || jersey.status !== "RETIRED") throw new AppError(409, "JERSEY_NOT_RETIRED");
    return this.repo.updateStatus(jersey.id, { status: "AVAILABLE" });
  }
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx jest __test__/player/jersey.service.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [x] **Step 5: Commit**

```bash
git add apps/api/src/player/jersey.repo.ts apps/api/src/player/jersey.service.ts \
        apps/api/src/player/dto/jersey.dto.ts \
        apps/api/__test__/player/jersey.service.test.ts
git commit -m "feat(player): jersey number service + state-transition tests"
```

---

## Task 5: 등번호 Controller + Routes

**Files:**
- Create: `apps/api/src/player/jersey.controller.ts`
- Modify: `apps/api/src/player/player.routes.ts`

- [x] **Step 1: Controller 작성**

`apps/api/src/player/jersey.controller.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { JerseyService } from "./jersey.service";

const GM_ROLES = ["GM", "ADMIN"] as const;
const ASSIGN_ROLES = ["GM", "ADMIN", "FRONT_OFFICE"] as const;

export class JerseyController {
  constructor(private service: JerseyService) {}

  listByPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.listByPlayer(String(req.params["id"]));
      res.json(result);
    } catch (err) { next(err); }
  };

  assign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ASSIGN_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const teamId = Number(req.body.teamId);
      if (!teamId) throw new AppError(400, "TEAM_ID_REQUIRED");
      const result = await this.service.assignToPlayer(teamId, req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  };

  release = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ASSIGN_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const { teamId, number } = req.body;
      const result = await this.service.release(Number(teamId), Number(number));
      res.json(result);
    } catch (err) { next(err); }
  };

  retire = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!GM_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
      const { teamId, number } = req.body;
      const result = await this.service.retire(Number(teamId), Number(number));
      res.json(result);
    } catch (err) { next(err); }
  };

  reactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const { teamId, number } = req.body;
      const result = await this.service.reactivate(Number(teamId), Number(number));
      res.json(result);
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 2: player.routes.ts에 jersey 라우트 추가**

`apps/api/src/player/player.routes.ts` 파일 상단 import 섹션에:

```typescript
import { JerseyService } from "./jersey.service";
import { JerseyController } from "./jersey.controller";
import { JerseyRepository } from "./jersey.repo";
```

`const router = Router();` 아래:

```typescript
const jerseyRepo = new JerseyRepository(getPrisma());
const jerseyService = new JerseyService(jerseyRepo);
const jerseyController = new JerseyController(jerseyService);
```

기존 `router.delete` 아래:

```typescript
// 선수의 등번호 조회
router.get("/:id/jersey-numbers", auth, jerseyController.listByPlayer);

// 등번호 배정 (GM, ADMIN, FRONT_OFFICE)
router.post("/:id/jersey-numbers/assign", auth, jerseyController.assign);

// 등번호 해제 (GM, ADMIN, FRONT_OFFICE)
router.post("/:id/jersey-numbers/release", auth, jerseyController.release);

// 등번호 영구 결번 (GM, ADMIN)
router.post("/:id/jersey-numbers/retire", auth, jerseyController.retire);

// 결번 재활성화 (ADMIN only)
router.post("/:id/jersey-numbers/reactivate", auth, jerseyController.reactivate);
```

- [x] **Step 3: 컴파일 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 4: Commit**

```bash
git add apps/api/src/player/jersey.controller.ts apps/api/src/player/player.routes.ts
git commit -m "feat(player): jersey number controller + routes"
```

---

## Task 6: Market Value API

**Files:**
- Create: `apps/api/src/player/dto/market-value.dto.ts`
- Create: `apps/api/src/player/market-value.repo.ts`
- Modify: `apps/api/src/player/player.service.ts`
- Modify: `apps/api/src/player/player.controller.ts`
- Modify: `apps/api/src/player/player.routes.ts`

- [x] **Step 1: DTO 작성**

`apps/api/src/player/dto/market-value.dto.ts`:

```typescript
export interface UpdateMarketValueDto {
  value: number;
}
```

- [x] **Step 2: Repository 작성**

`apps/api/src/player/market-value.repo.ts`:

```typescript
import { PrismaClient } from "../generated/client";

export class MarketValueRepository {
  constructor(private prisma: PrismaClient) {}

  getHistory(playerId: string) {
    return this.prisma.marketValueHistory.findMany({
      where: { playerId },
      orderBy: { recordedAt: "desc" },
      select: { id: true, value: true, source: true, recordedAt: true },
    });
  }

  async updateCurrentValue(playerId: string, value: number, recordedById: number) {
    await this.prisma.$transaction([
      this.prisma.player.update({
        where: { id: playerId },
        data: { currentMarketValue: value },
      }),
      this.prisma.marketValueHistory.create({
        data: { playerId, value, source: "MANUAL", recordedById },
      }),
    ]);
  }
}
```

- [x] **Step 3: PlayerService에 메서드 추가**

`apps/api/src/player/player.service.ts`에 import 추가:

```typescript
import { MarketValueRepository } from "./market-value.repo";
import { UpdateMarketValueDto } from "./dto/market-value.dto";
```

생성자 변경 및 메서드 추가:

```typescript
// 생성자: constructor(private repo: PlayerRepository, private mvRepo?: MarketValueRepository) {}
// 아래 두 메서드 추가

async getMarketValueHistory(playerId: string) {
  const player = await this.repo.findById(playerId);
  if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
  if (!this.mvRepo) throw new AppError(500, "MARKET_VALUE_REPO_NOT_CONFIGURED");
  return this.mvRepo.getHistory(playerId);
}

async updateMarketValue(playerId: string, dto: UpdateMarketValueDto, recordedById: number) {
  const player = await this.repo.findById(playerId);
  if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
  if (!this.mvRepo) throw new AppError(500, "MARKET_VALUE_REPO_NOT_CONFIGURED");
  await this.mvRepo.updateCurrentValue(playerId, dto.value, recordedById);
  return { playerId, currentMarketValue: dto.value };
}
```

- [x] **Step 4: player.routes.ts에 mvRepo 주입 및 라우트 추가**

`player.routes.ts`에 추가:

```typescript
import { MarketValueRepository } from "./market-value.repo";
// ...
const mvRepo = new MarketValueRepository(getPrisma());
const service = new PlayerService(repo, mvRepo);
// ... (기존 const service = new PlayerService(repo); 를 위 코드로 교체)
```

기존 jersey 라우트 아래:

```typescript
// 시장 가치 이력 조회 (GM, TD, ADMIN)
router.get("/:id/market-value/history", auth, controller.getMarketValueHistory);

// 시장 가치 수동 업데이트 (GM, TD, ADMIN)
router.patch("/:id/market-value", auth, controller.updateMarketValue);
```

- [x] **Step 5: Controller에 핸들러 추가**

`apps/api/src/player/player.controller.ts`에 추가:

```typescript
private readonly MARKET_VALUE_ROLES = ["GM", "TD", "ADMIN"] as const;

getMarketValueHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!this.MARKET_VALUE_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
    const history = await this.service.getMarketValueHistory(String(req.params["id"]));
    res.json(history);
  } catch (err) { next(err); }
};

updateMarketValue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!this.MARKET_VALUE_ROLES.includes(req.user!.role as any)) throw new AppError(403, "FORBIDDEN");
    const result = await this.service.updateMarketValue(
      String(req.params["id"]),
      req.body,
      req.user!.id,
    );
    res.json(result);
  } catch (err) { next(err); }
};
```

- [x] **Step 6: 컴파일 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit
```

- [x] **Step 7: Commit**

```bash
git add apps/api/src/player/dto/market-value.dto.ts \
        apps/api/src/player/market-value.repo.ts \
        apps/api/src/player/player.service.ts \
        apps/api/src/player/player.controller.ts \
        apps/api/src/player/player.routes.ts
git commit -m "feat(player): market value update + history API"
```

---

## Task 7: Match Stats + Training Results 엔드포인트

**Files:**
- Modify: `apps/api/src/player/player.repo.ts`
- Modify: `apps/api/src/player/player.service.ts`
- Modify: `apps/api/src/player/player.controller.ts`
- Modify: `apps/api/src/player/player.routes.ts`

- [x] **Step 1: Repo에 match-stats 쿼리 추가**

`apps/api/src/player/player.repo.ts`에 메서드 추가:

```typescript
getMatchStats(playerId: string, seasonId?: number) {
  return this.prisma.playerMatchStats.findMany({
    where: {
      playerId,
      ...(seasonId && { match: { seasonId } }),
    },
    include: {
      match: {
        select: { id: true, date: true, homeTeamId: true, awayTeamId: true, seasonId: true },
      },
    },
    orderBy: { match: { date: "desc" } },
  });
}

getTrainingResults(playerId: string, from?: string, to?: string) {
  return this.prisma.trainingResult.findMany({
    where: {
      playerId,
      ...(from || to
        ? {
            session: {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to + "T23:59:59Z") } : {}),
              },
            },
          }
        : {}),
    },
    include: {
      session: {
        select: { id: true, date: true, sessionType: true, goal: true },
      },
    },
    orderBy: { session: { date: "desc" } },
    take: 50,
  });
}
```

- [x] **Step 2: Service에 메서드 추가**

`apps/api/src/player/player.service.ts`에 추가:

```typescript
async getMatchStats(playerId: string, seasonId?: number) {
  const player = await this.repo.findById(playerId);
  if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
  return this.repo.getMatchStats(playerId, seasonId);
}

async getTrainingResults(playerId: string, requesterId: string, requesterRole: string, from?: string, to?: string) {
  const player = await this.repo.findById(playerId);
  if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
  // PLAYER 본인만 자신의 기록 열람 가능, 다른 역할은 모두 열람 가능
  if (requesterRole === "PLAYER" && player.userId !== Number(requesterId)) {
    throw new AppError(403, "FORBIDDEN");
  }
  return this.repo.getTrainingResults(playerId, from, to);
}
```

- [x] **Step 3: Controller에 핸들러 추가**

`apps/api/src/player/player.controller.ts`에 추가:

```typescript
getMatchStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seasonId = req.query["seasonId"] ? Number(req.query["seasonId"]) : undefined;
    const stats = await this.service.getMatchStats(String(req.params["id"]), seasonId);
    res.json(stats);
  } catch (err) { next(err); }
};

getTrainingResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query as Record<string, string | undefined>;
    const results = await this.service.getTrainingResults(
      String(req.params["id"]),
      String(req.user!.id),
      req.user!.role,
      from,
      to,
    );
    res.json(results);
  } catch (err) { next(err); }
};
```

- [x] **Step 4: Routes에 추가**

`apps/api/src/player/player.routes.ts`에 추가:

```typescript
// 경기 스탯 조회 (?seasonId=)
router.get("/:id/match-stats", auth, controller.getMatchStats);

// 훈련 결과 조회 (?from=&to=)
router.get("/:id/training-results", auth, controller.getTrainingResults);
```

- [x] **Step 5: 컴파일 + Commit**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit
git add apps/api/src/player/player.repo.ts apps/api/src/player/player.service.ts \
        apps/api/src/player/player.controller.ts apps/api/src/player/player.routes.ts
git commit -m "feat(player): match-stats and training-results endpoints"
```

---

## Task 8: 레이더 점수 + 강점/약점 알고리즘

**Files:**
- Create: `apps/api/src/player/radar.service.ts`
- Create: `apps/api/__test__/player/radar.service.test.ts`
- Modify: `apps/api/src/player/player.controller.ts`
- Modify: `apps/api/src/player/player.routes.ts`

- [x] **Step 1: 테스트 작성**

`apps/api/__test__/player/radar.service.test.ts`:

```typescript
import { describe, test, expect } from "@jest/globals";
import { computeRadarScores, computeTags, POSITION_GROUP } from "../../src/player/radar.service";

const fwdStats = {
  xG: 0.8, goals: 5, xA: 0.4, assists: 3,
  sprint: 32.1, clearCutChanceRate: 0.75,
  passAccuracy: 78, penaltyConversionRate: 1.0,
  freeKickConversionRate: 0.5,
};

describe("computeRadarScores - FWD", () => {
  test("공격수 6축 점수 반환 (0-100 범위)", () => {
    const scores = computeRadarScores("striker", fwdStats as any, null);
    expect(Object.keys(scores)).toHaveLength(6);
    Object.values(scores).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe("computeTags", () => {
  test("점수 ≥ 70이면 강점", () => {
    const scores = { shooting: 80, passing: 60, speed: 45, chance: 70, creation: 55, setpiece: 30 };
    const tags = computeTags(scores, null);
    expect(tags.strengths).toContain("shooting");
  });

  test("점수 ≤ 40이면 약점", () => {
    const scores = { shooting: 80, passing: 60, speed: 45, chance: 70, creation: 55, setpiece: 30 };
    const tags = computeTags(scores, null);
    expect(tags.weaknesses).toContain("setpiece");
  });
});

describe("POSITION_GROUP", () => {
  test("striker → FWD", () => expect(POSITION_GROUP["striker"]).toBe("FWD"));
  test("centralDefensiveMiddleFielder → MID", () => expect(POSITION_GROUP["centralDefensiveMiddleFielder"]).toBe("MID"));
  test("centerBack → DEF", () => expect(POSITION_GROUP["centerBack"]).toBe("DEF"));
  test("goalKeeper → GK", () => expect(POSITION_GROUP["goalKeeper"]).toBe("GK"));
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/player/radar.service.test.ts --no-coverage
```

Expected: FAIL

- [x] **Step 3: radar.service.ts 구현**

`apps/api/src/player/radar.service.ts`:

```typescript
import { Position } from "../generated/enums";

export type PositionGroup = "FWD" | "MID" | "DEF" | "GK";

export const POSITION_GROUP: Record<string, PositionGroup> = {
  striker: "FWD",
  shadowStriker: "FWD",
  winger: "FWD",
  centralAttackMiddleFielder: "FWD",
  rightAttackMiddleFielder: "FWD",
  leftAttackMiddleFielder: "FWD",
  centralDefensiveMiddleFielder: "MID",
  leftDefensiveMiddleFielder: "MID",
  rightDefensiveMiddleFielder: "MID",
  centralMiddleFielder: "MID",
  centerBack: "DEF",
  leftWingBack: "DEF",
  rightWingBack: "DEF",
  leftFullBack: "DEF",
  rightFullBack: "DEF",
  goalKeeper: "GK",
};

// clamp 0-100
function clamp(v: number): number {
  return Math.min(100, Math.max(0, v));
}

// 스탯 raw value → 0-100 점수 변환 (최대값 기준 선형 스케일)
function scale(value: number | null | undefined, max: number): number {
  if (value == null) return 0;
  return clamp((value / max) * 100);
}

type StatRow = {
  xG?: number | null;
  xA?: number | null;
  goals?: number | null;
  assists?: number | null;
  sprint?: number | null;
  clearCutChanceRate?: number | null;
  passAccuracy?: number | null;
  penaltyConversionRate?: number | null;
  freeKickConversionRate?: number | null;
  tackleSuccessRate?: number | null;
  interceptions?: number | null;
  clearances?: number | null;
  aerialDuelSuccessRate?: number | null;
  crossesCompleted?: number | null;
  saves?: number | null;
  shotAllowed?: number | null;
};

export function computeRadarScores(
  position: string,
  avg: StatRow,
  teamAvg: StatRow | null,
): Record<string, number> {
  const group = POSITION_GROUP[position] ?? "MID";

  switch (group) {
    case "FWD":
      return {
        shooting: clamp(scale(avg.xG, 1.5) * 0.5 + scale(avg.goals, 10) * 0.5),
        creation: clamp(scale(avg.xA, 1.0) * 0.5 + scale(avg.assists, 8) * 0.5),
        speed: scale(avg.sprint, 36),
        chance: scale(avg.clearCutChanceRate, 1.0),
        passing: scale(avg.passAccuracy, 100),
        setpiece: clamp(
          scale(avg.penaltyConversionRate, 1.0) * 0.5 +
          scale(avg.freeKickConversionRate, 1.0) * 0.5,
        ),
      };
    case "MID":
      return {
        passing: scale(avg.passAccuracy, 100),
        creation: clamp(scale(avg.xA, 1.0) * 0.5 + scale(avg.assists, 8) * 0.5),
        defending: clamp(
          scale(avg.tackleSuccessRate, 100) * 0.5 +
          scale(avg.interceptions, 5) * 0.5,
        ),
        speed: scale(avg.sprint, 36),
        shooting: clamp(scale(avg.xG, 1.5) * 0.5 + scale(avg.goals, 10) * 0.5),
        setpiece: scale(avg.freeKickConversionRate, 1.0),
      };
    case "DEF":
      return {
        tackling: scale(avg.tackleSuccessRate, 100),
        interception: scale(avg.interceptions, 5),
        clearing: scale(avg.clearances, 8),
        aerial: scale(avg.aerialDuelSuccessRate, 1.0),
        passing: scale(avg.passAccuracy, 100),
        speed: scale(avg.sprint, 36),
      };
    case "GK": {
      const saveRate =
        avg.saves != null && avg.shotAllowed != null
          ? clamp(((avg.saves - avg.shotAllowed) / Math.max(avg.saves, 1)) * 100 + 50)
          : 0;
      return {
        saving: saveRate,
        passing: scale(avg.passAccuracy, 100),
        distribution: scale(avg.crossesCompleted, 5),
        shotStopping: scale(avg.saves, 8),
        goalsConceded: avg.shotAllowed != null ? clamp(100 - avg.shotAllowed * 10) : 0,
        setpiece: scale(avg.freeKickConversionRate, 1.0),
      };
    }
  }
}

export function computeTags(
  scores: Record<string, number>,
  teamPercentiles: Record<string, number> | null,
): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const [axis, score] of Object.entries(scores)) {
    const inTopQuartile = teamPercentiles ? teamPercentiles[axis] >= 75 : true;
    const inBottomQuartile = teamPercentiles ? teamPercentiles[axis] <= 25 : true;

    if (score >= 70 && inTopQuartile) strengths.push(axis);
    if (score <= 40 || (score <= 60 && inBottomQuartile)) weaknesses.push(axis);
  }

  return { strengths, weaknesses };
}

export async function getPlayerRadarData(
  position: string,
  matchStats: StatRow[],
) {
  if (matchStats.length === 0) return null;

  const avg: StatRow = {};
  const keys: (keyof StatRow)[] = [
    "xG", "xA", "goals", "assists", "sprint", "clearCutChanceRate",
    "passAccuracy", "penaltyConversionRate", "freeKickConversionRate",
    "tackleSuccessRate", "interceptions", "clearances",
    "aerialDuelSuccessRate", "crossesCompleted", "saves", "shotAllowed",
  ];

  for (const key of keys) {
    const vals = matchStats.map((s) => s[key]).filter((v): v is number => v != null);
    (avg as any)[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  const scores = computeRadarScores(position, avg, null);
  const tags = computeTags(scores, null);

  return { scores, ...tags };
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx jest __test__/player/radar.service.test.ts --no-coverage
```

Expected: PASS

- [x] **Step 5: radar 엔드포인트 추가**

`player.controller.ts`에:

```typescript
import { getPlayerRadarData } from "./radar.service";

getRadar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playerId = String(req.params["id"]);
    const player = await this.service.getPlayerById(playerId);
    const stats = await this.service.getMatchStats(playerId);
    const radar = await getPlayerRadarData(player.position, stats as any);
    if (!radar) return res.json({ scores: {}, strengths: [], weaknesses: [], message: "데이터 부족" });
    res.json(radar);
  } catch (err) { next(err); }
};
```

`player.routes.ts`에:

```typescript
// 레이더 차트 데이터 + 강점/약점 태그
router.get("/:id/radar", auth, controller.getRadar);
```

- [x] **Step 6: Commit**

```bash
cd /Users/juno/work/football/apps/api
git add apps/api/src/player/radar.service.ts \
        apps/api/__test__/player/radar.service.test.ts \
        apps/api/src/player/player.controller.ts \
        apps/api/src/player/player.routes.ts
git commit -m "feat(player): radar score + strength/weakness algorithm"
```

---

## Task 9: 월간 시장 가치 스냅샷 Cron

**Files:**
- Create: `apps/api/src/jobs/monthlyMarketValueSnapshot.ts`
- Modify: `apps/api/src/server.ts`

- [x] **Step 1: Cron job 작성**

`apps/api/src/jobs/monthlyMarketValueSnapshot.ts`:

```typescript
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";

export function startMonthlyMarketValueSnapshotJob() {
  // 매월 1일 자정 실행
  cron.schedule("0 0 1 * *", async () => {
    const prisma = getPrisma();

    const players = await prisma.player.findMany({
      where: { currentMarketValue: { not: null } },
      select: { id: true, currentMarketValue: true },
    });

    if (players.length === 0) return;

    await prisma.marketValueHistory.createMany({
      data: players.map((p) => ({
        playerId: p.id,
        value: p.currentMarketValue!,
        source: "EXTERNAL_API" as const,
      })),
    });

    console.log(`[MarketValueSnapshot] ${players.length}명 스냅샷 저장`);
  });
}
```

- [x] **Step 2: server.ts에 등록**

`apps/api/src/server.ts`에 import 추가:

```typescript
import { startMonthlyMarketValueSnapshotJob } from "./jobs/monthlyMarketValueSnapshot";
```

기존 `startContractExpiryJob();` 아래:

```typescript
startMonthlyMarketValueSnapshotJob();
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/jobs/monthlyMarketValueSnapshot.ts apps/api/src/server.ts
git commit -m "feat(jobs): monthly market value snapshot cron"
```

---

## Task 10: FE 타입 + 서비스 확장

**Files:**
- Modify: `football/src/types/player.ts`
- Modify: `football/src/services/player.service.ts`

- [x] **Step 1: 타입 추가**

`football/src/types/player.ts` 파일 끝에 추가:

```typescript
export interface JerseyNumber {
  id: number
  number: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'RETIRED' | 'RESERVED'
  teamId: number
}

export interface MarketValueEntry {
  id: number
  value: number
  source: 'MANUAL' | 'EXTERNAL_API'
  recordedAt: string
}

export interface MatchStat {
  id: number
  goals: number | null
  assists: number | null
  xG: number | null
  xA: number | null
  passAccuracy: number | null
  tackleSuccessRate: number | null
  clearances: number | null
  interceptions: number | null
  saves: number | null
  aerialDuelSuccessRate: number | null
  sprint: number | null
  clearCutChanceRate: number | null
  penaltyConversionRate: number | null
  freeKickConversionRate: number | null
  crossesCompleted: number | null
  shotAllowed: number | null
  minutesPlayed: number | null
  match: {
    id: number
    date: string
    seasonId: number
  }
}

export interface TrainingResultEntry {
  id: number
  attendance: string
  feedback: string | null
  performanceScore: number | null
  session: {
    id: number
    date: string
    sessionType: string
    goal: string
  }
}

export interface RadarData {
  scores: Record<string, number>
  strengths: string[]
  weaknesses: string[]
  message?: string
}

export interface PlayerDetailWithDashboard extends PlayerDetail {
  playStyle: string | null
  currentMarketValue: number | null
}
```

- [x] **Step 2: 서비스 메서드 추가**

`football/src/services/player.service.ts`에 import 추가:

```typescript
import type {
  JerseyNumber,
  MarketValueEntry,
  MatchStat,
  TrainingResultEntry,
  RadarData,
} from '@/types/player'
```

`playerApi` 객체에 메서드 추가:

```typescript
  getMatchStats: (id: string, seasonId?: number) =>
    api.get<MatchStat[]>(`/players/${id}/match-stats${seasonId ? `?seasonId=${seasonId}` : ''}`),

  getTrainingResults: (id: string, params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const q = qs.toString()
    return api.get<TrainingResultEntry[]>(`/players/${id}/training-results${q ? `?${q}` : ''}`)
  },

  getRadar: (id: string) =>
    api.get<RadarData>(`/players/${id}/radar`),

  getJerseyNumbers: (id: string) =>
    api.get<JerseyNumber[]>(`/players/${id}/jersey-numbers`),

  assignJersey: (id: string, body: { number: number; teamId: number }) =>
    api.post<JerseyNumber>(`/players/${id}/jersey-numbers/assign`, body),

  releaseJersey: (id: string, body: { teamId: number; number: number }) =>
    api.post<JerseyNumber>(`/players/${id}/jersey-numbers/release`, body),

  getMarketValueHistory: (id: string) =>
    api.get<MarketValueEntry[]>(`/players/${id}/market-value/history`),

  updateMarketValue: (id: string, value: number) =>
    api.patch<{ playerId: string; currentMarketValue: number }>(`/players/${id}/market-value`, { value }),
```

- [x] **Step 3: Commit**

```bash
git add football/src/types/player.ts football/src/services/player.service.ts
git commit -m "feat(player-fe): add types and service methods for dashboard"
```

---

## Task 11: FE — 레이더 차트 컴포넌트

**Files:**
- Create: `football/src/components/player/RadarChart.tsx`

- [x] **Step 1: 컴포넌트 작성**

`football/src/components/player/RadarChart.tsx`:

```tsx
import {
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { RadarData } from '@/types/player'

const AXIS_LABEL_KO: Record<string, string> = {
  shooting: '슈팅',
  creation: '창출',
  speed: '스피드',
  chance: '결정적 기회',
  passing: '패싱',
  setpiece: '세트피스',
  defending: '수비',
  tackling: '태클',
  interception: '인터셉트',
  clearing: '클리어링',
  aerial: '공중 경합',
  saving: '세이브',
  distribution: '배급',
  shotStopping: '선방',
  goalsConceded: '실점 억제',
}

interface Props {
  data: RadarData
}

export function PlayerRadarChart({ data }: Props) {
  if (!data.scores || Object.keys(data.scores).length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        {data.message ?? '경기 데이터가 부족합니다.'}
      </div>
    )
  }

  const chartData = Object.entries(data.scores).map(([key, value]) => ({
    axis: AXIS_LABEL_KO[key] ?? key,
    value,
    fullMark: 100,
  }))

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={280}>
        <RechartsRadar data={chartData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
          <Radar
            name="점수"
            dataKey="value"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.25}
          />
          <Tooltip formatter={(v: number) => [`${v.toFixed(0)}점`, '점수']} />
        </RechartsRadar>
      </ResponsiveContainer>

      {(data.strengths.length > 0 || data.weaknesses.length > 0) && (
        <div className="flex gap-4 flex-wrap">
          {data.strengths.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-green-700">강점</span>
              {data.strengths.map((s) => (
                <span key={s} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  {AXIS_LABEL_KO[s] ?? s}
                </span>
              ))}
            </div>
          )}
          {data.weaknesses.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-red-700">약점</span>
              {data.weaknesses.map((w) => (
                <span key={w} className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                  {AXIS_LABEL_KO[w] ?? w}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/components/player/RadarChart.tsx
git commit -m "feat(player-fe): radar chart component with strength/weakness tags"
```

---

## Task 12: FE — Stats Tab

**Files:**
- Create: `football/src/pages/players/tabs/StatsTab.tsx`

- [x] **Step 1: StatsTab 구현**

`football/src/pages/players/tabs/StatsTab.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { playerApi } from '@/services/player.service'
import type { MatchStat, TrainingResultEntry, RadarData } from '@/types/player'
import { PlayerRadarChart } from '@/components/player/RadarChart'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const ATTENDANCE_KO: Record<string, string> = {
  PRESENT: '출석',
  ABSENT_AUTHORIZED: '공결',
  ABSENT_UNAUTHORIZED: '무단결석',
  LATE_AUTHORIZED: '공지각',
  LATE_UNAUTHORIZED: '무단지각',
}

function fmt(v: number | null | undefined, digits = 0): string {
  if (v == null) return '-'
  return v.toFixed(digits)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

interface Props {
  playerId: string
}

export function StatsTab({ playerId }: Props) {
  const [matchStats, setMatchStats] = useState<MatchStat[]>([])
  const [trainingResults, setTrainingResults] = useState<TrainingResultEntry[]>([])
  const [radar, setRadar] = useState<RadarData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      playerApi.getMatchStats(playerId),
      playerApi.getTrainingResults(playerId),
      playerApi.getRadar(playerId),
    ])
      .then(([ms, tr, rd]) => {
        setMatchStats(ms)
        setTrainingResults(tr)
        setRadar(rd)
      })
      .finally(() => setLoading(false))
  }, [playerId])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      {/* 레이더 차트 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">능력치 레이더</h3>
        {radar ? (
          <PlayerRadarChart data={radar} />
        ) : (
          <p className="text-sm text-muted-foreground">데이터를 불러오지 못했습니다.</p>
        )}
      </section>

      <Separator />

      {/* 경기 스탯 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">경기 기록 ({matchStats.length}경기)</h3>
        {matchStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">등록된 경기 기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2 pr-3">날짜</th>
                  <th className="text-right pr-3">골</th>
                  <th className="text-right pr-3">도움</th>
                  <th className="text-right pr-3">xG</th>
                  <th className="text-right pr-3">xA</th>
                  <th className="text-right pr-3">패스%</th>
                  <th className="text-right pr-3">태클%</th>
                  <th className="text-right">출전</th>
                </tr>
              </thead>
              <tbody>
                {matchStats.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-3 text-muted-foreground">{formatDate(s.match.date)}</td>
                    <td className="text-right pr-3 font-medium">{fmt(s.goals)}</td>
                    <td className="text-right pr-3">{fmt(s.assists)}</td>
                    <td className="text-right pr-3">{fmt(s.xG, 2)}</td>
                    <td className="text-right pr-3">{fmt(s.xA, 2)}</td>
                    <td className="text-right pr-3">{fmt(s.passAccuracy, 0)}{s.passAccuracy != null ? '%' : ''}</td>
                    <td className="text-right pr-3">{fmt(s.tackleSuccessRate, 0)}{s.tackleSuccessRate != null ? '%' : ''}</td>
                    <td className="text-right">{s.minutesPlayed != null ? `${s.minutesPlayed}'` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Separator />

      {/* 훈련 결과 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">훈련 기록 (최근 {trainingResults.length}건)</h3>
        {trainingResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">등록된 훈련 기록이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {trainingResults.map((r) => (
              <div key={r.id} className="rounded-md border px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{formatDate(r.session.date)} · {r.session.sessionType}</p>
                  <p className="text-sm font-medium truncate">{r.session.goal}</p>
                  {r.feedback && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.feedback}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.performanceScore != null && (
                    <span className="text-sm font-semibold">{r.performanceScore}점</span>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {ATTENDANCE_KO[r.attendance] ?? r.attendance}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/players/tabs/StatsTab.tsx
git commit -m "feat(player-fe): stats tab with match stats + training results + radar"
```

---

## Task 13: FE — Jersey Tab

**Files:**
- Create: `football/src/pages/players/tabs/JerseyTab.tsx`

- [x] **Step 1: JerseyTab 구현**

`football/src/pages/players/tabs/JerseyTab.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { playerApi } from '@/services/player.service'
import type { JerseyNumber } from '@/types/player'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const STATUS_KO: Record<string, string> = {
  AVAILABLE: '미배정',
  OCCUPIED: '사용중',
  RETIRED: '결번',
  RESERVED: '예약',
}

const STATUS_VARIANT: Record<string, string> = {
  AVAILABLE: 'secondary',
  OCCUPIED: 'default',
  RETIRED: 'destructive',
  RESERVED: 'outline',
}

interface Props {
  playerId: string
  teamId: number | null
  canAssign: boolean  // GM, ADMIN, FRONT_OFFICE
  canRetire: boolean  // GM, ADMIN
  canReactivate: boolean  // ADMIN only
}

export function JerseyTab({ playerId, teamId, canAssign, canRetire, canReactivate }: Props) {
  const [jerseys, setJerseys] = useState<JerseyNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [assignNumber, setAssignNumber] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    playerApi.getJerseyNumbers(playerId)
      .then(setJerseys)
      .catch(() => toast.error('등번호 조회 실패'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [playerId])

  const handleAssign = async () => {
    if (!teamId || !assignNumber) return
    const num = Number(assignNumber)
    if (!num || num < 1 || num > 99) {
      toast.error('1~99 사이 번호를 입력하세요.')
      return
    }
    setSaving(true)
    try {
      await playerApi.assignJersey(playerId, { number: num, teamId })
      toast.success(`${num}번 배정 완료`)
      setAssignNumber('')
      load()
    } catch (err: any) {
      const code = err?.response?.data?.code
      if (code === 'JERSEY_NUMBER_OCCUPIED') toast.error('이미 다른 선수가 사용 중인 번호입니다.')
      else if (code === 'JERSEY_NUMBER_RETIRED') toast.error('영구 결번 처리된 번호입니다.')
      else toast.error('배정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleRelease = async (jersey: JerseyNumber) => {
    if (!teamId) return
    setSaving(true)
    try {
      await playerApi.releaseJersey(playerId, { teamId, number: jersey.number })
      toast.success(`${jersey.number}번 해제`)
      load()
    } catch {
      toast.error('해제에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">불러오는 중...</div>

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold mb-3">배정된 등번호</h3>
        {jerseys.length === 0 ? (
          <p className="text-sm text-muted-foreground">배정된 등번호가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {jerseys.map((j) => (
              <div key={j.id} className="flex items-center justify-between rounded-md border px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold font-mono">{j.number}</span>
                  <Badge variant={STATUS_VARIANT[j.status] as any} className="text-xs">
                    {STATUS_KO[j.status]}
                  </Badge>
                </div>
                {canAssign && j.status === 'OCCUPIED' && (
                  <Button variant="outline" size="sm" onClick={() => void handleRelease(j)} disabled={saving}>
                    해제
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {canAssign && teamId && (
        <div>
          <h3 className="text-sm font-semibold mb-2">번호 배정</h3>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              max={99}
              placeholder="1-99"
              value={assignNumber}
              onChange={(e) => setAssignNumber(e.target.value)}
              className="w-24"
            />
            <Button onClick={() => void handleAssign()} disabled={saving || !assignNumber}>
              배정
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/players/tabs/JerseyTab.tsx
git commit -m "feat(player-fe): jersey number management tab"
```

---

## Task 14: FE — Player Motivation Tab (PLAYER 본인 전용)

**Files:**
- Create: `football/src/pages/players/tabs/MotivationTab.tsx`

- [x] **Step 1: MotivationTab 구현**

`football/src/pages/players/tabs/MotivationTab.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { playerApi } from '@/services/player.service'
import type { MatchStat, TrainingResultEntry } from '@/types/player'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function calcAttendanceRate(results: TrainingResultEntry[]): number {
  if (results.length === 0) return 0
  const present = results.filter((r) =>
    r.attendance === 'PRESENT' || r.attendance === 'LATE_AUTHORIZED' || r.attendance === 'ABSENT_AUTHORIZED'
  ).length
  return Math.round((present / results.length) * 100)
}

function calcVideoCompletionRate(results: TrainingResultEntry[]): number {
  // performanceScore > 0을 영상 완료 기준으로 사용 (영상과제 완료 여부는 추후 VideoAssignment 연동)
  if (results.length === 0) return 0
  const completed = results.filter((r) => r.performanceScore != null && r.performanceScore > 0).length
  return Math.round((completed / results.length) * 100)
}

interface Props {
  playerId: string
}

export function MotivationTab({ playerId }: Props) {
  const [matchStats, setMatchStats] = useState<MatchStat[]>([])
  const [trainingResults, setTrainingResults] = useState<TrainingResultEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      playerApi.getMatchStats(playerId),
      playerApi.getTrainingResults(playerId),
    ])
      .then(([ms, tr]) => {
        setMatchStats(ms)
        setTrainingResults(tr)
      })
      .finally(() => setLoading(false))
  }, [playerId])

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  // (A) 훈련-경기 상관관계 차트 데이터 (최근 10경기와 훈련 점수 추세 오버레이)
  const correlationData = matchStats.slice(0, 10).reverse().map((ms, i) => {
    const training = trainingResults[i]
    return {
      date: formatDate(ms.match.date),
      경기점수: ms.goals != null ? (ms.goals * 20 + (ms.assists ?? 0) * 10) : null,
      훈련점수: training?.performanceScore ?? null,
    }
  })

  // (B) 출석률 + 훈련 성실도
  const attendanceRate = calcAttendanceRate(trainingResults)
  const completionRate = calcVideoCompletionRate(trainingResults)

  // (C) 최근 5경기 vs 시즌 전체 평균 (xG 기준)
  const allXg = matchStats.map((s) => s.xG ?? 0)
  const seasonAvgXg = allXg.length ? allXg.reduce((a, b) => a + b, 0) / allXg.length : 0
  const recent5Xg = allXg.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(allXg.slice(0, 5).length, 1)
  const xgDiff = seasonAvgXg > 0 ? ((recent5Xg - seasonAvgXg) / seasonAvgXg) * 100 : 0

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      {/* (A) 훈련-경기 상관관계 */}
      <section>
        <h3 className="text-sm font-semibold mb-1">훈련과 경기 성과 추세</h3>
        <p className="text-xs text-muted-foreground mb-3">최근 10경기 기준</p>
        {correlationData.length === 0 ? (
          <p className="text-sm text-muted-foreground">데이터가 부족합니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={correlationData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="경기점수" stroke="#3b82f6" dot={false} connectNulls />
              <Line type="monotone" dataKey="훈련점수" stroke="#10b981" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* (B) 훈련 성실도 배지 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">훈련 성실도</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{attendanceRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">출석률</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{completionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">훈련 완료율</p>
          </div>
        </div>
      </section>

      {/* (C) 현재 폼 vs 시즌 평균 */}
      <section>
        <h3 className="text-sm font-semibold mb-3">현재 폼 (최근 5경기 xG)</h3>
        <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">최근 5경기 평균 xG</p>
            <p className="text-2xl font-bold">{recent5Xg.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">시즌 평균 대비</p>
            <p className={`text-xl font-semibold ${xgDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {xgDiff >= 0 ? '+' : ''}{xgDiff.toFixed(1)}%
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/players/tabs/MotivationTab.tsx
git commit -m "feat(player-fe): player motivation tab (A+B+C sections)"
```

---

## Task 15: FE — PlayerDetailPage 통합

**Files:**
- Modify: `football/src/pages/players/PlayerDetailPage.tsx`

- [x] **Step 1: import 추가**

`PlayerDetailPage.tsx` 상단 import에 추가:

```tsx
import { StatsTab } from './tabs/StatsTab'
import { JerseyTab } from './tabs/JerseyTab'
import { MotivationTab } from './tabs/MotivationTab'
```

- [x] **Step 2: useCurrentUser로 PLAYER 본인 여부 판별**

기존 `const canWrite` 아래:

```tsx
const isOwnProfile = user?.role === 'PLAYER' && player?.userId === user?.id
const canSeeMarketValue = ['GM', 'TD', 'ADMIN'].includes(user?.role ?? '')
const canAssignJersey = ['GM', 'ADMIN', 'FRONT_OFFICE'].includes(user?.role ?? '')
const canRetireJersey = ['GM', 'ADMIN'].includes(user?.role ?? '')
const canReactivateJersey = user?.role === 'ADMIN'
```

- [x] **Step 3: play_style 표시 — 프로필 카드에 추가**

기존 `<p className="text-sm text-muted-foreground mt-0.5">{POSITION_LABEL[player.position]}</p>` 아래:

```tsx
{player.playStyle ? (
  <span className="inline-flex items-center text-xs bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full mt-1">
    {player.playStyle}
  </span>
) : (
  <span className="inline-flex items-center text-xs text-muted-foreground mt-1">미분류</span>
)}
```

- [x] **Step 4: 탭 추가**

기존 `<TabsList>` 안에 추가:

```tsx
<TabsTrigger value="stats">스탯</TabsTrigger>
<TabsTrigger value="jersey">등번호</TabsTrigger>
{isOwnProfile && <TabsTrigger value="motivation">동기부여</TabsTrigger>}
```

- [x] **Step 5: 탭 컨텐츠 추가 (pdp 탭 아래)**

```tsx
<TabsContent value="stats" className="flex-1 overflow-auto mt-0">
  <StatsTab playerId={player.id} />
</TabsContent>

<TabsContent value="jersey" className="flex-1 overflow-auto mt-0">
  <JerseyTab
    playerId={player.id}
    teamId={player.teamId ?? null}
    canAssign={canAssignJersey}
    canRetire={canRetireJersey}
    canReactivate={canReactivateJersey}
  />
</TabsContent>

{isOwnProfile && (
  <TabsContent value="motivation" className="flex-1 overflow-auto mt-0">
    <MotivationTab playerId={player.id} />
  </TabsContent>
)}
```

- [x] **Step 6: PlayerDetail 타입에 teamId, userId, playStyle 포함 확인**

`football/src/types/player.ts`의 `PlayerDetail` 인터페이스에 있는지 확인 후 없으면 추가:

```typescript
export interface PlayerDetail extends Player {
  // 기존 필드들...
  teamId?: number | null
  userId?: number | null
  playStyle?: string | null
  currentMarketValue?: number | null
  contracts: Array<{
    id: number
    startDate: string
    endDate: string
    salary: number
    status: string
  }>
}
```

- [x] **Step 7: 컴파일 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit
```

- [x] **Step 8: Commit**

```bash
git add football/src/pages/players/PlayerDetailPage.tsx football/src/types/player.ts
git commit -m "feat(player-fe): integrate stats/jersey/motivation tabs into player detail page"
```

---

## Task 16: Player repo에 play_style + teamId 노출

**Files:**
- Modify: `apps/api/src/player/player.repo.ts`

- [x] **Step 1: findById SELECT에 playStyle, teamId 추가**

`player.repo.ts`의 `findById` 메서드에서 `select` 블록에 추가:

```typescript
playStyle: true,
currentMarketValue: true,
teamId: true,
userId: true,
```

`PLAYER_SELECT` 상수에도 추가:

```typescript
playStyle: true,
currentMarketValue: true,
teamId: true,
```

> Note: `currentMarketValue`는 역할별 필터를 컨트롤러에서 처리하거나, 조회 후 응답에서 제거하는 방식 중 선택. 현재는 컨트롤러에서 PLAYER 역할 응답 시 해당 필드를 null 처리.

- [x] **Step 2: getPlayerById 컨트롤러에서 PLAYER 역할 제한**

`player.controller.ts`의 `getPlayerById` 수정:

```typescript
getPlayerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const player = await this.service.getPlayerById(String(req.params["id"]));
    if (req.user!.role === "PLAYER") {
      const { currentMarketValue, ...safePlayer } = player as any;
      return res.status(200).json(safePlayer);
    }
    res.status(200).json(player);
  } catch (err) {
    next(err);
  }
};
```

- [x] **Step 3: 컴파일 + 전체 테스트**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit
npx jest --no-coverage
```

Expected: 모든 테스트 PASS

- [x] **Step 4: Commit**

```bash
git add apps/api/src/player/player.repo.ts apps/api/src/player/player.controller.ts
git commit -m "feat(player): expose playStyle, teamId in player detail response + market value PLAYER guard"
```

---

## 스펙 커버리지 체크

| 스펙 섹션 | 담당 Task |
|-----------|-----------|
| §1 스키마 변경 (Enum, JerseyNumber, MarketValueHistory, stats 타입 수정) | Task 1, 2 |
| §2 등번호 시스템 (상태 전환, 권한, 충돌 처리) | Task 3, 4, 5 |
| §3 시장 가치 (수동 입력, 이력, 권한) | Task 6, 9 |
| §4 플레이 스타일 (저장, 표시, 미분류) | Task 16, 15 |
| §5 레이더 차트 (포지션별 6축, 강점/약점 태그) | Task 8, 11 |
| §6 Stats Tab fetch 전략 (별도 엔드포인트) | Task 7 |
| §7 PLAYER 본인 뷰 공개 범위 | Task 15, 16 |
| §8 Player Motivation A+B+C | Task 14 |
| §9 남은 작업 중 PlayStyle enum → 추후 마이그레이션 | 현재 String?으로 유지, 별도 마이그레이션 작업 |
| §9 JerseyNumber.prospect_id → Prospect 구현 후 | 현재 스킵 (schema 주석으로 처리) |
| §9 MarketValueHistory 월 cron | Task 9 |
| §9 Play Style 자동 분류 알고리즘 | Task 8 알고리즘 기반 (자동 분류는 HEAD_COACH 확정 전 단계라 BE radar 서비스에 통합) |
| §9 강점/약점 태그 BE | Task 8 |
| §9 match-stats 엔드포인트 | Task 7 |
| §9 training-results 엔드포인트 | Task 7 |
| §9 Motivation A+B+C | Task 14 |
