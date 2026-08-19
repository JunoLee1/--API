# 예산 관리 Plan A — 편성·승인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 시즌별 예산 편성(BudgetHeader + BudgetLine)과 DRAFT→SUBMITTED→APPROVED 승인 워크플로우, 조정(BudgetAdjustment)을 구현하고, 가용예산을 실시간으로 계산·조회한다.

**Architecture:** 기존 `FinancialReport`(운영비 Knapsack 최적화)와 별도 모듈 `budget-control`로 분리한다. BudgetHeader는 시즌별 버전 관리된 예산이고, BudgetLine은 부서×카테고리×월 차원의 세부 라인, BudgetAdjustment는 증액·삭감·전용에 대한 승인 이력이다. 가용예산 = 승인예산 + 승인 증액 − 삭감 − 이후 Plan B에서 집행예정·실집행이 추가된다.

**Tech Stack:** Node.js/Express/TypeScript, Prisma (PostgreSQL), React/Vite, Jest

---

## File Map

**Backend (apps/api/):**
- Create: `apps/api/src/budget-control/dto/budget-control.dto.ts`
- Create: `apps/api/src/budget-control/budget-control.repo.ts`
- Create: `apps/api/src/budget-control/budget-control.service.ts`
- Create: `apps/api/src/budget-control/budget-control.controller.ts`
- Create: `apps/api/src/budget-control/budget-control.routes.ts`
- Create: `apps/api/__test__/budget-control/budget-control.service.test.ts`
- Modify: `apps/api/prisma/schema.prisma` — 3 new models, 3 new enums, Season/User/Department relations 추가
- Modify: `apps/api/src/apiRouter.ts` — `/budget-control` 라우트 등록

**Frontend (football/src/):**
- Create: `football/src/types/budget-control.ts`
- Create: `football/src/services/budgetControl.service.ts`
- Create: `football/src/pages/finance/BudgetListPage.tsx`
- Create: `football/src/pages/finance/BudgetDetailPage.tsx`
- Modify: `football/src/router.tsx` (또는 라우터 파일) — 페이지 경로 등록

---

## Task 1: Prisma 스키마 — 모델 3개 + 열거형 3개

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: 열거형 3개 추가**

`apps/api/prisma/schema.prisma` 파일 하단 (OperatingCategory enum 바로 아래)에 추가:

```prisma
enum BudgetStatus {
  DRAFT
  SUBMITTED
  APPROVED
  LOCKED
}

enum AdjustmentType {
  CARRYOVER
  INCREASE
  DECREASE
  TRANSFER
}

enum AdjustmentStatus {
  PENDING
  APPROVED
  REJECTED
}
```

- [x] **Step 2: BudgetHeader 모델 추가**

```prisma
model BudgetHeader {
  id           Int               @id @default(autoincrement())
  seasonId     Int
  version      Int               @default(1)
  status       BudgetStatus      @default(DRAFT)
  name         String
  totalBudget  Int               @default(0)
  note         String?
  createdById  Int
  approvedById Int?
  approvedAt   DateTime?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  season       Season            @relation(fields: [seasonId], references: [id])
  createdBy    User              @relation("BudgetHeaderCreator", fields: [createdById], references: [id])
  approvedBy   User?             @relation("BudgetHeaderApprover", fields: [approvedById], references: [id])
  lines        BudgetLine[]
  adjustments  BudgetAdjustment[]

  @@unique([seasonId, version])
}
```

- [x] **Step 3: BudgetLine 모델 추가**

```prisma
model BudgetLine {
  id             Int          @id @default(autoincrement())
  budgetHeaderId Int
  departmentId   Int?
  category       String
  year           Int
  month          Int?
  originalAmount Int          @default(0)
  note           String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  budgetHeader   BudgetHeader @relation(fields: [budgetHeaderId], references: [id], onDelete: Cascade)
  department     Department?  @relation(fields: [departmentId], references: [id])
}
```

- [x] **Step 4: BudgetAdjustment 모델 추가**

```prisma
model BudgetAdjustment {
  id             Int              @id @default(autoincrement())
  budgetHeaderId Int
  type           AdjustmentType
  amount         Int
  fromLineId     Int?
  toLineId       Int?
  reason         String
  status         AdjustmentStatus @default(PENDING)
  approvedById   Int?
  approvedAt     DateTime?
  createdById    Int
  createdAt      DateTime         @default(now())
  budgetHeader   BudgetHeader     @relation(fields: [budgetHeaderId], references: [id], onDelete: Cascade)
  createdBy      User             @relation("AdjustmentCreator", fields: [createdById], references: [id])
  approvedBy     User?            @relation("AdjustmentApprover", fields: [approvedById], references: [id])
}
```

- [x] **Step 5: Season 모델에 relation 추가**

`model Season` 블록 안 `financialReport FinancialReport?` 줄 바로 아래에:

```prisma
  budgetHeaders            BudgetHeader[]
```

- [x] **Step 6: User 모델에 relation 추가**

`model User` 블록 안 기존 relation 목록 하단에:

```prisma
  budgetHeadersCreated     BudgetHeader[]     @relation("BudgetHeaderCreator")
  budgetHeadersApproved    BudgetHeader[]     @relation("BudgetHeaderApprover")
  adjustmentsCreated       BudgetAdjustment[] @relation("AdjustmentCreator")
  adjustmentsApproved      BudgetAdjustment[] @relation("AdjustmentApprover")
```

- [x] **Step 7: Department 모델에 relation 추가**

`model Department` 블록 안 기존 relation 목록 하단에:

```prisma
  budgetLines              BudgetLine[]
```

- [x] **Step 8: 마이그레이션 실행**

```bash
cd apps/api
npx prisma migrate dev --name add_budget_control
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [x] **Step 9: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(schema): add BudgetHeader, BudgetLine, BudgetAdjustment models"
```

---

## Task 2: DTO 타입 정의

**Files:**
- Create: `apps/api/src/budget-control/dto/budget-control.dto.ts`

- [x] **Step 1: DTO 파일 생성**

```typescript
export interface CreateBudgetHeaderDto {
  seasonId: number;
  name: string;
  totalBudget: number;
  note?: string;
}

export interface UpdateBudgetHeaderDto {
  name?: string;
  totalBudget?: number;
  note?: string;
}

export interface CreateBudgetLineDto {
  departmentId?: number;
  category: string;
  year: number;
  month?: number;
  originalAmount: number;
  note?: string;
}

export interface UpdateBudgetLineDto {
  originalAmount?: number;
  note?: string;
}

export interface CreateAdjustmentDto {
  type: 'CARRYOVER' | 'INCREASE' | 'DECREASE' | 'TRANSFER';
  amount: number;
  fromLineId?: number;
  toLineId?: number;
  reason: string;
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/budget-control/
git commit -m "feat(budget-control): add DTOs"
```

---

## Task 3: Repository

**Files:**
- Create: `apps/api/src/budget-control/budget-control.repo.ts`

- [x] **Step 1: Repo 파일 생성**

```typescript
import type { PrismaClient } from "../generated/client";
import type { CreateBudgetHeaderDto, CreateBudgetLineDto, CreateAdjustmentDto } from "./dto/budget-control.dto";

export class BudgetControlRepository {
  constructor(private prisma: PrismaClient) {}

  createHeader(dto: CreateBudgetHeaderDto, createdById: number) {
    return this.prisma.budgetHeader.create({
      data: {
        seasonId: dto.seasonId,
        name: dto.name,
        totalBudget: dto.totalBudget,
        note: dto.note,
        createdById,
      },
      include: { lines: true, adjustments: true },
    });
  }

  findAll(seasonId?: number) {
    return this.prisma.budgetHeader.findMany({
      where: seasonId ? { seasonId } : undefined,
      include: { season: { select: { id: true, name: true } }, createdBy: { select: { id: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.budgetHeader.findUnique({
      where: { id },
      include: {
        lines: { include: { department: { select: { id: true, name: true } } } },
        adjustments: {
          include: {
            createdBy: { select: { id: true, username: true } },
            approvedBy: { select: { id: true, username: true } },
          },
        },
        season: { select: { id: true, name: true } },
        createdBy: { select: { id: true, username: true } },
        approvedBy: { select: { id: true, username: true } },
      },
    });
  }

  updateStatus(id: number, status: "SUBMITTED" | "APPROVED" | "LOCKED", approverId?: number) {
    return this.prisma.budgetHeader.update({
      where: { id },
      data: {
        status,
        ...(status === "APPROVED" && approverId
          ? { approvedById: approverId, approvedAt: new Date() }
          : {}),
      },
    });
  }

  updateHeader(id: number, data: { name?: string; totalBudget?: number; note?: string }) {
    return this.prisma.budgetHeader.update({ where: { id }, data });
  }

  createLine(budgetHeaderId: number, dto: CreateBudgetLineDto) {
    return this.prisma.budgetLine.create({ data: { budgetHeaderId, ...dto } });
  }

  updateLine(lineId: number, data: { originalAmount?: number; note?: string }) {
    return this.prisma.budgetLine.update({ where: { id: lineId }, data });
  }

  deleteLine(lineId: number) {
    return this.prisma.budgetLine.delete({ where: { id: lineId } });
  }

  createAdjustment(budgetHeaderId: number, dto: CreateAdjustmentDto, createdById: number) {
    return this.prisma.budgetAdjustment.create({
      data: { budgetHeaderId, ...dto, createdById },
      include: { createdBy: { select: { id: true, username: true } } },
    });
  }

  updateAdjustmentStatus(id: number, status: "APPROVED" | "REJECTED", approverId: number) {
    return this.prisma.budgetAdjustment.update({
      where: { id },
      data: {
        status,
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });
  }

  sumApprovedAdjustments(budgetHeaderId: number) {
    return this.prisma.budgetAdjustment.groupBy({
      by: ["type"],
      where: { budgetHeaderId, status: "APPROVED" },
      _sum: { amount: true },
    });
  }
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/budget-control/
git commit -m "feat(budget-control): add repository"
```

---

## Task 4: Service + 단위 테스트

**Files:**
- Create: `apps/api/src/budget-control/budget-control.service.ts`
- Create: `apps/api/__test__/budget-control/budget-control.service.test.ts`

- [x] **Step 1: 테스트 파일 먼저 작성 (TDD)**

```typescript
// apps/api/__test__/budget-control/budget-control.service.test.ts
import { BudgetControlService } from "../../src/budget-control/budget-control.service";
import { AppError } from "../../src/lib/appError";
import type { BudgetControlRepository } from "../../src/budget-control/budget-control.repo";

const makeHeader = (overrides = {}) => ({
  id: 1, seasonId: 1, version: 1, status: "DRAFT", name: "2026시즌", totalBudget: 100_000_000,
  note: null, createdById: 1, approvedById: null, approvedAt: null, createdAt: new Date(), updatedAt: new Date(),
  lines: [], adjustments: [], season: { id: 1, name: "2026" }, createdBy: { id: 1, username: "admin" }, approvedBy: null,
  ...overrides,
});

const makeRepo = (overrides: Partial<BudgetControlRepository> = {}): BudgetControlRepository => ({
  createHeader: jest.fn().mockResolvedValue(makeHeader()),
  findAll: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(null),
  updateStatus: jest.fn().mockResolvedValue(makeHeader()),
  updateHeader: jest.fn().mockResolvedValue(makeHeader()),
  createLine: jest.fn().mockResolvedValue({}),
  updateLine: jest.fn().mockResolvedValue({}),
  deleteLine: jest.fn().mockResolvedValue({}),
  createAdjustment: jest.fn().mockResolvedValue({}),
  updateAdjustmentStatus: jest.fn().mockResolvedValue({}),
  sumApprovedAdjustments: jest.fn().mockResolvedValue([]),
  ...overrides,
} as unknown as BudgetControlRepository);

const makeService = (repo: BudgetControlRepository) => new BudgetControlService(repo);

describe("BudgetControlService.getAvailableBudget", () => {
  it("returns totalBudget when no adjustments", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeHeader()) });
    const result = await makeService(repo).getAvailableBudget(1);
    expect(result.available).toBe(100_000_000);
  });

  it("adds approved INCREASE adjustments", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeHeader()),
      sumApprovedAdjustments: jest.fn().mockResolvedValue([
        { type: "INCREASE", _sum: { amount: 10_000_000 } },
      ]),
    });
    const result = await makeService(repo).getAvailableBudget(1);
    expect(result.available).toBe(110_000_000);
  });

  it("subtracts approved DECREASE adjustments", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeHeader()),
      sumApprovedAdjustments: jest.fn().mockResolvedValue([
        { type: "DECREASE", _sum: { amount: 5_000_000 } },
      ]),
    });
    const result = await makeService(repo).getAvailableBudget(1);
    expect(result.available).toBe(95_000_000);
  });

  it("throws 404 when header not found", async () => {
    await expect(makeService(makeRepo()).getAvailableBudget(99))
      .rejects.toThrow(new AppError(404, "BUDGET_NOT_FOUND"));
  });
});

describe("BudgetControlService.submit", () => {
  it("throws 400 when already APPROVED", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeHeader({ status: "APPROVED" })) });
    await expect(makeService(repo).submit(1, 1)).rejects.toThrow(new AppError(400, "BUDGET_ALREADY_APPROVED"));
  });

  it("throws 400 when totalBudget is 0", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeHeader({ totalBudget: 0 })) });
    await expect(makeService(repo).submit(1, 1)).rejects.toThrow(new AppError(400, "BUDGET_AMOUNT_REQUIRED"));
  });

  it("calls updateStatus with SUBMITTED", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeHeader()) });
    await makeService(repo).submit(1, 1);
    expect(repo.updateStatus).toHaveBeenCalledWith(1, "SUBMITTED");
  });
});

describe("BudgetControlService.approve", () => {
  it("throws 400 when not SUBMITTED", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeHeader({ status: "DRAFT" })) });
    await expect(makeService(repo).approve(1, 2)).rejects.toThrow(new AppError(400, "BUDGET_NOT_SUBMITTED"));
  });

  it("calls updateStatus with APPROVED and approverId", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeHeader({ status: "SUBMITTED" })) });
    await makeService(repo).approve(1, 2);
    expect(repo.updateStatus).toHaveBeenCalledWith(1, "APPROVED", 2);
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api
npx jest __test__/budget-control/budget-control.service.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/budget-control/budget-control.service'`

- [x] **Step 3: Service 구현**

```typescript
// apps/api/src/budget-control/budget-control.service.ts
import { AppError } from "../lib/appError";
import type { BudgetControlRepository } from "./budget-control.repo";
import type { CreateBudgetHeaderDto, UpdateBudgetHeaderDto, CreateBudgetLineDto, UpdateBudgetLineDto, CreateAdjustmentDto } from "./dto/budget-control.dto";

export class BudgetControlService {
  constructor(private repo: BudgetControlRepository) {}

  async create(dto: CreateBudgetHeaderDto, createdById: number) {
    if (dto.totalBudget < 0) throw new AppError(400, "INVALID_BUDGET");
    return this.repo.createHeader(dto, createdById);
  }

  getAll(seasonId?: number) {
    return this.repo.findAll(seasonId);
  }

  async getById(id: number) {
    const header = await this.repo.findById(id);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    return header;
  }

  async update(id: number, dto: UpdateBudgetHeaderDto) {
    const header = await this.repo.findById(id);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "APPROVED" || header.status === "LOCKED")
      throw new AppError(400, "BUDGET_ALREADY_APPROVED");
    return this.repo.updateHeader(id, dto);
  }

  async submit(id: number, userId: number) {
    const header = await this.repo.findById(id);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "APPROVED" || header.status === "LOCKED")
      throw new AppError(400, "BUDGET_ALREADY_APPROVED");
    if (header.totalBudget <= 0) throw new AppError(400, "BUDGET_AMOUNT_REQUIRED");
    return this.repo.updateStatus(id, "SUBMITTED");
  }

  async approve(id: number, approverId: number) {
    const header = await this.repo.findById(id);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status !== "SUBMITTED") throw new AppError(400, "BUDGET_NOT_SUBMITTED");
    return this.repo.updateStatus(id, "APPROVED", approverId);
  }

  async getAvailableBudget(id: number) {
    const header = await this.repo.findById(id);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");

    const adjSums = await this.repo.sumApprovedAdjustments(id);
    const byType = Object.fromEntries(adjSums.map(r => [r.type, r._sum.amount ?? 0]));

    const approvedBudget = header.totalBudget;
    const carryover = byType["CARRYOVER"] ?? 0;
    const increase = byType["INCREASE"] ?? 0;
    const decrease = byType["DECREASE"] ?? 0;
    const available = approvedBudget + carryover + increase - decrease;

    return {
      headerId: id,
      status: header.status,
      approvedBudget,
      carryover,
      increase,
      decrease,
      commitment: 0,   // Plan B에서 채워짐
      actual: 0,       // Plan B에서 채워짐
      available,
    };
  }

  async addLine(headerId: number, dto: CreateBudgetLineDto) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "APPROVED" || header.status === "LOCKED")
      throw new AppError(400, "BUDGET_ALREADY_APPROVED");
    return this.repo.createLine(headerId, dto);
  }

  async updateLine(headerId: number, lineId: number, dto: UpdateBudgetLineDto) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "APPROVED" || header.status === "LOCKED")
      throw new AppError(400, "BUDGET_ALREADY_APPROVED");
    const line = header.lines.find(l => l.id === lineId);
    if (!line) throw new AppError(404, "BUDGET_LINE_NOT_FOUND");
    return this.repo.updateLine(lineId, dto);
  }

  async deleteLine(headerId: number, lineId: number) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "APPROVED" || header.status === "LOCKED")
      throw new AppError(400, "BUDGET_ALREADY_APPROVED");
    const line = header.lines.find(l => l.id === lineId);
    if (!line) throw new AppError(404, "BUDGET_LINE_NOT_FOUND");
    return this.repo.deleteLine(lineId);
  }

  async requestAdjustment(headerId: number, dto: CreateAdjustmentDto, createdById: number) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    if (header.status === "DRAFT") throw new AppError(400, "BUDGET_NOT_APPROVED");
    if (dto.amount <= 0) throw new AppError(400, "INVALID_ADJUSTMENT_AMOUNT");
    return this.repo.createAdjustment(headerId, dto, createdById);
  }

  async approveAdjustment(headerId: number, adjId: number, approverId: number) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    const adj = header.adjustments.find(a => a.id === adjId);
    if (!adj) throw new AppError(404, "ADJUSTMENT_NOT_FOUND");
    if (adj.status !== "PENDING") throw new AppError(400, "ADJUSTMENT_NOT_PENDING");
    return this.repo.updateAdjustmentStatus(adjId, "APPROVED", approverId);
  }

  async rejectAdjustment(headerId: number, adjId: number, approverId: number) {
    const header = await this.repo.findById(headerId);
    if (!header) throw new AppError(404, "BUDGET_NOT_FOUND");
    const adj = header.adjustments.find(a => a.id === adjId);
    if (!adj) throw new AppError(404, "ADJUSTMENT_NOT_FOUND");
    if (adj.status !== "PENDING") throw new AppError(400, "ADJUSTMENT_NOT_PENDING");
    return this.repo.updateAdjustmentStatus(adjId, "REJECTED", approverId);
  }
}
```

- [x] **Step 4: 테스트 통과 확인**

```bash
cd apps/api
npx jest __test__/budget-control/budget-control.service.test.ts --no-coverage
```

Expected: PASS (9 tests)

- [x] **Step 5: Commit**

```bash
git add apps/api/src/budget-control/ apps/api/__test__/budget-control/
git commit -m "feat(budget-control): add service with available budget formula and tests"
```

---

## Task 5: Controller + Routes + apiRouter 등록

**Files:**
- Create: `apps/api/src/budget-control/budget-control.controller.ts`
- Create: `apps/api/src/budget-control/budget-control.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: Controller 작성**

```typescript
// apps/api/src/budget-control/budget-control.controller.ts
import type { Request, Response, NextFunction } from "express";
import type { BudgetControlService } from "./budget-control.service";

export class BudgetControlController {
  constructor(private service: BudgetControlService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.create(req.body, req.user!.id));
    } catch (e) { next(e); }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seasonId = req.query.seasonId ? Number(req.query.seasonId) : undefined;
      res.json(await this.service.getAll(seasonId));
    } catch (e) { next(e); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params.id)));
    } catch (e) { next(e); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.update(Number(req.params.id), req.body));
    } catch (e) { next(e); }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.submit(Number(req.params.id), req.user!.id));
    } catch (e) { next(e); }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.approve(Number(req.params.id), req.user!.id));
    } catch (e) { next(e); }
  };

  getAvailableBudget = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getAvailableBudget(Number(req.params.id)));
    } catch (e) { next(e); }
  };

  addLine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.addLine(Number(req.params.id), req.body));
    } catch (e) { next(e); }
  };

  updateLine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.updateLine(Number(req.params.id), Number(req.params.lineId), req.body));
    } catch (e) { next(e); }
  };

  deleteLine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteLine(Number(req.params.id), Number(req.params.lineId));
      res.status(204).send();
    } catch (e) { next(e); }
  };

  requestAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.requestAdjustment(Number(req.params.id), req.body, req.user!.id));
    } catch (e) { next(e); }
  };

  approveAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.approveAdjustment(Number(req.params.id), Number(req.params.adjId), req.user!.id));
    } catch (e) { next(e); }
  };

  rejectAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.rejectAdjustment(Number(req.params.id), Number(req.params.adjId), req.user!.id));
    } catch (e) { next(e); }
  };
}
```

- [x] **Step 2: Routes 작성**

```typescript
// apps/api/src/budget-control/budget-control.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { auth } from "../lib/authMiddleware";
import { AppError } from "../lib/appError";
import { canReadFinance, canWriteFinance } from "../lib/permissions";
import { getPrisma } from "../lib/prisma";
import { BudgetControlRepository } from "./budget-control.repo";
import { BudgetControlService } from "./budget-control.service";
import { BudgetControlController } from "./budget-control.controller";

const router = Router();
const repo = new BudgetControlRepository(getPrisma());
const service = new BudgetControlService(repo);
const controller = new BudgetControlController(service);

const checkRead = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canReadFinance(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
};

const checkWrite = (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteFinance(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
};

router.get("/",                                auth, checkRead,  controller.getAll);
router.post("/",                               auth, checkWrite, controller.create);
router.get("/:id",                             auth, checkRead,  controller.getById);
router.patch("/:id",                           auth, checkWrite, controller.update);
router.get("/:id/available",                   auth, checkRead,  controller.getAvailableBudget);
router.post("/:id/submit",                     auth, checkWrite, controller.submit);
router.post("/:id/approve",                    auth, checkWrite, controller.approve);
router.post("/:id/lines",                      auth, checkWrite, controller.addLine);
router.patch("/:id/lines/:lineId",             auth, checkWrite, controller.updateLine);
router.delete("/:id/lines/:lineId",            auth, checkWrite, controller.deleteLine);
router.post("/:id/adjustments",                auth, checkWrite, controller.requestAdjustment);
router.post("/:id/adjustments/:adjId/approve", auth, checkWrite, controller.approveAdjustment);
router.post("/:id/adjustments/:adjId/reject",  auth, checkWrite, controller.rejectAdjustment);

export default router;
```

- [x] **Step 3: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts` 파일에서 기존 import 목록 마지막에 추가:

```typescript
import budgetControlRouter from "./budget-control/budget-control.routes";
```

그리고 `apiRouter.use(...)` 목록 마지막에 추가:

```typescript
apiRouter.use("/budget-control", budgetControlRouter);
```

- [x] **Step 4: TypeScript 컴파일 확인**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 5: Commit**

```bash
git add apps/api/src/budget-control/ apps/api/src/apiRouter.ts
git commit -m "feat(budget-control): add controller, routes, register in apiRouter"
```

---

## Task 6: FE 타입 + API 서비스

**Files:**
- Create: `football/src/types/budget-control.ts`
- Create: `football/src/services/budgetControl.service.ts`

- [x] **Step 1: 타입 파일 생성**

```typescript
// football/src/types/budget-control.ts
export type BudgetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LOCKED'
export type AdjustmentType = 'CARRYOVER' | 'INCREASE' | 'DECREASE' | 'TRANSFER'
export type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface BudgetLine {
  id: number
  budgetHeaderId: number
  departmentId: number | null
  department: { id: number; name: string } | null
  category: string
  year: number
  month: number | null
  originalAmount: number
  note: string | null
  createdAt: string
}

export interface BudgetAdjustment {
  id: number
  budgetHeaderId: number
  type: AdjustmentType
  amount: number
  fromLineId: number | null
  toLineId: number | null
  reason: string
  status: AdjustmentStatus
  createdBy: { id: number; username: string }
  approvedBy: { id: number; username: string } | null
  approvedAt: string | null
  createdAt: string
}

export interface BudgetHeader {
  id: number
  seasonId: number
  season: { id: number; name: string }
  version: number
  status: BudgetStatus
  name: string
  totalBudget: number
  note: string | null
  createdBy: { id: number; username: string }
  approvedBy: { id: number; username: string } | null
  approvedAt: string | null
  lines: BudgetLine[]
  adjustments: BudgetAdjustment[]
  createdAt: string
  updatedAt: string
}

export interface BudgetHeaderSummary {
  id: number
  seasonId: number
  season: { id: number; name: string }
  version: number
  status: BudgetStatus
  name: string
  totalBudget: number
  createdBy: { id: number; username: string }
  createdAt: string
}

export interface AvailableBudget {
  headerId: number
  status: BudgetStatus
  approvedBudget: number
  carryover: number
  increase: number
  decrease: number
  commitment: number
  actual: number
  available: number
}
```

- [x] **Step 2: API 서비스 파일 생성**

```typescript
// football/src/services/budgetControl.service.ts
import { api } from './api'
import type { BudgetHeader, BudgetHeaderSummary, BudgetLine, BudgetAdjustment, AvailableBudget } from '@/types/budget-control'

export const budgetControlApi = {
  getAll: (seasonId?: number) => {
    const q = seasonId ? `?seasonId=${seasonId}` : ''
    return api.get<BudgetHeaderSummary[]>(`/budget-control${q}`)
  },
  getById: (id: number) =>
    api.get<BudgetHeader>(`/budget-control/${id}`),
  create: (data: { seasonId: number; name: string; totalBudget: number; note?: string }) =>
    api.post<BudgetHeader>('/budget-control', data),
  update: (id: number, data: { name?: string; totalBudget?: number; note?: string }) =>
    api.patch<BudgetHeader>(`/budget-control/${id}`, data),
  submit: (id: number) =>
    api.post<BudgetHeader>(`/budget-control/${id}/submit`, {}),
  approve: (id: number) =>
    api.post<BudgetHeader>(`/budget-control/${id}/approve`, {}),
  getAvailable: (id: number) =>
    api.get<AvailableBudget>(`/budget-control/${id}/available`),
  addLine: (id: number, data: { category: string; year: number; month?: number; originalAmount: number; departmentId?: number; note?: string }) =>
    api.post<BudgetLine>(`/budget-control/${id}/lines`, data),
  updateLine: (id: number, lineId: number, data: { originalAmount?: number; note?: string }) =>
    api.patch<BudgetLine>(`/budget-control/${id}/lines/${lineId}`, data),
  deleteLine: (id: number, lineId: number) =>
    api.delete(`/budget-control/${id}/lines/${lineId}`),
  requestAdjustment: (id: number, data: { type: string; amount: number; reason: string; fromLineId?: number; toLineId?: number }) =>
    api.post<BudgetAdjustment>(`/budget-control/${id}/adjustments`, data),
  approveAdjustment: (id: number, adjId: number) =>
    api.post<BudgetAdjustment>(`/budget-control/${id}/adjustments/${adjId}/approve`, {}),
  rejectAdjustment: (id: number, adjId: number) =>
    api.post<BudgetAdjustment>(`/budget-control/${id}/adjustments/${adjId}/reject`, {}),
}
```

- [x] **Step 3: TypeScript 확인**

```bash
cd football
npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 4: Commit**

```bash
git add football/src/types/budget-control.ts football/src/services/budgetControl.service.ts
git commit -m "feat(fe/budget-control): add types and API service"
```

---

## Task 7: FE BudgetListPage

**Files:**
- Create: `football/src/pages/finance/BudgetListPage.tsx`

- [x] **Step 1: BudgetListPage 작성**

```typescript
// football/src/pages/finance/BudgetListPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { budgetControlApi } from '@/services/budgetControl.service'
import type { BudgetHeaderSummary, BudgetStatus } from '@/types/budget-control'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Plus } from 'lucide-react'

const STATUS_VARIANT: Record<BudgetStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline', SUBMITTED: 'secondary', APPROVED: 'default', LOCKED: 'destructive',
}

const STATUS_LABEL: Record<BudgetStatus, string> = {
  DRAFT: '초안', SUBMITTED: '결재 중', APPROVED: '확정', LOCKED: '잠금',
}

function CreateBudgetDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void
}) {
  const [seasonId, setSeasonId] = useState('')
  const [name, setName] = useState('')
  const [totalBudget, setTotalBudget] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!seasonId || !name || !totalBudget) { toast.error('모든 필드를 입력하세요.'); return }
    setSaving(true)
    try {
      await budgetControlApi.create({
        seasonId: Number(seasonId),
        name,
        totalBudget: Number(totalBudget.replace(/,/g, '')),
      })
      toast.success('예산이 등록됐습니다.')
      onCreated()
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '등록 실패')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>예산 편성</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>시즌 ID</Label>
            <Input type="number" value={seasonId} onChange={e => setSeasonId(e.target.value)} placeholder="예: 3" />
          </div>
          <div className="space-y-1.5">
            <Label>예산명</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="예: 2026시즌 운영예산" />
          </div>
          <div className="space-y-1.5">
            <Label>총 승인예산 (원)</Label>
            <Input
              inputMode="numeric"
              value={totalBudget ? Number(totalBudget.replace(/,/g, '')).toLocaleString('ko-KR') : ''}
              onChange={e => setTotalBudget(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="예: 500,000,000"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? '등록 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function BudgetListPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [budgets, setBudgets] = useState<BudgetHeaderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'FINANCE_MANAGER')

  const load = () => {
    setLoading(true)
    budgetControlApi.getAll().then(setBudgets).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">예산 관리</h1>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />예산 편성
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : (
        <div className="space-y-2">
          {budgets.map(b => (
            <div
              key={b.id}
              className="border rounded-lg p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30"
              onClick={() => navigate(`/finance/budget/${b.id}`)}
            >
              <div className="flex-1">
                <p className="font-medium">{b.name}</p>
                <p className="text-sm text-muted-foreground">
                  {b.season.name} · v{b.version} · {b.totalBudget.toLocaleString()}원 · {b.createdBy.username}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[b.status]}>{STATUS_LABEL[b.status]}</Badge>
            </div>
          ))}
          {budgets.length === 0 && <p className="text-muted-foreground">등록된 예산이 없습니다.</p>}
        </div>
      )}

      {canWrite && (
        <CreateBudgetDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      )}
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/finance/BudgetListPage.tsx
git commit -m "feat(fe/budget-control): add BudgetListPage"
```

---

## Task 8: FE BudgetDetailPage

**Files:**
- Create: `football/src/pages/finance/BudgetDetailPage.tsx`

- [x] **Step 1: BudgetDetailPage 작성**

```typescript
// football/src/pages/finance/BudgetDetailPage.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { budgetControlApi } from '@/services/budgetControl.service'
import type { BudgetHeader, BudgetLine, AvailableBudget, BudgetStatus, AdjustmentType } from '@/types/budget-control'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ArrowLeft, Plus } from 'lucide-react'

const STATUS_LABEL: Record<BudgetStatus, string> = {
  DRAFT: '초안', SUBMITTED: '결재 중', APPROVED: '확정', LOCKED: '잠금',
}

const ADJ_LABEL: Record<AdjustmentType, string> = {
  CARRYOVER: '이월', INCREASE: '증액', DECREASE: '삭감', TRANSFER: '전용',
}

function AddLineDialog({ headerId, open, onOpenChange, onAdded }: {
  headerId: number; open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void
}) {
  const [category, setCategory] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!category || !year || !amount) { toast.error('카테고리, 연도, 금액을 입력하세요.'); return }
    setSaving(true)
    try {
      await budgetControlApi.addLine(headerId, {
        category,
        year: Number(year),
        month: month ? Number(month) : undefined,
        originalAmount: Number(amount.replace(/,/g, '')),
        note: note || undefined,
      })
      toast.success('예산 라인이 추가됐습니다.')
      onAdded()
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '추가 실패')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>예산 라인 추가</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>카테고리</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="예: TRAVEL, MEDICAL" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>연도</Label>
              <Input type="number" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>월 (선택)</Label>
              <Input type="number" value={month} onChange={e => setMonth(e.target.value)} min={1} max={12} placeholder="전체" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>금액 (원)</Label>
            <Input
              inputMode="numeric"
              value={amount ? Number(amount.replace(/,/g, '')).toLocaleString('ko-KR') : ''}
              onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="예: 10,000,000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>비고</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? '추가 중...' : '추가'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [header, setHeader] = useState<BudgetHeader | null>(null)
  const [available, setAvailable] = useState<AvailableBudget | null>(null)
  const [loading, setLoading] = useState(true)
  const [addLineOpen, setAddLineOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'GM' ||
    (user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'FINANCE_MANAGER')

  const isDraft = header?.status === 'DRAFT'

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [h, av] = await Promise.all([
        budgetControlApi.getById(Number(id)),
        budgetControlApi.getAvailable(Number(id)),
      ])
      setHeader(h)
      setAvailable(av)
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [id])

  const handleSubmit = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      await budgetControlApi.submit(Number(id))
      toast.success('결재 요청됐습니다.')
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '실패')
    } finally { setSubmitting(false) }
  }

  const handleApprove = async () => {
    if (!id) return
    try {
      await budgetControlApi.approve(Number(id))
      toast.success('예산이 확정됐습니다.')
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '실패')
    }
  }

  const handleDeleteLine = async (line: BudgetLine) => {
    if (!id || !confirm(`"${line.category}" 라인을 삭제하시겠습니까?`)) return
    try {
      await budgetControlApi.deleteLine(Number(id), line.id)
      toast.success('삭제됐습니다.')
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">불러오는 중...</div>
  if (!header) return <div className="p-6 text-muted-foreground">예산을 찾을 수 없습니다.</div>

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/finance/budget')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{header.name}</h1>
            <Badge variant="outline">{STATUS_LABEL[header.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {header.season.name} · v{header.version} · 총 {header.totalBudget.toLocaleString()}원
          </p>
        </div>
        <div className="flex gap-2">
          {canWrite && isDraft && (
            <Button size="sm" variant="outline" onClick={handleSubmit} disabled={submitting}>
              결재 요청
            </Button>
          )}
          {canWrite && header.status === 'SUBMITTED' && (
            <Button size="sm" onClick={handleApprove}>확정</Button>
          )}
        </div>
      </div>

      {/* 가용예산 요약 */}
      {available && (
        <div className="border rounded-lg p-4 bg-muted/20">
          <h2 className="text-sm font-semibold mb-3">가용예산 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-muted-foreground">승인예산</p><p className="font-medium">{available.approvedBudget.toLocaleString()}원</p></div>
            <div><p className="text-muted-foreground">이월·증액</p><p className="font-medium text-green-600">+{(available.carryover + available.increase).toLocaleString()}원</p></div>
            <div><p className="text-muted-foreground">삭감·집행</p><p className="font-medium text-red-500">−{(available.decrease + available.commitment + available.actual).toLocaleString()}원</p></div>
            <div><p className="text-muted-foreground font-semibold">가용예산</p><p className="text-lg font-bold">{available.available.toLocaleString()}원</p></div>
          </div>
        </div>
      )}

      {/* 예산 라인 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">예산 라인</h2>
          {canWrite && isDraft && (
            <Button size="sm" onClick={() => setAddLineOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />라인 추가
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {header.lines.map(line => (
            <div key={line.id} className="border rounded p-3 flex items-center gap-3">
              <div className="flex-1">
                <span className="font-medium text-sm">{line.category}</span>
                <span className="text-muted-foreground text-xs ml-2">
                  {line.year}년 {line.month ? `${line.month}월` : '연간'}
                  {line.department ? ` · ${line.department.name}` : ''}
                </span>
              </div>
              <span className="font-medium text-sm">{line.originalAmount.toLocaleString()}원</span>
              {canWrite && isDraft && (
                <Button size="sm" variant="ghost" onClick={() => handleDeleteLine(line)} className="text-destructive hover:text-destructive">삭제</Button>
              )}
            </div>
          ))}
          {header.lines.length === 0 && <p className="text-sm text-muted-foreground">등록된 라인이 없습니다.</p>}
        </div>
      </div>

      {/* 조정 이력 */}
      <div>
        <h2 className="font-semibold mb-3">조정 이력</h2>
        <div className="space-y-2">
          {header.adjustments.map(adj => (
            <div key={adj.id} className="border rounded p-3 flex items-center gap-3 text-sm">
              <Badge variant="outline">{ADJ_LABEL[adj.type]}</Badge>
              <span className="flex-1">{adj.reason}</span>
              <span className="font-medium">{adj.amount.toLocaleString()}원</span>
              <Badge variant={adj.status === 'APPROVED' ? 'default' : adj.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                {adj.status === 'APPROVED' ? '승인' : adj.status === 'REJECTED' ? '반려' : '대기'}
              </Badge>
              {canWrite && adj.status === 'PENDING' && (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => budgetControlApi.approveAdjustment(header.id, adj.id).then(() => load())}>승인</Button>
                  <Button size="sm" variant="outline" onClick={() => budgetControlApi.rejectAdjustment(header.id, adj.id).then(() => load())}>반려</Button>
                </div>
              )}
            </div>
          ))}
          {header.adjustments.length === 0 && <p className="text-sm text-muted-foreground">조정 이력이 없습니다.</p>}
        </div>
      </div>

      {canWrite && isDraft && (
        <AddLineDialog headerId={header.id} open={addLineOpen} onOpenChange={setAddLineOpen} onAdded={load} />
      )}
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/finance/BudgetDetailPage.tsx
git commit -m "feat(fe/budget-control): add BudgetDetailPage with available budget view"
```

---

## Task 9: 라우터 등록

**Files:**
- Modify: 프론트엔드 라우터 파일 (보통 `football/src/router.tsx` 또는 `football/src/App.tsx`)

- [x] **Step 1: 라우터 파일 확인**

```bash
find football/src -name "router*" -o -name "App.tsx" | head -5
```

- [x] **Step 2: 라우트 추가**

라우터 파일에서 기존 finance 관련 import 바로 아래에:

```typescript
import BudgetListPage from './pages/finance/BudgetListPage'
import BudgetDetailPage from './pages/finance/BudgetDetailPage'
```

그리고 route 정의에 추가:

```typescript
{ path: '/finance/budget', element: <BudgetListPage /> },
{ path: '/finance/budget/:id', element: <BudgetDetailPage /> },
```

- [x] **Step 3: 사이드바/네비게이션에 메뉴 추가 (있다면)**

기존 재무 메뉴 항목 옆에 "예산 관리" 링크 추가 (`/finance/budget`).

- [x] **Step 4: TypeScript 확인**

```bash
cd football
npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 5: 최종 커밋 및 Push**

```bash
git add football/src/
git commit -m "feat(fe/budget-control): register routes for BudgetListPage and BudgetDetailPage"
git push
```

---

## Self-Review

**Spec coverage 확인:**

| 도메인 요구사항 | 구현 Task |
|----------------|----------|
| 예산 편성 (BudgetHeader 생성) | Task 3, 7 |
| 예산 승인 (DRAFT→SUBMITTED→APPROVED) | Task 4, 5, 8 |
| 예산 라인 (BudgetLine CRUD) | Task 3, 4, 5, 8 |
| 가용예산 실시간 계산 | Task 4 (`getAvailableBudget`) |
| 증액·삭감·전용 조정 (BudgetAdjustment) | Task 3, 4, 5, 8 |
| RBAC (FINANCE_MANAGER/ADMIN/GM만 쓰기) | Task 5 (routes) |
| 버전 관리 (`@@unique([seasonId, version])`) | Task 1 |
| 전 시즌 비교 참고 | ❌ Plan C에서 구현 |
| 이월 승인 (BudgetCarryover) | ❌ Plan C에서 구현 (BudgetAdjustment type=CARRYOVER로 임시 대응) |
| 집행예정·실집행 차감 | ❌ Plan B에서 구현 (getAvailableBudget에 commitment=0, actual=0 placeholder) |
| 월별 예산 관리 | ✅ BudgetLine.month 필드로 지원 |
| 대시보드 | ❌ Plan C에서 구현 |

**타입 일관성 확인:**
- `BudgetControlRepository.sumApprovedAdjustments()` → `{type, _sum: {amount}}[]` → service에서 `Object.fromEntries()` 변환 ✅
- `BudgetLine` FE 타입의 `department` 필드 → repo의 include에 `department: { select: { id, name } }` ✅
- `AvailableBudget.commitment`, `actual` → service에서 `0` 하드코딩, Plan B에서 실제 값으로 교체 ✅

---

> **Plan B** (BudgetCommitment + BudgetActual + LedgerEntry 연동)와 **Plan C** (BudgetCarryover + 전 시즌 비교 + 대시보드)는 이 Plan A 완료 후 별도 플랜으로 구현합니다.
