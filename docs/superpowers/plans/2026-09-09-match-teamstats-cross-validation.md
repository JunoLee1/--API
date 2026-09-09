# Match TeamStats Cross-Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `oppPossession` and `oppGoals` to `TeamMatchStats`, validate opponent stats on input (Q_Opp), and enforce cross-team consistency: `possession + oppPossession = 100` and `oppGoals` matches the opponent's match scoreline (Q_Cross).

**Architecture:** Two nullable fields added to the single `TeamMatchStats` row per match. All validation lives in `MatchService.upsertTeamStats()`. No new endpoint; no sibling-row lookup — possession and goals cross-validation are done within the single upsert call using both `dto.possession` (always present) and `dto.oppPossession` (new optional). `oppGoals` is validated against `match.homeScore`/`awayScore`.

**Tech Stack:** TypeScript, Express, Prisma, Jest

---

## Files

| Action | Path |
|--------|------|
| Modify | `apps/api/prisma/schema.prisma` |
| Create | Migration (via `prisma migrate dev`) |
| Modify | `apps/api/src/match/dto/match.dto.ts` |
| Modify | `apps/api/src/match/match.repo.ts` |
| Modify | `apps/api/src/match/match.service.ts` |
| Modify | `apps/api/__test__/match/match.service.test.ts` |

---

## Background

`TeamMatchStats` currently has `oppShots Int?`, `oppShotsOnTarget Int?`, `oppCorners Int?`, `oppFouls Int?`, `oppYellowCards Int?`, `oppRedCards Int?`, `oppXG Float?`, `oppOffsides Int?` — but no `oppPossession` or `oppGoals`. There is exactly **one** `TeamMatchStats` row per match (`matchId @unique`). The row covers OUR team; `opp*` fields cover the opponent.

`upsertTeamStats()` in `match.service.ts` (lines 100-104) currently just calls `this.repo.upsertTeamStats()` with no validation.

Team constant: our team is `"FC Seoul"`. In `match.homeTeamName === "FC Seoul"` → we are home → opponent score is `match.awayScore`. In `match.awayTeamName === "FC Seoul"` → we are away → opponent score is `match.homeScore`.

---

## Task 1: Schema changes + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add `oppPossession` and `oppGoals` to `TeamMatchStats`**

In `apps/api/prisma/schema.prisma`, inside `model TeamMatchStats` (line ~1671), add after `oppOffsides Int?`:

```prisma
  oppPossession    Int?
  oppGoals         Int?
```

Final order of `opp*` fields should be:

```prisma
  oppShots         Int?
  oppShotsOnTarget Int?
  oppCorners       Int?
  oppFouls         Int?
  oppYellowCards   Int?
  oppRedCards      Int?
  oppXG            Float?
  oppOffsides      Int?
  oppPossession    Int?
  oppGoals         Int?
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_team_stats_opp_fields
```

Expected: migration created and applied.

- [ ] **Step 3: Regenerate client**

```bash
cd apps/api && npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add oppPossession + oppGoals to TeamMatchStats"
```

---

## Task 2: DTO extension + repo update

**Files:**
- Modify: `apps/api/src/match/dto/match.dto.ts`
- Modify: `apps/api/src/match/match.repo.ts`

- [ ] **Step 1: Extend `UpsertTeamStatsDto`**

In `apps/api/src/match/dto/match.dto.ts`, inside `export interface UpsertTeamStatsDto`, add after `oppOffsides`:

```typescript
  oppPossession?: number;
  oppGoals?: number;
```

- [ ] **Step 2: Update `upsertTeamStats` in repo**

In `apps/api/src/match/match.repo.ts`, inside `upsertTeamStats(matchId, dto)`, in both `create` and `update` blocks, add after the `oppOffsides` spread:

```typescript
// In create block:
...(dto.oppPossession !== undefined && { oppPossession: dto.oppPossession }),
...(dto.oppGoals      !== undefined && { oppGoals: dto.oppGoals }),

// In update block (same pattern):
...(dto.oppPossession !== undefined && { oppPossession: dto.oppPossession }),
...(dto.oppGoals      !== undefined && { oppGoals: dto.oppGoals }),
```

- [ ] **Step 3: Build TypeScript check**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/match/dto/match.dto.ts apps/api/src/match/match.repo.ts
git commit -m "feat: extend UpsertTeamStatsDto with oppPossession/oppGoals, wire up repo"
```

---

## Task 3: Q_Opp validations in service

**Files:**
- Modify: `apps/api/src/match/match.service.ts`
- Modify: `apps/api/__test__/match/match.service.test.ts`

- [ ] **Step 1: Write failing tests**

In `apps/api/__test__/match/match.service.test.ts`, add `upsertTeamStats` to mockRepo if not present, and add a new describe block:

```typescript
// Ensure mockRepo has upsertTeamStats (already present). Add:
const mockRepo = {
  // ... existing mocks ...
  upsertTeamStats: jest.fn().mockResolvedValue({ id: 1 }),
} as any;

describe("MatchService — upsertTeamStats Q_Opp 검증", () => {
  const baseMatch = {
    id: 1, homeTeamName: "FC Seoul", awayTeamName: "Jeonbuk",
    homeScore: 2, awayScore: 1, extraTime: false, hasSquad: true,
  };
  const baseDto = {
    possession: 55, yellowCards: 1, redCards: 0, corners: 5, offsides: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.findById.mockResolvedValue(baseMatch);
    mockRepo.upsertTeamStats.mockResolvedValue({ id: 1 });
  });

  test("oppShotsOnTarget > oppShots → 400 OPP_SHOTS_ON_TARGET_EXCEEDS_SHOTS", async () => {
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppShots: 3, oppShotsOnTarget: 5 })
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_SHOTS_ON_TARGET_EXCEEDS_SHOTS" });
  });

  test("oppShotsOnTarget === oppShots → 성공", async () => {
    await service.upsertTeamStats(1, { ...baseDto, oppShots: 5, oppShotsOnTarget: 5 });
    expect(mockRepo.upsertTeamStats).toHaveBeenCalled();
  });

  test("oppPossession < 0 → 400 OPP_POSSESSION_OUT_OF_RANGE", async () => {
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppPossession: -1 })
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_POSSESSION_OUT_OF_RANGE" });
  });

  test("oppPossession > 100 → 400 OPP_POSSESSION_OUT_OF_RANGE", async () => {
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppPossession: 101 })
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_POSSESSION_OUT_OF_RANGE" });
  });

  test("oppGoals < 0 → 400 OPP_GOALS_NEGATIVE", async () => {
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppGoals: -1 })
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_GOALS_NEGATIVE" });
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd apps/api && npx jest __test__/match/match.service.test.ts --no-coverage -t "Q_Opp" 2>&1 | tail -20
```

Expected: FAIL — `upsertTeamStats` has no guards yet.

- [ ] **Step 3: Add Q_Opp guards to `MatchService.upsertTeamStats`**

In `apps/api/src/match/match.service.ts`, replace the current `upsertTeamStats`:

```typescript
async upsertTeamStats(matchId: number, dto: UpsertTeamStatsDto) {
  const match = await this.repo.findById(matchId);
  if (!match) throw new AppError(404, "MATCH_NOT_FOUND");

  // Q_Opp: field-level validation
  if (dto.oppShotsOnTarget != null && dto.oppShots != null &&
      dto.oppShotsOnTarget > dto.oppShots) {
    throw new AppError(400, "OPP_SHOTS_ON_TARGET_EXCEEDS_SHOTS");
  }
  if (dto.oppPossession != null &&
      (dto.oppPossession < 0 || dto.oppPossession > 100)) {
    throw new AppError(400, "OPP_POSSESSION_OUT_OF_RANGE");
  }
  if (dto.oppGoals != null && dto.oppGoals < 0) {
    throw new AppError(400, "OPP_GOALS_NEGATIVE");
  }

  return this.repo.upsertTeamStats(matchId, dto);
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && npx jest __test__/match/match.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/match/match.service.ts apps/api/__test__/match/match.service.test.ts
git commit -m "feat: Q_Opp validation in upsertTeamStats (shots, possession, goals range checks)"
```

---

## Task 4: Q_Cross validations

**Files:**
- Modify: `apps/api/src/match/match.service.ts`
- Modify: `apps/api/__test__/match/match.service.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the existing `describe("MatchService — upsertTeamStats Q_Opp 검증", ...)` block (rename it to `Q_Opp + Q_Cross`):

```typescript
describe("MatchService — upsertTeamStats Q_Cross 검증", () => {
  const baseMatch = {
    id: 1, homeTeamName: "FC Seoul", awayTeamName: "Jeonbuk",
    homeScore: 2, awayScore: 1, extraTime: false, hasSquad: true,
  };
  const baseDto = {
    possession: 55, yellowCards: 1, redCards: 0, corners: 5, offsides: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.findById.mockResolvedValue(baseMatch);
    mockRepo.upsertTeamStats.mockResolvedValue({ id: 1 });
  });

  test("possession + oppPossession ≠ 100 → 400 POSSESSION_SUM_INVALID", async () => {
    // possession = 55 (from baseDto), oppPossession = 40 → sum = 95
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppPossession: 40 })
    ).rejects.toMatchObject({ statusCode: 400, message: "POSSESSION_SUM_INVALID" });
  });

  test("possession + oppPossession = 100 → 성공", async () => {
    await service.upsertTeamStats(1, { ...baseDto, oppPossession: 45 });
    expect(mockRepo.upsertTeamStats).toHaveBeenCalled();
  });

  test("oppPossession 미제공 시 합산 검증 스킵 → 성공", async () => {
    await service.upsertTeamStats(1, { ...baseDto });
    expect(mockRepo.upsertTeamStats).toHaveBeenCalled();
  });

  test("홈팀(FC Seoul): oppGoals ≠ awayScore → 400 OPP_GOALS_MISMATCH", async () => {
    // match: homeScore=2, awayScore=1; we are home; opp scored awayScore=1
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppGoals: 2 }) // should be 1
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_GOALS_MISMATCH" });
  });

  test("홈팀(FC Seoul): oppGoals === awayScore → 성공", async () => {
    await service.upsertTeamStats(1, { ...baseDto, oppGoals: 1 }); // awayScore=1 ✓
    expect(mockRepo.upsertTeamStats).toHaveBeenCalled();
  });

  test("원정팀(FC Seoul): oppGoals ≠ homeScore → 400 OPP_GOALS_MISMATCH", async () => {
    mockRepo.findById.mockResolvedValue({
      ...baseMatch, homeTeamName: "Jeonbuk", awayTeamName: "FC Seoul",
      homeScore: 3, awayScore: 0,
    });
    await expect(
      service.upsertTeamStats(1, { ...baseDto, oppGoals: 2 }) // should be homeScore=3
    ).rejects.toMatchObject({ statusCode: 400, message: "OPP_GOALS_MISMATCH" });
  });

  test("스코어 미입력 시 oppGoals 검증 스킵 → 성공", async () => {
    mockRepo.findById.mockResolvedValue({ ...baseMatch, homeScore: null, awayScore: null });
    await service.upsertTeamStats(1, { ...baseDto, oppGoals: 99 }); // skip check
    expect(mockRepo.upsertTeamStats).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd apps/api && npx jest __test__/match/match.service.test.ts --no-coverage -t "Q_Cross" 2>&1 | tail -20
```

Expected: FAIL.

- [ ] **Step 3: Add Q_Cross guards to `MatchService.upsertTeamStats`**

In `apps/api/src/match/match.service.ts`, inside `upsertTeamStats`, add Q_Cross guards AFTER the Q_Opp guards and BEFORE `return this.repo.upsertTeamStats(...)`:

```typescript
  // Q_Cross: possession sum = 100
  if (dto.oppPossession != null) {
    if (dto.possession + dto.oppPossession !== 100) {
      throw new AppError(400, "POSSESSION_SUM_INVALID");
    }
  }

  // Q_Cross: oppGoals matches match scoreline
  if (dto.oppGoals != null) {
    const isHome = (match as any).homeTeamName === "FC Seoul";
    const oppScore = isHome ? (match as any).awayScore : (match as any).homeScore;
    if (oppScore != null && dto.oppGoals !== oppScore) {
      throw new AppError(400, "OPP_GOALS_MISMATCH");
    }
  }

  return this.repo.upsertTeamStats(matchId, dto);
```

- [ ] **Step 4: Run all match service tests**

```bash
cd apps/api && npx jest __test__/match/match.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 5: Run full match test suite**

```bash
cd apps/api && npx jest __test__/match/ --no-coverage 2>&1 | tail -30
```

Expected: all pass.

- [ ] **Step 6: TypeScript check**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/match/match.service.ts apps/api/__test__/match/match.service.test.ts
git commit -m "feat: Q_Cross validation in upsertTeamStats (possession sum, oppGoals vs scoreline)"
```

---

## Implementation Dependency

**This plan requires Phase 2 (SubstitutionEvent) to be merged first** only if you need `match.extraTime` in scope. The schema migration for `extraTime` is in Phase 2. If implementing Phase 3 before Phase 2, the `extraTime` field won't exist in the `Match` model and `(match as any).extraTime` won't be populated. Phase 3 itself does not depend on `extraTime` — it's safe to implement Phase 3 independently; just ensure Phase 2's migration runs first before deploying to production.

## Q7 (대회별 집계 정합성)

Out of scope for this plan. Will be filed as a separate issue after Phase 3 is complete.
