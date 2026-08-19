# Recruitment Persona Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve 4 open criticals from 서지혜 & Claire personas — interview score validation on result confirmation, HEAD_COACH PII access restriction, source enum required, and cost-per-hire KPI endpoint.

**Architecture:** All changes are in the existing recruitment module (`apps/api/src/recruitment/`). No new tables. Schema change: `ApplicationSource` enum gets 4 new values; `JobApplication.source` becomes non-nullable. Service layer validates interview scores. Route RBAC tightened. New analytics endpoint follows the `time-to-hire` pattern.

**Tech Stack:** Express + TypeScript + Prisma, Jest. Enum addition uses raw SQL + `prisma migrate resolve --applied` (see known workaround).

---

## File Map

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `AGENT REFERRAL PLATFORM INTERNAL` to `ApplicationSource`; make `source` non-nullable |
| `apps/api/prisma/migrations/20260812300002_recruitment_persona/migration.sql` | Enum + NOT NULL migration |
| `apps/api/src/recruitment/dto/recruitment.dto.ts` | `source` required in CreateApplicationDto |
| `apps/api/src/recruitment/recruitment.service.ts` | Score validation on interview result confirmation |
| `apps/api/src/recruitment/recruitment.routes.ts` | Restrict `GET /applications/:id` to HR/ADMIN/SUPER_ADMIN; add cost-per-hire route |
| `apps/api/src/recruitment/recruitment.repo.ts` | Add `costPerHire` query |
| `apps/api/src/recruitment/recruitment.controller.ts` | Add `getCostPerHire` handler |
| `apps/api/__test__/recruitment/recruitment.service.test.ts` | Add score validation tests |
| `apps/api/__test__/recruitment/recruitment.routes.test.ts` | Add RBAC + cost-per-hire tests |

---

## Task 1: Enum + schema migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260812300002_recruitment_persona/migration.sql`

- [ ] **Step 1: Update ApplicationSource enum in schema**

Find `enum ApplicationSource` in `apps/api/prisma/schema.prisma` and replace:

```prisma
enum ApplicationSource {
  SARAMIN
  GLASSDOOR
  INDEED
  FACEBOOK
  DIRECT
  AGENT
  REFERRAL
  PLATFORM
  INTERNAL
}
```

- [ ] **Step 2: Make source non-nullable in JobApplication**

Find `source ApplicationSource?` in the `JobApplication` model and change to:

```prisma
source ApplicationSource
```

- [ ] **Step 3: Create migration SQL**

```bash
mkdir -p apps/api/prisma/migrations/20260812300002_recruitment_persona
```

Write `apps/api/prisma/migrations/20260812300002_recruitment_persona/migration.sql`:

```sql
-- Add new enum values (PostgreSQL requires ALTER TYPE)
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'AGENT';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'REFERRAL';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'PLATFORM';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'INTERNAL';

-- Backfill NULL source values before adding NOT NULL
UPDATE "JobApplication" SET "source" = 'DIRECT' WHERE "source" IS NULL;

-- Make source non-nullable
ALTER TABLE "JobApplication" ALTER COLUMN "source" SET NOT NULL;
ALTER TABLE "JobApplication" ALTER COLUMN "source" SET DEFAULT 'DIRECT';
```

- [ ] **Step 4: Apply migration**

```bash
cd apps/api
psql $DATABASE_URL -f prisma/migrations/20260812300002_recruitment_persona/migration.sql
npx prisma migrate resolve --applied 20260812300002_recruitment_persona
npx prisma generate
```

Expected: `Migration 20260812300002_recruitment_persona marked as applied`

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260812300002_recruitment_persona/
git commit -m "feat(schema): ApplicationSource enum extended + source required (SJ10)"
```

---

## Task 2: Interview score validation on result confirmation (SJ3)

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.ts`
- Modify: `apps/api/__test__/recruitment/recruitment.service.test.ts`

- [ ] **Step 1: Write failing test**

In `apps/api/__test__/recruitment/recruitment.service.test.ts`, add inside the describe block:

```typescript
describe('updateInterviewResult', () => {
  it('throws when result is PASS/FAIL but any score is missing', async () => {
    mockRepo.findInterviewByRound.mockResolvedValue({
      id: 1, round: 'FIRST', scoreSkill: null, scoreComm: 7, scoreCulture: 8,
    });

    await expect(
      service.updateInterviewRound(1, 'FIRST', { result: 'PASS' }, 99)
    ).rejects.toMatchObject({ code: 'INTERVIEW_SCORES_REQUIRED' });
  });

  it('succeeds when all three scores are present', async () => {
    mockRepo.findInterviewByRound.mockResolvedValue({
      id: 1, round: 'FIRST', scoreSkill: 8, scoreComm: 7, scoreCulture: 9,
    });
    mockRepo.updateInterviewRound.mockResolvedValue({ id: 1, result: 'PASS' });

    await expect(
      service.updateInterviewRound(1, 'FIRST', { result: 'PASS', scoreSkill: 8, scoreComm: 7, scoreCulture: 9 }, 99)
    ).resolves.toMatchObject({ result: 'PASS' });
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd apps/api && npx jest --testPathPattern="recruitment.service" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — no score validation logic.

- [ ] **Step 3: Add score validation in recruitment.service.ts**

Find `updateInterviewRound` (or equivalent method that sets `result`) in `apps/api/src/recruitment/recruitment.service.ts`. Add score validation before the update:

```typescript
async updateInterviewRound(
  applicationId: number,
  round: string,
  dto: UpdateInterviewDto,
  actorId: number,
) {
  const existing = await this.repo.findInterviewByRound(applicationId, round);
  if (!existing) throw new AppError(404, 'INTERVIEW_NOT_FOUND');

  // SJ3: all three scores required when finalising result
  if (dto.result && dto.result !== 'PENDING') {
    const skill = dto.scoreSkill ?? existing.scoreSkill;
    const comm = dto.scoreComm ?? existing.scoreComm;
    const culture = dto.scoreCulture ?? existing.scoreCulture;
    if (skill == null || comm == null || culture == null) {
      throw new AppError(400, 'INTERVIEW_SCORES_REQUIRED');
    }
  }

  return this.repo.updateInterviewRound(applicationId, round, dto);
}
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd apps/api && npx jest --testPathPattern="recruitment.service" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/recruitment/recruitment.service.ts apps/api/__test__/recruitment/recruitment.service.test.ts
git commit -m "feat(recruitment): validate all 3 interview scores on result confirmation (SJ3)"
```

---

## Task 3: RBAC — restrict application PII to HR/ADMIN/SUPER_ADMIN (SJ9)

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.routes.ts`

- [ ] **Step 1: Find the GET /applications/:id route**

Open `apps/api/src/recruitment/recruitment.routes.ts` and locate the `GET /applications/:id` route handler.

- [ ] **Step 2: Add role guard**

Currently the route likely uses `requireUser`. Replace with a role check:

```typescript
import { requireUser } from '../lib/authMiddleware';
import { AppError } from '../lib/appError';

// GET /applications/:id — PII restricted to HR/ADMIN/SUPER_ADMIN (SJ9)
router.get('/applications/:id', requireUser, (req, res, next) => {
  const allowed = ['HR', 'ADMIN', 'SUPER_ADMIN'];
  if (!allowed.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN'));
  }
  next();
}, controller.getApplication);
```

Note: If there is already a separate `HEAD_COACH` interview scoring endpoint that doesn't expose PII fields, ensure it remains accessible — only the full application detail route is restricted.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/recruitment/recruitment.routes.ts
git commit -m "feat(recruitment): restrict application PII to HR/ADMIN/SUPER_ADMIN (SJ9)"
```

---

## Task 4: Cost-per-hire KPI endpoint (CL10)

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.repo.ts`
- Modify: `apps/api/src/recruitment/recruitment.controller.ts`
- Modify: `apps/api/src/recruitment/recruitment.routes.ts`
- Create: `apps/api/__test__/recruitment/cost-per-hire.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/api/__test__/recruitment/cost-per-hire.test.ts`:

```typescript
import { RecruitmentRepository } from '../../src/recruitment/recruitment.repo';

describe('getCostPerHire', () => {
  let repo: RecruitmentRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = { jobPosting: { findMany: jest.fn() } };
    repo = new RecruitmentRepository(mockPrisma);
  });

  it('returns budget/hiredCount per posting, 0 when no hires', async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([
      {
        id: 1, title: 'Coach', budget: 500000,
        applications: [
          { status: 'ONBOARDED' },
          { status: 'ONBOARDED' },
          { status: 'APPLIED' },
        ],
      },
      {
        id: 2, title: 'Analyst', budget: 300000,
        applications: [],
      },
    ]);

    const result = await repo.getCostPerHire();

    expect(result).toEqual([
      { postingId: 1, title: 'Coach', budget: 500000, hiredCount: 2, costPerHire: 250000 },
      { postingId: 2, title: 'Analyst', budget: 300000, hiredCount: 0, costPerHire: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd apps/api && npx jest --testPathPattern="cost-per-hire" --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `getCostPerHire` not defined.

- [ ] **Step 3: Add getCostPerHire to repo**

In `apps/api/src/recruitment/recruitment.repo.ts`, add:

```typescript
async getCostPerHire() {
  const postings = await this.prisma.jobPosting.findMany({
    select: {
      id: true,
      title: true,
      budget: true,
      applications: { select: { status: true } },
    },
  });

  return postings.map(p => {
    const hiredCount = p.applications.filter(a => a.status === 'ONBOARDED').length;
    const budget = p.budget ?? 0;
    return {
      postingId: p.id,
      title: p.title,
      budget,
      hiredCount,
      costPerHire: hiredCount > 0 ? Math.round(budget / hiredCount) : 0,
    };
  });
}
```

- [ ] **Step 4: Add getCostPerHire to controller**

In `apps/api/src/recruitment/recruitment.controller.ts`, add:

```typescript
async getCostPerHire(req: Request, res: Response) {
  const data = await this.repo.getCostPerHire();
  res.json(data);
}
```

- [ ] **Step 5: Register route**

In `apps/api/src/recruitment/recruitment.routes.ts`, add alongside `time-to-hire`:

```typescript
// GET /recruitment/cost-per-hire — CL10
router.get('/cost-per-hire', requireUser, controller.getCostPerHire);
```

- [ ] **Step 6: Run tests**

```bash
cd apps/api && npx jest --testPathPattern="cost-per-hire" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 7: Run full recruitment test suite**

```bash
cd apps/api && npx jest --testPathPattern="recruitment" --no-coverage 2>&1 | tail -15
```

Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/recruitment/ apps/api/__test__/recruitment/cost-per-hire.test.ts
git commit -m "feat(recruitment): cost-per-hire KPI endpoint (CL10)"
```

---

## Self-Review

**Spec coverage:**
- SJ3 score validation → Task 2 ✅
- SJ9 RBAC restriction → Task 3 ✅
- SJ10 source required + enum extended → Task 1 ✅
- CL10 cost-per-hire → Task 4 ✅

**Placeholder scan:** No TBD/TODO.

**Type consistency:** `UpdateInterviewDto`, `getCostPerHire` return type consistent across repo/controller/test.
