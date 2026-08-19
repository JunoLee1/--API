# GM Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GM 인수인계서에서 도출된 5개 신규 도메인(Player 알레르기, ClubSettings, FINANCE_MANAGER 역할, StaffRecord, MealExpense)을 스키마에 추가하고 기본 CRUD API + 프론트엔드 서비스를 구현한다.

**Architecture:** Prisma 스키마 → migration → BE(routes/controller/service/repo 패턴) → FE(service + 기존 페이지 통합) 순서로 진행. 각 태스크는 독립적으로 테스트 가능한 단위로 분리한다.

**Tech Stack:** Prisma (PostgreSQL), Hono-style Express + TypeScript (BE), React + TypeScript + shadcn/ui (FE), react-i18next (i18n)

---

## ✅ 그릴 결정사항 (2026-08-19)

- **MealExpense**: 별도 모델 폐기 → `StaffAllowance.type = 'MEAL'`로 흡수. `MealExpensePage.tsx` 불필요
- **PlayerAllergy**: `Player.allergies String[]` 필드 추가 (스키마 미적용, 별도 모델 없음). FE: PlayerDetailPage `info` 탭 의료 서브섹션에 배지 표시. 편집 권한: MEDICAL/MEDICAL_DIRECTOR + ADMIN
- **FINANCE_MANAGER 역할**: 이미 완료 ✅
- **StaffRecord**: BE+FE 이미 완료 ✅ (StaffRecordPage.tsx, AppShell nav 등록)
- **ClubSettings**: BE 완료 ✅. FE: `/admin/club-settings` 전용 페이지 신설 (ADMIN 전용, AppShell management 섹션 추가)

## ✅ 이미 완료된 것 (플랜 체크박스 미반영)
- `FrontOfficeRole.FINANCE_MANAGER` enum 추가
- `ClubSettings` 모델 + BE API (`club-settings.routes.ts` 등록)
- `StaffRecord` 모델 + BE API + FE (`StaffRecordPage.tsx`, `staff-record.service.ts`)
- `football/src/services/club-settings.service.ts` 생성

## 잔여 구현
- A. `Player.allergies String[]` — 스키마 migration + player PATCH API 수정 + PlayerDetailPage info 탭
- B. `/admin/club-settings` FE 페이지 — GET/PATCH ClubSettings 폼 (currency, 각종 한도)

---

## 파일 맵

### 스키마 (Task 1)
- Modify: `apps/api/prisma/schema.prisma`

### FINANCE_MANAGER 역할 (Task 2)
- Modify: `apps/api/prisma/schema.prisma` (enum)
- Modify: `apps/api/src/admin/admin.controller.ts` (초대 유효성)
- Modify: `football/src/locales/ko/common.json`
- Modify: `football/src/locales/en/common.json`

### ClubSettings (Task 3)
- Create: `apps/api/src/club-settings/club-settings.repo.ts`
- Create: `apps/api/src/club-settings/club-settings.service.ts`
- Create: `apps/api/src/club-settings/club-settings.controller.ts`
- Create: `apps/api/src/club-settings/club-settings.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`
- Create: `football/src/services/club-settings.service.ts`

### StaffRecord (Task 4)
- Create: `apps/api/src/staff-record/staff-record.repo.ts`
- Create: `apps/api/src/staff-record/staff-record.service.ts`
- Create: `apps/api/src/staff-record/staff-record.controller.ts`
- Create: `apps/api/src/staff-record/staff-record.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`
- Create: `football/src/services/staff-record.service.ts`
- Create: `football/src/pages/admin/StaffRecordPage.tsx`

### MealExpense (Task 5)
- Create: `apps/api/src/meal-expense/meal-expense.repo.ts`
- Create: `apps/api/src/meal-expense/meal-expense.service.ts`
- Create: `apps/api/src/meal-expense/meal-expense.controller.ts`
- Create: `apps/api/src/meal-expense/meal-expense.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`
- Create: `football/src/services/meal-expense.service.ts`
- Create: `football/src/pages/admin/MealExpensePage.tsx`

### Player 알레르기 (Task 6)
- Modify: `apps/api/src/player/player.service.ts`
- Modify: `apps/api/src/player/player.repo.ts` (update 허용 필드 추가)
- Modify: `football/src/services/player.service.ts` (타입 확장)
- Modify: `football/src/pages/players/PlayerDetailPage.tsx` (알레르기 섹션 추가)

---

## Task 1: Prisma 스키마 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: FrontOfficeRole enum에 FINANCE_MANAGER 추가**

`schema.prisma`에서 `enum FrontOfficeRole` 블록을 찾아 아래와 같이 수정:

```prisma
enum FrontOfficeRole {
  GM
  TD
  CONTRACT_MANAGER
  SCOUT
  EQUIPMENT_MANAGER
  TACTICAL_ANALYST
  FINANCE_MANAGER
}
```

- [ ] **Step 2: Season 모델에 wageCapType/Value 추가**

```prisma
enum WageCapType {
  FIXED
  RATIO
}

model Season {
  id           Int          @id @default(autoincrement())
  name         String
  startDate    DateTime
  endDate      DateTime
  status       SeasonStatus @default(UPCOMING)
  wageCapType  WageCapType?
  wageCapValue Float?

  matches          Match[]
  trainingSessions TrainingSession[]
  tacticalAnalyses TacticalAnalysis[]
  developmentPlans PlayerDevelopmentPlan[]
}
```

- [ ] **Step 3: Player 모델에 allergies/foodPreferences 추가**

Player 모델 안에 아래 두 필드 추가:

```prisma
model Player {
  // ... 기존 필드 ...
  allergies       String[]
  foodPreferences String?
  // ... 기존 relations ...
}
```

- [ ] **Step 4: ClubSettings 모델 추가**

```prisma
model ClubSettings {
  id        Int    @id @default(1)
  currency  String @default("KRW")
}
```

- [ ] **Step 5: StaffRecord 모델 추가**

```prisma
model StaffRecord {
  id         Int      @id @default(autoincrement())
  name       String
  role       String
  department String?
  phone      String?
  isActive   Boolean  @default(true)
  notes      String?
  createdById Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  createdBy  User     @relation("StaffRecordCreator", fields: [createdById], references: [id])
}
```

- [ ] **Step 6: MealExpense 모델 추가**

```prisma
enum MealExpenseType {
  TRAINING
  MATCH
}

model MealExpense {
  id             Int             @id @default(autoincrement())
  type           MealExpenseType
  sessionId      Int?
  matchId        Int?
  date           DateTime
  amount         Float
  restaurantName String?
  note           String?
  createdById    Int
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  session     TrainingSession? @relation(fields: [sessionId], references: [id])
  match       Match?           @relation(fields: [matchId], references: [id])
  createdBy   User             @relation("MealExpenseCreator", fields: [createdById], references: [id])
}
```

- [ ] **Step 7: TrainingSession과 Match 모델에 역참조 추가**

TrainingSession 모델에:
```prisma
mealExpenses MealExpense[]
```

Match 모델에:
```prisma
mealExpenses MealExpense[]
```

User 모델에:
```prisma
staffRecordsCreated  StaffRecord[]  @relation("StaffRecordCreator")
mealExpensesCreated  MealExpense[]  @relation("MealExpenseCreator")
```

- [ ] **Step 8: migration 생성 및 적용**

```bash
cd apps/api
npx prisma migrate dev --name gm-data-foundation
```

Expected: migration 파일 생성 + DB 반영 성공

- [ ] **Step 9: Prisma client 재생성 확인**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 10: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(schema): GM data foundation - allergies, ClubSettings, StaffRecord, MealExpense, FINANCE_MANAGER"
```

---

## Task 2: FINANCE_MANAGER 역할 — 프론트엔드 i18n 및 초대 유효성

**Files:**
- Modify: `football/src/locales/ko/admin.json`
- Modify: `football/src/locales/en/admin.json`
- Modify: `apps/api/src/admin/admin.controller.ts` (초대 생성 유효성)

- [ ] **Step 1: ko/admin.json에 FINANCE_MANAGER 라벨 추가**

`admin.json`의 `frontOfficeRole` 번역 맵 안에:

```json
"FINANCE_MANAGER": "재무 담당"
```

- [ ] **Step 2: en/admin.json에 FINANCE_MANAGER 라벨 추가**

```json
"FINANCE_MANAGER": "Finance Manager"
```

- [ ] **Step 3: 백엔드 초대 생성 유효성 확인**

`apps/api/src/admin/admin.controller.ts`에서 `frontOfficeRole` 유효성 검사 배열을 찾아 `FINANCE_MANAGER` 추가:

```typescript
const validFrontOfficeRoles = [
  "GM", "TD", "CONTRACT_MANAGER", "SCOUT",
  "EQUIPMENT_MANAGER", "TACTICAL_ANALYST", "FINANCE_MANAGER"
];
```

- [ ] **Step 4: 서버 재시작 후 FINANCE_MANAGER 역할로 초대 생성 테스트**

```bash
curl -X POST http://localhost:3000/api/admin/invite \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"finance@club.com","role":"FRONT_OFFICE","frontOfficeRole":"FINANCE_MANAGER"}'
```

Expected: `201` 응답

- [ ] **Step 5: Commit**

```bash
git add football/src/locales/ko/admin.json football/src/locales/en/admin.json apps/api/src/admin/admin.controller.ts
git commit -m "feat: FINANCE_MANAGER 역할 초대 유효성 및 i18n 추가"
```

---

## Task 3: ClubSettings API

**Files:**
- Create: `apps/api/src/club-settings/club-settings.repo.ts`
- Create: `apps/api/src/club-settings/club-settings.service.ts`
- Create: `apps/api/src/club-settings/club-settings.controller.ts`
- Create: `apps/api/src/club-settings/club-settings.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`
- Create: `football/src/services/club-settings.service.ts`

- [ ] **Step 1: club-settings.repo.ts 작성**

```typescript
// apps/api/src/club-settings/club-settings.repo.ts
import { PrismaClient } from "@prisma/client";

export class ClubSettingsRepository {
  constructor(private prisma: PrismaClient) {}

  async get() {
    return this.prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, currency: "KRW" },
      update: {},
    });
  }

  async update(currency: string) {
    return this.prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, currency },
      update: { currency },
    });
  }
}
```

- [ ] **Step 2: club-settings.service.ts 작성**

```typescript
// apps/api/src/club-settings/club-settings.service.ts
import { ClubSettingsRepository } from "./club-settings.repo";

export class ClubSettingsService {
  constructor(private repo: ClubSettingsRepository) {}

  async get() {
    return this.repo.get();
  }

  async update(currency: string) {
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("INVALID_CURRENCY");
    }
    return this.repo.update(currency);
  }
}
```

- [ ] **Step 3: club-settings.controller.ts 작성**

```typescript
// apps/api/src/club-settings/club-settings.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { ClubSettingsService } from "./club-settings.service";

export class ClubSettingsController {
  constructor(private service: ClubSettingsService) {}

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get());
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const { currency } = req.body;
      if (!currency) throw new AppError(400, "currency is required");
      res.json(await this.service.update(currency));
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 4: club-settings.routes.ts 작성**

```typescript
// apps/api/src/club-settings/club-settings.routes.ts
import { Router } from "express";
import passport from "passport";
import { ClubSettingsRepository } from "./club-settings.repo";
import { ClubSettingsService } from "./club-settings.service";
import { ClubSettingsController } from "./club-settings.controller";
import { getPrisma } from "../lib/prisma";

const router = Router();
const auth = passport.authenticate("accessToken", { session: false });
const repo = new ClubSettingsRepository(getPrisma());
const service = new ClubSettingsService(repo);
const controller = new ClubSettingsController(service);

router.get("/", auth, controller.get);
router.patch("/", auth, controller.update);

export default router;
```

- [ ] **Step 5: apiRouter.ts에 등록**

```typescript
import clubSettingsRouter from "./club-settings/club-settings.routes";
// ...
apiRouter.use("/club-settings", clubSettingsRouter);
```

- [ ] **Step 6: FE 서비스 작성**

```typescript
// football/src/services/club-settings.service.ts
import { api } from "./api";

export interface ClubSettings {
  id: number;
  currency: string;
}

export const clubSettingsApi = {
  get: (): Promise<ClubSettings> => api.get("/club-settings"),
  update: (currency: string): Promise<ClubSettings> =>
    api.patch("/club-settings", { currency }),
};
```

- [ ] **Step 7: 동작 확인**

```bash
# GET
curl http://localhost:3000/api/club-settings -H "Authorization: Bearer <token>"
# Expected: {"id":1,"currency":"KRW"}

# PATCH (ADMIN만)
curl -X PATCH http://localhost:3000/api/club-settings \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"currency":"GBP"}'
# Expected: {"id":1,"currency":"GBP"}
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/club-settings/ apps/api/src/apiRouter.ts football/src/services/club-settings.service.ts
git commit -m "feat: ClubSettings API - 구단 통화 설정"
```

---

## Task 4: StaffRecord API + 페이지

**Files:**
- Create: `apps/api/src/staff-record/staff-record.repo.ts`
- Create: `apps/api/src/staff-record/staff-record.service.ts`
- Create: `apps/api/src/staff-record/staff-record.controller.ts`
- Create: `apps/api/src/staff-record/staff-record.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`
- Create: `football/src/services/staff-record.service.ts`
- Create: `football/src/pages/admin/StaffRecordPage.tsx`

- [ ] **Step 1: staff-record.repo.ts 작성**

```typescript
// apps/api/src/staff-record/staff-record.repo.ts
import { PrismaClient } from "@prisma/client";

export class StaffRecordRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(includeInactive = false) {
    return this.prisma.staffRecord.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: number) {
    return this.prisma.staffRecord.findUnique({ where: { id } });
  }

  async create(data: {
    name: string;
    role: string;
    department?: string;
    phone?: string;
    notes?: string;
    createdById: number;
  }) {
    return this.prisma.staffRecord.create({ data });
  }

  async update(id: number, data: {
    name?: string;
    role?: string;
    department?: string;
    phone?: string;
    isActive?: boolean;
    notes?: string;
  }) {
    return this.prisma.staffRecord.update({ where: { id }, data });
  }

  async delete(id: number) {
    return this.prisma.staffRecord.delete({ where: { id } });
  }
}
```

- [ ] **Step 2: staff-record.service.ts 작성**

```typescript
// apps/api/src/staff-record/staff-record.service.ts
import { StaffRecordRepository } from "./staff-record.repo";

export class StaffRecordService {
  constructor(private repo: StaffRecordRepository) {}

  async list(includeInactive = false) {
    return this.repo.findAll(includeInactive);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new Error("NOT_FOUND");
    return record;
  }

  async create(data: { name: string; role: string; department?: string; phone?: string; notes?: string }, createdById: number) {
    return this.repo.create({ ...data, createdById });
  }

  async update(id: number, data: { name?: string; role?: string; department?: string; phone?: string; isActive?: boolean; notes?: string }) {
    await this.get(id);
    return this.repo.update(id, data);
  }

  async delete(id: number) {
    await this.get(id);
    return this.repo.delete(id);
  }
}
```

- [ ] **Step 3: staff-record.controller.ts 작성**

```typescript
// apps/api/src/staff-record/staff-record.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { StaffRecordService } from "./staff-record.service";

const canWrite = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "FRONT_OFFICE" && frontOfficeRole === "GM";

const canRead = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && frontOfficeRole === "GM");

export class StaffRecordController {
  constructor(private service: StaffRecordService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const includeInactive = req.query["includeInactive"] === "true";
      res.json(await this.service.list(includeInactive));
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, id));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      await this.service.delete(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 4: staff-record.routes.ts 작성**

```typescript
// apps/api/src/staff-record/staff-record.routes.ts
import { Router } from "express";
import passport from "passport";
import { StaffRecordRepository } from "./staff-record.repo";
import { StaffRecordService } from "./staff-record.service";
import { StaffRecordController } from "./staff-record.controller";
import { getPrisma } from "../lib/prisma";

const router = Router();
const auth = passport.authenticate("accessToken", { session: false });
const repo = new StaffRecordRepository(getPrisma());
const service = new StaffRecordService(repo);
const controller = new StaffRecordController(service);

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, controller.update);
router.delete("/:id", auth, controller.delete);

export default router;
```

- [ ] **Step 5: apiRouter.ts에 등록**

```typescript
import staffRecordRouter from "./staff-record/staff-record.routes";
// ...
apiRouter.use("/staff-records", staffRecordRouter);
```

- [ ] **Step 6: FE 서비스 작성**

```typescript
// football/src/services/staff-record.service.ts
import { api } from "./api";

export interface StaffRecord {
  id: number;
  name: string;
  role: string;
  department: string | null;
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
  create: (data: Pick<StaffRecord, "name" | "role"> & Partial<Pick<StaffRecord, "department" | "phone" | "notes">>): Promise<StaffRecord> =>
    api.post("/staff-records", data),
  update: (id: number, data: Partial<Pick<StaffRecord, "name" | "role" | "department" | "phone" | "isActive" | "notes">>): Promise<StaffRecord> =>
    api.patch(`/staff-records/${id}`, data),
  delete: (id: number): Promise<void> => api.delete(`/staff-records/${id}`),
};
```

- [ ] **Step 7: StaffRecordPage.tsx 작성**

```tsx
// football/src/pages/admin/StaffRecordPage.tsx
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { staffRecordApi, StaffRecord } from "@/services/staff-record.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

export function StaffRecordPage() {
  const { t } = useTranslation("admin")
  const qc = useQueryClient()
  const [includeInactive, setIncludeInactive] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRecord | null>(null)
  const [form, setForm] = useState({ name: "", role: "", department: "", phone: "", notes: "" })

  const { data: records = [] } = useQuery({
    queryKey: ["staff-records", includeInactive],
    queryFn: () => staffRecordApi.list(includeInactive),
  })

  const createMutation = useMutation({
    mutationFn: staffRecordApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff-records"] }); setOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof staffRecordApi.update>[1] }) =>
      staffRecordApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff-records"] }); setOpen(false); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: staffRecordApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-records"] }),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: "", role: "", department: "", phone: "", notes: "" })
    setOpen(true)
  }

  const openEdit = (r: StaffRecord) => {
    setEditing(r)
    setForm({ name: r.name, role: r.role, department: r.department ?? "", phone: r.phone ?? "", notes: r.notes ?? "" })
    setOpen(true)
  }

  const handleSubmit = () => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form })
    } else {
      createMutation.mutate(form)
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
              <td className="py-2 pr-4 text-muted-foreground">{r.department ?? "-"}</td>
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
                <Button size="sm" variant="ghost" className="text-destructive"
                  onClick={() => { if (confirm(t("staffRecord.confirmDelete"))) deleteMutation.mutate(r.id) }}>
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
            {(["name", "role", "department", "phone", "notes"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label>{t(`staffRecord.${field}`)}</Label>
                <Input value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            {editing && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.name !== "" && editing.isActive}
                  onCheckedChange={(v) => updateMutation.mutate({ id: editing.id, data: { isActive: v } })}
                />
                <Label>{t("staffRecord.active")}</Label>
              </div>
            )}
            <Button className="w-full" onClick={handleSubmit}>{t("action.save", { ns: "common" })}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 8: admin.json i18n 추가 (ko)**

`football/src/locales/ko/admin.json`에 `staffRecord` 섹션 추가:

```json
"staffRecord": {
  "title": "직원 기록",
  "add": "직원 추가",
  "edit": "직원 수정",
  "name": "이름",
  "role": "역할",
  "department": "소속 부서",
  "phone": "연락처",
  "notes": "비고",
  "status": "재직 상태",
  "active": "재직 중",
  "inactive": "퇴직",
  "showInactive": "퇴직자 포함",
  "confirmDelete": "이 직원 기록을 삭제하시겠습니까?"
}
```

- [ ] **Step 9: admin.json i18n 추가 (en)**

```json
"staffRecord": {
  "title": "Staff Records",
  "add": "Add Staff",
  "edit": "Edit Staff",
  "name": "Name",
  "role": "Role",
  "department": "Department",
  "phone": "Phone",
  "notes": "Notes",
  "status": "Status",
  "active": "Active",
  "inactive": "Inactive",
  "showInactive": "Include inactive",
  "confirmDelete": "Delete this staff record?"
}
```

- [ ] **Step 10: 라우트 등록 및 사이드바 연결 확인**

`football/src/App.tsx` 또는 라우터 파일에서 `/admin/staff` 경로에 `StaffRecordPage` 등록. 사이드바 nav에 관련 항목이 있으면 연결.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/staff-record/ apps/api/src/apiRouter.ts \
  football/src/services/staff-record.service.ts \
  football/src/pages/admin/StaffRecordPage.tsx \
  football/src/locales/
git commit -m "feat: StaffRecord - 비로그인 직원 기록 CRUD"
```

---

## Task 5: MealExpense API + 페이지

**Files:**
- Create: `apps/api/src/meal-expense/meal-expense.repo.ts`
- Create: `apps/api/src/meal-expense/meal-expense.service.ts`
- Create: `apps/api/src/meal-expense/meal-expense.controller.ts`
- Create: `apps/api/src/meal-expense/meal-expense.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`
- Create: `football/src/services/meal-expense.service.ts`
- Create: `football/src/pages/admin/MealExpensePage.tsx`

- [ ] **Step 1: meal-expense.repo.ts 작성**

```typescript
// apps/api/src/meal-expense/meal-expense.repo.ts
import { PrismaClient, MealExpenseType } from "@prisma/client";

export class MealExpenseRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(filters: { type?: MealExpenseType; from?: Date; to?: Date } = {}) {
    return this.prisma.mealExpense.findMany({
      where: {
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.from || filters.to
          ? { date: { gte: filters.from, lte: filters.to } }
          : {}),
      },
      include: { createdBy: { select: { id: true, username: true } } },
      orderBy: { date: "desc" },
    });
  }

  async findById(id: number) {
    return this.prisma.mealExpense.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, username: true } } },
    });
  }

  async create(data: {
    type: MealExpenseType;
    sessionId?: number;
    matchId?: number;
    date: Date;
    amount: number;
    restaurantName?: string;
    note?: string;
    createdById: number;
  }) {
    return this.prisma.mealExpense.create({ data });
  }

  async update(id: number, data: {
    amount?: number;
    restaurantName?: string;
    note?: string;
  }) {
    return this.prisma.mealExpense.update({ where: { id }, data });
  }

  async delete(id: number) {
    return this.prisma.mealExpense.delete({ where: { id } });
  }
}
```

- [ ] **Step 2: meal-expense.service.ts 작성**

```typescript
// apps/api/src/meal-expense/meal-expense.service.ts
import { MealExpenseType } from "@prisma/client";
import { MealExpenseRepository } from "./meal-expense.repo";

export class MealExpenseService {
  constructor(private repo: MealExpenseRepository) {}

  async list(filters: { type?: MealExpenseType; from?: string; to?: string }) {
    return this.repo.findAll({
      type: filters.type,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    });
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new Error("NOT_FOUND");
    return record;
  }

  async create(data: {
    type: MealExpenseType;
    sessionId?: number;
    matchId?: number;
    date: string;
    amount: number;
    restaurantName?: string;
    note?: string;
  }, createdById: number) {
    if (data.type === "TRAINING" && !data.sessionId) throw new Error("sessionId required for TRAINING type");
    if (data.type === "MATCH" && !data.matchId) throw new Error("matchId required for MATCH type");
    return this.repo.create({ ...data, date: new Date(data.date), createdById });
  }

  async update(id: number, data: { amount?: number; restaurantName?: string; note?: string }) {
    await this.get(id);
    return this.repo.update(id, data);
  }

  async delete(id: number) {
    await this.get(id);
    return this.repo.delete(id);
  }
}
```

- [ ] **Step 3: meal-expense.controller.ts 작성**

```typescript
// apps/api/src/meal-expense/meal-expense.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { MealExpenseService } from "./meal-expense.service";

const canWrite = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" &&
    (frontOfficeRole === "GM" || frontOfficeRole === "FINANCE_MANAGER" || frontOfficeRole === "EQUIPMENT_MANAGER"));

const canRead = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "ADMIN" ||
  (role === "FRONT_OFFICE" && (frontOfficeRole === "GM" || frontOfficeRole === "FINANCE_MANAGER"));

export class MealExpenseController {
  constructor(private service: MealExpenseService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { type, from, to } = req.query as Record<string, string>;
      res.json(await this.service.list({ type: type as any, from, to }));
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, id));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      await this.service.delete(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 4: meal-expense.routes.ts 작성**

```typescript
// apps/api/src/meal-expense/meal-expense.routes.ts
import { Router } from "express";
import passport from "passport";
import { MealExpenseRepository } from "./meal-expense.repo";
import { MealExpenseService } from "./meal-expense.service";
import { MealExpenseController } from "./meal-expense.controller";
import { getPrisma } from "../lib/prisma";

const router = Router();
const auth = passport.authenticate("accessToken", { session: false });
const repo = new MealExpenseRepository(getPrisma());
const service = new MealExpenseService(repo);
const controller = new MealExpenseController(service);

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, controller.update);
router.delete("/:id", auth, controller.delete);

export default router;
```

- [ ] **Step 5: apiRouter.ts에 등록**

```typescript
import mealExpenseRouter from "./meal-expense/meal-expense.routes";
// ...
apiRouter.use("/meal-expenses", mealExpenseRouter);
```

- [ ] **Step 6: FE 서비스 작성**

```typescript
// football/src/services/meal-expense.service.ts
import { api } from "./api";

export type MealExpenseType = "TRAINING" | "MATCH";

export interface MealExpense {
  id: number;
  type: MealExpenseType;
  sessionId: number | null;
  matchId: number | null;
  date: string;
  amount: number;
  restaurantName: string | null;
  note: string | null;
  createdById: number;
  createdAt: string;
  createdBy: { id: number; username: string };
}

export const mealExpenseApi = {
  list: (params?: { type?: MealExpenseType; from?: string; to?: string }): Promise<MealExpense[]> => {
    const qs = new URLSearchParams(params as any).toString();
    return api.get(`/meal-expenses${qs ? `?${qs}` : ""}`);
  },
  get: (id: number): Promise<MealExpense> => api.get(`/meal-expenses/${id}`),
  create: (data: Pick<MealExpense, "type" | "date" | "amount"> & {
    sessionId?: number; matchId?: number; restaurantName?: string; note?: string;
  }): Promise<MealExpense> => api.post("/meal-expenses", data),
  update: (id: number, data: Partial<Pick<MealExpense, "amount" | "restaurantName" | "note">>): Promise<MealExpense> =>
    api.patch(`/meal-expenses/${id}`, data),
  delete: (id: number): Promise<void> => api.delete(`/meal-expenses/${id}`),
};
```

- [ ] **Step 7: i18n 추가 (ko/admin.json)**

```json
"mealExpense": {
  "title": "식대 관리",
  "add": "식대 기록 추가",
  "type": "구분",
  "TRAINING": "훈련일",
  "MATCH": "경기일",
  "date": "날짜",
  "amount": "금액",
  "restaurantName": "식당명",
  "note": "비고",
  "confirmDelete": "이 식대 기록을 삭제하시겠습니까?"
}
```

- [ ] **Step 8: i18n 추가 (en/admin.json)**

```json
"mealExpense": {
  "title": "Meal Expenses",
  "add": "Add Meal Expense",
  "type": "Type",
  "TRAINING": "Training Day",
  "MATCH": "Match Day",
  "date": "Date",
  "amount": "Amount",
  "restaurantName": "Restaurant",
  "note": "Note",
  "confirmDelete": "Delete this meal expense?"
}
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/meal-expense/ apps/api/src/apiRouter.ts \
  football/src/services/meal-expense.service.ts \
  football/src/locales/
git commit -m "feat: MealExpense - 세션/경기일 식대 기록 CRUD"
```

---

## Task 6: Player 알레르기 필드 연동

**Files:**
- Modify: `apps/api/src/player/player.service.ts`
- Modify: `football/src/services/player.service.ts` (타입 확장)
- Modify: `football/src/pages/players/PlayerDetailPage.tsx`

- [ ] **Step 1: BE player.service.ts updatePlayer에 allergies/foodPreferences 허용**

`player.service.ts`의 updatePlayer 메서드에서 허용 필드에 추가:

```typescript
// 기존 FRONT_OFFICE 수정 가능 필드 블록에 추가
if (body.allergies !== undefined) updateData.allergies = body.allergies;
if (body.foodPreferences !== undefined) updateData.foodPreferences = body.foodPreferences;
```

- [ ] **Step 2: FE player 타입에 필드 추가**

`football/src/services/player.service.ts`의 Player 인터페이스에:

```typescript
allergies: string[];
foodPreferences: string | null;
```

- [ ] **Step 3: PlayerDetailPage에 알레르기 섹션 추가**

FRONT_OFFICE 역할 사용자에게 `allergies`와 `foodPreferences`를 표시하고 수정할 수 있는 섹션을 기존 인적사항 카드 하단에 추가.

```tsx
{/* 알레르기 / 식이 정보 — FRONT_OFFICE만 표시 */}
{(user.role === "FRONT_OFFICE" || user.role === "ADMIN") && (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold">{t("player.allergySection")}</h3>
    <div className="flex flex-wrap gap-1.5">
      {player.allergies.map((a) => (
        <Badge key={a} variant="outline">{a}</Badge>
      ))}
      {player.allergies.length === 0 && (
        <span className="text-sm text-muted-foreground">{t("player.noAllergies")}</span>
      )}
    </div>
    {player.foodPreferences && (
      <p className="text-sm text-muted-foreground">{player.foodPreferences}</p>
    )}
  </div>
)}
```

- [ ] **Step 4: i18n 추가**

`ko/player.json`:
```json
"allergySection": "알레르기 / 식이 정보",
"noAllergies": "알레르기 정보 없음"
```

`en/player.json`:
```json
"allergySection": "Allergies & Diet",
"noAllergies": "No allergy information"
```

- [ ] **Step 5: 동작 확인**

선수 상세 페이지에서 FRONT_OFFICE 로그인 후 알레르기 섹션이 표시되는지 확인.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/player/ football/src/services/player.service.ts \
  football/src/pages/players/PlayerDetailPage.tsx \
  football/src/locales/
git commit -m "feat: Player 알레르기·식이 정보 필드 추가"
```

---

## Self-Review

**Spec coverage 체크:**
- [x] Player.allergies / foodPreferences → Task 6
- [x] ClubSettings.currency → Task 3
- [x] Season.wageCapType / wageCapValue → Task 1 (스키마만; 시뮬레이션 로직은 Plan B)
- [x] FINANCE_MANAGER 역할 → Task 1 + Task 2
- [x] StaffRecord → Task 4
- [x] MealExpense → Task 5

**누락 없음. Placeholder 없음.**
