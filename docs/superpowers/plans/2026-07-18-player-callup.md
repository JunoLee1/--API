# PlayerCallup (유소년 콜업) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유소년 선수를 1군으로 임시 합류시키는 콜업 워크플로우를 구현한다 — HEAD_COACH 요청 → GM 승인 → Player.teamId 자동 업데이트.

**Architecture:** Prisma 스키마에 `PlayerCallup` 모델과 `PlayerCallupStatus` enum을 추가하고, BE는 기존 repo/service/controller/routes 패턴을 따라 `apps/api/src/player-callup/` 모듈로 구현한다. FE는 이적 섹션 사이드바에 "유소년 콜업" 링크를 추가하고 `PlayerCallupPage.tsx`로 목록·요청·승인/거절을 처리한다.

**Tech Stack:** Express, Prisma, TypeScript, React, shadcn/ui, Jest (real DB integration tests)

---

## File Structure

**BE (신규)**
- `apps/api/prisma/schema.prisma` — `PlayerCallupStatus` enum, `PlayerCallup` 모델, `NotificationType` 3개 추가
- `apps/api/src/player-callup/dto/player-callup.dto.ts` — DTO 타입
- `apps/api/src/player-callup/player-callup.repo.ts` — DB 쿼리
- `apps/api/src/player-callup/player-callup.service.ts` — 비즈니스 로직
- `apps/api/src/player-callup/player-callup.controller.ts` — HTTP 핸들러
- `apps/api/src/player-callup/player-callup.routes.ts` — 라우트 등록
- `apps/api/src/apiRouter.ts` — `/player-callups` 등록

**테스트**
- `apps/api/__test__/player-callup/player-callup.service.test.ts`

**FE (신규)**
- `football/src/types/player-callup.ts`
- `football/src/services/player-callup.service.ts`
- `football/src/pages/transfers/PlayerCallupPage.tsx`
- `football/src/App.tsx` — 라우트 추가
- `football/src/layouts/AppShell.tsx` — 사이드바 링크 추가

---

### Task 1: 스키마 추가 + prisma db push

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `PlayerCallupStatus` enum + `PlayerCallup` 모델 + NotificationType 3개 추가**

`schema.prisma`에서 `NotificationType` enum 마지막 값(`TRAINING_SESSION_PENDING`) 다음에 추가:

```prisma
  CALLUP_REQUESTED
  CALLUP_APPROVED
  CALLUP_REJECTED
```

그리고 파일 맨 끝(또는 `Recall` 모델 아래)에 추가:

```prisma
enum PlayerCallupStatus {
  REQUESTED
  APPROVED
  REJECTED
  COMPLETED
}

model PlayerCallup {
  id            Int                 @id @default(autoincrement())
  playerId      String
  fromTeamId    Int
  toTeamId      Int
  requestedById Int
  approvedById  Int?
  reason        String
  status        PlayerCallupStatus  @default(REQUESTED)
  startDate     DateTime
  endDate       DateTime?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  player      Player @relation(fields: [playerId], references: [id])
  fromTeam    Team   @relation("CallupFromTeam", fields: [fromTeamId], references: [id])
  toTeam      Team   @relation("CallupToTeam", fields: [toTeamId], references: [id])
  requestedBy User   @relation("CallupRequestedBy", fields: [requestedById], references: [id])
  approvedBy  User?  @relation("CallupApprovedBy", fields: [approvedById], references: [id])
}
```

`Team` 모델에 relation 추가:
```prisma
  callupsFrom  PlayerCallup[] @relation("CallupFromTeam")
  callupsTo    PlayerCallup[] @relation("CallupToTeam")
```

`User` 모델에 relation 추가:
```prisma
  requestedCallups PlayerCallup[] @relation("CallupRequestedBy")
  approvedCallups  PlayerCallup[] @relation("CallupApprovedBy")
```

`Player` 모델에 relation 추가:
```prisma
  callups PlayerCallup[]
```

- [ ] **Step 2: DB 반영**

```bash
cd apps/api && npx prisma db push && npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add PlayerCallup model and CALLUP notification types"
```

---

### Task 2: BE DTO + Repository

**Files:**
- Create: `apps/api/src/player-callup/dto/player-callup.dto.ts`
- Create: `apps/api/src/player-callup/player-callup.repo.ts`

- [ ] **Step 1: 테스트 작성**

`apps/api/__test__/player-callup/player-callup.service.test.ts` 생성:

```typescript
import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PlayerCallupRepository } from '../../src/player-callup/player-callup.repo';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

let headCoachUserId: number;
let gmUserId: number;
let youthTeamId: number;
let firstTeamId: number;
let testPlayerId: string;
let callupId: number;

beforeAll(async () => {
  const headCoach = await prisma.user.findFirst({
    where: { role: 'COACHING_STAFF', coachingRole: 'HEAD_COACH' },
    select: { id: true },
  });
  if (!headCoach) throw new Error('HEAD_COACH user 없음');
  headCoachUserId = headCoach.id;

  const gm = await prisma.user.findFirst({
    where: { role: 'FRONT_OFFICE', frontOfficeRole: 'GM' },
    select: { id: true },
  });
  if (!gm) throw new Error('GM user 없음');
  gmUserId = gm.id;

  const [youth, first] = await Promise.all([
    prisma.team.findFirst({ where: { type: 'YOUTH' }, select: { id: true } }),
    prisma.team.findFirst({ where: { type: 'FIRST_TEAM' }, select: { id: true } }),
  ]);
  if (!youth || !first) throw new Error('팀 없음 — seed 필요');
  youthTeamId = youth.id;
  firstTeamId = first.id;

  const player = await prisma.player.findFirst({
    where: { teamId: youth.id },
    select: { id: true },
  });
  if (!player) throw new Error('유소년 팀 소속 선수 없음');
  testPlayerId = player.id;
});

afterAll(async () => {
  if (callupId) {
    await prisma.playerCallup.deleteMany({ where: { id: callupId } });
  }
  await prisma.$disconnect();
});

describe('PlayerCallupRepository', () => {
  const repo = () => new PlayerCallupRepository(prisma);

  it('콜업 생성', async () => {
    const r = await repo().create({
      playerId: testPlayerId,
      fromTeamId: youthTeamId,
      toTeamId: firstTeamId,
      requestedById: headCoachUserId,
      reason: '테스트 콜업',
      startDate: '2026-08-01',
    });
    expect(r.status).toBe('REQUESTED');
    callupId = r.id;
  });

  it('목록 조회', async () => {
    const list = await repo().findAll({ status: 'REQUESTED' });
    expect(list.some((c) => c.id === callupId)).toBe(true);
  });

  it('승인 처리', async () => {
    const r = await repo().approve(callupId, gmUserId);
    expect(r.status).toBe('APPROVED');
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
cd apps/api && npx jest __test__/player-callup/player-callup.service.test.ts --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `PlayerCallupRepository is not a constructor`

- [ ] **Step 3: DTO 생성**

`apps/api/src/player-callup/dto/player-callup.dto.ts`:

```typescript
export interface CreateCallupDto {
  playerId: string;
  fromTeamId: number;
  toTeamId: number;
  reason: string;
  startDate: string;
  endDate?: string;
}

export interface RejectCallupDto {
  reason: string;
}

export interface CallupListQuery {
  status?: string;
}
```

- [ ] **Step 4: Repository 생성**

`apps/api/src/player-callup/player-callup.repo.ts`:

```typescript
import { PrismaClient } from "../generated/client";
import { CreateCallupDto, CallupListQuery } from "./dto/player-callup.dto";

const SELECT = {
  id: true,
  status: true,
  reason: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  player: { select: { id: true, playerName: true, position: true } },
  fromTeam: { select: { id: true, name: true } },
  toTeam: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, nickname: true } },
  approvedBy: { select: { id: true, nickname: true } },
} as const;

export class PlayerCallupRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: CallupListQuery) {
    return this.prisma.playerCallup.findMany({
      where: query.status ? { status: query.status as any } : undefined,
      select: SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.playerCallup.findUnique({ where: { id }, select: SELECT });
  }

  create(dto: CreateCallupDto & { requestedById: number }) {
    return this.prisma.playerCallup.create({
      data: {
        playerId: dto.playerId,
        fromTeamId: dto.fromTeamId,
        toTeamId: dto.toTeamId,
        requestedById: dto.requestedById,
        reason: dto.reason,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      select: SELECT,
    });
  }

  approve(id: number, approvedById: number) {
    return this.prisma.playerCallup.update({
      where: { id },
      data: { status: "APPROVED", approvedById },
      select: SELECT,
    });
  }

  reject(id: number, approvedById: number, reason: string) {
    return this.prisma.playerCallup.update({
      where: { id },
      data: { status: "REJECTED", approvedById, reason },
      select: SELECT,
    });
  }

  complete(id: number) {
    return this.prisma.playerCallup.update({
      where: { id },
      data: { status: "COMPLETED" },
      select: SELECT,
    });
  }

  updatePlayerTeam(playerId: string, teamId: number) {
    return this.prisma.player.update({
      where: { id: playerId },
      data: { teamId },
    });
  }
}
```

- [ ] **Step 5: 테스트 실행 (통과 확인)**

```bash
cd apps/api && npx jest __test__/player-callup/player-callup.service.test.ts --no-coverage 2>&1 | tail -5
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/player-callup/dto/player-callup.dto.ts \
        apps/api/src/player-callup/player-callup.repo.ts \
        apps/api/__test__/player-callup/player-callup.service.test.ts
git commit -m "feat(player-callup): add repository and DTO with integration tests"
```

---

### Task 3: BE Service + Controller + Routes

**Files:**
- Create: `apps/api/src/player-callup/player-callup.service.ts`
- Create: `apps/api/src/player-callup/player-callup.controller.ts`
- Create: `apps/api/src/player-callup/player-callup.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: Service 생성**

`apps/api/src/player-callup/player-callup.service.ts`:

```typescript
import { PlayerCallupRepository } from "./player-callup.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { writeAuditLog } from "../lib/auditLog";
import { AppError } from "../lib/appError";
import { CreateCallupDto, RejectCallupDto, CallupListQuery } from "./dto/player-callup.dto";

export class PlayerCallupService {
  constructor(
    private repo: PlayerCallupRepository,
    private notifRepo: NotificationRepository,
  ) {}

  getAll(query: CallupListQuery) {
    return this.repo.findAll(query);
  }

  async getById(id: number) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    return callup;
  }

  async create(dto: CreateCallupDto, requestedById: number) {
    const callup = await this.repo.create({ ...dto, requestedById });
    void this.notifRepo
      .createForGM(
        "CALLUP_REQUESTED",
        "유소년 콜업 요청",
        `${callup.player.playerName} 선수의 1군 콜업 요청이 등록됐습니다.`,
        callup.id,
      )
      .catch(console.error);
    return callup;
  }

  async approve(id: number, approvedById: number) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    if (callup.status !== "REQUESTED") throw new AppError(409, "INVALID_STATUS");

    const updated = await this.repo.approve(id, approvedById);
    await this.repo.updatePlayerTeam(callup.player.id, callup.toTeam.id);
    await writeAuditLog({ actorId: approvedById, action: "CALLUP_APPROVED", targetId: id });

    void this.notifRepo
      .createForHeadCoach(
        "CALLUP_APPROVED",
        "콜업 승인",
        `${callup.player.playerName} 선수의 1군 콜업이 승인됐습니다.`,
        id,
      )
      .catch(console.error);

    return updated;
  }

  async reject(id: number, approvedById: number, dto: RejectCallupDto) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    if (callup.status !== "REQUESTED") throw new AppError(409, "INVALID_STATUS");
    if (!dto.reason?.trim()) throw new AppError(400, "REASON_REQUIRED");

    const updated = await this.repo.reject(id, approvedById, dto.reason);
    await writeAuditLog({ actorId: approvedById, action: "CALLUP_REJECTED", targetId: id });

    void this.notifRepo
      .createForHeadCoach(
        "CALLUP_REJECTED",
        "콜업 거절",
        `${callup.player.playerName} 선수의 1군 콜업이 거절됐습니다. 사유: ${dto.reason}`,
        id,
      )
      .catch(console.error);

    return updated;
  }

  async complete(id: number, actorId: number) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    if (callup.status !== "APPROVED") throw new AppError(409, "INVALID_STATUS");
    await writeAuditLog({ actorId, action: "CALLUP_COMPLETED", targetId: id });
    return this.repo.complete(id);
  }
}
```

- [ ] **Step 2: Controller 생성**

`apps/api/src/player-callup/player-callup.controller.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { PlayerCallupService } from "./player-callup.service";

export class PlayerCallupController {
  constructor(private service: PlayerCallupService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getAll({ status: req.query["status"] as string | undefined }));
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
      if (role !== "COACHING_STAFF" || coachingRole !== "HEAD_COACH") {
        throw new AppError(403, "FORBIDDEN");
      }
      res.status(201).json(await this.service.create(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (role !== "FRONT_OFFICE" || frontOfficeRole !== "GM") {
        throw new AppError(403, "FORBIDDEN");
      }
      res.json(await this.service.approve(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (role !== "FRONT_OFFICE" || frontOfficeRole !== "GM") {
        throw new AppError(403, "FORBIDDEN");
      }
      res.json(await this.service.reject(Number(req.params["id"]), req.user!.id, req.body));
    } catch (err) { next(err); }
  };

  complete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole, frontOfficeRole } = req.user!;
      const isHeadCoach = role === "COACHING_STAFF" && coachingRole === "HEAD_COACH";
      const isGM = role === "FRONT_OFFICE" && frontOfficeRole === "GM";
      if (!isHeadCoach && !isGM) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.complete(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 3: Routes 생성**

`apps/api/src/player-callup/player-callup.routes.ts`:

```typescript
import { Router } from "express";
import passport from "passport";
import { PlayerCallupController } from "./player-callup.controller";
import { PlayerCallupService } from "./player-callup.service";
import { PlayerCallupRepository } from "./player-callup.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new PlayerCallupRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new PlayerCallupService(repo, notifRepo);
const controller = new PlayerCallupController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id/approve", auth, controller.approve);
router.patch("/:id/reject", auth, controller.reject);
router.patch("/:id/complete", auth, controller.complete);

export default router;
```

- [ ] **Step 4: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts` 상단 import 추가:

```typescript
import playerCallupRouter from "./player-callup/player-callup.routes";
```

`apiRouter.use` 목록에 추가 (transfers 아래):

```typescript
apiRouter.use("/player-callups", playerCallupRouter);
```

- [ ] **Step 5: TypeScript 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/player-callup/ apps/api/src/apiRouter.ts
git commit -m "feat(player-callup): add service, controller, and routes"
```

---

### Task 4: FE 타입 + 서비스 + 페이지

**Files:**
- Create: `football/src/types/player-callup.ts`
- Create: `football/src/services/player-callup.service.ts`
- Create: `football/src/pages/transfers/PlayerCallupPage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [ ] **Step 1: 타입 생성**

`football/src/types/player-callup.ts`:

```typescript
export type PlayerCallupStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED'

export const CALLUP_STATUS_LABEL: Record<PlayerCallupStatus, string> = {
  REQUESTED: '요청',
  APPROVED: '승인',
  REJECTED: '거절',
  COMPLETED: '완료',
}

export const CALLUP_STATUS_STYLE: Record<PlayerCallupStatus, string> = {
  REQUESTED: 'border-yellow-300 text-yellow-700 bg-yellow-50',
  APPROVED: 'border-green-300 text-green-700 bg-green-50',
  REJECTED: 'border-red-300 text-red-700 bg-red-50',
  COMPLETED: 'border-gray-300 text-gray-600 bg-gray-50',
}

export interface PlayerCallup {
  id: number
  status: PlayerCallupStatus
  reason: string
  startDate: string
  endDate: string | null
  createdAt: string
  player: { id: string; playerName: string; position: string }
  fromTeam: { id: number; name: string }
  toTeam: { id: number; name: string }
  requestedBy: { id: number; nickname: string }
  approvedBy: { id: number; nickname: string } | null
}

export interface CreateCallupDto {
  playerId: string
  fromTeamId: number
  toTeamId: number
  reason: string
  startDate: string
  endDate?: string
}
```

- [ ] **Step 2: 서비스 생성**

`football/src/services/player-callup.service.ts`:

```typescript
import { api } from './api'
import type { PlayerCallup, CreateCallupDto } from '@/types/player-callup'

export const callupApi = {
  list: (status?: string) =>
    api.get<PlayerCallup[]>(`/player-callups${status ? `?status=${status}` : ''}`),

  getById: (id: number) =>
    api.get<PlayerCallup>(`/player-callups/${id}`),

  create: (payload: CreateCallupDto) =>
    api.post<PlayerCallup>('/player-callups', payload),

  approve: (id: number) =>
    api.patch<PlayerCallup>(`/player-callups/${id}/approve`, {}),

  reject: (id: number, reason: string) =>
    api.patch<PlayerCallup>(`/player-callups/${id}/reject`, { reason }),

  complete: (id: number) =>
    api.patch<PlayerCallup>(`/player-callups/${id}/complete`, {}),
}
```

- [ ] **Step 3: 페이지 생성**

`football/src/pages/transfers/PlayerCallupPage.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { callupApi } from '@/services/player-callup.service'
import type { PlayerCallup, PlayerCallupStatus, CreateCallupDto } from '@/types/player-callup'
import { CALLUP_STATUS_LABEL, CALLUP_STATUS_STYLE } from '@/types/player-callup'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usePlayers } from '@/hooks/usePlayers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

const STATUS_OPTIONS: Record<string, string> = {
  ALL: '전체',
  REQUESTED: '요청',
  APPROVED: '승인',
  REJECTED: '거절',
  COMPLETED: '완료',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

interface CreateDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateDialog({ open, onOpenChange, onSaved }: CreateDialogProps) {
  const { players } = usePlayers()
  const [form, setForm] = useState<Partial<CreateCallupDto>>({})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.playerId || !form.fromTeamId || !form.toTeamId || !form.reason?.trim() || !form.startDate) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await callupApi.create(form as CreateCallupDto)
      toast.success('콜업 요청이 등록됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>유소년 콜업 요청</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>선수 *</Label>
            <Select
              value={form.playerId ?? ''}
              onValueChange={(v) => setForm((f) => ({ ...f, playerId: v }))}
              items={Object.fromEntries(players.map((p) => [p.id, p.playerName]))}
            >
              <SelectTrigger><SelectValue placeholder="선수 선택" /></SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>출신 팀 ID *</Label>
            <Input
              type="number"
              placeholder="유소년 팀 ID"
              value={form.fromTeamId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, fromTeamId: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>합류 팀 ID *</Label>
            <Input
              type="number"
              placeholder="1군 팀 ID"
              value={form.toTeamId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, toTeamId: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>사유 *</Label>
            <Textarea
              placeholder="콜업 사유"
              value={form.reason ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>시작일 *</Label>
            <Input
              type="date"
              value={form.startDate ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>종료일 (미입력 시 영구)</Label>
            <Input
              type="date"
              value={form.endDate ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value || undefined }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '요청'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlayerCallupPage() {
  const { user } = useCurrentUser()
  const [callups, setCallups] = useState<PlayerCallup[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const isHeadCoach = user?.coachingRole === 'HEAD_COACH'
  const isGM = user?.frontOfficeRole === 'GM'

  const fetchCallups = () => {
    setLoading(true)
    callupApi.list(statusFilter === 'ALL' ? undefined : statusFilter)
      .then(setCallups)
      .catch(() => toast.error('콜업 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCallups() }, [statusFilter])

  const handleApprove = async (id: number) => {
    try {
      await callupApi.approve(id)
      toast.success('승인됐습니다.')
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '승인에 실패했습니다.')
    }
  }

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return
    try {
      await callupApi.reject(rejectId, rejectReason)
      toast.success('거절됐습니다.')
      setRejectId(null)
      setRejectReason('')
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '거절에 실패했습니다.')
    }
  }

  const handleComplete = async (id: number) => {
    try {
      await callupApi.complete(id)
      toast.success('완료 처리됐습니다.')
      fetchCallups()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">유소년 콜업</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 {callups.length}건</p>
        </div>
        {isHeadCoach && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />콜업 요청
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
          items={STATUS_OPTIONS}
        >
          <SelectTrigger className="w-32 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_OPTIONS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : callups.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            콜업 기록이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>선수</TableHead>
                <TableHead>출신팀 → 합류팀</TableHead>
                <TableHead className="w-28">기간</TableHead>
                <TableHead className="w-20 text-center">상태</TableHead>
                {(isGM || isHeadCoach) && <TableHead className="w-40" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {callups.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.player.playerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.fromTeam.name} → {c.toTeam.name}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {formatDate(c.startDate)}
                    {c.endDate ? ` ~ ${formatDate(c.endDate)}` : ' ~'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${CALLUP_STATUS_STYLE[c.status]}`}>
                      {CALLUP_STATUS_LABEL[c.status]}
                    </span>
                  </TableCell>
                  {(isGM || isHeadCoach) && (
                    <TableCell className="flex gap-1.5">
                      {isGM && c.status === 'REQUESTED' && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => handleApprove(c.id)}>
                            승인
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600"
                            onClick={() => setRejectId(c.id)}>
                            거절
                          </Button>
                        </>
                      )}
                      {(isGM || isHeadCoach) && c.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleComplete(c.id)}>
                          완료
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchCallups() }}
      />

      <Dialog open={rejectId !== null} onOpenChange={(v) => !v && setRejectId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>거절 사유</DialogTitle></DialogHeader>
          <Textarea
            placeholder="거절 사유를 입력해주세요."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>취소</Button>
            <Button onClick={handleReject} disabled={!rejectReason.trim()}>거절</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 4: App.tsx 라우트 추가**

`football/src/App.tsx`에 import 추가:
```typescript
import { PlayerCallupPage } from '@/pages/transfers/PlayerCallupPage'
```

`/transfers` 라우트 아래에 추가:
```typescript
<Route path="/player-callups" element={<PlayerCallupPage />} />
```

- [ ] **Step 5: AppShell.tsx 사이드바 링크 추가**

`football/src/layouts/AppShell.tsx`에서 이적 현황 항목 아래에 추가:
```typescript
{
  to: '/player-callups',
  label: '유소년 콜업',
  icon: ArrowUpCircle,
  section: '계약·영입',
  roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'],
  coachingRoles: ['HEAD_COACH'],
},
```

`lucide-react`에서 `ArrowUpCircle` import 추가 확인.

- [ ] **Step 6: TypeScript 빌드 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음

- [ ] **Step 7: Commit**

```bash
git add football/src/types/player-callup.ts \
        football/src/services/player-callup.service.ts \
        football/src/pages/transfers/PlayerCallupPage.tsx \
        football/src/App.tsx \
        football/src/layouts/AppShell.tsx
git commit -m "feat(player-callup): add FE page with list, create, approve, reject, complete"
```
