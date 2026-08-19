# Sponsorship Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 스폰서십·파트너 7개 이슈(PA4·PA6·PA8·PB2·PB3·PB4·PB10) 구현 — 조건부 조항, 다중 통화, 노출 이벤트 추적, CRM 접촉 이력, 파트너 계층 분류.

**Architecture:** 하나의 schema migration으로 신규 모델 3개(SponsorshipClause, SponsorshipExposureEvent, PartnerContactLog) + 기존 모델 필드 확장. 각 신규 모델은 독립 repo/service/controller 파일로 분리. PA6 환율 조회는 `lib/exchangeRate.ts` 단일 함수로 격리. PB4 팔로업 알림은 기존 cron 패턴(node-cron) 추가.

**Tech Stack:** TypeScript, Express, Prisma (PostgreSQL), node-cron, Jest (mock repo 패턴), native `fetch` (Node 18+)

---

## File Map

### Schema (공유)
- Modify: `apps/api/prisma/schema.prisma`

### PB10 — money.ts 정책 주석
- Modify: `apps/api/src/lib/money.ts`

### PB3 — Partner Tier
- Modify: `apps/api/src/partner/dto/partner.dto.ts`
- Modify: `apps/api/src/partner/partner.repo.ts`
- Modify: `apps/api/src/partner/partner.service.ts`
- Modify: `apps/api/src/partner/partner.controller.ts`

### PB4 — Partner Contact Log
- Create: `apps/api/src/partner/contact-log/dto/contact-log.dto.ts`
- Create: `apps/api/src/partner/contact-log/contact-log.repo.ts`
- Create: `apps/api/src/partner/contact-log/contact-log.service.ts`
- Create: `apps/api/src/partner/contact-log/contact-log.service.test.ts`
- Create: `apps/api/src/partner/contact-log/contact-log.controller.ts`
- Modify: `apps/api/src/partner/partner.routes.ts`

### PB4 Cron — 팔로업 알림
- Create: `apps/api/src/jobs/contactFollowUpNotifier.ts`
- Modify: `apps/api/src/notification/notification.service.ts`
- Modify: `apps/api/src/apiRouter.ts`

### PA4 — Sponsorship Clause
- Create: `apps/api/src/sponsorship/clause/dto/clause.dto.ts`
- Create: `apps/api/src/sponsorship/clause/clause.repo.ts`
- Create: `apps/api/src/sponsorship/clause/clause.service.ts`
- Create: `apps/api/src/sponsorship/clause/clause.service.test.ts`
- Create: `apps/api/src/sponsorship/clause/clause.controller.ts`
- Modify: `apps/api/src/sponsorship/dto/sponsorship.dto.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.repo.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.service.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.controller.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.routes.ts`

### PA6 — 다중 통화 환율
- Create: `apps/api/src/lib/exchangeRate.ts`
- Modify: `apps/api/src/sponsorship/dto/sponsorship.dto.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.repo.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.service.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.controller.ts`

### PA8+PB2 — Exposure Event Tracking
- Create: `apps/api/src/sponsorship/exposure/dto/exposure.dto.ts`
- Create: `apps/api/src/sponsorship/exposure/exposure.repo.ts`
- Create: `apps/api/src/sponsorship/exposure/exposure.service.ts`
- Create: `apps/api/src/sponsorship/exposure/exposure.service.test.ts`
- Create: `apps/api/src/sponsorship/exposure/exposure.controller.ts`
- Modify: `apps/api/src/sponsorship/dto/sponsorship.dto.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.repo.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.routes.ts`

---

## Task 1: Schema Changes + DB Push

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: 새 enum 4개 추가**

`schema.prisma` 끝 부분(기존 enum 블록 근처)에 추가:

```prisma
enum PartnerTier {
  TITLE
  GOLD
  SILVER
  BRONZE
}

enum ClauseType {
  DISCOUNT
  REFUND
}

enum ClauseStatus {
  PENDING
  APPLIED
  WAIVED
}

enum ContactChannel {
  CALL
  EMAIL
  MEETING
  OTHER
}

enum ExposureChannel {
  TV
  SNS
  STADIUM
  PRINT
  DIGITAL
  OTHER
}
```

- [x] **Step 2: `Partner` 모델에 tier 필드 추가** (line ~1134, `createdAt` 아래)

```prisma
  createdAt  DateTime    @default(now())
  tier       PartnerTier?
  tierReason String?
```

그리고 relations 블록에 `contactLogs PartnerContactLog[]` 추가:

```prisma
  preventiveSchedules  PreventiveSchedule[]
  contactLogs          PartnerContactLog[]
```

- [x] **Step 3: `Sponsorship` 모델 필드 추가** (line ~2839, `fanReach` 아래)

```prisma
  fanReach      Int?
  currency               CurrencyCode @default(KRW)
  targetExposureCount    Int?
  targetFanReach         Int?
  targetMediaValue       Decimal?     @db.Decimal(15, 2)
```

그리고 relations 블록(`payments` 아래)에 추가:

```prisma
  payments         SponsorshipPayment[]
  clauses          SponsorshipClause[]
  exposureEvents   SponsorshipExposureEvent[]
  deletedAt        DateTime?
```

- [x] **Step 4: `SponsorshipPayment` 모델 필드 추가** (line ~2878, `updatedAt` 아래)

```prisma
  updatedAt     DateTime                 @updatedAt
  adjustedAmount   Decimal?  @db.Decimal(14, 2)
  adjustmentReason String?
  appliedClauseId  Int?

  sponsorship  Sponsorship    @relation(fields: [sponsorshipId], references: [id], onDelete: Cascade)
  appliedClause SponsorshipClause? @relation(fields: [appliedClauseId], references: [id])
```

- [x] **Step 5: `User` 모델에 back-relation 추가** (line ~834, 기존 relation 블록 끝에)

```prisma
  sponsorshipExposureEvents SponsorshipExposureEvent[] @relation("ExposureEventCreator")
  partnerContactLogs        PartnerContactLog[]         @relation("ContactLogActor")
```

- [x] **Step 6: 새 모델 3개를 schema.prisma 끝에 추가**

```prisma
model SponsorshipClause {
  id            Int          @id @default(autoincrement())
  sponsorshipId Int
  type          ClauseType
  condition     String       @db.Text
  rate          Decimal?     @db.Decimal(5, 4)
  fixedAmount   Decimal?     @db.Decimal(14, 2)
  status        ClauseStatus @default(PENDING)
  createdAt     DateTime     @default(now())

  sponsorship    Sponsorship          @relation(fields: [sponsorshipId], references: [id])
  appliedPayments SponsorshipPayment[]
}

model SponsorshipExposureEvent {
  id            Int             @id @default(autoincrement())
  sponsorshipId Int
  channel       ExposureChannel
  occurredAt    DateTime
  exposureCount Int?
  fanReach      Int?
  mediaValue    Decimal?        @db.Decimal(15, 2)
  notes         String?         @db.Text
  createdById   Int
  createdAt     DateTime        @default(now())

  sponsorship Sponsorship @relation(fields: [sponsorshipId], references: [id])
  createdBy   User        @relation("ExposureEventCreator", fields: [createdById], references: [id])
}

model PartnerContactLog {
  id             Int            @id @default(autoincrement())
  partnerId      Int
  channel        ContactChannel
  contactedAt    DateTime
  actorId        Int
  summary        String         @db.Text
  nextActionDate DateTime?
  nextActionNote String?        @db.Text
  createdAt      DateTime       @default(now())

  partner Partner @relation(fields: [partnerId], references: [id])
  actor   User    @relation("ContactLogActor", fields: [actorId], references: [id])
}
```

- [x] **Step 7: DB push**

```bash
cd apps/api && npx prisma db push --accept-data-loss
```

Expected: `Your database is now in sync with your Prisma schema.`

- [x] **Step 8: 생성된 클라이언트 확인**

```bash
grep -n "PartnerTier\|SponsorshipClause\|SponsorshipExposureEvent\|PartnerContactLog\|ClauseType\|ExposureChannel\|ContactChannel" apps/api/src/generated/client/index.d.ts | head -15
```

Expected: 각 타입별로 라인이 나타남.

- [x] **Step 9: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add SponsorshipClause, SponsorshipExposureEvent, PartnerContactLog; extend Partner/Sponsorship/SponsorshipPayment (PA4/PA6/PA8/PB2/PB3/PB4)"
```

---

## Task 2: PB10 — money.ts 정책 주석

**Files:**
- Modify: `apps/api/src/lib/money.ts`

- [x] **Step 1: 주석 추가**

`apps/api/src/lib/money.ts`를 아래와 같이 수정:

```ts
// Last installment absorbs any rounding remainder from integer division.
// e.g. divideEvenly(10000, 3) → { baseAmount: 3333.33, lastAmount: 3333.34 }
// This is intentional: concentrating the ±1 cent in the final payment is
// standard receivables practice and simplifies period reconciliation.
export const divideEvenly = (total: number, count: number): { baseAmount: number; lastAmount: number } => {
  const baseAmount = Math.floor((total * 100) / count) / 100;
  const lastAmount = parseFloat((total - baseAmount * (count - 1)).toFixed(2));
  return { baseAmount, lastAmount };
};
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/lib/money.ts
git commit -m "docs(money): document last-installment remainder policy (PB10)"
```

---

## Task 3: PB3 — Partner Tier

**Files:**
- Modify: `apps/api/src/partner/dto/partner.dto.ts`
- Modify: `apps/api/src/partner/partner.repo.ts`
- Modify: `apps/api/src/partner/partner.service.ts`

- [x] **Step 1: DTO 업데이트**

`apps/api/src/partner/dto/partner.dto.ts` — `UpdatePartnerDto`에 tier 필드 추가:

```ts
import { PartnerType, PartnerContractStatus, PartnerTier } from "../../generated/enums";

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
  tier?: PartnerTier | null;
  tierReason?: string | null;
}

export interface CreatePartnerContractDto {
  startDate: string;
  endDate: string;
  sponsorshipFee?: number;
  discountRate?: number;
  notes?: string;
  responseHours?: number;
  resolutionDays?: number;
  penaltyPerDay?: number;
}

export interface UpdatePartnerContractDto {
  status?: PartnerContractStatus;
  endDate?: string;
  sponsorshipFee?: number;
  discountRate?: number;
  notes?: string;
  responseHours?: number;
  resolutionDays?: number;
  penaltyPerDay?: number;
}
```

- [x] **Step 2: repo — PARTNER_SELECT + update() 업데이트**

`apps/api/src/partner/partner.repo.ts`의 `PARTNER_SELECT` 상수 수정:

```ts
const PARTNER_SELECT = {
  id: true, type: true, name: true, country: true,
  website: true, address: true, phone: true, createdAt: true,
  tier: true, tierReason: true,
} as const;
```

그리고 `update()` 메서드 수정:

```ts
  update(id: number, dto: UpdatePartnerDto) {
    return this.prisma.partner.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.tier !== undefined && { tier: dto.tier }),
        ...(dto.tierReason !== undefined && { tierReason: dto.tierReason }),
      },
      select: PARTNER_SELECT,
    });
  }
```

- [x] **Step 3: service — tier 검증 추가**

`apps/api/src/partner/partner.service.ts`의 `update()` 메서드 수정:

```ts
  async update(id: number, dto: UpdatePartnerDto) {
    await this.getById(id);
    if (dto.name !== undefined && !dto.name.trim()) throw new AppError(400, "PARTNER_NAME_REQUIRED");
    const trimmed = dto.name !== undefined ? dto.name.trim() : undefined;
    if (trimmed && await this.repo.findByName(trimmed, id)) throw new AppError(409, "PARTNER_NAME_DUPLICATE");
    if (dto.tier === null && dto.tierReason !== undefined && dto.tierReason !== null) {
      throw new AppError(400, "TIER_REQUIRED_FOR_TIER_REASON");
    }
    return this.repo.update(id, { ...dto, ...(trimmed !== undefined && { name: trimmed }) });
  }
```

- [x] **Step 4: build 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "partner" | head -10
```

Expected: 에러 없음.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/partner/dto/partner.dto.ts apps/api/src/partner/partner.repo.ts apps/api/src/partner/partner.service.ts
git commit -m "feat(partner): add tier classification with TITLE/GOLD/SILVER/BRONZE (PB3)"
```

---

## Task 4: PB4 — Partner Contact Log

**Files:**
- Create: `apps/api/src/partner/contact-log/dto/contact-log.dto.ts`
- Create: `apps/api/src/partner/contact-log/contact-log.repo.ts`
- Create: `apps/api/src/partner/contact-log/contact-log.service.ts`
- Create: `apps/api/src/partner/contact-log/contact-log.service.test.ts`
- Create: `apps/api/src/partner/contact-log/contact-log.controller.ts`
- Modify: `apps/api/src/partner/partner.routes.ts`

- [x] **Step 1: 실패하는 테스트 작성**

`apps/api/src/partner/contact-log/contact-log.service.test.ts` 생성:

```ts
import { ContactLogService } from "./contact-log.service";
import { AppError } from "../../lib/appError";
import type { ContactLogRepository } from "./contact-log.repo";
import type { PartnerRepository } from "../partner.repo";

const makeLog = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  partnerId: 10,
  channel: "CALL",
  contactedAt: new Date("2026-08-17"),
  actorId: 5,
  summary: "계약 갱신 논의",
  nextActionDate: null,
  nextActionNote: null,
  createdAt: new Date(),
  ...overrides,
});

const makeContactLogRepo = (overrides: Partial<ContactLogRepository> = {}): ContactLogRepository => ({
  create: jest.fn().mockResolvedValue(makeLog()),
  findAll: jest.fn().mockResolvedValue([]),
  ...overrides,
} as unknown as ContactLogRepository);

const makePartnerRepo = (overrides: Partial<PartnerRepository> = {}): PartnerRepository => ({
  findById: jest.fn().mockResolvedValue(null),
  findByName: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  createContract: jest.fn(),
  updateContract: jest.fn(),
  findContractById: jest.fn(),
  findExpiringContracts: jest.fn(),
  ...overrides,
} as unknown as PartnerRepository);

const makeService = (logRepo: ContactLogRepository, partnerRepo: PartnerRepository) =>
  new ContactLogService(logRepo, partnerRepo);

describe("ContactLogService.create", () => {
  it("throws 404 when partner not found", async () => {
    const service = makeService(makeContactLogRepo(), makePartnerRepo());
    await expect(
      service.create(99, { channel: "CALL", contactedAt: "2026-08-17", summary: "test" }, 5),
    ).rejects.toThrow(new AppError(404, "PARTNER_NOT_FOUND"));
  });

  it("throws 400 when nextActionDate provided without nextActionNote", async () => {
    const partnerRepo = makePartnerRepo({ findById: jest.fn().mockResolvedValue({ id: 10 }) });
    const service = makeService(makeContactLogRepo(), partnerRepo);
    await expect(
      service.create(10, { channel: "EMAIL", contactedAt: "2026-08-17", summary: "test", nextActionDate: "2026-08-20" }, 5),
    ).rejects.toThrow(new AppError(400, "NEXT_ACTION_NOTE_REQUIRED"));
  });

  it("creates log when valid", async () => {
    const partnerRepo = makePartnerRepo({ findById: jest.fn().mockResolvedValue({ id: 10 }) });
    const logRepo = makeContactLogRepo({ create: jest.fn().mockResolvedValue(makeLog()) });
    const service = makeService(logRepo, partnerRepo);
    await service.create(10, { channel: "CALL", contactedAt: "2026-08-17", summary: "논의" }, 5);
    expect(logRepo.create).toHaveBeenCalledWith(10, expect.objectContaining({ channel: "CALL", actorId: 5 }));
  });
});

describe("ContactLogService.list", () => {
  it("throws 404 when partner not found", async () => {
    const service = makeService(makeContactLogRepo(), makePartnerRepo());
    await expect(service.list(99)).rejects.toThrow(new AppError(404, "PARTNER_NOT_FOUND"));
  });

  it("returns logs when partner exists", async () => {
    const partnerRepo = makePartnerRepo({ findById: jest.fn().mockResolvedValue({ id: 10 }) });
    const logRepo = makeContactLogRepo({ findAll: jest.fn().mockResolvedValue([makeLog()]) });
    const result = await makeService(logRepo, partnerRepo).list(10);
    expect(result).toHaveLength(1);
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npm test -- --testPathPattern=contact-log.service.test --passWithNoTests 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module './contact-log.service'"

- [x] **Step 3: DTO 생성**

`apps/api/src/partner/contact-log/dto/contact-log.dto.ts`:

```ts
import type { ContactChannel } from "../../../generated/enums";

export interface CreateContactLogDto {
  channel: ContactChannel;
  contactedAt: string;
  summary: string;
  nextActionDate?: string;
  nextActionNote?: string;
}
```

- [x] **Step 4: Repository 생성**

`apps/api/src/partner/contact-log/contact-log.repo.ts`:

```ts
import type { PrismaClient } from "../../generated/client";
import type { CreateContactLogDto } from "./dto/contact-log.dto";

const INCLUDE = {
  actor: { select: { id: true, username: true } },
} as const;

export class ContactLogRepository {
  constructor(private prisma: PrismaClient) {}

  create(partnerId: number, data: CreateContactLogDto & { actorId: number }) {
    return this.prisma.partnerContactLog.create({
      data: {
        partnerId,
        channel: data.channel as any,
        contactedAt: new Date(data.contactedAt),
        actorId: data.actorId,
        summary: data.summary,
        ...(data.nextActionDate && { nextActionDate: new Date(data.nextActionDate) }),
        ...(data.nextActionNote && { nextActionNote: data.nextActionNote }),
      },
      include: INCLUDE,
    });
  }

  findAll(partnerId: number) {
    return this.prisma.partnerContactLog.findMany({
      where: { partnerId },
      include: INCLUDE,
      orderBy: { contactedAt: "desc" },
    });
  }

  findDueTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    return this.prisma.partnerContactLog.findMany({
      where: { nextActionDate: { gte: tomorrow, lt: dayAfter } },
      include: { partner: { select: { id: true, name: true } }, actor: { select: { id: true } } },
    });
  }
}
```

- [x] **Step 5: Service 생성**

`apps/api/src/partner/contact-log/contact-log.service.ts`:

```ts
import { AppError } from "../../lib/appError";
import type { ContactLogRepository } from "./contact-log.repo";
import type { PartnerRepository } from "../partner.repo";
import type { CreateContactLogDto } from "./dto/contact-log.dto";

export class ContactLogService {
  constructor(
    private repo: ContactLogRepository,
    private partnerRepo: PartnerRepository,
  ) {}

  async list(partnerId: number) {
    const partner = await this.partnerRepo.findById(partnerId);
    if (!partner) throw new AppError(404, "PARTNER_NOT_FOUND");
    return this.repo.findAll(partnerId);
  }

  async create(partnerId: number, dto: CreateContactLogDto, actorId: number) {
    const partner = await this.partnerRepo.findById(partnerId);
    if (!partner) throw new AppError(404, "PARTNER_NOT_FOUND");
    if (dto.nextActionDate && !dto.nextActionNote) {
      throw new AppError(400, "NEXT_ACTION_NOTE_REQUIRED");
    }
    return this.repo.create(partnerId, { ...dto, actorId });
  }
}
```

- [x] **Step 6: 테스트 통과 확인**

```bash
cd apps/api && npm test -- --testPathPattern=contact-log.service.test 2>&1 | tail -10
```

Expected: PASS, 5 tests.

- [x] **Step 7: Controller 생성**

`apps/api/src/partner/contact-log/contact-log.controller.ts`:

```ts
import { Request, Response, NextFunction } from "express";
import { requireUser } from "../../lib/authMiddleware";
import type { ContactLogService } from "./contact-log.service";
import type { CreateContactLogDto } from "./dto/contact-log.dto";

export class ContactLogController {
  constructor(private service: ContactLogService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(Number(req.params["partnerId"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      res.status(201).json(
        await this.service.create(Number(req.params["partnerId"]), req.body as CreateContactLogDto, user.id),
      );
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 8: partner.routes.ts에 라우트 마운트**

`apps/api/src/partner/partner.routes.ts` — 상단 import에 추가:

```ts
import { ContactLogRepository } from "./contact-log/contact-log.repo";
import { ContactLogService } from "./contact-log/contact-log.service";
import { ContactLogController } from "./contact-log/contact-log.controller";
```

`const repo = ...` 아래에 추가:

```ts
const contactLogRepo = new ContactLogRepository(getPrisma());
const contactLogService = new ContactLogService(contactLogRepo, repo);
const contactLogController = new ContactLogController(contactLogService);
```

`export default router;` 앞에 추가:

```ts
router.get("/:partnerId/contacts", auth, contactLogController.list);
router.post("/:partnerId/contacts", auth, contactLogController.create);
```

- [x] **Step 9: build 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -i "contact" | head -10
```

Expected: 에러 없음.

- [x] **Step 10: Commit**

```bash
git add apps/api/src/partner/contact-log/ apps/api/src/partner/partner.routes.ts
git commit -m "feat(partner): add PartnerContactLog CRM with follow-up fields (PB4)"
```

---

## Task 5: PB4 Cron — 팔로업 D-1 알림

**Files:**
- Create: `apps/api/src/jobs/contactFollowUpNotifier.ts`
- Modify: `apps/api/src/notification/notification.service.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: NotificationService에 메서드 추가**

`apps/api/src/notification/notification.service.ts` 클래스 마지막 메서드 뒤에 추가:

```ts
  async notifyContactFollowUp(partnerName: string, contactLogId: number, actorId: number) {
    const title = "파트너 팔로업 일정";
    const body = `'${partnerName}' 파트너 접촉 팔로업이 내일 예정되어 있습니다.`;
    await this.repo.create({ userId: actorId, type: "PARTNER_CONTACT_FOLLOWUP", title, body, entityId: contactLogId });
    getIO().to("staff-room").emit("notification:partner", {
      type: "PARTNER_CONTACT_FOLLOWUP", title, body, entityId: contactLogId, createdAt: new Date().toISOString(),
    });
  }
```

- [x] **Step 2: 크론 잡 생성**

`apps/api/src/jobs/contactFollowUpNotifier.ts` 생성:

```ts
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationService } from "../notification/notification.service";
import { NotificationRepository } from "../notification/notification.repo";

async function runContactFollowUpNotifier() {
  const prisma = getPrisma();
  const notificationService = new NotificationService(new NotificationRepository(prisma));

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const dueLogs = await prisma.partnerContactLog.findMany({
    where: { nextActionDate: { gte: tomorrow, lt: dayAfter } },
    include: {
      partner: { select: { name: true } },
      actor: { select: { id: true } },
    },
  });

  for (const log of dueLogs) {
    await notificationService
      .notifyContactFollowUp(log.partner.name, log.id, log.actor.id)
      .catch(console.error);
  }

  console.log(`[contactFollowUpNotifier] ${dueLogs.length} follow-up notifications sent`);
}

export function startContactFollowUpNotifierJob() {
  cron.schedule("0 8 * * *", () => {
    runContactFollowUpNotifier().catch(console.error);
  });
  console.log("[contactFollowUpNotifier] scheduled at 08:00 daily");
}
```

- [x] **Step 3: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts` — 기존 job import 아래에 추가:

```ts
import { startContactFollowUpNotifierJob } from "./jobs/contactFollowUpNotifier";
```

기존 `startPreventiveScheduleGenJob();` 아래에 추가:

```ts
startContactFollowUpNotifierJob();
```

- [x] **Step 4: build 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -i "contact\|followup\|notif" | head -10
```

Expected: 에러 없음.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/jobs/contactFollowUpNotifier.ts apps/api/src/notification/notification.service.ts apps/api/src/apiRouter.ts
git commit -m "feat(jobs): add D-1 partner contact follow-up notification cron (PB4)"
```

---

## Task 6: PA4 — Sponsorship Clause

**Files:**
- Create: `apps/api/src/sponsorship/clause/dto/clause.dto.ts`
- Create: `apps/api/src/sponsorship/clause/clause.repo.ts`
- Create: `apps/api/src/sponsorship/clause/clause.service.ts`
- Create: `apps/api/src/sponsorship/clause/clause.service.test.ts`
- Create: `apps/api/src/sponsorship/clause/clause.controller.ts`
- Modify: `apps/api/src/sponsorship/dto/sponsorship.dto.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.repo.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.service.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.controller.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.routes.ts`

- [x] **Step 1: 실패하는 테스트 작성**

`apps/api/src/sponsorship/clause/clause.service.test.ts` 생성:

```ts
import { ClauseService } from "./clause.service";
import { AppError } from "../../lib/appError";
import type { ClauseRepository } from "./clause.repo";

const makeClause = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  sponsorshipId: 10,
  type: "DISCOUNT",
  condition: "팬 도달 10만 초과 시",
  rate: 0.05,
  fixedAmount: null,
  status: "PENDING",
  createdAt: new Date(),
  ...overrides,
});

const makeRepo = (overrides: Partial<ClauseRepository> = {}): ClauseRepository => ({
  create: jest.fn().mockResolvedValue(makeClause()),
  findAll: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(null),
  updateStatus: jest.fn(),
  ...overrides,
} as unknown as ClauseRepository);

const makeService = (repo: ClauseRepository) => new ClauseService(repo);

describe("ClauseService.applyClause", () => {
  it("throws 404 when clause not found", async () => {
    await expect(makeService(makeRepo()).applyClause(99)).rejects.toThrow(new AppError(404, "CLAUSE_NOT_FOUND"));
  });

  it("throws 400 when already APPLIED", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeClause({ status: "APPLIED" })) });
    await expect(makeService(repo).applyClause(1)).rejects.toThrow(new AppError(400, "CLAUSE_ALREADY_APPLIED"));
  });

  it("throws 400 when WAIVED", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeClause({ status: "WAIVED" })) });
    await expect(makeService(repo).applyClause(1)).rejects.toThrow(new AppError(400, "CLAUSE_ALREADY_APPLIED"));
  });

  it("calls updateStatus to APPLIED when valid", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeClause({ status: "PENDING" })),
      updateStatus: jest.fn().mockResolvedValue(makeClause({ status: "APPLIED" })),
    });
    await makeService(repo).applyClause(1);
    expect(repo.updateStatus).toHaveBeenCalledWith(1, "APPLIED");
  });
});

describe("ClauseService.waiveClause", () => {
  it("throws 404 when clause not found", async () => {
    await expect(makeService(makeRepo()).waiveClause(99)).rejects.toThrow(new AppError(404, "CLAUSE_NOT_FOUND"));
  });

  it("throws 400 when not PENDING", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeClause({ status: "APPLIED" })) });
    await expect(makeService(repo).waiveClause(1)).rejects.toThrow(new AppError(400, "CLAUSE_NOT_PENDING"));
  });

  it("calls updateStatus to WAIVED when valid", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeClause({ status: "PENDING" })),
      updateStatus: jest.fn().mockResolvedValue(makeClause({ status: "WAIVED" })),
    });
    await makeService(repo).waiveClause(1);
    expect(repo.updateStatus).toHaveBeenCalledWith(1, "WAIVED");
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npm test -- --testPathPattern=clause.service.test --passWithNoTests 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module './clause.service'"

- [x] **Step 3: DTO 생성**

`apps/api/src/sponsorship/clause/dto/clause.dto.ts`:

```ts
import type { ClauseType } from "../../../generated/enums";

export interface CreateClauseDto {
  type: ClauseType;
  condition: string;
  rate?: number;
  fixedAmount?: number;
}
```

- [x] **Step 4: Repository 생성**

`apps/api/src/sponsorship/clause/clause.repo.ts`:

```ts
import type { PrismaClient } from "../../generated/client";
import type { ClauseStatus } from "../../generated/enums";
import type { CreateClauseDto } from "./dto/clause.dto";

export class ClauseRepository {
  constructor(private prisma: PrismaClient) {}

  create(sponsorshipId: number, dto: CreateClauseDto) {
    return this.prisma.sponsorshipClause.create({
      data: {
        sponsorshipId,
        type: dto.type as any,
        condition: dto.condition,
        ...(dto.rate !== undefined && { rate: dto.rate }),
        ...(dto.fixedAmount !== undefined && { fixedAmount: dto.fixedAmount }),
      },
    });
  }

  findAll(sponsorshipId: number) {
    return this.prisma.sponsorshipClause.findMany({
      where: { sponsorshipId },
      orderBy: { createdAt: "asc" },
    });
  }

  findById(id: number) {
    return this.prisma.sponsorshipClause.findUnique({ where: { id } });
  }

  updateStatus(id: number, status: ClauseStatus) {
    return this.prisma.sponsorshipClause.update({
      where: { id },
      data: { status: status as any },
    });
  }
}
```

- [x] **Step 5: Service 생성**

`apps/api/src/sponsorship/clause/clause.service.ts`:

```ts
import { AppError } from "../../lib/appError";
import type { ClauseRepository } from "./clause.repo";
import type { CreateClauseDto } from "./dto/clause.dto";

export class ClauseService {
  constructor(private repo: ClauseRepository) {}

  list(sponsorshipId: number) {
    return this.repo.findAll(sponsorshipId);
  }

  create(sponsorshipId: number, dto: CreateClauseDto) {
    if (!dto.rate && !dto.fixedAmount) throw new AppError(400, "CLAUSE_AMOUNT_REQUIRED");
    return this.repo.create(sponsorshipId, dto);
  }

  async applyClause(id: number) {
    const clause = await this.repo.findById(id);
    if (!clause) throw new AppError(404, "CLAUSE_NOT_FOUND");
    if (clause.status !== "PENDING") throw new AppError(400, "CLAUSE_ALREADY_APPLIED");
    return this.repo.updateStatus(id, "APPLIED" as any);
  }

  async waiveClause(id: number) {
    const clause = await this.repo.findById(id);
    if (!clause) throw new AppError(404, "CLAUSE_NOT_FOUND");
    if (clause.status !== "PENDING") throw new AppError(400, "CLAUSE_NOT_PENDING");
    return this.repo.updateStatus(id, "WAIVED" as any);
  }
}
```

- [x] **Step 6: 테스트 통과 확인**

```bash
cd apps/api && npm test -- --testPathPattern=clause.service.test 2>&1 | tail -10
```

Expected: PASS, 6 tests.

- [x] **Step 7: Controller 생성**

`apps/api/src/sponsorship/clause/clause.controller.ts`:

```ts
import { Request, Response, NextFunction } from "express";
import type { ClauseService } from "./clause.service";
import type { CreateClauseDto } from "./dto/clause.dto";

export class ClauseController {
  constructor(private service: ClauseService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.create(Number(req.params["id"]), req.body as CreateClauseDto));
    } catch (err) { next(err); }
  };

  apply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.applyClause(Number(req.params["clauseId"])));
    } catch (err) { next(err); }
  };

  waive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.waiveClause(Number(req.params["clauseId"])));
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 8: `sponsorship.dto.ts`에 MarkPaidDto 추가**

`apps/api/src/sponsorship/dto/sponsorship.dto.ts` 끝에 추가:

```ts
export interface MarkPaidDto {
  adjustedAmount?: number;
  adjustmentReason?: string;
  appliedClauseId?: number;
}
```

- [x] **Step 9: `sponsorship.repo.ts`의 `updatePayment()` 수정**

`apps/api/src/sponsorship/sponsorship.repo.ts`의 `updatePayment` 메서드를 다음으로 교체:

```ts
  updatePayment(id: number, data: { status: "PAID"; paidAt: Date; adjustedAmount?: number; adjustmentReason?: string; appliedClauseId?: number }) {
    return this.prisma.sponsorshipPayment.update({
      where: { id },
      data: {
        status: data.status,
        paidAt: data.paidAt,
        ...(data.adjustedAmount !== undefined && { adjustedAmount: data.adjustedAmount }),
        ...(data.adjustmentReason !== undefined && { adjustmentReason: data.adjustmentReason }),
        ...(data.appliedClauseId !== undefined && { appliedClauseId: data.appliedClauseId }),
      },
    });
  }
```

- [x] **Step 10: `sponsorship.service.ts`의 `markPaid()` 수정**

`markPaid` 시그니처와 본문을 다음으로 교체:

```ts
  async markPaid(sponsorshipId: number, paymentId: number, userId: number, dto: MarkPaidDto = {}) {
    const sponsorship = await this.get(sponsorshipId);
    const payment = await this.repo.findPaymentById(paymentId);
    if (!payment || payment.sponsorshipId !== sponsorshipId) {
      throw new AppError(404, "SPONSORSHIP_PAYMENT_NOT_FOUND");
    }
    if (payment.status === "PAID") throw new AppError(409, "ALREADY_PAID");
    const payAmount = dto.adjustedAmount ?? Number(payment.amount);
    if (payAmount <= 0) throw new AppError(400, "INVALID_PAYMENT_AMOUNT");
    const updated = await this.repo.updatePayment(paymentId, {
      status: "PAID",
      paidAt: new Date(),
      ...(dto.adjustedAmount !== undefined && { adjustedAmount: dto.adjustedAmount }),
      ...(dto.adjustmentReason !== undefined && { adjustmentReason: dto.adjustmentReason }),
      ...(dto.appliedClauseId !== undefined && { appliedClauseId: dto.appliedClauseId }),
    });
    await this.ledgerService.createAutoEntry({
      type: "INCOME",
      category: "SPONSORSHIP",
      amount: payAmount,
      currency: "KRW",
      exchangeRate: 1,
      amountKrw: payAmount,
      description: formatLedgerDescription("sponsorship", "payment_received", { sponsorName: sponsorship.sponsorName, paymentId }),
      relatedModule: "sponsorship",
      relatedId: sponsorshipId,
    }, userId);
    return updated;
  }
```

`markPaid` 위쪽 import에 `MarkPaidDto` 추가:

```ts
import type { CreateSponsorshipDto, UpdateSponsorshipDto, SponsorshipListQuery, MarkPaidDto } from "./dto/sponsorship.dto";
```

- [x] **Step 11: `sponsorship.controller.ts`의 `markPaid` 수정**

기존 `markPaid` 핸들러를 다음으로 교체:

```ts
  markPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(
        await this.service.markPaid(
          Number(req.params["id"]),
          Number(req.params["paymentId"]),
          userId,
          req.body,
        ),
      );
    } catch (err) { next(err); }
  };
```

- [x] **Step 12: `sponsorship.routes.ts`에 clause 라우트 마운트**

상단 import에 추가:

```ts
import { ClauseRepository } from "./clause/clause.repo";
import { ClauseService } from "./clause/clause.service";
import { ClauseController } from "./clause/clause.controller";
```

`const service = ...` 아래에 추가:

```ts
const clauseRepo = new ClauseRepository(getPrisma());
const clauseService = new ClauseService(clauseRepo);
const clauseController = new ClauseController(clauseService);
```

`export default router;` 앞에 추가:

```ts
router.get("/:id/clauses",                   auth, checkReadFinance, clauseController.list);
router.post("/:id/clauses",                  auth, checkWriteFinance, clauseController.create);
router.post("/:id/clauses/:clauseId/apply",  auth, checkWriteFinance, clauseController.apply);
router.post("/:id/clauses/:clauseId/waive",  auth, checkWriteFinance, clauseController.waive);
```

- [x] **Step 13: build 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -i "clause\|sponsorship" | head -10
```

Expected: 에러 없음.

- [x] **Step 14: Commit**

```bash
git add apps/api/src/sponsorship/clause/ apps/api/src/sponsorship/dto/sponsorship.dto.ts apps/api/src/sponsorship/sponsorship.repo.ts apps/api/src/sponsorship/sponsorship.service.ts apps/api/src/sponsorship/sponsorship.controller.ts apps/api/src/sponsorship/sponsorship.routes.ts
git commit -m "feat(sponsorship): add SponsorshipClause CRUD with apply/waive; markPaid accepts adjustment fields (PA4)"
```

---

## Task 7: PA6 — 다중 통화 환율

**Files:**
- Create: `apps/api/src/lib/exchangeRate.ts`
- Modify: `apps/api/src/sponsorship/dto/sponsorship.dto.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.repo.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.service.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.controller.ts`

- [x] **Step 1: exchangeRate.ts 생성**

`apps/api/src/lib/exchangeRate.ts`:

```ts
type ForeignCurrency = "USD" | "EUR" | "GBP";

interface ErApiResponse {
  result: string;
  rates: Record<string, number>;
}

// Fetches KRW exchange rate for a foreign currency from open.er-api.com (free, no key).
// Returns null on network failure or unexpected response — caller must handle fallback.
export async function fetchKrwRate(from: ForeignCurrency): Promise<number | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!res.ok) return null;
    const data = (await res.json()) as ErApiResponse;
    if (data.result !== "success") return null;
    return data.rates["KRW"] ?? null;
  } catch {
    return null;
  }
}
```

- [x] **Step 2: `CreateSponsorshipDto`에 currency 추가**

`apps/api/src/sponsorship/dto/sponsorship.dto.ts`의 `CreateSponsorshipDto`에 추가:

```ts
import type { SponsorType, PaymentSchedule, CurrencyCode } from "../../generated/enums";

export interface CreateSponsorshipDto {
  sponsorName: string;
  type: SponsorType;
  totalFee: number;
  contractStart: string;
  contractEnd: string;
  paymentSchedule: PaymentSchedule;
  currency?: CurrencyCode;
  attachedContractId?: number;
  // 국내 계좌
  domesticBankName?: string;
  domesticAccountNumber?: string;
  domesticAccountHolder?: string;
  // 영국 계좌
  ukBankName?: string;
  ukSortCode?: string;
  ukAccountNumber?: string;
  ukSwiftBic?: string;
  // 국내/해외 구분
  isOverseas?: boolean;
  // 국내 전용
  businessRegNumber?: string;
  postalCode?: string;
  address?: string;
  addressDetail?: string;
  // 해외 전용
  taxId?: string;
  overseasAddress?: string;
}
```

그리고 `MarkPaidDto`에 `exchangeRate` 추가:

```ts
export interface MarkPaidDto {
  adjustedAmount?: number;
  adjustmentReason?: string;
  appliedClauseId?: number;
  exchangeRate?: number;
}
```

- [x] **Step 3: `sponsorship.repo.ts`의 `create()` 수정**

`sponsorship.repo.ts`의 `create()` 메서드 — `paymentSchedule` 아래에 `currency` 추가:

```ts
  create(data: CreateSponsorshipDto & { createdById: number }) {
    return this.prisma.sponsorship.create({
      data: {
        sponsorName: data.sponsorName,
        type: data.type,
        totalFee: data.totalFee,
        contractStart: new Date(data.contractStart),
        contractEnd: new Date(data.contractEnd),
        paymentSchedule: data.paymentSchedule,
        currency: (data.currency ?? "KRW") as any,
        createdById: data.createdById,
        ...(data.attachedContractId && { attachedContractId: data.attachedContractId }),
        ...(data.domesticBankName && { domesticBankName: data.domesticBankName }),
        ...(data.domesticAccountNumber && { domesticAccountNumber: data.domesticAccountNumber }),
        ...(data.domesticAccountHolder && { domesticAccountHolder: data.domesticAccountHolder }),
        ...(data.ukBankName && { ukBankName: data.ukBankName }),
        ...(data.ukSortCode && { ukSortCode: data.ukSortCode }),
        ...(data.ukAccountNumber && { ukAccountNumber: data.ukAccountNumber }),
        ...(data.ukSwiftBic && { ukSwiftBic: data.ukSwiftBic }),
        isOverseas: data.isOverseas ?? false,
        ...(data.businessRegNumber && { businessRegNumber: data.businessRegNumber }),
        ...(data.postalCode && { postalCode: data.postalCode }),
        ...(data.address && { address: data.address }),
        ...(data.addressDetail && { addressDetail: data.addressDetail }),
        ...(data.taxId && { taxId: data.taxId }),
        ...(data.overseasAddress && { overseasAddress: data.overseasAddress }),
      },
    });
  }
```

- [x] **Step 4: `sponsorship.service.ts`의 `markPaid()` 수정**

파일 상단 import에 추가:

```ts
import { fetchKrwRate } from "../lib/exchangeRate";
```

`markPaid()` 메서드에서 ledgerService.createAutoEntry 호출 부분을 다음으로 교체:

```ts
    const sponsorshipCurrency = (sponsorship as any).currency ?? "KRW";
    let rate = 1;
    let amountKrw = payAmount;

    if (sponsorshipCurrency !== "KRW") {
      if (dto.exchangeRate !== undefined) {
        rate = dto.exchangeRate;
      } else {
        const fetched = await fetchKrwRate(sponsorshipCurrency as "USD" | "EUR" | "GBP");
        if (fetched === null) throw new AppError(502, "EXCHANGE_RATE_UNAVAILABLE");
        rate = fetched;
      }
      amountKrw = parseFloat((payAmount * rate).toFixed(2));
    }

    await this.ledgerService.createAutoEntry({
      type: "INCOME",
      category: "SPONSORSHIP",
      amount: payAmount,
      currency: sponsorshipCurrency,
      exchangeRate: rate,
      amountKrw,
      description: formatLedgerDescription("sponsorship", "payment_received", { sponsorName: sponsorship.sponsorName, paymentId }),
      relatedModule: "sponsorship",
      relatedId: sponsorshipId,
    }, userId);
```

> **참고:** `dto.exchangeRate`가 없고 통화가 KRW가 아닐 때 API 조회 → 실패 시 `502 EXCHANGE_RATE_UNAVAILABLE`. 담당자가 `exchangeRate` 직접 입력해서 재호출하면 됨.

- [x] **Step 5: build 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -i "exchange\|currency\|sponsorship" | head -10
```

Expected: 에러 없음.

- [x] **Step 6: Commit**

```bash
git add apps/api/src/lib/exchangeRate.ts apps/api/src/sponsorship/dto/sponsorship.dto.ts apps/api/src/sponsorship/sponsorship.repo.ts apps/api/src/sponsorship/sponsorship.service.ts apps/api/src/sponsorship/sponsorship.controller.ts
git commit -m "feat(sponsorship): add multi-currency support with real-time exchange rate via open.er-api.com (PA6)"
```

---

## Task 8: PA8+PB2 — Sponsorship Exposure Event Tracking

**Files:**
- Create: `apps/api/src/sponsorship/exposure/dto/exposure.dto.ts`
- Create: `apps/api/src/sponsorship/exposure/exposure.repo.ts`
- Create: `apps/api/src/sponsorship/exposure/exposure.service.ts`
- Create: `apps/api/src/sponsorship/exposure/exposure.service.test.ts`
- Create: `apps/api/src/sponsorship/exposure/exposure.controller.ts`
- Modify: `apps/api/src/sponsorship/dto/sponsorship.dto.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.repo.ts`
- Modify: `apps/api/src/sponsorship/sponsorship.routes.ts`

- [x] **Step 1: 실패하는 테스트 작성**

`apps/api/src/sponsorship/exposure/exposure.service.test.ts`:

```ts
import { ExposureService } from "./exposure.service";
import { AppError } from "../../lib/appError";
import type { ExposureRepository } from "./exposure.repo";

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  sponsorshipId: 10,
  channel: "SNS",
  occurredAt: new Date("2026-08-17"),
  exposureCount: 5000,
  fanReach: 12000,
  mediaValue: "600000",
  notes: null,
  createdById: 5,
  createdAt: new Date(),
  ...overrides,
});

const makeRepo = (overrides: Partial<ExposureRepository> = {}): ExposureRepository => ({
  create: jest.fn().mockResolvedValue(makeEvent()),
  findAll: jest.fn().mockResolvedValue([]),
  ...overrides,
} as unknown as ExposureRepository);

const makeService = (repo: ExposureRepository) => new ExposureService(repo);

describe("ExposureService.create", () => {
  it("throws 400 when no metric provided", async () => {
    await expect(
      makeService(makeRepo()).create(10, { channel: "TV", occurredAt: "2026-08-17" }, 5),
    ).rejects.toThrow(new AppError(400, "EXPOSURE_METRIC_REQUIRED"));
  });

  it("creates event when valid", async () => {
    const repo = makeRepo({ create: jest.fn().mockResolvedValue(makeEvent()) });
    await makeService(repo).create(10, { channel: "SNS", occurredAt: "2026-08-17", exposureCount: 5000 }, 5);
    expect(repo.create).toHaveBeenCalledWith(10, expect.objectContaining({ channel: "SNS", createdById: 5 }));
  });
});

describe("ExposureService.list", () => {
  it("returns empty array when no events", async () => {
    const result = await makeService(makeRepo()).list(10);
    expect(result).toEqual([]);
  });

  it("returns events", async () => {
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([makeEvent()]) });
    const result = await makeService(repo).list(10);
    expect(result).toHaveLength(1);
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npm test -- --testPathPattern=exposure.service.test --passWithNoTests 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module './exposure.service'"

- [x] **Step 3: DTO 생성**

`apps/api/src/sponsorship/exposure/dto/exposure.dto.ts`:

```ts
import type { ExposureChannel } from "../../../generated/enums";

export interface CreateExposureEventDto {
  channel: ExposureChannel;
  occurredAt: string;
  exposureCount?: number;
  fanReach?: number;
  mediaValue?: number;
  notes?: string;
}
```

- [x] **Step 4: Repository 생성**

`apps/api/src/sponsorship/exposure/exposure.repo.ts`:

```ts
import type { PrismaClient } from "../../generated/client";
import type { CreateExposureEventDto } from "./dto/exposure.dto";

const INCLUDE = {
  createdBy: { select: { id: true, username: true } },
} as const;

export class ExposureRepository {
  constructor(private prisma: PrismaClient) {}

  create(sponsorshipId: number, data: CreateExposureEventDto & { createdById: number }) {
    return this.prisma.sponsorshipExposureEvent.create({
      data: {
        sponsorshipId,
        channel: data.channel as any,
        occurredAt: new Date(data.occurredAt),
        createdById: data.createdById,
        ...(data.exposureCount !== undefined && { exposureCount: data.exposureCount }),
        ...(data.fanReach !== undefined && { fanReach: data.fanReach }),
        ...(data.mediaValue !== undefined && { mediaValue: data.mediaValue }),
        ...(data.notes && { notes: data.notes }),
      },
      include: INCLUDE,
    });
  }

  findAll(sponsorshipId: number) {
    return this.prisma.sponsorshipExposureEvent.findMany({
      where: { sponsorshipId },
      include: INCLUDE,
      orderBy: { occurredAt: "desc" },
    });
  }
}
```

- [x] **Step 5: Service 생성**

`apps/api/src/sponsorship/exposure/exposure.service.ts`:

```ts
import { AppError } from "../../lib/appError";
import type { ExposureRepository } from "./exposure.repo";
import type { CreateExposureEventDto } from "./dto/exposure.dto";

export class ExposureService {
  constructor(private repo: ExposureRepository) {}

  list(sponsorshipId: number) {
    return this.repo.findAll(sponsorshipId);
  }

  create(sponsorshipId: number, dto: CreateExposureEventDto, createdById: number) {
    if (!dto.exposureCount && !dto.fanReach && !dto.mediaValue) {
      throw new AppError(400, "EXPOSURE_METRIC_REQUIRED");
    }
    return this.repo.create(sponsorshipId, { ...dto, createdById });
  }
}
```

- [x] **Step 6: 테스트 통과 확인**

```bash
cd apps/api && npm test -- --testPathPattern=exposure.service.test 2>&1 | tail -10
```

Expected: PASS, 4 tests.

- [x] **Step 7: Controller 생성**

`apps/api/src/sponsorship/exposure/exposure.controller.ts`:

```ts
import { Request, Response, NextFunction } from "express";
import { requireUser } from "../../lib/authMiddleware";
import type { ExposureService } from "./exposure.service";
import type { CreateExposureEventDto } from "./dto/exposure.dto";

export class ExposureController {
  constructor(private service: ExposureService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      res.status(201).json(
        await this.service.create(Number(req.params["id"]), req.body as CreateExposureEventDto, user.id),
      );
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 8: `CreateSponsorshipDto`와 `UpdateSponsorshipDto`에 target 필드 추가**

`apps/api/src/sponsorship/dto/sponsorship.dto.ts`의 `CreateSponsorshipDto`에 추가:

```ts
  currency?: CurrencyCode;
  targetExposureCount?: number;
  targetFanReach?: number;
  targetMediaValue?: number;
```

`UpdateSponsorshipDto`에 추가:

```ts
export interface UpdateSponsorshipDto {
  sponsorName?: string;
  type?: SponsorType;
  totalFee?: number;
  contractStart?: string;
  contractEnd?: string;
  paymentSchedule?: PaymentSchedule;
  attachedContractId?: number;
  targetExposureCount?: number | null;
  targetFanReach?: number | null;
  targetMediaValue?: number | null;
  // 국내 계좌
  domesticBankName?: string | null;
  domesticAccountNumber?: string | null;
  domesticAccountHolder?: string | null;
  // 영국 계좌
  ukBankName?: string | null;
  ukSortCode?: string | null;
  ukAccountNumber?: string | null;
  ukSwiftBic?: string | null;
  // 국내/해외 구분
  isOverseas?: boolean;
  // 국내 전용
  businessRegNumber?: string | null;
  postalCode?: string | null;
  address?: string | null;
  addressDetail?: string | null;
  // 해외 전용
  taxId?: string | null;
  overseasAddress?: string | null;
}
```

- [x] **Step 9: `sponsorship.repo.ts`의 `create()` 수정 — target 필드 추가**

`create()` 메서드 data 블록에서 `currency` 아래에 추가:

```ts
        currency: (data.currency ?? "KRW") as any,
        ...(data.targetExposureCount !== undefined && { targetExposureCount: data.targetExposureCount }),
        ...(data.targetFanReach !== undefined && { targetFanReach: data.targetFanReach }),
        ...(data.targetMediaValue !== undefined && { targetMediaValue: data.targetMediaValue }),
```

그리고 `update()` 메서드 data 블록에 추가:

```ts
        ...(data.targetExposureCount !== undefined && { targetExposureCount: data.targetExposureCount }),
        ...(data.targetFanReach !== undefined && { targetFanReach: data.targetFanReach }),
        ...(data.targetMediaValue !== undefined && { targetMediaValue: data.targetMediaValue }),
```

- [x] **Step 10: `sponsorship.routes.ts`에 exposure 라우트 마운트**

상단 import에 추가:

```ts
import { ExposureRepository } from "./exposure/exposure.repo";
import { ExposureService } from "./exposure/exposure.service";
import { ExposureController } from "./exposure/exposure.controller";
```

기존 `const clauseRepo = ...` 아래에 추가:

```ts
const exposureRepo = new ExposureRepository(getPrisma());
const exposureService = new ExposureService(exposureRepo);
const exposureController = new ExposureController(exposureService);
```

`export default router;` 앞에 추가:

```ts
router.get("/:id/exposure-events",  auth, checkReadFinance, exposureController.list);
router.post("/:id/exposure-events", auth, checkWriteFinance, exposureController.create);
```

- [x] **Step 11: 전체 테스트 실행**

```bash
cd apps/api && npm test 2>&1 | tail -20
```

Expected: 신규 테스트 포함 전체 통과. `clause.service.test`, `contact-log.service.test`, `exposure.service.test` 모두 PASS.

- [x] **Step 12: build 최종 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: 에러 없음.

- [x] **Step 13: Commit**

```bash
git add apps/api/src/sponsorship/exposure/ apps/api/src/sponsorship/dto/sponsorship.dto.ts apps/api/src/sponsorship/sponsorship.repo.ts apps/api/src/sponsorship/sponsorship.routes.ts
git commit -m "feat(sponsorship): add SponsorshipExposureEvent tracking with target obligations (PA8/PB2)"
```
