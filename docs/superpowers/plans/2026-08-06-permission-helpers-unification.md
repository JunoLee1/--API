# Permission Helpers Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 흩어진 role/foRole 권한 체크를 `permissions.ts`의 중앙 헬퍼로 통일하고, SUPER_ADMIN 전용 게이트를 명확히 분리한다.

**Architecture:** `permissions.ts`에 `requireSuperAdmin`, `canReadFinance`, `canWriteFinance`, `canReadHR`, `canWriteHR`, `canManageTD` 6개 헬퍼를 추가한다. Admin controller의 DELETE/setDemoStatus를 `requireSuperAdmin`으로 교체하고, Admin service에서 중복 SUPER_ADMIN 체크를 제거한다. 이후 payroll·financial·HR·coach·recruitment 컨트롤러에서 인라인 패턴을 헬퍼로 교체한다.

**Tech Stack:** Express, TypeScript, Jest

---

## File Map

| 파일 | 변경 내용 |
|------|----------|
| `apps/api/src/lib/permissions.ts` | 헬퍼 6개 추가 |
| `apps/api/__test__/lib/permissions.test.ts` | 헬퍼 테스트 추가 |
| `apps/api/src/admin/admin.controller.ts` | deleteUser → requireSuperAdmin, setDemoStatus → requireSuperAdmin |
| `apps/api/src/admin/admin.service.ts` | setDemoStatus에서 requesterRole 파라미터 제거 |
| `apps/api/__test__/admin/admin.service.test.ts` | setDemoStatus 테스트 업데이트 |
| `apps/api/src/payroll/salary/salary.controller.ts` | canWriteFinance |
| `apps/api/src/payroll/allowance/allowance.controller.ts` | canWriteFinance |
| `apps/api/src/payroll/config/config.controller.ts` | canWriteFinance |
| `apps/api/src/payroll/run/run.controller.ts` | canWriteFinance |
| `apps/api/src/financial-report/financial-report.controller.ts` | canWriteFinance / canReadFinance |
| `apps/api/src/operating-expense/operating-expense.controller.ts` | canReadFinance / canWriteFinance |
| `apps/api/src/sponsorship/sponsorship.controller.ts` | canWriteFinance |
| `apps/api/src/meal-expense/meal-expense.controller.ts` | canReadFinance / canWriteFinance |
| `apps/api/src/report/report.controller.ts` | canReadFinance / canWriteFinance / canReadHR / canWriteHR |
| `apps/api/src/hr/hr.routes.ts` | canReadHR |
| `apps/api/src/hr-report/hr-report.routes.ts` | canReadHR |
| `apps/api/src/hiring-automation/hiring-automation.routes.ts` | canReadHR / canWriteHR |
| `apps/api/src/recruitment/recruitment.controller.ts` | canWriteHR / canManageTD |
| `apps/api/src/coach/coach.controller.ts` | canManageTD |

---

### Task 1: permissions.ts — 헬퍼 6개 추가 (TDD)

**Files:**
- Modify: `apps/api/src/lib/permissions.ts`
- Modify: `apps/api/__test__/lib/permissions.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/__test__/lib/permissions.test.ts`의 기존 내용을 유지하고 아래 블록을 맨 끝에 추가:

```typescript
describe("requireSuperAdmin", () => {
  const { requireSuperAdmin } = require("../../src/lib/permissions");
  const { AppError } = require("../../src/lib/appError");

  test("SUPER_ADMIN이면 throw 없음", () => {
    expect(() => requireSuperAdmin({ user: { role: "SUPER_ADMIN" } } as any)).not.toThrow();
  });

  test("ADMIN이면 403", () => {
    expect(() => requireSuperAdmin({ user: { role: "ADMIN" } } as any)).toThrow(AppError);
  });

  test("user 없으면 403", () => {
    expect(() => requireSuperAdmin({} as any)).toThrow(AppError);
  });
});

describe("canReadFinance", () => {
  const { canReadFinance } = require("../../src/lib/permissions");

  test("ADMIN → true", () => expect(canReadFinance("ADMIN", null)).toBe(true));
  test("SUPER_ADMIN → true", () => expect(canReadFinance("SUPER_ADMIN", null)).toBe(true));
  test("GM → true", () => expect(canReadFinance("GM", null)).toBe(true));
  test("FRONT_OFFICE + FINANCE_MANAGER → true", () => expect(canReadFinance("FRONT_OFFICE", "FINANCE_MANAGER")).toBe(true));
  test("FRONT_OFFICE + FINANCE_STAFF → true", () => expect(canReadFinance("FRONT_OFFICE", "FINANCE_STAFF")).toBe(true));
  test("FRONT_OFFICE + TD → false", () => expect(canReadFinance("FRONT_OFFICE", "TD")).toBe(false));
  test("COACHING_STAFF → false", () => expect(canReadFinance("COACHING_STAFF", null)).toBe(false));
});

describe("canWriteFinance", () => {
  const { canWriteFinance } = require("../../src/lib/permissions");

  test("ADMIN → true", () => expect(canWriteFinance("ADMIN", null)).toBe(true));
  test("GM → true", () => expect(canWriteFinance("GM", null)).toBe(true));
  test("FRONT_OFFICE + FINANCE_MANAGER → true", () => expect(canWriteFinance("FRONT_OFFICE", "FINANCE_MANAGER")).toBe(true));
  test("FRONT_OFFICE + FINANCE_STAFF → false", () => expect(canWriteFinance("FRONT_OFFICE", "FINANCE_STAFF")).toBe(false));
  test("FRONT_OFFICE + TD → false", () => expect(canWriteFinance("FRONT_OFFICE", "TD")).toBe(false));
});

describe("canReadHR", () => {
  const { canReadHR } = require("../../src/lib/permissions");

  test("ADMIN → true", () => expect(canReadHR("ADMIN", null)).toBe(true));
  test("GM → true", () => expect(canReadHR("GM", null)).toBe(true));
  test("FRONT_OFFICE + HR_MANAGER → true", () => expect(canReadHR("FRONT_OFFICE", "HR_MANAGER")).toBe(true));
  test("FRONT_OFFICE + HR_STAFF → true", () => expect(canReadHR("FRONT_OFFICE", "HR_STAFF")).toBe(true));
  test("FRONT_OFFICE + TD → false", () => expect(canReadHR("FRONT_OFFICE", "TD")).toBe(false));
  test("PLAYER → false", () => expect(canReadHR("PLAYER", null)).toBe(false));
});

describe("canWriteHR", () => {
  const { canWriteHR } = require("../../src/lib/permissions");

  test("ADMIN → true", () => expect(canWriteHR("ADMIN", null)).toBe(true));
  test("GM → true", () => expect(canWriteHR("GM", null)).toBe(true));
  test("FRONT_OFFICE + HR_MANAGER → true", () => expect(canWriteHR("FRONT_OFFICE", "HR_MANAGER")).toBe(true));
  test("FRONT_OFFICE + HR_STAFF → false", () => expect(canWriteHR("FRONT_OFFICE", "HR_STAFF")).toBe(false));
});

describe("canManageTD", () => {
  const { canManageTD } = require("../../src/lib/permissions");

  test("ADMIN → true", () => expect(canManageTD("ADMIN", null)).toBe(true));
  test("GM → true", () => expect(canManageTD("GM", null)).toBe(true));
  test("FRONT_OFFICE + TD → true", () => expect(canManageTD("FRONT_OFFICE", "TD")).toBe(true));
  test("FRONT_OFFICE + HR_MANAGER → false", () => expect(canManageTD("FRONT_OFFICE", "HR_MANAGER")).toBe(false));
  test("COACHING_STAFF → false", () => expect(canManageTD("COACHING_STAFF", null)).toBe(false));
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/lib/permissions.test.ts --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `requireSuperAdmin is not a function` 등

- [ ] **Step 3: `permissions.ts` 구현**

`apps/api/src/lib/permissions.ts` 전체를 아래로 교체:

```typescript
import { Request } from "express";
import { Role } from '../generated/enums'
import { AppError } from './appError'

export const Permission = {
  SYSTEM_MANAGE: 'SYSTEM_MANAGE',
  FINANCE_APPROVE: 'FINANCE_APPROVE',
  VIEW_TEAM_RANKING: 'VIEW_TEAM_RANKING',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [Permission.SYSTEM_MANAGE, Permission.FINANCE_APPROVE, Permission.VIEW_TEAM_RANKING],
  SUPER_ADMIN: [Permission.SYSTEM_MANAGE, Permission.FINANCE_APPROVE, Permission.VIEW_TEAM_RANKING],
  GM: [Permission.FINANCE_APPROVE, Permission.VIEW_TEAM_RANKING],
  FRONT_OFFICE: [Permission.VIEW_TEAM_RANKING],
  COACHING_STAFF: [Permission.VIEW_TEAM_RANKING],
  PLAYER: [Permission.VIEW_TEAM_RANKING],
  AGENT: [],
  GUARDIAN: [],
}

export const isSuperAdmin = (user: Express.User): boolean =>
  user.role === 'SUPER_ADMIN'

export const isAdminLike = (role: string): boolean =>
  role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'GM'

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function requireSuperAdmin(req: Request): void {
  if (req.user?.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'FORBIDDEN')
  }
}

export const canReadFinance = (role: string, foRole?: string | null): boolean =>
  isAdminLike(role) ||
  (role === 'FRONT_OFFICE' && (foRole === 'FINANCE_MANAGER' || foRole === 'FINANCE_STAFF'))

export const canWriteFinance = (role: string, foRole?: string | null): boolean =>
  isAdminLike(role) ||
  (role === 'FRONT_OFFICE' && foRole === 'FINANCE_MANAGER')

export const canReadHR = (role: string, foRole?: string | null): boolean =>
  isAdminLike(role) ||
  (role === 'FRONT_OFFICE' && (foRole === 'HR_MANAGER' || foRole === 'HR_STAFF'))

export const canWriteHR = (role: string, foRole?: string | null): boolean =>
  isAdminLike(role) ||
  (role === 'FRONT_OFFICE' && foRole === 'HR_MANAGER')

export const canManageTD = (role: string, foRole?: string | null): boolean =>
  isAdminLike(role) ||
  (role === 'FRONT_OFFICE' && foRole === 'TD')
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/lib/permissions.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS (모든 테스트)

- [ ] **Step 5: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/src/lib/permissions.ts apps/api/__test__/lib/permissions.test.ts
git commit -m "feat: add requireSuperAdmin and domain permission helpers to permissions.ts"
```

---

### Task 2: admin controller + service — SUPER_ADMIN 전용 게이트 정리

**Files:**
- Modify: `apps/api/src/admin/admin.controller.ts`
- Modify: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/__test__/admin/admin.service.test.ts`

- [ ] **Step 1: admin.service.ts — setDemoStatus에서 requesterRole 파라미터 제거**

`setDemoStatus` 메서드를 아래로 교체 (SUPER_ADMIN 체크는 controller로 이동):

```typescript
async setDemoStatus(id: number, dto: SetDemoDto, requesterId: number) {
  if (id === requesterId) throw new AppError(403, "CANNOT_MODIFY_SELF");

  const user = await this.repo.findById(id);
  if (!user) throw new AppError(404, "USER_NOT_FOUND");

  return this.repo.setDemo(id, dto.isDemo);
}
```

- [ ] **Step 2: admin.service.test.ts — setDemoStatus 테스트 업데이트**

`describe("AdminService - setDemoStatus")`블록을 아래로 교체:

```typescript
describe("AdminService - setDemoStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  test("자기 자신에게는 설정 불가 → 403", async () => {
    await expect(service.setDemoStatus(1, { isDemo: true }, 1)).rejects.toMatchObject({
      statusCode: 403,
      code: "CANNOT_MODIFY_SELF",
    });
  });

  test("대상 유저 없으면 404", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.setDemoStatus(2, { isDemo: true }, 1)).rejects.toMatchObject({
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  });

  test("isDemo 설정 성공", async () => {
    mockRepo.findById.mockResolvedValue({ id: 2, isDemo: false });
    mockRepo.setDemo.mockResolvedValue({ id: 2, isDemo: true });
    const result = await service.setDemoStatus(2, { isDemo: true }, 1);
    expect(mockRepo.setDemo).toHaveBeenCalledWith(2, true);
    expect(result.isDemo).toBe(true);
  });
});
```

- [ ] **Step 3: admin.controller.ts — deleteUser + setDemoStatus 교체**

`deleteUser` 핸들러 내부:
```typescript
deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireSuperAdmin(req);
    await this.service.deleteUser(Number(req.params["id"]), req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
```

`setDemoStatus` 핸들러 내부:
```typescript
setDemoStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireSuperAdmin(req);
    const targetId = Number(req.params["id"]);
    const dto: SetDemoDto = { isDemo: Boolean(req.body.isDemo) };
    const result = await this.service.setDemoStatus(targetId, dto, req.user!.id);
    await writeAuditLog({
      actorId: req.user!.id,
      action: "DEMO_STATUS_UPDATE",
      targetId,
      detail: { isDemo: dto.isDemo },
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
```

`import` 라인에 `requireSuperAdmin` 추가:
```typescript
import { hasPermission, Permission, requireSuperAdmin } from "../lib/permissions";
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/admin/admin.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS (기존 통과 테스트 유지 + setDemoStatus 3개 통과)

- [ ] **Step 5: 타입 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | tail -5
```

Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/src/admin/admin.controller.ts apps/api/src/admin/admin.service.ts apps/api/__test__/admin/admin.service.test.ts
git commit -m "refactor: move SUPER_ADMIN gate to controller for deleteUser and setDemoStatus"
```

---

### Task 3: Payroll controllers — canWriteFinance 교체

**Files:**
- Modify: `apps/api/src/payroll/salary/salary.controller.ts`
- Modify: `apps/api/src/payroll/allowance/allowance.controller.ts`
- Modify: `apps/api/src/payroll/config/config.controller.ts`
- Modify: `apps/api/src/payroll/run/run.controller.ts`

4개 파일 모두 동일한 패턴입니다. 각 파일에서:

**1. import 교체:** `import { isAdminLike } from "../../lib/permissions"` → `import { canWriteFinance } from "../../lib/permissions"`

**2. canWrite 함수 교체:**
```typescript
// 기존
const canWrite = (role: string, foRole: string | null | undefined) =>
  isAdminLike(role) || (role === "FRONT_OFFICE" && foRole === "FINANCE_MANAGER");

// 교체 후
const canWrite = (role: string, foRole: string | null | undefined) =>
  canWriteFinance(role, foRole);
```

`run.controller.ts`만 `canConfirm`도 있습니다 — 건드리지 않습니다.

- [ ] **Step 1: 4개 파일 수정**

각 파일 import와 canWrite 함수를 위 패턴으로 수정.

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | tail -5
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/src/payroll/
git commit -m "refactor: replace inline finance checks with canWriteFinance in payroll controllers"
```

---

### Task 4: Financial report + Operating expense + Sponsorship + Meal expense

**Files:**
- Modify: `apps/api/src/financial-report/financial-report.controller.ts`
- Modify: `apps/api/src/operating-expense/operating-expense.controller.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.controller.ts`
- Modify: `apps/api/src/meal-expense/meal-expense.controller.ts`

- [ ] **Step 1: `financial-report/financial-report.controller.ts` 수정**

import 교체:
```typescript
import { canWriteFinance, canReadFinance, canManageTD } from "../lib/permissions";
```

함수 교체:
```typescript
const canWrite = (role: string, foRole: string | null | undefined) =>
  canWriteFinance(role, foRole);

const canRead = (role: string, foRole: string | null | undefined) =>
  canReadFinance(role, foRole) || (role === "FRONT_OFFICE" && foRole === "TD");
```

- [ ] **Step 2: `operating-expense/operating-expense.controller.ts` 수정**

import 교체:
```typescript
import { canReadFinance, canWriteFinance } from "../lib/permissions";
```

함수 교체:
```typescript
const canRead = (role: string, foRole: string | null | undefined) =>
  canReadFinance(role, foRole) || (role === "FRONT_OFFICE" && foRole === "TD");

const canCreate = (role: string, foRole: string | null | undefined) =>
  canReadFinance(role, foRole);

const canDelete = (role: string, foRole: string | null | undefined) =>
  canWriteFinance(role, foRole);
```

- [ ] **Step 3: `sponsorship/sponsorship.controller.ts` 수정**

```typescript
import { isAdminLike, canWriteFinance } from "../lib/permissions";
```

기존:
```typescript
isAdminLike(role) || (role === "FRONT_OFFICE" && foRole === "FINANCE_MANAGER");
```
→ `canWriteFinance(role, foRole)`

(`isAdminLike`를 다른 곳에서도 쓰면 import 유지, 아니면 제거)

- [ ] **Step 4: `meal-expense/meal-expense.controller.ts` 수정**

import 교체:
```typescript
import { canReadFinance, canWriteFinance } from "../lib/permissions";
```

함수 교체:
```typescript
const canRead = (role: string, frontOfficeRole: string | null | undefined) =>
  canReadFinance(role, frontOfficeRole);

// canWrite는 EQUIPMENT_MANAGER 포함이라 인라인 유지:
const canWrite = (role: string, frontOfficeRole: string | null | undefined) =>
  canWriteFinance(role, frontOfficeRole) ||
  (role === "FRONT_OFFICE" && frontOfficeRole === "EQUIPMENT_MANAGER");

const canDelete = (role: string, frontOfficeRole: string | null | undefined) =>
  canWriteFinance(role, frontOfficeRole) ||
  (role === "FRONT_OFFICE" && frontOfficeRole === "EQUIPMENT_MANAGER");
```

- [ ] **Step 5: 타입 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 6: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/src/financial-report/ apps/api/src/operating-expense/ apps/api/src/sponsorship/ apps/api/src/meal-expense/
git commit -m "refactor: replace inline finance checks with canReadFinance/canWriteFinance"
```

---

### Task 5: HR routes — canReadHR / canWriteHR

**Files:**
- Modify: `apps/api/src/hr/hr.routes.ts`
- Modify: `apps/api/src/hr-report/hr-report.routes.ts`
- Modify: `apps/api/src/hiring-automation/hiring-automation.routes.ts`

- [ ] **Step 1: `hr/hr.routes.ts` 수정**

import 교체:
```typescript
import { canReadHR } from "../lib/permissions";
```

`requireHR` 함수 교체:
```typescript
function requireHR(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (!canReadHR(user.role, user.frontOfficeRole)) return res.status(403).json({ error: "FORBIDDEN" });
  next();
}
```

- [ ] **Step 2: `hr-report/hr-report.routes.ts` 수정**

import 교체:
```typescript
import { canReadHR } from "../lib/permissions";
```

`requireHR` 함수 교체 (기존의 ADMIN/SUPER_ADMIN/GM/TD/HR_MANAGER 체크):
```typescript
const requireHR = (req: any, res: any, next: any) => {
  const { role, frontOfficeRole } = req.user as any;
  if (canReadHR(role, frontOfficeRole) || (role === "FRONT_OFFICE" && frontOfficeRole === "TD"))
    return next();
  next(new AppError(403, "FORBIDDEN"));
};
```

- [ ] **Step 3: `hiring-automation/hiring-automation.routes.ts` 수정**

import 교체:
```typescript
import { canReadHR, canWriteHR, isAdminLike } from "../lib/permissions";
```

`requireHRorGMorAdmin` 교체:
```typescript
const requireHRorGMorAdmin = (req: any, _res: any, next: any) => {
  const { role, frontOfficeRole } = req.user ?? {};
  if (canReadHR(role, frontOfficeRole)) return next();
  next(new AppError(403, "FORBIDDEN"));
};
```

`requireHRManager` 교체:
```typescript
const requireHRManager = (req: any, _res: any, next: any) => {
  const { role, frontOfficeRole } = req.user ?? {};
  if (canWriteHR(role, frontOfficeRole)) return next();
  next(new AppError(403, "FORBIDDEN"));
};
```

기존의 `isAdmin` 지역 함수와 `requireAdmin` 미들웨어는 제거하고 아래로 교체:
```typescript
const requireAdmin = (req: any, _res: any, next: any) => {
  const { role } = req.user ?? {};
  if (isAdminLike(role)) return next();
  next(new AppError(403, "FORBIDDEN"));
};
```

- [ ] **Step 4: 타입 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/src/hr/ apps/api/src/hr-report/ apps/api/src/hiring-automation/
git commit -m "refactor: replace inline HR checks with canReadHR/canWriteHR"
```

---

### Task 6: Recruitment + Coach — canWriteHR / canManageTD

**Files:**
- Modify: `apps/api/src/recruitment/recruitment.controller.ts`
- Modify: `apps/api/src/coach/coach.controller.ts`

- [ ] **Step 1: `recruitment/recruitment.controller.ts` 수정**

import 교체:
```typescript
import { canWriteHR, canManageTD, isAdminLike } from "../lib/permissions";
```

함수 교체:
```typescript
const canRead = (role: string, foRole: string | null | undefined, coachRole: string | null | undefined) =>
  canWriteHR(role, foRole) ||
  canManageTD(role, foRole) ||
  (role === "COACHING_STAFF" && coachRole === "HEAD_COACH");

const canWrite = (role: string, foRole: string | null | undefined) =>
  canWriteHR(role, foRole);

const canApprove = (role: string, foRole: string | null | undefined) =>
  canWriteHR(role, foRole);
```

- [ ] **Step 2: `coach/coach.controller.ts` 수정**

import 교체:
```typescript
import { canManageTD } from "../lib/permissions";
```

함수 교체:
```typescript
const canRead = (role: string, frontOfficeRole: string | null | undefined) =>
  canManageTD(role, frontOfficeRole);

const canWrite = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "GM" || (role === "FRONT_OFFICE" && frontOfficeRole === "TD");

const canApprove = (role: string) =>
  role === "GM";
```

- [ ] **Step 3: 타입 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 4: 전체 테스트 확인**

```bash
cd /Users/juno/work/football/apps/api && npx jest --no-coverage 2>&1 | tail -15
```

Expected: Task 1 이전과 동일한 pass/fail 수 (새로운 실패 없음)

- [ ] **Step 5: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/src/recruitment/ apps/api/src/coach/
git commit -m "refactor: replace inline HR/TD checks with canWriteHR/canManageTD in recruitment and coach"
```

---

### Task 7: report.controller.ts — 지역 헬퍼 함수 제거 및 통합

**Files:**
- Modify: `apps/api/src/report/report.controller.ts`

`report.controller.ts`에는 `isHrManager`, `isFinanceManager`, `isHrStaff`, `isFinanceStaff` 등 8개의 지역 헬퍼 함수가 있습니다. 이를 central 헬퍼로 교체합니다.

- [ ] **Step 1: import 교체**

```typescript
import { isAdminLike, canReadFinance, canWriteFinance, canReadHR, canWriteHR } from "../lib/permissions";
```

- [ ] **Step 2: 지역 헬퍼 함수 4개 제거 및 사용처 교체**

제거할 함수: `isHrManager`, `isHrStaff`, `isFinanceManager`, `isFinanceStaff`

사용처 교체 (line ~94~100 근처의 type 기반 게이트):

```typescript
// 기존
if (type === "HR" && !(isAdminLike(role) || foRole === "HR_MANAGER" || foRole === "HR_STAFF")) {
  throw new AppError(403, "FORBIDDEN");
}
if (type === "FINANCIAL" && !(isAdminLike(role) || role === "GM" || foRole === "FINANCE_MANAGER" || foRole === "FINANCE_STAFF")) {
  throw new AppError(403, "FORBIDDEN");
}

// 교체 후
if (type === "HR" && !canReadHR(role, foRole)) {
  throw new AppError(403, "FORBIDDEN");
}
if (type === "FINANCIAL" && !canReadFinance(role, foRole)) {
  throw new AppError(403, "FORBIDDEN");
}
```

지역 헬퍼를 사용하던 다른 부분도 `canReadHR(req.user.role, req.user.frontOfficeRole)` / `canWriteFinance(...)` 형태로 교체.

`isGM`, `isHeadCoach`, `isAssetManager`, `isAssetStaff` 함수는 asset 도메인에서만 쓰이므로 **그대로 유지** (asset 헬퍼는 이번 스코프 밖).

- [ ] **Step 3: 타입 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 4: 전체 테스트 최종 확인**

```bash
cd /Users/juno/work/football/apps/api && npx jest --no-coverage 2>&1 | tail -15
```

Expected: 기존 대비 새로운 실패 없음

- [ ] **Step 5: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/src/report/report.controller.ts
git commit -m "refactor: replace local role helpers in report.controller with central permission helpers"
```
