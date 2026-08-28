# 직원 근로계약 스켈레톤 (EmployeeContract) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직원 근로계약서를 계약 파일·서명 상태로 관리하는 최소 스켈레톤 도입. `HiringDispatch.dispatch()` EXECUTION 게이트에 "최신 EmployeeContract = SIGNED" 조건 추가하여 서명 완료 후에만 User 계정 원자적 생성. 처우 협상·외부 e-sign 통합·계약 갱신·퇴사 처리는 후속 이슈로 분리.

**Architecture:** 신규 `EmployeeContract` 모델 (HiringDispatch 참조 최소화, 파일·상태·서명 정보만). 상태머신 `DRAFT → ISSUED → SIGNED / CANCELLED`, 역방향 전환 없음. CANCELLED 후 재발행은 append-only 신규 레코드 (HiringDocument·Contract 개정 선례 동일).

**Tech Stack:** Prisma, TypeScript, Express, multer, React + shadcn/ui, jest.

**Scope (MVP):**
- `EmployeeContract` 모델 (파일 + 상태 + 서명 감사 필드)
- CRUD + 상태 전환 endpoint 5개
- HR (HR_STAFF·HR_MANAGER) 발행·서명 마킹, 취소는 HR_MANAGER·GM·ADMIN
- HR 이 오프라인 서명본 스캔·업로드 = 자동 SIGNED 마킹 (한 액션)
- HiringDispatch EXECUTION 게이트 통합
- FE: HiringDispatchDetailPage 안에 계약 섹션
- 파일 저장: 기존 multer + local `/uploads`

**Non-goal (후속 이슈로 분리):**
- 처우 협상 로그 (`SalaryNegotiation`) — Q1 결정에 따라 후속
- 외부 e-sign 통합 (DocuSign·모두사인 등) — 후속
- 계약 갱신 워크플로우 — 후속
- 퇴사 (offboarding) 처리 — 후속
- 후보자 서명 이력 별도 모델 (`ContractSignature`) — e-sign 통합 시

---

## File Structure

**Backend (new):**
- `apps/api/src/employee-contract/employee-contract.controller.ts`
- `apps/api/src/employee-contract/employee-contract.service.ts`
- `apps/api/src/employee-contract/employee-contract.repo.ts`
- `apps/api/src/employee-contract/employee-contract.routes.ts`
- `apps/api/src/employee-contract/dto/create.dto.ts`
- `apps/api/src/employee-contract/dto/issue.dto.ts`
- `apps/api/src/employee-contract/dto/sign.dto.ts`
- `apps/api/src/employee-contract/dto/cancel.dto.ts`
- `apps/api/__test__/employee-contract/employee-contract.service.test.ts`
- `apps/api/__test__/employee-contract/employee-contract.integration.test.ts`
- `apps/api/prisma/migrations/20260827030000_add_employee_contract/migration.sql`

**Backend (modified):**
- `apps/api/prisma/schema.prisma` — `EmployeeContract` + `HiringDispatch` relation + `User` relations + enum
- `apps/api/src/hiring-dispatch/hiring-dispatch.service.ts` — `assertContractSigned()` 게이트 추가
- `apps/api/src/server.ts` — route 등록

**Frontend (new):**
- `football/src/components/employee-contract/EmployeeContractSection.tsx` — dispatch 상세 페이지 안 계약 섹션
- `football/src/components/employee-contract/IssueContractDialog.tsx` — 계약서 발행
- `football/src/components/employee-contract/SignContractDialog.tsx` — 서명본 업로드
- `football/src/components/employee-contract/CancelContractDialog.tsx` — 취소 (사유 입력)
- `football/src/services/employee-contract.service.ts`
- `football/src/types/employee-contract.ts`

**Frontend (modified):**
- `football/src/pages/hr/HiringDispatchDetailPage.tsx` — EmployeeContractSection embed
- `football/src/types/hiring-dispatch.ts` — 계약 상태 배지용 필드 반영

---

## Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260827030000_add_employee_contract/migration.sql`

- [ ] **Step 1: enum + model 추가**

```prisma
enum EmployeeContractStatus {
  DRAFT       // HR 이 계약서 파일 준비 중
  ISSUED      // 계약서 발행, 지원자 서명 대기
  SIGNED      // 서명 완료 (HR 이 서명본 업로드·확인)
  CANCELLED   // 취소 (재발행 시 신규 create)
}

model EmployeeContract {
  id                  Int                     @id @default(autoincrement())
  hiringDispatchId    Int                     // @unique 아님 — 이력 append-only
  status              EmployeeContractStatus  @default(DRAFT)

  // 계약서 파일
  fileUrl             String?                 // DRAFT 시 nullable, ISSUED 부터 필수
  fileName            String?
  signedFileUrl       String?                 // SIGNED 시 필수
  signedFileName      String?

  // 감사 필드
  createdById         Int                     // DRAFT create 실행자
  issuedById          Int?
  issuedAt            DateTime?
  signedAt            DateTime?               // 실제 지원자가 서명한 날짜 (HR 수동 입력)
  signedConfirmedById Int?
  signedConfirmedAt   DateTime?               // SIGNED 로 마킹된 시각
  cancelledById       Int?
  cancelledAt         DateTime?
  cancelReason        String?

  createdAt           DateTime                @default(now())
  updatedAt           DateTime                @updatedAt

  hiringDispatch      HiringDispatch          @relation(fields: [hiringDispatchId], references: [id], onDelete: Cascade)
  createdBy           User                    @relation("EmpContractCreator", fields: [createdById], references: [id])
  issuedBy            User?                   @relation("EmpContractIssuer", fields: [issuedById], references: [id])
  signedConfirmedBy   User?                   @relation("EmpContractSigner", fields: [signedConfirmedById], references: [id])
  cancelledBy         User?                   @relation("EmpContractCanceller", fields: [cancelledById], references: [id])

  @@index([hiringDispatchId, createdAt(sort: Desc)])
}
```

- [ ] **Step 2: HiringDispatch, User 에 relation 추가**

```prisma
model HiringDispatch {
  // ... 기존
  employeeContracts EmployeeContract[]
}

model User {
  // ... 기존
  createdEmployeeContracts   EmployeeContract[] @relation("EmpContractCreator")
  issuedEmployeeContracts    EmployeeContract[] @relation("EmpContractIssuer")
  signedEmployeeContracts    EmployeeContract[] @relation("EmpContractSigner")
  cancelledEmployeeContracts EmployeeContract[] @relation("EmpContractCanceller")
}
```

- [ ] **Step 3: 마이그레이션 SQL**

```sql
-- CreateEnum
CREATE TYPE "EmployeeContractStatus" AS ENUM ('DRAFT', 'ISSUED', 'SIGNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmployeeContract" (
    "id" SERIAL NOT NULL,
    "hiringDispatchId" INTEGER NOT NULL,
    "status" "EmployeeContractStatus" NOT NULL DEFAULT 'DRAFT',
    "fileUrl" TEXT,
    "fileName" TEXT,
    "signedFileUrl" TEXT,
    "signedFileName" TEXT,
    "createdById" INTEGER NOT NULL,
    "issuedById" INTEGER,
    "issuedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedConfirmedById" INTEGER,
    "signedConfirmedAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeContract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeContract_hiringDispatchId_createdAt_idx"
  ON "EmployeeContract"("hiringDispatchId", "createdAt" DESC);

-- FKs
ALTER TABLE "EmployeeContract"
  ADD CONSTRAINT "EmployeeContract_hiringDispatchId_fkey"
  FOREIGN KEY ("hiringDispatchId") REFERENCES "HiringDispatch"("id") ON DELETE CASCADE;
ALTER TABLE "EmployeeContract"
  ADD CONSTRAINT "EmployeeContract_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "EmployeeContract"
  ADD CONSTRAINT "EmployeeContract_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "EmployeeContract"
  ADD CONSTRAINT "EmployeeContract_signedConfirmedById_fkey"
  FOREIGN KEY ("signedConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "EmployeeContract"
  ADD CONSTRAINT "EmployeeContract_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL;
```

- [ ] **Step 4: `pnpm --filter api prisma generate` + migrate dev**

---

## Task 2: Backend 모듈 (CRUD + 상태 전환)

**Files:** `apps/api/src/employee-contract/*`

- [ ] **Step 1: DTOs**

```typescript
// dto/create.dto.ts
export const CreateSchema = z.object({
  hiringDispatchId: z.number().int().positive(),
});

// dto/issue.dto.ts (파일 업로드 with multer)
export const IssueSchema = z.object({
  // fileUrl 은 multer 처리 결과. 여기선 별도 필드 없음
});

// dto/sign.dto.ts (파일 업로드 with multer)
export const SignSchema = z.object({
  signedAt: z.string().datetime(),  // ISO date
});

// dto/cancel.dto.ts
export const CancelSchema = z.object({
  cancelReason: z.string().trim().min(1).max(2000),
});
```

- [ ] **Step 2: Service 로직 (상태 전환)**

```typescript
export async function create(hiringDispatchId: number, actorId: number) {
  const dispatch = await prisma.hiringDispatch.findUnique({ where: { id: hiringDispatchId } });
  if (!dispatch) throw new HttpError(404, "DISPATCH_NOT_FOUND");
  return prisma.employeeContract.create({
    data: { hiringDispatchId, createdById: actorId },
  });
}

export async function issue(id: number, file: Express.Multer.File, actorId: number) {
  const ec = await prisma.employeeContract.findUniqueOrThrow({ where: { id } });
  if (ec.status !== "DRAFT") {
    throw new HttpError(409, "INVALID_STATE_TRANSITION", { current: ec.status, target: "ISSUED" });
  }
  return prisma.employeeContract.update({
    where: { id },
    data: {
      status: "ISSUED",
      fileUrl: `/uploads/${file.filename}`,
      fileName: file.originalname,
      issuedById: actorId,
      issuedAt: new Date(),
    },
  });
}

export async function sign(id: number, file: Express.Multer.File, input: SignInput, actorId: number) {
  const ec = await prisma.employeeContract.findUniqueOrThrow({ where: { id } });
  if (ec.status !== "ISSUED") {
    throw new HttpError(409, "INVALID_STATE_TRANSITION", { current: ec.status, target: "SIGNED" });
  }
  return prisma.employeeContract.update({
    where: { id },
    data: {
      status: "SIGNED",
      signedFileUrl: `/uploads/${file.filename}`,
      signedFileName: file.originalname,
      signedAt: new Date(input.signedAt),
      signedConfirmedById: actorId,
      signedConfirmedAt: new Date(),
    },
  });
}

export async function cancel(id: number, input: CancelInput, actorId: number) {
  const ec = await prisma.employeeContract.findUniqueOrThrow({ where: { id } });
  if (ec.status === "CANCELLED") {
    throw new HttpError(409, "ALREADY_CANCELLED");
  }
  return prisma.employeeContract.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelReason: input.cancelReason.trim(),
      cancelledById: actorId,
      cancelledAt: new Date(),
    },
  });
}

export async function listByDispatch(hiringDispatchId: number) {
  return prisma.employeeContract.findMany({
    where: { hiringDispatchId },
    include: { createdBy: true, issuedBy: true, signedConfirmedBy: true, cancelledBy: true },
    orderBy: { createdAt: "desc" },
  });
}
```

- [ ] **Step 3: Routes**

```typescript
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("INVALID_FILE_TYPE"));
  },
});

router.post("/", auth, requireRoles(["HR_STAFF", "HR_MANAGER", "ADMIN"]), controller.create);
router.patch("/:id/issue", auth, requireRoles(["HR_STAFF", "HR_MANAGER", "ADMIN"]), upload.single("file"), controller.issue);
router.patch("/:id/sign", auth, requireRoles(["HR_STAFF", "HR_MANAGER", "ADMIN"]), upload.single("file"), controller.sign);
router.patch("/:id/cancel", auth, requireRoles(["HR_MANAGER", "GM", "ADMIN"]), controller.cancel);
router.get("/dispatch/:hiringDispatchId", auth, requireRoles(["HR_STAFF", "HR_MANAGER", "ADMIN", "GM"]), controller.listByDispatch);
```

- [ ] **Step 4: server.ts 에 route 등록**

```typescript
import employeeContractRoutes from "./employee-contract/employee-contract.routes";
app.use("/employee-contracts", employeeContractRoutes);
```

- [ ] **Step 5: 단위 테스트**

- create: DRAFT 생성 + createdById 세팅
- issue: DRAFT → ISSUED with file, INVALID_STATE_TRANSITION for non-DRAFT
- sign: ISSUED → SIGNED with file + signedAt, INVALID_STATE_TRANSITION for non-ISSUED
- cancel: SIGNED → CANCELLED, ALREADY_CANCELLED 재취소 방지
- cancel: DRAFT → CANCELLED (모든 상태에서 취소 가능)
- listByDispatch: 시간 역순, 여러 이력 반환

---

## Task 3: HiringDispatch EXECUTION 게이트 통합

**Files:** `apps/api/src/hiring-dispatch/hiring-dispatch.service.ts`

- [ ] **Step 1: `assertContractSigned` helper 추가**

```typescript
async function assertContractSigned(dispatchId: number) {
  const latestEC = await prisma.employeeContract.findFirst({
    where: { hiringDispatchId: dispatchId, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
  });

  if (!latestEC) {
    throw new HttpError(400, "CONTRACT_NOT_ISSUED");
  }
  if (latestEC.status !== "SIGNED") {
    throw new HttpError(400, "CONTRACT_NOT_SIGNED", { status: latestEC.status, contractId: latestEC.id });
  }
}
```

- [ ] **Step 2: `dispatch()` 에 gate 삽입 (assertRequiredDocsApproved 다음)**

```typescript
export async function dispatch(dispatchId: number, ...) {
  const disp = await prisma.hiringDispatch.findUniqueOrThrow({ where: { id: dispatchId } });
  await assertRequiredDocsApproved(disp);  // #372 게이트
  await assertContractSigned(disp.id);      // #371 게이트
  // ... 기존 $transaction
}
```

- [ ] **Step 3: 통합 테스트**

`__test__/employee-contract/employee-contract.integration.test.ts`:
- EC 없음 + dispatch → 400 `CONTRACT_NOT_ISSUED`
- EC DRAFT → 400 `CONTRACT_NOT_SIGNED` (status: DRAFT)
- EC ISSUED → 400 `CONTRACT_NOT_SIGNED` (status: ISSUED)
- EC SIGNED → dispatch 성공
- EC SIGNED 이후 CANCELLED (최신) → 400 `CONTRACT_NOT_ISSUED`
- CANCELLED 이후 새 EC 생성 → DRAFT → SIGNED → dispatch 성공 (append-only 최신 판정)
- #372 서류도 함께 충족되어야 dispatch 성공 확인 (두 게이트 동시 검증)

---

## Task 4: Frontend — 계약 관리 컴포넌트

**Files:**
- `football/src/components/employee-contract/EmployeeContractSection.tsx`
- `football/src/components/employee-contract/IssueContractDialog.tsx`
- `football/src/components/employee-contract/SignContractDialog.tsx`
- `football/src/components/employee-contract/CancelContractDialog.tsx`
- `football/src/services/employee-contract.service.ts`
- `football/src/types/employee-contract.ts`

- [ ] **Step 1: Type + Service**

```typescript
export type EmployeeContractStatus = "DRAFT" | "ISSUED" | "SIGNED" | "CANCELLED";

export interface EmployeeContract {
  id: number;
  hiringDispatchId: number;
  status: EmployeeContractStatus;
  fileUrl: string | null;
  fileName: string | null;
  signedFileUrl: string | null;
  signedFileName: string | null;
  createdById: number;
  issuedById: number | null;
  issuedAt: string | null;
  signedAt: string | null;
  signedConfirmedById: number | null;
  signedConfirmedAt: string | null;
  cancelledById: number | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: { id: number; username: string; nickname: string };
  issuedBy: UserRef | null;
  signedConfirmedBy: UserRef | null;
  cancelledBy: UserRef | null;
}
```

- [ ] **Step 2: EmployeeContractSection**

- Props: `dispatchId`
- 표시:
  - 최신 EC 상태 배지 (DRAFT / ISSUED / SIGNED / CANCELLED)
  - 원본 계약서 다운로드 링크 (fileUrl 있으면)
  - 서명본 다운로드 링크 (signedFileUrl 있으면)
  - 감사 정보 (발행자·발행일, 서명일·확인자·확인일)
  - 액션 버튼 (상태별):
    - 없음: "계약서 발행" (CREATE + IssueDialog 이어서)
    - DRAFT: "계약서 발행" (Issue)
    - ISSUED: "서명본 업로드" (Sign)
    - SIGNED: "취소" (Cancel, HR_MANAGER+ only)
    - CANCELLED: "새 계약서 발행" (CREATE)
  - 히스토리 (이전 이력 확장 가능)

- [ ] **Step 3: 3개 Dialog**

- IssueContractDialog: 파일 선택 → PATCH /issue
- SignContractDialog: 파일 선택 + signedAt 날짜 → PATCH /sign
- CancelContractDialog: cancelReason 필수 → PATCH /cancel

- [ ] **Step 4: HiringDispatchDetailPage 에 embed**

- 기존 페이지에 `<EmployeeContractSection dispatchId={dispatch.id} />` 추가
- EXECUTION 버튼 disabled + tooltip "계약 서명 대기" (SIGNED 아니면)

---

## Task 5: 문서화

- [ ] **Step 1: `CONTEXT.md` 갱신**

- `## 채용 발령 (Hiring Dispatch)` 다음, `## 채용 서류 (HiringDocument)` 사이에 `## 근로계약 (EmployeeContract)` 섹션 추가
- Hiring Dispatch 섹션 EXECUTION 게이트 설명에 "계약 SIGNED 조건 추가" 언급

- [ ] **Step 2: 후속 이슈 스텁 4개 생성 (`gh issue create`)**

- (a) "처우 협상 로그 (SalaryNegotiation) 모델 도입" — `#371` 참조. offer/counter/final 이력, HR·부서장·임원 승인 라인
- (b) "외부 e-sign 통합 (DocuSign·모두사인 등)" — `#371` 참조. 서비스 선정, webhook 수신
- (c) "직원 근로계약 갱신 워크플로우" — `#371` 참조. 갱신 시점 알림, 신규 EmployeeContract 생성 흐름
- (d) "직원 퇴사 (offboarding) 워크플로우" — `#371` 참조. dispatch 반대 방향, User deactivation, StaffRecord.employmentEndDate

---

## 검증 체크리스트

- [ ] `pnpm --filter api tsc --noEmit`
- [ ] `pnpm --filter api test employee-contract`
- [ ] `pnpm --filter api test hiring-dispatch` (게이트 통합 회귀)
- [ ] Manual: HiringDispatch 생성 → 계약 생성 (DRAFT) → 발행 (ISSUED, PDF 업로드) → 서명 (SIGNED, 스캔본 업로드) → EXECUTION 성공
- [ ] Manual: EC 없이 EXECUTION 시도 → 400 CONTRACT_NOT_ISSUED
- [ ] Manual: EC DRAFT 상태에서 EXECUTION → 400 CONTRACT_NOT_SIGNED
- [ ] Manual: SIGNED 이후 CANCELLED → 새 EC 발행 → SIGNED → EXECUTION 성공 (append-only 흐름)
- [ ] Manual: 파일 10MB 초과 → 400
- [ ] Manual: .exe 확장자 → 400

---

## Rollback

- 신규 모듈이라 기존 코드 영향 없음
- `assertContractSigned()` 호출 라인 주석 처리로 즉시 게이트 비활성화 가능
- Migration 롤백: `EmployeeContract` drop, enum drop

---

## Grill 결정 요약

| # | 질문 | 결정 |
|---|---|---|
| Q1 | 스코프 분할 | **계약 스켈레톤만**. 처우 협상·e-sign·갱신·퇴사는 후속 이슈 |
| Q2 | HiringDispatch 연계 시점 | **EXECUTION 게이트에 "계약 SIGNED" 조건** 추가 (dispatch 전 서명 필수) |
| Q3 | EmployeeContract 필드 | HiringDispatch 참조 최소화 (파일 + 상태 + 서명 감사 필드만) + `@unique` 해제로 이력 append-only |
| Q4 | 서명 확인 흐름 | HR 이 서명본 업로드 = **자동 SIGNED 마킹** (한 액션) |
| Q5 | 권한 | 발행·서명 마킹 = HR_STAFF·HR_MANAGER 동등, 취소 = HR_MANAGER·GM·ADMIN |
| Q6 | 파일 저장 | 기존 multer + local `/uploads` (HiringDocument·11개 모듈 선례) |
| Q7 | 게이트 로직 | 최신 non-CANCELLED EC 가 SIGNED 여야 통과, 부재 시 400 `CONTRACT_NOT_ISSUED`, non-SIGNED 시 400 `CONTRACT_NOT_SIGNED`, override 없음 |
