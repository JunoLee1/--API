# 의료비 결재 모듈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 의료팀이 의료비를 상신하고 MEDICAL_DIRECTOR(1차) → ADMIN(최종) 2단계로 결재하는 워크플로우를 구현한다.

**Architecture:** 단일 `MedicalExpense` 테이블에 `status` 컬럼(DRAFT→SUBMITTED→LEADER_APPROVED→APPROVED/REJECTED)으로 결재 단계를 관리한다. BE는 Express 5 + Prisma 7, FE는 React + shadcn/ui. 파일 업로드는 multer, `uploads/medical-expenses/` 로컬 저장.

**Tech Stack:** TypeScript, Prisma 7, Express 5, React 18, shadcn/ui, multer 2.x, socket.io

---

## 파일 구조

**BE (apps/api/)**
- `prisma/schema.prisma` — MedicalExpense 모델 + 3개 enum 추가
- `prisma/migrations/20260714000003_add_medical_expense/migration.sql` — DDL
- `src/notification/notification.repo.ts` — createForMedicalDirector + createForAdmin 추가
- `src/medical-expense/medical-expense.repo.ts` — CRUD + 5개 상태전이 메서드
- `src/medical-expense/medical-expense.service.ts` — 비즈니스 로직 + 알림 + AuditLog
- `src/medical-expense/medical-expense.controller.ts` — HTTP 핸들러
- `src/medical-expense/medical-expense.routes.ts` — multer + 9개 라우트
- `src/apiRouter.ts` — `/medical-expenses` 등록

**FE (football/src/)**
- `types/medical-expense.ts` — 타입 + label/style 맵
- `services/medical-expense.service.ts` — API 함수 9개
- `pages/medical-expense/MedicalExpensesPage.tsx` — 목록
- `pages/medical-expense/MedicalExpenseFormPage.tsx` — 작성/수정 폼
- `pages/medical-expense/MedicalExpenseDetailPage.tsx` — 상세 + 결재 액션
- `layouts/AppShell.tsx` — 부상·의료 섹션에 nav 항목 추가
- `App.tsx` — 3개 라우트 추가

---

### Task 1: Prisma 스키마 + 마이그레이션 + 알림 repo 헬퍼

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260714000003_add_medical_expense/migration.sql`
- Modify: `apps/api/src/notification/notification.repo.ts`

- [ ] **Step 1: schema.prisma에 enum 3개 + MedicalExpense 모델 + User 관계 추가**

`apps/api/prisma/schema.prisma` 맨 끝(Report 모델 아래)에 추가:

```prisma
enum ExpenseCostCategory {
  OUTPATIENT
  EXAMINATION
  SURGERY
  REHABILITATION
  MEDICATION
}

enum ExpensePayerType {
  CLUB
  ASSOCIATION
  INDIVIDUAL
}

enum MedicalExpenseStatus {
  DRAFT
  SUBMITTED
  LEADER_APPROVED
  APPROVED
  REJECTED
}

model MedicalExpense {
  id               Int                  @id @default(autoincrement())
  status           MedicalExpenseStatus @default(DRAFT)
  injuryId         Int?
  injury           Injury?              @relation(fields: [injuryId], references: [id])
  receiptDate      DateTime
  costCategory     ExpenseCostCategory
  totalAmount      Int
  payerType        ExpensePayerType
  description      String?
  fileUrl          String?
  fileName         String?
  rejectionReason  String?
  submittedById    Int
  submittedBy      User                 @relation("MedicalExpenseSubmitter", fields: [submittedById], references: [id])
  leaderReviewerId Int?
  leaderReviewer   User?                @relation("MedicalExpenseLeaderReviewer", fields: [leaderReviewerId], references: [id])
  adminReviewerId  Int?
  adminReviewer    User?                @relation("MedicalExpenseAdminReviewer", fields: [adminReviewerId], references: [id])
  submittedAt      DateTime?
  leaderReviewedAt DateTime?
  adminReviewedAt  DateTime?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt
}
```

`apps/api/prisma/schema.prisma`의 User 모델 내 기존 `injuries` 필드 근처에 아래 3줄 추가:

```prisma
  submittedExpenses      MedicalExpense[] @relation("MedicalExpenseSubmitter")
  leaderReviewedExpenses MedicalExpense[] @relation("MedicalExpenseLeaderReviewer")
  adminReviewedExpenses  MedicalExpense[] @relation("MedicalExpenseAdminReviewer")
```

`apps/api/prisma/schema.prisma`의 Injury 모델에 역방향 관계 추가:

```prisma
  medicalExpenses MedicalExpense[]
```

- [ ] **Step 2: 마이그레이션 디렉토리 생성 및 SQL 작성**

```bash
mkdir -p apps/api/prisma/migrations/20260714000003_add_medical_expense
```

`apps/api/prisma/migrations/20260714000003_add_medical_expense/migration.sql` 생성:

```sql
-- CreateEnum
CREATE TYPE "ExpenseCostCategory" AS ENUM ('OUTPATIENT', 'EXAMINATION', 'SURGERY', 'REHABILITATION', 'MEDICATION');

-- CreateEnum
CREATE TYPE "ExpensePayerType" AS ENUM ('CLUB', 'ASSOCIATION', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "MedicalExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LEADER_APPROVED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MedicalExpense" (
    "id" SERIAL NOT NULL,
    "status" "MedicalExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "injuryId" INTEGER,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "costCategory" "ExpenseCostCategory" NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "payerType" "ExpensePayerType" NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "rejectionReason" TEXT,
    "submittedById" INTEGER NOT NULL,
    "leaderReviewerId" INTEGER,
    "adminReviewerId" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "leaderReviewedAt" TIMESTAMP(3),
    "adminReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalExpense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_leaderReviewerId_fkey" FOREIGN KEY ("leaderReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_adminReviewerId_fkey" FOREIGN KEY ("adminReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: 마이그레이션 적용 및 Prisma client 재생성**

```bash
cd apps/api
npx prisma migrate resolve --applied 20260714000003_add_medical_expense
npx prisma db execute --file prisma/migrations/20260714000003_add_medical_expense/migration.sql --schema prisma/schema.prisma
npx prisma generate
```

Expected: `✔ Generated Prisma Client` 메시지.

- [ ] **Step 4: notification.repo.ts에 createForMedicalDirector + createForAdmin 추가**

`apps/api/src/notification/notification.repo.ts`의 `createForGM` 메서드 아래에 추가:

```typescript
  createForMedicalDirector(type: string, title: string, body: string) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR" },
        select: { id: true },
      });
      if (users.length === 0) return;
      await tx.notification.createMany({
        data: users.map((u) => ({ userId: u.id, type, title, body })) as any,
      });
    });
  }

  createForAdmin(type: string, title: string, body: string) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      if (users.length === 0) return;
      await tx.notification.createMany({
        data: users.map((u) => ({ userId: u.id, type, title, body })) as any,
      });
    });
  }
```

- [ ] **Step 5: 커밋**

```bash
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations/20260714000003_add_medical_expense/ \
        apps/api/src/notification/notification.repo.ts
git commit -m "feat: add MedicalExpense schema, migration, notification helpers"
```

---

### Task 2: BE medical-expense.repo.ts

**Files:**
- Create: `apps/api/src/medical-expense/medical-expense.repo.ts`

- [ ] **Step 1: repo 파일 생성**

`apps/api/src/medical-expense/medical-expense.repo.ts`:

```typescript
import { PrismaClient } from "../generated/client";

const userSelect = {
  id: true,
  nickname: true,
  role: true,
  coachingRole: true,
} as const;

const expenseInclude = {
  submittedBy: { select: userSelect },
  leaderReviewer: { select: userSelect },
  adminReviewer: { select: userSelect },
  injury: { select: { id: true, bodyPart: true, playerId: true } },
} as const;

export class MedicalExpenseRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(submittedById: number | null) {
    return this.prisma.medicalExpense.findMany({
      where: submittedById !== null ? { submittedById } : undefined,
      include: expenseInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.medicalExpense.findUnique({
      where: { id },
      include: expenseInclude,
    });
  }

  create(data: {
    submittedById: number;
    receiptDate: Date;
    costCategory: string;
    totalAmount: number;
    payerType: string;
    injuryId?: number;
    description?: string;
    fileUrl?: string;
    fileName?: string;
  }) {
    return this.prisma.medicalExpense.create({
      data: data as any,
      include: expenseInclude,
    });
  }

  update(id: number, data: {
    receiptDate?: Date;
    costCategory?: string;
    totalAmount?: number;
    payerType?: string;
    injuryId?: number | null;
    description?: string;
    fileUrl?: string;
    fileName?: string;
  }) {
    return this.prisma.medicalExpense.update({
      where: { id },
      data: data as any,
      include: expenseInclude,
    });
  }

  submit(id: number) {
    return this.prisma.medicalExpense.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date(), rejectionReason: null },
      include: expenseInclude,
    });
  }

  leaderApprove(id: number, leaderReviewerId: number) {
    return this.prisma.medicalExpense.update({
      where: { id },
      data: { status: "LEADER_APPROVED", leaderReviewerId, leaderReviewedAt: new Date() },
      include: expenseInclude,
    });
  }

  leaderReject(id: number, leaderReviewerId: number, rejectionReason: string) {
    return this.prisma.medicalExpense.update({
      where: { id },
      data: { status: "REJECTED", leaderReviewerId, rejectionReason, leaderReviewedAt: new Date() },
      include: expenseInclude,
    });
  }

  approve(id: number, adminReviewerId: number) {
    return this.prisma.medicalExpense.update({
      where: { id },
      data: { status: "APPROVED", adminReviewerId, adminReviewedAt: new Date() },
      include: expenseInclude,
    });
  }

  reject(id: number, adminReviewerId: number, rejectionReason: string) {
    return this.prisma.medicalExpense.update({
      where: { id },
      data: { status: "REJECTED", adminReviewerId, rejectionReason, adminReviewedAt: new Date() },
      include: expenseInclude,
    });
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/api/src/medical-expense/medical-expense.repo.ts
git commit -m "feat: add MedicalExpenseRepository"
```

---

### Task 3: BE service + controller + routes + apiRouter 등록

**Files:**
- Create: `apps/api/src/medical-expense/medical-expense.service.ts`
- Create: `apps/api/src/medical-expense/medical-expense.controller.ts`
- Create: `apps/api/src/medical-expense/medical-expense.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: medical-expense.service.ts 작성**

`apps/api/src/medical-expense/medical-expense.service.ts`:

```typescript
import { MedicalExpenseRepository } from "./medical-expense.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";

export class MedicalExpenseService {
  constructor(
    private repo: MedicalExpenseRepository,
    private notifRepo: NotificationRepository,
  ) {}

  list(userId: number, role: string, coachingRole: string | null) {
    if (role === "ADMIN") return this.repo.findAll(null);
    if (coachingRole === "MEDICAL_DIRECTOR") return this.repo.findAll(null);
    return this.repo.findAll(userId);
  }

  async get(id: number) {
    const expense = await this.repo.findById(id);
    if (!expense) throw new AppError(404, "EXPENSE_NOT_FOUND");
    return expense;
  }

  async create(data: {
    submittedById: number;
    receiptDate: Date;
    costCategory: string;
    totalAmount: number;
    payerType: string;
    injuryId?: number;
    description?: string;
    fileUrl?: string;
    fileName?: string;
  }) {
    return this.repo.create(data);
  }

  async update(id: number, userId: number, data: {
    receiptDate?: Date;
    costCategory?: string;
    totalAmount?: number;
    payerType?: string;
    injuryId?: number | null;
    description?: string;
    fileUrl?: string;
    fileName?: string;
  }) {
    const expense = await this.repo.findById(id);
    if (!expense) throw new AppError(404, "EXPENSE_NOT_FOUND");
    if (expense.submittedById !== userId) throw new AppError(403, "FORBIDDEN");
    if (expense.status !== "DRAFT" && expense.status !== "REJECTED") throw new AppError(409, "INVALID_STATUS");
    return this.repo.update(id, data);
  }

  async submit(id: number, userId: number) {
    const expense = await this.repo.findById(id);
    if (!expense) throw new AppError(404, "EXPENSE_NOT_FOUND");
    if (expense.submittedById !== userId) throw new AppError(403, "FORBIDDEN");
    if (expense.status !== "DRAFT" && expense.status !== "REJECTED") throw new AppError(409, "INVALID_STATUS");

    const submitted = await this.repo.submit(id);

    await this.notifRepo.createForMedicalDirector(
      "MEDICAL_EXPENSE_SUBMITTED",
      "의료비 결재 요청",
      "의료비 지출 건이 1차 결재를 기다리고 있습니다.",
    );

    return submitted;
  }

  async leaderApprove(id: number, reviewerId: number) {
    const expense = await this.repo.findById(id);
    if (!expense) throw new AppError(404, "EXPENSE_NOT_FOUND");
    if (expense.status !== "SUBMITTED") throw new AppError(409, "INVALID_STATUS");

    const approved = await this.repo.leaderApprove(id, reviewerId);

    await writeAuditLog({ actorId: reviewerId, action: "MEDICAL_EXPENSE_LEADER_APPROVED", targetId: id });

    await this.notifRepo.createForAdmin(
      "MEDICAL_EXPENSE_LEADER_APPROVED",
      "의료비 최종 결재 요청",
      "1차 승인된 의료비 지출 건이 최종 결재를 기다리고 있습니다.",
    );

    return approved;
  }

  async leaderReject(id: number, reviewerId: number, reason: string) {
    if (!reason?.trim()) throw new AppError(400, "REJECTION_REASON_REQUIRED");
    const expense = await this.repo.findById(id);
    if (!expense) throw new AppError(404, "EXPENSE_NOT_FOUND");
    if (expense.status !== "SUBMITTED") throw new AppError(409, "INVALID_STATUS");

    const rejected = await this.repo.leaderReject(id, reviewerId, reason.trim());

    await writeAuditLog({ actorId: reviewerId, action: "MEDICAL_EXPENSE_LEADER_REJECTED", targetId: id, detail: { reason: reason.trim() } });

    await this.notifRepo.create({
      userId: expense.submittedById,
      type: "MEDICAL_EXPENSE_REJECTED",
      title: "의료비 신청 반려",
      body: "제출하신 의료비 지출 건이 반려됐습니다. 내용을 수정 후 재상신해주세요.",
    });

    return rejected;
  }

  async approve(id: number, adminId: number) {
    const expense = await this.repo.findById(id);
    if (!expense) throw new AppError(404, "EXPENSE_NOT_FOUND");
    if (expense.status !== "LEADER_APPROVED") throw new AppError(409, "INVALID_STATUS");

    const approved = await this.repo.approve(id, adminId);

    await writeAuditLog({ actorId: adminId, action: "MEDICAL_EXPENSE_APPROVED", targetId: id });

    await this.notifRepo.create({
      userId: expense.submittedById,
      type: "MEDICAL_EXPENSE_APPROVED",
      title: "의료비 최종 승인",
      body: "제출하신 의료비 지출 건이 최종 승인됐습니다.",
    });

    return approved;
  }

  async reject(id: number, adminId: number, reason: string) {
    if (!reason?.trim()) throw new AppError(400, "REJECTION_REASON_REQUIRED");
    const expense = await this.repo.findById(id);
    if (!expense) throw new AppError(404, "EXPENSE_NOT_FOUND");
    if (expense.status !== "LEADER_APPROVED") throw new AppError(409, "INVALID_STATUS");

    const rejected = await this.repo.reject(id, adminId, reason.trim());

    await writeAuditLog({ actorId: adminId, action: "MEDICAL_EXPENSE_REJECTED", targetId: id, detail: { reason: reason.trim() } });

    await this.notifRepo.create({
      userId: expense.submittedById,
      type: "MEDICAL_EXPENSE_REJECTED",
      title: "의료비 최종 반려",
      body: "제출하신 의료비 지출 건이 반려됐습니다. 내용을 수정 후 재상신해주세요.",
    });

    return rejected;
  }
}
```

- [ ] **Step 2: medical-expense.controller.ts 작성**

`apps/api/src/medical-expense/medical-expense.controller.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { MedicalExpenseService } from "./medical-expense.service";

function isMedical(req: Request) {
  return req.user?.role === "COACHING_STAFF" && req.user?.coachingRole === "MEDICAL";
}

function isMedicalDirector(req: Request) {
  return req.user?.role === "COACHING_STAFF" && req.user?.coachingRole === "MEDICAL_DIRECTOR";
}

function isAdmin(req: Request) {
  return req.user?.role === "ADMIN";
}

export class MedicalExpenseController {
  constructor(private service: MedicalExpenseService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.user!.id, req.user!.role, req.user!.coachingRole ?? null));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expense = await this.service.get(Number(req.params["id"]));
      const canAccess =
        isAdmin(req) ||
        isMedicalDirector(req) ||
        expense.submittedById === req.user!.id;
      if (!canAccess) throw new AppError(403, "FORBIDDEN");
      res.json(expense);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isMedical(req)) throw new AppError(403, "FORBIDDEN");
      const { receiptDate, costCategory, totalAmount, payerType, injuryId, description } = req.body;
      const file = req.file;
      res.status(201).json(
        await this.service.create({
          submittedById: req.user!.id,
          receiptDate: new Date(receiptDate),
          costCategory,
          totalAmount: Number(totalAmount),
          payerType,
          ...(injuryId && { injuryId: Number(injuryId) }),
          ...(description && { description }),
          ...(file && { fileUrl: `/uploads/medical-expenses/${file.filename}`, fileName: file.originalname }),
        }),
      );
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { receiptDate, costCategory, totalAmount, payerType, injuryId, description } = req.body;
      const file = req.file;
      res.json(
        await this.service.update(Number(req.params["id"]), req.user!.id, {
          ...(receiptDate !== undefined && { receiptDate: new Date(receiptDate) }),
          ...(costCategory !== undefined && { costCategory }),
          ...(totalAmount !== undefined && { totalAmount: Number(totalAmount) }),
          ...(payerType !== undefined && { payerType }),
          ...(injuryId !== undefined && { injuryId: injuryId ? Number(injuryId) : null }),
          ...(description !== undefined && { description }),
          ...(file && { fileUrl: `/uploads/medical-expenses/${file.filename}`, fileName: file.originalname }),
        }),
      );
    } catch (err) {
      next(err);
    }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.submit(Number(req.params["id"]), req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  leaderApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isMedicalDirector(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.leaderApprove(Number(req.params["id"]), req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  leaderReject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isMedicalDirector(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.leaderReject(Number(req.params["id"]), req.user!.id, req.body.reason));
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isAdmin(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.approve(Number(req.params["id"]), req.user!.id));
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isAdmin(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.reject(Number(req.params["id"]), req.user!.id, req.body.reason));
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 3: medical-expense.routes.ts 작성**

`apps/api/src/medical-expense/medical-expense.routes.ts`:

```typescript
import { Router } from "express";
import passport from "passport";
import multer from "multer";
import path from "path";
import fs from "fs";
import { MedicalExpenseController } from "./medical-expense.controller";
import { MedicalExpenseService } from "./medical-expense.service";
import { MedicalExpenseRepository } from "./medical-expense.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new MedicalExpenseRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new MedicalExpenseService(repo, notifRepo);
const controller = new MedicalExpenseController(service);

const auth = passport.authenticate("accessToken", { session: false });

const uploadDir = path.join(process.cwd(), "uploads", "medical-expenses");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.get("/", auth, controller.list);
router.post("/", auth, upload.single("file"), controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, upload.single("file"), controller.update);
router.post("/:id/submit", auth, controller.submit);
router.post("/:id/leader-approve", auth, controller.leaderApprove);
router.post("/:id/leader-reject", auth, controller.leaderReject);
router.post("/:id/approve", auth, controller.approve);
router.post("/:id/reject", auth, controller.reject);

export default router;
```

- [ ] **Step 4: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts`에서 기존 import 블록 맨 아래에 추가:

```typescript
import medicalExpenseRouter from "./medical-expense/medical-expense.routes";
```

`apiRouter.use("/reports", reportRouter);` 아래에 추가:

```typescript
apiRouter.use("/medical-expenses", medicalExpenseRouter);
```

- [ ] **Step 5: 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 오류 없음.

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/medical-expense/ apps/api/src/apiRouter.ts
git commit -m "feat: add MedicalExpense BE service, controller, routes"
```

---

### Task 4: FE types + service

**Files:**
- Create: `football/src/types/medical-expense.ts`
- Create: `football/src/services/medical-expense.service.ts`

- [ ] **Step 1: types/medical-expense.ts 작성**

`football/src/types/medical-expense.ts`:

```typescript
export type ExpenseCostCategory = 'OUTPATIENT' | 'EXAMINATION' | 'SURGERY' | 'REHABILITATION' | 'MEDICATION'
export type ExpensePayerType = 'CLUB' | 'ASSOCIATION' | 'INDIVIDUAL'
export type MedicalExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'LEADER_APPROVED' | 'APPROVED' | 'REJECTED'

export interface ExpenseUser {
  id: number
  nickname: string
  role: string
  coachingRole: string | null
}

export interface ExpenseInjury {
  id: number
  bodyPart: string
  playerId: string
}

export interface MedicalExpense {
  id: number
  status: MedicalExpenseStatus
  injuryId: number | null
  injury: ExpenseInjury | null
  receiptDate: string
  costCategory: ExpenseCostCategory
  totalAmount: number
  payerType: ExpensePayerType
  description: string | null
  fileUrl: string | null
  fileName: string | null
  rejectionReason: string | null
  submittedById: number
  submittedBy: ExpenseUser
  leaderReviewerId: number | null
  leaderReviewer: ExpenseUser | null
  adminReviewerId: number | null
  adminReviewer: ExpenseUser | null
  submittedAt: string | null
  leaderReviewedAt: string | null
  adminReviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateExpenseDto {
  receiptDate: string
  costCategory: ExpenseCostCategory
  totalAmount: number
  payerType: ExpensePayerType
  injuryId?: number
  description?: string
  file?: File
}

export interface UpdateExpenseDto {
  receiptDate?: string
  costCategory?: ExpenseCostCategory
  totalAmount?: number
  payerType?: ExpensePayerType
  injuryId?: number | null
  description?: string
  file?: File
}

export const COST_CATEGORY_LABEL: Record<ExpenseCostCategory, string> = {
  OUTPATIENT: '외래',
  EXAMINATION: '검사',
  SURGERY: '수술',
  REHABILITATION: '재활',
  MEDICATION: '약제',
}

export const PAYER_TYPE_LABEL: Record<ExpensePayerType, string> = {
  CLUB: '구단',
  ASSOCIATION: '협회',
  INDIVIDUAL: '개인',
}

export const EXPENSE_STATUS_LABEL: Record<MedicalExpenseStatus, string> = {
  DRAFT: '초안',
  SUBMITTED: '상신됨',
  LEADER_APPROVED: '1차승인',
  APPROVED: '최종승인',
  REJECTED: '반려',
}

export const EXPENSE_STATUS_STYLE: Record<MedicalExpenseStatus, string> = {
  DRAFT: 'border-border text-muted-foreground',
  SUBMITTED: 'border-blue-300 text-blue-700 bg-blue-50',
  LEADER_APPROVED: 'border-indigo-300 text-indigo-700 bg-indigo-50',
  APPROVED: 'border-green-300 text-green-700 bg-green-50',
  REJECTED: 'border-red-300 text-red-700 bg-red-50',
}
```

- [ ] **Step 2: services/medical-expense.service.ts 작성**

`football/src/services/medical-expense.service.ts`:

```typescript
import { api } from './api'
import type { MedicalExpense, CreateExpenseDto, UpdateExpenseDto } from '@/types/medical-expense'

function buildForm(data: Record<string, string | number | File | null | undefined>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) form.append(key, String(value === Object(value) ? value : value))
    else if (value === null) form.append(key, '')
  }
  return form
}

function buildExpenseForm(dto: CreateExpenseDto | UpdateExpenseDto): FormData {
  const form = new FormData()
  const { file, ...rest } = dto
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== null) form.append(key, String(value))
    else if (value === null) form.append(key, '')
  }
  if (file) form.append('file', file)
  return form
}

export const medicalExpenseApi = {
  list: () => api.get<MedicalExpense[]>('/medical-expenses'),

  get: (id: number) => api.get<MedicalExpense>(`/medical-expenses/${id}`),

  create: (dto: CreateExpenseDto) =>
    api.postForm<MedicalExpense>('/medical-expenses', buildExpenseForm(dto)),

  update: (id: number, dto: UpdateExpenseDto) =>
    api.patchForm<MedicalExpense>(`/medical-expenses/${id}`, buildExpenseForm(dto)),

  submit: (id: number) => api.post<MedicalExpense>(`/medical-expenses/${id}/submit`),

  leaderApprove: (id: number) => api.post<MedicalExpense>(`/medical-expenses/${id}/leader-approve`),

  leaderReject: (id: number, reason: string) =>
    api.post<MedicalExpense>(`/medical-expenses/${id}/leader-reject`, { reason }),

  approve: (id: number) => api.post<MedicalExpense>(`/medical-expenses/${id}/approve`),

  reject: (id: number, reason: string) =>
    api.post<MedicalExpense>(`/medical-expenses/${id}/reject`, { reason }),
}
```

- [ ] **Step 3: 커밋**

```bash
git add football/src/types/medical-expense.ts football/src/services/medical-expense.service.ts
git commit -m "feat: add MedicalExpense FE types and service"
```

---

### Task 5: FE MedicalExpensesPage (목록)

**Files:**
- Create: `football/src/pages/medical-expense/MedicalExpensesPage.tsx`

- [ ] **Step 1: MedicalExpensesPage.tsx 작성**

`football/src/pages/medical-expense/MedicalExpensesPage.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { medicalExpenseApi } from '@/services/medical-expense.service'
import type { MedicalExpense } from '@/types/medical-expense'
import {
  COST_CATEGORY_LABEL,
  PAYER_TYPE_LABEL,
  EXPENSE_STATUS_LABEL,
  EXPENSE_STATUS_STYLE,
} from '@/types/medical-expense'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatAmount(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export function MedicalExpensesPage() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState<MedicalExpense[]>([])
  const [loading, setLoading] = useState(true)

  const isMedical = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'MEDICAL'

  const fetchExpenses = useCallback(() => {
    setLoading(true)
    medicalExpenseApi
      .list()
      .then(setExpenses)
      .catch(() => toast.error('의료비 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">의료비 결재</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMedical ? '내가 신청한 의료비 목록' : '전체 의료비 결재 목록'}
          </p>
        </div>
        {isMedical && (
          <Button size="sm" onClick={() => navigate('/medical-expenses/new')}>
            <Plus className="h-4 w-4 mr-1" />비용 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            등록된 의료비 내역이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>영수증 날짜</TableHead>
                <TableHead className="w-20">항목</TableHead>
                <TableHead className="w-28 text-right">금액</TableHead>
                <TableHead className="w-20">납부주체</TableHead>
                <TableHead className="w-24">상태</TableHead>
                <TableHead className="w-24 text-muted-foreground">신청자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow
                  key={e.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/medical-expenses/${e.id}`)}
                >
                  <TableCell className="tabular-nums">{formatDate(e.receiptDate)}</TableCell>
                  <TableCell>{COST_CATEGORY_LABEL[e.costCategory]}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatAmount(e.totalAmount)}
                  </TableCell>
                  <TableCell>{PAYER_TYPE_LABEL[e.payerType]}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${EXPENSE_STATUS_STYLE[e.status]}`}>
                      {EXPENSE_STATUS_LABEL[e.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.submittedBy.nickname}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add football/src/pages/medical-expense/MedicalExpensesPage.tsx
git commit -m "feat: add MedicalExpensesPage"
```

---

### Task 6: FE MedicalExpenseFormPage (작성/수정)

**Files:**
- Create: `football/src/pages/medical-expense/MedicalExpenseFormPage.tsx`

- [ ] **Step 1: MedicalExpenseFormPage.tsx 작성**

`football/src/pages/medical-expense/MedicalExpenseFormPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { medicalExpenseApi } from '@/services/medical-expense.service'
import type { ExpenseCostCategory, ExpensePayerType, MedicalExpense } from '@/types/medical-expense'
import { COST_CATEGORY_LABEL, PAYER_TYPE_LABEL } from '@/types/medical-expense'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'

const COST_CATEGORIES: ExpenseCostCategory[] = ['OUTPATIENT', 'EXAMINATION', 'SURGERY', 'REHABILITATION', 'MEDICATION']
const PAYER_TYPES: ExpensePayerType[] = ['CLUB', 'ASSOCIATION', 'INDIVIDUAL']

export function MedicalExpenseFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const [receiptDate, setReceiptDate] = useState('')
  const [costCategory, setCostCategory] = useState<ExpenseCostCategory>('OUTPATIENT')
  const [totalAmount, setTotalAmount] = useState('')
  const [payerType, setPayerType] = useState<ExpensePayerType>('CLUB')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | undefined>()

  useEffect(() => {
    if (!id) return
    medicalExpenseApi
      .get(Number(id))
      .then((e: MedicalExpense) => {
        setReceiptDate(e.receiptDate.slice(0, 10))
        setCostCategory(e.costCategory)
        setTotalAmount(String(e.totalAmount))
        setPayerType(e.payerType)
        setDescription(e.description ?? '')
      })
      .catch(() => { toast.error('불러오지 못했습니다.'); navigate('/medical-expenses') })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleSave = async (andSubmit = false) => {
    if (!receiptDate || !totalAmount) { toast.error('날짜와 금액을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto = { receiptDate, costCategory, totalAmount: Number(totalAmount), payerType, description: description || undefined, file }
      let saved: MedicalExpense
      if (isEdit && id) {
        saved = await medicalExpenseApi.update(Number(id), dto)
      } else {
        saved = await medicalExpenseApi.create(dto)
      }
      if (andSubmit) {
        await medicalExpenseApi.submit(saved.id)
        toast.success('상신됐습니다.')
      } else {
        toast.success(isEdit ? '저장됐습니다.' : '초안으로 저장됐습니다.')
      }
      navigate(`/medical-expenses/${saved.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/medical-expenses')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">
          {isEdit ? '의료비 수정' : '의료비 등록'}
        </h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg space-y-4">
          <div className="space-y-1.5">
            <Label>영수증 날짜 *</Label>
            <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>비용 항목 *</Label>
            <Select value={costCategory} onValueChange={(v) => setCostCategory(v as ExpenseCostCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COST_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{COST_CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>금액 (원) *</Label>
            <Input
              type="number"
              min={0}
              placeholder="예: 50000"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>납부 주체 *</Label>
            <Select value={payerType} onValueChange={(v) => setPayerType(v as ExpensePayerType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYER_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>{PAYER_TYPE_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>비고</Label>
            <Textarea
              placeholder="추가 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>영수증 파일 (선택)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0])} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? '저장 중...' : '임시 저장'}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              {saving ? '처리 중...' : '저장 후 상신'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add football/src/pages/medical-expense/MedicalExpenseFormPage.tsx
git commit -m "feat: add MedicalExpenseFormPage"
```

---

### Task 7: FE MedicalExpenseDetailPage (상세 + 결재)

**Files:**
- Create: `football/src/pages/medical-expense/MedicalExpenseDetailPage.tsx`

- [ ] **Step 1: MedicalExpenseDetailPage.tsx 작성**

`football/src/pages/medical-expense/MedicalExpenseDetailPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { medicalExpenseApi } from '@/services/medical-expense.service'
import type { MedicalExpense } from '@/types/medical-expense'
import {
  COST_CATEGORY_LABEL,
  PAYER_TYPE_LABEL,
  EXPENSE_STATUS_LABEL,
  EXPENSE_STATUS_STYLE,
} from '@/types/medical-expense'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ArrowLeft, Download, Check, X, Pencil } from 'lucide-react'

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatAmount(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

function RejectDialog({ open, onOpenChange, onConfirm, title }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (reason: string) => Promise<void>
  title: string
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!reason.trim()) { toast.error('반려 사유를 입력해주세요.'); return }
    setLoading(true)
    try { await onConfirm(reason.trim()) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label>반려 사유 *</Label>
          <Textarea
            placeholder="반려 사유를 입력해주세요."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>취소</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? '처리 중...' : '반려'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MedicalExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [expense, setExpense] = useState<MedicalExpense | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [acting, setActing] = useState(false)

  const isMedical = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'MEDICAL'
  const isMedicalDirector = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'MEDICAL_DIRECTOR'
  const isAdmin = user?.role === 'ADMIN'
  const isAuthor = expense?.submittedById === user?.id

  useEffect(() => {
    if (!id) return
    medicalExpenseApi
      .get(Number(id))
      .then(setExpense)
      .catch(() => { toast.error('불러오지 못했습니다.'); navigate('/medical-expenses') })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const withActing = async (fn: () => Promise<MedicalExpense>) => {
    setActing(true)
    try {
      const updated = await fn()
      setExpense(updated)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '처리에 실패했습니다.')
    } finally {
      setActing(false)
    }
  }

  const handleSubmit = () =>
    withActing(async () => {
      const r = await medicalExpenseApi.submit(expense!.id)
      toast.success('상신됐습니다.')
      return r
    })

  const handleLeaderApprove = () =>
    withActing(async () => {
      const r = await medicalExpenseApi.leaderApprove(expense!.id)
      toast.success('1차 승인됐습니다.')
      return r
    })

  const handleLeaderReject = async (reason: string) => {
    const updated = await medicalExpenseApi.leaderReject(expense!.id, reason)
    setExpense(updated)
    setRejectOpen(false)
    toast.success('1차 반려됐습니다.')
  }

  const handleApprove = () =>
    withActing(async () => {
      const r = await medicalExpenseApi.approve(expense!.id)
      toast.success('최종 승인됐습니다.')
      return r
    })

  const handleReject = async (reason: string) => {
    const updated = await medicalExpenseApi.reject(expense!.id, reason)
    setExpense(updated)
    setRejectOpen(false)
    toast.success('최종 반려됐습니다.')
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    )
  }

  if (!expense) return null

  const canEdit = isAuthor && (expense.status === 'DRAFT' || expense.status === 'REJECTED')
  const canSubmit = isAuthor && (expense.status === 'DRAFT' || expense.status === 'REJECTED')
  const canLeaderAct = isMedicalDirector && expense.status === 'SUBMITTED'
  const canAdminAct = isAdmin && expense.status === 'LEADER_APPROVED'
  const rejectTitle = canLeaderAct ? '1차 반려' : '최종 반려'
  const onReject = canLeaderAct ? handleLeaderReject : handleReject

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/medical-expenses')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">의료비 상세</h1>
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs mt-0.5 ${EXPENSE_STATUS_STYLE[expense.status]}`}>
            {EXPENSE_STATUS_LABEL[expense.status]}
          </span>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/medical-expenses/${expense.id}/edit`)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />수정
            </Button>
          )}
          {canSubmit && (
            <Button size="sm" onClick={handleSubmit} disabled={acting}>상신</Button>
          )}
          {(canLeaderAct || canAdminAct) && (
            <>
              <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => setRejectOpen(true)} disabled={acting}>
                <X className="h-3.5 w-3.5 mr-1" />반려
              </Button>
              <Button size="sm" onClick={canLeaderAct ? handleLeaderApprove : handleApprove} disabled={acting}>
                <Check className="h-3.5 w-3.5 mr-1" />{canLeaderAct ? '1차 승인' : '최종 승인'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">영수증 날짜</p>
              <p className="font-medium">{new Date(expense.receiptDate).toLocaleDateString('ko-KR')}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">비용 항목</p>
              <p className="font-medium">{COST_CATEGORY_LABEL[expense.costCategory]}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">금액</p>
              <p className="font-medium tabular-nums">{formatAmount(expense.totalAmount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">납부 주체</p>
              <p className="font-medium">{PAYER_TYPE_LABEL[expense.payerType]}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">신청자</p>
              <p>{expense.submittedBy.nickname}</p>
            </div>
            {expense.submittedAt && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">상신일</p>
                <p>{formatDateTime(expense.submittedAt)}</p>
              </div>
            )}
            {expense.leaderReviewedAt && expense.leaderReviewer && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">1차 결재일</p>
                <p>{formatDateTime(expense.leaderReviewedAt)} ({expense.leaderReviewer.nickname})</p>
              </div>
            )}
            {expense.adminReviewedAt && expense.adminReviewer && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">최종 결재일</p>
                <p>{formatDateTime(expense.adminReviewedAt)} ({expense.adminReviewer.nickname})</p>
              </div>
            )}
          </div>

          {expense.rejectionReason && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium mb-0.5">반려 사유</p>
              <p className="whitespace-pre-wrap">{expense.rejectionReason}</p>
            </div>
          )}

          {expense.description && (
            <div>
              <p className="text-muted-foreground text-xs mb-1.5">비고</p>
              <div className="rounded border p-4 text-sm whitespace-pre-wrap">{expense.description}</div>
            </div>
          )}

          {expense.fileUrl && (
            <div>
              <p className="text-muted-foreground text-xs mb-1.5">첨부 파일</p>
              <a
                href={expense.fileUrl}
                download={expense.fileName ?? true}
                className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                {expense.fileName ?? '첨부 파일'}
              </a>
            </div>
          )}
        </div>
      </div>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={onReject}
        title={rejectTitle}
      />
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add football/src/pages/medical-expense/MedicalExpenseDetailPage.tsx
git commit -m "feat: add MedicalExpenseDetailPage"
```

---

### Task 8: AppShell nav + App.tsx 라우트

**Files:**
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/App.tsx`

**참고:** Task 9에서 InjuryStatsPage에 Sheet 통합 추가 (명세서 §315: "통계 데이터를 백그라운드에 띄워둔 채로 초안을 보며 수정")

- [ ] **Step 1: AppShell.tsx에 nav 항목 추가**

`football/src/layouts/AppShell.tsx`의 부상·의료 섹션 끝(부상 통계 항목 아래)에 추가:

```typescript
  {
    to: '/medical-expenses',
    label: '의료비 결재',
    icon: Receipt,
    section: '부상·의료',
    roles: ['ADMIN', 'COACHING_STAFF'],
    coachingRoles: ['MEDICAL', 'MEDICAL_DIRECTOR'],
  },
```

같은 파일 상단 import에 `Receipt` 추가 (lucide-react 기존 import에 추가):

```typescript
import { ..., Receipt } from 'lucide-react'
```

- [ ] **Step 2: App.tsx에 라우트 3개 추가**

`football/src/App.tsx` import 블록에 추가:

```typescript
import { MedicalExpensesPage } from '@/pages/medical-expense/MedicalExpensesPage'
import { MedicalExpenseFormPage } from '@/pages/medical-expense/MedicalExpenseFormPage'
import { MedicalExpenseDetailPage } from '@/pages/medical-expense/MedicalExpenseDetailPage'
```

Route 블록(기존 `/reports` 라우트 아래)에 추가:

```tsx
<Route path="/medical-expenses" element={<MedicalExpensesPage />} />
<Route path="/medical-expenses/new" element={<MedicalExpenseFormPage />} />
<Route path="/medical-expenses/:id/edit" element={<MedicalExpenseFormPage />} />
<Route path="/medical-expenses/:id" element={<MedicalExpenseDetailPage />} />
```

- [ ] **Step 3: TS 타입 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 오류 없음.

- [ ] **Step 4: 커밋**

```bash
git add football/src/layouts/AppShell.tsx football/src/App.tsx
git commit -m "feat: add medical-expense nav and routes"
```

---

### Task 9: InjuryStatsPage — 의료비 등록 Sheet 통합

**명세서 근거:** "통계 데이터를 백그라운드에 띄워둔 채로 초안을 보며 수정할 수 있도록 처리" (사이드 Drawer 패턴)

**Files:**
- Modify: `football/src/pages/injuries/InjuryStatsPage.tsx`

- [ ] **Step 1: InjuryStatsPage에 Sheet 기반 의료비 등록 폼 추가**

`football/src/pages/injuries/InjuryStatsPage.tsx`를 다음과 같이 수정:

import 블록에 추가:
```tsx
import { useState } from 'react'  // 기존 import에 useState 추가 (이미 있으면 스킵)
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { medicalExpenseApi } from '@/services/medical-expense.service'
import type { ExpenseCostCategory, ExpensePayerType } from '@/types/medical-expense'
import { COST_CATEGORY_LABEL, PAYER_TYPE_LABEL } from '@/types/medical-expense'
import { Plus } from 'lucide-react'
```

`InjuryStatsPage` 컴포넌트 내부에 상태 및 핸들러 추가 (기존 `stats`, `loading`, `error` 아래):
```tsx
  const { user } = useCurrentUser()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [receiptDate, setReceiptDate] = useState('')
  const [costCategory, setCostCategory] = useState<ExpenseCostCategory>('OUTPATIENT')
  const [totalAmount, setTotalAmount] = useState('')
  const [payerType, setPayerType] = useState<ExpensePayerType>('CLUB')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | undefined>()

  const isMedical = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'MEDICAL'

  const resetForm = () => {
    setReceiptDate(''); setCostCategory('OUTPATIENT'); setTotalAmount('')
    setPayerType('CLUB'); setDescription(''); setFile(undefined)
  }

  const handleSave = async (andSubmit: boolean) => {
    if (!receiptDate || !totalAmount) { toast.error('날짜와 금액을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto = { receiptDate, costCategory, totalAmount: Number(totalAmount), payerType, description: description || undefined, file }
      const saved = await medicalExpenseApi.create(dto)
      if (andSubmit) {
        await medicalExpenseApi.submit(saved.id)
        toast.success('의료비가 상신됐습니다.')
      } else {
        toast.success('의료비 초안이 저장됐습니다.')
      }
      setSheetOpen(false)
      resetForm()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }
```

페이지 헤더 부분(현재 `<div className="border-b ...">` 없음)을 추가하거나, 기존 최상위 `return` 안 맨 위에 헤더 + Sheet 추가:

현재 `return (` 직후의 `<div>` 태그 앞에 다음으로 교체:
```tsx
  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">부상 통계</h1>
          <p className="text-sm text-muted-foreground mt-0.5">부상 현황 집계 및 분석</p>
        </div>
        {isMedical && (
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />의료비 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
```

기존 페이지 콘텐츠(통계 카드, 차트 등)를 `<div className="flex-1 overflow-auto p-6 space-y-6">` 안으로 이동.

기존 최상위 닫는 `</div>` 직전에 Sheet 추가:
```tsx
      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) resetForm() }}>
        <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>의료비 등록</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>영수증 날짜 *</Label>
              <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>비용 항목 *</Label>
              <Select value={costCategory} onValueChange={(v) => setCostCategory(v as ExpenseCostCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['OUTPATIENT','EXAMINATION','SURGERY','REHABILITATION','MEDICATION'] as ExpenseCostCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>{COST_CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>금액 (원) *</Label>
              <Input type="number" min={0} placeholder="예: 50000" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>납부 주체 *</Label>
              <Select value={payerType} onValueChange={(v) => setPayerType(v as ExpensePayerType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['CLUB','ASSOCIATION','INDIVIDUAL'] as ExpensePayerType[]).map((p) => (
                    <SelectItem key={p} value={p}>{PAYER_TYPE_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>비고</Label>
              <Textarea placeholder="추가 설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>영수증 파일 (선택)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0])} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? '저장 중...' : '임시 저장'}
              </Button>
              <Button className="flex-1" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? '처리 중...' : '상신'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
```

- [ ] **Step 2: TS 타입 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 오류 없음.

- [ ] **Step 3: 커밋**

```bash
git add football/src/pages/injuries/InjuryStatsPage.tsx
git commit -m "feat: add medical expense quick-create Sheet to InjuryStatsPage"
```
