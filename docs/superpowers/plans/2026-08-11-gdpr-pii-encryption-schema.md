# GDPR PII Encryption Schema (PR A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt `emergencyContact*` and `dateOfBirth` fields in Player table, add `Injury.retainUntil` (7-year retention), and `User.suspendedAt` timestamp via a two-step migration with a backfill script.

**Architecture:** Two Prisma migrations bracket a TypeScript backfill script. Migration 1 adds nullable `*Encrypted`/`*Iv` columns alongside originals. The backfill script encrypts existing plaintext. Migration 2 drops the original plaintext columns. Encryption/decryption uses existing `src/lib/crypto.ts` (AES-256-CBC, key from `PHONE_ENCRYPTION_KEY` env). Decryption happens in the service layer; the repo returns raw encrypted blobs.

**Tech Stack:** Prisma, Node.js `crypto` (built-in), TypeScript, Jest, `tsx` for script execution.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `apps/api/prisma/schema.prisma` | Modify (×2) | Migration 1: add `*Encrypted`/`*Iv` columns, `retainUntil`, `suspendedAt`; Migration 2: drop plaintext columns |
| `apps/api/prisma/scripts/encrypt-pii.ts` | Create | One-shot backfill: read plaintext → encrypt → write to new columns |
| `apps/api/src/player/player.repo.ts` | Modify | Write path: encrypt before save; read path: select encrypted fields instead of plaintext |
| `apps/api/src/player/player.service.ts` | Modify | Decrypt encrypted fields after `findById`, strip raw blobs from returned object |
| `apps/api/src/safeguard/safeguard.repo.ts` | Modify | Set `suspendedAt: new Date()` when suspending a user |
| `apps/api/__test__/player/player.encryption.test.ts` | Create | Unit tests for encrypt-on-write and decrypt-on-read in player repo/service |
| `apps/api/__test__/safeguard/safeguard.repo.test.ts` | Create | Unit test: suspendUser sets suspendedAt |

---

## Task 1: Migration 1 — Add Encrypted Columns

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add fields to schema**

In `schema.prisma`, find `model Player` and add after the existing `emergencyContactRelation String?` line:

```prisma
  emergencyContactNameEncrypted     String?
  emergencyContactNameIv            String?
  emergencyContactPhoneEncrypted    String?
  emergencyContactPhoneIv           String?
  emergencyContactRelationEncrypted String?
  emergencyContactRelationIv        String?
  dateOfBirthEncrypted              String?
  dateOfBirthIv                     String?
```

In `schema.prisma`, find `model User` and add after `isSuspended Boolean @default(false)`:

```prisma
  suspendedAt DateTime?
```

In `schema.prisma`, find `model Injury` and add after `dataRetentionReason String?`:

```prisma
  retainUntil DateTime?
```

- [ ] **Step 2: Generate migration (do NOT use `db push`)**

```bash
cd apps/api && npx prisma migrate dev --name add-pii-encryption-columns
```

Expected output: `Your database is now in sync with your schema.` and a new folder in `prisma/migrations/`.

- [ ] **Step 3: Verify migration applied**

```bash
cd apps/api && npx prisma studio
```

Open Player table and confirm the 8 new columns exist (all nullable). Close Studio.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(schema): add PII encryption columns — Player emergency contacts + DOB encrypted, Injury.retainUntil, User.suspendedAt"
```

---

## Task 2: Update player.repo.ts — Encrypt on Write

**Files:**
- Modify: `apps/api/src/player/player.repo.ts`
- Create: `apps/api/__test__/player/player.encryption.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/__test__/player/player.encryption.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";

// Must set env before importing crypto module
process.env["PHONE_ENCRYPTION_KEY"] = "a".repeat(64); // 64 hex chars = 32 bytes

import { encrypt, decrypt } from "../../src/lib/crypto";

const mockPrisma = {
  player: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
};

jest.mock("../../src/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

import { PlayerRepository } from "../../src/player/player.repo";

describe("PlayerRepository — encryption on write", () => {
  let repo: PlayerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PlayerRepository(mockPrisma as any);
  });

  test("create() encrypts emergencyContactName before saving", async () => {
    mockPrisma.player.create.mockResolvedValue({ id: "p1", playerName: "Test" } as any);

    await repo.create({
      playerName: "Test",
      dateOfBirth: "2000-01-01",
      preferredFoot: "RIGHT",
      height: 180,
      weight: 75,
      position: "STRIKER",
      level: "SENIOR",
      nationalityId: 1,
      emergencyContactName: "Jane Doe",
    } as any);

    const savedData = (mockPrisma.player.create as jest.Mock).mock.calls[0][0].data;
    expect(savedData.emergencyContactName).toBeUndefined();
    expect(savedData.emergencyContactNameEncrypted).toBeDefined();
    expect(savedData.emergencyContactNameIv).toBeDefined();
    // Verify it actually decrypts back to original
    const decrypted = decrypt(savedData.emergencyContactNameEncrypted, savedData.emergencyContactNameIv);
    expect(decrypted).toBe("Jane Doe");
  });

  test("create() encrypts dateOfBirth before saving", async () => {
    mockPrisma.player.create.mockResolvedValue({ id: "p1", playerName: "Test" } as any);

    await repo.create({
      playerName: "Test",
      dateOfBirth: "2000-06-15",
      preferredFoot: "LEFT",
      height: 175,
      weight: 70,
      position: "GOALKEEPER",
      level: "ROOKIE",
      nationalityId: 1,
    } as any);

    const savedData = (mockPrisma.player.create as jest.Mock).mock.calls[0][0].data;
    expect(savedData.dateOfBirthEncrypted).toBeDefined();
    expect(savedData.dateOfBirthIv).toBeDefined();
    expect(savedData.dateOfBirth).toBeUndefined();
    const decrypted = decrypt(savedData.dateOfBirthEncrypted, savedData.dateOfBirthIv);
    expect(decrypted).toBe("2000-06-15");
  });

  test("update() encrypts only provided emergency contact fields", async () => {
    mockPrisma.player.update.mockResolvedValue({ id: "p1" } as any);

    await repo.update("p1", {
      emergencyContactPhone: "010-1234-5678",
    } as any);

    const savedData = (mockPrisma.player.update as jest.Mock).mock.calls[0][0].data;
    expect(savedData.emergencyContactPhone).toBeUndefined();
    expect(savedData.emergencyContactPhoneEncrypted).toBeDefined();
    expect(savedData.emergencyContactPhoneIv).toBeDefined();
    // Name was not provided — should not be set
    expect(savedData.emergencyContactNameEncrypted).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest __test__/player/player.encryption.test.ts --no-coverage
```

Expected: 3 failures — `emergencyContactNameEncrypted is undefined` etc.

- [ ] **Step 3: Update player.repo.ts write path**

At top of `apps/api/src/player/player.repo.ts`, add import:

```typescript
import { encrypt } from "../lib/crypto";
```

Replace the `create()` method body with:

```typescript
create(data: CreatePlayerDto) {
  const dobEncrypted = data.dateOfBirth ? encrypt(data.dateOfBirth) : null;
  const nameEncrypted = data.emergencyContactName ? encrypt(data.emergencyContactName) : null;
  const phoneEncrypted = data.emergencyContactPhone ? encrypt(data.emergencyContactPhone) : null;
  const relationEncrypted = data.emergencyContactRelation ? encrypt(data.emergencyContactRelation) : null;

  return this.prisma.player.create({
    data: {
      playerName: data.playerName,
      ...(dobEncrypted && { dateOfBirthEncrypted: dobEncrypted.encrypted, dateOfBirthIv: dobEncrypted.iv }),
      preferredFoot: data.preferredFoot,
      height: data.height,
      weight: data.weight,
      position: data.position,
      level: data.level,
      nationalityId: data.nationalityId,
      ...(data.externalId && { externalId: data.externalId }),
      ...(data.userId && { userId: data.userId }),
      ...(data.agentId && { agentId: data.agentId }),
      ...(data.agencyId && { agencyId: data.agencyId }),
      ...(nameEncrypted && { emergencyContactNameEncrypted: nameEncrypted.encrypted, emergencyContactNameIv: nameEncrypted.iv }),
      ...(phoneEncrypted && { emergencyContactPhoneEncrypted: phoneEncrypted.encrypted, emergencyContactPhoneIv: phoneEncrypted.iv }),
      ...(relationEncrypted && { emergencyContactRelationEncrypted: relationEncrypted.encrypted, emergencyContactRelationIv: relationEncrypted.iv }),
    },
    select: PLAYER_SELECT,
  });
}
```

Replace the `update()` method body with:

```typescript
update(id: string, data: UpdatePlayerDto) {
  const nameEncrypted = data.emergencyContactName !== undefined ? encrypt(data.emergencyContactName) : null;
  const phoneEncrypted = data.emergencyContactPhone !== undefined ? encrypt(data.emergencyContactPhone) : null;
  const relationEncrypted = data.emergencyContactRelation !== undefined ? encrypt(data.emergencyContactRelation) : null;
  const dobEncrypted = data.dateOfBirth !== undefined ? encrypt(data.dateOfBirth) : null;

  return this.prisma.player.update({
    where: { id },
    data: {
      ...(data.playerName && { playerName: data.playerName }),
      ...(dobEncrypted && { dateOfBirthEncrypted: dobEncrypted.encrypted, dateOfBirthIv: dobEncrypted.iv }),
      ...(data.preferredFoot && { preferredFoot: data.preferredFoot }),
      ...(data.height && { height: data.height }),
      ...(data.weight && { weight: data.weight }),
      ...(data.position && { position: data.position }),
      ...(data.level && { level: data.level }),
      ...(data.nationalityId && { nationalityId: data.nationalityId }),
      ...(data.externalId !== undefined && { externalId: data.externalId }),
      ...(data.agentId !== undefined && { agentId: data.agentId }),
      ...(data.agencyId !== undefined && { agencyId: data.agencyId }),
      ...(nameEncrypted && { emergencyContactNameEncrypted: nameEncrypted.encrypted, emergencyContactNameIv: nameEncrypted.iv }),
      ...(phoneEncrypted && { emergencyContactPhoneEncrypted: phoneEncrypted.encrypted, emergencyContactPhoneIv: phoneEncrypted.iv }),
      ...(relationEncrypted && { emergencyContactRelationEncrypted: relationEncrypted.encrypted, emergencyContactRelationIv: relationEncrypted.iv }),
      ...(data.allergies !== undefined && { allergies: data.allergies }),
      ...(data.foodPreferences !== undefined && { foodPreferences: data.foodPreferences }),
    },
    select: PLAYER_SELECT,
  });
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/api && npx jest __test__/player/player.encryption.test.ts --no-coverage
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/player/player.repo.ts apps/api/__test__/player/player.encryption.test.ts
git commit -m "feat(player): encrypt PII fields on write — emergency contacts and dateOfBirth"
```

---

## Task 3: Update player.repo.ts — Select Encrypted Fields on Read

**Files:**
- Modify: `apps/api/src/player/player.repo.ts`
- Modify: `apps/api/__test__/player/player.encryption.test.ts`

- [ ] **Step 1: Add failing test for read path**

Append to `apps/api/__test__/player/player.encryption.test.ts`:

```typescript
describe("PlayerRepository — encrypted field selection on read", () => {
  let repo: PlayerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PlayerRepository(mockPrisma as any);
  });

  test("findById(id, true) selects encrypted emergency contact fields", async () => {
    mockPrisma.player.findUnique.mockResolvedValue(null);
    await repo.findById("p1", true);

    const selectArg = (mockPrisma.player.findUnique as jest.Mock).mock.calls[0][0].select;
    expect(selectArg.emergencyContactNameEncrypted).toBe(true);
    expect(selectArg.emergencyContactNameIv).toBe(true);
    expect(selectArg.emergencyContactName).toBeUndefined();
  });

  test("findById(id, false) does NOT select emergency contact fields", async () => {
    mockPrisma.player.findUnique.mockResolvedValue(null);
    await repo.findById("p1", false);

    const selectArg = (mockPrisma.player.findUnique as jest.Mock).mock.calls[0][0].select;
    expect(selectArg.emergencyContactNameEncrypted).toBeUndefined();
  });

  test("PLAYER_SELECT does not include dateOfBirth (plaintext)", async () => {
    mockPrisma.player.findMany.mockResolvedValue([]);
    await repo.findAll({});

    const selectArg = (mockPrisma.player.findMany as jest.Mock).mock.calls[0][0].select;
    expect(selectArg.dateOfBirth).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest __test__/player/player.encryption.test.ts --no-coverage
```

Expected: 3 new failures.

- [ ] **Step 3: Update PLAYER_SELECT and findById in player.repo.ts**

Replace `PLAYER_SELECT` constant (remove `dateOfBirth: true`, add encrypted dob fields):

```typescript
const PLAYER_SELECT = {
  id: true,
  playerName: true,
  dateOfBirthEncrypted: true,
  dateOfBirthIv: true,
  preferredFoot: true,
  height: true,
  weight: true,
  position: true,
  level: true,
  status: true,
  externalId: true,
  playStyle: true,
  currentMarketValue: true,
  teamId: true,
  nationality: { select: { id: true, name: true, code: true } },
} as const;
```

Replace the `findById()` method with:

```typescript
findById(id: string, includePrivate = false) {
  return this.prisma.player.findUnique({
    where: { id },
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
    },
  });
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && npx jest __test__/player/player.encryption.test.ts --no-coverage
```

Expected: all 6 passing.

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -20
```

Fix any TypeScript errors related to missing `dateOfBirth` field (callers expecting `player.dateOfBirth` will now get `undefined` — service layer in Task 4 will restore it as decrypted string).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/player/player.repo.ts apps/api/__test__/player/player.encryption.test.ts
git commit -m "feat(player): select encrypted PII fields on read, remove plaintext dateOfBirth from PLAYER_SELECT"
```

---

## Task 4: Update player.service.ts — Decrypt on Read

**Files:**
- Modify: `apps/api/src/player/player.service.ts`
- Modify: `apps/api/__test__/player/player.encryption.test.ts`

- [ ] **Step 1: Add failing test for service decryption**

Append to `apps/api/__test__/player/player.encryption.test.ts`:

```typescript
import { PlayerService } from "../../src/player/player.service";

describe("PlayerService — decrypt on read", () => {
  test("getPlayerById decrypts emergencyContactName and returns plaintext", async () => {
    const { encrypted, iv } = encrypt("Jane Doe");
    const mockRepo = {
      findById: jest.fn().mockResolvedValue({
        id: "p1",
        playerName: "Test Player",
        dateOfBirthEncrypted: encrypt("2000-01-01").encrypted,
        dateOfBirthIv: encrypt("2000-01-01").iv,
        emergencyContactNameEncrypted: encrypted,
        emergencyContactNameIv: iv,
        emergencyContactPhoneEncrypted: null,
        emergencyContactPhoneIv: null,
        emergencyContactRelationEncrypted: null,
        emergencyContactRelationIv: null,
      }),
    };

    const service = new PlayerService(mockRepo as any);
    const result = await service.getPlayerById("p1", true);

    expect(result.emergencyContactName).toBe("Jane Doe");
    expect((result as any).emergencyContactNameEncrypted).toBeUndefined();
    expect((result as any).emergencyContactNameIv).toBeUndefined();
    expect(result.dateOfBirth).toBe("2000-01-01");
  });

  test("getPlayerById with includePrivate=false returns no emergency contact fields", async () => {
    const mockRepo = {
      findById: jest.fn().mockResolvedValue({
        id: "p1",
        playerName: "Test Player",
        dateOfBirthEncrypted: encrypt("1998-03-10").encrypted,
        dateOfBirthIv: encrypt("1998-03-10").iv,
      }),
    };

    const service = new PlayerService(mockRepo as any);
    const result = await service.getPlayerById("p1", false);

    expect((result as any).emergencyContactName).toBeUndefined();
    expect(result.dateOfBirth).toBe("1998-03-10");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest __test__/player/player.encryption.test.ts --no-coverage -t "decrypt on read"
```

Expected: 2 failures.

- [ ] **Step 3: Update player.service.ts**

Add import at top of `apps/api/src/player/player.service.ts`:

```typescript
import { decrypt } from "../lib/crypto";
```

Replace `getPlayerById` method:

```typescript
async getPlayerById(id: string, includePrivate = false) {
  const raw = await this.repo.findById(id, includePrivate);
  if (!raw) throw new AppError(404, "PLAYER_NOT_FOUND");

  const {
    dateOfBirthEncrypted, dateOfBirthIv,
    emergencyContactNameEncrypted, emergencyContactNameIv,
    emergencyContactPhoneEncrypted, emergencyContactPhoneIv,
    emergencyContactRelationEncrypted, emergencyContactRelationIv,
    ...rest
  } = raw as typeof raw & {
    dateOfBirthEncrypted?: string | null;
    dateOfBirthIv?: string | null;
    emergencyContactNameEncrypted?: string | null;
    emergencyContactNameIv?: string | null;
    emergencyContactPhoneEncrypted?: string | null;
    emergencyContactPhoneIv?: string | null;
    emergencyContactRelationEncrypted?: string | null;
    emergencyContactRelationIv?: string | null;
  };

  return {
    ...rest,
    dateOfBirth: dateOfBirthEncrypted && dateOfBirthIv
      ? decrypt(dateOfBirthEncrypted, dateOfBirthIv)
      : null,
    ...(includePrivate && {
      emergencyContactName: emergencyContactNameEncrypted && emergencyContactNameIv
        ? decrypt(emergencyContactNameEncrypted, emergencyContactNameIv)
        : null,
      emergencyContactPhone: emergencyContactPhoneEncrypted && emergencyContactPhoneIv
        ? decrypt(emergencyContactPhoneEncrypted, emergencyContactPhoneIv)
        : null,
      emergencyContactRelation: emergencyContactRelationEncrypted && emergencyContactRelationIv
        ? decrypt(emergencyContactRelationEncrypted, emergencyContactRelationIv)
        : null,
    }),
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && npx jest __test__/player/player.encryption.test.ts --no-coverage
```

Expected: all 8 passing.

- [ ] **Step 5: Run full test suite**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/player/player.service.ts apps/api/__test__/player/player.encryption.test.ts
git commit -m "feat(player): decrypt PII fields in service layer after findById"
```

---

## Task 5: Backfill Script

**Files:**
- Create: `apps/api/prisma/scripts/encrypt-pii.ts`

- [ ] **Step 1: Create the script directory and file**

```bash
mkdir -p apps/api/prisma/scripts
```

Create `apps/api/prisma/scripts/encrypt-pii.ts`:

```typescript
import { PrismaClient } from "../src/generated/client";
import { encrypt } from "../src/lib/crypto";
import { validatePhoneEncryptionKey } from "../src/lib/crypto";

async function main() {
  validatePhoneEncryptionKey();

  const prisma = new PrismaClient();

  const players = await prisma.player.findMany({
    select: {
      id: true,
      dateOfBirth: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true,
    },
  });

  console.log(`Backfilling ${players.length} players...`);

  let count = 0;
  for (const player of players) {
    const updates: Record<string, string> = {};

    if (player.dateOfBirth) {
      const { encrypted, iv } = encrypt(player.dateOfBirth.toISOString());
      updates["dateOfBirthEncrypted"] = encrypted;
      updates["dateOfBirthIv"] = iv;
    }
    if (player.emergencyContactName) {
      const { encrypted, iv } = encrypt(player.emergencyContactName);
      updates["emergencyContactNameEncrypted"] = encrypted;
      updates["emergencyContactNameIv"] = iv;
    }
    if (player.emergencyContactPhone) {
      const { encrypted, iv } = encrypt(player.emergencyContactPhone);
      updates["emergencyContactPhoneEncrypted"] = encrypted;
      updates["emergencyContactPhoneIv"] = iv;
    }
    if (player.emergencyContactRelation) {
      const { encrypted, iv } = encrypt(player.emergencyContactRelation);
      updates["emergencyContactRelationEncrypted"] = encrypted;
      updates["emergencyContactRelationIv"] = iv;
    }

    if (Object.keys(updates).length > 0) {
      await (prisma.player as any).update({ where: { id: player.id }, data: updates });
    }
    count++;
    if (count % 100 === 0) console.log(`  ${count}/${players.length}`);
  }

  console.log(`Done. Encrypted PII for ${count} players.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add script to package.json**

In `apps/api/package.json`, add to `"scripts"`:

```json
"script:encrypt-pii": "tsx prisma/scripts/encrypt-pii.ts"
```

- [ ] **Step 3: Verify script imports resolve (dry run)**

```bash
cd apps/api && npx tsx --noEmit prisma/scripts/encrypt-pii.ts 2>&1 | head -5
```

Expected: error about `PHONE_ENCRYPTION_KEY not set` (not an import error) — this confirms the module resolves correctly.

- [ ] **Step 4: Run the script against dev DB**

```bash
cd apps/api && PHONE_ENCRYPTION_KEY=$(grep PHONE_ENCRYPTION_KEY .env | cut -d= -f2) npx tsx prisma/scripts/encrypt-pii.ts
```

Expected: `Done. Encrypted PII for N players.`

- [ ] **Step 5: Spot-check encrypted data**

```bash
cd apps/api && npx prisma studio
```

Open Player table. Verify `dateOfBirthEncrypted` and `dateOfBirthIv` are populated for records that had `dateOfBirth`. Close Studio.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/scripts/encrypt-pii.ts apps/api/package.json
git commit -m "feat(scripts): add encrypt-pii backfill script for Player PII fields"
```

---

## Task 6: Update safeguard.repo.ts — Set suspendedAt

**Files:**
- Modify: `apps/api/src/safeguard/safeguard.repo.ts`
- Create: `apps/api/__test__/safeguard/safeguard.repo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/__test__/safeguard/safeguard.repo.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";

const mockPrisma = {
  user: {
    update: jest.fn(),
  },
  safeguardReport: {
    update: jest.fn(),
  },
};

jest.mock("../../src/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

import { SafeguardRepository } from "../../src/safeguard/safeguard.repo";

describe("SafeguardRepository", () => {
  let repo: SafeguardRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SafeguardRepository(mockPrisma as any);
  });

  test("suspendUser sets suspendedAt to current timestamp", async () => {
    const before = new Date();
    mockPrisma.user.update.mockResolvedValue({ id: 1, isSuspended: true, suspendedAt: new Date() } as any);

    await repo.suspendUser(1);

    const updateArgs = (mockPrisma.user.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.isSuspended).toBe(true);
    expect(updateArgs.data.suspendedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.suspendedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  test("unsuspendUser clears suspendedAt", async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 1, isSuspended: false, suspendedAt: null } as any);

    // Read the actual method name from safeguard.repo.ts first
    await repo.unsuspendUser(1);

    const updateArgs = (mockPrisma.user.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.isSuspended).toBe(false);
    expect(updateArgs.data.suspendedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Read safeguard.repo.ts to confirm method names**

```bash
cat apps/api/src/safeguard/safeguard.repo.ts
```

Confirm the unsuspend method name (may be `unsuspendUser` or `reinstateUser`). Update the test if needed.

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/api && npx jest __test__/safeguard/safeguard.repo.test.ts --no-coverage
```

Expected: failures about `suspendedAt` not being set.

- [ ] **Step 4: Update safeguard.repo.ts**

In `apps/api/src/safeguard/safeguard.repo.ts`, find `suspendUser()` and add `suspendedAt: new Date()`:

```typescript
suspendUser(userId: number) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { isSuspended: true, suspendedAt: new Date() },
  });
}
```

Find the unsuspend method and add `suspendedAt: null`:

```typescript
// e.g. unsuspendUser or reinstateUser — match actual name
unsuspendUser(userId: number) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { isSuspended: false, suspendedAt: null },
  });
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && npx jest __test__/safeguard/safeguard.repo.test.ts --no-coverage
```

Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/safeguard/safeguard.repo.ts apps/api/__test__/safeguard/safeguard.repo.test.ts
git commit -m "feat(safeguard): set suspendedAt timestamp when suspending users (RC15)"
```

---

## Task 7: Migration 2 — Drop Plaintext Columns

**⚠️ Only run after confirming backfill completed successfully (Task 5 Step 4–5).**

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Remove plaintext fields from schema**

In `schema.prisma`, find `model Player` and **remove** these lines:

```prisma
  emergencyContactName     String?
  emergencyContactPhone    String?
  emergencyContactRelation String?
  dateOfBirth              DateTime
```

- [ ] **Step 2: Generate drop migration**

```bash
cd apps/api && npx prisma migrate dev --name drop-plaintext-pii-columns
```

Expected: migration generated. Review the generated SQL in `prisma/migrations/` to confirm it contains `DROP COLUMN` for the 4 removed fields and nothing else destructive.

- [ ] **Step 3: Run full test suite to catch any remaining plaintext references**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -30
```

Fix any TypeScript compile errors from callers that still reference `player.emergencyContactName` (plaintext) or `player.dateOfBirth` (DateTime). These should now use the decrypted string returned by the service.

- [ ] **Step 4: Final commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(schema): drop plaintext PII columns — emergency contacts and dateOfBirth removed from Player"
```

---

## Self-Review

**Spec coverage:**
- RC1/RC14 (긴급연락처 암호화): ✅ Tasks 2–5
- RC4 (생년월일 암호화): ✅ Tasks 2–5 (handled alongside emergency contacts)
- RC3 (Injury.retainUntil 7년): ✅ Task 1 (schema field added; population logic is follow-up)
- RC15 (User.suspendedAt): ✅ Tasks 1 + 6
- Backfill script: ✅ Task 5
- Two-step migration: ✅ Tasks 1 + 7

**Placeholder scan:** No TBDs or vague steps found.

**Type consistency:** `encrypt()` returns `{ encrypted: string; iv: string }` (from `crypto.ts`). All tasks use `encrypted`/`iv` destructuring consistently. `decrypt(encrypted, iv)` returns `string` — service returns `string | null` to handle missing encrypted fields.
