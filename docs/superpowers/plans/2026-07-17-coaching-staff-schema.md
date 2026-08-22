# Coaching Staff 스키마 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 코칭스태프 도메인 설계를 Prisma 스키마에 반영한다 — CoachAvailability, TrainingLoad, PlayerDevelopmentPlan 신규 모델과 TrainingResult.scoredById 필드 추가.

**Architecture:** 스키마 변경만 포함. API 레이어 없음. `prisma migrate dev`가 shadow DB 충돌로 동작하지 않으므로 `migrate diff → db execute → migrate resolve` 워크플로우 사용 (기존 선례 동일).

**Tech Stack:** Prisma ORM, PostgreSQL, TypeScript

---

## 파일 구조

- Modify: `apps/api/prisma/schema.prisma` — 모든 스키마 변경
- Create: `apps/api/__test__/coaching-staff/coaching-staff.schema.test.ts` — 신규 모델 smoke test

---

## Task 1: 새 Enum + NotificationType 값 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: `PlayerDevelopmentPlanStatus` enum 추가**

기존 enum 블록 하단(`BonusTeamScope` 아래)에 추가:

```prisma
enum PlayerDevelopmentPlanStatus {
  DRAFT
  ACTIVE
  REVIEWED
}
```

- [x] **Step 2: `NotificationType` enum에 2개 값 추가**

기존 `NotificationType` enum의 마지막 값(`COACH_TUTOR_SUPPORT_NEEDED`) 아래에 추가:

```prisma
  TRAINING_LOAD_ALERT
  PLAYER_DEVELOPMENT_PLAN_ACTIVATED
```

- [x] **Step 3: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

Expected: 에러 없이 포맷 완료

- [x] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add PlayerDevelopmentPlanStatus enum and coaching staff notification types"
```

---

## Task 2: TrainingResult.scoredById 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: `TrainingResult` 모델에 scoredById 필드와 relation 추가**

현재 `TrainingResult` 모델:
```prisma
model TrainingResult {
  id               Int              @id @default(autoincrement())
  attendance       AttendanceStatus
  feedback         String?
  performanceScore Int?
  sessionId        Int
  playerId         String

  session TrainingSession @relation(fields: [sessionId], references: [id])
  player  Player          @relation(fields: [playerId], references: [id])
}
```

변경 후:
```prisma
model TrainingResult {
  id               Int              @id @default(autoincrement())
  attendance       AttendanceStatus
  feedback         String?
  performanceScore Int?
  scoredById       Int?
  sessionId        Int
  playerId         String

  session  TrainingSession @relation(fields: [sessionId], references: [id])
  player   Player          @relation(fields: [playerId], references: [id])
  scoredBy User?           @relation("TrainingResultScorer", fields: [scoredById], references: [id])
}
```

- [x] **Step 2: `User` 모델에 back-relation 추가**

`User` 모델의 relation 목록 마지막에 추가 (tutorAssignments 아래):
```prisma
  scoredTrainingResults TrainingResult[] @relation("TrainingResultScorer")
```

- [x] **Step 3: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

Expected: 에러 없이 포맷 완료

- [x] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add scoredById to TrainingResult for evaluator tracking"
```

---

## Task 3: CoachAvailability 모델 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: `CoachAvailability` 모델 추가**

`CoachTutorAssignment` 모델 아래에 추가:

```prisma
model CoachAvailability {
  id          Int      @id @default(autoincrement())
  userId      Int
  startDate   DateTime
  endDate     DateTime
  reason      String?
  createdById Int
  createdAt   DateTime @default(now())

  user      User @relation("CoachAvailabilityUser", fields: [userId], references: [id])
  createdBy User @relation("CoachAvailabilityCreatedBy", fields: [createdById], references: [id])
}
```

- [x] **Step 2: `User` 모델에 back-relations 추가**

`User` 모델의 relation 목록 마지막에 추가 (scoredTrainingResults 아래):
```prisma
  coachAvailabilities   CoachAvailability[] @relation("CoachAvailabilityUser")
  createdAvailabilities CoachAvailability[] @relation("CoachAvailabilityCreatedBy")
```

- [x] **Step 3: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

Expected: 에러 없이 포맷 완료

- [x] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add CoachAvailability model"
```

---

## Task 4: TrainingLoad 모델 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: `TrainingLoad` 모델 추가**

`CoachAvailability` 모델 아래에 추가:

```prisma
model TrainingLoad {
  id        Int    @id @default(autoincrement())
  playerId  String
  sessionId Int
  rpe       Int
  load      Int?

  player  Player          @relation(fields: [playerId], references: [id])
  session TrainingSession @relation(fields: [sessionId], references: [id])

  @@unique([playerId, sessionId])
}
```

- [x] **Step 2: `Player` 모델에 back-relation 추가**

`Player` 모델의 relation 목록 마지막에 추가 (medicalExpenses 아래):
```prisma
  trainingLoads TrainingLoad[]
```

- [x] **Step 3: `TrainingSession` 모델에 back-relation 추가**

`TrainingSession` 모델의 relation 목록 마지막에 추가 (results 아래):
```prisma
  trainingLoads TrainingLoad[]
```

- [x] **Step 4: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

Expected: 에러 없이 포맷 완료

- [x] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add TrainingLoad model with RPE and load fields"
```

---

## Task 5: PlayerDevelopmentPlan 모델 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: `PlayerDevelopmentPlan` 모델 추가**

`TrainingLoad` 모델 아래에 추가:

```prisma
model PlayerDevelopmentPlan {
  id         Int                         @id @default(autoincrement())
  playerId   String
  coachId    Int
  seasonId   Int
  goals      String                      @db.Text
  notes      String?                     @db.Text
  status     PlayerDevelopmentPlanStatus @default(DRAFT)
  reviewedAt DateTime?
  createdAt  DateTime                    @default(now())
  updatedAt  DateTime                    @updatedAt

  player Player @relation(fields: [playerId], references: [id])
  coach  User   @relation("PDPCoach", fields: [coachId], references: [id])
  season Season @relation(fields: [seasonId], references: [id])

  @@unique([playerId, seasonId])
}
```

- [x] **Step 2: `Player` 모델에 back-relation 추가**

`Player` 모델의 relation 목록 (trainingLoads 아래)에 추가:
```prisma
  developmentPlans PlayerDevelopmentPlan[]
```

- [x] **Step 3: `User` 모델에 back-relation 추가**

`User` 모델의 relation 목록 마지막에 추가 (createdAvailabilities 아래):
```prisma
  developmentPlans PlayerDevelopmentPlan[] @relation("PDPCoach")
```

- [x] **Step 4: `Season` 모델에 back-relation 추가**

`Season` 모델의 relation 목록 (tacticalAnalyses 아래)에 추가:
```prisma
  developmentPlans PlayerDevelopmentPlan[]
```

- [x] **Step 5: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

Expected: 에러 없이 포맷 완료

- [x] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add PlayerDevelopmentPlan model"
```

---

## Task 6: Migration 생성 및 적용

**Files:**
- Auto-generated: `apps/api/prisma/migrations/20260717_coaching_staff_schema/`

> **참고:** 이 저장소는 `prisma migrate dev` shadow DB 충돌 이슈가 있습니다. 아래 3단계 워크플로우를 사용하세요.

- [x] **Step 1: Migration SQL 생성**

```bash
cd apps/api
mkdir -p prisma/migrations/20260717_coaching_staff_schema
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260717_coaching_staff_schema/migration.sql
```

Expected: `prisma/migrations/20260717_coaching_staff_schema/migration.sql` 생성. 파일 내용에 `CREATE TABLE "CoachAvailability"`, `CREATE TABLE "TrainingLoad"`, `CREATE TABLE "PlayerDevelopmentPlan"` 포함 확인.

- [x] **Step 2: DB에 적용**

```bash
cd apps/api
npx prisma db execute \
  --file prisma/migrations/20260717_coaching_staff_schema/migration.sql \
  --url "$(grep DATABASE_URL .env | cut -d '=' -f2-)"
```

Expected: 에러 없이 완료

- [x] **Step 3: 마이그레이션 이력 등록**

```bash
cd apps/api && npx prisma migrate resolve --applied 20260717_coaching_staff_schema
```

Expected: `Migration 20260717_coaching_staff_schema marked as applied`

- [x] **Step 4: Prisma Client 재생성**

```bash
cd apps/api && npx prisma generate
```

Expected: `src/generated/` 업데이트 완료

- [x] **Step 5: 기존 테스트 회귀 확인**

```bash
cd apps/api && npx jest --passWithNoTests 2>&1 | grep -E "Tests:|Test Suites:|FAIL"
```

Expected: 실패 수 기존 기준(15 failed) 이상 증가 없음

- [x] **Step 6: Commit**

```bash
git add apps/api/prisma/migrations/20260717_coaching_staff_schema/
git commit -m "feat(schema): apply coaching_staff_schema migration"
```

---

## Task 7: Smoke Tests

**Files:**
- Create: `apps/api/__test__/coaching-staff/coaching-staff.schema.test.ts`

- [x] **Step 1: 테스트 파일 작성**

```typescript
// apps/api/__test__/coaching-staff/coaching-staff.schema.test.ts
import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

let testPlayerId: string;
let testSessionId: number;
let testCoachUserId: number;
let testSeasonId: number;

beforeAll(async () => {
  // 테스트에 필요한 기존 레코드 조회
  const player = await prisma.player.findFirst();
  const session = await prisma.trainingSession.findFirst();
  const coach = await prisma.user.findFirst({ where: { coachingRole: 'HEAD_COACH' } });
  const season = await prisma.season.findFirst();

  if (!player || !session || !coach || !season) {
    throw new Error('테스트에 필요한 기존 데이터가 없습니다. seed를 먼저 실행하세요.');
  }

  testPlayerId = player.id;
  testSessionId = session.id;
  testCoachUserId = coach.id;
  testSeasonId = season.id;
});

afterAll(async () => {
  await prisma.playerDevelopmentPlan.deleteMany({ where: { coachId: testCoachUserId } });
  await prisma.trainingLoad.deleteMany({ where: { playerId: testPlayerId, sessionId: testSessionId } });
  await prisma.coachAvailability.deleteMany({ where: { userId: testCoachUserId } });
  await prisma.$disconnect();
});

describe('TrainingResult.scoredById', () => {
  it('scoredById 필드가 nullable로 존재한다', async () => {
    const result = await prisma.trainingResult.findFirst();
    // scoredById가 필드로 존재하는지 확인 (null이어도 OK)
    expect('scoredById' in (result ?? {})).toBe(true);
  });
});

describe('CoachAvailability', () => {
  it('날짜 범위로 가용성 블록을 생성하고 삭제할 수 있다', async () => {
    const avail = await prisma.coachAvailability.create({
      data: {
        userId: testCoachUserId,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-14'),
        reason: '전지훈련',
        createdById: testCoachUserId,
      },
    });
    expect(avail.id).toBeDefined();
    expect(avail.reason).toBe('전지훈련');
    await prisma.coachAvailability.delete({ where: { id: avail.id } });
  });
});

describe('TrainingLoad', () => {
  it('선수 × 세션당 1개 제약으로 TrainingLoad를 생성할 수 있다', async () => {
    const load = await prisma.trainingLoad.create({
      data: {
        playerId: testPlayerId,
        sessionId: testSessionId,
        rpe: 7,
        load: 450,
      },
    });
    expect(load.rpe).toBe(7);
    expect(load.load).toBe(450);
  });

  it('동일 선수 × 세션 중복 생성 시 오류가 발생한다', async () => {
    await expect(
      prisma.trainingLoad.create({
        data: {
          playerId: testPlayerId,
          sessionId: testSessionId,
          rpe: 5,
          load: 300,
        },
      })
    ).rejects.toThrow();
  });
});

describe('PlayerDevelopmentPlan', () => {
  it('DRAFT 상태로 PDP를 생성할 수 있다', async () => {
    const pdp = await prisma.playerDevelopmentPlan.create({
      data: {
        playerId: testPlayerId,
        coachId: testCoachUserId,
        seasonId: testSeasonId,
        goals: '전진패스 성공률 70% 이상 달성',
        status: 'DRAFT',
      },
    });
    expect(pdp.status).toBe('DRAFT');
  });

  it('같은 선수 × 시즌 중복 PDP 생성 시 오류가 발생한다', async () => {
    await expect(
      prisma.playerDevelopmentPlan.create({
        data: {
          playerId: testPlayerId,
          coachId: testCoachUserId,
          seasonId: testSeasonId,
          goals: '중복 PDP',
          status: 'DRAFT',
        },
      })
    ).rejects.toThrow();
  });

  it('DRAFT → ACTIVE로 상태를 전환할 수 있다', async () => {
    const pdp = await prisma.playerDevelopmentPlan.findFirst({
      where: { playerId: testPlayerId, seasonId: testSeasonId },
    });
    const updated = await prisma.playerDevelopmentPlan.update({
      where: { id: pdp!.id },
      data: { status: 'ACTIVE' },
    });
    expect(updated.status).toBe('ACTIVE');
  });
});
```

- [x] **Step 2: 테스트 실행**

```bash
cd apps/api && npx jest __test__/coaching-staff/coaching-staff.schema.test.ts --verbose
```

Expected: 6개 테스트 모두 PASS

- [x] **Step 3: Commit**

```bash
git add apps/api/__test__/coaching-staff/
git commit -m "test(schema): add coaching staff schema smoke tests"
```

---

## Self-Review

**Spec coverage:**
- ✅ `PlayerDevelopmentPlanStatus` enum (DRAFT | ACTIVE | REVIEWED)
- ✅ `NotificationType` 2개 추가 (TRAINING_LOAD_ALERT, PLAYER_DEVELOPMENT_PLAN_ACTIVATED)
- ✅ `TrainingResult.scoredById` — 평가자 추적
- ✅ `CoachAvailability` — 날짜 범위, userId + createdById, reason
- ✅ `TrainingLoad` — rpe(1-10) + load(nullable Int), @@unique([playerId, sessionId])
- ✅ `PlayerDevelopmentPlan` — goals/notes @db.Text, @@unique([playerId, seasonId]), DRAFT→ACTIVE→REVIEWED

**확인 필요:**
- Migration 이름(`20260717_coaching_staff_schema`)이 기존 `20260717_coach_team_schema`와 달라야 충돌 없음 ✅
- `TrainingResult` smoke test는 기존 레코드가 없으면 `scoredById in result` 체크가 `{}` 기준으로 fallback되므로, seed 데이터가 있는 환경 기준으로 작성됨
