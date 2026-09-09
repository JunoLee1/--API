# Match Lineup Guards — Implementation Design (Phase 1)

## Goal

Enforce formation slot count, starter count (exactly 11), bench limit (≤ 7), and ineligible player status checks in `saveLineup()` before a lineup is persisted.

## Architecture

All new guards live inside `match.lineup.service.ts` → `saveLineup()`. No new endpoints. No schema changes. The checks execute sequentially before the existing duplicate/formation validation block.

**Files to change:**
- `apps/api/src/match/match.lineup.service.ts` — add guards
- `apps/api/__test__/match/match.lineup.service.test.ts` — new tests (or create if absent)

---

## Validation Logic

### Q2 Extension: Ineligible Player Status

A player in the lineup must not have status `RELEASED` or `ON_LOAN`.

```typescript
const ineligibleIds = players
  .filter(p => p.status === "RELEASED" || p.status === "ON_LOAN")
  .map(p => p.id);
if (ineligibleIds.length > 0) {
  throw new AppError(400, "INELIGIBLE_PLAYER_IN_LINEUP");
}
```

The repo's `findManyByIds` (or equivalent) should select `{ id, status }`. If the method doesn't exist, add a lightweight helper that returns `{ id: string, status: string }[]`.

### Q3: Starter Count (exactly 11)

```typescript
const starters = dto.players.filter(p => p.isStarter);
if (starters.length !== 11) {
  throw new AppError(400, "INVALID_STARTER_COUNT");
}
```

### Q3: Bench Limit (≤ 7)

```typescript
const bench = dto.players.filter(p => !p.isStarter);
if (bench.length > 7) {
  throw new AppError(400, "BENCH_LIMIT_EXCEEDED");
}
```

### Q3: Formation Slot Match

The formation string (e.g., `"4-3-3"`) encodes how many field players are expected in each line. The slot count must match the formation (11 starters is already enforced above, so this check focuses on outfield line totals).

```typescript
function slotsForFormation(formation: string): number {
  return formation.split("-").reduce((sum, n) => sum + parseInt(n, 10), 0);
}
// expected = 10 outfield slots; GK is always slot 1
const expectedOutfield = slotsForFormation(dto.formation); // e.g. 4+3+3 = 10
const outfieldStarters = starters.filter(p => p.position !== "GOALKEEPER");
if (outfieldStarters.length !== expectedOutfield) {
  throw new AppError(400, "INVALID_FORMATION");
}
```

The existing `INVALID_FORMATION` error code is already thrown for unrecognised formation strings — reuse it for slot count mismatch. One error code, two triggers; keep it simple.

---

## Guard Execution Order

```
1. fetch player records for all playerIds in dto
2. ineligible status check → INELIGIBLE_PLAYER_IN_LINEUP
3. starters.length !== 11 → INVALID_STARTER_COUNT
4. bench.length > 7 → BENCH_LIMIT_EXCEEDED
5. formation slot mismatch → INVALID_FORMATION
6. [existing] duplicate player/slot checks
7. persist
```

Fetching players once at the top covers both the ineligibility check and any future stat lookups.

---

## Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `INELIGIBLE_PLAYER_IN_LINEUP` | 400 | Player status is RELEASED or ON_LOAN |
| `INVALID_STARTER_COUNT` | 400 | Starters ≠ 11 |
| `BENCH_LIMIT_EXCEEDED` | 400 | Bench > 7 |
| `INVALID_FORMATION` | 400 | Formation slot count ≠ outfield starters (reuse existing code) |

---

## Tests

Each guard gets an isolated unit test. Inject a mock repo that returns players with controlled `status` values and vary `dto.players` count/isStarter.

```typescript
// starter count guard
it("rejects lineup with 10 starters", async () => {
  const dto = buildLineupDto({ starters: 10, bench: 5 });
  await expect(service.saveLineup(matchId, dto)).rejects.toMatchObject({ code: "INVALID_STARTER_COUNT" });
});

// bench limit guard
it("rejects lineup with 8 bench players", async () => {
  const dto = buildLineupDto({ starters: 11, bench: 8 });
  await expect(service.saveLineup(matchId, dto)).rejects.toMatchObject({ code: "BENCH_LIMIT_EXCEEDED" });
});

// ineligible status
it("rejects lineup containing RELEASED player", async () => {
  mockPlayerRepo.findManyByIds.mockResolvedValue([
    { id: "p1", status: "RELEASED" }, ...activePlayers
  ]);
  await expect(service.saveLineup(matchId, dto)).rejects.toMatchObject({ code: "INELIGIBLE_PLAYER_IN_LINEUP" });
});
```

---

## Out of Scope

- Season membership check (player must belong to active season roster) — deferred; requires additional season-roster table lookup not yet modelled
- Q4 (minutes played / substitution events) — Phase 2
- Q_Opp / Q_Cross team stats — Phase 3
