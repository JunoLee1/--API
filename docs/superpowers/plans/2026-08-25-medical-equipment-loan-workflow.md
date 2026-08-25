# 의무팀 기기 대여 워크플로우 (Medical Equipment Loan Workflow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 의무팀 전용 기기 대여 워크플로우 구현. 일반 대여(팀장 사전 승인)와 응급 대여(즉시 지급 → 팀장 사후 승인 D+1 09:00 SLA) 두 경로 지원. 파트너(Sponsorship/PartnerContract) 기반 자동 할인 계산 + 운영비 예산 라인 체크 통합.

**Why:**
- 기존 `EquipmentLoan`은 의무팀 역할 구분 없음 → 의무사 / 의무팀장 권한 분리 필요.
- 응급 상황(선수 부상·경기 중 긴급 처치) 대여 경로가 없어 현장 운영이 임의 처리로 흘러감 → 감사 불가.
- 병원(HOSPITAL) 파트너 스폰서십 할인이 대여 비용에 반영되지 않음 → 예산 과다 계상.
- OperatingExpense 기록 없이 대여 발생 → 의무비 지출 추적 불가.

**Architecture:**
- `MedicalEquipmentLoanLedger` 신규 모델 — `EquipmentLoan` 과 1:1 연결. 응급/파트너/할인/예산 컬럼 포함.
- `MedicalEquipmentLoanStatus` 신규 enum — 기존 `EquipmentLoanStatus` 확장 대신 별도 enum (별도 도메인, 별도 상태 머신).
- `resolvePartnerDiscount(equipmentItemId)` 헬퍼 — `EquipmentItem.partnerId` → Sponsorship(우선) / PartnerContract.discountRate 체인.
- `checkAndReserveBudget(budgetLineId, amount, tx)` 헬퍼 — BudgetLine remaining 검증 + OperatingExpense PENDING 생성.
- `medicalEmergencyOverdueEscalation.ts` cron — EMERGENCY_PENDING_POST_APPROVAL D+1 09:00 초과 시 escalation.
- 신규 모듈 `apps/api/src/medical-equipment-loan/` — repo, service, controller, routes 분리.

**Tech Stack:** Prisma + PostgreSQL, Hono/Express, Jest (unit test), React + TypeScript.

**Related Plans / Specs:**
- `docs/superpowers/plans/2026-07-14-partner-equipment-loan.md` — 기존 EquipmentLoan 워크플로우 기반 (이 plan 이 의무팀 특화 레이어 추가)
- `docs/superpowers/plans/2026-08-25-asset-registration-loan-guards.md` — BudgetCheck + $transaction 패턴 참조
- `docs/superpowers/plans/2026-08-22-operating-expense-approval.md` — BudgetLine remaining check 패턴 재사용
- `docs/superpowers/plans/2026-08-24-medical-partnership.md` — 병원 파트너십 확장 (pending; 이 plan 과 prerequisite 아님 — 기존 Partner + Sponsorship 모델 사용)

**Related ADRs:**
- (create) `docs/adr/0018-medical-equipment-loan-workflow.md` — emergency fast-rent + partner-discount + budget-line policy

**Constraints:**
- `EquipmentItem.partnerId Int?` 이미 존재 (line 1639) — 별도 schema 확장 불필요. Task 0 생략.
- `Sponsorship.attachedContractId Int?` 는 optional — Sponsorship 은 PartnerContract 없이도 존재 가능. 쿼리 분리.
- 예산 라인 `budgetLineId` 는 프론트엔드 dropdown 선택값 — 서버에서 `departmentId` + `year` 재검증.
- 응급 경로: 예산 체크만 skip. 파트너/할인 조회·계산·기록은 유지.
- 자기 자신 승인 불가 (요청자 == 승인자 → 403), admin 제외.
- Enum `ADD VALUE` 는 PostgreSQL transaction 밖에서 실행 (migration handcraft 필요).
- 기존 `EquipmentLoanStatus` enum 변경 없음 — 기존 대여 워크플로우 영향 없음.

---

## Grill 결정 (2026-08-25)

**재논의 금지.**

| # | 질문 | 결정 |
|---|------|------|
| Q1 | '응급 상황' 판정 주체 | 요청자 self-flag + `emergencyReason` 필수. 팀장 사후 검증. |
| Q2 | Fast-rent 사후 승인 SLA | 다음 근무일(D+1) 09:00 까지. 미승인 시 부서장 escalate. |
| Q3 | 사후 승인 반려 시 처리 | 즉시 반납 요구 알림 + 감사 log. 개인 청구 없음. |
| Q4 | 파트너/스폰서 검증 소스 | `PartnerContract` ACTIVE **OR** `Sponsorship` (contractEnd > now) 중 하나만 있어도 통과. 둘 다 없으면 외부 유상 업체 처리 (일반 경로). |
| Q5 | Discount 적용 우선순위 | `Sponsorship` > `PartnerContract`. Sponsorship 있으면 100% (무상), 없으면 `PartnerContract.discountRate` 적용. `overrideReason` 필수로 팀장 수동 override 가능. |
| Q6 | 비용 발생 여부 판단 | 항상 예산 체크 (무상=0원도 `OperatingExpense` 기록). 회계 일관성. |
| Q7 | 예산 line 선정 | 의무팀 `departmentId` 매칭 + 현재 season year + (month=현재 또는 NULL). 여러 개면 사용자가 dropdown 선택. 서버 검증. |
| Q8 | '의무기기 대여 대장' | `MedicalEquipmentLoanLedger` 별도 모델 (EquipmentLoan 과 1:1). 응급/파트너/할인/예산 컬럼 포함. |
| Q9 | 응급 시 검증 스킵 범위 | 예산 체크만 skip. 파트너/할인은 조회·계산·기록. 예산 라인은 사후 승인 시 backfill. |
| Q10 | '응급 Resolved' 상태 시점 | 팀장 사후 승인 완료 = `EMERGENCY_RESOLVED`. 반납은 별도 `RETURNED`. |

---

## 상태 머신 (State Machine)

### 일반 대여 경로

```
DRAFT
  → (팀장 승인) → APPROVED
     → (지급) → ISSUED
        → (반납) → RETURNED
  → (팀장 반려) → REJECTED
```

### 응급 대여 경로 (fast-rent)

```
EMERGENCY_ISSUED   (즉시 지급, budget check skip)
  → EMERGENCY_PENDING_POST_APPROVAL   (기본 상태 — D+1 09:00 SLA)
     → (팀장 사후 승인) → EMERGENCY_RESOLVED
        → (반납) → RETURNED
     → (팀장 사후 반려) → EMERGENCY_REJECTED
        (즉시 반납 요구 알림 + audit log)
```

**설계 선택:** `MedicalEquipmentLoanLedger` 에 `MedicalEquipmentLoanStatus` 별도 enum 을 사용한다. 이유:
- 기존 `EquipmentLoanStatus` (REQUESTED/APPROVED/REJECTED/ISSUED/RETURNED) 는 일반 장비 대여 워크플로우용이며 변경 시 기존 UI/서비스 영향 범위가 큼.
- 의무팀 경로는 응급·할인·예산·사후승인 컬럼을 포함한 독립 도메인 — 별도 모델에 별도 enum 이 가장 명확한 경계 설정.
- 기존 `EquipmentLoan` 은 그대로 유지하고 1:1 FK 로 연결 — 장비 지급/반납 이력은 기존 인프라 재사용.

---

## Task 1: 착수 확인 + 브랜치

- [ ] **Step 1: 핵심 모델 현재 상태 확인**
```bash
grep -B1 -A20 "^model EquipmentLoan\|^model EquipmentItem\|^enum EquipmentLoanStatus\|^enum CoachRole\|^enum NotificationType" apps/api/prisma/schema.prisma
```
확인 사항:
- `EquipmentItem.partnerId Int?` 존재 (line 1639) — 이 plan 에서 추가 불필요.
- `EquipmentLoanStatus` 에 EMERGENCY_* 값 없음 — 이 plan 은 별도 enum 사용하므로 기존 enum 변경 없음.
- `CoachRole` 에 `MEDICAL`, `MEDICAL_DIRECTOR` 존재 — 권한 헬퍼 재사용.
- `NotificationType` 에 `MEDICAL_EQUIPMENT_LOAN_*` 값 없음 — 이 plan 이 추가.

- [ ] **Step 2: 기존 EquipmentLoan 서비스 확인**
```bash
grep -n "requestLoan\|approveLoan\|issueLoan\|returnLoan\|rejectLoan" apps/api/src/equipment/equipment.service.ts | head -20
```
기존 5개 메서드 (requestLoan / approveLoan / rejectLoan / issueLoan / returnLoan) 확인. 이 plan 은 신규 모듈에서 기존 서비스를 조합 호출하는 레이어 패턴 사용.

- [ ] **Step 3: 기존 permissions.ts 확인**
```bash
grep -n "isAdminLike\|canApprove\|CoachRole" apps/api/src/lib/permissions.ts
```
`isAdminLike()` 함수 시그니처 확인 후 `canRequestMedicalEquipmentLoan` / `canApproveMedicalEquipmentLoan` 헬퍼 추가 위치 결정.

- [ ] **Step 4: 브랜치 생성**
```bash
git checkout -b feat/medical-equipment-loan-workflow
```

---

## Task 2: Prisma Schema — `MedicalEquipmentLoanLedger` + `MedicalEquipmentLoanStatus`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `MedicalEquipmentLoanStatus` 신규 enum 추가**

기존 enum 블록 인근 (line ~204 `EquipmentLoanStatus` 아래)에 추가:

```prisma
enum MedicalEquipmentLoanStatus {
  DRAFT
  APPROVED
  REJECTED
  ISSUED
  EMERGENCY_ISSUED
  EMERGENCY_PENDING_POST_APPROVAL
  EMERGENCY_RESOLVED
  EMERGENCY_REJECTED
  RETURNED
}
```

- [ ] **Step 2: `NotificationType` 에 의무기기 대여 알림 값 추가**

기존 enum 마지막 값 뒤에 추가:

```prisma
enum NotificationType {
  // ... 기존 값 유지 ...
  MEDICAL_EQUIPMENT_LOAN_REQUESTED          // 일반 대여 요청 → 의무팀장 알림
  MEDICAL_EQUIPMENT_LOAN_APPROVED           // 일반 대여 승인 → 요청자 알림
  MEDICAL_EQUIPMENT_LOAN_REJECTED           // 일반/응급 반려 → 요청자 알림
  MEDICAL_EQUIPMENT_LOAN_EMERGENCY_ISSUED   // 응급 즉시 지급 → 의무팀장 사후 승인 요청
  MEDICAL_EQUIPMENT_LOAN_ESCALATED          // D+1 09:00 초과 → 부서장 escalation
  MEDICAL_EQUIPMENT_LOAN_EMERGENCY_REJECTED // 응급 반려 → 즉시 반납 요구 알림
  MEDICAL_EQUIPMENT_LOAN_EMERGENCY_RESOLVED // 응급 사후 승인 완료 → 요청자 알림
  MEDICAL_EQUIPMENT_LOAN_RETURN_REQUIRED    // 응급 반려 시 즉시 반납 요구
}
```

- [ ] **Step 3: `MedicalEquipmentLoanLedger` 신규 모델 추가**

`model EquipmentLoan` 블록 (line 1239) 바로 다음에 추가:

```prisma
model MedicalEquipmentLoanLedger {
  id                Int                        @id @default(autoincrement())

  // 기존 EquipmentLoan 과 1:1 연결
  equipmentLoanId   Int                        @unique
  equipmentLoan     EquipmentLoan              @relation(fields: [equipmentLoanId], references: [id])

  // 상태
  status            MedicalEquipmentLoanStatus @default(DRAFT)

  // 요청자 / 승인자
  requestedById     Int
  requestedBy       User                       @relation("MedLoanRequestedBy", fields: [requestedById], references: [id])
  approvedById      Int?
  approvedBy        User?                      @relation("MedLoanApprovedBy", fields: [approvedById], references: [id])
  approvedAt        DateTime?
  rejectedById      Int?
  rejectedBy        User?                      @relation("MedLoanRejectedBy", fields: [rejectedById], references: [id])
  rejectedAt        DateTime?
  rejectionReason   String?                    @db.Text

  // 응급 여부
  isEmergency       Boolean                    @default(false)
  emergencyReason   String?                    @db.Text

  // 파트너 / 스폰서 참조
  partnerId         Int?
  partner           Partner?                   @relation(fields: [partnerId], references: [id])
  partnerContractId Int?
  partnerContract   PartnerContract?           @relation(fields: [partnerContractId], references: [id])
  sponsorshipId     Int?
  sponsorship       Sponsorship?               @relation(fields: [sponsorshipId], references: [id])

  // 할인 / 비용
  discountRate      Float                      @default(0)   // 0~100 퍼센트
  originalCost      Int                        @default(0)   // KRW, 대여 기준 원가
  finalCost         Int                        @default(0)   // KRW, 할인 후 실부담
  overrideReason    String?                    @db.Text      // 팀장 수동 override 시 사유

  // 예산 연결
  budgetLineId        Int?
  budgetLine          BudgetLine?              @relation(fields: [budgetLineId], references: [id])
  operatingExpenseId  Int?
  operatingExpense    OperatingExpense?        @relation(fields: [operatingExpenseId], references: [id])

  // escalation 추적
  escalatedAt         DateTime?               // D+1 09:00 escalation 발송 시각 (idempotent guard)

  // 감사
  createdAt           DateTime               @default(now())
  updatedAt           DateTime               @updatedAt
}
```

역참조 추가 — 연관 모델에 relation 필드 추가:

```prisma
// model EquipmentLoan 에 추가:
medicalLedger MedicalEquipmentLoanLedger?

// model Partner 에 추가:
medicalEquipmentLoanLedgers MedicalEquipmentLoanLedger[]

// model PartnerContract 에 추가:
medicalEquipmentLoanLedgers MedicalEquipmentLoanLedger[]

// model Sponsorship 에 추가:
medicalEquipmentLoanLedgers MedicalEquipmentLoanLedger[]

// model BudgetLine 에 추가:
medicalEquipmentLoanLedgers MedicalEquipmentLoanLedger[]

// model OperatingExpense 에 추가:
medicalEquipmentLoanLedger MedicalEquipmentLoanLedger?

// model User 에 추가:
medicalLoansRequested  MedicalEquipmentLoanLedger[] @relation("MedLoanRequestedBy")
medicalLoansApproved   MedicalEquipmentLoanLedger[] @relation("MedLoanApprovedBy")
medicalLoansRejected   MedicalEquipmentLoanLedger[] @relation("MedLoanRejectedBy")
```

- [ ] **Step 4: `prisma format` + `validate`**
```bash
cd apps/api && npx prisma format && npx prisma validate
```

---

## Task 3: Migration

**Files:**
- Create: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_medical_equipment_loan_ledger/migration.sql`

- [ ] **Step 1: Migration 생성 (create-only)**
```bash
cd apps/api
npx prisma migrate dev --create-only --name medical_equipment_loan_ledger
```

- [ ] **Step 2: Enum ADD VALUE 는 transaction 밖으로 이동**

PostgreSQL `ALTER TYPE ... ADD VALUE` 는 transaction 블록 안에서 불가. 생성된 migration SQL 을 수동 편집:

```sql
-- BEGIN/COMMIT 블록 밖으로 이동
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_ISSUED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_ESCALATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICAL_EQUIPMENT_LOAN_RETURN_REQUIRED';

-- MedicalEquipmentLoanStatus 는 신규 CREATE TYPE — transaction 안에서도 가능
-- (BEGIN 블록 안에 둬도 무방)

-- BEGIN
CREATE TYPE "MedicalEquipmentLoanStatus" AS ENUM (
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'ISSUED',
  'EMERGENCY_ISSUED',
  'EMERGENCY_PENDING_POST_APPROVAL',
  'EMERGENCY_RESOLVED',
  'EMERGENCY_REJECTED',
  'RETURNED'
);

CREATE TABLE "MedicalEquipmentLoanLedger" (
  "id"                  SERIAL PRIMARY KEY,
  "equipmentLoanId"     INTEGER NOT NULL UNIQUE,
  "status"              "MedicalEquipmentLoanStatus" NOT NULL DEFAULT 'DRAFT',
  "requestedById"       INTEGER NOT NULL,
  "approvedById"        INTEGER,
  "approvedAt"          TIMESTAMP(3),
  "rejectedById"        INTEGER,
  "rejectedAt"          TIMESTAMP(3),
  "rejectionReason"     TEXT,
  "isEmergency"         BOOLEAN NOT NULL DEFAULT false,
  "emergencyReason"     TEXT,
  "partnerId"           INTEGER,
  "partnerContractId"   INTEGER,
  "sponsorshipId"       INTEGER,
  "discountRate"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "originalCost"        INTEGER NOT NULL DEFAULT 0,
  "finalCost"           INTEGER NOT NULL DEFAULT 0,
  "overrideReason"      TEXT,
  "budgetLineId"        INTEGER,
  "operatingExpenseId"  INTEGER,
  "escalatedAt"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL
);

-- FK constraints
ALTER TABLE "MedicalEquipmentLoanLedger"
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_equipmentLoanId_fkey"
    FOREIGN KEY ("equipmentLoanId") REFERENCES "EquipmentLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_rejectedById_fkey"
    FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_partnerContractId_fkey"
    FOREIGN KEY ("partnerContractId") REFERENCES "PartnerContract"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_sponsorshipId_fkey"
    FOREIGN KEY ("sponsorshipId") REFERENCES "Sponsorship"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_budgetLineId_fkey"
    FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MedicalEquipmentLoanLedger_operatingExpenseId_fkey"
    FOREIGN KEY ("operatingExpenseId") REFERENCES "OperatingExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- COMMIT
```

- [ ] **Step 3: Migration apply**
```bash
cd apps/api && npx prisma migrate deploy
```

- [ ] **Step 4: Prisma client 재생성 확인**
```bash
cd apps/api && npx prisma generate
```

- [ ] **Step 5: Commit**
```bash
git add apps/api/prisma/
git commit -m "feat(schema): MedicalEquipmentLoanLedger + MedicalEquipmentLoanStatus enum"
```

---

## Task 4: 백엔드 헬퍼 — 권한 + 파트너 할인 + 예산 체크

**Files:**
- Modify: `apps/api/src/lib/permissions.ts`
- Create: `apps/api/src/medical-equipment-loan/helpers/resolvePartnerDiscount.ts`
- Create: `apps/api/src/medical-equipment-loan/helpers/checkAndReserveBudget.ts`

### 4-1. 권한 헬퍼 (`permissions.ts`)

- [ ] **Step 1: `canRequestMedicalEquipmentLoan` + `canApproveMedicalEquipmentLoan` 추가**

```typescript
// apps/api/src/lib/permissions.ts 에 추가

/**
 * 의무기기 대여 요청 가능 여부
 * CoachRole MEDICAL / MEDICAL_DIRECTOR 또는 isAdminLike
 */
export function canRequestMedicalEquipmentLoan(user: {
  role: string;
  coachRole?: string | null;
}): boolean {
  if (isAdminLike(user.role)) return true;
  return user.coachRole === 'MEDICAL' || user.coachRole === 'MEDICAL_DIRECTOR';
}

/**
 * 의무기기 대여 승인 가능 여부 (일반 + 사후 승인)
 * CoachRole MEDICAL_DIRECTOR 또는 isAdminLike
 */
export function canApproveMedicalEquipmentLoan(user: {
  role: string;
  coachRole?: string | null;
}): boolean {
  if (isAdminLike(user.role)) return true;
  return user.coachRole === 'MEDICAL_DIRECTOR';
}
```

### 4-2. `resolvePartnerDiscount` 헬퍼

- [ ] **Step 2: 파트너 할인 해소 헬퍼 작성**

```typescript
// apps/api/src/medical-equipment-loan/helpers/resolvePartnerDiscount.ts

import { PrismaClient, Prisma } from '@prisma/client';

export interface PartnerDiscountResult {
  partnerId: number | null;
  partnerContractId: number | null;
  sponsorshipId: number | null;
  discountRate: number; // 0~100
}

/**
 * EquipmentItem.partnerId 기반으로 파트너/스폰서 할인율 계산.
 *
 * 우선순위 (Q5):
 *   1. Sponsorship ACTIVE (contractEnd > now) → discountRate 100 (무상)
 *   2. PartnerContract ACTIVE + discountRate 존재 → discountRate 사용
 *   3. 없음 → discountRate 0 (외부 유상)
 */
export async function resolvePartnerDiscount(
  equipmentItemId: number,
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<PartnerDiscountResult> {
  const client = tx ?? (await import('../../lib/prisma').then((m) => m.default));

  // EquipmentItem → partnerId
  const item = await client.equipmentItem.findUnique({
    where: { id: equipmentItemId },
    select: { partnerId: true },
  });

  const partnerId = item?.partnerId ?? null;
  if (!partnerId) {
    return { partnerId: null, partnerContractId: null, sponsorshipId: null, discountRate: 0 };
  }

  const now = new Date();

  // (1) Sponsorship — contractEnd > now (attachedContractId 유무 무관)
  const sponsorship = await client.sponsorship.findFirst({
    where: {
      attachedContract: { partner: { id: partnerId } },
      contractEnd: { gt: now },
      deletedAt: null,
    },
    select: { id: true },
    orderBy: { contractEnd: 'desc' },
  });

  if (sponsorship) {
    return {
      partnerId,
      partnerContractId: null,
      sponsorshipId: sponsorship.id,
      discountRate: 100, // Q5: Sponsorship = 무상
    };
  }

  // (2) PartnerContract ACTIVE + discountRate
  const contract = await client.partnerContract.findFirst({
    where: {
      partnerId,
      status: 'ACTIVE',
      discountRate: { not: null },
    },
    select: { id: true, discountRate: true },
    orderBy: { startDate: 'desc' },
  });

  if (contract && contract.discountRate !== null) {
    return {
      partnerId,
      partnerContractId: contract.id,
      sponsorshipId: null,
      discountRate: Number(contract.discountRate),
    };
  }

  // (3) 외부 유상
  return { partnerId, partnerContractId: null, sponsorshipId: null, discountRate: 0 };
}
```

> **주의 (Q4):** Sponsorship 조회 시 `attachedContractId` 가 null 인 Sponsorship 도 파트너와 연결될 수 있어야 한다면, Sponsorship 에 `partnerId` 직접 컬럼이 없으므로 `attachedContract.partner.id` 경로만 사용 가능. Sponsorship → PartnerContract → Partner 체인으로 조회. Sponsorship 이 PartnerContract 없이 단독 존재하는 경우 해당 Sponsorship 은 이 쿼리에서 파트너 매칭 불가 → 팀장 수동 override (`overrideReason`) 으로 처리.

### 4-3. `checkAndReserveBudget` 헬퍼

- [ ] **Step 3: 예산 체크 + OperatingExpense PENDING 생성 헬퍼**

```typescript
// apps/api/src/medical-equipment-loan/helpers/checkAndReserveBudget.ts

import { Prisma } from '@prisma/client';
import { AppError } from '../../lib/AppError';

interface ReserveBudgetResult {
  operatingExpenseId: number;
}

/**
 * BudgetLine remaining 검증 후 OperatingExpense(PENDING) 생성.
 * $transaction 안에서 호출해야 함.
 *
 * (Q6) finalCost = 0 (무상) 이어도 OperatingExpense 기록 — 회계 일관성.
 * (Q9) 응급 경로에서는 호출 skip; 사후 승인 시 backfill 로 이 함수 재사용.
 */
export async function checkAndReserveBudget(
  tx: Prisma.TransactionClient,
  params: {
    budgetLineId: number;
    amount: number;          // KRW, finalCost
    seasonId: number;
    categoryId: number;
    departmentId: number;
    description?: string;
  }
): Promise<ReserveBudgetResult> {
  const { budgetLineId, amount, seasonId, categoryId, departmentId, description } = params;

  // BudgetLine 존재 + departmentId 검증 (Q7)
  const budgetLine = await tx.budgetLine.findUnique({
    where: { id: budgetLineId },
    select: { id: true, originalAmount: true, departmentId: true, year: true },
  });

  if (!budgetLine) {
    throw new AppError(404, 'BUDGET_LINE_NOT_FOUND');
  }

  if (budgetLine.departmentId !== departmentId) {
    throw new AppError(400, 'BUDGET_LINE_DEPT_MISMATCH');
  }

  // Remaining = originalAmount - 집행예정(PENDING) - 실집행(APPROVED)
  const spentAgg = await tx.operatingExpense.aggregate({
    where: {
      budgetLineId,
      status: { in: ['PENDING', 'APPROVED'] },
    },
    _sum: { amount: true },
  });

  const spent = Number(spentAgg._sum.amount ?? 0);
  const remaining = budgetLine.originalAmount - spent;

  if (remaining < amount) {
    throw new AppError(400, 'BUDGET_EXCEEDED', {
      remaining,
      requested: amount,
      budgetLineId,
    });
  }

  // OperatingExpense PENDING 생성
  const expense = await tx.operatingExpense.create({
    data: {
      seasonId,
      categoryId,
      amount,
      budgetLineId,
      departmentId,
      status: 'PENDING',
      description: description ?? '의무기기 대여',
    },
  });

  return { operatingExpenseId: expense.id };
}
```

---

## Task 5: 백엔드 — `medical-equipment-loan` 모듈

**Files:**
- Create: `apps/api/src/medical-equipment-loan/dto/medical-equipment-loan.dto.ts`
- Create: `apps/api/src/medical-equipment-loan/medical-equipment-loan.repo.ts`
- Create: `apps/api/src/medical-equipment-loan/medical-equipment-loan.service.ts`
- Create: `apps/api/src/medical-equipment-loan/medical-equipment-loan.controller.ts`
- Create: `apps/api/src/medical-equipment-loan/medical-equipment-loan.routes.ts`
- Create: `apps/api/src/medical-equipment-loan/helpers/resolvePartnerDiscount.ts` (Task 4 에서 작성)
- Create: `apps/api/src/medical-equipment-loan/helpers/checkAndReserveBudget.ts` (Task 4 에서 작성)

### 5-1. DTO

- [ ] **Step 1: DTO 작성**

```typescript
// apps/api/src/medical-equipment-loan/dto/medical-equipment-loan.dto.ts

export interface RequestNormalMedicalLoanDto {
  equipmentItemId: number;
  equipmentUnitId?: number;
  notes?: string;
  originalCost: number;           // KRW, 대여 기준 원가
  overrideDiscountRate?: number;  // 0~100, 팀장 수동 override
  overrideReason?: string;        // override 시 사유 필수
  budgetLineId: number;           // 프론트 dropdown 선택
  seasonId: number;
  categoryId: number;
}

export interface RequestEmergencyMedicalLoanDto {
  equipmentItemId: number;
  equipmentUnitId?: number;
  notes?: string;
  emergencyReason: string;        // Q1: 필수
  originalCost: number;
  overrideDiscountRate?: number;
  overrideReason?: string;
  // 예산 라인 없음 — 사후 승인 시 backfill (Q9)
}

export interface ApproveMedicalLoanDto {
  // 사후 승인 시 budgetLineId + seasonId + categoryId 필요 (응급 backfill)
  budgetLineId?: number;
  seasonId?: number;
  categoryId?: number;
}

export interface RejectMedicalLoanDto {
  rejectionReason: string;
}

export interface OverrideDiscountDto {
  discountRate: number;   // 0~100
  overrideReason: string; // 필수
}
```

### 5-2. Repo

- [ ] **Step 2: Repo 작성**

```typescript
// apps/api/src/medical-equipment-loan/medical-equipment-loan.repo.ts

import prisma from '../lib/prisma';

export const medicalEquipmentLoanRepo = {
  async findLedgerById(id: number) {
    return prisma.medicalEquipmentLoanLedger.findUnique({
      where: { id },
      include: { equipmentLoan: true, partner: true, budgetLine: true },
    });
  },

  async findLedgerByLoanId(equipmentLoanId: number) {
    return prisma.medicalEquipmentLoanLedger.findUnique({
      where: { equipmentLoanId },
      include: { equipmentLoan: true },
    });
  },

  async findAll(filter?: { status?: string; requestedById?: number }) {
    return prisma.medicalEquipmentLoanLedger.findMany({
      where: {
        ...(filter?.status ? { status: filter.status as any } : {}),
        ...(filter?.requestedById ? { requestedById: filter.requestedById } : {}),
      },
      include: {
        equipmentLoan: { include: { equipmentItem: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** EMERGENCY_PENDING_POST_APPROVAL 중 escalatedAt IS NULL (D+1 09:00 초과 대상) */
  async findOverdueEmergency(cutoffDate: Date) {
    return prisma.medicalEquipmentLoanLedger.findMany({
      where: {
        status: 'EMERGENCY_PENDING_POST_APPROVAL',
        escalatedAt: null,
        equipmentLoan: { issuedAt: { lt: cutoffDate } },
      },
      include: {
        equipmentLoan: { select: { issuedAt: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    });
  },
};
```

### 5-3. Service

- [ ] **Step 3: Service 작성**

```typescript
// apps/api/src/medical-equipment-loan/medical-equipment-loan.service.ts

import prisma from '../lib/prisma';
import { AppError } from '../lib/AppError';
import { canRequestMedicalEquipmentLoan, canApproveMedicalEquipmentLoan, isAdminLike } from '../lib/permissions';
import { resolvePartnerDiscount } from './helpers/resolvePartnerDiscount';
import { checkAndReserveBudget } from './helpers/checkAndReserveBudget';
import { sendNotification } from '../notification/notification.service';
import type {
  RequestNormalMedicalLoanDto,
  RequestEmergencyMedicalLoanDto,
  ApproveMedicalLoanDto,
  RejectMedicalLoanDto,
} from './dto/medical-equipment-loan.dto';

// ─── 공통 유틸 ────────────────────────────────────────────────────────────────

async function getUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, coachRole: true, name: true },
  });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND');
  return user;
}

function computeFinalCost(originalCost: number, discountRate: number): number {
  return Math.round(originalCost * (1 - discountRate / 100));
}

// ─── 일반 대여 요청 ─────────────────────────────────────────────────────────

export async function requestNormalLoan(
  requestedById: number,
  dto: RequestNormalMedicalLoanDto
) {
  const user = await getUser(requestedById);
  if (!canRequestMedicalEquipmentLoan(user)) {
    throw new AppError(403, 'MEDICAL_ROLE_REQUIRED');
  }

  const discount = await resolvePartnerDiscount(dto.equipmentItemId);

  // 팀장 수동 override (Q5)
  let appliedDiscountRate = discount.discountRate;
  if (dto.overrideDiscountRate !== undefined) {
    if (!dto.overrideReason) throw new AppError(400, 'OVERRIDE_REASON_REQUIRED');
    appliedDiscountRate = dto.overrideDiscountRate;
  }

  const finalCost = computeFinalCost(dto.originalCost, appliedDiscountRate);

  return prisma.$transaction(async (tx) => {
    // 예산 체크 + OperatingExpense PENDING 생성 (Q6)
    const { operatingExpenseId } = await checkAndReserveBudget(tx, {
      budgetLineId: dto.budgetLineId,
      amount: finalCost,
      seasonId: dto.seasonId,
      categoryId: dto.categoryId,
      departmentId: await getMedicalDeptId(tx),
      description: `의무기기 대여 (일반)`,
    });

    // 기존 EquipmentLoan 생성 (REQUESTED 상태)
    const loan = await tx.equipmentLoan.create({
      data: {
        requestedById,
        equipmentItemId: dto.equipmentItemId,
        equipmentUnitId: dto.equipmentUnitId,
        notes: dto.notes,
        status: 'REQUESTED',
      },
    });

    // MedicalEquipmentLoanLedger 생성
    const ledger = await tx.medicalEquipmentLoanLedger.create({
      data: {
        equipmentLoanId: loan.id,
        status: 'DRAFT',
        requestedById,
        isEmergency: false,
        partnerId: discount.partnerId,
        partnerContractId: discount.partnerContractId,
        sponsorshipId: discount.sponsorshipId,
        discountRate: appliedDiscountRate,
        originalCost: dto.originalCost,
        finalCost,
        overrideReason: dto.overrideReason,
        budgetLineId: dto.budgetLineId,
        operatingExpenseId,
      },
    });

    // 의무팀장 알림 (Q2)
    void notifyDirector(requestedById, 'MEDICAL_EQUIPMENT_LOAN_REQUESTED', loan.id);

    return { loan, ledger };
  });
}

// ─── 응급 대여 요청 ─────────────────────────────────────────────────────────

export async function requestEmergencyLoan(
  requestedById: number,
  dto: RequestEmergencyMedicalLoanDto
) {
  const user = await getUser(requestedById);
  if (!canRequestMedicalEquipmentLoan(user)) {
    throw new AppError(403, 'MEDICAL_ROLE_REQUIRED');
  }
  if (!dto.emergencyReason?.trim()) {
    throw new AppError(400, 'EMERGENCY_REASON_REQUIRED');
  }

  // 파트너/할인 조회·계산 (Q9: 예산 체크만 skip)
  const discount = await resolvePartnerDiscount(dto.equipmentItemId);
  let appliedDiscountRate = discount.discountRate;
  if (dto.overrideDiscountRate !== undefined) {
    if (!dto.overrideReason) throw new AppError(400, 'OVERRIDE_REASON_REQUIRED');
    appliedDiscountRate = dto.overrideDiscountRate;
  }
  const finalCost = computeFinalCost(dto.originalCost, appliedDiscountRate);

  return prisma.$transaction(async (tx) => {
    // 기존 EquipmentLoan — 즉시 ISSUED
    const loan = await tx.equipmentLoan.create({
      data: {
        requestedById,
        equipmentItemId: dto.equipmentItemId,
        equipmentUnitId: dto.equipmentUnitId,
        notes: dto.notes,
        status: 'ISSUED',
        issuedAt: new Date(),
      },
    });

    // Ledger — EMERGENCY_ISSUED → 즉시 EMERGENCY_PENDING_POST_APPROVAL
    const ledger = await tx.medicalEquipmentLoanLedger.create({
      data: {
        equipmentLoanId: loan.id,
        status: 'EMERGENCY_PENDING_POST_APPROVAL',
        requestedById,
        isEmergency: true,
        emergencyReason: dto.emergencyReason,
        partnerId: discount.partnerId,
        partnerContractId: discount.partnerContractId,
        sponsorshipId: discount.sponsorshipId,
        discountRate: appliedDiscountRate,
        originalCost: dto.originalCost,
        finalCost,
        overrideReason: dto.overrideReason,
        // budgetLineId / operatingExpenseId = null (사후 backfill, Q9)
      },
    });

    // 의무팀장에게 사후 승인 요청 알림 (Q2)
    void notifyDirector(requestedById, 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_ISSUED', loan.id);

    return { loan, ledger };
  });
}

// ─── 승인 (일반 + 응급 사후) ─────────────────────────────────────────────────

export async function approveLoan(
  ledgerId: number,
  approverId: number,
  dto: ApproveMedicalLoanDto = {}
) {
  const approver = await getUser(approverId);
  if (!canApproveMedicalEquipmentLoan(approver)) {
    throw new AppError(403, 'MEDICAL_DIRECTOR_REQUIRED');
  }

  const ledger = await prisma.medicalEquipmentLoanLedger.findUnique({
    where: { id: ledgerId },
    include: { equipmentLoan: true },
  });
  if (!ledger) throw new AppError(404, 'LEDGER_NOT_FOUND');

  // 자기 자신 승인 block (Q자기승인)
  if (ledger.requestedById === approverId && !isAdminLike(approver.role)) {
    throw new AppError(403, 'SELF_APPROVAL_FORBIDDEN');
  }

  const isDraft = ledger.status === 'DRAFT';
  const isEmergencyPending = ledger.status === 'EMERGENCY_PENDING_POST_APPROVAL';

  if (!isDraft && !isEmergencyPending) {
    throw new AppError(400, 'INVALID_STATUS_FOR_APPROVAL');
  }

  return prisma.$transaction(async (tx) => {
    let operatingExpenseId = ledger.operatingExpenseId;

    // 응급 경로: 예산 backfill (Q9)
    if (isEmergencyPending) {
      if (!dto.budgetLineId || !dto.seasonId || !dto.categoryId) {
        throw new AppError(400, 'BUDGET_LINE_REQUIRED_FOR_EMERGENCY_BACKFILL');
      }
      const { operatingExpenseId: expId } = await checkAndReserveBudget(tx, {
        budgetLineId: dto.budgetLineId,
        amount: ledger.finalCost,
        seasonId: dto.seasonId,
        categoryId: dto.categoryId,
        departmentId: await getMedicalDeptId(tx),
        description: `의무기기 대여 (응급 사후)`,
      });
      operatingExpenseId = expId;
    } else {
      // 일반 경로: EquipmentLoan REQUESTED → APPROVED
      await tx.equipmentLoan.update({
        where: { id: ledger.equipmentLoanId },
        data: { status: 'APPROVED', approvedById: approverId },
      });
    }

    const newStatus = isEmergencyPending ? 'EMERGENCY_RESOLVED' : 'APPROVED';

    const updated = await tx.medicalEquipmentLoanLedger.update({
      where: { id: ledgerId },
      data: {
        status: newStatus as any,
        approvedById: approverId,
        approvedAt: new Date(),
        operatingExpenseId,
        ...(dto.budgetLineId ? { budgetLineId: dto.budgetLineId } : {}),
      },
    });

    void sendNotification({
      userId: ledger.requestedById,
      type: isEmergencyPending
        ? 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_RESOLVED'
        : 'MEDICAL_EQUIPMENT_LOAN_APPROVED',
      referenceId: ledger.equipmentLoanId,
    });

    return updated;
  });
}

// ─── 반려 ────────────────────────────────────────────────────────────────────

export async function rejectLoan(
  ledgerId: number,
  approverId: number,
  dto: RejectMedicalLoanDto
) {
  const approver = await getUser(approverId);
  if (!canApproveMedicalEquipmentLoan(approver)) {
    throw new AppError(403, 'MEDICAL_DIRECTOR_REQUIRED');
  }

  const ledger = await prisma.medicalEquipmentLoanLedger.findUnique({
    where: { id: ledgerId },
  });
  if (!ledger) throw new AppError(404, 'LEDGER_NOT_FOUND');

  if (ledger.requestedById === approverId && !isAdminLike(approver.role)) {
    throw new AppError(403, 'SELF_APPROVAL_FORBIDDEN');
  }

  const isDraft = ledger.status === 'DRAFT';
  const isEmergencyPending = ledger.status === 'EMERGENCY_PENDING_POST_APPROVAL';

  if (!isDraft && !isEmergencyPending) {
    throw new AppError(400, 'INVALID_STATUS_FOR_REJECTION');
  }

  return prisma.$transaction(async (tx) => {
    // 일반 반려: EquipmentLoan → REJECTED, OperatingExpense PENDING → CANCELLED
    if (isDraft) {
      await tx.equipmentLoan.update({
        where: { id: ledger.equipmentLoanId },
        data: { status: 'REJECTED' },
      });
      if (ledger.operatingExpenseId) {
        await tx.operatingExpense.update({
          where: { id: ledger.operatingExpenseId },
          data: { status: 'CANCELLED' },
        });
      }
    }

    const newStatus = isEmergencyPending ? 'EMERGENCY_REJECTED' : 'REJECTED';

    const updated = await tx.medicalEquipmentLoanLedger.update({
      where: { id: ledgerId },
      data: {
        status: newStatus as any,
        rejectedById: approverId,
        rejectedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
    });

    // 응급 반려: 즉시 반납 요구 알림 (Q3)
    const notifType = isEmergencyPending
      ? 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_REJECTED'
      : 'MEDICAL_EQUIPMENT_LOAN_REJECTED';

    void sendNotification({
      userId: ledger.requestedById,
      type: notifType,
      referenceId: ledger.equipmentLoanId,
      message: isEmergencyPending
        ? `반려 사유: ${dto.rejectionReason}. 기기를 즉시 반납해주세요.`
        : `반려 사유: ${dto.rejectionReason}`,
    });

    // 응급 반려 시 return-required 별도 알림 (Q3)
    if (isEmergencyPending) {
      void sendNotification({
        userId: ledger.requestedById,
        type: 'MEDICAL_EQUIPMENT_LOAN_RETURN_REQUIRED',
        referenceId: ledger.equipmentLoanId,
      });
    }

    return updated;
  });
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

async function getMedicalDeptId(
  tx?: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<number> {
  const client = tx ?? prisma;
  const dept = await client.department.findFirst({
    where: { name: { contains: '의무' } },
    select: { id: true },
  });
  if (!dept) throw new AppError(500, 'MEDICAL_DEPT_NOT_FOUND');
  return dept.id;
}

async function notifyDirector(
  requestedById: number,
  type: string,
  referenceId: number
) {
  const director = await prisma.user.findFirst({
    where: { coachRole: 'MEDICAL_DIRECTOR' },
    select: { id: true },
  });
  if (!director) return; // no-op if not assigned
  await sendNotification({ userId: director.id, type: type as any, referenceId });
}
```

### 5-4. Controller

- [ ] **Step 4: Controller 작성**

```typescript
// apps/api/src/medical-equipment-loan/medical-equipment-loan.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as service from './medical-equipment-loan.service';

export async function listLoans(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, requestedById } = req.query as Record<string, string>;
    const result = await import('./medical-equipment-loan.repo').then((r) =>
      r.medicalEquipmentLoanRepo.findAll({
        status,
        requestedById: requestedById ? parseInt(requestedById) : undefined,
      })
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function requestNormal(req: Request, res: Response, next: NextFunction) {
  try {
    const requestedById = req.user!.id;
    const result = await service.requestNormalLoan(requestedById, req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function requestEmergency(req: Request, res: Response, next: NextFunction) {
  try {
    const requestedById = req.user!.id;
    const result = await service.requestEmergencyLoan(requestedById, req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const ledgerId = parseInt(req.params.id);
    const approverId = req.user!.id;
    const result = await service.approveLoan(ledgerId, approverId, req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const ledgerId = parseInt(req.params.id);
    const approverId = req.user!.id;
    const result = await service.rejectLoan(ledgerId, approverId, req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}
```

### 5-5. Routes

- [ ] **Step 5: Routes 작성**

```typescript
// apps/api/src/medical-equipment-loan/medical-equipment-loan.routes.ts

import { Router } from 'express';
import { auth } from '../middleWare/auth';
import * as controller from './medical-equipment-loan.controller';

const router = Router();

router.get('/', auth, controller.listLoans);
router.post('/request', auth, controller.requestNormal);
router.post('/emergency', auth, controller.requestEmergency);
router.post('/:id/approve', auth, controller.approve);
router.post('/:id/reject', auth, controller.reject);

export default router;
```

### 5-6. apiRouter.ts 에 등록

- [ ] **Step 6: apiRouter.ts 에 라우트 등록**

```typescript
// apps/api/src/apiRouter.ts
import medicalEquipmentLoanRouter from './medical-equipment-loan/medical-equipment-loan.routes';

// 기존 라우트 아래에 추가:
apiRouter.use('/medical-equipment-loan', medicalEquipmentLoanRouter);
```

- [ ] **Step 7: Commit**
```bash
git add apps/api/src/medical-equipment-loan/ apps/api/src/lib/permissions.ts apps/api/src/apiRouter.ts
git commit -m "feat(medical-equipment-loan): service + controller + routes + permission helpers"
```

---

## Task 6: 백엔드 — D+1 09:00 Escalation Cron

**Files:**
- Create: `apps/api/src/medical-equipment-loan/medicalEmergencyOverdueEscalation.ts`
- Modify: `apps/api/src/server.ts` (cron 등록)

- [ ] **Step 1: Cron 작성**

```typescript
// apps/api/src/medical-equipment-loan/medicalEmergencyOverdueEscalation.ts

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import prisma from '../lib/prisma';
import { sendNotification } from '../notification/notification.service';
import { medicalEquipmentLoanRepo } from './medical-equipment-loan.repo';

dayjs.extend(utc);
dayjs.extend(timezone);

const KST = 'Asia/Seoul';

/**
 * D+1 09:00 KST 초과 EMERGENCY_PENDING_POST_APPROVAL 조회 → escalation.
 * 매일 09:01 KST 실행 권장 (cron: '1 9 * * *' KST).
 * escalatedAt IS NULL 체크로 idempotent.
 */
export async function runMedicalEmergencyOverdueEscalation(): Promise<void> {
  const now = dayjs().tz(KST);
  // "next business day 09:00" 기준: 지급일 다음날 09:00 보다 현재가 늦으면 초과
  // cutoff: 어제 09:00 이전에 issuedAt 된 건
  const cutoff = now.subtract(1, 'day').hour(9).minute(0).second(0).millisecond(0).toDate();

  const overdues = await medicalEquipmentLoanRepo.findOverdueEmergency(cutoff);

  if (overdues.length === 0) return;

  // 부서장(또는 admin) 조회
  const escalationTarget = await prisma.user.findFirst({
    where: {
      OR: [
        { role: 'ADMIN' },
        { role: 'SUPER_ADMIN' },
        { role: 'GM' },
      ],
    },
    select: { id: true },
  });

  for (const ledger of overdues) {
    try {
      await prisma.$transaction(async (tx) => {
        // escalatedAt 업데이트 (idempotent)
        await tx.medicalEquipmentLoanLedger.update({
          where: { id: ledger.id },
          data: { escalatedAt: new Date() },
        });

        // 의무팀장 알림
        const director = await tx.user.findFirst({
          where: { coachRole: 'MEDICAL_DIRECTOR' },
          select: { id: true },
        });
        if (director) {
          await sendNotification({
            userId: director.id,
            type: 'MEDICAL_EQUIPMENT_LOAN_ESCALATED',
            referenceId: ledger.equipmentLoanId,
            message: `응급 대여 사후 승인 기한 초과: D+1 09:00 경과. 즉시 처리 필요.`,
          });
        }

        // 부서장 escalation (Q2)
        if (escalationTarget) {
          await sendNotification({
            userId: escalationTarget.id,
            type: 'MEDICAL_EQUIPMENT_LOAN_ESCALATED',
            referenceId: ledger.equipmentLoanId,
            message: `응급 대여 사후 승인이 D+1 09:00 를 초과했습니다. 의무팀장 독촉 필요.`,
          });
        }
      });
    } catch (err) {
      console.error(`[MedicalEmergencyEscalation] ledger ${ledger.id} escalation failed:`, err);
    }
  }
}
```

- [ ] **Step 2: server.ts 에 cron 등록**

```typescript
// apps/api/src/server.ts 또는 cron 등록 위치

import cron from 'node-cron';
import { runMedicalEmergencyOverdueEscalation } from './medical-equipment-loan/medicalEmergencyOverdueEscalation';

// 매일 09:01 KST (UTC+9 → UTC 00:01)
cron.schedule('1 0 * * *', async () => {
  console.log('[Cron] 의무기기 응급 대여 초과 escalation 실행');
  await runMedicalEmergencyOverdueEscalation().catch(console.error);
});
```

> **주의:** 서버 timezone 이 UTC 인 경우 `cron.schedule('1 0 * * *')` 은 UTC 00:01 = KST 09:01. 서버 timezone 확인 필요. `dayjs-timezone` 으로 KST 변환은 cutoff 계산에 이미 적용됨.

- [ ] **Step 3: Commit**
```bash
git add apps/api/src/medical-equipment-loan/medicalEmergencyOverdueEscalation.ts apps/api/src/server.ts
git commit -m "feat(medical-equipment-loan): D+1 09:00 escalation cron"
```

---

## Task 7: 프론트엔드 — `MedicalEquipmentLoanPage.tsx`

**Files:**
- Create: `football/src/types/medical-equipment-loan.ts`
- Create: `football/src/services/medical-equipment-loan.service.ts`
- Create: `football/src/pages/medical/MedicalEquipmentLoanPage.tsx`
- Create: `football/src/pages/medical/MedicalEquipmentLoanDetailPage.tsx`
- Modify: `football/src/App.tsx` (라우트 추가)
- Modify: `football/src/layouts/AppShell.tsx` (네비 항목 추가)

### 7-1. 타입 정의

- [ ] **Step 1: 타입 정의**

```typescript
// football/src/types/medical-equipment-loan.ts

export type MedicalEquipmentLoanStatus =
  | 'DRAFT'
  | 'APPROVED'
  | 'REJECTED'
  | 'ISSUED'
  | 'EMERGENCY_ISSUED'
  | 'EMERGENCY_PENDING_POST_APPROVAL'
  | 'EMERGENCY_RESOLVED'
  | 'EMERGENCY_REJECTED'
  | 'RETURNED';

export interface MedicalEquipmentLoanLedger {
  id: number;
  equipmentLoanId: number;
  status: MedicalEquipmentLoanStatus;
  requestedById: number;
  approvedById?: number;
  approvedAt?: string;
  rejectedById?: number;
  rejectedAt?: string;
  rejectionReason?: string;
  isEmergency: boolean;
  emergencyReason?: string;
  partnerId?: number;
  partnerContractId?: number;
  sponsorshipId?: number;
  discountRate: number;
  originalCost: number;
  finalCost: number;
  overrideReason?: string;
  budgetLineId?: number;
  operatingExpenseId?: number;
  escalatedAt?: string;
  createdAt: string;
  updatedAt: string;
  // 포함 관계
  equipmentLoan?: {
    id: number;
    status: string;
    equipmentItem?: { id: number; name: string };
  };
  requestedBy?: { id: number; name: string };
  approvedBy?: { id: number; name: string };
  partner?: { id: number; name: string };
}

export interface RequestNormalMedicalLoanDto {
  equipmentItemId: number;
  equipmentUnitId?: number;
  notes?: string;
  originalCost: number;
  overrideDiscountRate?: number;
  overrideReason?: string;
  budgetLineId: number;
  seasonId: number;
  categoryId: number;
}

export interface RequestEmergencyMedicalLoanDto {
  equipmentItemId: number;
  equipmentUnitId?: number;
  notes?: string;
  emergencyReason: string;
  originalCost: number;
  overrideDiscountRate?: number;
  overrideReason?: string;
}

export const MEDICAL_LOAN_STATUS_LABEL: Record<MedicalEquipmentLoanStatus, string> = {
  DRAFT: '승인 대기',
  APPROVED: '승인됨',
  REJECTED: '반려',
  ISSUED: '지급됨',
  EMERGENCY_ISSUED: '응급 지급',
  EMERGENCY_PENDING_POST_APPROVAL: '응급 — 사후 승인 대기',
  EMERGENCY_RESOLVED: '응급 — 사후 승인 완료',
  EMERGENCY_REJECTED: '응급 — 사후 반려',
  RETURNED: '반납 완료',
};
```

### 7-2. API 서비스

- [ ] **Step 2: API 서비스 작성**

```typescript
// football/src/services/medical-equipment-loan.service.ts

import apiClient from './apiClient';
import type {
  MedicalEquipmentLoanLedger,
  RequestNormalMedicalLoanDto,
  RequestEmergencyMedicalLoanDto,
} from '../types/medical-equipment-loan';

export const medicalEquipmentLoanApi = {
  list: (params?: { status?: string; requestedById?: number }) =>
    apiClient
      .get<MedicalEquipmentLoanLedger[]>('/medical-equipment-loan', { params })
      .then((r) => r.data),

  requestNormal: (dto: RequestNormalMedicalLoanDto) =>
    apiClient
      .post<{ loan: unknown; ledger: MedicalEquipmentLoanLedger }>('/medical-equipment-loan/request', dto)
      .then((r) => r.data),

  requestEmergency: (dto: RequestEmergencyMedicalLoanDto) =>
    apiClient
      .post<{ loan: unknown; ledger: MedicalEquipmentLoanLedger }>('/medical-equipment-loan/emergency', dto)
      .then((r) => r.data),

  approve: (id: number, body?: { budgetLineId?: number; seasonId?: number; categoryId?: number }) =>
    apiClient
      .post<MedicalEquipmentLoanLedger>(`/medical-equipment-loan/${id}/approve`, body ?? {})
      .then((r) => r.data),

  reject: (id: number, rejectionReason: string) =>
    apiClient
      .post<MedicalEquipmentLoanLedger>(`/medical-equipment-loan/${id}/reject`, { rejectionReason })
      .then((r) => r.data),
};
```

### 7-3. MedicalEquipmentLoanPage (목록 + 신청 폼)

- [ ] **Step 3: 목록 + 신청 페이지 작성**

주요 UI 컴포넌트 설계:

```
MedicalEquipmentLoanPage
├── 탭: 전체 목록 / 내 신청
├── [신청하기] 버튼 → RequestDrawer
│   ├── 장비 선택 (EquipmentItem dropdown)
│   ├── 응급 여부 토글
│   │   └── (응급 ON) emergencyReason 텍스트 영역 (필수)
│   ├── 원가 입력 (originalCost, KRW)
│   ├── 파트너 할인 미리보기
│   │   └── 자동 감지: "스폰서십 적용 — 무상 (100%)" / "계약 할인 30%" / "파트너 없음"
│   ├── (일반 대여만) 예산 라인 dropdown
│   │   └── 의무팀 departmentId 필터 + 현재 season year
│   ├── finalCost 미리보기 (원가 × (1 - discountRate / 100))
│   └── [신청 / 응급 지급] 버튼
└── 목록 테이블
    ├── 장비명, 요청자, 상태 badge, 날짜, 할인율, finalCost
    └── [상세보기] → MedicalEquipmentLoanDetailPage
```

```typescript
// football/src/pages/medical/MedicalEquipmentLoanPage.tsx
// (구조 스케치 — 전체 구현은 subagent 에서 완성)

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { medicalEquipmentLoanApi } from '../../services/medical-equipment-loan.service';
import { MEDICAL_LOAN_STATUS_LABEL } from '../../types/medical-equipment-loan';
import { toast } from 'sonner';

export default function MedicalEquipmentLoanPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: loans } = useQuery({
    queryKey: ['medical-equipment-loans'],
    queryFn: () => medicalEquipmentLoanApi.list(),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>의무기기 대여 대장</h1>
        <button onClick={() => setDrawerOpen(true)}>신청하기</button>
      </div>
      {/* 목록 테이블 */}
      <table>
        <thead>
          <tr>
            <th>장비</th><th>요청자</th><th>상태</th><th>할인율</th><th>실부담</th><th>일자</th>
          </tr>
        </thead>
        <tbody>
          {loans?.map((l) => (
            <tr key={l.id}>
              <td>{l.equipmentLoan?.equipmentItem?.name}</td>
              <td>{l.requestedBy?.name}</td>
              <td>{MEDICAL_LOAN_STATUS_LABEL[l.status]}</td>
              <td>{l.discountRate}%</td>
              <td>{l.finalCost.toLocaleString()}원</td>
              <td>{new Date(l.createdAt).toLocaleDateString('ko-KR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* RequestDrawer — 별도 컴포넌트로 분리 */}
    </div>
  );
}
```

### 7-4. MedicalEquipmentLoanDetailPage (승인/반려 액션)

- [ ] **Step 4: 상세 페이지 작성**

의무팀장/admin 전용 승인·반려 버튼. 응급 사후 승인 시 budgetLine dropdown 추가 표시:

```
MedicalEquipmentLoanDetailPage
├── 기본 정보 (장비, 요청자, 상태, 날짜)
├── 파트너/할인 정보 (partnerId, discountRate, finalCost)
├── 응급 정보 (emergencyReason, issuedAt, D+1 SLA 남은 시간 표시)
├── 예산 정보 (budgetLine, operatingExpense)
└── 액션 버튼 (권한 있는 사용자만)
    ├── [승인] — 응급 사후 승인이면 budgetLine dropdown 선택 후 진행
    └── [반려] — rejectionReason 입력 모달
```

- [ ] **Step 5: 라우트 + 네비 등록**

```typescript
// football/src/App.tsx
<Route path="/medical/equipment-loan" element={<MedicalEquipmentLoanPage />} />
<Route path="/medical/equipment-loan/:id" element={<MedicalEquipmentLoanDetailPage />} />

// football/src/layouts/AppShell.tsx
// 의무팀 섹션에 추가:
{ label: '기기 대여 대장', href: '/medical/equipment-loan', icon: <StethoscopeIcon /> }
```

- [ ] **Step 6: type-check**
```bash
cd football && npm run type-check
```

- [ ] **Step 7: Commit**
```bash
git add football/src/types/medical-equipment-loan.ts football/src/services/medical-equipment-loan.service.ts football/src/pages/medical/ football/src/App.tsx football/src/layouts/AppShell.tsx
git commit -m "feat(frontend): MedicalEquipmentLoanPage + types + service"
```

---

## Task 8: 테스트

**Files:**
- Create: `apps/api/__test__/medical-equipment-loan/medical-equipment-loan.service.test.ts`
- Create: `apps/api/__test__/medical-equipment-loan/medical-equipment-loan.integration.test.ts`

### 8-1. 서비스 단위 테스트 (Jest + prisma mock)

- [ ] **Step 1: 단위 테스트 작성**

```typescript
// apps/api/__test__/medical-equipment-loan/medical-equipment-loan.service.test.ts

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../src/lib/prisma');
jest.mock('../../src/medical-equipment-loan/helpers/resolvePartnerDiscount');
jest.mock('../../src/medical-equipment-loan/helpers/checkAndReserveBudget');
jest.mock('../../src/notification/notification.service');

const mockPrisma = require('../../src/lib/prisma').default;
const { resolvePartnerDiscount } = require('../../src/medical-equipment-loan/helpers/resolvePartnerDiscount');
const { checkAndReserveBudget } = require('../../src/medical-equipment-loan/helpers/checkAndReserveBudget');

describe('MedicalEquipmentLoanService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── 권한 ────────────────────────────────────────────────────────────────

  describe('requestNormalLoan — 권한 검증', () => {
    it('MEDICAL 역할 요청자 성공', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'STAFF', coachRole: 'MEDICAL', name: '의무사' });
      resolvePartnerDiscount.mockResolvedValue({ partnerId: null, partnerContractId: null, sponsorshipId: null, discountRate: 0 });
      checkAndReserveBudget.mockResolvedValue({ operatingExpenseId: 10 });
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
      mockPrisma.equipmentLoan.create.mockResolvedValue({ id: 100, status: 'REQUESTED' });
      mockPrisma.medicalEquipmentLoanLedger.create.mockResolvedValue({ id: 1, status: 'DRAFT' });

      const { requestNormalLoan } = await import('../../src/medical-equipment-loan/medical-equipment-loan.service');
      await expect(requestNormalLoan(1, {
        equipmentItemId: 5, originalCost: 50000, budgetLineId: 3, seasonId: 1, categoryId: 2
      })).resolves.toBeDefined();
    });

    it('MEDICAL 역할 없는 사용자 403', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, role: 'STAFF', coachRole: null, name: '일반 직원' });
      const { requestNormalLoan } = await import('../../src/medical-equipment-loan/medical-equipment-loan.service');
      await expect(requestNormalLoan(2, {
        equipmentItemId: 5, originalCost: 50000, budgetLineId: 3, seasonId: 1, categoryId: 2
      })).rejects.toMatchObject({ statusCode: 403, code: 'MEDICAL_ROLE_REQUIRED' });
    });
  });

  // ─── 파트너 할인 ─────────────────────────────────────────────────────────

  describe('requestNormalLoan — 파트너 할인', () => {
    it('Sponsorship 있으면 discountRate=100, finalCost=0', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'STAFF', coachRole: 'MEDICAL' });
      resolvePartnerDiscount.mockResolvedValue({ partnerId: 7, partnerContractId: null, sponsorshipId: 3, discountRate: 100 });
      checkAndReserveBudget.mockResolvedValue({ operatingExpenseId: 10 });
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
      mockPrisma.equipmentLoan.create.mockResolvedValue({ id: 101 });
      mockPrisma.medicalEquipmentLoanLedger.create.mockImplementation((args: any) => ({
        id: 2,
        ...args.data,
      }));

      const { requestNormalLoan } = await import('../../src/medical-equipment-loan/medical-equipment-loan.service');
      const result = await requestNormalLoan(1, {
        equipmentItemId: 5, originalCost: 100000, budgetLineId: 3, seasonId: 1, categoryId: 2
      });
      expect(result.ledger.finalCost).toBe(0);
      expect(result.ledger.discountRate).toBe(100);
    });

    it('PartnerContract discountRate=30 → finalCost=70% of original', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'STAFF', coachRole: 'MEDICAL' });
      resolvePartnerDiscount.mockResolvedValue({ partnerId: 8, partnerContractId: 5, sponsorshipId: null, discountRate: 30 });
      checkAndReserveBudget.mockResolvedValue({ operatingExpenseId: 11 });
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
      mockPrisma.equipmentLoan.create.mockResolvedValue({ id: 102 });
      mockPrisma.medicalEquipmentLoanLedger.create.mockImplementation((args: any) => ({
        id: 3, ...args.data,
      }));

      const { requestNormalLoan } = await import('../../src/medical-equipment-loan/medical-equipment-loan.service');
      const result = await requestNormalLoan(1, {
        equipmentItemId: 5, originalCost: 100000, budgetLineId: 3, seasonId: 1, categoryId: 2
      });
      expect(result.ledger.finalCost).toBe(70000);
    });
  });

  // ─── 예산 초과 ────────────────────────────────────────────────────────────

  describe('requestNormalLoan — 예산 체크', () => {
    it('BUDGET_EXCEEDED 시 400 throw', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'STAFF', coachRole: 'MEDICAL' });
      resolvePartnerDiscount.mockResolvedValue({ discountRate: 0, partnerId: null, partnerContractId: null, sponsorshipId: null });
      checkAndReserveBudget.mockRejectedValue({ statusCode: 400, code: 'BUDGET_EXCEEDED' });
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));

      const { requestNormalLoan } = await import('../../src/medical-equipment-loan/medical-equipment-loan.service');
      await expect(requestNormalLoan(1, {
        equipmentItemId: 5, originalCost: 9999999, budgetLineId: 3, seasonId: 1, categoryId: 2
      })).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED' });
    });
  });

  // ─── 응급 대여 ────────────────────────────────────────────────────────────

  describe('requestEmergencyLoan', () => {
    it('emergencyReason 없으면 400', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'STAFF', coachRole: 'MEDICAL' });
      const { requestEmergencyLoan } = await import('../../src/medical-equipment-loan/medical-equipment-loan.service');
      await expect(requestEmergencyLoan(1, {
        equipmentItemId: 5, originalCost: 50000, emergencyReason: ''
      })).rejects.toMatchObject({ statusCode: 400, code: 'EMERGENCY_REASON_REQUIRED' });
    });

    it('응급 요청 성공 시 status=EMERGENCY_PENDING_POST_APPROVAL, budgetLineId=null', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'STAFF', coachRole: 'MEDICAL' });
      resolvePartnerDiscount.mockResolvedValue({ discountRate: 0, partnerId: null, partnerContractId: null, sponsorshipId: null });
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
      mockPrisma.equipmentLoan.create.mockResolvedValue({ id: 103, status: 'ISSUED' });
      mockPrisma.medicalEquipmentLoanLedger.create.mockImplementation((args: any) => ({
        id: 4, ...args.data,
      }));

      const { requestEmergencyLoan } = await import('../../src/medical-equipment-loan/medical-equipment-loan.service');
      const result = await requestEmergencyLoan(1, {
        equipmentItemId: 5, originalCost: 50000, emergencyReason: '선수 응급 처치'
      });
      expect(result.ledger.status).toBe('EMERGENCY_PENDING_POST_APPROVAL');
      expect(result.ledger.budgetLineId).toBeUndefined();
    });
  });

  // ─── 자기 자신 승인 차단 ──────────────────────────────────────────────────

  describe('approveLoan — self-approval block', () => {
    it('요청자 == 승인자 (비admin) → 403', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'STAFF', coachRole: 'MEDICAL_DIRECTOR' });
      mockPrisma.medicalEquipmentLoanLedger.findUnique.mockResolvedValue({
        id: 10, status: 'DRAFT', requestedById: 1, equipmentLoanId: 100, finalCost: 50000, operatingExpenseId: null
      });

      const { approveLoan } = await import('../../src/medical-equipment-loan/medical-equipment-loan.service');
      await expect(approveLoan(10, 1)).rejects.toMatchObject({ statusCode: 403, code: 'SELF_APPROVAL_FORBIDDEN' });
    });
  });

  // ─── 응급 반려 → 즉시 반납 알림 ──────────────────────────────────────────

  describe('rejectLoan — emergency rejected', () => {
    it('EMERGENCY_PENDING_POST_APPROVAL 반려 시 RETURN_REQUIRED 알림 발송', async () => {
      const sendNotification = require('../../src/notification/notification.service').sendNotification;
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, role: 'STAFF', coachRole: 'MEDICAL_DIRECTOR' });
      mockPrisma.medicalEquipmentLoanLedger.findUnique.mockResolvedValue({
        id: 11, status: 'EMERGENCY_PENDING_POST_APPROVAL', requestedById: 1, equipmentLoanId: 101
      });
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
      mockPrisma.medicalEquipmentLoanLedger.update.mockResolvedValue({ id: 11, status: 'EMERGENCY_REJECTED' });

      const { rejectLoan } = await import('../../src/medical-equipment-loan/medical-equipment-loan.service');
      await rejectLoan(11, 2, { rejectionReason: '불필요 물품' });
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MEDICAL_EQUIPMENT_LOAN_RETURN_REQUIRED' })
      );
    });
  });
});
```

### 8-2. 통합 테스트 시나리오

- [ ] **Step 2: 통합 테스트 시나리오 목록 (구현은 subagent)**

```typescript
// apps/api/__test__/medical-equipment-loan/medical-equipment-loan.integration.test.ts
// 실 DB (test env) 사용 — prisma.$transaction 포함한 전체 흐름 검증

describe('MedicalEquipmentLoan Integration', () => {
  // 시나리오 1: 일반 대여 전체 라이프사이클
  it('DRAFT → APPROVED → ISSUED → RETURNED', async () => { /* ... */ });

  // 시나리오 2: 응급 대여 전체 라이프사이클
  it('EMERGENCY_PENDING_POST_APPROVAL → EMERGENCY_RESOLVED → RETURNED', async () => { /* ... */ });

  // 시나리오 3: 파트너 없음 (discountRate=0)
  it('파트너 없음 → finalCost = originalCost, discountRate = 0', async () => { /* ... */ });

  // 시나리오 4: Sponsorship 활성화 → discountRate=100, finalCost=0 이어도 OperatingExpense 기록
  it('Sponsorship 무상 → finalCost=0, OperatingExpense amount=0 생성', async () => { /* ... */ });

  // 시나리오 5: 예산 초과
  it('BUDGET_EXCEEDED → 400, EquipmentLoan 미생성', async () => { /* ... */ });

  // 시나리오 6: budgetLine departmentId 불일치
  it('BUDGET_LINE_DEPT_MISMATCH → 400', async () => { /* ... */ });

  // 시나리오 7: 응급 사후 반려 → 즉시 반납 알림
  it('EMERGENCY_REJECTED → RETURN_REQUIRED 알림 + audit log', async () => { /* ... */ });

  // 시나리오 8: D+1 SLA cron — escalatedAt idempotent
  it('escalation cron 중복 실행 → escalatedAt 한 번만 기록', async () => { /* ... */ });

  // 시나리오 9: 자기 자신 승인 차단
  it('요청자 == 승인자 → 403 SELF_APPROVAL_FORBIDDEN', async () => { /* ... */ });

  // 시나리오 10: override → overrideReason 없으면 400
  it('overrideDiscountRate 있을 때 overrideReason 없으면 400', async () => { /* ... */ });
});
```

- [ ] **Step 3: tsc + jest 실행 (체크 — 실제 run 은 subagent 에서)**
```bash
cd apps/api && npx tsc --noEmit && npx jest --testPathPattern="medical-equipment-loan"
cd football && npm run type-check
```

- [ ] **Step 4: Commit**
```bash
git add apps/api/__test__/medical-equipment-loan/
git commit -m "test(medical-equipment-loan): unit + integration test stubs"
```

---

## Task 9: ADR 0018 + CONTEXT.md

**Files:**
- Create: `docs/adr/0018-medical-equipment-loan-workflow.md`
- Modify: `CONTEXT.md`

- [ ] **Step 1: ADR 0018 작성**

- **Context:** 의무팀 기기 대여가 일반 EquipmentLoan 과 구분 없이 처리됨. 응급 대여 경로 없음. 병원 파트너 할인이 대여 비용에 반영되지 않음. 운영비 예산 기록 불가.
- **Decision:**
  - `MedicalEquipmentLoanLedger` 별도 모델 (EquipmentLoan 1:1 FK) — 응급/파트너/할인/예산 컬럼 포함 (Q8).
  - `MedicalEquipmentLoanStatus` 별도 enum — 기존 `EquipmentLoanStatus` 변경 없음 (도메인 분리).
  - 응급 fast-rent: budget check skip, 즉시 ISSUED, EMERGENCY_PENDING_POST_APPROVAL → D+1 09:00 SLA cron (Q2, Q9).
  - `resolvePartnerDiscount`: Sponsorship > PartnerContract 우선순위, 무상 100% (Q4, Q5).
  - 무상(finalCost=0) 이어도 OperatingExpense(amount=0) 기록 — 회계 일관성 (Q6).
  - 권한: `canRequestMedicalEquipmentLoan` (MEDICAL/MEDICAL_DIRECTOR/admin), `canApproveMedicalEquipmentLoan` (MEDICAL_DIRECTOR/admin). 자기 자신 승인 불가 (admin 제외).
- **Alternatives:**
  - 기존 `EquipmentLoanStatus` 에 EMERGENCY_* 추가 → rejected (기존 장비 대여 워크플로우 영향 범위 큼, 도메인 혼재).
  - 예산 체크 응급 시에도 강제 → rejected (현장 운영 불가, Q9).
  - Sponsorship 과 PartnerContract 동시 만족 조건 → rejected (OR 하나만 있어도 통과, Q4).
- **Consequences (+):** 응급 대여 감사 추적 가능, 병원 파트너 할인 자동 반영, 의무비 OperatingExpense 일관 기록.
- **Consequences (-):** 별도 모듈 신규 + schema 확장 + cron 추가. Sponsorship-Partner 체인 쿼리는 `attachedContractId` 없는 Sponsorship 커버 불가 (팀장 override 로 보완).

- [ ] **Step 2: CONTEXT.md 확장**

기존 `## 장비 대여 (Equipment Loan)` 섹션에 소절 추가:
- "MedicalEquipmentLoanLedger: EquipmentLoan 1:1 FK. 의무팀 전용 — 응급/할인/예산 컬럼."
- "응급 fast-rent: budget skip → EMERGENCY_PENDING_POST_APPROVAL → D+1 09:00 cron escalation."
- "resolvePartnerDiscount: Sponsorship(priority) > PartnerContract.discountRate. 둘 다 없음=0 (유상)."
- "finalCost=0 (무상) 이어도 OperatingExpense(amount=0) 기록 — 회계 일관성."
- "canRequestMedicalEquipmentLoan: CoachRole MEDICAL/MEDICAL_DIRECTOR or admin. canApproveMedicalEquipmentLoan: MEDICAL_DIRECTOR or admin."

- [ ] **Step 3: Commit**
```bash
git add docs/adr/0018-medical-equipment-loan-workflow.md CONTEXT.md
git commit -m "docs(adr): 0018 medical-equipment-loan workflow"
```

---

## Task 10: 스모크 테스트 + PR

- [ ] **Step 1: 전체 타입 체크**
```bash
cd apps/api && npx tsc --noEmit
cd football && npm run type-check
```

- [ ] **Step 2: E2E 시나리오 검증**

1. 의무사 MEDICAL 역할로 장비 대여 신청 → 파트너 병원 Sponsorship 활성 → discountRate=100, finalCost=0 → DRAFT 생성, OperatingExpense(amount=0) PENDING 생성.
2. 의무팀장 MEDICAL_DIRECTOR 역할로 승인 → APPROVED → EquipmentLoan APPROVED.
3. 일반 직원이 의무기기 대여 신청 → 403 MEDICAL_ROLE_REQUIRED.
4. 의무팀장이 자기 신청 자기 승인 → 403 SELF_APPROVAL_FORBIDDEN.
5. 예산 부족 시 400 BUDGET_EXCEEDED, EquipmentLoan 미생성 확인.
6. 응급 대여 신청 → emergencyReason 필수 → EMERGENCY_PENDING_POST_APPROVAL 생성, EquipmentLoan.status=ISSUED.
7. D+1 09:00 초과 → cron 실행 → escalatedAt 기록 + 부서장 알림 → 재실행 시 중복 발송 없음.
8. 응급 사후 반려 → EMERGENCY_REJECTED + RETURN_REQUIRED 알림 발송 확인.
9. 응급 사후 승인 → budgetLineId 입력 → OperatingExpense backfill → EMERGENCY_RESOLVED.
10. PartnerContract discountRate=30% 적용 → finalCost = original × 0.7.

- [ ] **Step 3: PR 생성**
```bash
gh pr create --title "feat: 의무기기 대여 워크플로우 (emergency fast-rent + partner-discount + budget-line)" \
  --body "MedicalEquipmentLoanLedger + MedicalEquipmentLoanStatus 신규 모듈. 응급/일반 경로 분리, 파트너 할인 자동 계산, 예산 라인 체크 + OperatingExpense 연동. D+1 09:00 escalation cron 포함."
```

---

## 위험 / 안전 노트

1. **Postgres enum ALTER 는 tx 밖** — `NotificationType ADD VALUE` 는 BEGIN/COMMIT 블록 밖으로 이동 필수 (Task 3 Step 2). PR #119~#125 패턴 재사용.
2. **Sponsorship-Partner 체인 쿼리** — `Sponsorship.attachedContractId` 가 null 인 Sponsorship 은 `attachedContract.partner.id` 경로로 매칭 불가. 파트너와 직접 연결된 Sponsorship 만 할인 적용 가능. 예외 케이스는 팀장 수동 override (`overrideReason`) 로 처리. 추후 `Sponsorship.partnerId` 직접 컬럼 추가 검토.
3. **`$transaction` 안에서 budget check** — `checkAndReserveBudget` 는 반드시 `$transaction` 안에서 호출. 예산 집계(SUM)와 OperatingExpense 생성이 원자적으로 실행되어야 phantom read 방지.
4. **응급 경로 budget skip** — `requestEmergencyLoan` 은 `checkAndReserveBudget` 호출 없음. 사후 승인 (`approveLoan`) 에서 `budgetLineId` 필수 요구 후 backfill. 사후 반려 시 OperatingExpense 없으므로 취소 처리 불필요.
5. **cron timezone** — 서버 TZ 가 UTC 인 경우 `cron.schedule('1 0 * * *')` = KST 09:01. 배포 환경 TZ 확인 필수. `dayjs-timezone` 으로 cutoff 계산은 이미 KST 기준.
6. **`getMedicalDeptId` null guard** — 의무팀 Department 가 없으면 500. seed 에서 의무팀 department 존재 보장 또는 null safe fallback 추가.
7. **`escalatedAt` idempotent guard** — cron 은 `escalatedAt IS NULL` 조건으로만 대상 선별. 재실행 시 중복 발송 없음. 단, cron 프로세스 crash 시 일부 업데이트 누락 가능 → 모니터링 권고.
8. **기존 EquipmentLoan 무변경** — 기존 `EquipmentLoanStatus` enum 및 `equipment.service.ts` 변경 없음. 의무기기 신규 신청은 반드시 `/medical-equipment-loan/*` 경로로만 진입.

---

## Non-goals (Follow-up)

- **`Sponsorship.partnerId` 직접 컬럼 추가** — Sponsorship-Partner 직접 매핑. 현재 `attachedContract.partner` 체인으로 우회. 별도 schema plan.
- **반납 워크플로우 (`returnLoan`)** — 기존 `equipment.service.returnLoan` 재사용. 반납 시 `MedicalEquipmentLoanLedger.status → RETURNED` update 연동은 별도 hook plan.
- **대여 물품 수량 재고 sync** — `asset-registration-loan-guards` plan 의 unit-tracked/bulk 재고 guard 와 연동. 별도 plan.
- **Threshold config UI** — 의무팀 예산 라인 선택 UI 개선. 별도 어드민 설정 plan.
- **MedicalPartnership 모델** — `2026-08-24-medical-partnership.md` 팬딩. 이 plan 과 prerequisite 아님 — 기존 Partner + Sponsorship 으로 충분.
- **대여 이력 감사 report** — 기간별 의무기기 대여/반납 집계. 별도 report plan.
- **모바일 응급 대여 UI** — 현장 신속 신청용 모바일 최적화 UX. 별도 UI plan.

---

## Decision Traceability

| Q# | 결정 요약 | 구현 Task |
|----|-----------|-----------|
| Q1 | 요청자 self-flag + `emergencyReason` 필수 | Task 5 Step 1 (DTO: emergencyReason required) / Task 5 Step 3 (`requestEmergencyLoan` validation) |
| Q2 | D+1 09:00 SLA cron + 부서장 escalation | Task 6 (`medicalEmergencyOverdueEscalation.ts`) |
| Q3 | 응급 반려 시 즉시 반납 요구 알림 + audit | Task 5 Step 3 (`rejectLoan` EMERGENCY_REJECTED branch) / Task 2 Step 2 (RETURN_REQUIRED NotificationType) |
| Q4 | PartnerContract ACTIVE OR Sponsorship(active) — OR 조건 | Task 4 Step 2 (`resolvePartnerDiscount`) |
| Q5 | Sponsorship → 100% (무상) > PartnerContract.discountRate. override 가능 | Task 4 Step 2 (`resolvePartnerDiscount` 우선순위) / Task 5 Step 3 (overrideReason validation) |
| Q6 | finalCost=0 이어도 OperatingExpense 기록 | Task 4 Step 3 (`checkAndReserveBudget` — amount=0 허용) |
| Q7 | 의무팀 departmentId + year 서버 재검증 | Task 4 Step 3 (`checkAndReserveBudget` departmentId mismatch 400) / Task 7 Step 1 (budgetLine dropdown) |
| Q8 | `MedicalEquipmentLoanLedger` 별도 모델 | Task 2 Step 3 (schema) / Task 3 (migration) |
| Q9 | 응급 budget skip — 사후 승인 시 backfill | Task 5 Step 3 (`requestEmergencyLoan` no-budget-check) / Task 5 Step 3 (`approveLoan` EMERGENCY_PENDING branch backfill) |
| Q10 | 팀장 사후 승인 완료 = `EMERGENCY_RESOLVED` | Task 2 Step 1 (MedicalEquipmentLoanStatus enum) / Task 5 Step 3 (`approveLoan` newStatus logic) |
