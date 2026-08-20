# Coach & Team 도메인 스키마 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Prisma 스키마에 Coach 도메인(Coach, CoachHiringRound, CoachTutorAssignment, 역할별 평가 모델)과 Team 엔티티를 추가하고, 기존 엔티티(Player, User, TrainingSession, Match, BonusTrigger)에 teamId 및 관련 필드를 추가한다.

**Architecture:** 스키마 변경 → `prisma migrate dev` → 기존 데이터 backfill(FIRST_TEAM seed). Coach는 Prospect 패턴을 따라 User와 분리된 독립 엔티티로 설계. Team은 ADMIN이 생성하는 유연한 엔티티로 하드코딩 enum 대신 DB 레코드로 관리.

**Tech Stack:** Prisma ORM, PostgreSQL, TypeScript

---

## 파일 구조

- Modify: `apps/api/prisma/schema.prisma` — 모든 스키마 변경
- Modify: `apps/api/prisma/seed.ts` — FIRST_TEAM 초기 레코드 seed
- Create: `apps/api/__test__/coach/coach.schema.test.ts` — Coach 모델 smoke test
- Create: `apps/api/__test__/team/team.schema.test.ts` — Team 모델 smoke test

---

## Task 1: 새 Enum 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: schema.prisma Enums 블록 하단에 추가**

```prisma
enum TeamType {
  FIRST_TEAM
  YOUTH
}

enum CoachStatus {
  CANDIDATE
  SHORTLISTED
  APPROVAL_PENDING
  CONTRACTED
  RETIRED
  ARCHIVED
}

enum ShortlistSource {
  SYSTEM
  MANUAL
}

enum TutorType {
  INTERNAL
  EXTERNAL
}

enum HiringRoundStatus {
  OPEN
  CLOSED
  CANCELLED
}

enum LanguageProficiency {
  A1
  A2
  B1
  B2
  C1
  C2
}

enum BonusTeamScope {
  ALL
  FIRST_TEAM_ONLY
}
```

- [x] **Step 2: `NotificationType` enum에 Coach 알림 타입 추가**

기존 `NotificationType` enum에 다음 값 추가:
```prisma
  COACH_AUTO_SHORTLISTED        // fitScore ≥ 임계값 달성 → GM
  COACH_MANUALLY_SHORTLISTED    // GM이 수동 SHORTLISTED → TD
  COACH_APPROVAL_REQUESTED      // TD가 APPROVAL_PENDING → GM
  COACH_CONTRACTED              // GM 최종 승인 → ADMIN (계정 생성 안내)
  COACH_HEAD_CONTRACTED         // HEAD_COACH CONTRACTED → GM, TD (Master Policy 갱신)
  COACH_ARCHIVED                // 탈락 처리 → 해당 라운드 GM
  COACH_TUTOR_SUPPORT_NEEDED    // 언어/전술 이행률 낮음 → GM, TD
```

- [x] **Step 3: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```
Expected: 에러 없이 포맷 완료

- [x] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add Coach/Team domain enums and notification types"
```

---

## Task 2: Team 모델 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: Team 모델 추가 (Models 블록)**

```prisma
model Team {
  id               Int      @id @default(autoincrement())
  name             String
  type             TeamType
  ageGroup         String?
  isActive         Boolean  @default(true)
  trackStats       Boolean  @default(true)
  requiresContract Boolean  @default(true)
  createdAt        DateTime @default(now())

  players          Player[]
  coachingStaff    User[]
  trainingSessions TrainingSession[]
  matches          Match[]
  coaches          Coach[]
}
```

- [x] **Step 2: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add Team model"
```

---

## Task 3: 기존 엔티티에 teamId 추가 (Player, User)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: Player 모델에 teamId 추가**

`Player` 모델의 필드 목록에 추가:
```prisma
  teamId Int?
```

`Player` 모델의 relation 목록에 추가:
```prisma
  team Team? @relation(fields: [teamId], references: [id])
```

- [x] **Step 2: User 모델에 teamId 추가**

`User` 모델의 필드 목록에 추가 (COACHING_STAFF용):
```prisma
  teamId Int?
```

`User` 모델의 relation 목록에 추가:
```prisma
  team Team? @relation(fields: [teamId], references: [id])
```

- [x] **Step 3: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

- [x] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add teamId to Player and User"
```

---

## Task 4: 기존 엔티티에 teamId 추가 (TrainingSession, Match)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: TrainingSession에 teamId 추가**

`TrainingSession` 모델에 추가:
```prisma
  teamId Int?
  team   Team? @relation(fields: [teamId], references: [id])
```

- [x] **Step 2: Match에 teamId 추가**

`Match` 모델에 추가:
```prisma
  teamId Int?
  team   Team? @relation(fields: [teamId], references: [id])
```

- [x] **Step 3: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

- [x] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add teamId to TrainingSession and Match"
```

---

## Task 5: BonusTrigger.teamScope 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: BonusTrigger 모델에 teamScope 추가**

`BonusTrigger` 모델에 추가:
```prisma
  teamScope BonusTeamScope @default(ALL)
```

- [x] **Step 2: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add teamScope to BonusTrigger"
```

---

## Task 6: CoachHiringRound 모델 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: CoachHiringRound 모델 추가**

```prisma
model CoachHiringRound {
  id                  Int               @id @default(autoincrement())
  targetRole          CoachingRole
  fitScoreThreshold   Int               @default(70)
  status              HiringRoundStatus @default(OPEN)
  deadline            DateTime?
  budget              Int?
  notes               String?
  result              String?
  createdById         Int
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  createdBy User    @relation("HiringRoundCreatedBy", fields: [createdById], references: [id])
  coaches   Coach[]
}
```

`User` 모델에 relation 추가:
```prisma
  createdHiringRounds CoachHiringRound[] @relation("HiringRoundCreatedBy")
```

- [x] **Step 2: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add CoachHiringRound model"
```

---

## Task 7: Coach 모델 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: Coach 모델 추가**

```prisma
model Coach {
  id               Int             @id @default(autoincrement())
  name             String
  nationality      String?
  coachingRole     CoachingRole
  status           CoachStatus     @default(CANDIDATE)
  shortlistSource  ShortlistSource?
  notes            String?
  isDeleted        Boolean         @default(false)
  packageLeadId    Int?
  hiringRoundId    Int?
  userId           Int?            @unique
  teamId           Int?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  packageLead      Coach?              @relation("CoachPackage", fields: [packageLeadId], references: [id])
  packageMembers   Coach[]             @relation("CoachPackage")
  hiringRound      CoachHiringRound?   @relation(fields: [hiringRoundId], references: [id])
  user             User?               @relation("CoachUser", fields: [userId], references: [id])
  team             Team?               @relation(fields: [teamId], references: [id])
  tutorAssignments CoachTutorAssignment[]

  headCoachEval       HeadCoachEvaluation?
  defensiveCoachEval  DefensiveCoachEvaluation?
  attackingCoachEval  AttackingCoachEvaluation?
  goalkeeperCoachEval GoalkeeperCoachEvaluation?
  tier2Eval           CoachTier2Evaluation?
}
```

`User` 모델에 relation 추가:
```prisma
  coachProfile Coach? @relation("CoachUser")
```

- [x] **Step 2: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add Coach model"
```

---

## Task 8: Coach 평가 모델 추가 (Tier 1 + Tier 2)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: Tier 1 평가 모델 4개 추가**

```prisma
// HEAD_COACH 평가 (구단 철학 부합도 + 팀 전술 지표)
model HeadCoachEvaluation {
  id                      Int    @id @default(autoincrement())
  coachId                 Int    @unique
  possession              Float?
  pressingIntensity       Float?
  progressivePassAccuracy Float?
  teamActivity            Float?
  philosophyFitScore      Float?
  dataSource              String?
  evaluatedAt             DateTime?

  coach Coach @relation(fields: [coachId], references: [id])
}

// DEFENSIVE_COACH 평가
model DefensiveCoachEvaluation {
  id                Int    @id @default(autoincrement())
  coachId           Int    @unique
  tackleSuccessRate Float?
  clearances        Float?
  blocks            Float?
  defensiveErrors   Float?
  ballRecovery      Float?
  pressingIntensity Float?
  dataSource        String?
  evaluatedAt       DateTime?

  coach Coach @relation(fields: [coachId], references: [id])
}

// ATTACKING_COACH 평가
model AttackingCoachEvaluation {
  id                      Int    @id @default(autoincrement())
  coachId                 Int    @unique
  xG                      Float?
  xA                      Float?
  chanceCreation          Float?
  dribbleSuccessRate      Float?
  progressivePassAccuracy Float?
  shotConversionRate      Float?
  goalInvolvement         Float?
  dataSource              String?
  evaluatedAt             DateTime?

  coach Coach @relation(fields: [coachId], references: [id])
}

// GOALKEEPER_COACH 평가
model GoalkeeperCoachEvaluation {
  id                   Int    @id @default(autoincrement())
  coachId              Int    @unique
  psxG                 Float?
  xGConcededDiff       Float?
  buildupPassAccuracy  Float?
  dataSource           String?
  evaluatedAt          DateTime?

  coach Coach @relation(fields: [coachId], references: [id])
}

// Tier 2 공통 평가 (ASSISTANT, PHYSICAL, SET_PIECE)
model CoachTier2Evaluation {
  id          Int    @id @default(autoincrement())
  coachId     Int    @unique
  fitScore    Int?
  notes       String?
  evaluatedAt DateTime?

  coach Coach @relation(fields: [coachId], references: [id])
}
```

- [x] **Step 2: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add Coach evaluation models (Tier 1 x4 + Tier 2)"
```

---

## Task 9: CoachTutorAssignment 모델 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: CoachTutorAssignment 모델 추가**

```prisma
model CoachTutorAssignment {
  id                    Int                  @id @default(autoincrement())
  coachId               Int
  type                  TutorType
  internalTutorId       Int?
  externalName          String?
  externalContact       String?
  sessionCount          Int                  @default(0)
  languageProficiency   LanguageProficiency?
  tacticalImplementationRate Float?
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  coach          Coach @relation(fields: [coachId], references: [id])
  internalTutor  User? @relation("TutorAssignments", fields: [internalTutorId], references: [id])
}
```

`User` 모델에 relation 추가:
```prisma
  tutorAssignments CoachTutorAssignment[] @relation("TutorAssignments")
```

- [x] **Step 2: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add CoachTutorAssignment model"
```

---

## Task 10: Migration 생성 및 적용

**Files:**
- Auto-generated: `apps/api/prisma/migrations/YYYYMMDD_coach_team_schema/`

- [x] **Step 1: Migration 생성**

```bash
cd apps/api && npx prisma migrate dev --name coach_team_schema
```

Expected: 마이그레이션 파일 생성 + DB 적용 성공

오류 발생 시 체크:
- `Team` relation이 `User`, `Player`, `TrainingSession`, `Match`, `Coach` 모두에 정의됐는지 확인
- `Coach` self-relation (`packageLead`/`packageMembers`) 양방향 이름 일치 확인

- [x] **Step 2: Prisma Client 재생성 확인**

```bash
cd apps/api && npx prisma generate
```

Expected: `src/generated/` 업데이트 완료

- [x] **Step 3: 기존 테스트 통과 확인**

```bash
cd apps/api && npx jest --passWithNoTests 2>&1 | grep -E "Tests:|Test Suites:"
```

Expected: 기존 실패 수 이상 증가 없음 (현재 기준: 10 failed, 146 passed)

- [x] **Step 4: Commit**

```bash
git add apps/api/prisma/migrations/
git commit -m "feat(schema): apply coach_team_schema migration"
```

---

## Task 11: FIRST_TEAM Seed 추가

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [x] **Step 1: seed.ts에 FIRST_TEAM 초기 레코드 추가**

기존 seed 파일의 최상단 실행 블록에 Team seed 추가:

```typescript
// Team seed - FIRST_TEAM 초기 레코드
const firstTeam = await prisma.team.upsert({
  where: { id: 1 },
  update: {},
  create: {
    name: '1군',
    type: 'FIRST_TEAM',
    ageGroup: null,
    isActive: true,
    trackStats: true,
    requiresContract: true,
  },
});
console.log('Seeded FIRST_TEAM:', firstTeam.id);
```

- [x] **Step 2: Seed 실행**

```bash
cd apps/api && npm run seed
```

Expected: `Seeded FIRST_TEAM: 1` 출력

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat(seed): add FIRST_TEAM initial record"
```

---

## Task 12: Smoke Tests 작성

**Files:**
- Create: `apps/api/__test__/team/team.schema.test.ts`
- Create: `apps/api/__test__/coach/coach.schema.test.ts`

- [x] **Step 1: Team smoke test 작성**

```typescript
// apps/api/__test__/team/team.schema.test.ts
import { PrismaClient } from '../../src/generated';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Team 모델', () => {
  it('FIRST_TEAM 레코드가 존재한다', async () => {
    const team = await prisma.team.findFirst({ where: { type: 'FIRST_TEAM' } });
    expect(team).not.toBeNull();
    expect(team?.trackStats).toBe(true);
    expect(team?.requiresContract).toBe(true);
  });

  it('YOUTH 팀을 생성하고 삭제할 수 있다', async () => {
    const youth = await prisma.team.create({
      data: { name: 'U18', type: 'YOUTH', ageGroup: 'U18', trackStats: false, requiresContract: false },
    });
    expect(youth.id).toBeDefined();
    await prisma.team.delete({ where: { id: youth.id } });
  });
});
```

- [x] **Step 2: Coach smoke test 작성**

```typescript
// apps/api/__test__/coach/coach.schema.test.ts
import { PrismaClient } from '../../src/generated';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.headCoachEvaluation.deleteMany({});
  await prisma.coach.deleteMany({ where: { name: 'Test Coach' } });
  await prisma.$disconnect();
});

describe('Coach 모델', () => {
  it('CANDIDATE 상태로 Coach를 생성할 수 있다', async () => {
    const coach = await prisma.coach.create({
      data: {
        name: 'Test Coach',
        coachingRole: 'HEAD_COACH',
        status: 'CANDIDATE',
      },
    });
    expect(coach.status).toBe('CANDIDATE');
    expect(coach.isDeleted).toBe(false);
  });

  it('HeadCoachEvaluation을 Coach에 연결할 수 있다', async () => {
    const coach = await prisma.coach.findFirst({ where: { name: 'Test Coach' } });
    const eval_ = await prisma.headCoachEvaluation.create({
      data: {
        coachId: coach!.id,
        possession: 55.5,
        philosophyFitScore: 82.0,
      },
    });
    expect(eval_.possession).toBe(55.5);
  });
});
```

- [x] **Step 3: 테스트 실행**

```bash
cd apps/api && npx jest __test__/team/team.schema.test.ts __test__/coach/coach.schema.test.ts --verbose
```

Expected: 모든 테스트 PASS

- [x] **Step 4: Commit**

```bash
git add apps/api/__test__/team/ apps/api/__test__/coach/
git commit -m "test(schema): add Team and Coach smoke tests"
```

---

## Self-Review

**Spec coverage:**
- ✅ Team 엔티티 (name, type, ageGroup, isActive, trackStats, requiresContract)
- ✅ Coach 엔티티 + 상태머신 (CoachStatus enum)
- ✅ CoachHiringRound (모든 필드 포함)
- ✅ Coach 평가 모델 Tier 1 x4 + Tier 2
- ✅ CoachTutorAssignment (INTERNAL/EXTERNAL, languageProficiency, tacticalImplementationRate)
- ✅ packageLeadId self-relation
- ✅ teamId → Player, User, TrainingSession, Match
- ✅ BonusTrigger.teamScope
- ✅ Coach 알림 타입 7개
- ✅ ShortlistSource 추적
- ✅ soft delete (isDeleted on Coach)
- ✅ FIRST_TEAM seed

**확인 필요:**
- Migration 적용 시 기존 `teamId` nullable이므로 기존 데이터 backfill 불필요 (기존 레코드는 teamId=null 유지)
- `Coach` self-relation Prisma 문법: `@relation("CoachPackage")` 양방향 이름 동일해야 함
