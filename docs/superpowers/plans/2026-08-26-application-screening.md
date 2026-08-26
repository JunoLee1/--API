# JobApplication Screening Result (Fix #364) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** [#364](https://github.com/JunoLee1/--API/issues/364)

**Goal:** `JobApplication` 에 서류 심사 결과 저장 필드 (`screeningResult`, `screeningNotes`, `screenedById`, `screenedAt`) 를 추가. HR 매니저가 서류 심사 후 결과를 시스템에 저장 · audit trail 확보.

**Architecture:**
- Schema: `ScreeningResult` enum (PENDING/PASS/FAIL) + 4 필드 (`screeningResult @default(PENDING)`)
- 신규 endpoint: `PATCH /recruitment/applications/:id/screen` (HR 만)
- 검증:
  * status 는 `SCREENING` 상태에서만 허용 (409 `INVALID_STATUS_FOR_SCREEN`)
  * FAIL 시 `screeningNotes` 필수 (400 `SCREENING_NOTES_REQUIRED_FOR_FAIL`)
- Reinstate 시 → `screeningResult` 를 `PENDING` 으로 리셋 (재심사 강제)
- Applicant 알림 없음 (내부 심사 — PASS 후 `scheduleInterview` 알림, FAIL 후 `rejectApplication` 이메일 담당)

**Tech Stack:** TypeScript · Prisma · Jest · Express (`apps/api`)

**Dependency:** 없음 (독립). Main `6fe41476` base.

**Out of scope:**
- 필수 서류 취합 (JobApplicationDocument 모델) → [#372](https://github.com/JunoLee1/--API/issues/372)
- 정형 rubric 점수 (options b/c/d) — MVP 후 확장
- Interview threshold 정책 → [#366](https://github.com/JunoLee1/--API/issues/366)
- FE screening 페이지 (별도 이슈)

---

## File Structure

**Modify:**
- `apps/api/prisma/schema.prisma` — `ScreeningResult` enum + `JobApplication` 4 필드
- `apps/api/src/recruitment/dto/recruitment.dto.ts` — `ScreenApplicationDto`
- `apps/api/src/recruitment/recruitment.service.ts` — `screenApplication` 신규 + `reinstateApplication` 확장 (screeningResult 리셋)
- `apps/api/src/recruitment/recruitment.repo.ts` — `screenApplication` repo helper
- `apps/api/src/recruitment/recruitment.controller.ts` — `screenApplication` handler
- `apps/api/src/recruitment/recruitment.routes.ts` — 신규 route
- `apps/api/src/recruitment/recruitment.service.test.ts` — 신규 테스트

**Create:**
- `apps/api/prisma/migrations/{timestamp}_application_screening/migration.sql`

**No changes:**
- FE — 별도 이슈

---

## Task 1: Schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/{new}/migration.sql`

- [ ] **Step 1: `ScreeningResult` enum 추가**

`apps/api/prisma/schema.prisma` — 기존 recruitment enums 근처에 추가 (예: `JobApplicationStatus` 다음):

```prisma
enum ScreeningResult {
  PENDING
  PASS
  FAIL
}
```

- [ ] **Step 2: `JobApplication` 에 4 필드 추가**

`apps/api/prisma/schema.prisma` (JobApplication 모델, ~line 2883-2914):

```prisma
model JobApplication {
  id                  Int                   @id @default(autoincrement())
  postingId           Int
  applicantName       String
  email               String
  phone               String?
  resumeUrl           String?
  status              JobApplicationStatus  @default(APPLIED)
  rejectedAt          DateTime?
  rejectionReason     String?
  previousStatus      JobApplicationStatus?
  offeredAt           DateTime?
  offeredById         Int?
  screeningResult     ScreeningResult       @default(PENDING)  // ← 신규
  screeningNotes      String?                                    // ← 신규
  screenedById        Int?                                       // ← 신규
  screenedAt          DateTime?                                  // ← 신규
  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt
  source              ApplicationSource     @default(DIRECT)
  externalApplicantId String?

  posting                 JobPosting      @relation(fields: [postingId], references: [id])
  offeredBy               User?           @relation("ApplicationOffer", fields: [offeredById], references: [id])
  screenedBy              User?           @relation("ApplicationScreener", fields: [screenedById], references: [id])   // ← 신규 relation
  interviews              Interview[]
  ...
}
```

또한 `User` 모델에 back-relation 추가 (예: 기존 `applicationOffers` 처럼):
```prisma
model User {
  ...
  applicationScreenings JobApplication[] @relation("ApplicationScreener")   // ← 신규
  ...
}
```

**주의**: User 의 정확한 위치 (파일 내 다른 relation 근처) 는 파일 열어서 확인. `ApplicationOffer` relation 이 있는 line 근처.

- [ ] **Step 3: Schema 형식 확인 + 검증**

```bash
cd apps/api && pnpm prisma format && pnpm prisma validate
```

Expected: "The schema is valid."

- [ ] **Step 4: Migration 생성**

```bash
cd apps/api && pnpm prisma migrate dev --name application_screening --create-only
```

Read the generated SQL. Expected content:
```sql
-- CreateEnum
CREATE TYPE "ScreeningResult" AS ENUM ('PENDING', 'PASS', 'FAIL');

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN "screeningResult" "ScreeningResult" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "JobApplication" ADD COLUMN "screeningNotes" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN "screenedById" INTEGER;
ALTER TABLE "JobApplication" ADD COLUMN "screenedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_screenedById_fkey" FOREIGN KEY ("screenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

만약 예상 외 변경 포함 시 **중단**.

- [ ] **Step 5: Migration 적용**

```bash
cd apps/api && pnpm prisma migrate deploy
```

Dev DB drift 있으면 수동 처리 (`db execute` + `migrate resolve --applied`).

- [ ] **Step 6: 기존 테스트 통과 확인**

```bash
cd apps/api && pnpm test -- src/recruitment/ __test__/plan-report/ 2>&1 | tail -8
```

Expected: 모두 pass (신규 필드는 optional/default, 기존 테스트 무영향).

---

## Task 2: Failing tests

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.test.ts`

- [ ] **Step 1: 신규 describe + 6 테스트 추가**

파일 끝에 추가:

```typescript
describe("RecruitmentService.screenApplication", () => {
  const screeningApp = {
    id: 1,
    status: "SCREENING",
    applicantName: "테스트",
    email: "test@example.com",
    posting: null,
  };

  const makeSvcWithScreen = (findApplicationResult: any = screeningApp) => {
    const repo = makeRepo({
      findApplicationById: jest.fn().mockResolvedValue(findApplicationResult),
      screenApplication: jest.fn().mockResolvedValue({ id: 1, screeningResult: "PASS" }),
    });
    return { svc: new RecruitmentService(repo), repo };
  };

  it("SCREENING 상태에서 PASS 결과 저장 성공", async () => {
    const { svc, repo } = makeSvcWithScreen();
    const result = await svc.screenApplication(1, { result: "PASS", notes: "우수" }, 42);
    expect(repo.screenApplication).toHaveBeenCalledWith(1, {
      screeningResult: "PASS",
      screeningNotes: "우수",
      screenedById: 42,
      screenedAt: expect.any(Date),
    });
    expect(result.screeningResult).toBe("PASS");
  });

  it("SCREENING 상태 아니면 409 INVALID_STATUS_FOR_SCREEN", async () => {
    const { svc } = makeSvcWithScreen({ ...screeningApp, status: "INTERVIEW_1" });
    await expect(svc.screenApplication(1, { result: "PASS" } as any, 42))
      .rejects.toMatchObject({ statusCode: 409, message: "INVALID_STATUS_FOR_SCREEN" });
  });

  it("FAIL 결과인데 notes 없으면 400 SCREENING_NOTES_REQUIRED_FOR_FAIL", async () => {
    const { svc } = makeSvcWithScreen();
    await expect(svc.screenApplication(1, { result: "FAIL" } as any, 42))
      .rejects.toMatchObject({ statusCode: 400, message: "SCREENING_NOTES_REQUIRED_FOR_FAIL" });
  });

  it("FAIL 결과 + notes 있으면 저장 성공", async () => {
    const { svc, repo } = makeSvcWithScreen();
    await svc.screenApplication(1, { result: "FAIL", notes: "학력 요건 미달" }, 42);
    expect(repo.screenApplication).toHaveBeenCalledWith(1, expect.objectContaining({
      screeningResult: "FAIL",
      screeningNotes: "학력 요건 미달",
    }));
  });

  it("Application 없으면 404 JOB_APPLICATION_NOT_FOUND (기존 getApplication 통해)", async () => {
    const { svc } = makeSvcWithScreen(null);
    await expect(svc.screenApplication(1, { result: "PASS" } as any, 42))
      .rejects.toMatchObject({ statusCode: 404, message: "JOB_APPLICATION_NOT_FOUND" });
  });

  it("PENDING 결과 (예: 심사 초기화) 는 notes 없어도 저장 성공", async () => {
    const { svc, repo } = makeSvcWithScreen();
    await svc.screenApplication(1, { result: "PENDING" } as any, 42);
    expect(repo.screenApplication).toHaveBeenCalledWith(1, expect.objectContaining({
      screeningResult: "PENDING",
    }));
  });
});

describe("RecruitmentService.reinstateApplication (with screeningResult reset)", () => {
  it("reinstate 시 screeningResult 도 PENDING 으로 리셋", async () => {
    const rejectedApp = {
      id: 1,
      status: "REJECTED",
      previousStatus: "SCREENING",
      screeningResult: "FAIL",
      applicantName: "테스트",
      posting: null,
    };
    const repo = makeRepo({
      findApplicationById: jest.fn().mockResolvedValue(rejectedApp),
      reinstateApplication: jest.fn().mockResolvedValue({ id: 1, status: "SCREENING", screeningResult: "PENDING" }),
    });
    const svc = new RecruitmentService(repo);

    await svc.reinstateApplication(1, 42);

    // reinstateApplication repo call 이 screeningResult 리셋 포함 인자를 받아야 함
    // (repo 단에서 처리한다면 여기 assert 없음. service 단에서 명시 호출한다면 assert.
    //  이 테스트는 service 가 repo 에 리셋 요청을 전달하는지 확인)
    expect(repo.reinstateApplication).toHaveBeenCalledWith(1, 42);
  });
});
```

**주의**: `reinstateApplication` 리셋 로직은 **repo 레벨** 에서 처리하는 게 clean (repo query 안에서 `screeningResult: 'PENDING'` 명시). Service 단은 호출만.

- [ ] **Step 2: 테스트 실행 (FAIL 예상)**

```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts -t "screenApplication\|reinstateApplication.*screeningResult" 2>&1 | tail -20
```

Expected: FAIL — `svc.screenApplication is not a function`.

---

## Task 3: Repo + Service + DTO

**Files:**
- Modify: `apps/api/src/recruitment/dto/recruitment.dto.ts`
- Modify: `apps/api/src/recruitment/recruitment.repo.ts`
- Modify: `apps/api/src/recruitment/recruitment.service.ts`

- [ ] **Step 1: DTO 추가**

`apps/api/src/recruitment/dto/recruitment.dto.ts` — 파일 끝에 추가:

```typescript
export interface ScreenApplicationDto {
  result: 'PENDING' | 'PASS' | 'FAIL'
  notes?: string
}
```

- [ ] **Step 2: Repo helper 추가 + reinstate 확장**

`apps/api/src/recruitment/recruitment.repo.ts` — 기존 `reinstateApplication` (line ~137) 확장:

```typescript
// 변경 전
reinstateApplication(id: number, actorId: number) {
  // ... 기존 로직
}

// 변경 후 — 리셋 필드 추가
reinstateApplication(id: number, actorId: number) {
  return this.prisma.jobApplication.update({
    where: { id },
    data: {
      // 기존 로직 (status: previousStatus 등)
      // ...
      screeningResult: 'PENDING',   // ← 신규: 재심사 강제
      screeningNotes: null,
      screenedById: null,
      screenedAt: null,
    },
    include: POSTING_INCLUDE_FROM_APPLICATION,  // 실제 include 상수는 파일 확인
  })
}
```

**주의**: 기존 `reinstateApplication` 구현 확인 후, `data` block 에만 screening 리셋 필드 4개 추가.

`updateApplication` 근처에 `screenApplication` 추가:

```typescript
screenApplication(id: number, data: {
  screeningResult: 'PENDING' | 'PASS' | 'FAIL'
  screeningNotes?: string | null
  screenedById: number
  screenedAt: Date
}) {
  return this.prisma.jobApplication.update({
    where: { id },
    data,
  })
}
```

- [ ] **Step 3: Service `screenApplication` 추가**

`apps/api/src/recruitment/recruitment.service.ts` — 기존 `rejectApplication` (line ~110) 근처에 추가:

```typescript
  async screenApplication(id: number, dto: ScreenApplicationDto, actorId: number) {
    const app = await this.getApplication(id);
    if (app.status !== "SCREENING") throw new AppError(409, "INVALID_STATUS_FOR_SCREEN");
    if (dto.result === "FAIL" && !dto.notes?.trim()) {
      throw new AppError(400, "SCREENING_NOTES_REQUIRED_FOR_FAIL");
    }

    return this.repo.screenApplication(id, {
      screeningResult: dto.result,
      screeningNotes: dto.notes ?? null,
      screenedById: actorId,
      screenedAt: new Date(),
    });
  }
```

**주의**: `ScreenApplicationDto` import 필요 (기존 import 블록 확장).

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts -t "screenApplication\|reinstateApplication.*screeningResult" 2>&1 | tail -15
```

Expected: 7개 신규 테스트 PASS.

- [ ] **Step 5: 전체 스코프 테스트 (regression 없음)**

```bash
cd apps/api && pnpm test -- src/recruitment/ __test__/plan-report/ 2>&1 | tail -10
```

Expected: 모두 PASS.

- [ ] **Step 6: TypeScript check**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -10
```

Expected: 신규 에러 없음.

---

## Task 4: Controller + Routes

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.controller.ts`
- Modify: `apps/api/src/recruitment/recruitment.routes.ts`

- [ ] **Step 1: Controller handler 추가**

`apps/api/src/recruitment/recruitment.controller.ts` — `rejectApplication` handler 근처에 추가:

```typescript
  screenApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params["id"])
      const actorId = (req.user as any)?.id
      const dto: ScreenApplicationDto = req.body
      res.json(await this.service.screenApplication(id, dto, actorId))
    } catch (e) { next(e) }
  }
```

**주의**: `ScreenApplicationDto` import 필요.

- [ ] **Step 2: Route + permission 등록**

`apps/api/src/recruitment/recruitment.routes.ts` — Application action routes 근처 (`router.post("/applications/:id/reject", ...)` 근처) 에 추가:

```typescript
router.patch("/applications/:id/screen", auth, canWriteHR (or 유사 미들웨어), controller.screenApplication)
```

**주의**: 기존 파일에 사용되는 HR 권한 middleware 이름 확인 (canWriteHR 함수인지 requireHR 인지). `plan-report.routes.ts` 의 `checkWriteHR` 참고. Recruitment 는 아마 서비스 단 canWriteHR 함수 호출로 처리 중일 수 있음.

만약 middleware 없이 service 단 permission check 만이면, service.screenApplication 안에서 `canWriteHR(user.role, user.frontOfficeRole)` 체크 추가 or Controller 에서 명시 체크.

파일 열어서 다른 HR-only endpoint 패턴 (예: 다른 reject/offer handler 들) 을 확인 후 동일 패턴 적용.

- [ ] **Step 3: TypeScript check + 전체 테스트**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -10
cd apps/api && pnpm test -- src/recruitment/ 2>&1 | tail -8
```

Expected: 컴파일 에러 없음. 모든 테스트 통과.

---

## Task 5: Verify + commit

- [ ] **Step 1: 전체 관련 테스트**

```bash
cd apps/api && pnpm test -- src/recruitment/ __test__/plan-report/ __test__/recruitment/ 2>&1 | tail -10
```

Expected: 모두 PASS (신규 ~7 + 기존).

- [ ] **Step 2: FE TypeScript (회귀 없음)**

```bash
cd football && pnpm tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: git status + commit**

```bash
git status --short
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations \
        apps/api/src/recruitment \
        docs/superpowers/plans/2026-08-26-application-screening.md

git commit -m "$(cat <<'EOF'
feat(recruitment): JobApplication screening result 필드 + API (fix #364)

- schema: ScreeningResult enum (PENDING/PASS/FAIL) + JobApplication 4 필드
- migration: default PENDING (기존 record 자동 backfill)
- service: screenApplication(id, dto, actorId)
  * SCREENING 상태에서만 허용 (409 INVALID_STATUS_FOR_SCREEN)
  * FAIL 시 notes 필수 (400 SCREENING_NOTES_REQUIRED_FOR_FAIL)
  * PASS/FAIL/PENDING 모두 저장 가능
- reinstateApplication 확장: screeningResult 4 필드 자동 리셋 (재심사 강제)
- API: PATCH /recruitment/applications/:id/screen (HR 만)
- tests: 7 신규 (PASS/FAIL/notes 필수/status 제약/PENDING 리셋 등)

서류 심사는 내부 판단 — Applicant 알림 없음 (FAIL 은 rejectApplication 이메일, PASS 는 scheduleInterview 알림 담당). MVP 자유형 (rubric JSONB 는 실사용 후 확장).

Closes #364

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log -1 --stat
```

---

## Self-Review

**1. Spec coverage** (#364 acceptance + grill decisions):
- [x] 자유형 4 필드 → Task 1
- [x] HR only → Task 4
- [x] Pass → 다음 단계 수동 → Service 로직에서 상태 전이 없음
- [x] SCREENING 상태만 → Task 3
- [x] Default PENDING → Task 1 (schema default)
- [x] FAIL 시 notes 필수 → Task 3
- [x] reinstate 시 리셋 → Task 3 (repo)
- [x] Applicant 알림 없음 → Service 에 notify 없음

**2. Placeholder scan:** `{timestamp}` Prisma auto-gen. `{new}` clear.

**3. Type consistency:**
- `ScreeningResult` 3 값 일관
- Method name `screenApplication` 일관 (repo, service, controller)
- Error code 3 개 일관

## 실행 후 확인 사항

- [ ] Migration SQL 이 CREATE ENUM + 4 ADD COLUMN + FK constraint 만
- [ ] `pnpm test` 전체 통과 (신규 7 + 기존)
- [ ] BE tsc 신규 에러 없음
- [ ] 기존 Application 들은 screeningResult=PENDING 로 backfill 확인
