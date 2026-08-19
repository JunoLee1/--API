# Persona Remaining Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement 4 remaining persona items: visa/work-permit expiry dedup cron, application reinstate, youth-to-senior promotion history, and ledger period lock.

**Architecture:** Each item is a self-contained vertical slice (schema → service → routes → FE). All BE changes share a single Prisma migration per item. Tests follow the existing jest unit-test pattern (mock repo, test service logic).

**Tech Stack:** Express + Prisma + PostgreSQL (BE); React + shadcn/ui + react-i18next (FE); jest for tests.

---

## File Map

| Item | New / Modified Files |
|------|---------------------|
| 1. Visa cron | `prisma/schema.prisma` (new `WorkPermitAlertLog`), `prisma/migrations/…`, `src/jobs/workPermitExpiryCheck.ts` |
| 2. Reinstate | `prisma/schema.prisma` (`JobApplication.previousStatus`), `prisma/migrations/…`, `src/recruitment/recruitment.repo.ts`, `src/recruitment/recruitment.service.ts`, `src/recruitment/recruitment.controller.ts`, `src/recruitment/recruitment.routes.ts`, `apps/api/__test__/recruitment/recruitment.service.test.ts`, `football/src/pages/admin/recruitment/ApplicationDetailPage.tsx`, `football/src/services/recruitment.service.ts` (FE) |
| 3. Youth promote | `prisma/schema.prisma` (`Player.promotedFromYouthAt`, `Player.youthOriginTeamId`), `prisma/migrations/…`, `src/player/player.service.ts`, `src/player/player.controller.ts`, `src/player/player.routes.ts`, `football/src/pages/players/PlayerDetailPage.tsx`, `football/src/services/player.service.ts`, `football/src/types/player.ts` |
| 4. Period lock | `prisma/schema.prisma` (new `LedgerPeriodLock`), `prisma/migrations/…`, `src/ledger/ledger.repo.ts`, `src/ledger/ledger.service.ts`, `src/ledger/ledger.controller.ts`, `src/ledger/ledger.routes.ts`, `src/ledger/ledger.service.test.ts`, `football/src/pages/finance/LedgerPage.tsx` (or wherever the ledger UI is), `football/src/services/ledger.service.ts` (FE) |

---

## Task 1: Visa / Work Permit Expiry — 60D milestone + dedup

**Problem:** The existing cron (`workPermitExpiryCheck.ts`) fires daily for every player within 30 days. It has no dedup—it sends a new notification every day. We need to add a 60-day window and send each milestone (30D, 60D) only **once** per player.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260814000001_add_work_permit_alert_log/migration.sql`
- Modify: `apps/api/src/jobs/workPermitExpiryCheck.ts`

### Step 1.1: Add `WorkPermitAlertLog` to schema

In `apps/api/prisma/schema.prisma`, after the `LedgerEntry` model, add:

```prisma
model WorkPermitAlertLog {
  id        Int      @id @default(autoincrement())
  playerId  String
  window    String   // "30D" | "60D"
  sentAt    DateTime @default(now())

  player Player @relation(fields: [playerId], references: [id])

  @@unique([playerId, window])
}
```

Also add to the `Player` model relation list (after `callups`):

```prisma
  workPermitAlerts   WorkPermitAlertLog[]
```

And add `WORK_PERMIT_EXPIRY_SOON_60D` to `NotificationType` enum (add after `WORK_PERMIT_EXPIRY_SOON`):

```prisma
  WORK_PERMIT_EXPIRY_SOON_60D
```

- [x] **Step 1.1: Edit schema.prisma** — add `WorkPermitAlertLog` model, the relation on `Player`, and `WORK_PERMIT_EXPIRY_SOON_60D` enum value as described above.

- [x] **Step 1.2: Run migration**

```bash
cd apps/api
npx prisma migrate dev --name add_work_permit_alert_log
```

Expected: `Migration 20260814000001_add_work_permit_alert_log applied`.

- [x] **Step 1.3: Rewrite `workPermitExpiryCheck.ts`**

Full replacement of `apps/api/src/jobs/workPermitExpiryCheck.ts`:

```typescript
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";

const WINDOWS = [
  { label: "60D" as const, days: 60 },
  { label: "30D" as const, days: 30 },
];

export function startWorkPermitExpiryCheckJob() {
  cron.schedule("0 0 * * *", async () => {
    const prisma = getPrisma();
    const notifRepo = new NotificationRepository(prisma);
    const now = new Date();

    for (const win of WINDOWS) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + win.days);
      const lower = new Date(now);
      // query players whose expiry falls within this window's day
      const expiring = await prisma.player.findMany({
        where: {
          workPermitStatus: "APPROVED",
          workPermitExpiry: { gte: lower, lte: cutoff },
          workPermitAlerts: { none: { window: win.label } },
        },
        select: { id: true, playerName: true, workPermitExpiry: true },
      });

      for (const player of expiring) {
        const expiry = player.workPermitExpiry!;
        const daysLeft = Math.ceil(
          (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        const notifType =
          win.label === "60D"
            ? "WORK_PERMIT_EXPIRY_SOON_60D"
            : "WORK_PERMIT_EXPIRY_SOON";

        await prisma.workPermitAlertLog
          .create({ data: { playerId: player.id, window: win.label } })
          .catch(() => null); // ignore if already exists (race condition)

        void notifRepo
          .createForStaff(
            notifType,
            () => ({
              title: "노동허가 만료 임박",
              body: `${player.playerName} 선수의 노동허가가 ${daysLeft}일 후(${expiry.toLocaleDateString("ko-KR")}) 만료됩니다.`,
            }),
            undefined,
          )
          .catch(console.error);
      }
    }
  });
}
```

- [x] **Step 1.4: Run BE tests**

```bash
cd apps/api
npx jest --testPathPattern="workPermit|ledger|recruitment" --passWithNoTests
```

Expected: all pass (no test file for this cron yet — `--passWithNoTests` covers that).

- [x] **Step 1.5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/jobs/workPermitExpiryCheck.ts
git commit -m "feat(cron): add 60D work-permit window with dedup via WorkPermitAlertLog"
```

---

## Task 2: Job Application Reinstate

**Problem:** Once a recruiter rejects an application, there is no way to undo it. We need a `POST /applications/:id/reinstate` endpoint that restores the application to its previous status. Only HR_MANAGER and ADMIN may call it.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/recruitment/recruitment.repo.ts`
- Modify: `apps/api/src/recruitment/recruitment.service.ts`
- Modify: `apps/api/src/recruitment/recruitment.controller.ts`
- Modify: `apps/api/src/recruitment/recruitment.routes.ts`
- Modify: `apps/api/__test__/recruitment/recruitment.service.test.ts`
- Modify: `football/src/pages/admin/recruitment/ApplicationDetailPage.tsx`
- Modify: `football/src/services/recruitment.service.ts` (FE — add reinstate call)

### Step 2.1: Write the failing test

In `apps/api/__test__/recruitment/recruitment.service.test.ts`, add at the end:

```typescript
describe("reinstateApplication", () => {
  test("REJECTED 지원자를 이전 상태로 복원한다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({
      id: 5, status: "REJECTED", email: null, phone: null,
      previousStatus: "INTERVIEW_2",
    });
    mockRepo.reinstateApplication = jest.fn().mockResolvedValue({
      id: 5, status: "INTERVIEW_2", previousStatus: null,
    });

    const svc = new RecruitmentService(mockRepo);
    const result = await svc.reinstateApplication(5, 99);
    expect(mockRepo.reinstateApplication).toHaveBeenCalledWith(5, 99);
    expect(result.status).toBe("INTERVIEW_2");
  });

  test("REJECTED가 아닌 지원자는 409 APPLICATION_NOT_REJECTED를 던진다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({
      id: 6, status: "INTERVIEW_1", email: null, phone: null,
      previousStatus: null,
    });

    const svc = new RecruitmentService(mockRepo);
    await expect(svc.reinstateApplication(6, 99)).rejects.toMatchObject({
      statusCode: 409,
      code: "APPLICATION_NOT_REJECTED",
    });
  });

  test("previousStatus가 없으면 409 NO_PREVIOUS_STATUS를 던진다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({
      id: 7, status: "REJECTED", email: null, phone: null,
      previousStatus: null,
    });

    const svc = new RecruitmentService(mockRepo);
    await expect(svc.reinstateApplication(7, 99)).rejects.toMatchObject({
      statusCode: 409,
      code: "NO_PREVIOUS_STATUS",
    });
  });
});
```

- [x] **Step 2.1: Write the tests above.**

- [x] **Step 2.2: Run tests to verify they fail**

```bash
cd apps/api
npx jest --testPathPattern="recruitment.service" 2>&1 | tail -20
```

Expected: FAIL — `svc.reinstateApplication is not a function`.

- [x] **Step 2.3: Add `previousStatus` to schema**

In `apps/api/prisma/schema.prisma`, in `model JobApplication`, after `rejectionReason String?`, add:

```prisma
  previousStatus  JobApplicationStatus?
```

- [x] **Step 2.4: Run migration**

```bash
cd apps/api
npx prisma migrate dev --name add_job_application_previous_status
```

Expected: migration applied.

- [x] **Step 2.5: Add `reinstateApplication` to repo**

In `apps/api/src/recruitment/recruitment.repo.ts`, add after `rejectApplication`:

```typescript
async reinstateApplication(id: number, actorId: number) {
  const app = await this.prisma.jobApplication.findUnique({
    where: { id },
    select: { previousStatus: true },
  });
  const result = await this.prisma.jobApplication.update({
    where: { id },
    data: {
      status: app!.previousStatus as any,
      previousStatus: null,
      rejectedAt: null,
      rejectionReason: null,
    },
    include: APPLICATION_INCLUDE,
  });
  void writeAuditLog({
    actorId,
    action: "JOB_APPLICATION_STATUS_CHANGED",
    targetId: id,
    detail: { newStatus: app!.previousStatus, reinstated: true },
  }).catch(console.error);
  return result;
}
```

Also update `rejectApplication` in repo to save `previousStatus`:

```typescript
async rejectApplication(id: number, actorId: number) {
  // fetch current status before changing it
  const current = await this.prisma.jobApplication.findUnique({
    where: { id },
    select: { status: true },
  });
  const retentionDeadline = new Date();
  retentionDeadline.setFullYear(retentionDeadline.getFullYear() + 1);

  const result = await this.prisma.jobApplication.update({
    where: { id },
    data: {
      status: "REJECTED",
      previousStatus: current!.status,
      rejectedAt: new Date(),
      dataRetentionDeadline: retentionDeadline,
    } as any,
    include: APPLICATION_INCLUDE,
  });
  void writeAuditLog({
    actorId,
    action: "JOB_APPLICATION_STATUS_CHANGED",
    targetId: id,
    detail: { newStatus: "REJECTED", dataRetentionDeadline: retentionDeadline.toISOString() },
  }).catch(console.error);
  return result;
}
```

- [x] **Step 2.5: Apply both repo changes.**

- [x] **Step 2.6: Add `reinstateApplication` to service**

In `apps/api/src/recruitment/recruitment.service.ts`, add after `rejectApplication`:

```typescript
async reinstateApplication(id: number, actorId: number) {
  const app = await this.getApplication(id);
  if (app.status !== "REJECTED") throw new AppError(409, "APPLICATION_NOT_REJECTED");
  const raw = await this.repo.findApplicationById(id) as any;
  if (!raw?.previousStatus) throw new AppError(409, "NO_PREVIOUS_STATUS");
  return this.repo.reinstateApplication(id, actorId);
}
```

- [x] **Step 2.7: Run tests to verify they pass**

```bash
cd apps/api
npx jest --testPathPattern="recruitment.service" 2>&1 | tail -20
```

Expected: all tests in the describe blocks PASS.

- [x] **Step 2.8: Add controller method**

In `apps/api/src/recruitment/recruitment.controller.ts`, add after `rejectApplication`:

```typescript
reinstateApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole, id: actorId } = requireUser(req);
    if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
    res.json(await this.service.reinstateApplication(Number(req.params["id"]), actorId));
  } catch (err) {
    next(err);
  }
};
```

- [x] **Step 2.9: Add route**

In `apps/api/src/recruitment/recruitment.routes.ts`, after the reject route:

```typescript
router.post("/applications/:id/reinstate", auth, controller.reinstateApplication);
```

- [x] **Step 2.10: Add FE service call**

In `football/src/services/recruitment.service.ts` (FE), find the file and add inside the `recruitmentApi` object (or wherever `rejectApplication` is defined):

```typescript
reinstateApplication: (id: number) =>
  api.post(`/recruitment/applications/${id}/reinstate`),
```

- [x] **Step 2.11: Add reinstate button to ApplicationDetailPage**

In `football/src/pages/admin/recruitment/ApplicationDetailPage.tsx`, find the reject button section (`app.status !== 'REJECTED' && app.status !== 'HIRED'`) and add a reinstate button immediately after it:

```tsx
{app.status === 'REJECTED' && (
  <Button
    variant="outline"
    size="sm"
    disabled={reinstating}
    onClick={() => void handleReinstate()}
  >
    {reinstating ? '복원 중...' : '거절 취소'}
  </Button>
)}
```

Add state and handler near the top of the component (after other useState declarations):

```tsx
const [reinstating, setReinstating] = useState(false)

const handleReinstate = async () => {
  if (!app) return
  setReinstating(true)
  try {
    await recruitmentApi.reinstateApplication(app.id)
    toast.success('지원자 상태가 복원됐습니다.')
    void fetchApp()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '복원에 실패했습니다.')
  } finally {
    setReinstating(false)
  }
}
```

- [x] **Step 2.12: Run full BE test suite**

```bash
cd apps/api
npx jest 2>&1 | tail -10
```

Expected: all pass.

- [x] **Step 2.13: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations \
  apps/api/src/recruitment apps/api/__test__/recruitment \
  football/src/pages/admin/recruitment/ApplicationDetailPage.tsx \
  football/src/services/recruitment.service.ts
git commit -m "feat(recruitment): add application reinstate endpoint and UI"
```

---

## Task 3: Youth ↔ Senior Promotion History

**Problem:** When a youth player gets promoted to the first team permanently, there is no record of their youth origin or the promotion date. The `POST /players/:id/promote` endpoint should set these fields and update the player's team. The FE player profile should show the youth history tab when relevant.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/player/player.service.ts`
- Modify: `apps/api/src/player/player.controller.ts`
- Modify: `apps/api/src/player/player.routes.ts`
- Modify: `football/src/pages/players/PlayerDetailPage.tsx`
- Modify: `football/src/services/player.service.ts` (FE)
- Modify: `football/src/types/player.ts`

### Step 3.1: Add promote fields to schema

In `apps/api/prisma/schema.prisma`, in `model Player`, after `teamId  Int?`, add:

```prisma
  promotedFromYouthAt  DateTime?
  youthOriginTeamId    Int?
```

No new relation needed (team is already resolved via `teamId`).

- [x] **Step 3.1: Edit schema.prisma as above.**

- [x] **Step 3.2: Run migration**

```bash
cd apps/api
npx prisma migrate dev --name add_player_youth_promotion_fields
```

Expected: migration applied.

- [x] **Step 3.3: Add `promotePlayer` to service**

In `apps/api/src/player/player.service.ts`, add after `updatePlayerStatus`:

```typescript
async promotePlayer(id: string, targetTeamId: number, actorId: number) {
  const player = await this.repo.findById(id);
  if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
  if (!player.team || player.team.type !== "YOUTH") {
    throw new AppError(409, "PLAYER_NOT_ON_YOUTH_TEAM");
  }
  const result = await this.repo.promotePlayer(id, targetTeamId, player.teamId!);
  await writeAuditLog({
    actorId,
    action: "PLAYER_PROMOTED_TO_FIRST_TEAM",
    targetId: id,
    detail: { fromTeamId: player.teamId, toTeamId: targetTeamId },
  });
  return result;
}
```

- [x] **Step 3.4: Add `promotePlayer` to repo**

In `apps/api/src/player/player.repo.ts`, add a method after `updateStatus`:

```typescript
promotePlayer(id: string, targetTeamId: number, youthOriginTeamId: number) {
  return this.prisma.player.update({
    where: { id },
    data: {
      teamId: targetTeamId,
      promotedFromYouthAt: new Date(),
      youthOriginTeamId,
    },
    select: {
      ...PLAYER_SELECT,
      promotedFromYouthAt: true,
      youthOriginTeamId: true,
    },
  });
}
```

- [x] **Step 3.5: Add controller method**

In `apps/api/src/player/player.controller.ts`, add after `updatePlayerStatus`:

```typescript
promotePlayer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = requireUser(req);
    if (!isAdminLike(user.role)) {
      res.status(403).json({ code: "FORBIDDEN" }); return;
    }
    const { targetTeamId } = req.body as { targetTeamId: number };
    if (!targetTeamId) { res.status(400).json({ code: "TARGET_TEAM_REQUIRED" }); return; }
    const result = await this.service.promotePlayer(req.params["id"]!, targetTeamId, user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
```

Import `requireUser` from `../lib/authMiddleware` if not already imported — check existing imports at the top of the controller and add if missing.

- [x] **Step 3.6: Add route**

In `apps/api/src/player/player.routes.ts`, add after the `patch("/:id/status")` route:

```typescript
router.post("/:id/promote", auth, controller.promotePlayer);
```

- [x] **Step 3.7: Add `promote` to FE service**

In `football/src/services/player.service.ts`, inside `playerApi`, add:

```typescript
promote: (id: string, targetTeamId: number) =>
  api.post<PlayerDetail>(`/players/${id}/promote`, { targetTeamId }),
```

- [x] **Step 3.8: Update FE types**

In `football/src/types/player.ts`, find `PlayerDetail` (or the detail interface) and add:

```typescript
promotedFromYouthAt?: string | null
youthOriginTeamId?: number | null
```

- [x] **Step 3.9: Add Youth History tab to PlayerDetailPage**

In `football/src/pages/players/PlayerDetailPage.tsx`:

1. Add condition for showing the tab (near other tab conditions, after `isYouthPlayer`):

```tsx
const hasYouthHistory = !!(player?.promotedFromYouthAt || player?.youthOriginTeamId)
```

2. Add the tab trigger inside `<TabsList>` (after the `growth` tab trigger):

```tsx
{hasYouthHistory && (
  <TabsTrigger value="youth-history">유소년 이력</TabsTrigger>
)}
```

3. Add the tab content after the last `<TabsContent>`:

```tsx
{hasYouthHistory && (
  <TabsContent value="youth-history" className="flex-1 overflow-auto p-6 mt-0">
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">유소년 이력</h3>
        <Separator className="mb-3" />
        {player.promotedFromYouthAt && (
          <>
            <StatRow
              label="1군 승격일"
              value={formatDate(player.promotedFromYouthAt)}
            />
            <Separator />
          </>
        )}
        {player.youthOriginTeamId && (
          <StatRow
            label="출신 유소년팀 ID"
            value={String(player.youthOriginTeamId)}
          />
        )}
      </div>
    </div>
  </TabsContent>
)}
```

Also add a promote button to the header action bar (visible only when `isYouthPlayer && canChangeStatus`):

```tsx
{isYouthPlayer && canChangeStatus && (
  <Button variant="outline" size="sm" onClick={() => setPromoteOpen(true)}>
    1군 승격
  </Button>
)}
```

Add state: `const [promoteOpen, setPromoteOpen] = useState(false)` and a simple dialog that asks for `targetTeamId` and calls `playerApi.promote`. Keep it minimal — an `<Input type="number">` for team ID with a confirm button is fine for now.

- [x] **Step 3.10: Run BE tests**

```bash
cd apps/api
npx jest 2>&1 | tail -10
```

Expected: all pass.

- [x] **Step 3.11: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations \
  apps/api/src/player/player.service.ts apps/api/src/player/player.controller.ts \
  apps/api/src/player/player.repo.ts apps/api/src/player/player.routes.ts \
  football/src/pages/players/PlayerDetailPage.tsx \
  football/src/services/player.service.ts football/src/types/player.ts
git commit -m "feat(player): add youth-to-senior promotion endpoint and profile history tab"
```

---

## Task 4: Ledger Period Lock

**Problem:** Finance staff can post entries to any past period with no restriction. We need a `LedgerPeriodLock` table (year + month unique) and a `POST /ledger/lock` endpoint (FINANCE_MANAGER only). Once a period is locked, `LedgerService.create()` and `createRefund()` must reject entries dated in that period.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/ledger/ledger.repo.ts`
- Modify: `apps/api/src/ledger/ledger.service.ts`
- Modify: `apps/api/src/ledger/ledger.controller.ts`
- Modify: `apps/api/src/ledger/ledger.routes.ts`
- Modify: `apps/api/src/ledger/ledger.service.test.ts`
- Find and modify: ledger-related FE page + FE service

### Step 4.1: Write failing tests

Add at the end of `apps/api/src/ledger/ledger.service.test.ts`:

```typescript
describe("LedgerService period lock", () => {
  it("throws 409 PERIOD_LOCKED when period is locked", async () => {
    const repo = makeRepo({
      isPeriodLocked: jest.fn().mockResolvedValue(true),
    });
    const service = new LedgerService(repo);
    await expect(
      service.create({ type: "EXPENSE", category: "OTHER", amount: 100 } as any, 1)
    ).rejects.toThrow(new AppError(409, "PERIOD_LOCKED"));
  });

  it("allows entry when period is not locked", async () => {
    const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
    const repo = makeRepo({
      isPeriodLocked: jest.fn().mockResolvedValue(false),
      create,
    });
    const service = new LedgerService(repo);
    await service.create({ type: "EXPENSE", category: "OTHER", amount: 100 } as any, 1);
    expect(create).toHaveBeenCalled();
  });

  it("lockPeriod throws 409 when already locked", async () => {
    const repo = makeRepo({
      isPeriodLocked: jest.fn().mockResolvedValue(true),
      lockPeriod: jest.fn(),
    });
    const service = new LedgerService(repo);
    await expect(service.lockPeriod(2025, 3, 1)).rejects.toThrow(
      new AppError(409, "PERIOD_ALREADY_LOCKED")
    );
  });

  it("lockPeriod succeeds when not locked", async () => {
    const lockPeriod = jest.fn().mockResolvedValue({ id: 1, year: 2025, month: 3 });
    const repo = makeRepo({
      isPeriodLocked: jest.fn().mockResolvedValue(false),
      lockPeriod,
    });
    const service = new LedgerService(repo);
    await service.lockPeriod(2025, 3, 1);
    expect(lockPeriod).toHaveBeenCalledWith(2025, 3, 1);
  });
});
```

- [x] **Step 4.1: Write the tests above.**

- [x] **Step 4.2: Run tests to verify they fail**

```bash
cd apps/api
npx jest --testPathPattern="ledger.service" 2>&1 | tail -20
```

Expected: FAIL — `service.lockPeriod is not a function` and `isPeriodLocked` not on repo.

- [x] **Step 4.3: Add `LedgerPeriodLock` to schema**

In `apps/api/prisma/schema.prisma`, after `model LedgerEntry`, add:

```prisma
model LedgerPeriodLock {
  id          Int      @id @default(autoincrement())
  year        Int
  month       Int
  lockedById  Int
  lockedAt    DateTime @default(now())

  lockedBy User @relation("PeriodLockCreator", fields: [lockedById], references: [id])

  @@unique([year, month])
}
```

Also add the relation on `User` model. Find `model User` in the schema and add:
```prisma
  periodLocks        LedgerPeriodLock[] @relation("PeriodLockCreator")
```

- [x] **Step 4.3: Edit schema.prisma as above.**

- [x] **Step 4.4: Run migration**

```bash
cd apps/api
npx prisma migrate dev --name add_ledger_period_lock
```

Expected: migration applied.

- [x] **Step 4.5: Add `isPeriodLocked` and `lockPeriod` to repo**

In `apps/api/src/ledger/ledger.repo.ts`, add after `create`:

```typescript
isPeriodLocked(year: number, month: number): Promise<boolean> {
  return this.prisma.ledgerPeriodLock
    .findUnique({ where: { year_month: { year, month } } })
    .then((r) => r !== null);
}

lockPeriod(year: number, month: number, lockedById: number) {
  return this.prisma.ledgerPeriodLock.create({
    data: { year, month, lockedById },
  });
}
```

- [x] **Step 4.6: Add period lock check and `lockPeriod` to service**

In `apps/api/src/ledger/ledger.service.ts`:

1. Replace `create` method:

```typescript
async create(dto: CreateLedgerEntryDto, createdById: number) {
  if (dto.amount <= 0) throw new AppError(400, "INVALID_AMOUNT");
  this.validateExchangeRate(dto.exchangeRate);

  if (dto.relatedModule !== undefined && !ALLOWED_MODULES.includes(dto.relatedModule as any)) {
    throw new AppError(400, "INVALID_RELATED_MODULE");
  }
  if (dto.relatedId !== undefined && (!Number.isInteger(dto.relatedId) || dto.relatedId <= 0)) {
    throw new AppError(400, "INVALID_RELATED_ID");
  }

  // Check period lock against the current month (entries are always "now")
  const now = new Date();
  const locked = await this.repo.isPeriodLocked(now.getFullYear(), now.getMonth() + 1);
  if (locked) throw new AppError(409, "PERIOD_LOCKED");

  const rate = dto.exchangeRate ?? 1;
  const amountKrw = dto.amountKrw ?? dto.amount * rate;
  return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
}
```

2. Replace `createRefund` method — add period lock check after the `ALREADY_REVERSED` guard:

```typescript
async createRefund(originalId: number, createdById: number) {
  const original = await this.repo.findById(originalId);
  if (!original) throw new AppError(404, "LEDGER_ENTRY_NOT_FOUND");
  if (original.reversedById != null) throw new AppError(400, "ALREADY_REVERSED");

  const now = new Date();
  const locked = await this.repo.isPeriodLocked(now.getFullYear(), now.getMonth() + 1);
  if (locked) throw new AppError(409, "PERIOD_LOCKED");

  const refund = await this.repo.create({
    type: original.type as any,
    category: "REFUND",
    amount: -Number(original.amount),
    currency: original.currency as any,
    exchangeRate: Number(original.exchangeRate),
    amountKrw: -Number(original.amountKrw),
    isRefund: true,
    description: formatLedgerDescription("ledger", "refund", { entryId: original.id }),
    ...(original.relatedModule != null && { relatedModule: original.relatedModule }),
    ...(original.relatedId != null && { relatedId: original.relatedId }),
    reversalOfId: original.id,
    createdById,
  } as any);
  await this.repo.markReversed(originalId, refund.id);

  if (original.relatedModule === "SalesRecord" && original.relatedId) {
    await this.repo.markSalesRecordRefunded(original.relatedId);
  }

  return refund;
}
```

3. Add `lockPeriod` method after `createAutoEntry`:

```typescript
async lockPeriod(year: number, month: number, actorId: number) {
  const already = await this.repo.isPeriodLocked(year, month);
  if (already) throw new AppError(409, "PERIOD_ALREADY_LOCKED");
  return this.repo.lockPeriod(year, month, actorId);
}
```

- [x] **Step 4.7: Run tests to verify they pass**

```bash
cd apps/api
npx jest --testPathPattern="ledger.service" 2>&1 | tail -20
```

Expected: all tests PASS, including new period lock tests.

- [x] **Step 4.8: Add controller method**

In `apps/api/src/ledger/ledger.controller.ts`, add after the `refund` method:

```typescript
lockPeriod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { year, month } = req.query as { year?: string; month?: string };
    if (!year || !month) { res.status(400).json({ code: "YEAR_MONTH_REQUIRED" }); return; }
    const y = Number(year), m = Number(month);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
      res.status(400).json({ code: "INVALID_YEAR_MONTH" }); return;
    }
    const user = req.user!;
    res.status(201).json(await this.service.lockPeriod(y, m, user.id));
  } catch (err) {
    next(err);
  }
};
```

- [x] **Step 4.9: Add route**

In `apps/api/src/ledger/ledger.routes.ts`, add a FINANCE_MANAGER-only lock route. First add a helper:

```typescript
const checkFinanceManager = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "GM" &&
      !(role === "FRONT_OFFICE" && frontOfficeRole === "FINANCE_MANAGER")) {
    return next(new AppError(403, "FORBIDDEN"));
  }
  next();
};
```

Then add the route:

```typescript
router.post("/lock", auth, checkFinanceManager, ctrl.lockPeriod);
```

- [x] **Step 4.10: Add FE lock button**

First, find the ledger FE page:

```bash
find football/src/pages -name "*edger*" -o -name "*Ledger*" 2>/dev/null
```

In that page, add a "기간 마감" button visible only to FINANCE_MANAGER/ADMIN. On click, show a small dialog with year/month inputs. On confirm, call `ledgerApi.lockPeriod(year, month)`.

Add to FE service (`football/src/services/ledger.service.ts` or similar):

```typescript
lockPeriod: (year: number, month: number) =>
  api.post('/ledger/lock', null, { params: { year, month } }),
```

Note: the `api` wrapper is fetch-based, not Axios. Pass query params as part of the URL string:

```typescript
lockPeriod: (year: number, month: number) =>
  api.post(`/ledger/lock?year=${year}&month=${month}`),
```

- [x] **Step 4.11: Run full BE test suite**

```bash
cd apps/api
npx jest 2>&1 | tail -10
```

Expected: all pass.

- [x] **Step 4.12: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations \
  apps/api/src/ledger \
  football/src/pages football/src/services
git commit -m "feat(ledger): add period lock (LedgerPeriodLock table + POST /ledger/lock endpoint)"
```

---

## Self-Review Checklist

### Spec coverage

| Item | Task(s) |
|------|---------|
| 비자/노동허가 60D 알림 | Task 1 |
| 비자/노동허가 dedup (send once per window) | Task 1 (WorkPermitAlertLog `@@unique([playerId, window])`) |
| 지원자 거절 취소 (reinstate) | Task 2 |
| 거절 취소 권한 HR_MANAGER + ADMIN | Task 2 (`canWrite` = `canWriteHR` which covers both) |
| 거절 시 `previousStatus` 저장 | Task 2 (updated `rejectApplication` repo) |
| 유소년↔1군 이력 — 승격일 / 출신팀 | Task 3 |
| 영구 승격은 별도 endpoint (callup과 무관) | Task 3 (`POST /players/:id/promote`) |
| FE 프로필 유소년 이력 탭 | Task 3 |
| 기간 마감 잠금 (year+month) | Task 4 |
| FINANCE_MANAGER만 잠금 가능 | Task 4 (`checkFinanceManager` middleware) |
| 잠긴 기간엔 entry 추가/환불 차단 | Task 4 (period lock check in `create` + `createRefund`) |

### Placeholder scan

None found. All code blocks are complete.

### Type consistency

- `WorkPermitAlertLog.window` is `String` (not enum) — consistent with `"30D"` / `"60D"` literal usage in cron.
- `JobApplication.previousStatus` is `JobApplicationStatus?` — consistent with `status` field type.
- `Player.promotedFromYouthAt` is `DateTime?` returned as ISO string to FE — `PlayerDetail.promotedFromYouthAt?: string | null` matches.
- `LedgerPeriodLock.year_month` compound unique name matches Prisma's auto-generated `year_month` key used in `isPeriodLocked`.

---

## Execution

Plan saved. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans skill

Which approach?
