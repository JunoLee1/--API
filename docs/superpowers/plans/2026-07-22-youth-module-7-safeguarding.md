# 유소년 모듈 Plan 7: 유소년 보호 (Safeguarding) 프로토콜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유소년 학대·가혹 행위 의심 신고를 익명으로 접수하고, 피의자 접근 차단 → 긴급 알림 → 외부 기관 보고서 자동 생성까지 즉시 수행하는 비상 대응 시스템을 구현한다.

**Architecture:** `SafeguardReport` 단일 엔티티(RECEIVED→UNDER_REVIEW→RESOLVED). 제보자 신원은 저장하지 않음(optional `contactInfo`만). 제출 즉시 서비스 레이어가 ① 피의자 계정 정지(`User.isSuspended`) ② GM·TD·의무 긴급 알림 ③ ExternalReport(경찰서·아동보호·협회) 자동 생성 세 가지를 fire-and-forget으로 병렬 처리한다. FE는 앱 셸 레이아웃에 고정된 빨간 익명 버튼과 관리자 전용 목록 페이지를 제공한다.

**Tech Stack:** Prisma migration, Express BE (Jest TDD), React FE

**의존성:** Plan 1 완료 (ExternalReport, NotificationRepository 패턴)

---

## 파일 맵

### BE — 신규
- `apps/api/src/safeguard/dto/safeguard.dto.ts`
- `apps/api/src/safeguard/safeguard.repo.ts`
- `apps/api/src/safeguard/safeguard.service.ts`
- `apps/api/src/safeguard/safeguard.controller.ts`
- `apps/api/src/safeguard/safeguard.routes.ts`
- `apps/api/__test__/safeguard/safeguard.service.test.ts`

### BE — 수정
- `apps/api/prisma/schema.prisma` — SafeguardReport 모델, User.isSuspended, NotificationType·ExternalReportTarget 확장
- `apps/api/src/apiRouter.ts` — `/safeguard-reports` 등록

### FE — 신규
- `football/src/types/safeguard.ts`
- `football/src/services/safeguard.service.ts`
- `football/src/components/layout/SafeguardButton.tsx`
- `football/src/pages/admin/SafeguardReportPage.tsx`

### FE — 수정
- `football/src/App.tsx` — `/safeguard-reports` 라우트
- `football/src/components/layout/AppShell.tsx` (또는 루트 Layout) — SafeguardButton 삽입

---

## Task 1: Schema 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: SafeguardReportStatus enum 추가**

```prisma
enum SafeguardReportStatus {
  RECEIVED
  UNDER_REVIEW
  RESOLVED
}
```

- [ ] **Step 2: SafeguardReport 모델 추가** (IncidentReport 모델 아래에 추가)

```prisma
model SafeguardReport {
  id              Int                    @id @default(autoincrement())
  description     String                 @db.Text
  contactInfo     String?
  accusedUserId   Int?
  status          SafeguardReportStatus  @default(RECEIVED)
  resolvedNote    String?
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  accusedUser     User?                  @relation("SafeguardAccused", fields: [accusedUserId], references: [id])
}
```

- [ ] **Step 3: User 모델에 역관계 + isSuspended 추가**

`model User` 필드 블록에:
```prisma
isSuspended              Boolean                 @default(false)
safeguardReportsAccused  SafeguardReport[]       @relation("SafeguardAccused")
```

- [ ] **Step 4: NotificationType에 SAFEGUARD_EMERGENCY 추가**

```prisma
enum NotificationType {
  // ... 기존 값 유지 ...
  SAFEGUARD_EMERGENCY
}
```

- [ ] **Step 5: ExternalReportTarget에 경찰·아동보호·협회 추가**

```prisma
enum ExternalReportTarget {
  EDUCATION_OFFICE
  SCHOOL_SAFETY
  LEAGUE
  FEDERATION
  INSURANCE
  POLICE
  CHILD_PROTECTION_AGENCY
  FOOTBALL_ASSOCIATION
}
```

- [ ] **Step 6: 마이그레이션 실행**

```bash
cd apps/api
npx prisma migrate dev --name add-safeguard-report-user-suspended
```

그림자 DB 충돌 시 우회:
```bash
npx prisma db push
TIMESTAMP=$(date +%Y%m%d%H%M%S)
NAME="add_safeguard_report_user_suspended"
mkdir -p prisma/migrations/${TIMESTAMP}_${NAME}
echo "-- Applied via db push" > prisma/migrations/${TIMESTAMP}_${NAME}/migration.sql
npx prisma migrate resolve --applied ${TIMESTAMP}_${NAME}
```

- [ ] **Step 7: Prisma generate**

```bash
npx prisma generate
```

- [ ] **Step 8: 타입 오류 확인**

```bash
npx tsc --noEmit 2>&1 | grep -v "country.repo\|monthlyAttendance" | head -20
```

`isSuspended` 참조 부분에 오류 없으면 통과.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(safeguard): SafeguardReport 모델 + User.isSuspended + NotificationType/ExternalReportTarget 확장"
```

---

## Task 2: DTO + Repository

**Files:**
- Create: `apps/api/src/safeguard/dto/safeguard.dto.ts`
- Create: `apps/api/src/safeguard/safeguard.repo.ts`

- [ ] **Step 1: DTO 작성**

`apps/api/src/safeguard/dto/safeguard.dto.ts`:

```typescript
export interface CreateSafeguardReportDto {
  description: string;
  contactInfo?: string;
  accusedUserId?: number;
}

export interface UpdateSafeguardStatusDto {
  status: "UNDER_REVIEW" | "RESOLVED";
  resolvedNote?: string;
}

export function validateCreateSafeguardReport(body: unknown): CreateSafeguardReportDto {
  const b = body as Record<string, unknown>;
  if (typeof b.description !== "string" || b.description.trim().length < 10) {
    throw { statusCode: 400, code: "INVALID_DESCRIPTION" };
  }
  return {
    description: b.description.trim(),
    contactInfo: typeof b.contactInfo === "string" ? b.contactInfo : undefined,
    accusedUserId: typeof b.accusedUserId === "number" ? b.accusedUserId : undefined,
  };
}

export function validateUpdateSafeguardStatus(body: unknown): UpdateSafeguardStatusDto {
  const b = body as Record<string, unknown>;
  const VALID = ["UNDER_REVIEW", "RESOLVED"] as const;
  if (!VALID.includes(b.status as any)) {
    throw { statusCode: 400, code: "INVALID_STATUS" };
  }
  return {
    status: b.status as "UNDER_REVIEW" | "RESOLVED",
    resolvedNote: typeof b.resolvedNote === "string" ? b.resolvedNote : undefined,
  };
}
```

- [ ] **Step 2: Repository 작성**

`apps/api/src/safeguard/safeguard.repo.ts`:

```typescript
import type { PrismaClient } from "../generated/client";
import type { CreateSafeguardReportDto, UpdateSafeguardStatusDto } from "./dto/safeguard.dto";

export class SafeguardRepository {
  constructor(private prisma: PrismaClient) {}

  create(dto: CreateSafeguardReportDto) {
    return this.prisma.safeguardReport.create({
      data: {
        description: dto.description,
        contactInfo: dto.contactInfo,
        accusedUserId: dto.accusedUserId,
        status: "RECEIVED",
      },
    });
  }

  findAll() {
    return this.prisma.safeguardReport.findMany({
      orderBy: { createdAt: "desc" },
      include: { accusedUser: { select: { id: true, username: true, role: true } } },
    });
  }

  findById(id: number) {
    return this.prisma.safeguardReport.findUnique({
      where: { id },
      include: { accusedUser: { select: { id: true, username: true, role: true } } },
    });
  }

  updateStatus(id: number, dto: UpdateSafeguardStatusDto) {
    return this.prisma.safeguardReport.update({
      where: { id },
      data: { status: dto.status, resolvedNote: dto.resolvedNote },
    });
  }

  suspendUser(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isSuspended: true },
    });
  }

  findEmergencyRecipients() {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { role: "ADMIN" },
          { role: "FRONT_OFFICE", frontOfficeRole: "GM" },
          { role: "FRONT_OFFICE", frontOfficeRole: "TD" },
          { role: "FRONT_OFFICE", frontOfficeRole: "MEDICAL_DIRECTOR" },
        ],
        isDeleted: false,
        isSuspended: false,
      },
      select: { id: true },
    });
  }

  createExternalReports(safeguardReportId: number) {
    const targets = ["POLICE", "CHILD_PROTECTION_AGENCY", "FOOTBALL_ASSOCIATION"] as const;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    return this.prisma.externalReport.createMany({
      data: targets.map(target => ({
        safeguardReportId,
        target,
        status: "PENDING_SUBMISSION",
        reportData: { safeguardReportId, generatedAt: new Date().toISOString() },
        dueDate,
      })),
      skipDuplicates: true,
    });
  }
}
```

> **Note:** ExternalReport 모델에 `safeguardReportId Int?` 필드가 없으면 Task 1 schema에 추가: `safeguardReportId Int?` + `safeguardReport SafeguardReport? @relation(...)`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/safeguard/
git commit -m "feat(safeguard): SafeguardReport DTO + Repository"
```

---

## Task 3: Service (TDD)

**Files:**
- Create: `apps/api/src/safeguard/safeguard.service.ts`
- Create: `apps/api/__test__/safeguard/safeguard.service.test.ts`

- [ ] **Step 1: Failing test 작성**

`apps/api/__test__/safeguard/safeguard.service.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { SafeguardService } from "../../src/safeguard/safeguard.service";

const mockRepo = {
  create: jest.fn(),
  findAll: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  suspendUser: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 5, isSuspended: true }),
  findEmergencyRecipients: jest.fn<() => Promise<any[]>>().mockResolvedValue([{ id: 1 }, { id: 2 }]),
  createExternalReports: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 3 }),
} as any;

const mockNotifRepo = {
  createForUser: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 10 }),
} as any;

const service = new SafeguardService(mockRepo, mockNotifRepo);

describe("SafeguardService - submit", () => {
  beforeEach(() => jest.clearAllMocks());

  test("제보 저장 후 신고서 반환", async () => {
    mockRepo.create.mockResolvedValue({ id: 1, description: "테스트", status: "RECEIVED" });
    const result = await service.submit({ description: "테스트 신고 내용입니다" });
    expect(mockRepo.create).toHaveBeenCalledWith({ description: "테스트 신고 내용입니다" });
    expect(result.status).toBe("RECEIVED");
  });

  test("accusedUserId 있으면 계정 정지 처리", async () => {
    mockRepo.create.mockResolvedValue({ id: 2, description: "폭행", status: "RECEIVED", accusedUserId: 5 });
    await service.submit({ description: "폭행 목격 신고입니다", accusedUserId: 5 });
    expect(mockRepo.suspendUser).toHaveBeenCalledWith(5);
  });

  test("accusedUserId 없으면 계정 정지 없음", async () => {
    mockRepo.create.mockResolvedValue({ id: 3, description: "익명 신고", status: "RECEIVED", accusedUserId: null });
    await service.submit({ description: "익명 신고 내용입니다" });
    expect(mockRepo.suspendUser).not.toHaveBeenCalled();
  });

  test("긴급 알림을 GM·TD·의무에게 발송", async () => {
    mockRepo.create.mockResolvedValue({ id: 4, description: "긴급", status: "RECEIVED", accusedUserId: null });
    await service.submit({ description: "긴급 신고 내용 입력" });
    expect(mockRepo.findEmergencyRecipients).toHaveBeenCalled();
    expect(mockNotifRepo.createForUser).toHaveBeenCalledTimes(2); // 2 recipients
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(
      1, "SAFEGUARD_EMERGENCY", expect.stringContaining("긴급"), expect.any(String), 4,
    );
  });

  test("ExternalReport 3건 자동 생성", async () => {
    mockRepo.create.mockResolvedValue({ id: 5, description: "보고서", status: "RECEIVED", accusedUserId: null });
    await service.submit({ description: "외부 보고서 테스트입니다" });
    expect(mockRepo.createExternalReports).toHaveBeenCalledWith(5);
  });
});

describe("SafeguardService - updateStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  test("RECEIVED 상태에서 UNDER_REVIEW로 전환", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: "RECEIVED" });
    mockRepo.updateStatus.mockResolvedValue({ id: 1, status: "UNDER_REVIEW" });
    const result = await service.updateStatus(1, { status: "UNDER_REVIEW" });
    expect(result.status).toBe("UNDER_REVIEW");
  });

  test("RESOLVED 상태에서 변경 불가 → 409", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: "RESOLVED" });
    await expect(service.updateStatus(1, { status: "UNDER_REVIEW" })).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_RESOLVED",
    });
  });

  test("존재하지 않는 보고서 → 404", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.updateStatus(99, { status: "UNDER_REVIEW" })).rejects.toMatchObject({
      statusCode: 404,
      code: "SAFEGUARD_REPORT_NOT_FOUND",
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd apps/api && npx jest __test__/safeguard/safeguard.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `SafeguardService is not a function`

- [ ] **Step 3: Service 구현**

`apps/api/src/safeguard/safeguard.service.ts`:

```typescript
import { AppError } from "../lib/appError";
import type { SafeguardRepository } from "./safeguard.repo";
import type { NotificationRepository } from "../notification/notification.repo";
import type { CreateSafeguardReportDto, UpdateSafeguardStatusDto } from "./dto/safeguard.dto";

export class SafeguardService {
  constructor(
    private repo: SafeguardRepository,
    private notifRepo: NotificationRepository,
  ) {}

  async submit(dto: CreateSafeguardReportDto) {
    const report = await this.repo.create(dto);

    // 피의자 계정 즉시 정지
    if (report.accusedUserId) {
      void this.repo.suspendUser(report.accusedUserId).catch(console.error);
    }

    // 긴급 알림 발송 (GM, TD, 의무)
    void this.repo
      .findEmergencyRecipients()
      .then(recipients =>
        Promise.all(
          recipients.map(r =>
            this.notifRepo.createForUser(
              r.id,
              "SAFEGUARD_EMERGENCY",
              "[긴급] 유소년 보호 위반 신고 접수",
              "유소년 학대 의심 신고가 접수됐습니다. 즉시 확인이 필요합니다.",
              report.id,
            ),
          ),
        ),
      )
      .catch(console.error);

    // 외부 기관 보고서 자동 생성
    void this.repo.createExternalReports(report.id).catch(console.error);

    return report;
  }

  getAll() {
    return this.repo.findAll();
  }

  async getById(id: number) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "SAFEGUARD_REPORT_NOT_FOUND");
    return report;
  }

  async updateStatus(id: number, dto: UpdateSafeguardStatusDto) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "SAFEGUARD_REPORT_NOT_FOUND");
    if (report.status === "RESOLVED") throw new AppError(409, "ALREADY_RESOLVED");
    return this.repo.updateStatus(id, dto);
  }
}
```

- [ ] **Step 4: 테스트 실행 → PASS 확인**

```bash
cd apps/api && npx jest __test__/safeguard/safeguard.service.test.ts --no-coverage
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/safeguard/ apps/api/__test__/safeguard/
git commit -m "feat(safeguard): SafeguardService TDD - 익명 신고, 계정 정지, 긴급 알림, 외부 보고서"
```

---

## Task 4: Controller + Routes + apiRouter 등록

**Files:**
- Create: `apps/api/src/safeguard/safeguard.controller.ts`
- Create: `apps/api/src/safeguard/safeguard.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: Controller 작성**

`apps/api/src/safeguard/safeguard.controller.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import type { SafeguardService } from "./safeguard.service";
import { validateCreateSafeguardReport, validateUpdateSafeguardStatus } from "./dto/safeguard.dto";

export class SafeguardController {
  constructor(private service: SafeguardService) {}

  // 익명 제출 — 인증 불필요
  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = validateCreateSafeguardReport(req.body);
      res.status(201).json(await this.service.submit(dto));
    } catch (e) { next(e); }
  };

  // 관리자 전용
  getAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getAll());
    } catch (e) { next(e); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params.id)));
    } catch (e) { next(e); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = validateUpdateSafeguardStatus(req.body);
      res.json(await this.service.updateStatus(Number(req.params.id), dto));
    } catch (e) { next(e); }
  };
}
```

- [ ] **Step 2: Routes 작성**

`apps/api/src/safeguard/safeguard.routes.ts`:

```typescript
import { Router } from "express";
import passport from "passport";
import { SafeguardController } from "./safeguard.controller";
import { SafeguardService } from "./safeguard.service";
import { SafeguardRepository } from "./safeguard.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new SafeguardRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new SafeguardService(repo, notifRepo);
const controller = new SafeguardController(service);

const auth = passport.authenticate("accessToken", { session: false });

// POST /safeguard-reports — 익명 제출, 인증 불필요
router.post("/", controller.submit);

// 이하 관리자 전용
const ADMIN_ROLES = ["ADMIN"];
function adminOnly(req: any, res: any, next: any) {
  if (!ADMIN_ROLES.includes(req.user?.role)) return res.status(403).json({ message: "Forbidden" });
  next();
}

router.get("/", auth, adminOnly, controller.getAll);
router.get("/:id", auth, adminOnly, controller.getById);
router.patch("/:id/status", auth, adminOnly, controller.updateStatus);

export default router;
```

- [ ] **Step 3: apiRouter.ts에 등록**

```bash
grep -n "incident-reports\|import" apps/api/src/apiRouter.ts | tail -5
```

```typescript
import safeguardRouter from "./safeguard/safeguard.routes";
// 기존 라우트 등록 아래:
apiRouter.use("/safeguard-reports", safeguardRouter);
```

- [ ] **Step 4: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|monthlyAttendance" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/safeguard/ apps/api/src/apiRouter.ts
git commit -m "feat(safeguard): SafeguardReport controller, routes, API 등록"
```

---

## Task 5: FE — 익명 신고 버튼 + 폼

**Files:**
- Create: `football/src/types/safeguard.ts`
- Create: `football/src/services/safeguard.service.ts`
- Create: `football/src/components/layout/SafeguardButton.tsx`

- [ ] **Step 1: 타입 정의**

`football/src/types/safeguard.ts`:

```typescript
export type SafeguardReportStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'RESOLVED'

export interface SafeguardReport {
  id: number
  description: string
  contactInfo: string | null
  accusedUserId: number | null
  status: SafeguardReportStatus
  resolvedNote: string | null
  createdAt: string
}

export interface CreateSafeguardReportPayload {
  description: string
  contactInfo?: string
  accusedUserId?: number
}
```

- [ ] **Step 2: API 서비스**

`football/src/services/safeguard.service.ts`:

```typescript
import { api } from './api'
import type { SafeguardReport, CreateSafeguardReportPayload } from '@/types/safeguard'

export const safeguardApi = {
  submit: (payload: CreateSafeguardReportPayload) =>
    api.post<SafeguardReport>('/safeguard-reports', payload).then(r => r.data),

  getAll: () =>
    api.get<SafeguardReport[]>('/safeguard-reports').then(r => r.data),

  updateStatus: (id: number, status: string, resolvedNote?: string) =>
    api.patch<SafeguardReport>(`/safeguard-reports/${id}/status`, { status, resolvedNote }).then(r => r.data),
}
```

- [ ] **Step 3: SafeguardButton 컴포넌트 (앱 전체 고정 버튼)**

`football/src/components/layout/SafeguardButton.tsx`:

```typescript
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { safeguardApi } from '@/services/safeguard.service'

export function SafeguardButton() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (description.trim().length < 10) {
      setError('내용을 10자 이상 입력해주세요.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await safeguardApi.submit({
        description: description.trim(),
        contactInfo: contactInfo.trim() || undefined,
      })
      setSubmitted(true)
      setDescription('')
      setContactInfo('')
    } catch {
      setError('제출 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setSubmitted(false)
    setError(null)
  }

  return (
    <>
      {/* 고정 버튼 — 화면 우하단 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 active:scale-95 transition-transform flex items-center justify-center text-xl"
        title="유소년 보호 신고"
        aria-label="유소년 보호 익명 신고"
      >
        🚨
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">🚨 유소년 보호 신고</DialogTitle>
          </DialogHeader>

          {submitted ? (
            <div className="space-y-4 text-center py-4">
              <p className="text-green-600 font-semibold">신고가 접수됐습니다.</p>
              <p className="text-sm text-muted-foreground">
                관리자에게 즉시 전달되며 신속하게 처리됩니다.<br />
                신고자의 신원은 보호됩니다.
              </p>
              <Button onClick={handleClose}>닫기</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                신체적·언어적·정서적 학대 또는 가혹 행위를 목격하거나 경험했다면 익명으로 신고하세요.
                신고자의 신원은 시스템에 저장되지 않습니다.
              </p>
              <div>
                <Label>사건 내용 <span className="text-red-500">*</span></Label>
                <Textarea
                  rows={5}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="언제, 어디서, 무슨 일이 있었는지 구체적으로 서술해주세요..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>연락처 (선택 — 익명 유지 시 비워두세요)</Label>
                <input
                  type="text"
                  className="w-full mt-1 border rounded px-3 py-2 text-sm"
                  value={contactInfo}
                  onChange={e => setContactInfo(e.target.value)}
                  placeholder="전화번호 또는 이메일 (선택)"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>취소</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? '제출 중...' : '익명으로 신고하기'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 4: AppShell에 SafeguardButton 삽입**

루트 레이아웃 파일 확인:
```bash
grep -rn "AppShell\|Layout\|Sidebar" football/src/App.tsx football/src/components/layout/ 2>/dev/null | head -10
ls football/src/components/layout/ 2>/dev/null || ls football/src/components/ | head -10
```

최상위 레이아웃 컴포넌트에 import 후 렌더:
```typescript
import { SafeguardButton } from '@/components/layout/SafeguardButton'
// 레이아웃 JSX 마지막에:
<SafeguardButton />
```

- [ ] **Step 5: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
cd /Users/juno/work/football
git add football/src/types/safeguard.ts football/src/services/safeguard.service.ts football/src/components/layout/SafeguardButton.tsx football/src/App.tsx football/src/components/layout/
git commit -m "feat(safeguard): 익명 신고 버튼 + 폼 (앱 전체 고정)"
```

---

## Task 6: FE — 관리자 SafeguardReportPage

**Files:**
- Create: `football/src/pages/admin/SafeguardReportPage.tsx`
- Modify: `football/src/App.tsx` — `/safeguard-reports` 라우트 추가

- [ ] **Step 1: 관리자 목록 페이지**

`football/src/pages/admin/SafeguardReportPage.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { safeguardApi } from '@/services/safeguard.service'
import type { SafeguardReport } from '@/types/safeguard'

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수됨',
  UNDER_REVIEW: '검토 중',
  RESOLVED: '처리 완료',
}
const STATUS_VARIANT: Record<string, 'destructive' | 'secondary' | 'default'> = {
  RECEIVED: 'destructive',
  UNDER_REVIEW: 'secondary',
  RESOLVED: 'default',
}

export default function SafeguardReportPage() {
  const [reports, setReports] = useState<SafeguardReport[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setReports(await safeguardApi.getAll()) }
    catch { /* 권한 없으면 빈 목록 */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleReview = async (id: number) => {
    await safeguardApi.updateStatus(id, 'UNDER_REVIEW')
    load()
  }

  const handleResolve = async (id: number) => {
    const note = prompt('처리 결과를 입력하세요:')
    if (note === null) return
    await safeguardApi.updateStatus(id, 'RESOLVED', note)
    load()
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-red-600">🚨 유소년 보호 신고 현황</h1>
      <p className="text-sm text-muted-foreground">신고자 신원은 시스템에 저장되지 않습니다. 모든 접근은 감사 로그에 기록됩니다.</p>

      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="border rounded-lg p-4 space-y-2 border-l-4 border-l-red-400">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">#{r.id} · {new Date(r.createdAt).toLocaleString('ko-KR')}</span>
                <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
              <p className="text-sm">{r.description}</p>
              {r.contactInfo && (
                <p className="text-xs text-muted-foreground">연락처: {r.contactInfo}</p>
              )}
              {r.accusedUser && (
                <p className="text-xs text-red-500 font-medium">피의자: {r.accusedUser.username} (계정 정지됨)</p>
              )}
              {r.resolvedNote && (
                <p className="text-xs text-muted-foreground border-t pt-2">처리 결과: {r.resolvedNote}</p>
              )}
              <div className="flex gap-2">
                {r.status === 'RECEIVED' && (
                  <Button size="sm" variant="outline" onClick={() => handleReview(r.id)}>검토 시작</Button>
                )}
                {r.status === 'UNDER_REVIEW' && (
                  <Button size="sm" variant="outline" onClick={() => handleResolve(r.id)}>처리 완료</Button>
                )}
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <p className="text-muted-foreground">접수된 신고가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: App.tsx에 라우트 추가**

```typescript
import SafeguardReportPage from './pages/admin/SafeguardReportPage'
// Routes 내:
<Route path="/safeguard-reports" element={<SafeguardReportPage />} />
```

- [ ] **Step 3: 전체 TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
cd /Users/juno/work/football/apps/api && npx jest --no-coverage 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
cd /Users/juno/work/football
git add football/src/pages/admin/SafeguardReportPage.tsx football/src/App.tsx
git commit -m "feat(safeguard): 관리자 SafeguardReportPage + App.tsx 라우트"
```
