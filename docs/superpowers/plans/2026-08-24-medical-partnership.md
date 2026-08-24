# 협력병원 + 스폰서 이중 파트너십 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스포츠 팀이 협력병원과 맺는 이중 파트너십 (진료 협력 + 스폰서십) 을 하나의 계약 단위로 관리한다. 현금 후원과 in-kind 의료지원을 분리 track 하고, 마케팅→메디컬 디렉터→대표이사 3-stage 결재를 거쳐 승인 시 자동으로 현금 스폰서십 회차 결제 스케줄을 만들고 월별 의료지원 정산 row 를 pre-create 한다.

**Why:**
- 현재 병원은 `Partner(type=HOSPITAL)` 로 등록되고 `Injury.partnerId` 로 참조되지만, **구단과의 계약 관계 자체를 표현하는 모델이 없음.**
- `Sponsorship` 은 킷/타이틀/디지털 후원 중심. 병원 특화 필드 (전문영역, 독점 수준, 의료지원 한도) 없음.
- 두 개념 (진료 협력 + 스폰서) 을 각각 별도 모델로 관리하면 한 계약이 두 model 에 걸쳐 지옥 UX.
- 의료지원 (in-kind) 은 현금 후원과 회계·감사 요구가 달라서 통합 처리 안 됨.
- 광고 권리 (LED, SNS, 홈페이지 등) 를 실제 소진 (SponsorshipExposureEvent) 과 매칭할 계약 조건 저장소 없음.

**Architecture:**
- 신규 도메인 `medical-partnership` 모듈: `MedicalPartnership` (계약) + `MedicalPartnershipApproval` (감사) + `MedicalPartnershipAdRight` (광고 권리) + `MedicalSupportSettlement` (월별 의료지원 정산).
- 병원 identity 는 `Partner` 재사용. 계약 관계는 `MedicalPartnership.partnerId + clubId` M:N.
- 현금 후원 → 승인 시 `Sponsorship` 자동 create, `SponsorshipPayment` 기존 회차 생성 로직 재사용.
- 의료지원 → 별도 `MedicalSupportSettlement` 월별 row (계약 승인 시 12개월 pre-create).
- 3-stage 결재 (마케팅 → 메디컬 디렉터 → 대표이사) 는 `asset-request` 의 2-stage 패턴 확장.
- 만료 처리 → 기존 `Contract` 만료 cron 패턴 재사용.

**Tech Stack:** Prisma + PostgreSQL, Express, Jest (unit test), React + TypeScript.

**Related Plans / Specs:**
- `docs/superpowers/plans/2026-08-03-sponsorship.md` — Sponsorship 원 도메인 (완료)
- `docs/superpowers/plans/2026-08-23-asset-request-workflow.md` — 3-stage 결재 패턴 참고
- CONTEXT.md `## 스폰서십 관리`, `## 의료비 관리` (existing)
- ADR 0013 (`docs/adr/0013-asset-request-department-approval.md`) — 결재 흐름 패턴 참조

---

## 🔴 Grill 결정 (2026-08-24)

**재논의 금지.** 아래 결정에 의문 시 grill 세션 재개.

### Q1: 도메인 위치
- **선택: A (새 model `MedicalPartnership`)** — Partner 확장 X, Sponsorship 확장 X. 관계·후원·의료지원·광고권리·정산을 담을 전용 모델.

### Q2: `MedicalPartnership` ↔ Partner ↔ Club 관계
- **선택: A (partnerId required, 1:many) + M:N via clubId**
- `partnerId Int` required (기존 Partner 재사용)
- `clubId Int` required (Q2-a M:N 확장) — 한 병원이 여러 구단, 한 구단이 여러 병원과 계약 가능
- `@@unique([partnerId, clubId, startDate])` 재계약 이력 지원

### Q2-a: 식별자 (HOSP-###, MED-YYYY-###)
- **HOSP-###**: `Partner.code String? @unique` 신규 필드 (모든 Partner 타입 재사용 가능)
- **MED-YYYY-###**: `MedicalPartnership.contractCode String @unique`
  - 자동 default (year + max(seq)+1 in retry loop) + 수동 override 허용

### Q3: 파트너 유형
- **선택: A + nullable (Y 해석)**
- enum `MedicalPartnershipRole { MEDICAL_ONLY, BOTH }`
- nullable = **명시적 미분류** (draft/이관/협상 초기)
- **SPONSOR_ONLY case 는 이 테이블 안 씀** → 기존 `Sponsorship` model 에만 row 생성 (병원 Partner 참조 없이 가능)

### Q4: 전문영역
- **선택: B (enum 배열)** + 10개 값
- `specialties MedicalSpecialty[]`
  - `ORTHOPEDICS`, `SPORTS_REHAB`, `PHYSICAL_THERAPY`, `GENERAL_MEDICINE`, `EMERGENCY`, `RADIOLOGY`, `DENTAL`, `MENTAL_HEALTH`, `NUTRITION`, `OTHER`
- empty default 허용 (draft), submit·approve 시점 서비스 로직에서 `length >= 1` 검증

### Q5: 독점 수준
- **Q5-1: 3-value enum `ExclusivityLevel { NONE, SPECIALTY, FULL }`, default NONE**
- **Q5-2: B — 서비스 레벨 검증** — 새 파트너십 승인 시, 기존 SPECIALTY/FULL 계약과 (같은 clubId, 겹치는 기간, 겹치는 specialty) 조합 있으면 400 `EXCLUSIVITY_CONFLICT`
- **Q5-3: A — specialties 배열 전체가 독점 대상** (별도 exclusiveSpecialties 필드 없음)

### Q6: 후원 트랙 (현금 + 의료지원)
- **Q6-1: A (필드 2쌍 inline)** — `cashAmount BigInt @default(0)` + `medicalSupportLimit BigInt @default(0)`
- **Q6-2: `medicalSupportUsed` 저장 X** — MedicalExpense aggregate 로 계산
- **Q6-3: A (Sponsorship 재사용)** — cashAmount > 0 시 승인 시점에 Sponsorship 자동 create, `sponsorshipId Int? @unique` 로 역참조
- **Q6-4: `MedicalExpense.medicalPartnershipId Int?` FK 추가** — 진료비가 어느 파트너십 의료지원에서 차감되는지 tag

### Q7: 광고 권리 (entitlement)
- **선택: C (sub-table `MedicalPartnershipAdRight`)**
- `(partnershipId, channel: ExposureChannel, quantity Int?, description String?)`
- `quantity IS NULL` = 무제한/상시
- 기존 `ExposureChannel { TV, SNS, STADIUM, PRINT, DIGITAL, OTHER }` 재사용 — LED 는 STADIUM + description 에 상세

### Q8: 3-stage 결재
- **Q8-1: A (순차)**
- **Q8-2: 마케팅 → 메디컬 디렉터 → 대표이사**
- 역할 매핑:
  - 마케팅: `frontOfficeRole = 'MARKETING'` (기존 enum) 또는 ADMIN
  - 메디컬 디렉터: `coachingRole = 'MEDICAL_DIRECTOR'` (기존 enum) 또는 ADMIN
  - 대표이사: `role = 'ADMIN'` (전용 CEO enum 없음)
- 각 stage self-approval 차단 (createdBy != reviewer)
- `@@unique([partnershipId, stage])` — asset-request 교훈 반영 (한 stage 한 결정)

### Q9: 월별 정산
- **Q9-1: C — 의료지원만 신규 `MedicalSupportSettlement`, 현금은 SponsorshipPayment 재사용**
- **Q9-2:** `@@unique([partnershipId, year, month])`, `SettlementStatus` (기존 enum: DRAFT/PENDING_FIRST/FIRST_APPROVED/APPROVED/REJECTED) 재사용
- **Q9-3: D + A 병행** — 계약 승인 시 12개월치 row pre-create (all DRAFT) + 월 종료 cron 이 DRAFT → PENDING_FIRST 자동 전환

### Q10: 만료 / 재계약
- **Q10-1: A** — cron 이 endDate 지난 APPROVED 를 자동 TERMINATED (기존 Contract 만료 cron 재사용/확장)
- **Q10-2:** 만료 임박 알림 D-90/D-30/D-7, 수신자 = 마케팅 + 메디컬 디렉터
- **Q10-3: A** — 조기 해지는 별도 `terminate(id, reason)` API + reason 필수 + audit log
- **Q10-4: B** — 재계약은 `duplicateFrom(oldPartnershipId)` API 로 필드 복사 → DRAFT 신규 row

---

## Task 1: 착수 확인 + 브랜치

- [ ] **Step 1: 관련 도메인 재확인**
```bash
grep -n "^model Partner\b\|^model Sponsorship\b\|^model MedicalExpense\b" apps/api/prisma/schema.prisma
```
확인 사항: 위 3개 모델 필드 최신 상태, ExposureChannel/SettlementStatus/PartnerType enum 최신값

- [ ] **Step 2: 3-stage 결재 role 매핑 검증**
```bash
grep -n "frontOfficeRole.*MARKETING\|coachingRole.*MEDICAL_DIRECTOR\|role.*ADMIN" apps/api/src/lib/permissions.ts
```
`hasPermission`, `isAdminLike` 등 helper 재사용 가능한지 확인.

- [ ] **Step 3: 브랜치 생성**
```bash
git checkout -b feat/medical-partnership
```

---

## Task 2: Prisma schema — 신규 enums + 3 신규 모델 + 2 기존 모델 확장

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: 신규 enums 추가** (grill Q3/Q4/Q5/Q8)
```prisma
enum MedicalPartnershipRole { MEDICAL_ONLY, BOTH }

enum ExclusivityLevel { NONE, SPECIALTY, FULL }

enum MedicalSpecialty {
  ORTHOPEDICS
  SPORTS_REHAB
  PHYSICAL_THERAPY
  GENERAL_MEDICINE
  EMERGENCY
  RADIOLOGY
  DENTAL
  MENTAL_HEALTH
  NUTRITION
  OTHER
}

enum MedicalPartnershipStatus {
  DRAFT
  SUBMITTED
  MARKETING_APPROVED
  MEDICAL_APPROVED
  APPROVED
  REJECTED
  CANCELLED
  TERMINATED
}

enum MedicalPartnershipApprovalStage { MARKETING, MEDICAL, EXECUTIVE }
enum MedicalPartnershipApprovalAction { APPROVED, REJECTED }
```

- [ ] **Step 2: `MedicalPartnership` model** (grill Q2, Q6)
```prisma
model MedicalPartnership {
  id                    Int @id @default(autoincrement())
  partnerId             Int
  clubId                Int
  contractCode          String  @unique
  role                  MedicalPartnershipRole?
  specialties           MedicalSpecialty[]
  exclusivityLevel      ExclusivityLevel @default(NONE)
  startDate             DateTime
  endDate               DateTime
  cashAmount            BigInt  @default(0)
  medicalSupportLimit   BigInt  @default(0)
  status                MedicalPartnershipStatus @default(DRAFT)
  sponsorshipId         Int?    @unique
  createdById           Int
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  partner       Partner      @relation(fields: [partnerId], references: [id])
  club          Club         @relation(fields: [clubId], references: [id])
  sponsorship   Sponsorship? @relation(fields: [sponsorshipId], references: [id])
  createdBy     User         @relation("MedicalPartnershipCreator", fields: [createdById], references: [id])
  approvals     MedicalPartnershipApproval[]
  adRights      MedicalPartnershipAdRight[]
  settlements   MedicalSupportSettlement[]
  medicalExpenses MedicalExpense[]

  @@unique([partnerId, clubId, startDate])
  @@index([clubId, status])
  @@index([status, endDate])
}
```

- [ ] **Step 3: `MedicalPartnershipApproval` model** (grill Q8)
```prisma
model MedicalPartnershipApproval {
  id             Int @id @default(autoincrement())
  partnershipId  Int
  stage          MedicalPartnershipApprovalStage
  action         MedicalPartnershipApprovalAction
  reviewerId     Int
  reason         String?
  createdAt      DateTime @default(now())

  partnership    MedicalPartnership @relation(fields: [partnershipId], references: [id], onDelete: Cascade)
  reviewer       User               @relation("MedicalPartnershipReviewer", fields: [reviewerId], references: [id])

  @@unique([partnershipId, stage])   // Q8-3 (asset-request 교훈)
  @@index([partnershipId, stage])
}
```

- [ ] **Step 4: `MedicalPartnershipAdRight` model** (grill Q7)
```prisma
model MedicalPartnershipAdRight {
  id             Int @id @default(autoincrement())
  partnershipId  Int
  channel        ExposureChannel   // 기존 enum 재사용
  quantity       Int?              // null = 무제한
  description    String?

  partnership    MedicalPartnership @relation(fields: [partnershipId], references: [id], onDelete: Cascade)

  @@index([partnershipId])
}
```

- [ ] **Step 5: `MedicalSupportSettlement` model** (grill Q9)
```prisma
model MedicalSupportSettlement {
  id               Int @id @default(autoincrement())
  partnershipId    Int
  year             Int
  month            Int
  usedAmount       BigInt  @default(0)
  submittedAmount  BigInt?
  status           SettlementStatus @default(DRAFT)
  approvedById     Int?
  approvedAt       DateTime?
  rejectionReason  String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  partnership      MedicalPartnership @relation(fields: [partnershipId], references: [id], onDelete: Cascade)
  approvedBy       User?              @relation("MedicalSupportApprover", fields: [approvedById], references: [id])

  @@unique([partnershipId, year, month])
  @@index([partnershipId, status])
}
```

- [ ] **Step 6: 기존 모델 확장** (Q2-a-1, Q6-4)
- `Partner`: `code String? @unique` 신규 + 역참조 `medicalPartnerships MedicalPartnership[]`
- `MedicalExpense`: `medicalPartnershipId Int?` 신규 + 관계 `medicalPartnership MedicalPartnership? @relation(...)`
- `Sponsorship`: 역참조 `medicalPartnership MedicalPartnership?`
- `User`: 역참조 3개 (`MedicalPartnershipCreator`, `MedicalPartnershipReviewer`, `MedicalSupportApprover`)
- `Club`: 역참조 `medicalPartnerships MedicalPartnership[]`

- [ ] **Step 7: `npx prisma format` + `validate`**
```bash
cd apps/api && npx prisma format && npx prisma validate
```

- [ ] **Step 8: Commit (schema 만)**
```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add MedicalPartnership + 3 sub-tables, Partner.code, MedicalExpense.medicalPartnershipId"
```

---

## Task 3: Migration 파일 생성 + scratch DB 검증

- [ ] **Step 1: Auto-generate migration**
```bash
cd apps/api
npx prisma migrate dev --create-only --name medical_partnership
```

- [ ] **Step 2: SQL 검토** — 4 신규 enum, 4 신규 CREATE TABLE, ALTER TABLE (Partner, MedicalExpense), FK 및 unique index

- [ ] **Step 3: `prisma migrate reset` (로컬)**
```bash
npx prisma migrate reset --force --skip-seed
npx prisma migrate deploy
npm run seed
```

- [ ] **Step 4: Commit migration**
```bash
git add apps/api/prisma/migrations/*_medical_partnership/
git commit -m "feat(migration): add MedicalPartnership tables + Partner.code + MedicalExpense.medicalPartnershipId"
```

---

## Task 4: 백엔드 모듈 신설 (repo + service + controller + routes + tests)

**Files:**
- Create: `apps/api/src/medical-partnership/medical-partnership.repo.ts`
- Create: `apps/api/src/medical-partnership/medical-partnership.service.ts`
- Create: `apps/api/src/medical-partnership/medical-partnership.controller.ts`
- Create: `apps/api/src/medical-partnership/medical-partnership.routes.ts`
- Create: `apps/api/src/medical-partnership/dto/medical-partnership.dto.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.service.ts` (자동 create 대응)
- Modify: `apps/api/src/apiRouter.ts` (등록)

기존 `asset-request` 및 `sponsorship` 모듈 스타일 답습.

- [ ] **Step 1: DTOs**
```typescript
export interface CreateMedicalPartnershipDto {
  partnerId: number;
  clubId: number;
  contractCode?: string;      // 없으면 auto
  role?: 'MEDICAL_ONLY' | 'BOTH';
  specialties: MedicalSpecialty[];
  exclusivityLevel?: 'NONE' | 'SPECIALTY' | 'FULL';
  startDate: string;
  endDate: string;
  cashAmount?: number;
  medicalSupportLimit?: number;
  adRights?: Array<{ channel: string; quantity?: number; description?: string }>;
}
export interface RejectDto { reason: string; }
export interface TerminateDto { reason: string; }
```

- [ ] **Step 2: Repository**
- `create(dto, requesterId)`, `findById(id)` (relations: partner, club, approvals+reviewer, adRights, settlements, sponsorship)
- `findByClub(clubId, status?)`, `findByPartner(partnerId)`
- `findExpiring(daysAhead)` — Q10 만료 임박 조회
- `findExpiredActive()` — Q10 cron 이 TERMINATED 로 전환할 대상
- `findOverlappingExclusive(clubId, specialties, startDate, endDate)` — Q5-2 검증용
- `updateStatus(id, patch, tx?)` — asset-request 패턴 `tx?` 옵셔널
- `addApproval(id, dto, tx?)`
- `createAdRights(id, dtos, tx?)`
- `bulkCreateSettlements(id, monthsArr, tx?)` — Q9-3 12개월 pre-create
- `getNextContractSeq(year)` — Q2-a-3 max+1

- [ ] **Step 3: Service — 승인 로직**
- `create(dto, requesterId)`:
  - `partnerId` 존재 확인, `partner.type` HOSPITAL 검증
  - `contractCode` 자동 생성 (없으면) `MED-{startYear}-{lpad(seq,3)}` retry loop
  - hybrid role 검증 (nullable OK, but if provided must be enum)
  - startDate < endDate, dates 형식
  - status DRAFT

- `submit(id, userId)`:
  - createdBy === userId
  - specialties.length >= 1 검증 (Q4-3)
  - status DRAFT → SUBMITTED

- `marketingApprove(id, reviewerId, role, foRole)`:
  - status SUBMITTED
  - `isAdminLike(role) || foRole === 'MARKETING'`
  - self-approval 차단
  - status → MARKETING_APPROVED + approval row

- `medicalApprove(id, reviewerId, role, coachingRole)`:
  - status MARKETING_APPROVED
  - `isAdminLike(role) || coachingRole === 'MEDICAL_DIRECTOR'`
  - self-approval 차단
  - status → MEDICAL_APPROVED + approval row

- `executiveApprove(id, reviewerId, role)` — **최종 결재 + 부작용**:
  - status MEDICAL_APPROVED
  - `role === 'ADMIN'`
  - self-approval 차단
  - **`prisma.$transaction`** 안에서:
    1. Q5-2: `findOverlappingExclusive` — 겹치면 400 `EXCLUSIVITY_CONFLICT`
    2. Q6-3: `cashAmount > 0` → `sponsorshipService.createAutoForMedicalPartnership` 호출 → 반환된 `sponsorshipId` 저장
    3. Q9-3: 12개월분 `MedicalSupportSettlement` bulk create (all DRAFT)
    4. status → APPROVED + approval row
  - notif fire-and-forget (마케팅+메디컬 디렉터+대표이사 각자에게 최종 승인 알림)

- `reject(id, reviewerId, reason, stage)` — 어느 stage 든 반려:
  - reviewer 권한 = 해당 stage 권한
  - reason 필수
  - status → REJECTED + approval row (action=REJECTED)

- `cancel(id, userId)`: createdBy 만, status ∈ {DRAFT, SUBMITTED, MARKETING_APPROVED, MEDICAL_APPROVED}

- `terminate(id, userId, reason, role)`: ADMIN 또는 createdBy, reason 필수, status APPROVED → TERMINATED (Q10-3)

- `duplicateFrom(oldId, userId)`: Q10-4 재계약 draft — 필드 복사 + startDate/endDate/contractCode 는 새로 지정

- `submitSettlement(settlementId, userId, submittedAmount)`: PENDING_FIRST 로 전환
- `approveSettlement(settlementId, userId, role, foRole)`: FINANCE_APPROVE 권한 (`canApprovePlan` 아님, 별도)
- `rejectSettlement(settlementId, userId, reason)`

- [ ] **Step 4: Controller** — asset-request 패턴 재사용, 모든 handler `requireUser` + role/foRole/coachingRole 전달

- [ ] **Step 5: Routes**
```
POST   /medical-partnerships                          (create)
GET    /medical-partnerships?clubId=&status=&filter=  (list)
GET    /medical-partnerships/:id
PATCH  /medical-partnerships/:id/submit
PATCH  /medical-partnerships/:id/marketing-approve
PATCH  /medical-partnerships/:id/medical-approve
PATCH  /medical-partnerships/:id/executive-approve
PATCH  /medical-partnerships/:id/reject                (body: {stage, reason})
PATCH  /medical-partnerships/:id/cancel
PATCH  /medical-partnerships/:id/terminate             (body: {reason})
POST   /medical-partnerships/:id/duplicate             (재계약 draft)
POST   /medical-partnerships/:id/ad-rights             (bulk update)

GET    /medical-partnerships/:id/settlements
PATCH  /medical-partnerships/settlements/:sid/submit
PATCH  /medical-partnerships/settlements/:sid/approve
PATCH  /medical-partnerships/settlements/:sid/reject   (body: {reason})
```
등록: `apiRouter.use('/medical-partnerships', medicalPartnershipRouter)`

- [ ] **Step 6: Unit tests** — 각 stage 승인 성공·자기 승인 차단·overlapping exclusivity 검출·BUDGET/limit·재계약·조기 해지·정산 승인

- [ ] **Step 7: Commit**

---

## Task 5: 알림 + Cron jobs

- [ ] **Step 1: NotificationType enum 확장** — 신규 값
  - `MEDICAL_PARTNERSHIP_SUBMITTED` (수신 마케팅)
  - `MEDICAL_PARTNERSHIP_MARKETING_APPROVED` (수신 메디컬 디렉터)
  - `MEDICAL_PARTNERSHIP_MEDICAL_APPROVED` (수신 대표이사)
  - `MEDICAL_PARTNERSHIP_APPROVED` (수신 신청자 + 3인)
  - `MEDICAL_PARTNERSHIP_REJECTED` (수신 신청자)
  - `MEDICAL_PARTNERSHIP_TERMINATED` (수신 마케팅 + 메디컬 디렉터)
  - `MEDICAL_PARTNERSHIP_EXPIRY_90D` / `_30D` / `_7D` (수신 마케팅 + 메디컬 디렉터)
  - `MEDICAL_SUPPORT_SETTLEMENT_PENDING` (수신 재무팀)
  - `MEDICAL_SUPPORT_SETTLEMENT_APPROVED` / `_REJECTED` (수신 담당자)

- [ ] **Step 2: Migration**
```bash
cd apps/api && npx prisma migrate dev --name medical_partnership_notification_types
```
(shadow-DB fail 시 handcraft `ALTER TYPE ADD VALUE IF NOT EXISTS`)

- [ ] **Step 3: Cron jobs** — `apps/api/src/jobs/`
- `medicalPartnershipExpiryCheck.ts` — 매일 새벽. endDate 지난 APPROVED → TERMINATED. 90/30/7일 전 알림.
- `medicalSupportSettlementCron.ts` — 매월 1일 새벽. 전월 DRAFT → PENDING_FIRST 자동 전환 + 재무팀 알림.
- 서버 부팅 시 `apps/api/src/server.ts` 에 등록.

- [ ] **Step 4: Commit**

---

## Task 6: Frontend

**Files:**
- Create: `football/src/types/medical-partnership.ts`
- Create: `football/src/services/medical-partnership.service.ts`
- Create: `football/src/hooks/useMedicalPartnerships.ts`
- Create: `football/src/pages/medical-partnership/MedicalPartnershipPage.tsx` (목록·생성·상세)
- Create: `football/src/pages/medical-partnership/MedicalPartnershipApprovalPage.tsx` (3-stage 결재함)
- Create: `football/src/pages/medical-partnership/MedicalSupportSettlementPage.tsx` (월별 정산)
- Modify: `football/src/App.tsx` (routes)
- Modify: `football/src/layouts/AppShell.tsx` (nav 3항목: 목록 / 결재함 / 정산)
- Modify: `football/src/locales/{ko,en}/common.json`

주의사항 (기존 세션 반영):
- 모든 `<SelectItem>` 에 `label={...}` 명시 (PR #336 fix)
- Error toast 에서 backend `code` 매핑 (PR #329 fix): `EXCLUSIVITY_CONFLICT`, `BUDGET_EXCEEDED`, `NOT_MARKETING`, `NOT_MEDICAL_DIRECTOR`, `NOT_EXECUTIVE`, `SELF_APPROVAL_FORBIDDEN` 등

- [ ] **Step 1: types + service + hook**
- [ ] **Step 2: 목록·생성·상세 페이지** — 생성 폼은 계약 조건 + 광고 권리 배열 + 후원 금액
- [ ] **Step 3: 3-stage 결재함** — Tabs (마케팅 / 메디컬 디렉터 / 대표이사) + 반려 dialog
- [ ] **Step 4: 정산 페이지** — 파트너십별 12개월 grid + 상태별 색상 + 승인/반려 버튼
- [ ] **Step 5: nav 3항목**
- [ ] **Step 6: type-check + commit**

---

## Task 7: ADR + CONTEXT.md

**Files:**
- Create: `docs/adr/0014-medical-partnership-dual-role.md`
- Modify: `CONTEXT.md`

- [ ] **Step 1: ADR 0014**
- Context: 병원은 진료 협력 + 후원 스폰서 이중 역할이 흔한데 기존 Partner/Sponsorship 분리 모델로는 관리 어려움
- Decision: 신규 `MedicalPartnership` 모델 + 3-stage 결재 + 현금은 Sponsorship 자동 create + 의료지원 별도 tracking
- Alternatives: Sponsorship 확장 (rejected), Partner 확장 (rejected)
- Consequences (+): 이중 역할 표현, 재계약 이력, 광고 소진 매칭 / (-): sponsorship+medical_partnership 이중 조회, cron job 2종 추가

- [ ] **Step 2: CONTEXT.md 신규 섹션** `## 협력병원 파트너십 (Medical Partnership)`
- 상태머신, 3-stage 결재 역할 매핑, 현금 vs 의료지원 처리, 월별 정산 흐름, 만료·재계약 도식

- [ ] **Step 3: Commit**

---

## Task 8: 전체 스모크 + PR

- [ ] **Step 1: tsc + jest**
```bash
cd apps/api && npx tsc --noEmit && npx jest --testPathPattern="medical-partnership"
cd football && npm run type-check
```

- [ ] **Step 2: E2E 시나리오**
1. 마케팅 유저가 계약 생성 → SUBMITTED
2. 마케팅 → MARKETING_APPROVED
3. 메디컬 디렉터 → MEDICAL_APPROVED
4. 대표이사(ADMIN) → APPROVED
   - Sponsorship + 12개월 회차 결제 자동 create 확인
   - 12개월 MedicalSupportSettlement DRAFT 자동 create 확인
5. self-approval 시나리오: 신청자 == 대표이사 인 경우 403
6. exclusivity 시나리오: 같은 clubId+specialty 로 SPECIALTY 계약 이미 있는데 새 계약 executive-approve → 400
7. 조기 해지: terminate(reason) → TERMINATED
8. 재계약: duplicate → 새 draft
9. 정산: 병원이 매월 청구 → submit → 재무팀 approve → aggregate 반영

- [ ] **Step 3: PR 생성**
```bash
git push -u origin feat/medical-partnership
gh pr create --title "feat(medical-partnership): 협력병원 이중 파트너십 (진료+스폰서) 3-stage 승인 흐름" --body ...
```

---

## 위험 / 안전 노트

1. **자기 승인 차단 필수** — 신청자가 마케팅·메디컬 디렉터·대표이사 겸직 케이스 (작은 팀에서 흔함) 각 stage 별 명시 검증. asset-request 교훈.
2. **exclusivity 검증은 3-stage 마지막 (executive-approve)** 에만 — 앞 stage 는 통과 가능. 마지막 승인권자에게 명시 에러.
3. **12개월 pre-create + 자동 상태 전환** — 계약 취소 시 cascade 반영 (이미 승인된 settlement 는 어떻게? → APPROVED 상태 pending settlement 는 조기 해지 warning 필수).
4. **`MedicalPartnership.sponsorshipId` unique** — 한 파트너십당 최대 1개 Sponsorship. 재계약 시 새 파트너십 = 새 sponsorship (독립).
5. **Postgres enum ALTER 는 transaction 안에서 불가** — `ALTER TYPE ADD VALUE` 는 별도 statement (기존 asset-request notification 마이그레이션 패턴 재사용).
6. **Multi-club** — 현재 시스템은 clubId 필터 UI 정착 안 됐을 수 있음. Task 6 에서 활성 클럽 자동 감지 필요 (`useCurrentUser().clubId`).

---

## Non-goals (Follow-up)

- **SPONSOR_ONLY 병원** (Q3 논의) — 이 plan 안 다룸. 기존 Sponsorship 만 사용.
- **부분 독점** (Q5-3 B) — 배열 subset 별 독점권 지정 (지금은 전체 배열이 독점).
- **의료지원 3번째 track** (Q6-1 B sub-table 확장) — 필요 시 후속.
- **재계약 자동 draft** (Q10-4 C) — 만료 30일 전 자동 draft. 지금은 수동 duplicate.
- **광고 실적 대비 계약 소진율 대시보드** — SponsorshipExposureEvent 와 AdRight 매칭 view. 별도 PR.
- **정산 승인 이의 제기 흐름** — 병원이 재무팀 반려에 이의 제기하는 UI. Non-goal.

---

## Self-Review

**Grill decision coverage:**
- Q1 (도메인 위치) ✅ Task 2 신규 모델
- Q2 (관계) ✅ Task 2 Step 2 (partnerId + clubId + @@unique)
- Q2-a (식별자) ✅ Task 2 Step 6 (Partner.code) + Task 4 Step 3 (contractCode auto+retry)
- Q3 (role nullable) ✅ Task 2 Step 1 (enum) + Step 2 (nullable field)
- Q4 (specialties enum 배열) ✅ Task 2 Step 1 + 2 + Task 4 Step 3 (submit 시 length 검증)
- Q5 (독점) ✅ Task 2 (enum + field) + Task 4 Step 3 (executive-approve 시 overlap 검증)
- Q6 (후원 트랙) ✅ Task 2 (필드 2쌍) + Task 4 Step 3 (Sponsorship 자동 create) + MedicalExpense.medicalPartnershipId
- Q7 (광고 권리) ✅ Task 2 Step 4 (sub-table)
- Q8 (3-stage 결재) ✅ Task 2 Step 3 (Approval model) + Task 4 Step 3 (각 stage)
- Q9 (월별 정산) ✅ Task 2 Step 5 (settlement model) + Task 4 Step 3 (12개월 pre-create) + Task 5 (cron)
- Q10 (만료/재계약) ✅ Task 4 Step 3 (terminate/duplicate) + Task 5 (expiry cron)

**Safety:**
- Scratch DB reset (Task 3) — 로컬만
- Self-approval 3-stage 각각 (Task 4 Step 3)
- Executive-approve `$transaction` 로 부작용 atomic (asset-request 교훈)
- Notification fire-and-forget (`.catch(console.error)`, asset-request 교훈)
- Migration debt (#21) 서버 배포 전 조율 필요
