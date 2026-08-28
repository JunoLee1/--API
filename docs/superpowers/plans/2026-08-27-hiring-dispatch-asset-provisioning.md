# HiringDispatch → AssetRequest 자동 프로비저닝 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `HiringDispatch.dispatch()` 성공 후 신입 계정으로 부서별 기본 자산 (노트북·사원증·유니폼 등) `AssetRequest` DRAFT 를 자동 생성하여 온보딩 자산 지급 누락 방지. 재고 부족 항목은 ASSET_MANAGER 에게 알림.

**Architecture:** 신규 `DepartmentDefaultAssetKit` 모델(부서별 default 자산 리스트) + `hiring-dispatch.service.ts:dispatch()` 성공 후 `provisionNewEmployeeAssets(dispatchId)` fire-and-forget hook. 재고 확인은 조달(FULFILLED) 단계에서 처리 — provisioning 은 draft 만 생성.

**Tech Stack:** Prisma, TypeScript, Express, jest.

**Scope (MVP):**
- `DepartmentDefaultAssetKit` 모델 + 관리 endpoint
- `dispatch()` 성공 후 fire-and-forget hook (실패해도 dispatch 롤백 안 함)
- 신입 계정 (`createdUserId`) 으로 `AssetRequest.status = DRAFT` 자동 생성
- 재고 부족 항목 ASSET_MANAGER 알림 발송
- 재고 확인은 조달 단계 (기존 AssetRequest FULFILLED 흐름)
- **`WAITING_STOCK` 새 상태 — 후속 이슈** (asset-request 워크플로우 전체 개선)
- **후보자 서명·확인 기능 — 후속 이슈** (candidate portal)

---

## File Structure

**Backend (new):**
- `apps/api/src/department-asset-kit/department-asset-kit.controller.ts`
- `apps/api/src/department-asset-kit/department-asset-kit.service.ts`
- `apps/api/src/department-asset-kit/department-asset-kit.repo.ts`
- `apps/api/src/department-asset-kit/department-asset-kit.routes.ts`
- `apps/api/src/hiring-dispatch/provision-assets.ts` — provisioning job
- `apps/api/__test__/department-asset-kit/department-asset-kit.service.test.ts`
- `apps/api/__test__/hiring-dispatch/provision-assets.test.ts`
- `apps/api/prisma/migrations/20260827020000_add_department_asset_kit/migration.sql`

**Backend (modified):**
- `apps/api/prisma/schema.prisma` — `DepartmentDefaultAssetKit` + Department/User relations
- `apps/api/src/hiring-dispatch/hiring-dispatch.service.ts` — dispatch 성공 후 hook 추가
- `apps/api/src/server.ts` — route 등록
- `apps/api/src/lib/notifications.ts` (또는 유사) — `PROVISIONING_LOW_STOCK` 알림 타입

**Frontend (new):**
- `football/src/pages/asset/DepartmentAssetKitPage.tsx` — 부서별 default kit 관리 UI (ADMIN·ASSET_MANAGER)
- `football/src/services/department-asset-kit.service.ts`
- `football/src/types/department-asset-kit.ts`

**Frontend (modified):**
- `football/src/pages/asset/AssetRequestListPage.tsx` — DRAFT 자동 생성건 배지 (`isAutoProvisioned` 표시)

---

## Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260827020000_add_department_asset_kit/migration.sql`

- [ ] **Step 1: Model 추가**

```prisma
model DepartmentDefaultAssetKit {
  id                       Int      @id @default(autoincrement())
  departmentId             Int      @unique
  assetItems               Json     // [{equipmentItemId: number, quantity: number, note?: string}]
  defaultExpenseCategoryId Int      // 자동 생성 draft 의 expenseCategoryId 기본값
  createdById              Int
  updatedById              Int?
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  department      Department      @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  expenseCategory ExpenseCategory @relation(fields: [defaultExpenseCategoryId], references: [id])
  createdBy       User            @relation("DeptKitCreator", fields: [createdById], references: [id])
  updatedBy       User?           @relation("DeptKitUpdater", fields: [updatedById], references: [id])
}
```

- [ ] **Step 2: 관련 모델에 relation 추가**

```prisma
model Department {
  // ... 기존
  defaultAssetKit DepartmentDefaultAssetKit?
}

model ExpenseCategory {
  // ... 기존
  defaultAssetKits DepartmentDefaultAssetKit[]
}

model User {
  // ... 기존
  createdDeptKits DepartmentDefaultAssetKit[] @relation("DeptKitCreator")
  updatedDeptKits DepartmentDefaultAssetKit[] @relation("DeptKitUpdater")
}

model AssetRequest {
  // ... 기존
  isAutoProvisioned Boolean @default(false)  // 자동 생성 여부
  provisionedFromDispatchId Int?             // 어떤 dispatch 로부터 생성됐는지 추적
  provisionedFromDispatch HiringDispatch? @relation("DispatchProvisioned", fields: [provisionedFromDispatchId], references: [id], onDelete: SetNull)
}

model HiringDispatch {
  // ... 기존
  provisionedAssetRequests AssetRequest[] @relation("DispatchProvisioned")
}
```

- [ ] **Step 3: 마이그레이션 SQL**

```sql
-- CreateTable
CREATE TABLE "DepartmentDefaultAssetKit" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "assetItems" JSONB NOT NULL,
    "defaultExpenseCategoryId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentDefaultAssetKit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepartmentDefaultAssetKit_departmentId_key"
  ON "DepartmentDefaultAssetKit"("departmentId");

ALTER TABLE "AssetRequest"
  ADD COLUMN "isAutoProvisioned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "provisionedFromDispatchId" INTEGER;

CREATE INDEX "AssetRequest_provisionedFromDispatchId_idx"
  ON "AssetRequest"("provisionedFromDispatchId");

-- FKs
ALTER TABLE "DepartmentDefaultAssetKit"
  ADD CONSTRAINT "DepartmentDefaultAssetKit_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE;

ALTER TABLE "DepartmentDefaultAssetKit"
  ADD CONSTRAINT "DepartmentDefaultAssetKit_defaultExpenseCategoryId_fkey"
  FOREIGN KEY ("defaultExpenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT;

ALTER TABLE "DepartmentDefaultAssetKit"
  ADD CONSTRAINT "DepartmentDefaultAssetKit_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT;

ALTER TABLE "DepartmentDefaultAssetKit"
  ADD CONSTRAINT "DepartmentDefaultAssetKit_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "AssetRequest"
  ADD CONSTRAINT "AssetRequest_provisionedFromDispatchId_fkey"
  FOREIGN KEY ("provisionedFromDispatchId") REFERENCES "HiringDispatch"("id") ON DELETE SET NULL;
```

- [ ] **Step 4: `pnpm --filter api prisma generate` + migrate dev**

---

## Task 2: DepartmentAssetKit 모듈 (CRUD)

**Files:** `apps/api/src/department-asset-kit/*`

- [ ] **Step 1: DTO + Service**

```typescript
// dto/upsert.dto.ts
export const AssetItemSchema = z.object({
  equipmentItemId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
  note: z.string().max(200).optional(),
});

export const UpsertKitSchema = z.object({
  assetItems: z.array(AssetItemSchema).min(1),
  defaultExpenseCategoryId: z.number().int().positive(),
});
```

```typescript
// department-asset-kit.service.ts
export async function upsert(departmentId: number, input: UpsertKit, actorId: number) {
  // EquipmentItem 존재 검증
  const itemIds = input.assetItems.map(i => i.equipmentItemId);
  const items = await prisma.equipmentItem.findMany({ where: { id: { in: itemIds } } });
  if (items.length !== new Set(itemIds).size) {
    throw new HttpError(400, "EQUIPMENT_ITEM_NOT_FOUND");
  }

  return prisma.departmentDefaultAssetKit.upsert({
    where: { departmentId },
    create: {
      departmentId,
      assetItems: input.assetItems,
      defaultExpenseCategoryId: input.defaultExpenseCategoryId,
      createdById: actorId,
    },
    update: {
      assetItems: input.assetItems,
      defaultExpenseCategoryId: input.defaultExpenseCategoryId,
      updatedById: actorId,
    },
  });
}

export async function get(departmentId: number) {
  return prisma.departmentDefaultAssetKit.findUnique({
    where: { departmentId },
    include: { expenseCategory: true },
  });
}

export async function remove(departmentId: number) {
  return prisma.departmentDefaultAssetKit.delete({ where: { departmentId } });
}
```

- [ ] **Step 2: Routes**

```typescript
router.get("/:departmentId/kit", auth, requireRoles(["ADMIN", "ASSET_MANAGER", "HR_MANAGER"]), controller.get);
router.put("/:departmentId/kit", auth, requireRoles(["ADMIN", "ASSET_MANAGER"]), controller.upsert);
router.delete("/:departmentId/kit", auth, requireRoles(["ADMIN", "ASSET_MANAGER"]), controller.remove);
```

- [ ] **Step 3: 단위 테스트**
- upsert: 신규 create + 기존 update
- EquipmentItem 존재 검증 실패 → 400
- 권한 검증

---

## Task 3: Provisioning Hook (dispatch 성공 후)

**Files:**
- Create: `apps/api/src/hiring-dispatch/provision-assets.ts`
- Modify: `apps/api/src/hiring-dispatch/hiring-dispatch.service.ts`

- [ ] **Step 1: provision-assets.ts 작성**

```typescript
import { prisma } from "../lib/prisma";
import { notifyAssetManagers } from "../lib/notifications";

interface KitItem {
  equipmentItemId: number;
  quantity: number;
  note?: string;
}

export async function provisionNewEmployeeAssets(dispatchId: number): Promise<void> {
  const dispatch = await prisma.hiringDispatch.findUnique({
    where: { id: dispatchId },
    include: { department: true },
  });
  if (!dispatch || !dispatch.createdUserId) return;

  const kit = await prisma.departmentDefaultAssetKit.findUnique({
    where: { departmentId: dispatch.departmentId },
  });
  if (!kit) return;  // 부서에 default kit 미설정 → skip

  const items = kit.assetItems as unknown as KitItem[];
  if (items.length === 0) return;

  const stockLevels = await prisma.equipmentItem.findMany({
    where: { id: { in: items.map(i => i.equipmentItemId) } },
    select: { id: true, name: true, quantity: true, trackedIndividually: true },
  });

  const lowStock: string[] = [];
  const createdRequests: number[] = [];

  for (const kitItem of items) {
    const stock = stockLevels.find(s => s.id === kitItem.equipmentItemId);
    if (!stock) continue;  // 삭제된 EquipmentItem — skip

    // Draft 생성 (재고 무관)
    const created = await prisma.assetRequest.create({
      data: {
        requesterId: dispatch.createdUserId,
        departmentId: dispatch.departmentId,
        type: 'HARDWARE',
        status: 'DRAFT',
        equipmentItemId: kitItem.equipmentItemId,
        expenseCategoryId: kit.defaultExpenseCategoryId,
        expectedAmount: 0,  // 신입이 draft 편집 시 입력
        justification: `신입 자동 프로비저닝 (${dispatch.candidateName ?? "N/A"})${kitItem.note ? ` — ${kitItem.note}` : ""}`,
        isAutoProvisioned: true,
        provisionedFromDispatchId: dispatchId,
      },
    });
    createdRequests.push(created.id);

    // 재고 부족 체크
    let shortage = false;
    if (!stock.trackedIndividually) {
      if ((stock.quantity ?? 0) < kitItem.quantity) {
        lowStock.push(`${stock.name} (재고 ${stock.quantity ?? 0}, 요청 ${kitItem.quantity})`);
        shortage = true;
      }
    } else {
      const availableUnits = await prisma.equipmentUnit.count({
        where: { equipmentItemId: stock.id, status: 'AVAILABLE' },
      });
      if (availableUnits < kitItem.quantity) {
        lowStock.push(`${stock.name} (가용 unit ${availableUnits}, 요청 ${kitItem.quantity})`);
        shortage = true;
      }
    }
  }

  if (lowStock.length > 0) {
    await notifyAssetManagers({
      type: 'PROVISIONING_LOW_STOCK',
      dispatchId,
      candidateName: dispatch.candidateName ?? undefined,
      shortageItems: lowStock,
      createdRequests,
    }).catch(err => console.error("Failed to notify asset managers", err));
  }
}
```

- [ ] **Step 2: `hiring-dispatch.service.ts:dispatch()` 에 hook 추가**

기존 `dispatch()` 의 `prisma.$transaction` 커밋 이후 (fire-and-forget 알림 위치와 동일 지점) 삽입:

```typescript
export async function dispatch(dispatchId: number, ...) {
  const result = await prisma.$transaction(async tx => {
    // ... 기존 원자적 실행 (PhoneNumber → User → UserDepartment → StaffRecord → Onboarding)
  });

  // 기존 fire-and-forget 알림들 (팀장·HR 등) 뒤에 추가
  provisionNewEmployeeAssets(dispatchId).catch(err =>
    console.error("[provisionNewEmployeeAssets] failed", err)
  );

  return result;
}
```

- [ ] **Step 3: `notifications.ts` 에 `PROVISIONING_LOW_STOCK` 타입 추가**

기존 알림 인프라 확인 후 새 타입 추가. ASSET_MANAGER 역할 유저 전원에게 인앱 알림.

- [ ] **Step 4: 통합 테스트**

`__test__/hiring-dispatch/provision-assets.test.ts`:
- Kit 미설정 부서 → provisioning skip (에러 없음)
- Kit 있음 + 재고 충분 → AssetRequest DRAFT N개 생성, 알림 없음
- Kit 있음 + 재고 부족 (quantity-based) → DRAFT 생성 + 알림 발송
- Kit 있음 + 재고 부족 (trackedIndividually) → DRAFT 생성 + 알림 발송
- 삭제된 EquipmentItem 포함 → skip (예외 없음)
- Provisioning 실패해도 dispatch 성공 (fire-and-forget 검증 — dispatch 결과 확인)
- `isAutoProvisioned = true` + `provisionedFromDispatchId` 확인

---

## Task 4: Frontend — DepartmentAssetKit 관리 페이지

**Files:**
- `football/src/pages/asset/DepartmentAssetKitPage.tsx`
- `football/src/services/department-asset-kit.service.ts`
- `football/src/types/department-asset-kit.ts`

- [ ] **Step 1: Type + Service**

```typescript
export interface DepartmentDefaultAssetKit {
  id: number;
  departmentId: number;
  assetItems: { equipmentItemId: number; quantity: number; note?: string }[];
  defaultExpenseCategoryId: number;
  expenseCategory: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: DepartmentAssetKitPage**

- URL: `/asset/departments/:departmentId/kit`
- 표시: 현재 kit 항목 (EquipmentItem 이름·수량·note)
- 편집: 항목 추가/삭제 (EquipmentItem dropdown), 수량 조정, defaultExpenseCategory 선택
- Save → upsert API

- [ ] **Step 3: AssetRequestListPage 에 배지 추가**

- `isAutoProvisioned = true` 인 draft 에 "자동 프로비저닝" 배지
- 프로비저닝 dispatch 링크 (`/hr/dispatches/:id`)

---

## Task 5: 문서화

- [ ] **Step 1: `CONTEXT.md` 갱신**

- `## 자산 신청 워크플로우 (Asset Request)` 아래 서브섹션 추가: `### DepartmentDefaultAssetKit (부서 기본 자산 세트)` 및 자동 프로비저닝 흐름 명시
- `## 채용 발령 (Hiring Dispatch)` 섹션에 "dispatch 성공 후 fire-and-forget provisioning" 언급 추가

- [ ] **Step 2: 후속 이슈 스텁 생성**

- (a) "AssetRequest 재고 대기 상태 (WAITING_STOCK) 도입" — `#373` 참조, ASSET_MANAGER 조달 큐 대시보드 포함
- (b) "신입 자동 프로비저닝 draft 편집 UI 개선" — `#373` 참조, 신입 로그인 후 draft 검토·submit UX

---

## 검증 체크리스트

- [ ] `pnpm --filter api tsc --noEmit`
- [ ] `pnpm --filter api test department-asset-kit`
- [ ] `pnpm --filter api test provision-assets`
- [ ] Manual: 부서 kit 생성 → dispatch 실행 → 신입 계정으로 DRAFT AssetRequest N개 확인
- [ ] Manual: 재고 부족 항목 → ASSET_MANAGER 알림 수신 확인
- [ ] Manual: kit 없는 부서 dispatch → 에러 없이 dispatch 성공
- [ ] Manual: provisioning 실패 시나리오 (예: EquipmentItem FK 위반) → dispatch 성공, 로그만 남음

---

## Rollback

- 기존 코드 영향 없음 (신규 hook 만 추가)
- `provisionNewEmployeeAssets()` 호출 라인 주석 처리로 즉시 비활성화 가능
- Migration 롤백: `DepartmentDefaultAssetKit` drop, `AssetRequest.isAutoProvisioned` / `provisionedFromDispatchId` drop

---

## Grill 결정 요약

**이전 그릴 (a1-f1, 2026-08-27 배치3 Cluster D):**

| # | 결정 |
|---|---|
| a1 | Default kit = 신규 `DepartmentDefaultAssetKit` 모델 (`departmentId + assetItems Json[] + defaultExpenseCategoryId`) |
| b1 | Trigger = `HiringDispatch.dispatch()` 성공 hook |
| c1 | Fire-and-forget outside dispatch tx (실패해도 dispatch 롤백 안 함) |
| d1 | 신입 계정으로 자동 생성 (`requesterId = 신입.userId`), `status = DRAFT` (신입 편집·제출) |
| e1 | ~~재고 없어도 draft 에 포함~~ → **재그릴 (Q1) 확정 아래 참조** |
| f1 | 예산 = 기존 AssetRequest 검증 재사용 (submit 시점 검증) |

**재그릴 (Q1, 2026-08-27):**

| # | 결정 |
|---|---|
| Q1 | 재고 무시 + draft 모두 생성 + ASSET_MANAGER 부족 알림 fire-and-forget. `WAITING_STOCK` 상태 도입은 후속 이슈로 분리 |
