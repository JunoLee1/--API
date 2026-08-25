# SW 설치 컴플라이언스 (Software Installation Compliance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유저 self-report 기반 SW 설치 관리 시스템. 인가 whitelist (`SoftwareLicense`) 대조 + 블랙리스트 (`SoftwareBlacklist`) 매칭 → 미인가/악성 SW 감지 시 유저 3-way choice (즉시 삭제 / 승인 요청 / 유예) 워크플로우. Compliance flag + 팀장 통보로 강제 조치. Workflow 3 (미인가) + Workflow 4 (블랙리스트) 를 `SoftwareInstallation.riskLevel` 로 통합.

**Why:**
- 축구단 IT 자산 컴플라이언스 관리 부재. SW 감사 프로세스 자동화 필요.
- MDM/EDR 통합은 벤더·계약 스코프 폭발 → 우선 self-report + 정기 감사로 시작.
- `SoftwareLicense` CRUD 는 이미 있음 (`apps/api/src/software-license/`). 실제 유저별 install tracking + 컴플라이언스 판정은 신규.
- Workflow 4 (블랙리스트) 는 severity 다르지만 mechanism 유사 → 통합 모델로 유지보수 부담 최소화.

**Architecture:**
- **신규 모델 3개:**
  - `SoftwareInstallation` — 유저별 install record + state machine + 승인 lifecycle
  - `SoftwareBlacklist` — 관리자가 등록한 블랙리스트 (name, version?, reason)
  - `SoftwareBlacklistException` — 특별 승인된 예외 (expiresAt 필수)
- **State machine (5-state):** `DETECTED` → `PENDING_USER_ACTION` → `AWAITING_REVIEW` → `GRACE_PERIOD` → `RESOLVED` (resolution: `AUTHORIZED_ON_DETECTION` / `USER_DELETED` / `AUTHORIZED` / `FORCE_REMOVED`)
- **riskLevel enum:** `NORMAL` (인가) / `UNAUTHORIZED` (미인가, Workflow 3) / `BLACKLISTED` (Workflow 4)
- **매칭:** 등록 시 서비스가 case-insensitive exact match 로 `SoftwareLicense` + `SoftwareBlacklist` 대조
- **승인자:**
  - 미인가 (`UNAUTHORIZED`): IT 자산관리팀장 (`Department` name=`IT 자산관리` headId). null → 자산관리팀장 → admin
  - 블랙리스트 (`BLACKLISTED`): 보안팀장 (`Department` name=`보안팀` headId — seed 필요). null → admin
- **`User.complianceFlag`: `NORMAL` / `WARNING` / `CRITICAL`** — 컴플라이언스 위반 상태 tracking
  - `WARNING`: 미인가 SW 로 인한 grace period 만료
  - `CRITICAL`: 블랙리스트 SW 로 인한 grace period 만료
  - Gate: 자산 대여, 라이선스 신청 등 특정 액션 제한 (기존 pattern 재사용)

**Tech Stack:** Prisma + PostgreSQL, Express, Jest, React + TypeScript.

**Related Plans / Specs:**
- `docs/superpowers/plans/2026-08-24-team-member-crud.md` — `Department.headId` 재사용 pattern (팀장 승인자 판정 동일)
- `docs/superpowers/plans/2026-08-25-asset-registration-loan-guards.md` — 자산 gate 패턴 (`complianceFlag` check 재사용)
- `apps/api/src/software-license/` — `SoftwareLicense` CRUD 재사용 (whitelist 소스)

---

## 🔴 Grill 결정 (2026-08-25)

**재논의 금지.**

### Q12: Detection source + CI 정의
- **선택 (a) + (ii):** 유저 self-report + 정기 감사. `SoftwareLicense` DB = 인가 whitelist ("CI 미등록" = SoftwareLicense 매칭 실패)
- MDM/EDR 통합, SBOM, 외부 threat intel API 는 non-goal

### Q13: 상태 머신 + 모델
- **선택 (c) + (α):** 5-state (`DETECTED` / `PENDING_USER_ACTION` / `AWAITING_REVIEW` / `GRACE_PERIOD` / `RESOLVED`) + `resolution` 필드. 단일 `SoftwareInstallation` 모델 (인가·미인가·블랙리스트 통합)

### Q14: 승인 lifecycle + 승인자 + grace
- **선택 (c) + (α) + (B):**
  - `SoftwareInstallation` 자체에 승인 필드 (`authReviewerId`, `authReviewNote`, `authReviewedAt`) — 별도 auth request 모델 X
  - 미인가 승인자: IT 자산관리팀장 (`Department` name=`IT 자산관리` headId). null → 자산관리팀장 → admin
  - Grace period: 14일 (config 로 조정 가능)
  - 알림: D-7, D-3, D-1 warning

### Q15: EscalateGM + ForceDel
- **선택 (γ) + (D):**
  - EscalateGM 대상: IT 자산관리팀장 (Q14 승인자와 동일). 블랙리스트는 보안팀장 (Q16 δ)
  - ForceDel 메커니즘 (D 조합):
    - 감사 log (기존 `writeAuditLog` fire-and-forget)
    - `User.complianceFlag = WARNING` (미인가) / `CRITICAL` (블랙리스트)
    - 팀장 통보 (`SW_COMPLIANCE_ESCALATION` notification to user's `dept.headId`)
  - 자동 강제 삭제 (MDM/agent) 는 non-goal — 인력 수동 조치

### Q16: Workflow 4 통합 + 블랙리스트 DB + 보안 책임자
- **선택 (B+C) + (i) + (δ):**
  - **(B+C):** MVP 통합. `SoftwareInstallation.riskLevel` (`NORMAL` / `UNAUTHORIZED` / `BLACKLISTED`) 로 두 워크플로우 통합. 자동 네트워크 격리, 에이전트 강제 삭제 non-goal (수동 대체: `complianceFlag = CRITICAL`)
  - **(i)** 신규 `SoftwareBlacklist` 모델 + admin CRUD UI. 외부 threat intel API는 non-goal
  - **(δ)** 보안팀 = 신규 Department (name=`보안팀`, headId 유저). 신규 role 추가 없음. Fallback: 보안팀 미존재 → admin
  - 신규 예외 모델 `SoftwareBlacklistException { installationId, approvedById, approvedAt, expiresAt, reason }` — 임시성 명시

### Q17: 매칭 룰 + UI 진입점
- **선택 (ii) + (D):**
  - Case-insensitive exact match. `softwareName` + optional `softwareVersion` 조합. 매칭 실패 = 미인가 판정
  - UI: (A) 유저 profile 페이지 "설치된 SW" 섹션 자율 등록 + (B) 정기 알림 (분기마다 `SW_INVENTORY_REMINDER`). 온보딩 강제는 non-goal

---

## Task 1: 착수 확인 + 브랜치

- [ ] **Step 1: 관련 모델·모듈 최신 상태 확인**
```bash
grep -B1 -A20 "^model SoftwareLicense" apps/api/prisma/schema.prisma
grep -B1 -A10 "^enum NotificationType" apps/api/prisma/schema.prisma
ls apps/api/src/software-license/
```
확인 사항:
- `SoftwareLicense` 기존 필드 목록 (`name`, `version?`, `seats`, `expiresAt` 등) 확인
- `NotificationType` 마지막 값 확인 (신규 enum 추가 위치)
- `User` 모델에 `complianceFlag` 없음 (신규 추가)

- [ ] **Step 2: 기존 소프트웨어 라이선스 서비스 확인**
```bash
grep -n "findAll\|findById\|create\|update\|delete" apps/api/src/software-license/software-license.repo.ts
```
`SoftwareLicense` 매칭 소스로 재사용할 메소드 파악.

- [ ] **Step 3: 브랜치 생성**
```bash
git checkout -b feat/software-installation-compliance
```

---

## Task 2: Prisma schema — SoftwareInstallation 통합 모델

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: 신규 enum 3개 + 기존 `NotificationType` 확장 + `ComplianceFlag` 추가**
```prisma
enum SoftwareInstallationStatus {
  DETECTED
  PENDING_USER_ACTION
  AWAITING_REVIEW
  GRACE_PERIOD
  RESOLVED
}

enum SoftwareInstallationResolution {
  AUTHORIZED_ON_DETECTION
  USER_DELETED
  AUTHORIZED
  FORCE_REMOVED
}

enum SoftwareRiskLevel {
  NORMAL
  UNAUTHORIZED
  BLACKLISTED
}

enum ComplianceFlag {
  NORMAL
  WARNING
  CRITICAL
}
```

- [ ] **Step 2: `User` 모델에 `complianceFlag` 필드 추가**
```prisma
// User 모델 내
complianceFlag  ComplianceFlag  @default(NORMAL)
```
- `SoftwareInstallation` 역방향 relation 도 추가:
```prisma
softwareInstallations  SoftwareInstallation[]
```

- [ ] **Step 3: `SoftwareInstallation` 신규 모델**
```prisma
model SoftwareInstallation {
  id                   Int                              @id @default(autoincrement())
  userId               Int
  softwareName         String
  softwareVersion      String?
  deviceIdentifier     String?
  riskLevel            SoftwareRiskLevel                @default(NORMAL)
  status               SoftwareInstallationStatus       @default(DETECTED)
  resolution           SoftwareInstallationResolution?
  graceDeadline        DateTime?
  authReviewerId       Int?
  authReviewNote       String?
  authReviewedAt       DateTime?
  softwareLicenseId    Int?
  createdAt            DateTime                         @default(now())
  updatedAt            DateTime                         @updatedAt
  resolvedAt           DateTime?

  user                 User                             @relation(fields: [userId], references: [id])
  authReviewer         User?                            @relation("SoftwareInstallationReviewer", fields: [authReviewerId], references: [id])
  softwareLicense      SoftwareLicense?                 @relation(fields: [softwareLicenseId], references: [id])
  blacklistException   SoftwareBlacklistException?
}
```

- [ ] **Step 4: `SoftwareBlacklist` 신규 모델**
```prisma
model SoftwareBlacklist {
  id          Int       @id @default(autoincrement())
  name        String
  version     String?
  reason      String
  addedById   Int
  addedAt     DateTime  @default(now())

  addedBy     User      @relation("SoftwareBlacklistAddedBy", fields: [addedById], references: [id])
}
```

- [ ] **Step 5: `SoftwareBlacklistException` 신규 모델**
```prisma
model SoftwareBlacklistException {
  id              Int                  @id @default(autoincrement())
  installationId  Int                  @unique
  approvedById    Int
  approvedAt      DateTime             @default(now())
  expiresAt       DateTime             // 필수 — 임시성 명시
  reason          String

  installation    SoftwareInstallation @relation(fields: [installationId], references: [id])
  approvedBy      User                 @relation("SoftwareBlacklistExceptionApprover", fields: [approvedById], references: [id])
}
```

- [ ] **Step 6: `NotificationType` enum 신규 값 추가** (기존 `ASSET_REQUEST_FULFILLED` 뒤에)
```prisma
  UNAUTHORIZED_SW_ACTION_REQUIRED
  BLACKLIST_SW_DETECTED
  SW_AUTH_REQUESTED
  SW_AUTH_APPROVED
  SW_AUTH_REJECTED
  BLACKLIST_SW_EXCEPTION_REQUESTED
  BLACKLIST_SW_EXCEPTION_APPROVED
  BLACKLIST_SW_EXCEPTION_REJECTED
  SW_GRACE_PERIOD_D7
  SW_GRACE_PERIOD_D3
  SW_GRACE_PERIOD_D1
  SW_COMPLIANCE_ESCALATION
  SW_FORCE_REMOVED
  SW_INVENTORY_REMINDER
```

- [ ] **Step 7: `SoftwareLicense` 모델에 역방향 relation 추가**
```prisma
// SoftwareLicense 모델 내
softwareInstallations  SoftwareInstallation[]
```

- [ ] **Step 8: `prisma format` + `validate`**
```bash
cd apps/api && npx prisma format && npx prisma validate
```

---

## Task 3: Migration + seed

- [ ] **Step 1: Migration 생성**
```bash
cd apps/api
npx prisma migrate dev --create-only --name software_installation_compliance
```
shadow-DB 실패 시 수동 SQL:
```sql
-- enum 추가 (CREATE TYPE ... AS ENUM)
CREATE TYPE "SoftwareInstallationStatus" AS ENUM ('DETECTED','PENDING_USER_ACTION','AWAITING_REVIEW','GRACE_PERIOD','RESOLVED');
CREATE TYPE "SoftwareInstallationResolution" AS ENUM ('AUTHORIZED_ON_DETECTION','USER_DELETED','AUTHORIZED','FORCE_REMOVED');
CREATE TYPE "SoftwareRiskLevel" AS ENUM ('NORMAL','UNAUTHORIZED','BLACKLISTED');
CREATE TYPE "ComplianceFlag" AS ENUM ('NORMAL','WARNING','CRITICAL');

-- NotificationType 에 신규 값 추가
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'UNAUTHORIZED_SW_ACTION_REQUIRED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BLACKLIST_SW_DETECTED';
-- ... (나머지 13개 SW_ 값 동일 패턴)

-- User.complianceFlag 컬럼
ALTER TABLE "User" ADD COLUMN "complianceFlag" "ComplianceFlag" NOT NULL DEFAULT 'NORMAL';

-- 신규 테이블 3개 (schema 기반 Prisma 자동 생성)
```

- [ ] **Step 2: 로컬 apply**
```bash
npx prisma migrate deploy
```

- [ ] **Step 3: 보안팀 Department seed**
`apps/api/prisma/seed.ts` 내 Department seed 구간에 추가:
```typescript
// 보안팀 Department seed (없으면 생성)
await prisma.department.upsert({
  where: { name: '보안팀' },
  update: {},
  create: {
    name: '보안팀',
    // headId: 별도 보안팀장 유저 seed 후 할당 또는 null
  },
});
```
- 보안팀장 유저가 없으면 null 허용. 런타임 fallback → admin (Q16 δ)

- [ ] **Step 4: Grace period config 상수**
`apps/api/src/software-installation/constants.ts` 신규:
```typescript
export const SW_GRACE_PERIOD_DAYS = parseInt(process.env.SW_GRACE_PERIOD_DAYS ?? '14', 10);
```
환경 변수로 오버라이드 가능.

- [ ] **Step 5: Commit**
```bash
git add apps/api/prisma/
git commit -m "feat(schema): add SoftwareInstallation compliance models + ComplianceFlag enum"
```

---

## Task 4: 백엔드 SoftwareInstallation 모듈

**Files:**
- Create: `apps/api/src/software-installation/software-installation.repo.ts`
- Create: `apps/api/src/software-installation/software-installation.service.ts`
- Create: `apps/api/src/software-installation/software-installation.controller.ts`
- Create: `apps/api/src/software-installation/software-installation.routes.ts`
- Create: `apps/api/src/software-installation/__test__/software-installation.service.test.ts`

- [ ] **Step 1: Repository**
```typescript
// software-installation.repo.ts
findById(id: number): Promise<SoftwareInstallation | null>
findByUser(userId: number): Promise<SoftwareInstallation[]>
findPendingGrace(): Promise<SoftwareInstallation[]>  // GRACE_PERIOD 상태 전체
findAwaitingReview(riskLevel?: SoftwareRiskLevel): Promise<SoftwareInstallation[]>
create(data: CreateInstallationDto): Promise<SoftwareInstallation>
updateStatus(id: number, status: SoftwareInstallationStatus, extra?: Partial<SoftwareInstallation>): Promise<SoftwareInstallation>
updateComplianceFlag(userId: number, flag: ComplianceFlag): Promise<void>
```

- [ ] **Step 2: 매칭 로직 (matchingLogic)**
```typescript
// software-installation.service.ts
private async matchRiskLevel(
  name: string,
  version?: string
): Promise<{ riskLevel: SoftwareRiskLevel; licenseId?: number; blacklistEntry?: SoftwareBlacklist }> {
  const nameLower = name.toLowerCase();

  // 1. 블랙리스트 대조 (우선)
  const blacklisted = await this.blacklistRepo.findAll();
  const blackMatch = blacklisted.find(b =>
    b.name.toLowerCase() === nameLower &&
    (!b.version || !version || b.version.toLowerCase() === version.toLowerCase())
  );
  if (blackMatch) return { riskLevel: 'BLACKLISTED', blacklistEntry: blackMatch };

  // 2. SoftwareLicense whitelist 대조
  const licenses = await this.licenseRepo.findAll();
  const licenseMatch = licenses.find(l =>
    l.name.toLowerCase() === nameLower &&
    (!l.version || !version || l.version.toLowerCase() === version.toLowerCase())
  );
  if (licenseMatch) return { riskLevel: 'NORMAL', licenseId: licenseMatch.id };

  // 3. 매칭 실패 = 미인가
  return { riskLevel: 'UNAUTHORIZED' };
}
```

- [ ] **Step 3: Service — registerInstallation**
```typescript
async registerInstallation(
  userId: number,
  name: string,
  version?: string,
  deviceIdentifier?: string
): Promise<SoftwareInstallation> {
  const { riskLevel, licenseId } = await this.matchRiskLevel(name, version);

  const status = riskLevel === 'NORMAL'
    ? 'RESOLVED'
    : 'PENDING_USER_ACTION';
  const resolution = riskLevel === 'NORMAL' ? 'AUTHORIZED_ON_DETECTION' : undefined;

  const record = await this.repo.create({
    userId, softwareName: name, softwareVersion: version,
    deviceIdentifier, riskLevel, status, resolution,
    softwareLicenseId: licenseId ?? null,
  });

  if (riskLevel === 'UNAUTHORIZED') {
    await this.notifyUser(userId, 'UNAUTHORIZED_SW_ACTION_REQUIRED', record.id);
    await this.notifyReviewer('UNAUTHORIZED', 'SW_AUTH_REQUESTED', record.id);
  }
  if (riskLevel === 'BLACKLISTED') {
    await this.notifyUser(userId, 'BLACKLIST_SW_DETECTED', record.id);
    await this.notifyReviewer('BLACKLISTED', 'BLACKLIST_SW_DETECTED', record.id);
  }

  return record;
}
```

- [ ] **Step 4: Service — 3-way choice (userDelete / requestAuth / enterGracePeriod)**
```typescript
async userDelete(installationId: number, userId: number): Promise<void> {
  const inst = await this.assertOwnerAndStatus(installationId, userId, 'PENDING_USER_ACTION');
  await this.repo.updateStatus(inst.id, 'RESOLVED', { resolution: 'USER_DELETED', resolvedAt: new Date() });
  void writeAuditLog({ actorId: userId, action: 'SW_USER_DELETED', targetId: inst.id }).catch(console.error);
}

async requestAuth(installationId: number, userId: number, reason: string): Promise<void> {
  const inst = await this.assertOwnerAndStatus(installationId, userId, 'PENDING_USER_ACTION');
  await this.repo.updateStatus(inst.id, 'AWAITING_REVIEW');
  const reviewerId = await this.resolveReviewer(inst.riskLevel);
  if (reviewerId) await this.notifySingle(reviewerId, 'SW_AUTH_REQUESTED', inst.id, reason);
}

async enterGracePeriod(installationId: number, deadline: Date): Promise<void> {
  await this.repo.updateStatus(installationId, 'GRACE_PERIOD', { graceDeadline: deadline });
  // D-7, D-3, D-1 알림은 cron (Task 7) 이 담당
}
```

- [ ] **Step 5: Service — reviewAuth (승인·반려)**
```typescript
async reviewAuth(
  installationId: number,
  reviewerId: number,
  action: 'APPROVE' | 'REJECT',
  note?: string
): Promise<void> {
  const inst = await this.repo.findById(installationId);
  if (!inst || inst.status !== 'AWAITING_REVIEW') throw new AppError(400, 'INVALID_STATE');
  await this.assertReviewerPermission(reviewerId, inst.riskLevel);

  if (action === 'APPROVE') {
    // SoftwareLicense 신규 생성 or 기존 link
    const licenseId = inst.softwareLicenseId ?? (await this.licenseService.createFromInstallation(inst)).id;
    await this.repo.updateStatus(inst.id, 'RESOLVED', {
      resolution: 'AUTHORIZED',
      authReviewerId: reviewerId,
      authReviewNote: note,
      authReviewedAt: new Date(),
      softwareLicenseId: licenseId,
      resolvedAt: new Date(),
    });
    await this.notifySingle(inst.userId, 'SW_AUTH_APPROVED', inst.id);
  } else {
    // 반려 → grace period 진입
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + SW_GRACE_PERIOD_DAYS);
    await this.repo.updateStatus(inst.id, 'GRACE_PERIOD', {
      authReviewerId: reviewerId,
      authReviewNote: note,
      authReviewedAt: new Date(),
      graceDeadline: deadline,
    });
    await this.notifySingle(inst.userId, 'SW_AUTH_REJECTED', inst.id);
  }
  void writeAuditLog({ actorId: reviewerId, action: `SW_REVIEW_${action}`, targetId: inst.id }).catch(console.error);
}
```

- [ ] **Step 6: Service — forceRemove**
```typescript
async forceRemove(installationId: number, actorId: number): Promise<void> {
  const inst = await this.repo.findById(installationId);
  if (!inst) throw new AppError(404, 'NOT_FOUND');
  if (inst.status !== 'GRACE_PERIOD') throw new AppError(400, 'INVALID_STATE');
  await this.assertReviewerPermission(actorId, inst.riskLevel);

  const newFlag: ComplianceFlag = inst.riskLevel === 'BLACKLISTED' ? 'CRITICAL' : 'WARNING';
  await this.repo.updateStatus(inst.id, 'RESOLVED', { resolution: 'FORCE_REMOVED', resolvedAt: new Date() });
  await this.repo.updateComplianceFlag(inst.userId, newFlag);

  // 팀장 통보
  const userDept = await this.deptRepo.findUserPrimaryDept(inst.userId);
  if (userDept?.headId) {
    await this.notifySingle(userDept.headId, 'SW_COMPLIANCE_ESCALATION', inst.id);
  }
  await this.notifySingle(inst.userId, 'SW_FORCE_REMOVED', inst.id);
  void writeAuditLog({ actorId, action: 'SW_FORCE_REMOVED', targetId: inst.id, detail: { flag: newFlag } }).catch(console.error);
}
```

- [ ] **Step 7: Service — resolveReviewer helper**
```typescript
private async resolveReviewer(riskLevel: SoftwareRiskLevel): Promise<number | null> {
  const deptName = riskLevel === 'BLACKLISTED' ? '보안팀' : 'IT 자산관리';
  const dept = await this.deptRepo.findByName(deptName);
  if (dept?.headId) return dept.headId;
  // fallback: admin 유저 중 첫 번째
  return this.userRepo.findFirstAdmin();
}
```

- [ ] **Step 8: assertReviewerPermission helper**
```typescript
private async assertReviewerPermission(reviewerId: number, riskLevel: SoftwareRiskLevel): Promise<void> {
  const reviewer = await this.userRepo.findById(reviewerId);
  if (!reviewer) throw new AppError(404, 'REVIEWER_NOT_FOUND');
  if (isAdminLike(reviewer.role)) return;  // admin escape
  const expected = await this.resolveReviewer(riskLevel);
  if (expected !== reviewerId) throw new AppError(403, 'NOT_AUTHORIZED_REVIEWER');
}
```

- [ ] **Step 9: Controller + Routes**
```typescript
// Routes
router.get   ('/my',                    auth, controller.listMy);           // 내 installation 목록
router.post  ('/',                       auth, controller.register);          // self-report 등록
router.delete('/:id/user-delete',        auth, controller.userDelete);        // 즉시 삭제 (3-way A)
router.post  ('/:id/request-auth',       auth, controller.requestAuth);       // 승인 요청 (3-way B)
router.get   ('/review-queue',           auth, controller.listReviewQueue);   // 검토 대기함 (reviewer용)
router.post  ('/:id/review',             auth, controller.reviewAuth);        // 승인·반려
router.post  ('/:id/force-remove',       auth, controller.forceRemove);       // 강제 조치
router.get   ('/',                       auth, admin, controller.listAll);    // admin 전체 목록
```
prefix: `/api/software-installations`

- [ ] **Step 10: Unit tests** — `apps/api/src/software-installation/__test__/software-installation.service.test.ts`
  - 매칭: 블랙리스트 → `BLACKLISTED` / whitelist 매칭 → `NORMAL` + `RESOLVED` / 미매칭 → `UNAUTHORIZED`
  - 매칭 case-insensitive: `"photoshop"` vs `"Photoshop"` 동일 판정
  - 버전 매칭: version 있으면 정확 매칭, null 이면 무시
  - 3-way choice: `userDelete` 상태 전환 + `PENDING_USER_ACTION` 외 상태에서 400
  - `requestAuth`: 상태 전환 + 알림 fire
  - `reviewAuth` APPROVE: `RESOLVED(AUTHORIZED)` + licenseId 할당
  - `reviewAuth` REJECT: `GRACE_PERIOD` 전환 + graceDeadline 설정
  - `forceRemove`: `RESOLVED(FORCE_REMOVED)` + `complianceFlag=WARNING/CRITICAL` + 팀장 알림
  - `resolveReviewer` fallback: dept 없으면 admin 반환
  - `assertReviewerPermission`: admin escape / wrong reviewer 403

- [ ] **Step 11: Commit**
```bash
git add apps/api/src/software-installation/
git commit -m "feat(software-installation): add installation CRUD, state machine, 3-way choice, reviewAuth, forceRemove"
```

---

## Task 5: 백엔드 SoftwareBlacklist CRUD (admin)

**Files:**
- Create: `apps/api/src/software-blacklist/software-blacklist.repo.ts`
- Create: `apps/api/src/software-blacklist/software-blacklist.service.ts`
- Create: `apps/api/src/software-blacklist/software-blacklist.controller.ts`
- Create: `apps/api/src/software-blacklist/software-blacklist.routes.ts`

- [ ] **Step 1: Repository**
```typescript
findAll(): Promise<SoftwareBlacklist[]>
findByNameVersion(name: string, version?: string): Promise<SoftwareBlacklist | null>
create(data: { name, version?, reason, addedById }): Promise<SoftwareBlacklist>
delete(id: number): Promise<void>
```

- [ ] **Step 2: Service**
- `list()`: 전체 목록
- `add(addedById, name, version?, reason)`: 중복 체크 (name+version 기존에 있으면 409) → 생성 + audit log
- `remove(id, actorId)`: 삭제 + audit log

- [ ] **Step 3: Controller + Routes (admin only)**
```typescript
router.get   ('/',    auth, adminOnly, controller.list);
router.post  ('/',    auth, adminOnly, controller.add);
router.delete('/:id', auth, adminOnly, controller.remove);
```
prefix: `/api/software-blacklists`

- [ ] **Step 4: Commit**
```bash
git add apps/api/src/software-blacklist/
git commit -m "feat(software-blacklist): admin CRUD for software blacklist"
```

---

## Task 6: 백엔드 SoftwareBlacklistException CRUD

**Files:**
- Create: `apps/api/src/software-blacklist-exception/software-blacklist-exception.repo.ts`
- Create: `apps/api/src/software-blacklist-exception/software-blacklist-exception.service.ts`
- Create: `apps/api/src/software-blacklist-exception/software-blacklist-exception.controller.ts`
- Create: `apps/api/src/software-blacklist-exception/software-blacklist-exception.routes.ts`

- [ ] **Step 1: Repository**
```typescript
findByInstallation(installationId: number): Promise<SoftwareBlacklistException | null>
findExpired(): Promise<SoftwareBlacklistException[]>   // expiresAt < now()
create(data: CreateExceptionDto): Promise<SoftwareBlacklistException>
```

- [ ] **Step 2: Service — approve (보안팀장 or admin)**
```typescript
async approveException(
  installationId: number,
  approvedById: number,
  expiresAt: Date,
  reason: string
): Promise<SoftwareBlacklistException> {
  const inst = await this.installRepo.findById(installationId);
  if (!inst || inst.riskLevel !== 'BLACKLISTED') throw new AppError(400, 'NOT_BLACKLISTED');
  await this.assertBlacklistReviewer(approvedById);
  const exception = await this.repo.create({ installationId, approvedById, expiresAt, reason });
  // 예외 승인 → installation status = RESOLVED (AUTHORIZED)
  await this.installRepo.updateStatus(inst.id, 'RESOLVED', {
    resolution: 'AUTHORIZED',
    authReviewerId: approvedById,
    authReviewedAt: new Date(),
    resolvedAt: new Date(),
  });
  await this.notifySingle(inst.userId, 'BLACKLIST_SW_EXCEPTION_APPROVED', inst.id);
  void writeAuditLog({ actorId: approvedById, action: 'BLACKLIST_EXCEPTION_APPROVED', targetId: inst.id, detail: { expiresAt } }).catch(console.error);
  return exception;
}
```

- [ ] **Step 3: Service — handleExpiry (cron 에서 호출)**
```typescript
async handleExpiredExceptions(): Promise<void> {
  const expired = await this.repo.findExpired();
  for (const ex of expired) {
    // 예외 만료 → installation 재판정 (PENDING_USER_ACTION 으로 복귀)
    await this.installRepo.updateStatus(ex.installationId, 'PENDING_USER_ACTION', { resolution: undefined });
    await this.notifyUser(ex.installation.userId, 'UNAUTHORIZED_SW_ACTION_REQUIRED', ex.installationId);
    void writeAuditLog({ actorId: 0, action: 'BLACKLIST_EXCEPTION_EXPIRED', targetId: ex.installationId }).catch(console.error);
  }
}
```

- [ ] **Step 4: Routes**
```typescript
router.get   ('/',                     auth, controller.list);
router.post  ('/installations/:id/approve', auth, controller.approve);  // 보안팀장·admin only
```
prefix: `/api/software-blacklist-exceptions`

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/software-blacklist-exception/
git commit -m "feat(software-blacklist-exception): blacklist exception approval + expiry handler"
```

---

## Task 7: Cron jobs

**Files:**
- Create: `apps/api/src/cron/swGracePeriodWarning.ts`
- Create: `apps/api/src/cron/swExceptionExpiry.ts`
- Create: `apps/api/src/cron/swInventoryReminder.ts`
- Modify: `apps/api/src/cron/index.ts` — 신규 cron 등록

- [ ] **Step 1: `swGracePeriodWarning.ts` — daily D-7/D-3/D-1**
```typescript
// 매일 실행 (ex: 09:00 KST)
// GRACE_PERIOD 상태인 모든 installation 조회
// graceDeadline 까지 남은 날 = 7, 3, 1 이면 해당 알림 발송
export async function swGracePeriodWarning(): Promise<void> {
  const installs = await installRepo.findPendingGrace();
  const now = new Date();
  for (const inst of installs) {
    if (!inst.graceDeadline) continue;
    const daysLeft = Math.ceil((inst.graceDeadline.getTime() - now.getTime()) / 86400000);
    const typeMap: Record<number, NotificationType> = {
      7: 'SW_GRACE_PERIOD_D7',
      3: 'SW_GRACE_PERIOD_D3',
      1: 'SW_GRACE_PERIOD_D1',
    };
    if (typeMap[daysLeft]) {
      await notificationService.send(inst.userId, typeMap[daysLeft], inst.id);
    }
    // grace 만료 (daysLeft <= 0) → forceRemove 트리거
    if (daysLeft <= 0) {
      const reviewerId = await installService.resolveReviewer(inst.riskLevel);
      if (reviewerId) await installService.forceRemove(inst.id, reviewerId);
    }
  }
}
```

- [ ] **Step 2: `swExceptionExpiry.ts` — daily**
```typescript
// SoftwareBlacklistException.expiresAt < now() 인 레코드 재판정
export async function swExceptionExpiry(): Promise<void> {
  await blacklistExceptionService.handleExpiredExceptions();
}
```

- [ ] **Step 3: `swInventoryReminder.ts` — 분기 첫날 (quarterly)**
```typescript
// 분기 첫날 = 1/1, 4/1, 7/1, 10/1
// 모든 활성 User 에게 SW_INVENTORY_REMINDER 발송
export async function swInventoryReminder(): Promise<void> {
  const users = await userRepo.findAllActive();
  for (const u of users) {
    await notificationService.send(u.id, 'SW_INVENTORY_REMINDER', undefined);
  }
}
```

- [ ] **Step 4: `cron/index.ts` 등록**
```typescript
// existing cron 패턴 재사용
cron.schedule('0 0 * * *', swGracePeriodWarning);   // daily 09:00 KST (UTC 00:00)
cron.schedule('0 1 * * *', swExceptionExpiry);       // daily 10:00 KST (UTC 01:00)
cron.schedule('0 0 1 1,4,7,10 *', swInventoryReminder); // 분기 첫날
```

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/cron/
git commit -m "feat(cron): add SW grace period warning, exception expiry, quarterly inventory reminder crons"
```

---

## Task 8: Frontend

**Files:**
- Create: `football/src/pages/profile/InstalledSoftwarePage.tsx`
- Create: `football/src/pages/software/BlacklistAdminPage.tsx`
- Create: `football/src/pages/software/ComplianceReviewPage.tsx`
- Create: `football/src/services/softwareInstallation.service.ts`
- Create: `football/src/services/softwareBlacklist.service.ts`
- Modify: `football/src/App.tsx` — 신규 routes 등록
- Modify: `football/src/layouts/AppShell.tsx` — nav 노출 조건
- Modify: `football/src/locales/{ko,en}/common.json` — 신규 문자열

- [ ] **Step 1: API 서비스 함수**
```typescript
// softwareInstallation.service.ts
export const softwareInstallationApi = {
  listMy(): Promise<SoftwareInstallation[]>,
  register(name: string, version?: string, deviceIdentifier?: string): Promise<SoftwareInstallation>,
  userDelete(id: number): Promise<void>,
  requestAuth(id: number, reason: string): Promise<void>,
  listReviewQueue(): Promise<SoftwareInstallation[]>,
  reviewAuth(id: number, action: 'APPROVE' | 'REJECT', note?: string): Promise<void>,
  forceRemove(id: number): Promise<void>,
}

// softwareBlacklist.service.ts
export const softwareBlacklistApi = {
  list(): Promise<SoftwareBlacklist[]>,
  add(name: string, version?: string, reason: string): Promise<SoftwareBlacklist>,
  remove(id: number): Promise<void>,
  approveException(installationId: number, expiresAt: string, reason: string): Promise<void>,
}
```

- [ ] **Step 2: `InstalledSoftwarePage.tsx` — 유저 프로필 SW 섹션**
  - 유저 자신의 `SoftwareInstallation` 목록 + 상태 배지 (NORMAL/미인가/블랙리스트/GRACE_PERIOD)
  - 상단: "SW 등록" 버튼 → 이름·버전 입력 다이얼로그 → `register()`
  - 항목별 액션:
    - `PENDING_USER_ACTION` 상태: 3-way 선택 버튼 (즉시 삭제 / 승인 요청 / — ) + 유예 안내
    - `AWAITING_REVIEW`: "검토 대기 중" 배지
    - `GRACE_PERIOD`: D-N 카운트다운 + 남은 일수 표시
    - `RESOLVED`: 결과 표시 (인가됨 / 삭제됨 / 강제 조치)
  - `complianceFlag = WARNING | CRITICAL` 시 상단 배너

- [ ] **Step 3: `BlacklistAdminPage.tsx` — admin 전용**
  - 블랙리스트 목록 테이블 (name, version, reason, 추가일, 추가자)
  - "블랙리스트 추가" 버튼 → name/version/reason 입력 다이얼로그
  - 삭제 버튼 (확인 모달)
  - 접근 제한: `isAdminLike(user.role)` 만

- [ ] **Step 4: `ComplianceReviewPage.tsx` — IT 자산관리팀장 + 보안팀장**
  - 탭: "미인가 SW 검토" (UNAUTHORIZED) / "블랙리스트 SW 검토" (BLACKLISTED)
  - 각 탭: 검토 대기 `SoftwareInstallation` 목록 + 승인·반려 버튼 + note 입력
  - 보안팀장 탭 추가: 예외 승인 (expiresAt 날짜 picker + reason)
  - 접근 조건:
    ```typescript
    const canReviewUnauthorized = isAdminLike(user.role) || user.id === itDeptHead?.headId;
    const canReviewBlacklisted  = isAdminLike(user.role) || user.id === securityDeptHead?.headId;
    ```

- [ ] **Step 5: Nav 노출 조건**
```typescript
// AppShell.tsx
// 유저 프로필 하위 "내 SW 목록" — 모든 유저 표시
// "컴플라이언스 검토" — IT 자산관리팀장 or 보안팀장 or admin
// "블랙리스트 관리" — admin only
```

- [ ] **Step 6: 오류 코드 매핑 (i18n)**
  - `INVALID_STATE`, `NOT_AUTHORIZED_REVIEWER`, `NOT_BLACKLISTED`, `REVIEWER_NOT_FOUND`

- [ ] **Step 7: type-check + commit**
```bash
cd football && npm run type-check
git add football/src/
git commit -m "feat(frontend): SW installation compliance UI — profile section, blacklist admin, compliance review"
```

---

## Task 9: ADR + CONTEXT.md

**Files:**
- Create: `docs/adr/0017-software-installation-compliance.md`
- Modify: `CONTEXT.md`

- [ ] **Step 1: ADR 0017**
  - **Context:** 축구단 IT 자산 컴플라이언스 관리 부재. `SoftwareLicense` CRUD 는 존재하나 유저별 install tracking 없음. MDM/EDR 통합은 벤더 계약 스코프 폭발.
  - **Decision:**
    - Self-report + 정기 감사 (Q12 a+ii)
    - 단일 `SoftwareInstallation` 모델 + `riskLevel` 으로 인가/미인가/블랙리스트 통합 (Q13 c+α, Q16 B+C)
    - 5-state machine + `resolution` 필드 (Q13 α)
    - 별도 auth-request 모델 X — `SoftwareInstallation` 자체 승인 필드 (Q14 c+α)
    - Grace period 14일 config (Q14 B)
    - `User.complianceFlag` (WARNING/CRITICAL) + 팀장 통보 = ForceDel 대체 (Q15 γ+D)
    - 보안팀 신규 Department, 신규 role 없음 (Q16 δ)
    - Case-insensitive exact match (Q17 ii)
  - **Alternatives rejected:**
    - MDM/EDR 통합 — 스코프, 계약, 구현 복잡도 폭발
    - 별도 `SoftwareAuthRequest` 모델 — 단일 모델 통합이 유지보수 저렴
    - 네트워크 격리 / 자동 강제 삭제 — endpoint agent 전제, MVP 불가
    - `riskLevel` 분리 모델 — 통합이 상태 관리 단순화
  - **Consequences (+):** 구현 빠름, 유지보수 단순, 기존 Department.headId 패턴 재사용
  - **Consequences (-):** self-report 의존 → 탐지율 제한, complianceFlag 실효성은 감사·인사 연동 전제

- [ ] **Step 2: CONTEXT.md 신규 섹션 추가**
  - `## SW 설치 컴플라이언스 (Software Installation Compliance)` 섹션:
    - `SoftwareInstallation` state machine 도식 (DETECTED→...→RESOLVED)
    - riskLevel 3-tier 설명 (NORMAL/UNAUTHORIZED/BLACKLISTED)
    - 승인자 결정 로직 (IT 자산관리팀 headId / 보안팀 headId / fallback admin)
    - `User.complianceFlag` gate 설명 + complianceFlag 리셋 정책 (별도 plan — non-goal)
    - MDM/EDR 통합 non-goal 명시

- [ ] **Step 3: Commit**
```bash
git add docs/adr/0017-software-installation-compliance.md CONTEXT.md
git commit -m "docs(adr): ADR 0017 — SW installation compliance self-report + state machine"
```

---

## Task 10: 스모크 + PR

- [ ] **Step 1: tsc + jest**
```bash
cd apps/api && npx tsc --noEmit
npx jest --testPathPattern="software-installation"
cd football && npm run type-check
```

- [ ] **Step 2: E2E 시나리오 수동 검증**
  1. 일반 유저 로그인 → 프로필 페이지 "SW 등록" → `"Photoshop"` 입력 → (whitelist 매칭 시) `RESOLVED(AUTHORIZED_ON_DETECTION)` 즉시
  2. 같은 유저 → `"HackerTool"` (블랙리스트 항목) 입력 → `PENDING_USER_ACTION` + 알림 2건 (유저·보안팀장)
  3. 유저: `HackerTool` 즉시 삭제 → `RESOLVED(USER_DELETED)`
  4. 유저: `"UnknownApp"` (whitelist 미등록) 입력 → `PENDING_USER_ACTION(UNAUTHORIZED)` → "승인 요청" 클릭 → `AWAITING_REVIEW`
  5. IT 자산관리팀장 로그인 → 컴플라이언스 검토 → 반려 → 유저 `GRACE_PERIOD` + 알림 `SW_AUTH_REJECTED`
  6. Grace period 만료 cron mock → `FORCE_REMOVED` + `complianceFlag=WARNING` + 팀장 알림 `SW_COMPLIANCE_ESCALATION`
  7. Admin 로그인 → 블랙리스트 관리 → `"BadSoftware"` 추가 → 삭제
  8. 보안팀장 → 블랙리스트 SW exception 승인 (expiresAt = 30일 후) → 예외 만료 cron mock → `PENDING_USER_ACTION` 재진입

- [ ] **Step 3: PR 생성**
```bash
gh pr create \
  --title "feat: SW 설치 컴플라이언스 — self-report + 3-way choice + complianceFlag" \
  --body "..."
```

---

## 위험 / 안전 노트

1. **Self-report 한계:** 유저가 미인가 SW 를 등록 안 하면 탐지 불가. MDM/EDR 통합 없이는 근본 해결 X → 별도 plan.
2. **매칭 정확성:** case-insensitive exact match 는 `"Photoshop"` vs `"Adobe Photoshop CC"` 구분 실패 가능. 관리자가 `SoftwareLicense`/`SoftwareBlacklist` 항목명을 세심히 관리해야.
3. **강제 조치 실효성:** `complianceFlag` + 팀장 통보 는 사회적 압박 mechanism. 실제 삭제 강제력 없음. 감사·인사 프로세스와 연동 전제.
4. **블랙리스트 관리 부담:** 관리자가 수동으로 CVE/threat intel 을 반영해야. 외부 API 통합 없이는 실시간성 X.
5. **보안팀장 부재 시:** admin 으로 fallback. 조직 구조 변경 시 dept name 매칭 실패 리스크 (dept id 하드코딩 대신 name 조회 + fallback chain 으로 완화).
6. **예외 승인 오남용:** `SoftwareBlacklistException` 은 `expiresAt` 필수 + 승인자 audit. 그러나 임의 연장 남용 가능 → 별도 감사 필요.
7. **enum migration 순서:** `NotificationType` 에 14개 값 추가 시 `ALTER TYPE ADD VALUE` 는 각 값별 개별 실행 필요. transaction 밖에서만 실행 가능 (Prisma 가 `--create-only` migration 에 자동 처리하지 못하면 수동 SQL).
8. **complianceFlag 리셋 정책 미정:** `forceRemove` 이후 유저가 SW 삭제하면 `complianceFlag` 를 어떻게 복구하는지 이 plan 에 없음 → non-goal, 별도 plan.

---

## Non-goals (Follow-up)

- **MDM/EDR 통합** (Jamf, Intune, CrowdStrike 등 자동 탐지·자동 격리·자동 삭제) — 별도 대규모 plan.
- **네트워크 격리 (Isolate)** — endpoint agent 전제, MVP X.
- **에이전트 통한 자동 강제 삭제** — endpoint agent 전제, MVP X.
- **외부 threat intel API** (VirusTotal, MITRE CVE) — 스코프 폭발.
- **온보딩 시 SW 인벤토리 강제 등록** — `OnboardingChecklist` 시스템 도입 시.
- **재발 방지 자동 warning** — `forceRemove` 후 재감지 시 강한 경고 (별도 rules engine plan).
- **부서·팀별 인벤토리 dashboard** — 컴플라이언스 리포팅 UI.
- **정기 감사 자동 리포트** — quarterly compliance report 자동 생성.
- **`complianceFlag` 리셋 워크플로우** — 조치 완료 후 flag 정상화 절차 (별도 plan).
- **SBOM (Software Bill of Materials)** — 빌드 레벨 의존성 추적.

---

## Self-Review

**Grill decision coverage:**
- Q12 (self-report + SoftwareLicense whitelist) → Task 4 `matchRiskLevel` + Non-goals (MDM/EDR/외부 API)
- Q13 (5-state + 단일 모델) → Task 2 (schema enum + `SoftwareInstallation` 모델) + Task 4 (state machine service)
- Q14 (승인 필드 내장 + IT 자산관리팀장 + 14일 grace) → Task 2 (`authReviewer*` 필드) + Task 4 (`reviewAuth`, `resolveReviewer`) + Task 3 (`SW_GRACE_PERIOD_DAYS`) + Task 7 (`swGracePeriodWarning`)
- Q15 (EscalateGM = 팀장 통보 + complianceFlag) → Task 4 (`forceRemove` 팀장 통보 + `updateComplianceFlag`) + Task 7 (grace expiry cron)
- Q16 (riskLevel 통합 + SoftwareBlacklist 모델 + 보안팀 dept) → Task 2 (모델 3개) + Task 3 (보안팀 seed) + Task 5 (blacklist CRUD) + Task 6 (exception)
- Q17 (case-insensitive exact match + profile UI + 분기 reminder) → Task 4 (`matchRiskLevel` + version 매칭) + Task 8 (`InstalledSoftwarePage`) + Task 7 (`swInventoryReminder`)

**Safety:**
- enum migration 주의사항 Task 3 명시 (위험 노트 7)
- 승인자 fallback chain 명시 (resolveReviewer: dept.headId → admin)
- `complianceFlag` 리셋 정책 non-goal 명시 (위험 노트 8)
- Grace period cron 만료 → `forceRemove` 자동 트리거 + audit log fire-and-forget
- `SoftwareBlacklistException.expiresAt` 필수 + 만료 후 재판정 (Task 6 + Task 7)
