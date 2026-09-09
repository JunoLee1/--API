# Match Substitution Event — Implementation Design (Phase 2)

## Goal

Introduce a `SubstitutionEvent` model that records who came on, who went off, and at which minute. Use this to validate `minutesPlayed` in `upsertPlayerStats()`: the sub-off player's minutes = substitution minute; the sub-on player's minutes = `matchDuration - substitution.minute`.

## Architecture

- New `SubstitutionEvent` Prisma model + migration
- `Match.extraTime Boolean?` field (determines whether `matchDuration` is 90 or 120)
- New `POST /matches/:matchId/substitutions` endpoint + `DELETE /matches/:matchId/substitutions/:id`
- `upsertPlayerStats()` in `match.service.ts` → validate `minutesPlayed` against substitution records

**Files to change:**
- `apps/api/prisma/schema.prisma`
- `apps/api/src/match/dto/match.dto.ts`
- `apps/api/src/match/match.repo.ts`
- `apps/api/src/match/match.service.ts`
- `apps/api/src/match/match.controller.ts` (or `match.lineup.controller.ts` — follow existing pattern)
- `apps/api/__test__/match/match.service.test.ts`

---

## Schema Changes

```prisma
model Match {
  // existing fields …
  extraTime Boolean? // null = unknown, false = 90 min, true = AET (120 min)
  substitutions SubstitutionEvent[]
}

model SubstitutionEvent {
  id           Int      @id @default(autoincrement())
  matchId      Int
  fromPlayerId String   // player who came OFF
  toPlayerId   String   // player who came ON
  minute       Int      // minute of substitution (1-120)
  createdAt    DateTime @default(now())

  match      Match  @relation(fields: [matchId], references: [id], onDelete: Cascade)
  fromPlayer Player @relation("SubOff", fields: [fromPlayerId], references: [id])
  toPlayer   Player @relation("SubOn",  fields: [toPlayerId],   references: [id])
}
```

Add named relation aliases to `Player` as well:
```prisma
model Player {
  // existing …
  substitutionsOff SubstitutionEvent[] @relation("SubOff")
  substitutionsOn  SubstitutionEvent[] @relation("SubOn")
}
```

---

## DTO

```typescript
export interface CreateSubstitutionDto {
  fromPlayerId: string;
  toPlayerId:   string;
  minute:       number; // 1-120
}
```

Validation rules:
- `minute` must be integer, `>= 1`, `<= 120`
- `fromPlayerId !== toPlayerId`
- Both players must appear in the match's player stats or lineup (they must have played)

---

## Endpoint

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/matches/:matchId/substitutions` | Record a substitution |
| `DELETE` | `/matches/:matchId/substitutions/:id` | Remove a substitution record |
| `GET` | `/matches/:matchId/substitutions` | List substitutions for a match |

GET is read-only convenience; the two mutating endpoints are the core work.

---

## `minutesPlayed` Validation in `upsertPlayerStats()`

When `dto.minutesPlayed` is provided:

```typescript
const matchDuration = match.extraTime ? 120 : 90;

// Check if this player was substituted off
const subOff = await this.repo.findSubstitutionByFromPlayer(matchId, dto.playerId);
if (subOff) {
  if (dto.minutesPlayed !== subOff.minute) {
    throw new AppError(400, "MINUTES_PLAYED_MISMATCH_SUB_OFF");
  }
}

// Check if this player was substituted on
const subOn = await this.repo.findSubstitutionByToPlayer(matchId, dto.playerId);
if (subOn) {
  const expected = matchDuration - subOn.minute;
  if (dto.minutesPlayed !== expected) {
    throw new AppError(400, "MINUTES_PLAYED_MISMATCH_SUB_ON");
  }
}

// If neither, player should have played full match (minutesPlayed == matchDuration)
if (!subOff && !subOn && dto.minutesPlayed !== matchDuration) {
  throw new AppError(400, "MINUTES_PLAYED_MISMATCH_FULL");
}
```

Only validate when `dto.minutesPlayed` is explicitly provided. If null/undefined, skip (backward-compatible).

---

## Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `SUBSTITUTION_SAME_PLAYER` | 400 | fromPlayerId === toPlayerId |
| `INVALID_SUBSTITUTION_MINUTE` | 400 | minute < 1 or > 120 |
| `MINUTES_PLAYED_MISMATCH_SUB_OFF` | 400 | minutesPlayed ≠ substitution.minute for sub-off player |
| `MINUTES_PLAYED_MISMATCH_SUB_ON` | 400 | minutesPlayed ≠ matchDuration - substitution.minute for sub-on player |
| `MINUTES_PLAYED_MISMATCH_FULL` | 400 | Non-substituted player has minutesPlayed ≠ matchDuration |

---

## Tests

```typescript
it("stores substitution and validates sub-off minutesPlayed", async () => {
  await service.createSubstitution(matchId, { fromPlayerId: "A", toPlayerId: "B", minute: 70 });
  // player A must have minutesPlayed = 70
  await expect(
    service.upsertPlayerStats(matchId, { playerId: "A", minutesPlayed: 65 })
  ).rejects.toMatchObject({ code: "MINUTES_PLAYED_MISMATCH_SUB_OFF" });
});

it("validates sub-on minutesPlayed (90 - subOn.minute)", async () => {
  await service.createSubstitution(matchId, { fromPlayerId: "A", toPlayerId: "B", minute: 70 });
  await expect(
    service.upsertPlayerStats(matchId, { playerId: "B", minutesPlayed: 15 })
  ).rejects.toMatchObject({ code: "MINUTES_PLAYED_MISMATCH_SUB_ON" }); // expected 20
});

it("accepts correct sub-on minutesPlayed", async () => {
  await service.createSubstitution(matchId, { fromPlayerId: "A", toPlayerId: "B", minute: 70 });
  await expect(
    service.upsertPlayerStats(matchId, { playerId: "B", minutesPlayed: 20 })
  ).resolves.toBeDefined();
});
```

---

## Out of Scope

- Multiple substitutions for the same player (e.g., re-entry in cup rules) — not supported in standard league play; add later if needed
- Q_Opp / Q_Cross team stats — Phase 3
