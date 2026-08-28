# 직무 온보딩 컨텐츠 스켈레톤 (OnboardingTemplate + OnboardingTask) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부서별 온보딩 콘텐츠 (오리엔테이션·교육·체크리스트) 을 템플릿으로 정의하고, `HiringDispatch.dispatch()` 성공 시 신입 온보딩에 자동 populate 하는 스켈레톤 도입. 신입은 self-report 로 태스크 완료 마킹, HR/부서장은 검증 필요한 태스크만 verify. 멘토 배정·자동 이벤트 감지·수습기간 연동은 후속 이슈로 분리.

**Architecture:** 신규 `OnboardingTemplate` (Department 1:1) + `OnboardingTask` (Onboarding 하위). `dispatch()` $transaction 안에서 template.tasks 를 OnboardingTask 로 스냅샷 populate. Task 상태머신 `PENDING → SELF_REPORTED → DONE/SKIPPED`, verify 필요 시 2단계, reject 시 PENDING 복귀. 모든 required task 완료 시 `Onboarding.contentCompletedAt` 자동 set (fire-and-forget). HiringDispatch.COMPLETED 자동 전이는 별도 이슈.

**Tech Stack:** Prisma, TypeScript, Express, React + shadcn/ui, jest.

**Scope (MVP):**
- `OnboardingTemplate` 모델 (Department 1:1, tasks Json[])
- `OnboardingTask` 모델 (Onboarding 하위, 상태머신)
- Template CRUD (부서장·HR·ADMIN)
- `dispatch()` $transaction 안 원자적 populate
- Task self-report / HR verify / reject / skip
- Onboarding.contentCompletedAt 자동 판정 (fire-and-forget hook)
- 4개 자동 알림 (populate·verify request·verify result·content complete)
- FE: OnboardingTemplateManagementPage + OnboardingChecklistPage (신입) + OnboardingVerifyPage (HR)

**Non-goal (후속 이슈로 분리):**
- `Mentorship` 모델·멘토 배정 워크플로우
- 자동 이벤트 감지 (첫 PR 머지 등 crossdomain 훅)
- 수습기간 · `ProbationReview` 통합 (`#375` 와 병합 여부 결정)
- Task 완료 증빙 파일 첨부 (필요 시 HiringDocument 로 대체)
- Due date 임박 알림 cron
- 기존 온보딩 backfill (Template 도입 이전 dispatch 는 tasks = [] 유지)
- HiringDispatch.COMPLETED 자동 전이 hook (별도 논의)

---

## File Structure

**Backend (new):**
- `apps/api/src/onboarding-template/onboarding-template.controller.ts`
- `apps/api/src/onboarding-template/onboarding-template.service.ts`
- `apps/api/src/onboarding-template/onboarding-template.repo.ts`
- `apps/api/src/onboarding-template/onboarding-template.routes.ts`
- `apps/api/src/onboarding-template/dto/upsert-template.dto.ts`
- `apps/api/src/onboarding-task/onboarding-task.controller.ts`
- `apps/api/src/onboarding-task/onboarding-task.service.ts`
- `apps/api/src/onboarding-task/onboarding-task.repo.ts`
- `apps/api/src/onboarding-task/onboarding-task.routes.ts`
- `apps/api/src/onboarding-task/dto/verify.dto.ts`
- `apps/api/src/onboarding-task/dto/skip.dto.ts`
- `apps/api/src/hiring-dispatch/populate-onboarding-tasks.ts` — dispatch tx 안 populate helper
- `apps/api/__test__/onboarding-template/onboarding-template.service.test.ts`
- `apps/api/__test__/onboarding-task/onboarding-task.service.test.ts`
- `apps/api/__test__/hiring-dispatch/populate-onboarding-tasks.test.ts`
- `apps/api/prisma/migrations/20260828010000_add_onboarding_content/migration.sql`

**Backend (modified):**
- `apps/api/prisma/schema.prisma` — 2 model + Onboarding.contentCompletedAt + relations + enum
- `apps/api/src/hiring-dispatch/hiring-dispatch.service.ts` — dispatch tx 안 populate hook
- `apps/api/src/server.ts` — route 등록
- `apps/api/src/lib/notifications.ts` — 4 새 알림 타입

**Frontend (new):**
- `football/src/pages/onboarding/OnboardingTemplateManagementPage.tsx` — 부서 template CRUD (dept.head·HR·ADMIN)
- `football/src/pages/onboarding/OnboardingChecklistPage.tsx` — 신입 본인 태스크 리스트·self-report
- `football/src/pages/onboarding/OnboardingVerifyPage.tsx` — HR/dept.head verify queue
- `football/src/components/onboarding/TaskEditor.tsx` — template task JSON 편집기
- `football/src/components/onboarding/TaskCard.tsx` — 개별 태스크 표시·액션
- `football/src/services/onboarding-template.service.ts`
- `football/src/services/onboarding-task.service.ts`
- `football/src/types/onboarding-template.ts`
- `football/src/types/onboarding-task.ts`

**Frontend (modified):**
- `football/src/pages/hr/HiringDispatchDetailPage.tsx` — 온보딩 진행률 배지·링크
- 신입 계정 홈 대시보드에 "온보딩 태스크 X/Y" 위젯 (링크는 OnboardingChecklistPage)

---

## Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260828010000_add_onboarding_content/migration.sql`

- [ ] **Step 1: enum + models 추가**

```prisma
enum OnboardingTaskStatus {
  PENDING
  SELF_REPORTED
  DONE
  SKIPPED
}

model OnboardingTemplate {
  id           Int      @id @default(autoincrement())
  departmentId Int      @unique
  name         String
  tasks        Json     // OnboardingTemplateTask[]: [{title, description?, dueDaysFromStart?, requiresVerification, optional}]
  createdById  Int
  updatedById  Int?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  department   Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  createdBy    User       @relation("OnbTemplateCreator", fields: [createdById], references: [id])
  updatedBy    User?      @relation("OnbTemplateUpdater", fields: [updatedById], references: [id])
}

model OnboardingTask {
  id                   Int                  @id @default(autoincrement())
  onboardingId         Int
  title                String
  description          String?
  dueDate              DateTime?
  requiresVerification Boolean              @default(false)
  optional             Boolean              @default(false)
  status               OnboardingTaskStatus @default(PENDING)
  order                Int                  @default(0)

  selfReportedAt       DateTime?
  verifiedById         Int?
  verifiedAt           DateTime?
  verifyNotes          String?
  skipReason           String?

  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  onboarding           Onboarding @relation(fields: [onboardingId], references: [id], onDelete: Cascade)
  verifiedBy           User?      @relation("OnbTaskVerifier", fields: [verifiedById], references: [id])

  @@index([onboardingId, status])
  @@index([onboardingId, order])
}
```

- [ ] **Step 2: 관련 모델에 필드·relation 추가**

```prisma
model Onboarding {
  // ... 기존
  contentCompletedAt DateTime?              // 신규
  tasks              OnboardingTask[]       // 신규 relation
}

model Department {
  // ... 기존
  onboardingTemplate OnboardingTemplate?
}

model User {
  // ... 기존
  createdOnbTemplates OnboardingTemplate[] @relation("OnbTemplateCreator")
  updatedOnbTemplates OnboardingTemplate[] @relation("OnbTemplateUpdater")
  verifiedOnbTasks    OnboardingTask[]     @relation("OnbTaskVerifier")
}
```

- [ ] **Step 3: 마이그레이션 SQL**

```sql
-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'SELF_REPORTED', 'DONE', 'SKIPPED');

-- AlterTable
ALTER TABLE "Onboarding" ADD COLUMN "contentCompletedAt" TIMESTAMP(3);

-- CreateTable OnboardingTemplate
CREATE TABLE "OnboardingTemplate" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tasks" JSONB NOT NULL,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OnboardingTemplate_departmentId_key" ON "OnboardingTemplate"("departmentId");

-- CreateTable OnboardingTask
CREATE TABLE "OnboardingTask" (
    "id" SERIAL NOT NULL,
    "onboardingId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "requiresVerification" BOOLEAN NOT NULL DEFAULT false,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "order" INTEGER NOT NULL DEFAULT 0,
    "selfReportedAt" TIMESTAMP(3),
    "verifiedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "verifyNotes" TEXT,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OnboardingTask_onboardingId_status_idx" ON "OnboardingTask"("onboardingId", "status");
CREATE INDEX "OnboardingTask_onboardingId_order_idx" ON "OnboardingTask"("onboardingId", "order");

-- FKs
ALTER TABLE "OnboardingTemplate"
  ADD CONSTRAINT "OnboardingTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "OnboardingTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "OnboardingTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "OnboardingTask"
  ADD CONSTRAINT "OnboardingTask_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "Onboarding"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "OnboardingTask_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL;
```

- [ ] **Step 4: `pnpm --filter api prisma generate` + migrate dev**

---

## Task 2: OnboardingTemplate 모듈 (CRUD)

**Files:** `apps/api/src/onboarding-template/*`

- [ ] **Step 1: DTOs + Types**

```typescript
// dto/upsert-template.dto.ts
export const TemplateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueDaysFromStart: z.number().int().nonnegative().max(365).optional(),
  requiresVerification: z.boolean().default(false),
  optional: z.boolean().default(false),
});

export const UpsertTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  tasks: z.array(TemplateTaskSchema).min(0).max(100),
});
```

- [ ] **Step 2: Service**

```typescript
export async function upsert(departmentId: number, input: UpsertTemplate, actorId: number) {
  // 부서 존재 + 권한 검증 (dept.head or HR or ADMIN)
  return prisma.onboardingTemplate.upsert({
    where: { departmentId },
    create: { departmentId, name: input.name, tasks: input.tasks, createdById: actorId },
    update: { name: input.name, tasks: input.tasks, updatedById: actorId },
  });
}

export async function get(departmentId: number) {
  return prisma.onboardingTemplate.findUnique({
    where: { departmentId },
    include: { createdBy: true, updatedBy: true },
  });
}

export async function remove(departmentId: number) {
  return prisma.onboardingTemplate.delete({ where: { departmentId } });
}
```

- [ ] **Step 3: Routes + 권한 미들웨어**

```typescript
router.get("/:departmentId", auth, requireRoles(["ADMIN", "HR_MANAGER", "HR_STAFF"]), controller.get);
router.put("/:departmentId", auth, requireDeptHeadOrHR, controller.upsert);
router.delete("/:departmentId", auth, requireDeptHeadOrHR, controller.remove);
```

`requireDeptHeadOrHR` 헬퍼: `Department.headId === req.user.id` OR `role in [ADMIN, HR_MANAGER, HR_STAFF, GM]` OR `isAdminLike()`.

- [ ] **Step 4: 단위 테스트**
- upsert create + update
- 권한 검증 (dept.head 만 편집 가능, 다른 dept.head 는 403)
- Task validation (max 100, title 필수)

---

## Task 3: dispatch() populate hook (원자적)

**Files:**
- Create: `apps/api/src/hiring-dispatch/populate-onboarding-tasks.ts`
- Modify: `apps/api/src/hiring-dispatch/hiring-dispatch.service.ts`

- [ ] **Step 1: populate helper 작성**

```typescript
import type { Prisma } from "@prisma/client";

interface TemplateTask {
  title: string;
  description?: string;
  dueDaysFromStart?: number;
  requiresVerification?: boolean;
  optional?: boolean;
}

export async function populateOnboardingTasks(
  tx: Prisma.TransactionClient,
  onboardingId: number,
  departmentId: number,
  startDate: Date
): Promise<void> {
  const template = await tx.onboardingTemplate.findUnique({ where: { departmentId } });
  if (!template) return;

  const tasks = template.tasks as unknown as TemplateTask[];
  if (tasks.length === 0) return;

  await tx.onboardingTask.createMany({
    data: tasks.map((t, idx) => ({
      onboardingId,
      title: t.title,
      description: t.description ?? null,
      dueDate: t.dueDaysFromStart != null
        ? new Date(startDate.getTime() + t.dueDaysFromStart * 86400000)
        : null,
      requiresVerification: t.requiresVerification ?? false,
      optional: t.optional ?? false,
      order: idx,
    })),
  });
}
```

- [ ] **Step 2: dispatch() $transaction 안에 삽입**

`hiring-dispatch.service.ts:dispatch()` 안 `Onboarding.create()` 직후:

```typescript
const onboarding = await tx.onboarding.create({
  data: { hiringDispatchId, userId, otpCode, otpExpiresAt },
});

// 신규: 온보딩 태스크 자동 populate
await populateOnboardingTasks(tx, onboarding.id, dispatch.departmentId, dispatch.startDate);
```

- [ ] **Step 3: dispatch tx 밖 fire-and-forget 알림**

`provisionNewEmployeeAssets(dispatchId)` 옆:
```typescript
notifyNewEmployeeTasksAssigned(dispatchId).catch(err =>
  console.error("[notifyNewEmployeeTasksAssigned] failed", err)
);
```

`notifyNewEmployeeTasksAssigned(dispatchId)`: onboarding.tasks 개수 조회 후 신입에게 `ONBOARDING_TASKS_ASSIGNED` 알림.

- [ ] **Step 4: 통합 테스트**
- 부서 template 없음 → dispatch 성공, tasks 0개
- Template 있고 tasks 5개 → dispatch 성공, OnboardingTask 5개 생성 (order 0~4)
- dueDaysFromStart 계산 검증 (startDate + N일)
- Template tasks = [] → dispatch 성공, tasks 0개 생성
- populate 실패 시 dispatch 전체 롤백 확인 (User·Onboarding 도 롤백)

---

## Task 4: OnboardingTask 모듈 (상태 전환)

**Files:** `apps/api/src/onboarding-task/*`

- [ ] **Step 1: DTOs**

```typescript
// dto/verify.dto.ts
export const VerifySchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  verifyNotes: z.string().max(2000).optional(),
}).refine(
  d => d.action !== "REJECT" || (d.verifyNotes && d.verifyNotes.length > 0),
  { message: "REJECT requires verifyNotes" }
);

// dto/skip.dto.ts
export const SkipSchema = z.object({
  skipReason: z.string().trim().min(1).max(500),
});
```

- [ ] **Step 2: Service (상태 전환 + 완료 판정)**

```typescript
export async function selfReport(taskId: number, actorId: number) {
  const task = await prisma.onboardingTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { onboarding: true },
  });
  if (task.onboarding.userId !== actorId) throw new HttpError(403, "NOT_TASK_OWNER");
  if (task.status !== "PENDING") throw new HttpError(409, "INVALID_STATE_TRANSITION");

  const nextStatus: OnboardingTaskStatus = task.requiresVerification ? "SELF_REPORTED" : "DONE";
  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { status: nextStatus, selfReportedAt: new Date() },
  });

  if (nextStatus === "SELF_REPORTED") {
    // HR/verifier 에게 알림
    notifyVerifyRequested(task).catch(console.error);
  } else {
    // 즉시 DONE — 완료 판정 훅
    checkContentCompletion(task.onboardingId).catch(console.error);
  }
  return updated;
}

export async function verify(taskId: number, input: VerifyInput, actorId: number) {
  const task = await prisma.onboardingTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { onboarding: true },
  });
  if (task.onboarding.userId === actorId) throw new HttpError(403, "CANNOT_SELF_VERIFY");
  if (task.status !== "SELF_REPORTED") throw new HttpError(409, "INVALID_STATE_TRANSITION");

  const nextStatus: OnboardingTaskStatus = input.action === "APPROVE" ? "DONE" : "PENDING";
  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: {
      status: nextStatus,
      verifiedById: actorId,
      verifiedAt: new Date(),
      verifyNotes: input.verifyNotes ?? null,
    },
  });

  // 신입에게 알림 (APPROVED/REJECTED)
  notifyVerifyResult(task, input.action).catch(console.error);

  if (nextStatus === "DONE") {
    checkContentCompletion(task.onboardingId).catch(console.error);
  }
  return updated;
}

export async function skip(taskId: number, input: SkipInput, actorId: number) {
  const task = await prisma.onboardingTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { onboarding: true },
  });
  const isOwner = task.onboarding.userId === actorId;
  const isHR = /* role check ... */;
  if (!isOwner && !isHR) throw new HttpError(403, "NOT_AUTHORIZED");
  if (!task.optional) throw new HttpError(400, "TASK_NOT_OPTIONAL");
  if (task.status === "DONE" || task.status === "SKIPPED") throw new HttpError(409, "ALREADY_TERMINAL");

  return prisma.onboardingTask.update({
    where: { id: taskId },
    data: { status: "SKIPPED", skipReason: input.skipReason.trim() },
  }).then(u => {
    checkContentCompletion(task.onboardingId).catch(console.error);
    return u;
  });
}

async function checkContentCompletion(onboardingId: number) {
  const incompleteRequired = await prisma.onboardingTask.count({
    where: { onboardingId, optional: false, status: { notIn: ["DONE", "SKIPPED"] } },
  });
  if (incompleteRequired > 0) return;

  const updated = await prisma.onboarding.update({
    where: { id: onboardingId, contentCompletedAt: null },  // 이미 set 됐으면 skip
    data: { contentCompletedAt: new Date() },
  }).catch(() => null);  // 이미 set 된 경우 catch

  if (updated) {
    notifyContentCompleted(onboardingId).catch(console.error);
  }
}
```

- [ ] **Step 3: Routes**

```typescript
router.get("/onboarding/:onboardingId/tasks", auth, requireOnboardingReader, controller.list);
router.patch("/:taskId/self-report", auth, controller.selfReport);   // 본인만
router.patch("/:taskId/verify", auth, requireVerifier, controller.verify);  // HR·dept.head
router.patch("/:taskId/skip", auth, controller.skip);  // 본인 or HR·dept.head
```

- [ ] **Step 4: 단위 테스트**

- selfReport: PENDING → DONE (verify 불필요), PENDING → SELF_REPORTED (verify 필요)
- selfReport: NOT_TASK_OWNER 403
- verify APPROVE: SELF_REPORTED → DONE
- verify REJECT: SELF_REPORTED → PENDING + verifyNotes 저장
- verify: CANNOT_SELF_VERIFY 403 (본인 시도)
- skip: optional 만, PENDING 에서만
- skip: TASK_NOT_OPTIONAL 400
- checkContentCompletion: 모두 완료 시 contentCompletedAt set
- checkContentCompletion: 이미 set 됐으면 재 set 안 함
- checkContentCompletion: optional 미완료는 무시

---

## Task 5: 알림 4종

**Files:** `apps/api/src/lib/notifications.ts` (또는 프로젝트 알림 인프라)

- [ ] **Step 1: NotificationType 추가**

```typescript
enum NotificationType {
  // ... 기존
  ONBOARDING_TASKS_ASSIGNED,
  ONBOARDING_TASK_VERIFY_REQUESTED,
  ONBOARDING_TASK_VERIFIED,     // status: APPROVED
  ONBOARDING_TASK_REJECTED,     // status: REJECTED
  ONBOARDING_CONTENT_COMPLETED,
}
```

- [ ] **Step 2: 4 알림 helper**

- `notifyNewEmployeeTasksAssigned(dispatchId)` — 신입 본인
- `notifyVerifyRequested(task)` — HR + dept.head
- `notifyVerifyResult(task, action)` — 신입 본인
- `notifyContentCompleted(onboardingId)` — 신입 + HR + dept.head

- [ ] **Step 3: 알림 인프라 존재 여부 확인 후 통합**

기존 프로젝트 알림 시스템 (예: `lib/notifications.ts`) 확인 후 새 타입 삽입. 없으면 새 인프라 이슈 분리.

---

## Task 6: Frontend

- [ ] **Step 1: Types + Services**

```typescript
export type OnboardingTaskStatus = "PENDING" | "SELF_REPORTED" | "DONE" | "SKIPPED";

export interface OnboardingTemplateTask {
  title: string;
  description?: string;
  dueDaysFromStart?: number;
  requiresVerification: boolean;
  optional: boolean;
}

export interface OnboardingTemplate {
  id: number;
  departmentId: number;
  name: string;
  tasks: OnboardingTemplateTask[];
  // ... audit fields
}

export interface OnboardingTask {
  id: number;
  onboardingId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  requiresVerification: boolean;
  optional: boolean;
  status: OnboardingTaskStatus;
  order: number;
  selfReportedAt: string | null;
  verifiedById: number | null;
  verifiedAt: string | null;
  verifyNotes: string | null;
  skipReason: string | null;
}
```

- [ ] **Step 2: OnboardingTemplateManagementPage**

- URL: `/departments/:id/onboarding-template`
- Template 조회·편집 (name + tasks 리스트)
- Task editor: drag-drop 순서, 필드 4개 (title/description/dueDaysFromStart/requiresVerification/optional)
- Save = PUT upsert

- [ ] **Step 3: OnboardingChecklistPage (신입 본인)**

- URL: `/my/onboarding`
- Task 리스트 (status 배지·due date 표시)
- 각 task 카드: "완료 마킹" 버튼 (PENDING 시), status 배지 (SELF_REPORTED/DONE/SKIPPED)
- Optional 태스크는 "건너뛰기" 버튼 (skipReason 입력)
- Reject 된 태스크는 verifyNotes 표시 + 다시 self-report 가능
- 진행률 프로그레스 바 (완료/전체)

- [ ] **Step 4: OnboardingVerifyPage (HR/dept.head)**

- URL: `/hr/onboarding-verify`
- SELF_REPORTED status 태스크 큐 (verify 대기)
- Task 상세 dialog: 신입 정보·task 내용·selfReportedAt
- APPROVE / REJECT 버튼 (REJECT 시 verifyNotes 필수)

- [ ] **Step 5: HiringDispatchDetailPage 통합**

- 온보딩 섹션에 진행률 배지 (X/Y done) + `OnboardingChecklistPage` 링크

- [ ] **Step 6: 신입 홈 대시보드 위젯**

- "온보딩 태스크 X 남음" 배지 → OnboardingChecklistPage 링크
- contentCompletedAt 있으면 "온보딩 완료" 배지

---

## Task 7: 문서화

- [ ] **Step 1: CONTEXT.md 갱신**

- `## 채용 발령 (Hiring Dispatch)` EXECUTION 게이트·post-dispatch hook 옆에 "온보딩 태스크 populate" 추가
- 신규 섹션: `## 직무 온보딩 (OnboardingTemplate + OnboardingTask)` — `## 근로계약 (EmployeeContract)` 다음에 배치

- [ ] **Step 2: 후속 이슈 스텁 3개 생성**

- (a) "온보딩 멘토 배정 (`Mentorship` 모델)" — `#374` 참조, 부서장 지정 or 라운드로빈 정책
- (b) "온보딩 자동 이벤트 감지 (crossdomain 훅)" — `#374` 참조, 첫 PR·훈련 참가 등
- (c) "온보딩 due date 임박 알림 cron + 미완료 escalation" — `#374` 참조

---

## 검증 체크리스트

- [ ] `pnpm --filter api tsc --noEmit`
- [ ] `pnpm --filter api test onboarding-template`
- [ ] `pnpm --filter api test onboarding-task`
- [ ] `pnpm --filter api test hiring-dispatch` (populate 회귀)
- [ ] Manual: 부서 template 생성 → dispatch 실행 → 신입 로그인 시 태스크 리스트 확인
- [ ] Manual: 신입 태스크 self-report → HR 검증 대기 → APPROVE → DONE
- [ ] Manual: REJECT → PENDING 복귀 → verifyNotes 표시 → 재 self-report
- [ ] Manual: Optional 태스크 skip → contentCompletedAt 자동 set
- [ ] Manual: 모든 required 완료 → contentCompletedAt set + 알림
- [ ] Manual: 기존 dispatch (template 도입 이전) → tasks 0개, 온보딩 정상 진행
- [ ] Manual: 본인이 자기 태스크 verify 시도 → 403 CANNOT_SELF_VERIFY

---

## Rollback

- 신규 모듈이라 기존 코드 영향 없음
- `populateOnboardingTasks()` 호출 라인 주석 처리로 즉시 populate 비활성화
- Migration 롤백: `OnboardingTask` drop, `OnboardingTemplate` drop, `Onboarding.contentCompletedAt` drop, enum drop

---

## Grill 결정 요약

| # | 질문 | 결정 |
|---|---|---|
| Q1 | 스코프 분할 | **스켈레톤만** (Template + Task 체크리스트). 멘토·자동감지·수습기간(#375 통합)은 후속 이슈 |
| Q2 | 템플릿 스코프 | **Department 1:1** (DepartmentDefaultAssetKit 선례) |
| Q3 | Task 상태·검증 | `PENDING → SELF_REPORTED → DONE / SKIPPED`, verify 필요 시 2단계, reject 시 PENDING 복귀 |
| Q4 | 자동 populate 시점 | `dispatch()` $transaction 안 원자적 populate (Onboarding.create() 직후) |
| Q5 | 완료 판정 | 신규 `Onboarding.contentCompletedAt` 필드. HiringDispatch.COMPLETED 자동 전이는 후속 이슈 |
| Q6 | 권한 | Template CRUD = dept.head + HR + ADMIN. Task self-report = 본인. Verify = HR + dept.head (self-verify 차단) |
| Q7-A | 파일 첨부 | **MVP 미포함** (필요 시 HiringDocument 로 대체) |
| Q7-B | 알림 4종 | populate 완료 · verify 요청 · verify 결과 · content complete |
| Q7-C | 기존 온보딩 하위호환 | 그대로 유지 (tasks = []). Backfill 안 함 |
