# HiringPlanItem Status Tracking (Fix #362) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** [#362](https://github.com/JunoLee1/--API/issues/362)

**Goal:** `HiringPlanItem` 에 완료 상태 필드 (`status`, `fulfilledAt`, `fulfilledCount`) 를 추가하고, JobPosting 생성 · Application 온보딩 완료 · HR 매니저 취소 액션에 따라 자동 상태 전이시킨다. 이후 `getHeadcountProgress` 등 분석 API 정확도 확보.

**Architecture:**
- Schema: `HiringPlanItemStatus` enum 신설 (`PLANNED | IN_PROGRESS | FULFILLED | CANCELLED`) + `HiringPlanItem` 에 3 필드 추가
- 상태 전이 자동화:
  - 첫 JobPosting 생성 시 `PLANNED → IN_PROGRESS` (recruitment.service.createPosting)
  - Application `completeMfa` 완료 시 fulfilledCount++, headcount 도달하면 `FULFILLED` + fulfilledAt (recruitment.service.completeMfa)
  - HR 매니저 명시적 취소 시 `→ CANCELLED` (신규 API)
- 신규 API: `PATCH /plan-reports/:id/hiring-items/:itemId/cancel` (HR 만)
- #363 의 deferred `hiringPlanItem.status !== 'FULFILLED'` 체크를 함께 활성화 (createPosting 에서 CANCELLED/FULFILLED item 재사용 차단)
- `listHiringPlanItems` 에 status 필터 지원 추가

**Tech Stack:** TypeScript · Prisma · Jest · Express (`apps/api`) · React+Vite (`football/`)

**Dependency:** [#359](https://github.com/JunoLee1/--API/pull/376), [#363](https://github.com/JunoLee1/--API/pull/379) merged (main `e98811c0`).

**Out of scope:**
- 대량 backfill (기존 완료 채용은 수동 HR 확인 필요)
- 분석 API 재작성 (별도 이슈)
- FE 상태 badge UI (별도 이슈)

---

## File Structure

**Modify (BE):**
- `apps/api/prisma/schema.prisma` — `HiringPlanItemStatus` enum + `HiringPlanItem` 3 필드
- `apps/api/src/recruitment/recruitment.repo.ts:24` — `APPLICATION_INCLUDE` 의 `posting.select` 에 `hiringPlanItemId: true` 추가
- `apps/api/src/recruitment/recruitment.service.ts:53-63` (`createPosting`) — IN_PROGRESS 전이 + FULFILLED 체크 활성화
- `apps/api/src/recruitment/recruitment.service.ts:240-272` (`completeMfa`) — fulfilledCount 증가 + FULFILLED 전이
- `apps/api/src/plan-report/plan-report.repo.ts` — `findHiringPlanItemById` select 확장 + `updateHiringPlanItemStatus`, `incrementFulfilledCount`, `cancelHiringPlanItem` 신규 + `listHiringPlanItems` status filter 확장
- `apps/api/src/plan-report/plan-report.service.ts` — `cancelHiringPlanItem` 신규 service 메서드
- `apps/api/src/plan-report/plan-report.controller.ts` — cancel handler + `listHiringItems` status query 지원
- `apps/api/src/plan-report/plan-report.routes.ts` — 신규 cancel route
- `apps/api/src/recruitment/recruitment.service.test.ts` — 신규 테스트 (IN_PROGRESS, FULFILLED, FULFILLED check)
- `apps/api/__test__/plan-report/plan-report.service.test.ts` — cancel + list filter 테스트

**Create:**
- `apps/api/prisma/migrations/{timestamp}_hiring_plan_item_status/migration.sql` — Prisma auto-gen + 수동 backfill

**No changes:**
- FE (`football/`) — 이 스코프는 BE only. FE badge/status UI 는 별도 이슈.

---

## Task 1: Schema + migration + backfill

**Files:**
- Modify: `apps/api/prisma/schema.prisma` — enum + HiringPlanItem 필드
- Create: `apps/api/prisma/migrations/{timestamp}_hiring_plan_item_status/migration.sql`

- [ ] **Step 1: `HiringPlanItemStatus` enum 추가**

`apps/api/prisma/schema.prisma` 의 `SurveyPriority` enum (~line 3587) 뒤에 추가:

```prisma
enum HiringPlanItemStatus {
  PLANNED
  IN_PROGRESS
  FULFILLED
  CANCELLED
}
```

- [ ] **Step 2: `HiringPlanItem` 에 3 필드 추가**

`apps/api/prisma/schema.prisma:3684-...` (HiringPlanItem 모델) 에 추가:

```prisma
model HiringPlanItem {
  id               Int            @id @default(autoincrement())
  planReportId     Int
  surveyResponseId Int?           @unique
  roleTitle        String
  headcount        Int
  quarter          Int?
  priority         SurveyPriority
  estimatedBudget  Int?
  status           HiringPlanItemStatus @default(PLANNED)   // ← 신규
  fulfilledCount   Int            @default(0)                // ← 신규
  fulfilledAt      DateTime?                                 // ← 신규
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  planReport     PlanReport      @relation(fields: [planReportId], references: [id], onDelete: Cascade)
  surveyResponse SurveyResponse? @relation(fields: [surveyResponseId], references: [id])
  jobPostings    JobPosting[]
}
```

- [ ] **Step 3: Schema 형식 확인**

Run:
```bash
cd apps/api && pnpm prisma format && pnpm prisma validate
```

Expected: "The schema is valid." 출력.

- [ ] **Step 4: Migration 생성**

Run:
```bash
cd apps/api && pnpm prisma migrate dev --name hiring_plan_item_status --create-only
```

`--create-only` 로 migration 파일만 생성 (자동 apply 안 함) — backfill SQL 추가 후 수동 apply.

Expected: `apps/api/prisma/migrations/{timestamp}_hiring_plan_item_status/migration.sql` 생성됨.

Read the generated SQL. Expected content (Prisma auto-gen):
```sql
-- CreateEnum
CREATE TYPE "HiringPlanItemStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED');

-- AlterTable
ALTER TABLE "HiringPlanItem" ADD COLUMN "status" "HiringPlanItemStatus" NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "HiringPlanItem" ADD COLUMN "fulfilledCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HiringPlanItem" ADD COLUMN "fulfilledAt" TIMESTAMP(3);
```

만약 예상 외 변경 (다른 필드 rename 등) 포함 시 **중단**.

- [ ] **Step 5: Migration SQL 에 backfill 추가**

생성된 migration.sql 끝에 추가:

```sql
-- Backfill: HiringPlanItem 이 JobPosting 을 이미 가지고 있으면 IN_PROGRESS 로 mark
UPDATE "HiringPlanItem" SET "status" = 'IN_PROGRESS'
WHERE id IN (SELECT DISTINCT "hiringPlanItemId" FROM "JobPosting" WHERE "hiringPlanItemId" IS NOT NULL);
```

**주의**: 완료된 채용 (headcount 도달) backfill 은 복잡 (StaffRecord/Application join 필요). HR 매니저가 수동으로 IN_PROGRESS → FULFILLED cancel/update 하도록 방침. Backfill 은 IN_PROGRESS 까지만.

- [ ] **Step 6: Migration 적용**

Run:
```bash
cd apps/api && pnpm prisma migrate deploy
```

Expected: migration 적용 성공. `pnpm prisma generate` 자동 재실행 됨.

만약 dev DB drift 로 실패 시 (#359 처럼) 수동 처리:
- `pnpm prisma db execute --file prisma/migrations/{new}/migration.sql`
- `pnpm prisma migrate resolve --applied {timestamp}_hiring_plan_item_status`
- `pnpm prisma generate`

- [ ] **Step 7: 기존 테스트 통과 확인 (regression 없음)**

Run:
```bash
cd apps/api && pnpm test -- src/recruitment/ __test__/plan-report/ 2>&1 | tail -15
```

Expected: 모두 통과 (이 단계에서는 status 필드 미사용 → breakage 없음).

---

## Task 2: Failing tests — state transitions

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.test.ts`

이 task 는 3 신규 시나리오 테스트 추가. Task 3 구현 후 통과.

- [ ] **Step 1: `createPosting` IN_PROGRESS 전이 테스트 추가**

`describe("RecruitmentService.createPosting", ...)` 블록에 추가 (기존 7 테스트 뒤):

```typescript
  it("첫 JobPosting 생성 시 HiringPlanItem status 를 IN_PROGRESS 로 전이", async () => {
    const updateHiringPlanItemStatus = jest.fn().mockResolvedValue({});
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1,
        status: "APPROVED",
        templateType: "HR",
        departmentId: 10,
        title: "test",
        jobPostings: [],
      }),
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500,
        planReportId: 1,
        status: "PLANNED",
      }),
      updateHiringPlanItemStatus,
    });

    await svc.createPosting({ ...validDto, hiringPlanItemId: 500 }, 42);

    expect(updateHiringPlanItemStatus).toHaveBeenCalledWith(500, "IN_PROGRESS");
  });

  it("이미 IN_PROGRESS 인 HiringPlanItem 은 status 재 update 안 함 (idempotent)", async () => {
    const updateHiringPlanItemStatus = jest.fn().mockResolvedValue({});
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1, status: "APPROVED", templateType: "HR",
        departmentId: 10, title: "test", jobPostings: [],
      }),
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, status: "IN_PROGRESS",
      }),
      updateHiringPlanItemStatus,
    });

    await svc.createPosting({ ...validDto, hiringPlanItemId: 500 }, 42);

    expect(updateHiringPlanItemStatus).not.toHaveBeenCalled();
  });

  it("HiringPlanItem status === 'FULFILLED' 이면 409 HIRING_PLAN_ITEM_ALREADY_FULFILLED", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1, status: "APPROVED", templateType: "HR",
        departmentId: 10, title: "test", jobPostings: [],
      }),
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, status: "FULFILLED",
      }),
    });

    await expect(svc.createPosting({ ...validDto, hiringPlanItemId: 500 }, 42))
      .rejects.toMatchObject({ statusCode: 409, message: "HIRING_PLAN_ITEM_ALREADY_FULFILLED" });
  });

  it("HiringPlanItem status === 'CANCELLED' 이면 409 HIRING_PLAN_ITEM_CANCELLED", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1, status: "APPROVED", templateType: "HR",
        departmentId: 10, title: "test", jobPostings: [],
      }),
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, status: "CANCELLED",
      }),
    });

    await expect(svc.createPosting({ ...validDto, hiringPlanItemId: 500 }, 42))
      .rejects.toMatchObject({ statusCode: 409, message: "HIRING_PLAN_ITEM_CANCELLED" });
  });
```

**주의**: 기존 `makePlanReportRepo` 의 default mock 도 업데이트 필요:
- `findHiringPlanItemById` return 에 `status: 'PLANNED'` 추가
- `updateHiringPlanItemStatus: jest.fn().mockResolvedValue({})` default 추가

```typescript
const makePlanReportRepo = (overrides: any = {}): any => ({
  findByIdLight: jest.fn().mockResolvedValue({ /* 기존 */ }),
  findHiringPlanItemById: jest.fn().mockResolvedValue({
    id: 500,
    planReportId: 1,
    status: "PLANNED",   // ← 신규 필드
  }),
  updateHiringPlanItemStatus: jest.fn().mockResolvedValue({}),   // ← 신규 mock
  ...overrides,
});
```

- [ ] **Step 2: `completeMfa` fulfilledCount + FULFILLED 전이 테스트 추가**

`recruitment.service.test.ts` 파일의 `describe('RecruitmentService.startOnboarding', ...)` 블록 뒤에 신규 describe 추가:

```typescript
describe("RecruitmentService.completeMfa (HiringPlanItem status)", () => {
  const makeMfaCtx = (repoOverrides: any = {}, planRepoOverrides: any = {}) => {
    const repo = makeRepo({
      findOnboardingByApplication: jest.fn().mockResolvedValue({
        id: 1, applicationId: 1, userId: 1,
        otpCode: "hash", otpExpiresAt: new Date(Date.now() + 60_000),
        emailVerifiedAt: new Date(),
        mfaRegisteredAt: null,
      }),
      markMfaRegistered: jest.fn().mockResolvedValue({ mfaRegisteredAt: new Date() }),
      findApplicationById: jest.fn().mockResolvedValue({
        id: 1,
        applicantName: "테스트",
        offeredById: 42,
        posting: {
          id: 100,
          title: "Coach",
          hiringPlanItemId: 500,
        },
      }),
      completeOnboarding: jest.fn().mockResolvedValue({}),
      ...repoOverrides,
    });
    const planRepo = {
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, headcount: 3, fulfilledCount: 0, status: "IN_PROGRESS",
      }),
      incrementFulfilledCount: jest.fn().mockResolvedValue({ fulfilledCount: 1 }),
      updateHiringPlanItemStatus: jest.fn().mockResolvedValue({}),
      ...planRepoOverrides,
    } as any;
    return { svc: new RecruitmentService(repo, undefined, planRepo), repo, planRepo };
  };

  it("Application 온보딩 완료 시 HiringPlanItem.fulfilledCount 증가", async () => {
    const { svc, planRepo } = makeMfaCtx();
    await svc.completeMfa(1);
    expect(planRepo.incrementFulfilledCount).toHaveBeenCalledWith(500);
  });

  it("fulfilledCount 가 headcount 도달 시 FULFILLED 로 전이 + fulfilledAt 세팅", async () => {
    const { svc, planRepo } = makeMfaCtx({}, {
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, headcount: 3, fulfilledCount: 2, status: "IN_PROGRESS",
      }),
      incrementFulfilledCount: jest.fn().mockResolvedValue({ fulfilledCount: 3 }),
    });
    await svc.completeMfa(1);
    expect(planRepo.updateHiringPlanItemStatus).toHaveBeenCalledWith(500, "FULFILLED", expect.any(Date));
  });

  it("fulfilledCount < headcount 이면 status 유지", async () => {
    const { svc, planRepo } = makeMfaCtx({}, {
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, headcount: 3, fulfilledCount: 0, status: "IN_PROGRESS",
      }),
      incrementFulfilledCount: jest.fn().mockResolvedValue({ fulfilledCount: 1 }),
    });
    await svc.completeMfa(1);
    expect(planRepo.updateHiringPlanItemStatus).not.toHaveBeenCalled();
  });

  it("posting 에 hiringPlanItemId 없으면 (legacy) fulfilledCount 증가 skip", async () => {
    const { svc, planRepo } = makeMfaCtx({
      findApplicationById: jest.fn().mockResolvedValue({
        id: 1, applicantName: "테스트", offeredById: 42,
        posting: { id: 100, title: "Coach", hiringPlanItemId: null },
      }),
    });
    await svc.completeMfa(1);
    expect(planRepo.incrementFulfilledCount).not.toHaveBeenCalled();
    expect(planRepo.updateHiringPlanItemStatus).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트 실행 (FAIL 예상)**

Run:
```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts 2>&1 | tail -30
```

Expected: 신규 8개 (createPosting 4 + completeMfa 4) 대부분 FAIL — service 에 로직 없음. 기존 테스트는 mock 업데이트로 대부분 PASS 유지.

---

## Task 3: Repo methods + service transitions

**Files:**
- Modify: `apps/api/src/plan-report/plan-report.repo.ts` — 3 신규 메서드
- Modify: `apps/api/src/recruitment/recruitment.service.ts:53-63` (createPosting) + `:240-272` (completeMfa)

- [ ] **Step 1: Repo 에 3 메서드 추가**

`apps/api/src/plan-report/plan-report.repo.ts` — `findHiringPlanItemById` (line 168-173) 뒤에 추가:

```typescript
  updateHiringPlanItemStatus(id: number, status: 'PLANNED' | 'IN_PROGRESS' | 'FULFILLED' | 'CANCELLED', fulfilledAt?: Date) {
    return this.prisma.hiringPlanItem.update({
      where: { id },
      data: {
        status,
        ...(fulfilledAt !== undefined && { fulfilledAt }),
      },
    })
  }

  incrementFulfilledCount(id: number) {
    return this.prisma.hiringPlanItem.update({
      where: { id },
      data: { fulfilledCount: { increment: 1 } },
      select: { id: true, headcount: true, fulfilledCount: true, status: true },
    })
  }

  cancelHiringPlanItem(id: number) {
    return this.prisma.hiringPlanItem.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
  }
```

또한 `findHiringPlanItemById` 의 select 를 확장 (status 필요):

```typescript
// 변경 전
findHiringPlanItemById(id: number) {
  return this.prisma.hiringPlanItem.findUnique({
    where: { id },
    select: { id: true, planReportId: true },
  })
}

// 변경 후
findHiringPlanItemById(id: number) {
  return this.prisma.hiringPlanItem.findUnique({
    where: { id },
    select: { id: true, planReportId: true, status: true, headcount: true, fulfilledCount: true },
  })
}
```

- [ ] **Step 2: `createPosting` 확장 — IN_PROGRESS 전이 + FULFILLED/CANCELLED 체크**

`apps/api/src/recruitment/recruitment.service.ts:53-63`:

```typescript
// 변경 전
async createPosting(dto: CreateJobPostingDto, createdById: number) {
  if (!this.planReportRepo) throw new AppError(500, "INTERNAL_ERROR");
  const planReport = await this.planReportRepo.findByIdLight(dto.planReportId);
  if (!planReport) throw new AppError(404, "PLAN_REPORT_NOT_FOUND");
  if (planReport.status !== "APPROVED") throw new AppError(409, "PLAN_REPORT_NOT_APPROVED");
  if (planReport.templateType !== "HR") throw new AppError(409, "PLAN_REPORT_NOT_HR_TYPE");

  if (!dto.hiringPlanItemId) throw new AppError(400, "HIRING_PLAN_ITEM_REQUIRED");
  const hiringPlanItem = await this.planReportRepo.findHiringPlanItemById(dto.hiringPlanItemId);
  if (!hiringPlanItem) throw new AppError(404, "HIRING_PLAN_ITEM_NOT_FOUND");
  if (hiringPlanItem.planReportId !== dto.planReportId) throw new AppError(400, "HIRING_PLAN_ITEM_MISMATCH");

  return this.repo.createPosting({ ...dto, createdById });
}

// 변경 후
async createPosting(dto: CreateJobPostingDto, createdById: number) {
  if (!this.planReportRepo) throw new AppError(500, "INTERNAL_ERROR");
  const planReport = await this.planReportRepo.findByIdLight(dto.planReportId);
  if (!planReport) throw new AppError(404, "PLAN_REPORT_NOT_FOUND");
  if (planReport.status !== "APPROVED") throw new AppError(409, "PLAN_REPORT_NOT_APPROVED");
  if (planReport.templateType !== "HR") throw new AppError(409, "PLAN_REPORT_NOT_HR_TYPE");

  if (!dto.hiringPlanItemId) throw new AppError(400, "HIRING_PLAN_ITEM_REQUIRED");
  const hiringPlanItem = await this.planReportRepo.findHiringPlanItemById(dto.hiringPlanItemId);
  if (!hiringPlanItem) throw new AppError(404, "HIRING_PLAN_ITEM_NOT_FOUND");
  if (hiringPlanItem.planReportId !== dto.planReportId) throw new AppError(400, "HIRING_PLAN_ITEM_MISMATCH");
  if (hiringPlanItem.status === "FULFILLED") throw new AppError(409, "HIRING_PLAN_ITEM_ALREADY_FULFILLED");
  if (hiringPlanItem.status === "CANCELLED") throw new AppError(409, "HIRING_PLAN_ITEM_CANCELLED");

  const posting = await this.repo.createPosting({ ...dto, createdById });

  // 첫 JobPosting 생성 시 PLANNED → IN_PROGRESS 전이 (idempotent)
  if (hiringPlanItem.status === "PLANNED") {
    await this.planReportRepo.updateHiringPlanItemStatus(dto.hiringPlanItemId, "IN_PROGRESS");
  }

  return posting;
}
```

- [ ] **Step 3: `completeMfa` 확장 — fulfilledCount + FULFILLED 전이**

`apps/api/src/recruitment/recruitment.service.ts:240-272`:

```typescript
// 변경 전 (line 240-272)
async completeMfa(applicationId: number) {
  const onboarding = await this.repo.findOnboardingByApplication(applicationId);
  if (!onboarding) throw new AppError(404, "ONBOARDING_NOT_FOUND");
  if (!onboarding.emailVerifiedAt) throw new AppError(409, "EMAIL_NOT_VERIFIED");
  if (onboarding.mfaRegisteredAt) throw new AppError(409, "MFA_ALREADY_REGISTERED");
  const result = await this.repo.markMfaRegistered(applicationId);

  // Mark application as ONBOARDED (system-initiated, no human actorId — use 0 as sentinel)
  const prisma = getPrisma();
  const application = await this.repo.findApplicationById(applicationId);
  if (application) {
    await this.repo.completeOnboarding(applicationId, 0);

    // Auto-create StaffRecord if not already exists
    const existingRecord = await prisma.staffRecord.findFirst({
      where: { employeeId: String(applicationId) },
    });
    if (!existingRecord) {
      await prisma.staffRecord.create({
        data: {
          name: application.applicantName,
          role: application.posting?.title ?? "Staff",
          employeeId: String(applicationId),
          isActive: true,
          createdById: application.offeredById ?? 1,
          employmentStartDate: new Date(),
        } as any,
      });
    }
  }

  return result;
}

// 변경 후
async completeMfa(applicationId: number) {
  const onboarding = await this.repo.findOnboardingByApplication(applicationId);
  if (!onboarding) throw new AppError(404, "ONBOARDING_NOT_FOUND");
  if (!onboarding.emailVerifiedAt) throw new AppError(409, "EMAIL_NOT_VERIFIED");
  if (onboarding.mfaRegisteredAt) throw new AppError(409, "MFA_ALREADY_REGISTERED");
  const result = await this.repo.markMfaRegistered(applicationId);

  const prisma = getPrisma();
  const application = await this.repo.findApplicationById(applicationId);
  if (application) {
    await this.repo.completeOnboarding(applicationId, 0);

    const existingRecord = await prisma.staffRecord.findFirst({
      where: { employeeId: String(applicationId) },
    });
    if (!existingRecord) {
      await prisma.staffRecord.create({
        data: {
          name: application.applicantName,
          role: application.posting?.title ?? "Staff",
          employeeId: String(applicationId),
          isActive: true,
          createdById: application.offeredById ?? 1,
          employmentStartDate: new Date(),
        } as any,
      });
    }

    // HiringPlanItem fulfilledCount 증가 + FULFILLED 전이 (posting 이 hiringPlanItemId 를 가진 경우만)
    const hiringPlanItemId = (application.posting as any)?.hiringPlanItemId;
    if (hiringPlanItemId && this.planReportRepo) {
      const updated = await this.planReportRepo.incrementFulfilledCount(hiringPlanItemId);
      if (updated.fulfilledCount >= updated.headcount && updated.status !== "FULFILLED") {
        await this.planReportRepo.updateHiringPlanItemStatus(hiringPlanItemId, "FULFILLED", new Date());
      }
    }
  }

  return result;
}
```

**주의**: `application.posting` 는 이미 include 로 반환되지만, 현재 `recruitment.repo.ts:24` 의 `APPLICATION_INCLUDE` (또는 유사 상수) 는 `posting: { select: { id: true, title: true } }` — `hiringPlanItemId` 미포함. **먼저 select 를 확장해야 함**:

```typescript
// apps/api/src/recruitment/recruitment.repo.ts (기존 APPLICATION_INCLUDE 상수)
// 변경 전
posting: { select: { id: true, title: true } },

// 변경 후
posting: { select: { id: true, title: true, hiringPlanItemId: true } },
```

이 변경 없이는 completeMfa 에서 `application.posting.hiringPlanItemId` 가 undefined 로 나와 fulfilledCount 증가 로직이 항상 skip 됨 (테스트는 mock 값 사용해서 통과하지만 프로덕션에서 안 작동).

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts 2>&1 | tail -30
```

Expected: 신규 8개 (Task 2 Step 1+2) 모두 PASS + 기존 유지.

- [ ] **Step 5: TypeScript 컴파일**

Run:
```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -10
```

Expected: 신규 에러 없음. 기존 pre-existing 9개 unrelated 에러는 그대로.

---

## Task 4: Cancel API + list filter

**Files:**
- Modify: `apps/api/src/plan-report/plan-report.service.ts` — `cancelHiringPlanItem` 신규
- Modify: `apps/api/src/plan-report/plan-report.controller.ts` — handler
- Modify: `apps/api/src/plan-report/plan-report.routes.ts` — 신규 route
- Modify: `apps/api/src/plan-report/plan-report.repo.ts:222-228` — `listHiringPlanItems` status 필터
- Modify: `apps/api/__test__/plan-report/plan-report.service.test.ts` — 신규 테스트

- [ ] **Step 1: Cancel service method 추가**

`apps/api/src/plan-report/plan-report.service.ts` 에 신규 메서드 (파일 끝):

```typescript
  async cancelHiringPlanItem(id: number, planReportId: number) {
    // 검증: item 존재 + 같은 planReport 소속 + 이미 CANCELLED 가 아님
    const item = await this.repo.findHiringPlanItemById(id)
    if (!item) throw new AppError(404, 'HIRING_PLAN_ITEM_NOT_FOUND')
    if (item.planReportId !== planReportId) throw new AppError(400, 'HIRING_PLAN_ITEM_MISMATCH')
    if (item.status === 'CANCELLED') throw new AppError(409, 'HIRING_PLAN_ITEM_ALREADY_CANCELLED')

    return this.repo.cancelHiringPlanItem(id)
  }
```

- [ ] **Step 2: Controller handler 추가**

`apps/api/src/plan-report/plan-report.controller.ts` — 기존 hiring-item handlers (`createHiringItem`, `updateHiringItem`, `deleteHiringItem`) 뒤에 추가:

```typescript
  cancelHiringItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planReportId = Number(req.params.id)
      const itemId = Number(req.params.itemId)
      const result = await this.service.cancelHiringPlanItem(itemId, planReportId)
      res.json(result)
    } catch (e) { next(e) }
  }
```

- [ ] **Step 3: Route 등록**

`apps/api/src/plan-report/plan-report.routes.ts` — 기존 hiring-items route 근처 (`plan-report.routes.ts:52` 부근) 에 추가:

```typescript
router.patch('/:id/hiring-items/:itemId/cancel', auth, checkWriteHR, controller.cancelHiringItem)
```

- [ ] **Step 4: `listHiringPlanItems` status 필터 지원**

`apps/api/src/plan-report/plan-report.repo.ts:222-228` — `listHiringPlanItems` 변경:

```typescript
// 변경 전
listHiringPlanItems(planReportId: number) {
  return this.prisma.hiringPlanItem.findMany({
    where: { planReportId },
    include: { surveyResponse: { select: { id: true, departmentId: true } } },
    orderBy: { createdAt: 'asc' },
  })
}

// 변경 후
listHiringPlanItems(planReportId: number, statusFilter?: ('PLANNED' | 'IN_PROGRESS' | 'FULFILLED' | 'CANCELLED')[]) {
  return this.prisma.hiringPlanItem.findMany({
    where: {
      planReportId,
      ...(statusFilter && statusFilter.length > 0 && { status: { in: statusFilter } }),
    },
    include: { surveyResponse: { select: { id: true, departmentId: true } } },
    orderBy: { createdAt: 'asc' },
  })
}
```

Controller 도 status query param 지원 확장 (기존 `listHiringItems` handler 확장):

`apps/api/src/plan-report/plan-report.controller.ts` — `listHiringItems`:
```typescript
// 변경 전
listHiringItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await this.repo.listHiringPlanItems(Number(req.params.id))
    res.json(items)
  } catch (e) { next(e) }
}

// 변경 후
listHiringItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statusParam = req.query.status
    const statusFilter = typeof statusParam === 'string'
      ? (statusParam.split(',').filter(s => ['PLANNED', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED'].includes(s)) as any[])
      : undefined
    const items = await this.repo.listHiringPlanItems(Number(req.params.id), statusFilter)
    res.json(items)
  } catch (e) { next(e) }
}
```

- [ ] **Step 5: Cancel + list filter 테스트 추가**

`apps/api/__test__/plan-report/plan-report.service.test.ts` — 파일 끝에 추가:

```typescript
describe('PlanReportService.cancelHiringPlanItem', () => {
  const makeCtx = (repoOverrides: any = {}) => {
    const repo = {
      findHiringPlanItemById: jest.fn(),
      cancelHiringPlanItem: jest.fn(),
      ...repoOverrides,
    } as any
    return { svc: new PlanReportService(repo), repo }
  }

  test('DRAFT/IN_PROGRESS item cancel 성공', async () => {
    const { svc, repo } = makeCtx({
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, status: 'IN_PROGRESS',
      }),
      cancelHiringPlanItem: jest.fn().mockResolvedValue({ id: 500, status: 'CANCELLED' }),
    })
    const result = await svc.cancelHiringPlanItem(500, 1)
    expect(repo.cancelHiringPlanItem).toHaveBeenCalledWith(500)
    expect(result.status).toBe('CANCELLED')
  })

  test('없는 item → 404 HIRING_PLAN_ITEM_NOT_FOUND', async () => {
    const { svc } = makeCtx({
      findHiringPlanItemById: jest.fn().mockResolvedValue(null),
    })
    await expect(svc.cancelHiringPlanItem(999, 1))
      .rejects.toMatchObject({ statusCode: 404, code: 'HIRING_PLAN_ITEM_NOT_FOUND' })
  })

  test('다른 planReport 소속 → 400 HIRING_PLAN_ITEM_MISMATCH', async () => {
    const { svc } = makeCtx({
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 999, status: 'PLANNED',
      }),
    })
    await expect(svc.cancelHiringPlanItem(500, 1))
      .rejects.toMatchObject({ statusCode: 400, code: 'HIRING_PLAN_ITEM_MISMATCH' })
  })

  test('이미 CANCELLED → 409 HIRING_PLAN_ITEM_ALREADY_CANCELLED', async () => {
    const { svc } = makeCtx({
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, status: 'CANCELLED',
      }),
    })
    await expect(svc.cancelHiringPlanItem(500, 1))
      .rejects.toMatchObject({ statusCode: 409, code: 'HIRING_PLAN_ITEM_ALREADY_CANCELLED' })
  })
})

describe('PlanReportRepository.listHiringPlanItems (status filter)', () => {
  const makePrismaMock = () => ({
    hiringPlanItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any)

  test('status filter 없으면 planReportId 만 매칭', async () => {
    const prisma = makePrismaMock()
    const repo = new PlanReportRepository(prisma)
    await repo.listHiringPlanItems(1)
    const call = (prisma.hiringPlanItem.findMany as jest.Mock).mock.calls[0][0]
    expect(call.where).toEqual({ planReportId: 1 })
  })

  test('status filter 있으면 status: { in: [...] } 추가', async () => {
    const prisma = makePrismaMock()
    const repo = new PlanReportRepository(prisma)
    await repo.listHiringPlanItems(1, ['PLANNED', 'IN_PROGRESS'])
    const call = (prisma.hiringPlanItem.findMany as jest.Mock).mock.calls[0][0]
    expect(call.where).toEqual({
      planReportId: 1,
      status: { in: ['PLANNED', 'IN_PROGRESS'] },
    })
  })
})
```

- [ ] **Step 6: 테스트 실행**

Run:
```bash
cd apps/api && pnpm test -- __test__/plan-report/plan-report.service.test.ts 2>&1 | tail -20
```

Expected: 신규 6개 (cancel 4 + list filter 2) 모두 PASS.

---

## Task 5: Verify + commit

- [ ] **Step 1: 전체 스코프 테스트**

Run:
```bash
cd apps/api && pnpm test -- src/recruitment/ src/plan-report/ __test__/plan-report/ __test__/recruitment/ 2>&1 | tail -15
```

Expected: 모두 PASS (기존 + 신규 ~14개). Pre-existing AuditLog 실패 유지 OK.

- [ ] **Step 2: TypeScript 컴파일**

BE:
```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -10
```

FE (변경 없지만 회귀 없음 확인):
```bash
cd football && pnpm tsc --noEmit 2>&1 | tail -10
```

Expected: 신규 에러 없음.

- [ ] **Step 3: git status 확인 + commit**

```bash
git status --short
```

Expected 파일 리스트:
- Modified: schema.prisma, recruitment.service.ts, plan-report.repo.ts, plan-report.service.ts, plan-report.controller.ts, plan-report.routes.ts, recruitment.service.test.ts, __test__/plan-report/plan-report.service.test.ts
- Untracked: migration folder, plan doc

```bash
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations \
        apps/api/src/recruitment/recruitment.service.ts \
        apps/api/src/plan-report \
        apps/api/src/recruitment/recruitment.service.test.ts \
        apps/api/__test__/plan-report/plan-report.service.test.ts \
        docs/superpowers/plans/2026-08-26-hiring-plan-item-status.md

git commit -m "$(cat <<'EOF'
feat(recruitment): HiringPlanItem status tracking (fix #362)

- schema: HiringPlanItemStatus enum (PLANNED|IN_PROGRESS|FULFILLED|CANCELLED) + status/fulfilledCount/fulfilledAt 필드 추가
- migration: backfill for records with existing JobPosting (→ IN_PROGRESS)
- service.createPosting: PLANNED → IN_PROGRESS 자동 전이 + FULFILLED/CANCELLED item 재사용 차단 (#363 deferred 체크 활성화)
- service.completeMfa: fulfilledCount++ + headcount 도달 시 FULFILLED 자동 전이
- API: PATCH /plan-reports/:id/hiring-items/:itemId/cancel (HR 만)
- repo: listHiringPlanItems 에 status 필터 지원 (예: ?status=PLANNED,IN_PROGRESS)
- tests: 신규 14개 (createPosting status 4 + completeMfa 4 + cancel 4 + list filter 2)

HiringPlanItem 완료 추적 가능. getHeadcountProgress 등 분석 API 정확도 향상. #363 의 FULFILLED 재사용 방지 체크가 이 PR 로 활성화됨.

Closes #362

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git log -1 --stat
```

---

## Self-Review Checklist

**1. Spec coverage** (#362 acceptance):
- [x] status/fulfilledAt/fulfilledCount 필드 추가 → Task 1
- [x] JobPosting 첫 생성 시 PLANNED → IN_PROGRESS → Task 3 Step 2
- [x] Application ONBOARDED → fulfilledCount++ , headcount 도달 시 FULFILLED → Task 3 Step 3
- [x] HR 매니저 취소 API → Task 4
- [x] listHiringPlanItems status filter → Task 4
- [x] Backfill: 기존 JobPosting 연결 item 은 IN_PROGRESS → Task 1 Step 5
- [x] #363 의 FULFILLED 체크 활성화 → Task 3 Step 2 (createPosting 확장 안 status === "FULFILLED" 체크)

**2. Placeholder scan:** `{timestamp}` 는 Prisma 자동 생성. `{new}` 는 실행 시점 대체 명확 표시.

**3. Type consistency:**
- `HiringPlanItemStatus` 4 값 일관 사용
- Method 이름: `updateHiringPlanItemStatus`, `incrementFulfilledCount`, `cancelHiringPlanItem` 일관
- Error code: `HIRING_PLAN_ITEM_ALREADY_FULFILLED`, `_CANCELLED`, `_ALREADY_CANCELLED` 명명 일관

## 실행 후 확인 사항

- [ ] Migration SQL 이 3 ADD COLUMN + 1 CREATE ENUM + backfill UPDATE 만 포함
- [ ] `pnpm test` 전체 스코프 통과 (신규 14개 + 기존 유지)
- [ ] `pnpm tsc --noEmit` 신규 에러 없음
- [ ] FE 회귀 없음 (FE 변경 없지만 tsc 재확인)
- [ ] 배포 후: 기존 posting 있는 item 들 status 확인 (backfill 잘 됐는지)
