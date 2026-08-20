# Department CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Department(부서)를 독립 Prisma 모델로 구현하고, StaffRecord가 FK로 참조하며, 관리자가 부서를 CRUD할 수 있는 백엔드 API와 프론트엔드 페이지를 추가한다.

**Architecture:** `Department` 모델을 신규 생성하고 `StaffRecord.department String?`을 `departmentId Int?` FK로 교체한다. BE는 기존 staff-record 모듈과 동일한 패턴(repo → service → controller → routes)을 따른다. FE는 `/admin/departments` 페이지에서 부서 CRUD, StaffRecordPage에서는 텍스트 입력 대신 Select 드롭다운으로 부서를 선택한다.

**Tech Stack:** Prisma 5, Express, TypeScript, React 18, shadcn/ui, react-i18next

---

## File Structure

**새로 생성:**
- `apps/api/prisma/migrations/20260731000002_department/migration.sql`
- `apps/api/src/department/department.repo.ts`
- `apps/api/src/department/department.service.ts`
- `apps/api/src/department/department.controller.ts`
- `apps/api/src/department/department.routes.ts`
- `apps/api/__test__/department/department.service.test.ts`
- `football/src/services/department.service.ts`
- `football/src/pages/admin/DepartmentPage.tsx`

**수정:**
- `apps/api/prisma/schema.prisma` — Department 모델 추가, StaffRecord 수정
- `apps/api/src/apiRouter.ts` — /departments 라우터 등록
- `apps/api/src/staff-record/staff-record.repo.ts` — departmentId 필드로 교체, department include
- `apps/api/src/staff-record/staff-record.service.ts` — departmentId 파라미터로 교체
- `football/src/services/staff-record.service.ts` — department 타입 수정
- `football/src/pages/admin/StaffRecordPage.tsx` — department Input → Select (부서 목록)
- `football/src/App.tsx` — /admin/departments 라우트 추가
- `football/src/layouts/AppShell.tsx` — 부서 관리 nav 항목 추가
- `football/src/locales/ko/admin.json` — department 키 추가
- `football/src/locales/ko/common.json` — nav.item.departments 추가

---

### Task 1: Prisma 스키마 변경 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260731000002_department/migration.sql`

- [x] **Step 1: schema.prisma에 Department 모델 추가 + StaffRecord 수정**

`apps/api/prisma/schema.prisma`에서 `StaffRecord` 모델을 찾아 `department String?` 줄을 아래로 교체하고, 파일 끝에 Department 모델을 추가한다.

StaffRecord 수정 (기존 `department String?` 줄 교체):
```prisma
  departmentId Int?
  department   Department? @relation(fields: [departmentId], references: [id], onDelete: SetNull)
```

파일 끝(마지막 `}` 이전 적절한 위치)에 추가:
```prisma
model Department {
  id           Int           @id @default(autoincrement())
  name         String        @unique
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  staffRecords StaffRecord[]
}
```

- [x] **Step 2: 마이그레이션 SQL 파일 작성**

`apps/api/prisma/migrations/20260731000002_department/migration.sql` 생성:
```sql
-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- AlterTable: StaffRecord - add departmentId, drop department
ALTER TABLE "StaffRecord" ADD COLUMN "departmentId" INTEGER;
ALTER TABLE "StaffRecord" DROP COLUMN IF EXISTS "department";

-- AddForeignKey
ALTER TABLE "StaffRecord" ADD CONSTRAINT "StaffRecord_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [x] **Step 3: 마이그레이션 적용 + Prisma 클라이언트 재생성**

```bash
cd apps/api
npx prisma migrate resolve --applied 20260731000002_department
# 이미 DB에 테이블이 없다면 대신:
# npx prisma db push
# 또는 직접 SQL 실행 후 migrate resolve
psql $DATABASE_URL -f prisma/migrations/20260731000002_department/migration.sql
npx prisma migrate resolve --applied 20260731000002_department
npx prisma generate
```

확인: `npx prisma studio`에서 Department 테이블, StaffRecord에 departmentId 컬럼 존재 여부 체크

- [x] **Step 4: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260731000002_department/
git commit -m "feat(db): Department 모델 추가, StaffRecord.department → departmentId FK"
```

---

### Task 2: BE - DepartmentRepository + DepartmentService (TDD)

**Files:**
- Create: `apps/api/src/department/department.repo.ts`
- Create: `apps/api/src/department/department.service.ts`
- Create: `apps/api/__test__/department/department.service.test.ts`

- [x] **Step 1: 테스트 파일 작성 (실패 상태)**

`apps/api/__test__/department/department.service.test.ts`:
```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { DepartmentService } from "../../src/department/department.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  findAll: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  findById: jest.fn(),
  findByName: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as any;

const service = new DepartmentService(mockRepo);

describe("DepartmentService", () => {
  beforeEach(() => jest.clearAllMocks());

  test("list: 전체 부서 목록 반환", async () => {
    mockRepo.findAll.mockResolvedValue([{ id: 1, name: "전략팀", isActive: true }]);
    const result = await service.list();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "전략팀" });
  });

  test("get: 존재하는 부서 반환", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, name: "전략팀", isActive: true });
    const result = await service.get(1);
    expect(result.id).toBe(1);
  });

  test("get: 존재하지 않으면 404", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.get(99)).rejects.toThrow(AppError);
    await expect(service.get(99)).rejects.toMatchObject({ statusCode: 404 });
  });

  test("create: 정상 생성", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({ id: 2, name: "마케팅팀", isActive: true });
    const result = await service.create({ name: "마케팅팀" });
    expect(result.name).toBe("마케팅팀");
    expect(mockRepo.create).toHaveBeenCalledWith({ name: "마케팅팀" });
  });

  test("create: 중복 이름이면 409", async () => {
    mockRepo.findByName.mockResolvedValue({ id: 1, name: "전략팀" });
    await expect(service.create({ name: "전략팀" })).rejects.toMatchObject({ statusCode: 409 });
  });

  test("update: 존재하는 부서 수정", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, name: "전략팀", isActive: true });
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue({ id: 1, name: "전략기획팀", isActive: true });
    const result = await service.update(1, { name: "전략기획팀" });
    expect(result.name).toBe("전략기획팀");
  });

  test("update: 존재하지 않으면 404", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.update(99, { name: "X" })).rejects.toMatchObject({ statusCode: 404 });
  });

  test("delete: 정상 삭제", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, name: "전략팀", isActive: true });
    await service.delete(1);
    expect(mockRepo.delete).toHaveBeenCalledWith(1);
  });

  test("delete: 존재하지 않으면 404", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.delete(99)).rejects.toMatchObject({ statusCode: 404 });
  });
});
```

- [x] **Step 2: 테스트 실행 - 실패 확인**

```bash
cd apps/api
npx jest __test__/department/department.service.test.ts --no-coverage
```

Expected: FAIL (DepartmentService 모듈 없음)

- [x] **Step 3: DepartmentRepository 구현**

`apps/api/src/department/department.repo.ts`:
```typescript
import { PrismaClient } from "../generated/client";

export class DepartmentRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: "asc" } });
  }

  findById(id: number) {
    return this.prisma.department.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return this.prisma.department.findUnique({ where: { name } });
  }

  create(data: { name: string }) {
    return this.prisma.department.create({ data });
  }

  update(id: number, data: { name?: string; isActive?: boolean }) {
    return this.prisma.department.update({ where: { id }, data });
  }

  delete(id: number) {
    return this.prisma.department.delete({ where: { id } });
  }
}
```

- [x] **Step 4: DepartmentService 구현**

`apps/api/src/department/department.service.ts`:
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

  async create(data: { name: string }) {
    const existing = await this.repo.findByName(data.name);
    if (existing) throw new AppError(409, "DEPARTMENT_NAME_CONFLICT");
    return this.repo.create(data);
  }

  async update(id: number, data: { name?: string; isActive?: boolean }) {
    await this.get(id);
    if (data.name) {
      const existing = await this.repo.findByName(data.name);
      if (existing && existing.id !== id) throw new AppError(409, "DEPARTMENT_NAME_CONFLICT");
    }
    return this.repo.update(id, data);
  }

  async delete(id: number) {
    await this.get(id);
    return this.repo.delete(id);
  }
}
```

- [x] **Step 5: 테스트 실행 - 통과 확인**

```bash
cd apps/api
npx jest __test__/department/department.service.test.ts --no-coverage
```

Expected: PASS (8 tests)

- [x] **Step 6: 커밋**

```bash
git add apps/api/src/department/ apps/api/__test__/department/
git commit -m "feat(department): repo + service TDD"
```

---

### Task 3: BE - Controller + Routes + apiRouter 등록

**Files:**
- Create: `apps/api/src/department/department.controller.ts`
- Create: `apps/api/src/department/department.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: DepartmentController 작성**

`apps/api/src/department/department.controller.ts`:
```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { DepartmentService } from "./department.service";

const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && foRole === "GM");

const canRead = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && foRole === "GM");

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
      const { role } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { name } = req.body as { name: string };
      if (!name?.trim()) throw new AppError(400, "NAME_REQUIRED");
      res.status(201).json(await this.service.create({ name: name.trim() }));
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const data = req.body as { name?: string; isActive?: boolean };
      res.json(await this.service.update(Number(req.params["id"]), data));
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      await this.service.delete(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
```

- [x] **Step 2: DepartmentRoutes 작성**

`apps/api/src/department/department.routes.ts`:
```typescript
import { Router } from "express";
import passport from "passport";
import { DepartmentRepository } from "./department.repo";
import { DepartmentService } from "./department.service";
import { DepartmentController } from "./department.controller";
import { getPrisma } from "../lib/prisma";

const router = Router();
const auth = passport.authenticate("accessToken", { session: false });
const repo = new DepartmentRepository(getPrisma());
const service = new DepartmentService(repo);
const controller = new DepartmentController(service);

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, controller.update);
router.delete("/:id", auth, controller.delete);

export default router;
```

- [x] **Step 3: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts`에서 기존 import들 아래 추가:
```typescript
import departmentRouter from "./department/department.routes";
```

`apiRouter.use` 블록에 추가 (예: staffRecordRouter 바로 위):
```typescript
apiRouter.use("/departments", departmentRouter);
```

- [x] **Step 4: TS 빌드 확인**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/department/ apps/api/src/apiRouter.ts
git commit -m "feat(department): controller + routes, /departments 엔드포인트 등록"
```

---

### Task 4: BE - StaffRecord 모듈 departmentId로 업데이트

**Files:**
- Modify: `apps/api/src/staff-record/staff-record.repo.ts`
- Modify: `apps/api/src/staff-record/staff-record.service.ts`

- [x] **Step 1: StaffRecordRepository 수정**

`apps/api/src/staff-record/staff-record.repo.ts` 전체를 아래로 교체:
```typescript
import { PrismaClient } from "../generated/client";

export class StaffRecordRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(includeInactive = false) {
    return this.prisma.staffRecord.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { department: true },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: number) {
    return this.prisma.staffRecord.findUnique({
      where: { id },
      include: { department: true },
    });
  }

  async create(data: {
    name: string;
    role: string;
    departmentId?: number;
    phone?: string;
    notes?: string;
    createdById: number;
  }) {
    return this.prisma.staffRecord.create({
      data,
      include: { department: true },
    });
  }

  async update(
    id: number,
    data: {
      name?: string;
      role?: string;
      departmentId?: number | null;
      phone?: string;
      isActive?: boolean;
      notes?: string;
    }
  ) {
    return this.prisma.staffRecord.update({
      where: { id },
      data,
      include: { department: true },
    });
  }

  async delete(id: number) {
    return this.prisma.staffRecord.delete({ where: { id } });
  }
}
```

- [x] **Step 2: StaffRecordService 수정**

`apps/api/src/staff-record/staff-record.service.ts` 전체를 아래로 교체:
```typescript
import { StaffRecordRepository } from "./staff-record.repo";
import { AppError } from "../lib/appError";

export class StaffRecordService {
  constructor(private repo: StaffRecordRepository) {}

  async list(includeInactive = false) {
    return this.repo.findAll(includeInactive);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "STAFF_RECORD_NOT_FOUND");
    return record;
  }

  async create(
    data: { name: string; role: string; departmentId?: number; phone?: string; notes?: string },
    createdById: number
  ) {
    return this.repo.create({ ...data, createdById });
  }

  async update(
    id: number,
    data: { name?: string; role?: string; departmentId?: number | null; phone?: string; isActive?: boolean; notes?: string }
  ) {
    await this.get(id);
    return this.repo.update(id, data);
  }

  async delete(id: number) {
    await this.get(id);
    return this.repo.delete(id);
  }
}
```

- [x] **Step 3: TS 빌드 확인**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 4: 커밋**

```bash
git add apps/api/src/staff-record/
git commit -m "refactor(staff-record): department String → departmentId FK, include department"
```

---

### Task 5: FE - department.service.ts + DepartmentPage

**Files:**
- Create: `football/src/services/department.service.ts`
- Create: `football/src/pages/admin/DepartmentPage.tsx`

- [x] **Step 1: FE API 서비스 작성**

`football/src/services/department.service.ts`:
```typescript
import { api } from "./api";

export interface Department {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const departmentApi = {
  list: (): Promise<Department[]> => api.get("/departments"),
  get: (id: number): Promise<Department> => api.get(`/departments/${id}`),
  create: (data: { name: string }): Promise<Department> => api.post("/departments", data),
  update: (id: number, data: { name?: string; isActive?: boolean }): Promise<Department> =>
    api.patch(`/departments/${id}`, data),
  delete: (id: number): Promise<void> => api.delete(`/departments/${id}`),
};
```

- [x] **Step 2: DepartmentPage 작성**

`football/src/pages/admin/DepartmentPage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { departmentApi } from '@/services/department.service'
import type { Department } from '@/services/department.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function DepartmentPage() {
  const { t } = useTranslation('admin')
  const [departments, setDepartments] = useState<Department[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchDepartments = async () => {
    try {
      setDepartments(await departmentApi.list())
    } catch {
      toast.error(t('department.loadFailed'))
    }
  }

  useEffect(() => { void fetchDepartments() }, [])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setOpen(true)
  }

  const openEdit = (d: Department) => {
    setEditing(d)
    setName(d.name)
    setOpen(true)
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error(t('department.nameRequired')); return }
    setSaving(true)
    try {
      if (editing) {
        await departmentApi.update(editing.id, { name: name.trim() })
      } else {
        await departmentApi.create({ name: name.trim() })
      }
      setOpen(false)
      void fetchDepartments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('department.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('department.confirmDelete'))) return
    try {
      await departmentApi.delete(id)
      void fetchDepartments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('department.deleteFailed'))
    }
  }

  const handleToggleActive = async (d: Department, value: boolean) => {
    try {
      await departmentApi.update(d.id, { isActive: value })
      void fetchDepartments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('department.saveFailed'))
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('department.title')}</h1>
        <Button onClick={openCreate}>{t('department.add')}</Button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">{t('department.name')}</th>
            <th className="py-2 pr-4">{t('department.status')}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => (
            <tr key={d.id} className="border-b hover:bg-muted/30">
              <td className="py-2 pr-4 font-medium">{d.name}</td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={d.isActive}
                    onCheckedChange={(v) => void handleToggleActive(d, v)}
                  />
                  <Badge variant={d.isActive ? 'default' : 'secondary'}>
                    {d.isActive ? t('department.active') : t('department.inactive')}
                  </Badge>
                </div>
              </td>
              <td className="py-2 flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                  {t('action.edit', { ns: 'common' })}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => void handleDelete(d.id)}
                >
                  {t('action.delete', { ns: 'common' })}
                </Button>
              </td>
            </tr>
          ))}
          {departments.length === 0 && (
            <tr>
              <td colSpan={3} className="py-8 text-center text-muted-foreground text-sm">
                {t('department.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t('department.edit') : t('department.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('department.name')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('department.namePlaceholder')}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
              />
            </div>
            <Button className="w-full" onClick={() => void handleSubmit()} disabled={saving}>
              {t('action.save', { ns: 'common' })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [x] **Step 3: 커밋**

```bash
git add football/src/services/department.service.ts football/src/pages/admin/DepartmentPage.tsx
git commit -m "feat(department): FE API 서비스 + DepartmentPage CRUD UI"
```

---

### Task 6: FE - StaffRecordPage에 부서 Select 추가 + 라우팅 + Nav + i18n

**Files:**
- Modify: `football/src/services/staff-record.service.ts`
- Modify: `football/src/pages/admin/StaffRecordPage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/locales/ko/admin.json`
- Modify: `football/src/locales/ko/common.json`

- [x] **Step 1: FE StaffRecord 타입 수정**

`football/src/services/staff-record.service.ts`에서 `StaffRecord` 인터페이스를 아래로 교체:
```typescript
import { api } from "./api";
import type { Department } from "./department.service";

export interface StaffRecord {
  id: number;
  name: string;
  role: string;
  departmentId: number | null;
  department: Department | null;
  phone: string | null;
  isActive: boolean;
  notes: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export const staffRecordApi = {
  list: (includeInactive = false): Promise<StaffRecord[]> =>
    api.get(`/staff-records?includeInactive=${includeInactive}`),
  get: (id: number): Promise<StaffRecord> => api.get(`/staff-records/${id}`),
  create: (
    data: Pick<StaffRecord, "name" | "role"> & Partial<Pick<StaffRecord, "departmentId" | "phone" | "notes">>
  ): Promise<StaffRecord> => api.post("/staff-records", data),
  update: (
    id: number,
    data: Partial<Pick<StaffRecord, "name" | "role" | "departmentId" | "phone" | "isActive" | "notes">>
  ): Promise<StaffRecord> => api.patch(`/staff-records/${id}`, data),
  delete: (id: number): Promise<void> => api.delete(`/staff-records/${id}`),
};
```

- [x] **Step 2: StaffRecordPage 수정**

`football/src/pages/admin/StaffRecordPage.tsx` 전체를 아래로 교체:
```tsx
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { staffRecordApi } from "@/services/staff-record.service"
import { departmentApi } from "@/services/department.service"
import type { StaffRecord } from "@/services/staff-record.service"
import type { Department } from "@/services/department.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function StaffRecordPage() {
  const { t } = useTranslation("admin")
  const [records, setRecords] = useState<StaffRecord[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [includeInactive, setIncludeInactive] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRecord | null>(null)
  const [form, setForm] = useState({ name: "", role: "", departmentId: "", phone: "", notes: "" })
  const [saving, setSaving] = useState(false)

  const fetchRecords = async () => {
    try {
      setRecords(await staffRecordApi.list(includeInactive))
    } catch {
      toast.error("불러오기 실패")
    }
  }

  useEffect(() => {
    void fetchRecords()
    departmentApi.list()
      .then((data) => setDepartments(data.filter((d) => d.isActive)))
      .catch(() => {})
  }, [includeInactive])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: "", role: "", departmentId: "", phone: "", notes: "" })
    setOpen(true)
  }

  const openEdit = (r: StaffRecord) => {
    setEditing(r)
    setForm({
      name: r.name,
      role: r.role,
      departmentId: r.departmentId ? String(r.departmentId) : "",
      phone: r.phone ?? "",
      notes: r.notes ?? "",
    })
    setOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.role.trim()) { toast.error("이름과 역할을 입력하세요"); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        role: form.role,
        departmentId: form.departmentId ? Number(form.departmentId) : undefined,
        phone: form.phone || undefined,
        notes: form.notes || undefined,
      }
      if (editing) {
        await staffRecordApi.update(editing.id, payload)
      } else {
        await staffRecordApi.create(payload)
      }
      setOpen(false)
      void fetchRecords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t("staffRecord.confirmDelete"))) return
    try {
      await staffRecordApi.delete(id)
      void fetchRecords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패")
    }
  }

  const handleToggleActive = async (r: StaffRecord, value: boolean) => {
    try {
      await staffRecordApi.update(r.id, { isActive: value })
      void fetchRecords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "수정 실패")
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("staffRecord.title")}</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
            {t("staffRecord.showInactive")}
          </label>
          <Button onClick={openCreate}>{t("staffRecord.add")}</Button>
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">{t("staffRecord.name")}</th>
            <th className="py-2 pr-4">{t("staffRecord.role")}</th>
            <th className="py-2 pr-4">{t("staffRecord.department")}</th>
            <th className="py-2 pr-4">{t("staffRecord.phone")}</th>
            <th className="py-2 pr-4">{t("staffRecord.status")}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              <td className="py-2 pr-4 font-medium">{r.name}</td>
              <td className="py-2 pr-4">{r.role}</td>
              <td className="py-2 pr-4 text-muted-foreground">{r.department?.name ?? "-"}</td>
              <td className="py-2 pr-4 text-muted-foreground">{r.phone ?? "-"}</td>
              <td className="py-2 pr-4">
                <Badge variant={r.isActive ? "default" : "secondary"}>
                  {r.isActive ? t("staffRecord.active") : t("staffRecord.inactive")}
                </Badge>
              </td>
              <td className="py-2 flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                  {t("action.edit", { ns: "common" })}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void handleDelete(r.id)}>
                  {t("action.delete", { ns: "common" })}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("staffRecord.edit") : t("staffRecord.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(["name", "role", "phone", "notes"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label>{t(`staffRecord.${field}`)}</Label>
                <Input
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>{t("staffRecord.department")}</Label>
              <Select
                value={form.departmentId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("staffRecord.departmentPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("staffRecord.noDepartment")}</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.isActive}
                  onCheckedChange={(v) => void handleToggleActive(editing, v)}
                />
                <Label>{t("staffRecord.active")}</Label>
              </div>
            )}
            <Button className="w-full" onClick={() => void handleSubmit()} disabled={saving}>
              {t("action.save", { ns: "common" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [x] **Step 3: i18n 키 추가**

`football/src/locales/ko/admin.json`의 `staffRecord` 객체에 2개 키 추가:
```json
"departmentPlaceholder": "부서 선택",
"noDepartment": "부서 없음"
```

같은 파일에 `department` 객체 추가 (최상위 레벨):
```json
"department": {
  "title": "부서 관리",
  "add": "부서 추가",
  "edit": "부서 수정",
  "name": "부서명",
  "namePlaceholder": "예: 전략팀",
  "status": "상태",
  "active": "운영 중",
  "inactive": "비활성",
  "empty": "등록된 부서가 없습니다.",
  "loadFailed": "부서 목록을 불러오지 못했습니다.",
  "saveFailed": "저장에 실패했습니다.",
  "deleteFailed": "삭제에 실패했습니다.",
  "nameRequired": "부서명을 입력하세요.",
  "confirmDelete": "이 부서를 삭제하시겠습니까? 소속 직원의 부서 정보가 초기화됩니다."
}
```

`football/src/locales/ko/common.json`의 `nav.item` 객체에 추가:
```json
"departments": "부서 관리"
```

- [x] **Step 4: App.tsx 라우트 추가**

`football/src/App.tsx`에 import 추가:
```tsx
import { DepartmentPage } from '@/pages/admin/DepartmentPage'
```

라우트 추가 (`/admin/staff-records` 근처):
```tsx
<Route path="/admin/departments" element={<DepartmentPage />} />
```

- [x] **Step 5: AppShell.tsx nav 항목 추가**

`football/src/layouts/AppShell.tsx`에서 staff-records nav 항목(to: '/admin/staff-records') 바로 위에 추가:
```typescript
{
  to: '/admin/departments',
  label: 'nav.item.departments',
  icon: Building2,
  section: 'nav.section.management',
  roles: ['ADMIN', 'FRONT_OFFICE'],
  frontOfficeRoles: ['GM'],
},
```

`Building2`는 이미 AppShell imports에 있음 (확인 필요 - 없으면 lucide-react import에 추가).

- [x] **Step 6: FE TS 빌드 확인**

```bash
cd football
npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 7: 커밋**

```bash
git add football/src/services/staff-record.service.ts \
        football/src/pages/admin/StaffRecordPage.tsx \
        football/src/services/department.service.ts \
        football/src/pages/admin/DepartmentPage.tsx \
        football/src/App.tsx \
        football/src/layouts/AppShell.tsx \
        football/src/locales/ko/admin.json \
        football/src/locales/ko/common.json
git commit -m "feat(department): FE 라우팅, nav, i18n, StaffRecord 부서 Select 연동"
```
