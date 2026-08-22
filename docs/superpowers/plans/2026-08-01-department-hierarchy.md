# Department Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** `Department` 모델에 `parentId` 계층 구조를 추가하고, `ASSET_MANAGER` frontOfficeRole을 신설하며, 자산관리 하위 5개 부서를 시드 데이터로 구성한다.

**Architecture:** `Department`에 셀프 릴레이션(`parentId`)을 추가해 2-depth 계층(그룹→부서)을 지원한다. `ASSET_MANAGER` 신규 enum 값은 자산관리 부서 총괄 역할이다. `OperatingExpense.departmentId`는 feat/knapsack-budget 머지 후 후속 PR에서 처리한다.

**Tech Stack:** Prisma (schema + migrate + seed), Hono/Express, TypeScript, Jest, React

---

## File Map

| 파일 | 변경 유형 | 역할 |
|------|----------|------|
| `apps/api/prisma/schema.prisma` | Modify | `Department.parentId` + `FrontOfficeRole.ASSET_MANAGER` 추가 |
| `apps/api/prisma/seed.ts` | Modify | 부서 시드 데이터 (재무관리·자산관리+하위5개) |
| `apps/api/src/department/department.repo.ts` | Modify | `parentId` 지원, `children` include |
| `apps/api/src/department/department.service.ts` | Modify | `parentId` 검증, `ASSET_MANAGER` 권한 |
| `apps/api/src/department/department.controller.ts` | Modify | `ASSET_MANAGER` canWrite/canRead 추가 |
| `apps/api/src/department/department.service.test.ts` | Create | 계층 생성·검증 단위 테스트 |
| `football/src/types/auth.ts` | Modify | `FrontOfficeRole`에 `ASSET_MANAGER` 추가 |
| `football/src/services/department.service.ts` | Modify | `Department` 타입에 `parentId`, `children` 추가 |

---

## Task 1: Schema 변경

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: FrontOfficeRole enum에 ASSET_MANAGER 추가**

`schema.prisma` 53번째 줄 `FrontOfficeRole` enum:
```prisma
enum FrontOfficeRole {
  GM
  TD
  CONTRACT_MANAGER
  SCOUT
  EQUIPMENT_MANAGER
  TACTICAL_ANALYST
  FINANCE_MANAGER
  ASSET_MANAGER
}
```

- [x] **Step 2: Department 모델에 parentId 셀프 릴레이션 추가**

```prisma
model Department {
  id           Int           @id @default(autoincrement())
  name         String        @unique
  parentId     Int?
  parent       Department?   @relation("DepartmentHierarchy", fields: [parentId], references: [id])
  children     Department[]  @relation("DepartmentHierarchy")
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  staffRecords StaffRecord[]
}
```

- [x] **Step 3: 마이그레이션 생성 및 적용**

```bash
cd apps/api
npx prisma migrate dev --name add-department-hierarchy
```

Expected: `migrations/` 아래 새 폴더 생성, `prisma generate` 자동 실행

- [x] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(department): add parentId hierarchy + ASSET_MANAGER role"
```

---

## Task 2: Seed 데이터

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [x] **Step 1: 기존 department 시드 코드 위치 파악**

```bash
grep -n "department\|Department" apps/api/prisma/seed.ts | head -20
```

- [x] **Step 2: 부서 시드 함수 추가**

seed.ts에서 기존 department 시드 코드를 아래로 교체 (없으면 추가):

```typescript
async function seedDepartments() {
  // 상위 부서
  const finance = await prisma.department.upsert({
    where: { name: '재무관리' },
    update: {},
    create: { name: '재무관리' },
  });

  const asset = await prisma.department.upsert({
    where: { name: '자산관리' },
    update: {},
    create: { name: '자산관리' },
  });

  // 자산관리 하위 부서
  const subDepts = ['HR', '시설관리', '선수 장비관리', '의료기기 관리', 'IT 자산관리'];
  for (const name of subDepts) {
    await prisma.department.upsert({
      where: { name },
      update: { parentId: asset.id },
      create: { name, parentId: asset.id },
    });
  }

  console.log(`Departments seeded: 재무관리, 자산관리 + ${subDepts.length} sub-departments`);
}
```

- [x] **Step 3: seedDepartments를 main 함수에서 호출**

seed.ts의 main 함수 내 적절한 위치(User 생성 전)에 추가:
```typescript
await seedDepartments();
```

- [x] **Step 4: 시드 실행 확인**

```bash
cd apps/api
npx prisma db seed
```

Expected: `Departments seeded: 재무관리, 자산관리 + 5 sub-departments`

- [x] **Step 5: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat(department): seed 재무관리·자산관리 hierarchy"
```

---

## Task 3: BE Repository 업데이트

**Files:**
- Modify: `apps/api/src/department/department.repo.ts`

- [x] **Step 1: findAll에 children include 추가, create에 parentId 지원**

```typescript
import { PrismaClient } from "../generated/client";

export class DepartmentRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { children: { orderBy: { name: "asc" } } },
    });
  }

  findById(id: number) {
    return this.prisma.department.findUnique({
      where: { id },
      include: { children: { orderBy: { name: "asc" } }, parent: true },
    });
  }

  findByName(name: string) {
    return this.prisma.department.findUnique({ where: { name } });
  }

  create(data: { name: string; parentId?: number }) {
    return this.prisma.department.create({
      data,
      include: { children: true, parent: true },
    });
  }

  update(id: number, data: { name?: string; isActive?: boolean; parentId?: number | null }) {
    return this.prisma.department.update({
      where: { id },
      data,
      include: { children: true, parent: true },
    });
  }

  delete(id: number) {
    return this.prisma.department.delete({ where: { id } });
  }
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/department/department.repo.ts
git commit -m "feat(department): repo supports parentId + children include"
```

---

## Task 4: BE Service 단위 테스트 작성

**Files:**
- Create: `apps/api/src/department/department.service.test.ts`

- [x] **Step 1: 테스트 파일 작성**

```typescript
import { DepartmentService } from "./department.service";
import type { DepartmentRepository } from "./department.repo";

const makeRepo = (overrides: Partial<DepartmentRepository> = {}): DepartmentRepository =>
  ({
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findByName: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as DepartmentRepository);

const fakeDept = { id: 1, name: '자산관리', parentId: null, isActive: true, children: [], parent: null, createdAt: new Date(), updatedAt: new Date(), staffRecords: [] };
const fakeChild = { id: 2, name: 'HR', parentId: 1, isActive: true, children: [], parent: fakeDept, createdAt: new Date(), updatedAt: new Date(), staffRecords: [] };

describe('DepartmentService', () => {
  describe('create', () => {
    it('이름 중복이면 409', async () => {
      const repo = makeRepo({ findByName: jest.fn().mockResolvedValue(fakeDept) });
      const svc = new DepartmentService(repo);
      await expect(svc.create({ name: '자산관리' })).rejects.toMatchObject({ statusCode: 409 });
    });

    it('parentId가 없는 상위 부서 생성', async () => {
      const repo = makeRepo({ create: jest.fn().mockResolvedValue(fakeDept) });
      const svc = new DepartmentService(repo);
      const result = await svc.create({ name: '자산관리' });
      expect(repo.create).toHaveBeenCalledWith({ name: '자산관리' });
      expect(result.name).toBe('자산관리');
    });

    it('존재하지 않는 parentId면 404', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const svc = new DepartmentService(repo);
      await expect(svc.create({ name: 'HR', parentId: 999 })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('유효한 parentId로 하위 부서 생성', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(fakeDept),
        create: jest.fn().mockResolvedValue(fakeChild),
      });
      const svc = new DepartmentService(repo);
      const result = await svc.create({ name: 'HR', parentId: 1 });
      expect(repo.create).toHaveBeenCalledWith({ name: 'HR', parentId: 1 });
      expect(result.parentId).toBe(1);
    });
  });

  describe('delete', () => {
    it('하위 부서가 있으면 삭제 불가 409', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue({ ...fakeDept, children: [fakeChild] }),
      });
      const svc = new DepartmentService(repo);
      await expect(svc.delete(1)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('하위 부서 없으면 삭제 가능', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue({ ...fakeDept, children: [] }),
        delete: jest.fn().mockResolvedValue(fakeDept),
      });
      const svc = new DepartmentService(repo);
      await svc.delete(1);
      expect(repo.delete).toHaveBeenCalledWith(1);
    });
  });
});
```

- [x] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd apps/api
npx jest department.service.test --no-coverage
```

Expected: FAIL (service에 parentId 검증 없음)

- [x] **Step 3: Commit (failing test)**

```bash
git add apps/api/src/department/department.service.test.ts
git commit -m "test(department): failing tests for parentId hierarchy"
```

---

## Task 5: BE Service 구현

**Files:**
- Modify: `apps/api/src/department/department.service.ts`

- [x] **Step 1: parentId 검증 + delete 보호 로직 추가**

```typescript
import { DepartmentRepository } from "./department.repo";
import { AppError } from "../lib/appError";

export class DepartmentService {
  constructor(private repo: DepartmentRepository) {}

  list() {
    return this.repo.findAll();
  }

  async get(id: number) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new AppError(404, "DEPARTMENT_NOT_FOUND");
    return dept;
  }

  async create(data: { name: string; parentId?: number }) {
    const existing = await this.repo.findByName(data.name);
    if (existing) throw new AppError(409, "DEPARTMENT_NAME_CONFLICT");
    if (data.parentId !== undefined) {
      const parent = await this.repo.findById(data.parentId);
      if (!parent) throw new AppError(404, "PARENT_DEPARTMENT_NOT_FOUND");
    }
    return this.repo.create(data);
  }

  async update(id: number, data: { name?: string; isActive?: boolean; parentId?: number | null }) {
    await this.get(id);
    if (data.name !== undefined) {
      const existing = await this.repo.findByName(data.name);
      if (existing && existing.id !== id) throw new AppError(409, "DEPARTMENT_NAME_CONFLICT");
    }
    if (data.parentId !== undefined && data.parentId !== null) {
      const parent = await this.repo.findById(data.parentId);
      if (!parent) throw new AppError(404, "PARENT_DEPARTMENT_NOT_FOUND");
    }
    return this.repo.update(id, data);
  }

  async delete(id: number) {
    const dept = await this.get(id);
    if (dept.children && dept.children.length > 0)
      throw new AppError(409, "DEPARTMENT_HAS_CHILDREN");
    return this.repo.delete(id);
  }
}
```

- [x] **Step 2: 테스트 실행 — PASS 확인**

```bash
cd apps/api
npx jest department.service.test --no-coverage
```

Expected: 5 tests PASS

- [x] **Step 3: Commit**

```bash
git add apps/api/src/department/department.service.ts
git commit -m "feat(department): parentId validation + delete guard for children"
```

---

## Task 6: BE Controller 업데이트

**Files:**
- Modify: `apps/api/src/department/department.controller.ts`

- [x] **Step 1: ASSET_MANAGER 권한 추가 + create body에 parentId 처리**

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { DepartmentService } from "./department.service";

const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" && (foRole === "GM" || foRole === "ASSET_MANAGER"));

const canRead = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" &&
    (foRole === "GM" || foRole === "ASSET_MANAGER" || foRole === "FINANCE_MANAGER"));

export class DepartmentController {
  constructor(private service: DepartmentService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.list());
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { name, parentId } = req.body as { name: string; parentId?: number };
      if (!name?.trim()) throw new AppError(400, "NAME_REQUIRED");
      res.status(201).json(
        await this.service.create({ name: name.trim(), parentId })
      );
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const data = req.body as { name?: string; isActive?: boolean; parentId?: number | null };
      res.json(await this.service.update(Number(req.params["id"]), data));
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      await this.service.delete(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
```

- [x] **Step 2: 전체 테스트 실행**

```bash
cd apps/api
npx jest --no-coverage
```

Expected: All existing tests PASS

- [x] **Step 3: Commit**

```bash
git add apps/api/src/department/department.controller.ts
git commit -m "feat(department): ASSET_MANAGER canRead/canWrite + parentId in create body"
```

---

## Task 7: FE 타입 업데이트

**Files:**
- Modify: `football/src/types/auth.ts`
- Modify: `football/src/services/department.service.ts`

- [x] **Step 1: auth.ts — ASSET_MANAGER 추가**

`football/src/types/auth.ts` 14번째 줄 `FrontOfficeRole` 타입:
```typescript
export type FrontOfficeRole =
  | 'GM'
  | 'TD'
  | 'CONTRACT_MANAGER'
  | 'SCOUT'
  | 'EQUIPMENT_MANAGER'
  | 'TACTICAL_ANALYST'
  | 'FINANCE_MANAGER'
  | 'ASSET_MANAGER'
```

`FRONT_OFFICE_ROLE_LABEL` 레코드에 추가:
```typescript
export const FRONT_OFFICE_ROLE_LABEL: Record<FrontOfficeRole, string> = {
  GM: 'GM',
  TD: 'Technical Director',
  CONTRACT_MANAGER: 'Contract Manager',
  SCOUT: 'Scout',
  EQUIPMENT_MANAGER: 'Equipment Manager',
  TACTICAL_ANALYST: 'Tactical Analyst',
  FINANCE_MANAGER: 'Finance Manager',
  ASSET_MANAGER: 'Asset Manager',
}
```

- [x] **Step 2: department.service.ts — Department 타입에 계층 필드 추가**

`football/src/services/department.service.ts` 전체 교체:

```typescript
import { api } from "./api";

export interface Department {
  id: number;
  name: string;
  parentId: number | null;
  parent: Pick<Department, 'id' | 'name'> | null;
  children: Pick<Department, 'id' | 'name' | 'isActive'>[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const departmentApi = {
  list: (): Promise<Department[]> => api.get("/departments"),
  get: (id: number): Promise<Department> => api.get(`/departments/${id}`),
  create: (data: { name: string; parentId?: number }): Promise<Department> =>
    api.post("/departments", data),
  update: (
    id: number,
    data: { name?: string; isActive?: boolean; parentId?: number | null }
  ): Promise<Department> => api.patch(`/departments/${id}`, data),
  delete: (id: number): Promise<void> => api.delete(`/departments/${id}`),
};
```

- [x] **Step 3: TypeScript 타입 체크**

```bash
cd football
npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 4: Commit**

```bash
git add football/src/types/auth.ts football/src/services/department.service.ts
git commit -m "feat(department): FE types — ASSET_MANAGER + Department hierarchy fields"
```

---

## Task 8: 통합 확인

- [x] **Step 1: BE 서버 시작**

```bash
cd apps/api && npm run dev
```

- [x] **Step 2: 시드 데이터 확인**

```bash
curl -s http://localhost:3000/api/departments \
  -H "Authorization: Bearer <ADMIN_TOKEN>" | jq '[.[] | {id, name, parentId, childrenCount: (.children | length)}]'
```

Expected:
```json
[
  {"id": 1, "name": "IT 자산관리", "parentId": 2, "childrenCount": 0},
  {"id": 2, "name": "HR", "parentId": 2, "childrenCount": 0},
  {"id": 3, "name": "재무관리", "parentId": null, "childrenCount": 0},
  {"id": 4, "name": "자산관리", "parentId": null, "childrenCount": 5},
  ...
]
```

- [x] **Step 3: 하위 부서가 있는 부서 삭제 시도 — 409 확인**

```bash
curl -s -X DELETE http://localhost:3000/api/departments/<자산관리id> \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Expected: `{"error": "DEPARTMENT_HAS_CHILDREN"}`

- [x] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(department): department hierarchy complete — parentId + ASSET_MANAGER + seed"
```

---

## 후속 작업 (feat/knapsack-budget 머지 후)

`OperatingExpense.departmentId` 추가:

```prisma
model OperatingExpense {
  // 기존 필드...
  departmentId Int?
  department   Department? @relation(fields: [departmentId], references: [id])
}
```

- `OperatingExpenseRepository.create()`에 `departmentId?` 파라미터 추가
- FE `OperatingExpense` 타입 + `operatingExpenseApi.create()` payload에 `departmentId?` 추가
