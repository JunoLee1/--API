# Megan Medical Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce medical team authority boundaries (matchAvailable gate, securityLevel access control, allowedActivities guard), add rehab load tracking, automate youth expense payerType, and extend the ReturnChecklist with a load recovery criterion.

**Architecture:** Service-layer guards validate role before mutating sensitive fields; schema adds two optional columns to InjuryReport; frontend ReturnChecklist reads the new field; youth MedicalExpense auto-sets payerType at create time. No new routes or models.

**Tech Stack:** Prisma (schema migration), Express TypeScript (service/controller), React+Vite (InjuryDetailPage), Jest (unit tests)

---

## File Map

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `allowedActivities Text?` + `rehabLoadPercentage Int?` to InjuryReport |
| `apps/api/prisma/migrations/20260812100000_megan_injury_report_fields/migration.sql` | Create migration |
| `apps/api/src/injury/dto/injury.dto.ts` | Add fields to `UpsertInjuryReportDto` |
| `apps/api/src/injury/injury.repo.ts` | Add fields to `INJURY_REPORT_SELECT` + `upsertReport` |
| `apps/api/src/injury/injury.service.ts` | securityLevel gate, allowedActivities guard, matchAvailable soft gate, RETURNED medical notification |
| `apps/api/src/injury/injury.controller.ts` | Pass user context to `getReport` + `saveReport` |
| `apps/api/src/medical-expense/medical-expense.repo.ts` | Add `findPlayerLevel(playerId)` |
| `apps/api/src/medical-expense/medical-expense.service.ts` | Auto-set `payerType: CLUB` for YOUTH players |
| `apps/api/__test__/injury/injury.service.test.ts` | New — service-level unit tests |
| `apps/api/__test__/medical-expense/medical-expense.service.test.ts` | New — youth payerType test |
| `football/src/pages/injuries/InjuryDetailPage.tsx` | ReturnChecklist + rehabLoadPercentage criterion + allowedActivities field + matchAvailable warning |

---

## Task 1: Schema migration — allowedActivities + rehabLoadPercentage

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (InjuryReport model)
- Create: `apps/api/prisma/migrations/20260812100000_megan_injury_report_fields/migration.sql`

- [ ] **Step 1: Add fields to schema**

In `apps/api/prisma/schema.prisma`, find the InjuryReport model (currently ends with `medicalOpinion` and `securityLevel` fields). Add two fields after `securityLevel`:

```prisma
model InjuryReport {
  id                 Int           @id @default(autoincrement())
  injuryId           Int           @unique
  diagnosisName      String?
  treatmentContent   String?       @db.Text
  rehabStage         RehabStage?
  trainingReturnDate DateTime?
  matchAvailable     Boolean?
  reinjuryRisk       RiskLevel?
  medicalOpinion     String?       @db.Text
  securityLevel      SecurityLevel @default(INTERNAL)
  allowedActivities  String?       @db.Text
  rehabLoadPercentage Int?
  // ... rest unchanged
```

- [ ] **Step 2: Create migration file**

Create directory `apps/api/prisma/migrations/20260812100000_megan_injury_report_fields/` and write `migration.sql`:

```sql
ALTER TABLE "InjuryReport" ADD COLUMN "allowedActivities" TEXT;
ALTER TABLE "InjuryReport" ADD COLUMN "rehabLoadPercentage" INTEGER;
```

- [ ] **Step 3: Apply migration**

```bash
cd apps/api && npx prisma migrate dev --name megan_injury_report_fields
```

Expected: `The following migration(s) have been applied` or `Already in sync`.

- [ ] **Step 4: Regenerate Prisma client**

```bash
cd apps/api && npx prisma generate
```

Expected: `Generated Prisma Client`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260812100000_megan_injury_report_fields/
git commit -m "feat(injury): add allowedActivities and rehabLoadPercentage to InjuryReport"
```

---

## Task 2: DTO + Repo wiring

**Files:**
- Modify: `apps/api/src/injury/dto/injury.dto.ts`
- Modify: `apps/api/src/injury/injury.repo.ts`

- [ ] **Step 1: Add fields to DTO**

In `apps/api/src/injury/dto/injury.dto.ts`, update `UpsertInjuryReportDto`:

```typescript
export interface UpsertInjuryReportDto {
  diagnosisName?: string;
  treatmentContent?: string;
  rehabStage?: RehabStage;
  trainingReturnDate?: string;
  matchAvailable?: boolean;
  reinjuryRisk?: RiskLevel;
  medicalOpinion?: string;
  securityLevel?: SecurityLevel;
  allowedActivities?: string;
  rehabLoadPercentage?: number;
}
```

- [ ] **Step 2: Add fields to INJURY_REPORT_SELECT**

In `apps/api/src/injury/injury.repo.ts`, update `INJURY_REPORT_SELECT` (around line 22):

```typescript
const INJURY_REPORT_SELECT = {
  id: true,
  injuryId: true,
  diagnosisName: true,
  treatmentContent: true,
  rehabStage: true,
  trainingReturnDate: true,
  matchAvailable: true,
  reinjuryRisk: true,
  medicalOpinion: true,
  securityLevel: true,
  allowedActivities: true,
  rehabLoadPercentage: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, nickname: true } },
  updatedBy: { select: { id: true, nickname: true } },
  coachSignedAt: true,
  coachSignedById: true,
  coachSigner: { select: { id: true, nickname: true } },
  trainerSignedAt: true,
  trainerSignedById: true,
  trainerSigner: { select: { id: true, nickname: true } },
  medicalSignedAt: true,
  medicalSignedById: true,
  medicalSigner: { select: { id: true, nickname: true } },
} as const;
```

- [ ] **Step 3: Update upsertReport data object**

In `apps/api/src/injury/injury.repo.ts`, `upsertReport` method (around line 157), update the `data` object:

```typescript
upsertReport(injuryId: number, dto: UpsertInjuryReportDto, userId: number) {
  const data = {
    diagnosisName: dto.diagnosisName ?? null,
    treatmentContent: dto.treatmentContent ?? null,
    rehabStage: dto.rehabStage ?? null,
    trainingReturnDate: dto.trainingReturnDate ? new Date(dto.trainingReturnDate) : null,
    matchAvailable: dto.matchAvailable ?? null,
    reinjuryRisk: dto.reinjuryRisk ?? null,
    medicalOpinion: dto.medicalOpinion ?? null,
    securityLevel: dto.securityLevel ?? "INTERNAL",
    allowedActivities: dto.allowedActivities ?? null,
    rehabLoadPercentage: dto.rehabLoadPercentage ?? null,
  };
  return this.prisma.injuryReport.upsert({
    where: { injuryId },
    create: { ...data, injuryId, createdById: userId },
    update: { ...data, updatedById: userId },
    select: INJURY_REPORT_SELECT,
  });
}
```

- [ ] **Step 4: Run existing tests to verify nothing broke**

```bash
cd apps/api && npx jest --testPathPattern="injury" --no-coverage
```

Expected: All existing injury tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/injury/dto/injury.dto.ts apps/api/src/injury/injury.repo.ts
git commit -m "feat(injury): wire allowedActivities and rehabLoadPercentage through DTO and repo"
```

---

## Task 3: securityLevel access enforcement

**Files:**
- Modify: `apps/api/src/injury/injury.service.ts`
- Modify: `apps/api/src/injury/injury.controller.ts`
- Create: `apps/api/__test__/injury/injury.service.test.ts`

Rule: `PRIVATE` reports are readable only by ADMIN or COACHING_STAFF with `coachingRole` MEDICAL or MEDICAL_DIRECTOR.

- [ ] **Step 1: Write the failing test**

Create `apps/api/__test__/injury/injury.service.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";

const mockRepo = {
  findById: jest.fn(),
  findReport: jest.fn(),
  upsertReport: jest.fn(),
  getPlayerWithGuardian: jest.fn(),
};
const mockNotifRepo = {
  createForCoachingStaff: jest.fn(),
  createForMedicalStaff: jest.fn(),
  createForMedicalDirector: jest.fn(),
  createForHeadCoach: jest.fn(),
  countAvailableByZone: jest.fn(),
};

jest.mock("../../src/lib/prisma", () => ({ getPrisma: () => ({}) }));
jest.mock("../../src/lib/io", () => ({ getIO: () => ({ to: () => ({ emit: jest.fn() }) }) }));
jest.mock("../../src/lib/auditLog", () => ({ writeAuditLog: jest.fn() }));

import { InjuryService } from "../../src/injury/injury.service";

describe("InjuryService — securityLevel gate", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(mockRepo as any, mockNotifRepo as any);
  });

  test("PRIVATE report is accessible by ADMIN", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findReport.mockResolvedValue({ securityLevel: "PRIVATE", matchAvailable: null, medicalSignedAt: null });

    const result = await service.getReport(1, { role: "ADMIN", coachingRole: null });
    expect(result).toBeDefined();
  });

  test("PRIVATE report is accessible by MEDICAL_DIRECTOR", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findReport.mockResolvedValue({ securityLevel: "PRIVATE", matchAvailable: null, medicalSignedAt: null });

    const result = await service.getReport(1, { role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR" });
    expect(result).toBeDefined();
  });

  test("PRIVATE report is blocked for HEAD_COACH", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findReport.mockResolvedValue({ securityLevel: "PRIVATE", matchAvailable: null, medicalSignedAt: null });

    await expect(
      service.getReport(1, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("INTERNAL report is accessible by HEAD_COACH", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findReport.mockResolvedValue({ securityLevel: "INTERNAL", matchAvailable: null, medicalSignedAt: null });

    const result = await service.getReport(1, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && npx jest --testPathPattern="injury.service" --no-coverage
```

Expected: FAIL — `getReport` does not accept a second argument.

- [ ] **Step 3: Update InjuryService.getReport**

In `apps/api/src/injury/injury.service.ts`, replace the `getReport` method:

```typescript
private isMedicalRole(role: string, coachingRole: string | null): boolean {
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;
  return role === 'COACHING_STAFF' &&
    (coachingRole === 'MEDICAL' || coachingRole === 'MEDICAL_DIRECTOR');
}

async getReport(injuryId: number, requester: { role: string; coachingRole: string | null }) {
  const injury = await this.repo.findById(injuryId);
  if (!injury) throw new AppError(404, "INJURY_NOT_FOUND");
  const report = await this.repo.findReport(injuryId);
  if (!report) return null;
  if (report.securityLevel === 'PRIVATE' && !this.isMedicalRole(requester.role, requester.coachingRole)) {
    throw new AppError(403, "FORBIDDEN");
  }
  return report;
}
```

- [ ] **Step 4: Update InjuryController.getReport to pass user context**

In `apps/api/src/injury/injury.controller.ts`, update `getReport`:

```typescript
getReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    void writeAuditLog({ actorId: user.id, action: "MEDICAL_DATA_READ", targetId: String(req.params["id"]) }).catch(console.error);
    const report = await this.service.getReport(
      Number(req.params["id"]),
      { role: user.role, coachingRole: user.coachingRole ?? null },
    );
    res.status(200).json(report ?? null);
  } catch (err) { next(err); }
};
```

- [ ] **Step 5: Run tests to verify passing**

```bash
cd apps/api && npx jest --testPathPattern="injury" --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/injury/injury.service.ts apps/api/src/injury/injury.controller.ts apps/api/__test__/injury/injury.service.test.ts
git commit -m "feat(injury): enforce securityLevel=PRIVATE access gate in getReport"
```

---

## Task 4: allowedActivities write guard + matchAvailable soft gate

**Files:**
- Modify: `apps/api/src/injury/injury.service.ts`
- Modify: `apps/api/src/injury/injury.controller.ts`
- Modify: `apps/api/__test__/injury/injury.service.test.ts`

Rules:
- `allowedActivities` can only be set by MEDICAL/MEDICAL_DIRECTOR; others' value is silently dropped
- When `matchAvailable=true` is saved and `medicalSignedAt` is null, the response includes `_warning: "MATCH_AVAILABLE_WITHOUT_MEDICAL_CLEARANCE"`

- [ ] **Step 1: Write failing tests**

Append to `apps/api/__test__/injury/injury.service.test.ts`:

```typescript
describe("InjuryService — allowedActivities write guard", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(mockRepo as any, mockNotifRepo as any);
    mockRepo.findById.mockResolvedValue({ id: 1 });
  });

  test("MEDICAL_DIRECTOR can set allowedActivities", async () => {
    mockRepo.upsertReport.mockResolvedValue({ matchAvailable: null, medicalSignedAt: null, allowedActivities: "Water rehab only" });

    await service.saveReport(1, { allowedActivities: "Water rehab only" }, 99, { role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR" });

    expect(mockRepo.upsertReport).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ allowedActivities: "Water rehab only" }),
      99,
    );
  });

  test("HEAD_COACH cannot set allowedActivities — field is stripped", async () => {
    mockRepo.upsertReport.mockResolvedValue({ matchAvailable: null, medicalSignedAt: null, allowedActivities: null });

    await service.saveReport(1, { allowedActivities: "Full training" }, 99, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });

    expect(mockRepo.upsertReport).toHaveBeenCalledWith(
      1,
      expect.not.objectContaining({ allowedActivities: "Full training" }),
      99,
    );
  });
});

describe("InjuryService — matchAvailable soft gate", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(mockRepo as any, mockNotifRepo as any);
    mockRepo.findById.mockResolvedValue({ id: 1 });
  });

  test("matchAvailable=true without medical signature returns warning", async () => {
    mockRepo.upsertReport.mockResolvedValue({ matchAvailable: true, medicalSignedAt: null });

    const result = await service.saveReport(1, { matchAvailable: true }, 99, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });

    expect(result._warning).toBe("MATCH_AVAILABLE_WITHOUT_MEDICAL_CLEARANCE");
  });

  test("matchAvailable=true with medical signature returns no warning", async () => {
    mockRepo.upsertReport.mockResolvedValue({ matchAvailable: true, medicalSignedAt: new Date() });

    const result = await service.saveReport(1, { matchAvailable: true }, 99, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });

    expect(result._warning).toBeUndefined();
  });

  test("matchAvailable=false never returns warning", async () => {
    mockRepo.upsertReport.mockResolvedValue({ matchAvailable: false, medicalSignedAt: null });

    const result = await service.saveReport(1, { matchAvailable: false }, 99, { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" });

    expect(result._warning).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && npx jest --testPathPattern="injury.service" --no-coverage
```

Expected: FAIL — `saveReport` does not accept the fourth argument.

- [ ] **Step 3: Update InjuryService.saveReport**

In `apps/api/src/injury/injury.service.ts`, replace the `saveReport` method:

```typescript
async saveReport(
  injuryId: number,
  dto: UpsertInjuryReportDto,
  userId: number,
  requester: { role: string; coachingRole: string | null },
) {
  const injury = await this.repo.findById(injuryId);
  if (!injury) throw new AppError(404, "INJURY_NOT_FOUND");

  // allowedActivities: medical-only field — strip for non-medical roles
  const safeDto: UpsertInjuryReportDto = this.isMedicalRole(requester.role, requester.coachingRole)
    ? dto
    : { ...dto, allowedActivities: undefined };

  const report = await this.repo.upsertReport(injuryId, safeDto, userId);

  // soft gate: warn when matchAvailable=true without medical clearance
  const warning =
    report.matchAvailable === true && !report.medicalSignedAt
      ? "MATCH_AVAILABLE_WITHOUT_MEDICAL_CLEARANCE"
      : undefined;

  return warning ? { ...report, _warning: warning } : report;
}
```

- [ ] **Step 4: Update InjuryController.saveReport to pass user context**

In `apps/api/src/injury/injury.controller.ts`, update `saveReport`:

```typescript
saveReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    if (!(MEDICAL_ROLES as readonly string[]).includes(user.role)) throw new AppError(403, "FORBIDDEN");
    res.status(200).json(
      await this.service.saveReport(
        Number(req.params["id"]),
        req.body,
        user.id,
        { role: user.role, coachingRole: user.coachingRole ?? null },
      )
    );
  } catch (err) { next(err); }
};
```

- [ ] **Step 5: Run all injury tests**

```bash
cd apps/api && npx jest --testPathPattern="injury" --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/injury/injury.service.ts apps/api/src/injury/injury.controller.ts apps/api/__test__/injury/injury.service.test.ts
git commit -m "feat(injury): allowedActivities write guard + matchAvailable soft gate warning"
```

---

## Task 5: RETURNED status → medical staff notification

**Files:**
- Modify: `apps/api/src/injury/injury.service.ts`
- Modify: `apps/api/__test__/injury/injury.service.test.ts`

Currently `updateStatus(→ RETURNED)` notifies only coaching staff. Add medical staff notification so Megan's team knows a player has returned to full training.

- [ ] **Step 1: Write failing test**

Append to `apps/api/__test__/injury/injury.service.test.ts`:

```typescript
describe("InjuryService — RETURNED notification", () => {
  let service: InjuryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InjuryService(mockRepo as any, mockNotifRepo as any);
    mockRepo.findById.mockResolvedValue({ id: 1, playerId: "p1", status: "READY_TO_RETURN" });
    mockRepo.updateStatus.mockResolvedValue({ id: 1, status: "RETURNED" });
    mockRepo.getPlayerWithGuardian.mockResolvedValue({ playerName: "Kim", guardianId: null });
    mockRepo.countAvailableByZone.mockResolvedValue({ GK: 3, DEF: 5, MID: 4, FWD: 3 });
    mockNotifRepo.createForCoachingStaff.mockResolvedValue(undefined);
    mockNotifRepo.createForMedicalStaff.mockResolvedValue(undefined);
  });

  test("RETURNED status notifies both coaching staff and medical staff", async () => {
    await service.updateStatus(1, { status: "RETURNED" });

    expect(mockNotifRepo.createForCoachingStaff).toHaveBeenCalledWith(
      "INJURY_RETURNED",
      expect.any(Function),
      1,
    );
    expect(mockNotifRepo.createForMedicalStaff).toHaveBeenCalledWith(
      "INJURY_RETURNED",
      expect.any(Function),
      1,
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && npx jest --testPathPattern="injury.service" --no-coverage
```

Expected: FAIL — `createForMedicalStaff` not called.

- [ ] **Step 3: Update updateStatus in InjuryService**

In `apps/api/src/injury/injury.service.ts`, update the `RETURNED` branch inside `updateStatus`:

```typescript
} else if (dto.status === "RETURNED") {
  const title = "선수 부상 복귀";
  const body = `${playerName} 선수가 부상에서 복귀하여 훈련에 합류했습니다.`;
  await this.notifRepo.createForCoachingStaff("INJURY_RETURNED", () => ({ title, body }), id);
  await this.notifRepo.createForMedicalStaff("INJURY_RETURNED", () => ({ title, body }), id);
  getIO().to("staff-room").emit("notification:injury", {
    type: "INJURY_RETURNED", title, body, createdAt: new Date().toISOString(),
  });
  await this.checkAndNotifySquadDepth(id);
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && npx jest --testPathPattern="injury" --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/injury/injury.service.ts apps/api/__test__/injury/injury.service.test.ts
git commit -m "feat(injury): notify medical staff when player status becomes RETURNED"
```

---

## Task 6: Youth MedicalExpense auto payerType

**Files:**
- Modify: `apps/api/src/medical-expense/medical-expense.repo.ts`
- Modify: `apps/api/src/medical-expense/medical-expense.service.ts`
- Create: `apps/api/__test__/medical-expense/medical-expense.service.test.ts`

Rule: if the expense references a YOUTH player (via `playerId` or `injuryId → injury.playerId`), auto-set `payerType = 'CLUB'`.

- [ ] **Step 1: Write failing test**

Create `apps/api/__test__/medical-expense/medical-expense.service.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";

const mockRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findPlayerLevel: jest.fn(),
  findAll: jest.fn(),
  submit: jest.fn(),
  update: jest.fn(),
};
const mockNotifRepo = {
  createForMedicalDirector: jest.fn(),
};

jest.mock("../../src/lib/prisma", () => ({ getPrisma: () => ({}) }));

import { MedicalExpenseService } from "../../src/medical-expense/medical-expense.service";

describe("MedicalExpenseService — youth auto payerType", () => {
  let service: MedicalExpenseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MedicalExpenseService(mockRepo as any, mockNotifRepo as any);
    mockRepo.create.mockResolvedValue({ id: 1, payerType: "CLUB" });
  });

  test("YOUTH player auto-sets payerType to CLUB regardless of submitted value", async () => {
    mockRepo.findPlayerLevel.mockResolvedValue("YOUTH");

    await service.create({
      submittedById: 1,
      receiptDate: new Date(),
      costCategory: "MEDICAL_TREATMENT",
      totalAmount: 50000,
      payerType: "INDIVIDUAL",
      playerId: "player-youth-1",
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ payerType: "CLUB" }),
    );
  });

  test("SENIOR player keeps submitted payerType", async () => {
    mockRepo.findPlayerLevel.mockResolvedValue("SENIOR");

    await service.create({
      submittedById: 1,
      receiptDate: new Date(),
      costCategory: "MEDICAL_TREATMENT",
      totalAmount: 50000,
      payerType: "INDIVIDUAL",
      playerId: "player-senior-1",
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ payerType: "INDIVIDUAL" }),
    );
  });

  test("no playerId keeps submitted payerType", async () => {
    await service.create({
      submittedById: 1,
      receiptDate: new Date(),
      costCategory: "MEDICAL_TREATMENT",
      totalAmount: 50000,
      payerType: "ASSOCIATION",
    });

    expect(mockRepo.findPlayerLevel).not.toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ payerType: "ASSOCIATION" }),
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && npx jest --testPathPattern="medical-expense.service" --no-coverage
```

Expected: FAIL — `findPlayerLevel` does not exist on repo.

- [ ] **Step 3: Add findPlayerLevel to MedicalExpenseRepository**

In `apps/api/src/medical-expense/medical-expense.repo.ts`, add after `findById`:

```typescript
findPlayerLevel(playerId: string) {
  return this.prisma.player.findUnique({
    where: { id: playerId },
    select: { level: true },
  }).then((p) => p?.level ?? null);
}
```

- [ ] **Step 4: Update MedicalExpenseService.create**

In `apps/api/src/medical-expense/medical-expense.service.ts`, replace the `create` method:

```typescript
async create(data: {
  submittedById: number;
  receiptDate: Date;
  costCategory: string;
  totalAmount: number;
  payerType: string;
  injuryId?: number;
  playerId?: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
}) {
  let payerType = data.payerType;
  if (data.playerId) {
    const level = await this.repo.findPlayerLevel(data.playerId);
    if (level === "YOUTH") payerType = "CLUB";
  }
  return this.repo.create({ ...data, payerType });
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && npx jest --testPathPattern="medical-expense" --no-coverage
```

Expected: All 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/medical-expense/medical-expense.repo.ts apps/api/src/medical-expense/medical-expense.service.ts apps/api/__test__/medical-expense/medical-expense.service.test.ts
git commit -m "feat(medical-expense): auto-set payerType=CLUB for YOUTH player expenses"
```

---

## Task 7: ReturnChecklist — rehabLoadPercentage criterion

**Files:**
- Modify: `football/src/pages/injuries/InjuryDetailPage.tsx`

Add a 6th criterion to `ReturnChecklist`: rehab load has reached ≥80% of pre-injury level (`rehabLoadPercentage >= 80`). The criterion is shown as "미확인" (grey, not blocking) when `rehabLoadPercentage` is null.

The component currently receives `assessment: InjuryAssessment`. The `report` (InjuryReport) has `rehabLoadPercentage`. Update the component to receive both.

- [ ] **Step 1: Locate ReturnChecklist call in InjuryDetailPage**

The component is called at line 544:
```tsx
<ReturnChecklist assessment={assessment} />
```

And the report data is available in the parent component as `report` (the InjuryReport object loaded from the API).

- [ ] **Step 2: Update ReturnChecklist signature and criteria**

In `football/src/pages/injuries/InjuryDetailPage.tsx`, replace the `ReturnChecklist` function (around line 68):

```tsx
function ReturnChecklist({
  assessment,
  rehabLoadPercentage,
}: {
  assessment: InjuryAssessment
  rehabLoadPercentage: number | null | undefined
}) {
  const { t } = useTranslation('medical')
  const avgFunctional = (assessment.strengthScore + assessment.sprintScore + assessment.jumpScore) / 3
  const criteria: { label: string; met: boolean; unknown?: boolean }[] = [
    { label: t('returnReadiness.painNormal'), met: assessment.painLevel <= 2 },
    { label: t('returnReadiness.swellingGone'), met: !assessment.hasSwelling },
    { label: t('returnReadiness.romRecovered'), met: assessment.romScore >= 80 },
    { label: t('returnReadiness.strengthRecovered'), met: avgFunctional >= 80 },
    { label: t('returnReadiness.psychReady'), met: assessment.psychScore <= 30 },
    {
      label: t('returnReadiness.loadRecovered'),
      met: (rehabLoadPercentage ?? 0) >= 80,
      unknown: rehabLoadPercentage == null,
    },
  ]
  const metCount = criteria.filter((c) => c.met).length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium">{t('returnReadiness.title')}</span>
        <span className="text-xs text-muted-foreground">{t('returnReadiness.met', { count: metCount, total: criteria.length })}</span>
      </div>
      {criteria.map((c) => (
        <div key={c.label} className="flex items-center gap-2">
          <span className={`text-sm ${c.unknown ? 'text-muted-foreground' : c.met ? 'text-green-600' : 'text-muted-foreground'}`}>
            {c.unknown ? '?' : c.met ? '✓' : '○'}
          </span>
          <span className={`text-sm ${c.met && !c.unknown ? '' : 'text-muted-foreground'}`}>{c.label}</span>
          {c.unknown && (
            <span className="text-xs text-muted-foreground">{t('returnReadiness.notRecorded')}</span>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Update ReturnChecklist call site to pass rehabLoadPercentage**

Find the call at line 544 and update it. The parent component should have `report` in scope (the `InjuryReport` object):

```tsx
<ReturnChecklist assessment={assessment} rehabLoadPercentage={report?.rehabLoadPercentage ?? null} />
```

- [ ] **Step 4: Add i18n key**

In the medical translation file (check `football/src/locales/ko/medical.json` or equivalent), add:

```json
"returnReadiness": {
  "loadRecovered": "재활 부하 80% 이상 회복",
  "notRecorded": "(미기록)"
}
```

Find the existing translation file location first:
```bash
find /Users/juno/work/football/football/src -name "*.json" | xargs grep -l "returnReadiness" 2>/dev/null
```

- [ ] **Step 5: Commit**

```bash
git add football/src/pages/injuries/InjuryDetailPage.tsx
git commit -m "feat(injury-ui): add rehabLoadPercentage criterion to ReturnChecklist"
```

---

## Task 8: allowedActivities UI (medical-only edit)

**Files:**
- Modify: `football/src/pages/injuries/InjuryDetailPage.tsx`

Display `allowedActivities` as a read-only text area for all roles; editable textarea only for MEDICAL/MEDICAL_DIRECTOR. The current user's role is available via `useAuth()` hook (check existing usage in the file).

- [ ] **Step 1: Find how user role is accessed in InjuryDetailPage**

```bash
grep -n "useAuth\|user\.role\|coachingRole\|isMedical" /Users/juno/work/football/football/src/pages/injuries/InjuryDetailPage.tsx | head -10
```

- [ ] **Step 2: Add allowedActivities state to the report form section**

In `InjuryDetailPage.tsx`, in the section where `matchAvailable` state is declared (around line 209), add:

```tsx
const [allowedActivities, setAllowedActivities] = useState<string>('')
```

And in the useEffect that loads report data (around line 222), add:

```tsx
setAllowedActivities(r.allowedActivities ?? '')
```

And in the save handler (around line 255), include in the payload:

```tsx
allowedActivities: allowedActivities || undefined,
```

- [ ] **Step 3: Add allowedActivities field to the report form JSX**

Find the report form section (where `matchAvailable` Select is rendered, around line 422) and add after the matchAvailable field:

```tsx
{/* allowedActivities: editable for medical, read-only for others */}
<div className="space-y-1">
  <Label>{t('detail.fieldAllowedActivities')}</Label>
  {isMedical ? (
    <Textarea
      value={allowedActivities}
      onChange={(e) => setAllowedActivities(e.target.value)}
      placeholder={t('detail.fieldAllowedActivitiesPlaceholder')}
      rows={3}
    />
  ) : (
    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
      {allowedActivities || t('detail.fieldAllowedActivitiesEmpty')}
    </p>
  )}
</div>
```

Where `isMedical` is derived from the current user's role:
```tsx
const { user } = useAuth()
const isMedical = user?.role === 'ADMIN' ||
  (user?.role === 'COACHING_STAFF' && (user?.coachingRole === 'MEDICAL' || user?.coachingRole === 'MEDICAL_DIRECTOR'))
```

- [ ] **Step 4: Add i18n keys**

In the medical translation file, add:
```json
"fieldAllowedActivities": "허용 재활 활동",
"fieldAllowedActivitiesPlaceholder": "예: 수중 재활만 허용, 풀콘택트 훈련 금지",
"fieldAllowedActivitiesEmpty": "지정된 활동 제한 없음"
```

- [ ] **Step 5: Commit**

```bash
git add football/src/pages/injuries/InjuryDetailPage.tsx
git commit -m "feat(injury-ui): add allowedActivities display and medical-only edit field"
```

---

## Task 9: matchAvailable warning badge

**Files:**
- Modify: `football/src/pages/injuries/InjuryDetailPage.tsx`

When the API returns `_warning: "MATCH_AVAILABLE_WITHOUT_MEDICAL_CLEARANCE"` after saving, or when the loaded report has `matchAvailable=true` and `medicalSignedAt=null`, show a yellow warning banner.

- [ ] **Step 1: Add warning state**

In the report state section of `InjuryDetailPage.tsx`, add:

```tsx
const [matchAvailableWarning, setMatchAvailableWarning] = useState(false)
```

Derive from loaded report in useEffect:
```tsx
setMatchAvailableWarning(r.matchAvailable === true && !r.medicalSignedAt)
```

After save, check the response:
```tsx
const result = await injuryApi.saveReport(injuryId, payload)
setMatchAvailableWarning(result._warning === 'MATCH_AVAILABLE_WITHOUT_MEDICAL_CLEARANCE')
```

- [ ] **Step 2: Render the warning banner**

In the JSX, right after the matchAvailable Select field (around line 430), add:

```tsx
{matchAvailableWarning && (
  <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
    <span className="mt-0.5 shrink-0">⚠</span>
    <span>{t('detail.matchAvailableWarning')}</span>
  </div>
)}
```

- [ ] **Step 3: Add i18n key**

In the medical translation file, add:
```json
"matchAvailableWarning": "의무팀 서명 없이 경기 출전 가능으로 표시되어 있습니다. 의무팀 확인을 권장합니다."
```

- [ ] **Step 4: Run full test suite**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add football/src/pages/injuries/InjuryDetailPage.tsx
git commit -m "feat(injury-ui): show warning when matchAvailable=true without medical signature"
```

---

## Self-Review

### Spec coverage

| Megan decision | Task |
|----------------|------|
| M1 matchAvailable soft gate | Task 4 + Task 9 |
| M2 allowedActivities medical-only | Task 1 + Task 2 + Task 4 + Task 8 |
| M3 PlayerMedicalHistory 현행 유지 | No-op ✓ |
| M4 medications 현행 유지 | No-op ✓ |
| M5 securityLevel enforcement | Task 3 |
| M6 ReturnChecklist 확장 | Task 7 |
| M7 priorWeeklyLoad × 0.8 threshold | Task 7 (rehabLoadPercentage ≥ 80 criterion) |
| M8 youth MedicalExpense payerType | Task 6 |
| M9 복귀 알림 + deeplink | Task 5 (INJURY_RETURNED 이미 entityId 포함 → deeplink 작동) |

### Known dependency
Task 7 reads `report.rehabLoadPercentage` from the API response. This requires Task 1 (schema) and Task 2 (repo select) to be merged first. Execute in order: 1 → 2 → remaining tasks can run independently.

### No placeholders confirmed ✓
