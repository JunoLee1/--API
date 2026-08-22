# Callup Type + Contract Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add `CallupType (TRAINING | OFFICIAL)` to the PlayerCallup model, enforce OFFICIAL callups require an active player contract, and gate TRAINING approvals to GM/TD/HEAD_COACH while OFFICIAL remains GM-only.

**Architecture:** Schema adds `CallupType` enum + field. Repo adds `findActiveContract`. Service branches on `callupType` in `approve()` (contract check + teamId update only for OFFICIAL) and `complete()` (teamId restore only for OFFICIAL). TRAINING skips the docs-submission flow entirely but sends guardian notifications. Controller broadens approve permission to GM|TD|HEAD_COACH and delegates type-specific role enforcement to the service.

**Tech Stack:** TypeScript, Express, Prisma, PostgreSQL, Jest (integration tests against real DB)

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` | Modify | Add `CallupType` enum + `callupType` field to `PlayerCallup` |
| `apps/api/src/player-callup/dto/player-callup.dto.ts` | Modify | Add `callupType?: "TRAINING" \| "OFFICIAL"` to `CreateCallupDto` |
| `apps/api/src/player-callup/player-callup.repo.ts` | Modify | Add `callupType` to SELECT + `create()`, add `findActiveContract()` |
| `apps/api/src/player-callup/player-callup.service.ts` | Modify | Type-aware `approve()`, `complete()`, `create()` (TRAINING guardian notif) |
| `apps/api/src/player-callup/player-callup.controller.ts` | Modify | Broaden `approve` role check to GM\|TD\|HEAD_COACH |
| `apps/api/__test__/player-callup/player-callup.service.test.ts` | Modify | Add TRAINING and contract-guard test cases |

---

### Task 1: Schema — add `CallupType` enum and field

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

Context: `PlayerCallup` model is around line 1780. `PlayerCallupStatus` enum is at line 1671. Add a new `CallupType` enum right after `PlayerCallupStatus`, then add the field to the model.

- [x] **Step 1: Add `CallupType` enum after `PlayerCallupStatus`**

Find this block in schema.prisma:
```prisma
enum PlayerCallupStatus {
  REQUESTED
  DOCS_SUBMITTED
  APPROVED
  REJECTED
  COMPLETED
}
```

Add immediately after:
```prisma
enum CallupType {
  TRAINING
  OFFICIAL
}
```

- [x] **Step 2: Add `callupType` field to `PlayerCallup` model**

In the `PlayerCallup` model, after the `status` field line, add:
```prisma
  callupType      CallupType         @default(OFFICIAL)
```

So the model looks like:
```prisma
  status          PlayerCallupStatus @default(REQUESTED)
  callupType      CallupType         @default(OFFICIAL)
  youthCoachConfirmed Boolean            @default(false)
```

- [x] **Step 3: Push schema to DB**

```bash
cd apps/api && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [x] **Step 4: Verify generated client has the new enum**

```bash
grep -n "CallupType\|TRAINING\|OFFICIAL" apps/api/src/generated/enums.ts | head -10
```

Expected: lines containing `CallupType`, `TRAINING`, `OFFICIAL`

- [x] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/generated/
git commit -m "feat: add CallupType enum (TRAINING|OFFICIAL) to PlayerCallup schema"
```

---

### Task 2: DTO + Repo — `callupType` field and `findActiveContract`

**Files:**
- Modify: `apps/api/src/player-callup/dto/player-callup.dto.ts`
- Modify: `apps/api/src/player-callup/player-callup.repo.ts`

- [x] **Step 1: Write the failing test — repo creates TRAINING callup**

In `apps/api/__test__/player-callup/player-callup.service.test.ts`, add to the existing `describe('PlayerCallupRepository')` block:

```typescript
it('TRAINING 콜업 생성 시 callupType=TRAINING 반환', async () => {
  const r = await repo().create({
    playerId: testPlayerId,
    fromTeamId: teamId,
    toTeamId: teamId,
    requestedById: headCoachUserId,
    reason: '훈련 참가',
    startDate: '2026-08-01',
    callupType: 'TRAINING',
  });
  expect(r.callupType).toBe('TRAINING');
  await prisma.playerCallup.delete({ where: { id: r.id } });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx jest __test__/player-callup --testNamePattern="TRAINING 콜업 생성"
```

Expected: FAIL — `callupType` not in DTO/SELECT yet

- [x] **Step 3: Update `CreateCallupDto`**

Replace the entire content of `apps/api/src/player-callup/dto/player-callup.dto.ts`:

```typescript
export interface CreateCallupDto {
  playerId: string;
  fromTeamId: number;
  toTeamId: number;
  reason: string;
  startDate: string;
  endDate?: string;
  callupType?: "TRAINING" | "OFFICIAL";
}

export interface RejectCallupDto {
  reason: string;
}

export interface CallupListQuery {
  status?: string;
}
```

- [x] **Step 4: Update repo SELECT and `create()`, add `findActiveContract()`**

Replace the full content of `apps/api/src/player-callup/player-callup.repo.ts`:

```typescript
import { PrismaClient } from "../generated/client";
import { CreateCallupDto, CallupListQuery } from "./dto/player-callup.dto";

const SELECT = {
  id: true,
  status: true,
  callupType: true,
  reason: true,
  rejectionReason: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  youthCoachConfirmed: true,
  medicalConfirmed: true,
  player: { select: { id: true, playerName: true, position: true, guardianId: true } },
  fromTeam: { select: { id: true, name: true } },
  toTeam: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, nickname: true } },
  approvedBy: { select: { id: true, nickname: true } },
} as const;

export class PlayerCallupRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: CallupListQuery) {
    const where = query.status ? { status: query.status as any } : {};
    return this.prisma.playerCallup.findMany({
      where,
      select: SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.playerCallup.findUnique({ where: { id }, select: SELECT });
  }

  findActiveByPlayerId(playerId: string) {
    return this.prisma.playerCallup.findFirst({
      where: { playerId, status: { in: ["REQUESTED", "DOCS_SUBMITTED", "APPROVED"] } },
      select: { id: true },
    });
  }

  findActiveContract(playerId: string) {
    const now = new Date();
    return this.prisma.contract.findFirst({
      where: {
        playerId,
        status: "ACTIVE",
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: { id: true },
    });
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
        callupType: dto.callupType ?? "OFFICIAL",
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

  reject(id: number, approvedById: number, rejectionReason: string) {
    return this.prisma.playerCallup.update({
      where: { id },
      data: { status: "REJECTED", approvedById, rejectionReason },
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

  confirmYouth(id: number) {
    return this.prisma.playerCallup.update({
      where: { id },
      data: { youthCoachConfirmed: true },
      select: SELECT,
    });
  }

  confirmMedical(id: number) {
    return this.prisma.playerCallup.update({
      where: { id },
      data: { medicalConfirmed: true },
      select: SELECT,
    });
  }

  submitDocs(id: number) {
    return this.prisma.playerCallup.update({
      where: { id },
      data: { status: "DOCS_SUBMITTED" },
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

- [x] **Step 5: Run test to verify it passes**

```bash
cd apps/api && npx jest __test__/player-callup --testNamePattern="TRAINING 콜업 생성"
```

Expected: PASS

- [x] **Step 6: Commit**

```bash
git add apps/api/src/player-callup/dto/player-callup.dto.ts \
        apps/api/src/player-callup/player-callup.repo.ts \
        apps/api/__test__/player-callup/player-callup.service.test.ts
git commit -m "feat: add callupType to dto/repo, add findActiveContract"
```

---

### Task 3: Service — type-aware `approve()`, `complete()`, `create()`

**Files:**
- Modify: `apps/api/src/player-callup/player-callup.service.ts`

Key rules to implement:
- `create()`: if TRAINING, still send guardian notification (already does — no change needed there)
- `approve()`:
  - OFFICIAL: existing DOCS_SUBMITTED check → contract check → `updatePlayerTeam` → notify
  - TRAINING: REQUESTED check → skip contract → skip `updatePlayerTeam` → notify requester
- `complete()`:
  - OFFICIAL: existing logic (updatePlayerTeam back to fromTeam)
  - TRAINING: status update only, no `updatePlayerTeam`
- `confirmYouth()` / `confirmMedical()`: guard against TRAINING callups (throw `INVALID_CALLUP_TYPE`)

- [x] **Step 1: Write failing tests**

Add to `apps/api/__test__/player-callup/player-callup.service.test.ts`:

```typescript
import { PlayerCallupService } from '../../src/player-callup/player-callup.service';
import { NotificationRepository } from '../../src/notification/notification.repo';

describe('PlayerCallupService — contract guard', () => {
  let trainingCallupId: number;
  const notifRepo = new NotificationRepository(prisma);
  const service = () => new PlayerCallupService(new PlayerCallupRepository(prisma), notifRepo);

  it('OFFICIAL 콜업 — 활성 계약 없으면 approve 거부 (NO_ACTIVE_CONTRACT)', async () => {
    // 계약 없는 선수로 OFFICIAL 콜업 생성 후 DOCS_SUBMITTED 상태로 세팅
    const player = await prisma.player.findFirst({
      where: { contracts: { none: { status: 'ACTIVE' } } },
      select: { id: true },
    });
    if (!player) return; // 환경에 따라 skip

    const callup = await prisma.playerCallup.create({
      data: {
        playerId: player.id,
        fromTeamId: teamId,
        toTeamId: teamId,
        requestedById: headCoachUserId,
        reason: '계약 없음 테스트',
        startDate: new Date('2026-08-01'),
        callupType: 'OFFICIAL',
        status: 'DOCS_SUBMITTED',
      },
    });

    await expect(service().approve(callup.id, gmUserId, true)).rejects.toThrow('NO_ACTIVE_CONTRACT');
    await prisma.playerCallup.delete({ where: { id: callup.id } });
  });

  it('TRAINING 콜업 — REQUESTED 상태에서 approve 가능, teamId 변경 없음', async () => {
    const before = await prisma.player.findUnique({
      where: { id: testPlayerId },
      select: { teamId: true },
    });

    const callup = await prisma.playerCallup.create({
      data: {
        playerId: testPlayerId,
        fromTeamId: teamId,
        toTeamId: teamId,
        requestedById: headCoachUserId,
        reason: '훈련 참가',
        startDate: new Date('2026-08-01'),
        callupType: 'TRAINING',
        status: 'REQUESTED',
      },
    });
    trainingCallupId = callup.id;

    const approved = await service().approve(callup.id, gmUserId, true);
    expect(approved.status).toBe('APPROVED');

    const after = await prisma.player.findUnique({
      where: { id: testPlayerId },
      select: { teamId: true },
    });
    expect(after?.teamId).toBe(before?.teamId); // teamId 변경 없음

    await prisma.playerCallup.delete({ where: { id: callup.id } });
  });

  it('TRAINING 콜업 — complete() 시 teamId 변경 없음', async () => {
    const before = await prisma.player.findUnique({
      where: { id: testPlayerId },
      select: { teamId: true },
    });

    const callup = await prisma.playerCallup.create({
      data: {
        playerId: testPlayerId,
        fromTeamId: teamId,
        toTeamId: teamId,
        requestedById: headCoachUserId,
        reason: '훈련 참가',
        startDate: new Date('2026-08-01'),
        callupType: 'TRAINING',
        status: 'APPROVED',
      },
    });

    const completed = await service().complete(callup.id, gmUserId);
    expect(completed.status).toBe('COMPLETED');

    const after = await prisma.player.findUnique({
      where: { id: testPlayerId },
      select: { teamId: true },
    });
    expect(after?.teamId).toBe(before?.teamId);

    await prisma.playerCallup.delete({ where: { id: callup.id } });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest __test__/player-callup --testNamePattern="contract guard"
```

Expected: FAIL — service doesn't branch on callupType yet

- [x] **Step 3: Update `player-callup.service.ts`**

Replace the full content of `apps/api/src/player-callup/player-callup.service.ts`:

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
    const existing = await this.repo.findActiveByPlayerId(dto.playerId);
    if (existing) throw new AppError(409, "CALLUP_ALREADY_ACTIVE");

    const callup = await this.repo.create({ ...dto, requestedById });

    void this.notifRepo
      .createForYouthHeadCoach(
        callup.fromTeam.id,
        "CALLUP_REQUESTED",
        () => ({
          title: "유소년 콜업 서류 요청",
          body: `${callup.player.playerName} 선수의 1군 콜업 서류 확인이 필요합니다.`,
        }),
        callup.id,
      )
      .catch(console.error);

    void this.notifRepo
      .createForMedicalStaff(
        "CALLUP_REQUESTED",
        () => ({
          title: "유소년 콜업 서류 요청",
          body: `${callup.player.playerName} 선수의 1군 콜업 의무 서류 확인이 필요합니다.`,
        }),
        callup.id,
      )
      .catch(console.error);

    const guardianId = callup.player.guardianId;
    if (guardianId) {
      void this.notifRepo
        .createForGuardian(
          guardianId,
          "CALLUP_REQUESTED",
          () => ({
            title: "1군 콜업 요청",
            body: `${callup.player.playerName} 선수에게 1군 콜업 요청이 들어왔습니다.`,
          }),
          callup.id,
        )
        .catch(console.error);
    }

    return callup;
  }

  async approve(id: number, approvedById: number, isGM: boolean) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");

    if (callup.callupType === "TRAINING") {
      if (callup.status !== "REQUESTED") throw new AppError(409, "INVALID_STATUS");

      const updated = await this.repo.approve(id, approvedById);

      void this.notifRepo
        .createForUser(
          callup.requestedBy.id,
          "CALLUP_APPROVED",
          () => ({
            title: "훈련 콜업 승인",
            body: `${callup.player.playerName} 선수의 훈련 참가 콜업이 승인됐습니다.`,
          }),
          id,
        )
        .catch(console.error);

      return updated;
    }

    // OFFICIAL — GM만 승인 가능
    if (!isGM) throw new AppError(403, "FORBIDDEN");
    if (callup.status !== "DOCS_SUBMITTED") throw new AppError(409, "INVALID_STATUS");

    const contract = await this.repo.findActiveContract(callup.player.id);
    if (!contract) throw new AppError(409, "NO_ACTIVE_CONTRACT");

    const updated = await this.repo.approve(id, approvedById);
    await this.repo.updatePlayerTeam(callup.player.id, callup.toTeam.id);
    await writeAuditLog({ actorId: approvedById, action: "CALLUP_APPROVED", targetId: id });

    void this.notifRepo
      .createForUser(
        callup.requestedBy.id,
        "CALLUP_APPROVED",
        () => ({
          title: "콜업 승인",
          body: `${callup.player.playerName} 선수의 1군 콜업이 승인됐습니다.`,
        }),
        id,
      )
      .catch(console.error);

    return updated;
  }

  async reject(id: number, approvedById: number, dto: RejectCallupDto) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    if (callup.status !== "DOCS_SUBMITTED") throw new AppError(409, "INVALID_STATUS");
    if (!dto.reason?.trim()) throw new AppError(400, "REASON_REQUIRED");

    const updated = await this.repo.reject(id, approvedById, dto.reason);
    await writeAuditLog({ actorId: approvedById, action: "CALLUP_REJECTED", targetId: id });

    void this.notifRepo
      .createForUser(
        callup.requestedBy.id,
        "CALLUP_REJECTED",
        () => ({
          title: "콜업 거절",
          body: `${callup.player.playerName} 선수의 1군 콜업이 거절됐습니다. 사유: ${dto.reason}`,
        }),
        id,
      )
      .catch(console.error);

    return updated;
  }

  async confirmYouth(id: number, actorTeamId: number | null) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    if (callup.callupType === "TRAINING") throw new AppError(409, "INVALID_CALLUP_TYPE");
    if (callup.status !== "REQUESTED") throw new AppError(409, "INVALID_STATUS");
    if (actorTeamId !== callup.fromTeam.id) throw new AppError(403, "FORBIDDEN");

    const updated = await this.repo.confirmYouth(id);

    if (updated.medicalConfirmed) {
      const submitted = await this.repo.submitDocs(id);
      void this.notifRepo.createForGM("CALLUP_DOCS_READY", () => ({ title: "콜업 서류 완료", body: `${callup.player.playerName} 선수 콜업 서류가 완료됐습니다. 최종 승인을 진행해주세요.` }), id).catch(console.error);
      void this.notifRepo.createForTD("CALLUP_DOCS_READY", () => ({ title: "콜업 서류 완료", body: `${callup.player.playerName} 선수 콜업 서류가 완료됐습니다.` }), id).catch(console.error);
      return submitted;
    }

    return updated;
  }

  async confirmMedical(id: number) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    if (callup.callupType === "TRAINING") throw new AppError(409, "INVALID_CALLUP_TYPE");
    if (callup.status !== "REQUESTED") throw new AppError(409, "INVALID_STATUS");

    const updated = await this.repo.confirmMedical(id);

    if (updated.youthCoachConfirmed) {
      const submitted = await this.repo.submitDocs(id);
      void this.notifRepo.createForGM("CALLUP_DOCS_READY", () => ({ title: "콜업 서류 완료", body: `${callup.player.playerName} 선수 콜업 서류가 완료됐습니다. 최종 승인을 진행해주세요.` }), id).catch(console.error);
      void this.notifRepo.createForTD("CALLUP_DOCS_READY", () => ({ title: "콜업 서류 완료", body: `${callup.player.playerName} 선수 콜업 서류가 완료됐습니다.` }), id).catch(console.error);
      return submitted;
    }

    return updated;
  }

  async complete(id: number, actorId: number) {
    const callup = await this.repo.findById(id);
    if (!callup) throw new AppError(404, "CALLUP_NOT_FOUND");
    if (callup.status !== "APPROVED") throw new AppError(409, "INVALID_STATUS");

    const completed = await this.repo.complete(id);

    if (callup.callupType === "OFFICIAL") {
      await this.repo.updatePlayerTeam(callup.player.id, callup.fromTeam.id);
      await writeAuditLog({ actorId, action: "CALLUP_COMPLETED", targetId: id });
    }

    return completed;
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest __test__/player-callup --testNamePattern="contract guard"
```

Expected: PASS (3/3)

- [x] **Step 5: Run full callup test suite**

```bash
cd apps/api && npx jest __test__/player-callup
```

Expected: All existing tests still pass

- [x] **Step 6: Commit**

```bash
git add apps/api/src/player-callup/player-callup.service.ts \
        apps/api/__test__/player-callup/player-callup.service.test.ts
git commit -m "feat: type-aware callup approve/complete with OFFICIAL contract guard"
```

---

### Task 4: Controller — broaden `approve` role to GM | TD | HEAD_COACH

**Files:**
- Modify: `apps/api/src/player-callup/player-callup.controller.ts`

Context: The service already enforces type-specific logic. The controller just needs to let GM, TD (FRONT_OFFICE), and HEAD_COACH through — the service will reject if a TD tries to approve an OFFICIAL callup isn't needed because we decided GM approves OFFICIAL and GM|TD|HEAD_COACH approves TRAINING. But since the service handles the state check (OFFICIAL requires DOCS_SUBMITTED, TRAINING requires REQUESTED), the controller only needs to gate on "is this user allowed to even attempt approve?".

We allow: GM, TD, HEAD_COACH. The service enforces the rest.

- [x] **Step 1: Update `approve` handler in controller**

In `apps/api/src/player-callup/player-callup.controller.ts`, replace the `approve` handler:

```typescript
approve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole, coachingRole } = req.user!;
    const isGM = role === "FRONT_OFFICE" && frontOfficeRole === "GM";
    const isTD = role === "FRONT_OFFICE" && frontOfficeRole === "TD";
    const isHeadCoach = role === "COACHING_STAFF" && coachingRole === "HEAD_COACH";
    if (!isGM && !isTD && !isHeadCoach) throw new AppError(403, "FORBIDDEN");
    res.json(await this.service.approve(Number(req.params["id"]), req.user!.id, isGM));
  } catch (err) { next(err); }
};
```

- [x] **Step 2: Check TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors

- [x] **Step 3: Commit**

```bash
git add apps/api/src/player-callup/player-callup.controller.ts
git commit -m "feat: allow TD and HEAD_COACH to approve callups (TRAINING type)"
```

---

### Task 5: Final test run + verify

**Files:** (none changed)

- [x] **Step 1: Run all callup tests**

```bash
cd apps/api && npx jest __test__/player-callup -v
```

Expected: All pass

- [x] **Step 2: Run full test suite**

```bash
cd apps/api && npx jest
```

Expected: No regressions

- [x] **Step 3: Check TypeScript**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 0 errors
