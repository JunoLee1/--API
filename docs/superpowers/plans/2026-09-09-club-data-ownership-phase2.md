# Club Data Ownership Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TrainingSession`·`OperatingExpense`에 `clubId Int?` FK를 추가하고, Phase 1/1.5와 동일한 패턴으로 read/write 경로에 구단 소속 필터링을 적용한다.

**Architecture:** `clubId` nullable FK → `findFirst` with optional WHERE clubId 조건 → null(SUPER_ADMIN)이면 필터 생략. Phase 1.5(Player/Prospect mutation 경로)와 완전 동일한 패턴. 새 에러 코드 없음 — 기존 404 가드가 처리.

**Tech Stack:** Express + TypeScript + Prisma ORM + Jest (ts-jest)

---

## File Map

| 파일 | 변경 내용 |
|---|---|
| `apps/api/prisma/schema.prisma` | TrainingSession + OperatingExpense에 `clubId Int?` + Club relation 추가 |
| `apps/api/prisma/migrations/YYYYMMDDNNNNNN_*/migration.sql` | 신규 마이그레이션 (backfill SQL 수동 추가) |
| `apps/api/src/training/training.repo.ts` | `findById` findUnique→findFirst+clubId, `findAll`+clubId, `findByIdWithTeam`+clubId, `create`+clubId |
| `apps/api/src/training/training.service.ts` | 모든 메서드에 `actorClubId?` 파라미터 추가 |
| `apps/api/src/training/training.controller.ts` | 서비스 호출 시 `user.clubId` 전달 |
| `apps/api/src/operating-expense/operating-expense.repo.ts` | `findById` findUnique→findFirst+clubId, `findBySeasonId`+clubId, `createWithBudgetCheck`+clubId |
| `apps/api/src/operating-expense/operating-expense.service.ts` | 모든 메서드에 `actorClubId?` 파라미터 추가 |
| `apps/api/src/operating-expense/operating-expense.controller.ts` | 서비스 호출 시 `user.clubId` 전달 |
| `apps/api/src/training/training.service.test.ts` | 신규 — clubId 스코핑 단위 테스트 |
| `apps/api/src/operating-expense/operating-expense.service.test.ts` | 신규 — clubId 스코핑 단위 테스트 |

---

## Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/YYYYMMDDNNNNNN_add_club_id_to_training_and_expense/migration.sql`

- [ ] **Step 1: schema.prisma에 필드 추가**

`model TrainingSession` 블록 (현재 line ~1723) 마지막 relation 뒤에 추가:

```prisma
model TrainingSession {
  // ... 기존 필드 유지 ...
  teamId       Int?
  targetLoad   Int?
  clubId       Int?                                           // ← 추가

  season          Season                @relation(fields: [seasonId], references: [id])
  team            Team?                 @relation(fields: [teamId], references: [id])
  club            Club?                 @relation("TrainingSessionClub", fields: [clubId], references: [id])  // ← 추가
  createdBy       User                  @relation("TrainingSessionCreatedBy", fields: [createdById], references: [id])
  approvedBy      User?                 @relation("TrainingSessionApprovedBy", fields: [approvedById], references: [id])
  contents        TrainingContent[]
  participants    TrainingParticipant[]
  results         TrainingResult[]
  trainingLoads   TrainingLoad[]
  incidentReports IncidentReport[]
  playerBadges    PlayerBadge[]
}
```

`model OperatingExpense` 블록 (현재 line ~3106) `departmentId Int?` 뒤에 추가:

```prisma
  departmentId               Int?
  clubId                     Int?                            // ← 추가

  season                     Season                      @relation(...)
  // ... 기존 relations ...
  club                       Club?                       @relation("OperatingExpenseClub", fields: [clubId], references: [id])  // ← 추가
```

`model Club` 블록 (현재 line ~832) 역방향 relation 추가:

```prisma
  players          Player[]           @relation("PlayerClub")
  prospects        Prospect[]         @relation("ProspectClub")
  trainingSessions TrainingSession[]  @relation("TrainingSessionClub")    // ← 추가
  operatingExpenses OperatingExpense[] @relation("OperatingExpenseClub")  // ← 추가
```

- [ ] **Step 2: 마이그레이션 파일 생성 (적용 X)**

```bash
cd apps/api && npx prisma migrate dev --create-only --name add_club_id_to_training_and_expense
```

Expected: `prisma/migrations/YYYYMMDDNNNNNN_add_club_id_to_training_and_expense/migration.sql` 생성됨

- [ ] **Step 3: migration.sql에 backfill SQL 수동 추가**

생성된 migration.sql 파일을 열어 ALTER TABLE 구문 바로 다음에 추가:

```sql
-- TrainingSession: 기존 레코드의 clubId를 팀 소속 클럽으로 backfill
UPDATE "public"."TrainingSession" ts
SET "clubId" = t."clubId"
FROM "public"."Team" t
WHERE ts."teamId" = t."id" AND t."clubId" IS NOT NULL;

-- OperatingExpense: 기존 레코드의 clubId를 생성자 소속 클럽으로 backfill
UPDATE "public"."OperatingExpense" oe
SET "clubId" = u."clubId"
FROM "public"."User" u
WHERE oe."createdById" = u."id" AND u."clubId" IS NOT NULL;
```

- [ ] **Step 4: 마이그레이션 적용 + 클라이언트 재생성**

```bash
cd apps/api && npx prisma migrate dev
```

Expected: 마이그레이션 성공 + Prisma client 재생성 완료

- [ ] **Step 5: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: TrainingSession·OperatingExpense에 clubId FK 추가 (Phase 2 schema)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Training Repo — clubId 필터링

**Files:**
- Modify: `apps/api/src/training/training.repo.ts`

- [ ] **Step 1: `findAll` clubId 필터 추가**

```typescript
findAll(query: SessionListQuery, clubId?: number | null) {
  return this.prisma.trainingSession.findMany({
    where: {
      ...(query.seasonId && { seasonId: query.seasonId }),
      ...(clubId != null && { clubId }),
    },
    select: {
      id: true,
      date: true,
      goal: true,
      sessionType: true,
      isApproved: true,
      seasonId: true,
      createdById: true,
    },
    orderBy: { date: "desc" },
  });
}
```

- [ ] **Step 2: `findById` findUnique → findFirst + clubId**

```typescript
findById(id: number, clubId?: number | null) {
  return this.prisma.trainingSession.findFirst({
    where: { id, ...(clubId != null && { clubId }) },
    select: {
      id: true,
      date: true,
      goal: true,
      sessionType: true,
      isApproved: true,
      seasonId: true,
      createdById: true,
      approvedById: true,
      contents: true,
      participants: { select: { playerId: true, player: { select: { playerName: true, position: true } } } },
      results: true,
    },
  });
}
```

- [ ] **Step 3: `findByIdWithTeam` findUnique → findFirst + clubId**

```typescript
findByIdWithTeam(id: number, clubId?: number | null) {
  return this.prisma.trainingSession.findFirst({
    where: { id, ...(clubId != null && { clubId }) },
    select: { id: true, teamId: true, date: true, team: { select: { id: true, type: true, name: true } } },
  });
}
```

- [ ] **Step 4: `create`에 clubId 파라미터 추가**

```typescript
create(dto: CreateSessionDto, createdById: number, clubId?: number | null) {
  return this.prisma.trainingSession.create({
    data: {
      date: new Date(dto.date),
      goal: dto.goal,
      sessionType: dto.sessionType,
      seasonId: dto.seasonId,
      createdById,
      ...(clubId != null && { clubId }),
      ...(dto.teamId ? { teamId: dto.teamId } : {}),
      ...(dto.contents && {
        contents: { create: dto.contents },
      }),
    },
    select: { id: true, date: true, goal: true, sessionType: true, isApproved: true, seasonId: true, teamId: true },
  });
}
```

- [ ] **Step 5: TypeScript 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "training"
```

Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/training/training.repo.ts
git commit -m "feat: training repo — findById/findAll/create clubId 필터 추가

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Training Service — actorClubId 전파

**Files:**
- Modify: `apps/api/src/training/training.service.ts`

- [ ] **Step 1: `getSessions` clubId 전파**

```typescript
getSessions(query: SessionListQuery, actorClubId?: number | null) {
  return this.repo.findAll(query, actorClubId);
}
```

- [ ] **Step 2: `getSessionById` clubId 전파**

```typescript
async getSessionById(id: number, actorClubId?: number | null) {
  const session = await this.repo.findById(id, actorClubId);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
  return session;
}
```

- [ ] **Step 3: `createSession` clubId 전파**

```typescript
async createSession(dto: CreateSessionDto, createdById: number, actorClubId?: number | null) {
  const sessionDate = new Date(dto.date);
  if (sessionDate > new Date()) {
    throw new AppError(400, "SESSION_DATE_FUTURE_NOT_ALLOWED");
  }
  const session = await this.repo.create(dto, createdById, actorClubId);
  void this.repo.addAllActivePlayers(session.id, session.teamId).catch(console.error);
  if (this.notifRepo) {
    void this.notifRepo
      .createForHeadCoach(
        "TRAINING_SESSION_PENDING",
        () => ({
          title: "훈련 세션 승인 요청",
          body: `${new Date(dto.date).toLocaleDateString("ko-KR")} 훈련 세션(${dto.sessionType})이 등록되어 승인이 필요합니다.`,
        }),
        session.id,
      )
      .catch(console.error);
  }
  return session;
}
```

- [ ] **Step 4: `approveSession` clubId 전파**

```typescript
async approveSession(id: number, approvedById: number, actorClubId?: number | null) {
  const session = await this.repo.findById(id, actorClubId);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
  if (session.isApproved) throw new AppError(409, "ALREADY_APPROVED");
  // ... 나머지 로직 동일 유지 ...
```

(`approve`, `highPerfResults` 로직 등 나머지는 그대로 유지)

- [ ] **Step 5: `addContent`, `addParticipants`, `upsertResult` clubId 전파**

```typescript
async addContent(sessionId: number, dto: AddContentDto, actorClubId?: number | null) {
  const session = await this.repo.findById(sessionId, actorClubId);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
  return this.repo.addContent(sessionId, dto);
}

async addParticipants(sessionId: number, dto: AddParticipantsDto, actorClubId?: number | null) {
  const session = await this.repo.findById(sessionId, actorClubId);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
  return this.repo.addParticipants(sessionId, dto);
}

async upsertResult(sessionId: number, dto: UpsertResultDto, actorClubId?: number | null) {
  const session = await this.repo.findById(sessionId, actorClubId);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
  // ... 나머지 로직(performanceScore range check, 출결 알림 등) 동일 유지 ...
```

- [ ] **Step 6: `updateSession`, `cancelSession` clubId 전파**

```typescript
async updateSession(id: number, data: { date?: string; goal?: string }, _updatedById: number, actorClubId?: number | null) {
  const session = await this.repo.findByIdWithTeam(id, actorClubId);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
  // ... 나머지 로직(guardian 알림 등) 동일 유지 ...
}

async cancelSession(id: number, actorClubId?: number | null) {
  const session = await this.repo.findByIdWithTeam(id, actorClubId);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
  // ... 나머지 로직 동일 유지 ...
}
```

- [ ] **Step 7: TypeScript 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "training"
```

Expected: 에러 없음

- [ ] **Step 8: 커밋**

```bash
git add apps/api/src/training/training.service.ts
git commit -m "feat: training service — 전 메서드에 actorClubId 전파

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Training Controller — user.clubId 전달

**Files:**
- Modify: `apps/api/src/training/training.controller.ts`

- [ ] **Step 1: 각 핸들러에서 `user.clubId` 추가 전달**

`getSessions`:
```typescript
getSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const query: SessionListQuery = {};
    if (req.query["seasonId"]) query.seasonId = Number(req.query["seasonId"]);
    res.status(200).json(await this.service.getSessions(query, user.clubId));
  } catch (err) { next(err); }
};
```

`getSessionById`:
```typescript
getSessionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    res.status(200).json(await this.service.getSessionById(Number(req.params["id"]), user.clubId));
  } catch (err) { next(err); }
};
```

`createSession` — `user.id` 외 `user.clubId` 추가:
```typescript
res.status(201).json(await this.service.createSession(req.body, user.id, user.clubId));
```

`approveSession`:
```typescript
res.status(200).json(await this.service.approveSession(Number(req.params["id"]), userId, user.clubId));
// user 변수를 requireUser(req)로 통째로 받도록 수정
```

`addContent`:
```typescript
const user = requireUser(req);
// ... permission check ...
res.status(201).json(await this.service.addContent(Number(req.params["id"]), req.body, user.clubId));
```

`addParticipants`, `upsertResult`, `updateSession`, `cancelSession` — 동일 패턴으로 `user.clubId` 전달.

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "training"
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/training/training.controller.ts
git commit -m "feat: training controller — 서비스 호출 시 user.clubId 전달

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: OperatingExpense Repo — clubId 필터링

**Files:**
- Modify: `apps/api/src/operating-expense/operating-expense.repo.ts`

- [ ] **Step 1: `findBySeasonId` clubId 필터 추가**

```typescript
findBySeasonId(seasonId: number, clubId?: number | null) {
  return this.prisma.operatingExpense.findMany({
    where: { seasonId, deletedAt: null, ...(clubId != null && { clubId }) },
    include: {
      createdBy: { select: { id: true, username: true } },
      budgetLine: { select: { id: true, originalAmount: true, expenseCategory: { select: { code: true } } } },
      expenseCategory: { select: { code: true } },
    },
    orderBy: { date: "desc" },
  });
}
```

- [ ] **Step 2: `findById` findUnique → findFirst + clubId**

```typescript
findById(id: number, clubId?: number | null) {
  return this.prisma.operatingExpense.findFirst({
    where: { id, ...(clubId != null && { clubId }) },
    include: {
      createdBy: { select: { id: true, username: true } },
      budgetLine: { select: { id: true, originalAmount: true, budgetHeaderId: true, expenseCategory: { select: { code: true } } } },
      expenseCategory: { select: { code: true } },
    },
  });
}
```

- [ ] **Step 3: `createWithBudgetCheck` data 타입에 clubId 추가**

`data` 파라미터 타입에 `clubId?: number | null` 추가:

```typescript
async createWithBudgetCheck(
  data: {
    seasonId: number;
    categoryId: number;
    costType?: ExpenseCostType;
    amount: number;
    date: Date;
    note?: string | null;
    createdById: number;
    budgetLineId: number;
    clubId?: number | null;   // ← 추가
  },
  tx?: Tx,
) {
  const run = async (client: Tx) => {
    // ... 기존 로직 동일 유지 ...

    return client.operatingExpense.create({
      data: {
        seasonId: data.seasonId,
        categoryId: data.categoryId,
        ...(data.costType && { costType: data.costType }),
        amount: data.amount,
        date: data.date,
        note: data.note ?? null,
        createdById: data.createdById,
        budgetLineId: data.budgetLineId,
        status: "PENDING",
        ...(data.clubId != null && { clubId: data.clubId }),  // ← 추가
      },
      // ... include 동일 유지 ...
    });
  };
  if (tx) return run(tx);
  return this.prisma.$transaction(run);
}
```

- [ ] **Step 4: TypeScript 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "operating-expense"
```

Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/operating-expense/operating-expense.repo.ts
git commit -m "feat: operating-expense repo — findById/findBySeasonId/create clubId 필터 추가

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: OperatingExpense Service — actorClubId 전파

**Files:**
- Modify: `apps/api/src/operating-expense/operating-expense.service.ts`

- [ ] **Step 1: `list` clubId 전파**

```typescript
async list(seasonId: number, actorClubId?: number | null) {
  const rows = await this.repo.findBySeasonId(seasonId, actorClubId);
  // ... 나머지 map 로직 동일 ...
}
```

- [ ] **Step 2: `create` clubId 전파**

`create` 메서드 data 파라미터에 `actorClubId?: number | null` 추가 후 `createWithBudgetCheck` 호출 시 전달:

```typescript
async create(data: {
  seasonId: number;
  category: string;
  costType?: "FIXED" | "VARIABLE" | "CONTINGENCY";
  amount: number;
  date: string;
  note?: string;
  createdById: number;
  budgetLineId?: number;
  actorClubId?: number | null;  // ← 추가
}) {
  // ... 기존 로직 동일 ...
  expense = await this.repo.createWithBudgetCheck({
    // ... 기존 필드들 ...
    clubId: data.actorClubId ?? null,  // ← 추가
  });
  // ...
}
```

- [ ] **Step 3: mutation 메서드들 actorClubId 전파**

`firstApprove`, `approve`, `reject`, `cancel`, `markPaid`, `update`, `delete` — 각 메서드 시그니처에 `actorClubId?: number | null` 추가, 내부 `this.repo.findById(id)` → `this.repo.findById(id, actorClubId)` 변경:

```typescript
async firstApprove(id: number, approverId: number, role: string, foRole: string | null | undefined, departmentCategories?: string[], actorClubId?: number | null) {
  if (!canReadFinance(role, foRole, departmentCategories)) throw new AppError(403, "FORBIDDEN");
  const expense = await this.repo.findById(id, actorClubId);
  // ... 나머지 동일 ...
}

async approve(id: number, approverId: number, role: string, foRole: string | null | undefined, departmentCategories?: string[], actorClubId?: number | null) {
  const expense = await this.repo.findById(id, actorClubId);
  // ... 나머지 동일 ...
}

async reject(id: number, rejectorId: number, reason: string, role: string, foRole: string | null | undefined, departmentCategories?: string[], actorClubId?: number | null) {
  if (!canReadFinance(role, foRole, departmentCategories)) throw new AppError(403, "FORBIDDEN");
  const expense = await this.repo.findById(id, actorClubId);
  // ... 나머지 동일 ...
}

async cancel(id: number, cancellerId: number, reason: string, role: string, foRole: string | null | undefined, departmentCategories?: string[], actorClubId?: number | null) {
  const expense = await this.repo.findById(id, actorClubId);
  // ... 나머지 동일 ...
}

async markPaid(id: number, paidById: number, actorClubId?: number | null) {
  const expense = await this.repo.findById(id, actorClubId);
  // ... 나머지 동일 ...
}

async update(id: number, userId: number, data: { amount?: number; category?: string; note?: string }, actorClubId?: number | null) {
  const expense = await this.repo.findById(id, actorClubId);
  // ... 나머지 동일 ...
}

async delete(id: number, requesterId: number, requesterRole: string, reason: string, actorClubId?: number | null) {
  const expense = await this.repo.findById(id, actorClubId);
  // ... 나머지 동일 ...
}
```

- [ ] **Step 4: TypeScript 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "operating-expense"
```

Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/operating-expense/operating-expense.service.ts
git commit -m "feat: operating-expense service — 전 메서드에 actorClubId 전파

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: OperatingExpense Controller — user.clubId 전달

**Files:**
- Modify: `apps/api/src/operating-expense/operating-expense.controller.ts`

- [ ] **Step 1: `list`에 `user.clubId` 추가**

```typescript
list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole, departmentCategories, clubId } = requireUser(req);
    if (!canRead(role, frontOfficeRole, departmentCategories)) throw new AppError(403, "FORBIDDEN");
    const seasonId = Number(req.query["seasonId"]);
    if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
    const expenses = await this.service.list(seasonId, clubId);
    res.json(expenses);
  } catch (err) { next(err); }
};
```

- [ ] **Step 2: `create`에 `actorClubId` 추가**

```typescript
const expense = await this.service.create({
  seasonId, category, amount, date,
  ...(costType !== undefined && { costType }),
  ...(note !== undefined && { note }),
  ...(budgetLineId !== undefined && { budgetLineId }),
  createdById: userId,
  actorClubId: user.clubId,  // ← 추가 (user를 requireUser(req)로 통째로 받도록 변수 수정)
});
```

- [ ] **Step 3: mutation 핸들러들에 `user.clubId` 추가**

각 핸들러(`firstApprove`, `approve`, `reject`, `cancel`, `markPaid`, `update`, `delete`)에서 `requireUser(req)`로 `clubId` 추출 후 서비스 메서드 마지막 인자로 전달.

예시 (`approve`):
```typescript
approve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole, departmentCategories, id: userId, clubId } = requireUser(req);
    const id = Number(req.params["id"]);
    res.json(await this.service.approve(id, userId, role, frontOfficeRole, departmentCategories, clubId));
  } catch (err) { next(err); }
};
```

- [ ] **Step 4: 전체 TypeScript 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/operating-expense/operating-expense.controller.ts
git commit -m "feat: operating-expense controller — 서비스 호출 시 user.clubId 전달

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: 테스트 작성 + PR

**Files:**
- Create: `apps/api/src/training/training.service.test.ts`
- Create: `apps/api/src/operating-expense/operating-expense.service.test.ts`

- [ ] **Step 1: training.service.test.ts 작성**

```typescript
import { TrainingService } from "./training.service";
import { TrainingRepository } from "./training.repo";
import { AppError } from "../lib/appError";

const mockRepo = () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByIdWithTeam: jest.fn(),
  create: jest.fn(),
  approve: jest.fn(),
  addContent: jest.fn(),
  addParticipants: jest.fn(),
  addAllActivePlayers: jest.fn().mockResolvedValue(undefined),
  upsertResult: jest.fn(),
  countUnexcusedAttendance: jest.fn().mockResolvedValue({ absences: 0, lateCount: 0 }),
  findPlayerUserId: jest.fn().mockResolvedValue(null),
  findPlayerNameById: jest.fn().mockResolvedValue(null),
  findResults: jest.fn(),
  findResultById: jest.fn(),
  updateAttendance: jest.fn(),
  findGuardiansByTeam: jest.fn().mockResolvedValue([]),
  updateSession: jest.fn(),
  cancelSession: jest.fn(),
}) as unknown as jest.Mocked<TrainingRepository>;

const SESSION_FIXTURE = {
  id: 1, date: new Date("2026-01-01"), goal: "기술 훈련", sessionType: "TECHNICAL",
  isApproved: false, seasonId: 1, createdById: 10, approvedById: null,
  contents: [], participants: [], results: [],
};

describe("TrainingService clubId 스코핑", () => {
  let repo: jest.Mocked<TrainingRepository>;
  let service: TrainingService;

  beforeEach(() => {
    repo = mockRepo();
    service = new TrainingService(repo as any);
  });

  describe("getSessions", () => {
    it("actorClubId를 repo.findAll에 전달한다", async () => {
      repo.findAll.mockResolvedValue([]);
      await service.getSessions({ seasonId: 1 }, 2);
      expect(repo.findAll).toHaveBeenCalledWith({ seasonId: 1 }, 2);
    });
  });

  describe("getSessionById", () => {
    it("일치하는 clubId → 세션 반환", async () => {
      repo.findById.mockResolvedValue(SESSION_FIXTURE as any);
      const result = await service.getSessionById(1, 5);
      expect(repo.findById).toHaveBeenCalledWith(1, 5);
      expect(result.id).toBe(1);
    });

    it("다른 clubId → repo null 반환 → 404", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getSessionById(1, 99)).rejects.toThrow(AppError);
      const err = await service.getSessionById(1, 99).catch((e) => e);
      expect(err.code).toBe("SESSION_NOT_FOUND");
    });

    it("actorClubId = null (SUPER_ADMIN) → clubId 필터 없이 처리", async () => {
      repo.findById.mockResolvedValue(SESSION_FIXTURE as any);
      await service.getSessionById(1, null);
      expect(repo.findById).toHaveBeenCalledWith(1, null);
    });
  });

  describe("createSession", () => {
    it("actorClubId를 repo.create에 전달한다", async () => {
      repo.create.mockResolvedValue({ id: 1, teamId: null } as any);
      const dto = { date: "2026-01-01", goal: "훈련", sessionType: "TECHNICAL" as any, seasonId: 1 };
      await service.createSession(dto, 10, 5);
      expect(repo.create).toHaveBeenCalledWith(dto, 10, 5);
    });
  });

  describe("approveSession", () => {
    it("다른 clubId → 404", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.approveSession(1, 10, 99)).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
    });
  });
});
```

- [ ] **Step 2: operating-expense.service.test.ts 작성**

```typescript
import { OperatingExpenseService } from "./operating-expense.service";
import { OperatingExpenseRepository } from "./operating-expense.repo";
import { AppError } from "../lib/appError";

const EXPENSE_FIXTURE = {
  id: 1, seasonId: 1, categoryId: 2, amount: 100_000, date: new Date(),
  createdById: 10, status: "PENDING", deletedAt: null, paidAt: null,
  expenseCategory: { code: "STAFF_WAGES" },
  budgetLine: null, createdBy: { id: 10, username: "user" },
};

const mockRepo = () => ({
  findBySeasonId: jest.fn(),
  findById: jest.fn(),
  findBudgetLine: jest.fn(),
  findBudgetLinesForSeasonCategory: jest.fn(),
  createWithBudgetCheck: jest.fn(),
  updateStatus: jest.fn(),
  update: jest.fn(),
  findBudgetPlan: jest.fn(),
  sumSpendBySeasonAndCategory: jest.fn(),
  softDelete: jest.fn(),
  purgeExpired: jest.fn(),
}) as unknown as jest.Mocked<OperatingExpenseRepository>;

const mockNotifRepo = () => ({
  createForFinanceStaff: jest.fn().mockResolvedValue(undefined),
  createForFinanceManager: jest.fn().mockResolvedValue(undefined),
  createForUser: jest.fn().mockResolvedValue(undefined),
}) as any;

const mockCategoryService = () => ({
  isValidCode: jest.fn().mockResolvedValue(true),
  resolveCategoryId: jest.fn().mockResolvedValue(2),
}) as any;

describe("OperatingExpenseService clubId 스코핑", () => {
  let repo: jest.Mocked<OperatingExpenseRepository>;
  let service: OperatingExpenseService;

  beforeEach(() => {
    repo = mockRepo();
    service = new OperatingExpenseService(repo as any, mockNotifRepo(), mockCategoryService());
  });

  describe("list", () => {
    it("actorClubId를 repo.findBySeasonId에 전달한다", async () => {
      repo.findBySeasonId.mockResolvedValue([{ ...EXPENSE_FIXTURE }] as any);
      await service.list(1, 5);
      expect(repo.findBySeasonId).toHaveBeenCalledWith(1, 5);
    });
  });

  describe("approve", () => {
    it("일치하는 clubId → 승인 처리", async () => {
      repo.findById.mockResolvedValue({ ...EXPENSE_FIXTURE, amount: 500_000, status: "PENDING" } as any);
      repo.updateStatus.mockResolvedValue({} as any);
      await service.approve(1, 99, "ADMIN", null, undefined, 5);
      expect(repo.findById).toHaveBeenCalledWith(1, 5);
    });

    it("다른 clubId → repo null 반환 → 404", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.approve(1, 99, "ADMIN", null, undefined, 99)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("actorClubId = null (SUPER_ADMIN) → clubId 필터 없이 처리", async () => {
      repo.findById.mockResolvedValue({ ...EXPENSE_FIXTURE, amount: 500_000, status: "PENDING" } as any);
      repo.updateStatus.mockResolvedValue({} as any);
      await service.approve(1, 99, "ADMIN", null, undefined, null);
      expect(repo.findById).toHaveBeenCalledWith(1, null);
    });
  });

  describe("delete", () => {
    it("다른 clubId → repo null → 404", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete(1, 10, "ADMIN", "reason", 99)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
```

- [ ] **Step 3: 테스트 실행**

```bash
cd apps/api && npx jest --testPathPattern="training.service.test|operating-expense.service.test" --no-coverage 2>&1 | tail -20
```

Expected: 모든 테스트 PASS

- [ ] **Step 4: 전체 테스트 suite 실행**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -10
```

Expected: 기존 테스트 regression 없음

- [ ] **Step 5: 최종 커밋**

```bash
git add apps/api/src/training/training.service.test.ts apps/api/src/operating-expense/operating-expense.service.test.ts
git commit -m "test: Phase 2 clubId 스코핑 단위 테스트 추가 (TrainingSession·OperatingExpense)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 6: PR 생성**

```bash
cd /Users/juno/work/football && git push -u origin HEAD
gh pr create \
  --title "feat: Club Data Ownership Phase 2 — TrainingSession·OperatingExpense clubId 스코핑" \
  --body "$(cat <<'EOF'
## Summary
- TrainingSession·OperatingExpense 모델에 clubId Int? FK 추가 (Prisma migration + backfill)
- training/operating-expense repo: findById findUnique→findFirst+clubId 필터, findAll/findBySeasonId 클럽 필터, create clubId 저장
- training/operating-expense service: 전 메서드에 actorClubId? 파라미터 추가
- training/operating-expense controller: 서비스 호출 시 user.clubId 전달
- SUPER_ADMIN / clubId 없는 계정은 기존 동작 그대로 (bypass)

## Test Plan
- [ ] training.service.test.ts: getSessions/getSessionById/createSession/approveSession clubId 스코핑 케이스 통과
- [ ] operating-expense.service.test.ts: list/approve/delete clubId 스코핑 케이스 통과
- [ ] 전체 jest suite regression 없음

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 범위 밖

- `Contract`, `Match`, `BudgetPlan` 등 다른 도메인 — Phase 3
- `TrainingResult`, `TrainingContent`, `TrainingParticipant` 등 하위 모델 — TrainingSession clubId 스코핑이 커버
