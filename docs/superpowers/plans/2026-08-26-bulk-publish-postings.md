# Bulk Publish JobPostings from PlanReport (Fix #361) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** [#361](https://github.com/JunoLee1/--API/issues/361)

**Goal:** HR 매니저가 승인된 HR PlanReport 의 모든 미완료 HiringPlanItem 을 한 번의 API 호출로 JobPosting draft 로 일괄 생성. Idempotent — 이미 posting 있는 item 은 skip.

**Architecture:**
- 신규 endpoint: `POST /plan-reports/:id/publish-postings` (HR 만)
- Service `RecruitmentService.bulkCreatePostingsFromPlanReport(planReportId, actorId)` — planReport 검증 후 PLANNED status 인 HiringPlanItem 들에 대해 iterate 하며 posting 생성 (기존 createPosting 재사용). CANCELLED/FULFILLED/IN_PROGRESS 는 skip
- Response: `{ created: JobPosting[], skipped: { id, roleTitle, status }[] }`
- Title 자동: `{PlanReport.title} - {HiringPlanItem.roleTitle}`
- Description 자동: HiringPlanItem 정보 (roleTitle, headcount, priority, quarter, estimatedBudget) 요약

**Tech Stack:** TypeScript · Prisma · Jest · Express (`apps/api`)

**Dependency:** [#359](https://github.com/JunoLee1/--API/pull/376), [#362](https://github.com/JunoLee1/--API/pull/380), [#363](https://github.com/JunoLee1/--API/pull/379) merged (main `e428d8ca`). #362 의 HiringPlanItem status 있으므로 정확한 skip 판정 가능.

**Out of scope:**
- FE 상세 페이지 "일괄 발행" 버튼 (별도 이슈)
- 각 item 별 커스텀 title/description (자동 생성만 지원)

---

## File Structure

**Modify:**
- `apps/api/src/recruitment/recruitment.service.ts` — 신규 `bulkCreatePostingsFromPlanReport` 메서드
- `apps/api/src/recruitment/recruitment.repo.ts` — (필요 시) list helper — 아마 plan-report.repo.listHiringPlanItems 재사용으로 불필요
- `apps/api/src/plan-report/plan-report.routes.ts` — 신규 route + 필요한 서비스 import
- `apps/api/src/plan-report/plan-report.controller.ts` — 신규 handler `publishPostings`
- `apps/api/src/recruitment/recruitment.service.test.ts` — 신규 테스트

**Verify (no changes):**
- FE 는 이번 스코프 out. 별도 FE 이슈에서 button 추가

---

## Task 1: Failing tests

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.test.ts` — 신규 `describe("RecruitmentService.bulkCreatePostingsFromPlanReport")` 블록

- [ ] **Step 1: 신규 describe + 4 테스트 추가**

파일 끝에 추가:

```typescript
describe("RecruitmentService.bulkCreatePostingsFromPlanReport", () => {
  const planReportData = {
    id: 1,
    title: "2026 Q4 채용 계획",
    status: "APPROVED",
    templateType: "HR",
    departmentId: 10,
    jobPostings: [],
  };

  const items = [
    { id: 101, planReportId: 1, roleTitle: "수비코치", headcount: 2, priority: "HIGH", status: "PLANNED", quarter: 4, estimatedBudget: 50000000 },
    { id: 102, planReportId: 1, roleTitle: "GK코치", headcount: 1, priority: "MEDIUM", status: "IN_PROGRESS", quarter: 4, estimatedBudget: 30000000 },
    { id: 103, planReportId: 1, roleTitle: "물리치료사", headcount: 2, priority: "HIGH", status: "PLANNED", quarter: 4, estimatedBudget: 40000000 },
    { id: 104, planReportId: 1, roleTitle: "취소된 role", headcount: 1, priority: "LOW", status: "CANCELLED", quarter: 4, estimatedBudget: 20000000 },
    { id: 105, planReportId: 1, roleTitle: "완료된 role", headcount: 1, priority: "LOW", status: "FULFILLED", quarter: 4, estimatedBudget: 20000000 },
  ];

  const makeSvcWithBulkContext = (
    listHiringPlanItemsResult = items,
    createPostingResults = [{ id: 500 }, { id: 501 }],
  ) => {
    const repo = makeRepo({
      createPosting: jest.fn()
        .mockResolvedValueOnce(createPostingResults[0])
        .mockResolvedValueOnce(createPostingResults[1]),
    });
    const planRepo = {
      findByIdLight: jest.fn().mockResolvedValue(planReportData),
      findHiringPlanItemById: jest.fn().mockImplementation((id) => {
        const item = items.find(i => i.id === id);
        return Promise.resolve(item ?? null);
      }),
      listHiringPlanItems: jest.fn().mockResolvedValue(listHiringPlanItemsResult),
      updateHiringPlanItemStatus: jest.fn().mockResolvedValue({}),
    } as any;
    const svc = new RecruitmentService(repo, undefined, planRepo);
    return { svc, repo, planRepo };
  };

  it("PLANNED 상태 item 들만 posting 생성, 나머지는 skip", async () => {
    const { svc, planRepo } = makeSvcWithBulkContext();

    const result = await svc.bulkCreatePostingsFromPlanReport(1, 42);

    // 2개 PLANNED (101, 103) → posting 생성
    expect(result.created).toHaveLength(2);
    // 3개 non-PLANNED (102 IN_PROGRESS, 104 CANCELLED, 105 FULFILLED) → skip
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped.map((s: any) => s.id).sort()).toEqual([102, 104, 105]);
    expect(result.skipped.map((s: any) => s.status).sort()).toEqual(["CANCELLED", "FULFILLED", "IN_PROGRESS"]);

    // listHiringPlanItems 는 planReportId 기준 조회 (status filter 없이 전체)
    expect(planRepo.listHiringPlanItems).toHaveBeenCalledWith(1);
  });

  it("생성된 posting 은 default title/description 갖고, hiringPlanItemId 자동 연결", async () => {
    const { svc, repo } = makeSvcWithBulkContext();

    await svc.bulkCreatePostingsFromPlanReport(1, 42);

    const calls = (repo.createPosting as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    // 첫 posting (id 101, 수비코치)
    expect(calls[0][0]).toMatchObject({
      planReportId: 1,
      hiringPlanItemId: 101,
      title: "2026 Q4 채용 계획 - 수비코치",
      headcount: 2,
      departmentId: 10,
      createdById: 42,
    });
    expect(calls[0][0].description).toContain("수비코치");
    expect(calls[0][0].description).toContain("2"); // headcount
  });

  it("planReport 없으면 404 PLAN_REPORT_NOT_FOUND", async () => {
    const { svc } = makeSvcWithBulkContext();
    const planRepo = {
      findByIdLight: jest.fn().mockResolvedValue(null),
      listHiringPlanItems: jest.fn(),
    } as any;
    const svcNoReport = new RecruitmentService(makeRepo(), undefined, planRepo);

    await expect(svcNoReport.bulkCreatePostingsFromPlanReport(999, 42))
      .rejects.toMatchObject({ statusCode: 404, message: "PLAN_REPORT_NOT_FOUND" });
  });

  it("planReport 가 HR 이 아니거나 승인 안 됨 시 409", async () => {
    const planRepo = {
      findByIdLight: jest.fn().mockResolvedValue({ ...planReportData, templateType: "GENERAL" }),
      listHiringPlanItems: jest.fn(),
    } as any;
    const svc = new RecruitmentService(makeRepo(), undefined, planRepo);

    await expect(svc.bulkCreatePostingsFromPlanReport(1, 42))
      .rejects.toMatchObject({ statusCode: 409, message: "PLAN_REPORT_NOT_HR_TYPE" });
  });

  it("모든 item 이 non-PLANNED 이면 created 는 빈 배열, skipped 만 반환 (에러 아님)", async () => {
    const allNonPlanned = items.filter(i => i.status !== "PLANNED");
    const { svc } = makeSvcWithBulkContext(allNonPlanned);

    const result = await svc.bulkCreatePostingsFromPlanReport(1, 42);

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(3);
  });
});
```

- [ ] **Step 2: 테스트 실행 (FAIL 예상)**

Run:
```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts -t "bulkCreatePostings" 2>&1 | tail -20
```

Expected: **FAIL** — service method 없음.

---

## Task 2: Service implementation

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.service.ts` — 신규 메서드

- [ ] **Step 1: `bulkCreatePostingsFromPlanReport` 메서드 추가**

`apps/api/src/recruitment/recruitment.service.ts` — 기존 `createPosting` 메서드 뒤에 추가:

```typescript
  async bulkCreatePostingsFromPlanReport(planReportId: number, createdById: number) {
    if (!this.planReportRepo) throw new AppError(500, "INTERNAL_ERROR");

    const planReport = await this.planReportRepo.findByIdLight(planReportId);
    if (!planReport) throw new AppError(404, "PLAN_REPORT_NOT_FOUND");
    if (planReport.status !== "APPROVED") throw new AppError(409, "PLAN_REPORT_NOT_APPROVED");
    if (planReport.templateType !== "HR") throw new AppError(409, "PLAN_REPORT_NOT_HR_TYPE");

    const allItems = await this.planReportRepo.listHiringPlanItems(planReportId);

    const created: any[] = [];
    const skipped: { id: number; roleTitle: string; status: string }[] = [];

    for (const item of allItems) {
      if (item.status !== "PLANNED") {
        skipped.push({ id: item.id, roleTitle: item.roleTitle, status: item.status });
        continue;
      }

      // Auto-generate title + description
      const title = `${planReport.title} - ${item.roleTitle}`;
      const description = [
        `역할: ${item.roleTitle}`,
        `채용 인원: ${item.headcount}명`,
        `우선순위: ${item.priority}`,
        item.quarter ? `분기: Q${item.quarter}` : null,
        item.estimatedBudget ? `예산: ${item.estimatedBudget.toLocaleString()}원` : null,
      ].filter(Boolean).join(" · ");

      const posting = await this.createPosting(
        {
          planReportId,
          hiringPlanItemId: item.id,
          title,
          description,
          departmentId: planReport.departmentId ?? undefined,
          headcount: item.headcount,
        } as any,
        createdById,
      );
      created.push(posting);
    }

    return { created, skipped };
  }
```

**주의**: `this.createPosting()` 재사용 — 각 item 별로 REQUIRED/NOT_FOUND/MISMATCH/FULFILLED/CANCELLED 체크 + PLANNED→IN_PROGRESS 전이 자동 발생 (검증 중복이지만 idempotent + 안전).

- [ ] **Step 2: 테스트 통과 확인**

Run:
```bash
cd apps/api && pnpm test -- src/recruitment/recruitment.service.test.ts -t "bulkCreatePostings" 2>&1 | tail -20
```

Expected: **PASS** — 5개 신규 테스트.

- [ ] **Step 3: TypeScript check**

Run:
```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -10
```

Expected: 신규 에러 없음.

---

## Task 3: Route + Controller wiring

**Files:**
- Modify: `apps/api/src/plan-report/plan-report.routes.ts` — 신규 route + service wiring
- Modify: `apps/api/src/plan-report/plan-report.controller.ts` — 신규 handler

- [ ] **Step 1: PlanReportController 에 handler 추가**

`apps/api/src/plan-report/plan-report.controller.ts` — 기존 hiring-items handlers 근처에 추가:

```typescript
  publishPostings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planReportId = Number(req.params.id)
      const actorId = (req.user as any)?.id
      const result = await this.recruitmentService.bulkCreatePostingsFromPlanReport(planReportId, actorId)
      res.status(201).json(result)
    } catch (e) { next(e) }
  }
```

**주의**: `this.recruitmentService` 필드가 controller class 에 있어야 함. 없으면 constructor 확장 필요.

`apps/api/src/plan-report/plan-report.controller.ts` — class constructor 확장:

```typescript
// 변경 전 (예시)
export class PlanReportController {
  constructor(private service: PlanReportService, private repo: PlanReportRepository) {}
  ...
}

// 변경 후
import { RecruitmentService } from '../recruitment/recruitment.service'

export class PlanReportController {
  constructor(
    private service: PlanReportService,
    private repo: PlanReportRepository,
    private recruitmentService: RecruitmentService,
  ) {}
  ...
}
```

- [ ] **Step 2: Route 등록**

`apps/api/src/plan-report/plan-report.routes.ts`:

```typescript
// 파일 상단 imports 에 추가
import { RecruitmentService } from '../recruitment/recruitment.service'
import { RecruitmentRepository } from '../recruitment/recruitment.repo'

// 기존 controller 생성 후에 recruitmentService 도 만들어서 controller 에 전달
const recruitmentRepo = new RecruitmentRepository(prisma)
const recruitmentService = new RecruitmentService(recruitmentRepo, notifRepo, planReportRepo)
const controller = new PlanReportController(service, planReportRepo, recruitmentService)  // 3rd arg 추가

// 기존 route 근처에 추가
router.post('/:id/publish-postings', auth, checkWriteHR, controller.publishPostings)
```

**주의**: 실제 `plan-report.routes.ts` 내 constructor arg 순서 · notifRepo 여부는 파일 열어서 확인 후 조정.

- [ ] **Step 3: TypeScript check + 테스트**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -10
cd apps/api && pnpm test -- src/recruitment/ __test__/plan-report/ src/plan-report/ 2>&1 | tail -10
```

Expected: 컴파일 에러 없음. 모든 테스트 통과.

---

## Task 4: Verify + commit

- [ ] **Step 1: 전체 스코프 테스트**

```bash
cd apps/api && pnpm test -- src/recruitment/ __test__/plan-report/ __test__/recruitment/ src/plan-report/ 2>&1 | tail -10
```

Expected: 모두 PASS (신규 5개 + 기존 39개 이상).

- [ ] **Step 2: FE TypeScript (regression 없음)**

```bash
cd football && pnpm tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Git status + commit**

```bash
git status --short
git add apps/api/src/recruitment/recruitment.service.ts \
        apps/api/src/recruitment/recruitment.service.test.ts \
        apps/api/src/plan-report/plan-report.routes.ts \
        apps/api/src/plan-report/plan-report.controller.ts \
        docs/superpowers/plans/2026-08-26-bulk-publish-postings.md

git commit -m "$(cat <<'EOF'
feat(recruitment): bulk publish JobPostings from PlanReport (fix #361)

- 신규 API: POST /plan-reports/:id/publish-postings (HR 만)
- service: RecruitmentService.bulkCreatePostingsFromPlanReport
  * planReport 검증 (HR type + APPROVED)
  * PLANNED status HiringPlanItem 만 posting 생성
  * IN_PROGRESS/FULFILLED/CANCELLED 는 skip (response 에 포함)
  * 각 posting: title="{planReport.title} - {item.roleTitle}", description 자동 생성
  * createPosting 재사용으로 PLANNED→IN_PROGRESS 전이 등 자동 처리
- response: { created: JobPosting[], skipped: { id, roleTitle, status }[] }
- tests: 5개 신규 (skip 판정 · title/desc 생성 · 검증 실패 · empty planned)

HR 매니저가 다중 role HR 계획서를 한 번의 API 호출로 posting draft 로 변환 가능. 부서 5개 × role 3개 = 15번 클릭 부담 해결. Idempotent — 이미 posting 있는 item 재호출 안전.

Closes #361

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log -1 --stat
```

---

## Self-Review

**1. Spec coverage** (#361 acceptance):
- [x] Bulk 생성 API (`POST /plan-reports/:id/publish-postings`) → Task 3
- [x] `hiringPlanItemId` 자동 연결 → Task 2 (createPosting 재사용)
- [x] Idempotent (이미 posting 있는 skip) → Task 2 (status !== 'PLANNED' skip)
- [x] Response `{ created, skipped }` → Task 2
- [x] title 규칙 `{PlanReport.title} - {HiringPlanItem.roleTitle}` → Task 2
- [x] description HiringPlanItem 정보 요약 → Task 2

**2. Placeholder scan:** 없음.

**3. Type consistency:**
- Method: `bulkCreatePostingsFromPlanReport` 일관
- Response shape: `{ created, skipped }` 일관

## 실행 후 확인 사항

- [ ] 신규 5 테스트 pass
- [ ] BE tsc 신규 에러 없음
- [ ] FE tsc 통과
- [ ] 실제 POST 호출 시 correct response 형식
