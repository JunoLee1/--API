# Facility Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FacilityInspection + MaintenanceRequest CRUD API 구현, ISSUE_FOUND 시 자동 유지보수 생성, EMERGENCY/RESOLVED 전체 스태프 알림 발송.

**Architecture:** 단일 `facility/` 모듈 아래 `inspection/`과 `maintenance/` 서브도메인 분리. InspectionService → MaintenanceService → NotificationService 단방향 의존. NotificationService에 `notifyFacilityEmergency` / `notifyFacilityResolved` 추가, NotificationRepository에 `createForAllStaff` 추가.

**Tech Stack:** Express, Prisma (PostgreSQL), Jest + mock repos, Socket.IO (getIO)

---

## File Map

| 경로 | 역할 |
|------|------|
| `apps/api/src/notification/notification.repo.ts` | `createForAllStaff` 메서드 추가 |
| `apps/api/src/notification/notification.service.ts` | `notifyFacilityEmergency`, `notifyFacilityResolved` 추가 |
| `apps/api/src/facility/inspection/dto/inspection.dto.ts` | DTO 타입 |
| `apps/api/src/facility/inspection/inspection.repo.ts` | Prisma 쿼리 |
| `apps/api/src/facility/inspection/inspection.service.ts` | 비즈니스 로직 (ISSUE_FOUND 연계) |
| `apps/api/src/facility/maintenance/dto/maintenance.dto.ts` | DTO 타입 |
| `apps/api/src/facility/maintenance/maintenance.repo.ts` | Prisma 쿼리 |
| `apps/api/src/facility/maintenance/maintenance.service.ts` | EMERGENCY/RESOLVED 알림 |
| `apps/api/src/facility/inspection/inspection.controller.ts` | HTTP 핸들러 |
| `apps/api/src/facility/maintenance/maintenance.controller.ts` | HTTP 핸들러 |
| `apps/api/src/facility/facility.routes.ts` | 두 서브라우터 통합 |
| `apps/api/src/apiRouter.ts` | `/api/facility` 등록 |
| `apps/api/__test__/facility/inspection.service.test.ts` | 서비스 유닛 테스트 |
| `apps/api/__test__/facility/maintenance.service.test.ts` | 서비스 유닛 테스트 |

---

## Task 1: Inspection DTO + Repo

**Files:**
- Create: `apps/api/src/facility/inspection/dto/inspection.dto.ts`
- Create: `apps/api/src/facility/inspection/inspection.repo.ts`

- [ ] **Step 1: inspection.dto.ts 작성**

```ts
import type { FacilityZone, InspectionType, InspectionResult } from "../../../generated/enums";

export interface CreateInspectionDto {
  type: InspectionType;
  facilityZone: FacilityZone;
  result: InspectionResult;
  isStatutory?: boolean;
  certificateUrl?: string;
  statutoryDeadline?: string;
  inspectedAt?: string;
  notes?: string;
}

export interface UpdateInspectionDto {
  type?: InspectionType;
  facilityZone?: FacilityZone;
  result?: InspectionResult;
  isStatutory?: boolean;
  certificateUrl?: string;
  statutoryDeadline?: string;
  inspectedAt?: string;
  notes?: string;
}

export interface InspectionListQuery {
  zone?: FacilityZone;
  type?: InspectionType;
  result?: InspectionResult;
}
```

- [ ] **Step 2: inspection.repo.ts 작성**

```ts
import type { PrismaClient } from "../../../generated/client";
import type { CreateInspectionDto, UpdateInspectionDto, InspectionListQuery } from "./dto/inspection.dto";

const INCLUDE = {
  inspectedBy: { select: { id: true, username: true } },
} as const;

export class InspectionRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: InspectionListQuery) {
    return this.prisma.facilityInspection.findMany({
      where: {
        ...(query.zone && { facilityZone: query.zone }),
        ...(query.type && { type: query.type }),
        ...(query.result && { result: query.result }),
      },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.facilityInspection.findUnique({ where: { id }, include: INCLUDE });
  }

  create(data: CreateInspectionDto & { inspectedById: number }) {
    return this.prisma.facilityInspection.create({
      data: {
        ...data,
        inspectedAt: data.inspectedAt ? new Date(data.inspectedAt) : new Date(),
        statutoryDeadline: data.statutoryDeadline ? new Date(data.statutoryDeadline) : undefined,
      },
      include: INCLUDE,
    });
  }

  update(id: number, data: UpdateInspectionDto) {
    return this.prisma.facilityInspection.update({
      where: { id },
      data: {
        ...data,
        ...(data.inspectedAt && { inspectedAt: new Date(data.inspectedAt) }),
        ...(data.statutoryDeadline && { statutoryDeadline: new Date(data.statutoryDeadline) }),
      },
      include: INCLUDE,
    });
  }
}
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/facility/inspection/
git commit -m "feat: add FacilityInspection DTO and repository"
```

---

## Task 2: Maintenance DTO + Repo

**Files:**
- Create: `apps/api/src/facility/maintenance/dto/maintenance.dto.ts`
- Create: `apps/api/src/facility/maintenance/maintenance.repo.ts`

- [ ] **Step 1: maintenance.dto.ts 작성**

```ts
import type { MaintenancePriority, MaintenanceStatus } from "../../../generated/enums";

export interface CreateMaintenanceDto {
  title: string;
  description: string;
  priority: MaintenancePriority;
  sourceInspectionId?: number;
  estimatedCost?: number;
}

export interface UpdateMaintenanceDto {
  title?: string;
  description?: string;
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;
  postIncidentReport?: string;
  estimatedCost?: number;
  actualCost?: number;
}

export interface MaintenanceListQuery {
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
}
```

- [ ] **Step 2: maintenance.repo.ts 작성**

```ts
import type { PrismaClient } from "../../../generated/client";
import type { CreateMaintenanceDto, UpdateMaintenanceDto, MaintenanceListQuery } from "./dto/maintenance.dto";

const INCLUDE = {
  createdBy: { select: { id: true, username: true } },
  sourceInspection: { select: { id: true, type: true, facilityZone: true } },
} as const;

export class MaintenanceRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: MaintenanceListQuery) {
    return this.prisma.maintenanceRequest.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.priority && { priority: query.priority }),
      },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.maintenanceRequest.findUnique({ where: { id }, include: INCLUDE });
  }

  create(data: CreateMaintenanceDto & { createdById: number }) {
    return this.prisma.maintenanceRequest.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        createdById: data.createdById,
        ...(data.sourceInspectionId && { sourceInspectionId: data.sourceInspectionId }),
        ...(data.estimatedCost !== undefined && { estimatedCost: data.estimatedCost }),
      },
      include: INCLUDE,
    });
  }

  update(id: number, data: UpdateMaintenanceDto & { resolvedAt?: Date }) {
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        ...data,
        ...(data.estimatedCost !== undefined && { estimatedCost: data.estimatedCost }),
        ...(data.actualCost !== undefined && { actualCost: data.actualCost }),
      },
      include: INCLUDE,
    });
  }
}
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/facility/maintenance/
git commit -m "feat: add MaintenanceRequest DTO and repository"
```

---

## Task 3: InspectionService + MaintenanceService TDD

**Files:**
- Create: `apps/api/src/facility/inspection/inspection.service.ts`
- Create: `apps/api/src/facility/maintenance/maintenance.service.ts`
- Test: `apps/api/__test__/facility/inspection.service.test.ts`
- Test: `apps/api/__test__/facility/maintenance.service.test.ts`

> Note: supertest in this project requires `(request as any).default(app)`. Service unit tests use mock repos and don't need supertest.

- [ ] **Step 1: maintenance.service 테스트 작성**

Create `apps/api/__test__/facility/maintenance.service.test.ts`:

```ts
import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { MaintenanceService } from "../../src/facility/maintenance/maintenance.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
} as any;

const mockNotificationService = {
  notifyFacilityEmergency: jest.fn(),
  notifyFacilityResolved: jest.fn(),
} as any;

const service = new MaintenanceService(mockRepo, mockNotificationService);
const userId = 1;

beforeEach(() => jest.clearAllMocks());

describe("MaintenanceService", () => {
  test("EMERGENCY priority로 생성 시 notifyFacilityEmergency를 호출한다", async () => {
    const created = { id: 5, title: "펌프 고장", priority: "EMERGENCY" };
    mockRepo.create.mockResolvedValue(created);

    await service.create({ title: "펌프 고장", description: "고장", priority: "EMERGENCY" }, userId);

    expect(mockNotificationService.notifyFacilityEmergency).toHaveBeenCalledWith("펌프 고장", 5);
  });

  test("NORMAL priority로 생성 시 알림을 발송하지 않는다", async () => {
    mockRepo.create.mockResolvedValue({ id: 6, title: "청소", priority: "NORMAL" });

    await service.create({ title: "청소", description: "청소 필요", priority: "NORMAL" }, userId);

    expect(mockNotificationService.notifyFacilityEmergency).not.toHaveBeenCalled();
  });

  test("status=RESOLVED 업데이트 시 notifyFacilityResolved를 호출하고 resolvedAt을 설정한다", async () => {
    const existing = { id: 7, status: "OPEN", title: "배수관 교체" };
    mockRepo.findById.mockResolvedValue(existing);
    mockRepo.update.mockResolvedValue({ ...existing, status: "RESOLVED", resolvedAt: new Date() });

    await service.update(7, { status: "RESOLVED" });

    expect(mockRepo.update).toHaveBeenCalledWith(7, expect.objectContaining({
      status: "RESOLVED",
      resolvedAt: expect.any(Date),
    }));
    expect(mockNotificationService.notifyFacilityResolved).toHaveBeenCalledWith("배수관 교체", 7);
  });

  test("이미 RESOLVED인 항목 업데이트 시 409를 던진다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 8, status: "RESOLVED" });

    await expect(service.update(8, { status: "IN_PROGRESS" })).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_RESOLVED",
    });
  });

  test("존재하지 않는 ID 조회 시 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.get(99)).rejects.toMatchObject({
      statusCode: 404,
      code: "MAINTENANCE_REQUEST_NOT_FOUND",
    });
  });
});
```

- [ ] **Step 2: inspection.service 테스트 작성**

Create `apps/api/__test__/facility/inspection.service.test.ts`:

```ts
import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { InspectionService } from "../../src/facility/inspection/inspection.service";

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
} as any;

const mockMaintenanceService = {
  create: jest.fn(),
} as any;

const service = new InspectionService(mockRepo, mockMaintenanceService);
const userId = 1;

beforeEach(() => jest.clearAllMocks());

describe("InspectionService", () => {
  test("result=OK 시 MaintenanceService.create를 호출하지 않는다", async () => {
    mockRepo.create.mockResolvedValue({ id: 1, facilityZone: "GROUND", result: "OK" });

    await service.create({ type: "DAILY", facilityZone: "GROUND", result: "OK" }, userId);

    expect(mockMaintenanceService.create).not.toHaveBeenCalled();
  });

  test("result=ISSUE_FOUND 시 MaintenanceService.create(EMERGENCY)를 호출한다", async () => {
    const inspection = { id: 10, facilityZone: "MECHANICAL", notes: "균열 발견", result: "ISSUE_FOUND" };
    mockRepo.create.mockResolvedValue(inspection);
    mockMaintenanceService.create.mockResolvedValue({ id: 20 });

    await service.create({ type: "MONTHLY", facilityZone: "MECHANICAL", result: "ISSUE_FOUND", notes: "균열 발견" }, userId);

    expect(mockMaintenanceService.create).toHaveBeenCalledWith(
      {
        title: "[자동] MECHANICAL 구역 점검 이상 감지",
        description: "균열 발견",
        priority: "EMERGENCY",
        sourceInspectionId: 10,
      },
      userId,
    );
  });

  test("result=ISSUE_FOUND이고 notes 없을 시 description을 빈 문자열로 한다", async () => {
    const inspection = { id: 11, facilityZone: "SAFETY", notes: null, result: "ISSUE_FOUND" };
    mockRepo.create.mockResolvedValue(inspection);
    mockMaintenanceService.create.mockResolvedValue({ id: 21 });

    await service.create({ type: "DAILY", facilityZone: "SAFETY", result: "ISSUE_FOUND" }, userId);

    expect(mockMaintenanceService.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: "" }),
      userId,
    );
  });

  test("존재하지 않는 ID 조회 시 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.get(99)).rejects.toMatchObject({
      statusCode: 404,
      code: "INSPECTION_NOT_FOUND",
    });
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/facility --no-coverage
```

Expected: FAIL (구현 파일 없음)

- [ ] **Step 4: maintenance.service.ts 구현**

Create `apps/api/src/facility/maintenance/maintenance.service.ts`:

```ts
import { AppError } from "../../lib/appError";
import { NotificationService } from "../../notification/notification.service";
import type { MaintenanceRepository } from "./maintenance.repo";
import type { CreateMaintenanceDto, UpdateMaintenanceDto, MaintenanceListQuery } from "./dto/maintenance.dto";

export class MaintenanceService {
  constructor(
    private repo: MaintenanceRepository,
    private notifications: NotificationService,
  ) {}

  list(query: MaintenanceListQuery) {
    return this.repo.findAll(query);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "MAINTENANCE_REQUEST_NOT_FOUND");
    return record;
  }

  async create(dto: CreateMaintenanceDto, createdById: number) {
    const record = await this.repo.create({ ...dto, createdById });
    if (record.priority === "EMERGENCY") {
      void this.notifications.notifyFacilityEmergency(record.title, record.id).catch(console.error);
    }
    return record;
  }

  async update(id: number, dto: UpdateMaintenanceDto) {
    const existing = await this.get(id);
    if (existing.status === "RESOLVED") throw new AppError(409, "ALREADY_RESOLVED");

    const resolvedAt = dto.status === "RESOLVED" ? new Date() : undefined;
    const record = await this.repo.update(id, { ...dto, ...(resolvedAt && { resolvedAt }) });

    if (dto.status === "RESOLVED") {
      void this.notifications.notifyFacilityResolved(existing.title, id).catch(console.error);
    }
    return record;
  }
}
```

- [ ] **Step 5: inspection.service.ts 구현**

Create `apps/api/src/facility/inspection/inspection.service.ts`:

```ts
import { AppError } from "../../lib/appError";
import type { InspectionRepository } from "./inspection.repo";
import type { MaintenanceService } from "../maintenance/maintenance.service";
import type { CreateInspectionDto, UpdateInspectionDto, InspectionListQuery } from "./dto/inspection.dto";

export class InspectionService {
  constructor(
    private repo: InspectionRepository,
    private maintenanceService: MaintenanceService,
  ) {}

  list(query: InspectionListQuery) {
    return this.repo.findAll(query);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "INSPECTION_NOT_FOUND");
    return record;
  }

  async create(dto: CreateInspectionDto, inspectedById: number) {
    const record = await this.repo.create({ ...dto, inspectedById });

    if (record.result === "ISSUE_FOUND") {
      const maintenance = await this.maintenanceService.create(
        {
          title: `[자동] ${record.facilityZone} 구역 점검 이상 감지`,
          description: record.notes ?? "",
          priority: "EMERGENCY",
          sourceInspectionId: record.id,
        },
        inspectedById,
      );
      return { ...record, createdMaintenanceId: maintenance.id };
    }

    return record;
  }

  async update(id: number, dto: UpdateInspectionDto) {
    await this.get(id);
    return this.repo.update(id, dto);
  }
}
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/facility --no-coverage
```

Expected: 9개 테스트 모두 PASS

- [ ] **Step 7: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/facility/ apps/api/__test__/facility/
git commit -m "feat: add InspectionService and MaintenanceService with ISSUE_FOUND auto-link"
```

---

## Task 4: NotificationService 확장 + Controllers + Routes + apiRouter

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`
- Modify: `apps/api/src/notification/notification.service.ts`
- Create: `apps/api/src/facility/inspection/inspection.controller.ts`
- Create: `apps/api/src/facility/maintenance/maintenance.controller.ts`
- Create: `apps/api/src/facility/facility.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: NotificationRepository에 createForAllStaff 추가**

`apps/api/src/notification/notification.repo.ts`의 마지막 메서드 앞에 추가:

```ts
  createForAllStaff(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { role: { notIn: ["PLAYER", "AGENT"] } },
        select: { id: true, language: true },
      });
      if (users.length === 0) return;
      await tx.notification.createMany({
        data: users.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }
```

- [ ] **Step 2: NotificationService에 notifyFacilityEmergency / notifyFacilityResolved 추가**

`apps/api/src/notification/notification.service.ts`의 `getPartnerAlerts` 메서드 앞에 추가:

```ts
  async notifyFacilityEmergency(requestTitle: string, requestId: number) {
    const title = "시설 긴급 유지보수 요청";
    const body = `'${requestTitle}' — 긴급 유지보수 요청이 등록됐습니다. 즉시 확인 바랍니다.`;
    await this.repo.createForAllStaff("FACILITY_EMERGENCY", () => ({ title, body }), requestId);
    getIO().to("staff-room").emit("notification:facility", {
      type: "FACILITY_EMERGENCY",
      title,
      body,
      requestId,
      createdAt: new Date().toISOString(),
    });
  }

  async notifyFacilityResolved(requestTitle: string, requestId: number) {
    const title = "시설 유지보수 완료";
    const body = `'${requestTitle}' 유지보수 요청이 해결됐습니다.`;
    await this.repo.createForAllStaff("FACILITY_MAINTENANCE_RESOLVED", () => ({ title, body }), requestId);
    getIO().to("staff-room").emit("notification:facility", {
      type: "FACILITY_MAINTENANCE_RESOLVED",
      title,
      body,
      requestId,
      createdAt: new Date().toISOString(),
    });
  }
```

- [ ] **Step 3: inspection.controller.ts 작성**

Create `apps/api/src/facility/inspection/inspection.controller.ts`:

```ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import type { InspectionService } from "./inspection.service";
import type { CreateInspectionDto, UpdateInspectionDto, InspectionListQuery } from "./dto/inspection.dto";

const canWrite = (role: string) => role === "ADMIN" || role === "FRONT_OFFICE";

export class InspectionController {
  constructor(private service: InspectionService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.query as InspectionListQuery));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get(Number(req.params.id)));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId } = req.user!;
      if (!canWrite(role)) throw new AppError(403, "FORBIDDEN");
      const result = await this.service.create(req.body as CreateInspectionDto, userId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!canWrite(role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params.id), req.body as UpdateInspectionDto));
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 4: maintenance.controller.ts 작성**

Create `apps/api/src/facility/maintenance/maintenance.controller.ts`:

```ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import type { MaintenanceService } from "./maintenance.service";
import type { CreateMaintenanceDto, UpdateMaintenanceDto, MaintenanceListQuery } from "./dto/maintenance.dto";

const canWrite = (role: string) => role === "ADMIN" || role === "FRONT_OFFICE";

export class MaintenanceController {
  constructor(private service: MaintenanceService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.query as MaintenanceListQuery));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get(Number(req.params.id)));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, id: userId } = req.user!;
      if (!canWrite(role)) throw new AppError(403, "FORBIDDEN");
      const result = await this.service.create(req.body as CreateMaintenanceDto, userId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!canWrite(role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params.id), req.body as UpdateMaintenanceDto));
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 5: facility.routes.ts 작성**

Create `apps/api/src/facility/facility.routes.ts`:

```ts
import { Router } from "express";
import passport from "passport";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { NotificationService } from "../notification/notification.service";
import { InspectionRepository } from "./inspection/inspection.repo";
import { InspectionService } from "./inspection/inspection.service";
import { InspectionController } from "./inspection/inspection.controller";
import { MaintenanceRepository } from "./maintenance/maintenance.repo";
import { MaintenanceService } from "./maintenance/maintenance.service";
import { MaintenanceController } from "./maintenance/maintenance.controller";

const router = Router();
const auth = passport.authenticate("accessToken", { session: false });

const notificationService = new NotificationService(new NotificationRepository(getPrisma()));
const maintenanceRepo = new MaintenanceRepository(getPrisma());
const maintenanceService = new MaintenanceService(maintenanceRepo, notificationService);
const maintenanceController = new MaintenanceController(maintenanceService);

const inspectionRepo = new InspectionRepository(getPrisma());
const inspectionService = new InspectionService(inspectionRepo, maintenanceService);
const inspectionController = new InspectionController(inspectionService);

// Inspections
router.get("/inspections", auth, inspectionController.list);
router.post("/inspections", auth, inspectionController.create);
router.get("/inspections/:id", auth, inspectionController.get);
router.patch("/inspections/:id", auth, inspectionController.update);

// Maintenance
router.get("/maintenance", auth, maintenanceController.list);
router.post("/maintenance", auth, maintenanceController.create);
router.get("/maintenance/:id", auth, maintenanceController.get);
router.patch("/maintenance/:id", auth, maintenanceController.update);

export default router;
```

- [ ] **Step 6: apiRouter.ts에 facility 등록**

`apps/api/src/apiRouter.ts`에서 마지막 `import` 다음에 추가:

```ts
import facilityRouter from "./facility/facility.routes";
```

그리고 `apiRouter.use("/recruitment", recruitmentRouter);` 다음 줄에 추가:

```ts
apiRouter.use("/facility", facilityRouter);
```

- [ ] **Step 7: TypeScript 빌드 확인**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | grep "facility\|notification"
```

Expected: facility/notification 관련 에러 없음

- [ ] **Step 8: 전체 테스트 실행**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/facility --no-coverage 2>&1 | tail -10
```

Expected: 9개 테스트 모두 PASS

- [ ] **Step 9: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/notification/ apps/api/src/facility/ apps/api/src/apiRouter.ts
git commit -m "feat: wire up facility management routes and notification methods"
```

---

## 완료 체크리스트

- [ ] `GET /api/facility/inspections` — 목록 반환 (zone/type/result 필터)
- [ ] `POST /api/facility/inspections` result=OK → 201, maintenanceId 없음
- [ ] `POST /api/facility/inspections` result=ISSUE_FOUND → 201, `createdMaintenanceId` 포함, EMERGENCY 알림 발송
- [ ] `POST /api/facility/maintenance` priority=EMERGENCY → 201, staff-room emit
- [ ] `PATCH /api/facility/maintenance/:id` status=RESOLVED → resolvedAt 설정, 알림 발송
- [ ] `PATCH /api/facility/maintenance/:id` (이미 RESOLVED) → 409
- [ ] ADMIN/FRONT_OFFICE 외 쓰기 → 403
- [ ] 9개 유닛 테스트 통과
- [ ] tsc 에러 없음
