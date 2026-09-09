# Club Data Ownership 설계 (Phase 2)

**Goal:** `TrainingSession`·`OperatingExpense` 에 `clubId` FK를 추가하고, Phase 1과 동일한 패턴으로 구단 소속 필터링을 적용한다.

**Issues:** Phase 1(Player·Prospect)에서 수립한 구단 소속 데이터 제약을 훈련·운영비 도메인으로 확장

**Tech Stack:** Express + Prisma (BE only)

**Scope:** TrainingSession + OperatingExpense. Contract·Match·BudgetPlan은 Phase 3 (별도 이슈).

---

## 1. DB 스키마

```prisma
model TrainingSession {
  // ... 기존 필드 ...
  clubId Int?
  club   Club? @relation("TrainingSessionClub", fields: [clubId], references: [id])
}

model OperatingExpense {
  // ... 기존 필드 ...
  clubId Int?
  club   Club? @relation("OperatingExpenseClub", fields: [clubId], references: [id])
}
```

### 마이그레이션

하나의 마이그레이션으로 두 모델 동시 처리:

```sql
-- TrainingSession
ALTER TABLE "public"."TrainingSession" ADD COLUMN "clubId" INTEGER;
ALTER TABLE "public"."TrainingSession"
  ADD CONSTRAINT "TrainingSession_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "public"."TrainingSession" ts
SET "clubId" = t."clubId"
FROM "public"."Team" t
WHERE ts."teamId" = t."id" AND t."clubId" IS NOT NULL;

-- OperatingExpense
ALTER TABLE "public"."OperatingExpense" ADD COLUMN "clubId" INTEGER;
ALTER TABLE "public"."OperatingExpense"
  ADD CONSTRAINT "OperatingExpense_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "public"."OperatingExpense" oe
SET "clubId" = u."clubId"
FROM "public"."User" u
WHERE oe."createdById" = u."id" AND u."clubId" IS NOT NULL;
```

### 불변식

- 신규 생성: `clubId = actor.clubId ?? null`
- `user.clubId` 없는 계정: bypass (null 허용)
- SUPER_ADMIN: 검증 bypass

---

## 2. 서비스·레포 패턴 (Phase 1 완전 미러)

### `training.repo.ts`

```typescript
findById(id: number, clubId?: number | null) {
  return this.prisma.trainingSession.findFirst({
    where: { id, ...(clubId != null && { clubId }) },
  });
}

findAll(filters: TrainingFilters & { clubId?: number | null }) {
  return this.prisma.trainingSession.findMany({
    where: { ...(filters.clubId != null && { clubId: filters.clubId }) },
  });
}
```

### `training.service.ts`

```typescript
async create(dto: CreateTrainingSessionDto, actor: Express.User) {
  return this.repo.create({ ...dto, clubId: actor.clubId ?? null });
}

async getById(id: number, actor: Express.User) {
  const session = await this.repo.findById(id, actor.clubId);
  if (!session) throw new AppError(404, 'TRAINING_SESSION_NOT_FOUND');
  return session;
}

async list(filters: TrainingFilters, actor: Express.User) {
  return this.repo.findAll({ ...filters, clubId: actor.clubId });
}
```

### `operating-expense.repo.ts` / `operating-expense.service.ts`

동일 패턴 적용.

---

## 3. 파일 변경 목록

| 파일 | 변경 |
|---|---|
| `apps/api/prisma/schema.prisma` | `TrainingSession.clubId Int?`, `OperatingExpense.clubId Int?` + Club relation |
| `apps/api/prisma/migrations/…` | 신규 마이그레이션 (backfill 포함) |
| `apps/api/src/training/training.repo.ts` | `findById(id, clubId?)`, `findAll(filters + clubId?)` |
| `apps/api/src/training/training.service.ts` | `create()` clubId 세팅, `getById()` / `list()` actor 전달 |
| `apps/api/src/training/training.controller.ts` | 서비스 호출 시 `req.user` 전달 |
| `apps/api/src/operating-expense/operating-expense.repo.ts` | 동일 패턴 |
| `apps/api/src/operating-expense/operating-expense.service.ts` | 동일 패턴 |
| `apps/api/src/operating-expense/operating-expense.controller.ts` | 서비스 호출 시 `req.user` 전달 |

---

## 4. 테스트

- TrainingSession `getById`: 다른 clubId → 404, 일치 → 200
- TrainingSession `list`: clubId 필터 적용 확인
- OperatingExpense 동일
