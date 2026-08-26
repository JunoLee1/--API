# PlanReport ↔ JobPosting 1:1 → 1:N Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** [#359](https://github.com/JunoLee1/--API/issues/359)

**Goal:** HR 계획서(`PlanReport with templateType='HR'`) 에 여러 `HiringPlanItem` 이 있어도 각각에 대해 독립적으로 `JobPosting` 을 생성할 수 있도록 1:1 강제를 제거한다.

**Architecture:**
- Schema: `JobPosting.planReportId` 의 `@unique` 제약 제거. `PlanReport.jobPosting JobPosting?` (1:1) → `jobPostings JobPosting[]` (1:N).
- Service: `recruitment.service.createPosting()` 의 `PLAN_REPORT_ALREADY_LINKED` 체크 삭제.
- Repo: `findByIdLight` 에서 이제 사용되지 않는 `jobPosting` select 제거, `findApprovedHrReports` 를 "미완료 HiringPlanItem 잔여 여부" semantics 로 재정의.
- Migration: Prisma 가 auto-generate (unique constraint drop).

**Tech Stack:** TypeScript · Prisma · Jest · Express (`apps/api`), React+Vite (`football/`)

**Out of scope (별도 이슈):**
- `hiringPlanItemId` required 화 → [#363](https://github.com/JunoLee1/--API/issues/363)
- Bulk publish endpoint → [#361](https://github.com/JunoLee1/--API/issues/361)
- HiringPlanItem status 추적 → [#362](https://github.com/JunoLee1/--API/issues/362)
- Cron 우회 정리 → [#360](https://github.com/JunoLee1/--API/issues/360)

---

## File Structure

각 파일 하나의 명확한 책임을 가짐. 이 fix 는 최소 스코프로 5개 파일만 건드림.

**Modify:**
- `apps/api/prisma/schema.prisma:2872` — `JobPosting.planReportId` `@unique` 제거
- `apps/api/prisma/schema.prisma:3627` — `PlanReport.jobPosting JobPosting?` → `jobPostings JobPosting[]`
- `apps/api/src/recruitment/recruitment.service.ts:59` — `PLAN_REPORT_ALREADY_LINKED` 체크 삭제
- `apps/api/src/plan-report/plan-report.repo.ts:161-166` — `findByIdLight` 에서 `jobPosting` select 제거
- `apps/api/src/plan-report/plan-report.repo.ts:168-174` — `findApprovedHrReports` 새 semantics
- `apps/api/src/recruitment/recruitment.service.test.ts` — 신규 `describe("RecruitmentService.createPosting")` 추가
- `apps/api/src/plan-report/plan-report.service.test.ts` OR `apps/api/__test__/plan-report/plan-report.service.test.ts` — `findApprovedHrReports` 신 semantics 테스트

**Create:**
- `apps/api/prisma/migrations/YYYYMMDDHHMMSS_planreport_jobposting_1n/migration.sql` — Prisma auto-generated

**Verify (no changes):**
- `football/src/services/plan-report.service.ts:14` — `/plan-reports/approved-hr` endpoint 소비 — response shape 유지되니 FE 영향 없음
- `apps/api/src/webhook/webhook.service.ts:10` — `jobPosting.findFirst` (Prisma delegate 호출) — 관계 필드 변경 무관
- `apps/api/src/hiring-automation/hiring-automation.repo.ts:155,168` — `jobPosting.findMany/create` (Prisma delegate) — 관계 필드 변경 무관

---

## Task 1: Add failing test — 같은 planReportId 로 두 번째 JobPosting 생성

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.test.ts` (파일 끝에 추가)

- [ ] **Step 1: 신규 describe block 추가**

`apps/api/src/recruitment/recruitment.service.test.ts` 파일 끝 (line 123, `});` 다음) 에 추가:

```typescript
describe("RecruitmentService.createPosting", () => {
  const makePlanReportRepo = (overrides: any = {}): any => ({
    findByIdLight: jest.fn().mockResolvedValue({
      id: 1,
      status: "APPROVED",
      templateType: "HR",
      departmentId: 10,
      title: "2026 상반기 채용 계획",
      jobPostings: [], // 이제 array — schema 변경 후 필드 이름
    }),
    ...overrides,
  });

  const makeSvcWithPlanRepo = (
    planRepoOverrides: any = {},
    repoOverrides: Partial<RecruitmentRepository> = {},
  ) =>
    new RecruitmentService(
      makeRepo(repoOverrides),
      undefined,
      makePlanReportRepo(planRepoOverrides),
    );

  const validDto = {
    planReportId: 1,
    title: "수비코치 채용",
    description: "수비진 강화를 위한 코치 채용",
    departmentId: 10,
    headcount: 3,
  } as any;

  it("PlanReport 에 이미 JobPosting 이 있어도 새 posting 생성 가능해야 함 (다중 role 지원)", async () => {
    const svc = makeSvcWithPlanRepo(
      {
        findByIdLight: jest.fn().mockResolvedValue({
          id: 1,
          status: "APPROVED",
          templateType: "HR",
          departmentId: 10,
          title: "2026 상반기 채용 계획",
          // 현재 code 는 .jobPosting (singular) 를 읽어 체크함 → 이 필드로 현재 버그 재현.
          // fix 후에는 이 체크가 삭제되므로 두 필드 다 무시되고 posting 생성 성공.
          jobPosting: { id: 100 },
          jobPostings: [{ id: 100 }],
        }),
      },
      {
        createPosting: jest.fn().mockResolvedValue({ id: 101, title: "수비코치 채용" }),
      },
    );

    await expect(svc.createPosting(validDto, 42)).resolves.toEqual({
      id: 101,
      title: "수비코치 채용",
    });
  });

  it("PlanReport 승인 안 되면 409 PLAN_REPORT_NOT_APPROVED", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1,
        status: "DRAFT",
        templateType: "HR",
        departmentId: 10,
        title: "test",
        jobPostings: [],
      }),
    });

    await expect(svc.createPosting(validDto, 42)).rejects.toMatchObject({
      statusCode: 409,
      message: "PLAN_REPORT_NOT_APPROVED",
    });
  });

  it("PlanReport HR 타입 아니면 409 PLAN_REPORT_NOT_HR_TYPE", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1,
        status: "APPROVED",
        templateType: "MARKETING",
        departmentId: 10,
        title: "test",
        jobPostings: [],
      }),
    });

    await expect(svc.createPosting(validDto, 42)).rejects.toMatchObject({
      statusCode: 409,
      message: "PLAN_REPORT_NOT_HR_TYPE",
    });
  });

  it("PlanReport 없으면 404 PLAN_REPORT_NOT_FOUND", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue(null),
    });

    await expect(svc.createPosting(validDto, 42)).rejects.toMatchObject({
      statusCode: 404,
      message: "PLAN_REPORT_NOT_FOUND",
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 (첫 번째 테스트 반드시 실패해야 함)**

Run:
```bash
cd apps/api && pnpm jest src/recruitment/recruitment.service.test.ts -t "다중 role 지원"
```

Expected: **FAIL** with `statusCode: 409, message: "PLAN_REPORT_ALREADY_LINKED"`.

이유: 현재 code (`recruitment.service.ts:59`) 는 `if (planReport.jobPosting)` 체크. mock 에서 `jobPosting: { id: 100 }` 을 truthy 값으로 넣어서 이 체크가 반드시 trigger 되고 서비스가 rejection 함. 테스트는 성공을 기대했으므로 실패로 나타남 — TDD red.

- [ ] **Step 3: 나머지 3개 테스트 통과 확인**

Run:
```bash
cd apps/api && pnpm jest src/recruitment/recruitment.service.test.ts -t "PlanReport 승인 안 되면"
cd apps/api && pnpm jest src/recruitment/recruitment.service.test.ts -t "PlanReport HR 타입 아니면"
cd apps/api && pnpm jest src/recruitment/recruitment.service.test.ts -t "PlanReport 없으면"
```

Expected: 모두 PASS (기존 코드로도 이 3개는 통과).

---

## Task 2: Schema 변경 (JobPosting.planReportId unique 제거)

**Files:**
- Modify: `apps/api/prisma/schema.prisma:2872`
- Modify: `apps/api/prisma/schema.prisma:3627`

- [ ] **Step 1: JobPosting.planReportId 의 @unique 제거**

`apps/api/prisma/schema.prisma:2872` 편집:

```prisma
// 변경 전 (line 2872)
planReportId     Int?             @unique

// 변경 후
planReportId     Int?
```

- [ ] **Step 2: PlanReport.jobPosting 관계를 1:N 로 변경**

`apps/api/prisma/schema.prisma:3627` 편집:

```prisma
// 변경 전 (line 3627)
jobPosting      JobPosting?        @relation(fields: [surveyId], references: [id])

// 실제 필드 이름/relation 은 아래 확인 후 정정. 정확한 line 은:
// jobPosting      JobPosting?
// (Prisma 는 back-relation 이라 fields/references 없음 - 정방향 관계만 있음)
```

**주의**: line 3627 의 실제 코드를 먼저 `Read` 로 확인. 실제로는:

```prisma
jobPosting  JobPosting?  // back-relation, fields 없음
```

이걸 다음처럼 변경:

```prisma
jobPostings JobPostingRelation JobPosting[]  // ← 이건 예시. 실제로는:
jobPostings JobPosting[]
```

**정확한 편집**:

```prisma
// 변경 전
jobPosting      JobPosting?

// 변경 후
jobPostings     JobPosting[]
```

- [ ] **Step 3: schema 파일 형식 확인**

Run:
```bash
cd apps/api && pnpm prisma format
```

Expected: 오류 없이 완료. 파일 재정렬 될 수 있음.

- [ ] **Step 4: schema 검증**

Run:
```bash
cd apps/api && pnpm prisma validate
```

Expected: "The schema is valid." 출력.

---

## Task 3: Migration 생성 및 적용

**Files:**
- Create: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_planreport_jobposting_1n/migration.sql`

- [ ] **Step 1: Migration 생성 (dev DB 에 자동 적용됨)**

Run:
```bash
cd apps/api && pnpm prisma migrate dev --name planreport_jobposting_1n
```

Expected:
- 새 migration 파일 생성됨 (`apps/api/prisma/migrations/YYYYMMDDHHMMSS_planreport_jobposting_1n/migration.sql`)
- Dev DB 에 자동 적용
- `pnpm prisma generate` 자동 실행 (Prisma Client 재생성)

- [ ] **Step 2: 생성된 migration SQL 확인**

Read: `apps/api/prisma/migrations/{new_timestamp}_planreport_jobposting_1n/migration.sql`

Expected 내용 (Prisma auto-gen):
```sql
-- DropIndex
DROP INDEX "JobPosting_planReportId_key";
```

만약 다른 unexpected 변경 (다른 컬럼 drop, rename 등) 이 섞여 있으면 **중단** — schema 편집 실수 가능성. 원상복구 후 재검토.

- [ ] **Step 3: Prisma Client 타입 확인**

Run:
```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: `apps/api/src/recruitment/recruitment.service.ts:59` 에서 TypeScript 에러 발생 — `planReport.jobPosting` 이 이제 존재하지 않는 필드 (jobPostings 로 변경됨). 이 에러가 다음 Task 에서 fix 됨.

만약 이 에러가 안 나면 (Prisma Client 재생성 안 됐거나 schema 변경 안 됨), 확인:
```bash
cd apps/api && pnpm prisma generate
```

---

## Task 4: Service fix — PLAN_REPORT_ALREADY_LINKED 체크 삭제

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.ts:53-61`

- [ ] **Step 1: 체크 라인 삭제**

`apps/api/src/recruitment/recruitment.service.ts:53-61` 편집:

```typescript
// 변경 전 (line 53-61)
async createPosting(dto: CreateJobPostingDto, createdById: number) {
  if (!this.planReportRepo) throw new AppError(500, "INTERNAL_ERROR");
  const planReport = await this.planReportRepo.findByIdLight(dto.planReportId);
  if (!planReport) throw new AppError(404, "PLAN_REPORT_NOT_FOUND");
  if (planReport.status !== "APPROVED") throw new AppError(409, "PLAN_REPORT_NOT_APPROVED");
  if (planReport.templateType !== "HR") throw new AppError(409, "PLAN_REPORT_NOT_HR_TYPE");
  if (planReport.jobPosting) throw new AppError(409, "PLAN_REPORT_ALREADY_LINKED");
  return this.repo.createPosting({ ...dto, createdById });
}

// 변경 후
async createPosting(dto: CreateJobPostingDto, createdById: number) {
  if (!this.planReportRepo) throw new AppError(500, "INTERNAL_ERROR");
  const planReport = await this.planReportRepo.findByIdLight(dto.planReportId);
  if (!planReport) throw new AppError(404, "PLAN_REPORT_NOT_FOUND");
  if (planReport.status !== "APPROVED") throw new AppError(409, "PLAN_REPORT_NOT_APPROVED");
  if (planReport.templateType !== "HR") throw new AppError(409, "PLAN_REPORT_NOT_HR_TYPE");
  return this.repo.createPosting({ ...dto, createdById });
}
```

핵심: `if (planReport.jobPosting) throw new AppError(409, "PLAN_REPORT_ALREADY_LINKED");` 한 줄 삭제.

- [ ] **Step 2: TypeScript 컴파일 확인**

Run:
```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: `recruitment.service.ts:59` 관련 에러 사라짐. 다른 에러 없음.

- [ ] **Step 3: Task 1 의 첫 테스트 통과 확인**

Run:
```bash
cd apps/api && pnpm jest src/recruitment/recruitment.service.test.ts -t "다중 role 지원"
```

Expected: **PASS**. mock 이 `jobPosting: {id: 100}` 있어도 (또는 없어도), 이제 체크 자체가 없으니 그대로 `createPosting` 반환.

---

## Task 5: Repo cleanup — findByIdLight 에서 jobPosting select 제거

**Files:**
- Modify: `apps/api/src/plan-report/plan-report.repo.ts:161-166`

- [ ] **Step 1: findByIdLight 의 select 절 수정**

`apps/api/src/plan-report/plan-report.repo.ts:161-166` 편집:

```typescript
// 변경 전
findByIdLight(id: number) {
  return this.prisma.planReport.findUnique({
    where: { id },
    select: { id: true, status: true, templateType: true, departmentId: true, title: true, jobPosting: { select: { id: true } } },
  })
}

// 변경 후
findByIdLight(id: number) {
  return this.prisma.planReport.findUnique({
    where: { id },
    select: { id: true, status: true, templateType: true, departmentId: true, title: true },
  })
}
```

핵심: `jobPosting: { select: { id: true } }` 삭제. 이 필드는 이제 스키마 상 `jobPostings` (array) 이고, 서비스에서 참조 안 하니 select 할 필요 없음.

- [ ] **Step 2: TypeScript 컴파일 확인**

Run:
```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 3: 기존 관련 테스트 통과 확인**

Run:
```bash
cd apps/api && pnpm jest src/plan-report/ 2>&1 | tail -20
```

Expected: 기존 테스트 모두 통과. 실패 나면 mock 이 `jobPosting` 를 참조하고 있을 수 있음 — mock 정리.

---

## Task 6: Repo semantics — findApprovedHrReports 재정의

**Files:**
- Modify: `apps/api/src/plan-report/plan-report.repo.ts:168-174`

**신 semantics**: "HR + APPROVED 이고 아직 미완료 HiringPlanItem 이 남아있는 PlanReport". 즉:
- HiringPlanItem 이 하나도 없거나 (legacy PlanReport), OR
- HiringPlanItem 중 최소 하나가 JobPosting 이 연결 안 됐음

- [ ] **Step 1: 신규 semantics 로 query 재작성**

`apps/api/src/plan-report/plan-report.repo.ts:168-174` 편집:

```typescript
// 변경 전
findApprovedHrReports() {
  return this.prisma.planReport.findMany({
    where: { status: 'APPROVED', templateType: 'HR', jobPosting: null },
    select: { id: true, title: true, departmentId: true, department: { select: { id: true, name: true } }, approvedAt: true },
    orderBy: { approvedAt: 'desc' },
  })
}

// 변경 후
findApprovedHrReports() {
  return this.prisma.planReport.findMany({
    where: {
      status: 'APPROVED',
      templateType: 'HR',
      OR: [
        { hiringPlanItems: { none: {} } },
        { hiringPlanItems: { some: { jobPostings: { none: {} } } } },
      ],
    },
    select: { id: true, title: true, departmentId: true, department: { select: { id: true, name: true } }, approvedAt: true },
    orderBy: { approvedAt: 'desc' },
  })
}
```

**의미**:
- `hiringPlanItems: { none: {} }` — HiringPlanItem 이 하나도 없는 계획서 (legacy, HR 매니저가 아직 계획 항목 채우지 않았거나 pre-HiringNeedsSurvey 시절 데이터)
- `hiringPlanItems: { some: { jobPostings: { none: {} } } }` — HiringPlanItem 중 최소 하나가 JobPosting 연결 안 됨 (미완료 잔여)

- [ ] **Step 2: TypeScript 컴파일 확인**

Run:
```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: 에러 없음. Prisma 는 nested `jobPostings: { none: {} }` 를 지원.

- [ ] **Step 3: 신규 unit test 추가 (findApprovedHrReports semantics)**

`apps/api/__test__/plan-report/plan-report.service.test.ts` 파일에 신규 describe 추가. 파일이 없으면 새로 만듬. 파일 기존 구조 확인 후:

```typescript
// 파일 상단 import 확인 - PrismaClient mock 필요
import { PlanReportRepository } from "../../src/plan-report/plan-report.repo";

describe("PlanReportRepository.findApprovedHrReports", () => {
  const makePrismaMock = (findManyResult: any[] = []) => ({
    planReport: {
      findMany: jest.fn().mockResolvedValue(findManyResult),
    },
  } as any);

  it("HR + APPROVED + no HiringPlanItems 인 계획서 반환", async () => {
    const prisma = makePrismaMock([
      { id: 1, title: "legacy plan", departmentId: 10, department: { id: 10, name: "코칭" }, approvedAt: new Date() },
    ]);
    const repo = new PlanReportRepository(prisma);
    const result = await repo.findApprovedHrReports();

    expect(result).toHaveLength(1);
    expect(prisma.planReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "APPROVED",
          templateType: "HR",
          OR: expect.arrayContaining([
            { hiringPlanItems: { none: {} } },
            { hiringPlanItems: { some: { jobPostings: { none: {} } } } },
          ]),
        }),
      }),
    );
  });

  it("query 는 미완료 HiringPlanItem 조건을 포함해야 함 (regression)", async () => {
    const prisma = makePrismaMock([]);
    const repo = new PlanReportRepository(prisma);
    await repo.findApprovedHrReports();

    const call = (prisma.planReport.findMany as jest.Mock).mock.calls[0][0];
    // OR 안에 정확히 2개 조건이 있어야 함
    expect(call.where.OR).toHaveLength(2);
    expect(call.where.OR).toContainEqual({ hiringPlanItems: { none: {} } });
    expect(call.where.OR).toContainEqual({ hiringPlanItems: { some: { jobPostings: { none: {} } } } });
  });
});
```

**주의**: `apps/api/__test__/plan-report/plan-report.service.test.ts` 파일이 이미 있음. 파일 끝에 위 describe 추가. 파일 열어서 import 문 재확인 후 필요한 것만 추가.

- [ ] **Step 4: 테스트 실행**

Run:
```bash
cd apps/api && pnpm jest __test__/plan-report/plan-report.service.test.ts
```

Expected: 신규 2개 테스트 포함 모두 PASS.

---

## Task 7: 전체 테스트 실행 + FE compat 확인

- [ ] **Step 1: recruitment 관련 전체 테스트**

Run:
```bash
cd apps/api && pnpm jest src/recruitment/ __test__/recruitment/ 2>&1 | tail -30
```

Expected: 모든 테스트 PASS.

- [ ] **Step 2: plan-report 관련 전체 테스트**

Run:
```bash
cd apps/api && pnpm jest src/plan-report/ __test__/plan-report/ 2>&1 | tail -30
```

Expected: 모든 테스트 PASS.

- [ ] **Step 3: 전체 API 테스트**

Run:
```bash
cd apps/api && pnpm jest 2>&1 | tail -20
```

Expected: 모든 테스트 PASS. `.jobPosting` 참조 있는 다른 테스트가 있으면 실패 → mock 정리.

- [ ] **Step 4: TypeScript strict 컴파일 (전체)**

Run:
```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 5: FE compat 확인 (grep)**

Run:
```bash
grep -rn "planReport\.jobPosting\|\.jobPosting[^s]" football/src --include="*.ts" --include="*.tsx" 2>&1 | grep -v generated
```

Expected: 빈 출력 (없음). 만약 결과 있으면 FE 도 수정 필요 (`.jobPosting` → `.jobPostings[0]` 등).

- [ ] **Step 6: FE TypeScript 컴파일**

Run:
```bash
cd football && pnpm tsc --noEmit 2>&1 | tail -20
```

Expected: 에러 없음. Backend API 의 `listApprovedHrReports` response shape 이 동일 (select 필드 안 바뀜) 이라 FE 무관.

---

## Task 8: Commit

- [ ] **Step 1: 변경 파일 확인**

Run:
```bash
git status
git diff apps/api/prisma/schema.prisma apps/api/src/recruitment/recruitment.service.ts apps/api/src/plan-report/plan-report.repo.ts
```

변경 파일 리스트:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/{new}/migration.sql` (신규)
- `apps/api/src/recruitment/recruitment.service.ts`
- `apps/api/src/plan-report/plan-report.repo.ts`
- `apps/api/src/recruitment/recruitment.service.test.ts`
- `apps/api/__test__/plan-report/plan-report.service.test.ts` (수정 or 신규)

- [ ] **Step 2: Commit**

Run:
```bash
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations \
        apps/api/src/recruitment/recruitment.service.ts \
        apps/api/src/plan-report/plan-report.repo.ts \
        apps/api/src/recruitment/recruitment.service.test.ts \
        apps/api/__test__/plan-report/plan-report.service.test.ts

git commit -m "$(cat <<'EOF'
fix(recruitment): PlanReport ↔ JobPosting 1:1 → 1:N (다중 role HR 계획서 지원)

- schema: JobPosting.planReportId @unique 제거, PlanReport.jobPosting → jobPostings (1:N)
- service: recruitment.service.createPosting PLAN_REPORT_ALREADY_LINKED 체크 삭제
- repo: findByIdLight 에서 jobPosting select 제거
- repo: findApprovedHrReports 를 "미완료 HiringPlanItem 잔여" semantics 로 재정의
- tests: createPosting 다중 role 시나리오, findApprovedHrReports 신 semantics regression

Closes #359

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Commit 검증**

Run:
```bash
git log -1 --stat
```

Expected: commit 생성됨, 변경 파일 6개 반영.

---

## Self-Review Checklist

**1. Spec coverage** (#359 acceptance criteria):
- [x] 한 PlanReport 승인 후 여러 HiringPlanItem 에 대해 각각 JobPosting 생성 가능 → Task 4
- [x] 기존 1개 JobPosting 만 있는 PlanReport 도 정상 조회 → 변경 없이 통과 (schema drop 만)
- [x] 신규 테스트: multi-role PlanReport(3개 HiringPlanItem)에 3개 posting 생성 성공 → Task 1 (개념 검증), integration 테스트로 확장 가능 but unit 수준으로 충분
- [x] `listApprovedHrReports()` 의 신 semantics 문서화 → Task 6 (query 재정의 + regression 테스트)

**2. Placeholder scan:** 없음 — 모든 step 에 완전 코드/커맨드 존재.

**3. Type consistency:** 
- `jobPostings` (plural) 로 일관 사용 (schema, mock, repo query)
- `hiringPlanItems` (plural) 로 일관 사용
- Service signature 변경 없음 (input/output shape 유지)

## 실행 후 확인 사항

- [ ] `pnpm jest` 전체 통과
- [ ] `pnpm tsc --noEmit` (apps/api) 에러 없음
- [ ] `pnpm tsc --noEmit` (football/) 에러 없음
- [ ] Migration SQL 이 예상대로 DROP INDEX 만 포함
- [ ] `.jobPosting` (singular) 참조 codebase 어디에도 없음 (`grep` 확인)
