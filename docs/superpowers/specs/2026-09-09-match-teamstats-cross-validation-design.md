# Match TeamStats Cross-Validation — Implementation Design (Phase 3)

## Goal

Add `oppPossession` and `oppGoals` to `TeamMatchStats`, validate opponent team stats on input (Q_Opp), and enforce cross-team consistency: possession sums to 100% and opponent goals match the match scoreline (Q_Cross).

## Architecture

- Two new nullable fields on `TeamMatchStats`: `oppPossession Int?`, `oppGoals Int?`
- `upsertTeamStats()` in `match.service.ts` gains Q_Opp guards (field-level) and Q_Cross guards (cross-team)
- No new endpoints

**Files to change:**
- `apps/api/prisma/schema.prisma` — add two fields
- `apps/api/src/match/dto/match.dto.ts` — add to `UpsertTeamStatsDto`
- `apps/api/src/match/match.service.ts` — add validations in `upsertTeamStats()`
- `apps/api/__test__/match/match.service.test.ts` — new tests

---

## Schema Changes

```prisma
model TeamMatchStats {
  // existing fields …
  oppPossession    Int?   // opponent possession percentage (0-100)
  oppGoals         Int?   // opponent goals (used for cross-validation with match score)
  // existing opp* fields remain unchanged
}
```

No new relations. Both fields are nullable for backward compatibility with existing records.

---

## DTO Extension

```typescript
export interface UpsertTeamStatsDto {
  // existing fields …
  oppPossession?: number;  // 0-100
  oppGoals?:      number;  // >= 0
}
```

---

## Validation in `upsertTeamStats()`

### Q_Opp: Opponent Stats Field-Level Guards

```typescript
// oppShotsOnTarget <= oppShots
if (dto.oppShotsOnTarget != null && dto.oppShots != null &&
    dto.oppShotsOnTarget > dto.oppShots) {
  throw new AppError(400, "OPP_SHOTS_ON_TARGET_EXCEEDS_SHOTS");
}

// oppPossession in [0, 100]
if (dto.oppPossession != null &&
    (dto.oppPossession < 0 || dto.oppPossession > 100)) {
  throw new AppError(400, "OPP_POSSESSION_OUT_OF_RANGE");
}

// oppGoals >= 0
if (dto.oppGoals != null && dto.oppGoals < 0) {
  throw new AppError(400, "OPP_GOALS_NEGATIVE");
}
```

### Q_Cross: Possession Sum

After persisting, read the sibling team's stats (the other team's stats row for the same match):

```typescript
// After save, fetch sibling stats
const siblingStats = await this.repo.findSiblingTeamStats(matchId, savedStats.team);
if (dto.oppPossession != null && siblingStats?.possession != null) {
  if (dto.oppPossession + siblingStats.possession !== 100) {
    throw new AppError(400, "POSSESSION_SUM_INVALID");
  }
}
if (siblingStats?.oppPossession != null && dto.possession != null) {
  if (dto.possession + siblingStats.oppPossession !== 100) {
    throw new AppError(400, "POSSESSION_SUM_INVALID");
  }
}
```

Validate only when both sides are known. If the sibling row doesn't exist yet, skip (partial input allowed).

### Q_Cross: Goals = Opponent Goals (Match Scoreline)

```typescript
if (dto.oppGoals != null) {
  const match = await this.repo.findById(matchId);
  // Determine which score is ours and which is the opponent's
  const isHome = savedStats.team === "FC Seoul" && match.homeTeam === "FC Seoul";
  const ourScore    = isHome ? match.homeScore : match.awayScore;
  const theirScore  = isHome ? match.awayScore : match.homeScore;

  if (ourScore != null && dto.oppGoals !== theirScore) {
    throw new AppError(400, "OPP_GOALS_MISMATCH");
  }
}
```

`match.homeScore` and `match.awayScore` are set via `updateMatch()`. If either is null (score not yet recorded), skip this check.

---

## `findSiblingTeamStats` Repo Method

```typescript
async findSiblingTeamStats(matchId: number, ourTeam: string): Promise<TeamMatchStats | null> {
  return this.prisma.teamMatchStats.findFirst({
    where: { matchId, team: { not: ourTeam } },
  });
}
```

---

## Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `OPP_SHOTS_ON_TARGET_EXCEEDS_SHOTS` | 400 | oppShotsOnTarget > oppShots |
| `OPP_POSSESSION_OUT_OF_RANGE` | 400 | oppPossession < 0 or > 100 |
| `OPP_GOALS_NEGATIVE` | 400 | oppGoals < 0 |
| `POSSESSION_SUM_INVALID` | 400 | possession + oppPossession ≠ 100 |
| `OPP_GOALS_MISMATCH` | 400 | oppGoals ≠ opponent's scoreline in match |

---

## Tests

```typescript
it("rejects oppShotsOnTarget > oppShots", async () => {
  await expect(
    service.upsertTeamStats(matchId, { oppShots: 5, oppShotsOnTarget: 6 })
  ).rejects.toMatchObject({ code: "OPP_SHOTS_ON_TARGET_EXCEEDS_SHOTS" });
});

it("rejects oppPossession out of range", async () => {
  await expect(
    service.upsertTeamStats(matchId, { oppPossession: 110 })
  ).rejects.toMatchObject({ code: "OPP_POSSESSION_OUT_OF_RANGE" });
});

it("rejects possession sum != 100 when sibling stats exist", async () => {
  mockRepo.findSiblingTeamStats.mockResolvedValue({ possession: 55 });
  await expect(
    service.upsertTeamStats(matchId, { oppPossession: 40 })
  ).rejects.toMatchObject({ code: "POSSESSION_SUM_INVALID" });
});

it("accepts possession sum == 100", async () => {
  mockRepo.findSiblingTeamStats.mockResolvedValue({ possession: 60 });
  await expect(
    service.upsertTeamStats(matchId, { oppPossession: 40 })
  ).resolves.toBeDefined();
});

it("rejects oppGoals mismatch with match score", async () => {
  mockRepo.findById.mockResolvedValue({ homeTeam: "FC Seoul", homeScore: 2, awayScore: 1 });
  await expect(
    service.upsertTeamStats(matchId, { oppGoals: 2 }) // should be 1
  ).rejects.toMatchObject({ code: "OPP_GOALS_MISMATCH" });
});
```

---

## Ordering Constraint

Phase 3 depends on Phase 2 (`matchDuration`, `extraTime`) being available. Implement Phase 2 before Phase 3 to ensure `match.extraTime` exists when referenced.

## Out of Scope

- Q7 (대회별 집계 정합성): deferred, will be filed as a separate issue after Phase 3 is complete
