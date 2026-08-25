# 연말 결산 보고서 (YearlySettlementReport) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연말 결산 보고서 (`YearlySettlementReport`) 모델·워크플로우 신설. `MonthlySettlementReport` 와 병렬 별도 모델, fully manual 입력. 자산·시설관리팀 (`frontOfficeRole = ASSET_MANAGER / FACILITY_MANAGER / ASSET_STAFF / FACILITY_STAFF`) 접근 게이트 helper 도입.

**Why:**
- `MonthlySettlementReport` 만 있고 연말 (yearly) 결산 보고서 없음. 실무 상 연말 결산은 필수.
- 12개월 aggregate 자동 계산은 복잡 (일부 미결재/조정 항목) → MVP 는 수동 입력.
- 자산+시설관리 팀 전용 보고서 진입점 필요 (현재는 role-based access 만) → 명시적 helper 로 캡슐화.

**Architecture:**
- 별도 `YearlySettlementReport` 모델 (`MonthlySettlementReport` 스키마 미러 + `year Int @unique`).
- Approval 로직은 shared service (`ReportApprovalService.approve(reportType, id, stage)`) 로 두 모델 공유 (optional — over-engineering 방지, 별도 service 도 허용).
- Excel export 도 shared util 재사용.
- `canAccessAssetFacilityReport(user)` helper — 4개 role 조합 + admin escape 하나로 캡슐화.

**Tech Stack:** Prisma + PostgreSQL, Express, Jest, React + TypeScript, exceljs.

**Related Plans / Specs:**
- `docs/superpowers/plans/2026-08-19-monthly-settlement-report.md` — 기존 monthly settlement (모델 미러 참조)
- `docs/superpowers/plans/2026-08-24-team-member-crud.md` — Department gate 패턴 + `isAdminLike` escape hatch 참조

---

## 🔴 Grill 결정 (2026-08-25)

**재논의 금지.**

### Q10: 자산+시설관리 combo gate 구현

- **선택 (a) + (γ):** 기존 `frontOfficeRole` 활용
  - 통과 조건: `frontOfficeRole in (ASSET_MANAGER, ASSET_STAFF, FACILITY_MANAGER, FACILITY_STAFF)`
  - γ: 팀 전원 (manager + staff) 접근 허용 (MVP)
  - Helper 캡슐화: `apps/api/src/lib/permissions.ts` 에 `canAccessAssetFacilityReport(user)` 추가
  - ADMIN / SUPER_ADMIN / GM 은 escape hatch (기존 `isAdminLike`)

### Q11: YearReport 모델 구조

- **선택 (a) + (α):**
  - (a) 별도 모델 `YearlySettlementReport` — `MonthlySettlementReport` 병렬
    - 이유: 프로덕션 monthly 리스크 회피. `(year, month)` unique 제약 문제 회피.
    - Approval / Excel 로직은 shared service 로 재사용.
  - (α) Fully manual 입력 (auto-aggregate 는 별도 plan)
  - Approval 라인: 기존 monthly 와 동일 3-step (재무 매니저 → 매니저 → 임원)

---

## Task 1: 착수 + 브랜치

- [ ] **Step 1: 관련 model 확인**
```bash
grep -B1 -A35 "^model MonthlySettlementReport\|^enum SettlementStatus" apps/api/prisma/schema.prisma
```
확인 사항:
- `MonthlySettlementReport` 필드 목록 (미러 기준)
- `SettlementStatus` enum 이미 존재 — 신규 enum 불필요

- [ ] **Step 2: permissions.ts 현황 확인**
```bash
grep -n "export\|canAccess\|isAdminLike\|frontOfficeRole" apps/api/src/lib/permissions.ts
```
기존 `canReadFinance` / `canWriteFinance` 패턴 확인 → `canAccessAssetFacilityReport` 동일 구조로 추가.

- [ ] **Step 3: 브랜치 생성**
```bash
git checkout -b feat/yearly-settlement-report
```

---

## Task 2: Prisma schema — `YearlySettlementReport` 신설

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `YearlySettlementReport` 모델 추가**

`MonthlySettlementReport` 필드 미러. 차이점:
- `year Int @unique` (month 없음 — 연간 단위)
- `@@unique([seasonId, year])`
- `revenueAdjustments` relation 는 이 plan 범위 밖 (연간 조정 별도 plan)

```prisma
model YearlySettlementReport {
  id       Int @id @default(autoincrement())
  seasonId Int
  year     Int

  status          SettlementStatus @default(DRAFT)
  rejectionReason String?

  totalRevenue Float @default(0)
  totalExpense Float @default(0)
  netIncome    Float @default(0)

  snapshotJson Json @default("{}")

  note String? @db.Text

  createdById        Int
  firstSubmittedById Int?
  firstSubmittedAt   DateTime?
  firstApproverId    Int?
  firstApprovedAt    DateTime?
  approverId         Int?
  approvedAt         DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  season           Season @relation(fields: [seasonId], references: [id])
  createdBy        User   @relation("YearlySettlementCreator", fields: [createdById], references: [id])
  firstSubmittedBy User?  @relation("YearlySettlementFirstSubmitter", fields: [firstSubmittedById], references: [id])
  firstApprover    User?  @relation("YearlySettlementFirstApprover", fields: [firstApproverId], references: [id])
  approver         User?  @relation("YearlySettlementApprover", fields: [approverId], references: [id])

  @@unique([seasonId, year])
}
```

- User 모델에 역관계 4개 추가:
  - `yearlySettlementsCreated        YearlySettlementReport[] @relation("YearlySettlementCreator")`
  - `yearlySettlementsFirstSubmitted YearlySettlementReport[] @relation("YearlySettlementFirstSubmitter")`
  - `yearlySettlementsFirstApproved  YearlySettlementReport[] @relation("YearlySettlementFirstApprover")`
  - `yearlySettlementsApproved       YearlySettlementReport[] @relation("YearlySettlementApprover")`
- Season 모델에 역관계 추가:
  - `yearlySettlements YearlySettlementReport[]`

- [ ] **Step 2: `prisma format` + `validate`**
```bash
cd apps/api && npx prisma format && npx prisma validate
```

- [ ] **Step 3: Commit**
```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add YearlySettlementReport model (parallel to monthly)"
```

---

## Task 3: Migration

- [ ] **Step 1: Create migration**
```bash
cd apps/api
npx prisma migrate dev --create-only --name yearly_settlement_report
```

- [ ] **Step 2: 로컬 apply**
```bash
npx prisma migrate deploy
```

- [ ] **Step 3: Commit**
```bash
git add apps/api/prisma/migrations/*_yearly_settlement_report/
git commit -m "feat(migration): create YearlySettlementReport table"
```

---

## Task 4: 백엔드 — yearly settlement CRUD + approval

**Files:**
- Create: `apps/api/src/yearly-settlement/yearly-settlement.repo.ts`
- Create: `apps/api/src/yearly-settlement/yearly-settlement.service.ts`
- Create: `apps/api/src/yearly-settlement/yearly-settlement.controller.ts`
- Create: `apps/api/src/yearly-settlement/yearly-settlement.routes.ts`
- Create: `apps/api/src/yearly-settlement/yearly-settlement.excel.ts`
- Modify: `apps/api/src/apiRouter.ts` — `/yearly-settlement` 라우트 등록
- Create: `apps/api/__test__/yearly-settlement/yearly-settlement.service.test.ts`

- [ ] **Step 1: Repository**
```typescript
// yearly-settlement.repo.ts
findAll(seasonId?: number): Promise<YearlySettlementReport[]>
findByYear(seasonId: number, year: number): Promise<YearlySettlementReport | null>
findById(id: number): Promise<YearlySettlementReport | null>
create(data: CreateDto): Promise<YearlySettlementReport>
update(id: number, data: UpdateDto, tx?: PrismaClient): Promise<YearlySettlementReport>
```

- [ ] **Step 2: Service — CRUD + approval 로직**

Approval 라인 (Q11 — monthly 동일 3-step):
- `DRAFT → PENDING_FIRST` (초안 제출: ASSET_MANAGER or FINANCE_STAFF or admin)
- `PENDING_FIRST → FIRST_APPROVED` (1차 승인: FINANCE_MANAGER or admin, self-approval 차단)
- `FIRST_APPROVED → APPROVED` (최종 승인: GM or admin, self-approval 차단)
- 모든 단계 `REJECTED` 가능 → `DRAFT` 복귀 + `rejectionReason` 저장

```typescript
async createDraft(data, requesterId, user): Promise<YearlySettlementReport> {
  if (!canAccessAssetFacilityReport(user) && !isAdminLike(user.role))
    throw new AppError(403, "FORBIDDEN");
  const existing = await this.repo.findByYear(data.seasonId, data.year);
  if (existing) throw new AppError(400, "ALREADY_EXISTS");
  return this.repo.create({ ...data, createdById: requesterId, status: "DRAFT" });
}

async updateDraft(id, data, requesterId, user): Promise<YearlySettlementReport> {
  const report = await this.assertFound(id);
  if (report.status !== "DRAFT") throw new AppError(400, "NOT_DRAFT");
  if (!canAccessAssetFacilityReport(user) && !isAdminLike(user.role))
    throw new AppError(403, "FORBIDDEN");
  return this.repo.update(id, data);
}

async submitFirst(id, requesterId, user) {
  const report = await this.assertFound(id);
  if (report.status !== "DRAFT") throw new AppError(400, "INVALID_STAGE");
  if (!canAccessAssetFacilityReport(user) && !isAdminLike(user.role))
    throw new AppError(403, "FORBIDDEN");
  return this.repo.update(id, {
    status: "PENDING_FIRST",
    firstSubmittedById: requesterId,
    firstSubmittedAt: new Date(),
  });
}

async approveFirst(id, requesterId, user) {
  const report = await this.assertFound(id);
  if (report.status !== "PENDING_FIRST") throw new AppError(400, "INVALID_STAGE");
  // self-approval 차단
  if (report.firstSubmittedById === requesterId) throw new AppError(403, "SELF_APPROVAL_FORBIDDEN");
  const foRole = user.frontOfficeRole;
  if (foRole !== "FINANCE_MANAGER" && !isAdminLike(user.role))
    throw new AppError(403, "FORBIDDEN");
  return this.repo.update(id, {
    status: "FIRST_APPROVED",
    firstApproverId: requesterId,
    firstApprovedAt: new Date(),
  });
}

async approveFinal(id, requesterId, user) {
  const report = await this.assertFound(id);
  if (report.status !== "FIRST_APPROVED") throw new AppError(400, "INVALID_STAGE");
  if (report.firstApproverId === requesterId) throw new AppError(403, "SELF_APPROVAL_FORBIDDEN");
  if (user.role !== "GM" && !isAdminLike(user.role)) throw new AppError(403, "FORBIDDEN");
  return this.repo.update(id, {
    status: "APPROVED",
    approverId: requesterId,
    approvedAt: new Date(),
  });
}

async reject(id, requesterId, reason, user) {
  const report = await this.assertFound(id);
  if (!["PENDING_FIRST", "FIRST_APPROVED"].includes(report.status))
    throw new AppError(400, "INVALID_STAGE");
  if (!isAdminLike(user.role) && user.role !== "GM" && user.frontOfficeRole !== "FINANCE_MANAGER")
    throw new AppError(403, "FORBIDDEN");
  return this.repo.update(id, { status: "DRAFT", rejectionReason: reason });
}

private async assertFound(id: number) {
  const r = await this.repo.findById(id);
  if (!r) throw new AppError(404, "NOT_FOUND");
  return r;
}
```

Shared approval helper 는 optional: monthly service 와 로직이 동일하다면 `apps/api/src/lib/reportApproval.ts` 로 extract. 별도가 더 단순하면 그대로 유지.

- [ ] **Step 3: Controller**
- `listReports`, `getReport`, `createDraft`, `updateDraft`, `submitFirst`, `approveFirst`, `approveFinal`, `reject`, `exportExcel`
- `requireUser(req)` 로 user 추출 후 service 전달

- [ ] **Step 4: Routes**
```typescript
router.get   ("/",                          auth, controller.listReports);
router.get   ("/:id",                       auth, controller.getReport);
router.post  ("/",                          auth, controller.createDraft);
router.patch ("/:id",                       auth, controller.updateDraft);
router.post  ("/:id/submit-first",          auth, controller.submitFirst);
router.post  ("/:id/approve-first",         auth, controller.approveFirst);
router.post  ("/:id/approve-final",         auth, controller.approveFinal);
router.post  ("/:id/reject",                auth, controller.reject);
router.get   ("/:id/export-excel",          auth, controller.exportExcel);
```

- [ ] **Step 5: Excel export**
- `yearly-settlement.excel.ts` — `exceljs` 사용, monthly excel util 참조
- 시트 구성: 수익 / 운영비 / P&L (monthly 동일 3시트 구조)

- [ ] **Step 6: Unit tests** — `apps/api/__test__/yearly-settlement/yearly-settlement.service.test.ts`
  - `createDraft`: permission gate 통과 / asset role 통과 / 중복 year → 400
  - `updateDraft`: DRAFT 아니면 400 / permission gate
  - `submitFirst`: DRAFT 아니면 400 / permission gate
  - `approveFirst`: PENDING_FIRST 아니면 400 / self-approval → 403 / FINANCE_MANAGER 통과 / admin 통과
  - `approveFinal`: FIRST_APPROVED 아니면 400 / self-approval (연속 승인) → 403 / GM 통과
  - `reject`: 유효 단계 통과 / DRAFT 에서 reject → 400 / reason 저장 확인
  - `canAccessAssetFacilityReport` 4개 role 각각 통과 / 그 외 403

- [ ] **Step 7: Commit**
```bash
git add apps/api/src/yearly-settlement/ apps/api/__test__/yearly-settlement/ apps/api/src/apiRouter.ts
git commit -m "feat(yearly-settlement): CRUD + 3-step approval + Excel export endpoints"
```

---

## Task 5: Permission helper

**Files:**
- Modify: `apps/api/src/lib/permissions.ts`

- [ ] **Step 1: `canAccessAssetFacilityReport` 추가**
```typescript
export const canAccessAssetFacilityReport = (user: Express.User): boolean =>
  isAdminLike(user.role) ||
  user.role === "GM" ||
  ["ASSET_MANAGER", "ASSET_STAFF", "FACILITY_MANAGER", "FACILITY_STAFF"].includes(
    user.frontOfficeRole ?? ""
  );
```
- `isAdminLike` escape hatch 포함 (Q10).
- `user.frontOfficeRole` 미지정 (null) 이면 접근 불가 — 의도된 semantic (Q10 γ).

- [ ] **Step 2: monthly-settlement routes 재검토**
- `apps/api/src/monthly-settlement/monthly-settlement.routes.ts` 확인
- monthly 는 FINANCE role 게이트 유지 (자산·시설 게이트 불필요). 변경 불필요 시 주석만 추가.

- [ ] **Step 3: Commit**
```bash
git add apps/api/src/lib/permissions.ts
git commit -m "feat(permissions): add canAccessAssetFacilityReport helper (Q10)"
```

---

## Task 6: Frontend

**Files:**
- Create: `football/src/types/yearly-settlement.ts`
- Create: `football/src/services/yearlySettlement.service.ts`
- Create: `football/src/pages/reports/YearlySettlementTab.tsx`
- Create: `football/src/pages/reports/YearlySettlementDetailPage.tsx`
- Modify: `football/src/pages/reports/ReportsPage.tsx` — `[연말 결산]` 탭 추가
- Modify: `football/src/router.tsx` — `/reports/yearly/:year` 라우트
- Modify: `football/src/layouts/AppShell.tsx` — nav 노출 조건

- [ ] **Step 1: Types + service**
```typescript
export const yearlySettlementApi = {
  list(seasonId?: number): Promise<YearlySettlementReport[]>,
  get(id: number): Promise<YearlySettlementReport>,
  createDraft(data: CreateYearlySettlementDto): Promise<YearlySettlementReport>,
  update(id: number, data: UpdateYearlySettlementDto): Promise<YearlySettlementReport>,
  submitFirst(id: number): Promise<void>,
  approveFirst(id: number): Promise<void>,
  approveFinal(id: number): Promise<void>,
  reject(id: number, reason: string): Promise<void>,
  exportExcel(id: number): Promise<void>,  // anchor download
}
```

- [ ] **Step 2: `YearlySettlementDetailPage`**
- 상단: 연도 + 시즌 + 상태 badge
- 수익·지출·순이익 입력 (DRAFT 상태에서만 편집 가능)
- 메모 (`note`) 텍스트 영역
- 승인 버튼 (stage 별 조건부 노출): 제출 / 1차 승인 / 최종 승인 / 반려
- Self-approval 버튼 비활성화 (FE 레벨 UX, BE 도 차단)
- Excel 다운로드 버튼
- Error code 매핑: `ALREADY_EXISTS`, `NOT_DRAFT`, `INVALID_STAGE`, `SELF_APPROVAL_FORBIDDEN`, `FORBIDDEN`

- [ ] **Step 3: `YearlySettlementTab` (목록)**
- year/seasonId 필터
- 상태별 색상 badge
- 상세 페이지 링크

- [ ] **Step 4: ReportsPage 탭 확장**
- `[월말 결산]` | `[연말 결산]` 탭 분리
- 연말 결산 탭 = `YearlySettlementTab`

- [ ] **Step 5: Nav 노출 조건**
```typescript
// AppShell.tsx
// "연말 결산" 메뉴 — canAccessAssetFacilityReport 조건 (FE 반영)
const showYearlySettlement =
  isAdminLike(user.role) ||
  user.role === "GM" ||
  ["ASSET_MANAGER", "ASSET_STAFF", "FACILITY_MANAGER", "FACILITY_STAFF"].includes(
    user.frontOfficeRole ?? ""
  );
```
- `<SelectItem label={...}>` 명시 (PR #336 패턴 준수)

- [ ] **Step 6: type-check + commit**
```bash
cd football && npm run type-check
git add football/src/
git commit -m "feat(fe/yearly-settlement): tab, detail page, approval UI, nav gate"
```

---

## Task 7: ADR 0017 + CONTEXT.md

**Files:**
- Create: `docs/adr/0017-yearly-settlement-report.md`
- Modify: `CONTEXT.md`

- [ ] **Step 1: ADR 0017**
- Context: `MonthlySettlementReport` 만 존재. 연말 결산 없음. 자산·시설 팀 전용 접근 게이트 미캡슐화.
- Decision:
  - `YearlySettlementReport` 별도 모델 — monthly 병렬 (프로덕션 monthly 리스크 회피)
  - Fully manual 입력 (auto-aggregate 는 별도 plan)
  - Approval 라인 monthly 동일 3-step (FINANCE_MANAGER → GM)
  - `canAccessAssetFacilityReport` helper — 4개 frontOfficeRole + admin escape
- Alternatives:
  - `MonthlySettlementReport` 에 `month=0` 컨벤션으로 yearly 표현 → rejected (`(year, month)` unique 제약 의미 훼손, 조회 복잡도 증가)
  - Auto-aggregate 12개월 → rejected (미결재/조정 항목 처리 복잡, MVP 범위 초과)
- Consequences (+): 프로덕션 monthly 無영향, 연말 결산 명시적 모델, 게이트 helper 재사용 가능
- Consequences (-): 두 모델 중복 유사 구조 — Approval/Excel shared service 로 완화 가능

- [ ] **Step 2: CONTEXT.md 확장**
- 기존 `## Reports / Settlement` 섹션 (또는 Finance 섹션) 에 소절 추가:
  - "YearlySettlementReport — MonthlySettlementReport 와 병렬 모델. `@@unique([seasonId, year])`. Fully manual."
  - "canAccessAssetFacilityReport — ASSET_MANAGER/ASSET_STAFF/FACILITY_MANAGER/FACILITY_STAFF + isAdminLike. permissions.ts."
  - "Yearly approval 라인: FINANCE_MANAGER(1차) → GM(최종). Self-approval 차단."

- [ ] **Step 3: Commit**
```bash
git add docs/adr/0017-yearly-settlement-report.md CONTEXT.md
git commit -m "docs: ADR 0017 yearly settlement + CONTEXT.md update"
```

---

## Task 8: 스모크 + PR

- [ ] **Step 1: tsc + jest**
```bash
cd apps/api && npx tsc --noEmit && npx jest --testPathPattern="yearly-settlement"
cd football && npm run type-check
```

- [ ] **Step 2: E2E 시나리오**
1. ASSET_MANAGER 로그인 → POST `/yearly-settlement` (year=2026) → DRAFT 생성 성공
2. ASSET_MANAGER → PATCH `/:id` (totalRevenue/totalExpense/note 수정) → 성공
3. ASSET_MANAGER → POST `/:id/submit-first` → `PENDING_FIRST`
4. FINANCE_MANAGER 로그인 → POST `/:id/approve-first` → `FIRST_APPROVED`
5. GM 로그인 → POST `/:id/approve-final` → `APPROVED`
6. FINANCE_MANAGER 가 approve-first 후 approve-final 시도 (self-approval) → 403
7. FACILITY_STAFF 로그인 → GET `/yearly-settlement` → 200 (gate 통과)
8. FINANCE_STAFF (asset/facility 아님) 로그인 → POST `/yearly-settlement` → 403
9. APPROVED 상태에서 PATCH 시도 → 400 NOT_DRAFT
10. GET `/:id/export-excel` → 200 + xlsx 파일

- [ ] **Step 3: PR 생성**

---

## 위험 / 안전 노트

1. **MonthlySettlementReport 변경 금지** — 프로덕션 모델. `YearlySettlementReport` 는 완전 신규.
2. **Shared approval helper 는 optional** — over-engineering 방지. monthly 와 별도 service 가 더 단순하면 그대로 유지.
3. **Permission helper frontOfficeRole null 처리** — `user.frontOfficeRole` 미지정 유저는 접근 불가. 의도된 semantic (Q10 γ). role=FRONT_OFFICE 여도 frontOfficeRole 없으면 차단.
4. **12개월 auto-aggregate 는 이 plan 범위 밖** — 일부 미결재/조정 항목 존재. 별도 plan 필요.
5. **Self-approval 차단 2곳** — `approveFirst` (firstSubmittedById 검증) / `approveFinal` (firstApproverId 검증). BE + FE 양쪽 차단.
6. **`@@unique([seasonId, year])` 제약** — 동일 season + year 중복 생성 방지. 수동 재생성 필요 시 기존 삭제 후 재생성 (또는 update 사용).

---

## Non-goals (Follow-up)

- Auto-aggregate 12 monthly → yearly draft (조정 항목 처리 포함)
- Year-end 조정 항목 (accrual, deferral 등) UI
- Yearly settlement 대비 monthly 재분류 자동 fill
- Historical trend (연도별 비교 대시보드)
- Excel 대신 PDF export
- `YearlyRevenueAdjustment` (연간 수익 조정 항목) — 별도 plan

---

## Self-Review

**Grill decision coverage:**
- Q10 (asset+facility gate helper) → Task 5 `canAccessAssetFacilityReport` + Task 6 nav 조건
- Q11 (별도 모델 + fully manual) → Task 2 schema + Task 4 service (`createDraft` — auto-aggregate 없음)
- Q11 approval 라인 (monthly 동일 3-step) → Task 4 `approveFirst` / `approveFinal`

**Safety:**
- MonthlySettlementReport 無변경 (병렬 신규 모델)
- Self-approval 2단계 차단
- Permission helper null-safe (`?? ""`)
- `@@unique([seasonId, year])` 중복 방지
