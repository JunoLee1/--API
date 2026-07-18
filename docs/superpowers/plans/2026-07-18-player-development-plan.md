# PlayerDevelopmentPlan (선수 발전 계획) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코치가 선수 × 시즌 단위로 발전 계획(PDP)을 작성하고 DRAFT → ACTIVE → REVIEWED 상태로 관리하며, ACTIVE 전환 시 해당 선수에게 알림을 발송하는 워크플로우를 구현한다.

**Architecture:** Prisma 스키마는 이미 완성되어 있으므로 BE repo/service/controller/routes와 FE 타입/서비스/페이지만 구현한다. PlayerDetailPage에 "발전 계획" 탭을 추가하는 방식으로 FE를 통합한다.

**Tech Stack:** Express + Prisma (BE), React + shadcn/ui Tabs (FE), Jest + 실제 DB (테스트)

---

## File Structure

**BE (신규)**
- `apps/api/src/development-plan/dto/development-plan.dto.ts` — DTO 인터페이스
- `apps/api/src/development-plan/development-plan.repo.ts` — Prisma 쿼리
- `apps/api/src/development-plan/development-plan.service.ts` — 비즈니스 로직 + 상태 전환
- `apps/api/src/development-plan/development-plan.controller.ts` — HTTP 핸들러
- `apps/api/src/development-plan/development-plan.routes.ts` — Express 라우터

**BE (수정)**
- `apps/api/src/apiRouter.ts` — `/development-plans` 라우트 등록
- `apps/api/src/notification/notification.repo.ts` — `createForUser()` 메서드 추가

**테스트 (신규)**
- `apps/api/__test__/development-plan/development-plan.service.test.ts` — 상태 전환 순수 함수 + DB 통합

**FE (신규)**
- `football/src/types/development-plan.ts` — 타입 정의
- `football/src/services/development-plan.service.ts` — API 호출
- `football/src/pages/players/PlayerDevelopmentPlanTab.tsx` — 탭 컴포넌트

**FE (수정)**
- `football/src/pages/players/PlayerDetailPage.tsx` — 발전 계획 탭 추가

---

### Task 1: notification.repo.ts에 createForUser() 추가

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`

- [ ] **Step 1: createForUser 메서드 추가**

파일을 열고 기존 `createForHeadCoach` 메서드 뒤에 추가:

```typescript
createForUser(userId: number, type: string, title: string, body: string, entityId?: number) {
  return this.prisma.notification.create({
    data: { userId, type, title, body, ...(entityId && { entityId }) },
  });
}
```

- [ ] **Step 2: TypeScript 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/notification/notification.repo.ts
git commit -m "feat(notification): add createForUser single-target method"
```

---

### Task 2: BE DTO + Repo

**Files:**
- Create: `apps/api/src/development-plan/dto/development-plan.dto.ts`
- Create: `apps/api/src/development-plan/development-plan.repo.ts`

- [ ] **Step 1: 실패 테스트 작성**

`apps/api/__test__/development-plan/development-plan.service.test.ts` 생성:

```typescript
import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DevelopmentPlanRepository } from '../../src/development-plan/development-plan.repo';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
const repo = new DevelopmentPlanRepository(prisma);

let testPlayerId: string;
let testCoachId: number;
let testSeasonId: number;
let createdPlanId: number;

beforeAll(async () => {
  const player = await prisma.player.findFirst({ select: { id: true } });
  if (!player) throw new Error('테스트 player 없음');
  testPlayerId = player.id;

  const coach = await prisma.user.findFirst({
    where: { role: 'COACHING_STAFF' },
    select: { id: true },
  });
  if (!coach) throw new Error('테스트 COACHING_STAFF user 없음');
  testCoachId = coach.id;

  const season = await prisma.season.findFirst({ select: { id: true } });
  if (!season) throw new Error('테스트 season 없음');
  testSeasonId = season.id;
});

afterAll(async () => {
  if (createdPlanId) {
    await prisma.playerDevelopmentPlan.deleteMany({ where: { id: createdPlanId } });
  }
  await prisma.$disconnect();
});

describe('DevelopmentPlanRepository', () => {
  it('create - DRAFT 상태로 생성', async () => {
    const plan = await repo.create({
      playerId: testPlayerId,
      coachId: testCoachId,
      seasonId: testSeasonId,
      goals: '패스 정확도 향상',
    });
    expect(plan.status).toBe('DRAFT');
    expect(plan.goals).toBe('패스 정확도 향상');
    createdPlanId = plan.id;
  });

  it('findById - 생성된 플랜 조회', async () => {
    const found = await repo.findById(createdPlanId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(createdPlanId);
  });

  it('updateStatus - ACTIVE 전환', async () => {
    const updated = await repo.updateStatus(createdPlanId, 'ACTIVE');
    expect(updated.status).toBe('ACTIVE');
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd apps/api && npx jest __test__/development-plan/development-plan.service.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../src/development-plan/development-plan.repo'`

- [ ] **Step 3: DTO 파일 생성**

`apps/api/src/development-plan/dto/development-plan.dto.ts`:

```typescript
export interface CreatePlanDto {
  playerId: string;
  seasonId: number;
  goals: string;
  notes?: string;
}

export interface UpdatePlanDto {
  goals?: string;
  notes?: string;
}

export interface PlanListQuery {
  playerId?: string;
  seasonId?: number;
}
```

- [ ] **Step 4: Repo 파일 생성**

`apps/api/src/development-plan/development-plan.repo.ts`:

```typescript
import { PrismaClient } from "../generated/client";
import { CreatePlanDto, UpdatePlanDto, PlanListQuery } from "./dto/development-plan.dto";
import { PlayerDevelopmentPlanStatus } from "../generated/enums";

const SELECT = {
  id: true,
  playerId: true,
  coachId: true,
  seasonId: true,
  goals: true,
  notes: true,
  status: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  player: { select: { playerName: true, position: true } },
  coach: { select: { id: true, username: true, nickname: true } },
  season: { select: { id: true, name: true } },
};

export class DevelopmentPlanRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: PlanListQuery) {
    return this.prisma.playerDevelopmentPlan.findMany({
      where: {
        ...(query.playerId && { playerId: query.playerId }),
        ...(query.seasonId && { seasonId: query.seasonId }),
      },
      select: SELECT,
      orderBy: { updatedAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.playerDevelopmentPlan.findUnique({
      where: { id },
      select: SELECT,
    });
  }

  create(dto: CreatePlanDto & { coachId: number }) {
    return this.prisma.playerDevelopmentPlan.create({
      data: {
        playerId: dto.playerId,
        coachId: dto.coachId,
        seasonId: dto.seasonId,
        goals: dto.goals,
        notes: dto.notes ?? null,
      },
      select: SELECT,
    });
  }

  update(id: number, dto: UpdatePlanDto) {
    return this.prisma.playerDevelopmentPlan.update({
      where: { id },
      data: {
        ...(dto.goals !== undefined && { goals: dto.goals }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      select: SELECT,
    });
  }

  updateStatus(id: number, status: PlayerDevelopmentPlanStatus, reviewedAt?: Date) {
    return this.prisma.playerDevelopmentPlan.update({
      where: { id },
      data: {
        status,
        ...(reviewedAt && { reviewedAt }),
      },
      select: SELECT,
    });
  }

  findPlayerUserId(playerId: string) {
    return this.prisma.player.findUnique({
      where: { id: playerId },
      select: { userId: true },
    });
  }
}
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/development-plan/development-plan.service.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 3 passed`

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/development-plan/dto/development-plan.dto.ts \
        apps/api/src/development-plan/development-plan.repo.ts \
        apps/api/__test__/development-plan/development-plan.service.test.ts
git commit -m "feat(development-plan): add repo and DTO with DB integration tests"
```

---

### Task 3: BE Service + Controller + Routes

**Files:**
- Create: `apps/api/src/development-plan/development-plan.service.ts`
- Create: `apps/api/src/development-plan/development-plan.controller.ts`
- Create: `apps/api/src/development-plan/development-plan.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: Service 작성**

`apps/api/src/development-plan/development-plan.service.ts`:

```typescript
import { AppError } from "../lib/appError";
import { DevelopmentPlanRepository } from "./development-plan.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { CreatePlanDto, UpdatePlanDto, PlanListQuery } from "./dto/development-plan.dto";

export class DevelopmentPlanService {
  constructor(
    private repo: DevelopmentPlanRepository,
    private notifRepo: NotificationRepository,
  ) {}

  getAll(query: PlanListQuery) {
    return this.repo.findAll(query);
  }

  async getById(id: number) {
    const plan = await this.repo.findById(id);
    if (!plan) throw new AppError(404, "PLAN_NOT_FOUND");
    return plan;
  }

  async create(dto: CreatePlanDto, coachId: number) {
    return this.repo.create({ ...dto, coachId });
  }

  async update(id: number, dto: UpdatePlanDto, requesterId: number, requesterRole: string, coachingRole?: string | null) {
    const plan = await this.repo.findById(id);
    if (!plan) throw new AppError(404, "PLAN_NOT_FOUND");
    if (plan.status !== "DRAFT") throw new AppError(409, "PLAN_NOT_EDITABLE");

    const isHeadCoach = requesterRole === "COACHING_STAFF" && coachingRole === "HEAD_COACH";
    const isAuthor = plan.coachId === requesterId;
    if (!isHeadCoach && !isAuthor) throw new AppError(403, "FORBIDDEN");

    return this.repo.update(id, dto);
  }

  async activate(id: number, requesterId: number, requesterRole: string, coachingRole?: string | null) {
    const plan = await this.repo.findById(id);
    if (!plan) throw new AppError(404, "PLAN_NOT_FOUND");
    if (plan.status !== "DRAFT") throw new AppError(409, "ALREADY_ACTIVATED");

    const isHeadCoach = requesterRole === "COACHING_STAFF" && coachingRole === "HEAD_COACH";
    const isAuthor = plan.coachId === requesterId;
    if (!isHeadCoach && !isAuthor) throw new AppError(403, "FORBIDDEN");

    const updated = await this.repo.updateStatus(id, "ACTIVE");

    const playerData = await this.repo.findPlayerUserId(plan.playerId);
    if (playerData?.userId) {
      void this.notifRepo
        .createForUser(
          playerData.userId,
          "PLAYER_DEVELOPMENT_PLAN_ACTIVATED",
          "발전 계획이 등록됐습니다",
          "코치가 이번 시즌 발전 계획을 작성하고 활성화했습니다. 확인해보세요.",
          id,
        )
        .catch(console.error);
    }

    return updated;
  }

  async review(id: number, requesterId: number, requesterRole: string, coachingRole?: string | null) {
    const plan = await this.repo.findById(id);
    if (!plan) throw new AppError(404, "PLAN_NOT_FOUND");
    if (plan.status !== "ACTIVE") throw new AppError(409, "PLAN_NOT_ACTIVE");

    const isHeadCoach = requesterRole === "COACHING_STAFF" && coachingRole === "HEAD_COACH";
    if (!isHeadCoach) throw new AppError(403, "FORBIDDEN");

    return this.repo.updateStatus(id, "REVIEWED", new Date());
  }
}
```

- [ ] **Step 2: Controller 작성**

`apps/api/src/development-plan/development-plan.controller.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { DevelopmentPlanService } from "./development-plan.service";

export class DevelopmentPlanController {
  constructor(private service: DevelopmentPlanService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { playerId, seasonId } = req.query;
      res.json(await this.service.getAll({
        playerId: playerId as string | undefined,
        seasonId: seasonId ? Number(seasonId) : undefined,
      }));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      if (role !== "COACHING_STAFF") throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      res.json(await this.service.update(
        Number(req.params["id"]),
        req.body,
        req.user!.id,
        role,
        coachingRole,
      ));
    } catch (err) { next(err); }
  };

  activate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      res.json(await this.service.activate(
        Number(req.params["id"]),
        req.user!.id,
        role,
        coachingRole,
      ));
    } catch (err) { next(err); }
  };

  review = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      res.json(await this.service.review(
        Number(req.params["id"]),
        req.user!.id,
        role,
        coachingRole,
      ));
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 3: Routes 작성**

`apps/api/src/development-plan/development-plan.routes.ts`:

```typescript
import { Router } from "express";
import passport from "passport";
import { DevelopmentPlanController } from "./development-plan.controller";
import { DevelopmentPlanService } from "./development-plan.service";
import { DevelopmentPlanRepository } from "./development-plan.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new DevelopmentPlanRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new DevelopmentPlanService(repo, notifRepo);
const controller = new DevelopmentPlanController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.put("/:id", auth, controller.update);
router.patch("/:id/activate", auth, controller.activate);
router.patch("/:id/review", auth, controller.review);

export default router;
```

- [ ] **Step 4: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts`를 열고 기존 라우터 등록 패턴에 맞게 추가:

```typescript
import developmentPlanRouter from "./development-plan/development-plan.routes";
// ...기존 import들 뒤에 추가

// 기존 router.use 목록에 추가:
router.use("/development-plans", developmentPlanRouter);
```

- [ ] **Step 5: TypeScript 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/development-plan/ apps/api/src/apiRouter.ts
git commit -m "feat(development-plan): add service, controller, routes — DRAFT→ACTIVE→REVIEWED"
```

---

### Task 4: FE 타입 + 서비스

**Files:**
- Create: `football/src/types/development-plan.ts`
- Create: `football/src/services/development-plan.service.ts`

- [ ] **Step 1: 타입 파일 작성**

`football/src/types/development-plan.ts`:

```typescript
export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'REVIEWED'

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: '초안',
  ACTIVE: '활성',
  REVIEWED: '검토 완료',
}

export const PLAN_STATUS_STYLE: Record<PlanStatus, string> = {
  DRAFT: 'border-gray-300 text-gray-600 bg-gray-50',
  ACTIVE: 'border-blue-300 text-blue-700 bg-blue-50',
  REVIEWED: 'border-green-300 text-green-700 bg-green-50',
}

export interface DevelopmentPlan {
  id: number
  playerId: string
  coachId: number
  seasonId: number
  goals: string
  notes: string | null
  status: PlanStatus
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  player: { playerName: string; position: string }
  coach: { id: number; username: string; nickname: string | null }
  season: { id: number; name: string }
}

export interface CreatePlanPayload {
  playerId: string
  seasonId: number
  goals: string
  notes?: string
}

export interface UpdatePlanPayload {
  goals?: string
  notes?: string
}
```

- [ ] **Step 2: 서비스 파일 작성**

`football/src/services/development-plan.service.ts`:

```typescript
import { api } from './api'
import type { DevelopmentPlan, CreatePlanPayload, UpdatePlanPayload } from '@/types/development-plan'

export const developmentPlanApi = {
  list: (params: { playerId?: string; seasonId?: number }) => {
    const q = new URLSearchParams()
    if (params.playerId) q.set('playerId', params.playerId)
    if (params.seasonId) q.set('seasonId', String(params.seasonId))
    return api.get<DevelopmentPlan[]>(`/development-plans?${q.toString()}`)
  },

  get: (id: number) =>
    api.get<DevelopmentPlan>(`/development-plans/${id}`),

  create: (payload: CreatePlanPayload) =>
    api.post<DevelopmentPlan>('/development-plans', payload),

  update: (id: number, payload: UpdatePlanPayload) =>
    api.put<DevelopmentPlan>(`/development-plans/${id}`, payload),

  activate: (id: number) =>
    api.patch<DevelopmentPlan>(`/development-plans/${id}/activate`, {}),

  review: (id: number) =>
    api.patch<DevelopmentPlan>(`/development-plans/${id}/review`, {}),
}
```

- [ ] **Step 3: TypeScript 빌드 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -10
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add football/src/types/development-plan.ts football/src/services/development-plan.service.ts
git commit -m "feat(development-plan): add FE types and API service"
```

---

### Task 5: FE PlayerDevelopmentPlanTab 컴포넌트

**Files:**
- Create: `football/src/pages/players/PlayerDevelopmentPlanTab.tsx`
- Modify: `football/src/pages/players/PlayerDetailPage.tsx`

- [ ] **Step 1: Tab 컴포넌트 작성**

`football/src/pages/players/PlayerDevelopmentPlanTab.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { developmentPlanApi } from '@/services/development-plan.service'
import { seasonApi } from '@/services/season.service'
import type { DevelopmentPlan, CreatePlanPayload } from '@/types/development-plan'
import { PLAN_STATUS_LABEL, PLAN_STATUS_STYLE } from '@/types/development-plan'
import type { Season } from '@/types/season'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

interface Props {
  playerId: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface CreateDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  playerId: string
  seasons: Season[]
  onSaved: () => void
}

function CreatePlanDialog({ open, onOpenChange, playerId, seasons, onSaved }: CreateDialogProps) {
  const [goals, setGoals] = useState('')
  const [notes, setNotes] = useState('')
  const [seasonId, setSeasonId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!goals.trim() || !seasonId) {
      toast.error('목표와 시즌을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await developmentPlanApi.create({ playerId, seasonId: Number(seasonId), goals: goals.trim(), notes: notes.trim() || undefined })
      toast.success('발전 계획이 등록됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>발전 계획 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>시즌 *</Label>
            <Select
              value={seasonId}
              onValueChange={setSeasonId}
              items={Object.fromEntries(seasons.map(s => [String(s.id), s.name]))}
            >
              <SelectTrigger><SelectValue placeholder="시즌 선택" /></SelectTrigger>
              <SelectContent>
                {seasons.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>목표 *</Label>
            <Textarea placeholder="이번 시즌 발전 목표" value={goals} onChange={e => setGoals(e.target.value)} rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea placeholder="추가 메모 (선택)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlayerDevelopmentPlanTab({ playerId }: Props) {
  const { user } = useCurrentUser()
  const [plans, setPlans] = useState<DevelopmentPlan[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const isCoachingStaff = user?.role === 'COACHING_STAFF'
  const isHeadCoach = isCoachingStaff && user?.coachingRole === 'HEAD_COACH'
  const canCreate = isCoachingStaff || user?.role === 'ADMIN'

  const fetch = () => {
    setLoading(true)
    developmentPlanApi.list({ playerId })
      .then(setPlans)
      .catch(() => toast.error('발전 계획을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch()
    seasonApi.list().then(setSeasons).catch(() => null)
  }, [playerId])

  const handleActivate = async (id: number) => {
    try {
      await developmentPlanApi.activate(id)
      toast.success('발전 계획이 활성화됐습니다.')
      fetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '활성화에 실패했습니다.')
    }
  }

  const handleReview = async (id: number) => {
    try {
      await developmentPlanApi.review(id)
      toast.success('검토 완료 처리됐습니다.')
      fetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  if (loading) return <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">총 {plans.length}개 플랜</h3>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />발전 계획 등록
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">등록된 발전 계획이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{plan.season.name}</span>
                  <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${PLAN_STATUS_STYLE[plan.status]}`}>
                    {PLAN_STATUS_LABEL[plan.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {plan.status === 'DRAFT' && (isHeadCoach || plan.coachId === user?.id) && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleActivate(plan.id)}>활성화</Button>
                  )}
                  {plan.status === 'ACTIVE' && isHeadCoach && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReview(plan.id)}>검토 완료</Button>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{plan.goals}</p>
              {plan.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{plan.notes}</p>}
              <p className="text-xs text-muted-foreground">
                작성: {plan.coach.nickname ?? plan.coach.username} · {formatDate(plan.createdAt)}
                {plan.reviewedAt && ` · 검토: ${formatDate(plan.reviewedAt)}`}
              </p>
            </div>
          ))}
        </div>
      )}

      <CreatePlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        playerId={playerId}
        seasons={seasons}
        onSaved={() => { setCreateOpen(false); fetch() }}
      />
    </div>
  )
}
```

- [ ] **Step 2: PlayerDetailPage에 탭 추가**

`football/src/pages/players/PlayerDetailPage.tsx`를 열어 현재 구조를 확인한 뒤, 파일 최하단에 탭 컴포넌트를 통합한다.

현재 페이지에 `Tabs` UI가 없다면 shadcn/ui Tabs를 도입. 기존 상세 정보를 "기본 정보" 탭으로 감싸고 "발전 계획" 탭을 추가:

```typescript
// 추가 import
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlayerDevelopmentPlanTab } from './PlayerDevelopmentPlanTab'

// return 내부에서 기존 콘텐츠를 Tabs로 감싸기:
// <Tabs defaultValue="info">
//   <TabsList>
//     <TabsTrigger value="info">기본 정보</TabsTrigger>
//     <TabsTrigger value="pdp">발전 계획</TabsTrigger>
//   </TabsList>
//   <TabsContent value="info">
//     {/* 기존 콘텐츠 */}
//   </TabsContent>
//   <TabsContent value="pdp">
//     <PlayerDevelopmentPlanTab playerId={player.id} />
//   </TabsContent>
// </Tabs>
```

- [ ] **Step 3: TypeScript 빌드 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -10
```

Expected: 에러 없음

- [ ] **Step 4: 수동 동작 확인**

1. dev 서버 실행 (`npm run dev`)
2. COACHING_STAFF로 로그인
3. 선수 상세 → "발전 계획" 탭 클릭
4. "발전 계획 등록" 버튼 → 시즌 선택 + 목표 입력 → 등록
5. 카드 표시 확인, "활성화" 버튼 클릭 → status ACTIVE 변경 확인
6. HEAD_COACH 로그인 → "검토 완료" 버튼 클릭 → REVIEWED 확인

- [ ] **Step 5: 커밋**

```bash
git add football/src/pages/players/PlayerDevelopmentPlanTab.tsx \
        football/src/pages/players/PlayerDetailPage.tsx
git commit -m "feat(development-plan): add PlayerDevelopmentPlanTab and integrate into PlayerDetailPage"
```
