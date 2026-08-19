# Security & Facility Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Resolve 6 facility/security issues: preventive maintenance scheduling (TR4+TR9), vendor contract SLA integration (KD7+TR10), facility access logging (TR7), and equipment disposal verification (TR8).

**Architecture:** Three independent feature groups sharing one schema migration. Group A adds a `PreventiveSchedule` model with a daily cron job that auto-generates `MaintenanceRequest` rows. Group B extends `PartnerType` enum and adds SLA columns to `PartnerContract`. Group C adds `FacilityAccessLog` for zone-access auditing and `EquipmentDisposalVerification` for a physical-verification approval gate before a unit can be retired.

**Tech Stack:** TypeScript, Express, Prisma (PostgreSQL), node-cron, Jest (unit tests with mock repos), multer (photo upload for disposal verification).

---

## File Map

### Schema (shared)
- Modify: `apps/api/prisma/schema.prisma`

### Group A — TR4 + TR9 (Preventive Maintenance Scheduling)
- Create: `apps/api/src/facility/preventive-schedule/dto/preventive-schedule.dto.ts`
- Create: `apps/api/src/facility/preventive-schedule/preventive-schedule.repo.ts`
- Create: `apps/api/src/facility/preventive-schedule/preventive-schedule.service.ts`
- Create: `apps/api/src/facility/preventive-schedule/preventive-schedule.service.test.ts`
- Create: `apps/api/src/facility/preventive-schedule/preventive-schedule.controller.ts`
- Create: `apps/api/src/jobs/preventiveScheduleGen.ts`
- Modify: `apps/api/src/facility/facility.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

### Group B — KD7 + TR10 (Vendor Integration)
- Modify: `apps/api/src/partner/dto/partner.dto.ts`
- Modify: `apps/api/src/partner/partner.repo.ts`

### Group C — TR7 (Facility Access Log)
- Create: `apps/api/src/lib/facilityAccessControl.ts`
- Create: `apps/api/src/facility/access-log/dto/access-log.dto.ts`
- Create: `apps/api/src/facility/access-log/access-log.repo.ts`
- Create: `apps/api/src/facility/access-log/access-log.service.ts`
- Create: `apps/api/src/facility/access-log/access-log.controller.ts`
- Modify: `apps/api/src/facility/facility.routes.ts`

### Group C — TR8 (Equipment Disposal Verification)
- Create: `apps/api/src/equipment/disposal/dto/disposal.dto.ts`
- Create: `apps/api/src/equipment/disposal/disposal.repo.ts`
- Create: `apps/api/src/equipment/disposal/disposal.service.ts`
- Create: `apps/api/src/equipment/disposal/disposal.service.test.ts`
- Create: `apps/api/src/equipment/disposal/disposal.controller.ts`
- Modify: `apps/api/src/equipment/equipment.routes.ts`
- Modify: `apps/api/src/notification/notification.service.ts`

---

## Task 1: Schema Changes + DB Push

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: Extend `PartnerType` enum (line ~191)**

Replace:
```prisma
enum PartnerType {
  MANUFACTURER
  HOSPITAL
}
```
With:
```prisma
enum PartnerType {
  MANUFACTURER
  HOSPITAL
  MAINTENANCE_VENDOR
  EQUIPMENT_SUPPLIER
}
```

- [x] **Step 2: Add SLA fields to `PartnerContract` (after `notes String?` ~line 1138)**

```prisma
  notes          String?
  responseHours  Int?
  resolutionDays Int?
  penaltyPerDay  Decimal?              @db.Decimal(12, 2)
  createdAt      DateTime              @default(now())
```

- [x] **Step 3: Add `sourceScheduleId` to `MaintenanceRequest` (after `partnerId Int?` ~line 2734)**

```prisma
  partnerId           Int?
  sourceScheduleId    Int?
  createdAt           DateTime            @default(now())
```
And add relation (after `partner Partner? @relation(...)` ~line 2742):
```prisma
  partner          Partner?            @relation("MaintenancePartner", fields: [partnerId], references: [id])
  sourceSchedule   PreventiveSchedule? @relation(fields: [sourceScheduleId], references: [id])
```

- [x] **Step 4: Add `preventiveSchedules` back-relation to `Partner` (after `maintenanceRequests` ~line 1127)**

```prisma
  maintenanceRequests  MaintenanceRequest[] @relation("MaintenancePartner")
  preventiveSchedules  PreventiveSchedule[]
```

- [x] **Step 5: Add back-relations to `User` model (after last existing relation ~line 834)**

```prisma
  facilityAccessLogs       FacilityAccessLog[]
  disposalRequests         EquipmentDisposalVerification[] @relation("DisposalRequestedBy")
  disposalVerifications    EquipmentDisposalVerification[] @relation("DisposalVerifiedBy")
```

- [x] **Step 6: Add `disposalVerification` back-relation to `EquipmentUnit` (after `disposedBy` relation ~line 1577)**

```prisma
  disposedBy          User?                 @relation("EquipmentDisposer", fields: [disposedById], references: [id])
  disposalVerification EquipmentDisposalVerification?
```

- [x] **Step 7: Add new models at the end of `schema.prisma`**

```prisma
model PreventiveSchedule {
  id              Int                 @id @default(autoincrement())
  facilityZone    FacilityZone
  title           String
  description     String?             @db.Text
  intervalDays    Int
  priority        MaintenancePriority
  partnerId       Int?
  lastGeneratedAt DateTime?
  isActive        Boolean             @default(true)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  partner             Partner?           @relation(fields: [partnerId], references: [id])
  maintenanceRequests MaintenanceRequest[]
}

model FacilityAccessLog {
  id        Int          @id @default(autoincrement())
  userId    Int
  zone      FacilityZone
  action    String
  reason    String?
  createdAt DateTime     @default(now())

  user User @relation(fields: [userId], references: [id])
}

model EquipmentDisposalVerification {
  id            Int       @id @default(autoincrement())
  equipmentId   Int       @unique
  requestedById Int
  verifiedById  Int?
  verifiedAt    DateTime?
  photoUrl      String?
  checklistOk   Boolean   @default(false)
  notes         String?   @db.Text
  status        String    @default("PENDING")
  createdAt     DateTime  @default(now())

  equipment   EquipmentUnit @relation(fields: [equipmentId], references: [id])
  requestedBy User          @relation("DisposalRequestedBy", fields: [requestedById], references: [id])
  verifiedBy  User?         @relation("DisposalVerifiedBy", fields: [verifiedById], references: [id])
}
```

- [x] **Step 8: Push schema to DB**

Run from `apps/api/`:
```bash
npx prisma db push --accept-data-loss
```
Expected: `Your database is now in sync with your Prisma schema.`

- [x] **Step 9: Verify generated client has new types**

```bash
grep -n "MAINTENANCE_VENDOR\|PreventiveSchedule\|FacilityAccessLog\|EquipmentDisposalVerification" src/generated/client/index.d.ts | head -10
```
Expected: lines found for each.

- [x] **Step 10: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add PreventiveSchedule, FacilityAccessLog, EquipmentDisposalVerification; extend PartnerType + PartnerContract SLA"
```

---

## Task 2: Group A — PreventiveSchedule CRUD API

**Files:**
- Create: `apps/api/src/facility/preventive-schedule/dto/preventive-schedule.dto.ts`
- Create: `apps/api/src/facility/preventive-schedule/preventive-schedule.repo.ts`
- Create: `apps/api/src/facility/preventive-schedule/preventive-schedule.service.ts`
- Create: `apps/api/src/facility/preventive-schedule/preventive-schedule.service.test.ts`
- Create: `apps/api/src/facility/preventive-schedule/preventive-schedule.controller.ts`

- [x] **Step 1: Write the failing tests**

Create `apps/api/src/facility/preventive-schedule/preventive-schedule.service.test.ts`:
```ts
import { PreventiveScheduleService } from "./preventive-schedule.service";
import { AppError } from "../../lib/appError";
import type { PreventiveScheduleRepository } from "./preventive-schedule.repo";

const makeRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  facilityZone: "GROUND",
  title: "잔디 점검",
  intervalDays: 30,
  priority: "NORMAL",
  isActive: true,
  partnerId: null,
  lastGeneratedAt: null,
  ...overrides,
});

const makeRepo = (overrides: Partial<PreventiveScheduleRepository> = {}): PreventiveScheduleRepository => ({
  findAll:  jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(null),
  create:   jest.fn(),
  update:   jest.fn(),
  deactivate: jest.fn(),
  ...overrides,
} as unknown as PreventiveScheduleRepository);

const makeService = (repo: PreventiveScheduleRepository) => new PreventiveScheduleService(repo);

describe("PreventiveScheduleService.get", () => {
  it("throws 404 when not found", async () => {
    await expect(makeService(makeRepo()).get(1))
      .rejects.toThrow(new AppError(404, "PREVENTIVE_SCHEDULE_NOT_FOUND"));
  });

  it("returns record when found", async () => {
    const record = makeRecord();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(record) });
    const result = await makeService(repo).get(1);
    expect(result).toEqual(record);
  });
});

describe("PreventiveScheduleService.deactivate", () => {
  it("throws 404 when not found", async () => {
    await expect(makeService(makeRepo()).deactivate(99))
      .rejects.toThrow(new AppError(404, "PREVENTIVE_SCHEDULE_NOT_FOUND"));
  });

  it("throws 400 when already inactive", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeRecord({ isActive: false })) });
    await expect(makeService(repo).deactivate(1))
      .rejects.toThrow(new AppError(400, "SCHEDULE_ALREADY_INACTIVE"));
  });

  it("calls repo.deactivate when valid", async () => {
    const repo = makeRepo({
      findById:   jest.fn().mockResolvedValue(makeRecord({ isActive: true })),
      deactivate: jest.fn().mockResolvedValue(makeRecord({ isActive: false })),
    });
    await makeService(repo).deactivate(1);
    expect(repo.deactivate).toHaveBeenCalledWith(1);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npm test -- --testPathPattern=preventive-schedule.service.test --passWithNoTests 2>&1 | tail -15
```
Expected: FAIL with "Cannot find module './preventive-schedule.service'"

- [x] **Step 3: Create DTO**

Create `apps/api/src/facility/preventive-schedule/dto/preventive-schedule.dto.ts`:
```ts
import type { FacilityZone, MaintenancePriority } from "../../../generated/enums";

export interface CreatePreventiveScheduleDto {
  facilityZone: FacilityZone;
  title: string;
  description?: string;
  intervalDays: number;
  priority: MaintenancePriority;
  partnerId?: number;
}

export interface UpdatePreventiveScheduleDto {
  title?: string;
  description?: string;
  intervalDays?: number;
  priority?: MaintenancePriority;
  partnerId?: number;
}

export interface PreventiveScheduleListQuery {
  facilityZone?: FacilityZone;
  isActive?: string;
}
```

- [x] **Step 4: Create repository**

Create `apps/api/src/facility/preventive-schedule/preventive-schedule.repo.ts`:
```ts
import type { PrismaClient } from "../../generated/client";
import type { CreatePreventiveScheduleDto, UpdatePreventiveScheduleDto, PreventiveScheduleListQuery } from "./dto/preventive-schedule.dto";

const INCLUDE = {
  partner: { select: { id: true, name: true, type: true } },
} as const;

export class PreventiveScheduleRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: PreventiveScheduleListQuery) {
    return this.prisma.preventiveSchedule.findMany({
      where: {
        ...(query.facilityZone && { facilityZone: query.facilityZone as any }),
        ...(query.isActive !== undefined && { isActive: query.isActive === "true" }),
      },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.preventiveSchedule.findUnique({ where: { id }, include: INCLUDE });
  }

  create(dto: CreatePreventiveScheduleDto) {
    return this.prisma.preventiveSchedule.create({
      data: {
        facilityZone: dto.facilityZone as any,
        title: dto.title,
        intervalDays: dto.intervalDays,
        priority: dto.priority as any,
        ...(dto.description && { description: dto.description }),
        ...(dto.partnerId && { partnerId: dto.partnerId }),
      },
      include: INCLUDE,
    });
  }

  update(id: number, dto: UpdatePreventiveScheduleDto) {
    return this.prisma.preventiveSchedule.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.intervalDays !== undefined && { intervalDays: dto.intervalDays }),
        ...(dto.priority !== undefined && { priority: dto.priority as any }),
        ...(dto.partnerId !== undefined && { partnerId: dto.partnerId }),
      },
      include: INCLUDE,
    });
  }

  deactivate(id: number) {
    return this.prisma.preventiveSchedule.update({
      where: { id },
      data: { isActive: false },
      include: INCLUDE,
    });
  }

  findDueSchedules(today: Date) {
    return this.prisma.preventiveSchedule.findMany({
      where: {
        isActive: true,
        OR: [
          { lastGeneratedAt: null },
          {
            lastGeneratedAt: {
              lte: new Date(today.getTime() - 0),
            },
          },
        ],
      },
      include: INCLUDE,
    });
  }

  updateLastGeneratedAt(id: number, date: Date) {
    return this.prisma.preventiveSchedule.update({
      where: { id },
      data: { lastGeneratedAt: date },
    });
  }
}
```

- [x] **Step 5: Create service**

Create `apps/api/src/facility/preventive-schedule/preventive-schedule.service.ts`:
```ts
import { AppError } from "../../lib/appError";
import type { PreventiveScheduleRepository } from "./preventive-schedule.repo";
import type { CreatePreventiveScheduleDto, UpdatePreventiveScheduleDto, PreventiveScheduleListQuery } from "./dto/preventive-schedule.dto";

export class PreventiveScheduleService {
  constructor(private repo: PreventiveScheduleRepository) {}

  list(query: PreventiveScheduleListQuery) {
    return this.repo.findAll(query);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "PREVENTIVE_SCHEDULE_NOT_FOUND");
    return record;
  }

  create(dto: CreatePreventiveScheduleDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdatePreventiveScheduleDto) {
    await this.get(id);
    return this.repo.update(id, dto);
  }

  async deactivate(id: number) {
    const existing = await this.get(id);
    if (!existing.isActive) throw new AppError(400, "SCHEDULE_ALREADY_INACTIVE");
    return this.repo.deactivate(id);
  }
}
```

- [x] **Step 6: Create controller**

Create `apps/api/src/facility/preventive-schedule/preventive-schedule.controller.ts`:
```ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import { requireUser } from "../../lib/authMiddleware";
import { isAdminLike } from "../../lib/permissions";
import type { PreventiveScheduleService } from "./preventive-schedule.service";
import type { CreatePreventiveScheduleDto, UpdatePreventiveScheduleDto, PreventiveScheduleListQuery } from "./dto/preventive-schedule.dto";

const isFacilityManager = (req: Request) => {
  const user = requireUser(req);
  return isAdminLike(user.role) ||
    user.role === "GM" ||
    (user.role === "FRONT_OFFICE" && user.frontOfficeRole === "FACILITY_MANAGER");
};

export class PreventiveScheduleController {
  constructor(private service: PreventiveScheduleService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.query as PreventiveScheduleListQuery));
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get(Number(req.params.id)));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body as CreatePreventiveScheduleDto));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params.id), req.body as UpdatePreventiveScheduleDto));
    } catch (err) { next(err); }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.deactivate(Number(req.params.id)));
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 7: Run tests to verify they pass**

```bash
cd apps/api && npm test -- --testPathPattern=preventive-schedule.service.test 2>&1 | tail -15
```
Expected: PASS, 3 tests passing.

- [x] **Step 8: Mount routes in `facility.routes.ts`**

Add at the top of `apps/api/src/facility/facility.routes.ts` after the existing imports:
```ts
import { PreventiveScheduleRepository } from "./preventive-schedule/preventive-schedule.repo";
import { PreventiveScheduleService } from "./preventive-schedule/preventive-schedule.service";
import { PreventiveScheduleController } from "./preventive-schedule/preventive-schedule.controller";
```

Add after the existing service instantiations (before the route definitions):
```ts
const preventiveScheduleRepo = new PreventiveScheduleRepository(getPrisma());
const preventiveScheduleService = new PreventiveScheduleService(preventiveScheduleRepo);
const preventiveScheduleController = new PreventiveScheduleController(preventiveScheduleService);
```

Add before `export default router;`:
```ts
router.get("/preventive-schedules", auth, preventiveScheduleController.list);
router.post("/preventive-schedules", auth, preventiveScheduleController.create);
router.get("/preventive-schedules/:id", auth, preventiveScheduleController.get);
router.patch("/preventive-schedules/:id", auth, preventiveScheduleController.update);
router.post("/preventive-schedules/:id/deactivate", auth, preventiveScheduleController.deactivate);
```

- [x] **Step 9: Commit**

```bash
git add apps/api/src/facility/preventive-schedule/
git add apps/api/src/facility/facility.routes.ts
git commit -m "feat(facility): add PreventiveSchedule CRUD API (TR4/TR9)"
```

---

## Task 3: Group A — Preventive Maintenance Cron Job

**Files:**
- Create: `apps/api/src/jobs/preventiveScheduleGen.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: Create the cron job**

Create `apps/api/src/jobs/preventiveScheduleGen.ts`:
```ts
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";

async function runPreventiveScheduleGen() {
  const prisma = getPrisma();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedules = await prisma.preventiveSchedule.findMany({
    where: { isActive: true },
  });

  let generated = 0;

  for (const schedule of schedules) {
    // Check if it's time to generate
    if (schedule.lastGeneratedAt) {
      const nextDue = new Date(schedule.lastGeneratedAt.getTime() + schedule.intervalDays * 24 * 60 * 60 * 1000);
      nextDue.setHours(0, 0, 0, 0);
      if (nextDue > today) continue;
    }

    // Check for existing pending request from this schedule
    const pending = await prisma.maintenanceRequest.findFirst({
      where: {
        sourceScheduleId: schedule.id,
        status: { in: ["OPEN", "IN_PROGRESS", "PENDING_APPROVAL"] as any[] },
      },
    });
    if (pending) continue;

    // Create maintenance request
    await prisma.maintenanceRequest.create({
      data: {
        title: `[정기점검] ${schedule.title}`,
        description: schedule.description ?? `${schedule.facilityZone} 구역 정기 예방 유지보수`,
        priority: schedule.priority as any,
        status: "OPEN" as any,
        sourceScheduleId: schedule.id,
        createdById: 1, // system user — adjust to your actual system user ID
        ...(schedule.partnerId && { partnerId: schedule.partnerId }),
      },
    });

    await prisma.preventiveSchedule.update({
      where: { id: schedule.id },
      data: { lastGeneratedAt: today },
    });

    generated++;
  }

  console.log(`[preventiveScheduleGen] generated ${generated} requests from ${schedules.length} schedules at ${today.toISOString()}`);
}

export function startPreventiveScheduleGenJob() {
  cron.schedule("0 7 * * *", () => {
    runPreventiveScheduleGen().catch(console.error);
  });
  console.log("[preventiveScheduleGen] scheduled at 07:00 daily");
}
```

- [x] **Step 2: Wire into `apiRouter.ts`**

Add import at top of `apps/api/src/apiRouter.ts` (after the existing job imports):
```ts
import { startPreventiveScheduleGenJob } from "./jobs/preventiveScheduleGen";
```

Add after `startCertStatusSyncJob();`:
```ts
startPreventiveScheduleGenJob();
```

- [x] **Step 3: Build check**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```
Expected: No new errors related to `preventiveScheduleGen` or `preventive-schedule/`.

- [x] **Step 4: Commit**

```bash
git add apps/api/src/jobs/preventiveScheduleGen.ts
git add apps/api/src/apiRouter.ts
git commit -m "feat(jobs): add daily preventive maintenance request generator (TR4/TR9)"
```

---

## Task 4: Group B — Vendor Integration (KD7 + TR10)

**Files:**
- Modify: `apps/api/src/partner/dto/partner.dto.ts`
- Modify: `apps/api/src/partner/partner.repo.ts`

- [x] **Step 1: Update `partner.dto.ts` — add SLA fields to contract DTOs**

In `apps/api/src/partner/dto/partner.dto.ts`, add SLA fields to `CreatePartnerContractDto` and `UpdatePartnerContractDto`:

```ts
export interface CreatePartnerContractDto {
  startDate: string;
  endDate: string;
  sponsorshipFee?: number;
  discountRate?: number;
  notes?: string;
  responseHours?: number;
  resolutionDays?: number;
  penaltyPerDay?: number;
}

export interface UpdatePartnerContractDto {
  status?: PartnerContractStatus;
  endDate?: string;
  sponsorshipFee?: number;
  discountRate?: number;
  notes?: string;
  responseHours?: number;
  resolutionDays?: number;
  penaltyPerDay?: number;
}
```

- [x] **Step 2: Update `CONTRACT_SELECT` in `partner.repo.ts`**

In `apps/api/src/partner/partner.repo.ts`, update the `CONTRACT_SELECT` constant to include SLA fields:

```ts
const CONTRACT_SELECT = {
  id: true, partnerId: true, status: true, startDate: true,
  endDate: true, sponsorshipFee: true, discountRate: true, notes: true,
  responseHours: true, resolutionDays: true, penaltyPerDay: true, createdAt: true,
} as const;
```

- [x] **Step 3: Update `createContract` in `partner.repo.ts`**

Find the `createContract` method and add SLA fields to the `data` object:
```ts
  createContract(partnerId: number, dto: CreatePartnerContractDto) {
    return this.prisma.partnerContract.create({
      data: {
        partnerId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        ...(dto.sponsorshipFee !== undefined && { sponsorshipFee: dto.sponsorshipFee }),
        ...(dto.discountRate !== undefined && { discountRate: dto.discountRate }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.responseHours !== undefined && { responseHours: dto.responseHours }),
        ...(dto.resolutionDays !== undefined && { resolutionDays: dto.resolutionDays }),
        ...(dto.penaltyPerDay !== undefined && { penaltyPerDay: dto.penaltyPerDay }),
      },
      select: CONTRACT_SELECT,
    });
  }
```

- [x] **Step 4: Update `updateContract` in `partner.repo.ts`**

Find the `updateContract` method and add SLA fields:
```ts
  updateContract(id: number, dto: UpdatePartnerContractDto) {
    return this.prisma.partnerContract.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status as any }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.sponsorshipFee !== undefined && { sponsorshipFee: dto.sponsorshipFee }),
        ...(dto.discountRate !== undefined && { discountRate: dto.discountRate }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.responseHours !== undefined && { responseHours: dto.responseHours }),
        ...(dto.resolutionDays !== undefined && { resolutionDays: dto.resolutionDays }),
        ...(dto.penaltyPerDay !== undefined && { penaltyPerDay: dto.penaltyPerDay }),
      },
      select: CONTRACT_SELECT,
    });
  }
```

- [x] **Step 5: Build check**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "partner" | head -10
```
Expected: No errors related to partner files.

- [x] **Step 6: Commit**

```bash
git add apps/api/src/partner/dto/partner.dto.ts
git add apps/api/src/partner/partner.repo.ts
git commit -m "feat(partner): extend PartnerType with MAINTENANCE_VENDOR/EQUIPMENT_SUPPLIER; add SLA fields to PartnerContract (KD7/TR10)"
```

---

## Task 5: Group C — Facility Access Log (TR7)

**Files:**
- Create: `apps/api/src/lib/facilityAccessControl.ts`
- Create: `apps/api/src/facility/access-log/dto/access-log.dto.ts`
- Create: `apps/api/src/facility/access-log/access-log.repo.ts`
- Create: `apps/api/src/facility/access-log/access-log.service.ts`
- Create: `apps/api/src/facility/access-log/access-log.controller.ts`
- Modify: `apps/api/src/facility/facility.routes.ts`

- [x] **Step 1: Create zone access rules**

Create `apps/api/src/lib/facilityAccessControl.ts`:
```ts
import type { FacilityZone } from "../generated/enums";

type Role = string;

export const ZONE_ACCESS_RULES: Record<FacilityZone, Role[]> = {
  GROUND:      ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER", "FRONT_OFFICE"],
  MECHANICAL:  ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"],
  STRUCTURAL:  ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"],
  SAFETY:      ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE", "COACHING_STAFF"],
  SANITATION:  ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"],
  OPERATIONS:  ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"],
  LOCKER_ROOM: ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER"],
  MEDICAL_ROOM:["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF"],
  SHOWER_ROOM: ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER"],
};

export function canAccessZone(role: Role, zone: FacilityZone): boolean {
  return ZONE_ACCESS_RULES[zone]?.includes(role) ?? false;
}
```

- [x] **Step 2: Create DTO**

Create `apps/api/src/facility/access-log/dto/access-log.dto.ts`:
```ts
import type { FacilityZone } from "../../../generated/enums";

export type AccessAction = "ENTER" | "EXIT";

export interface LogAccessDto {
  zone: FacilityZone;
  action: AccessAction;
  reason?: string;
}

export interface AccessLogListQuery {
  userId?: string;
  zone?: FacilityZone;
  action?: string;
  from?: string;
  to?: string;
}
```

- [x] **Step 3: Create repository**

Create `apps/api/src/facility/access-log/access-log.repo.ts`:
```ts
import type { PrismaClient } from "../../generated/client";
import type { AccessLogListQuery } from "./dto/access-log.dto";

export class AccessLogRepository {
  constructor(private prisma: PrismaClient) {}

  create(data: { userId: number; zone: string; action: string; reason?: string }) {
    return this.prisma.facilityAccessLog.create({
      data: {
        userId: data.userId,
        zone: data.zone as any,
        action: data.action,
        ...(data.reason && { reason: data.reason }),
      },
    });
  }

  findAll(query: AccessLogListQuery) {
    return this.prisma.facilityAccessLog.findMany({
      where: {
        ...(query.userId && { userId: Number(query.userId) }),
        ...(query.zone && { zone: query.zone as any }),
        ...(query.action && { action: query.action }),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from && { gte: new Date(query.from) }),
                ...(query.to && { lte: new Date(query.to) }),
              },
            }
          : {}),
      },
      include: { user: { select: { id: true, username: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
```

- [x] **Step 4: Create service**

Create `apps/api/src/facility/access-log/access-log.service.ts`:
```ts
import { AppError } from "../../lib/appError";
import { canAccessZone } from "../../lib/facilityAccessControl";
import type { AccessLogRepository } from "./access-log.repo";
import type { LogAccessDto, AccessLogListQuery } from "./dto/access-log.dto";

export class AccessLogService {
  constructor(private repo: AccessLogRepository) {}

  list(query: AccessLogListQuery) {
    return this.repo.findAll(query);
  }

  async logAccess(userId: number, userRole: string, dto: LogAccessDto) {
    const allowed = canAccessZone(userRole, dto.zone);
    const action = allowed ? dto.action : "ATTEMPT_DENIED";
    await this.repo.create({ userId, zone: dto.zone, action, reason: dto.reason });
    if (!allowed) throw new AppError(403, "ZONE_ACCESS_DENIED");
  }
}
```

- [x] **Step 5: Create controller**

Create `apps/api/src/facility/access-log/access-log.controller.ts`:
```ts
import { Request, Response, NextFunction } from "express";
import { requireUser } from "../../lib/authMiddleware";
import { isAdminLike } from "../../lib/permissions";
import type { AccessLogService } from "./access-log.service";
import type { LogAccessDto, AccessLogListQuery } from "./dto/access-log.dto";

export class AccessLogController {
  constructor(private service: AccessLogService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!isAdminLike(user.role) && user.role !== "GM" && user.role !== "FRONT_OFFICE") {
        return res.status(403).json({ error: "FORBIDDEN" });
      }
      res.json(await this.service.list(req.query as AccessLogListQuery));
    } catch (err) { next(err); }
  };

  logAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      await this.service.logAccess(user.id, user.role, req.body as LogAccessDto);
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 6: Mount routes in `facility.routes.ts`**

Add imports at the top of `apps/api/src/facility/facility.routes.ts`:
```ts
import { AccessLogRepository } from "./access-log/access-log.repo";
import { AccessLogService } from "./access-log/access-log.service";
import { AccessLogController } from "./access-log/access-log.controller";
```

Add after existing controller instantiations:
```ts
const accessLogRepo = new AccessLogRepository(getPrisma());
const accessLogService = new AccessLogService(accessLogRepo);
const accessLogController = new AccessLogController(accessLogService);
```

Add routes before `export default router;`:
```ts
router.get("/access-logs", auth, accessLogController.list);
router.post("/access-logs", auth, accessLogController.logAccess);
```

- [x] **Step 7: Build check**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -i "access\|facility" | head -10
```
Expected: No errors.

- [x] **Step 8: Commit**

```bash
git add apps/api/src/lib/facilityAccessControl.ts
git add apps/api/src/facility/access-log/
git add apps/api/src/facility/facility.routes.ts
git commit -m "feat(facility): add FacilityAccessLog with zone access control (TR7)"
```

---

## Task 6: Group C — Equipment Disposal Verification (TR8)

**Files:**
- Create: `apps/api/src/equipment/disposal/dto/disposal.dto.ts`
- Create: `apps/api/src/equipment/disposal/disposal.repo.ts`
- Create: `apps/api/src/equipment/disposal/disposal.service.ts`
- Create: `apps/api/src/equipment/disposal/disposal.service.test.ts`
- Create: `apps/api/src/equipment/disposal/disposal.controller.ts`
- Modify: `apps/api/src/equipment/equipment.routes.ts`
- Modify: `apps/api/src/notification/notification.service.ts`

- [x] **Step 1: Write the failing tests**

Create `apps/api/src/equipment/disposal/disposal.service.test.ts`:
```ts
import { DisposalService } from "./disposal.service";
import { AppError } from "../../lib/appError";
import type { DisposalRepository } from "./disposal.repo";

const makeUnit = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  status: "AVAILABLE",
  isHighValue: false,
  disposedAt: null,
  ...overrides,
});

const makeVerification = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  equipmentId: 1,
  requestedById: 10,
  verifiedById: null,
  verifiedAt: null,
  photoUrl: null,
  checklistOk: false,
  notes: null,
  status: "PENDING",
  createdAt: new Date(),
  equipment: makeUnit(),
  ...overrides,
});

const makeRepo = (overrides: Partial<DisposalRepository> = {}): DisposalRepository => ({
  findUnitById:       jest.fn().mockResolvedValue(null),
  findVerification:   jest.fn().mockResolvedValue(null),
  createVerification: jest.fn(),
  fmVerify:           jest.fn(),
  gmApprove:          jest.fn(),
  rejectVerification: jest.fn(),
  updateUnitDisposed: jest.fn(),
  ...overrides,
} as unknown as DisposalRepository);

const makeService = (repo: DisposalRepository) => new DisposalService(repo);

describe("DisposalService.requestDisposal", () => {
  it("throws 404 when unit not found", async () => {
    await expect(makeService(makeRepo()).requestDisposal(99, 10))
      .rejects.toThrow(new AppError(404, "EQUIPMENT_UNIT_NOT_FOUND"));
  });

  it("throws 409 when already RETIRED", async () => {
    const repo = makeRepo({ findUnitById: jest.fn().mockResolvedValue(makeUnit({ status: "RETIRED" })) });
    await expect(makeService(repo).requestDisposal(1, 10))
      .rejects.toThrow(new AppError(409, "UNIT_ALREADY_RETIRED"));
  });

  it("throws 409 when pending verification exists", async () => {
    const repo = makeRepo({
      findUnitById:     jest.fn().mockResolvedValue(makeUnit()),
      findVerification: jest.fn().mockResolvedValue(makeVerification({ status: "PENDING" })),
    });
    await expect(makeService(repo).requestDisposal(1, 10))
      .rejects.toThrow(new AppError(409, "DISPOSAL_VERIFICATION_PENDING"));
  });

  it("calls createVerification when valid", async () => {
    const repo = makeRepo({
      findUnitById:       jest.fn().mockResolvedValue(makeUnit()),
      findVerification:   jest.fn().mockResolvedValue(null),
      createVerification: jest.fn().mockResolvedValue(makeVerification()),
    });
    await makeService(repo).requestDisposal(1, 10);
    expect(repo.createVerification).toHaveBeenCalledWith(1, 10);
  });
});

describe("DisposalService.fmVerify", () => {
  it("throws 404 when verification not found", async () => {
    await expect(makeService(makeRepo()).fmVerify(99, 5, {}))
      .rejects.toThrow(new AppError(404, "DISPOSAL_VERIFICATION_NOT_FOUND"));
  });

  it("throws 400 when not PENDING", async () => {
    const repo = makeRepo({ findVerification: jest.fn().mockResolvedValue(makeVerification({ status: "FM_VERIFIED" })) });
    await expect(makeService(repo).fmVerify(1, 5, {}))
      .rejects.toThrow(new AppError(400, "INVALID_VERIFICATION_STATUS"));
  });

  it("throws 400 when high-value and no photoUrl", async () => {
    const repo = makeRepo({
      findVerification: jest.fn().mockResolvedValue(
        makeVerification({ status: "PENDING", equipment: makeUnit({ isHighValue: true }) })
      ),
    });
    await expect(makeService(repo).fmVerify(1, 5, {}))
      .rejects.toThrow(new AppError(400, "PHOTO_REQUIRED_FOR_HIGH_VALUE"));
  });

  it("calls fmVerify and updateUnitDisposed for normal equipment", async () => {
    const repo = makeRepo({
      findVerification: jest.fn().mockResolvedValue(
        makeVerification({ status: "PENDING", equipment: makeUnit({ isHighValue: false }) })
      ),
      fmVerify:           jest.fn().mockResolvedValue(makeVerification({ status: "FM_VERIFIED" })),
      updateUnitDisposed: jest.fn(),
    });
    await makeService(repo).fmVerify(1, 5, { checklistOk: true });
    expect(repo.fmVerify).toHaveBeenCalled();
    expect(repo.updateUnitDisposed).toHaveBeenCalledWith(1, 5);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npm test -- --testPathPattern=disposal.service.test --passWithNoTests 2>&1 | tail -10
```
Expected: FAIL with "Cannot find module './disposal.service'"

- [x] **Step 3: Create DTO**

Create `apps/api/src/equipment/disposal/dto/disposal.dto.ts`:
```ts
export interface FmVerifyDto {
  checklistOk?: boolean;
  photoUrl?: string;
  notes?: string;
}

export interface GmApproveDto {
  notes?: string;
}

export interface RejectDisposalDto {
  reason: string;
}
```

- [x] **Step 4: Create repository**

Create `apps/api/src/equipment/disposal/disposal.repo.ts`:
```ts
import type { PrismaClient } from "../../generated/client";
import type { FmVerifyDto, GmApproveDto } from "./dto/disposal.dto";

const VERIFICATION_INCLUDE = {
  equipment: {
    select: { id: true, isHighValue: true, status: true, disposedAt: true, item: { select: { name: true } } },
  },
  requestedBy: { select: { id: true, username: true } },
  verifiedBy:  { select: { id: true, username: true } },
} as const;

export class DisposalRepository {
  constructor(private prisma: PrismaClient) {}

  findUnitById(id: number) {
    return this.prisma.equipmentUnit.findUnique({
      where: { id },
      select: { id: true, status: true, isHighValue: true, disposedAt: true },
    });
  }

  findVerification(equipmentId: number) {
    return this.prisma.equipmentDisposalVerification.findUnique({
      where: { equipmentId },
      include: VERIFICATION_INCLUDE,
    });
  }

  createVerification(equipmentId: number, requestedById: number) {
    return this.prisma.equipmentDisposalVerification.create({
      data: { equipmentId, requestedById },
      include: VERIFICATION_INCLUDE,
    });
  }

  fmVerify(id: number, verifiedById: number, dto: FmVerifyDto) {
    return this.prisma.equipmentDisposalVerification.update({
      where: { id },
      data: {
        verifiedById,
        verifiedAt: new Date(),
        status: "FM_VERIFIED",
        ...(dto.checklistOk !== undefined && { checklistOk: dto.checklistOk }),
        ...(dto.photoUrl && { photoUrl: dto.photoUrl }),
        ...(dto.notes && { notes: dto.notes }),
      },
      include: VERIFICATION_INCLUDE,
    });
  }

  gmApprove(id: number, dto: GmApproveDto) {
    return this.prisma.equipmentDisposalVerification.update({
      where: { id },
      data: {
        status: "GM_APPROVED",
        ...(dto.notes && { notes: dto.notes }),
      },
      include: VERIFICATION_INCLUDE,
    });
  }

  rejectVerification(id: number, reason: string) {
    return this.prisma.equipmentDisposalVerification.update({
      where: { id },
      data: { status: "REJECTED", notes: reason },
      include: VERIFICATION_INCLUDE,
    });
  }

  updateUnitDisposed(equipmentId: number, actorId: number) {
    return this.prisma.equipmentUnit.update({
      where: { id: equipmentId },
      data: {
        status: "RETIRED" as any,
        disposedById: actorId,
        disposedAt: new Date(),
      },
    });
  }
}
```

- [x] **Step 5: Create service**

Create `apps/api/src/equipment/disposal/disposal.service.ts`:
```ts
import { AppError } from "../../lib/appError";
import type { DisposalRepository } from "./disposal.repo";
import type { FmVerifyDto, GmApproveDto, RejectDisposalDto } from "./dto/disposal.dto";

export class DisposalService {
  constructor(private repo: DisposalRepository) {}

  async getVerification(equipmentId: number) {
    const record = await this.repo.findVerification(equipmentId);
    if (!record) throw new AppError(404, "DISPOSAL_VERIFICATION_NOT_FOUND");
    return record;
  }

  async requestDisposal(equipmentId: number, requestedById: number) {
    const unit = await this.repo.findUnitById(equipmentId);
    if (!unit) throw new AppError(404, "EQUIPMENT_UNIT_NOT_FOUND");
    if (unit.status === "RETIRED") throw new AppError(409, "UNIT_ALREADY_RETIRED");

    const existing = await this.repo.findVerification(equipmentId);
    if (existing && ["PENDING", "FM_VERIFIED"].includes(existing.status)) {
      throw new AppError(409, "DISPOSAL_VERIFICATION_PENDING");
    }

    return this.repo.createVerification(equipmentId, requestedById);
  }

  async fmVerify(equipmentId: number, verifiedById: number, dto: FmVerifyDto) {
    const verification = await this.repo.findVerification(equipmentId);
    if (!verification) throw new AppError(404, "DISPOSAL_VERIFICATION_NOT_FOUND");
    if (verification.status !== "PENDING") throw new AppError(400, "INVALID_VERIFICATION_STATUS");

    if (verification.equipment.isHighValue && !dto.photoUrl) {
      throw new AppError(400, "PHOTO_REQUIRED_FOR_HIGH_VALUE");
    }

    const updated = await this.repo.fmVerify(verification.id, verifiedById, dto);

    // Normal (non-high-value) equipment: FM_VERIFIED = final
    if (!verification.equipment.isHighValue) {
      await this.repo.updateUnitDisposed(equipmentId, verifiedById);
    }

    return updated;
  }

  async gmApprove(equipmentId: number, gmId: number, dto: GmApproveDto) {
    const verification = await this.repo.findVerification(equipmentId);
    if (!verification) throw new AppError(404, "DISPOSAL_VERIFICATION_NOT_FOUND");
    if (verification.status !== "FM_VERIFIED") throw new AppError(400, "INVALID_VERIFICATION_STATUS");
    if (!verification.equipment.isHighValue) throw new AppError(400, "GM_APPROVAL_NOT_REQUIRED");

    const updated = await this.repo.gmApprove(verification.id, dto);
    await this.repo.updateUnitDisposed(equipmentId, gmId);
    return updated;
  }

  async rejectVerification(equipmentId: number, dto: RejectDisposalDto) {
    const verification = await this.repo.findVerification(equipmentId);
    if (!verification) throw new AppError(404, "DISPOSAL_VERIFICATION_NOT_FOUND");
    if (!["PENDING", "FM_VERIFIED"].includes(verification.status)) {
      throw new AppError(400, "INVALID_VERIFICATION_STATUS");
    }
    if (!dto.reason) throw new AppError(400, "REJECTION_REASON_REQUIRED");
    return this.repo.rejectVerification(verification.id, dto.reason);
  }
}
```

- [x] **Step 6: Run tests to verify they pass**

```bash
cd apps/api && npm test -- --testPathPattern=disposal.service.test 2>&1 | tail -15
```
Expected: PASS, 6 tests passing.

- [x] **Step 7: Add disposal notifications to `notification.service.ts`**

Add these methods to `apps/api/src/notification/notification.service.ts` before the closing brace of the class:
```ts
  async notifyDisposalRequested(itemName: string, equipmentId: number) {
    const title = "장비 폐기 검증 요청";
    const body = `'${itemName}' 장비의 폐기 검증이 요청됐습니다. 현장 확인 바랍니다.`;
    await this.repo.createForStaff("DISPOSAL_VERIFICATION_REQUESTED", () => ({ title, body }), equipmentId);
    getIO().to("staff-room").emit("notification:disposal", {
      type: "DISPOSAL_VERIFICATION_REQUESTED", title, body, equipmentId, createdAt: new Date().toISOString(),
    });
  }

  async notifyDisposalFMVerified(itemName: string, equipmentId: number) {
    const title = "고가 장비 폐기 GM 승인 필요";
    const body = `'${itemName}' 고가 장비 폐기가 시설 매니저에 의해 확인됐습니다. GM 최종 승인이 필요합니다.`;
    await this.repo.createForGM("DISPOSAL_FM_VERIFIED", () => ({ title, body }), equipmentId);
    getIO().to("staff-room").emit("notification:disposal", {
      type: "DISPOSAL_FM_VERIFIED", title, body, equipmentId, createdAt: new Date().toISOString(),
    });
  }
```

- [x] **Step 8: Create controller**

Create `apps/api/src/equipment/disposal/disposal.controller.ts`:
```ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import { requireUser } from "../../lib/authMiddleware";
import { isAdminLike } from "../../lib/permissions";
import type { DisposalService } from "./disposal.service";
import type { FmVerifyDto, GmApproveDto, RejectDisposalDto } from "./dto/disposal.dto";
import type { NotificationService } from "../../notification/notification.service";

const isFacilityManager = (req: Request) => {
  const user = requireUser(req);
  return isAdminLike(user.role) ||
    user.role === "GM" ||
    (user.role === "FRONT_OFFICE" && user.frontOfficeRole === "FACILITY_MANAGER");
};

const isGM = (req: Request) => {
  const user = requireUser(req);
  return isAdminLike(user.role) || user.role === "GM";
};

export class DisposalController {
  constructor(
    private service: DisposalService,
    private notifications: NotificationService,
  ) {}

  getVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getVerification(Number(req.params.unitId)));
    } catch (err) { next(err); }
  };

  requestDisposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      const result = await this.service.requestDisposal(Number(req.params.unitId), user.id);
      const itemName = result.equipment.item.name;
      void this.notifications.notifyDisposalRequested(itemName, result.equipmentId).catch(console.error);
      res.status(201).json(result);
    } catch (err) { next(err); }
  };

  fmVerify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req)) throw new AppError(403, "FORBIDDEN");
      const user = requireUser(req);
      const result = await this.service.fmVerify(Number(req.params.unitId), user.id, req.body as FmVerifyDto);
      if (result.equipment.isHighValue) {
        void this.notifications.notifyDisposalFMVerified(result.equipment.item.name, result.equipmentId).catch(console.error);
      }
      res.json(result);
    } catch (err) { next(err); }
  };

  gmApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isGM(req)) throw new AppError(403, "FORBIDDEN");
      const user = requireUser(req);
      res.json(await this.service.gmApprove(Number(req.params.unitId), user.id, req.body as GmApproveDto));
    } catch (err) { next(err); }
  };

  rejectVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isFacilityManager(req) && !isGM(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.rejectVerification(Number(req.params.unitId), req.body as RejectDisposalDto));
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 9: Mount routes in `equipment.routes.ts`**

Add imports at the top of `apps/api/src/equipment/equipment.routes.ts` after existing imports:
```ts
import { DisposalRepository } from "./disposal/disposal.repo";
import { DisposalService } from "./disposal/disposal.service";
import { DisposalController } from "./disposal/disposal.controller";
import { NotificationService } from "../notification/notification.service";
```

Add after the existing service instantiation:
```ts
const notificationService = new NotificationService(notificationRepo);
const disposalRepo = new DisposalRepository(getPrisma());
const disposalService = new DisposalService(disposalRepo);
const disposalController = new DisposalController(disposalService, notificationService);
```

Add routes before `export default router;`:
```ts
router.get("/units/:unitId/disposal", auth, disposalController.getVerification);
router.post("/units/:unitId/disposal", auth, disposalController.requestDisposal);
router.post("/units/:unitId/disposal/fm-verify", auth, disposalController.fmVerify);
router.post("/units/:unitId/disposal/gm-approve", auth, disposalController.gmApprove);
router.post("/units/:unitId/disposal/reject", auth, disposalController.rejectVerification);
```

- [x] **Step 10: Build check**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```
Expected: No new errors (there is one pre-existing error in `team.service.ts` — ignore it if it was there before).

- [x] **Step 11: Run all tests**

```bash
cd apps/api && npm test 2>&1 | tail -20
```
Expected: All tests pass including the new disposal.service.test and preventive-schedule.service.test suites.

- [x] **Step 12: Commit**

```bash
git add apps/api/src/equipment/disposal/
git add apps/api/src/equipment/equipment.routes.ts
git add apps/api/src/notification/notification.service.ts
git commit -m "feat(equipment): add disposal verification flow with FM + GM approval stages (TR8)"
```
