# Club Data Ownership Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Player`·`Prospect`에 `clubId Int?` FK를 추가하고, 생성 시 자동 세팅, 조회 시 구단 불일치 → 404를 반환한다.

**Architecture:** Prisma 스키마에 직접 `clubId` 컬럼 추가 → 마이그레이션 backfill → `assertClubAccess` 확장 → repo/service/controller 3계층 수정. `user.clubId`가 없는 계정은 bypass, SUPER_ADMIN은 전체 접근.

**Tech Stack:** Express + Prisma + TypeScript (BE only)

---

## 파일 맵

| 파일 | 변경 |
|---|---|
| `apps/api/prisma/schema.prisma` | `Player.clubId Int?`, `Prospect.clubId Int?`, `Club` backrelation 추가 |
| `apps/api/prisma/migrations/20260908000003_player_prospect_club_id/migration.sql` | 신규 마이그레이션 |
| `apps/api/src/lib/permissions.ts` | `assertClubAccess` — 모든 역할 clubId 체크, 403→404 |
| `apps/api/src/player/player.repo.ts` | `findById(id, clubId?, includePrivate)`, `findAll` 직접 clubId 필터 |
| `apps/api/src/player/player.service.ts` | `createPlayer(dto, actor)`, `getPlayerById(id, clubId?, includePrivate)`, `getPlayers(query, clubId?)` |
| `apps/api/src/player/player.controller.ts` | `getPlayers` scopedClubId 전역화, `getPlayerById` clubId 전달, `createPlayer` actor 전달 |
| `apps/api/src/prospect/prospect.repo.ts` | `findAll(status?, clubId?)`, `findById(id, clubId?)`, `create(dto, clubId?)` |
| `apps/api/src/prospect/prospect.service.ts` | `create(dto, actor)`, `getAll(status?, clubId?)`, `getById(id, clubId?)` |
| `apps/api/src/prospect/prospect.controller.ts` | `list`, `getById`, `create`에 actor.clubId 전달 |

---

### Task 1: 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260908000003_player_prospect_club_id/migration.sql`

- [ ] **Step 1: schema.prisma — Player, Prospect, Club 수정**

`apps/api/prisma/schema.prisma` 에서 Player 모델을 찾아 `clubId`·`club` 필드 추가:

```prisma
model Player {
  // ... 기존 필드 유지 ...
  clubId   Int?
  club     Club?   @relation("PlayerClub", fields: [clubId], references: [id])
}
```

Prospect 모델:

```prisma
model Prospect {
  // ... 기존 필드 유지 ...
  clubId   Int?
  club     Club?   @relation("ProspectClub", fields: [clubId], references: [id])
}
```

Club 모델(`model Club { ... }` 블록 내 마지막 relation 뒤)에 backrelation 추가:

```prisma
model Club {
  // ... 기존 필드 유지 ...
  players   Player[]   @relation("PlayerClub")
  prospects Prospect[] @relation("ProspectClub")
}
```

- [ ] **Step 2: Prisma 클라이언트 재생성 확인**

```bash
cd apps/api && npx prisma generate
```

Expected: `✔ Generated Prisma Client` (오류 없음)

- [ ] **Step 3: 마이그레이션 파일 생성**

```bash
mkdir -p apps/api/prisma/migrations/20260908000003_player_prospect_club_id
```

`apps/api/prisma/migrations/20260908000003_player_prospect_club_id/migration.sql` 파일 생성:

```sql
-- Player.clubId 추가 및 backfill
ALTER TABLE "public"."Player" ADD COLUMN "clubId" INTEGER;
ALTER TABLE "public"."Player"
  ADD CONSTRAINT "Player_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "public"."Player" p
SET "clubId" = t."clubId"
FROM "public"."Team" t
WHERE p."teamId" = t."id" AND t."clubId" IS NOT NULL;

-- Prospect.clubId 추가 및 backfill (첫 번째 Club으로 일괄)
ALTER TABLE "public"."Prospect" ADD COLUMN "clubId" INTEGER;
ALTER TABLE "public"."Prospect"
  ADD CONSTRAINT "Prospect_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "public"."Prospect"
SET "clubId" = (SELECT "id" FROM "public"."Club" ORDER BY "id" LIMIT 1)
WHERE "clubId" IS NULL;
```

- [ ] **Step 4: 마이그레이션 적용**

```bash
cd apps/api && npx prisma migrate deploy
```

Expected: `1 migration applied` (오류 없음)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260908000003_player_prospect_club_id/
git commit -m "feat: Player·Prospect clubId FK 추가 및 마이그레이션"
```

---

### Task 2: `assertClubAccess` 확장

**Files:**
- Modify: `apps/api/src/lib/permissions.ts`
- Create: `apps/api/__test__/lib/permissions.test.ts`

**현재 코드 (`apps/api/src/lib/permissions.ts:93-102`):**

```typescript
export function assertClubAccess(req: Request, targetClubId: number | null | undefined): void {
  const user = req.user;
  if (!user) throw new AppError(401, 'UNAUTHORIZED');
  if (user.role === 'SUPER_ADMIN') return;
  if (user.role === 'ADMIN') {
    if (targetClubId == null || user.clubId !== targetClubId) {
      throw new AppError(403, 'FORBIDDEN');
    }
  }
}
```

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/__test__/lib/permissions.test.ts` 생성:

```typescript
import { describe, it, expect } from "@jest/globals";
import { assertClubAccess } from "../../src/lib/permissions";

function makeReq(role: string, clubId: number | null | undefined) {
  return { user: { role, clubId } } as any;
}

describe("assertClubAccess", () => {
  it("SUPER_ADMIN은 targetClubId 무관 통과", () => {
    expect(() => assertClubAccess(makeReq("SUPER_ADMIN", 1), 99)).not.toThrow();
    expect(() => assertClubAccess(makeReq("SUPER_ADMIN", null), null)).not.toThrow();
  });

  it("user.clubId 없으면 모든 역할 bypass", () => {
    expect(() => assertClubAccess(makeReq("ADMIN", null), 1)).not.toThrow();
    expect(() => assertClubAccess(makeReq("FRONT_OFFICE", undefined), 1)).not.toThrow();
  });

  it("clubId 일치하면 통과", () => {
    expect(() => assertClubAccess(makeReq("ADMIN", 1), 1)).not.toThrow();
    expect(() => assertClubAccess(makeReq("COACHING_STAFF", 2), 2)).not.toThrow();
  });

  it("clubId 불일치 → 404 NOT_FOUND", () => {
    expect(() => assertClubAccess(makeReq("ADMIN", 1), 2)).toThrow(
      expect.objectContaining({ statusCode: 404, code: "NOT_FOUND" })
    );
  });

  it("targetClubId null → 404 NOT_FOUND (정보 노출 방지)", () => {
    expect(() => assertClubAccess(makeReq("ADMIN", 1), null)).toThrow(
      expect.objectContaining({ statusCode: 404, code: "NOT_FOUND" })
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npx jest --testPathPattern="permissions.test" --no-coverage 2>&1 | tail -20
```

Expected: FAIL (assertClubAccess가 아직 기존 로직)

- [ ] **Step 3: `assertClubAccess` 구현 변경**

`apps/api/src/lib/permissions.ts:93-102` 교체:

```typescript
export function assertClubAccess(req: Request, targetClubId: number | null | undefined): void {
  const user = req.user;
  if (!user) throw new AppError(401, 'UNAUTHORIZED');
  if (user.role === 'SUPER_ADMIN') return;
  if (!user.clubId) return;
  if (!targetClubId || user.clubId !== targetClubId) {
    throw new AppError(404, 'NOT_FOUND');
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd apps/api && npx jest --testPathPattern="permissions.test" --no-coverage 2>&1 | tail -10
```

Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/lib/permissions.ts apps/api/__test__/lib/permissions.test.ts
git commit -m "feat: assertClubAccess 전역 clubId 체크 (모든 역할, 403→404)"
```

---

### Task 3: Player 레포 변경

**Files:**
- Modify: `apps/api/src/player/player.repo.ts`

**변경 포인트 2곳:**

1. `findById` — `findUnique` → `findFirst` + clubId 필터, 파라미터 순서 변경
2. `findAll` — `team: { clubId }` join 대신 직접 `{ clubId }` 필터

- [ ] **Step 1: `findById` 시그니처 변경**

`apps/api/src/player/player.repo.ts:43-89` 의 `findById`:

```typescript
findById(id: string, clubId?: number | null, includePrivate = false) {
  return this.prisma.player.findFirst({
    where: { id, ...(clubId != null && { clubId }) },
    select: {
      ...PLAYER_SELECT,
      userId: true,
      agentId: true,
      agencyId: true,
      ...(includePrivate && {
        emergencyContactNameEncrypted: true,
        emergencyContactNameIv: true,
        emergencyContactPhoneEncrypted: true,
        emergencyContactPhoneIv: true,
        emergencyContactRelationEncrypted: true,
        emergencyContactRelationIv: true,
        allergies: true,
        foodPreferences: true,
      }),
      agency: { select: { id: true, name: true, contactName: true, phone: true } },
      team: { select: { id: true, type: true } },
      contracts: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          ...(includePrivate && { salary: true }),
          status: true,
        },
        orderBy: { startDate: "desc" },
        take: 1,
      },
      transfers: {
        select: {
          id: true,
          type: true,
          date: true,
          fee: true,
          fromClub: true,
          toClub: true,
        },
        orderBy: { date: "desc" },
      },
      workPermitStatus: true,
      workPermitExpiry: true,
    },
  });
}
```

- [ ] **Step 2: `findAll` — 직접 clubId 필터로 교체**

`apps/api/src/player/player.repo.ts:27-41` 의 `findAll`:

```typescript
findAll(query: PlayerListQuery, clubId?: number | null) {
  return this.prisma.player.findMany({
    where: {
      ...(clubId != null && { clubId }),
      ...(query.status && { status: query.status }),
      ...(query.position && { position: query.position }),
      ...(query.level && { level: query.level }),
      ...(query.nationalityId && { nationalityId: query.nationalityId }),
      ...(query.excludeYouth && { NOT: { team: { type: 'YOUTH' } } }),
      ...(query.teamType && { team: { type: query.teamType } }),
    },
    select: PLAYER_SELECT,
    orderBy: { playerName: "asc" },
  });
}
```

- [ ] **Step 3: `create` — clubId 파라미터 추가**

`apps/api/src/player/player.repo.ts:91-128` 의 `create`:

```typescript
create(data: CreatePlayerDto, clubId?: number | null) {
  const dobEnc = encrypt(data.dateOfBirth);
  const encName = data.emergencyContactName ? encrypt(data.emergencyContactName) : null;
  const encPhone = data.emergencyContactPhone ? encrypt(data.emergencyContactPhone) : null;
  const encRelation = data.emergencyContactRelation ? encrypt(data.emergencyContactRelation) : null;

  return this.prisma.player.create({
    data: {
      playerName: data.playerName,
      dateOfBirthEncrypted: dobEnc.encrypted,
      dateOfBirthIv: dobEnc.iv,
      preferredFoot: data.preferredFoot,
      height: data.height,
      weight: data.weight,
      position: data.position,
      level: data.level,
      nationalityId: data.nationalityId,
      clubId: clubId ?? null,
      ...(data.externalId && { externalId: data.externalId }),
      ...(data.userId && { userId: data.userId }),
      ...(data.agentId && { agentId: data.agentId }),
      ...(data.agencyId && { agencyId: data.agencyId }),
      ...(encName && {
        emergencyContactNameEncrypted: encName.encrypted,
        emergencyContactNameIv: encName.iv,
      }),
      ...(encPhone && {
        emergencyContactPhoneEncrypted: encPhone.encrypted,
        emergencyContactPhoneIv: encPhone.iv,
      }),
      ...(encRelation && {
        emergencyContactRelationEncrypted: encRelation.encrypted,
        emergencyContactRelationIv: encRelation.iv,
      }),
    },
    select: PLAYER_SELECT,
  });
}
```

- [ ] **Step 4: TypeScript 오류 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "player.repo\|player.service\|player.controller" | head -20
```

Expected: 서비스·컨트롤러에서 `findById` 시그니처 불일치 오류 (다음 Task에서 수정)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/player/player.repo.ts
git commit -m "refactor: player.repo — findById clubId 필터, findAll 직접 clubId, create clubId 파라미터"
```

---

### Task 4: Player 서비스 + 컨트롤러 변경

**Files:**
- Modify: `apps/api/src/player/player.service.ts`
- Modify: `apps/api/src/player/player.controller.ts`
- Create: `apps/api/__test__/player/player.club-access.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/__test__/player/player.club-access.test.ts` 생성:

```typescript
import { describe, it, jest, expect, beforeEach } from "@jest/globals";
import { PlayerService } from "../../src/player/player.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  findAll: jest.fn<() => Promise<any[]>>(),
  findById: jest.fn<() => Promise<any>>(),
  create: jest.fn<() => Promise<any>>(),
  updateStatus: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  promotePlayer: jest.fn(),
  updateWorkPermit: jest.fn(),
  getMatchStats: jest.fn(),
  getTrainingResults: jest.fn(),
  getPositionDiversity: jest.fn(),
};

const fakePlayer = {
  id: "p1",
  playerName: "홍길동",
  clubId: 1,
  team: { id: 1, type: "FIRST_TEAM" },
};

const actor = { id: 10, role: "ADMIN", clubId: 1 } as any;

describe("PlayerService — club scoping", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getPlayerById", () => {
    it("clubId 불일치(null 반환) → PLAYER_NOT_FOUND", async () => {
      mockRepo.findById.mockResolvedValue(null);
      const svc = new PlayerService(mockRepo as any);
      await expect(svc.getPlayerById("p1", 2)).rejects.toMatchObject({
        statusCode: 404, code: "PLAYER_NOT_FOUND",
      });
      expect(mockRepo.findById).toHaveBeenCalledWith("p1", 2, false);
    });

    it("clubId 일치 → 반환", async () => {
      mockRepo.findById.mockResolvedValue(fakePlayer);
      const svc = new PlayerService(mockRepo as any);
      const result = await svc.getPlayerById("p1", 1);
      expect(result).toMatchObject({ id: "p1" });
    });
  });

  describe("createPlayer", () => {
    it("actor.clubId를 repo.create에 전달", async () => {
      mockRepo.create.mockResolvedValue(fakePlayer);
      const svc = new PlayerService(mockRepo as any);
      const dto = { playerName: "홍길동", dateOfBirth: "1990-01-01" } as any;
      await svc.createPlayer(dto, actor);
      expect(mockRepo.create).toHaveBeenCalledWith(dto, 1);
    });

    it("actor.clubId 없으면 null 전달", async () => {
      mockRepo.create.mockResolvedValue(fakePlayer);
      const svc = new PlayerService(mockRepo as any);
      const dto = { playerName: "홍길동", dateOfBirth: "1990-01-01" } as any;
      await svc.createPlayer(dto, { ...actor, clubId: undefined });
      expect(mockRepo.create).toHaveBeenCalledWith(dto, null);
    });
  });

  describe("getPlayers", () => {
    it("clubId를 repo.findAll에 전달", async () => {
      mockRepo.findAll.mockResolvedValue([]);
      const svc = new PlayerService(mockRepo as any);
      await svc.getPlayers({}, 1);
      expect(mockRepo.findAll).toHaveBeenCalledWith({}, 1);
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npx jest --testPathPattern="player.club-access" --no-coverage 2>&1 | tail -20
```

Expected: FAIL (서비스 시그니처 불일치)

- [ ] **Step 3: `player.service.ts` 변경**

**`createPlayer` (`apps/api/src/player/player.service.ts:69-73`):**

```typescript
async createPlayer(dto: CreatePlayerDto, actor: Express.User) {
  const player = await this.repo.create(dto, actor.clubId ?? null);
  await writeAuditLog({ actorId: actor.id, action: "PLAYER_CREATED", targetId: player.id });
  return player;
}
```

**`getPlayerById` (`apps/api/src/player/player.service.ts:29-67`):** — 시그니처에 `clubId?` 추가:

```typescript
async getPlayerById(id: string, clubId?: number | null, includePrivate = false) {
  const raw = await this.repo.findById(id, clubId, includePrivate);
  if (!raw) throw new AppError(404, "PLAYER_NOT_FOUND");
  // ... decrypt 로직 유지 (기존 코드 그대로) ...
}
```

> 참고: decrypt 로직(dateOfBirth, emergencyContact 필드 복호화)은 기존 코드 그대로 유지.

- [ ] **Step 4: `player.controller.ts` 변경**

**`getPlayers` (`apps/api/src/player/player.controller.ts:74`):**

```typescript
// 변경 전:
const scopedClubId = user.role === "ADMIN" ? user.clubId : null;
// 변경 후:
const scopedClubId = user.clubId ?? null;
```

**`getPlayerById` (`apps/api/src/player/player.controller.ts:85`):**

```typescript
// 변경 전:
const player = await this.service.getPlayerById(String(req.params["id"]), includePrivate);
// 변경 후:
const player = await this.service.getPlayerById(String(req.params["id"]), user.clubId, includePrivate);
```

**`createPlayer` (`apps/api/src/player/player.controller.ts:108`):**

```typescript
// 변경 전:
const player = await this.service.createPlayer(req.body, user.id);
// 변경 후:
const player = await this.service.createPlayer(req.body, user);
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd apps/api && npx jest --testPathPattern="player.club-access" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 6: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -i "player" | head -20
```

Expected: 0 errors

- [ ] **Step 7: 커밋**

```bash
git add apps/api/src/player/player.service.ts apps/api/src/player/player.controller.ts apps/api/__test__/player/player.club-access.test.ts
git commit -m "feat: player service/controller — clubId 스코핑 (getById, list, create)"
```

---

### Task 5: Prospect 레포 변경

**Files:**
- Modify: `apps/api/src/prospect/prospect.repo.ts`

- [ ] **Step 1: `findAll` — `clubId?` 파라미터 추가**

`apps/api/src/prospect/prospect.repo.ts:61-67` 의 `findAll`:

```typescript
findAll(status?: ProspectStatus, clubId?: number | null) {
  return this.prisma.prospect.findMany({
    where: {
      ...(status !== undefined && { status }),
      ...(clubId != null && { clubId }),
    },
    select: PROSPECT_SELECT,
    orderBy: { createdAt: "desc" },
  });
}
```

- [ ] **Step 2: `findById` — `findUnique` → `findFirst` + clubId 필터**

`apps/api/src/prospect/prospect.repo.ts:69-71` 의 `findById`:

```typescript
findById(id: number, clubId?: number | null) {
  return this.prisma.prospect.findFirst({
    where: { id, ...(clubId != null && { clubId }) },
    select: PROSPECT_SELECT,
  });
}
```

- [ ] **Step 3: `create` — `clubId` 파라미터 추가**

`apps/api/src/prospect/prospect.repo.ts:73-...` 의 `create` 시그니처 변경:

```typescript
create(dto: CreateProspectDto, clubId?: number | null) {
  return this.prisma.prospect.create({
    data: {
      name: dto.name,
      nationalityId: dto.nationalityId,
      position: dto.position ?? null,
      currentTeam: dto.currentTeam ?? null,
      notes: dto.notes ?? null,
      createdById: dto.createdById ?? null,
      status: dto.status ?? "LONGLIST",
      playStyle: (dto.playStyle as any) ?? null,
      clubId: clubId ?? null,
    },
    select: PROSPECT_SELECT,
  });
}
```

- [ ] **Step 4: TypeScript 오류 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "prospect" | head -10
```

Expected: 서비스·컨트롤러에서 시그니처 불일치 오류 (다음 Task에서 수정)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/prospect/prospect.repo.ts
git commit -m "refactor: prospect.repo — findAll/findById clubId 필터, create clubId 파라미터"
```

---

### Task 6: Prospect 서비스 + 컨트롤러 변경

**Files:**
- Modify: `apps/api/src/prospect/prospect.service.ts`
- Modify: `apps/api/src/prospect/prospect.controller.ts`
- Modify: `apps/api/__test__/prospect/prospect.service.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`apps/api/__test__/prospect/prospect.service.test.ts` 내 `describe("ProspectService - create")` 블록에 테스트 추가:

```typescript
describe("ProspectService - create (club scoping)", () => {
  const actorWithClub = { id: 10, role: "ADMIN", clubId: 5 } as any;
  const actorNoClub = { id: 11, role: "FRONT_OFFICE", clubId: null } as any;

  it("actor.clubId를 repo.create에 전달", async () => {
    mockRepo.checkDuplicate.mockResolvedValue({ prospects: [], squadPlayers: [] });
    mockRepo.create.mockResolvedValue(activeProspect);
    await service.create({ nationalityId: 1, name: "테스터" } as any, actorWithClub);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ nationalityId: 1 }),
      5
    );
  });

  it("actor.clubId 없으면 null 전달", async () => {
    mockRepo.checkDuplicate.mockResolvedValue({ prospects: [], squadPlayers: [] });
    mockRepo.create.mockResolvedValue(activeProspect);
    await service.create({ nationalityId: 1, name: "테스터" } as any, actorNoClub);
    expect(mockRepo.create).toHaveBeenCalledWith(expect.any(Object), null);
  });
});

describe("ProspectService - getById (club scoping)", () => {
  it("clubId 불일치(null 반환) → PROSPECT_NOT_FOUND", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getById(1, 99)).rejects.toMatchObject({
      statusCode: 404, code: "PROSPECT_NOT_FOUND",
    });
    expect(mockRepo.findById).toHaveBeenCalledWith(1, 99);
  });

  it("clubId 일치 → 반환", async () => {
    mockRepo.findById.mockResolvedValue(activeProspect);
    const result = await service.getById(1, 1);
    expect(result).toMatchObject({ id: 1 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npx jest --testPathPattern="prospect.service.test" --no-coverage 2>&1 | tail -20
```

Expected: FAIL (서비스 시그니처 불일치)

- [ ] **Step 3: `prospect.service.ts` 변경**

**`create` (`apps/api/src/prospect/prospect.service.ts:35-39`):**

```typescript
async create(dto: CreateProspectDto, actor: Express.User) {
  if (!dto.nationalityId) throw new AppError(400, "NATIONALITY_REQUIRED");
  const { squadPlayers } = await this.repo.checkDuplicate(dto.name);
  if (squadPlayers.length > 0) throw new AppError(409, "ALREADY_IN_SQUAD");
  return this.repo.create(dto, actor.clubId ?? null);
}
```

**`getAll` (`apps/api/src/prospect/prospect.service.ts:42-44`):**

```typescript
getAll(status?: ProspectStatus, clubId?: number | null) {
  return this.repo.findAll(status, clubId);
}
```

**`getById` (`apps/api/src/prospect/prospect.service.ts:46-50`):**

```typescript
async getById(id: number, clubId?: number | null) {
  const prospect = await this.repo.findById(id, clubId);
  if (!prospect) throw new AppError(404, "PROSPECT_NOT_FOUND");
  return prospect;
}
```

- [ ] **Step 4: `prospect.controller.ts` 변경**

**`list` (`apps/api/src/prospect/prospect.controller.ts:41-48`):**

```typescript
list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    if (!canRead(user.role, user.coachingRole, user.departmentCategories)) throw new AppError(403, "FORBIDDEN");
    const status = req.query["status"] as ProspectStatus | undefined;
    res.status(200).json(await this.service.getAll(status, user.clubId));
  } catch (err) { next(err); }
};
```

**`getById` (`apps/api/src/prospect/prospect.controller.ts:50-56`):**

```typescript
getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    if (!canRead(user.role, user.coachingRole, user.departmentCategories)) throw new AppError(403, "FORBIDDEN");
    res.status(200).json(await this.service.getById(Number(req.params["id"]), user.clubId));
  } catch (err) { next(err); }
};
```

**`create` (`apps/api/src/prospect/prospect.controller.ts:58-...`):**

```typescript
create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    if (!canWrite(user.role, user.frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
    const prospect = await this.service.create(req.body, user);
    res.status(201).json(prospect);
  } catch (err) { next(err); }
};
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd apps/api && npx jest --testPathPattern="prospect.service.test" --no-coverage 2>&1 | tail -10
```

Expected: PASS (모든 기존 테스트 포함)

- [ ] **Step 6: TypeScript 전체 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 errors (또는 기존 pre-existing 오류만)

- [ ] **Step 7: 전체 Prospect 테스트 통과 확인**

```bash
cd apps/api && npx jest --testPathPattern="prospect" --no-coverage 2>&1 | tail -15
```

Expected: 42 tests pass

- [ ] **Step 8: 커밋**

```bash
git add apps/api/src/prospect/prospect.service.ts apps/api/src/prospect/prospect.controller.ts apps/api/__test__/prospect/prospect.service.test.ts
git commit -m "feat: prospect service/controller — clubId 스코핑 (getById, list, create)"
```
