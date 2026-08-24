# 채용 발령 워크플로우 (HiringDispatch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 채용 최종합격 이후의 4단계 발령 워크플로우 (조직·예산 최종 재검증 → 발령 승인 → 인사발령 실행 → 온보딩 연계) 를 하나의 신규 `HiringDispatch` 도메인으로 통합한다. 재무팀·임원·HR 3-stage 결재 + Application 없는 임원 스카웃 case + 팀장·HR 특수 권한 협의 채널 지원.

**Why:**
- 현재 채용 파이프라인 (`HiringNeedsSurvey` → `HiringPlanItem` → `PlanReport` → `JobPosting` → `JobApplication` → `Interview` → `ReferenceCheck` → `Onboarding`) 은 **합격 이후 발령까지의 공백**이 큼.
- Application status 에 `OFFERED / HIRED / ONBOARDED` 는 있지만 **재무 최종 재검증 (TO·인건비·offer 일치), 임원 발령 승인, HR 실행 (User+UserDepartment+StaffRecord 생성)** 단계를 위한 model·상태·감사 로그가 없음.
- 임원 스카웃·계약직 즉시 채용 (Application 없이 발령) case 도 없음.
- 특수 권한 부여 (특정 시스템 admin 등) 는 팀장·HR 협의가 필요하지만 지금은 발령 시점에 이걸 캡처할 채널이 없음 → 발령 후 알림·이슈로 처리되며 놓치기 쉬움.

**Architecture:**
- 신규 도메인 `hiring-dispatch` 모듈: `HiringDispatch` (발령 절차) + `HiringDispatchApproval` (감사) 두 테이블.
- 기존 `JobApplication`, `Onboarding`, `Department`, `User`, `UserDepartment`, `StaffRecord`, `HiringPlanItem` 은 유지·재사용.
- `Onboarding` 에 `hiringDispatchId Int? @unique` 신규 필드 추가 (Application-free 발령 케이스 지원, `applicationId XOR hiringDispatchId` app-level 검증).
- 3-stage 결재: 재무팀 매니저 → 임원(ADMIN/GM) → HR 매니저. asset-request / medical-partnership 3-stage 패턴 재사용.
- DISPATCHED 시점 `prisma.$transaction` 안에서 `User` + `UserDepartment` + `StaffRecord` + `Onboarding.create({ hiringDispatchId })` 순차 실행 → status ONBOARDING 전환.

**Tech Stack:** Prisma + PostgreSQL, Express, Jest (unit test), React + TypeScript.

**Related Plans / Specs:**
- `docs/superpowers/plans/2026-08-23-asset-request-workflow.md` — 2/3-stage 결재 패턴 참고
- `docs/superpowers/plans/2026-08-24-medical-partnership.md` — 3-stage 결재 + $transaction 패턴 참고
- CONTEXT.md `## 채용 자동화` (existing), `## HR` (existing)
- ADR 0013 (`docs/adr/0013-asset-request-department-approval.md`) — 결재 흐름 패턴

---

## 🔴 Grill 결정 (2026-08-24)

**재논의 금지.**

### Q1: gap 처리 방식
- **선택: A** — 신규 모듈 `HiringDispatch` (4 gap 통합 상태머신)
- 팀원 CRUD (팀장 밑 팀원 관리) 는 **분리** (별도 grill 세션)

### Q2: `HiringDispatch` ↔ `JobApplication` 관계
- **선택: B (`applicationId Int? @unique` nullable)**
- default 흐름: Application OFFERED → HiringDispatch 자동 create
- 예외: 임원 스카웃·계약직 즉시 채용 (Application 없음) — HR 이 직접 create

### Q3: 상태머신
- **6-state + 반려/취소**:
  ```
  CREATED → BUDGET_REVERIFIED → DISPATCH_APPROVED → DISPATCHED → ONBOARDING → COMPLETED
      ↓           ↓                    ↓
  CANCELLED   REJECTED           REJECTED
  ```

### Q4: 승인권자 매핑
- **BUDGET_REVERIFIED**: `frontOfficeRole = 'FINANCE_MANAGER'` OR `isAdminLike(role)`
- **DISPATCH_APPROVED**: `role IN ('ADMIN', 'SUPER_ADMIN', 'GM')` (`isAdminLike`)
- **DISPATCHED**: `frontOfficeRole = 'HR_MANAGER'` OR `isAdminLike(role)`
- 각 stage self-approval 차단
- `@@unique([dispatchId, stage])`

### Q5: 확정 필드
- `jobTitle String`, `jobGrade JobGrade` (enum), `employmentType EmploymentType` (enum), `departmentId Int` (leaf), `reportsToUserId Int?`, `monthlySalary BigInt`, `startDate DateTime`
- **Q5-1**: `JobGrade` enum 6-value (`INTERN, JUNIOR, ASSOCIATE, MANAGER, DIRECTOR, EXECUTIVE`) — free text 아님
- **Q5-2**: `EmploymentType` enum 5-value (`FULL_TIME, PART_TIME, CONTRACT, INTERN, ADVISOR`)

### Q6: DISPATCHED 시점 부작용 ($transaction)
- **`targetRole Role` + `targetFrontOfficeRole FrontOfficeRole?` + `targetCoachingRole CoachingRole?`** 필드로 대상 role 명시
- $transaction 안에서:
  1. `User.create({ email, role, frontOfficeRole, coachingRole, tempPassword })`
  2. `UserDepartment.create({ userId, departmentId, role: 'MEMBER' })`
  3. `StaffRecord.create({ userId, ... })`
  4. `Onboarding.create({ hiringDispatchId })` (Q11-1 b 반영)
  5. `HiringDispatch.update({ status: DISPATCHED, createdUserId })`
  6. 커밋 후 notif fire-and-forget (팀장 + HR + candidate)

### Q7: 기존 Onboarding 재사용
- **선택: A** — 기존 `Onboarding` 재사용. 발령 후 절차 (OTP 이메일, MFA 세팅) 는 그대로.
- Q11-1 b 반영: `Onboarding.hiringDispatchId Int? @unique` 추가하여 Application-free 케이스도 온보딩 지원.

### Q8: 코스트센터
- **선택: A** — 기존 `Department` = cost center. 별도 필드/모델 없음.
- 후속: 외부 ERP 연동 시 `Department.costCenterCode` 추가 검토.

### Q9: 시스템 권한 자동 부여 + 팀장·HR 협의
- **Q9-A: role auto** — `User.role` + `frontOfficeRole`/`coachingRole` 만 자동 세팅. 세부 권한은 기존 `permissions.ts` 시스템에 위임.
- **Q9-B: A (permissionNotes + 알림)** — `HiringDispatch.permissionNotes String?` (팀장이 발령 요청 시 서술) → DISPATCHED 알림에 HR 에게 포함 → 수동 후속 부여.
- **Q9-C**: DISPATCHED 알림 대상: 신청 팀장 (department.headId) + HR 매니저 (permissionNotes 있으면).
- **Q9-D: X** — HR 이 HiringDispatch owner. 팀장 involvement 는 `permissionNotes` 채우기만.
- 상시 access request 채널 (별도 model) 은 **non-goal**.

### Q10: BUDGET_REVERIFIED 재검증 대상
- **선택: D (셋 다)**
  1. TO 초과: `HiringPlanItem.headcount` vs 부서 현재 인원 + 1
  2. 예산 잔액: 부서 월 인건비 예산 vs 현재 지출 + `monthlySalary`
  3. Offer 일치: `HiringDispatch.monthlySalary` vs `JobApplication.offeredSalary` (nullable)
- 검증 실패 처리:
  - TO 초과 → warning (재무팀 override 가능)
  - 예산 초과 → 400 `BUDGET_EXCEEDED` (강한 차단)
  - Offer 불일치 → warning (승인 시 재무팀 body 로 override 명시)

### Q10-1: TO 상한 소스
- **선택: B (`HiringPlanItem.headcount` 재사용)** — 채용 계획 단계에서 정한 headcount 를 TO 상한으로. `Department` 에 신규 필드 없음.
- Application-free 케이스는 TO 검증 skip (HiringPlanItem 참조 없음).

### Q11-1: Application-free 온보딩
- **선택: b** — `Onboarding.hiringDispatchId Int? @unique` 추가. `applicationId XOR hiringDispatchId` app-level 검증 (하나만 non-null).

### Q11-2: 반려 시 Application status
- **선택: B (그대로 유지)** — HiringDispatch REJECTED 되어도 Application 은 OFFERED 유지. HR 이 상황 봐서 재제출 or Application 별건 처리.

### Q11-3: 취소 (CANCELLED)
- HR 만 취소 가능. Status ∈ {CREATED, BUDGET_REVERIFIED} 에서만 (승인 이후 롤백은 별건 절차).
- Candidate 사퇴 case: HR 이 cancel(reason='CANDIDATE_WITHDREW').

---

## Task 1: 착수 확인 + 브랜치

- [ ] **Step 1: 기존 관련 model 확인**
```bash
grep -n "^model JobApplication\b\|^model Onboarding\b\|^model StaffRecord\b\|^model UserDepartment\b\|^model HiringPlanItem\b" apps/api/prisma/schema.prisma
```
- 각 모델 필드 최신 상태 검증
- `Onboarding.applicationId` 가 이미 `@unique` 인지 확인 (`@@check` 여부)

- [ ] **Step 2: role/perm 매핑 검증**
```bash
grep -n "FINANCE_MANAGER\|HR_MANAGER\|isAdminLike\|hasPermission" apps/api/src/lib/permissions.ts
```
Q4 3-stage 승인권자 role 값 확인.

- [ ] **Step 3: HiringPlanItem headcount 필드 확인**
```bash
grep -A15 "^model HiringPlanItem" apps/api/prisma/schema.prisma
```
Q10-1 TO 상한 소스 검증. headcount 필드가 없으면 Q10-1 재검토 필요.

- [ ] **Step 4: 브랜치 생성**
```bash
git checkout -b feat/hiring-dispatch
```

---

## Task 2: Prisma schema

- [ ] **Step 1: 신규 enums**
```prisma
enum HiringDispatchStatus {
  CREATED
  BUDGET_REVERIFIED
  DISPATCH_APPROVED
  DISPATCHED
  ONBOARDING
  COMPLETED
  REJECTED
  CANCELLED
}

enum HiringDispatchStage {
  BUDGET_REVIEW
  DISPATCH_APPROVAL
  EXECUTION
}

enum HiringDispatchAction { APPROVED, REJECTED }

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERN
  ADVISOR
}

enum JobGrade {
  INTERN
  JUNIOR
  ASSOCIATE
  MANAGER
  DIRECTOR
  EXECUTIVE
}
```

- [ ] **Step 2: `HiringDispatch` model**
```prisma
model HiringDispatch {
  id                    Int @id @default(autoincrement())
  applicationId         Int? @unique
  candidateName         String
  candidateEmail        String
  jobTitle              String
  jobGrade              JobGrade
  employmentType        EmploymentType
  departmentId          Int
  reportsToUserId       Int?
  monthlySalary         BigInt
  startDate             DateTime
  targetRole            Role
  targetFrontOfficeRole FrontOfficeRole?
  targetCoachingRole    CoachingRole?
  permissionNotes       String?
  status                HiringDispatchStatus @default(CREATED)
  createdUserId         Int? @unique
  createdById           Int
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  application    JobApplication? @relation(fields: [applicationId], references: [id])
  department     Department      @relation(fields: [departmentId], references: [id])
  reportsToUser  User?           @relation("DispatchReportsTo", fields: [reportsToUserId], references: [id])
  createdUser    User?           @relation("DispatchCreatedUser", fields: [createdUserId], references: [id])
  createdBy      User            @relation("DispatchCreator", fields: [createdById], references: [id])
  approvals      HiringDispatchApproval[]
  onboarding     Onboarding?

  @@index([status, createdAt])
  @@index([departmentId, status])
}
```

- [ ] **Step 3: `HiringDispatchApproval` model**
```prisma
model HiringDispatchApproval {
  id             Int @id @default(autoincrement())
  dispatchId     Int
  stage          HiringDispatchStage
  action         HiringDispatchAction
  reviewerId     Int
  reason         String?
  createdAt      DateTime @default(now())

  dispatch       HiringDispatch @relation(fields: [dispatchId], references: [id], onDelete: Cascade)
  reviewer       User           @relation("DispatchReviewer", fields: [reviewerId], references: [id])

  @@unique([dispatchId, stage])
  @@index([dispatchId, stage])
}
```

- [ ] **Step 4: 기존 모델 확장**
- `Onboarding`: `hiringDispatchId Int? @unique` 신규 + 관계
  - **주의**: `applicationId` 도 `@unique` 유지. XOR 은 app-level.
- `JobApplication`: 역참조 `hiringDispatch HiringDispatch?`
- `Department`: 역참조 `hiringDispatches HiringDispatch[]`
- `User`: 역참조 4개 (`DispatchCreator`, `DispatchCreatedUser`, `DispatchReportsTo`, `DispatchReviewer`)

- [ ] **Step 5: `prisma format` + `validate`**

- [ ] **Step 6: Commit**
```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add HiringDispatch + Approval models, Onboarding.hiringDispatchId"
```

---

## Task 3: Migration + scratch DB

- [ ] **Step 1: `prisma migrate dev --create-only --name hiring_dispatch`**
- [ ] **Step 2: SQL 검토**
- [ ] **Step 3: `prisma migrate reset --force --skip-seed` + `deploy` + `seed`**
- [ ] **Step 4: Commit**

---

## Task 4: 백엔드 모듈

**Files:**
- `apps/api/src/hiring-dispatch/hiring-dispatch.repo.ts`
- `apps/api/src/hiring-dispatch/hiring-dispatch.service.ts`
- `apps/api/src/hiring-dispatch/hiring-dispatch.controller.ts`
- `apps/api/src/hiring-dispatch/hiring-dispatch.routes.ts`
- `apps/api/src/hiring-dispatch/dto/hiring-dispatch.dto.ts`
- Modify: `apps/api/src/apiRouter.ts`
- Modify: `apps/api/src/onboarding/*` (기존 Onboarding create 로직에 hiringDispatchId 지원)

**Service — 핵심 로직:**

- `create(dto, hrUserId)`:
  - `applicationId` 있으면 → OFFERED status 검증
  - 없으면 → HR only (isAdminLike or HR_MANAGER)
  - 필수 필드 검증 (jobTitle, jobGrade, employmentType, deptId, salary, startDate, targetRole)
  - status CREATED

- `budgetReverify(id, reviewerId, role, foRole, body: { toOverride?: bool, offerMismatchOverride?: bool })`:
  - reviewer = `frontOfficeRole=FINANCE_MANAGER` OR `isAdminLike(role)`
  - self-approval 차단
  - **Q10 D 재검증:**
    - TO (`HiringPlanItem.headcount` vs 현재 부서 인원): 초과 시 `toOverride=true` 없으면 warning 반환
    - 예산 (`monthlySalary` vs 부서 남은 인건비): 초과 시 강한 차단 (`BUDGET_EXCEEDED`)
    - Offer 일치 (있는 경우): 불일치 시 `offerMismatchOverride=true` 없으면 warning
  - 성공 시 status → BUDGET_REVERIFIED + approval row + audit

- `budgetReject(id, reviewerId, role, foRole, reason)`

- `dispatchApprove(id, reviewerId, role)`:
  - `isAdminLike(role)`, self-approval 차단
  - status BUDGET_REVERIFIED → DISPATCH_APPROVED + approval row

- `dispatchReject(id, reviewerId, role, reason)`

- `dispatch(id, reviewerId, role, foRole)` — **HR 실행**:
  - `frontOfficeRole=HR_MANAGER` OR `isAdminLike(role)`, self-approval 차단
  - status DISPATCH_APPROVED → DISPATCHED
  - **$transaction:**
    1. Generate temp password, encrypt PII (phoneNumber 등 encrypt required)
    2. `User.create` — role/foRole/coachingRole 부여
    3. `UserDepartment.create({ userId, departmentId, role: 'MEMBER' })`
    4. `StaffRecord.create({ userId, name, dept, phone, hireDate })`
    5. `Onboarding.create({ hiringDispatchId })` (Q11-1 b)
    6. `HiringDispatch.update({ status: DISPATCHED, createdUserId })`
  - 트랜잭션 커밋 후:
    - status → ONBOARDING (자동 전환, 기존 Onboarding flow 진입)
    - Notif fire-and-forget: 팀장 (dept.head), HR (permissionNotes 있으면), candidate (OTP 이메일)

- `cancel(id, userId, role, foRole, reason)`:
  - status ∈ {CREATED, BUDGET_REVERIFIED} 만
  - HR only (`isAdminLike` OR `HR_MANAGER`)
  - reason 필수 (CANDIDATE_WITHDREW / OTHER)
  - status → CANCELLED

- `complete(id, userId, role, foRole)`:
  - status ONBOARDING → COMPLETED. Onboarding 완료 시 자동 호출 (또는 수동 API)

**Controller & Routes:**
```
POST   /hiring-dispatches
GET    /hiring-dispatches?filter=me|pending-budget|pending-dispatch|pending-execution|all&status=
GET    /hiring-dispatches/:id
PATCH  /hiring-dispatches/:id/budget-reverify  body?: { toOverride?, offerMismatchOverride? }
PATCH  /hiring-dispatches/:id/budget-reject     body: { reason }
PATCH  /hiring-dispatches/:id/dispatch-approve
PATCH  /hiring-dispatches/:id/dispatch-reject   body: { reason }
PATCH  /hiring-dispatches/:id/dispatch          (실행)
PATCH  /hiring-dispatches/:id/cancel            body: { reason }
PATCH  /hiring-dispatches/:id/complete          (수동 완료 or 온보딩 완료 시 자동)
```
등록: `apiRouter.use('/hiring-dispatches', hiringDispatchRouter)`

**테스트:**
- create success (Application 있는 case, 없는 case)
- create 실패 (Application 상태 not OFFERED)
- budgetReverify: TO warning + override, 예산 초과 400, offer mismatch warning
- 각 stage self-approval 차단
- dispatch $transaction 성공 (User + UserDept + StaffRecord + Onboarding create 검증)
- dispatch 롤백 시나리오 (예: email 중복 → 트랜잭션 롤백)
- cancel (status 조건)
- reject 각 stage
- Application-free full path

- [ ] **Step 5: Commit**

---

## Task 5: 알림 + Cron

- [ ] **Step 1: NotificationType 신규 값**
  - `HIRING_DISPATCH_CREATED` (수신 재무팀)
  - `HIRING_DISPATCH_BUDGET_REVERIFIED` (수신 임원)
  - `HIRING_DISPATCH_DISPATCH_APPROVED` (수신 HR)
  - `HIRING_DISPATCH_DISPATCHED` (수신 팀장 + HR + candidate)
  - `HIRING_DISPATCH_REJECTED` (수신 신청자 + HR)
  - `HIRING_DISPATCH_CANCELLED` (수신 관련자)
  - `HIRING_DISPATCH_PERMISSION_REQUESTED` (permissionNotes 있는 경우, DISPATCHED 시 HR)

- [ ] **Step 2: Migration**
```bash
cd apps/api && npx prisma migrate dev --name hiring_dispatch_notification_types
```
(shadow-DB fail 시 handcraft `ALTER TYPE ADD VALUE IF NOT EXISTS`)

- [ ] **Step 3: Cron 필요 여부 검토**
- Application 없이 permanently CREATED 상태로 방치된 dispatch → HR 알림 (선택)
- MVP 는 cron 없음 (수동 처리)

- [ ] **Step 4: Commit**

---

## Task 6: Frontend

**Files:**
- `football/src/types/hiring-dispatch.ts`
- `football/src/services/hiring-dispatch.service.ts`
- `football/src/hooks/useHiringDispatches.ts`
- `football/src/pages/hiring/HiringDispatchPage.tsx` (목록·생성·상세)
- `football/src/pages/hiring/HiringDispatchApprovalPage.tsx` (3-stage 결재함)
- Modify: `football/src/App.tsx`, `football/src/layouts/AppShell.tsx`, `football/src/locales/{ko,en}/common.json`

주의사항 (이 세션 반영):
- `<SelectItem label={...}>` 명시 (PR #336)
- Error toast 에서 backend `code` 매핑 (PR #329)
- 3-stage 결재함 tabs: 재무팀 / 임원 / HR
- 생성 폼: Application 선택 (dropdown, optional) or 직접 입력 (candidateName/Email)
- budgetReverify UI: TO 경고 / 예산 초과 (강한 차단) / offer mismatch 경고 표시 + override 체크박스

- [ ] **Step 1: types + service + hook**
- [ ] **Step 2: 목록·생성·상세**
- [ ] **Step 3: 결재함 (3-stage tabs)**
- [ ] **Step 4: nav 2항목 (목록 / 결재함)**
- [ ] **Step 5: type-check + commit**

---

## Task 7: ADR + CONTEXT.md

- [ ] **Step 1: ADR 0015 (`docs/adr/0015-hiring-dispatch-workflow.md`)**
- Context: 채용 파이프라인의 발령 gap
- Decision: 신규 HiringDispatch 도메인 + 3-stage 결재 + $transaction 안 User 생성
- Alternatives: JobApplication 확장 (rejected), Onboarding 확장 (rejected)
- Consequences (+): 발령 감사 로그 완비, Application-free 케이스 지원, 재무 재검증 자동화
- Consequences (-): 채용 도메인 model 개수 증가, Onboarding 2-way ref 복잡

- [ ] **Step 2: CONTEXT.md 신규 섹션** `## 채용 발령 (Hiring Dispatch)`
- 상태머신, 3-stage 결재 역할, User 생성 $transaction 순서, permissionNotes 협의 흐름

- [ ] **Step 3: Commit**

---

## Task 8: 전체 스모크 + PR

- [ ] **Step 1: tsc + jest**
- [ ] **Step 2: E2E 시나리오**
  1. HR 이 Application 기반 dispatch create (CREATED)
  2. 재무팀 매니저: budgetReverify (TO warning override + 예산 통과) → BUDGET_REVERIFIED
  3. ADMIN: dispatchApprove → DISPATCH_APPROVED
  4. HR: dispatch → DISPATCHED (User + UserDept + StaffRecord + Onboarding 자동 create)
  5. Onboarding 완료 → COMPLETED
  6. Application-free path: HR 이 candidateName/Email 직접 입력 후 전체 flow
  7. Self-approval 시나리오: HR 이 신청+실행 겸직 → 403
  8. 예산 초과 시나리오: monthlySalary 과다 → 400 BUDGET_EXCEEDED

- [ ] **Step 3: PR 생성**

---

## 위험 / 안전 노트

1. **`Onboarding.applicationId XOR hiringDispatchId`** — DB constraint 로 강제 불가 (Prisma CHECK 미지원). App-level 검증 필수. `Onboarding.create` 시 둘 중 하나만 non-null 강제.
2. **DISPATCHED $transaction rollback 시나리오** — email 중복, PII encryption 실패 등. 원자성 보장 필수.
3. **Self-approval 3-stage 각 stage 별로 명시** (asset-request 교훈).
4. **Notification fire-and-forget** (`.catch(console.error)`).
5. **BudgetReverify override** — 재무팀 결정을 이력에 남겨야 (approval row.reason 에 "TO override: X, offer override: Y" 등 자유텍스트 기록).
6. **HiringPlanItem 없는 케이스** (Application-free) — Q10-1 TO 검증 skip. Warning 없이 통과.
7. **User.email 중복 검증** — DISPATCHED 실행 시점에 email 중복 → 400. HR 이 candidateEmail 조정 후 재실행.

---

## Non-goals (Follow-up)

- **팀원 CRUD (팀장 밑 UserDepartment 확장)** — 별도 grill 세션 (task #23).
- **상시 access request 채널** (권한 부여 워크플로우) — Q9 D 로 언급된 별도 model.
- **Cron 자동화** — 방치된 dispatch 알림, 만료 임박 등. MVP 후.
- **재발령 (조기 이동)** — 이미 발령된 유저의 부서 이동. 별도 도메인.
- **인수인계 (offboarding)** — 발령 반대. 별도 domain.

---

## Self-Review

**Grill decision coverage:**
- Q1 (신규 모듈) ✅ Task 2
- Q2 (nullable applicationId) ✅ Task 2 Step 2
- Q3 (상태머신 6-state) ✅ Task 2 Step 1 enum + Task 4 service
- Q4 (승인권자 매핑) ✅ Task 4 service (role/foRole 검증)
- Q5 (확정 필드 + enum) ✅ Task 2 Step 1 + 2
- Q6 (DISPATCHED $transaction) ✅ Task 4 service
- Q7 (Onboarding 재사용) ✅ Task 2 Step 4 (hiringDispatchId 추가)
- Q8 (Department=CC) ✅ 기존 model 재사용, 신규 필드 없음
- Q9 (권한 자동 + 협의) ✅ Task 2 Step 2 (permissionNotes) + Task 5 (notification)
- Q10 (재검증 3항목) ✅ Task 4 service budgetReverify
- Q10-1 (HiringPlanItem 재사용) ✅ Task 4 service TO 검증
- Q11-1 (Onboarding.hiringDispatchId) ✅ Task 2 Step 4
- Q11-2 (Application 그대로) ✅ Task 4 service (reject 시 Application 미변경)
- Q11-3 (취소 조건) ✅ Task 4 service cancel

**Safety:**
- Scratch DB reset (Task 3)
- Self-approval 3-stage 각각
- DISPATCHED $transaction atomic
- Notification fire-and-forget
