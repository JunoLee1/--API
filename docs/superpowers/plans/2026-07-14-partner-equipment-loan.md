# Partner & Equipment Loan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제조사·병원을 `Partner` 단일 모델로 통합하고, 계약(PartnerContract)과 장비 대여 신청(EquipmentLoan) 워크플로우를 추가한다.

**Architecture:** 기존 `Hospital` 모델을 `Partner(type: MANUFACTURER|HOSPITAL)`로 통합하여 병원·제조사 계약을 단일 `PartnerContract` 테이블에서 관리. `EquipmentLoan`은 기존 `EquipmentAssignment`와 병행하며 선수 신청 → Kit Manager 승인 → 지급 → 반납 4단계 워크플로우를 구현. 만료 임박 계약 알림은 `/notifications/partners` 기존 엔드포인트를 `PartnerContract`로 교체.

**Tech Stack:** Express 5, Prisma 7 (db push), TypeScript (exactOptionalPropertyTypes), React 19, Sonner, Radix UI/shadcn

---

## File Map

### Backend — new / modified

| 파일 | 역할 |
|---|---|
| `apps/api/prisma/schema.prisma` | Partner, PartnerContract, EquipmentLoan 모델 추가; Hospital 제거; Injury.hospitalId→partnerId |
| `apps/api/src/partner/dto/partner.dto.ts` | CreatePartnerDto, CreatePartnerContractDto |
| `apps/api/src/partner/partner.repo.ts` | Partner + PartnerContract CRUD |
| `apps/api/src/partner/partner.service.ts` | 비즈니스 로직 |
| `apps/api/src/partner/partner.controller.ts` | HTTP 핸들러 |
| `apps/api/src/partner/partner.routes.ts` | 라우트 등록 |
| `apps/api/src/equipment/dto/equipment.dto.ts` | CreateEquipmentLoanDto, UpdateEquipmentLoanDto 추가 |
| `apps/api/src/equipment/equipment.repo.ts` | Loan CRUD 메서드 추가, EquipmentItem에 partnerId 추가 |
| `apps/api/src/equipment/equipment.service.ts` | Loan 워크플로우 + 알림 로직 추가 |
| `apps/api/src/equipment/equipment.controller.ts` | Loan 엔드포인트 추가 |
| `apps/api/src/equipment/equipment.routes.ts` | Loan 라우트 추가 |
| `apps/api/src/hospital/` | 전체 삭제 (Partner로 통합) |
| `apps/api/src/injury/injury.repo.ts` | hospitalId → partnerId 필드명 변경 |
| `apps/api/src/injury/dto/injury.dto.ts` | hospitalId → partnerId |
| `apps/api/src/notification/notification.repo.ts` | findExpiringContracts → PartnerContract 조회로 교체 |
| `apps/api/src/apiRouter.ts` | /hospitals 제거, /partners 추가 |

### Frontend — new / modified

| 파일 | 역할 |
|---|---|
| `football/src/types/partner.ts` | Partner, PartnerContract 타입 + 레이블 상수 |
| `football/src/services/partner.service.ts` | partnerApi CRUD |
| `football/src/types/hospital.ts` | 삭제 (partner.ts로 통합) |
| `football/src/services/hospital.service.ts` | 삭제 |
| `football/src/types/equipment.ts` | EquipmentLoan 타입 추가, EquipmentItem에 partner 추가 |
| `football/src/services/equipment.service.ts` | loanApi 추가 |
| `football/src/pages/admin/PartnersPage.tsx` | Partner CRUD + 계약 관리 (탭: 병원 / 제조사) |
| `football/src/pages/equipment/EquipmentPage.tsx` | 대여 신청 탭 추가 (선수용), Kit Manager 승인/지급/반납 |
| `football/src/pages/injuries/InjuriesPage.tsx` | hospitalId → partnerId, /hospitals → /partners?type=HOSPITAL |
| `football/src/layouts/AppShell.tsx` | /admin/partners 네비 항목 추가 |
| `football/src/App.tsx` | /admin/partners 라우트 추가 |

---

## Task 1: Prisma 스키마 변경 + db push

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: 스키마에 새 enum/모델 추가, 기존 Hospital 제거**

```prisma
// schema.prisma에 추가할 enum/모델:

enum PartnerType {
  MANUFACTURER
  HOSPITAL
}

enum PartnerContractStatus {
  ACTIVE
  EXPIRED
  TERMINATED
}

enum EquipmentLoanStatus {
  REQUESTED
  APPROVED
  REJECTED
  ISSUED
  RETURNED
}

model Partner {
  id        Int         @id @default(autoincrement())
  type      PartnerType
  name      String
  country   String?
  website   String?
  address   String?
  phone     String?
  createdAt DateTime    @default(now())

  injuries  Injury[]
  equipmentItems EquipmentItem[]
  contracts PartnerContract[]
}

model PartnerContract {
  id             Int                   @id @default(autoincrement())
  partnerId      Int
  status         PartnerContractStatus @default(ACTIVE)
  startDate      DateTime
  endDate        DateTime
  sponsorshipFee Float?
  discountRate   Float?
  notes          String?
  createdAt      DateTime              @default(now())

  partner Partner @relation(fields: [partnerId], references: [id])
}

model EquipmentLoan {
  id              Int                @id @default(autoincrement())
  status          EquipmentLoanStatus @default(REQUESTED)
  requestedAt     DateTime           @default(now())
  requestedById   Int
  approvedById    Int?
  issuedAt        DateTime?
  returnedAt      DateTime?
  notes           String?
  equipmentItemId Int
  equipmentUnitId Int?

  requestedBy   User          @relation("LoanRequestedBy", fields: [requestedById], references: [id])
  approvedBy    User?         @relation("LoanApprovedBy", fields: [approvedById], references: [id])
  equipmentItem EquipmentItem @relation(fields: [equipmentItemId], references: [id])
  equipmentUnit EquipmentUnit? @relation(fields: [equipmentUnitId], references: [id])
}
```

- [x] **Step 2: Injury 모델 수정 (hospitalId → partnerId)**

`apps/api/prisma/schema.prisma`의 Injury 모델에서:
```prisma
// 제거:
  hospitalId         Int?
  hospital     Hospital? @relation(fields: [hospitalId], references: [id])

// 추가:
  partnerId          Int?
  partner      Partner? @relation(fields: [partnerId], references: [id])
```

- [x] **Step 3: EquipmentItem 모델에 partnerId 추가**

```prisma
model EquipmentItem {
  // 기존 필드 유지 ...
  partnerId           Int?
  partner             Partner?        @relation(fields: [partnerId], references: [id])
  loans               EquipmentLoan[]
}
```

- [x] **Step 4: EquipmentUnit 모델에 loans 역관계 추가**

```prisma
model EquipmentUnit {
  // 기존 필드 유지 ...
  loans EquipmentLoan[]
}
```

- [x] **Step 5: User 모델에 EquipmentLoan 역관계 추가**

```prisma
model User {
  // 기존 필드 유지 ...
  requestedLoans  EquipmentLoan[] @relation("LoanRequestedBy")
  approvedLoans   EquipmentLoan[] @relation("LoanApprovedBy")
}
```

- [x] **Step 6: Hospital 모델 완전 삭제**

schema.prisma에서 `model Hospital { ... }` 블록 전체 삭제.

- [x] **Step 7: db push 실행**

```bash
cd apps/api && npx prisma db push
```
Expected: `Your database is now in sync with your Prisma schema.`

- [x] **Step 8: Prisma client 재생성 확인**

```bash
ls apps/api/src/generated/enums.ts | xargs grep "PartnerType\|EquipmentLoanStatus"
```
Expected: 두 enum이 출력됨.

- [x] **Step 9: 커밋**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add Partner, PartnerContract, EquipmentLoan models; remove Hospital"
```

---

## Task 2: Partner 백엔드 (repo → service → controller → routes)

**Files:**
- Create: `apps/api/src/partner/dto/partner.dto.ts`
- Create: `apps/api/src/partner/partner.repo.ts`
- Create: `apps/api/src/partner/partner.service.ts`
- Create: `apps/api/src/partner/partner.controller.ts`
- Create: `apps/api/src/partner/partner.routes.ts`
- Create: `apps/api/__test__/partner/partner.service.test.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: DTO 작성**

`apps/api/src/partner/dto/partner.dto.ts`:
```typescript
import { PartnerType, PartnerContractStatus } from "../../generated/enums";

export interface CreatePartnerDto {
  type: PartnerType;
  name: string;
  country?: string;
  website?: string;
  address?: string;
  phone?: string;
}

export interface UpdatePartnerDto {
  name?: string;
  country?: string;
  website?: string;
  address?: string;
  phone?: string;
}

export interface CreatePartnerContractDto {
  startDate: string;
  endDate: string;
  sponsorshipFee?: number;
  discountRate?: number;
  notes?: string;
}

export interface UpdatePartnerContractDto {
  status?: PartnerContractStatus;
  endDate?: string;
  sponsorshipFee?: number;
  discountRate?: number;
  notes?: string;
}
```

- [x] **Step 2: Repo 작성**

`apps/api/src/partner/partner.repo.ts`:
```typescript
import { PrismaClient } from "../generated/client";
import { PartnerType } from "../generated/enums";
import { CreatePartnerDto, UpdatePartnerDto, CreatePartnerContractDto, UpdatePartnerContractDto } from "./dto/partner.dto";

const PARTNER_SELECT = {
  id: true, type: true, name: true, country: true,
  website: true, address: true, phone: true, createdAt: true,
} as const;

const CONTRACT_SELECT = {
  id: true, partnerId: true, status: true, startDate: true,
  endDate: true, sponsorshipFee: true, discountRate: true, notes: true, createdAt: true,
} as const;

export class PartnerRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(type?: PartnerType) {
    return this.prisma.partner.findMany({
      where: type ? { type } : undefined,
      select: { ...PARTNER_SELECT, contracts: { select: CONTRACT_SELECT, orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
    });
  }

  findById(id: number) {
    return this.prisma.partner.findUnique({
      where: { id },
      select: { ...PARTNER_SELECT, contracts: { select: CONTRACT_SELECT, orderBy: { createdAt: "desc" } } },
    });
  }

  create(dto: CreatePartnerDto) {
    return this.prisma.partner.create({
      data: {
        type: dto.type,
        name: dto.name,
        ...(dto.country && { country: dto.country }),
        ...(dto.website && { website: dto.website }),
        ...(dto.address && { address: dto.address }),
        ...(dto.phone && { phone: dto.phone }),
      },
      select: PARTNER_SELECT,
    });
  }

  update(id: number, dto: UpdatePartnerDto) {
    return this.prisma.partner.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
      select: PARTNER_SELECT,
    });
  }

  createContract(partnerId: number, dto: CreatePartnerContractDto) {
    return this.prisma.partnerContract.create({
      data: {
        partnerId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        ...(dto.sponsorshipFee !== undefined && { sponsorshipFee: dto.sponsorshipFee }),
        ...(dto.discountRate !== undefined && { discountRate: dto.discountRate }),
        ...(dto.notes && { notes: dto.notes }),
      },
      select: CONTRACT_SELECT,
    });
  }

  updateContract(id: number, dto: UpdatePartnerContractDto) {
    return this.prisma.partnerContract.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.sponsorshipFee !== undefined && { sponsorshipFee: dto.sponsorshipFee }),
        ...(dto.discountRate !== undefined && { discountRate: dto.discountRate }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      select: CONTRACT_SELECT,
    });
  }

  findExpiringContracts(withinDays: number) {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + withinDays);
    return this.prisma.partnerContract.findMany({
      where: { status: "ACTIVE", endDate: { gte: now, lte: threshold } },
      select: {
        id: true, endDate: true, sponsorshipFee: true, discountRate: true,
        partner: { select: { id: true, name: true, type: true } },
      },
      orderBy: { endDate: "asc" },
    });
  }
}
```

- [x] **Step 3: Service 작성**

`apps/api/src/partner/partner.service.ts`:
```typescript
import { PartnerRepository } from "./partner.repo";
import { AppError } from "../lib/appError";
import { PartnerType } from "../generated/enums";
import { CreatePartnerDto, UpdatePartnerDto, CreatePartnerContractDto, UpdatePartnerContractDto } from "./dto/partner.dto";

export class PartnerService {
  constructor(private repo: PartnerRepository) {}

  list(type?: PartnerType) {
    return this.repo.findAll(type);
  }

  async getById(id: number) {
    const partner = await this.repo.findById(id);
    if (!partner) throw new AppError(404, "PARTNER_NOT_FOUND");
    return partner;
  }

  create(dto: CreatePartnerDto) {
    if (!dto.name?.trim()) throw new AppError(400, "PARTNER_NAME_REQUIRED");
    return this.repo.create({ ...dto, name: dto.name.trim() });
  }

  async update(id: number, dto: UpdatePartnerDto) {
    await this.getById(id);
    return this.repo.update(id, dto);
  }

  async createContract(partnerId: number, dto: CreatePartnerContractDto) {
    await this.getById(partnerId);
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new AppError(400, "CONTRACT_END_BEFORE_START");
    }
    return this.repo.createContract(partnerId, dto);
  }

  async updateContract(partnerId: number, contractId: number, dto: UpdatePartnerContractDto) {
    await this.getById(partnerId);
    return this.repo.updateContract(contractId, dto);
  }
}
```

- [x] **Step 4: 서비스 테스트 작성**

`apps/api/__test__/partner/partner.service.test.ts`:
```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { PartnerService } from "../../src/partner/partner.service";

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1, type: "HOSPITAL", name: "서울대병원" }),
  update: jest.fn(),
  createContract: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
  updateContract: jest.fn(),
  findExpiringContracts: jest.fn(),
} as any;

const service = new PartnerService(mockRepo);

describe("PartnerService - create", () => {
  beforeEach(() => jest.clearAllMocks());

  test("빈 이름이면 400 에러", async () => {
    await expect(service.create({ type: "HOSPITAL", name: "  " }))
      .rejects.toMatchObject({ code: "PARTNER_NAME_REQUIRED" });
  });

  test("정상 파트너 생성", async () => {
    const result = await service.create({ type: "HOSPITAL", name: "서울대병원" });
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "서울대병원" }));
    expect(result.id).toBe(1);
  });
});

describe("PartnerService - createContract", () => {
  beforeEach(() => jest.clearAllMocks());

  test("종료일이 시작일보다 앞이면 400 에러", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    await expect(service.createContract(1, {
      startDate: "2026-12-01",
      endDate: "2026-01-01",
    })).rejects.toMatchObject({ code: "CONTRACT_END_BEFORE_START" });
  });

  test("정상 계약 생성", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    await service.createContract(1, { startDate: "2026-01-01", endDate: "2027-01-01" });
    expect(mockRepo.createContract).toHaveBeenCalledWith(1, expect.objectContaining({ startDate: "2026-01-01" }));
  });
});
```

- [x] **Step 5: 테스트 실행 (실패 확인)**

```bash
cd apps/api && npx jest __test__/partner/partner.service.test.ts --no-coverage
```
Expected: FAIL (PartnerService not found)

- [x] **Step 6: Controller 작성**

`apps/api/src/partner/partner.controller.ts`:
```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { PartnerService } from "./partner.service";
import { PartnerType } from "../generated/enums";

const canManage = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && frontOfficeRole === "EQUIPMENT_MANAGER");

const canRead = (role: string) =>
  role === "ADMIN" || role === "FRONT_OFFICE" || role === "COACHING_STAFF";

export class PartnerController {
  constructor(private service: PartnerService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canRead(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      const type = req.query["type"] as PartnerType | undefined;
      res.status(200).json(await this.service.list(type));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canRead(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canManage(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canManage(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  createContract = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createContract(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  updateContract = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.updateContract(
        Number(req.params["id"]),
        Number(req.params["contractId"]),
        req.body,
      ));
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 7: Routes 작성**

`apps/api/src/partner/partner.routes.ts`:
```typescript
import { Router } from "express";
import passport from "passport";
import { PartnerController } from "./partner.controller";
import { PartnerService } from "./partner.service";
import { PartnerRepository } from "./partner.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new PartnerRepository(getPrisma());
const service = new PartnerService(repo);
const controller = new PartnerController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.getById);
router.patch("/:id", auth, controller.update);
router.post("/:id/contracts", auth, controller.createContract);
router.patch("/:id/contracts/:contractId", auth, controller.updateContract);

export default router;
```

- [x] **Step 8: apiRouter에 등록, /hospitals 제거**

`apps/api/src/apiRouter.ts`:
```typescript
// 제거:
import hospitalRouter from "./hospital/hospital.routes";
apiRouter.use("/hospitals", hospitalRouter);

// 추가:
import partnerRouter from "./partner/partner.routes";
apiRouter.use("/partners", partnerRouter);
```

- [x] **Step 9: 테스트 통과 확인**

```bash
cd apps/api && npx jest __test__/partner/partner.service.test.ts --no-coverage
```
Expected: PASS (4 tests)

- [x] **Step 10: TS 체크**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|ErrorHandler"
```
Expected: 출력 없음 (오류 없음)

- [x] **Step 11: 커밋**

```bash
git add apps/api/src/partner/ apps/api/__test__/partner/ apps/api/src/apiRouter.ts
git commit -m "feat(partner): unified Partner + PartnerContract CRUD API (replaces Hospital)"
```

---

## Task 3: Injury 코드 hospitalId → partnerId 마이그레이션

**Files:**
- Modify: `apps/api/src/injury/dto/injury.dto.ts`
- Modify: `apps/api/src/injury/injury.repo.ts`

- [x] **Step 1: DTO 수정**

`apps/api/src/injury/dto/injury.dto.ts`에서:
```typescript
// 변경 전:
  hospitalType?: HospitalType;
  hospitalId?: number;
  customHospitalName?: string;

// 변경 후:
  hospitalType?: HospitalType;
  partnerId?: number;         // 협진 파트너 병원 ID (hospitalType=ACCREDITED 시)
  customHospitalName?: string;
```

- [x] **Step 2: Repo INJURY_SELECT 수정**

`apps/api/src/injury/injury.repo.ts`의 `INJURY_SELECT`에서:
```typescript
// 변경 전:
  hospitalType: true,
  hospitalId: true,
  customHospitalName: true,
  hospital: { select: { id: true, name: true } },

// 변경 후:
  hospitalType: true,
  partnerId: true,
  customHospitalName: true,
  partner: { select: { id: true, name: true } },
```

- [x] **Step 3: Repo create() 수정**

`apps/api/src/injury/injury.repo.ts`의 `create()` 메서드에서:
```typescript
// 변경 전:
  hospitalType: dto.hospitalType ?? null,
  hospitalId: dto.hospitalId ?? null,

// 변경 후:
  hospitalType: dto.hospitalType ?? null,
  partnerId: dto.partnerId ?? null,
```

- [x] **Step 4: TS 체크**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|ErrorHandler"
```
Expected: 출력 없음

- [x] **Step 5: hospital/ 디렉토리 삭제**

```bash
rm -rf apps/api/src/hospital/
```

- [x] **Step 6: 커밋**

```bash
git add apps/api/src/injury/ && git rm -r apps/api/src/hospital/
git commit -m "refactor(injury): migrate hospitalId → partnerId; remove Hospital module"
```

---

## Task 4: 만료 알림 → PartnerContract로 교체

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`
- Modify: `apps/api/src/notification/notification.service.ts`

- [x] **Step 1: notification.repo.ts의 findExpiringContracts 교체**

`apps/api/src/notification/notification.repo.ts`에서 기존 `findExpiringContracts` 메서드를:
```typescript
  findExpiringContracts(withinDays: number) {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + withinDays);
    return this.prisma.partnerContract.findMany({
      where: { status: "ACTIVE", endDate: { gte: now, lte: threshold } },
      select: {
        id: true, endDate: true, sponsorshipFee: true, discountRate: true,
        partner: { select: { id: true, name: true, type: true } },
      },
      orderBy: { endDate: "asc" },
    });
  }
```

- [x] **Step 2: notification.service.ts의 getPartnerAlerts 교체**

`apps/api/src/notification/notification.service.ts`의 `getPartnerAlerts()`:
```typescript
  async getPartnerAlerts() {
    const contracts = await this.repo.findExpiringContracts(30);
    return contracts.map((c) => {
      const daysLeft = Math.ceil((c.endDate.getTime() - Date.now()) / 86_400_000);
      return {
        type: "CONTRACT_EXPIRY",
        title: "계약 만료 임박",
        body: `${c.partner.name} ${c.partner.type === "HOSPITAL" ? "병원" : "제조사"} 계약이 ${daysLeft}일 후 만료됩니다.`,
        daysLeft,
        contractId: c.id,
        partnerId: c.partner.id,
        partnerName: c.partner.name,
        partnerType: c.partner.type,
        endDate: c.endDate.toISOString(),
        sponsorshipFee: c.sponsorshipFee,
        discountRate: c.discountRate,
      };
    });
  }
```

- [x] **Step 3: TS 체크 + 커밋**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|ErrorHandler"
git add apps/api/src/notification/
git commit -m "refactor(notification): partner alerts use PartnerContract instead of Contract"
```

---

## Task 5: EquipmentLoan 백엔드

**Files:**
- Modify: `apps/api/src/equipment/dto/equipment.dto.ts`
- Modify: `apps/api/src/equipment/equipment.repo.ts`
- Modify: `apps/api/src/equipment/equipment.service.ts`
- Modify: `apps/api/src/equipment/equipment.controller.ts`
- Modify: `apps/api/src/equipment/equipment.routes.ts`
- Create: `apps/api/__test__/equipment/equipment.loan.service.test.ts`

- [x] **Step 1: DTO 추가**

`apps/api/src/equipment/dto/equipment.dto.ts` 끝에 추가:
```typescript
import { EquipmentLoanStatus } from "../../generated/enums";

export interface CreateEquipmentLoanDto {
  equipmentItemId: number;
  notes?: string;
}

export interface UpdateEquipmentLoanStatusDto {
  status: EquipmentLoanStatus;
  equipmentUnitId?: number;  // ISSUED 시 Kit Manager가 Unit 배정
}
```

- [x] **Step 2: Repo에 Loan 메서드 추가**

`apps/api/src/equipment/equipment.repo.ts`에 추가:
```typescript
const LOAN_SELECT = {
  id: true, status: true, requestedAt: true, issuedAt: true, returnedAt: true,
  notes: true, equipmentItemId: true, equipmentUnitId: true,
  requestedBy: { select: { id: true, nickname: true } },
  approvedBy: { select: { id: true, nickname: true } },
  equipmentItem: { select: { id: true, name: true, category: true } },
  equipmentUnit: { select: { id: true } },
} as const;

// EquipmentRepository 클래스 안에 추가:
  findLoanById(id: number) {
    return this.prisma.equipmentLoan.findUnique({ where: { id }, select: LOAN_SELECT });
  }

  findAllLoans(status?: EquipmentLoanStatus) {
    return this.prisma.equipmentLoan.findMany({
      where: status ? { status } : undefined,
      select: LOAN_SELECT,
      orderBy: { requestedAt: "desc" },
    });
  }

  findMyLoans(userId: number) {
    return this.prisma.equipmentLoan.findMany({
      where: { requestedById: userId },
      select: LOAN_SELECT,
      orderBy: { requestedAt: "desc" },
    });
  }

  createLoan(requestedById: number, dto: CreateEquipmentLoanDto) {
    return this.prisma.equipmentLoan.create({
      data: {
        requestedById,
        equipmentItemId: dto.equipmentItemId,
        ...(dto.notes && { notes: dto.notes }),
      },
      select: LOAN_SELECT,
    });
  }

  updateLoan(id: number, data: {
    status: EquipmentLoanStatus;
    approvedById?: number;
    equipmentUnitId?: number;
    issuedAt?: Date;
    returnedAt?: Date;
  }) {
    return this.prisma.equipmentLoan.update({
      where: { id },
      data,
      select: LOAN_SELECT,
    });
  }

  findEquipmentManagers() { /* 이미 존재 */ }
```

- [x] **Step 3: 서비스 테스트 작성**

`apps/api/__test__/equipment/equipment.loan.service.test.ts`:
```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { EquipmentService } from "../../src/equipment/equipment.service";

const mockEquipmentRepo = {
  findAllItems: jest.fn(),
  findItemById: jest.fn(),
  createItem: jest.fn(),
  adjustQuantity: jest.fn(),
  createUnit: jest.fn(),
  findUnitById: jest.fn(),
  updateUnitStatus: jest.fn(),
  createAssignment: jest.fn(),
  findUnreturnedByPlayer: jest.fn(),
  findAssignmentById: jest.fn(),
  markReturned: jest.fn(),
  findEquipmentManagers: jest.fn<() => Promise<{ id: number }[]>>().mockResolvedValue([{ id: 10 }]),
  findLoanById: jest.fn(),
  findAllLoans: jest.fn(),
  findMyLoans: jest.fn(),
  createLoan: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1, status: "REQUESTED" }),
  updateLoan: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
} as any;

const mockNotificationRepo = { create: jest.fn(), createForStaff: jest.fn() } as any;
const service = new EquipmentService(mockEquipmentRepo, mockNotificationRepo);

describe("EquipmentService - requestLoan", () => {
  beforeEach(() => jest.clearAllMocks());

  test("대여 신청 생성 후 EQUIPMENT_MANAGER에게 알림", async () => {
    mockEquipmentRepo.findItemById.mockResolvedValue({ id: 1, name: "훈련화", quantity: 5 });
    await service.requestLoan(99, { equipmentItemId: 1 });
    expect(mockEquipmentRepo.createLoan).toHaveBeenCalledWith(99, expect.objectContaining({ equipmentItemId: 1 }));
    expect(mockNotificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 10, type: "EQUIPMENT_LOAN_REQUESTED" }),
    );
  });
});

describe("EquipmentService - approveLoan / rejectLoan", () => {
  beforeEach(() => jest.clearAllMocks());

  test("REQUESTED 상태의 대여 승인", async () => {
    mockEquipmentRepo.findLoanById.mockResolvedValue({ id: 1, status: "REQUESTED", requestedById: 5, equipmentItem: { name: "훈련화" } });
    await service.approveLoan(1, 10);
    expect(mockEquipmentRepo.updateLoan).toHaveBeenCalledWith(1, expect.objectContaining({ status: "APPROVED", approvedById: 10 }));
  });

  test("APPROVED가 아닌 상태에서 approveLoan 시 409", async () => {
    mockEquipmentRepo.findLoanById.mockResolvedValue({ id: 1, status: "ISSUED", requestedById: 5, equipmentItem: { name: "훈련화" } });
    await expect(service.approveLoan(1, 10)).rejects.toMatchObject({ code: "INVALID_LOAN_STATUS_TRANSITION" });
  });
});
```

- [x] **Step 4: 테스트 실행 (실패 확인)**

```bash
cd apps/api && npx jest __test__/equipment/equipment.loan.service.test.ts --no-coverage
```
Expected: FAIL

- [x] **Step 5: Service에 Loan 메서드 추가**

`apps/api/src/equipment/equipment.service.ts`에 추가:
```typescript
  async requestLoan(requestedById: number, dto: CreateEquipmentLoanDto) {
    const item = await this.repo.findItemById(dto.equipmentItemId);
    if (!item) throw new AppError(404, "EQUIPMENT_ITEM_NOT_FOUND");
    const loan = await this.repo.createLoan(requestedById, dto);
    const managers = await this.repo.findEquipmentManagers();
    await Promise.all(managers.map((m) =>
      this.notificationRepo.create({
        userId: m.id,
        type: "EQUIPMENT_LOAN_REQUESTED",
        title: "장비 대여 신청",
        body: `${item.name} 대여 신청이 접수됐습니다.`,
      }),
    ));
    return loan;
  }

  async approveLoan(loanId: number, approvedById: number) {
    const loan = await this.repo.findLoanById(loanId);
    if (!loan) throw new AppError(404, "LOAN_NOT_FOUND");
    if (loan.status !== "REQUESTED") throw new AppError(409, "INVALID_LOAN_STATUS_TRANSITION");
    const updated = await this.repo.updateLoan(loanId, { status: "APPROVED", approvedById });
    await this.notificationRepo.create({
      userId: loan.requestedBy.id,
      type: "EQUIPMENT_LOAN_APPROVED",
      title: "장비 대여 승인",
      body: `${loan.equipmentItem.name} 대여 신청이 승인됐습니다. 직접 수령해주세요.`,
    });
    return updated;
  }

  async rejectLoan(loanId: number, approvedById: number) {
    const loan = await this.repo.findLoanById(loanId);
    if (!loan) throw new AppError(404, "LOAN_NOT_FOUND");
    if (loan.status !== "REQUESTED") throw new AppError(409, "INVALID_LOAN_STATUS_TRANSITION");
    const updated = await this.repo.updateLoan(loanId, { status: "REJECTED", approvedById });
    await this.notificationRepo.create({
      userId: loan.requestedBy.id,
      type: "EQUIPMENT_LOAN_REJECTED",
      title: "장비 대여 거절",
      body: `${loan.equipmentItem.name} 대여 신청이 거절됐습니다.`,
    });
    return updated;
  }

  async issueLoan(loanId: number, equipmentUnitId?: number) {
    const loan = await this.repo.findLoanById(loanId);
    if (!loan) throw new AppError(404, "LOAN_NOT_FOUND");
    if (loan.status !== "APPROVED") throw new AppError(409, "INVALID_LOAN_STATUS_TRANSITION");
    return this.repo.updateLoan(loanId, {
      status: "ISSUED",
      issuedAt: new Date(),
      ...(equipmentUnitId !== undefined && { equipmentUnitId }),
    });
  }

  async returnLoan(loanId: number) {
    const loan = await this.repo.findLoanById(loanId);
    if (!loan) throw new AppError(404, "LOAN_NOT_FOUND");
    if (loan.status !== "ISSUED") throw new AppError(409, "INVALID_LOAN_STATUS_TRANSITION");
    return this.repo.updateLoan(loanId, { status: "RETURNED", returnedAt: new Date() });
  }

  listLoans(status?: EquipmentLoanStatus) {
    return this.repo.findAllLoans(status);
  }

  listMyLoans(userId: number) {
    return this.repo.findMyLoans(userId);
  }
```

- [x] **Step 6: 테스트 통과 확인**

```bash
cd apps/api && npx jest __test__/equipment/equipment.loan.service.test.ts --no-coverage
```
Expected: PASS

- [x] **Step 7: Controller에 Loan 핸들러 추가**

`apps/api/src/equipment/equipment.controller.ts`에 추가:
```typescript
  listLoans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canRead(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      const status = req.query["status"] as any;
      res.status(200).json(await this.service.listLoans(status));
    } catch (err) { next(err); }
  };

  listMyLoans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.listMyLoans(req.user!.id));
    } catch (err) { next(err); }
  };

  requestLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.requestLoan(req.user!.id, req.body));
    } catch (err) { next(err); }
  };

  approveLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.approveLoan(Number(req.params["loanId"]), req.user!.id));
    } catch (err) { next(err); }
  };

  rejectLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.rejectLoan(Number(req.params["loanId"]), req.user!.id));
    } catch (err) { next(err); }
  };

  issueLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const { equipmentUnitId } = req.body as { equipmentUnitId?: number };
      res.status(200).json(await this.service.issueLoan(Number(req.params["loanId"]), equipmentUnitId));
    } catch (err) { next(err); }
  };

  returnLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.returnLoan(Number(req.params["loanId"])));
    } catch (err) { next(err); }
  };
```

- [x] **Step 8: Routes에 Loan 경로 추가**

`apps/api/src/equipment/equipment.routes.ts`의 기존 라우트 위에 추가:
```typescript
// Loan routes (정적 경로 먼저)
router.get("/loans", auth, controller.listLoans);
router.get("/loans/my", auth, controller.listMyLoans);
router.post("/loans", auth, controller.requestLoan);
router.post("/loans/:loanId/approve", auth, controller.approveLoan);
router.post("/loans/:loanId/reject", auth, controller.rejectLoan);
router.post("/loans/:loanId/issue", auth, controller.issueLoan);
router.post("/loans/:loanId/return", auth, controller.returnLoan);
```

- [x] **Step 9: TS 체크 + 커밋**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|ErrorHandler"
git add apps/api/src/equipment/ apps/api/__test__/equipment/equipment.loan.service.test.ts
git commit -m "feat(equipment): EquipmentLoan CRUD API with REQUESTED→APPROVED→ISSUED→RETURNED flow"
```

---

## Task 6: 프론트엔드 타입/서비스 (Partner + Loan)

**Files:**
- Create: `football/src/types/partner.ts`
- Create: `football/src/services/partner.service.ts`
- Delete: `football/src/types/hospital.ts`
- Delete: `football/src/services/hospital.service.ts`
- Modify: `football/src/types/equipment.ts`
- Modify: `football/src/services/equipment.service.ts`

- [x] **Step 1: partner.ts 타입 작성**

`football/src/types/partner.ts`:
```typescript
export type PartnerType = 'MANUFACTURER' | 'HOSPITAL'
export type PartnerContractStatus = 'ACTIVE' | 'EXPIRED' | 'TERMINATED'

export interface Partner {
  id: number
  type: PartnerType
  name: string
  country: string | null
  website: string | null
  address: string | null
  phone: string | null
  createdAt: string
  contracts?: PartnerContract[]
}

export interface PartnerContract {
  id: number
  partnerId: number
  status: PartnerContractStatus
  startDate: string
  endDate: string
  sponsorshipFee: number | null
  discountRate: number | null
  notes: string | null
  createdAt: string
}

export interface CreatePartnerDto {
  type: PartnerType
  name: string
  country?: string
  website?: string
  address?: string
  phone?: string
}

export interface CreatePartnerContractDto {
  startDate: string
  endDate: string
  sponsorshipFee?: number
  discountRate?: number
  notes?: string
}

export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  MANUFACTURER: '제조사',
  HOSPITAL: '협진병원',
}

export const CONTRACT_STATUS_LABEL: Record<PartnerContractStatus, string> = {
  ACTIVE: '유효',
  EXPIRED: '만료',
  TERMINATED: '해지',
}

export const CONTRACT_STATUS_STYLE: Record<PartnerContractStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  EXPIRED: 'bg-gray-100 text-gray-500 border-gray-200',
  TERMINATED: 'bg-red-100 text-red-800 border-red-200',
}
```

- [x] **Step 2: partner.service.ts 작성**

`football/src/services/partner.service.ts`:
```typescript
import { api } from './api'
import type { Partner, PartnerContract, CreatePartnerDto, CreatePartnerContractDto } from '@/types/partner'
import type { PartnerType, PartnerContractStatus } from '@/types/partner'

export const partnerApi = {
  list: (type?: PartnerType) =>
    api.get<Partner[]>(`/partners${type ? `?type=${type}` : ''}`),

  get: (id: number) => api.get<Partner>(`/partners/${id}`),

  create: (dto: CreatePartnerDto) => api.post<Partner>('/partners', dto),

  update: (id: number, dto: Partial<CreatePartnerDto>) =>
    api.patch<Partner>(`/partners/${id}`, dto),

  createContract: (partnerId: number, dto: CreatePartnerContractDto) =>
    api.post<PartnerContract>(`/partners/${partnerId}/contracts`, dto),

  updateContract: (partnerId: number, contractId: number, dto: { status?: PartnerContractStatus; endDate?: string }) =>
    api.patch<PartnerContract>(`/partners/${partnerId}/contracts/${contractId}`, dto),
}
```

- [x] **Step 3: hospital.ts, hospital.service.ts 삭제**

```bash
rm football/src/types/hospital.ts football/src/services/hospital.service.ts
```

- [x] **Step 4: equipment.ts에 EquipmentLoan 타입 추가**

`football/src/types/equipment.ts`에 추가:
```typescript
export type EquipmentLoanStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'RETURNED'

export interface EquipmentLoan {
  id: number
  status: EquipmentLoanStatus
  requestedAt: string
  issuedAt: string | null
  returnedAt: string | null
  notes: string | null
  equipmentItemId: number
  equipmentUnitId: number | null
  requestedBy: { id: number; nickname: string }
  approvedBy: { id: number; nickname: string } | null
  equipmentItem: { id: number; name: string; category: EquipmentCategory }
  equipmentUnit: { id: number } | null
}

export const LOAN_STATUS_LABEL: Record<EquipmentLoanStatus, string> = {
  REQUESTED: '신청 중',
  APPROVED: '승인됨',
  REJECTED: '거절됨',
  ISSUED: '지급됨',
  RETURNED: '반납 완료',
}

export const LOAN_STATUS_STYLE: Record<EquipmentLoanStatus, string> = {
  REQUESTED: 'bg-blue-100 text-blue-800 border-blue-200',
  APPROVED: 'bg-amber-100 text-amber-800 border-amber-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
  ISSUED: 'bg-purple-100 text-purple-800 border-purple-200',
  RETURNED: 'bg-green-100 text-green-800 border-green-200',
}
```

`EquipmentItem` 인터페이스에 `partner` 필드 추가:
```typescript
export interface EquipmentItem {
  // 기존 필드 유지 ...
  partner: { id: number; name: string } | null
}
```

- [x] **Step 5: equipment.service.ts에 loanApi 추가**

`football/src/services/equipment.service.ts`에 추가:
```typescript
import type { EquipmentLoan, EquipmentLoanStatus } from '@/types/equipment'

export const loanApi = {
  list: (status?: EquipmentLoanStatus) =>
    api.get<EquipmentLoan[]>(`/equipment/loans${status ? `?status=${status}` : ''}`),

  my: () => api.get<EquipmentLoan[]>('/equipment/loans/my'),

  request: (dto: { equipmentItemId: number; notes?: string }) =>
    api.post<EquipmentLoan>('/equipment/loans', dto),

  approve: (loanId: number) =>
    api.post<EquipmentLoan>(`/equipment/loans/${loanId}/approve`, {}),

  reject: (loanId: number) =>
    api.post<EquipmentLoan>(`/equipment/loans/${loanId}/reject`, {}),

  issue: (loanId: number, equipmentUnitId?: number) =>
    api.post<EquipmentLoan>(`/equipment/loans/${loanId}/issue`, { equipmentUnitId }),

  return: (loanId: number) =>
    api.post<EquipmentLoan>(`/equipment/loans/${loanId}/return`, {}),
}
```

- [x] **Step 6: InjuriesPage의 hospital 참조 수정**

`football/src/pages/injuries/InjuriesPage.tsx`에서:
```typescript
// 변경 전:
import { hospitalApi } from '@/services/hospital.service'
import type { Hospital } from '@/types/hospital'
// hospitalApi.list() 호출
// hospital.hospitalId

// 변경 후:
import { partnerApi } from '@/services/partner.service'
import type { Partner } from '@/types/partner'
// partnerApi.list('HOSPITAL') 호출
// hospital.partnerId
```

- [x] **Step 7: TS 체크**

```bash
cd football && npx tsc --noEmit
```
Expected: 출력 없음

- [x] **Step 8: 커밋**

```bash
git add football/src/types/ football/src/services/ football/src/pages/injuries/
git rm football/src/types/hospital.ts football/src/services/hospital.service.ts
git commit -m "feat(frontend): Partner/Loan types and services; migrate InjuriesPage hospital refs"
```

---

## Task 7: PartnersPage (`/admin/partners`)

**Files:**
- Create: `football/src/pages/admin/PartnersPage.tsx`
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/App.tsx`

- [x] **Step 1: PartnersPage 작성**

`football/src/pages/admin/PartnersPage.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { partnerApi } from '@/services/partner.service'
import type { Partner, PartnerType, CreatePartnerDto, CreatePartnerContractDto } from '@/types/partner'
import { PARTNER_TYPE_LABEL, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_STYLE } from '@/types/partner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, FileText, ChevronDown, ChevronUp } from 'lucide-react'

// ── CreatePartnerDialog ─────────────────────────────
interface CreatePartnerDialogProps {
  open: boolean
  type: PartnerType
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreatePartnerDialog({ open, type, onOpenChange, onSaved }: CreatePartnerDialogProps) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => { setName(''); setCountry(''); setWebsite(''); setAddress(''); setPhone('') }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('이름을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto: CreatePartnerDto = {
        type,
        name: name.trim(),
        ...(country && { country }),
        ...(website && { website }),
        ...(address && { address }),
        ...(phone && { phone }),
      }
      await partnerApi.create(dto)
      toast.success(`${PARTNER_TYPE_LABEL[type]}이(가) 등록됐습니다.`)
      reset()
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{PARTNER_TYPE_LABEL[type]} 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>이름 *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          {type === 'MANUFACTURER' && (
            <>
              <div><Label>국가</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div>
              <div><Label>웹사이트</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} /></div>
            </>
          )}
          {type === 'HOSPITAL' && (
            <>
              <div><Label>주소</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              <div><Label>전화번호</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── AddContractDialog ─────────────────────────────
function AddContractDialog({ partner, open, onOpenChange, onSaved }: {
  partner: Partner; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void
}) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sponsorshipFee, setSponsorshipFee] = useState('')
  const [discountRate, setDiscountRate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!startDate || !endDate) { toast.error('계약 기간을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto: CreatePartnerContractDto = {
        startDate,
        endDate,
        ...(sponsorshipFee && { sponsorshipFee: Number(sponsorshipFee) }),
        ...(discountRate && { discountRate: Number(discountRate) }),
        ...(notes && { notes }),
      }
      await partnerApi.createContract(partner.id, dto)
      toast.success('계약이 등록됐습니다.')
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('계약 등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{partner.name} — 계약 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>시작일 *</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label>종료일 *</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div><Label>스폰서십 금액 (원)</Label><Input type="number" value={sponsorshipFee} onChange={(e) => setSponsorshipFee(e.target.value)} /></div>
          <div><Label>할인율 (%)</Label><Input type="number" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} /></div>
          <div><Label>비고</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── PartnerRow ─────────────────────────────────────
function PartnerRow({ partner, isAdmin, onContractAdded }: {
  partner: Partner; isAdmin: boolean; onContractAdded: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [addContractOpen, setAddContractOpen] = useState(false)

  const latestContract = partner.contracts?.[0]

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <TableCell className="font-medium">{partner.name}</TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {partner.type === 'MANUFACTURER' ? partner.country : partner.address}
        </TableCell>
        <TableCell>
          {latestContract ? (
            <Badge variant="outline" className={CONTRACT_STATUS_STYLE[latestContract.status]}>
              {CONTRACT_STATUS_LABEL[latestContract.status]}
            </Badge>
          ) : <span className="text-muted-foreground text-xs">계약 없음</span>}
        </TableCell>
        <TableCell className="text-right">
          {expanded ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/30 p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold">계약 이력</p>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setAddContractOpen(true) }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />계약 추가
                </Button>
              )}
            </div>
            {!partner.contracts?.length ? (
              <p className="text-sm text-muted-foreground">등록된 계약이 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left pb-1">기간</th>
                    <th className="text-left pb-1">스폰서십</th>
                    <th className="text-left pb-1">할인율</th>
                    <th className="text-left pb-1">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {partner.contracts?.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-1">{c.startDate.slice(0, 10)} ~ {c.endDate.slice(0, 10)}</td>
                      <td className="py-1">{c.sponsorshipFee != null ? `${c.sponsorshipFee.toLocaleString()}원` : '—'}</td>
                      <td className="py-1">{c.discountRate != null ? `${c.discountRate}%` : '—'}</td>
                      <td className="py-1">
                        <Badge variant="outline" className={CONTRACT_STATUS_STYLE[c.status]}>
                          {CONTRACT_STATUS_LABEL[c.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <AddContractDialog
              partner={partner}
              open={addContractOpen}
              onOpenChange={setAddContractOpen}
              onSaved={onContractAdded}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ── PartnersPage ───────────────────────────────────
export function PartnersPage() {
  const { user } = useCurrentUser()
  const isAdmin = user?.role === 'ADMIN'
  const [tab, setTab] = useState<PartnerType>('HOSPITAL')
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const load = () => {
    setLoading(true)
    partnerApi.list(tab).then(setPartners).catch(() => toast.error('목록을 불러오지 못했습니다.')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">파트너 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">협진병원 및 장비 제조사 계약 관리</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {PARTNER_TYPE_LABEL[tab]} 추가
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as PartnerType)}>
          <TabsList className="mb-4">
            <TabsTrigger value="HOSPITAL">협진병원</TabsTrigger>
            <TabsTrigger value="MANUFACTURER">제조사</TabsTrigger>
          </TabsList>

          {(['HOSPITAL', 'MANUFACTURER'] as PartnerType[]).map((t) => (
            <TabsContent key={t} value={t}>
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>{t === 'MANUFACTURER' ? '국가' : '주소'}</TableHead>
                      <TableHead>최근 계약</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">등록된 {PARTNER_TYPE_LABEL[t]}이 없습니다.</TableCell></TableRow>
                    ) : (
                      partners.map((p) => (
                        <PartnerRow key={p.id} partner={p} isAdmin={isAdmin} onContractAdded={load} />
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <CreatePartnerDialog
        open={createOpen}
        type={tab}
        onOpenChange={setCreateOpen}
        onSaved={load}
      />
    </div>
  )
}
```

- [x] **Step 2: AppShell에 /admin/partners 네비 항목 추가**

`football/src/layouts/AppShell.tsx`의 NAV_ITEMS 배열에서 `/admin/users` 항목 바로 앞에 추가:
```typescript
  {
    to: '/admin/partners',
    label: '파트너 관리',
    icon: Building2,
    section: '관리',
    roles: ['ADMIN', 'FRONT_OFFICE'],
    frontOfficeRoles: ['EQUIPMENT_MANAGER'],
  },
```

`Building2`를 lucide-react import에 추가.

- [x] **Step 3: App.tsx에 라우트 추가**

`football/src/App.tsx`에서:
```typescript
import { PartnersPage } from '@/pages/admin/PartnersPage'
// Routes 안에 추가:
<Route path="/admin/partners" element={<PartnersPage />} />
```

- [x] **Step 4: TS 체크 + 커밋**

```bash
cd football && npx tsc --noEmit
git add football/src/pages/admin/PartnersPage.tsx football/src/layouts/AppShell.tsx football/src/App.tsx
git commit -m "feat(frontend): PartnersPage with HOSPITAL/MANUFACTURER tabs and contract history"
```

---

## Task 8: EquipmentPage 대여 탭 추가

**Files:**
- Modify: `football/src/pages/equipment/EquipmentPage.tsx`

- [x] **Step 1: 대여 탭 추가**

`football/src/pages/equipment/EquipmentPage.tsx` 상단 imports에 추가:
```typescript
import { loanApi } from '@/services/equipment.service'
import type { EquipmentLoan, EquipmentLoanStatus } from '@/types/equipment'
import { LOAN_STATUS_LABEL, LOAN_STATUS_STYLE } from '@/types/equipment'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
```

- [x] **Step 2: LoanRequestDialog 컴포넌트 추가**

EquipmentPage.tsx 내 컴포넌트 영역에 추가:
```typescript
function LoanRequestDialog({ open, onOpenChange, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void
}) {
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [itemId, setItemId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) equipmentApi.listItems().then(setItems).catch(() => null)
  }, [open])

  const handleSave = async () => {
    if (!itemId) { toast.error('장비를 선택해주세요.'); return }
    setSaving(true)
    try {
      await loanApi.request({ equipmentItemId: Number(itemId), ...(notes && { notes }) })
      toast.success('대여 신청이 접수됐습니다.')
      onSaved()
      onOpenChange(false)
    } catch { toast.error('신청에 실패했습니다.') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>장비 대여 신청</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>장비 선택 *</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="장비를 선택하세요" /></SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>비고</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '신청 중…' : '신청'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [x] **Step 3: LoansTab 컴포넌트 추가**

```typescript
function LoansTab({ isKitManager }: { isKitManager: boolean }) {
  const { user } = useCurrentUser()
  const [loans, setLoans] = useState<EquipmentLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)

  const loadLoans = () => {
    setLoading(true)
    const fetch = isKitManager ? loanApi.list() : loanApi.my()
    fetch.then(setLoans).catch(() => toast.error('대여 목록을 불러오지 못했습니다.')).finally(() => setLoading(false))
  }

  useEffect(() => { loadLoans() }, [isKitManager])

  const handleAction = async (action: () => Promise<any>) => {
    try { await action(); loadLoans() }
    catch { toast.error('처리에 실패했습니다.') }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">
          {isKitManager ? '전체 대여 신청 목록' : '내 대여 신청'}
        </p>
        {!isKitManager && (
          <Button size="sm" onClick={() => setRequestOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />대여 신청
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : loans.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">대여 내역이 없습니다.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>장비</TableHead>
              {isKitManager && <TableHead>신청자</TableHead>}
              <TableHead>신청일</TableHead>
              <TableHead>상태</TableHead>
              {isKitManager && <TableHead>액션</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell className="font-medium">{loan.equipmentItem.name}</TableCell>
                {isKitManager && <TableCell className="text-sm">{loan.requestedBy.nickname}</TableCell>}
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(loan.requestedAt).toLocaleDateString('ko-KR')}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={LOAN_STATUS_STYLE[loan.status]}>
                    {LOAN_STATUS_LABEL[loan.status]}
                  </Badge>
                </TableCell>
                {isKitManager && (
                  <TableCell>
                    <div className="flex gap-1.5">
                      {loan.status === 'REQUESTED' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleAction(() => loanApi.approve(loan.id))}>승인</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleAction(() => loanApi.reject(loan.id))}>거절</Button>
                        </>
                      )}
                      {loan.status === 'APPROVED' && (
                        <Button size="sm" onClick={() => handleAction(() => loanApi.issue(loan.id))}>지급</Button>
                      )}
                      {loan.status === 'ISSUED' && (
                        <Button size="sm" variant="outline" onClick={() => handleAction(() => loanApi.return(loan.id))}>반납 확인</Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <LoanRequestDialog open={requestOpen} onOpenChange={setRequestOpen} onSaved={loadLoans} />
    </div>
  )
}
```

- [x] **Step 4: EquipmentPage 메인에 Tabs 추가**

기존 EquipmentPage의 최상위 return에서 장비 목록 전체를 `<TabsContent value="items">`로 감싸고, 대여 탭을 추가:

```typescript
// EquipmentPage 내 isKitManager 변수 추가:
const isKitManager = user?.role === 'ADMIN' ||
  (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'EQUIPMENT_MANAGER')

// return 최상위를 Tabs로 감싸기:
return (
  <div className="flex flex-col h-full">
    <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
      <h1 className="text-lg font-semibold tracking-tight">장비 관리</h1>
    </div>
    <div className="flex-1 overflow-auto p-6">
      <Tabs defaultValue="items">
        <TabsList className="mb-4">
          <TabsTrigger value="items">장비 목록</TabsTrigger>
          <TabsTrigger value="loans">대여 신청</TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          {/* 기존 장비 목록 UI 전체 */}
        </TabsContent>
        <TabsContent value="loans">
          <LoansTab isKitManager={isKitManager} />
        </TabsContent>
      </Tabs>
    </div>
  </div>
)
```

- [x] **Step 5: TS 체크 + 커밋**

```bash
cd football && npx tsc --noEmit
git add football/src/pages/equipment/EquipmentPage.tsx
git commit -m "feat(equipment-frontend): add loan request/approval tab with full status workflow"
```

---

## 완료 후 전체 TS + 테스트 확인

```bash
# 백엔드
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|ErrorHandler"
npx jest --no-coverage

# 프론트엔드
cd football && npx tsc --noEmit
```

Expected: 모든 테스트 PASS, TS 오류 없음.
