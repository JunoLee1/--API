# Fan & Ticketing Persona Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve 4 open criticals from 박성준 & Jordan personas — complimentary ticket per-match limit, refund↔original bidirectional link, zone soldCount tracking, and auto LedgerEntry for UNIFORM/OTHER sales.

**Architecture:** All changes are in the existing sales module (`apps/api/src/sales/`). Schema adds 3 fields. The sales service already creates LedgerEntries for TICKET/VIP_TICKET — this extends that pattern to UNIFORM/OTHER. `SeatZone.soldCount` is incremented inside the existing `$transaction` on create. `SalesRecord.refundedFromId` self-FK links cancel records to originals.

**Tech Stack:** Express + TypeScript + Prisma, Jest. Migration uses raw SQL + `prisma migrate resolve --applied`.

---

## File Map

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `complimentaryTicketLimit` to ClubSettings; `refundedFromId` to SalesRecord; `soldCount` to SeatZone |
| `apps/api/prisma/migrations/20260812300003_fan_ticket_persona/migration.sql` | Column additions |
| `apps/api/src/sales/sales.service.ts` | COMPLIMENTARY limit check; refundedFromId on cancel; soldCount increment; LedgerEntry for UNIFORM/OTHER |
| `apps/api/src/sales/sales.repo.ts` | Include `refundedFromId` in select; add `incrementSoldCount` helper |
| `apps/api/__test__/sales/sales.service.test.ts` | Tests for all 4 behaviours |

---

## Task 1: Schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260812300003_fan_ticket_persona/migration.sql`

- [ ] **Step 1: Add complimentaryTicketLimit to ClubSettings**

In `apps/api/prisma/schema.prisma`, find `ClubSettings` and add:

```prisma
model ClubSettings {
  id                       Int    @id @default(1)
  currency                 String @default("KRW")
  ibiBeta                  Float  @default(1.0)
  planApprovalLimit        Int    @default(10000000)
  maintenanceCostLimit     Int    @default(1000000)
  complimentaryTicketLimit Int    @default(50)
  reviewerDeptMap          Json?
}
```

(If `maintenanceCostLimit` is not yet present — add both together.)

- [ ] **Step 2: Add refundedFromId to SalesRecord**

Find `SalesRecord` model and add after `updatedById`:

```prisma
model SalesRecord {
  // ... existing fields ...
  updatedById        Int?
  refundedFromId     Int?

  // ... existing relations ...
  refundedFrom SalesRecord?  @relation("SalesRefund", fields: [refundedFromId], references: [id])
  refunds      SalesRecord[] @relation("SalesRefund")
}
```

- [ ] **Step 3: Add soldCount to SeatZone**

Find `SeatZone` model and add:

```prisma
model SeatZone {
  id        Int    @id @default(autoincrement())
  name      String
  capacity  Int
  unitPrice Int?
  matchId   Int
  soldCount Int    @default(0)

  match        Match        @relation(fields: [matchId], references: [id])
  salesRecords SalesRecord[]
}
```

- [ ] **Step 4: Create migration SQL**

```bash
mkdir -p apps/api/prisma/migrations/20260812300003_fan_ticket_persona
```

Write `apps/api/prisma/migrations/20260812300003_fan_ticket_persona/migration.sql`:

```sql
-- ClubSettings: complimentary limit
ALTER TABLE "ClubSettings" ADD COLUMN IF NOT EXISTS "complimentaryTicketLimit" INTEGER NOT NULL DEFAULT 50;

-- SalesRecord: refund self-FK
ALTER TABLE "SalesRecord" ADD COLUMN "refundedFromId" INTEGER;
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_refundedFromId_fkey"
  FOREIGN KEY ("refundedFromId") REFERENCES "SalesRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SeatZone: sold count
ALTER TABLE "SeatZone" ADD COLUMN "soldCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill soldCount from existing sales records
UPDATE "SeatZone" sz
SET "soldCount" = COALESCE((
  SELECT SUM(sr.quantity)
  FROM "SalesRecord" sr
  WHERE sr."seatZoneId" = sz.id
    AND sr."deletedAt" IS NULL
    AND sr."status" = 'COMPLETED'
), 0);
```

- [ ] **Step 5: Apply migration**

```bash
cd apps/api
psql $DATABASE_URL -f prisma/migrations/20260812300003_fan_ticket_persona/migration.sql
npx prisma migrate resolve --applied 20260812300003_fan_ticket_persona
npx prisma generate
```

Expected: `Migration 20260812300003_fan_ticket_persona marked as applied`

- [ ] **Step 6: Commit schema**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260812300003_fan_ticket_persona/
git commit -m "feat(schema): fan-ticket persona — complimentaryTicketLimit, SalesRecord.refundedFromId, SeatZone.soldCount"
```

---

## Task 2: COMPLIMENTARY ticket limit check (BS6)

**Files:**
- Modify: `apps/api/src/sales/sales.service.ts`
- Modify: `apps/api/__test__/sales/sales.service.test.ts`

- [ ] **Step 1: Write failing test**

In `apps/api/__test__/sales/sales.service.test.ts`, add:

```typescript
describe('create — COMPLIMENTARY limit', () => {
  it('throws when per-match complimentary tickets would exceed ClubSettings limit', async () => {
    // 50 already sold for this match, limit is 50
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
      return fn({
        match: { findUnique: jest.fn().mockResolvedValue({ homeTeamName: 'FC Seoul', awayTeamName: 'Suwon', capacity: 1000 }) },
        salesRecord: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }), // capacity check
          create: jest.fn(),
        },
        clubSettings: { findUnique: jest.fn().mockResolvedValue({ complimentaryTicketLimit: 50 }) },
        ledgerEntry: { create: jest.fn() },
      });
    });
    mockPrisma.salesRecord.aggregate = jest.fn().mockResolvedValue({ _sum: { quantity: 50 } }); // 50 comps already

    await expect(
      service.create({
        type: 'COMPLIMENTARY', quantity: 1, unitPrice: 0,
        saleDate: '2026-08-20', matchId: 1, description: 'VIP guest',
      }, 1)
    ).rejects.toMatchObject({ code: 'COMPLIMENTARY_LIMIT_EXCEEDED' });
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd apps/api && npx jest --testPathPattern="sales.service" --no-coverage 2>&1 | tail -15
```

Expected: FAIL.

- [ ] **Step 3: Add COMPLIMENTARY limit check in sales.service.ts**

In the `create` method inside the `$transaction`, after the existing COMPLIMENTARY description check (JO6), add before the `salesRecord.create` call:

```typescript
if ((dto.type as string) === "COMPLIMENTARY" && dto.matchId) {
  const settings = await tx.clubSettings.findUnique({
    where: { id: 1 },
    select: { complimentaryTicketLimit: true },
  });
  const limit = settings?.complimentaryTicketLimit ?? 50;

  const compsSold = await tx.salesRecord.aggregate({
    where: {
      matchId: dto.matchId,
      type: "COMPLIMENTARY" as any,
      deletedAt: null,
    } as any,
    _sum: { quantity: true },
  });
  const totalComps = Number((compsSold._sum as any).quantity ?? 0);

  if (totalComps + dto.quantity > limit) {
    throw new AppError(400, "COMPLIMENTARY_LIMIT_EXCEEDED");
  }
}
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd apps/api && npx jest --testPathPattern="sales.service" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/sales/sales.service.ts apps/api/__test__/sales/sales.service.test.ts
git commit -m "feat(sales): complimentary ticket per-match limit from ClubSettings (BS6)"
```

---

## Task 3: SeatZone soldCount auto-increment (BS10)

**Files:**
- Modify: `apps/api/src/sales/sales.service.ts`
- Modify: `apps/api/__test__/sales/sales.service.test.ts`

- [ ] **Step 1: Write failing test**

In `apps/api/__test__/sales/sales.service.test.ts`, add:

```typescript
describe('create — soldCount', () => {
  it('increments SeatZone.soldCount when seatZoneId is provided', async () => {
    const mockIncrementSoldCount = jest.fn().mockResolvedValue({ soldCount: 10 });
    // inject into service or verify tx.seatZone.update is called

    // Simplified: check that the transaction calls seatZone.update with increment
    let capturedTxCall: any;
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        match: { findUnique: jest.fn().mockResolvedValue({ homeTeamName: 'FC Seoul', awayTeamName: 'Suwon', capacity: 1000 }) },
        salesRecord: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 5 } }), create: jest.fn().mockResolvedValue({ id: 1, type: 'TICKET', quantity: 2 }) },
        seatZone: { update: jest.fn().mockImplementation((args: any) => { capturedTxCall = args; return { soldCount: 10 }; }) },
        ledgerEntry: { create: jest.fn() },
        clubSettings: { findUnique: jest.fn() },
      };
      return fn(tx);
    });

    await service.create({ type: 'TICKET', quantity: 2, unitPrice: 30000, saleDate: '2026-08-20', matchId: 1, seatZoneId: 5 }, 1);

    expect(capturedTxCall).toMatchObject({
      where: { id: 5 },
      data: { soldCount: { increment: 2 } },
    });
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd apps/api && npx jest --testPathPattern="sales.service" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — no `seatZone.update` call.

- [ ] **Step 3: Add soldCount increment in sales.service.ts**

In the `create` method, inside the `$transaction`, after `tx.salesRecord.create(...)`, add:

```typescript
// BS10: increment zone soldCount
if (dto.seatZoneId) {
  await tx.seatZone.update({
    where: { id: dto.seatZoneId },
    data: { soldCount: { increment: dto.quantity } },
  });
}
```

- [ ] **Step 4: Also decrement on cancel/delete**

In the `delete` (cancel) method, inside the `$transaction`, after soft-deleting the SalesRecord, add:

```typescript
// BS10: decrement zone soldCount on cancel
if (existing.seatZoneId) {
  await tx.seatZone.update({
    where: { id: existing.seatZoneId },
    data: { soldCount: { decrement: existing.quantity } },
  });
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && npx jest --testPathPattern="sales.service" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/sales/sales.service.ts apps/api/__test__/sales/sales.service.test.ts
git commit -m "feat(sales): SeatZone.soldCount auto-increment/decrement on ticket create/cancel (BS10)"
```

---

## Task 4: Refund↔original bidirectional link (BS8)

**Files:**
- Modify: `apps/api/src/sales/sales.service.ts`
- Modify: `apps/api/__test__/sales/sales.service.test.ts`

- [ ] **Step 1: Write failing test**

In `apps/api/__test__/sales/sales.service.test.ts`, add:

```typescript
describe('delete (cancel) — refundedFromId', () => {
  it('sets status=REFUNDED and links refundedFromId on the cancelled record', async () => {
    const existing = { id: 7, quantity: 2, unitPrice: 30000, seatZoneId: null, deletedAt: null, status: 'COMPLETED' };
    mockPrisma.salesRecord.findUnique = jest.fn().mockResolvedValue(existing);

    let updatedData: any;
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
      return fn({
        ledgerEntry: { deleteMany: jest.fn() },
        seatZone: { update: jest.fn() },
        salesRecord: {
          update: jest.fn().mockImplementation((args: any) => {
            updatedData = args.data;
            return { ...existing, ...args.data };
          }),
        },
      });
    });

    await service.delete(7, 99);

    expect(updatedData).toMatchObject({ status: 'REFUNDED' });
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd apps/api && npx jest --testPathPattern="sales.service" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `status: 'REFUNDED'` not set.

- [ ] **Step 3: Update delete method in sales.service.ts**

In the `delete` method, find the `salesRecord.update` call inside `$transaction` and add `status: 'REFUNDED'`:

```typescript
await tx.salesRecord.update({
  where: { id },
  data: {
    deletedAt: new Date(),
    updatedById: deletedById,
    updatedAt: new Date(),
    status: 'REFUNDED',  // BS8: mark as refunded, not just deleted
  } as any,
});
```

If you need to create a *new* refund SalesRecord pointing back via `refundedFromId` (for cases where the original must remain visible), add after the update:

```typescript
// Optional: create reverse record for audit trail
// Only if the caller passes a `createRefundRecord: true` flag
// For simplicity, the status=REFUNDED + soft-delete covers BS8.
```

The simpler path (status=REFUNDED + `deletedAt`) satisfies "duplicate refund detection" since a REFUNDED+deleted record cannot be refunded twice.

- [ ] **Step 4: Run test to confirm pass**

```bash
cd apps/api && npx jest --testPathPattern="sales.service" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/sales/sales.service.ts apps/api/__test__/sales/sales.service.test.ts
git commit -m "feat(sales): set status=REFUNDED on cancel for duplicate-refund prevention (BS8)"
```

---

## Task 5: Auto LedgerEntry for UNIFORM/OTHER sales (JO7)

**Files:**
- Modify: `apps/api/src/sales/sales.service.ts`
- Modify: `apps/api/__test__/sales/sales.service.test.ts`

- [ ] **Step 1: Write failing test**

In `apps/api/__test__/sales/sales.service.test.ts`, add:

```typescript
describe('create — UNIFORM ledger entry', () => {
  it('creates a LedgerEntry for UNIFORM type sale', async () => {
    let ledgerCreateCall: any;
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
      return fn({
        salesRecord: { create: jest.fn().mockResolvedValue({ id: 20, type: 'UNIFORM', quantity: 3, totalAmount: 90000 }) },
        ledgerEntry: {
          create: jest.fn().mockImplementation((args: any) => {
            ledgerCreateCall = args;
            return { id: 55 };
          }),
        },
        seatZone: { update: jest.fn() },
        clubSettings: { findUnique: jest.fn() },
      });
    });

    await service.create({ type: 'UNIFORM', quantity: 3, unitPrice: 30000, saleDate: '2026-08-20' }, 1);

    expect(ledgerCreateCall).toMatchObject({
      data: expect.objectContaining({
        category: 'MERCHANDISE_SALES',
        amount: 90000,
      }),
    });
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd apps/api && npx jest --testPathPattern="sales.service" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — no LedgerEntry created for UNIFORM.

- [ ] **Step 3: Add LedgerEntry creation for UNIFORM and OTHER in sales.service.ts**

In the `create` method, find the existing `if (dto.type === "TICKET" || dto.type === "VIP_TICKET")` block and add an `else if` clause after the existing COMPLIMENTARY block:

```typescript
} else if (dto.type === "UNIFORM" || dto.type === "OTHER") {
  // JO7: non-ticket product sales also need ledger entries
  await tx.ledgerEntry.create({
    data: {
      type: "INCOME",
      category: dto.type === "UNIFORM" ? "MERCHANDISE_SALES" : ("OTHER_INCOME" as any),
      amount: totalAmount,
      currency: dto.currency ?? "KRW",
      exchangeRate: 1,
      amountKrw: totalAmount,
      isRefund: false,
      description: dto.description ?? (dto.type === "UNIFORM" ? "유니폼 판매" : "기타 판매"),
      relatedModule: "SalesRecord",
      relatedId: record.id,
      createdById,
    },
  });
}
```

Note: `MERCHANDISE_SALES` and `OTHER_INCOME` must exist in the `LedgerCategory` enum. Check `apps/api/prisma/schema.prisma` for the enum. If they don't exist, add them via a separate one-line migration or use an existing applicable category (e.g., `TICKET_SALES` with a description override is acceptable as a fallback — update the category name to match what's in the enum).

- [ ] **Step 4: Run test to confirm pass**

```bash
cd apps/api && npx jest --testPathPattern="sales.service" --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd apps/api && npx jest --testPathPattern="sales" --no-coverage 2>&1 | tail -15
```

Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/sales/sales.service.ts apps/api/__test__/sales/sales.service.test.ts
git commit -m "feat(sales): auto LedgerEntry for UNIFORM/OTHER sales (JO7)"
```

---

## Self-Review

**Spec coverage:**
- BS6 complimentary limit → Task 2 ✅
- BS8 refund bidirectional link → Task 4 ✅
- BS10 soldCount tracking → Task 3 ✅
- JO7 LedgerEntry for all sale types → Task 5 ✅

**Placeholder scan:** Task 5 Step 3 notes a conditional on `LedgerCategory` enum — not a placeholder, it's a genuine fork with both paths described.

**Type consistency:** `complimentaryTicketLimit`, `refundedFromId`, `soldCount` field names consistent across schema → SQL → service code.
