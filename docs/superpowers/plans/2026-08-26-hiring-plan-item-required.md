# `hiringPlanItemId` Required + Validation (Fix #363) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** [#363](https://github.com/JunoLee1/--API/issues/363)

**Goal:** `CreateJobPostingDto.hiringPlanItemId` 를 required 로 변경하고 서비스에서 검증하여 `SurveyResponse → HiringPlanItem → JobPosting → Application → StaffRecord` 데이터 chain 무결성 보장.

**Architecture:** 
- BE: DTO field 를 optional → required 로 변경, `recruitment.service.createPosting` 에 3가지 검증 추가 (존재 · 같은 계획서 · 향후 status 확인은 #362 후속)
- BE: `PlanReportRepository` 에 `findHiringPlanItemById` 조회 헬퍼 추가
- FE: `recruitment.service.ts` 에서 DTO 타입 required 로 동기화
- Schema 변경 없음 (`JobPosting.hiringPlanItemId Int?` 는 legacy record 호환 위해 유지)
- Migration 없음

**Tech Stack:** TypeScript · Prisma · Jest · Express (`apps/api`) · React+Vite (`football/`)

**Dependency:** [#359](https://github.com/JunoLee1/--API/pull/376) merged (필수 선행) — 이 plan 은 post-#359 main 을 base 로 함.

**Out of scope (별도 이슈):**
- `hiringPlanItem.status !== 'FULFILLED'` 검증 → [#362](https://github.com/JunoLee1/--API/issues/362) 완료 후 활성화
- Legacy `JobPosting` 중 `hiringPlanItemId=null` record 처리 정책 → 별도 데이터 정리 이슈로 분리 (필요 시)

---

## File Structure

**Modify (BE):**
- `apps/api/src/recruitment/dto/recruitment.dto.ts:16` — `hiringPlanItemId?: number` → `hiringPlanItemId: number`
- `apps/api/src/recruitment/recruitment.service.ts:53-60` — `createPosting` 에 3 validation 추가
- `apps/api/src/plan-report/plan-report.repo.ts` — `findHiringPlanItemById` 신규 메서드
- `apps/api/src/recruitment/recruitment.service.test.ts` — `createPosting` describe 확장 (신규 3 테스트)

**Modify (FE):**
- `football/src/services/recruitment.service.ts:34` — `hiringPlanItemId?: number` → `hiringPlanItemId: number`

**Verify (no changes needed):**
- `football/src/pages/admin/recruitment/JobPostingListPage.tsx:115` — 이미 `hiringPlanItemId: selectedHiringItemId` 전달 중 (제대로 non-null 값 보장하는지 verify)
- Schema `prisma/schema.prisma` — 변경 없음
- Migration — 없음

---

## Task 1: Failing tests

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.test.ts` — 기존 `describe("RecruitmentService.createPosting")` 블록에 신규 테스트 3개 추가

- [ ] **Step 1: 파일 현재 상태 확인**

Read `apps/api/src/recruitment/recruitment.service.test.ts` 의 `describe("RecruitmentService.createPosting", ...)` 블록. #359 fix 후에는 4개 테스트 존재 (다중 role, NOT_APPROVED, NOT_HR_TYPE, NOT_FOUND).

- [ ] **Step 2: 신규 3개 테스트 추가 — 검증 시나리오**

기존 4개 테스트 뒤에 추가:

```typescript
  it("hiringPlanItemId 없으면 400 HIRING_PLAN_ITEM_REQUIRED", async () => {
    const svc = makeSvcWithPlanRepo();
    // validDto 는 hiringPlanItemId 포함, 이 테스트는 제외 후 전송
    const dtoWithoutItem = { ...validDto, hiringPlanItemId: undefined } as any;
    await expect(svc.createPosting(dtoWithoutItem, 42)).rejects.toMatchObject({
      statusCode: 400,
      message: "HIRING_PLAN_ITEM_REQUIRED",
    });
  });

  it("hiringPlanItemId 가 존재하지 않으면 404 HIRING_PLAN_ITEM_NOT_FOUND", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1,
        status: "APPROVED",
        templateType: "HR",
        departmentId: 10,
        title: "test",
        jobPostings: [],
      }),
      findHiringPlanItemById: jest.fn().mockResolvedValue(null),
    });
    await expect(svc.createPosting(validDto, 42)).rejects.toMatchObject({
      statusCode: 404,
      message: "HIRING_PLAN_ITEM_NOT_FOUND",
    });
  });

  it("hiringPlanItemId 가 다른 planReport 소속이면 400 HIRING_PLAN_ITEM_MISMATCH", async () => {
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
        planReportId: 999, // ← 다른 계획서 소속
      }),
    });
    await expect(svc.createPosting(validDto, 42)).rejects.toMatchObject({
      statusCode: 400,
      message: "HIRING_PLAN_ITEM_MISMATCH",
    });
  });
```

**주의**: `makePlanReportRepo` (기존 헬퍼) 의 default mock 에는 `findHiringPlanItemById` 이 없음. Default 에도 mock 추가 필요 (기존 4개 테스트 회귀 방지):

```typescript
  const makePlanReportRepo = (overrides: any = {}): any => ({
    findByIdLight: jest.fn().mockResolvedValue({
      id: 1,
      status: "APPROVED",
      templateType: "HR",
      departmentId: 10,
      title: "2026 상반기 채용 계획",
      jobPosting: { id: 100 },
      jobPostings: [{ id: 100 }],
    }),
    findHiringPlanItemById: jest.fn().mockResolvedValue({  // ← 신규 추가, default 는 매칭됨
      id: 500,
      planReportId: 1,
    }),
    ...overrides,
  });
```

- [ ] **Step 3: 테스트 실행 (FAIL 예상)**

Run:
```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts -t "HIRING_PLAN_ITEM" 2>&1 | tail -15
```

Expected: **FAIL** — service 에 validation 없어서 아무것도 throw 안 함. 3개 모두 fail (`Expected reject but resolved` 형식).

- [ ] **Step 4: 기존 4개 테스트 여전히 pass 확인 (default mock 회귀 없음)**

Run:
```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts -t "createPosting" 2>&1 | tail -20
```

Expected: 기존 4개 PASS + 신규 3개 FAIL.

---

## Task 2: Implementation — DTO + repo helper + service validation

**Files:**
- Modify: `apps/api/src/recruitment/dto/recruitment.dto.ts:16`
- Modify: `apps/api/src/plan-report/plan-report.repo.ts`
- Modify: `apps/api/src/recruitment/recruitment.service.ts:53-60`

- [ ] **Step 1: DTO required 로 변경**

`apps/api/src/recruitment/dto/recruitment.dto.ts` 의 `CreateJobPostingDto`:

```typescript
// 변경 전 (line 16)
hiringPlanItemId?: number;

// 변경 후
hiringPlanItemId: number;
```

- [ ] **Step 2: Repo helper 추가**

`apps/api/src/plan-report/plan-report.repo.ts` — `findByIdLight` 뒤에 추가:

```typescript
  findHiringPlanItemById(id: number) {
    return this.prisma.hiringPlanItem.findUnique({
      where: { id },
      select: { id: true, planReportId: true },
    })
  }
```

- [ ] **Step 3: Service `createPosting` 검증 추가**

`apps/api/src/recruitment/recruitment.service.ts:53-60` — 마지막 (return 직전) 에 검증 추가:

```typescript
// 변경 전
async createPosting(dto: CreateJobPostingDto, createdById: number) {
  if (!this.planReportRepo) throw new AppError(500, "INTERNAL_ERROR");
  const planReport = await this.planReportRepo.findByIdLight(dto.planReportId);
  if (!planReport) throw new AppError(404, "PLAN_REPORT_NOT_FOUND");
  if (planReport.status !== "APPROVED") throw new AppError(409, "PLAN_REPORT_NOT_APPROVED");
  if (planReport.templateType !== "HR") throw new AppError(409, "PLAN_REPORT_NOT_HR_TYPE");
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

  return this.repo.createPosting({ ...dto, createdById });
}
```

- [ ] **Step 4: TypeScript 컴파일**

Run:
```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -10
```

Expected: 신규 에러 없음 (기존 pre-existing 9 에러 무관). DTO 필드 required 로 변경했으므로 다른 caller 에서 에러 나면 문제.

가능한 회귀 지점:
- `apps/api/src/recruitment/recruitment.controller.ts:createPosting` — req.body 를 DTO 로 cast 하는데 원래 optional 이었음. Runtime 에는 문제 없고, TypeScript check 는 body 를 이미 `as CreateJobPostingDto` 로 사용 중이면 통과. Verify.

- [ ] **Step 5: 전체 createPosting 테스트 실행**

Run:
```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts -t "createPosting" 2>&1 | tail -20
```

Expected: 기존 4개 + 신규 3개 = **7개 모두 PASS**.

---

## Task 3: FE DTO 동기화

**Files:**
- Modify: `football/src/services/recruitment.service.ts:34`

- [ ] **Step 1: FE DTO required 로 변경**

`football/src/services/recruitment.service.ts:28-36` — `createPosting` 함수의 파라미터 타입:

```typescript
// 변경 전
createPosting: (data: {
  planReportId: number
  title: string
  description: string
  departmentId?: number
  headcount?: number
  hiringPlanItemId?: number  // ← optional
}) =>
  api.post('/recruitment/job-postings', data),

// 변경 후
createPosting: (data: {
  planReportId: number
  title: string
  description: string
  departmentId?: number
  headcount?: number
  hiringPlanItemId: number  // ← required
}) =>
  api.post('/recruitment/job-postings', data),
```

- [ ] **Step 2: FE 호출부 verify**

Grep 확인:
```bash
cd /Users/juno/work/football/.claude/worktrees/{worktree_name} && grep -rn "recruitmentApi.createPosting\|createPosting(" football/src --include="*.tsx" --include="*.ts" 2>&1 | grep -v node_modules | head -10
```

기존 호출부 `JobPostingListPage.tsx:109-115`:
```typescript
await recruitmentApi.createPosting({
  planReportId,
  title,
  description,
  departmentId,
  headcount,
  hiringPlanItemId: selectedHiringItemId,
});
```

`selectedHiringItemId` 가 항상 값이 있는지 확인 필요. 없으면 FE 에서 required 로 강제 (dropdown 선택 필수) 하거나 이 이슈에서 fix.

- [ ] **Step 3: `selectedHiringItemId` 값 보장 확인**

Read `football/src/pages/admin/recruitment/JobPostingListPage.tsx` 관련 state + form validation. `selectedHiringItemId` 가 nullable 이면 required 로 강제하는 form 검증 추가:

```typescript
if (!selectedHiringItemId) {
  toast.error('HiringPlanItem 을 선택해 주세요.');
  return;
}
```

또는 초기값을 nullable 하지 않도록 (dropdown default 값 강제).

**Grill 결정**: `selectedHiringItemId` 상태 및 검증 방식은 이 이슈 스코프. 실제 UI 확인 후 최소 스코프로 수정.

- [ ] **Step 4: FE TypeScript 컴파일**

Run:
```bash
cd football && pnpm tsc --noEmit 2>&1 | tail -15
```

Expected: 에러 없음. `hiringPlanItemId` 를 required 로 만들었으니 호출부에서 값 항상 전달해야 함. TypeScript 가 caller 에서 문제 지점 지적.

Fix 방향: 각 caller 를 검사, 없으면 `hiringPlanItemId!` non-null assertion 또는 조건부 필수 검증 추가.

---

## Task 4: Verify + commit

- [ ] **Step 1: 전체 관련 테스트**

Run:
```bash
cd apps/api && pnpm test -- src/recruitment/ src/plan-report/ __test__/plan-report/ __test__/recruitment/ 2>&1 | tail -15
```

Expected: 모두 PASS. Pre-existing DB test 실패는 유지 (`__test__/plan-report/plan-report.service.test.ts:169` AuditLog 관련, 우리 fix 무관).

- [ ] **Step 2: TypeScript 전체**

BE:
```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -20
```

FE:
```bash
cd football && pnpm tsc --noEmit 2>&1 | tail -20
```

Expected: 신규 에러 없음.

- [ ] **Step 3: git status 확인**

Run:
```bash
git status --short
```

Expected 파일 리스트:
- Modified: `apps/api/src/recruitment/dto/recruitment.dto.ts`
- Modified: `apps/api/src/recruitment/recruitment.service.ts`
- Modified: `apps/api/src/plan-report/plan-report.repo.ts`
- Modified: `apps/api/src/recruitment/recruitment.service.test.ts`
- Modified: `football/src/services/recruitment.service.ts`
- Modified (선택적): `football/src/pages/admin/recruitment/JobPostingListPage.tsx` (Task 3 Step 3 결과)
- Untracked: `docs/superpowers/plans/2026-08-26-hiring-plan-item-required.md`

- [ ] **Step 4: Commit**

Run:
```bash
git add apps/api/src/recruitment/dto/recruitment.dto.ts \
        apps/api/src/recruitment/recruitment.service.ts \
        apps/api/src/plan-report/plan-report.repo.ts \
        apps/api/src/recruitment/recruitment.service.test.ts \
        football/src/services/recruitment.service.ts \
        docs/superpowers/plans/2026-08-26-hiring-plan-item-required.md

# JobPostingListPage 수정했으면 함께 add
git add football/src/pages/admin/recruitment/JobPostingListPage.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
fix(recruitment): CreateJobPostingDto.hiringPlanItemId required + validation (fix #363)

- DTO: hiringPlanItemId 를 optional → required 로 변경 (BE + FE 동기화)
- service: createPosting 에 3 validation 추가 (존재 · MISMATCH · REQUIRED)
- repo: PlanReportRepository.findHiringPlanItemById 신규 조회 헬퍼
- tests: 3개 신규 (HIRING_PLAN_ITEM_REQUIRED, NOT_FOUND, MISMATCH)

SurveyResponse → HiringPlanItem → JobPosting → Application → StaffRecord 데이터 chain 무결성 보장. hiringPlanItem.status !== 'FULFILLED' 검증은 #362 완료 후 활성화 예정.

Legacy JobPosting 중 hiringPlanItemId=null record 는 schema 상 nullable 유지 (기존 데이터 보호). 신규 create 만 강제.

Closes #363

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git log -1 --stat
```

---

## Self-Review Checklist

**1. Spec coverage** (#363 acceptance):
- [x] `hiringPlanItemId` required → Task 2 Step 1
- [x] `hiringPlanItem.planReportId === dto.planReportId` 검증 → Task 2 Step 3
- [x] `hiringPlanItem.status !== 'FULFILLED'` 검증 → **Out of scope** (#362 후속)
- [x] 400 `HIRING_PLAN_ITEM_MISMATCH` → Task 2
- [x] 400 `HIRING_PLAN_ITEM_REQUIRED` (신규 code, 원 issue 언급) → Task 2
- [x] 404 `HIRING_PLAN_ITEM_NOT_FOUND` (신규 code, 원 issue 언급) → Task 2
- [x] FE 호환 → Task 3

**2. Placeholder scan:** `{worktree_name}` 하나 (Task 3 Step 2). 실행 시점 대체.

**3. Type consistency:**
- `findHiringPlanItemById` 일관 사용 (repo, service, test mock)
- `hiringPlanItemId` 필드명 일관
- Error code (`HIRING_PLAN_ITEM_REQUIRED`, `_NOT_FOUND`, `_MISMATCH`) 일관

## 실행 후 확인 사항

- [ ] Post-#359 main 상태에서 시작 (`git log` 에 `b1abdb49` 확인)
- [ ] BE `pnpm test` 전체 통과 (신규 3 + 기존 유지)
- [ ] FE `pnpm tsc --noEmit` 통과
- [ ] Migration 없음 (schema 그대로)
- [ ] DB 상 `JobPosting.hiringPlanItemId Int?` (nullable) 유지 확인
