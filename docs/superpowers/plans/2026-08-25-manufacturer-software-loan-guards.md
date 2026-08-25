# 제조사·라이선스 발급 제약 (Manufacturer & Software Assignment Guards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 가지 자산관리 규칙을 스키마 + 서비스 계층에서 강제한다.
1. **등록된 제조사·공급업체의 장비만 대여 가능** — `EquipmentItem.partnerId` NOT NULL + `Partner.isInternal` false + `Partner.type ∈ {MANUFACTURER, EQUIPMENT_SUPPLIER}` 검증
2. **담당자(ASSET_MANAGER)가 등록한 소프트웨어만 이용 가능** — 신규 `SoftwareLicenseAssignment` 모델로 유저별 seat 발급 관리. 이용 자격은 `AssetRequest.fulfill` 또는 담당자 직접 assign(bypassReason 필수)

**Why:**
- 현재 `EquipmentItem.partnerId` nullable → 제조사 없이 장비 등록 가능 → "이 물건 어디서 왔지?" 불명. 감가상각·재구매·수리 이력 tracking 불가.
- `EquipmentLoan.create` 는 partner 검증 없음 → 자체 조달 물품·불명 장비도 대여 flow 진입 가능.
- `SoftwareLicense` 는 `totalSeats`/`usedSeats` counter 만 있고 **어느 유저에게 배정됐는지 스키마 상 알 수 없음**. Seat 초과·미사용 revoke·감사 이력 모두 X.
- `vendor` 자유 String → 담당자 등록 자산 vs 임의 유저 등록 자산 구분 불가. RBAC 강제 못 함.
- AssetRequest workflow 는 이미 있음 (Task fulfill 단계) — 그 지점에 seat 발급 hook 만 붙이면 되는데 현재 자동화 없음.

**Architecture:**
- **Equipment 측:** `EquipmentItem.partnerId Int` (NOT NULL) + backfill "자체 조달" Partner + `Partner.isInternal Boolean @default(false)`. Loan create 시점 서비스 로직에서 (`!partner.isInternal && partner.type in [MANUFACTURER, EQUIPMENT_SUPPLIER]`) 검증.
- **Software 측:** 신규 `SoftwareLicenseAssignment` (licenseId, userId, assignedById, assignedAt, revokedAt?, revokedById?, revokeReason?, assetRequestId?, bypassReason?). `SoftwareLicense.usedSeats` 필드 제거 → aggregate 계산 (단일 진실 소스).
- **Workflow 통합:** `AssetRequest.fulfill` (기존 asset-request 모듈) 이 `type=SOFTWARE` 인 경우 `SoftwareLicenseAssignment` 자동 create. 담당자 직접 assign 은 `bypassReason` 필수.
- **알림·cron:** SOFTWARE_LICENSE_ASSIGNED/REVOKED/EXPIRY_30D 3종 신규. 만료 자동 revoke cron.

**Tech Stack:** Prisma + PostgreSQL, Express, Jest, React + TypeScript.

**Related Plans / Specs:**
- `docs/superpowers/plans/2026-08-23-asset-request-workflow.md` — AssetRequest.fulfill hook 통합 지점
- CONTEXT.md `## 자산 신청 워크플로우 (Asset Request)`
- `docs/superpowers/plans/2026-07-14-partner-equipment-loan.md` — Partner & Equipment Loan 원형

---

## 🔴 Grill 결정 (2026-08-25)

**재논의 금지.**

### Q1: 소프트웨어 이용 정의
- **선택: A + C 병행** — 신규 `SoftwareLicenseAssignment` 모델(A) + AssetRequest.fulfill 자동 create(C)
- 유저는 assignment (활성 seat) 있어야 이용 자격
- `AssetRequest.fulfill` 시점에 자동 발급 (Q1-c C)

### Q1-a: SoftwareLicenseAssignment 스키마
```prisma
model SoftwareLicenseAssignment {
  id             Int              @id @default(autoincrement())
  licenseId      Int
  userId         Int
  assignedById   Int              // 담당자 (ASSET_MANAGER)
  assignedAt     DateTime         @default(now())
  revokedAt      DateTime?
  revokedById    Int?
  revokeReason   String?
  assetRequestId Int?             // AssetRequest 승인 통해 assign 됐으면 링크 (nullable = 담당자 직접)
  bypassReason   String?          // 담당자 직접 assign 시 필수 (Q4-1 C)

  license      SoftwareLicense  @relation(fields: [licenseId], references: [id])
  user         User             @relation("SwLicenseAssignee", fields: [userId], references: [id])
  assignedBy   User             @relation("SwLicenseAssigner", fields: [assignedById], references: [id])
  revokedBy    User?            @relation("SwLicenseRevoker", fields: [revokedById], references: [id])
  assetRequest AssetRequest?    @relation(fields: [assetRequestId], references: [id])

  @@unique([licenseId, userId, assignedAt])
  @@index([userId, revokedAt])
  @@index([licenseId, revokedAt])
}
```

### Q1-b: 담당자 등록 = ASSET_MANAGER 만
- **선택: (ii) + (iii)**
- `SoftwareLicense.create` API 는 ASSET_MANAGER + ADMIN + GM (`canManageSoftware`) 만
- `createdById` 는 감사용 (별도 role 제약 X)

### Q1-c: 이용 자격 획득 시점
- **선택: C** — `AssetRequest.status = FULFILLED` 시점에 SoftwareLicenseAssignment 자동 create
- APPROVED 는 "승인 완료" — 아직 seat 없음
- FULFILLED = 실제 seat 발급

### Q2-1: EquipmentItem.partnerId 필수화
- **선택: A (NOT NULL 강제) + Q2-1 후속 B (Partner.isInternal Boolean)**
- 기존 nullable 데이터: "자체 조달" 이름의 Partner (type=MANUFACTURER, isInternal=true) 를 미리 upsert 하고 NULL rows 를 이 partner 로 backfill
- 이후 NOT NULL 제약 걸기

### Q2-2: Partner.type 검증
- **선택: B (MANUFACTURER + EQUIPMENT_SUPPLIER)**
- HOSPITAL / MAINTENANCE_VENDOR 는 장비 소싱 대상 아님

### Q2-3: 검증 시점
- **선택: B (대여 시점)** — EquipmentItem.create 는 자유. EquipmentLoan.create 에서 검증.
- 에러: `ITEM_NOT_AVAILABLE_FOR_LOAN` (isInternal or 잘못된 type)

### Q3-1: Seat 초과 검증
- **선택: A (강한 차단, 400 SEAT_LIMIT_EXCEEDED)**
- Waitlist / override 없음. 감사 안전성 우선

### Q3-2: Revoke 흐름
- **선택: A + 만료 cron**
- 담당자 수동 revoke (with reason) + `SoftwareLicense.expiresAt < now()` cron 자동 revoke all

### Q3-3: usedSeats 필드 관리
- **선택: A (필드 제거, aggregate 계산)**
- `count(assignments where revokedAt IS NULL)` 로 매번 계산. 단일 진실 소스.

### Q4-1: AssetRequest bypass 여부
- **선택: C (하이브리드 + bypassReason)**
- 기본: AssetRequest workflow 통해 assign (audit 강함)
- 예외: 담당자 직접 `POST /software-licenses/:id/assign` 도 허용하되 `bypassReason` 필수 (긴급 대응·이관·이벤트 등)

### Q5-1: Frontend 페이지
- `SoftwareLicenseListPage` (담당자 전용) — 라이선스별 assignment 리스트 + assign/revoke 액션
- `MyLicensesPage` (일반 유저) — 내 활성 assignment 목록 + 대시보드 위젯
- `EquipmentItemFormDialog` — partner dropdown 을 MANUFACTURER + EQUIPMENT_SUPPLIER, `isInternal=false` 로 필터

### Q5-2: 알림 3종 신규
- `SOFTWARE_LICENSE_ASSIGNED` (수신 유저)
- `SOFTWARE_LICENSE_REVOKED` (수신 유저)
- `SOFTWARE_LICENSE_EXPIRY_30D` (수신 담당자 = ASSET_MANAGER)

### Q5-3: Cron
- `softwareLicenseExpiryCheck.ts` — 매일 새벽. `expiresAt <= now()` 인 라이선스의 all active assignments 를 revoke (revokeReason='EXPIRED'). D-30 알림.

---

## Task 1: 착수 확인 + 브랜치

- [ ] **Step 1: 기존 model 확인**
```bash
grep -B1 -A25 "^model EquipmentItem\|^model EquipmentLoan\|^model SoftwareLicense\|^model Partner\|^model AssetRequest" apps/api/prisma/schema.prisma | head -100
```
- Confirm: EquipmentItem.partnerId Int?, EquipmentLoan schema, SoftwareLicense totalSeats/usedSeats/createdById, Partner enum, AssetRequest.softwareLicenseId/equipmentItemId 있음
- 대여 관련 helpers 확인

- [ ] **Step 2: 기존 nullable partnerId 데이터 개수 확인**
```bash
psql postgresql://juno@localhost:5432/football -c 'SELECT COUNT(*) FROM "EquipmentItem" WHERE "partnerId" IS NULL;'
```
- backfill 대상 규모 확인 (0이면 skip 가능, N개면 migration 에 UPDATE 포함)

- [ ] **Step 3: 브랜치 생성**
```bash
git checkout -b feat/manufacturer-software-guards
```

---

## Task 2: Prisma schema — 3 모델 변경 + 1 신규

### Step 1: Partner 확장
```prisma
model Partner {
  ...
  isInternal Boolean @default(false)  // 신규 — 자체 조달 partner flag
  ...
}
```

### Step 2: EquipmentItem.partnerId NOT NULL
```prisma
model EquipmentItem {
  ...
  partnerId Int                       // ? 제거 → NOT NULL
  ...
  partner   Partner @relation(fields: [partnerId], references: [id])  // ? 제거
  ...
}
```

### Step 3: SoftwareLicense 필드 조정
```prisma
model SoftwareLicense {
  ...
  totalSeats Int
  // usedSeats Int @default(0)   ← 필드 제거 (Q3-3 A)
  ...
  assignments SoftwareLicenseAssignment[]  // 역참조 신규
}
```

### Step 4: SoftwareLicenseAssignment 신규
(위 Q1-a 스키마 그대로)

### Step 5: User 역참조
`User` 에:
- `swLicenseAssignments SoftwareLicenseAssignment[] @relation("SwLicenseAssignee")`
- `swLicenseAssignerRecords SoftwareLicenseAssignment[] @relation("SwLicenseAssigner")`
- `swLicenseRevokerRecords SoftwareLicenseAssignment[] @relation("SwLicenseRevoker")`

`AssetRequest` 에:
- `softwareAssignments SoftwareLicenseAssignment[]`

### Step 6: `prisma format` + `validate`

### Step 7: Commit
```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): Partner.isInternal, EquipmentItem.partnerId NOT NULL, SoftwareLicenseAssignment"
```

---

## Task 3: Migration + backfill

### Step 1: `prisma migrate dev --create-only --name manufacturer_software_guards`
- shadow-DB replay 실패 시 handcraft

### Step 2: Migration SQL 검토 + backfill 포함
기대 내용 (handcraft 시):
```sql
-- 1. Partner.isInternal
ALTER TABLE "Partner" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

-- 2. "자체 조달" internal partner upsert
INSERT INTO "Partner" (name, type, country, "isInternal", "createdAt")
VALUES ('자체 조달', 'MANUFACTURER', '한국', true, NOW())
ON CONFLICT (name) DO UPDATE SET "isInternal" = true;
-- (name unique 없으면 조건 다르게)

-- 3. Backfill EquipmentItem.partnerId NULL → "자체 조달" partner id
UPDATE "EquipmentItem"
SET "partnerId" = (SELECT id FROM "Partner" WHERE name = '자체 조달' AND "isInternal" = true LIMIT 1)
WHERE "partnerId" IS NULL;

-- 4. NOT NULL 제약
ALTER TABLE "EquipmentItem" ALTER COLUMN "partnerId" SET NOT NULL;

-- 5. SoftwareLicense.usedSeats drop
ALTER TABLE "SoftwareLicense" DROP COLUMN "usedSeats";

-- 6. SoftwareLicenseAssignment 신규 + FK + unique + index
CREATE TABLE "SoftwareLicenseAssignment" (...);
```

### Step 3: `prisma migrate reset` (로컬)
```bash
npx prisma migrate reset --force
npx prisma migrate deploy
npm run seed
```

### Step 4: Seed 조정
- `apps/api/prisma/seed.ts` 에 "자체 조달" partner + EquipmentItem partnerId 세팅 추가 (기존 null 유지된 코드 fix)

### Step 5: Commit (schema + migration + seed)

---

## Task 4: Backend — Equipment 대여 검증

### Step 1: `EquipmentService.createLoan` 확장
```typescript
async createLoan(dto: CreateEquipmentLoanDto, userId: number) {
  const item = await this.repo.findItemById(dto.equipmentItemId)
  if (!item) throw new AppError(404, "EQUIPMENT_ITEM_NOT_FOUND")
  
  const partner = await this.repo.findPartnerById(item.partnerId)  // Q2-1 A: 항상 있음
  if (partner.isInternal) throw new AppError(400, "ITEM_NOT_AVAILABLE_FOR_LOAN")  // Q2-1 후속 B
  if (partner.type !== 'MANUFACTURER' && partner.type !== 'EQUIPMENT_SUPPLIER') {
    throw new AppError(400, "INVALID_PARTNER_TYPE_FOR_LOAN")  // Q2-2 B
  }
  
  // 기존 로직: unit 상태 검증, loan create
}
```

### Step 2: Tests 확장
- 기존 loan 테스트 + 3개 신규:
  - partner.isInternal=true → 400
  - partner.type=HOSPITAL → 400
  - partner.type=MANUFACTURER + isInternal=false → 성공

### Step 3: Commit

---

## Task 5: Backend — SoftwareLicenseAssignment 모듈 신설

**Files:**
- `apps/api/src/software-license/software-license.repo.ts` — assignment CRUD 추가
- `apps/api/src/software-license/software-license.service.ts` — assign/revoke 로직
- `apps/api/src/software-license/software-license.controller.ts` — 신규 endpoint
- `apps/api/src/software-license/software-license.routes.ts` — 라우팅 + role gate

### Step 1: Repository 확장
```typescript
createAssignment(dto: {licenseId, userId, assignedById, assetRequestId?, bypassReason?})
findActiveAssignmentsByLicense(licenseId): Assignment[]
countActiveAssignments(licenseId): number
revokeAssignment(id, revokedById, reason)
findMyAssignments(userId): Assignment[]  // revokedAt IS NULL
findExpiringLicenses(daysAhead): SoftwareLicense[]
```

### Step 2: Service
```typescript
async assign(licenseId, userId, assignedById, opts: {assetRequestId?, bypassReason?}) {
  const license = await this.repo.findById(licenseId)
  if (!license) throw 404
  const active = await this.repo.countActiveAssignments(licenseId)
  if (active >= license.totalSeats) throw new AppError(400, "SEAT_LIMIT_EXCEEDED")  // Q3-1
  // Q4-1 C: assetRequestId or bypassReason 중 하나 필수
  if (!opts.assetRequestId && !opts.bypassReason) throw 400 "BYPASS_REASON_REQUIRED"
  return this.repo.createAssignment({...})
}

async revoke(assignmentId, revokedById, reason) {
  // ASSET_MANAGER + ADMIN 만
  // reason 필수
}

async listMine(userId) { return this.repo.findMyAssignments(userId) }
```

### Step 3: Controller + Routes
```
POST   /software-licenses/:id/assign     body: {userId, bypassReason?}  (담당자 직접 assign)
POST   /software-licenses/:id/revoke     body: {assignmentId, reason}   (담당자 revoke)
GET    /software-licenses/:id/assignments  (담당자 조회)
GET    /software-licenses/mine            (일반 유저 — 내 assignment)
```
role gate:
- assign/revoke/list assignments: `canManageSoftware` (ASSET_MANAGER + ADMIN + GM)
- mine: 인증만

### Step 4: Unit tests
- seat 초과 → 400
- bypassReason 없이 직접 assign → 400
- revoke 성공 + audit
- revoked 후 usedSeats aggregate = 감소

### Step 5: Commit

---

## Task 6: AssetRequest.fulfill hook (Q1-c C 반영)

- Modify: `apps/api/src/asset-request/asset-request.service.ts`

### Step 1: fulfill 로직 확장
```typescript
async fulfill(id, userId, userRole, foRole) {
  // ...existing status/role checks...
  
  if (request.type === 'SOFTWARE' && request.softwareLicenseId) {
    await this.softwareLicenseService.assign(
      request.softwareLicenseId,
      request.requesterId,
      userId,
      { assetRequestId: request.id }
    )
    // seat 초과 시 400 → fulfill 실패, 전체 status 유지
  }
  
  // 기존 HARDWARE 로직 유지
  // status → FULFILLED
}
```

### Step 2: Tests 확장
- fulfill 성공 시 assignment 자동 create
- seat 초과 시 fulfill 실패

### Step 3: Commit

---

## Task 7: 알림 + Cron

### Step 1: NotificationType 3종 신규
```prisma
enum NotificationType {
  ...
  SOFTWARE_LICENSE_ASSIGNED
  SOFTWARE_LICENSE_REVOKED
  SOFTWARE_LICENSE_EXPIRY_30D
}
```

### Step 2: Migration
```bash
npx prisma migrate dev --name software_license_notif_types
```
handcraft `ALTER TYPE ADD VALUE IF NOT EXISTS`

### Step 3: Service 통합
- `assign()` 성공 시 → `SOFTWARE_LICENSE_ASSIGNED` 알림 (수신 유저)
- `revoke()` 성공 시 → `SOFTWARE_LICENSE_REVOKED` 알림 (수신 유저)
- fire-and-forget `.catch(console.error)`

### Step 4: FE `NOTIFICATION_ROUTES` 추가
```typescript
SOFTWARE_LICENSE_ASSIGNED: '/me/licenses',
SOFTWARE_LICENSE_REVOKED: '/me/licenses',
SOFTWARE_LICENSE_EXPIRY_30D: '/admin/software-licenses',
```

### Step 5: Cron — `softwareLicenseExpiryCheck.ts`
```typescript
// 매일 새벽
// D-30 임박 라이선스 → 담당자 알림
// expiresAt <= now() → all active assignments revoke (revokeReason='EXPIRED')
```
server.ts 에 등록

### Step 6: Commit

---

## Task 8: Frontend

**Files:**
- `football/src/services/software-license.service.ts` — assignment API 추가
- `football/src/pages/admin/SoftwareLicenseListPage.tsx` — assign/revoke UI
- `football/src/pages/me/MyLicensesPage.tsx` — 내 활성 assignment
- `football/src/components/dashboard/MyLicensesWidget.tsx` — 대시보드 위젯
- Modify: `football/src/pages/equipment/EquipmentItemFormDialog.tsx` — partner dropdown filter (MANUFACTURER + EQUIPMENT_SUPPLIER, `isInternal=false`)
- Modify: `football/src/App.tsx` — 라우트 등록
- Modify: `football/src/layouts/AppShell.tsx` — nav
- Modify: `football/src/locales/{ko,en}/common.json` — 신규 라벨

주의:
- 모든 `<SelectItem label={...}>` 명시 (PR #336/#349/#350 패턴)
- Error toast 매핑: `SEAT_LIMIT_EXCEEDED`, `ITEM_NOT_AVAILABLE_FOR_LOAN`, `INVALID_PARTNER_TYPE_FOR_LOAN`, `BYPASS_REASON_REQUIRED`

### Steps
- [ ] types + service + hook
- [ ] SoftwareLicenseListPage 확장 (assignment 탭·다이얼로그)
- [ ] MyLicensesPage 신규
- [ ] Dashboard widget
- [ ] EquipmentItemFormDialog partner filter
- [ ] type-check + commit

---

## Task 9: ADR + CONTEXT.md

- ADR 0017 `docs/adr/0017-manufacturer-software-loan-guards.md`
  - Context / Decision / Alternatives / Consequences
- CONTEXT.md 확장
  - `## 자산 (Equipment / SoftwareLicense)` 섹션에 두 규칙 명시
  - `Partner.isInternal` 개념 문서화
  - SoftwareLicenseAssignment vs AssetRequest 관계 도식

---

## Task 10: 전체 스모크 + PR

- `tsc --noEmit` + jest
- E2E 시나리오:
  1. 담당자 직접 assign (bypassReason 있음) → 성공
  2. seat 초과 assign → 400
  3. AssetRequest SOFTWARE flow → executive-approve → fulfill → assignment 자동 create
  4. Revoke → 유저 알림 도착
  5. Equipment.create partner=internal → 등록은 성공
  6. EquipmentLoan.create item.partner=internal → 400
  7. EquipmentLoan.create item.partner=HOSPITAL → 400
  8. EquipmentLoan.create item.partner=MANUFACTURER(!isInternal) → 성공
- PR 생성

---

## 위험 / 안전 노트

1. **"자체 조달" Partner backfill** — 절대 중복 생성 X (`INSERT ON CONFLICT` or lookup-then-insert). 서버 프로덕션 마이그레이션 시 이 partner id 를 하드코딩 하지 말고 lookup.
2. **`usedSeats` DROP** — 필드 삭제는 destructive. Backend 서비스에서 이 필드 참조하는 곳 grep 후 aggregate 로 대체 (예: dashboard stat).
3. **AssetRequest.fulfill $transaction** — assign 실패 시 fulfill 자체 rollback (asset-request 이미 $transaction 있음, hook 안에서 tx? 전달 필요).
4. **Assignment 소프트 삭제 vs 하드 삭제** — 이 plan 은 `revokedAt` 소프트만. 하드 delete 는 감사 관점 X.
5. **Bypass audit strengthening** — `bypassReason` 은 자유 텍스트. 후속으로 categorized enum (EMERGENCY/EVENT/TRANSFER 등) 로 확장 가능.
6. **Partner.isInternal 기존 데이터** — "자체 조달" partner 외에 다른 internal partner 있으면 수동 update 필요. 이 plan 은 seed·backfill 만 커버.

---

## Non-goals (Follow-up)

- **Waitlist / override** on seat 초과 (Q3-1 B/C) — 필요 시 후속
- **유저 반납 요청 flow** (Q3-2 B) — 유저가 스스로 반납 요청 → 담당자 confirm. 별도 plan
- **Bypass reason enum 화** — 자유 텍스트 → 카테고리
- **Software 사용 로그** (UsageEvent) — 실제 소프트웨어 사용 시점 tracking. 별도 domain
- **Equipment 사용료·감가상각 자동화** — Partner.isInternal 활용한 다른 계산
- **다중 부서·다중 담당자** — 담당자 하나가 아닌 부서별 담당자 지정

---

## Self-Review

**Grill decision coverage:**
- Q1 A+C (Assignment 신설 + AssetRequest fulfill hook) ✅ Task 2 + Task 6
- Q1-a (Assignment 스키마) ✅ Task 2 Step 4
- Q1-b (ii)+(iii) (create/assign role gate) ✅ Task 5 role gate
- Q1-c C (fulfill 시점 assign) ✅ Task 6
- Q2-1 A + 후속 B (partnerId NOT NULL + isInternal) ✅ Task 2 + Task 3 backfill
- Q2-2 B (MANUFACTURER + EQUIPMENT_SUPPLIER) ✅ Task 4
- Q2-3 B (대여 시점 검증) ✅ Task 4
- Q3-1 A (seat 초과 400) ✅ Task 5
- Q3-2 A + cron (revoke 담당자 + 만료 자동) ✅ Task 5 + Task 7
- Q3-3 A (usedSeats aggregate) ✅ Task 2 Step 3 + Task 5
- Q4-1 C (bypass 하이브리드) ✅ Task 5 assign()
- Q5-1 (FE 3 페이지) ✅ Task 8
- Q5-2 (알림 3종) ✅ Task 7
- Q5-3 (Cron) ✅ Task 7

**Safety:**
- Backfill safe (upsert + lookup)
- Migration reversible (assignment 신규만, DROP COLUMN 은 신중)
- Self-approval 개념 없음 (담당자가 자신에게 seat assign 하는 것 자체는 문제 X, 다만 감사 log)
- Notification fire-and-forget
- Cron 은 별도 실패 처리 (한 라이선스 실패해도 나머지 진행)
