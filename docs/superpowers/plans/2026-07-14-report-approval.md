# Director(GM) 보고서 결재 모듈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin/HEAD_COACH가 재무·성과 보고서를 작성하고 GM(Director)이 승인·반려하는 3단계 결재 워크플로우를 구현한다.

**Architecture:** 단일 `Report` 테이블에 `type(FINANCIAL|PERFORMANCE)` + `status(DRAFT|SUBMITTED|APPROVED|REJECTED)` 필드로 상태를 관리. GM 권한 검증은 `requireGM` 미들웨어(`role=FRONT_OFFICE && frontOfficeRole=GM`)로 처리. 파일 업로드는 multer + 로컬 저장, 제출 시 WebSocket으로 GM에게 알림.

**Tech Stack:** Express 5, Prisma 7, multer, socket.io, React, shadcn/ui, TypeScript

---

## File Map

**Backend (apps/api/src/report/):**
- Create: `report.repo.ts` — Prisma CRUD
- Create: `report.service.ts` — 상태 전이 + 알림
- Create: `report.controller.ts` — HTTP 핸들러 + 권한 체크
- Create: `report.routes.ts` — Router + multer + requireGM

**Prisma:**
- Modify: `prisma/schema.prisma` — Report model + 2 enum 추가
- Create: `prisma/migrations/20260714000002_add_report/migration.sql`

**Register:**
- Modify: `src/apiRouter.ts` — reportRouter 등록
- Modify: `src/server.ts` — /uploads static 서빙

**Notification:**
- Modify: `src/notification/notification.repo.ts` — `createForGM()` 추가

**Frontend:**
- Create: `football/src/types/report.ts`
- Create: `football/src/services/report.service.ts`
- Create: `football/src/hooks/useReportNotification.ts`
- Create: `football/src/pages/reports/ReportsPage.tsx`
- Create: `football/src/pages/reports/ReportFormPage.tsx`
- Create: `football/src/pages/reports/ReportDetailPage.tsx`
- Modify: `football/src/App.tsx` — 3개 라우트 추가
- Modify: `football/src/layouts/AppShell.tsx` — nav item + hook 연결

---

## Task 1: Prisma 스키마 + 마이그레이션 + multer 설치

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260714000002_add_report/migration.sql`

- [x] **Step 1: schema.prisma에 Report 모델 + enum 추가**

`apps/api/prisma/schema.prisma` 맨 끝(AuditLog 모델 아래)에 추가:

```prisma
enum ReportType {
  FINANCIAL
  PERFORMANCE
}

enum ReportStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
}

model Report {
  id              Int          @id @default(autoincrement())
  type            ReportType
  status          ReportStatus @default(DRAFT)
  title           String
  content         String       @db.Text
  fileUrl         String?
  fileName        String?
  rejectionReason String?

  authorId    Int
  author      User  @relation("ReportAuthor", fields: [authorId], references: [id])
  reviewerId  Int?
  reviewer    User? @relation("ReportReviewer", fields: [reviewerId], references: [id])

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  submittedAt DateTime?
  reviewedAt  DateTime?
}
```

그리고 `model User { ... }` 블록 안에 relation 필드 추가(AuditLog 아래):
```prisma
  authoredReports  Report[] @relation("ReportAuthor")
  reviewedReports  Report[] @relation("ReportReviewer")
  auditLogs        AuditLog[]
```

- [x] **Step 2: 마이그레이션 파일 생성**

`apps/api/prisma/migrations/20260714000002_add_report/migration.sql` 생성:

```sql
CREATE TYPE "ReportType" AS ENUM ('FINANCIAL', 'PERFORMANCE');
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE "Report" (
  "id"              SERIAL PRIMARY KEY,
  "type"            "ReportType" NOT NULL,
  "status"          "ReportStatus" NOT NULL DEFAULT 'DRAFT',
  "title"           TEXT NOT NULL,
  "content"         TEXT NOT NULL,
  "fileUrl"         TEXT,
  "fileName"        TEXT,
  "rejectionReason" TEXT,
  "authorId"        INTEGER NOT NULL REFERENCES "User"("id"),
  "reviewerId"      INTEGER REFERENCES "User"("id"),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt"     TIMESTAMP(3),
  "reviewedAt"      TIMESTAMP(3)
);
```

- [x] **Step 3: 마이그레이션 적용**

```bash
cd apps/api
npx prisma migrate resolve --applied 20260714000002_add_report
npx prisma db execute --file prisma/migrations/20260714000002_add_report/migration.sql --schema prisma/schema.prisma
npx prisma generate
```

성공 시 `✔ Generated Prisma Client` 출력.

- [x] **Step 4: multer 설치**

```bash
cd apps/api
npm install multer
npm install -D @types/multer
```

- [x] **Step 5: uploads 디렉토리 생성**

```bash
mkdir -p apps/api/uploads/reports
```

- [x] **Step 6: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260714000002_add_report/
git commit -m "feat: add Report schema and migration"
```

---

## Task 2: notification.repo.ts — createForGM 추가

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`

- [x] **Step 1: createForGM 메서드 추가**

`findExpiringContracts` 메서드 바로 위에 삽입:

```typescript
createForGM(type: string, title: string, body: string) {
  return this.prisma.$transaction(async (tx) => {
    const gmUsers = await tx.user.findMany({
      where: { role: "FRONT_OFFICE", frontOfficeRole: "GM" },
      select: { id: true },
    });
    if (gmUsers.length === 0) return;
    await tx.notification.createMany({
      data: gmUsers.map((u) => ({ userId: u.id, type, title, body })) as any,
    });
  });
}
```

- [x] **Step 2: 커밋**

```bash
git add apps/api/src/notification/notification.repo.ts
git commit -m "feat: add createForGM notification method"
```

---

## Task 3: BE — report 모듈 (repo, service, controller, routes)

**Files:**
- Create: `apps/api/src/report/report.repo.ts`
- Create: `apps/api/src/report/report.service.ts`
- Create: `apps/api/src/report/report.controller.ts`
- Create: `apps/api/src/report/report.routes.ts`

- [x] **Step 1: report.repo.ts 생성**

```typescript
import { PrismaClient, ReportType, ReportStatus } from "../generated/client";

const AUTHOR_SELECT = { id: true, nickname: true };

export class ReportRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(userId: number, isGM: boolean) {
    return this.prisma.report.findMany({
      where: isGM ? undefined : { authorId: userId },
      include: { author: { select: AUTHOR_SELECT }, reviewer: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.report.findUnique({
      where: { id },
      include: { author: { select: AUTHOR_SELECT }, reviewer: { select: AUTHOR_SELECT } },
    });
  }

  create(data: { type: ReportType; title: string; content: string; authorId: number }) {
    return this.prisma.report.create({ data, include: { author: { select: AUTHOR_SELECT }, reviewer: { select: AUTHOR_SELECT } } });
  }

  update(id: number, data: { title: string; content: string; fileUrl?: string | null; fileName?: string | null }) {
    return this.prisma.report.update({ where: { id }, data: { ...data, updatedAt: new Date() }, include: { author: { select: AUTHOR_SELECT }, reviewer: { select: AUTHOR_SELECT } } });
  }

  submit(id: number) {
    return this.prisma.report.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date(), rejectionReason: null },
      include: { author: { select: AUTHOR_SELECT }, reviewer: { select: AUTHOR_SELECT } },
    });
  }

  approve(id: number, reviewerId: number) {
    return this.prisma.report.update({
      where: { id },
      data: { status: "APPROVED", reviewerId, reviewedAt: new Date() },
      include: { author: { select: AUTHOR_SELECT }, reviewer: { select: AUTHOR_SELECT } },
    });
  }

  reject(id: number, reviewerId: number, reason: string) {
    return this.prisma.report.update({
      where: { id },
      data: { status: "REJECTED", reviewerId, reviewedAt: new Date(), rejectionReason: reason },
      include: { author: { select: AUTHOR_SELECT }, reviewer: { select: AUTHOR_SELECT } },
    });
  }
}
```

- [x] **Step 2: report.service.ts 생성**

```typescript
import { AppError } from "../lib/appError";
import { getIO } from "../lib/io";
import { writeAuditLog } from "../lib/auditLog";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";
import { ReportRepository } from "./report.repo";

export class ReportService {
  private notifRepo = new NotificationRepository(getPrisma());

  constructor(private repo: ReportRepository) {}

  list(userId: number, isGM: boolean) {
    return this.repo.findAll(userId, isGM);
  }

  async get(id: number, userId: number, isGM: boolean) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (!isGM && report.authorId !== userId) throw new AppError(403, "FORBIDDEN");
    return report;
  }

  create(type: string, title: string, content: string, authorId: number) {
    return this.repo.create({ type: type as any, title, content, authorId });
  }

  async update(id: number, userId: number, data: { title: string; content: string; fileUrl?: string | null; fileName?: string | null }) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (report.authorId !== userId) throw new AppError(403, "FORBIDDEN");
    if (report.status === "APPROVED" || report.status === "SUBMITTED") throw new AppError(403, "CANNOT_MODIFY");
    return this.repo.update(id, data);
  }

  async submit(id: number, userId: number) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (report.authorId !== userId) throw new AppError(403, "FORBIDDEN");
    if (report.status === "APPROVED" || report.status === "SUBMITTED") throw new AppError(403, "CANNOT_SUBMIT");
    const updated = await this.repo.submit(id);
    const typeLabel = updated.type === "FINANCIAL" ? "재무/자산" : "성과";
    const title = "보고서 결재 요청";
    const body = `${updated.author.nickname}님이 [${typeLabel}] "${updated.title}" 보고서를 제출했습니다.`;
    await this.notifRepo.createForGM("REPORT_SUBMITTED", title, body);
    getIO().to("staff-room").emit("notification:report-submitted", { type: "REPORT_SUBMITTED", title, body, createdAt: new Date().toISOString() });
    return updated;
  }

  async approve(id: number, reviewerId: number) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (report.status !== "SUBMITTED") throw new AppError(403, "NOT_SUBMITTED");
    if (report.authorId === reviewerId) throw new AppError(403, "CANNOT_SELF_APPROVE");
    const updated = await this.repo.approve(id, reviewerId);
    await writeAuditLog({ actorId: reviewerId, action: "REPORT_APPROVED", targetId: id, detail: { title: report.title } });
    return updated;
  }

  async reject(id: number, reviewerId: number, reason: string) {
    if (!reason?.trim()) throw new AppError(400, "REASON_REQUIRED");
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (report.status !== "SUBMITTED") throw new AppError(403, "NOT_SUBMITTED");
    if (report.authorId === reviewerId) throw new AppError(403, "CANNOT_SELF_REJECT");
    const updated = await this.repo.reject(id, reviewerId, reason.trim());
    await writeAuditLog({ actorId: reviewerId, action: "REPORT_REJECTED", targetId: id, detail: { title: report.title, reason: reason.trim() } });
    return updated;
  }
}
```

- [x] **Step 3: report.controller.ts 생성**

```typescript
import { Request, Response, NextFunction } from "express";
import { ReportService } from "./report.service";

export class ReportController {
  constructor(private service: ReportService) {}

  private isGM(req: Request) {
    return req.user!.role === "FRONT_OFFICE" && req.user!.frontOfficeRole === "GM";
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.user!.id, this.isGM(req)));
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get(Number(req.params["id"]), req.user!.id, this.isGM(req)));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, title, content } = req.body;
      res.status(201).json(await this.service.create(type, title, content, req.user!.id));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, content, fileUrl, fileName } = req.body;
      res.json(await this.service.update(Number(req.params["id"]), req.user!.id, { title, content, fileUrl, fileName }));
    } catch (err) { next(err); }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.submit(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.approve(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.reject(Number(req.params["id"]), req.user!.id, req.body.reason));
    } catch (err) { next(err); }
  };

  upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ code: "NO_FILE" }); return; }
      res.json({ fileUrl: `/uploads/reports/${req.file.filename}`, fileName: req.file.originalname });
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 4: report.routes.ts 생성**

```typescript
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import passport from "passport";
import { getPrisma } from "../lib/prisma";
import { ReportRepository } from "./report.repo";
import { ReportService } from "./report.service";
import { ReportController } from "./report.controller";

const router = Router();
const repo = new ReportRepository(getPrisma());
const service = new ReportService(repo);
const controller = new ReportController(service);

const auth = passport.authenticate("accessToken", { session: false });

const upload = multer({
  dest: path.join(process.cwd(), "uploads/reports"),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const requireGM = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role === "FRONT_OFFICE" && req.user?.frontOfficeRole === "GM") return next();
  res.status(403).json({ code: "FORBIDDEN" });
};

const requireAuthor = (req: Request, res: Response, next: NextFunction) => {
  const { role, coachingRole } = req.user!;
  const allowed =
    role === "ADMIN" ||
    (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");
  if (!allowed) { res.status(403).json({ code: "FORBIDDEN" }); return; }
  next();
};

router.get("/", auth, controller.list);
router.post("/", auth, requireAuthor, controller.create);
router.post("/upload", auth, requireAuthor, upload.single("file"), controller.upload);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, requireAuthor, controller.update);
router.post("/:id/submit", auth, requireAuthor, controller.submit);
router.post("/:id/approve", auth, requireGM, controller.approve);
router.post("/:id/reject", auth, requireGM, controller.reject);

export default router;
```

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/report/
git commit -m "feat: add report module (repo, service, controller, routes)"
```

---

## Task 4: apiRouter + static 서빙 등록

**Files:**
- Modify: `apps/api/src/apiRouter.ts`
- Modify: `apps/api/src/server.ts`

- [x] **Step 1: apiRouter.ts에 reportRouter 추가**

`import notificationRouter` 아래에 추가:
```typescript
import reportRouter from "./report/report.routes";
```

`apiRouter.use("/notifications", notificationRouter);` 아래에 추가:
```typescript
apiRouter.use("/reports", reportRouter);
```

- [x] **Step 2: server.ts에 static 파일 서빙 추가**

`app.use("/api", apiRouter);` 위에 추가:
```typescript
import path from "path";
// ...
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
```

(파일 상단 imports에 `import path from "path";` 추가)

- [x] **Step 3: 서버 재시작 후 확인**

```bash
cd apps/api && npm run dev
# 다른 터미널에서:
curl -s http://localhost:3001/api/reports -H "Cookie: <valid-cookie>" | head -20
# 401 or [] 응답이면 정상 등록
```

- [x] **Step 4: 커밋**

```bash
git add apps/api/src/apiRouter.ts apps/api/src/server.ts
git commit -m "feat: register report router and static file serving"
```

---

## Task 5: FE — types/report.ts + services/report.service.ts

**Files:**
- Create: `football/src/types/report.ts`
- Create: `football/src/services/report.service.ts`

- [x] **Step 1: types/report.ts 생성**

```typescript
export type ReportType = 'FINANCIAL' | 'PERFORMANCE'
export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

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
  author: { id: number; nickname: string }
  reviewerId: number | null
  reviewer: { id: number; nickname: string } | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  reviewedAt: string | null
}

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  FINANCIAL: '재무/자산',
  PERFORMANCE: '성과',
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  DRAFT: '임시저장',
  SUBMITTED: '승인 대기',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
}

export const REPORT_STATUS_STYLE: Record<ReportStatus, string> = {
  DRAFT: 'text-muted-foreground border-border',
  SUBMITTED: 'text-blue-700 bg-blue-50 border-blue-200',
  APPROVED: 'text-green-700 bg-green-50 border-green-200',
  REJECTED: 'text-red-700 bg-red-50 border-red-200',
}
```

- [x] **Step 2: services/report.service.ts 생성**

`api.ts`는 `Content-Type: application/json`을 고정 사용하므로 파일 업로드는 별도 fetch로 처리한다.

```typescript
import { api } from './api'
import type { Report } from '@/types/report'

async function uploadFile(file: File): Promise<{ fileUrl: string; fileName: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/reports/upload', {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  if (!res.ok) throw new Error('파일 업로드에 실패했습니다.')
  return res.json()
}

export const reportApi = {
  list: () => api.get<Report[]>('/reports'),
  get: (id: number) => api.get<Report>(`/reports/${id}`),
  create: (payload: { type: string; title: string; content: string }) =>
    api.post<Report>('/reports', payload),
  update: (id: number, payload: { title: string; content: string; fileUrl?: string | null; fileName?: string | null }) =>
    api.patch<Report>(`/reports/${id}`, payload),
  submit: (id: number) => api.post<Report>(`/reports/${id}/submit`, {}),
  approve: (id: number) => api.post<Report>(`/reports/${id}/approve`, {}),
  reject: (id: number, reason: string) =>
    api.post<Report>(`/reports/${id}/reject`, { reason }),
  uploadFile,
}
```

- [x] **Step 3: 타입 체크**

```bash
cd football && npx tsc --noEmit
```

에러 없어야 함.

- [x] **Step 4: 커밋**

```bash
git add football/src/types/report.ts football/src/services/report.service.ts
git commit -m "feat: add report types and API service"
```

---

## Task 6: FE — hooks/useReportNotification.ts

**Files:**
- Create: `football/src/hooks/useReportNotification.ts`

- [x] **Step 1: useReportNotification.ts 생성**

```typescript
import { useEffect } from 'react'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'

interface ReportSubmittedEvent {
  type: string
  title: string
  body: string
  createdAt: string
}

export function useReportNotification(onNew: () => void, isGM: boolean) {
  useEffect(() => {
    if (!isGM) return
    const socket = getSocket()
    socket.on('notification:report-submitted', (data: ReportSubmittedEvent) => {
      toast.info(data.title, { description: data.body })
      onNew()
    })
    return () => {
      socket.off('notification:report-submitted')
    }
  }, [onNew, isGM])
}
```

- [x] **Step 2: AppShell.tsx에 hook 연결**

`AppShell.tsx`에서:

import 추가 (`usePartnerNotification` import 아래):
```typescript
import { useReportNotification } from '@/hooks/useReportNotification'
```

`usePartnerNotification(user?.role)` 아래에 추가:
```typescript
const isGM = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'GM'
useReportNotification(refreshUnread, isGM)
```

- [x] **Step 3: 커밋**

```bash
git add football/src/hooks/useReportNotification.ts football/src/layouts/AppShell.tsx
git commit -m "feat: add report submission WebSocket notification hook"
```

---

## Task 7: FE — ReportsPage.tsx

**Files:**
- Create: `football/src/pages/reports/ReportsPage.tsx`

- [x] **Step 1: ReportsPage.tsx 생성**

```typescript
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reportApi } from '@/services/report.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Report, ReportStatus } from '@/types/report'
import { REPORT_TYPE_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_STYLE } from '@/types/report'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus } from 'lucide-react'

const TABS: { key: ReportStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'SUBMITTED', label: '승인 대기' },
  { key: 'APPROVED', label: '승인됨' },
  { key: 'REJECTED', label: '반려됨' },
  { key: 'DRAFT', label: '임시저장' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

export function ReportsPage() {
  const { user } = useCurrentUser()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ReportStatus | 'ALL'>('ALL')

  const isGM = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'GM'
  const canWrite =
    user?.role === 'ADMIN' ||
    (user?.role === 'COACHING_STAFF' && user?.coachingRole === 'HEAD_COACH')

  useEffect(() => {
    reportApi.list()
      .then(setReports)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  const filtered = tab === 'ALL' ? reports : reports.filter((r) => r.status === tab)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">보고서</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isGM ? '전체 보고서 결재 관리' : '내 보고서'}
          </p>
        </div>
        {canWrite && (
          <Button size="sm" asChild>
            <Link to="/reports/new"><Plus className="h-4 w-4 mr-1.5" />보고서 작성</Link>
          </Button>
        )}
      </div>

      {/* 탭 */}
      <div className="border-b px-6 flex gap-1 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {t.key === 'ALL' ? reports.length : reports.filter((r) => r.status === t.key).length}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">보고서가 없습니다.</div>
        ) : (
          <div className="divide-y">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to={`/reports/${r.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-accent/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">
                      {REPORT_TYPE_LABEL[r.type]}
                    </span>
                    <span className={`text-xs border rounded px-1.5 py-0.5 ${REPORT_STATUS_STYLE[r.status]}`}>
                      {REPORT_STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.author.nickname} · {formatDate(r.createdAt)}
                  </p>
                </div>
                {r.submittedAt && (
                  <p className="text-xs text-muted-foreground shrink-0">제출 {formatDate(r.submittedAt)}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [x] **Step 2: 타입 체크**

```bash
cd football && npx tsc --noEmit
```

- [x] **Step 3: 커밋**

```bash
git add football/src/pages/reports/ReportsPage.tsx
git commit -m "feat: add ReportsPage with tabs and list"
```

---

## Task 8: FE — ReportFormPage.tsx

**Files:**
- Create: `football/src/pages/reports/ReportFormPage.tsx`

- [x] **Step 1: ReportFormPage.tsx 생성**

```typescript
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { reportApi } from '@/services/report.service'
import type { ReportType } from '@/types/report'
import { REPORT_TYPE_LABEL } from '@/types/report'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Paperclip, X } from 'lucide-react'

const TYPES: ReportType[] = ['FINANCIAL', 'PERFORMANCE']

export function ReportFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)

  const [type, setType] = useState<ReportType>('FINANCIAL')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(isEdit)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    reportApi.get(Number(id)).then((r) => {
      setType(r.type)
      setTitle(r.title)
      setContent(r.content)
      setFileUrl(r.fileUrl)
      setFileName(r.fileName)
      setLoadingEdit(false)
    }).catch(() => { toast.error('보고서를 불러오지 못했습니다.'); navigate('/reports') })
  }, [id, navigate])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await reportApi.uploadFile(file)
      setFileUrl(result.fileUrl)
      setFileName(result.fileName)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '파일 업로드 실패')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async (submit: boolean) => {
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return }
    if (!content.trim()) { toast.error('내용을 입력해주세요.'); return }
    setSaving(true)
    try {
      let report
      if (isEdit && id) {
        report = await reportApi.update(Number(id), { title: title.trim(), content: content.trim(), fileUrl, fileName })
      } else {
        report = await reportApi.create({ type, title: title.trim(), content: content.trim() })
        if (fileUrl) await reportApi.update(report.id, { title: title.trim(), content: content.trim(), fileUrl, fileName })
      }
      if (submit) {
        await reportApi.submit(report.id)
        toast.success('보고서가 제출됐습니다.')
      } else {
        toast.success('임시저장됐습니다.')
      }
      navigate(`/reports/${report.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingEdit) return (
    <div className="p-6 space-y-4 max-w-2xl">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">
          {isEdit ? '보고서 수정' : '보고서 작성'}
        </h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-5">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>보고서 유형 *</Label>
              <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{REPORT_TYPE_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>제목 *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="보고서 제목" />
          </div>

          <div className="space-y-1.5">
            <Label>내용 *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="보고서 내용을 입력하세요."
              className="min-h-48 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>첨부 파일</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                {uploading ? '업로드 중...' : '파일 첨부'}
              </Button>
              {fileName && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="truncate max-w-xs">{fileName}</span>
                  <button
                    type="button"
                    onClick={() => { setFileUrl(null); setFileName(null) }}
                    className="hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => save(false)} disabled={saving || uploading}>
              임시저장
            </Button>
            <Button onClick={() => save(true)} disabled={saving || uploading}>
              {saving ? '처리 중...' : '제출'}
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)} disabled={saving}>취소</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [x] **Step 2: 타입 체크**

```bash
cd football && npx tsc --noEmit
```

- [x] **Step 3: 커밋**

```bash
git add football/src/pages/reports/ReportFormPage.tsx
git commit -m "feat: add ReportFormPage (create/edit with file upload)"
```

---

## Task 9: FE — ReportDetailPage.tsx

**Files:**
- Create: `football/src/pages/reports/ReportDetailPage.tsx`

- [x] **Step 1: ReportDetailPage.tsx 생성**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { reportApi } from '@/services/report.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useConfirm } from '@/lib/confirm-dialog'
import type { Report } from '@/types/report'
import { REPORT_TYPE_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_STYLE } from '@/types/report'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Paperclip } from 'lucide-react'

function formatDate(d: string) {
  return new Date(d).toLocaleString('ko-KR')
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const confirm = useConfirm()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)

  const isGM = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'GM'
  const isAuthor = report?.authorId === user?.id

  const load = () => {
    reportApi.get(Number(id))
      .then(setReport)
      .catch(() => { toast.error('보고서를 찾을 수 없습니다.'); navigate('/reports') })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleSubmit = async () => {
    if (!report) return
    const ok = await confirm({ title: '제출', description: '이 보고서를 결재 요청하시겠습니까?', confirmText: '제출' })
    if (!ok) return
    setActing(true)
    try {
      await reportApi.submit(report.id)
      toast.success('보고서가 제출됐습니다.')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '제출에 실패했습니다.')
    } finally { setActing(false) }
  }

  const handleApprove = async () => {
    if (!report) return
    const ok = await confirm({ title: '승인', description: '이 보고서를 승인하시겠습니까?', confirmText: '승인' })
    if (!ok) return
    setActing(true)
    try {
      await reportApi.approve(report.id)
      toast.success('승인됐습니다.')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '승인에 실패했습니다.')
    } finally { setActing(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('반려 사유를 입력해주세요.'); return }
    setActing(true)
    try {
      await reportApi.reject(report!.id, rejectReason.trim())
      toast.success('반려됐습니다.')
      setRejectOpen(false)
      setRejectReason('')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '반려에 실패했습니다.')
    } finally { setActing(false) }
  }

  if (loading) return (
    <div className="p-6 space-y-4 max-w-2xl">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  )
  if (!report) return null

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs border rounded px-1.5 py-0.5 text-muted-foreground">
              {REPORT_TYPE_LABEL[report.type]}
            </span>
            <span className={`text-xs border rounded px-1.5 py-0.5 ${REPORT_STATUS_STYLE[report.status]}`}>
              {REPORT_STATUS_LABEL[report.status]}
            </span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">{report.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.author.nickname} · {formatDate(report.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 작성자 액션 */}
          {isAuthor && (report.status === 'DRAFT' || report.status === 'REJECTED') && (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/reports/${report.id}/edit`}>수정</Link>
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={acting}>제출</Button>
            </>
          )}
          {/* GM 액션 */}
          {isGM && report.status === 'SUBMITTED' && (
            <>
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={acting}>
                반려
              </Button>
              <Button size="sm" onClick={handleApprove} disabled={acting}>승인</Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* 반려 사유 */}
          {report.status === 'REJECTED' && report.rejectionReason && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700 mb-1">반려 사유</p>
              <p className="text-sm text-red-600">{report.rejectionReason}</p>
              {report.reviewer && (
                <p className="text-xs text-red-400 mt-1">
                  {report.reviewer.nickname} · {report.reviewedAt ? formatDate(report.reviewedAt) : ''}
                </p>
              )}
            </div>
          )}

          {/* 승인 정보 */}
          {report.status === 'APPROVED' && report.reviewer && (
            <div className="rounded-md border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-700">
                승인됨 — {report.reviewer.nickname}
                {report.reviewedAt && ` · ${formatDate(report.reviewedAt)}`}
              </p>
            </div>
          )}

          {/* 본문 */}
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{report.content}</pre>
          </div>

          {/* 첨부 파일 */}
          {report.fileUrl && report.fileName && (
            <div className="border-t pt-4">
              <a
                href={report.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {report.fileName}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 반려 다이얼로그 */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>반려 사유 입력</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>사유 *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력해주세요."
              className="min-h-24 resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={acting}>취소</Button>
            <Button variant="destructive" onClick={handleReject} disabled={acting}>
              {acting ? '처리 중...' : '반려'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [x] **Step 2: 타입 체크**

```bash
cd football && npx tsc --noEmit
```

- [x] **Step 3: 커밋**

```bash
git add football/src/pages/reports/ReportDetailPage.tsx
git commit -m "feat: add ReportDetailPage with approve/reject actions"
```

---

## Task 10: FE — App.tsx + AppShell.tsx nav 추가

**Files:**
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [x] **Step 1: App.tsx에 라우트 추가**

기존 import 블록에 추가:
```typescript
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { ReportFormPage } from '@/pages/reports/ReportFormPage'
import { ReportDetailPage } from '@/pages/reports/ReportDetailPage'
```

`<Route path="/admin/users" .../>` 앞에 추가:
```typescript
<Route path="/reports" element={<ReportsPage />} />
<Route path="/reports/new" element={<ReportFormPage />} />
<Route path="/reports/:id/edit" element={<ReportFormPage />} />
<Route path="/reports/:id" element={<ReportDetailPage />} />
```

- [x] **Step 2: AppShell.tsx NAV_ITEMS에 보고서 추가**

`관리` 섹션의 마지막 항목(`/admin/users`) 바로 앞에 추가:

```typescript
{
  to: '/reports',
  label: '보고서',
  icon: FileText,
  section: '관리',
  roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'],
  frontOfficeRoles: ['GM'],
  coachingRoles: ['HEAD_COACH'],
},
```

`FileText`는 이미 import됨.

- [x] **Step 3: 타입 체크 + 빌드 확인**

```bash
cd football && npx tsc --noEmit
```

- [x] **Step 4: 커밋**

```bash
git add football/src/App.tsx football/src/layouts/AppShell.tsx
git commit -m "feat: register report routes and nav item"
```
