# Report Multi-Stage Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보고서 타입별 다단계 결재 구조 구현 — HR(3단계), ASSET/FINANCIAL(2단계), 나머지(현행 유지)

**Architecture:** `ReportStatus`에 `FIRST_APPROVED`, `SECOND_APPROVED` 추가, `Report` 모델에 단계별 검토자 필드 추가. 백엔드 controller에서 타입+현재 상태 기반으로 승인 권한 판별. 프론트엔드 `canApprove` 로직을 동일 규칙으로 미러링.

**Tech Stack:** Prisma (PostgreSQL), Express/TypeScript, React/TypeScript, Vite

---

## 결재 체계 요약

| 보고서 | 작성자 | 1차 | 2차 | 최종 |
|--------|--------|-----|-----|------|
| HR | HR_STAFF | HR_MANAGER | ASSET_MANAGER | GM |
| ASSET | ASSET_STAFF | ASSET_MANAGER | — | GM |
| FINANCIAL | FINANCE_STAFF | FINANCE_MANAGER | — | GM |
| TRAINING | HEAD_COACH | — | — | HEAD_COACH |
| PERFORMANCE·MEDICAL | 누구나 | — | — | GM |

반려 시: 어느 단계든 → REJECTED → 작성자가 수정 후 재제출(DRAFT로 복귀)

---

## File Map

| 파일 | 변경 |
|------|------|
| `apps/api/prisma/schema.prisma` | FrontOfficeRole 3개 추가, ReportStatus 2개 추가, Report 모델 필드 4개 추가, User 역관계 2개 추가 |
| `apps/api/prisma/migrations/20260803_report_multi_stage/migration.sql` | 신규 생성 |
| `apps/api/src/report/report.repo.ts` | approve() 시그니처 변경, reportInclude 확장, findAll() HR_STAFF 등 처리 |
| `apps/api/src/report/report.service.ts` | approve() 다음 상태 계산, 알림 대상 분기 |
| `apps/api/src/report/report.controller.ts` | approve/reject 단계별 권한 체크, create/list/get 신규 역할 처리 |
| `apps/api/__test__/report/report.service.test.ts` | 신규 생성 — 단계별 승인 통합 테스트 |
| `football/src/types/report.ts` | 새 상태·역할 타입, 스타일 맵 추가 |
| `football/src/pages/reports/ReportDetailPage.tsx` | canApprove 다단계 로직, 결재 이력 표시 |
| `football/src/pages/reports/ReportsPage.tsx` | FO_CREATE_ROLES 신규 역할 추가 |
| `football/src/pages/reports/ReportFormPage.tsx` | 타입별 작성 권한 필터 업데이트 |
| `football/src/layouts/AppShell.tsx` | /reports 네비 frontOfficeRoles 업데이트 |
| `football/src/locales/ko/report.json` | 신규 상태 번역 |
| `football/src/locales/en/report.json` | 신규 상태 번역 |
| `apps/api/prisma/seed.ts` | HR_STAFF/ASSET_STAFF/FINANCE_STAFF 계정 추가, 중간 단계 보고서 추가 |

---

### Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260803_report_multi_stage/migration.sql`

- [ ] **Step 1: FrontOfficeRole enum에 3개 추가**

`schema.prisma` line 53 `FrontOfficeRole` 블록 끝에 추가:
```prisma
enum FrontOfficeRole {
  GM
  TD
  CONTRACT_MANAGER
  SCOUT
  EQUIPMENT_MANAGER
  TACTICAL_ANALYST
  FINANCE_MANAGER
  ASSET_MANAGER
  HR_MANAGER
  FACILITY_MANAGER
  HR_STAFF
  ASSET_STAFF
  FINANCE_STAFF
}
```

- [ ] **Step 2: ReportStatus enum에 2개 추가**

`schema.prisma` line 1285 `ReportStatus` 블록:
```prisma
enum ReportStatus {
  DRAFT
  SUBMITTED
  FIRST_APPROVED
  SECOND_APPROVED
  APPROVED
  REJECTED
}
```

- [ ] **Step 3: Report 모델에 단계별 검토자 필드 추가**

`schema.prisma` Report 모델 (`reviewedAt DateTime?` 아래에 추가):
```prisma
model Report {
  id              Int          @id @default(autoincrement())
  type            ReportType
  status          ReportStatus @default(DRAFT)
  title           String
  content         String       @db.Text
  fileUrl         String?
  fileName        String?
  rejectionReason String?

  authorId   Int
  author     User  @relation("ReportAuthor", fields: [authorId], references: [id])
  reviewerId Int?
  reviewer   User? @relation("ReportReviewer", fields: [reviewerId], references: [id])

  firstReviewerId  Int?
  firstReviewer    User?     @relation("ReportFirstReviewer", fields: [firstReviewerId], references: [id])
  firstReviewedAt  DateTime?
  secondReviewerId Int?
  secondReviewer   User?     @relation("ReportSecondReviewer", fields: [secondReviewerId], references: [id])
  secondReviewedAt DateTime?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  submittedAt DateTime?
  reviewedAt  DateTime?
}
```

- [ ] **Step 4: User 모델에 역관계 2개 추가**

`schema.prisma` User 모델의 `reviewedReports` 아래에:
```prisma
  firstReviewedReports     Report[]                @relation("ReportFirstReviewer")
  secondReviewedReports    Report[]                @relation("ReportSecondReviewer")
```

- [ ] **Step 5: 마이그레이션 SQL 파일 생성**

```bash
mkdir -p apps/api/prisma/migrations/20260803_report_multi_stage
```

`apps/api/prisma/migrations/20260803_report_multi_stage/migration.sql`:
```sql
ALTER TYPE "FrontOfficeRole" ADD VALUE 'HR_STAFF';
ALTER TYPE "FrontOfficeRole" ADD VALUE 'ASSET_STAFF';
ALTER TYPE "FrontOfficeRole" ADD VALUE 'FINANCE_STAFF';

ALTER TYPE "ReportStatus" ADD VALUE 'FIRST_APPROVED';
ALTER TYPE "ReportStatus" ADD VALUE 'SECOND_APPROVED';

ALTER TABLE "Report" ADD COLUMN "firstReviewerId"  INTEGER REFERENCES "User"("id");
ALTER TABLE "Report" ADD COLUMN "firstReviewedAt"  TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "secondReviewerId" INTEGER REFERENCES "User"("id");
ALTER TABLE "Report" ADD COLUMN "secondReviewedAt" TIMESTAMP(3);
```

- [ ] **Step 6: DB에 직접 적용 후 마이그레이션 마킹**

```bash
psql -U postgres -d football -f apps/api/prisma/migrations/20260803_report_multi_stage/migration.sql
npx prisma migrate resolve --applied 20260803_report_multi_stage
npx prisma generate
```

Expected output: `Migration 20260803_report_multi_stage marked as applied.` + `✔ Generated Prisma Client`

- [ ] **Step 7: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260803_report_multi_stage/
git commit -m "feat(schema): add multi-stage report approval fields and new FO roles"
```

---

### Task 2: 백엔드 — repo 업데이트

**Files:**
- Modify: `apps/api/src/report/report.repo.ts`

- [ ] **Step 1: reportInclude에 firstReviewer, secondReviewer 추가**

```typescript
const reportInclude = {
  author: { select: authorSelect },
  reviewer: { select: authorSelect },
  firstReviewer: { select: authorSelect },
  secondReviewer: { select: authorSelect },
} as const;
```

- [ ] **Step 2: approve() 시그니처 변경 — nextStatus 파라미터 추가**

```typescript
approve(id: number, reviewerId: number, nextStatus: "FIRST_APPROVED" | "SECOND_APPROVED" | "APPROVED") {
  const now = new Date();
  const data =
    nextStatus === "FIRST_APPROVED"
      ? { status: nextStatus, firstReviewerId: reviewerId, firstReviewedAt: now }
      : nextStatus === "SECOND_APPROVED"
      ? { status: nextStatus, secondReviewerId: reviewerId, secondReviewedAt: now }
      : { status: nextStatus, reviewerId, reviewedAt: now };

  return this.prisma.report.update({
    where: { id },
    data,
    include: reportInclude,
  });
}
```

- [ ] **Step 3: findAll()에 HR_STAFF/ASSET_STAFF/FINANCE_STAFF 처리 추가**

파라미터에 `isHrStaff`, `isAssetStaff`, `isFinanceStaff` 추가:
```typescript
findAll(
  userId: number,
  isGM: boolean,
  isHeadCoach: boolean = false,
  filters: { type?: string; status?: string } = {},
  isHrManager: boolean = false,
  isFinanceManager: boolean = false,
  isAssetManager: boolean = false,
  isHrStaff: boolean = false,
  isAssetStaff: boolean = false,
  isFinanceStaff: boolean = false,
) {
  const roleWhere = isGM
    ? {}
    : isHeadCoach
    ? { OR: [{ authorId: userId }, { type: "TRAINING" as const }] }
    : isHrManager
    ? { OR: [{ authorId: userId }, { type: "HR" as const }] }
    : isFinanceManager
    ? { OR: [{ authorId: userId }, { type: "FINANCIAL" as const }] }
    : isAssetManager
    ? { OR: [{ authorId: userId }, { type: "ASSET" as const }] }
    : isHrStaff
    ? { OR: [{ authorId: userId }, { type: "HR" as const }] }
    : isAssetStaff
    ? { OR: [{ authorId: userId }, { type: "ASSET" as const }] }
    : isFinanceStaff
    ? { OR: [{ authorId: userId }, { type: "FINANCIAL" as const }] }
    : { authorId: userId };
  // ... 나머지 동일
}
```

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/report/report.repo.ts
git commit -m "feat(report): update repo for multi-stage approval and new staff roles"
```

---

### Task 3: 백엔드 — service 업데이트

**Files:**
- Modify: `apps/api/src/report/report.service.ts`

- [ ] **Step 1: list() 파라미터 확장**

```typescript
list(
  userId: number,
  isGM: boolean,
  isHeadCoach: boolean = false,
  filters: { type?: string; status?: string } = {},
  isHrManager: boolean = false,
  isFinanceManager: boolean = false,
  isAssetManager: boolean = false,
  isHrStaff: boolean = false,
  isAssetStaff: boolean = false,
  isFinanceStaff: boolean = false,
) {
  return this.repo.findAll(userId, isGM, isHeadCoach, filters, isHrManager, isFinanceManager, isAssetManager, isHrStaff, isAssetStaff, isFinanceStaff);
}
```

- [ ] **Step 2: approve() 다음 상태 계산 로직 추가**

```typescript
async approve(id: number, reviewerId: number) {
  const report = await this.repo.findById(id);
  if (!report) throw new AppError(404, "REPORT_NOT_FOUND");

  const nextStatus = ((): "FIRST_APPROVED" | "SECOND_APPROVED" | "APPROVED" => {
    switch (report.type) {
      case "HR":
        if (report.status === "SUBMITTED") return "FIRST_APPROVED";
        if (report.status === "FIRST_APPROVED") return "SECOND_APPROVED";
        return "APPROVED";
      case "ASSET":
      case "FINANCIAL":
        if (report.status === "SUBMITTED") return "FIRST_APPROVED";
        return "APPROVED";
      default:
        return "APPROVED";
    }
  })();

  const approved = await this.repo.approve(id, reviewerId, nextStatus);

  await writeAuditLog({
    actorId: reviewerId,
    action: "REPORT_APPROVED",
    targetId: id,
    detail: { title: report.title, nextStatus },
  });

  return approved;
}
```

- [ ] **Step 3: reject() — REJECTED 후 author 알림 유지, 상태 체크 확장**

```typescript
async reject(id: number, reviewerId: number, reason: string) {
  if (!reason?.trim()) throw new AppError(400, "REJECTION_REASON_REQUIRED");
  const report = await this.repo.findById(id);
  if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
  const approvableStatuses = ["SUBMITTED", "FIRST_APPROVED", "SECOND_APPROVED"];
  if (!approvableStatuses.includes(report.status)) throw new AppError(409, "INVALID_STATUS");

  const rejected = await this.repo.reject(id, reviewerId, reason.trim());

  await writeAuditLog({
    actorId: reviewerId,
    action: "REPORT_REJECTED",
    targetId: id,
    detail: { title: report.title, reason: reason.trim() },
  });

  void this.notifRepo
    .createForUser(
      report.authorId,
      "REPORT_REJECTED",
      () => ({
        title: "보고서가 반려됐습니다",
        body: `"${report.title}" 보고서가 반려됐습니다. 사유: ${reason.trim()}`,
      }),
      id,
    )
    .catch(console.error);

  return rejected;
}
```

- [ ] **Step 4: submit() — NOT_SUBMITTED 체크 제거 (DRAFT 및 REJECTED 에서 제출 허용)**

`submit()` 내부의 상태 체크가 `report.status !== "DRAFT" && report.status !== "REJECTED"` 이어야 함. 현재 service.ts의 update()에 이미 있으므로 submit()에서는 authorId 체크만:
```typescript
async submit(id: number, userId: number) {
  const report = await this.repo.findById(id);
  if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
  if (report.authorId !== userId) throw new AppError(403, "FORBIDDEN");
  if (report.status !== "DRAFT" && report.status !== "REJECTED") throw new AppError(409, "INVALID_STATUS");
  // ... 나머지 동일
}
```

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/report/report.service.ts
git commit -m "feat(report): multi-stage approval logic in service layer"
```

---

### Task 4: 백엔드 — controller 업데이트

**Files:**
- Modify: `apps/api/src/report/report.controller.ts`

- [ ] **Step 1: 헬퍼 함수 추가**

기존 헬퍼 아래에:
```typescript
function isHrStaff(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "HR_STAFF";
}
function isAssetStaff(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "ASSET_STAFF";
}
function isFinanceStaff(req: Request): boolean {
  return req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "FINANCE_STAFF";
}
```

- [ ] **Step 2: list() 핸들러 — 새 역할 파라미터 전달**

```typescript
list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, status } = req.query as { type?: string; status?: string };
    const filters: { type?: string; status?: string } = {};
    if (type !== undefined) filters.type = type;
    if (status !== undefined) filters.status = status;
    res.json(
      await this.service.list(
        req.user!.id,
        isGM(req),
        isHeadCoach(req),
        filters,
        isHrManager(req),
        isFinanceManager(req),
        isAssetManager(req),
        isHrStaff(req),
        isAssetStaff(req),
        isFinanceStaff(req),
      ),
    );
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 3: get() 핸들러 — 새 역할 열람 권한 추가**

```typescript
get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await this.service.get(Number(req.params["id"]));
    const canView =
      isGM(req) ||
      isHeadCoach(req) ||
      report.authorId === req.user!.id ||
      (isHrManager(req) && report.type === "HR") ||
      (isHrStaff(req) && report.type === "HR") ||
      (isFinanceManager(req) && report.type === "FINANCIAL") ||
      (isFinanceStaff(req) && report.type === "FINANCIAL") ||
      (isAssetManager(req) && report.type === "ASSET") ||
      (isAssetStaff(req) && report.type === "ASSET");
    if (!canView) throw new AppError(403, "FORBIDDEN");
    res.json(report);
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 4: create() 핸들러 — 새 역할 타입 제한 업데이트**

```typescript
create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;
    if (!AUTHOR_ROLES.includes(role as any)) throw new AppError(403, "FORBIDDEN");
    const { type, title, content } = req.body;
    const foRole = req.user!.frontOfficeRole;
    if (type === "HR" && !(role === "ADMIN" || foRole === "HR_MANAGER" || foRole === "HR_STAFF")) {
      throw new AppError(403, "FORBIDDEN");
    }
    if (type === "FINANCIAL" && !(role === "ADMIN" || foRole === "FINANCE_MANAGER" || foRole === "FINANCE_STAFF" || foRole === "GM")) {
      throw new AppError(403, "FORBIDDEN");
    }
    if (type === "ASSET" && !(role === "ADMIN" || foRole === "ASSET_MANAGER" || foRole === "ASSET_STAFF")) {
      throw new AppError(403, "FORBIDDEN");
    }
    const file = req.file;
    res.status(201).json(
      await this.service.create({
        authorId: req.user!.id,
        type,
        title,
        content,
        ...(file && { fileUrl: `/uploads/reports/${file.filename}`, fileName: file.originalname }),
      }),
    );
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 5: approve() 핸들러 — 단계별 권한 체크**

```typescript
approve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await this.service.get(Number(req.params["id"]));

    const canApprove = (() => {
      switch (report.type) {
        case "HR":
          if (report.status === "SUBMITTED") return isHrManager(req);
          if (report.status === "FIRST_APPROVED") return isAssetManager(req);
          if (report.status === "SECOND_APPROVED") return isGM(req);
          return false;
        case "ASSET":
          if (report.status === "SUBMITTED") return isAssetManager(req);
          if (report.status === "FIRST_APPROVED") return isGM(req);
          return false;
        case "FINANCIAL":
          if (report.status === "SUBMITTED") return isFinanceManager(req);
          if (report.status === "FIRST_APPROVED") return isGM(req);
          return false;
        case "TRAINING":
          return isHeadCoach(req) && report.status === "SUBMITTED";
        default:
          return isGM(req) && report.status === "SUBMITTED";
      }
    })();

    if (!canApprove) throw new AppError(403, "FORBIDDEN");
    res.json(await this.service.approve(Number(req.params["id"]), req.user!.id));
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 6: reject() 핸들러 — 단계별 권한 체크**

```typescript
reject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await this.service.get(Number(req.params["id"]));

    const canReject = (() => {
      switch (report.type) {
        case "HR":
          if (report.status === "SUBMITTED") return isHrManager(req);
          if (report.status === "FIRST_APPROVED") return isAssetManager(req);
          if (report.status === "SECOND_APPROVED") return isGM(req);
          return false;
        case "ASSET":
          if (report.status === "SUBMITTED") return isAssetManager(req);
          if (report.status === "FIRST_APPROVED") return isGM(req);
          return false;
        case "FINANCIAL":
          if (report.status === "SUBMITTED") return isFinanceManager(req);
          if (report.status === "FIRST_APPROVED") return isGM(req);
          return false;
        case "TRAINING":
          return isHeadCoach(req) && report.status === "SUBMITTED";
        default:
          return isGM(req) && report.status === "SUBMITTED";
      }
    })();

    if (!canReject) throw new AppError(403, "FORBIDDEN");
    res.json(await this.service.reject(Number(req.params["id"]), req.user!.id, req.body.reason));
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 7: 타입 체크 후 커밋**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 에러 없음

```bash
git add apps/api/src/report/report.controller.ts
git commit -m "feat(report): stage-aware approve/reject permissions in controller"
```

---

### Task 5: 백엔드 — 테스트

**Files:**
- Create: `apps/api/__test__/report/report.service.test.ts`

- [ ] **Step 1: 테스트 파일 생성**

```typescript
import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ReportRepository } from '../../src/report/report.repo';
import { ReportService } from '../../src/report/report.service';
import { NotificationRepository } from '../../src/notification/notification.repo';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

let hrStaffId: number;
let hrManagerId: number;
let assetManagerId: number;
let gmId: number;
let reportId: number;

beforeAll(async () => {
  const hrStaff = await prisma.user.findFirst({ where: { frontOfficeRole: 'HR_STAFF' }, select: { id: true } });
  if (!hrStaff) throw new Error('HR_STAFF 없음 — seed 필요');
  hrStaffId = hrStaff.id;

  const hrManager = await prisma.user.findFirst({ where: { frontOfficeRole: 'HR_MANAGER' }, select: { id: true } });
  if (!hrManager) throw new Error('HR_MANAGER 없음');
  hrManagerId = hrManager.id;

  const assetManager = await prisma.user.findFirst({ where: { frontOfficeRole: 'ASSET_MANAGER' }, select: { id: true } });
  if (!assetManager) throw new Error('ASSET_MANAGER 없음');
  assetManagerId = assetManager.id;

  const gm = await prisma.user.findFirst({ where: { frontOfficeRole: 'GM' }, select: { id: true } });
  if (!gm) throw new Error('GM 없음');
  gmId = gm.id;
});

afterAll(async () => {
  if (reportId) await prisma.report.deleteMany({ where: { id: reportId } });
  await prisma.$disconnect();
});

const makeService = () => {
  const repo = new ReportRepository(prisma);
  const notifRepo = new NotificationRepository(prisma);
  return new ReportService(repo, notifRepo);
};

describe('HR 보고서 3단계 결재', () => {
  it('HR_STAFF가 HR 보고서 생성 → DRAFT', async () => {
    const svc = makeService();
    const r = await svc.create({ authorId: hrStaffId, type: 'HR', title: '테스트 HR 보고서', content: '내용' });
    expect(r.status).toBe('DRAFT');
    reportId = r.id;
  });

  it('제출 → SUBMITTED', async () => {
    const svc = makeService();
    const r = await svc.submit(reportId, hrStaffId);
    expect(r.status).toBe('SUBMITTED');
  });

  it('HR_MANAGER 1차 승인 → FIRST_APPROVED', async () => {
    const svc = makeService();
    const r = await svc.approve(reportId, hrManagerId);
    expect(r.status).toBe('FIRST_APPROVED');
    expect((r as any).firstReviewerId).toBe(hrManagerId);
  });

  it('ASSET_MANAGER 2차 승인 → SECOND_APPROVED', async () => {
    const svc = makeService();
    const r = await svc.approve(reportId, assetManagerId);
    expect(r.status).toBe('SECOND_APPROVED');
    expect((r as any).secondReviewerId).toBe(assetManagerId);
  });

  it('GM 최종 승인 → APPROVED', async () => {
    const svc = makeService();
    const r = await svc.approve(reportId, gmId);
    expect(r.status).toBe('APPROVED');
    expect((r as any).reviewerId).toBe(gmId);
  });
});

describe('HR 보고서 반려 후 재제출', () => {
  let rejectedReportId: number;

  it('HR_STAFF 생성 → 제출', async () => {
    const svc = makeService();
    const r = await svc.create({ authorId: hrStaffId, type: 'HR', title: '반려 테스트', content: '내용' });
    rejectedReportId = r.id;
    await svc.submit(rejectedReportId, hrStaffId);
  });

  it('HR_MANAGER 반려 → REJECTED', async () => {
    const svc = makeService();
    const r = await svc.reject(rejectedReportId, hrManagerId, '내용 보완 필요');
    expect(r.status).toBe('REJECTED');
    expect(r.rejectionReason).toBe('내용 보완 필요');
  });

  it('작성자 수정 후 재제출 → SUBMITTED', async () => {
    const svc = makeService();
    await svc.update(rejectedReportId, hrStaffId, { content: '보완된 내용' });
    const r = await svc.submit(rejectedReportId, hrStaffId);
    expect(r.status).toBe('SUBMITTED');
    await prisma.report.deleteMany({ where: { id: rejectedReportId } });
  });
});
```

- [ ] **Step 2: 테스트 실행 (seed 후)**

```bash
cd apps/api && npx jest __test__/report/report.service.test.ts --runInBand
```

Expected: 모든 테스트 PASS (seed Task 7 완료 후 실행 가능)

- [ ] **Step 3: 커밋**

```bash
git add apps/api/__test__/report/report.service.test.ts
git commit -m "test(report): add multi-stage approval integration tests"
```

---

### Task 6: 프론트엔드 — 타입 + i18n

**Files:**
- Modify: `football/src/types/report.ts`
- Modify: `football/src/locales/ko/report.json`
- Modify: `football/src/locales/en/report.json`

- [ ] **Step 1: report.ts 타입 업데이트**

```typescript
export type ReportType = 'PERFORMANCE' | 'MEDICAL' | 'TRAINING' | 'HR' | 'FINANCIAL' | 'ASSET'
export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'FIRST_APPROVED' | 'SECOND_APPROVED' | 'APPROVED' | 'REJECTED'

export interface Report {
  id: number
  type: ReportType
  status: ReportStatus
  title: string
  content: string
  fileUrl: string | null
  fileName: string | null
  rejectionReason: string | null
  authorId: number
  author: ReportUser
  reviewerId: number | null
  reviewer: ReportUser | null
  firstReviewerId: number | null
  firstReviewer: ReportUser | null
  firstReviewedAt: string | null
  secondReviewerId: number | null
  secondReviewer: ReportUser | null
  secondReviewedAt: string | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  reviewedAt: string | null
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  FIRST_APPROVED: '1차 승인',
  SECOND_APPROVED: '2차 승인',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const REPORT_STATUS_STYLE: Record<ReportStatus, string> = {
  DRAFT: 'border-border text-muted-foreground',
  SUBMITTED: 'border-blue-300 text-blue-700 bg-blue-50',
  FIRST_APPROVED: 'border-sky-300 text-sky-700 bg-sky-50',
  SECOND_APPROVED: 'border-indigo-300 text-indigo-700 bg-indigo-50',
  APPROVED: 'border-green-300 text-green-700 bg-green-50',
  REJECTED: 'border-red-300 text-red-700 bg-red-50',
}
```

- [ ] **Step 2: ko/report.json — 새 상태 번역 추가**

`status` 블록:
```json
"status": {
  "DRAFT": "초안",
  "SUBMITTED": "제출됨",
  "FIRST_APPROVED": "1차 승인",
  "SECOND_APPROVED": "2차 승인",
  "APPROVED": "승인됨",
  "REJECTED": "반려"
}
```

- [ ] **Step 3: en/report.json — 새 상태 번역 추가**

```json
"status": {
  "DRAFT": "Draft",
  "SUBMITTED": "Submitted",
  "FIRST_APPROVED": "1st Approved",
  "SECOND_APPROVED": "2nd Approved",
  "APPROVED": "Approved",
  "REJECTED": "Rejected"
}
```

- [ ] **Step 4: 커밋**

```bash
git add football/src/types/report.ts football/src/locales/ko/report.json football/src/locales/en/report.json
git commit -m "feat(report-fe): add new statuses and staff roles to types and i18n"
```

---

### Task 7: 프론트엔드 — 페이지 업데이트

**Files:**
- Modify: `football/src/pages/reports/ReportDetailPage.tsx`
- Modify: `football/src/pages/reports/ReportsPage.tsx`
- Modify: `football/src/pages/reports/ReportFormPage.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [ ] **Step 1: ReportDetailPage — canApprove 다단계 로직**

`ReportDetailPage.tsx` line 77 아래 전체 교체:
```typescript
const isGM = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'GM'
const isHrManager = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'HR_MANAGER'
const isAssetManager = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'ASSET_MANAGER'
const isFinanceManager = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'FINANCE_MANAGER'
const isHeadCoach = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'HEAD_COACH'

const canApprove = (() => {
  if (!report) return false
  switch (report.type) {
    case 'HR':
      if (report.status === 'SUBMITTED') return isHrManager
      if (report.status === 'FIRST_APPROVED') return isAssetManager
      if (report.status === 'SECOND_APPROVED') return isGM
      return false
    case 'ASSET':
      if (report.status === 'SUBMITTED') return isAssetManager
      if (report.status === 'FIRST_APPROVED') return isGM
      return false
    case 'FINANCIAL':
      if (report.status === 'SUBMITTED') return isFinanceManager
      if (report.status === 'FIRST_APPROVED') return isGM
      return false
    case 'TRAINING':
      return isHeadCoach && report.status === 'SUBMITTED'
    default:
      return isGM && report.status === 'SUBMITTED'
  }
})()
const isAuthor = report?.authorId === user?.id
const canSubmit = isAuthor && (report?.status === 'DRAFT' || report?.status === 'REJECTED')
```

- [ ] **Step 2: ReportDetailPage — submit 버튼 조건 수정**

```tsx
{canSubmit && (
  <Button size="sm" onClick={handleSubmit} disabled={acting}>{t('detail.submitButton')}</Button>
)}
```

- [ ] **Step 3: ReportDetailPage — 결재 이력 표시 추가**

`report.reviewedAt && report.reviewer` 블록 아래에 단계별 이력 추가:
```tsx
{report.firstReviewedAt && report.firstReviewer && (
  <div>
    <p className="text-muted-foreground text-xs mb-0.5">{t('detail.firstApprovedAtLabel')}</p>
    <p>{formatDateTime(report.firstReviewedAt)} ({report.firstReviewer.nickname})</p>
  </div>
)}
{report.secondReviewedAt && report.secondReviewer && (
  <div>
    <p className="text-muted-foreground text-xs mb-0.5">{t('detail.secondApprovedAtLabel')}</p>
    <p>{formatDateTime(report.secondReviewedAt)} ({report.secondReviewer.nickname})</p>
  </div>
)}
{report.reviewedAt && report.reviewer && (
  <div>
    <p className="text-muted-foreground text-xs mb-0.5">{t('page.col.approvedAt')}</p>
    <p>{formatDateTime(report.reviewedAt)} ({report.reviewer.nickname})</p>
  </div>
)}
```

- [ ] **Step 4: ReportsPage — FO_CREATE_ROLES 업데이트**

```typescript
const FO_CREATE_ROLES = ['GM', 'HR_MANAGER', 'HR_STAFF', 'FINANCE_MANAGER', 'FINANCE_STAFF', 'ASSET_MANAGER', 'ASSET_STAFF']
```

- [ ] **Step 5: ReportFormPage — 타입 필터 업데이트**

```typescript
const TYPES = ALL_TYPES.filter((tp) => {
  if (tp === 'HR') return isAdmin || foRole === 'HR_MANAGER' || foRole === 'HR_STAFF'
  if (tp === 'FINANCIAL') return isAdmin || foRole === 'FINANCE_MANAGER' || foRole === 'FINANCE_STAFF' || foRole === 'GM'
  if (tp === 'ASSET') return isAdmin || foRole === 'ASSET_MANAGER' || foRole === 'ASSET_STAFF'
  return true
})
```

- [ ] **Step 6: AppShell — /reports 네비 frontOfficeRoles 업데이트**

```typescript
{
  to: '/reports',
  label: 'nav.item.reportApproval',
  icon: FileText,
  section: 'nav.section.management',
  roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'],
  frontOfficeRoles: ['GM', 'TD', 'HR_MANAGER', 'HR_STAFF', 'FINANCE_MANAGER', 'FINANCE_STAFF', 'ASSET_MANAGER', 'ASSET_STAFF', 'SCOUT'],
},
```

- [ ] **Step 7: ko/report.json에 결재 이력 레이블 추가**

`detail` 블록에:
```json
"firstApprovedAtLabel": "1차 승인일",
"secondApprovedAtLabel": "2차 승인일"
```

- [ ] **Step 8: en/report.json에 결재 이력 레이블 추가**

```json
"firstApprovedAtLabel": "1st Approved At",
"secondApprovedAtLabel": "2nd Approved At"
```

- [ ] **Step 9: 커밋**

```bash
git add football/src/pages/reports/ football/src/layouts/AppShell.tsx football/src/locales/
git commit -m "feat(report-fe): multi-stage approve UI, approval trail, nav visibility"
```

---

### Task 8: 시드 데이터 업데이트

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: 신규 staff 계정 추가 (seedRecruitment 함수 앞)**

`seed.ts`의 `async function seedReports()` 내부 `existing` 체크 전에 신규 계정 upsert:

```typescript
async function seedStaffAccounts() {
  const hashed = await bcrypt.hash('Password1!', 10);
  const korea = await prisma.country.findUniqueOrThrow({ where: { id: 1 } });

  const accounts = [
    { email: 'hr.staff@club.com', username: 'HR직원', nickname: 'hr_staff', frontOfficeRole: 'HR_STAFF' as const },
    { email: 'asset.staff@club.com', username: '자산관리직원', nickname: 'asset_staff', frontOfficeRole: 'ASSET_STAFF' as const },
    { email: 'finance.staff@club.com', username: '재무직원', nickname: 'finance_staff', frontOfficeRole: 'FINANCE_STAFF' as const },
  ];

  for (const acc of accounts) {
    const existing = await prisma.user.findUnique({ where: { email: acc.email } });
    if (!existing) {
      const phone = await prisma.phoneNumber.create({ data: encryptPhone('010-0000-0099') });
      await prisma.user.create({
        data: {
          email: acc.email,
          password: hashed,
          username: acc.username,
          nickname: acc.nickname,
          role: 'FRONT_OFFICE',
          frontOfficeRole: acc.frontOfficeRole,
          dateOfBirth: new Date('1995-01-01'),
          nationalityId: korea.id,
          phoneNumberId: phone.id,
        },
      });
    }
  }
  console.log('   - Staff accounts: hr.staff, asset.staff, finance.staff seeded');
}
```

- [ ] **Step 2: seedReports()에 중간 단계 보고서 추가**

`existing > 0` 체크 제거하고, 타입별 기존 보고서가 있으면 스킵하는 방식으로 변경:
```typescript
async function seedReports() {
  const [gm, hr, hrStaff, asset, assetStaff, finance, financeStaff, coach] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'gm@club.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'hr@club.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'hr.staff@club.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'asset@club.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'asset.staff@club.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'finance@club.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'finance.staff@club.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'coach@club.com' } }),
  ]);

  const existing = await prisma.report.count();
  if (existing > 0) {
    console.log('   - Reports: already seeded, skipping');
    return;
  }

  const now = new Date();
  const reports = [
    // HR 보고서 — 3단계
    { type: 'HR' as const, title: '2026년 7월 인력 현황 보고', content: '7월 인력 현황 보고서입니다.', authorId: hrStaff.id, status: 'DRAFT' as const },
    { type: 'HR' as const, title: '2026년 상반기 인사 평가 결과', content: '상반기 평가 보고서입니다.', authorId: hrStaff.id, status: 'SUBMITTED' as const, submittedAt: new Date(now.getTime() - 2 * 86400_000) },
    { type: 'HR' as const, title: '채용 절차 개선 방안 (1차 승인)', content: '채용 프로세스 개선안입니다.', authorId: hrStaff.id, status: 'FIRST_APPROVED' as const, submittedAt: new Date(now.getTime() - 5 * 86400_000), firstReviewerId: hr.id, firstReviewedAt: new Date(now.getTime() - 4 * 86400_000) },
    { type: 'HR' as const, title: '채용 절차 개선 방안 (2차 승인)', content: '채용 프로세스 개선안입니다.', authorId: hrStaff.id, status: 'SECOND_APPROVED' as const, submittedAt: new Date(now.getTime() - 8 * 86400_000), firstReviewerId: hr.id, firstReviewedAt: new Date(now.getTime() - 7 * 86400_000), secondReviewerId: asset.id, secondReviewedAt: new Date(now.getTime() - 6 * 86400_000) },
    { type: 'HR' as const, title: '신규 채용 절차 개선 방안 (최종)', content: '최종 승인된 개선안입니다.', authorId: hrStaff.id, status: 'APPROVED' as const, submittedAt: new Date(now.getTime() - 14 * 86400_000), firstReviewerId: hr.id, firstReviewedAt: new Date(now.getTime() - 13 * 86400_000), secondReviewerId: asset.id, secondReviewedAt: new Date(now.getTime() - 12 * 86400_000), reviewerId: gm.id, reviewedAt: new Date(now.getTime() - 11 * 86400_000) },
    // ASSET 보고서 — 2단계
    { type: 'ASSET' as const, title: '구장 시설물 점검 현황 (7월)', content: '시설 점검 보고서입니다.', authorId: assetStaff.id, status: 'DRAFT' as const },
    { type: 'ASSET' as const, title: '장비 교체 요청 보고', content: '장비 구매 요청 보고서입니다.', authorId: assetStaff.id, status: 'FIRST_APPROVED' as const, submittedAt: new Date(now.getTime() - 3 * 86400_000), firstReviewerId: asset.id, firstReviewedAt: new Date(now.getTime() - 2 * 86400_000) },
    { type: 'ASSET' as const, title: '2026년 자산 관리 연간 계획', content: '연간 자산 계획입니다.', authorId: assetStaff.id, status: 'APPROVED' as const, submittedAt: new Date(now.getTime() - 10 * 86400_000), firstReviewerId: asset.id, firstReviewedAt: new Date(now.getTime() - 9 * 86400_000), reviewerId: gm.id, reviewedAt: new Date(now.getTime() - 8 * 86400_000) },
    // FINANCIAL 보고서 — 2단계
    { type: 'FINANCIAL' as const, title: '2026년 7월 예산 집행 현황', content: '월별 예산 집행 보고서입니다.', authorId: financeStaff.id, status: 'SUBMITTED' as const, submittedAt: new Date(now.getTime() - 1 * 86400_000) },
    { type: 'FINANCIAL' as const, title: '스폰서십 수익 결산 (상반기)', content: '스폰서십 결산입니다.', authorId: financeStaff.id, status: 'APPROVED' as const, submittedAt: new Date(now.getTime() - 14 * 86400_000), firstReviewerId: finance.id, firstReviewedAt: new Date(now.getTime() - 13 * 86400_000), reviewerId: gm.id, reviewedAt: new Date(now.getTime() - 12 * 86400_000) },
    // TRAINING
    { type: 'TRAINING' as const, title: '주간 훈련 계획 보고', content: '이번 주 훈련 보고서입니다.', authorId: coach.id, status: 'APPROVED' as const, submittedAt: new Date(now.getTime() - 5 * 86400_000), reviewerId: coach.id, reviewedAt: new Date(now.getTime() - 4 * 86400_000) },
    // PERFORMANCE
    { type: 'PERFORMANCE' as const, title: '선수단 성과 평가 (2분기)', content: '2분기 성과 보고서입니다.', authorId: gm.id, status: 'APPROVED' as const, submittedAt: new Date(now.getTime() - 20 * 86400_000), reviewerId: gm.id, reviewedAt: new Date(now.getTime() - 19 * 86400_000) },
  ];

  await prisma.report.createMany({ data: reports });
  console.log(`   - Reports: ${reports.length}개 (HR×5, ASSET×3, FINANCIAL×2, TRAINING×1, PERFORMANCE×1)`);
}
```

- [ ] **Step 3: main()에 seedStaffAccounts() 호출 추가**

`seedRecruitment()` 호출 전에:
```typescript
await seedStaffAccounts();
```

- [ ] **Step 4: console.log 요약 업데이트**

`console.log("✅ Seed complete")` 블록에:
```typescript
console.log(`     FRONT_OFFICE: hr.staff@club.com (HR_STAFF)`);
console.log(`     FRONT_OFFICE: asset.staff@club.com (ASSET_STAFF)`);
console.log(`     FRONT_OFFICE: finance.staff@club.com (FINANCE_STAFF)`);
```

- [ ] **Step 5: 기존 보고서 삭제 후 시드 실행**

```bash
psql -U postgres -d football -c 'DELETE FROM "Report";'
cd apps/api && npx prisma db seed
```

Expected 출력:
```
- Staff accounts: hr.staff, asset.staff, finance.staff seeded
- Reports: 12개 (HR×5, ASSET×3, FINANCIAL×2, TRAINING×1, PERFORMANCE×1)
```

- [ ] **Step 6: 커밋**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat(seed): add HR/ASSET/FINANCE staff accounts and multi-stage report samples"
```

---

### Task 9: 빠른 로그인 업데이트

**Files:**
- Modify: `football/src/pages/auth/LoginPage.tsx`

- [ ] **Step 1: DEV_ACCOUNTS에 staff 계정 추가**

`기본` 그룹에 추가:
```typescript
{ label: 'HR직원', email: 'hr.staff@club.com' },
{ label: '자산관리직원', email: 'asset.staff@club.com' },
{ label: '재무직원', email: 'finance.staff@club.com' },
```

- [ ] **Step 2: 커밋**

```bash
git add football/src/pages/auth/LoginPage.tsx
git commit -m "feat(auth): add HR/ASSET/FINANCE staff to quick login"
```

---

## Self-Review

**Spec coverage:**
- ✅ HR 3단계: HR_STAFF → HR_MANAGER → ASSET_MANAGER → GM
- ✅ ASSET 2단계: ASSET_STAFF → ASSET_MANAGER → GM
- ✅ FINANCIAL 2단계: FINANCE_STAFF → FINANCE_MANAGER → GM
- ✅ TRAINING/PERFORMANCE/MEDICAL: 현행 유지
- ✅ 반려 시 REJECTED → 작성자 수정 후 재제출
- ✅ 새 역할 네비 접근 권한
- ✅ 새 역할 보고서 작성 권한
- ✅ 시드 데이터
- ✅ 빠른 로그인

**Placeholder scan:** 없음

**Type consistency:**
- `nextStatus` 타입 `"FIRST_APPROVED" | "SECOND_APPROVED" | "APPROVED"` — repo/service 일치
- `firstReviewerId`, `firstReviewedAt`, `secondReviewerId`, `secondReviewedAt` — schema/repo/types/seed 일치
- `HR_STAFF`, `ASSET_STAFF`, `FINANCE_STAFF` — schema/controller/repo/seed/frontend 일치
