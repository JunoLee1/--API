# 유소년 모듈 Plan 8: 아카데미 회비 관리 (Academy Fee Management)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 유소년 아카데미 회비 청구·수납·미납 관리 전 과정을 자동화하고, GM 재무 KPI 대시보드와 라이트 모드 수동 수납을 지원한다.

**Architecture:** `AcademyFee` 엔티티가 월별 청구 단위. 두 cron job: (1) 매월 25일 09:00 청구서 자동 발행, (2) 매일 09:00 미납 단계별 처리(D+1→D+7→D+30 자동 상태 전환 + 알림). D+30 시 Player.status = SUSPENDED로 훈련/경기 자동 배제. Guardian 수동 납부 증빙 업로드 지원(Lite Mode). 관리자 승인으로 PAID 전환.

**Tech Stack:** node-cron, Prisma migration, Express BE, React FE, Tailwind

**의존성:** Plan 1 완료 필요 (GUARDIAN role, Player.guardianId, NotificationRepository.createForGuardian)

---

## 파일 맵

### BE — 신규
- `apps/api/src/academy-fee/dto/academy-fee.dto.ts`
- `apps/api/src/academy-fee/academy-fee.repo.ts`
- `apps/api/src/academy-fee/academy-fee.service.ts`
- `apps/api/src/academy-fee/academy-fee.controller.ts`
- `apps/api/src/academy-fee/academy-fee.routes.ts`
- `apps/api/src/jobs/academyFeeBilling.ts`
- `apps/api/src/jobs/academyFeeDelinquency.ts`
- `apps/api/__test__/academy-fee/academy-fee.service.test.ts`
- `apps/api/__test__/jobs/academyFeeDelinquency.test.ts`

### BE — 수정
- `apps/api/prisma/schema.prisma` — AcademyFee 모델, FeeStatus enum, NotificationType 추가
- `apps/api/src/apiRouter.ts` — /academy-fees 등록
- `apps/api/src/server.ts` — 두 cron job 등록
- `apps/api/src/dashboard/dashboard.repo.ts` — getAcademyFinanceStats() 추가
- `apps/api/src/dashboard/dashboard.service.ts` — getAcademyFinanceStats() 위임
- `apps/api/src/dashboard/dashboard.routes.ts` — GET /academy-finance 추가

### FE — 신규
- `football/src/types/academy-fee.ts`
- `football/src/services/academyFee.service.ts`
- `football/src/pages/youth/AcademyFeePage.tsx` — 어드민 관리 뷰
- `football/src/pages/youth/GuardianFeeView.tsx` — 학부모 납부 뷰
- `football/src/components/dashboard/AcademyFinanceSection.tsx`

### FE — 수정
- `football/src/App.tsx` — /academy-fees 라우트 추가
- `football/src/pages/dashboard/dashboardConfig.ts` — showAcademyFinance flag
- `football/src/pages/dashboard/DashboardPage.tsx` — AcademyFinanceSection 추가

---

## Task 1: Schema 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: FeeStatus enum 추가**

```prisma
enum FeeStatus {
  PENDING
  SUBMITTED   // 학부모가 납부 증빙 제출 (수동 확인 대기)
  PAID
  OVERDUE
  LOCKED
}
```

- [x] **Step 2: NotificationType에 회비 관련 타입 추가**

`enum NotificationType` 블록에 추가:
```prisma
  FEE_INVOICE_ISSUED
  FEE_REMINDER
  FEE_OVERDUE_WARNING
  FEE_ACCOUNT_LOCKED
```

- [x] **Step 3: AcademyFee 모델 추가** (YouthRegistration 아래)

```prisma
model AcademyFee {
  id                  Int        @id @default(autoincrement())
  playerId            String
  guardianId          Int
  amount              Int
  dueDate             DateTime
  status              FeeStatus  @default(PENDING)
  paidAt              DateTime?
  paymentProofUrl     String?
  paymentSubmittedAt  DateTime?
  year                Int
  month               Int
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt

  player   Player @relation(fields: [playerId], references: [id])
  guardian User   @relation("GuardianFees", fields: [guardianId], references: [id])

  @@unique([playerId, year, month])
}
```

- [x] **Step 4: 역관계 추가**

Player 모델에:
```prisma
academyFees AcademyFee[]
```

User 모델에:
```prisma
guardianFees AcademyFee[] @relation("GuardianFees")
```

- [x] **Step 5: 마이그레이션 실행**

```bash
cd apps/api && npx prisma migrate dev --name add-academy-fee
```

shadow DB 충돌 시 workaround:
```bash
npx prisma db push
TIMESTAMP=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TIMESTAMP}_add_academy_fee
echo "-- Applied via db push" > prisma/migrations/${TIMESTAMP}_add_academy_fee/migration.sql
npx prisma migrate resolve --applied ${TIMESTAMP}_add_academy_fee
```

- [x] **Step 6: Generate**

```bash
npx prisma generate
```

- [x] **Step 7: TypeScript 확인**

```bash
npx tsc --noEmit 2>&1 | grep -v "country.repo\|monthlyAttendance" | head -20
```

- [x] **Step 8: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(youth): AcademyFee 모델 + FeeStatus enum + 회비 알림 타입"
```

---

## Task 2: AcademyFee DTO + Repository

**Files:**
- Create: `apps/api/src/academy-fee/dto/academy-fee.dto.ts`
- Create: `apps/api/src/academy-fee/academy-fee.repo.ts`

- [x] **Step 1: DTO 작성**

```typescript
// apps/api/src/academy-fee/dto/academy-fee.dto.ts
export interface CreateAcademyFeeDto {
  playerId: string;
  guardianId: number;
  amount: number;
  dueDate: Date;
  year: number;
  month: number;
}

export interface SubmitPaymentProofDto {
  paymentProofUrl: string;
}

export interface FeeListQuery {
  status?: string;
  teamId?: number;
  year?: number;
  month?: number;
}
```

- [x] **Step 2: Repository 작성**

```typescript
// apps/api/src/academy-fee/academy-fee.repo.ts
import type { PrismaClient } from "../generated/client";
import type { CreateAcademyFeeDto, FeeListQuery } from "./dto/academy-fee.dto";

const INCLUDE = {
  player: { select: { id: true, playerName: true, teamId: true, status: true } },
  guardian: { select: { id: true, username: true } },
} as const;

export class AcademyFeeRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: FeeListQuery) {
    return this.prisma.academyFee.findMany({
      where: {
        ...(query.status && { status: query.status as any }),
        ...(query.year && { year: query.year }),
        ...(query.month && { month: query.month }),
        ...(query.teamId && { player: { teamId: query.teamId } }),
      },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.academyFee.findUnique({ where: { id }, include: INCLUDE });
  }

  findByPlayer(playerId: string) {
    return this.prisma.academyFee.findMany({
      where: { playerId },
      include: INCLUDE,
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  findOverdue(beforeDate: Date) {
    return this.prisma.academyFee.findMany({
      where: { status: { in: ["PENDING", "OVERDUE"] }, dueDate: { lt: beforeDate } },
      include: INCLUDE,
    });
  }

  findAllActiveYouthPlayers() {
    return this.prisma.player.findMany({
      where: { team: { type: "YOUTH" }, guardianId: { not: null } },
      select: { id: true, playerName: true, teamId: true, guardianId: true },
    });
  }

  create(data: CreateAcademyFeeDto) {
    return this.prisma.academyFee.create({ data, include: INCLUDE });
  }

  createMany(fees: CreateAcademyFeeDto[]) {
    return this.prisma.academyFee.createMany({ data: fees, skipDuplicates: true });
  }

  updateStatus(id: number, status: string, extra?: { paidAt?: Date }) {
    return this.prisma.academyFee.update({
      where: { id },
      data: { status: status as any, ...extra },
      include: INCLUDE,
    });
  }

  submitPaymentProof(id: number, url: string) {
    return this.prisma.academyFee.update({
      where: { id },
      data: { status: "SUBMITTED", paymentProofUrl: url, paymentSubmittedAt: new Date() },
      include: INCLUDE,
    });
  }

  approvePayment(id: number) {
    return this.prisma.academyFee.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
      include: INCLUDE,
    });
  }

  lockPlayer(playerId: string) {
    return this.prisma.player.update({
      where: { id: playerId },
      data: { status: "SUSPENDED" as any },
    });
  }

  getFinanceStats(year: number, month: number) {
    return this.prisma.academyFee.groupBy({
      by: ["status"],
      where: { year, month },
      _count: { id: true },
      _sum: { amount: true },
    });
  }
}
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/academy-fee/
git commit -m "feat(youth): AcademyFee DTO and Repository"
```

---

## Task 3: AcademyFeeService (TDD)

**Files:**
- Create: `apps/api/src/academy-fee/academy-fee.service.ts`
- Create: `apps/api/__test__/academy-fee/academy-fee.service.test.ts`

- [x] **Step 1: failing test 작성**

```typescript
// apps/api/__test__/academy-fee/academy-fee.service.test.ts
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { AcademyFeeService } from "../../src/academy-fee/academy-fee.service";

const mockRepo = {
  findById: jest.fn(),
  findByPlayer: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  findAll: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  findAllActiveYouthPlayers: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  create: jest.fn(),
  createMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 0 }),
  updateStatus: jest.fn(),
  submitPaymentProof: jest.fn(),
  approvePayment: jest.fn(),
  lockPlayer: jest.fn(),
  findOverdue: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  getFinanceStats: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
} as any;

const mockNotifRepo = {
  createForGuardian: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
} as any;

const service = new AcademyFeeService(mockRepo, mockNotifRepo);

describe("AcademyFeeService - issueMonthlyFees", () => {
  beforeEach(() => jest.clearAllMocks());

  test("활성 유소년 선수에게 청구서 발행", async () => {
    mockRepo.findAllActiveYouthPlayers.mockResolvedValue([
      { id: "player-1", playerName: "홍길동", guardianId: 10 },
      { id: "player-2", playerName: "김철수", guardianId: 11 },
    ]);

    await service.issueMonthlyFees(2026, 7, 50000);

    expect(mockRepo.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ playerId: "player-1", guardianId: 10, amount: 50000, year: 2026, month: 7 }),
        expect.objectContaining({ playerId: "player-2", guardianId: 11, amount: 50000, year: 2026, month: 7 }),
      ]),
    );
    expect(mockNotifRepo.createForGuardian).toHaveBeenCalledTimes(2);
  });

  test("guardianId 없는 선수는 제외", async () => {
    mockRepo.findAllActiveYouthPlayers.mockResolvedValue([
      { id: "player-3", playerName: "이영희", guardianId: null },
    ]);

    await service.issueMonthlyFees(2026, 7, 50000);

    expect(mockRepo.createMany).toHaveBeenCalledWith([]);
  });
});

describe("AcademyFeeService - processOverdue", () => {
  beforeEach(() => jest.clearAllMocks());

  test("D+1: PENDING → 리마인더 발송", async () => {
    const dueDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    mockRepo.findOverdue.mockResolvedValue([
      { id: 1, status: "PENDING", dueDate, guardianId: 10, playerId: "p1",
        player: { playerName: "홍길동", status: "ACTIVE" } },
    ]);

    await service.processOverdue();

    expect(mockNotifRepo.createForGuardian).toHaveBeenCalledWith(
      10, "FEE_REMINDER", expect.any(String), expect.any(String), 1,
    );
    expect(mockRepo.lockPlayer).not.toHaveBeenCalled();
  });

  test("D+30: LOCKED + Player suspended + 알림", async () => {
    const dueDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    mockRepo.findOverdue.mockResolvedValue([
      { id: 2, status: "OVERDUE", dueDate, guardianId: 11, playerId: "p2",
        player: { playerName: "김철수", status: "ACTIVE" } },
    ]);

    await service.processOverdue();

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(2, "LOCKED");
    expect(mockRepo.lockPlayer).toHaveBeenCalledWith("p2");
    expect(mockNotifRepo.createForGuardian).toHaveBeenCalledWith(
      11, "FEE_ACCOUNT_LOCKED", expect.any(String), expect.any(String), 2,
    );
  });
});
```

- [x] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd apps/api && npx jest __test__/academy-fee/academy-fee.service.test.ts --no-coverage 2>&1 | tail -10
```

- [x] **Step 3: Service 구현**

```typescript
// apps/api/src/academy-fee/academy-fee.service.ts
import { AppError } from "../lib/appError";
import type { AcademyFeeRepository } from "./academy-fee.repo";
import type { NotificationRepository } from "../notification/notification.repo";
import type { FeeListQuery, SubmitPaymentProofDto } from "./dto/academy-fee.dto";

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export class AcademyFeeService {
  constructor(
    private repo: AcademyFeeRepository,
    private notifRepo: NotificationRepository,
  ) {}

  getAll(query: FeeListQuery) {
    return this.repo.findAll(query);
  }

  getByPlayer(playerId: string) {
    return this.repo.findByPlayer(playerId);
  }

  async getById(id: number) {
    const fee = await this.repo.findById(id);
    if (!fee) throw new AppError(404, "FEE_NOT_FOUND");
    return fee;
  }

  async issueMonthlyFees(year: number, month: number, amount: number) {
    const players = await this.repo.findAllActiveYouthPlayers();
    const dueDate = new Date(year, month - 1, 25); // 당월 25일

    const eligible = players.filter(p => p.guardianId !== null);

    await this.repo.createMany(
      eligible.map(p => ({
        playerId: p.id,
        guardianId: p.guardianId!,
        amount,
        dueDate,
        year,
        month,
      })),
    );

    for (const p of eligible) {
      void this.notifRepo
        .createForGuardian(
          p.guardianId!,
          "FEE_INVOICE_ISSUED",
          `${month}월 아카데미 회비 청구서`,
          `${p.playerName} 선수의 ${month}월 아카데미 회비(${amount.toLocaleString()}원)가 청구됐습니다. 납부 기한: ${dueDate.toLocaleDateString("ko-KR")}`,
        )
        .catch(console.error);
    }
  }

  async processOverdue() {
    const now = new Date();
    const overdueFees = await this.repo.findOverdue(now);

    for (const fee of overdueFees) {
      const days = daysSince(fee.dueDate);

      if (days >= 30) {
        await this.repo.updateStatus(fee.id, "LOCKED");
        if (fee.player.status !== "SUSPENDED") {
          await this.repo.lockPlayer(fee.playerId);
        }
        void this.notifRepo
          .createForGuardian(
            fee.guardianId,
            "FEE_ACCOUNT_LOCKED",
            "아카데미 회비 미납 — 훈련/경기 참가 정지",
            `${fee.player.playerName} 선수가 30일 이상 회비를 미납하여 훈련·경기 참가가 일시 정지됐습니다.`,
            fee.id,
          )
          .catch(console.error);
      } else if (days >= 7) {
        await this.repo.updateStatus(fee.id, "OVERDUE");
        void this.notifRepo
          .createForGuardian(
            fee.guardianId,
            "FEE_OVERDUE_WARNING",
            "아카데미 회비 미납 2차 안내",
            `${fee.player.playerName} 선수의 아카데미 회비가 ${days}일째 미납 중입니다. 빠른 납부를 부탁드립니다.`,
            fee.id,
          )
          .catch(console.error);
      } else if (days >= 1) {
        void this.notifRepo
          .createForGuardian(
            fee.guardianId,
            "FEE_REMINDER",
            "아카데미 회비 납부 안내",
            `${fee.player.playerName} 선수의 아카데미 회비 납부 기한이 지났습니다. 확인해 주세요.`,
            fee.id,
          )
          .catch(console.error);
      }
    }
  }

  async submitPaymentProof(id: number, dto: SubmitPaymentProofDto) {
    const fee = await this.repo.findById(id);
    if (!fee) throw new AppError(404, "FEE_NOT_FOUND");
    if (fee.status === "PAID") throw new AppError(409, "ALREADY_PAID");
    return this.repo.submitPaymentProof(id, dto.paymentProofUrl);
  }

  async approvePayment(id: number) {
    const fee = await this.repo.findById(id);
    if (!fee) throw new AppError(404, "FEE_NOT_FOUND");
    if (fee.status !== "SUBMITTED") throw new AppError(409, "INVALID_STATUS");
    const paid = await this.repo.approvePayment(id);
    void this.notifRepo
      .createForGuardian(
        fee.guardianId,
        "FEE_INVOICE_ISSUED",
        "아카데미 회비 수납 확인",
        `${fee.player.playerName} 선수의 회비 납부가 확인됐습니다. 감사합니다.`,
        id,
      )
      .catch(console.error);
    return paid;
  }

  async getFinanceStats(year: number, month: number) {
    const rows = await this.repo.getFinanceStats(year, month);
    const total = rows.reduce((s, r) => s + (r._count.id ?? 0), 0);
    const paid = rows.find(r => r.status === "PAID")?._count.id ?? 0;
    const overdue = rows.filter(r => ["OVERDUE", "LOCKED"].includes(r.status as string))
      .reduce((s, r) => s + (r._count.id ?? 0), 0);
    const locked = rows.find(r => r.status === "LOCKED")?._count.id ?? 0;
    const totalRevenue = rows.find(r => r.status === "PAID")?._sum.amount ?? 0;

    return {
      monthlyCollectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
      totalRevenue,
      overdueCount: overdue,
      lockedPlayerCount: locked,
    };
  }
}
```

- [x] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/academy-fee/academy-fee.service.test.ts --no-coverage
```

Expected: 4 tests PASS

- [x] **Step 5: Commit**

```bash
git add apps/api/src/academy-fee/ apps/api/__test__/academy-fee/
git commit -m "feat(youth): AcademyFeeService TDD - 청구 발행, 미납 처리, 수납 승인"
```

---

## Task 4: Delinquency + Billing Cron Jobs

**Files:**
- Create: `apps/api/src/jobs/academyFeeBilling.ts`
- Create: `apps/api/src/jobs/academyFeeDelinquency.ts`
- Create: `apps/api/__test__/jobs/academyFeeDelinquency.test.ts`

- [x] **Step 1: Billing cron 작성**

```typescript
// apps/api/src/jobs/academyFeeBilling.ts
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { AcademyFeeRepository } from "../academy-fee/academy-fee.repo";
import { AcademyFeeService } from "../academy-fee/academy-fee.service";

const DEFAULT_MONTHLY_AMOUNT = 100000; // 기본 회비 10만원 (추후 팀별 설정으로 대체 가능)

export function startAcademyFeeBillingJob() {
  // 매월 25일 09:00
  cron.schedule("0 9 25 * *", async () => {
    const prisma = getPrisma();
    const repo = new AcademyFeeRepository(prisma);
    const notifRepo = new NotificationRepository(prisma);
    const service = new AcademyFeeService(repo, notifRepo);

    const now = new Date();
    await service.issueMonthlyFees(now.getFullYear(), now.getMonth() + 1, DEFAULT_MONTHLY_AMOUNT)
      .catch(console.error);
  });
}
```

- [x] **Step 2: failing test 작성**

```typescript
// apps/api/__test__/jobs/academyFeeDelinquency.test.ts
import { describe, test, jest, expect, beforeEach } from "@jest/globals";

const mockService = {
  processOverdue: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
} as any;

jest.mock("../../src/academy-fee/academy-fee.service", () => ({
  AcademyFeeService: jest.fn().mockImplementation(() => mockService),
}));
jest.mock("../../src/academy-fee/academy-fee.repo", () => ({
  AcademyFeeRepository: jest.fn(),
}));
jest.mock("../../src/notification/notification.repo", () => ({
  NotificationRepository: jest.fn(),
}));
jest.mock("../../src/lib/prisma", () => ({ getPrisma: jest.fn().mockReturnValue({}) }));

import { runDelinquencyCheck } from "../../src/jobs/academyFeeDelinquency";

describe("academyFeeDelinquency job", () => {
  beforeEach(() => jest.clearAllMocks());

  test("processOverdue를 호출한다", async () => {
    await runDelinquencyCheck();
    expect(mockService.processOverdue).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 3: 테스트 실행 → 실패 확인**

```bash
cd apps/api && npx jest __test__/jobs/academyFeeDelinquency.test.ts --no-coverage 2>&1 | tail -5
```

- [x] **Step 4: Delinquency cron 작성**

```typescript
// apps/api/src/jobs/academyFeeDelinquency.ts
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { AcademyFeeRepository } from "../academy-fee/academy-fee.repo";
import { AcademyFeeService } from "../academy-fee/academy-fee.service";

export async function runDelinquencyCheck() {
  const prisma = getPrisma();
  const repo = new AcademyFeeRepository(prisma);
  const notifRepo = new NotificationRepository(prisma);
  const service = new AcademyFeeService(repo, notifRepo);
  await service.processOverdue();
}

export function startAcademyFeeDelinquencyJob() {
  // 매일 09:00
  cron.schedule("0 9 * * *", () => {
    runDelinquencyCheck().catch(console.error);
  });
}
```

- [x] **Step 5: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/jobs/academyFeeDelinquency.test.ts --no-coverage
```

Expected: PASS

- [x] **Step 6: server.ts에 cron 등록**

`apps/api/src/server.ts`에 추가:
```typescript
import { startAcademyFeeBillingJob } from "./jobs/academyFeeBilling";
import { startAcademyFeeDelinquencyJob } from "./jobs/academyFeeDelinquency";
// 기존 cron 등록 아래:
startAcademyFeeBillingJob();
startAcademyFeeDelinquencyJob();
```

- [x] **Step 7: Commit**

```bash
git add apps/api/src/jobs/academyFee*.ts apps/api/__test__/jobs/academyFeeDelinquency.test.ts apps/api/src/server.ts
git commit -m "feat(youth): 회비 청구 cron (월 25일) + 미납 처리 cron (매일)"
```

---

## Task 5: Controller + Routes + apiRouter

**Files:**
- Create: `apps/api/src/academy-fee/academy-fee.controller.ts`
- Create: `apps/api/src/academy-fee/academy-fee.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: Controller 작성**

```typescript
// apps/api/src/academy-fee/academy-fee.controller.ts
import type { Request, Response, NextFunction } from "express";
import type { AcademyFeeService } from "./academy-fee.service";

export class AcademyFeeController {
  constructor(private service: AcademyFeeService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, teamId, year, month } = req.query;
      res.json(await this.service.getAll({
        status: status as string | undefined,
        teamId: teamId ? Number(teamId) : undefined,
        year: year ? Number(year) : undefined,
        month: month ? Number(month) : undefined,
      }));
    } catch (e) { next(e); }
  };

  getByPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getByPlayer(req.params.playerId));
    } catch (e) { next(e); }
  };

  issueMonthlyFees = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { year, month, amount } = req.body as { year: number; month: number; amount: number };
      await this.service.issueMonthlyFees(year, month, amount);
      res.json({ success: true });
    } catch (e) { next(e); }
  };

  submitPaymentProof = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.submitPaymentProof(Number(req.params.id), req.body));
    } catch (e) { next(e); }
  };

  approvePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.approvePayment(Number(req.params.id)));
    } catch (e) { next(e); }
  };

  getFinanceStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const year = Number(req.query.year ?? now.getFullYear());
      const month = Number(req.query.month ?? now.getMonth() + 1);
      res.json(await this.service.getFinanceStats(year, month));
    } catch (e) { next(e); }
  };
}
```

- [x] **Step 2: Routes 작성** (기존 auth 패턴 참고)

```typescript
// apps/api/src/academy-fee/academy-fee.routes.ts
import { Router } from "express";
import passport from "passport";
import { AcademyFeeController } from "./academy-fee.controller";
import { AcademyFeeService } from "./academy-fee.service";
import { AcademyFeeRepository } from "./academy-fee.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new AcademyFeeRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new AcademyFeeService(repo, notifRepo);
const controller = new AcademyFeeController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getAll);
router.get("/player/:playerId", auth, controller.getByPlayer);
router.post("/issue", auth, controller.issueMonthlyFees);         // ADMIN only
router.patch("/:id/submit-proof", auth, controller.submitPaymentProof);   // GUARDIAN
router.patch("/:id/approve", auth, controller.approvePayment);    // ADMIN/STAFF
router.get("/stats", auth, controller.getFinanceStats);           // GM/ADMIN

export default router;
```

- [x] **Step 3: apiRouter.ts에 등록**

```typescript
import academyFeeRouter from "./academy-fee/academy-fee.routes";
// 기존 라우트 아래:
apiRouter.use("/academy-fees", academyFeeRouter);
```

- [x] **Step 4: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|monthlyAttendance" | head -20
```

- [x] **Step 5: Commit**

```bash
git add apps/api/src/academy-fee/ apps/api/src/apiRouter.ts
git commit -m "feat(youth): AcademyFee controller, routes, API 등록"
```

---

## Task 6: BE — GET /dashboard/academy-finance

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.repo.ts`
- Modify: `apps/api/src/dashboard/dashboard.service.ts`
- Modify: `apps/api/src/dashboard/dashboard.routes.ts`

- [x] **Step 1: dashboard.repo.ts에 getAcademyFinanceStats 추가**

```typescript
async getAcademyFinanceStats(year: number, month: number) {
  const rows = await this.prisma.academyFee.groupBy({
    by: ["status"],
    where: { year, month },
    _count: { id: true },
    _sum: { amount: true },
  });

  const total = rows.reduce((s, r) => s + (r._count.id ?? 0), 0);
  const paid = rows.find(r => r.status === "PAID")?._count.id ?? 0;
  const overdue = rows
    .filter(r => ["OVERDUE", "LOCKED"].includes(r.status as string))
    .reduce((s, r) => s + (r._count.id ?? 0), 0);
  const locked = rows.find(r => r.status === "LOCKED")?._count.id ?? 0;
  const totalRevenue = rows.find(r => r.status === "PAID")?._sum.amount ?? 0;

  return {
    monthlyCollectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
    totalRevenue,
    overdueCount: overdue,
    lockedPlayerCount: locked,
  };
}
```

- [x] **Step 2: dashboard.service.ts에 위임 메서드 추가**

```typescript
getAcademyFinanceStats(year: number, month: number) {
  return this.repo.getAcademyFinanceStats(year, month);
}
```

- [x] **Step 3: dashboard.routes.ts에 엔드포인트 추가** (기존 패턴 따라)

```typescript
router.get("/academy-finance", auth, async (req, res, next) => {
  try {
    const user = req.user as any;
    if (user.role !== "ADMIN" && !(user.role === "FRONT_OFFICE")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const now = new Date();
    const year = Number(req.query.year ?? now.getFullYear());
    const month = Number(req.query.month ?? now.getMonth() + 1);
    res.json(await service.getAcademyFinanceStats(year, month));
  } catch (e) { next(e); }
});
```

- [x] **Step 4: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|monthlyAttendance" | head -10
```

- [x] **Step 5: Commit**

```bash
git add apps/api/src/dashboard/
git commit -m "feat(dashboard): GET /academy-finance KPI 엔드포인트"
```

---

## Task 7: FE — Types + API Service

**Files:**
- Create: `football/src/types/academy-fee.ts`
- Create: `football/src/services/academyFee.service.ts`

- [x] **Step 1: 타입 정의**

```typescript
// football/src/types/academy-fee.ts
export type FeeStatus = 'PENDING' | 'SUBMITTED' | 'PAID' | 'OVERDUE' | 'LOCKED'

export interface AcademyFee {
  id: number
  playerId: string
  player: { id: string; playerName: string; teamId: number | null; status: string }
  guardianId: number
  guardian: { id: number; username: string }
  amount: number
  dueDate: string
  status: FeeStatus
  paidAt: string | null
  paymentProofUrl: string | null
  paymentSubmittedAt: string | null
  year: number
  month: number
  createdAt: string
}

export interface AcademyFinanceStats {
  monthlyCollectionRate: number
  totalRevenue: number
  overdueCount: number
  lockedPlayerCount: number
}
```

- [x] **Step 2: API 서비스**

```typescript
// football/src/services/academyFee.service.ts
import { api } from './api'
import type { AcademyFee, AcademyFinanceStats } from '@/types/academy-fee'

export const academyFeeApi = {
  getAll: (params?: { status?: string; teamId?: number; year?: number; month?: number }) =>
    api.get<AcademyFee[]>('/academy-fees', { params }).then(r => r.data),

  getByPlayer: (playerId: string) =>
    api.get<AcademyFee[]>(`/academy-fees/player/${playerId}`).then(r => r.data),

  submitProof: (id: number, paymentProofUrl: string) =>
    api.patch<AcademyFee>(`/academy-fees/${id}/submit-proof`, { paymentProofUrl }).then(r => r.data),

  approve: (id: number) =>
    api.patch<AcademyFee>(`/academy-fees/${id}/approve`).then(r => r.data),

  issue: (year: number, month: number, amount: number) =>
    api.post('/academy-fees/issue', { year, month, amount }).then(r => r.data),

  getStats: (year?: number, month?: number) =>
    api.get<AcademyFinanceStats>('/academy-fees/stats', { params: { year, month } }).then(r => r.data),
}
```

- [x] **Step 3: Commit**

```bash
git add football/src/types/academy-fee.ts football/src/services/academyFee.service.ts
git commit -m "feat(youth): AcademyFee FE 타입 + API 서비스"
```

---

## Task 8: FE — 학부모 납부 뷰 + 어드민 관리 뷰

**Files:**
- Create: `football/src/pages/youth/GuardianFeeView.tsx`
- Create: `football/src/pages/youth/AcademyFeePage.tsx`
- Modify: `football/src/App.tsx`

- [x] **Step 1: 학부모 납부 뷰 작성**

```typescript
// football/src/pages/youth/GuardianFeeView.tsx
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { academyFeeApi } from '@/services/academyFee.service'
import type { AcademyFee } from '@/types/academy-fee'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '납부 대기', SUBMITTED: '확인 중', PAID: '납부 완료', OVERDUE: '연체', LOCKED: '정지'
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline', SUBMITTED: 'secondary', PAID: 'default', OVERDUE: 'destructive', LOCKED: 'destructive'
}

interface Props { playerId: string }

export function GuardianFeeView({ playerId }: Props) {
  const [fees, setFees] = useState<AcademyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<number | null>(null)

  useEffect(() => {
    academyFeeApi.getByPlayer(playerId).then(setFees).finally(() => setLoading(false))
  }, [playerId])

  const handleSubmitProof = async (feeId: number) => {
    const url = window.prompt('납부 증빙 이미지 URL을 입력하세요 (또는 파일 업로드 기능 연동)')
    if (!url) return
    setSubmitting(feeId)
    try {
      const updated = await academyFeeApi.submitProof(feeId, url)
      setFees(prev => prev.map(f => f.id === feeId ? updated : f))
    } finally { setSubmitting(null) }
  }

  if (loading) return <p className="text-muted-foreground">불러오는 중...</p>

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">아카데미 회비 내역</h2>
      {fees.map(fee => (
        <div key={fee.id} className="border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">{fee.year}년 {fee.month}월</p>
            <p className="text-sm text-muted-foreground">{fee.amount.toLocaleString()}원 · 납부 기한: {new Date(fee.dueDate).toLocaleDateString('ko-KR')}</p>
            {fee.status === 'SUBMITTED' && <p className="text-xs text-blue-500 mt-1">증빙 확인 중입니다</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[fee.status]}>{STATUS_LABEL[fee.status]}</Badge>
            {(fee.status === 'PENDING' || fee.status === 'OVERDUE') && (
              <Button size="sm" onClick={() => handleSubmitProof(fee.id)} disabled={submitting === fee.id}>
                납부 증빙 제출
              </Button>
            )}
          </div>
        </div>
      ))}
      {fees.length === 0 && <p className="text-muted-foreground">청구된 회비가 없습니다.</p>}
    </div>
  )
}
```

- [x] **Step 2: 어드민 관리 뷰 작성**

```typescript
// football/src/pages/youth/AcademyFeePage.tsx
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { academyFeeApi } from '@/services/academyFee.service'
import type { AcademyFee } from '@/types/academy-fee'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', SUBMITTED: '확인 중', PAID: '완료', OVERDUE: '연체', LOCKED: '정지'
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline', SUBMITTED: 'secondary', PAID: 'default', OVERDUE: 'destructive', LOCKED: 'destructive'
}

export default function AcademyFeePage() {
  const [fees, setFees] = useState<AcademyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  const load = () => {
    setLoading(true)
    academyFeeApi.getAll(filter ? { status: filter } : {}).then(setFees).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const handleApprove = async (id: number) => {
    await academyFeeApi.approve(id)
    load()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">아카데미 회비 관리</h1>
        <div className="flex gap-2">
          {['', 'PENDING', 'SUBMITTED', 'OVERDUE', 'LOCKED'].map(s => (
            <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
              {s || '전체'}
            </Button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-muted-foreground">불러오는 중...</p> : (
        <div className="space-y-2">
          {fees.map(fee => (
            <div key={fee.id} className="border rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium">{fee.player.playerName}</p>
                <p className="text-sm text-muted-foreground">
                  {fee.year}년 {fee.month}월 · {fee.amount.toLocaleString()}원 · 기한 {new Date(fee.dueDate).toLocaleDateString('ko-KR')}
                </p>
                {fee.paymentProofUrl && (
                  <a href={fee.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">증빙 확인</a>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[fee.status]}>{STATUS_LABEL[fee.status]}</Badge>
              {fee.status === 'SUBMITTED' && (
                <Button size="sm" onClick={() => handleApprove(fee.id)}>수납 승인</Button>
              )}
            </div>
          ))}
          {fees.length === 0 && <p className="text-muted-foreground">해당하는 회비 내역이 없습니다.</p>}
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 3: App.tsx에 라우트 추가**

```typescript
import AcademyFeePage from './pages/youth/AcademyFeePage'
// Routes 내:
<Route path="/academy-fees" element={<AcademyFeePage />} />
```

- [x] **Step 4: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

- [x] **Step 5: Commit**

```bash
git add football/src/
git commit -m "feat(youth): 아카데미 회비 FE - 학부모 납부 뷰 + 어드민 관리 뷰"
```

---

## Task 9: FE — GM Finance KPI 대시보드 섹션

**Files:**
- Create: `football/src/components/dashboard/AcademyFinanceSection.tsx`
- Modify: `football/src/types/dashboard.ts`
- Modify: `football/src/services/dashboard.service.ts`
- Modify: `football/src/pages/dashboard/dashboardConfig.ts`
- Modify: `football/src/pages/dashboard/DashboardPage.tsx`

- [x] **Step 1: AcademyFinanceSection 컴포넌트**

```typescript
// football/src/components/dashboard/AcademyFinanceSection.tsx
import type { AcademyFinanceStats } from '@/types/academy-fee'

interface Props { data: AcademyFinanceStats }

export function AcademyFinanceSection({ data }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">아카데미 회비 현황</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{data.monthlyCollectionRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">당월 수납률</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold">{data.totalRevenue.toLocaleString()}원</p>
          <p className="text-xs text-muted-foreground mt-1">총 수납액</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className={`text-2xl font-bold ${data.overdueCount > 0 ? 'text-yellow-600' : ''}`}>{data.overdueCount}건</p>
          <p className="text-xs text-muted-foreground mt-1">미납/연체</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className={`text-2xl font-bold ${data.lockedPlayerCount > 0 ? 'text-red-600' : ''}`}>{data.lockedPlayerCount}명</p>
          <p className="text-xs text-muted-foreground mt-1">참가 정지</p>
        </div>
      </div>
    </div>
  )
}
```

- [x] **Step 2: dashboard.ts에 타입 추가**

기존 파일에 추가:
```typescript
export interface AcademyFinanceStats {
  monthlyCollectionRate: number
  totalRevenue: number
  overdueCount: number
  lockedPlayerCount: number
}
```

- [x] **Step 3: dashboard.service.ts에 academyFinance 메서드 추가**

기존 패턴 따라:
```typescript
academyFinance: (year?: number, month?: number): Promise<AcademyFinanceStats> =>
  api.get('/dashboard/academy-finance', { params: { year, month } }).then(r => r.data),
```

- [x] **Step 4: dashboardConfig.ts에 `showAcademyFinance: boolean` 추가**

`DashboardConfig` 인터페이스에 추가 후, GM/ADMIN 블록에 `showAcademyFinance: true`, 나머지 role에 `showAcademyFinance: false` 설정.

- [x] **Step 5: DashboardPage.tsx에 AcademyFinanceSection 추가**

```typescript
import { AcademyFinanceSection } from '@/components/dashboard/AcademyFinanceSection'
import type { AcademyFinanceStats } from '@/types/academy-fee'

const [academyFinance, setAcademyFinance] = useState<AcademyFinanceStats | null>(null)

// useEffect에 추가:
if (config.showAcademyFinance) {
  dashboardApi.academyFinance().then(setAcademyFinance).catch(() => null)
}

// 렌더에 추가:
{config.showAcademyFinance && academyFinance && <AcademyFinanceSection data={academyFinance} />}
```

- [x] **Step 6: TypeScript 최종 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|monthlyAttendance" | head -10
```

- [x] **Step 7: Commit**

```bash
git add football/src/
git commit -m "feat(dashboard): 아카데미 회비 KPI 섹션 (GM/ADMIN 대시보드)"
```
