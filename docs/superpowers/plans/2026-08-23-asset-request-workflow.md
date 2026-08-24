# 자산 신청 워크플로우 (Asset Request) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 각 부서 소속 직원이 소프트웨어 라이선스 또는 하드웨어 자산을 신청하고 팀장 → 부서장 2단계 결재를 거쳐 승인되면 신청 부서의 운영비 예산에서 자동 차감된다. 모든 결재 단계가 감사 로그로 기록된다.

**Why:**
- 현재 `Equipment` / `SoftwareLicense`는 관리 부서(EQUIPMENT_MANAGER, ASSET_MANAGER)가 top-down으로 CRUD만 함. **일반 직원이 자산을 신청할 수 없음.**
- 지출 결재는 `OperatingExpense` PR #309에 있지만 재무팀 내부 결재(FINANCE_STAFF → FINANCE_MANAGER)라 **부서 자율 결재 흐름이 없음.**
- 부서 예산 소진을 직원 개별 지출까지 pull 방식으로 자동 반영해야 실시간 잔여예산 대시보드가 의미 있음.
- 감사 로그 강도 강화 (구독비 / 기기비의 이중 승인 이력 필수).

**Architecture:**
- 신규 도메인 `asset-request` 모듈: `AssetRequest` + `AssetRequestApproval` (감사 이력) 두 테이블.
- 승인 흐름은 `Department.parentId` / `Department.headId` 계층을 재사용 — 새 role/필드 도입 없음.
- 승인 시 `OperatingExpense`(status=APPROVED) 자동 생성 → 재무 결재는 skip → 지출 실행(PAID)만 재무팀이 처리.
- SW 구독은 총액 1건 + `SoftwareLicensePayment` 서브테이블 회차 tracking (별도 스코프).
- HW 일회성은 OperatingExpense 1건 + 감가상각 cron 기존 로직 재사용.

**Tech Stack:** Prisma + PostgreSQL, Express, Jest (unit test), React + TypeScript.

**Related Plans / Specs:**
- `docs/superpowers/plans/2026-08-05-asset-mgmt-feature.md` — Equipment / SoftwareLicense CRUD (완료)
- `docs/superpowers/plans/2026-08-22-operating-expense-approval.md` — 재무팀 지출 결재 (완료, PR #309)
- `docs/superpowers/plans/2026-08-22-category-table-refactor.md` — ExpenseCategory 테이블화 (완료, PR #315/#320)
- CONTEXT.md `## 부서 (Department)`, `## 자산 신청 워크플로우 (Asset Request)`

---

## 🔴 Grill 결정 (2026-08-23)

**재논의 금지.** 아래 결정에 의문 시 grill 세션 재개.

### Q1: 결재 계층
- **선택: B안 (Department hierarchy 사용) + 2-stage (팀장 → 부서장)**
- 팀장 = 신청자 소속 leaf `Department.head`
- 부서장 = 신청자 소속 leaf `Department.parent.head`
- GM / ADMIN은 workflow **외부**. audit log 열람만.
- 이유: 유저 원 표현 정확 일치, 스키마 이미 지원 (`parentId` + `headId`), scope creep 방지.

### Q2-i: 신청 대상 payload
- **선택: c (하이브리드)** — 마스터 FK (`equipmentItemId?` / `softwareLicenseId?`) 또는 자유입력 (`customName`, `customDescription`)
- 승인 후 FULFILLED 단계에서 관리 부서가 신규 마스터 등록 여부 결정.

### Q2-ii: "차감" 정의
- **선택: B (실적 지출 기록)** — `BudgetCategoryPlan.mandatoryMinimum`이 아닌 `OperatingExpense` 실적 레코드 생성으로 반영.
- 잔여예산 계산은 기존 pull 방식 (`knapsackAllocated - Σ 실적지출`) 자동.
- 계획(plan) 자체는 시즌 초에만 확정, 자산 승인마다 계획 수정 안 함.

### Q2-iii: 팀 vs 부서 이중 차감
- **선택: c (leaf 부서 실적 태그 + 상위 롤업 표시)**
- `OperatingExpense.departmentId Int?` 신규 필드 = 신청자 leaf 부서
- 대시보드에서 상위 부서 = leaf 부서들 합산으로 롤업 조회.

### Q3-1: 재무 결재 재통과
- **선택: b (재무 결재 skip)** — AssetRequest APPROVED → OperatingExpense(status=APPROVED) 직행.
- 재무팀은 PAID 실행 + audit log 열람만.
- 이유: 원 표현 2단계 준수, 부서장 승인 = 지출 결정 최종 책임, `createWithBudgetCheck()`가 이미 초과 방어.

### Q3-2: 상태머신
```
DRAFT ──► SUBMITTED ──► LEADER_APPROVED ──► APPROVED ──► FULFILLED
             ↓                ↓                 ↓
         CANCELLED     LEADER_REJECTED     REJECTED
```

### Q4-1: SW/HW OperatingExpense payload
- **선택: c** — SW는 계획 반영은 총액 1건 + 실제 결제는 `SoftwareLicensePayment` 회차 tracking. HW는 1건.
- `SoftwareLicensePayment` 신규 테이블 = **이 plan 스코프 밖 (Follow-up).**
- 이번 plan에서는 SW도 총액 1건 OperatingExpense만.

### Q4-2: OperatingExpense.category 결정
- **선택: X (신청자 명시 선택)** — 신청 폼에 `expenseCategoryId Int NOT NULL` 필수.
- ExpenseCategory 마스터(9행)에서 dropdown.

### Q5-1: BudgetLine 매칭
- **선택: c (자동 매칭 + fallback)**
- 우선: `(budgetHeader.status=APPROVED, seasonId=active, departmentId=신청자leaf, categoryId=선택cat)` 매칭.
- Fallback: `departmentId=null` (전사 공용) 매칭.
- 둘 다 실패: `BUDGET_LINE_NOT_FOUND` 400 반환.
- **year/month 매칭:** 활성 시즌의 연도/월 자동 (신청 date 기준). 월별 line은 신청 date의 month, year-only line은 year만.

### Q5-2: BUDGET_EXCEEDED 처리
- **선택: Y (부서장 승인 시점 차단)** — SUBMITTED, LEADER_APPROVED까지 통과. 부서장 approve 호출 시 검증.
- BUDGET_EXCEEDED 시 부서장에게 명시적 에러 반환. 신청자는 사유 확인 후 취소 or 예비비 배정 후 재승인 요청.

---

## Task 1: 착수 확인 + 브랜치

**Files:** (read-only + git)

- [ ] **Step 1: Department 계층 데이터 상태 점검**
```bash
# 하위 부서(parentId 있음)와 headId 채워진 부서 확인
docker compose exec postgres psql -U postgres -d football \
  -c 'SELECT id, name, "parentId", "headId" FROM "Department" ORDER BY "parentId" NULLS FIRST, id LIMIT 30;'
```
확인 사항:
- parentId 계층이 실제로 구성되어 있나 (예: "시설관리팀 – 그라운드 매니지먼트"가 "시설관리팀"의 child?)
- headId가 채워진 부서는 몇 개?
- **결과에 따라 별도 Task 0.5 (seed 정비) 필요할 수 있음** — 계층 구조가 flat이면 grill Q1 결정 무의미해짐.

- [ ] **Step 2: OperatingExpense 결재 흐름 API 재확인**
```bash
grep -n "async approve\|async firstApprove\|createWithBudgetCheck" \
  apps/api/src/operating-expense/*.ts | head
```
`OperatingExpenseRepository.createWithBudgetCheck()` 시그니처와 반환값 재확인 — AssetRequest 승인 시 재사용.

- [ ] **Step 3: 브랜치 생성**
```bash
git checkout -b feat/asset-request-workflow
```

---

## Task 2: Prisma schema — `AssetRequest` + `AssetRequestApproval` 모델 신규 + `OperatingExpense.departmentId` 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: 신규 enum 추가**
```prisma
enum AssetRequestStatus {
  DRAFT
  SUBMITTED
  LEADER_APPROVED
  LEADER_REJECTED
  APPROVED
  REJECTED
  CANCELLED
  FULFILLED
}

enum AssetRequestType {
  SOFTWARE
  HARDWARE
}

enum AssetRequestApprovalStage {
  LEADER      // 팀장 (신청자 dept.head)
  DEPT_HEAD   // 부서장 (parent dept.head)
}

enum AssetRequestApprovalAction {
  APPROVED
  REJECTED
}
```

- [ ] **Step 2: `AssetRequest` 모델**
```prisma
model AssetRequest {
  id                Int                @id @default(autoincrement())
  requesterId       Int                // 신청자 (User)
  departmentId      Int                // 신청자 소속 leaf Department
  type              AssetRequestType
  status            AssetRequestStatus @default(DRAFT)

  // payload — 하이브리드 (Q2-i c)
  equipmentItemId   Int?               // HW 마스터 참조 (선택)
  softwareLicenseId Int?               // SW 마스터 참조 (선택)
  customName        String?            // 자유입력 (마스터 없을 때)
  customDescription String?

  // OperatingExpense 매핑에 필요
  expenseCategoryId Int                // 신청자가 명시 선택 (Q4-2 X)
  expectedAmount    Int                // 예상 총액 (SW는 연 총액)
  neededBy          DateTime?          // 사용 시작 희망일 (선택)
  justification     String             // 사유 (필수, 감사 기록용)

  // 승인 결과 링크
  operatingExpenseId Int?              // APPROVED 시 자동 생성된 지출 레코드

  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  requester         User               @relation("AssetRequestRequester", fields: [requesterId], references: [id])
  department        Department         @relation(fields: [departmentId], references: [id])
  expenseCategory   ExpenseCategory    @relation(fields: [expenseCategoryId], references: [id])
  equipmentItem     EquipmentItem?     @relation(fields: [equipmentItemId], references: [id])
  softwareLicense   SoftwareLicense?   @relation(fields: [softwareLicenseId], references: [id])
  operatingExpense  OperatingExpense?  @relation(fields: [operatingExpenseId], references: [id])
  approvals         AssetRequestApproval[]

  @@index([requesterId, status])
  @@index([departmentId, status])
  @@index([status, createdAt])
}
```

- [ ] **Step 3: `AssetRequestApproval` 모델 (감사 이력)**
```prisma
model AssetRequestApproval {
  id             Int                          @id @default(autoincrement())
  assetRequestId Int
  stage          AssetRequestApprovalStage    // LEADER | DEPT_HEAD
  action         AssetRequestApprovalAction   // APPROVED | REJECTED
  reviewerId     Int                          // 승인/반려한 유저
  reason         String?                      // 반려 시 필수
  createdAt      DateTime                     @default(now())

  assetRequest   AssetRequest                 @relation(fields: [assetRequestId], references: [id], onDelete: Cascade)
  reviewer       User                         @relation("AssetRequestReviewer", fields: [reviewerId], references: [id])

  @@index([assetRequestId, stage])
  @@unique([assetRequestId, stage])  // 동일 단계 중복 방지 — action 제외로 모순된 승인 DB 차단
}
```

> Note: unique on `[assetRequestId, stage]` — one decision per stage. `action` intentionally excluded so DB rejects contradictory approvals.

- [ ] **Step 4: `OperatingExpense.departmentId Int?` + relation 추가** (Q2-iii c)
```prisma
model OperatingExpense {
  // ... 기존 ...
  departmentId    Int?              // ← 신규. leaf 부서 태그 (nullable = 부서 무관 지출)
  // ... 기존 ...
  department      Department?       @relation(fields: [departmentId], references: [id])
}
```
+ `Department` model에 역방향 relation `operatingExpenses OperatingExpense[]` 추가.

- [ ] **Step 5: `Department`, `User`, `ExpenseCategory`, `EquipmentItem`, `SoftwareLicense`에 역방향 relation 추가**
- `User`: `assetRequests AssetRequest[] @relation("AssetRequestRequester")`, `assetRequestApprovals AssetRequestApproval[] @relation("AssetRequestReviewer")`
- `Department`: `assetRequests AssetRequest[]`, `operatingExpenses OperatingExpense[]`
- `ExpenseCategory`: `assetRequests AssetRequest[]`
- `EquipmentItem`: `assetRequests AssetRequest[]`
- `SoftwareLicense`: `assetRequests AssetRequest[]`

- [ ] **Step 6: `npx prisma format`**
```bash
cd apps/api && npx prisma format
```

- [ ] **Step 7: Commit (schema만, migration은 Task 3)**
```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add AssetRequest + AssetRequestApproval models, OperatingExpense.departmentId"
```

---

## Task 3: Migration 파일 생성 + scratch DB 검증

**Files:**
- Create: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_asset_request_workflow/migration.sql`

- [ ] **Step 1: Prisma auto-generate**
```bash
cd apps/api
npx prisma migrate dev --create-only --name asset_request_workflow
```

- [ ] **Step 2: 생성된 SQL 검토**
기대 내용:
- `CREATE TYPE "AssetRequestStatus" ...` (4 신규 enum)
- `CREATE TABLE "AssetRequest" ...` (FK 6개)
- `CREATE TABLE "AssetRequestApproval" ...` (FK 2개, unique index)
- `ALTER TABLE "OperatingExpense" ADD COLUMN "departmentId" INTEGER` + FK

- [ ] **Step 3: Scratch DB 검증**
```bash
cd /Users/juno/work/football
docker compose down -v && docker compose up -d postgres
sleep 5
cd apps/api
npx prisma migrate deploy   # 전체 마이그레이션 재실행, 오류 없어야 함
```

- [ ] **Step 4: 시드 스크립트에 Department 계층 + headId 정비 로직 추가** (Task 1 Step 1 결과에 따라)
- 계층 없으면 이 workflow 무의미. 최소 seed:
  - 상위: "시설관리팀" (parentId=null, headId=FacilityManagerUser)
  - 하위: "시설관리팀 – 그라운드 매니지먼트" (parentId=시설관리팀.id, headId=GroundLeadUser)
  - 신청자: leaf 부서에 `UserDepartment(role=MEMBER)` 로 연결

- [ ] **Step 5: Commit**
```bash
git add apps/api/prisma/migrations/*_asset_request_workflow/
git commit -m "feat(migration): add AssetRequest + AssetRequestApproval tables, OperatingExpense.departmentId"
```

---

## Task 4: `asset-request` 백엔드 모듈 신설 (repo + service + controller + routes)

**Files:**
- Create: `apps/api/src/asset-request/asset-request.repo.ts`
- Create: `apps/api/src/asset-request/asset-request.service.ts`
- Create: `apps/api/src/asset-request/asset-request.controller.ts`
- Create: `apps/api/src/asset-request/asset-request.routes.ts`
- Create: `apps/api/src/asset-request/dto/asset-request.dto.ts`

기존 `operating-expense` 모듈 스타일 답습.

- [ ] **Step 1: DTO**
```typescript
export interface CreateAssetRequestDto {
  type: "SOFTWARE" | "HARDWARE";
  equipmentItemId?: number;
  softwareLicenseId?: number;
  customName?: string;
  customDescription?: string;
  expenseCategoryId: number;
  expectedAmount: number;
  neededBy?: string;
  justification: string;
}

export interface RejectDto { reason: string; }
```

- [ ] **Step 2: Repository — CRUD + 승인 상태 전환 primitive**
- `create(dto, requesterId)`, `findById(id)`, `findByDepartment(deptId, status?)`, `findByRequester(userId)`, `findPendingForLeader(userId)`, `findPendingForDeptHead(userId)`
- `updateStatus(id, {status, ...})`, `addApproval(id, {stage, action, reviewerId, reason?})`

- [ ] **Step 3: Service — 승인 로직**
- `create(dto, requesterId)`:
  - 신청자 leaf 부서 조회 (UserDepartment)
  - hybrid payload 검증: `equipmentItemId || softwareLicenseId || customName` 중 하나 필수
  - AssetRequest(status=DRAFT) 생성
- `submit(id, userId)`: DRAFT → SUBMITTED. 신청자 본인만.
- `leaderApprove(id, reviewerId)`:
  - reviewer = 신청자 dept.head 확인 (`Department.head`)
  - status SUBMITTED만 허용
  - self-approval 금지 (신청자 == reviewer 차단)
  - status → LEADER_APPROVED + AssetRequestApproval 기록 + audit log
  - 부서장(parent dept.head)에게 알림
- `leaderReject(id, reviewerId, reason)`: 위와 동일 권한, reason 필수
- `approve(id, reviewerId)` (부서장 승인):
  - reviewer = 신청자 dept.parent.head 확인
  - status LEADER_APPROVED만 허용
  - self-approval 금지
  - **BudgetLine 자동 매칭 (Q5-1 c)**:
    ```
    line = findBudgetLine({ 
      seasonId: activeSeason, 
      categoryId: req.expenseCategoryId, 
      departmentId: req.departmentId,
    }) 
    ?? findBudgetLine({ 
      seasonId: activeSeason, 
      categoryId: req.expenseCategoryId, 
      departmentId: null,
    });
    if (!line) throw BUDGET_LINE_NOT_FOUND;
    ```
  - **`OperatingExpenseRepository.createWithBudgetCheck()` 호출** — BUDGET_EXCEEDED 시 그대로 throw (Q5-2 Y)
  - 생성된 OperatingExpense.id를 `assetRequest.operatingExpenseId`에 저장
  - status → APPROVED + AssetRequestApproval 기록 + audit log
  - 재무팀에 알림 (`createForFinanceStaff`)
- `reject(id, reviewerId, reason)` (부서장 반려)
- `cancel(id, userId)`: SUBMITTED 상태에서 신청자 본인만
- `fulfill(id, userId)`:
  - status APPROVED만 허용
  - reviewer = EQUIPMENT_MANAGER (HW) or ASSET_MANAGER (SW) 권한
  - customName 있고 마스터 없으면 Equipment/SoftwareLicense 신규 레코드 생성 후 링크
  - status → FULFILLED + audit log

- [ ] **Step 4: Controller**
- Routes:
  - `POST /asset-requests` (create)
  - `GET /asset-requests?filter=me|pending-leader|pending-dept-head|all`
  - `GET /asset-requests/:id`
  - `PATCH /asset-requests/:id/submit`
  - `PATCH /asset-requests/:id/leader-approve`
  - `PATCH /asset-requests/:id/leader-reject` (body: `{reason}`)
  - `PATCH /asset-requests/:id/approve`
  - `PATCH /asset-requests/:id/reject` (body: `{reason}`)
  - `PATCH /asset-requests/:id/cancel`
  - `PATCH /asset-requests/:id/fulfill`

- [ ] **Step 5: Routes 파일 + `apiRouter.ts`에 등록**

- [ ] **Step 6: 유닛 테스트 (`asset-request.service.test.ts`)**
- 각 전환의 성공 케이스 + 권한 실패 케이스 + 자기 승인 차단 + BUDGET_EXCEEDED 전파 + budget line fallback

- [ ] **Step 7: Commit**
```bash
git add apps/api/src/asset-request/ apps/api/src/apiRouter.ts
git commit -m "feat(asset-request): 2-stage department approval workflow with operating expense auto-create"
```

---

## Task 5: 알림 트리거

**Files:**
- Modify: `apps/api/src/asset-request/asset-request.service.ts` (Task 4에서 이미 삽입)
- Modify: `apps/api/src/notification/notification.repo.ts` (필요시 신규 helper)

- [ ] **Step 1: 알림 시점 확인 (모두 이미 Task 4 서비스에 삽입)**

| 트리거 | 수신자 | i18n | entityId |
|--------|--------|-----|----------|
| SUBMITTED | 신청자 dept.head (팀장) | ko/en | assetRequest.id |
| LEADER_APPROVED | 신청자 dept.parent.head (부서장) | ko/en | assetRequest.id |
| LEADER_REJECTED | 신청자 | ko/en | assetRequest.id |
| APPROVED | 신청자 + 재무팀 (`createForFinanceStaff`) | ko/en | assetRequest.id |
| REJECTED | 신청자 | ko/en | assetRequest.id |
| FULFILLED | 신청자 | ko/en | assetRequest.id |

- [ ] **Step 2: `NotificationType` 신규 값 추가 (Prisma enum이면 마이그레이션 별도)**
`ASSET_REQUEST_SUBMITTED`, `ASSET_REQUEST_LEADER_APPROVED`, `ASSET_REQUEST_LEADER_REJECTED`, `ASSET_REQUEST_APPROVED`, `ASSET_REQUEST_REJECTED`, `ASSET_REQUEST_FULFILLED`

- [ ] **Step 3: notification service 단위 테스트에 helper 확장 확인**

- [ ] **Step 4: Commit**
```bash
git add apps/api/prisma/schema.prisma apps/api/src/notification/ apps/api/src/asset-request/
git commit -m "feat(notification): asset request lifecycle notifications"
```

---

## Task 6: Frontend — 자산 신청 페이지

**Files:**
- Create: `football/src/pages/asset/AssetRequestPage.tsx` (신청 폼 + 내 신청 목록)
- Create: `football/src/pages/asset/AssetRequestApprovalPage.tsx` (결재함, 팀장/부서장용)
- Create: `football/src/services/asset-request.service.ts`
- Create: `football/src/hooks/useAssetRequests.ts`
- Modify: `football/src/layouts/AppShell.tsx` (nav 추가)

- [ ] **Step 1: 신청 폼** — 하이브리드 payload
  - Radio: 마스터 선택 vs 자유입력
  - 카테고리 dropdown (`useExpenseCategories()` 재사용)
  - 예상 금액, 사유(justification), 사용 희망일

- [ ] **Step 2: 내 신청 목록** — status별 필터

- [ ] **Step 3: 결재함** — 팀장/부서장 pending 목록 + 승인/반려 액션

- [ ] **Step 4: nav 항목**
  - 모든 로그인 유저 → `/asset/request` (내 신청)
  - `Department.head`인 유저 → `/asset/approval` (결재함)

- [ ] **Step 5: 통합 스모크 테스트** (dev 서버 + 브라우저)

- [ ] **Step 6: Commit**

---

## Task 7: (선택) 부서 롤업 대시보드

**Files:**
- Create: `apps/api/src/asset-request/asset-request.report.ts` (aggregate 조회)
- Modify: 기존 대시보드 페이지에 섹션 추가 or 신규 페이지

- [ ] 부서별 자산 신청 실적 + 부서 예산 대비 소비율
- [ ] `OperatingExpense.departmentId` 를 활용한 롤업 aggregate
- [ ] 상위 부서 조회 시 leaf 부서들 합산

**이 태스크는 선택적** — MVP 이후 후속 PR로 분리 가능.

---

## Task 8: 문서 / ADR / CONTEXT.md

**Files:**
- Create: `docs/adr/0013-asset-request-department-approval.md`
- Modify: `CONTEXT.md` (신규 섹션 추가)

- [ ] **Step 1: ADR 작성**
- Context: 부서 자율 자산 신청 채널 필요, 재무팀 결재로만은 부서 예산 통제 부족
- Decision: `Department.parentId/headId` 계층 재사용한 2-stage 승인 + OperatingExpense 자동 생성
- Alternatives: 재무팀 3단계 결재 (b), 신규 role 도입 (X), Department 계층 무시 flat 승인 (X)
- Consequences (positive): 신청 lead time 단축, 부서 자율성 강화, `createWithBudgetCheck` 재사용
- Consequences (negative): 자산 승인이 재무팀 사전 검토 없이 지출로 이어짐 (사후 audit 의존), Department 계층 seed 정비 부담

- [ ] **Step 2: CONTEXT.md 신규 섹션**
`## 자산 신청 워크플로우 (Asset Request)` — grill 결정 요약 + 상태머신 + 도메인 용어.

---

## Task 9: 전체 스모크 + PR

- [ ] **Step 1: TS + jest 전체**
```bash
cd apps/api && npx tsc --noEmit && npx jest --testPathPattern="asset-request"
cd football && npx tsc --noEmit
```

- [ ] **Step 2: E2E**
- dev 서버 재시작 (BE+FE)
- 시나리오:
  1. 일반 유저 A (leaf 부서 소속) 로그인 → 자산 신청 폼 작성 → 제출
  2. 팀장 유저 B (leaf dept.head) 로그인 → 결재함에서 승인
  3. 부서장 유저 C (parent dept.head) 로그인 → 결재함에서 승인 → OperatingExpense 자동 생성 확인
  4. 재무팀 유저 D 로그인 → 새 OperatingExpense가 APPROVED 상태로 표시되는지 확인
  5. 반려 시나리오: B가 반려 → A가 알림 수신 확인
  6. BUDGET_EXCEEDED 시나리오: 예산 소진된 카테고리에 신청 → C 승인 시 명시적 에러

- [ ] **Step 3: PR 생성**
```bash
git push -u origin feat/asset-request-workflow
gh pr create --title "feat(asset-request): 2-stage department approval workflow" --body ...
```

---

## 위험 / 안전 노트

1. **Department 계층 seed 정비 필수** — 현재 데이터가 flat이면 workflow 자체가 작동 안 함. Task 3 Step 4에서 반드시 처리.
2. **OperatingExpense.departmentId 마이그레이션 nullable로 시작** — 기존 데이터 backfill 없음 (자산 승인으로 생성되는 신규 지출만 태그).
3. **BudgetLine 매칭 실패 사전 안내** — 신청 접수(SUBMITTED) 시점에 preview API로 예상 BudgetLine 표시하면 신청자 UX 개선 (Task 6 Step 1에서 검토).
4. **Self-approval 차단 로직 필수** — 신청자가 dept.head 겸직인 케이스(작은 부서에서 흔함) 반드시 테스트.
5. **AssetRequestApproval unique(assetRequestId, stage)** 제약으로 stage당 결정 1개만 허용 — `action` 제외해서 APPROVED/REJECTED 모순 기록 DB 차단. 반려 후 재승인 케이스는 상태머신 자체가 막음(LEADER_REJECTED → SUBMITTED 전환 없음).

---

## Non-goals (Follow-up)

- `SoftwareLicensePayment` 서브테이블 (Q4-1 c의 회차 tracking) — 별도 PR
- 부서 롤업 대시보드 (Task 7) — MVP 이후
- 재신청/재접수 워크플로우 (LEADER_REJECTED → 신청자가 수정 후 재제출) — 지금은 신규 AssetRequest 생성으로 처리
- Equipment/SoftwareLicense 마스터 admin UI에서 pending AssetRequest 목록 표시 — 후속
- BUDGET_EXCEEDED 시 예비비 자동 이월 요청 트리거 — 후속
- 여러 승인자 (co-manager) 병렬 승인 — 지금은 dept.head 단일 승인
- 팀장 부재 시 대타 자동 지정 (parent dept.head가 대행 등) — 후속

---

## Self-Review

**Grill decision coverage:**
- Q1 (계층) ✅ Task 2 (Department FK), Task 4 Step 3 (권한 체크)
- Q2-i (payload hybrid) ✅ Task 2 Step 2 (nullable FK + customName), Task 4 Step 3 (validation)
- Q2-ii (실적 지출) ✅ Task 4 Step 3 (OperatingExpense 자동 생성)
- Q2-iii (leaf 태그 + 롤업) ✅ Task 2 Step 4 (OperatingExpense.departmentId), Task 7 (롤업)
- Q3-1 (재무 skip) ✅ Task 4 Step 3 (approve 시 OperatingExpense.status=APPROVED 직행)
- Q3-2 (상태머신) ✅ Task 2 Step 1 (enum), Task 4 Step 3 (전환 로직)
- Q4-1 (SW/HW payload) ⚠️ 부분 — 이번 plan은 총액 1건만. 회차 tracking은 follow-up.
- Q4-2 (category 명시) ✅ Task 2 Step 2 (expenseCategoryId NOT NULL)
- Q5-1 (BudgetLine 매칭 c) ✅ Task 4 Step 3 (fallback 로직)
- Q5-2 (BUDGET_EXCEEDED Y) ✅ Task 4 Step 3 (approve 시점 검증)

**Safety:**
- Scratch DB 검증 필수 (Task 3 Step 3)
- Self-approval 차단 (Task 4 Step 3)
- audit log 4단계 (SUBMITTED, LEADER_APPROVED, APPROVED, REJECTED, FULFILLED) + `AssetRequestApproval` 감사 이력 테이블 이중 기록.

**Non-goals 명시** — 스코프 크리프 방지.
