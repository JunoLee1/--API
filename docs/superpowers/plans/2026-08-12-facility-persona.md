# Facility & Equipment Persona Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve 5 open TR/KD criticals from Trevor & 김동욱 personas — configurable maintenance cost threshold, preventive inspection scheduling cron, reservation audit logging, disposal accountability, and vendor/partner linkage on maintenance requests.

**Architecture:** All changes are additive service-layer enhancements on top of `feat/pedro-equipment-facility`. ClubSettings receives one new field (`maintenanceCostLimit`) replacing the hardcoded 1 000 000 KRW constant in `maintenance.service.ts`. A new cron job (`inspectionDueAlert.ts`) mirrors the `sponsorshipExpiryAlert.ts` pattern. Audit logging uses the existing `writeAuditLog` utility.

**Tech Stack:** Express + TypeScript + Prisma (backend), Jest (unit tests). Known workaround for enum-safe migration: direct SQL + `prisma migrate resolve --applied` (no shadow DB needed).

---

## File Map

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `maintenanceCostLimit` to ClubSettings; add `partnerId` + `disposedById/At/Note` to respective models |
| `apps/api/prisma/migrations/20260812300001_facility_persona/migration.sql` | CREATE migration SQL |
| `apps/api/src/facility/maintenance/maintenance.service.ts` | Replace hardcoded `1000000` with ClubSettings lookup |
| `apps/api/src/facility/maintenance/dto/maintenance.dto.ts` | Add `partnerId?: number` to CreateMaintenanceDto |
| `apps/api/src/facility/maintenance/maintenance.repo.ts` | Include `partnerId` in SELECT and write |
| `apps/api/src/equipment/equipment.service.ts` | Enforce `disposedById`/`disposedAt` when retiring a unit |
| `apps/api/src/equipment/dto/equipment.dto.ts` | Add `disposedById`, `disposalNote` to retire DTO |
| `apps/api/src/jobs/inspectionDueAlert.ts` | New cron — daily check for units where `nextInspectionDue` ≤ 7 days |
| `apps/api/src/server.ts` | Register `inspectionDueAlert` cron |
| `apps/api/src/facility/reservation/reservation.controller.ts` | Call `writeAuditLog` on create and delete |
| `apps/api/__test__/facility/maintenance.service.test.ts` | Add test for dynamic threshold; add partnerId test |
| `apps/api/__test__/equipment/equipment.retire.test.ts` | New — test disposal fields required |
| `apps/api/__test__/jobs/inspectionDueAlert.test.ts` | New — unit tests for alert job |

---

## Task 1: Schema changes + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260812300001_facility_persona/migration.sql`

- [ ] **Step 1: Update ClubSettings in schema**

In `apps/api/prisma/schema.prisma`, find the `ClubSettings` model and add the new field:

```prisma
model ClubSettings {
  id                   Int    @id @default(1)
  currency             String @default("KRW")
  ibiBeta              Float  @default(1.0)
  planApprovalLimit    Int    @default(10000000)
  maintenanceCostLimit Int    @default(1000000)
  reviewerDeptMap      Json?
}
```

- [ ] **Step 2: Update MaintenanceRequest in schema**

Find `MaintenanceRequest` and add `partnerId` after `createdById`:

```prisma
model MaintenanceRequest {
  // ... existing fields ...
  createdById         Int
  partnerId           Int?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  // ... existing relations ...
  partner  Partner? @relation("MaintenancePartner", fields: [partnerId], references: [id])
}
```

Also add to the `Partner` model (find it and append):
```prisma
maintenanceRequests MaintenanceRequest[] @relation("MaintenancePartner")
```

- [ ] **Step 3: Update EquipmentUnit in schema**

Find `EquipmentUnit` and add disposal fields after `sanitationStatus`:

```prisma
model EquipmentUnit {
  // ... existing fields ...
  sanitationStatus      String?
  disposedById          Int?
  disposedAt            DateTime?
  disposalNote          String?            @db.Text

  // ... existing relations ...
  disposedBy  User? @relation("EquipmentDisposer", fields: [disposedById], references: [id])
}
```

Also add to `User` model:
```prisma
disposedEquipmentUnits EquipmentUnit[] @relation("EquipmentDisposer")
```

- [ ] **Step 4: Create migration directory and SQL**

```bash
mkdir -p apps/api/prisma/migrations/20260812300001_facility_persona
```

Write `apps/api/prisma/migrations/20260812300001_facility_persona/migration.sql`:

```sql
ALTER TABLE "ClubSettings" ADD COLUMN "maintenanceCostLimit" INTEGER NOT NULL DEFAULT 1000000;

ALTER TABLE "MaintenanceRequest" ADD COLUMN "partnerId" INTEGER;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EquipmentUnit" ADD COLUMN "disposedById" INTEGER;
ALTER TABLE "EquipmentUnit" ADD COLUMN "disposedAt" TIMESTAMP(3);
ALTER TABLE "EquipmentUnit" ADD COLUMN "disposalNote" TEXT;
ALTER TABLE "EquipmentUnit" ADD CONSTRAINT "EquipmentUnit_disposedById_fkey"
  FOREIGN KEY ("disposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 5: Apply migration without shadow DB**

```bash
cd apps/api
psql $DATABASE_URL -f prisma/migrations/20260812300001_facility_persona/migration.sql
npx prisma migrate resolve --applied 20260812300001_facility_persona
npx prisma generate
```

Expected: `Migration 20260812300001_facility_persona marked as applied`

- [ ] **Step 6: Commit schema**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260812300001_facility_persona/
git commit -m "feat(schema): facility persona — ClubSettings.maintenanceCostLimit, MaintenanceRequest.partnerId, EquipmentUnit disposal fields"
```

---

## Task 2: Dynamic maintenance cost threshold (TR2)

**Files:**
- Modify: `apps/api/src/facility/maintenance/maintenance.service.ts`
- Modify: `apps/api/src/facility/maintenance/maintenance.repo.ts`
- Modify: `apps/api/__test__/facility/maintenance.service.test.ts`

- [ ] **Step 1: Write failing test**

In `apps/api/__test__/facility/maintenance.service.test.ts`, add inside the describe block:

```typescript
describe('submitToFinance', () => {
  it('rejects when cost is below ClubSettings.maintenanceCostLimit', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1, title: 'Fix roof', estimatedCost: 500000,
      status: 'OPEN', financeSubmittedAt: null, createdBy: { id: 2 },
    });
    mockPrisma.clubSettings.findUnique.mockResolvedValue({ maintenanceCostLimit: 1000000 });

    await expect(service.submitToFinance(1, 99)).rejects.toMatchObject({ code: 'COST_BELOW_THRESHOLD' });
  });

  it('succeeds when cost equals the dynamic limit from ClubSettings', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 2, title: 'Fix roof', estimatedCost: 800000,
      status: 'OPEN', financeSubmittedAt: null, createdBy: { id: 2 },
    });
    mockPrisma.clubSettings.findUnique.mockResolvedValue({ maintenanceCostLimit: 800000 });
    mockRepo.submitToFinance.mockResolvedValue({ id: 2, financeSubmittedAt: new Date() });

    await expect(service.submitToFinance(2, 99)).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && npx jest --testPathPattern="maintenance.service" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `maintenanceCostLimit` not yet read from DB.

- [ ] **Step 3: Update maintenance.service.ts**

Find `submitToFinance` and replace the hardcoded check:

```typescript
async submitToFinance(id: number, userId: number) {
  const existing = await this.repo.findById(id);
  if (!existing) throw new AppError(404, "MAINTENANCE_NOT_FOUND");

  const settings = await this.prisma.clubSettings.findUnique({
    where: { id: 1 },
    select: { maintenanceCostLimit: true },
  });
  const limit = settings?.maintenanceCostLimit ?? 1000000;

  const cost = existing.estimatedCost ? Number(existing.estimatedCost) : 0;
  if (cost < limit) throw new AppError(400, "COST_BELOW_THRESHOLD");
  if (existing.financeSubmittedAt) throw new AppError(400, "ALREADY_SUBMITTED_TO_FINANCE");

  const result = await this.repo.submitToFinance(id);
  void this.notifications.notifyFacilityFinanceSubmit(existing.title, id, cost).catch(console.error);
  return result;
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd apps/api && npx jest --testPathPattern="maintenance.service" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Add partnerId to maintenance DTO**

In `apps/api/src/facility/maintenance/dto/maintenance.dto.ts`, add to `CreateMaintenanceDto`:

```typescript
export class CreateMaintenanceDto {
  // ... existing fields ...
  partnerId?: number;
}
```

- [ ] **Step 6: Update maintenance.repo.ts SELECT to include partner**

In `apps/api/src/facility/maintenance/maintenance.repo.ts`, find the `MAINTENANCE_SELECT` constant (or equivalent) and add:

```typescript
partner: { select: { id: true, name: true } },
```

And in the create/update data, pass `partnerId` if provided.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/facility/maintenance/ apps/api/__test__/facility/maintenance.service.test.ts
git commit -m "feat(maintenance): dynamic cost threshold from ClubSettings + partnerId linkage (TR2/TR10)"
```

---

## Task 3: Disposal accountability (TR8)

**Files:**
- Modify: `apps/api/src/equipment/equipment.service.ts`
- Modify: `apps/api/src/equipment/dto/equipment.dto.ts`
- Create: `apps/api/__test__/equipment/equipment.retire.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/api/__test__/equipment/equipment.retire.test.ts`:

```typescript
import { EquipmentService } from '../../src/equipment/equipment.service';

describe('retireUnit', () => {
  let service: EquipmentService;
  let mockRepo: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockRepo = { findUnitById: jest.fn(), retireUnit: jest.fn() };
    mockPrisma = {};
    service = new EquipmentService(mockRepo, mockPrisma);
  });

  it('throws when disposedById is missing on RETIRED transition', async () => {
    mockRepo.findUnitById.mockResolvedValue({ id: 1, status: 'AVAILABLE' });

    await expect(
      service.retireUnit(1, { disposalNote: 'worn out' }, 99)
    ).rejects.toMatchObject({ code: 'DISPOSAL_ACTOR_REQUIRED' });
  });

  it('sets disposedAt to now when disposedById is provided', async () => {
    mockRepo.findUnitById.mockResolvedValue({ id: 1, status: 'AVAILABLE' });
    mockRepo.retireUnit.mockResolvedValue({ id: 1, status: 'RETIRED', disposedById: 5, disposedAt: new Date() });

    const result = await service.retireUnit(1, { disposedById: 5, disposalNote: 'worn out' }, 99);
    expect(result.disposedById).toBe(5);
    expect(result.disposedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd apps/api && npx jest --testPathPattern="equipment.retire" --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `retireUnit` not found or missing disposal check.

- [ ] **Step 3: Add RetireUnitDto**

In `apps/api/src/equipment/dto/equipment.dto.ts`, add:

```typescript
export class RetireUnitDto {
  disposedById?: number;
  disposalNote?: string;
}
```

- [ ] **Step 4: Update equipment.service.ts retireUnit**

Find or add `retireUnit` in `apps/api/src/equipment/equipment.service.ts`:

```typescript
async retireUnit(unitId: number, dto: RetireUnitDto, actorId: number) {
  const unit = await this.repo.findUnitById(unitId);
  if (!unit) throw new AppError(404, "EQUIPMENT_UNIT_NOT_FOUND");
  if (!dto.disposedById) throw new AppError(400, "DISPOSAL_ACTOR_REQUIRED");

  return this.repo.retireUnit(unitId, {
    status: "RETIRED",
    disposedById: dto.disposedById,
    disposedAt: new Date(),
    disposalNote: dto.disposalNote ?? null,
    bookValue: 0,
  });
}
```

Update `retireUnit` in the repo to write the new fields.

- [ ] **Step 5: Run test to confirm pass**

```bash
cd apps/api && npx jest --testPathPattern="equipment.retire" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/equipment/ apps/api/__test__/equipment/equipment.retire.test.ts
git commit -m "feat(equipment): require disposedById/disposalNote on RETIRED transition (TR8)"
```

---

## Task 4: Preventive inspection cron (TR4 / TR9)

**Files:**
- Create: `apps/api/src/jobs/inspectionDueAlert.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/__test__/jobs/inspectionDueAlert.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/api/__test__/jobs/inspectionDueAlert.test.ts`:

```typescript
import { runInspectionDueAlert } from '../../src/jobs/inspectionDueAlert';

describe('runInspectionDueAlert', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      equipmentUnit: { findMany: jest.fn() },
      notification: { create: jest.fn() },
      user: { findMany: jest.fn() },
    };
  });

  it('creates notifications for units due within 7 days', async () => {
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
    mockPrisma.equipmentUnit.findMany.mockResolvedValue([
      { id: 10, item: { name: 'Training Vest' }, nextInspectionDue: dueDate },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockPrisma.notification.create.mockResolvedValue({ id: 99 });

    await runInspectionDueAlert(mockPrisma);

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'INSPECTION_DUE_SOON' }),
      })
    );
  });

  it('skips units not due within 7 days', async () => {
    const farDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockPrisma.equipmentUnit.findMany.mockResolvedValue([
      { id: 11, item: { name: 'Ball' }, nextInspectionDue: farDate },
    ]);

    await runInspectionDueAlert(mockPrisma);

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd apps/api && npx jest --testPathPattern="inspectionDueAlert" --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create inspectionDueAlert.ts**

Create `apps/api/src/jobs/inspectionDueAlert.ts`:

```typescript
import cron from 'node-cron';
import { getPrisma } from '../lib/prisma';
import type { PrismaClient } from '../generated/client';

export async function runInspectionDueAlert(prisma: PrismaClient = getPrisma()) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const units = await prisma.equipmentUnit.findMany({
    where: {
      nextInspectionDue: { gte: now, lte: in7Days },
      status: { not: 'RETIRED' },
    },
    include: { item: { select: { name: true } } },
  });

  if (units.length === 0) return;

  // Notify facility managers (ADMIN and SUPER_ADMIN)
  const managers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] as any[] } },
    select: { id: true },
  });

  await Promise.all(
    units.flatMap(unit =>
      managers.map(mgr =>
        prisma.notification.create({
          data: {
            userId: mgr.id,
            type: 'INSPECTION_DUE_SOON' as any,
            message: `장비 점검 예정: ${unit.item.name} — ${unit.nextInspectionDue!.toLocaleDateString('ko-KR')}까지`,
            message_en: `Equipment inspection due: ${unit.item.name} — by ${unit.nextInspectionDue!.toLocaleDateString('en-GB')}`,
          },
        }).catch(console.error)
      )
    )
  );
}

export function startInspectionDueCron() {
  cron.schedule('0 8 * * *', () => {
    runInspectionDueAlert().catch(console.error);
  });
}
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd apps/api && npx jest --testPathPattern="inspectionDueAlert" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Register cron in server.ts**

In `apps/api/src/server.ts`, find where `sponsorshipExpiryAlert` is registered and add below it:

```typescript
import { startInspectionDueCron } from './jobs/inspectionDueAlert';
// ...
startInspectionDueCron();
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/jobs/inspectionDueAlert.ts apps/api/src/server.ts apps/api/__test__/jobs/inspectionDueAlert.test.ts
git commit -m "feat(jobs): inspection due alert cron — 7-day warning for equipment units (TR4/TR9)"
```

---

## Task 5: Reservation audit logging (TR7)

**Files:**
- Modify: `apps/api/src/facility/reservation/reservation.controller.ts`

- [ ] **Step 1: Update reservation.controller.ts**

Find the `create` and `delete` handlers in `apps/api/src/facility/reservation/reservation.controller.ts` and add audit logging:

```typescript
import { writeAuditLog } from '../../lib/auditLog';

// In create handler, after successful creation:
void writeAuditLog({
  actorId: req.user.id,
  action: 'FACILITY_RESERVATION_CREATED',
  targetId: reservation.id,
  detail: { facilityZone: dto.facilityZone, title: dto.title, startTime: dto.startTime, endTime: dto.endTime },
}).catch(console.error);

// In delete handler, after successful deletion:
void writeAuditLog({
  actorId: req.user.id,
  action: 'FACILITY_RESERVATION_DELETED',
  targetId: id,
  detail: { facilityZone: existing.facilityZone, title: existing.title },
}).catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/facility/reservation/reservation.controller.ts
git commit -m "feat(reservation): audit log on create/delete (TR7)"
```

---

## Task 6: Full test run + also update nextInspectionDue on inspection complete

**Files:**
- Modify: `apps/api/src/facility/inspection/inspection.service.ts`

- [ ] **Step 1: Auto-calculate nextInspectionDue when inspection completed**

In `apps/api/src/facility/inspection/inspection.service.ts`, find the `update` method (or wherever inspection result is set). When `result` transitions to a terminal state (e.g., `PASS` or `FAIL`), auto-update the inspected unit's `nextInspectionDue`:

```typescript
// After saving inspection result, if sourceUnit has inspectionIntervalDays:
if (updated.result !== 'PENDING' && updated.equipmentUnitId && updated.equipmentUnit?.inspectionIntervalDays) {
  const days = updated.equipmentUnit.inspectionIntervalDays;
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + days);
  await prisma.equipmentUnit.update({
    where: { id: updated.equipmentUnitId },
    data: { lastInspectedAt: new Date(), nextInspectionDue: nextDue },
  });
}
```

Adjust field names to match the actual inspection model (check if `equipmentUnitId` exists; if not, this step may not apply and can be skipped).

- [ ] **Step 2: Run all facility tests**

```bash
cd apps/api && npx jest --testPathPattern="facility|equipment|inspection|inspectionDue" --no-coverage 2>&1 | tail -20
```

Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/facility/inspection/inspection.service.ts
git commit -m "feat(inspection): auto-update nextInspectionDue on completion (TR9)"
```

---

## Self-Review

**Spec coverage:**
- TR2 maintenance cost threshold → Task 2 ✅
- TR4/TR9 preventive scheduling → Task 4 + Task 6 ✅
- TR7 reservation audit → Task 5 ✅
- TR8 disposal accountability → Task 3 ✅
- TR10 vendor linkage → Task 2 (partnerId) ✅

**Placeholder scan:** No TBD or TODO in plan.

**Type consistency:** `RetireUnitDto`, `runInspectionDueAlert`, `writeAuditLog` params consistent throughout.
