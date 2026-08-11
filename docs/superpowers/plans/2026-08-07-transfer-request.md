# TransferRequest 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agency 주도 이적 요청 워크플로우 — DRAFT → PENDING_APPROVAL → APPROVED → CONFIRMED/REJECTED 상태 머신 구현

**Architecture:** Transfer 테이블은 확정 이적만 보관하고, TransferRequest 별도 테이블에서 요청 상태를 관리한다. CONFIRMED 전환 시 단일 트랜잭션으로 Transfer 생성 + 계약 종료 + 선수 Agency 업데이트를 처리한다.

**Tech Stack:** Express, Prisma 7.x, TypeScript, Jest (ts-jest)

---

## 파일 목록

| 파일 | 역할 |
|------|------|
| `apps/api/prisma/schema.prisma` | TransferRequest 모델 + TransferRequestStatus enum 추가 |
| `apps/api/src/transfer-request/dto/transfer-request.dto.ts` | DTO 인터페이스 |
| `apps/api/src/transfer-request/transfer-request.repo.ts` | DB 접근 |
| `apps/api/src/transfer-request/transfer-request.service.ts` | 비즈니스 로직 |
| `apps/api/src/transfer-request/transfer-request.controller.ts` | 라우트 핸들러 |
| `apps/api/src/transfer-request/transfer-request.routes.ts` | Express 라우터 |
| `apps/api/src/apiRouter.ts` | `/transfer-requests` 라우트 등록 |
| `apps/api/__test__/transfer-request/transfer-request.service.test.ts` | 서비스 단위 테스트 |
| `apps/api/__test__/transfer-request/transfer-request.controller.test.ts` | 컨트롤러 단위 테스트 |

---

## Task 1: Schema — TransferRequest 모델 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: schema.prisma에 enum과 모델 추가**

`apps/api/prisma/schema.prisma`에서 기존 `enum RecallStatus` 블록 바로 아래에 추가:

```prisma
enum TransferRequestStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  CONFIRMED
  REJECTED
}
```

`model Recall` 블록 아래에 추가:

```prisma
model TransferRequest {
  id           Int                   @id @default(autoincrement())
  status       TransferRequestStatus @default(DRAFT)
  type         TransferType
  playerId     String
  agencyId     Int
  fromClub     String?
  toClub       String?
  fee          Int?
  startDate    DateTime?
  endDate      DateTime?
  rejectReason String?

  requestedById Int
  reviewedById  Int?
  confirmedById Int?
  rejectedById  Int?

  reviewedAt  DateTime?
  confirmedAt DateTime?
  rejectedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  player      Player  @relation(fields: [playerId], references: [id])
  agency      Agency  @relation(fields: [agencyId], references: [id])
  requestedBy User    @relation("TRRequestedBy", fields: [requestedById], references: [id])
  reviewedBy  User?   @relation("TRReviewedBy", fields: [reviewedById], references: [id])
  confirmedBy User?   @relation("TRConfirmedBy", fields: [confirmedById], references: [id])
  rejectedBy  User?   @relation("TRRejectedBy", fields: [rejectedById], references: [id])
}
```

- [ ] **Step 2: User 모델에 역방향 관계 추가**

`model User` 블록에서 기존 관계 목록 끝에 추가:

```prisma
  transferRequestsRequested  TransferRequest[] @relation("TRRequestedBy")
  transferRequestsReviewed   TransferRequest[] @relation("TRReviewedBy")
  transferRequestsConfirmed  TransferRequest[] @relation("TRConfirmedBy")
  transferRequestsRejected   TransferRequest[] @relation("TRRejectedBy")
```

- [ ] **Step 3: Player 모델에 역방향 관계 추가**

`model Player` 블록 관계 목록 끝에:

```prisma
  transferRequests TransferRequest[]
```

- [ ] **Step 4: Agency 모델에 역방향 관계 추가**

`model Agency` 블록 관계 목록 끝에:

```prisma
  transferRequests TransferRequest[]
```

- [ ] **Step 5: 마이그레이션 실행**

```bash
cd apps/api
npx prisma migrate dev --name add-transfer-request
```

Expected: `Your database is now in sync with your schema.` 출력 후 `prisma/migrations/` 아래 새 폴더 생성.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add TransferRequest model with status machine schema"
```

---

## Task 2: DTO

**Files:**
- Create: `apps/api/src/transfer-request/dto/transfer-request.dto.ts`

- [ ] **Step 1: DTO 파일 생성**

```typescript
import { TransferType, TransferRequestStatus } from "../../generated/enums";

export interface CreateTransferRequestDto {
  playerId: string;
  agencyId: number;
  type: TransferType;
  fromClub?: string;
  toClub?: string;
  fee?: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdateTransferRequestDto {
  type?: TransferType;
  fromClub?: string | null;
  toClub?: string | null;
  fee?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface ReviewTransferRequestDto {
  action: "approve" | "reject";
  rejectReason?: string;
}

export interface ConfirmTransferRequestDto {
  action: "confirm" | "reject";
  rejectReason?: string;
}

export interface ListTransferRequestQuery {
  status?: TransferRequestStatus;
  playerId?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/transfer-request/dto/transfer-request.dto.ts
git commit -m "feat: add TransferRequest DTOs"
```

---

## Task 3: Repository

**Files:**
- Create: `apps/api/src/transfer-request/transfer-request.repo.ts`

- [ ] **Step 1: Repository 생성**

```typescript
import { PrismaClient, Prisma } from "../generated/client";
import { TransferRequestStatus, TransferType } from "../generated/enums";
import { CreateTransferRequestDto, UpdateTransferRequestDto, ListTransferRequestQuery } from "./dto/transfer-request.dto";

const n = <T>(v: T | undefined | null): T | null => v ?? null;

const DETAIL_SELECT = {
  id: true,
  status: true,
  type: true,
  fromClub: true,
  toClub: true,
  fee: true,
  startDate: true,
  endDate: true,
  rejectReason: true,
  createdAt: true,
  reviewedAt: true,
  confirmedAt: true,
  rejectedAt: true,
  player: { select: { id: true, playerName: true, position: true } },
  agency: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, username: true } },
  reviewedBy: { select: { id: true, username: true } },
  confirmedBy: { select: { id: true, username: true } },
  rejectedBy: { select: { id: true, username: true } },
} satisfies Prisma.TransferRequestSelect;

export class TransferRequestRepository {
  constructor(private prisma: PrismaClient) {}

  findById(id: number) {
    return this.prisma.transferRequest.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
  }

  findAll(query: ListTransferRequestQuery) {
    return this.prisma.transferRequest.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.playerId && { playerId: query.playerId }),
      },
      select: DETAIL_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  hasInProgress(playerId: string) {
    return this.prisma.transferRequest.findFirst({
      where: {
        playerId,
        status: { in: [TransferRequestStatus.DRAFT, TransferRequestStatus.PENDING_APPROVAL, TransferRequestStatus.APPROVED] },
      },
      select: { id: true },
    });
  }

  create(dto: CreateTransferRequestDto, requestedById: number) {
    return this.prisma.transferRequest.create({
      data: {
        playerId: dto.playerId,
        agencyId: dto.agencyId,
        type: dto.type,
        fromClub: n(dto.fromClub),
        toClub: n(dto.toClub),
        fee: n(dto.fee),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        requestedById,
      },
      select: DETAIL_SELECT,
    });
  }

  update(id: number, dto: UpdateTransferRequestDto) {
    return this.prisma.transferRequest.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.fromClub !== undefined && { fromClub: dto.fromClub }),
        ...(dto.toClub !== undefined && { toClub: dto.toClub }),
        ...(dto.fee !== undefined && { fee: dto.fee }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
      },
      select: DETAIL_SELECT,
    });
  }

  submit(id: number) {
    return this.prisma.transferRequest.update({
      where: { id },
      data: { status: TransferRequestStatus.PENDING_APPROVAL },
      select: DETAIL_SELECT,
    });
  }

  review(id: number, action: "approve" | "reject", reviewedById: number, rejectReason?: string) {
    const isApprove = action === "approve";
    return this.prisma.transferRequest.update({
      where: { id },
      data: {
        status: isApprove ? TransferRequestStatus.APPROVED : TransferRequestStatus.REJECTED,
        reviewedById,
        reviewedAt: new Date(),
        ...(!isApprove && { rejectedById: reviewedById, rejectedAt: new Date(), rejectReason }),
      },
      select: DETAIL_SELECT,
    });
  }

  async confirm(
    id: number,
    action: "confirm" | "reject",
    confirmedById: number,
    rejectReason?: string,
  ) {
    if (action === "reject") {
      return this.prisma.transferRequest.update({
        where: { id },
        data: {
          status: TransferRequestStatus.REJECTED,
          rejectedById: confirmedById,
          rejectedAt: new Date(),
          rejectReason,
        },
        select: DETAIL_SELECT,
      });
    }

    // CONFIRMED — 트랜잭션으로 Transfer 생성 + 계약 종료 + 선수 Agency 업데이트
    const req = await this.prisma.transferRequest.findUniqueOrThrow({ where: { id } });
    const OUT_TYPES: TransferType[] = [TransferType.PERMANENT_OUT, TransferType.RELEASE, TransferType.FREE];
    const isOut = OUT_TYPES.includes(req.type);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.transferRequest.update({
        where: { id },
        data: {
          status: TransferRequestStatus.CONFIRMED,
          confirmedById,
          confirmedAt: new Date(),
        },
        select: DETAIL_SELECT,
      });

      await tx.transfer.create({
        data: {
          playerId: req.playerId,
          type: req.type,
          date: new Date(),
          startDate: req.startDate,
          endDate: req.endDate,
          fee: req.fee,
          fromClub: req.fromClub,
          toClub: req.toClub,
        },
      });

      if (isOut) {
        await tx.contract.updateMany({
          where: { playerId: req.playerId, status: "ACTIVE" },
          data: { status: "TERMINATED" },
        });
      }

      await tx.player.update({
        where: { id: req.playerId },
        data: { agencyId: isOut ? null : req.agencyId },
      });

      return updated;
    });
  }

  delete(id: number) {
    return this.prisma.transferRequest.delete({ where: { id } });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/transfer-request/transfer-request.repo.ts
git commit -m "feat: add TransferRequestRepository"
```

---

## Task 4: Service 테스트 작성 및 구현

**Files:**
- Create: `apps/api/__test__/transfer-request/transfer-request.service.test.ts`
- Create: `apps/api/src/transfer-request/transfer-request.service.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TransferRequestService } from "../../src/transfer-request/transfer-request.service";
import { TransferRequestStatus } from "../../src/generated/enums";

const mockRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  hasInProgress: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  submit: jest.fn(),
  review: jest.fn(),
  confirm: jest.fn(),
  delete: jest.fn(),
} as any;

const mockNotifRepo = {
  createForStaff: jest.fn(),
  createForGM: jest.fn(),
  createForUser: jest.fn(),
} as any;

const service = new TransferRequestService(mockRepo, mockNotifRepo);

const makeRequest = (overrides = {}) => ({
  id: 1,
  status: TransferRequestStatus.DRAFT,
  playerId: "p1",
  agencyId: 1,
  requestedById: 10,
  type: "PERMANENT_OUT",
  ...overrides,
});

describe("TransferRequestService", () => {
  beforeEach(() => jest.clearAllMocks());

  test("create — 진행 중 요청 있으면 409", async () => {
    mockRepo.hasInProgress.mockResolvedValue({ id: 99 });
    await expect(service.create({ playerId: "p1", agencyId: 1, type: "PERMANENT_OUT" as any }, 10))
      .rejects.toMatchObject({ statusCode: 409, code: "TRANSFER_REQUEST_IN_PROGRESS" });
  });

  test("create — 성공", async () => {
    mockRepo.hasInProgress.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(makeRequest());
    const result = await service.create({ playerId: "p1", agencyId: 1, type: "PERMANENT_OUT" as any }, 10);
    expect(result.id).toBe(1);
    expect(mockRepo.create).toHaveBeenCalledWith({ playerId: "p1", agencyId: 1, type: "PERMANENT_OUT" }, 10);
  });

  test("update — DRAFT가 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL }));
    await expect(service.update(1, {}))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_MODIFY_NON_DRAFT" });
  });

  test("submit — DRAFT가 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.APPROVED }));
    await expect(service.submit(1, 10))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_SUBMIT_NON_DRAFT" });
  });

  test("submit — 본인이 아니면 403", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ requestedById: 99 }));
    await expect(service.submit(1, 10))
      .rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  test("submit — 성공, FRONT_OFFICE 알림 발송", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest());
    mockRepo.submit.mockResolvedValue(makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL }));
    await service.submit(1, 10);
    expect(mockRepo.submit).toHaveBeenCalledWith(1);
    expect(mockNotifRepo.createForStaff).toHaveBeenCalledWith(
      "TRANSFER_REQUEST_SUBMITTED",
      expect.any(Function),
      1,
    );
  });

  test("review — PENDING_APPROVAL이 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.DRAFT }));
    await expect(service.review(1, { action: "approve" }, 20))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_REVIEW_NON_PENDING" });
  });

  test("review reject — rejectReason 없으면 400", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL }));
    await expect(service.review(1, { action: "reject" }, 20))
      .rejects.toMatchObject({ statusCode: 400, code: "REJECT_REASON_REQUIRED" });
  });

  test("review approve — 성공, AGENT 알림 발송", async () => {
    const req = makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL });
    mockRepo.findById.mockResolvedValue(req);
    mockRepo.review.mockResolvedValue(makeRequest({ status: TransferRequestStatus.APPROVED }));
    await service.review(1, { action: "approve" }, 20);
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(10, "TRANSFER_REQUEST_APPROVED", expect.any(Function), 1);
  });

  test("confirmStep — APPROVED가 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL }));
    await expect(service.confirmStep(1, { action: "confirm" }, 30))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_CONFIRM_NON_APPROVED" });
  });

  test("confirmStep reject — rejectReason 없으면 400", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.APPROVED }));
    await expect(service.confirmStep(1, { action: "reject" }, 30))
      .rejects.toMatchObject({ statusCode: 400, code: "REJECT_REASON_REQUIRED" });
  });

  test("confirmStep confirm — 성공, AGENT + GM 알림 발송", async () => {
    const req = makeRequest({ status: TransferRequestStatus.APPROVED });
    mockRepo.findById.mockResolvedValue(req);
    mockRepo.confirm.mockResolvedValue(makeRequest({ status: TransferRequestStatus.CONFIRMED }));
    await service.confirmStep(1, { action: "confirm" }, 30);
    expect(mockNotifRepo.createForUser).toHaveBeenCalledWith(10, "TRANSFER_REQUEST_CONFIRMED", expect.any(Function), 1);
    expect(mockNotifRepo.createForGM).toHaveBeenCalledWith("TRANSFER_REQUEST_CONFIRMED", expect.any(Function), 1);
  });

  test("delete — DRAFT가 아니면 409", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ status: TransferRequestStatus.PENDING_APPROVAL }));
    await expect(service.delete(1, 10))
      .rejects.toMatchObject({ statusCode: 409, code: "CANNOT_DELETE_NON_DRAFT" });
  });

  test("delete — 본인이 아니면 403", async () => {
    mockRepo.findById.mockResolvedValue(makeRequest({ requestedById: 99 }));
    await expect(service.delete(1, 10))
      .rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd apps/api
npx jest __test__/transfer-request/transfer-request.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `Cannot find module '../../src/transfer-request/transfer-request.service'`

- [ ] **Step 3: Service 구현**

```typescript
import { AppError } from "../lib/appError";
import { TransferRequestRepository } from "./transfer-request.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { TransferRequestStatus } from "../generated/enums";
import { CreateTransferRequestDto, UpdateTransferRequestDto, ReviewTransferRequestDto, ConfirmTransferRequestDto, ListTransferRequestQuery } from "./dto/transfer-request.dto";

export class TransferRequestService {
  constructor(
    private repo: TransferRequestRepository,
    private notifRepo: NotificationRepository,
  ) {}

  list(query: ListTransferRequestQuery) {
    return this.repo.findAll(query);
  }

  async getById(id: number) {
    const req = await this.repo.findById(id);
    if (!req) throw new AppError(404, "TRANSFER_REQUEST_NOT_FOUND");
    return req;
  }

  async create(dto: CreateTransferRequestDto, requestedById: number) {
    const inProgress = await this.repo.hasInProgress(dto.playerId);
    if (inProgress) throw new AppError(409, "TRANSFER_REQUEST_IN_PROGRESS");
    return this.repo.create(dto, requestedById);
  }

  async update(id: number, dto: UpdateTransferRequestDto) {
    const req = await this.getById(id);
    if (req.status !== TransferRequestStatus.DRAFT) throw new AppError(409, "CANNOT_MODIFY_NON_DRAFT");
    return this.repo.update(id, dto);
  }

  async submit(id: number, userId: number) {
    const req = await this.getById(id);
    if (req.status !== TransferRequestStatus.DRAFT) throw new AppError(409, "CANNOT_SUBMIT_NON_DRAFT");
    if (req.requestedBy.id !== userId) throw new AppError(403, "FORBIDDEN");
    const result = await this.repo.submit(id);
    await this.notifRepo.createForStaff(
      "TRANSFER_REQUEST_SUBMITTED",
      (lang) => ({
        title: lang === "ko" ? "이적 요청 검토 필요" : "Transfer Request Review Required",
        body: lang === "ko" ? `선수 이적 요청이 접수되었습니다.` : `A transfer request has been submitted.`,
      }),
      id,
    );
    return result;
  }

  async review(id: number, dto: ReviewTransferRequestDto, reviewedById: number) {
    const req = await this.getById(id);
    if (req.status !== TransferRequestStatus.PENDING_APPROVAL) throw new AppError(409, "CANNOT_REVIEW_NON_PENDING");
    if (dto.action === "reject" && !dto.rejectReason?.trim()) throw new AppError(400, "REJECT_REASON_REQUIRED");
    const result = await this.repo.review(id, dto.action, reviewedById, dto.rejectReason);
    const notifType = dto.action === "approve" ? "TRANSFER_REQUEST_APPROVED" : "TRANSFER_REQUEST_REJECTED";
    await this.notifRepo.createForUser(
      req.requestedBy.id,
      notifType,
      (lang) => ({
        title: lang === "ko"
          ? (dto.action === "approve" ? "이적 요청 1차 승인" : "이적 요청 반려")
          : (dto.action === "approve" ? "Transfer Request Approved (1st)" : "Transfer Request Rejected"),
        body: lang === "ko"
          ? (dto.action === "approve" ? "이적 요청이 1차 승인되었습니다." : `이적 요청이 반려되었습니다: ${dto.rejectReason}`)
          : (dto.action === "approve" ? "Your transfer request has been approved." : `Your transfer request was rejected: ${dto.rejectReason}`),
      }),
      id,
    );
    return result;
  }

  async confirmStep(id: number, dto: ConfirmTransferRequestDto, confirmedById: number) {
    const req = await this.getById(id);
    if (req.status !== TransferRequestStatus.APPROVED) throw new AppError(409, "CANNOT_CONFIRM_NON_APPROVED");
    if (dto.action === "reject" && !dto.rejectReason?.trim()) throw new AppError(400, "REJECT_REASON_REQUIRED");
    const result = await this.repo.confirm(id, dto.action, confirmedById, dto.rejectReason);
    if (dto.action === "confirm") {
      await Promise.all([
        this.notifRepo.createForUser(
          req.requestedBy.id,
          "TRANSFER_REQUEST_CONFIRMED",
          (lang) => ({
            title: lang === "ko" ? "이적 최종 확정" : "Transfer Confirmed",
            body: lang === "ko" ? "이적 요청이 최종 확정되었습니다." : "Your transfer request has been confirmed.",
          }),
          id,
        ),
        this.notifRepo.createForGM(
          "TRANSFER_REQUEST_CONFIRMED",
          (lang) => ({
            title: lang === "ko" ? "이적 확정 완료" : "Transfer Confirmed",
            body: lang === "ko" ? "이적 요청이 최종 확정 처리되었습니다." : "A transfer request has been confirmed.",
          }),
          id,
        ),
      ]);
    } else {
      await this.notifRepo.createForUser(
        req.requestedBy.id,
        "TRANSFER_REQUEST_REJECTED",
        (lang) => ({
          title: lang === "ko" ? "이적 요청 최종 반려" : "Transfer Request Rejected",
          body: lang === "ko"
            ? `이적 요청이 최종 반려되었습니다: ${dto.rejectReason}`
            : `Your transfer request was rejected: ${dto.rejectReason}`,
        }),
        id,
      );
    }
    return result;
  }

  async delete(id: number, userId: number) {
    const req = await this.getById(id);
    if (req.status !== TransferRequestStatus.DRAFT) throw new AppError(409, "CANNOT_DELETE_NON_DRAFT");
    if (req.requestedBy.id !== userId) throw new AppError(403, "FORBIDDEN");
    return this.repo.delete(id);
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd apps/api
npx jest __test__/transfer-request/transfer-request.service.test.ts --no-coverage 2>&1 | tail -15
```

Expected: `Tests: 13 passed, 13 total`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/transfer-request/transfer-request.service.ts apps/api/__test__/transfer-request/transfer-request.service.test.ts
git commit -m "feat: add TransferRequestService with status machine logic"
```

---

## Task 5: Controller 테스트 작성 및 구현

**Files:**
- Create: `apps/api/__test__/transfer-request/transfer-request.controller.test.ts`
- Create: `apps/api/src/transfer-request/transfer-request.controller.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TransferRequestController } from "../../src/transfer-request/transfer-request.controller";

const mockService = {
  list: jest.fn().mockResolvedValue([]),
  getById: jest.fn().mockResolvedValue({ id: 1 }),
  create: jest.fn().mockResolvedValue({ id: 1 }),
  update: jest.fn().mockResolvedValue({ id: 1 }),
  submit: jest.fn().mockResolvedValue({ id: 1 }),
  review: jest.fn().mockResolvedValue({ id: 1 }),
  confirmStep: jest.fn().mockResolvedValue({ id: 1 }),
  delete: jest.fn().mockResolvedValue({ id: 1 }),
} as any;

const controller = new TransferRequestController(mockService);

const mockReq = (overrides: any) => ({
  user: { id: 1, role: "AGENT", coachingRole: null, frontOfficeRole: null },
  body: {},
  params: {},
  query: {},
  ...overrides,
}) as any;

const mockRes = () => {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

const next = jest.fn() as any;

describe("TransferRequestController", () => {
  beforeEach(() => jest.clearAllMocks());

  test("create — AGENT → 201", async () => {
    const req = mockReq({ user: { id: 1, role: "AGENT" }, body: { playerId: "p1", agencyId: 1, type: "PERMANENT_OUT" } });
    const res = mockRes();
    await controller.create(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockService.create).toHaveBeenCalled();
  });

  test("create — COACHING_STAFF → 403", async () => {
    const req = mockReq({ user: { id: 2, role: "COACHING_STAFF" }, body: {} });
    const res = mockRes();
    await controller.create(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("update — AGENT → 200", async () => {
    const req = mockReq({ user: { id: 1, role: "AGENT" }, params: { id: "1" }, body: { fee: 500000 } });
    const res = mockRes();
    await controller.update(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("update — GM → 403", async () => {
    const req = mockReq({ user: { id: 2, role: "GM" }, params: { id: "1" }, body: {} });
    const res = mockRes();
    await controller.update(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("submit — AGENT → 200", async () => {
    const req = mockReq({ user: { id: 1, role: "AGENT" }, params: { id: "1" } });
    const res = mockRes();
    await controller.submit(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.submit).toHaveBeenCalledWith(1, 1);
  });

  test("review — FRONT_OFFICE → 200", async () => {
    const req = mockReq({ user: { id: 2, role: "FRONT_OFFICE" }, params: { id: "1" }, body: { action: "approve" } });
    const res = mockRes();
    await controller.review(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.review).toHaveBeenCalledWith(1, { action: "approve" }, 2);
  });

  test("review — AGENT → 403", async () => {
    const req = mockReq({ user: { id: 1, role: "AGENT" }, params: { id: "1" }, body: {} });
    const res = mockRes();
    await controller.review(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("confirm — GM → 200", async () => {
    const req = mockReq({ user: { id: 3, role: "GM" }, params: { id: "1" }, body: { action: "confirm" } });
    const res = mockRes();
    await controller.confirm(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.confirmStep).toHaveBeenCalledWith(1, { action: "confirm" }, 3);
  });

  test("confirm — ADMIN → 200", async () => {
    const req = mockReq({ user: { id: 4, role: "ADMIN" }, params: { id: "1" }, body: { action: "confirm" } });
    const res = mockRes();
    await controller.confirm(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("confirm — FRONT_OFFICE → 403", async () => {
    const req = mockReq({ user: { id: 5, role: "FRONT_OFFICE" }, params: { id: "1" }, body: {} });
    const res = mockRes();
    await controller.confirm(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("delete — AGENT → 200", async () => {
    const req = mockReq({ user: { id: 1, role: "AGENT" }, params: { id: "1" } });
    const res = mockRes();
    await controller.remove(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.delete).toHaveBeenCalledWith(1, 1);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd apps/api
npx jest __test__/transfer-request/transfer-request.controller.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../src/transfer-request/transfer-request.controller'`

- [ ] **Step 3: Controller 구현**

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { TransferRequestService } from "./transfer-request.service";

export class TransferRequestController {
  constructor(private service: TransferRequestService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.list(req.query as any));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (role !== "AGENT") throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (role !== "AGENT") throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (role !== "AGENT") throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.submit(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };

  review = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (role !== "FRONT_OFFICE") throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.review(Number(req.params["id"]), req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  confirm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (!isAdminLike(role)) throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.confirmStep(Number(req.params["id"]), req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.user!;
      if (role !== "AGENT") throw new AppError(403, "FORBIDDEN");
      res.status(200).json(await this.service.delete(Number(req.params["id"]), req.user!.id));
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd apps/api
npx jest __test__/transfer-request/transfer-request.controller.test.ts --no-coverage 2>&1 | tail -15
```

Expected: `Tests: 11 passed, 11 total`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/transfer-request/transfer-request.controller.ts apps/api/__test__/transfer-request/transfer-request.controller.test.ts
git commit -m "feat: add TransferRequestController with role guards"
```

---

## Task 6: Routes + apiRouter 등록

**Files:**
- Create: `apps/api/src/transfer-request/transfer-request.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: Routes 파일 생성**

```typescript
import { Router } from "express";
import { TransferRequestController } from "./transfer-request.controller";
import { TransferRequestService } from "./transfer-request.service";
import { TransferRequestRepository } from "./transfer-request.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new TransferRequestRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new TransferRequestService(repo, notifRepo);
const controller = new TransferRequestController(service);

router.get("/", auth, controller.list);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id", auth, controller.update);
router.patch("/:id/submit", auth, controller.submit);
router.patch("/:id/review", auth, controller.review);
router.patch("/:id/confirm", auth, controller.confirm);
router.delete("/:id", auth, controller.remove);

export default router;
```

- [ ] **Step 2: apiRouter.ts에 라우트 등록**

`apps/api/src/apiRouter.ts`에서 `agencyRouter` import 바로 아래에 추가:

```typescript
import transferRequestRouter from "./transfer-request/transfer-request.routes";
```

그리고 `apiRouter.use("/agencies", agencyRouter);` 바로 아래에:

```typescript
apiRouter.use("/transfer-requests", transferRequestRouter);
```

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
cd apps/api
npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음 (출력 없음)

- [ ] **Step 4: 전체 테스트 실행**

```bash
cd apps/api
npx jest --no-coverage 2>&1 | tail -20
```

Expected: 기존 테스트 포함 모두 통과, 새 테스트 24개 추가.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/transfer-request/transfer-request.routes.ts apps/api/src/apiRouter.ts
git commit -m "feat: register /transfer-requests route — TransferRequest workflow complete"
```
