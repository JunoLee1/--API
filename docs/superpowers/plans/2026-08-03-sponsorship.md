# Sponsorship Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sponsorship + SponsorshipPayment CRUD API 구현, 스폰서십 생성 시 paymentSchedule 기반 납부 일정 자동 생성, OVERDUE 상태 읽기 시 계산.

**Architecture:** 단일 `sponsorship/` 모듈. `SponsorshipService`가 납부일 계산(`generatePaymentDates` 순수 함수) + OVERDUE 변환 담당. Repo는 Prisma 쿼리만. Controller는 `canWrite(role, frontOfficeRole)` 가드.

**Tech Stack:** Express, Prisma (PostgreSQL), Jest + mock repos

---

## File Map

| 경로 | 역할 |
|------|------|
| `apps/api/src/sponsorship/dto/sponsorship.dto.ts` | DTO 타입 |
| `apps/api/src/sponsorship/sponsorship.repo.ts` | Prisma 쿼리 |
| `apps/api/src/sponsorship/sponsorship.service.ts` | 비즈니스 로직 |
| `apps/api/src/sponsorship/sponsorship.controller.ts` | HTTP 핸들러 |
| `apps/api/src/sponsorship/sponsorship.routes.ts` | 라우터 + DI |
| `apps/api/src/apiRouter.ts` | `/api/sponsorships` 등록 |
| `apps/api/__test__/sponsorship/sponsorship.service.test.ts` | 서비스 유닛 테스트 |

---

## Task 1: DTO + Repo

**Files:**
- Create: `apps/api/src/sponsorship/dto/sponsorship.dto.ts`
- Create: `apps/api/src/sponsorship/sponsorship.repo.ts`

- [ ] **Step 1: sponsorship.dto.ts 작성**

```ts
import type { SponsorType, PaymentSchedule } from "../../generated/enums";

export interface CreateSponsorshipDto {
  sponsorName: string;
  type: SponsorType;
  totalFee: number;
  contractStart: string;
  contractEnd: string;
  paymentSchedule: PaymentSchedule;
  attachedContractId?: number;
}

export interface UpdateSponsorshipDto {
  sponsorName?: string;
  type?: SponsorType;
  totalFee?: number;
  contractStart?: string;
  contractEnd?: string;
  paymentSchedule?: PaymentSchedule;
  attachedContractId?: number;
}

export interface SponsorshipListQuery {
  type?: SponsorType;
}
```

- [ ] **Step 2: sponsorship.repo.ts 작성**

```ts
import type { PrismaClient } from "../../generated/client";
import type { CreateSponsorshipDto, UpdateSponsorshipDto, SponsorshipListQuery } from "./dto/sponsorship.dto";

const INCLUDE = {
  createdBy: { select: { id: true, username: true } },
} as const;

export class SponsorshipRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: SponsorshipListQuery) {
    return this.prisma.sponsorship.findMany({
      where: { ...(query.type && { type: query.type }) },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.sponsorship.findUnique({
      where: { id },
      include: {
        ...INCLUDE,
        payments: { orderBy: { dueDate: "asc" } },
      },
    });
  }

  create(data: CreateSponsorshipDto & { createdById: number }) {
    return this.prisma.sponsorship.create({
      data: {
        sponsorName: data.sponsorName,
        type: data.type,
        totalFee: data.totalFee,
        contractStart: new Date(data.contractStart),
        contractEnd: new Date(data.contractEnd),
        paymentSchedule: data.paymentSchedule,
        createdById: data.createdById,
        ...(data.attachedContractId && { attachedContractId: data.attachedContractId }),
      },
    });
  }

  createPayments(data: { sponsorshipId: number; dueDate: Date; amount: number }[]) {
    return this.prisma.sponsorshipPayment.createMany({ data });
  }

  update(id: number, data: UpdateSponsorshipDto) {
    return this.prisma.sponsorship.update({
      where: { id },
      data: {
        ...data,
        ...(data.contractStart && { contractStart: new Date(data.contractStart) }),
        ...(data.contractEnd && { contractEnd: new Date(data.contractEnd) }),
      },
    });
  }

  findPayments(sponsorshipId: number) {
    return this.prisma.sponsorshipPayment.findMany({
      where: { sponsorshipId },
      orderBy: { dueDate: "asc" },
    });
  }

  findPaymentById(id: number) {
    return this.prisma.sponsorshipPayment.findUnique({ where: { id } });
  }

  updatePayment(id: number, data: { status: "PAID"; paidAt: Date }) {
    return this.prisma.sponsorshipPayment.update({
      where: { id },
      data,
    });
  }
}
```

- [ ] **Step 3: TypeScript 체크**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | grep "sponsorship" | head -20
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/sponsorship/
git commit -m "feat: add Sponsorship DTO and repository"
```

---

## Task 2: SponsorshipService TDD

**Files:**
- Test: `apps/api/__test__/sponsorship/sponsorship.service.test.ts`
- Create: `apps/api/src/sponsorship/sponsorship.service.ts`

- [ ] **Step 1: 테스트 파일 작성**

Create `apps/api/__test__/sponsorship/sponsorship.service.test.ts`:

```ts
import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { SponsorshipService, generatePaymentDates } from "../../src/sponsorship/sponsorship.service";
import { AppError } from "../../src/lib/appError";

// ── generatePaymentDates 순수 함수 테스트 ──────────────────────────

describe("generatePaymentDates", () => {
  test("MONTHLY: 3개월 계약 → 3개 납부일", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-03-31");
    const dates = generatePaymentDates(start, end, "MONTHLY");
    expect(dates).toHaveLength(3);
    expect(dates[0]).toEqual(new Date("2026-01-01"));
    expect(dates[1]).toEqual(new Date("2026-02-01"));
    expect(dates[2]).toEqual(new Date("2026-03-01"));
  });

  test("QUARTERLY: 9개월 계약 → 3개 납부일", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-09-30");
    const dates = generatePaymentDates(start, end, "QUARTERLY");
    expect(dates).toHaveLength(3);
    expect(dates[0]).toEqual(new Date("2026-01-01"));
    expect(dates[1]).toEqual(new Date("2026-04-01"));
    expect(dates[2]).toEqual(new Date("2026-07-01"));
  });

  test("ANNUAL: 2년 계약 → 2개 납부일", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2027-12-31");
    const dates = generatePaymentDates(start, end, "ANNUAL");
    expect(dates).toHaveLength(2);
    expect(dates[0]).toEqual(new Date("2026-01-01"));
    expect(dates[1]).toEqual(new Date("2027-01-01"));
  });
});

// ── SponsorshipService 테스트 ──────────────────────────────────────

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  createPayments: jest.fn(),
  update: jest.fn(),
  findPayments: jest.fn(),
  findPaymentById: jest.fn(),
  updatePayment: jest.fn(),
} as any;

const service = new SponsorshipService(mockRepo);

beforeEach(() => jest.clearAllMocks());

describe("SponsorshipService.create", () => {
  test("MONTHLY 3개월 계약 시 3개 payment 생성, 균등 금액", async () => {
    mockRepo.create.mockResolvedValue({ id: 1 });
    mockRepo.findById.mockResolvedValue({ id: 1, payments: [] });

    await service.create(
      {
        sponsorName: "나이키",
        type: "KIT",
        totalFee: 300,
        contractStart: "2026-01-01",
        contractEnd: "2026-03-31",
        paymentSchedule: "MONTHLY",
      },
      10,
    );

    expect(mockRepo.createPayments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ amount: 100, dueDate: new Date("2026-01-01") }),
        expect.objectContaining({ amount: 100, dueDate: new Date("2026-02-01") }),
        expect.objectContaining({ amount: 100, dueDate: new Date("2026-03-01") }),
      ]),
    );
  });

  test("나눌 수 없는 금액 — 마지막 회차에 반올림 차액 보정", async () => {
    mockRepo.create.mockResolvedValue({ id: 2 });
    mockRepo.findById.mockResolvedValue({ id: 2, payments: [] });

    await service.create(
      {
        sponsorName: "아디다스",
        type: "KIT",
        totalFee: 100,
        contractStart: "2026-01-01",
        contractEnd: "2026-03-31",
        paymentSchedule: "MONTHLY",
      },
      10,
    );

    const [[payments]] = (mockRepo.createPayments as any).mock.calls;
    const total = payments.reduce((s: number, p: any) => s + p.amount, 0);
    expect(total).toBeCloseTo(100, 5);
  });
});

describe("SponsorshipService.get", () => {
  test("존재하지 않으면 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.get(999)).rejects.toMatchObject({
      statusCode: 404,
      code: "SPONSORSHIP_NOT_FOUND",
    });
  });

  test("dueDate가 지난 PENDING payment는 OVERDUE로 반환", async () => {
    const pastDate = new Date("2020-01-01");
    mockRepo.findById.mockResolvedValue({
      id: 1,
      payments: [{ id: 10, status: "PENDING", dueDate: pastDate, paidAt: null }],
    });

    const result = await service.get(1);
    expect(result.payments[0].status).toBe("OVERDUE");
  });

  test("dueDate가 미래인 PENDING payment는 PENDING 유지", async () => {
    const futureDate = new Date("2099-01-01");
    mockRepo.findById.mockResolvedValue({
      id: 1,
      payments: [{ id: 11, status: "PENDING", dueDate: futureDate, paidAt: null }],
    });

    const result = await service.get(1);
    expect(result.payments[0].status).toBe("PENDING");
  });
});

describe("SponsorshipService.markPaid", () => {
  test("payment 없으면 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, payments: [] });
    mockRepo.findPaymentById.mockResolvedValue(null);

    await expect(service.markPaid(1, 99)).rejects.toMatchObject({
      statusCode: 404,
      code: "SPONSORSHIP_PAYMENT_NOT_FOUND",
    });
  });

  test("다른 sponsorship의 payment면 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, payments: [] });
    mockRepo.findPaymentById.mockResolvedValue({ id: 50, sponsorshipId: 99, status: "PENDING" });

    await expect(service.markPaid(1, 50)).rejects.toMatchObject({
      statusCode: 404,
      code: "SPONSORSHIP_PAYMENT_NOT_FOUND",
    });
  });

  test("이미 PAID면 409를 던진다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, payments: [] });
    mockRepo.findPaymentById.mockResolvedValue({ id: 5, sponsorshipId: 1, status: "PAID" });

    await expect(service.markPaid(1, 5)).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_PAID",
    });
  });

  test("성공 시 updatePayment에 paidAt을 설정한다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, payments: [] });
    mockRepo.findPaymentById.mockResolvedValue({ id: 5, sponsorshipId: 1, status: "PENDING" });
    mockRepo.updatePayment.mockResolvedValue({});

    await service.markPaid(1, 5);

    expect(mockRepo.updatePayment).toHaveBeenCalledWith(5, {
      status: "PAID",
      paidAt: expect.any(Date),
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/sponsorship --no-coverage 2>&1 | tail -10
```

Expected: FAIL (구현 파일 없음)

- [ ] **Step 3: sponsorship.service.ts 구현**

Create `apps/api/src/sponsorship/sponsorship.service.ts`:

```ts
import { AppError } from "../lib/appError";
import type { SponsorshipRepository } from "./sponsorship.repo";
import type { CreateSponsorshipDto, UpdateSponsorshipDto, SponsorshipListQuery } from "./dto/sponsorship.dto";
import type { PaymentSchedule } from "../generated/enums";

export function generatePaymentDates(start: Date, end: Date, schedule: PaymentSchedule): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    if (schedule === "MONTHLY") current.setMonth(current.getMonth() + 1);
    else if (schedule === "QUARTERLY") current.setMonth(current.getMonth() + 3);
    else current.setFullYear(current.getFullYear() + 1);
  }
  return dates;
}

export class SponsorshipService {
  constructor(private repo: SponsorshipRepository) {}

  list(query: SponsorshipListQuery) {
    return this.repo.findAll(query);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "SPONSORSHIP_NOT_FOUND");
    return { ...record, payments: this.applyOverdue(record.payments) };
  }

  async create(dto: CreateSponsorshipDto, createdById: number) {
    const sponsorship = await this.repo.create({ ...dto, createdById });
    const dates = generatePaymentDates(
      new Date(dto.contractStart),
      new Date(dto.contractEnd),
      dto.paymentSchedule,
    );
    if (dates.length > 0) {
      const count = dates.length;
      const baseAmount = Math.floor((dto.totalFee * 100) / count) / 100;
      const lastAmount = parseFloat((dto.totalFee - baseAmount * (count - 1)).toFixed(2));
      await this.repo.createPayments(
        dates.map((dueDate, i) => ({
          sponsorshipId: sponsorship.id,
          dueDate,
          amount: i === count - 1 ? lastAmount : baseAmount,
        })),
      );
    }
    return this.get(sponsorship.id);
  }

  async update(id: number, dto: UpdateSponsorshipDto) {
    await this.get(id);
    return this.repo.update(id, dto);
  }

  async getPayments(id: number) {
    await this.get(id);
    const payments = await this.repo.findPayments(id);
    return this.applyOverdue(payments);
  }

  async markPaid(sponsorshipId: number, paymentId: number) {
    await this.get(sponsorshipId);
    const payment = await this.repo.findPaymentById(paymentId);
    if (!payment || payment.sponsorshipId !== sponsorshipId) {
      throw new AppError(404, "SPONSORSHIP_PAYMENT_NOT_FOUND");
    }
    if (payment.status === "PAID") throw new AppError(409, "ALREADY_PAID");
    return this.repo.updatePayment(paymentId, { status: "PAID", paidAt: new Date() });
  }

  private applyOverdue(payments: any[]) {
    const now = new Date();
    return payments.map((p) => ({
      ...p,
      status: p.status === "PENDING" && p.dueDate < now ? "OVERDUE" : p.status,
    }));
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/sponsorship --no-coverage 2>&1 | tail -15
```

Expected: 12개 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/sponsorship/sponsorship.service.ts apps/api/__test__/sponsorship/
git commit -m "feat: add SponsorshipService with payment auto-generation and OVERDUE logic"
```

---

## Task 3: Controller + Routes + apiRouter

**Files:**
- Create: `apps/api/src/sponsorship/sponsorship.controller.ts`
- Create: `apps/api/src/sponsorship/sponsorship.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: sponsorship.controller.ts 작성**

```ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import type { SponsorshipService } from "./sponsorship.service";
import type { CreateSponsorshipDto, UpdateSponsorshipDto, SponsorshipListQuery } from "./dto/sponsorship.dto";

const canWrite = (role: string, foRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && foRole === "FINANCE_MANAGER");

export class SponsorshipController {
  constructor(private service: SponsorshipService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(req.query as SponsorshipListQuery));
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id: userId } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body as CreateSponsorshipDto, userId));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body as UpdateSponsorshipDto));
    } catch (err) { next(err); }
  };

  getPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getPayments(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  markPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(
        await this.service.markPaid(Number(req.params["id"]), Number(req.params["paymentId"])),
      );
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 2: sponsorship.routes.ts 작성**

```ts
import { Router } from "express";
import passport from "passport";
import { getPrisma } from "../lib/prisma";
import { SponsorshipRepository } from "./sponsorship.repo";
import { SponsorshipService } from "./sponsorship.service";
import { SponsorshipController } from "./sponsorship.controller";

const router = Router();
const auth = passport.authenticate("accessToken", { session: false });

const repo = new SponsorshipRepository(getPrisma());
const service = new SponsorshipService(repo);
const controller = new SponsorshipController(service);

router.get("/",    auth, controller.list);
router.post("/",   auth, controller.create);
router.get("/:id", auth, controller.get);
router.patch("/:id", auth, controller.update);
router.get("/:id/payments", auth, controller.getPayments);
router.patch("/:id/payments/:paymentId", auth, controller.markPaid);

export default router;
```

- [ ] **Step 3: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts` 마지막 import 다음에 추가:
```ts
import sponsorshipRouter from "./sponsorship/sponsorship.routes";
```

`apiRouter.use("/recruitment", recruitmentRouter);` 다음에 추가:
```ts
apiRouter.use("/sponsorships", sponsorshipRouter);
```

- [ ] **Step 4: TypeScript 빌드 확인**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | grep "sponsorship" | head -20
```

Expected: 에러 없음

- [ ] **Step 5: 전체 테스트 실행**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/sponsorship --no-coverage 2>&1 | tail -10
```

Expected: 10개 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/juno/work/football
git add apps/api/src/sponsorship/ apps/api/src/apiRouter.ts
git commit -m "feat: wire up sponsorship routes and controller"
```

---

## 완료 체크리스트

- [ ] `GET /api/sponsorships` — type 필터 작동
- [ ] `POST /api/sponsorships` MONTHLY 3개월 → 3개 Payment 자동 생성
- [ ] `POST /api/sponsorships` QUARTERLY/ANNUAL 날짜 계산 정확
- [ ] `GET /api/sponsorships/:id` — payments 포함, OVERDUE 계산
- [ ] `GET /api/sponsorships/:id/payments` — OVERDUE 계산
- [ ] `PATCH /api/sponsorships/:id/payments/:paymentId` → PAID, paidAt 설정
- [ ] 이미 PAID → 409
- [ ] 다른 sponsorship의 payment → 404
- [ ] ADMIN/FINANCE_MANAGER 외 쓰기 → 403
- [ ] 12개 유닛 테스트 통과
- [ ] tsc 에러 없음
