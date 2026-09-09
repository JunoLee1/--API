# Match Lineup Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ineligible-player-status, starter-count (=11), bench-limit (≤7), and formation-slot-count guards to `saveLineup()` in `match.lineup.service.ts`.

**Architecture:** Guards are pure service-layer logic. A single new repo method (`findPlayersByIds`) fetches `{ id, status }` for all slot players; the four guards execute sequentially after the existing formation-string check but before duplicate/injury checks. No schema changes.

**Tech Stack:** TypeScript, Express, Prisma (`PrismaClient.player`), Jest

---

## Files

| Action | Path |
|--------|------|
| Modify | `apps/api/src/match/match.lineup.repo.ts` |
| Modify | `apps/api/src/match/match.lineup.service.ts` |
| Modify | `apps/api/__test__/match/match.lineup.service.test.ts` |

---

## Background

`apps/api/src/match/match.lineup.service.ts` currently calls `this.repo.findActiveInjuredPlayerIds(playerIds)` but has no method that returns player `status`. The `PlayerStatus` enum (generated at `src/generated/enums.ts`) has values `ACTIVE | ON_LOAN | RELEASED | RETIRED | YOUTH`.

`apps/api/__test__/match/match.lineup.service.test.ts` line 15-21 defines `validDto` with only 2 slots — this will break the new starter-count guard. **`validDto` must be updated to 11 starters + 5 bench** as part of this plan.

---

## Task 1: Add `findPlayersByIds` to lineup repo

**Files:**
- Modify: `apps/api/src/match/match.lineup.repo.ts`
- Modify: `apps/api/__test__/match/match.lineup.service.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the top of the `describe("MatchLineupService - saveLineup", ...)` block (after the existing mockRepo definition). First add `findPlayersByIds` to mockRepo:

```typescript
// In match.lineup.service.test.ts, update mockRepo to add:
const mockRepo = {
  findByMatch: jest.fn<() => Promise<any>>(),
  saveLineup: jest.fn<() => Promise<any>>(),
  confirmLineup: jest.fn<() => Promise<any>>(),
  findSlotsWithUsers: jest.fn<() => Promise<any>>().mockResolvedValue([]),
  findMatchInfo: jest.fn<() => Promise<any>>().mockResolvedValue(null),
  findActiveInjuredPlayerIds: jest.fn<() => Promise<any>>().mockResolvedValue([]),
  findPlayersByIds: jest.fn<() => Promise<any>>().mockResolvedValue([]),
} as any;
```

Also replace `validDto` (lines 15-21) with a full 11+5 lineup:

```typescript
const makeSlots = () => [
  { playerId: "p1",  slotKey: "GK",   isStarter: true },
  { playerId: "p2",  slotKey: "LB",   isStarter: true },
  { playerId: "p3",  slotKey: "LCB",  isStarter: true },
  { playerId: "p4",  slotKey: "RCB",  isStarter: true },
  { playerId: "p5",  slotKey: "RB",   isStarter: true },
  { playerId: "p6",  slotKey: "LCM",  isStarter: true },
  { playerId: "p7",  slotKey: "CM",   isStarter: true },
  { playerId: "p8",  slotKey: "RCM",  isStarter: true },
  { playerId: "p9",  slotKey: "LW",   isStarter: true },
  { playerId: "p10", slotKey: "ST",   isStarter: true },
  { playerId: "p11", slotKey: "RW",   isStarter: true },
  { playerId: "p12", slotKey: "B1",   isStarter: false },
  { playerId: "p13", slotKey: "B2",   isStarter: false },
  { playerId: "p14", slotKey: "B3",   isStarter: false },
  { playerId: "p15", slotKey: "B4",   isStarter: false },
  { playerId: "p16", slotKey: "B5",   isStarter: false },
];

const validDto = {
  formation: "4-3-3",
  slots: makeSlots(),
};
```

`findPlayersByIds` mock returns `[]` by default (no players → no ineligible). The valid test should also set it to return ACTIVE players:

```typescript
test("유효한 dto로 저장 성공 시 repo.saveLineup 호출", async () => {
  mockRepo.findPlayersByIds.mockResolvedValue(makeSlots().map(s => ({ id: s.playerId, status: "ACTIVE" })));
  mockRepo.findActiveInjuredPlayerIds.mockResolvedValue([]);
  mockRepo.saveLineup.mockResolvedValue({ id: 1, matchId: 10, formation: "4-3-3", slots: [] });
  await service.saveLineup(10, validDto);
  expect(mockRepo.saveLineup).toHaveBeenCalledWith(10, validDto);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: `findPlayersByIds is not a function` or similar — the service doesn't call it yet.

- [ ] **Step 3: Add `findPlayersByIds` to `MatchLineupRepository`**

In `apps/api/src/match/match.lineup.repo.ts`, add after `findActiveInjuredPlayerIds`:

```typescript
findPlayersByIds(playerIds: string[]) {
  return this.prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, status: true },
  });
}
```

- [ ] **Step 4: Call `findPlayersByIds` in `saveLineup` (service) — minimal stub**

In `apps/api/src/match/match.lineup.service.ts`, inside `saveLineup`, add AFTER the formation-string check and BEFORE the playerIds/duplicate block:

```typescript
const players = await this.repo.findPlayersByIds(playerIds);
```

(At this point we fetch but don't use the result yet — test should pass for the happy path.)

- [ ] **Step 5: Run tests to verify pass**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/match/match.lineup.repo.ts apps/api/src/match/match.lineup.service.ts apps/api/__test__/match/match.lineup.service.test.ts
git commit -m "feat: add findPlayersByIds to MatchLineupRepository"
```

---

## Task 2: Ineligible player status guard

**Files:**
- Modify: `apps/api/src/match/match.lineup.service.ts`
- Modify: `apps/api/__test__/match/match.lineup.service.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside `describe("MatchLineupService - saveLineup", ...)`:

```typescript
test("RELEASED 선수 포함 시 400 INELIGIBLE_PLAYER_IN_LINEUP", async () => {
  mockRepo.findPlayersByIds.mockResolvedValue([
    { id: "p1", status: "RELEASED" },
    ...makeSlots().slice(1).map(s => ({ id: s.playerId, status: "ACTIVE" })),
  ]);
  await expect(service.saveLineup(10, validDto))
    .rejects.toMatchObject({ statusCode: 400, message: "INELIGIBLE_PLAYER_IN_LINEUP" });
  expect(mockRepo.saveLineup).not.toHaveBeenCalled();
});

test("ON_LOAN 선수 포함 시 400 INELIGIBLE_PLAYER_IN_LINEUP", async () => {
  mockRepo.findPlayersByIds.mockResolvedValue([
    { id: "p2", status: "ON_LOAN" },
    ...makeSlots().filter(s => s.playerId !== "p2").map(s => ({ id: s.playerId, status: "ACTIVE" })),
  ]);
  await expect(service.saveLineup(10, validDto))
    .rejects.toMatchObject({ statusCode: 400, message: "INELIGIBLE_PLAYER_IN_LINEUP" });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage -t "INELIGIBLE" 2>&1 | tail -20
```

Expected: FAIL (guard not implemented yet).

- [ ] **Step 3: Add guard to `saveLineup`**

In `apps/api/src/match/match.lineup.service.ts`, after the `findPlayersByIds` call:

```typescript
const players = await this.repo.findPlayersByIds(playerIds);
const ineligible = players.filter(p => p.status === "RELEASED" || p.status === "ON_LOAN");
if (ineligible.length > 0) {
  throw new AppError(400, "INELIGIBLE_PLAYER_IN_LINEUP");
}
```

- [ ] **Step 4: Run to verify pass**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/match/match.lineup.service.ts apps/api/__test__/match/match.lineup.service.test.ts
git commit -m "feat: block RELEASED/ON_LOAN players in lineup (INELIGIBLE_PLAYER_IN_LINEUP)"
```

---

## Task 3: Starter count guard (exactly 11)

**Files:**
- Modify: `apps/api/src/match/match.lineup.service.ts`
- Modify: `apps/api/__test__/match/match.lineup.service.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
test("선발 10명이면 400 INVALID_STARTER_COUNT", async () => {
  const dto = {
    formation: "4-3-3",
    slots: makeSlots().map((s, i) =>
      i === 10 ? { ...s, isStarter: false } : s  // move p11 to bench → 10 starters, 6 bench
    ),
  };
  mockRepo.findPlayersByIds.mockResolvedValue(
    dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
  );
  await expect(service.saveLineup(10, dto))
    .rejects.toMatchObject({ statusCode: 400, message: "INVALID_STARTER_COUNT" });
});

test("선발 12명이면 400 INVALID_STARTER_COUNT", async () => {
  const dto = {
    formation: "4-3-3",
    slots: [
      ...makeSlots().filter(s => s.isStarter),   // 11 starters
      { playerId: "p17", slotKey: "ST2", isStarter: true },  // 12th starter
      ...makeSlots().filter(s => !s.isStarter),  // 5 bench
    ],
  };
  mockRepo.findPlayersByIds.mockResolvedValue(
    dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
  );
  await expect(service.saveLineup(10, dto))
    .rejects.toMatchObject({ statusCode: 400, message: "INVALID_STARTER_COUNT" });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage -t "INVALID_STARTER_COUNT" 2>&1 | tail -20
```

- [ ] **Step 3: Add guard**

In `apps/api/src/match/match.lineup.service.ts`, after the ineligible guard:

```typescript
const starters = dto.slots.filter(s => s.isStarter);
const bench = dto.slots.filter(s => !s.isStarter);
if (starters.length !== 11) {
  throw new AppError(400, "INVALID_STARTER_COUNT");
}
```

- [ ] **Step 4: Run to verify pass**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/match/match.lineup.service.ts apps/api/__test__/match/match.lineup.service.test.ts
git commit -m "feat: enforce exactly 11 starters in lineup (INVALID_STARTER_COUNT)"
```

---

## Task 4: Bench limit guard (≤ 7)

**Files:**
- Modify: `apps/api/src/match/match.lineup.service.ts`
- Modify: `apps/api/__test__/match/match.lineup.service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
test("벤치 8명이면 400 BENCH_LIMIT_EXCEEDED", async () => {
  const dto = {
    formation: "4-3-3",
    slots: [
      ...makeSlots().filter(s => s.isStarter),  // 11 starters
      { playerId: "p12", slotKey: "B1", isStarter: false },
      { playerId: "p13", slotKey: "B2", isStarter: false },
      { playerId: "p14", slotKey: "B3", isStarter: false },
      { playerId: "p15", slotKey: "B4", isStarter: false },
      { playerId: "p16", slotKey: "B5", isStarter: false },
      { playerId: "p17", slotKey: "B6", isStarter: false },
      { playerId: "p18", slotKey: "B7", isStarter: false },
      { playerId: "p19", slotKey: "B8", isStarter: false },  // 8 bench
    ],
  };
  mockRepo.findPlayersByIds.mockResolvedValue(
    dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
  );
  await expect(service.saveLineup(10, dto))
    .rejects.toMatchObject({ statusCode: 400, message: "BENCH_LIMIT_EXCEEDED" });
});

test("벤치 7명이면 저장 성공", async () => {
  const dto = {
    formation: "4-3-3",
    slots: [
      ...makeSlots().filter(s => s.isStarter),  // 11 starters
      { playerId: "p12", slotKey: "B1", isStarter: false },
      { playerId: "p13", slotKey: "B2", isStarter: false },
      { playerId: "p14", slotKey: "B3", isStarter: false },
      { playerId: "p15", slotKey: "B4", isStarter: false },
      { playerId: "p16", slotKey: "B5", isStarter: false },
      { playerId: "p17", slotKey: "B6", isStarter: false },
      { playerId: "p18", slotKey: "B7", isStarter: false },  // exactly 7
    ],
  };
  mockRepo.findPlayersByIds.mockResolvedValue(
    dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
  );
  mockRepo.findActiveInjuredPlayerIds.mockResolvedValue([]);
  mockRepo.saveLineup.mockResolvedValue({ id: 1, matchId: 10, formation: "4-3-3", slots: [] });
  await service.saveLineup(10, dto);
  expect(mockRepo.saveLineup).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage -t "BENCH_LIMIT" 2>&1 | tail -20
```

- [ ] **Step 3: Add guard**

In `apps/api/src/match/match.lineup.service.ts`, after the `INVALID_STARTER_COUNT` guard:

```typescript
if (bench.length > 7) {
  throw new AppError(400, "BENCH_LIMIT_EXCEEDED");
}
```

- [ ] **Step 4: Run to verify pass**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/match/match.lineup.service.ts apps/api/__test__/match/match.lineup.service.test.ts
git commit -m "feat: enforce bench ≤ 7 in lineup (BENCH_LIMIT_EXCEEDED)"
```

---

## Task 5: Formation slot count guard

**Files:**
- Modify: `apps/api/src/match/match.lineup.service.ts`
- Modify: `apps/api/__test__/match/match.lineup.service.test.ts`

- [ ] **Step 1: Write the failing test**

The guard checks: outfield starters (slotKey !== "GK") count must equal formation's numeric sum. For "4-3-3" the sum is 10; for "3-5-2" it's 10; for "4-4-2" it's 10 — all supported formations sum to 10. The guard catches cases where a second GK is listed as starter (slotKey = "GK2") causing mismatch.

```typescript
test("GK가 2명 선발이면 400 INVALID_FORMATION (슬롯 불일치)", async () => {
  const slotsWithTwoGK = makeSlots().map(s =>
    s.slotKey === "RW" ? { ...s, slotKey: "GK2" } : s  // replace RW with 2nd GK
  );
  // Still 11 starters but 9 outfield starters (formation expects 10)
  const dto = { formation: "4-3-3", slots: slotsWithTwoGK };
  mockRepo.findPlayersByIds.mockResolvedValue(
    dto.slots.map(s => ({ id: s.playerId, status: "ACTIVE" }))
  );
  await expect(service.saveLineup(10, dto))
    .rejects.toMatchObject({ statusCode: 400, message: "INVALID_FORMATION" });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage -t "GK가 2명" 2>&1 | tail -20
```

- [ ] **Step 3: Add guard**

Add helper function `slotsForFormation` at the top of `match.lineup.service.ts` (before the class):

```typescript
function slotsForFormation(formation: string): number {
  return formation.split("-").reduce((sum, n) => sum + parseInt(n, 10), 0);
}
```

Then in `saveLineup`, after the bench guard:

```typescript
const outfieldStarters = starters.filter(s => s.slotKey !== "GK");
if (outfieldStarters.length !== slotsForFormation(dto.formation)) {
  throw new AppError(400, "INVALID_FORMATION");
}
```

- [ ] **Step 4: Run full test suite**

```bash
cd apps/api && npx jest __test__/match/match.lineup.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Run full match test suite to check no regressions**

```bash
cd apps/api && npx jest __test__/match/ --no-coverage 2>&1 | tail -30
```

Expected: all match tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/match/match.lineup.service.ts apps/api/__test__/match/match.lineup.service.test.ts
git commit -m "feat: enforce formation slot count match in lineup (INVALID_FORMATION)"
```

---

## Final state of `saveLineup` guard sequence

```typescript
async saveLineup(matchId: number, dto: SaveLineupDto) {
  // 1. formation string check (existing)
  if (!SUPPORTED_FORMATIONS.includes(dto.formation)) {
    throw new AppError(400, "INVALID_FORMATION");
  }
  const playerIds = dto.slots.map((s) => s.playerId);

  // 2. fetch player status (new)
  const players = await this.repo.findPlayersByIds(playerIds);
  const ineligible = players.filter(p => p.status === "RELEASED" || p.status === "ON_LOAN");
  if (ineligible.length > 0) throw new AppError(400, "INELIGIBLE_PLAYER_IN_LINEUP");

  // 3. starter count (new)
  const starters = dto.slots.filter(s => s.isStarter);
  const bench = dto.slots.filter(s => !s.isStarter);
  if (starters.length !== 11) throw new AppError(400, "INVALID_STARTER_COUNT");

  // 4. bench limit (new)
  if (bench.length > 7) throw new AppError(400, "BENCH_LIMIT_EXCEEDED");

  // 5. formation slot count (new)
  const outfieldStarters = starters.filter(s => s.slotKey !== "GK");
  if (outfieldStarters.length !== slotsForFormation(dto.formation)) {
    throw new AppError(400, "INVALID_FORMATION");
  }

  // 6-7. duplicate checks (existing)
  if (new Set(playerIds).size !== playerIds.length) throw new AppError(409, "DUPLICATE_PLAYER");
  const slotKeys = dto.slots.map((s) => s.slotKey);
  if (new Set(slotKeys).size !== slotKeys.length) throw new AppError(409, "DUPLICATE_SLOT");

  // 8. injury check (existing)
  const injured = await this.repo.findActiveInjuredPlayerIds(playerIds);
  if (injured.length > 0) throw new AppError(409, "INJURED_PLAYER_IN_LINEUP");

  return this.repo.saveLineup(matchId, dto);
}
```
