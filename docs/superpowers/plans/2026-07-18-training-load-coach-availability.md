# TrainingLoad + CoachAvailability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 훈련 부하(TrainingLoad)와 코치 가용성(CoachAvailability) 도메인에 BE API와 FE UI를 구현하여 PHYSICAL_COACH가 선수별 부하를 관리하고 HEAD_COACH가 훈련 계획 시 코치 가용성을 확인할 수 있게 한다.

**Architecture:** Prisma 스키마는 이미 있으므로 repo → service → controller → routes 레이어만 추가한다. CoachAvailability는 독립 라우터(`/coach-availabilities`)로, TrainingLoad는 독립 라우터(`/training-loads`)로 분리한다. FE는 CoachAvailability를 별도 페이지로, TrainingLoad를 TrainingDetailPage 내 섹션으로 추가한다.

**Tech Stack:** Express, Prisma, TypeScript (BE) / React, shadcn/ui, sonner (FE)

---

## 파일 구조

**BE 신규 생성:**
- `apps/api/src/coach-availability/coach-availability.repo.ts`
- `apps/api/src/coach-availability/coach-availability.service.ts`
- `apps/api/src/coach-availability/coach-availability.controller.ts`
- `apps/api/src/coach-availability/coach-availability.routes.ts`
- `apps/api/src/coach-availability/dto/coach-availability.dto.ts`
- `apps/api/src/training-load/training-load.repo.ts`
- `apps/api/src/training-load/training-load.service.ts`
- `apps/api/src/training-load/training-load.controller.ts`
- `apps/api/src/training-load/training-load.routes.ts`
- `apps/api/src/training-load/dto/training-load.dto.ts`

**BE 수정:**
- `apps/api/src/apiRouter.ts` — 두 라우터 등록
- `apps/api/src/notification/notification.repo.ts` — `createForPhysicalCoach` 추가

**FE 신규 생성:**
- `football/src/pages/training/CoachAvailabilityPage.tsx`
- `football/src/services/coach-availability.service.ts`
- `football/src/services/training-load.service.ts`
- `football/src/types/coach-availability.ts`
- `football/src/types/training-load.ts`

**FE 수정:**
- `football/src/pages/training/TrainingDetailPage.tsx` — TrainingLoad 섹션 추가
- `football/src/App.tsx` — CoachAvailabilityPage 라우트 추가
- `football/src/layouts/AppShell.tsx` — 사이드바 링크 추가

**테스트:**
- `apps/api/__test__/training-load/training-load.test.ts`

---

## Task 1: `createForPhysicalCoach` 알림 메서드 추가

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`

- [x] **Step 1: 메서드 추가**

`createForCoachingStaff` 메서드 바로 아래에 추가:

```typescript
createForPhysicalCoach(type: string, title: string, body: string, entityId?: number) {
  return this.prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({
      where: { role: "COACHING_STAFF", coachingRole: "PHYSICAL_COACH" },
      select: { id: true },
    });
    if (users.length === 0) return;
    await tx.notification.createMany({
      data: users.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
    });
  });
}
```

- [x] **Step 2: 커밋**

```bash
git add apps/api/src/notification/notification.repo.ts
git commit -m "feat(notification): add createForPhysicalCoach method"
```

---

## Task 2: CoachAvailability DTO + Repo

**Files:**
- Create: `apps/api/src/coach-availability/dto/coach-availability.dto.ts`
- Create: `apps/api/src/coach-availability/coach-availability.repo.ts`

- [x] **Step 1: DTO 작성**

```typescript
// apps/api/src/coach-availability/dto/coach-availability.dto.ts
export interface CreateCoachAvailabilityDto {
  userId: number;
  startDate: string; // ISO date string
  endDate: string;
  reason?: string;
}

export interface CoachAvailabilityQuery {
  userId?: number;
  from?: string;
  to?: string;
}
```

- [x] **Step 2: Repo 작성**

```typescript
// apps/api/src/coach-availability/coach-availability.repo.ts
import { PrismaClient } from "../generated/client";
import { CreateCoachAvailabilityDto, CoachAvailabilityQuery } from "./dto/coach-availability.dto";

export class CoachAvailabilityRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: CoachAvailabilityQuery) {
    return this.prisma.coachAvailability.findMany({
      where: {
        ...(query.userId && { userId: query.userId }),
        ...(query.from || query.to
          ? {
              OR: [
                {
                  startDate: {
                    ...(query.from && { gte: new Date(query.from) }),
                    ...(query.to && { lte: new Date(query.to) }),
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        user: { select: { id: true, nickname: true, coachingRole: true } },
      },
      orderBy: { startDate: "asc" },
    });
  }

  findById(id: number) {
    return this.prisma.coachAvailability.findUnique({ where: { id } });
  }

  create(dto: CreateCoachAvailabilityDto, createdById: number) {
    return this.prisma.coachAvailability.create({
      data: {
        userId: dto.userId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        reason: dto.reason ?? null,
        createdById,
      },
    });
  }

  delete(id: number) {
    return this.prisma.coachAvailability.delete({ where: { id } });
  }

  findConflicts(date: Date) {
    return this.prisma.coachAvailability.findMany({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
      },
      include: {
        user: { select: { id: true, nickname: true, coachingRole: true } },
      },
    });
  }
}
```

- [x] **Step 3: 커밋**

```bash
git add apps/api/src/coach-availability/
git commit -m "feat(coach-availability): add DTO and repository"
```

---

## Task 3: CoachAvailability Service + Controller + Routes

**Files:**
- Create: `apps/api/src/coach-availability/coach-availability.service.ts`
- Create: `apps/api/src/coach-availability/coach-availability.controller.ts`
- Create: `apps/api/src/coach-availability/coach-availability.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: Service 작성**

```typescript
// apps/api/src/coach-availability/coach-availability.service.ts
import { CoachAvailabilityRepository } from "./coach-availability.repo";
import { AppError } from "../lib/appError";
import { CreateCoachAvailabilityDto, CoachAvailabilityQuery } from "./dto/coach-availability.dto";

export class CoachAvailabilityService {
  constructor(private repo: CoachAvailabilityRepository) {}

  getAll(query: CoachAvailabilityQuery) {
    return this.repo.findAll(query);
  }

  async create(dto: CreateCoachAvailabilityDto, createdById: number) {
    if (new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new AppError(400, "START_AFTER_END");
    }
    return this.repo.create(dto, createdById);
  }

  async delete(id: number, requesterId: number, isAdmin: boolean) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "NOT_FOUND");
    if (!isAdmin && record.createdById !== requesterId) {
      throw new AppError(403, "FORBIDDEN");
    }
    return this.repo.delete(id);
  }

  getConflicts(date: string) {
    return this.repo.findConflicts(new Date(date));
  }
}
```

- [x] **Step 2: Controller 작성**

```typescript
// apps/api/src/coach-availability/coach-availability.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { CoachAvailabilityService } from "./coach-availability.service";

export class CoachAvailabilityController {
  constructor(private service: CoachAvailabilityService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, from, to } = req.query;
      res.json(
        await this.service.getAll({
          userId: userId ? Number(userId) : undefined,
          from: from as string | undefined,
          to: to as string | undefined,
        }),
      );
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole, id: requesterId } = req.user!;
      const canCreate =
        role === "ADMIN" ||
        (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH") ||
        (role === "COACHING_STAFF" && req.body.userId === requesterId);
      if (!canCreate) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, requesterId));
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: requesterId, role } = req.user!;
      await this.service.delete(Number(req.params["id"]), requesterId, role === "ADMIN");
      res.status(204).send();
    } catch (err) { next(err); }
  };

  getConflicts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date } = req.query;
      if (!date) throw new AppError(400, "DATE_REQUIRED");
      res.json(await this.service.getConflicts(date as string));
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 3: Routes 작성**

```typescript
// apps/api/src/coach-availability/coach-availability.routes.ts
import { Router } from "express";
import passport from "passport";
import { CoachAvailabilityController } from "./coach-availability.controller";
import { CoachAvailabilityService } from "./coach-availability.service";
import { CoachAvailabilityRepository } from "./coach-availability.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new CoachAvailabilityRepository(getPrisma());
const service = new CoachAvailabilityService(repo);
const controller = new CoachAvailabilityController(service);
const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getAll);
router.get("/conflicts", auth, controller.getConflicts);
router.post("/", auth, controller.create);
router.delete("/:id", auth, controller.delete);

export default router;
```

- [x] **Step 4: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts`를 열어 다른 라우터 import 패턴 그대로 추가:

```typescript
import coachAvailabilityRouter from "./coach-availability/coach-availability.routes";
// ...
router.use("/coach-availabilities", coachAvailabilityRouter);
```

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/coach-availability/ apps/api/src/apiRouter.ts
git commit -m "feat(coach-availability): add service, controller, and routes"
```

---

## Task 4: TrainingLoad 순수 함수 + 테스트

**Files:**
- Create: `apps/api/__test__/training-load/training-load.test.ts`
- Create: `apps/api/src/training-load/training-load.service.ts` (순수 함수만 먼저)

- [x] **Step 1: 순수 함수 먼저 작성 (service에 export)**

```typescript
// apps/api/src/training-load/training-load.service.ts (일부 — 순수 함수)
export const WEEKLY_LOAD_THRESHOLD = 500;

export function isWeeklyOverload(weeklyTotal: number): boolean {
  return weeklyTotal >= WEEKLY_LOAD_THRESHOLD;
}
```

- [x] **Step 2: 단위 테스트 작성**

```typescript
// apps/api/__test__/training-load/training-load.test.ts
import { isWeeklyOverload, WEEKLY_LOAD_THRESHOLD } from "../../src/training-load/training-load.service";

describe("isWeeklyOverload", () => {
  it("임계값 미만이면 false", () => {
    expect(isWeeklyOverload(499)).toBe(false);
  });
  it("임계값 정확히 500이면 true", () => {
    expect(isWeeklyOverload(WEEKLY_LOAD_THRESHOLD)).toBe(true);
  });
  it("임계값 초과이면 true", () => {
    expect(isWeeklyOverload(600)).toBe(true);
  });
  it("0이면 false", () => {
    expect(isWeeklyOverload(0)).toBe(false);
  });
});
```

- [x] **Step 3: 테스트 실행 (실패 확인)**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="training-load" --no-coverage 2>&1 | tail -20
```

Expected: FAIL (함수 미구현)

- [x] **Step 4: 구현 후 테스트 통과 확인**

`isWeeklyOverload` 구현 후:

```bash
npx jest --testPathPattern="training-load" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [x] **Step 5: 커밋**

```bash
git add apps/api/__test__/training-load/ apps/api/src/training-load/training-load.service.ts
git commit -m "test(training-load): add weekly overload pure function tests"
```

---

## Task 5: TrainingLoad Repo + Service (전체)

**Files:**
- Create: `apps/api/src/training-load/dto/training-load.dto.ts`
- Create: `apps/api/src/training-load/training-load.repo.ts`
- Modify: `apps/api/src/training-load/training-load.service.ts`

- [x] **Step 1: DTO 작성**

```typescript
// apps/api/src/training-load/dto/training-load.dto.ts
export interface UpsertTrainingLoadDto {
  playerId: string;
  sessionId: number;
  rpe?: number;  // 1–10, PLAYER 본인만
  load?: number; // PHYSICAL_COACH / HEAD_COACH / ADMIN
}

export interface TrainingLoadQuery {
  sessionId?: number;
  playerId?: string;
}

export interface WeeklySummaryQuery {
  playerId: string;
  weekStart: string; // ISO date (월요일)
}
```

- [x] **Step 2: Repo 작성**

```typescript
// apps/api/src/training-load/training-load.repo.ts
import { PrismaClient } from "../generated/client";
import { UpsertTrainingLoadDto, TrainingLoadQuery } from "./dto/training-load.dto";

export class TrainingLoadRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: TrainingLoadQuery) {
    return this.prisma.trainingLoad.findMany({
      where: {
        ...(query.sessionId && { sessionId: query.sessionId }),
        ...(query.playerId && { playerId: query.playerId }),
      },
      include: {
        player: { select: { id: true, playerName: true, position: true } },
        session: { select: { id: true, date: true, sessionType: true } },
      },
      orderBy: { session: { date: "desc" } },
    });
  }

  upsert(dto: UpsertTrainingLoadDto) {
    return this.prisma.trainingLoad.upsert({
      where: { playerId_sessionId: { playerId: dto.playerId, sessionId: dto.sessionId } },
      create: {
        playerId: dto.playerId,
        sessionId: dto.sessionId,
        rpe: dto.rpe ?? 5,
        load: dto.load ?? null,
      },
      update: {
        ...(dto.rpe !== undefined && { rpe: dto.rpe }),
        ...(dto.load !== undefined && { load: dto.load }),
      },
    });
  }

  async getWeeklyLoadTotal(playerId: string, weekStart: Date): Promise<number> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const rows = await this.prisma.trainingLoad.findMany({
      where: {
        playerId,
        load: { not: null },
        session: { date: { gte: weekStart, lt: weekEnd } },
      },
      select: { load: true },
    });
    return rows.reduce((sum, r) => sum + (r.load ?? 0), 0);
  }

  getPlayerName(playerId: string) {
    return this.prisma.player.findUnique({
      where: { id: playerId },
      select: { playerName: true },
    });
  }
}
```

- [x] **Step 3: Service 전체 완성**

```typescript
// apps/api/src/training-load/training-load.service.ts
import { TrainingLoadRepository } from "./training-load.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { UpsertTrainingLoadDto, TrainingLoadQuery, WeeklySummaryQuery } from "./dto/training-load.dto";
import { AppError } from "../lib/appError";

export const WEEKLY_LOAD_THRESHOLD = 500;

export function isWeeklyOverload(weeklyTotal: number): boolean {
  return weeklyTotal >= WEEKLY_LOAD_THRESHOLD;
}

export class TrainingLoadService {
  constructor(
    private repo: TrainingLoadRepository,
    private notifRepo: NotificationRepository,
  ) {}

  getAll(query: TrainingLoadQuery) {
    return this.repo.findAll(query);
  }

  async upsert(
    dto: UpsertTrainingLoadDto,
    requesterId: string,
    requesterRole: string,
    requesterCoachingRole: string | null,
  ) {
    const isPlayer = requesterRole === "PLAYER";
    const isPhysicalCoach = requesterRole === "COACHING_STAFF" && requesterCoachingRole === "PHYSICAL_COACH";
    const isHeadCoach = requesterRole === "COACHING_STAFF" && requesterCoachingRole === "HEAD_COACH";
    const isAdmin = requesterRole === "ADMIN";

    if (dto.rpe !== undefined) {
      if (!isPlayer) throw new AppError(403, "RPE_PLAYER_ONLY");
      if (dto.playerId !== requesterId) throw new AppError(403, "RPE_OWN_ONLY");
      if (dto.rpe < 1 || dto.rpe > 10) throw new AppError(400, "RPE_OUT_OF_RANGE");
    }
    if (dto.load !== undefined) {
      if (!isPhysicalCoach && !isHeadCoach && !isAdmin) throw new AppError(403, "LOAD_COACH_ONLY");
    }

    const result = await this.repo.upsert(dto);

    if (dto.load !== undefined) {
      const weekStart = this.getWeekStart(new Date());
      const total = await this.repo.getWeeklyLoadTotal(dto.playerId, weekStart);
      if (isWeeklyOverload(total)) {
        const player = await this.repo.getPlayerName(dto.playerId);
        const playerName = player?.playerName ?? dto.playerId;
        void Promise.all([
          this.notifRepo
            .createForPhysicalCoach(
              "TRAINING_LOAD_ALERT",
              "훈련 부하 초과",
              `${playerName} 선수의 이번 주 누적 부하(${total})가 임계값(${WEEKLY_LOAD_THRESHOLD})을 초과했습니다.`,
            )
            .catch(console.error),
          this.notifRepo
            .createForHeadCoach(
              "TRAINING_LOAD_ALERT",
              "훈련 부하 초과",
              `${playerName} 선수의 이번 주 누적 부하(${total})가 임계값(${WEEKLY_LOAD_THRESHOLD})을 초과했습니다.`,
            )
            .catch(console.error),
        ]);
      }
    }

    return result;
  }

  async getWeeklySummary(query: WeeklySummaryQuery) {
    const weekStart = new Date(query.weekStart);
    const total = await this.repo.getWeeklyLoadTotal(query.playerId, weekStart);
    return { playerId: query.playerId, weekStart: query.weekStart, total, overload: isWeeklyOverload(total) };
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일 기준
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
```

- [x] **Step 4: 커밋**

```bash
git add apps/api/src/training-load/
git commit -m "feat(training-load): add DTO, repo, and service with weekly overload alert"
```

---

## Task 6: TrainingLoad Controller + Routes

**Files:**
- Create: `apps/api/src/training-load/training-load.controller.ts`
- Create: `apps/api/src/training-load/training-load.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: Controller 작성**

```typescript
// apps/api/src/training-load/training-load.controller.ts
import { Request, Response, NextFunction } from "express";
import { TrainingLoadService } from "./training-load.service";

export class TrainingLoadController {
  constructor(private service: TrainingLoadService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, playerId } = req.query;
      res.json(
        await this.service.getAll({
          sessionId: sessionId ? Number(sessionId) : undefined,
          playerId: playerId as string | undefined,
        }),
      );
    } catch (err) { next(err); }
  };

  upsert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, role, coachingRole } = req.user!;
      res.status(200).json(
        await this.service.upsert(req.body, String(id), role, coachingRole ?? null),
      );
    } catch (err) { next(err); }
  };

  getWeeklySummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { playerId, weekStart } = req.query;
      res.json(
        await this.service.getWeeklySummary({
          playerId: playerId as string,
          weekStart: weekStart as string,
        }),
      );
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 2: Routes 작성**

```typescript
// apps/api/src/training-load/training-load.routes.ts
import { Router } from "express";
import passport from "passport";
import { TrainingLoadController } from "./training-load.controller";
import { TrainingLoadService } from "./training-load.service";
import { TrainingLoadRepository } from "./training-load.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new TrainingLoadRepository(getPrisma());
const notifRepo = new NotificationRepository(getPrisma());
const service = new TrainingLoadService(repo, notifRepo);
const controller = new TrainingLoadController(service);
const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getAll);
router.get("/weekly-summary", auth, controller.getWeeklySummary);
router.post("/", auth, controller.upsert);

export default router;
```

- [x] **Step 3: apiRouter.ts에 등록**

```typescript
import trainingLoadRouter from "./training-load/training-load.routes";
// ...
router.use("/training-loads", trainingLoadRouter);
```

- [x] **Step 4: 커밋**

```bash
git add apps/api/src/training-load/ apps/api/src/apiRouter.ts
git commit -m "feat(training-load): add controller and routes"
```

---

## Task 7: FE 타입 + 서비스

**Files:**
- Create: `football/src/types/coach-availability.ts`
- Create: `football/src/types/training-load.ts`
- Create: `football/src/services/coach-availability.service.ts`
- Create: `football/src/services/training-load.service.ts`

- [x] **Step 1: 타입 작성**

```typescript
// football/src/types/coach-availability.ts
export interface CoachAvailability {
  id: number
  userId: number
  startDate: string
  endDate: string
  reason: string | null
  createdById: number
  createdAt: string
  user: { id: number; nickname: string; coachingRole: string | null }
}

export interface CreateCoachAvailabilityPayload {
  userId: number
  startDate: string
  endDate: string
  reason?: string
}
```

```typescript
// football/src/types/training-load.ts
export interface TrainingLoad {
  id: number
  playerId: string
  sessionId: number
  rpe: number
  load: number | null
  player: { id: string; playerName: string; position: string }
  session: { id: number; date: string; sessionType: string }
}

export interface WeeklySummary {
  playerId: string
  weekStart: string
  total: number
  overload: boolean
}

export interface UpsertTrainingLoadPayload {
  playerId: string
  sessionId: number
  rpe?: number
  load?: number
}
```

- [x] **Step 2: FE 서비스 작성**

```typescript
// football/src/services/coach-availability.service.ts
import { api } from './api'
import type { CoachAvailability, CreateCoachAvailabilityPayload } from '@/types/coach-availability'

export const coachAvailabilityApi = {
  list: (params?: { userId?: number; from?: string; to?: string }) => {
    const q = new URLSearchParams()
    if (params?.userId) q.set('userId', String(params.userId))
    if (params?.from) q.set('from', params.from)
    if (params?.to) q.set('to', params.to)
    return api.get<CoachAvailability[]>(`/coach-availabilities?${q}`)
  },
  conflicts: (date: string) =>
    api.get<CoachAvailability[]>(`/coach-availabilities/conflicts?date=${date}`),
  create: (payload: CreateCoachAvailabilityPayload) =>
    api.post<CoachAvailability>('/coach-availabilities', payload),
  delete: (id: number) => api.delete<void>(`/coach-availabilities/${id}`),
}
```

```typescript
// football/src/services/training-load.service.ts
import { api } from './api'
import type { TrainingLoad, WeeklySummary, UpsertTrainingLoadPayload } from '@/types/training-load'

export const trainingLoadApi = {
  list: (params?: { sessionId?: number; playerId?: string }) => {
    const q = new URLSearchParams()
    if (params?.sessionId) q.set('sessionId', String(params.sessionId))
    if (params?.playerId) q.set('playerId', params.playerId)
    return api.get<TrainingLoad[]>(`/training-loads?${q}`)
  },
  upsert: (payload: UpsertTrainingLoadPayload) =>
    api.post<TrainingLoad>('/training-loads', payload),
  weeklySummary: (playerId: string, weekStart: string) =>
    api.get<WeeklySummary>(`/training-loads/weekly-summary?playerId=${playerId}&weekStart=${weekStart}`),
}
```

- [x] **Step 3: 커밋**

```bash
git add football/src/types/coach-availability.ts football/src/types/training-load.ts football/src/services/coach-availability.service.ts football/src/services/training-load.service.ts
git commit -m "feat(training-load): add FE types and API services"
```

---

## Task 8: CoachAvailabilityPage FE

**Files:**
- Create: `football/src/pages/training/CoachAvailabilityPage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [x] **Step 1: 페이지 작성**

```tsx
// football/src/pages/training/CoachAvailabilityPage.tsx
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { coachAvailabilityApi } from '@/services/coach-availability.service'
import type { CoachAvailability } from '@/types/coach-availability'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Trash2 } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'

const PAGE_SIZE = 10

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

export function CoachAvailabilityPage() {
  const { user } = useCurrentUser()
  const [items, setItems] = useState<CoachAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' })
  const [saving, setSaving] = useState(false)

  const canCreate =
    user?.role === 'ADMIN' ||
    user?.coachingRole === 'HEAD_COACH' ||
    user?.role === 'COACHING_STAFF'

  const fetchItems = () => {
    setLoading(true)
    coachAvailabilityApi.list()
      .then(setItems)
      .catch(() => toast.error('가용성 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchItems() }, [])

  const handleCreate = async () => {
    if (!form.startDate || !form.endDate) {
      toast.error('날짜를 모두 입력해주세요.')
      return
    }
    if (!user) return
    setSaving(true)
    try {
      await coachAvailabilityApi.create({
        userId: user.id,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || undefined,
      })
      toast.success('등록됐습니다.')
      setDialogOpen(false)
      setForm({ startDate: '', endDate: '', reason: '' })
      fetchItems()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await coachAvailabilityApi.delete(id)
      toast.success('삭제됐습니다.')
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">코치 가용성</h1>
          <p className="text-sm text-muted-foreground mt-0.5">훈련 불가 일정 관리</p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            등록된 가용성 블록이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>코치</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>시작일</TableHead>
                <TableHead>종료일</TableHead>
                <TableHead>사유</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.user.nickname}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.user.coachingRole ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(item.startDate)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(item.endDate)}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{item.reason ?? '—'}</TableCell>
                  <TableCell>
                    {(user?.role === 'ADMIN' || item.createdById === user?.id) && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={items.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>가용성 블록 등록</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>시작일 *</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>종료일 *</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>사유</Label>
              <Textarea rows={2} placeholder="사유 (선택)" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>취소</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [x] **Step 2: App.tsx에 라우트 추가**

```tsx
// football/src/App.tsx에 추가
import { CoachAvailabilityPage } from '@/pages/training/CoachAvailabilityPage'
// ...
<Route path="/training/coach-availability" element={<CoachAvailabilityPage />} />
```

라우트는 `/training/results` 앞에 등록 (파라미터 충돌 방지).

- [x] **Step 3: AppShell.tsx 사이드바 추가**

훈련 섹션에 "코치 가용성" 링크 추가 (CalendarX2 아이콘 사용):

```tsx
import { CalendarX2 } from 'lucide-react'
// 훈련 그룹 내 추가:
{ to: '/training/coach-availability', label: '코치 가용성', icon: CalendarX2 }
```

- [x] **Step 4: 커밋**

```bash
git add football/src/pages/training/CoachAvailabilityPage.tsx football/src/App.tsx football/src/layouts/AppShell.tsx
git commit -m "feat(coach-availability): add FE page, route, and sidebar link"
```

---

## Task 9: TrainingDetailPage에 TrainingLoad 섹션 추가

**Files:**
- Modify: `football/src/pages/training/TrainingDetailPage.tsx`

- [x] **Step 1: 기존 페이지 끝 부분에 섹션 추가**

TrainingDetailPage.tsx의 참가자 목록 아래에 TrainingLoad 입력 섹션을 추가한다.

useEffect 훅 아래, return 위에 상태와 fetch 로직 추가:

```tsx
import { trainingLoadApi } from '@/services/training-load.service'
import type { TrainingLoad } from '@/types/training-load'

// 컴포넌트 내 상태
const [loads, setLoads] = useState<TrainingLoad[]>([])
const [loadInputs, setLoadInputs] = useState<Record<string, { rpe: string; load: string }>>({})

// useEffect 내 session fetch 이후 loads 도 fetch
trainingApi.get(Number(id)).then((s) => {
  setSession(s)
  return trainingLoadApi.list({ sessionId: Number(id) })
}).then(setLoads)
```

JSX에서 참가자 섹션 아래에 추가:

```tsx
{/* 훈련 부하 섹션 */}
{session.participants.length > 0 && (
  <div className="px-6 py-4">
    <h3 className="text-sm font-semibold mb-3">훈련 부하</h3>
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>선수</TableHead>
          <TableHead className="w-24 text-center">RPE (1–10)</TableHead>
          <TableHead className="w-24 text-center">부하</TableHead>
          <TableHead className="w-16" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {session.participants.map((p) => {
          const existing = loads.find((l) => l.playerId === p.playerId)
          const input = loadInputs[p.playerId] ?? { rpe: existing ? String(existing.rpe) : '', load: existing?.load != null ? String(existing.load) : '' }
          const isOwnRpe = user?.role === 'PLAYER' && String(user.id) === p.playerId
          const canSetLoad = user?.role === 'ADMIN' || user?.coachingRole === 'PHYSICAL_COACH' || user?.coachingRole === 'HEAD_COACH'
          return (
            <TableRow key={p.playerId}>
              <TableCell className="font-medium">{p.player.playerName}</TableCell>
              <TableCell className="text-center">
                {isOwnRpe ? (
                  <Input
                    type="number" min={1} max={10} className="w-16 h-7 text-center text-sm"
                    value={input.rpe}
                    onChange={(e) => setLoadInputs((prev) => ({ ...prev, [p.playerId]: { ...input, rpe: e.target.value } }))}
                  />
                ) : (
                  <span className="tabular-nums text-sm">{existing?.rpe ?? '—'}</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {canSetLoad ? (
                  <Input
                    type="number" min={0} className="w-20 h-7 text-center text-sm"
                    value={input.load}
                    onChange={(e) => setLoadInputs((prev) => ({ ...prev, [p.playerId]: { ...input, load: e.target.value } }))}
                  />
                ) : (
                  <span className="tabular-nums text-sm">{existing?.load ?? '—'}</span>
                )}
              </TableCell>
              <TableCell>
                {(isOwnRpe || canSetLoad) && (
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs"
                    onClick={async () => {
                      try {
                        const payload: { playerId: string; sessionId: number; rpe?: number; load?: number } = {
                          playerId: p.playerId,
                          sessionId: session.id,
                        }
                        if (isOwnRpe && input.rpe) payload.rpe = Number(input.rpe)
                        if (canSetLoad && input.load) payload.load = Number(input.load)
                        await trainingLoadApi.upsert(payload)
                        toast.success('저장됐습니다.')
                        const updated = await trainingLoadApi.list({ sessionId: session.id })
                        setLoads(updated)
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : '저장 실패')
                      }
                    }}
                  >
                    저장
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  </div>
)}
```

- [x] **Step 2: 커밋**

```bash
git add football/src/pages/training/TrainingDetailPage.tsx
git commit -m "feat(training-load): add TrainingLoad section to TrainingDetailPage"
```

---

## 최종 확인

- [x] `npx tsc --noEmit` (FE 타입 오류 없음)
- [x] `GET /coach-availabilities` 응답 확인
- [x] `POST /training-loads` — PLAYER rpe 입력, PHYSICAL_COACH load 입력 각각 확인
- [x] `GET /training-loads/weekly-summary` 확인
- [x] TrainingDetailPage 부하 섹션 렌더링 확인
