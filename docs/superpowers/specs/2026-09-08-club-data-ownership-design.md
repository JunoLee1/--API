# Club Data Ownership 설계 (Phase 1)

**Goal:** `Player`·`Prospect` 에 `clubId` FK를 추가하고, 생성 시 자동 세팅, 조회 시 구단 불일치 → 404 를 반환하도록 한다.

**Issues:** 구단 소속 데이터 제약 조건 누락 (전 워크플로우 공통)

**Tech Stack:** Express + Prisma (BE only, Phase 1)

**Scope:** Player + Prospect만. Contract·Training·Match·OperatingExpense·BudgetPlan은 Phase 2 (별도 이슈).

---

## 1. DB 스키마

`Player`·`Prospect` 모델에 `clubId Int?` + Club relation 추가.

```prisma
model Player {
  // ... 기존 필드 ...
  clubId   Int?
  club     Club?   @relation("PlayerClub", fields: [clubId], references: [id])
}

model Prospect {
  // ... 기존 필드 ...
  clubId   Int?
  club     Club?   @relation("ProspectClub", fields: [clubId], references: [id])
}
```

### 마이그레이션

컬럼 추가 + 기존 행 backfill:

```sql
-- Player.clubId 추가 및 backfill (team → club 경유)
ALTER TABLE "public"."Player" ADD COLUMN "clubId" INTEGER;
ALTER TABLE "public"."Player"
  ADD CONSTRAINT "Player_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "public"."Player" p
SET "clubId" = t."clubId"
FROM "public"."Team" t
WHERE p."teamId" = t."id" AND t."clubId" IS NOT NULL;

-- Prospect.clubId 추가 및 backfill (single-club: 첫 번째 Club 사용)
ALTER TABLE "public"."Prospect" ADD COLUMN "clubId" INTEGER;
ALTER TABLE "public"."Prospect"
  ADD CONSTRAINT "Prospect_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "public"."Prospect"
SET "clubId" = (SELECT "id" FROM "public"."Club" ORDER BY "id" LIMIT 1)
WHERE "clubId" IS NULL;
```

### 불변식
- 신규 생성 Player/Prospect: `clubId = user.clubId` 자동 세팅
- `user.clubId` 가 없는 경우 (legacy 계정 등): clubId null 허용, 소속 검증 skip
- SUPER_ADMIN: clubId 검증 bypass (전체 구단 조회 가능)

---

## 2. `assertClubAccess` 확장

`apps/api/src/lib/permissions.ts` 의 `assertClubAccess` 를 확장:

```typescript
// 현재: ADMIN만 체크, 나머지 bypass
// 변경: user.clubId 가 있는 모든 역할에 적용, SUPER_ADMIN bypass

export function assertClubAccess(
  req: Request,
  targetClubId: number | null | undefined,
): void {
  const user = requireUser(req);
  if (user.role === 'SUPER_ADMIN') return;          // bypass
  if (!user.clubId) return;                          // clubId 없는 계정 bypass
  if (!targetClubId || user.clubId !== targetClubId) {
    throw new AppError(404, 'NOT_FOUND');            // 403 → 404 (존재 여부 비노출)
  }
}
```

**변경 포인트:** 기존 `403 FORBIDDEN` → `404 NOT_FOUND` (정보 노출 방지).

---

## 3. Player 서비스·레포

### `player.repo.ts`

`findById(id)` 에 `clubId` 필터 파라미터 추가:

```typescript
findById(id: string, clubId?: number | null) {
  return this.prisma.player.findFirst({
    where: {
      id,
      ...(clubId != null && { clubId }),
    },
    // 기존 select/include 유지
  });
}

findAll(filters: PlayerFilters & { clubId?: number | null }) {
  return this.prisma.player.findMany({
    where: {
      ...(filters.clubId != null && { clubId: filters.clubId }),
      // 기존 filters 유지
    },
  });
}
```

### `player.service.ts`

```typescript
// create(): clubId 자동 세팅
async createPlayer(dto: CreatePlayerDto, actor: Express.User) {
  // ... 기존 검증 ...
  return this.repo.create({
    ...dto,
    clubId: actor.clubId ?? null,
  });
}

// getById(): clubId 필터 전달 → null이면 404
async getPlayerById(id: string, actor: Express.User) {
  const player = await this.repo.findById(id, actor.clubId);
  if (!player) throw new AppError(404, 'PLAYER_NOT_FOUND');
  return player;
}

// list(): clubId 필터 전달
async listPlayers(filters: PlayerFilters, actor: Express.User) {
  return this.repo.findAll({ ...filters, clubId: actor.clubId });
}
```

---

## 4. Prospect 서비스·레포

Player 와 동일한 패턴:

### `prospect.repo.ts`

```typescript
findById(id: number, clubId?: number | null) {
  return this.prisma.prospect.findFirst({
    where: {
      id,
      ...(clubId != null && { clubId }),
    },
  });
}

findAll(filters: ProspectFilters & { clubId?: number | null }) {
  return this.prisma.prospect.findMany({
    where: {
      ...(filters.clubId != null && { clubId: filters.clubId }),
      // 기존 filters 유지
    },
  });
}
```

### `prospect.service.ts`

```typescript
async createProspect(dto: CreateProspectDto, actor: Express.User) {
  return this.repo.create({
    ...dto,
    clubId: actor.clubId ?? null,
  });
}

async getProspectById(id: number, actor: Express.User) {
  const prospect = await this.repo.findById(id, actor.clubId);
  if (!prospect) throw new AppError(404, 'PROSPECT_NOT_FOUND');
  return prospect;
}

async listProspects(filters: ProspectFilters, actor: Express.User) {
  return this.repo.findAll({ ...filters, clubId: actor.clubId });
}
```

---

## 5. 파일 변경 목록

| 파일 | 변경 |
|---|---|
| `apps/api/prisma/schema.prisma` | `Player.clubId Int?`, `Prospect.clubId Int?` + Club relation 추가 |
| `apps/api/prisma/migrations/…` | 신규 마이그레이션 (컬럼 추가 + backfill) |
| `apps/api/src/lib/permissions.ts` | `assertClubAccess` — 모든 역할에 clubId 체크, 에러 코드 404 |
| `apps/api/src/player/player.repo.ts` | `findById(id, clubId?)`, `findAll(filters + clubId?)` |
| `apps/api/src/player/player.service.ts` | `create()` clubId 세팅, `getById()` / `list()` actor 전달 |
| `apps/api/src/player/player.controller.ts` | 서비스 호출 시 `req.user` 전달 |
| `apps/api/src/prospect/prospect.repo.ts` | 동일 패턴 |
| `apps/api/src/prospect/prospect.service.ts` | 동일 패턴 |
| `apps/api/src/prospect/prospect.controller.ts` | 서비스 호출 시 `req.user` 전달 |

---

## 6. 테스트

- `assertClubAccess`: SUPER_ADMIN bypass, clubId 없는 user bypass, 불일치 → 404
- Player `getById`: 다른 clubId → 404, 일치 → 200
- Player `list`: clubId 필터 적용 확인
- Prospect `getById`: 동일
- Prospect `list`: 동일

---

## Phase 2 (별도 이슈)

- Contract, TrainingSession, Match, OperatingExpense, BudgetPlan 에 동일 패턴 적용
- 단, 이들은 clubId 직접 추가보다 team/season 경유 스코핑이 더 적합할 수 있음 — 별도 설계 필요
