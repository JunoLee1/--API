# 자산관리부서(Feature 16) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 자산관리부서 산하 HR·IT자산·운영재무·시설관리 4개 팀의 핵심 업무(급여 2차 승인, 감가상각, 장부, 재고 관리)를 ERP에서 처리한다.

**Architecture:** 기존 payroll/equipment/facility 모듈을 확장하고, ledger·sales·inventory·software-license 4개 신규 모듈을 추가한다. 운영재무팀 LedgerEntry가 타 팀 결과를 fire-and-forget으로 자동 동기화하는 허브 역할을 한다.

**Tech Stack:** Express, Prisma (PostgreSQL), Jest (unit test), multer (file upload)

**Spec:** `docs/superpowers/specs/2026-08-05-asset-mgmt-feature-design.md`

---

## 🔴 Grill 결정사항 (2026-08-19)

### 이미 완료된 것 (백엔드 전체)
- Task 1: PayrollRun 2차 승인 + netPay 음수 보정 ✅
- Task 2: StaffRecord 퇴사 처리 (`terminate()`), 중복은 `closeActive()` 패턴으로 처리 ✅
- Task 3: HR 문서 업로드 (`hr.routes.ts` + multer + `uploadDocument()`) ✅
- Task 4: Equipment 감가상각 + 고가 분류 ✅
- Task 5: SoftwareLicense 모듈 BE ✅ (FE 미구현)
- Task 6: Ledger 모듈 ✅
- Task 7: Sales 모듈 ✅
- Task 8: Inventory 모듈 BE ✅ (FE 미구현)
- Task 9: Facility isLocked + 재무 상신 ✅
- Task 10: 크론 잡 3개 (`inventoryThreshold`, `monthlyDepreciation` 등) ✅
- Task 11: 장부 자동 동기화 (payroll run → ledger entry) ✅
- Task 12: 전체 검증 ✅

### 잔여 구현 (프론트엔드 1개)
- [x] `/asset/inventory` 페이지 신설 — ASSET_MANAGER / ASSET_STAFF 전용
  - **탭 1:** 소모품 재고 — 목록 + 수량 조정 + 부족 배지 (`GET /inventory`, `PATCH /inventory/:id/quantity`, `GET /inventory/alerts`)
  - **탭 2:** 소프트웨어 라이선스 — ASSET_MANAGER 전용, 발급·사용자 할당 (`GET/POST /software-licenses`, `POST /:id/assign`, `DELETE /:id/assign/:userId`)

### 기타 결정
- 감가상각: cron 자동처리로 충분, 수동 트리거 API/버튼 불필요
- 재고 알림: 페이지 배지로 충분, push/이메일 알림 불필요
- AppShell에 `/asset/inventory` nav 항목 추가 필요 (ASSET_MANAGER / ASSET_STAFF)

---

## Task 1: HR — PayrollRun 2차 승인 + netPay 음수 보정

**Files:**
- Modify: `apps/api/src/payroll/run/run.service.ts`
- Modify: `apps/api/src/payroll/run/run.repo.ts`
- Create: `apps/api/src/payroll/run/run.service.test.ts`

### Steps

- [x] **1.1 Add `secondApprove` method to `RunRepository`** in `apps/api/src/payroll/run/run.repo.ts`.

  Add this method to the existing `RunRepository` class:
  ```ts
  secondApprove(runId: number, userId: number) {
    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        secondApprovedById: userId,
        secondApprovedAt: new Date(),
        isLocked: true,
      },
    });
  }
  ```

- [x] **1.2 Patch `computePayroll` in `run.service.ts`** to floor `netPay` at 0 and throw when the raw value would be negative.

  Locate the existing `computePayroll` function. Find the line that computes `netPay` (something like `const netPay = grossPay - totalDeductions;`) and replace with:
  ```ts
  const rawNetPay = grossPay - totalDeductions;
  if (rawNetPay < 0) {
    throw new AppError(400, "NEGATIVE_NET_PAY");
  }
  const netPay = Math.max(0, rawNetPay);
  ```
  Ensure `AppError` is imported at the top: `import { AppError } from "../../lib/appError";`

- [x] **1.3 Add `secondApproveRun` method to `RunService`** in the same `run.service.ts` file.

  Inside the `RunService` class:
  ```ts
  async secondApproveRun(salaryId: number, runId: number, userId: number) {
    const run = await this.runRepo.findById(runId);
    if (!run || run.staffSalaryId !== salaryId) {
      throw new AppError(404, "PAYROLL_RUN_NOT_FOUND");
    }
    if (run.status !== "CONFIRMED") {
      throw new AppError(400, "PAYROLL_RUN_NOT_CONFIRMED");
    }
    if (run.isLocked) {
      throw new AppError(400, "PAYROLL_RUN_ALREADY_LOCKED");
    }
    return this.runRepo.secondApprove(runId, userId);
  }
  ```

- [x] **1.4 Wire the route** in the existing payroll run routes file (check `apps/api/src/payroll/run/run.routes.ts` or `run.controller.ts`).

  Add:
  ```ts
  runRouter.post("/salaries/:salaryId/runs/:runId/second-approve", auth, async (req, res, next) => {
    try {
      const salaryId = Number(req.params.salaryId);
      const runId = Number(req.params.runId);
      const userId = req.user!.id;
      const result = await runService.secondApproveRun(salaryId, runId, userId);
      res.json(result);
    } catch (e) { next(e); }
  });
  ```

- [x] **1.5 Create test file** `apps/api/src/payroll/run/run.service.test.ts`:
  ```ts
  import { RunService } from "./run.service";
  import { AppError } from "../../lib/appError";
  import type { RunRepository } from "./run.repo";

  const makeRepo = (overrides: Partial<RunRepository> = {}): RunRepository => ({
    findById: jest.fn().mockResolvedValue(null),
    secondApprove: jest.fn().mockResolvedValue({ id: 1, isLocked: true }),
    ...overrides,
  } as unknown as RunRepository);

  describe("RunService.secondApproveRun", () => {
    it("throws 400 when netPay would be negative in computePayroll", () => {
      // Directly test computePayroll import if exported; otherwise test via runService
      // If computePayroll is a standalone export:
      const { computePayroll } = require("./run.service");
      expect(() => computePayroll({ grossPay: 100, deductions: [{ amount: 200 }] }))
        .toThrow(new AppError(400, "NEGATIVE_NET_PAY"));
    });

    it("throws 400 when run is already locked", async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue({ id: 1, staffSalaryId: 10, status: "CONFIRMED", isLocked: true }),
      });
      const service = new RunService(repo);
      await expect(service.secondApproveRun(10, 1, 99))
        .rejects.toThrow(new AppError(400, "PAYROLL_RUN_ALREADY_LOCKED"));
    });

    it("throws 400 when status is not CONFIRMED", async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue({ id: 1, staffSalaryId: 10, status: "DRAFT", isLocked: false }),
      });
      const service = new RunService(repo);
      await expect(service.secondApproveRun(10, 1, 99))
        .rejects.toThrow(new AppError(400, "PAYROLL_RUN_NOT_CONFIRMED"));
    });

    it("succeeds and locks the run", async () => {
      const secondApprove = jest.fn().mockResolvedValue({ id: 1, isLocked: true, secondApprovedById: 99 });
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue({ id: 1, staffSalaryId: 10, status: "CONFIRMED", isLocked: false }),
        secondApprove,
      });
      const service = new RunService(repo);
      const result = await service.secondApproveRun(10, 1, 99);
      expect(secondApprove).toHaveBeenCalledWith(1, 99);
      expect(result.isLocked).toBe(true);
    });
  });
  ```
  If `computePayroll` is not a top-level export, adapt the first test to call it through whatever surface exposes it (e.g., `RunService.confirmRun` with a mocked repo).

- [x] **1.6 Verify:** run `cd apps/api && npx tsc --noEmit` and `npx jest src/payroll/run/run.service.test.ts` — expect 0 errors, 4 passing tests.

---

## Task 2: HR — StaffRecord 중복 체크 + 퇴사 처리

**Files:**
- Modify: `apps/api/src/staff-record/staff-record.service.ts`
- Modify: `apps/api/src/staff-record/staff-record.repo.ts`
- Create: `apps/api/src/staff-record/staff-record.service.test.ts`
- Modify: existing staff-record routes file (search `apps/api/src/staff-record/` for `*.routes.ts` or `*.controller.ts`)

### Steps

- [x] **2.1 Add three methods to `StaffRecordRepository`** in `staff-record.repo.ts`:
  ```ts
  findByEmail(email: string) {
    return this.prisma.staffRecord.findFirst({ where: { email } });
  }

  findByEmployeeId(employeeId: string) {
    return this.prisma.staffRecord.findFirst({ where: { employeeId } });
  }

  terminate(id: number, terminatedAt: Date) {
    return this.prisma.staffRecord.update({
      where: { id },
      data: { terminatedAt, isActive: false },
    });
  }
  ```

- [x] **2.2 Patch `StaffRecordService.create`** in `staff-record.service.ts` to short-circuit on duplicates.

  At the top of the existing `create(data, createdById)` method, before hitting the repo insert:
  ```ts
  if (data.email) {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) throw new AppError(409, "STAFF_ALREADY_EXISTS");
  }
  if (data.employeeId) {
    const existing = await this.repo.findByEmployeeId(data.employeeId);
    if (existing) throw new AppError(409, "STAFF_ALREADY_EXISTS");
  }
  ```
  Ensure `AppError` is imported: `import { AppError } from "../lib/appError";`

- [x] **2.3 Add `terminate` method to `StaffRecordService`**:
  ```ts
  async terminate(id: number) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(404, "STAFF_RECORD_NOT_FOUND");
    return this.repo.terminate(id, new Date());
  }
  ```

- [x] **2.4 Add route** `PATCH /api/staff-records/:id/terminate` in the existing staff-record routes/controller file:
  ```ts
  router.patch("/:id/terminate", auth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const result = await staffRecordService.terminate(id);
      res.json(result);
    } catch (e) { next(e); }
  });
  ```

- [x] **2.5 Create test file** `apps/api/src/staff-record/staff-record.service.test.ts`:
  ```ts
  import { StaffRecordService } from "./staff-record.service";
  import { AppError } from "../lib/appError";
  import type { StaffRecordRepository } from "./staff-record.repo";

  const makeRepo = (overrides: Partial<StaffRecordRepository> = {}): StaffRecordRepository => ({
    findByEmail: jest.fn().mockResolvedValue(null),
    findByEmployeeId: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue({ id: 1 }),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    terminate: jest.fn().mockResolvedValue({ id: 1, isActive: false, terminatedAt: new Date() }),
    ...overrides,
  } as unknown as StaffRecordRepository);

  describe("StaffRecordService", () => {
    it("throws 409 when email is duplicated", async () => {
      const repo = makeRepo({ findByEmail: jest.fn().mockResolvedValue({ id: 42 }) });
      const service = new StaffRecordService(repo);
      await expect(service.create({ email: "a@b.com", employeeId: "E1", name: "x" } as any, 1))
        .rejects.toThrow(new AppError(409, "STAFF_ALREADY_EXISTS"));
    });

    it("throws 409 when employeeId is duplicated", async () => {
      const repo = makeRepo({ findByEmployeeId: jest.fn().mockResolvedValue({ id: 42 }) });
      const service = new StaffRecordService(repo);
      await expect(service.create({ email: "new@b.com", employeeId: "E1", name: "x" } as any, 1))
        .rejects.toThrow(new AppError(409, "STAFF_ALREADY_EXISTS"));
    });

    it("terminate sets terminatedAt and isActive: false", async () => {
      const terminate = jest.fn().mockResolvedValue({ id: 1, isActive: false, terminatedAt: new Date() });
      const repo = makeRepo({ terminate });
      const service = new StaffRecordService(repo);
      const result = await service.terminate(1);
      expect(terminate).toHaveBeenCalledWith(1, expect.any(Date));
      expect(result.isActive).toBe(false);
      expect(result.terminatedAt).toBeInstanceOf(Date);
    });
  });
  ```

- [x] **2.6 Verify:** `cd apps/api && npx tsc --noEmit && npx jest src/staff-record/staff-record.service.test.ts`.

---

## Task 3: HR — 문서 업로드 엔드포인트

**Files:**
- Create: `apps/api/src/hr/hr.controller.ts`
- Create: `apps/api/src/hr/hr.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

### Steps

- [x] **3.1 Install multer if not already present:** `cd apps/api && npm ls multer || npm install multer && npm install --save-dev @types/multer`.

- [x] **3.2 Create `apps/api/src/hr/hr.controller.ts`:**
  ```ts
  import type { Request, Response } from "express";

  export function uploadDocument(req: Request, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: "NO_FILE_UPLOADED" });
    }
    return res.status(200).json({ ok: true, filename: req.file.originalname });
  }
  ```

- [x] **3.3 Create `apps/api/src/hr/hr.routes.ts`:**
  ```ts
  import { Router } from "express";
  import multer from "multer";
  import { auth } from "../lib/authMiddleware";
  import type { Request, Response, NextFunction } from "express";
  import { uploadDocument } from "./hr.controller";

  const ALLOWED_MIMES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/x-hwp",
    "application/haansofthwp",
  ];

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("INVALID_FILE_TYPE"));
      }
    },
  });

  function requireHR(req: Request, res: Response, next: NextFunction) {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });
    const isHR = ["HR_MANAGER", "HR_STAFF"].includes((user as any).frontOfficeRole);
    const isAdmin = ["ADMIN", "GM"].includes((user as any).role);
    if (!isHR && !isAdmin) return res.status(403).json({ error: "FORBIDDEN" });
    next();
  }

  const router = Router();
  router.post("/documents", auth, requireHR, upload.single("file"), uploadDocument);
  export default router;
  ```

- [x] **3.4 Register in `apps/api/src/apiRouter.ts`** — add import at top and mount:
  ```ts
  import hrRouter from "./hr/hr.routes";
  // ... existing routes
  apiRouter.use("/hr", hrRouter);
  ```

- [x] **3.5 Smoke test:**
  ```bash
  cd apps/api && npm run build && (npm run dev &)
  sleep 3
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/hr/documents
  # Expect: 401
  ```

- [x] **3.6 Verify:** `cd apps/api && npx tsc --noEmit`.

---

## Task 4: Equipment — 감가상각 + 고가 분류

**Files:**
- Modify: `apps/api/src/equipment/equipment.service.ts`
- Modify: `apps/api/src/equipment/equipment.repo.ts`
- Create: `apps/api/src/equipment/equipment.service.test.ts`

### Steps

- [x] **4.1 Add methods to `EquipmentRepository`** in `equipment.repo.ts`:
  ```ts
  updateUnitDepreciation(unitId: number, bookValue: number) {
    return this.prisma.equipmentUnit.update({
      where: { id: unitId },
      data: { bookValue },
    });
  }

  findUnitWithDepreciation(unitId: number) {
    return this.prisma.equipmentUnit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        purchaseValue: true,
        bookValue: true,
        depreciationRate: true,
        depreciationMethod: true,
        purchasedAt: true,
      },
    });
  }
  ```

- [x] **4.2 Patch `EquipmentRepository.createUnit`** to accept the new optional fields. Locate the existing `createUnit` signature and expand its `data` block:
  ```ts
  createUnit(itemId: number, dto: {
    // existing fields...
    serialNumber?: string;
    purchasedAt?: Date;
    purchaseValue?: number;
    depreciationRate?: number;
    depreciationMethod?: "STRAIGHT_LINE" | "DECLINING_BALANCE";
    isHighValue?: boolean;
  }) {
    return this.prisma.equipmentUnit.create({
      data: {
        itemId,
        // ...existing spread
        ...(dto.serialNumber && { serialNumber: dto.serialNumber }),
        ...(dto.purchasedAt && { purchasedAt: dto.purchasedAt }),
        ...(dto.purchaseValue !== undefined && { purchaseValue: dto.purchaseValue, bookValue: dto.purchaseValue }),
        ...(dto.depreciationRate !== undefined && { depreciationRate: dto.depreciationRate }),
        ...(dto.depreciationMethod && { depreciationMethod: dto.depreciationMethod }),
        ...(dto.isHighValue !== undefined && { isHighValue: dto.isHighValue }),
      },
    });
  }
  ```

- [x] **4.3 Patch `EquipmentService.addUnit`** in `equipment.service.ts` to accept the new fields and auto-flag high value:
  ```ts
  async addUnit(itemId: number, dto: {
    // existing fields...
    serialNumber?: string;
    purchasedAt?: string;
    purchaseValue?: number;
    depreciationRate?: number;
    depreciationMethod?: "STRAIGHT_LINE" | "DECLINING_BALANCE";
    isHighValue?: boolean;
  }) {
    const isHighValue = dto.isHighValue ?? (dto.purchaseValue !== undefined && dto.purchaseValue >= 500000);
    return this.repo.createUnit(itemId, {
      ...dto,
      purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : undefined,
      isHighValue,
    });
  }
  ```

- [x] **4.4 Add `calculateAndSaveDepreciation` to `EquipmentService`:**
  ```ts
  async calculateAndSaveDepreciation(unitId: number) {
    const unit = await this.repo.findUnitWithDepreciation(unitId);
    if (!unit) throw new AppError(404, "EQUIPMENT_UNIT_NOT_FOUND");
    if (!unit.depreciationMethod || unit.depreciationRate === null || unit.bookValue === null || unit.purchaseValue === null) {
      throw new AppError(400, "DEPRECIATION_FIELDS_MISSING");
    }

    const currentBook = Number(unit.bookValue);
    const purchase = Number(unit.purchaseValue);
    const rate = Number(unit.depreciationRate);
    let newBookValue: number;

    if (unit.depreciationMethod === "DECLINING_BALANCE") {
      newBookValue = currentBook * (1 - rate);
    } else {
      // STRAIGHT_LINE
      const purchasedAt = unit.purchasedAt ?? new Date();
      const elapsedMs = Date.now() - new Date(purchasedAt).getTime();
      const elapsedMonths = Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24 * 30)));
      newBookValue = purchase - (purchase * rate) * elapsedMonths;
    }

    if (newBookValue < 0) throw new AppError(400, "NEGATIVE_BOOK_VALUE");
    return this.repo.updateUnitDepreciation(unitId, newBookValue);
  }
  ```
  Ensure `AppError` is imported at the top.

- [x] **4.5 Create test file** `apps/api/src/equipment/equipment.service.test.ts`:
  ```ts
  import { EquipmentService } from "./equipment.service";
  import { AppError } from "../lib/appError";
  import type { EquipmentRepository } from "./equipment.repo";

  const makeRepo = (overrides: Partial<EquipmentRepository> = {}): EquipmentRepository => ({
    findUnitWithDepreciation: jest.fn().mockResolvedValue(null),
    updateUnitDepreciation: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as EquipmentRepository);

  describe("EquipmentService.calculateAndSaveDepreciation", () => {
    it("computes declining balance correctly", async () => {
      const updateUnitDepreciation = jest.fn().mockResolvedValue({});
      const repo = makeRepo({
        findUnitWithDepreciation: jest.fn().mockResolvedValue({
          id: 1, purchaseValue: 1000, bookValue: 1000, depreciationRate: 0.2,
          depreciationMethod: "DECLINING_BALANCE", purchasedAt: new Date(),
        }),
        updateUnitDepreciation,
      });
      const service = new EquipmentService(repo);
      await service.calculateAndSaveDepreciation(1);
      // 1000 * (1 - 0.2) = 800
      expect(updateUnitDepreciation).toHaveBeenCalledWith(1, 800);
    });

    it("computes straight line correctly", async () => {
      const updateUnitDepreciation = jest.fn().mockResolvedValue({});
      const purchasedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // ~1 month ago
      const repo = makeRepo({
        findUnitWithDepreciation: jest.fn().mockResolvedValue({
          id: 1, purchaseValue: 1000, bookValue: 1000, depreciationRate: 0.1,
          depreciationMethod: "STRAIGHT_LINE", purchasedAt,
        }),
        updateUnitDepreciation,
      });
      const service = new EquipmentService(repo);
      await service.calculateAndSaveDepreciation(1);
      // 1000 - (1000 * 0.1) * 1 month = 900
      expect(updateUnitDepreciation).toHaveBeenCalledWith(1, 900);
    });

    it("throws 400 when newBookValue would go negative", async () => {
      const repo = makeRepo({
        findUnitWithDepreciation: jest.fn().mockResolvedValue({
          id: 1, purchaseValue: 1000, bookValue: 100, depreciationRate: 0.5,
          depreciationMethod: "STRAIGHT_LINE",
          purchasedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 12 months
        }),
      });
      const service = new EquipmentService(repo);
      await expect(service.calculateAndSaveDepreciation(1))
        .rejects.toThrow(new AppError(400, "NEGATIVE_BOOK_VALUE"));
    });
  });
  ```

- [x] **4.6 Verify:** `cd apps/api && npx tsc --noEmit && npx jest src/equipment/equipment.service.test.ts`.

---

## Task 5: SoftwareLicense 모듈

**Files (all new unless noted):**
- Create: `apps/api/src/software-license/dto/software-license.dto.ts`
- Create: `apps/api/src/software-license/software-license.repo.ts`
- Create: `apps/api/src/software-license/software-license.service.ts`
- Create: `apps/api/src/software-license/software-license.controller.ts`
- Create: `apps/api/src/software-license/software-license.routes.ts`
- Create: `apps/api/src/software-license/software-license.service.test.ts`
- Modify: `apps/api/src/apiRouter.ts`

### Steps

- [x] **5.1 Create `dto/software-license.dto.ts`:**
  ```ts
  export interface CreateSoftwareLicenseDto {
    name: string;
    vendor: string;
    totalSeats: number;
    expiresAt?: string;
    renewalCost?: number;
  }

  export interface UpdateSoftwareLicenseDto {
    name?: string;
    vendor?: string;
    totalSeats?: number;
    expiresAt?: string;
    renewalCost?: number;
  }

  export interface AssignSeatDto {
    userId: number;
  }
  ```

- [x] **5.2 Create `software-license.repo.ts`:**
  ```ts
  import type { PrismaClient } from "../../generated/client";
  import type { CreateSoftwareLicenseDto, UpdateSoftwareLicenseDto } from "./dto/software-license.dto";

  export class SoftwareLicenseRepository {
    constructor(private prisma: PrismaClient) {}

    findAll() {
      return this.prisma.softwareLicense.findMany({ orderBy: { createdAt: "desc" } });
    }

    findById(id: number) {
      return this.prisma.softwareLicense.findUnique({ where: { id } });
    }

    create(data: CreateSoftwareLicenseDto & { createdById: number }) {
      return this.prisma.softwareLicense.create({
        data: {
          name: data.name,
          vendor: data.vendor,
          totalSeats: data.totalSeats,
          usedSeats: 0,
          ...(data.expiresAt && { expiresAt: new Date(data.expiresAt) }),
          ...(data.renewalCost !== undefined && { renewalCost: data.renewalCost }),
          createdById: data.createdById,
        },
      });
    }

    update(id: number, data: UpdateSoftwareLicenseDto) {
      return this.prisma.softwareLicense.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.vendor && { vendor: data.vendor }),
          ...(data.totalSeats !== undefined && { totalSeats: data.totalSeats }),
          ...(data.expiresAt && { expiresAt: new Date(data.expiresAt) }),
          ...(data.renewalCost !== undefined && { renewalCost: data.renewalCost }),
        },
      });
    }

    incrementSeats(id: number, delta: number) {
      return this.prisma.softwareLicense.update({
        where: { id },
        data: { usedSeats: { increment: delta } },
      });
    }

    findManagers() {
      return this.prisma.user.findMany({
        where: { frontOfficeRole: "ASSET_MANAGER", isDeleted: false },
        select: { id: true },
      });
    }
  }
  ```

- [x] **5.3 Create `software-license.service.ts`:**
  ```ts
  import { AppError } from "../lib/appError";
  import type { SoftwareLicenseRepository } from "./software-license.repo";
  import type { CreateSoftwareLicenseDto, UpdateSoftwareLicenseDto } from "./dto/software-license.dto";

  export class SoftwareLicenseService {
    constructor(private repo: SoftwareLicenseRepository) {}

    findAll() { return this.repo.findAll(); }
    findById(id: number) { return this.repo.findById(id); }

    create(dto: CreateSoftwareLicenseDto, createdById: number) {
      return this.repo.create({ ...dto, createdById });
    }

    update(id: number, dto: UpdateSoftwareLicenseDto) {
      return this.repo.update(id, dto);
    }

    async assign(id: number, _userId: number) {
      const license = await this.repo.findById(id);
      if (!license) throw new AppError(404, "LICENSE_NOT_FOUND");
      if (license.usedSeats >= license.totalSeats) {
        throw new AppError(400, "LICENSE_SEAT_EXCEEDED");
      }
      return this.repo.incrementSeats(id, +1);
    }

    async revoke(id: number, _userId: number) {
      const license = await this.repo.findById(id);
      if (!license) throw new AppError(404, "LICENSE_NOT_FOUND");
      const delta = license.usedSeats > 0 ? -1 : 0;
      if (delta === 0) return license;
      return this.repo.incrementSeats(id, delta);
    }
  }
  ```

- [x] **5.4 Create `software-license.controller.ts`:**
  ```ts
  import type { Request, Response, NextFunction } from "express";
  import type { SoftwareLicenseService } from "./software-license.service";

  export class SoftwareLicenseController {
    constructor(private service: SoftwareLicenseService) {}

    list = async (_req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.findAll()); } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.findById(Number(req.params.id))); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
      try { res.status(201).json(await this.service.create(req.body, req.user!.id)); } catch (e) { next(e); }
    };
    update = async (req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.update(Number(req.params.id), req.body)); } catch (e) { next(e); }
    };
    assign = async (req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.assign(Number(req.params.id), req.body.userId)); } catch (e) { next(e); }
    };
    revoke = async (req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.revoke(Number(req.params.id), Number(req.params.userId))); } catch (e) { next(e); }
    };
  }
  ```

- [x] **5.5 Create `software-license.routes.ts`:**
  ```ts
  import { Router } from "express";
  import { auth } from "../lib/authMiddleware";
  import { getPrisma } from "../lib/prisma";
  import { SoftwareLicenseRepository } from "./software-license.repo";
  import { SoftwareLicenseService } from "./software-license.service";
  import { SoftwareLicenseController } from "./software-license.controller";

  const router = Router();
  const repo = new SoftwareLicenseRepository(getPrisma());
  const service = new SoftwareLicenseService(repo);
  const ctrl = new SoftwareLicenseController(service);

  router.get("/", auth, ctrl.list);
  router.post("/", auth, ctrl.create);
  router.get("/:id", auth, ctrl.get);
  router.patch("/:id", auth, ctrl.update);
  router.post("/:id/assign", auth, ctrl.assign);
  router.delete("/:id/assign/:userId", auth, ctrl.revoke);

  export default router;
  ```

- [x] **5.6 Create `software-license.service.test.ts`:**
  ```ts
  import { SoftwareLicenseService } from "./software-license.service";
  import { AppError } from "../lib/appError";
  import type { SoftwareLicenseRepository } from "./software-license.repo";

  const makeRepo = (overrides: Partial<SoftwareLicenseRepository> = {}): SoftwareLicenseRepository => ({
    findById: jest.fn().mockResolvedValue(null),
    incrementSeats: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as SoftwareLicenseRepository);

  describe("SoftwareLicenseService.assign", () => {
    it("throws 400 when all seats are used", async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue({ id: 1, totalSeats: 5, usedSeats: 5 }),
      });
      const service = new SoftwareLicenseService(repo);
      await expect(service.assign(1, 99))
        .rejects.toThrow(new AppError(400, "LICENSE_SEAT_EXCEEDED"));
    });

    it("increments usedSeats when a seat is available", async () => {
      const incrementSeats = jest.fn().mockResolvedValue({ id: 1, usedSeats: 3 });
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue({ id: 1, totalSeats: 5, usedSeats: 2 }),
        incrementSeats,
      });
      const service = new SoftwareLicenseService(repo);
      await service.assign(1, 99);
      expect(incrementSeats).toHaveBeenCalledWith(1, 1);
    });
  });
  ```

- [x] **5.7 Register router in `apiRouter.ts`:**
  ```ts
  import softwareLicenseRouter from "./software-license/software-license.routes";
  apiRouter.use("/software-licenses", softwareLicenseRouter);
  ```

- [x] **5.8 Verify:** `cd apps/api && npx tsc --noEmit && npx jest src/software-license/software-license.service.test.ts`.

---

## Task 6: Ledger 모듈

**Files (all new unless noted):**
- Create: `apps/api/src/ledger/dto/ledger.dto.ts`
- Create: `apps/api/src/ledger/ledger.repo.ts`
- Create: `apps/api/src/ledger/ledger.service.ts`
- Create: `apps/api/src/ledger/ledger.controller.ts`
- Create: `apps/api/src/ledger/ledger.routes.ts`
- Create: `apps/api/src/ledger/ledger.service.test.ts`
- Modify: `apps/api/src/apiRouter.ts`

### Steps

- [x] **6.1 Create `dto/ledger.dto.ts`:**
  ```ts
  export interface CreateLedgerEntryDto {
    type: "INCOME" | "EXPENSE";
    category:
      | "SALARY" | "EQUIPMENT_PURCHASE" | "FACILITY_REPAIR" | "TRANSFER_FEE"
      | "TICKET_SALES" | "UNIFORM_SALES" | "SPONSORSHIP" | "ACADEMY_FEE"
      | "REFUND" | "OTHER";
    amount: number;
    currency?: "KRW" | "USD" | "EUR" | "GBP";
    exchangeRate?: number;
    amountKrw?: number;
    isRefund?: boolean;
    description?: string;
    relatedModule?: string;
    relatedId?: number;
  }

  export interface LedgerListQuery {
    type?: "INCOME" | "EXPENSE";
    category?: string;
    from?: string;
    to?: string;
  }
  ```

- [x] **6.2 Create `ledger.repo.ts`:**
  ```ts
  import type { PrismaClient } from "../../generated/client";
  import type { CreateLedgerEntryDto, LedgerListQuery } from "./dto/ledger.dto";

  export class LedgerRepository {
    constructor(private prisma: PrismaClient) {}

    findAll(query: LedgerListQuery) {
      return this.prisma.ledgerEntry.findMany({
        where: {
          ...(query.type && { type: query.type }),
          ...(query.category && { category: query.category as any }),
          ...(query.from || query.to
            ? { createdAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }

    findById(id: number) {
      return this.prisma.ledgerEntry.findUnique({ where: { id } });
    }

    create(data: CreateLedgerEntryDto & { createdById: number; amountKrw: number }) {
      return this.prisma.ledgerEntry.create({
        data: {
          type: data.type,
          category: data.category as any,
          amount: data.amount,
          currency: data.currency ?? "KRW",
          exchangeRate: data.exchangeRate ?? 1,
          amountKrw: data.amountKrw,
          isRefund: data.isRefund ?? false,
          ...(data.description && { description: data.description }),
          ...(data.relatedModule && { relatedModule: data.relatedModule }),
          ...(data.relatedId !== undefined && { relatedId: data.relatedId }),
          createdById: data.createdById,
        },
      });
    }
  }
  ```

- [x] **6.3 Create `ledger.service.ts`:**
  ```ts
  import { AppError } from "../lib/appError";
  import type { LedgerRepository } from "./ledger.repo";
  import type { CreateLedgerEntryDto, LedgerListQuery } from "./dto/ledger.dto";

  export class LedgerService {
    constructor(private repo: LedgerRepository) {}

    findAll(query: LedgerListQuery) { return this.repo.findAll(query); }
    findById(id: number) { return this.repo.findById(id); }

    async create(dto: CreateLedgerEntryDto, createdById: number) {
      if (dto.amount <= 0) throw new AppError(400, "INVALID_AMOUNT");
      const rate = dto.exchangeRate ?? 1;
      const amountKrw = dto.amountKrw ?? dto.amount * rate;
      return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
    }

    async createRefund(originalId: number, createdById: number) {
      const original = await this.repo.findById(originalId);
      if (!original) throw new AppError(404, "LEDGER_ENTRY_NOT_FOUND");
      return this.repo.create({
        type: original.type as any,
        category: "REFUND",
        amount: -Number(original.amount),
        currency: original.currency as any,
        exchangeRate: Number(original.exchangeRate),
        amountKrw: -Number(original.amountKrw),
        isRefund: true,
        description: `Refund for #${original.id}`,
        relatedModule: original.relatedModule ?? undefined,
        relatedId: original.relatedId ?? undefined,
        createdById,
      });
    }

    // Fire-and-forget helper for other modules
    async createAutoEntry(dto: CreateLedgerEntryDto, createdById: number) {
      const rate = dto.exchangeRate ?? 1;
      const amountKrw = dto.amountKrw ?? dto.amount * rate;
      return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
    }
  }
  ```

- [x] **6.4 Create `ledger.controller.ts`:**
  ```ts
  import type { Request, Response, NextFunction } from "express";
  import type { LedgerService } from "./ledger.service";

  export class LedgerController {
    constructor(private service: LedgerService) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.findAll(req.query as any)); } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.findById(Number(req.params.id))); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
      try { res.status(201).json(await this.service.create(req.body, req.user!.id)); } catch (e) { next(e); }
    };
    refund = async (req: Request, res: Response, next: NextFunction) => {
      try { res.status(201).json(await this.service.createRefund(Number(req.params.id), req.user!.id)); } catch (e) { next(e); }
    };
  }
  ```

- [x] **6.5 Create `ledger.routes.ts`:**
  ```ts
  import { Router } from "express";
  import { auth } from "../lib/authMiddleware";
  import { getPrisma } from "../lib/prisma";
  import { LedgerRepository } from "./ledger.repo";
  import { LedgerService } from "./ledger.service";
  import { LedgerController } from "./ledger.controller";

  const router = Router();
  const repo = new LedgerRepository(getPrisma());
  const service = new LedgerService(repo);
  const ctrl = new LedgerController(service);

  router.get("/", auth, ctrl.list);
  router.post("/", auth, ctrl.create);
  router.get("/:id", auth, ctrl.get);
  router.post("/:id/refund", auth, ctrl.refund);

  export { service as ledgerService };
  export default router;
  ```

- [x] **6.6 Create `ledger.service.test.ts`:**
  ```ts
  import { LedgerService } from "./ledger.service";
  import { AppError } from "../lib/appError";
  import type { LedgerRepository } from "./ledger.repo";

  const makeRepo = (overrides: Partial<LedgerRepository> = {}): LedgerRepository => ({
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async (data) => ({ id: 1, ...data })),
    findAll: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as LedgerRepository);

  describe("LedgerService", () => {
    it("throws 400 when amount is negative", async () => {
      const service = new LedgerService(makeRepo());
      await expect(service.create({ type: "EXPENSE", category: "OTHER", amount: -100 } as any, 1))
        .rejects.toThrow(new AppError(400, "INVALID_AMOUNT"));
    });

    it("auto-calculates amountKrw from amount * exchangeRate", async () => {
      const create = jest.fn().mockImplementation(async (data) => ({ id: 1, ...data }));
      const service = new LedgerService(makeRepo({ create }));
      await service.create({ type: "EXPENSE", category: "OTHER", amount: 100, currency: "USD", exchangeRate: 1300 } as any, 1);
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ amountKrw: 130000 }));
    });

    it("refund creates a negative entry", async () => {
      const create = jest.fn().mockImplementation(async (data) => ({ id: 2, ...data }));
      const service = new LedgerService(makeRepo({
        findById: jest.fn().mockResolvedValue({
          id: 1, type: "EXPENSE", category: "SALARY",
          amount: 100, currency: "KRW", exchangeRate: 1, amountKrw: 100,
          relatedModule: null, relatedId: null,
        }),
        create,
      }));
      await service.createRefund(1, 42);
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        amount: -100, amountKrw: -100, isRefund: true, category: "REFUND",
      }));
    });
  });
  ```

- [x] **6.7 Register router in `apiRouter.ts`:**
  ```ts
  import ledgerRouter from "./ledger/ledger.routes";
  apiRouter.use("/ledger", ledgerRouter);
  ```

- [x] **6.8 Verify:** `cd apps/api && npx tsc --noEmit && npx jest src/ledger/ledger.service.test.ts`.

---

## Task 7: Sales 모듈

**Files (all new unless noted):**
- Create: `apps/api/src/sales/dto/sales.dto.ts`
- Create: `apps/api/src/sales/sales.repo.ts`
- Create: `apps/api/src/sales/sales.service.ts`
- Create: `apps/api/src/sales/sales.controller.ts`
- Create: `apps/api/src/sales/sales.routes.ts`
- Create: `apps/api/src/sales/sales.service.test.ts`
- Modify: `apps/api/src/apiRouter.ts`

### Steps

- [x] **7.1 Create `dto/sales.dto.ts`:**
  ```ts
  export interface CreateSalesRecordDto {
    type: "TICKET" | "UNIFORM" | "OTHER";
    quantity: number;
    unitPrice: number;
    currency?: "KRW" | "USD" | "EUR" | "GBP";
    saleDate: string;
    description?: string;
  }
  ```

- [x] **7.2 Create `sales.repo.ts`:**
  ```ts
  import type { PrismaClient } from "../../generated/client";
  import type { CreateSalesRecordDto } from "./dto/sales.dto";

  export class SalesRepository {
    constructor(private prisma: PrismaClient) {}

    findAll() {
      return this.prisma.salesRecord.findMany({ orderBy: { saleDate: "desc" } });
    }

    create(data: CreateSalesRecordDto & { totalAmount: number; createdById: number }) {
      return this.prisma.salesRecord.create({
        data: {
          type: data.type,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          totalAmount: data.totalAmount,
          currency: data.currency ?? "KRW",
          saleDate: new Date(data.saleDate),
          ...(data.description && { description: data.description }),
          createdById: data.createdById,
        },
      });
    }

    groupByType() {
      return this.prisma.salesRecord.groupBy({
        by: ["type"],
        _sum: { totalAmount: true },
      });
    }
  }
  ```

- [x] **7.3 Create `sales.service.ts`:**
  ```ts
  import { AppError } from "../lib/appError";
  import type { SalesRepository } from "./sales.repo";
  import type { CreateSalesRecordDto } from "./dto/sales.dto";

  export class SalesService {
    constructor(private repo: SalesRepository) {}

    findAll() { return this.repo.findAll(); }

    async create(dto: CreateSalesRecordDto, createdById: number) {
      if (dto.quantity <= 0) throw new AppError(400, "NEGATIVE_SALES_VALUE");
      if (dto.unitPrice <= 0) throw new AppError(400, "NEGATIVE_SALES_VALUE");
      const totalAmount = dto.quantity * dto.unitPrice;
      return this.repo.create({ ...dto, totalAmount, createdById });
    }

    async getSummary() {
      return this.repo.groupByType();
    }
  }
  ```

- [x] **7.4 Create `sales.controller.ts`:**
  ```ts
  import type { Request, Response, NextFunction } from "express";
  import type { SalesService } from "./sales.service";

  export class SalesController {
    constructor(private service: SalesService) {}

    list = async (_req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.findAll()); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
      try { res.status(201).json(await this.service.create(req.body, req.user!.id)); } catch (e) { next(e); }
    };
    summary = async (_req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.getSummary()); } catch (e) { next(e); }
    };
  }
  ```

- [x] **7.5 Create `sales.routes.ts`:**
  ```ts
  import { Router } from "express";
  import { auth } from "../lib/authMiddleware";
  import { getPrisma } from "../lib/prisma";
  import { SalesRepository } from "./sales.repo";
  import { SalesService } from "./sales.service";
  import { SalesController } from "./sales.controller";

  const router = Router();
  const repo = new SalesRepository(getPrisma());
  const service = new SalesService(repo);
  const ctrl = new SalesController(service);

  router.get("/", auth, ctrl.list);
  router.post("/", auth, ctrl.create);
  router.get("/summary", auth, ctrl.summary);

  export default router;
  ```

- [x] **7.6 Create `sales.service.test.ts`:**
  ```ts
  import { SalesService } from "./sales.service";
  import { AppError } from "../lib/appError";
  import type { SalesRepository } from "./sales.repo";

  const makeRepo = (overrides: Partial<SalesRepository> = {}): SalesRepository => ({
    create: jest.fn().mockImplementation(async (data) => ({ id: 1, ...data })),
    ...overrides,
  } as unknown as SalesRepository);

  describe("SalesService.create", () => {
    it("throws 400 when quantity is negative", async () => {
      const service = new SalesService(makeRepo());
      await expect(service.create({ type: "TICKET", quantity: -1, unitPrice: 100, saleDate: "2026-08-05" } as any, 1))
        .rejects.toThrow(new AppError(400, "NEGATIVE_SALES_VALUE"));
    });

    it("throws 400 when unitPrice is negative", async () => {
      const service = new SalesService(makeRepo());
      await expect(service.create({ type: "TICKET", quantity: 1, unitPrice: -100, saleDate: "2026-08-05" } as any, 1))
        .rejects.toThrow(new AppError(400, "NEGATIVE_SALES_VALUE"));
    });
  });
  ```

- [x] **7.7 Register in `apiRouter.ts`:**
  ```ts
  import salesRouter from "./sales/sales.routes";
  apiRouter.use("/sales", salesRouter);
  ```

- [x] **7.8 Verify:** `cd apps/api && npx tsc --noEmit && npx jest src/sales/sales.service.test.ts`.

---

## Task 8: Inventory 모듈

**Files (all new unless noted):**
- Create: `apps/api/src/inventory/dto/inventory.dto.ts`
- Create: `apps/api/src/inventory/inventory.repo.ts`
- Create: `apps/api/src/inventory/inventory.service.ts`
- Create: `apps/api/src/inventory/inventory.controller.ts`
- Create: `apps/api/src/inventory/inventory.routes.ts`
- Create: `apps/api/src/inventory/inventory.service.test.ts`
- Modify: `apps/api/src/apiRouter.ts`

### Steps

- [x] **8.1 Create `dto/inventory.dto.ts`:**
  ```ts
  export interface CreateInventoryItemDto {
    name: string;
    unit: string;
    quantity?: number;
    minThreshold?: number;
  }

  export interface AdjustQuantityDto {
    delta: number;
  }
  ```

- [x] **8.2 Create `inventory.repo.ts`:**
  ```ts
  import type { PrismaClient } from "../../generated/client";
  import type { CreateInventoryItemDto } from "./dto/inventory.dto";

  export class InventoryRepository {
    constructor(private prisma: PrismaClient) {}

    findAll() {
      return this.prisma.facilityInventoryItem.findMany({ orderBy: { name: "asc" } });
    }

    findById(id: number) {
      return this.prisma.facilityInventoryItem.findUnique({ where: { id } });
    }

    create(data: CreateInventoryItemDto & { createdById: number }) {
      return this.prisma.facilityInventoryItem.create({
        data: {
          name: data.name,
          unit: data.unit,
          quantity: data.quantity ?? 0,
          minThreshold: data.minThreshold ?? 0,
          createdById: data.createdById,
        },
      });
    }

    updateQuantity(id: number, newQuantity: number) {
      return this.prisma.facilityInventoryItem.update({
        where: { id },
        data: { quantity: newQuantity },
      });
    }

    findAllForAlertCheck() {
      return this.prisma.facilityInventoryItem.findMany();
    }
  }
  ```

- [x] **8.3 Create `inventory.service.ts`:**
  ```ts
  import { AppError } from "../lib/appError";
  import type { InventoryRepository } from "./inventory.repo";
  import type { CreateInventoryItemDto } from "./dto/inventory.dto";

  export class InventoryService {
    constructor(private repo: InventoryRepository) {}

    findAll() { return this.repo.findAll(); }

    create(dto: CreateInventoryItemDto, createdById: number) {
      return this.repo.create({ ...dto, createdById });
    }

    async adjustQuantity(id: number, delta: number) {
      const item = await this.repo.findById(id);
      if (!item) throw new AppError(404, "INVENTORY_ITEM_NOT_FOUND");
      const newQty = item.quantity + delta;
      return this.repo.updateQuantity(id, newQty);
    }

    async getAlerts() {
      const items = await this.repo.findAllForAlertCheck();
      return items.filter(i => i.quantity <= i.minThreshold);
    }
  }
  ```

- [x] **8.4 Create `inventory.controller.ts`:**
  ```ts
  import type { Request, Response, NextFunction } from "express";
  import type { InventoryService } from "./inventory.service";

  export class InventoryController {
    constructor(private service: InventoryService) {}

    list = async (_req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.findAll()); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
      try { res.status(201).json(await this.service.create(req.body, req.user!.id)); } catch (e) { next(e); }
    };
    adjust = async (req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.adjustQuantity(Number(req.params.id), Number(req.body.delta))); } catch (e) { next(e); }
    };
    alerts = async (_req: Request, res: Response, next: NextFunction) => {
      try { res.json(await this.service.getAlerts()); } catch (e) { next(e); }
    };
  }
  ```

- [x] **8.5 Create `inventory.routes.ts`:**
  ```ts
  import { Router } from "express";
  import { auth } from "../lib/authMiddleware";
  import { getPrisma } from "../lib/prisma";
  import { InventoryRepository } from "./inventory.repo";
  import { InventoryService } from "./inventory.service";
  import { InventoryController } from "./inventory.controller";

  const router = Router();
  const repo = new InventoryRepository(getPrisma());
  const service = new InventoryService(repo);
  const ctrl = new InventoryController(service);

  router.get("/", auth, ctrl.list);
  router.post("/", auth, ctrl.create);
  router.patch("/:id/quantity", auth, ctrl.adjust);
  router.get("/alerts", auth, ctrl.alerts);

  export default router;
  ```

- [x] **8.6 Create `inventory.service.test.ts`:**
  ```ts
  import { InventoryService } from "./inventory.service";
  import type { InventoryRepository } from "./inventory.repo";

  const makeRepo = (overrides: Partial<InventoryRepository> = {}): InventoryRepository => ({
    findById: jest.fn().mockResolvedValue({ id: 1, quantity: 10, minThreshold: 5 }),
    updateQuantity: jest.fn().mockImplementation(async (id, q) => ({ id, quantity: q })),
    findAllForAlertCheck: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as InventoryRepository);

  describe("InventoryService", () => {
    it("adjusts quantity correctly", async () => {
      const updateQuantity = jest.fn().mockImplementation(async (id, q) => ({ id, quantity: q }));
      const repo = makeRepo({ updateQuantity });
      const service = new InventoryService(repo);
      await service.adjustQuantity(1, -3);
      expect(updateQuantity).toHaveBeenCalledWith(1, 7);
    });

    it("getAlerts returns items at or below minThreshold", async () => {
      const items = [
        { id: 1, name: "cones", quantity: 10, minThreshold: 5 },
        { id: 2, name: "balls", quantity: 3, minThreshold: 5 },
        { id: 3, name: "vests", quantity: 5, minThreshold: 5 },
      ];
      const repo = makeRepo({ findAllForAlertCheck: jest.fn().mockResolvedValue(items) });
      const service = new InventoryService(repo);
      const alerts = await service.getAlerts();
      expect(alerts.map(i => i.id).sort()).toEqual([2, 3]);
    });
  });
  ```

- [x] **8.7 Register in `apiRouter.ts`:**
  ```ts
  import inventoryRouter from "./inventory/inventory.routes";
  apiRouter.use("/inventory", inventoryRouter);
  ```

- [x] **8.8 Verify:** `cd apps/api && npx tsc --noEmit && npx jest src/inventory/inventory.service.test.ts`.

---

## Task 9: Facility 확장 — isLocked + 재무 상신

**Files:**
- Modify: `apps/api/src/facility/maintenance/maintenance.repo.ts`
- Modify: `apps/api/src/facility/maintenance/maintenance.service.ts`
- Modify: `apps/api/src/facility/maintenance/maintenance.controller.ts`
- Modify: `apps/api/src/facility/facility.routes.ts` (routes live here; verify with `grep -R "maintenance" apps/api/src/facility`)

### Steps

- [x] **9.1 Add repo methods to `maintenance.repo.ts`:**
  ```ts
  lock(id: number) {
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: { isLocked: true },
      include: INCLUDE,
    });
  }

  submitToFinance(id: number) {
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: { financeSubmittedAt: new Date() },
      include: INCLUDE,
    });
  }
  ```

- [x] **9.2 Patch `MaintenanceService.update`** — add lock check as the first statement inside the method:
  ```ts
  async update(id: number, dto: UpdateMaintenanceDto) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(404, "MAINTENANCE_NOT_FOUND");
    if (existing.isLocked) throw new AppError(400, "MAINTENANCE_LOCKED");
    return this.repo.update(id, dto);
  }
  ```

- [x] **9.3 Add `lock` method to `MaintenanceService`:**
  ```ts
  async lock(id: number, _userId: number) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(404, "MAINTENANCE_NOT_FOUND");
    if (existing.status !== "RESOLVED") throw new AppError(400, "CANNOT_LOCK_UNRESOLVED");
    if (existing.isLocked) throw new AppError(400, "MAINTENANCE_ALREADY_LOCKED");
    return this.repo.lock(id);
  }
  ```

- [x] **9.4 Add `submitToFinance` method to `MaintenanceService`:**
  Constructor already takes `maintenanceRepo`. Change constructor to also accept an optional `notificationRepo`, or import a shared `NotificationRepository` and instantiate it here. Preferred approach — inject via constructor:
  ```ts
  constructor(
    private repo: MaintenanceRepository,
    private notificationRepo: NotificationRepository,
    private prisma: PrismaClient,
  ) {}

  async submitToFinance(id: number, _userId: number) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(404, "MAINTENANCE_NOT_FOUND");
    const cost = existing.estimatedCost ? Number(existing.estimatedCost) : 0;
    if (cost < 1000000) throw new AppError(400, "COST_BELOW_THRESHOLD");
    if (existing.financeSubmittedAt) throw new AppError(400, "ALREADY_SUBMITTED_TO_FINANCE");

    const result = await this.repo.submitToFinance(id);

    // Notify FINANCE_MANAGER users
    const managers = await this.prisma.user.findMany({
      where: { frontOfficeRole: "FINANCE_MANAGER", isDeleted: false },
      select: { id: true },
    });
    for (const m of managers) {
      await this.notificationRepo.create({
        userId: m.id,
        type: "FINANCE_SUBMIT_REQUIRED",
        title: "시설 유지보수 재무 승인 요청",
        body: `${existing.title} (예상 비용 ${cost.toLocaleString()}원) 재무팀 승인이 필요합니다.`,
      });
    }
    return result;
  }
  ```
  Update the wiring code (in the routes/module file) to construct MaintenanceService with `new MaintenanceService(maintenanceRepo, new NotificationRepository(prisma), prisma)`.

- [x] **9.5 Add routes.** In `apps/api/src/facility/facility.routes.ts` (or wherever `/maintenance` routes are registered), add:
  ```ts
  router.post("/maintenance/:id/lock", auth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      res.json(await maintenanceService.lock(id, req.user!.id));
    } catch (e) { next(e); }
  });

  router.post("/maintenance/:id/submit-finance", auth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      res.json(await maintenanceService.submitToFinance(id, req.user!.id));
    } catch (e) { next(e); }
  });
  ```

- [x] **9.6 Extend or create `maintenance.service.test.ts`** with these two tests:
  ```ts
  it("throws 400 when locking an unresolved request", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, status: "IN_PROGRESS", isLocked: false }),
    });
    const service = new MaintenanceService(repo, makeNotifRepo(), {} as any);
    await expect(service.lock(1, 99))
      .rejects.toThrow(new AppError(400, "CANNOT_LOCK_UNRESOLVED"));
  });

  it("throws 400 when submit-finance called under threshold", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, estimatedCost: 500000, financeSubmittedAt: null }),
    });
    const service = new MaintenanceService(repo, makeNotifRepo(), {} as any);
    await expect(service.submitToFinance(1, 99))
      .rejects.toThrow(new AppError(400, "COST_BELOW_THRESHOLD"));
  });
  ```
  Provide `makeRepo` and `makeNotifRepo` helper factories at the top of the test file.

- [x] **9.7 Verify:** `cd apps/api && npx tsc --noEmit && npx jest src/facility/maintenance/maintenance.service.test.ts`.

---

## Task 10: 크론 잡 3개

**Files:**
- Create: `apps/api/src/jobs/equipmentExpiryAlert.ts`
- Create: `apps/api/src/jobs/inventoryThreshold.ts`
- Create: `apps/api/src/jobs/monthlyDepreciation.ts`
- Modify: `apps/api/src/server.ts`

Reference existing pattern in `apps/api/src/jobs/contractExpiry.ts`. Cron uses `node-cron`, prisma is fetched via `getPrisma()`.

### Steps

- [x] **10.1 Create `apps/api/src/jobs/equipmentExpiryAlert.ts`:**
  ```ts
  import cron from "node-cron";
  import { getPrisma } from "../lib/prisma";
  import { NotificationRepository } from "../notification/notification.repo";

  export function startEquipmentExpiryAlertJob() {
    cron.schedule("0 9 * * *", async () => {
      const prisma = getPrisma();
      const notifRepo = new NotificationRepository(prisma);
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const expiringUnits = await prisma.equipmentUnit.findMany({
        where: { expiresAt: { lte: thirtyDaysFromNow, gt: new Date() } },
        select: { id: true, serialNumber: true, item: { select: { name: true } } },
      });
      const expiringLicenses = await prisma.softwareLicense.findMany({
        where: { expiresAt: { lte: thirtyDaysFromNow, gt: new Date() } },
        select: { id: true, name: true },
      });

      const managers = await prisma.user.findMany({
        where: { frontOfficeRole: "ASSET_MANAGER", isDeleted: false },
        select: { id: true },
      });

      for (const unit of expiringUnits) {
        for (const m of managers) {
          await notifRepo.create({
            userId: m.id,
            type: "IT_ASSET_EXPIRY_SOON",
            title: "IT 자산 만료 임박",
            body: `${unit.item.name} (${unit.serialNumber ?? `#${unit.id}`}) 만료 30일 전입니다.`,
          });
        }
      }
      for (const license of expiringLicenses) {
        for (const m of managers) {
          await notifRepo.create({
            userId: m.id,
            type: "IT_ASSET_EXPIRY_SOON",
            title: "라이선스 만료 임박",
            body: `${license.name} 라이선스 만료 30일 전입니다.`,
          });
        }
      }
    });
  }
  ```

- [x] **10.2 Create `apps/api/src/jobs/inventoryThreshold.ts`:**
  ```ts
  import cron from "node-cron";
  import { getPrisma } from "../lib/prisma";
  import { NotificationRepository } from "../notification/notification.repo";

  export function startInventoryThresholdJob() {
    cron.schedule("0 9 * * *", async () => {
      const prisma = getPrisma();
      const notifRepo = new NotificationRepository(prisma);

      // Prisma cannot compare two columns natively in a where clause without raw SQL,
      // so we fetch and filter in memory.
      const allItems = await prisma.facilityInventoryItem.findMany();
      const belowThreshold = allItems.filter(i => i.quantity <= i.minThreshold);

      const managers = await prisma.user.findMany({
        where: { frontOfficeRole: "FACILITY_MANAGER", isDeleted: false },
        select: { id: true },
      });

      for (const item of belowThreshold) {
        for (const m of managers) {
          await notifRepo.create({
            userId: m.id,
            type: "INVENTORY_LOW_STOCK",
            title: "재고 부족 경고",
            body: `${item.name} 재고가 ${item.quantity}${item.unit}로 임계치(${item.minThreshold}) 이하입니다.`,
          });
        }
      }
    });
  }
  ```

- [x] **10.3 Create `apps/api/src/jobs/monthlyDepreciation.ts`:**
  ```ts
  import cron from "node-cron";
  import { getPrisma } from "../lib/prisma";

  export function startMonthlyDepreciationJob() {
    cron.schedule("0 0 1 * *", async () => {
      const prisma = getPrisma();
      const units = await prisma.equipmentUnit.findMany({
        where: {
          status: { not: "RETIRED" },
          depreciationMethod: { not: null },
          bookValue: { not: null },
        },
      });

      for (const unit of units) {
        if (!unit.depreciationRate || !unit.bookValue) continue;
        let newBookValue: number;
        if (unit.depreciationMethod === "DECLINING_BALANCE") {
          newBookValue = Number(unit.bookValue) * (1 - Number(unit.depreciationRate));
        } else {
          const purchase = unit.purchaseValue ? Number(unit.purchaseValue) : 0;
          newBookValue = Math.max(0, Number(unit.bookValue) - purchase * Number(unit.depreciationRate));
        }
        if (newBookValue < 0) newBookValue = 0;
        await prisma.equipmentUnit.update({
          where: { id: unit.id },
          data: { bookValue: newBookValue },
        });
      }
    });
  }
  ```

- [x] **10.4 Register the 3 jobs in `apps/api/src/server.ts`.** Locate the block where existing jobs are started (e.g. `startContractExpiryJob()`), and add:
  ```ts
  import { startEquipmentExpiryAlertJob } from "./jobs/equipmentExpiryAlert";
  import { startInventoryThresholdJob } from "./jobs/inventoryThreshold";
  import { startMonthlyDepreciationJob } from "./jobs/monthlyDepreciation";
  // ...
  startEquipmentExpiryAlertJob();
  startInventoryThresholdJob();
  startMonthlyDepreciationJob();
  ```

- [x] **10.5 Verify:** `cd apps/api && npx tsc --noEmit`.

---

## Task 11: 타 팀 장부 자동 동기화 (LedgerEntry fire-and-forget)

**Files:**
- Modify: `apps/api/src/payroll/run/run.service.ts`
- Modify: `apps/api/src/equipment/equipment.service.ts`
- Modify: `apps/api/src/facility/maintenance/maintenance.service.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.service.ts` (only if it exists — `ls apps/api/src/sponsorship/` first; skip if not present)

Each service needs an injected `LedgerService`. The wiring change is: at the routes/module file where the service is constructed, pass the shared `ledgerService` from Task 6 (import via `import { ledgerService } from "../ledger/ledger.routes"` — or better, construct a fresh `LedgerService(new LedgerRepository(getPrisma()))` in each routes file to avoid circular imports).

### Steps

- [x] **11.1 Extend `RunService` in `apps/api/src/payroll/run/run.service.ts`.**
  - Update constructor to accept `LedgerService`: `constructor(private runRepo: RunRepository, private ledgerService: LedgerService) {}`.
  - Inside `secondApproveRun`, after a successful `runRepo.secondApprove(...)`, add:
    ```ts
    const updated = await this.runRepo.secondApprove(runId, userId);
    void this.ledgerService.createAutoEntry({
      type: "EXPENSE",
      category: "SALARY",
      amount: Number(updated.netPay),
      currency: "KRW",
      exchangeRate: 1,
      amountKrw: Number(updated.netPay),
      description: `급여 지급 - salaryId ${salaryId} runId ${runId}`,
      relatedModule: "payroll",
      relatedId: runId,
    }, userId).catch(err => console.error("[LedgerAutoEntry:payroll]", err));
    return updated;
    ```
  - Update the routes file that constructs `RunService` to pass a `LedgerService` instance.

- [x] **11.2 Extend `EquipmentService.transitionUnitStatus` in `equipment.service.ts`.**
  - Update constructor to inject `LedgerService`.
  - After the DB update, if the new status is `RETIRED`:
    ```ts
    if (dto.status === "RETIRED" && unit.bookValue) {
      void this.ledgerService.createAutoEntry({
        type: "EXPENSE",
        category: "EQUIPMENT_PURCHASE",
        amount: Number(unit.bookValue),
        currency: "KRW",
        exchangeRate: 1,
        amountKrw: Number(unit.bookValue),
        isRefund: true,
        description: `장비 폐기 - Unit #${unitId}`,
        relatedModule: "equipment",
        relatedId: unitId,
      }, userId).catch(err => console.error("[LedgerAutoEntry:equipment]", err));
    }
    ```

- [x] **11.3 Extend maintenance flow in `maintenance.service.ts`.**
  - Inject `LedgerService` into `MaintenanceService`.
  - Inside the method that transitions a maintenance record to `RESOLVED` (typically `gmApprove` or equivalent), after the update:
    ```ts
    const record = await this.repo.findById(id);
    if (record?.actualCost) {
      void this.ledgerService.createAutoEntry({
        type: "EXPENSE",
        category: "FACILITY_REPAIR",
        amount: Number(record.actualCost),
        currency: "KRW",
        exchangeRate: 1,
        amountKrw: Number(record.actualCost),
        description: `시설 수리 완료 - ${record.title}`,
        relatedModule: "facility",
        relatedId: id,
      }, userId).catch(err => console.error("[LedgerAutoEntry:facility]", err));
    }
    ```

- [x] **11.4 Sponsorship (optional).** Run `ls apps/api/src/sponsorship/sponsorship.service.ts` — if the file exists, locate where a sponsorship contract is signed/activated and add:
  ```ts
  void this.ledgerService.createAutoEntry({
    type: "INCOME",
    category: "SPONSORSHIP",
    amount: Number(contract.amount),
    currency: "KRW",
    exchangeRate: 1,
    amountKrw: Number(contract.amount),
    description: `스폰서십 - ${contract.sponsorName}`,
    relatedModule: "sponsorship",
    relatedId: contract.id,
  }, userId).catch(err => console.error("[LedgerAutoEntry:sponsorship]", err));
  ```
  If the file does not exist, skip this substep.

- [x] **11.5 Verify:** `cd apps/api && npx tsc --noEmit && npx jest` — all existing tests must still pass. The fire-and-forget calls are wrapped in `void … .catch(...)` so they cannot break the parent operation.

---

## Task 12: 전체 검증

### Steps

- [x] **12.1 Confirm every new router is registered** in `apps/api/src/apiRouter.ts`:
  ```ts
  import hrRouter from "./hr/hr.routes";
  import softwareLicenseRouter from "./software-license/software-license.routes";
  import ledgerRouter from "./ledger/ledger.routes";
  import salesRouter from "./sales/sales.routes";
  import inventoryRouter from "./inventory/inventory.routes";

  apiRouter.use("/hr", hrRouter);
  apiRouter.use("/software-licenses", softwareLicenseRouter);
  apiRouter.use("/ledger", ledgerRouter);
  apiRouter.use("/sales", salesRouter);
  apiRouter.use("/inventory", inventoryRouter);
  ```

- [x] **12.2 Typecheck:** `cd apps/api && npx tsc --noEmit` — expect 0 errors.

- [x] **12.3 Run full test suite:** `cd apps/api && npx jest --no-coverage` — expect all new tests pass, no regressions in existing tests.

- [x] **12.4 Smoke tests** — start the server (`npm run dev &`, wait 3s) and check auth guards:
  ```bash
  for path in /api/hr/documents /api/software-licenses /api/ledger /api/sales /api/inventory /api/inventory/alerts; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001$path")
    echo "$path -> $code"
  done
  # Every line should print 401.
  ```
  Also test that the new payroll/staff/facility routes require auth:
  ```bash
  curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/payroll/salaries/1/runs/1/second-approve
  # 401
  curl -s -o /dev/null -w "%{http_code}" -X PATCH http://localhost:3001/api/staff-records/1/terminate
  # 401
  curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/facility/maintenance/1/lock
  # 401
  curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/facility/maintenance/1/submit-finance
  # 401
  ```

- [x] **12.5 Stop the dev server:** `pkill -f "tsx.*server" || pkill -f "node.*server"`.

- [x] **12.6 Final review checklist:**
  - [x] All 12 tasks completed
  - [x] All new tests pass (Tasks 1, 2, 4, 5, 6, 7, 8, 9)
  - [x] No existing test regressions
  - [x] All 5 new routers registered in apiRouter.ts
  - [x] All 3 new cron jobs registered in server.ts
  - [x] Fire-and-forget ledger entries do not throw uncaught errors
  - [x] netPay is floored at 0 when raw computation is negative and error is thrown when raw < 0
  - [x] Equipment `isHighValue` auto-set at `purchaseValue >= 500000`
  - [x] Facility maintenance `submitToFinance` requires `estimatedCost >= 1_000_000`
  - [x] File upload accepts only `.pdf .docx .xlsx .hwp` at max 10MB

---

## Appendix: File Path Reference

| Concern | Path |
|---|---|
| Payroll run service | `apps/api/src/payroll/run/run.service.ts` |
| Payroll run repo | `apps/api/src/payroll/run/run.repo.ts` |
| Staff record service | `apps/api/src/staff-record/staff-record.service.ts` |
| Staff record repo | `apps/api/src/staff-record/staff-record.repo.ts` |
| Equipment service | `apps/api/src/equipment/equipment.service.ts` |
| Equipment repo | `apps/api/src/equipment/equipment.repo.ts` |
| Maintenance service | `apps/api/src/facility/maintenance/maintenance.service.ts` |
| Maintenance repo | `apps/api/src/facility/maintenance/maintenance.repo.ts` |
| Facility routes | `apps/api/src/facility/facility.routes.ts` |
| API router aggregator | `apps/api/src/apiRouter.ts` |
| Server bootstrap | `apps/api/src/server.ts` |
| AppError helper | `apps/api/src/lib/appError.ts` |
| Auth middleware | `apps/api/src/lib/authMiddleware.ts` |
| Prisma singleton | `apps/api/src/lib/prisma.ts` |
| Notification repo | `apps/api/src/notification/notification.repo.ts` |
| Existing cron reference | `apps/api/src/jobs/contractExpiry.ts` |
