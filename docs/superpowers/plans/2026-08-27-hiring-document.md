# 채용 서류 취합 (HiringDocument) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 채용 프로세스 내 필수 서류(신분증·통장사본·학력증명 등) 취합·검토 워크플로우 도입. HR 매니저가 발령(HiringDispatch) 실행 전 모든 필수 서류가 APPROVED 상태인지 자동 검증하여 발령 후 서류 미비 리스크 제거.

**Architecture:** 신규 `HiringDocument` 모델 (JobApplication XOR HiringDispatch 로 연결) + `JobPosting.requiredDocuments` + `HiringDispatch.requiredDocuments` String[] 필드. 재업로드 = append-only 신규 레코드 (Contract 개정 선례). 파일 저장은 기존 multer + local `/uploads` 재사용.

**Tech Stack:** Prisma, TypeScript, Express, multer, React + shadcn/ui, jest.

**Scope (MVP):**
- HR 대리 업로드만 (후보자 직접 upload 는 별도 candidate portal 이슈)
- `docType` 자유 문자열 (enum 없음), trim 정규화, `requiredDocuments` 서브셋만 gate 검증
- 반려 후 재업로드는 신규 row (append-only, 최신 row 로 current 판정)
- HiringDispatch EXECUTION stage 진입 시 gate 검증
- 만료 관리 (expiryDate + 알림 cron) — **후속 이슈**
- 후보자 직접 업로드 — **후속 이슈** (candidate portal 전체 설계 필요)
- 파일 orphan cleanup cron — **후속 이슈**

**Grill 결정 근거:** `docs/superpowers/plans/2026-08-27-hiring-document.md` (본 문서 요약), `#372` 이슈 댓글.

---

## File Structure

**Backend (new):**
- `apps/api/src/hiring-document/hiring-document.controller.ts`
- `apps/api/src/hiring-document/hiring-document.service.ts`
- `apps/api/src/hiring-document/hiring-document.repo.ts`
- `apps/api/src/hiring-document/hiring-document.routes.ts`
- `apps/api/src/hiring-document/dto/upload.dto.ts`
- `apps/api/src/hiring-document/dto/review.dto.ts`
- `apps/api/__test__/hiring-document/hiring-document.service.test.ts`
- `apps/api/__test__/hiring-document/hiring-document.integration.test.ts`
- `apps/api/prisma/migrations/20260827010000_add_hiring_document/migration.sql`

**Backend (modified):**
- `apps/api/prisma/schema.prisma` — HiringDocument model + JobPosting/HiringDispatch/User relations + enum
- `apps/api/src/hiring-dispatch/hiring-dispatch.service.ts` — EXECUTION gate 추가
- `apps/api/src/server.ts` — route 등록
- `apps/api/src/job-posting/job-posting.controller.ts` — requiredDocuments 입출력
- `apps/api/src/job-posting/job-posting.service.ts`

**Frontend (new):**
- `football/src/pages/hr/HiringDocumentUploadPage.tsx` — HR 서류 업로드·검토 페이지 (application 또는 dispatch 별)
- `football/src/components/hiring-document/DocumentUploadDialog.tsx`
- `football/src/components/hiring-document/DocumentReviewDialog.tsx`
- `football/src/components/hiring-document/RequiredDocumentsInput.tsx` — String[] 편집기 + 템플릿 버튼
- `football/src/services/hiring-document.service.ts`
- `football/src/types/hiring-document.ts`

**Frontend (modified):**
- `football/src/pages/hr/JobPostingFormPage.tsx` — requiredDocuments 필드 편집 UI 추가
- `football/src/pages/hr/HiringDispatchDetailPage.tsx` — 서류 섹션 추가
- `football/src/services/job-posting.service.ts`
- `football/src/services/hiring-dispatch.service.ts`
- `football/src/types/job-posting.ts`
- `football/src/types/hiring-dispatch.ts`

---

## Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260827010000_add_hiring_document/migration.sql`

- [ ] **Step 1: enum + model 추가**

`schema.prisma` 채용 도메인 섹션 (HiringDispatch 근처):

```prisma
enum HiringDocReviewStatus {
  PENDING
  APPROVED
  REJECTED
}

model HiringDocument {
  id                Int                    @id @default(autoincrement())
  applicationId     Int?
  hiringDispatchId  Int?
  docType           String                 // 자유 문자열, trim 정규화
  fileUrl           String
  fileName          String?
  fileSize          Int?
  status            HiringDocReviewStatus  @default(PENDING)
  uploadedById      Int
  uploadedAt        DateTime               @default(now())
  reviewedById      Int?
  reviewedAt        DateTime?
  reviewNotes       String?
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt

  application    JobApplication?  @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  hiringDispatch HiringDispatch?  @relation(fields: [hiringDispatchId], references: [id], onDelete: Cascade)
  uploadedBy     User             @relation("HiringDocUploader", fields: [uploadedById], references: [id])
  reviewedBy     User?            @relation("HiringDocReviewer", fields: [reviewedById], references: [id])

  @@index([applicationId, docType, createdAt(sort: Desc)])
  @@index([hiringDispatchId, docType, createdAt(sort: Desc)])
}
```

- [ ] **Step 2: 기존 모델에 필드·relation 추가**

```prisma
model JobPosting {
  // ... 기존
  requiredDocuments String[] @default([])
}

model HiringDispatch {
  // ... 기존
  requiredDocuments String[] @default([])
  documents         HiringDocument[]
}

model JobApplication {
  // ... 기존
  documents         HiringDocument[]
}

model User {
  // ... 기존
  uploadedHiringDocs HiringDocument[] @relation("HiringDocUploader")
  reviewedHiringDocs HiringDocument[] @relation("HiringDocReviewer")
}
```

- [ ] **Step 3: 마이그레이션 SQL**

```sql
-- CreateEnum
CREATE TYPE "HiringDocReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "HiringDispatch" ADD COLUMN "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "HiringDocument" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER,
    "hiringDispatchId" INTEGER,
    "docType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "status" "HiringDocReviewStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiringDocument_applicationId_docType_createdAt_idx"
  ON "HiringDocument"("applicationId", "docType", "createdAt" DESC);
CREATE INDEX "HiringDocument_hiringDispatchId_docType_createdAt_idx"
  ON "HiringDocument"("hiringDispatchId", "docType", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "HiringDocument"
  ADD CONSTRAINT "HiringDocument_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HiringDocument"
  ADD CONSTRAINT "HiringDocument_hiringDispatchId_fkey"
  FOREIGN KEY ("hiringDispatchId") REFERENCES "HiringDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HiringDocument"
  ADD CONSTRAINT "HiringDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HiringDocument"
  ADD CONSTRAINT "HiringDocument_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4: `pnpm --filter api prisma generate` + migrate dev**

---

## Task 2: Backend 모듈 (upload · review · list)

**Files:** `apps/api/src/hiring-document/*`

- [ ] **Step 1: DTO 정의**

`dto/upload.dto.ts`:
```typescript
import { z } from "zod";

export const UploadTargetSchema = z.object({
  applicationId: z.number().int().positive().optional(),
  hiringDispatchId: z.number().int().positive().optional(),
  docType: z.string().trim().min(1).max(100),
}).refine(
  d => (d.applicationId != null) !== (d.hiringDispatchId != null),
  { message: "applicationId XOR hiringDispatchId required" }
);
```

`dto/review.dto.ts`:
```typescript
export const ReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().max(2000).optional(),
}).refine(
  d => d.status !== "REJECTED" || (d.reviewNotes && d.reviewNotes.length > 0),
  { message: "REJECTED requires reviewNotes" }
);
```

- [ ] **Step 2: Service 로직**

`hiring-document.service.ts`:
```typescript
export async function upload(input: UploadTarget, file: Express.Multer.File, uploaderId: number) {
  // target 존재 검증 (application 또는 dispatch)
  if (input.applicationId) {
    const app = await prisma.jobApplication.findUnique({ where: { id: input.applicationId } });
    if (!app) throw new HttpError(404, "APPLICATION_NOT_FOUND");
  } else {
    const disp = await prisma.hiringDispatch.findUnique({ where: { id: input.hiringDispatchId! } });
    if (!disp) throw new HttpError(404, "DISPATCH_NOT_FOUND");
  }

  return prisma.hiringDocument.create({
    data: {
      applicationId: input.applicationId,
      hiringDispatchId: input.hiringDispatchId,
      docType: input.docType.trim(),
      fileUrl: `/uploads/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      uploadedById: uploaderId,
    },
  });
}

export async function review(id: number, input: ReviewInput, reviewerId: number) {
  return prisma.hiringDocument.update({
    where: { id },
    data: {
      status: input.status,
      reviewNotes: input.reviewNotes ?? null,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });
}

export async function listCurrent(target: { applicationId?: number; hiringDispatchId?: number }) {
  const where = target.applicationId
    ? { applicationId: target.applicationId }
    : { hiringDispatchId: target.hiringDispatchId };
  // 최신 row per (target, docType) — 서비스 레이어 그룹핑
  const all = await prisma.hiringDocument.findMany({
    where,
    include: { uploadedBy: true, reviewedBy: true },
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  return all.filter(d => {
    if (seen.has(d.docType)) return false;
    seen.add(d.docType);
    return true;
  });
}

export async function listHistory(target: { applicationId?: number; hiringDispatchId?: number }, docType: string) {
  const where = target.applicationId
    ? { applicationId: target.applicationId, docType: docType.trim() }
    : { hiringDispatchId: target.hiringDispatchId, docType: docType.trim() };
  return prisma.hiringDocument.findMany({
    where,
    include: { uploadedBy: true, reviewedBy: true },
    orderBy: { createdAt: "desc" },
  });
}
```

- [ ] **Step 3: Controller + Routes**

`hiring-document.routes.ts`:
```typescript
import multer from "multer";
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("INVALID_FILE_TYPE"));
  },
});

router.post("/", auth, requireRoles(["HR_STAFF", "HR_MANAGER", "ADMIN"]), upload.single("file"), controller.upload);
router.patch("/:id/review", auth, requireRoles(["HR_STAFF", "HR_MANAGER", "ADMIN"]), controller.review);
router.get("/", auth, requireRoles(["HR_STAFF", "HR_MANAGER", "ADMIN"]), controller.listCurrent);
router.get("/history", auth, requireRoles(["HR_STAFF", "HR_MANAGER", "ADMIN"]), controller.listHistory);
```

Note: role check helper `requireRoles` 는 프로젝트 관행 확인 후 정확한 export 사용.

- [ ] **Step 4: server.ts 에 route 등록**

```typescript
import hiringDocumentRoutes from "./hiring-document/hiring-document.routes";
app.use("/hiring-documents", hiringDocumentRoutes);
```

- [ ] **Step 5: 단위 테스트**

`__test__/hiring-document/hiring-document.service.test.ts`:
- upload: application/dispatch XOR 검증
- upload: docType trim 정규화 확인
- review: PENDING → APPROVED / REJECTED
- review: REJECTED 시 reviewNotes 필수
- listCurrent: 같은 docType 여러 row 시 최신만 반환
- listHistory: 특정 docType 전체 이력 시간 역순

---

## Task 3: HiringDispatch EXECUTION 게이트 통합

**Files:** `apps/api/src/hiring-dispatch/hiring-dispatch.service.ts`

- [ ] **Step 1: gate helper 추가**

```typescript
async function assertRequiredDocsApproved(dispatch: HiringDispatch) {
  const required = dispatch.applicationId
    ? (await prisma.jobPosting.findUnique({
        where: { id: (await prisma.jobApplication.findUniqueOrThrow({
          where: { id: dispatch.applicationId },
          select: { postingId: true },
        })).postingId },
        select: { requiredDocuments: true },
      }))?.requiredDocuments ?? []
    : dispatch.requiredDocuments;

  if (required.length === 0) return;  // 필수 리스트 비어있으면 skip

  const latestByType = await prisma.hiringDocument.findMany({
    where: dispatch.applicationId
      ? { applicationId: dispatch.applicationId }
      : { hiringDispatchId: dispatch.id },
    orderBy: [{ docType: "asc" }, { createdAt: "desc" }],
    distinct: ["docType"],
  });

  const approvedTypes = new Set(
    latestByType
      .filter(d => d.status === "APPROVED")
      .map(d => d.docType.trim())
  );

  const missing = required
    .map(r => r.trim())
    .filter(r => !approvedTypes.has(r));

  if (missing.length > 0) {
    throw new HttpError(400, "MISSING_APPROVED_DOCS", { missing });
  }
}
```

- [ ] **Step 2: `dispatch()` (EXECUTION 진입) 에 gate 삽입**

기존 `dispatch()` 로직 앞에 추가:
```typescript
export async function dispatch(dispatchId: number, ...) {
  const disp = await prisma.hiringDispatch.findUniqueOrThrow({ where: { id: dispatchId } });
  await assertRequiredDocsApproved(disp);
  // ... 기존 $transaction 로직
}
```

- [ ] **Step 3: 통합 테스트**

`__test__/hiring-document/hiring-document.integration.test.ts`:
- Application-based dispatch: posting.requiredDocuments = ["신분증", "통장사본"]
  - 둘 다 APPROVED → dispatch 성공
  - 하나만 APPROVED → 400 MISSING_APPROVED_DOCS with missing=["통장사본"]
  - PENDING 상태 → 400
  - REJECTED 최신 상태 → 400 (append-only 최신 판정)
  - REJECTED 후 새 row APPROVED → 통과 (append-only 최신 판정)
- Application-free dispatch: dispatch.requiredDocuments = ["신분증"]
  - HiringDocument.hiringDispatchId 로 upload → APPROVED → 통과
- Empty required: dispatch.requiredDocuments = [] → gate skip → 통과

---

## Task 4: JobPosting requiredDocuments 편집 API

**Files:**
- `apps/api/src/job-posting/job-posting.controller.ts`
- `apps/api/src/job-posting/job-posting.service.ts`

- [ ] **Step 1: 요청/응답 DTO 에 `requiredDocuments: string[]` 추가**

- [ ] **Step 2: create / update service 에서 저장 (trim + 빈 문자열 제거)**

```typescript
data.requiredDocuments = (input.requiredDocuments ?? [])
  .map(s => s.trim())
  .filter(s => s.length > 0);
```

- [ ] **Step 3: 응답에 필드 포함 (getById / list)**

- [ ] **Step 4: 단위 테스트**
- create: requiredDocuments 저장 확인
- update: 배열 교체 확인 (append 아님)
- trim·빈 문자열 필터 확인

---

## Task 5: Frontend — HR 서류 관리 페이지

**Files:**
- `football/src/pages/hr/HiringDocumentUploadPage.tsx`
- `football/src/components/hiring-document/DocumentUploadDialog.tsx`
- `football/src/components/hiring-document/DocumentReviewDialog.tsx`
- `football/src/components/hiring-document/RequiredDocumentsInput.tsx`
- `football/src/services/hiring-document.service.ts`
- `football/src/types/hiring-document.ts`

- [ ] **Step 1: Type + Service**

`types/hiring-document.ts`:
```typescript
export type HiringDocReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface HiringDocument {
  id: number;
  applicationId: number | null;
  hiringDispatchId: number | null;
  docType: string;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  status: HiringDocReviewStatus;
  uploadedById: number;
  uploadedAt: string;
  reviewedById: number | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  uploadedBy: { id: number; username: string; nickname: string };
  reviewedBy: { id: number; username: string; nickname: string } | null;
}
```

`services/hiring-document.service.ts`:
```typescript
export const hiringDocumentApi = {
  upload: (target, docType, file) => { /* multipart FormData POST */ },
  review: (id, status, notes) => { /* PATCH */ },
  listCurrent: (target) => { /* GET */ },
  listHistory: (target, docType) => { /* GET */ },
};
```

- [ ] **Step 2: DocumentUploadDialog**

- 필수: docType (dropdown from JobPosting.requiredDocuments + free text 옵션), file
- 업로드 진행 표시
- 성공 시 부모 컴포넌트 refresh

- [ ] **Step 3: DocumentReviewDialog**

- 파일 미리보기 링크
- 반려 사유 입력 (REJECTED 선택 시 필수)
- APPROVED / REJECTED 버튼

- [ ] **Step 4: HiringDocumentUploadPage (통합 페이지)**

- URL: `/hr/applications/:id/documents` 또는 `/hr/dispatches/:id/documents`
- 표시:
  - 필수 서류 리스트 (posting 또는 dispatch 기준)
  - 각 항목별 최신 상태 (PENDING / APPROVED / REJECTED / 미제출)
  - 업로드 버튼 (미제출 또는 REJECTED 시 표시)
  - 검토 버튼 (PENDING 시 표시)
  - "이력 보기" 링크 (히스토리 dialog)
  - 추가 (extra) 서류 섹션 별도 표시

- [ ] **Step 5: RequiredDocumentsInput (JobPosting 편집용)**

- String[] 편집 UI (추가·삭제·순서변경)
- "기본 서류 추가" 템플릿 버튼 → `["신분증", "통장사본", "최종학력증명"]` 자동 채움
- JobPostingFormPage 에 통합

---

## Task 6: HiringDispatch 상세 페이지 통합

**Files:** `football/src/pages/hr/HiringDispatchDetailPage.tsx`

- [ ] **Step 1: 서류 섹션 추가**

- HiringDocumentUploadPage 내용을 embed 또는 링크
- 미충족 required 서류 배지 표시
- EXECUTION 버튼 disabled + "필수 서류 X건 미승인" tooltip (frontend guard, backend 는 gate 로 최종 검증)

- [ ] **Step 2: Application-free dispatch 케이스 UI**

- HiringDispatch 생성 폼에 `requiredDocuments` 입력 (RequiredDocumentsInput 재사용)
- Application 있는 경우엔 자동으로 posting.requiredDocuments 표시 (readonly)

---

## Task 7: 문서화

- [ ] **Step 1: `CONTEXT.md` 신규 섹션**

`## 채용 발령 (Hiring Dispatch)` 다음에 `## 채용 서류 (HiringDocument)` 섹션 추가. 본 plan 결정 사항 요약.

- [ ] **Step 2: `docs/adr/` 신규 ADR 판단**

ADR 조건 3개 (hard to reverse / surprising without context / real trade-off) 검토:
- **Hard to reverse:** append-only + XOR 참조 결정은 되돌리기 어려움 ✓
- **Surprising:** "왜 재업로드가 append-only?" — 향후 리더가 의문 가질 수 있음 ✓
- **Real trade-off:** in-place update vs append-only 는 진짜 대안이 있었음 ✓
- **결론:** ADR 작성 (`0019-hiring-document-append-only.md`)

- [ ] **Step 3: 후속 이슈 스텁 3개 생성 (`gh issue create`)**

- (a) "채용 후보자 portal — 서류 직접 upload" — `#372` 참조, blocked by 후보자 인증 시스템 설계
- (b) "채용 서류 만료 관리 (expiryDate + 알림 cron)" — `#372` 참조
- (c) "업로드 파일 orphan cleanup cron" — `#372` 참조, blocked by 다른 upload 모듈 통합 정리

---

## 검증 체크리스트

- [ ] `pnpm --filter api tsc --noEmit`
- [ ] `pnpm --filter api test hiring-document`
- [ ] `pnpm --filter api test hiring-dispatch`
- [ ] Manual: JobPosting 생성 시 requiredDocuments 저장/조회
- [ ] Manual: Application 서류 upload → PENDING → APPROVE → dispatch 성공
- [ ] Manual: Application-free dispatch + `HiringDispatch.requiredDocuments` → upload → dispatch 성공
- [ ] Manual: 필수 서류 하나 REJECTED 상태 → EXECUTION 400
- [ ] Manual: REJECTED 후 새 파일 upload → 최신 APPROVED → 통과
- [ ] Manual: 10MB 초과 파일 → 400
- [ ] Manual: .exe 등 허용되지 않은 확장자 → 400

---

## Rollback

- 신규 모듈이라 기존 코드 영향 없음
- `HiringDispatch.dispatch()` gate 추가로 인한 회귀는 `assertRequiredDocsApproved` 호출 라인 주석 처리로 즉시 비활성화 가능
- Migration 롤백: `HiringDocument` 테이블 drop, `requiredDocuments` 컬럼 drop, enum drop (역순)

---

## Grill 결정 요약

| # | 질문 | 결정 |
|---|---|---|
| Q1 | DocumentType 형태 | `String[]` 자유 문자열 (PlayerCallup.requiredDocuments 선례) |
| Q2 | #371 근로계약 통합 여부 | 별도 (`EmploymentContract` 로 분리) |
| Q3 | requiredDocuments 위치 | `JobPosting.requiredDocuments` 만 (FE 템플릿 버튼) |
| Q4 | 승인 상태 | `PENDING → APPROVED / REJECTED` + reviewer + notes |
| Q5 | 제출 주체 | MVP HR 대리만 (후보자 직접 upload 는 별도 이슈) |
| Q6 | HiringDispatch gate 위치 | EXECUTION stage + dual reference + 모델명 `HiringDocument` |
| Q7 | REJECTED 후 재업로드 | Append-only 신규 레코드 (Contract 개정 선례) |
| Q8 | 승인자 역할 | HR_STAFF·HR_MANAGER 동등 + self-review 허용 |
| Q9 | 파일 저장 | 기존 multer + local `/uploads` (11개 모듈 선례) |
| Q10 | docType 검증 | 자유 입력 + trim, gate 는 required 서브셋만 검사, Application-free 는 `HiringDispatch.requiredDocuments` 필드 사용 |
| Q11 | 만료 관리 | MVP 제외, HR 이 REJECT 로 대응, 자동화는 후속 이슈 |
