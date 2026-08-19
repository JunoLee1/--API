# Ledger Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix four ledger integrity bugs: hard-delete of ledger entries on sales cancel (L1), netPay recorded instead of grossPay in payroll ledger (L2), period-lock bypass in `createAutoEntry` (L3), and fire-and-forget ledger creation that can silently fail (L4).

**Architecture:** All fixes are confined to three service files. L3 extracts a shared `assertPeriodNotLocked` helper into `LedgerService`. L1 replaces a hard `deleteMany` with a reversal-entry pattern directly in the Prisma transaction. L2+L4 refactor `RunService.secondApproveRun` to use `prisma.$transaction` with `grossPay` and removes the now-unused `LedgerService` injection.

**Tech Stack:** TypeScript, Express, Prisma (PostgreSQL), Jest + ts-jest

---

## File Map

| File | Change |
|------|--------|
| `apps/api/src/ledger/ledger.service.ts` | Extract `assertPeriodNotLocked()` helper; call from `create` and `createAutoEntry` |
| `apps/api/src/ledger/ledger.service.test.ts` | Add: `createAutoEntry` throws `PERIOD_LOCKED` |
| `apps/api/src/sales/sales.service.ts` | Replace `tx.ledgerEntry.deleteMany` with reversal-entry pattern |
| `apps/api/src/sales/sales.service.test.ts` | Add: reversal tests; update existing delete mocks |
| `apps/api/src/payroll/run/run.service.ts` | Remove `ledgerService` dep; add `prisma` dep; wrap approve+ledger in `$transaction`; use `grossPay` |
| `apps/api/src/payroll/run/run.service.test.ts` | Update constructor args; replace mock pattern |
| `apps/api/src/payroll/payroll.routes.ts` | Remove `ledgerService` arg; add `prisma` arg to `RunService` |

---

### Task 1: L3 — Period lock in `createAutoEntry`

**Files:**
- Modify: `apps/api/src/ledger/ledger.service.ts`
- Test: `apps/api/src/ledger/ledger.service.test.ts`

- [x] **Step 1: Write the failing test**

In `apps/api/src/ledger/ledger.service.test.ts`, add a new `describe` block after line 180 (after the `"createAutoEntry validation"` block closes):

```typescript
describe("LedgerService createAutoEntry - period lock", () => {
  it("throws 409 PERIOD_LOCKED when period is locked", async () => {
    const repo = makeRepo({ isPeriodLocked: jest.fn().mockResolvedValue(true) });
    const service = new LedgerService(repo);
    await expect(
      service.createAutoEntry({ type: "EXPENSE", category: "SALARY", amount: 1000 } as any, 1)
    ).rejects.toThrow(new AppError(409, "PERIOD_LOCKED"));
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd /Users/juno/work/football/apps/api && npx jest src/ledger/ledger.service.test.ts --no-coverage
```

Expected: FAIL — `createAutoEntry` does not check period lock yet.

- [x] **Step 3: Implement `assertPeriodNotLocked` and wire it up**

Replace `apps/api/src/ledger/ledger.service.ts` with:

```typescript
import { AppError } from "../lib/appError";
import { formatLedgerDescription } from "../lib/ledger-formatter";
import type { LedgerRepository } from "./ledger.repo";
import type { CreateLedgerEntryDto, LedgerListQuery } from "./dto/ledger.dto";

export const ALLOWED_MODULES = ["SalesRecord", "facility", "sponsorship", "equipment", "payroll", "AcademyFee"] as const;
const MAX_EXCHANGE_RATE = 10_000;

export class LedgerService {
  constructor(private repo: LedgerRepository) {}

  findAll(query: LedgerListQuery) { return this.repo.findAll(query); }
  findById(id: number) { return this.repo.findById(id); }

  private validateExchangeRate(provided: number | undefined): void {
    if (provided !== undefined && (provided <= 0 || provided > MAX_EXCHANGE_RATE)) {
      throw new AppError(400, "INVALID_EXCHANGE_RATE");
    }
  }

  private async assertPeriodNotLocked(): Promise<void> {
    const now = new Date();
    const locked = await this.repo.isPeriodLocked(now.getFullYear(), now.getMonth() + 1);
    if (locked) throw new AppError(409, "PERIOD_LOCKED");
  }

  async create(dto: CreateLedgerEntryDto, createdById: number) {
    if (dto.amount <= 0) throw new AppError(400, "INVALID_AMOUNT");
    this.validateExchangeRate(dto.exchangeRate);

    if (dto.relatedModule !== undefined && !ALLOWED_MODULES.includes(dto.relatedModule as any)) {
      throw new AppError(400, "INVALID_RELATED_MODULE");
    }
    if (dto.relatedId !== undefined && (!Number.isInteger(dto.relatedId) || dto.relatedId <= 0)) {
      throw new AppError(400, "INVALID_RELATED_ID");
    }

    await this.assertPeriodNotLocked();

    const rate = dto.exchangeRate ?? 1;
    const amountKrw = dto.amountKrw ?? dto.amount * rate;
    return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
  }

  async createRefund(originalId: number, createdById: number) {
    const original = await this.repo.findById(originalId);
    if (!original) throw new AppError(404, "LEDGER_ENTRY_NOT_FOUND");
    if (original.reversedById != null) throw new AppError(400, "ALREADY_REVERSED");

    await this.assertPeriodNotLocked();

    // JO4: link refund entry back to original via reversalOfId
    const refund = await this.repo.create({
      type: original.type as any,
      category: "REFUND",
      amount: -Number(original.amount),
      currency: original.currency as any,
      exchangeRate: Number(original.exchangeRate),
      amountKrw: -Number(original.amountKrw),
      isRefund: true,
      description: formatLedgerDescription("ledger", "refund", { entryId: original.id }),
      ...(original.relatedModule != null && { relatedModule: original.relatedModule }),
      ...(original.relatedId != null && { relatedId: original.relatedId }),
      reversalOfId: original.id,
      createdById,
    } as any);
    // JO4: mark original as reversed (reversedById already in schema)
    await this.repo.markReversed(originalId, refund.id);

    // BS2: mark the source SalesRecord as refunded
    if (original.relatedModule === "SalesRecord" && original.relatedId) {
      await this.repo.markSalesRecordRefunded(original.relatedId);
    }

    return refund;
  }

  async lockPeriod(year: number, month: number, actorId: number) {
    const already = await this.repo.isPeriodLocked(year, month);
    if (already) throw new AppError(409, "PERIOD_ALREADY_LOCKED");
    try {
      return await this.repo.lockPeriod(year, month, actorId);
    } catch (e: any) {
      if (e?.code === "P2002") throw new AppError(409, "PERIOD_ALREADY_LOCKED");
      throw e;
    }
  }

  // Auto-entry helper for internal trusted modules (payroll, contracts, etc.)
  async createAutoEntry(dto: CreateLedgerEntryDto, createdById: number) {
    this.validateExchangeRate(dto.exchangeRate);
    await this.assertPeriodNotLocked();
    const rate = dto.exchangeRate ?? 1;
    const amountKrw = dto.amountKrw ?? dto.amount * rate;
    return this.repo.create({ ...dto, exchangeRate: rate, amountKrw, createdById });
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /Users/juno/work/football/apps/api && npx jest src/ledger/ledger.service.test.ts --no-coverage
```

Expected: All PASS. The new "throws 409 PERIOD_LOCKED" test should now pass. The existing `"createAutoEntry validation"` test at line 165 still passes because `makeRepo()` defaults `isPeriodLocked` to `false`.

- [x] **Step 5: Commit**

```bash
cd /Users/juno/work/football/apps/api && git add src/ledger/ledger.service.ts src/ledger/ledger.service.test.ts && git commit -m "fix(ledger): enforce period lock in createAutoEntry via shared helper"
```

---

### Task 2: L1 — Reversal pattern replacing hard delete in `sales.service.ts`

**Files:**
- Modify: `apps/api/src/sales/sales.service.ts`
- Test: `apps/api/src/sales/sales.service.test.ts`

**Context:** The `delete()` method currently runs `tx.ledgerEntry.deleteMany(...)` to erase the ledger entry linked to a cancelled sale. This destroys the audit trail. The fix creates a reversal (negative) ledger entry instead and marks the original as reversed, matching the pattern already used in `LedgerService.createRefund`.

- [x] **Step 1: Write the new reversal tests**

In `apps/api/src/sales/sales.service.test.ts`, add after the `"SalesService.create — LedgerEntry for UNIFORM/OTHER (JO7)"` block (end of file):

```typescript
describe("SalesService.delete — reversal ledger entry (L1)", () => {
  it("creates a reversal entry when a linked ledger entry exists", async () => {
    const existingEntry = {
      id: 5, type: "INCOME", category: "TICKET_SALE",
      amount: 30000, currency: "KRW", exchangeRate: 1, amountKrw: 30000,
      reversedById: null,
    };
    const ledgerCreate = jest.fn().mockResolvedValue({ id: 6 });
    const ledgerUpdate = jest.fn();
    const mockTx = {
      ledgerEntry: {
        findFirst: jest.fn().mockResolvedValue(existingEntry),
        create: ledgerCreate,
        update: ledgerUpdate,
      },
      salesRecord: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, seatZoneId: null, quantity: 1, deletedAt: null }),
        update: jest.fn(),
      },
      seatZone: { update: jest.fn() },
    };
    const prisma = makePrisma({
      $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
    } as any);
    const service = new SalesService(makeRepo(), prisma);
    await service.delete(10, 1);
    expect(ledgerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "REFUND",
          amount: -30000,
          amountKrw: -30000,
          isRefund: true,
          reversalOfId: 5,
        }),
      }),
    );
    expect(ledgerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: { reversedById: 6 },
      }),
    );
  });

  it("skips reversal when no linked ledger entry exists", async () => {
    const ledgerCreate = jest.fn();
    const mockTx = {
      ledgerEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: ledgerCreate,
        update: jest.fn(),
      },
      salesRecord: {
        findUnique: jest.fn().mockResolvedValue({ id: 20, seatZoneId: null, quantity: 1, deletedAt: null }),
        update: jest.fn(),
      },
      seatZone: { update: jest.fn() },
    };
    const prisma = makePrisma({
      $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
    } as any);
    const service = new SalesService(makeRepo(), prisma);
    await service.delete(20, 1);
    expect(ledgerCreate).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run new tests to verify they fail**

```bash
cd /Users/juno/work/football/apps/api && npx jest src/sales/sales.service.test.ts --no-coverage -t "reversal ledger entry"
```

Expected: FAIL — `tx.ledgerEntry.findFirst is not a function` (implementation still uses `deleteMany`).

- [x] **Step 3: Implement the reversal pattern**

In `apps/api/src/sales/sales.service.ts`, replace the `delete` method (lines 306–343). The new method:

```typescript
async delete(id: number, deletedById: number) {
  await this.prisma.$transaction(async (tx) => {
    const existing = await tx.salesRecord.findUnique({
      where: { id },
      select: { seatZoneId: true, quantity: true, deletedAt: true },
    });

    if (!existing) throw new AppError(404, "SALES_RECORD_NOT_FOUND");
    if (existing.deletedAt !== null) throw new AppError(400, "ALREADY_CANCELLED");

    // BS1: reverse the ledger entry linked to this sales record (preserves audit trail)
    const originalEntry = await tx.ledgerEntry.findFirst({
      where: { relatedModule: "SalesRecord", relatedId: id, reversedById: null },
    });
    if (originalEntry) {
      const reversal = await tx.ledgerEntry.create({
        data: {
          type: originalEntry.type,
          category: "REFUND",
          amount: -Number(originalEntry.amount),
          currency: originalEntry.currency,
          exchangeRate: Number(originalEntry.exchangeRate),
          amountKrw: -Number(originalEntry.amountKrw),
          isRefund: true,
          description: formatLedgerDescription("ledger", "refund", { entryId: originalEntry.id }),
          relatedModule: "SalesRecord",
          relatedId: id,
          reversalOfId: originalEntry.id,
          createdById: deletedById,
        },
      });
      await tx.ledgerEntry.update({
        where: { id: originalEntry.id },
        data: { reversedById: reversal.id },
      });
    }

    // JO1: soft-delete instead of hard delete; BS8: mark REFUNDED for duplicate-refund prevention
    await tx.salesRecord.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: deletedById, updatedAt: new Date(), status: "REFUNDED" } as any,
    });

    // BS10: decrement SeatZone.soldCount on cancel
    if (existing?.seatZoneId) {
      await tx.seatZone.update({
        where: { id: existing.seatZoneId },
        data: { soldCount: { decrement: existing.quantity } },
      });
    }
  });

  // JO8: audit trail for deletion
  await writeAuditLog({
    actorId: deletedById,
    action: "SALES_RECORD_DELETED",
    targetId: id,
  });
}
```

- [x] **Step 4: Update existing delete tests to use the new mock shape**

The existing tests that mock `tx.ledgerEntry` used `deleteMany` — replace with `findFirst` returning `null` (no entry to reverse) and add no-op `create` and `update`. Update these four `describe` blocks in `apps/api/src/sales/sales.service.test.ts`:

**"SalesService.delete — SeatZone soldCount (BS10)"** (two tests, lines 174–214): change each `mockTx.ledgerEntry` from:
```typescript
ledgerEntry: { deleteMany: jest.fn() },
```
to:
```typescript
ledgerEntry: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
```

**"SalesService.delete — REFUNDED status (BS8)"** (line 219): same replacement.

**"SalesService.delete — double-cancel protection"** (two tests, lines 244–280): same replacement.

- [x] **Step 5: Run all sales tests to verify they pass**

```bash
cd /Users/juno/work/football/apps/api && npx jest src/sales/sales.service.test.ts --no-coverage
```

Expected: All PASS.

- [x] **Step 6: Commit**

```bash
cd /Users/juno/work/football/apps/api && git add src/sales/sales.service.ts src/sales/sales.service.test.ts && git commit -m "fix(sales): replace hard ledger delete with reversal-entry pattern on cancel"
```

---

### Task 3: L2+L4 — grossPay + atomic transaction in `secondApproveRun`

**Files:**
- Modify: `apps/api/src/payroll/run/run.service.ts`
- Modify: `apps/api/src/payroll/run/run.service.test.ts`
- Modify: `apps/api/src/payroll/payroll.routes.ts`

**Context:**  
- L2: `secondApproveRun` currently records `netPay` in the ledger. It must record `grossPay` (gross payroll disbursement; deductions are employer's accounting, not the ledger line).  
- L4: The ledger entry is currently fire-and-forget (`void ... .catch(...)`), meaning a DB failure silently loses the entry. Fix: wrap `payrollRun.update` + `ledgerEntry.create` in a single `prisma.$transaction` so both commit or both roll back.  
- Since `ledgerService` was only used in `secondApproveRun` and is now replaced by a direct Prisma transaction, remove it from the constructor (YAGNI).

- [x] **Step 1: Write the failing tests**

Replace the entire content of `apps/api/src/payroll/run/run.service.test.ts` with:

```typescript
import { RunService } from "./run.service";
import { AppError } from "../../lib/appError";
import type { RunRepository } from "./run.repo";
import type { PrismaClient } from "../../generated/client";

const makeRepo = (overrides: Partial<RunRepository> = {}): RunRepository => ({
  findById: jest.fn().mockResolvedValue(null),
  secondApprove: jest.fn().mockResolvedValue({ id: 1, isLocked: true }),
  ...overrides,
} as unknown as RunRepository);

const makePrisma = (overrides: Partial<PrismaClient> = {}): PrismaClient =>
  overrides as unknown as PrismaClient;

describe("RunService.secondApproveRun", () => {
  it("throws 404 when run is not found", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new RunService(repo, undefined as any, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(404, "PAYROLL_RUN_NOT_FOUND"));
  });

  it("throws 400 when run is already locked", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, staffSalaryId: 10, status: "CONFIRMED", isLocked: true }),
    });
    const service = new RunService(repo, undefined as any, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(400, "PAYROLL_RUN_ALREADY_LOCKED"));
  });

  it("throws 400 when status is not CONFIRMED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, staffSalaryId: 10, status: "DRAFT", isLocked: false }),
    });
    const service = new RunService(repo, undefined as any, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(400, "PAYROLL_RUN_NOT_CONFIRMED"));
  });

  it("throws 403 when approver is the same as confirmer", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({
        id: 1, staffSalaryId: 10, status: "CONFIRMED", isLocked: false, confirmedById: 99,
      }),
    });
    const service = new RunService(repo, undefined as any, undefined as any, undefined as any);
    await expect(service.secondApproveRun(10, 1, 99))
      .rejects.toThrow(new AppError(403, "CANNOT_SECOND_APPROVE_OWN_CONFIRMATION"));
  });

  it("atomically locks the run and creates a SALARY ledger entry with grossPay", async () => {
    const payrollUpdate = jest.fn().mockResolvedValue({
      id: 1, isLocked: true, secondApprovedById: 99, grossPay: 5_000_000,
    });
    const ledgerCreate = jest.fn().mockResolvedValue({ id: 10 });
    const mockTx = {
      payrollRun: { update: payrollUpdate },
      ledgerEntry: { create: ledgerCreate },
    };
    const prisma = makePrisma({
      $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
    } as any);
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue({
        id: 1, staffSalaryId: 10, status: "CONFIRMED", isLocked: false,
        confirmedById: 5, grossPay: 5_000_000,
      }),
    });
    const service = new RunService(repo, undefined as any, undefined as any, prisma);
    const result = await service.secondApproveRun(10, 1, 99);

    expect(payrollUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({ isLocked: true, secondApprovedById: 99 }),
    }));
    expect(ledgerCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: "SALARY",
        amount: 5_000_000,
        amountKrw: 5_000_000,
        type: "EXPENSE",
      }),
    }));
    expect(result.isLocked).toBe(true);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /Users/juno/work/football/apps/api && npx jest src/payroll/run/run.service.test.ts --no-coverage
```

Expected: FAIL — constructor signature mismatch and `prisma.$transaction` not called.

- [x] **Step 3: Implement the refactored `RunService`**

Replace `apps/api/src/payroll/run/run.service.ts` with:

```typescript
import { AppError } from "../../lib/appError";
import { formatLedgerDescription } from "../../lib/ledger-formatter";
import type { RunRepository } from "./run.repo";
import type { SalaryRepository } from "../salary/salary.repo";
import type { ConfigRepository } from "../config/config.repo";
import type { CreateRunDto } from "./dto/run.dto";
import type { PrismaClient } from "../../generated/client";

export function computePayroll(
  baseSalary: number,
  allowancesTotal: number,
  configs: { employeeRate: number }[],
): { grossPay: number; totalDeductions: number; netPay: number } {
  const grossPay = parseFloat((baseSalary + allowancesTotal).toFixed(2));
  const totalDeductions = parseFloat(
    configs.reduce((sum, c) => sum + grossPay * c.employeeRate, 0).toFixed(2),
  );
  const rawNetPay = parseFloat((grossPay - totalDeductions).toFixed(2));
  if (rawNetPay < 0) {
    throw new AppError(400, "NEGATIVE_NET_PAY");
  }
  const netPay = rawNetPay;
  return { grossPay, totalDeductions, netPay };
}

export class RunService {
  constructor(
    private runRepo: RunRepository,
    private salaryRepo: SalaryRepository,
    private configRepo: ConfigRepository,
    private prisma: PrismaClient,
  ) {}

  async list(salaryId: number) {
    const salary = await this.salaryRepo.findById(salaryId);
    if (!salary) throw new AppError(404, "SALARY_NOT_FOUND");
    return this.runRepo.findAll(salaryId);
  }

  async createRun(salaryId: number, dto: CreateRunDto) {
    const salary = await this.salaryRepo.findById(salaryId);
    if (!salary) throw new AppError(404, "SALARY_NOT_FOUND");

    const raw = new Date(dto.month);
    const month = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), 1));

    const existing = await this.runRepo.findByMonth(salaryId, month);
    if (existing) throw new AppError(409, "PAYROLL_RUN_ALREADY_EXISTS");

    const activeConfigs = await this.configRepo.findActiveForCountry(salary.country, month);
    if (activeConfigs.length === 0) throw new AppError(422, "NO_PAYROLL_CONFIG_FOR_COUNTRY");

    const allowancesTotal = salary.allowances.reduce(
      (sum, a) => sum + a.amount.toNumber(),
      0,
    );

    const { grossPay, totalDeductions, netPay } = computePayroll(
      salary.baseSalary.toNumber(),
      allowancesTotal,
      activeConfigs.map((c) => ({ employeeRate: c.employeeRate.toNumber() })),
    );

    return this.runRepo.create({ staffSalaryId: salaryId, month, grossPay, totalDeductions, netPay });
  }

  async secondApproveRun(salaryId: number, runId: number, userId: number) {
    const run = await this.runRepo.findById(runId);
    if (!run || run.staffSalaryId !== salaryId) {
      throw new AppError(404, "PAYROLL_RUN_NOT_FOUND");
    }
    if (run.isLocked) {
      throw new AppError(400, "PAYROLL_RUN_ALREADY_LOCKED");
    }
    if (run.status !== "CONFIRMED") {
      throw new AppError(400, "PAYROLL_RUN_NOT_CONFIRMED");
    }
    if (run.confirmedById === userId) {
      throw new AppError(403, "CANNOT_SECOND_APPROVE_OWN_CONFIRMATION");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payrollRun.update({
        where: { id: runId },
        data: { secondApprovedById: userId, secondApprovedAt: new Date(), isLocked: true },
      });
      await tx.ledgerEntry.create({
        data: {
          type: "EXPENSE",
          category: "SALARY",
          amount: Number(updated.grossPay),
          currency: "KRW",
          exchangeRate: 1,
          amountKrw: Number(updated.grossPay),
          isRefund: false,
          description: formatLedgerDescription("payroll", "salary_disbursed", { salaryId, runId }),
          relatedModule: "payroll",
          relatedId: runId,
          createdById: userId,
        },
      });
      return updated;
    });
  }

  async confirmRun(salaryId: number, runId: number, userId: number) {
    const salary = await this.salaryRepo.findById(salaryId);
    if (!salary) throw new AppError(404, "SALARY_NOT_FOUND");

    const run = await this.runRepo.findById(runId);
    if (!run || run.staffSalaryId !== salaryId) throw new AppError(404, "PAYROLL_RUN_NOT_FOUND");
    if (run.status === "CONFIRMED") throw new AppError(409, "ALREADY_CONFIRMED");

    return this.runRepo.update(runId, {
      status: "CONFIRMED",
      confirmedById: userId,
      confirmedAt: new Date(),
    });
  }
}
```

- [x] **Step 4: Update `payroll.routes.ts` constructor call**

In `apps/api/src/payroll/payroll.routes.ts`, line 31, change:

```typescript
const runService = new RunService(runRepo, salaryRepo, configRepo, ledgerService);
```

to:

```typescript
const runService = new RunService(runRepo, salaryRepo, configRepo, prisma);
```

Also remove the now-unused import at line 17:
```typescript
import { ledgerService } from "../ledger/ledger.routes";
```

- [x] **Step 5: Run all payroll tests to verify they pass**

```bash
cd /Users/juno/work/football/apps/api && npx jest src/payroll/ --no-coverage
```

Expected: All PASS.

- [x] **Step 6: Run full test suite to confirm no regressions**

```bash
cd /Users/juno/work/football/apps/api && npx jest --no-coverage
```

Expected: All PASS.

- [x] **Step 7: Commit**

```bash
cd /Users/juno/work/football/apps/api && git add src/payroll/run/run.service.ts src/payroll/run/run.service.test.ts src/payroll/payroll.routes.ts && git commit -m "fix(payroll): record grossPay in ledger and wrap secondApprove in atomic transaction"
```

---

## Self-Review

**Spec coverage:**
- L1 (hard delete): Task 2 replaces `deleteMany` with `findFirst` + `create` reversal + `update` to mark reversed ✅
- L2 (netPay→grossPay): Task 3 uses `updated.grossPay` for both `amount` and `amountKrw` ✅
- L3 (period lock bypass): Task 1 extracts `assertPeriodNotLocked` and calls it from `createAutoEntry` ✅
- L4 (fire-and-forget): Task 3 wraps both `payrollRun.update` + `ledgerEntry.create` in `prisma.$transaction` ✅

**Placeholder scan:** All steps contain actual code. No TBD/TODO/placeholder patterns.

**Type consistency:**
- `RunService` constructor: 4 args (`runRepo, salaryRepo, configRepo, prisma`) in service, tests, and routes ✅
- `formatLedgerDescription("ledger", "refund", { entryId })` in Task 2 matches existing `LedgerService.createRefund` pattern ✅
- `makePrisma` helper in test file matches `PrismaClient` type from `../../generated/client` ✅
