# 자산 등록·대여 게이트 강화 (Asset Registration & Loan Guards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장비 등록·대여의 gate 를 강화. 등록 3-tier 승인 escalation (저가/일반/고가) + 대여 유닛 상태 원자적 체크 + 유저별 대여 한도 감사. 스폰서/파트너십/현물협찬 등록은 sponsor 도메인 별도 진입점으로 분리.

**Why:**
- 현재 `AssetRequest` 3-stage 는 모든 요청에 동일 → 저가 자산도 부서장 승인 부담. 고가 자산은 구단주·단장 승인 없음.
- Equipment loan 은 `unit.status` atomic check X → race condition 으로 이중 대여 위험.
- 유저별 대여 한도 미존재 → 미반납 폭주 시 감사 불가.
- 스폰서 물품 register 는 acquisition (`AssetRequest`) 이 아님 — sponsor 계약 트리거로 자동 재고 등록해야 하며, 이 plan 스코프 밖.

**Architecture:**
- `AssetRequest` 에 `tier: AssetTier` (LOW/MID/HIGH) 필드 추가 — 생성 시 서비스가 `AssetTierThresholdConfig` 읽어 자동 결정.
- 3-tier escalation: LOW = 팀장만 / MID = 팀장→부서장 (기존) / HIGH = 팀장→부서장→구단주+단장.
- `Club.ownerId Int?` 추가 — HIGH tier 3rd stage 승인자 식별. `null` 이면 GM only.
- `AssetTierThresholdConfig` 단일-row 테이블 — 금액 임계값 + 유저별 대여 한도 중앙 관리.
- `EquipmentLoan` 대여 요청 시 `$transaction` 안에서 unit 상태 검증 + 대여 한도 체크 → 초과 시 `PENDING_ADDITIONAL_APPROVAL` 상태로 자산관리팀장 승인 대기.

**Tech Stack:** Prisma + PostgreSQL, Express, Jest (unit test), React + TypeScript.

**Related Plans / Specs:**
- `docs/superpowers/plans/2026-08-23-asset-request-workflow.md` — AssetRequest 2-stage 기본 설계 (이 plan 이 확장)
- `docs/superpowers/plans/2026-08-24-team-member-crud.md` — `Department.headId` 재사용 패턴 참조
- `docs/adr/0013-asset-request-department-approval.md` — asset-request approval ADR (이 plan 이 0017 신규 ADR 로 보강)

---

## 🔴 Grill 결정 (2026-08-25)

**재논의 금지.**

### Q3: 자산 등록 정의
- **선택 (c):** 일반/고가 → `AssetRequest` 확장. 스폰서/파트너십/현물협찬 → `sponsor` / `partnership` 모듈 별도 등록 진입점.
- 근거: 스폰서 물품은 취득 결재(`AssetRequest`) 가 아니라 계약 체결 이후 재고 등록 트리거이므로 도메인 혼재 방지.
- BudgetCheck for sponsor = "계약 상한 대비 물품 가액 초과 여부" (운영비 예산 아님).

### Q4: 승인 shape + threshold
- **선택: 3-tier escalation**
  - 저가 (LOW): 팀장만 (부서장 stage skip)
  - 일반 (MID): 팀장 → 부서장 (기존 2-stage 유지)
  - 고가 (HIGH): 팀장 → 부서장 → 구단주+단장 (신규 3rd stage)
- 근거: 저가 자산 부서장 부담 해소 + 고가 자산 상급 통제 강화. 기존 2-stage 는 MID tier 그대로 재사용 — 최소 스키마 변경.

### Q5: 구단주+단장 승인자 식별
- **선택 (a) + (β):** `Club.ownerId Int?` 필드 추가 + OR (first-approve-wins).
- `ownerId = null` 이면 GM only. `ownerId != null` 이면 owner 또는 GM 중 먼저 승인한 쪽 = 3rd stage 완료.
- 근거: 구단주 부재 클럽(법인 운영 등)에서 GM 단독 fallback 필수. `firstApprove` 패턴은 기존 asset-request reviewer 경합 방지 로직 재사용.

### Q6: Threshold cutpoints
- **선택 (ii):** `AssetTierThresholdConfig` 단일-row 테이블 (`id = 1` default).
  - 초기값: 저가 ≤ 500,000 KRW / 일반 500,001~5,000,000 / 고가 > 5,000,000
  - 컬럼: `lowMax Int`, `midMax Int`, `loanLimitPerUser Int @default(5)`
- 근거: 부서·카테고리별 임계값 (`EquipmentCategoryThreshold`) 은 설계 복잡도 대비 운영 실익 낮음 → 3.x scope. 단일 row 어드민 직접 SQL 수정 허용.
- Threshold 조정 UI 는 이 plan 밖 (Non-goals).

### Q7: ItemStatus 409 (동시 대여 방지)
- **선택 (c) 하이브리드:**
  - `trackedIndividually = true` (unit level): `$transaction` 안에서 `unit.status = 'AVAILABLE'` verify → `'IN_USE'` update. 실패 시 409 `UNIT_NOT_AVAILABLE`.
  - `trackedIndividually = false` (bulk stock): active loan count (APPROVED + ISSUED) aggregate → `count >= quantity` 이면 409 `NO_STOCK`.
- **APPROVED 포함 (승인 시점 lock):** 승인 즉시 재고 잠금 — 미수령 timeout 은 별도 plan.
- 근거: unit-tracked 장비는 식별자 단위 정합성 필수. bulk 재고는 aggregate count 가 overhead 낮음.

### Q8: LimitAlert (per-user 한도)
- **선택 (a) + (α):**
  - 유저별 active loan count (APPROVED + ISSUED) 집계.
  - 상한 = `AssetTierThresholdConfig.loanLimitPerUser` (기본 5).
  - 초과 시 loan 상태 `PENDING_ADDITIONAL_APPROVAL` (신규 enum) → **자산관리팀장** (`Department where name='자산관리'` 또는 category 매칭 `headId`) 승인.
  - 자산관리팀장 `null` → admin escalation.
  - 거부 → `REJECTED` + 요청자 알림 (`LOAN_LIMIT_EXCEEDED_APPROVAL_REQUIRED` NotificationType 신규).
- 근거: 부서별 quota 는 운영 설정 부담 큼 → 3.x scope. 유저별 단순 상한이 현실적 첫 제어 수단.

### Q9: RentSuccess 재고 sync
- **선택 (a):** `issueLoan()` / `returnLoan()` 안에서 `$transaction` 으로 `EquipmentUnit.status` 동기 update.
  - 대여 발행 (`issueLoan`): `ISSUED → IN_USE`
  - 반납 (`returnLoan`): `RETURNED → AVAILABLE`
- 근거: 비동기 event 기반 sync 는 lag 시 재고 불일치 위험 → 동기 transaction 이 단순하고 안전.
- 미수령 timeout auto-cancel 은 별도 plan.

---

## Task 1: 착수 확인 + 브랜치

- [ ] **Step 1: 관련 모델 최신 상태 확인**
```bash
grep -B1 -A20 "^model Club\|^model AssetRequest\|^model EquipmentLoan\|^model EquipmentUnit\|^enum AssetRequestStatus\|^enum AssetRequestApprovalStage\|^enum NotificationType" apps/api/prisma/schema.prisma
```
확인 사항:
- `Club` 에 `ownerId` 없음 (이 plan 이 추가)
- `AssetRequest` 에 `tier` 필드 없음 (이 plan 이 추가)
- `EquipmentLoan.status` enum 에 `PENDING_ADDITIONAL_APPROVAL` 없음 (이 plan 이 추가)
- `NotificationType` 에 `LOAN_LIMIT_EXCEEDED_APPROVAL_REQUIRED` 없음 (이 plan 이 추가)

- [ ] **Step 2: 기존 asset-request 서비스 확인**
```bash
grep -n "stage\|approve\|APPROVED\|PENDING" apps/api/src/asset-request/asset-request.service.ts | head -40
```
기존 2-stage (LEADER → DEPT_HEAD) 흐름 파악 후 3rd stage 확장 위치 결정.

- [ ] **Step 3: EquipmentLoan 서비스 확인**
```bash
grep -n "requestLoan\|issueLoan\|returnLoan\|unit\|status" apps/api/src/equipment/equipment.service.ts | head -40
```
현재 unit.status 검증 없음 확인.

- [ ] **Step 4: 브랜치 생성**
```bash
git checkout -b feat/asset-registration-loan-guards
```

---

## Task 2: Prisma Schema 변경

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `Club.ownerId` 추가**
```prisma
model Club {
  // ... 기존 필드 ...
  ownerId    Int?
  owner      User?   @relation("ClubOwner", fields: [ownerId], references: [id], onDelete: SetNull)
}
```
`User` 모델에 역참조 추가:
```prisma
model User {
  // ... 기존 필드 ...
  ownedClubs Club[]  @relation("ClubOwner")
}
```

- [ ] **Step 2: `AssetTierThresholdConfig` 신규 모델**
```prisma
model AssetTierThresholdConfig {
  id                Int @id @default(1)  // 단일-row 강제
  lowMax            Int @default(500000)
  midMax            Int @default(5000000)
  loanLimitPerUser  Int @default(5)
  updatedAt         DateTime @updatedAt
}
```

- [ ] **Step 3: `AssetTier` 신규 enum + `AssetRequest.tier` 필드 추가**
```prisma
enum AssetTier {
  LOW
  MID
  HIGH
}

model AssetRequest {
  // ... 기존 필드 ...
  tier  AssetTier?   // 생성 시 서비스가 자동 결정, null = 미분류(구버전 데이터)
}
```

- [ ] **Step 4: `AssetRequestStatus` + `AssetRequestApprovalStage` 3rd stage 확장**
```prisma
enum AssetRequestStatus {
  // 기존 값 유지 ...
  PENDING_OWNER_APPROVAL   // 신규: HIGH tier 3rd stage 대기
}

enum AssetRequestApprovalStage {
  // 기존 값 유지 ...
  OWNER_GM_APPROVED        // 신규: 구단주 or GM 승인 완료 (3rd stage)
}
```

- [ ] **Step 5: `EquipmentLoan.status` enum 에 `PENDING_ADDITIONAL_APPROVAL` 추가**
```prisma
enum EquipmentLoanStatus {
  // 기존 값 유지 (PENDING, APPROVED, ISSUED, RETURNED, REJECTED, CANCELLED) ...
  PENDING_ADDITIONAL_APPROVAL   // 신규: 대여 한도 초과 → 자산관리팀장 승인 대기
}
```

- [ ] **Step 6: `NotificationType` 에 신규 enum 값 추가**
```prisma
enum NotificationType {
  // 기존 값 유지 ...
  LOAN_LIMIT_EXCEEDED_APPROVAL_REQUIRED   // 신규
}
```

- [ ] **Step 7: `prisma format` + `validate`**
```bash
cd apps/api && npx prisma format && npx prisma validate
```

---

## Task 3: Migration + Seed

- [ ] **Step 1: Migration 생성**
```bash
cd apps/api
npx prisma migrate dev --create-only --name asset_tier_loan_guards
```

- [ ] **Step 2: Enum ALTER 핸들링 (필요 시 수동 handcraft)**
Postgres `ALTER TYPE ... ADD VALUE` 는 transaction 밖에서 실행해야 함 (기존 asset-request enum 확장 패턴 재사용):
```sql
-- migration SQL 파일에서 BEGIN/COMMIT 블록 밖으로 ALTER TYPE 이동
ALTER TYPE "AssetRequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_OWNER_APPROVAL';
ALTER TYPE "AssetRequestApprovalStage" ADD VALUE IF NOT EXISTS 'OWNER_GM_APPROVED';
ALTER TYPE "EquipmentLoanStatus" ADD VALUE IF NOT EXISTS 'PENDING_ADDITIONAL_APPROVAL';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LOAN_LIMIT_EXCEEDED_APPROVAL_REQUIRED';
-- AssetTier 신규 enum 은 CREATE TYPE (문제 없음)
```

- [ ] **Step 3: 로컬 apply**
```bash
npx prisma migrate deploy
```

- [ ] **Step 4: `AssetTierThresholdConfig` seed row 추가**
`apps/api/prisma/seed.ts` 에 upsert 추가:
```typescript
await prisma.assetTierThresholdConfig.upsert({
  where: { id: 1 },
  update: {},
  create: {
    id: 1,
    lowMax: 500_000,
    midMax: 5_000_000,
    loanLimitPerUser: 5,
  },
});
```
```bash
cd apps/api && npx prisma db seed
```

- [ ] **Step 5: Commit**
```bash
git add apps/api/prisma/
git commit -m "feat(schema): asset tier escalation + loan guards schema (Club.ownerId, AssetTierThresholdConfig, AssetTier, loan enums)"
```

---

## Task 4: 백엔드 — AssetRequest 3-tier 승인 확장

**Files:**
- Modify: `apps/api/src/asset-request/asset-request.service.ts`
- Modify: `apps/api/src/asset-request/asset-request.repo.ts`
- Modify: `apps/api/src/asset-request/asset-request.controller.ts`
- Modify: `apps/api/src/asset-request/asset-request.routes.ts`
- Create: `apps/api/__test__/asset-request/asset-request-tier.test.ts`

- [ ] **Step 1: Tier 판정 유틸 추가**
```typescript
// asset-request.service.ts
private async classifyTier(expectedAmount: number): Promise<AssetTier> {
  const config = await prisma.assetTierThresholdConfig.findUnique({ where: { id: 1 } });
  if (!config) throw new AppError(500, 'THRESHOLD_CONFIG_MISSING');
  if (expectedAmount <= config.lowMax) return AssetTier.LOW;
  if (expectedAmount <= config.midMax) return AssetTier.MID;
  return AssetTier.HIGH;
}
```

- [ ] **Step 2: `createAssetRequest()` tier 자동 결정 주입**
```typescript
async createAssetRequest(dto, requesterId) {
  const tier = await this.classifyTier(dto.expectedAmount);
  // LOW: 첫 stage = LEADER only (부서장 stage 없음)
  // MID: 기존 2-stage (LEADER → DEPT_HEAD)
  // HIGH: 3-stage (LEADER → DEPT_HEAD → OWNER_GM)
  const initialStatus = 'PENDING_LEADER_APPROVAL'; // 공통
  return prisma.assetRequest.create({
    data: { ...dto, tier, status: initialStatus, requesterId },
  });
}
```

- [ ] **Step 3: `leaderApprove()` LOW tier 자동 최종 승인 처리**
LOW tier 팀장 승인 시 `APPROVED` 로 바로 이동 (부서장 stage skip):
```typescript
async leaderApprove(requestId, approverId) {
  const req = await this.repo.findById(requestId);
  // ... 기존 권한 검증 ...
  if (req.tier === AssetTier.LOW) {
    // skip to final approval
    await this.repo.updateStatus(requestId, 'APPROVED');
    await this.repo.createApprovalRecord(requestId, approverId, 'LEADER_APPROVED', 'LOW tier — final');
    void this.createApprovedExpense(req).catch(console.error);
    return { ok: true, finalApproved: true };
  }
  // MID/HIGH: 기존 DEPT_HEAD 로 이관
  await this.repo.updateStatus(requestId, 'PENDING_DEPT_HEAD_APPROVAL');
  await this.repo.createApprovalRecord(requestId, approverId, 'LEADER_APPROVED');
  return { ok: true };
}
```

- [ ] **Step 4: `deptHeadApprove()` HIGH tier 3rd stage 이관 처리**
```typescript
async deptHeadApprove(requestId, approverId) {
  const req = await this.repo.findById(requestId);
  // ... 권한 검증 (기존 로직) ...
  if (req.tier === AssetTier.HIGH) {
    await this.repo.updateStatus(requestId, 'PENDING_OWNER_APPROVAL');
    await this.repo.createApprovalRecord(requestId, approverId, 'DEPT_HEAD_APPROVED', 'HIGH tier — owner/GM stage');
    // 구단주 + GM 에게 알림 (fire-and-forget)
    void this.notifyOwnerAndGm(req).catch(console.error);
    return { ok: true };
  }
  // LOW/MID: 최종 승인
  await this.repo.updateStatus(requestId, 'APPROVED');
  await this.repo.createApprovalRecord(requestId, approverId, 'DEPT_HEAD_APPROVED');
  void this.createApprovedExpense(req).catch(console.error);
  return { ok: true };
}
```

- [ ] **Step 5: `ownerApprove()` 신규 endpoint (3rd stage, first-approve-wins)**
```typescript
async ownerApprove(requestId, approverId) {
  const req = await this.repo.findById(requestId);
  if (req.status !== 'PENDING_OWNER_APPROVAL') throw new AppError(400, 'WRONG_STAGE');
  const club = await prisma.club.findFirst(); // 단일 클럽 assumption
  const isOwner = club?.ownerId === approverId;
  const isGm = await this.isGm(approverId);
  if (!isOwner && !isGm) throw new AppError(403, 'NOT_OWNER_OR_GM');
  // first-approve-wins: 이미 OWNER_GM_APPROVED 기록 있으면 skip
  const existing = await this.repo.findApproval(requestId, 'OWNER_GM_APPROVED');
  if (existing) throw new AppError(409, 'ALREADY_APPROVED_BY_PEER');
  await prisma.$transaction(async (tx) => {
    await this.repo.updateStatus(requestId, 'APPROVED', tx);
    await this.repo.createApprovalRecord(requestId, approverId, 'OWNER_GM_APPROVED', undefined, tx);
  });
  void this.createApprovedExpense(req).catch(console.error);
  return { ok: true };
}
```

- [ ] **Step 6: Route 등록**
```typescript
// asset-request.routes.ts
router.post('/:id/owner-approve', auth, controller.ownerApprove);
```

- [ ] **Step 7: Unit tests** — `apps/api/__test__/asset-request/asset-request-tier.test.ts`
  - `classifyTier`: 500,000 → LOW / 1,000,000 → MID / 6,000,000 → HIGH
  - `leaderApprove` LOW tier: status = APPROVED (skip dept-head) + expense 생성 트리거
  - `leaderApprove` MID/HIGH tier: status = PENDING_DEPT_HEAD_APPROVAL
  - `deptHeadApprove` HIGH tier: status = PENDING_OWNER_APPROVAL + owner/GM 알림
  - `deptHeadApprove` MID tier: status = APPROVED + expense 생성
  - `ownerApprove`: owner 통과 / GM 통과 / 비해당자 403 / 중복 승인 409
  - tier config 누락 시 500 오류

- [ ] **Step 8: Commit**
```bash
git add apps/api/src/asset-request/ apps/api/__test__/asset-request/
git commit -m "feat(asset-request): 3-tier approval escalation (LOW skip / HIGH owner+GM stage)"
```

---

## Task 5: 백엔드 — EquipmentLoan 가드 확장

**Files:**
- Modify: `apps/api/src/equipment/equipment.service.ts`
- Create: `apps/api/src/equipment/loan-quota.service.ts`
- Modify: `apps/api/src/equipment/equipment.controller.ts`
- Modify: `apps/api/src/equipment/equipment.routes.ts`
- Create: `apps/api/__test__/equipment/loan-guards.test.ts`

- [ ] **Step 1: `LoanQuotaService` 신규 (유저별 대여 한도 체크)**
```typescript
// loan-quota.service.ts
export class LoanQuotaService {
  async check(userId: number): Promise<{ ok: boolean; activeCount: number; limit: number }> {
    const config = await prisma.assetTierThresholdConfig.findUnique({ where: { id: 1 } });
    if (!config) throw new AppError(500, 'THRESHOLD_CONFIG_MISSING');
    const activeCount = await prisma.equipmentLoan.count({
      where: {
        requesterId: userId,
        status: { in: ['APPROVED', 'ISSUED'] },
      },
    });
    return { ok: activeCount < config.loanLimitPerUser, activeCount, limit: config.loanLimitPerUser };
  }
}
```

- [ ] **Step 2: `requestLoan()` — atomic 검증 + quota 체크 통합**

`trackedIndividually = true` (unit-tracked) 경로:
```typescript
async requestLoanUnitTracked(dto, requesterId) {
  // Q8: quota check 먼저
  const quota = await this.loanQuotaService.check(requesterId);
  if (!quota.ok) {
    // PENDING_ADDITIONAL_APPROVAL 생성 → 자산관리팀장 알림
    const loan = await prisma.equipmentLoan.create({
      data: { ...dto, status: 'PENDING_ADDITIONAL_APPROVAL', requesterId },
    });
    await this.notifyAssetManagerHead(loan, requesterId, quota);
    return { loan, requiresAdditionalApproval: true };
  }
  // Q7: $transaction unit 상태 검증
  return prisma.$transaction(async (tx) => {
    const unit = await tx.equipmentUnit.findUnique({
      where: { id: dto.unitId },
      select: { status: true },
    });
    if (!unit || unit.status !== 'AVAILABLE') {
      throw new AppError(409, 'UNIT_NOT_AVAILABLE');
    }
    await tx.equipmentUnit.update({
      where: { id: dto.unitId },
      data: { status: 'IN_USE' },
    });
    return tx.equipmentLoan.create({
      data: { ...dto, status: 'APPROVED', requesterId },
    });
  });
}
```

`trackedIndividually = false` (bulk stock) 경로:
```typescript
async requestLoanBulk(dto, requesterId) {
  const quota = await this.loanQuotaService.check(requesterId);
  if (!quota.ok) {
    const loan = await prisma.equipmentLoan.create({
      data: { ...dto, status: 'PENDING_ADDITIONAL_APPROVAL', requesterId },
    });
    await this.notifyAssetManagerHead(loan, requesterId, quota);
    return { loan, requiresAdditionalApproval: true };
  }
  // bulk: aggregate count check
  const activeLoans = await prisma.equipmentLoan.count({
    where: {
      equipmentItemId: dto.equipmentItemId,
      status: { in: ['APPROVED', 'ISSUED'] },
    },
  });
  const item = await prisma.equipmentItem.findUnique({ where: { id: dto.equipmentItemId } });
  if (!item) throw new AppError(404, 'EQUIPMENT_NOT_FOUND');
  if (activeLoans + dto.quantity > item.totalQuantity) {
    throw new AppError(409, 'NO_STOCK');
  }
  return prisma.equipmentLoan.create({
    data: { ...dto, status: 'APPROVED', requesterId },
  });
}
```

- [ ] **Step 3: `approveLoan()` — 자산관리팀장이 PENDING_ADDITIONAL_APPROVAL 승인**
```typescript
async approveAdditionalLoan(loanId, approverId) {
  const loan = await prisma.equipmentLoan.findUnique({ where: { id: loanId } });
  if (!loan || loan.status !== 'PENDING_ADDITIONAL_APPROVAL') throw new AppError(400, 'WRONG_STATUS');
  // 자산관리팀장 권한 검증
  const isAssetManagerHead = await this.isAssetManagerHead(approverId);
  const isAdmin = await this.isAdminLike(approverId);
  if (!isAssetManagerHead && !isAdmin) throw new AppError(403, 'NOT_ASSET_MANAGER_HEAD');
  await prisma.equipmentLoan.update({
    where: { id: loanId },
    data: { status: 'ISSUED' },
  });
  return { ok: true };
}

// 자산관리팀장 식별: Department name='자산관리' 또는 category 매칭의 headId
private async isAssetManagerHead(userId: number): Promise<boolean> {
  const dept = await prisma.department.findFirst({
    where: {
      OR: [
        { name: '자산관리' },
        { name: { contains: '자산' } },
      ],
      headId: userId,
    },
  });
  return !!dept;
}
```

- [ ] **Step 4: `issueLoan()` / `returnLoan()` — 재고 sync (Q9)**
```typescript
async issueLoan(loanId: number) {
  const loan = await prisma.equipmentLoan.findUnique({ where: { id: loanId } });
  if (!loan || loan.status !== 'APPROVED') throw new AppError(400, 'NOT_APPROVED');
  await prisma.$transaction(async (tx) => {
    await tx.equipmentLoan.update({ where: { id: loanId }, data: { status: 'ISSUED' } });
    if (loan.unitId) {
      await tx.equipmentUnit.update({
        where: { id: loan.unitId },
        data: { status: 'IN_USE' },
      });
    }
  });
}

async returnLoan(loanId: number) {
  const loan = await prisma.equipmentLoan.findUnique({ where: { id: loanId } });
  if (!loan || loan.status !== 'ISSUED') throw new AppError(400, 'NOT_ISSUED');
  await prisma.$transaction(async (tx) => {
    await tx.equipmentLoan.update({ where: { id: loanId }, data: { status: 'RETURNED' } });
    if (loan.unitId) {
      await tx.equipmentUnit.update({
        where: { id: loan.unitId },
        data: { status: 'AVAILABLE' },
      });
    }
  });
}
```

- [ ] **Step 5: `notifyAssetManagerHead()` helper**
```typescript
private async notifyAssetManagerHead(loan, requesterId, quota) {
  const dept = await prisma.department.findFirst({
    where: { OR: [{ name: '자산관리' }, { name: { contains: '자산' } }] },
    select: { headId: true },
  });
  const targetId = dept?.headId ?? await this.findAdminFallback();
  if (!targetId) return; // no-op if no admin either
  void prisma.notification.create({
    data: {
      userId: targetId,
      type: 'LOAN_LIMIT_EXCEEDED_APPROVAL_REQUIRED',
      relatedId: loan.id,
      message: `대여 한도(${quota.limit}건) 초과 요청 (현재 ${quota.activeCount}건). 추가 승인 필요.`,
    },
  }).catch(console.error);
}
```

- [ ] **Step 6: Route 등록**
```typescript
// equipment.routes.ts
router.post('/:loanId/additional-approve', auth, controller.approveAdditionalLoan);
```

- [ ] **Step 7: Unit tests** — `apps/api/__test__/equipment/loan-guards.test.ts`
  - unit-race: 동시 2개 요청 → 1개 성공 / 1개 409 `UNIT_NOT_AVAILABLE`
  - bulk count: `activeLoans + quantity > totalQuantity` → 409 `NO_STOCK`
  - quota check: activeCount < 5 → OK / >= 5 → `PENDING_ADDITIONAL_APPROVAL`
  - `approveAdditionalLoan`: 자산관리팀장 통과 / 비해당자 403 / 상태 오류 400
  - `issueLoan`: unit.status `IN_USE` 업데이트 확인
  - `returnLoan`: unit.status `AVAILABLE` 복원 확인
  - config 누락 시 500 오류

- [ ] **Step 8: Commit**
```bash
git add apps/api/src/equipment/ apps/api/__test__/equipment/
git commit -m "feat(equipment-loan): atomic unit-check + quota guard + PENDING_ADDITIONAL_APPROVAL flow"
```

---

## Task 6: 알림 확장

**Files:**
- Modify: `apps/api/src/notification/notification.service.ts` (존재 시)
- Verify: `LOAN_LIMIT_EXCEEDED_APPROVAL_REQUIRED` 타입 처리 등록

- [ ] **Step 1: NotificationType 신규 값 핸들링 확인**
```bash
grep -n "NotificationType\|switch\|case" apps/api/src/notification/notification.service.ts | head -30
```
기존 switch/case 에 `LOAN_LIMIT_EXCEEDED_APPROVAL_REQUIRED` 분기 누락 여부 확인.

- [ ] **Step 2: 알림 템플릿 등록**
알림 서비스에 신규 타입 케이스 추가:
```typescript
case 'LOAN_LIMIT_EXCEEDED_APPROVAL_REQUIRED':
  return {
    title: '대여 한도 초과 — 추가 승인 필요',
    body: notification.message,
    link: `/equipment/loans/${notification.relatedId}`,
  };
```

- [ ] **Step 3: Commit**
```bash
git add apps/api/src/notification/
git commit -m "feat(notification): add LOAN_LIMIT_EXCEEDED_APPROVAL_REQUIRED handler"
```

---

## Task 7: Frontend

**Files:**
- Modify: `football/src/pages/asset-request/AssetRequestDetailPage.tsx` — tier 표시 + owner 승인 UI
- Modify: `football/src/pages/equipment/EquipmentLoanPage.tsx` — 409 에러 메시지 + PENDING_ADDITIONAL_APPROVAL 상태
- Create: `football/src/pages/equipment/components/LoanAdditionalApproveCard.tsx` — 자산관리팀장 additional-approve UI
- Modify: `football/src/services/assetRequestApi.ts` — `ownerApprove` API 함수
- Modify: `football/src/services/equipmentApi.ts` — `approveAdditionalLoan` API 함수
- Modify: `football/src/locales/{ko,en}/common.json`

- [ ] **Step 1: AssetRequest 화면 — tier 배지 + owner 승인 버튼**
```typescript
// AssetRequestDetailPage.tsx
const tierLabel = { LOW: '저가', MID: '일반', HIGH: '고가' };

// tier 배지 표시
<Badge variant={request.tier === 'HIGH' ? 'destructive' : 'secondary'}>
  {tierLabel[request.tier ?? 'MID']}
</Badge>

// 구단주/GM 에게 3rd stage 버튼 노출
{request.status === 'PENDING_OWNER_APPROVAL' && (isOwner || isGm) && (
  <Button onClick={() => assetRequestApi.ownerApprove(request.id)}>
    최종 승인 (구단주/단장)
  </Button>
)}
```

- [ ] **Step 2: EquipmentLoan 화면 — 409 에러 메시지 처리**
```typescript
// equipmentApi.ts requestLoan() 호출부 에러 핸들링
catch (err) {
  if (err.code === 'UNIT_NOT_AVAILABLE') {
    toast.error('해당 장비는 현재 대여 중입니다. 다른 유닛을 선택하세요.');
  } else if (err.code === 'NO_STOCK') {
    toast.error('재고가 부족합니다. 반납 후 재시도하세요.');
  }
}
```

- [ ] **Step 3: `LoanAdditionalApproveCard` — 자산관리팀장 추가 승인 UI**
```typescript
// LoanAdditionalApproveCard.tsx
// PENDING_ADDITIONAL_APPROVAL 상태인 대여 목록 표시 (자산관리팀장에게만 노출)
// 승인 / 거부 버튼 — 거부 시 사유 입력 모달
export function LoanAdditionalApproveCard({ loan }: { loan: EquipmentLoan }) {
  // ...
}
```

- [ ] **Step 4: API 함수 추가**
```typescript
// assetRequestApi.ts
ownerApprove: (id: number) =>
  apiClient.post(`/asset-requests/${id}/owner-approve`),

// equipmentApi.ts
approveAdditionalLoan: (loanId: number) =>
  apiClient.post(`/equipment/loans/${loanId}/additional-approve`),
rejectAdditionalLoan: (loanId: number, reason: string) =>
  apiClient.post(`/equipment/loans/${loanId}/additional-reject`, { reason }),
```

- [ ] **Step 5: i18n 키 추가**
`ko/common.json` + `en/common.json` 에 추가:
```json
{
  "assetTier": {
    "LOW": "저가",
    "MID": "일반",
    "HIGH": "고가"
  },
  "loanStatus": {
    "PENDING_ADDITIONAL_APPROVAL": "추가 승인 대기"
  },
  "error": {
    "UNIT_NOT_AVAILABLE": "해당 장비는 현재 대여 중입니다.",
    "NO_STOCK": "재고가 부족합니다.",
    "NOT_ASSET_MANAGER_HEAD": "자산관리팀장만 승인할 수 있습니다.",
    "LOAN_LIMIT_EXCEEDED": "대여 한도({{limit}}건)를 초과했습니다."
  }
}
```

- [ ] **Step 6: type-check**
```bash
cd football && npm run type-check
```

- [ ] **Step 7: Commit**
```bash
git add football/src/
git commit -m "feat(frontend): asset tier badge + owner approval UI + loan guards error handling"
```

---

## Task 8: ADR 0017 + CONTEXT.md

**Files:**
- Create: `docs/adr/0017-asset-tier-loan-guards.md`
- Modify: `CONTEXT.md`

- [ ] **Step 1: ADR 0017 작성**
- Context: `AssetRequest` 2-stage 는 금액 불문 동일 결재 부담. Equipment loan 은 race condition 무방비. 유저별 대여 한도 없음.
- Decision:
  - `AssetTierThresholdConfig` 단일-row 테이블로 임계값 중앙 관리
  - 3-tier escalation: LOW = 팀장 only / MID = 팀장→부서장 / HIGH = 팀장→부서장→구단주+GM
  - `Club.ownerId Int?` 추가 — HIGH tier 3rd stage 승인자. null 이면 GM fallback
  - unit-tracked 장비: `$transaction` 안에서 `status='AVAILABLE'` verify → `'IN_USE'` update (409 on fail)
  - bulk 재고: aggregate count check (`APPROVED + ISSUED`) >= quantity → 409
  - 유저별 대여 한도 (`loanLimitPerUser = 5`) 초과 시 `PENDING_ADDITIONAL_APPROVAL` → 자산관리팀장 승인
  - `issueLoan` / `returnLoan` 시 `$transaction` 으로 `EquipmentUnit.status` 동기 update
- Alternatives:
  - 카테고리별 threshold (`EquipmentCategoryThreshold`) → rejected (설정 복잡도, 3.x scope)
  - 비동기 이벤트 기반 재고 sync → rejected (lag 시 재고 불일치)
  - 스폰서 물품 AssetRequest 통합 → rejected (도메인 혼재)
- Consequences (+): 저가 결재 부담 감소, 고가 통제 강화, race condition 방지, 대여 폭주 감사 가능
- Consequences (-): schema 3개 enum 확장 + 1 신규 모델 + Club 필드 추가

- [ ] **Step 2: CONTEXT.md 확장**
기존 `## 자산 신청 워크플로우 (Asset Request)` 섹션에 소절 추가:
- "AssetTierThresholdConfig (id=1 단일 row) — lowMax, midMax, loanLimitPerUser. 어드민 직접 SQL 수정."
- "3-tier escalation: LOW(≤500k)=팀장 only / MID=팀장→부서장 / HIGH(>5M)=팀장→부서장→Club.ownerId or GM"
- "EquipmentLoan: unit-tracked = $transaction status guard. bulk = aggregate count guard. 유저별 한도 초과 = PENDING_ADDITIONAL_APPROVAL"

- [ ] **Step 3: Commit**
```bash
git add docs/adr/0017-asset-tier-loan-guards.md CONTEXT.md
git commit -m "docs(adr): 0017 asset tier escalation + loan guards"
```

---

## Task 9: 스모크 테스트 + PR

- [ ] **Step 1: tsc + jest**
```bash
cd apps/api && npx tsc --noEmit && npx jest --testPathPattern="asset-request-tier|loan-guards"
cd football && npm run type-check
```

- [ ] **Step 2: E2E 시나리오**
1. LOW tier 자산 신청 (expectedAmount = 300,000) → 팀장 승인 → 즉시 APPROVED (부서장 알림 없음)
2. MID tier 자산 신청 (expectedAmount = 2,000,000) → 팀장 승인 → 부서장 승인 → APPROVED
3. HIGH tier 자산 신청 (expectedAmount = 8,000,000) → 팀장 승인 → 부서장 승인 → PENDING_OWNER_APPROVAL → 구단주 or GM 승인 → APPROVED
4. HIGH tier: GM 승인 후 구단주 추가 승인 시도 → 409 ALREADY_APPROVED_BY_PEER
5. unit-tracked 장비 동시 대여 시도 (동일 unitId) → 1개 성공, 1개 409 UNIT_NOT_AVAILABLE
6. bulk 재고 초과 대여 시도 → 409 NO_STOCK
7. 유저 A 가 이미 5건 대여 중 → 6번째 요청 → PENDING_ADDITIONAL_APPROVAL 생성 + 자산관리팀장 알림
8. 자산관리팀장 추가 승인 → ISSUED 진행
9. `returnLoan` 호출 → unit.status AVAILABLE 복원 확인

- [ ] **Step 3: PR 생성**

---

## 위험 / 안전 노트

1. **Postgres enum ALTER 는 tx 밖** — `ADD VALUE` 는 transaction 안에서 불가. migration SQL 핸들링 필수 (기존 asset-request 확장 패턴 재사용, PR #119~#125 참고).
2. **`$transaction` 안에서 count-check** — `requestLoanBulk` 에서 aggregate count 는 `$transaction` 안에서 실행하여 phantom read 방지. (Postgres default isolation = READ COMMITTED, 실사용 검토 필요)
3. **owner+GM race `firstApprove` 패턴** — `ownerApprove` 에서 `OWNER_GM_APPROVED` 기록 존재 여부를 transaction 안에서 check → upsert 방지. 기존 asset-request reviewer 경합 방지 로직 재사용.
4. **`AssetTierThresholdConfig` seed 강제** — seed row (id=1) 없으면 서비스 500. migration 과 함께 seed 필수 실행.
5. **자산관리팀장 null 대응** — 팀장 미배정 시 admin fallback. null + admin 없으면 알림 no-op (loan 은 생성됨 — 관리자 수동 대응 필요, 운영 주의).
6. **스폰서 물품 등록은 이 plan 밖** — Q3 (c) 스코프 명시. sponsor 도메인 후속 plan 에서 별도 구현. 이 plan 이 AssetRequest 에 sponsor 물품 경로 추가하지 않음.
7. **LOW tier 에서 `OperatingExpense` 자동 생성** — `leaderApprove` 에서 fire-and-forget 로 expense 생성. 실패 시 audit log 로 추적 (idempotent 재시도 별도 고려).

---

## Non-goals (Follow-up)

- **스폰서/파트너십/현물협찬 등록 자동화** — sponsor 도메인 계약 트리거. 이 plan 스코프 밖 (Q3 c).
- **Threshold config 관리 UI** — 현재 어드민 직접 SQL. 별도 어드민 설정 plan.
- **APPROVED 후 미수령 timeout auto-cancel** — cron 기반 자동 취소. 별도 plan.
- **부서별 대여 quota (per-dept aggregate)** — 팀 단위 대여 상한. 운영 수요 확인 후 별도 plan.
- **대여 이력 감사 report** — 기간별 대여/반납 집계 리포트. 별도 plan.
- **Threshold per-category (`EquipmentCategoryThreshold`)** — 카테고리별 세분화 임계값. 3.x scope.
- **부서별 owner 지정** — 현재 `Club.ownerId` 단일 필드. 멀티-클럽 또는 부서별 owner 는 별도 설계.

---

## Self-Review

**Grill decision coverage:**

| Q | 결정 요약 | Task 위치 |
|---|-----------|-----------|
| Q3 | 일반/고가 → AssetRequest 확장, 스폰서 → sponsor 도메인 분리 | Task 4 (createAssetRequest tier 판정), Non-goals |
| Q4 | 3-tier escalation (LOW skip / HIGH 3rd stage) | Task 4 Step 2~5 (`leaderApprove` / `deptHeadApprove` / `ownerApprove`) |
| Q5 | `Club.ownerId Int?` + first-approve-wins (ownerId=null → GM only) | Task 2 Step 1 (schema) / Task 4 Step 5 (`ownerApprove`) |
| Q6 | `AssetTierThresholdConfig` 단일-row, seed 초기값 강제 | Task 2 Step 2 (schema) / Task 3 Step 4 (seed) |
| Q7 | 하이브리드: unit-tracked → $transaction, bulk → aggregate count (APPROVED+ISSUED 포함) | Task 5 Step 2 (`requestLoan`) |
| Q8 | `PENDING_ADDITIONAL_APPROVAL` → 자산관리팀장 승인, null → admin escalation, 거부 → REJECTED + 알림 | Task 5 Step 3~5 / Task 6 |
| Q9 | `issueLoan`/`returnLoan` 안 $transaction 으로 EquipmentUnit.status 동기 update | Task 5 Step 4 |

**Safety:**
- Enum ALTER 는 tx 밖 처리 (Task 3 Step 2)
- $transaction on unit-race + bulk count + issueLoan + returnLoan (Task 5)
- first-approve-wins on owner+GM (Task 4 Step 5)
- Threshold config seed 강제 + null 방어 (Task 3 Step 4, Task 5 Step 1)
- 스폰서 물품 경로 완전 분리 (Non-goals)
