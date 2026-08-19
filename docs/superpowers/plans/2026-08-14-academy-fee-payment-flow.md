# Academy Fee Payment Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 학부모가 아카데미 회비를 PG(Toss Payments) 또는 계좌이체 증빙 업로드로 납부하면 재무팀 확인 후 PAID 처리되고 인앱 영수증이 발급된다.

**Architecture:** 두 가지 납부 경로를 병행한다. PG(Toss)는 FE SDK 결제 팝업 → BE confirm API → 자동 PAID; 계좌이체는 학부모가 증빙 파일 업로드 → SUBMITTED → 재무팀이 관리 화면에서 PAID 승인. 재무팀은 외부 채널로 증빙을 받은 경우 관리 화면에서 직접 SUBMITTED 처리 가능. 결제 완료 시 `receiptIssuedAt`을 세팅하고 `GET /academy-fees/:id/receipt`로 인앱 영수증 조회.

**Tech Stack:** Prisma (PostgreSQL), Express, Toss Payments v2 (`@tosspayments/tosspayments-js`), multer (로컬 파일), React + shadcn/ui, react-i18next

---

## File Map

**Backend (apps/api)**
- Modify: `prisma/schema.prisma` — `PaymentMethod` enum 추가 + `AcademyFee` 3개 필드 추가
- Modify: `src/academy-fee/dto/academy-fee.dto.ts` — `TossConfirmDto`, `AdminSubmitDto` 추가
- Modify: `src/academy-fee/academy-fee.repo.ts` — `confirmTossPayment`, `adminSubmitProof`, `getReceipt` 추가
- Modify: `src/academy-fee/academy-fee.service.ts` — `confirmTossPayment`, `tossWebhook`, `adminSubmitProof`, `getReceipt` 추가
- Modify: `src/academy-fee/academy-fee.controller.ts` — 4개 핸들러 추가
- Modify: `src/academy-fee/academy-fee.routes.ts` — multer + 5개 라우트 추가
- Modify: `.env` — `TOSS_SECRET_KEY`, `TOSS_CLIENT_KEY` 추가

**Frontend (football/src)**
- Modify: `types/academy-fee.ts` — `paymentMethod`, `pgTransactionId`, `receiptIssuedAt` 추가
- Modify: `services/academyFee.service.ts` — `uploadProof`, `tossConfirm`, `getReceipt`, `adminSubmit` 추가
- Create: `components/youth/PaymentModal.tsx` — PG / 계좌이체 탭 선택 모달
- Create: `pages/youth/TossCallbackPage.tsx` — Toss 결제 성공 리다이렉트 핸들러
- Modify: `pages/youth/GuardianFeeView.tsx` — `window.prompt` → `PaymentModal`로 교체
- Modify: `pages/youth/AcademyFeePage.tsx` — "수동 접수" 버튼 + 영수증 링크 추가
- Modify: `App.tsx` — `/toss-callback` 라우트 추가

---

## Task 1: Schema 마이그레이션 + FE 타입 업데이트

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `football/src/types/academy-fee.ts`

- [x] **Step 1: `PaymentMethod` enum + `AcademyFee` 3개 필드 추가**

`apps/api/prisma/schema.prisma`에서 `FeeStatus` enum 바로 위에 추가:

```prisma
enum PaymentMethod {
  PG
  BANK_TRANSFER
}
```

그리고 `AcademyFee` 모델에 필드 3개 추가 (기존 `paymentSubmittedAt` 바로 아래):

```prisma
model AcademyFee {
  id                  Int             @id @default(autoincrement())
  playerId            String
  guardianId          Int
  amount              Int
  dueDate             DateTime
  status              FeeStatus       @default(PENDING)
  paidAt              DateTime?
  paymentProofUrl     String?
  paymentSubmittedAt  DateTime?
  paymentMethod       PaymentMethod?
  pgTransactionId     String?
  receiptIssuedAt     DateTime?
  year                Int
  month               Int
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  player   Player @relation(fields: [playerId], references: [id])
  guardian User   @relation("GuardianFees", fields: [guardianId], references: [id])

  @@unique([playerId, year, month])
}
```

- [x] **Step 2: 마이그레이션 실행**

```bash
cd apps/api && npx prisma migrate dev --name add_payment_method_to_academy_fee
```

예상 출력:
```
✔ Generated Prisma Client
Your database is now in sync with your schema.
```

- [x] **Step 3: FE 타입 업데이트**

`football/src/types/academy-fee.ts`에서 `AcademyFee` 인터페이스에 필드 추가:

```typescript
export type FeeStatus = 'PENDING' | 'SUBMITTED' | 'PAID' | 'OVERDUE' | 'LOCKED'
export type PaymentMethod = 'PG' | 'BANK_TRANSFER'

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
  paymentMethod: PaymentMethod | null
  pgTransactionId: string | null
  receiptIssuedAt: string | null
  year: number
  month: number
  createdAt: string
}

export interface AcademyFinanceStats {
  monthlyCollectionRate: number
  totalRevenue: number
  overdueCount: number
  lockedPlayerCount: number
  lockedAmount: number
}

export interface FeeReceipt {
  id: number
  year: number
  month: number
  amount: number
  paidAt: string
  paymentMethod: PaymentMethod
  receiptIssuedAt: string
  playerName: string
  guardianUsername: string
}
```

- [x] **Step 4: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/ football/src/types/academy-fee.ts
git commit -m "feat(academy-fee): add paymentMethod, pgTransactionId, receiptIssuedAt fields"
```

---

## Task 2: BE — 계좌이체 증빙 파일 업로드 엔드포인트

**Files:**
- Modify: `apps/api/src/academy-fee/academy-fee.routes.ts`
- Modify: `apps/api/src/academy-fee/academy-fee.controller.ts`

현재 `submitPaymentProof` 서비스 메서드(`repo.submitPaymentProof(id, url)`)는 그대로 재사용. 라우트만 추가.

- [x] **Step 1: `academy-fee.routes.ts`에 multer 설정 추가**

파일 상단 import 추가:

```typescript
import multer from "multer";
import path from "path";
import fs from "fs";
```

라우터 정의 위에 multer 설정 추가:

```typescript
const proofUploadDir = path.join(process.cwd(), "uploads", "academy-fee-proofs");
if (!fs.existsSync(proofUploadDir)) fs.mkdirSync(proofUploadDir, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf")
      cb(null, true);
    else cb(new Error("이미지 또는 PDF만 업로드할 수 있습니다."));
  },
});
```

- [x] **Step 2: 업로드 라우트 추가**

`academy-fee.routes.ts`의 기존 라우트들 아래에 추가:

```typescript
// 학부모: 계좌이체 증빙 파일 업로드 → SUBMITTED
router.post("/:id/upload-proof", auth, uploadProof.single("file"), async (req, res, next) => {
  try {
    const { role } = req.user!;
    if (role !== "GUARDIAN") return next(new AppError(403, "FORBIDDEN"));
    if (!req.file) return next(new AppError(400, "FILE_REQUIRED"));
    const feeId = Number(req.params.id);
    const fee = await service.getById(feeId);
    if (fee.guardianId !== req.user!.id) return next(new AppError(403, "FORBIDDEN"));
    const url = `/uploads/academy-fee-proofs/${req.file.filename}`;
    const updated = await service.submitPaymentProof(feeId, { paymentProofUrl: url });
    res.json(updated);
  } catch (e) { next(e); }
});
```

- [x] **Step 3: 동작 확인**

서버 실행 후 테스트:
```bash
curl -X POST http://localhost:3001/academy-fees/1/upload-proof \
  -H "Authorization: Bearer <guardian_token>" \
  -F "file=@/path/to/transfer.jpg"
```

예상 응답: fee 객체에 `status: "SUBMITTED"`, `paymentProofUrl: "/uploads/academy-fee-proofs/..."` 포함

- [x] **Step 4: 커밋**

```bash
git add apps/api/src/academy-fee/academy-fee.routes.ts
git commit -m "feat(academy-fee): add multer proof file upload endpoint"
```

---

## Task 3: BE — Toss 결제 확인 엔드포인트

**Files:**
- Modify: `apps/api/.env`
- Modify: `apps/api/src/academy-fee/dto/academy-fee.dto.ts`
- Modify: `apps/api/src/academy-fee/academy-fee.repo.ts`
- Modify: `apps/api/src/academy-fee/academy-fee.service.ts`
- Modify: `apps/api/src/academy-fee/academy-fee.controller.ts`
- Modify: `apps/api/src/academy-fee/academy-fee.routes.ts`

- [x] **Step 1: `.env`에 Toss 키 추가**

`apps/api/.env` 하단에 추가:

```
TOSS_SECRET_KEY=test_sk_...         # Toss 대시보드에서 테스트 시크릿 키
TOSS_CLIENT_KEY=test_ck_...         # Toss 대시보드에서 테스트 클라이언트 키
```

> Toss 테스트 키 발급: https://developers.tosspayments.com — 회원가입 후 대시보드 > 개발자 센터 > 연동 키

- [x] **Step 2: DTO 추가**

`apps/api/src/academy-fee/dto/academy-fee.dto.ts` 전체 교체:

```typescript
export interface CreateAcademyFeeDto {
  playerId: string
  guardianId: number
  amount: number
  dueDate: Date
  year: number
  month: number
}

export interface SubmitPaymentProofDto {
  paymentProofUrl: string
}

export interface FeeListQuery {
  status?: string
  teamId?: number
  year?: number
  month?: number
}

export interface TossConfirmDto {
  paymentKey: string
  orderId: string
  amount: number
}

export interface AdminSubmitDto {
  paymentProofUrl?: string
}
```

- [x] **Step 3: repo에 `confirmTossPayment` 추가**

`apps/api/src/academy-fee/academy-fee.repo.ts`에서 `approvePayment` 메서드 아래에 추가:

```typescript
confirmTossPayment(id: number, pgTransactionId: string) {
  const now = new Date()
  return this.prisma.academyFee.update({
    where: { id },
    data: {
      status: 'PAID' as any,
      paidAt: now,
      paymentMethod: 'PG' as any,
      pgTransactionId,
      receiptIssuedAt: now,
    },
    include: INCLUDE,
  })
}
```

- [x] **Step 4: service에 `confirmTossPayment` 추가**

`apps/api/src/academy-fee/academy-fee.service.ts`에서 `approvePayment` 메서드 아래에 추가:

```typescript
async confirmTossPayment(id: number, dto: TossConfirmDto) {
  const fee = await this.repo.findById(id);
  if (!fee) throw new AppError(404, "FEE_NOT_FOUND");
  if ((fee.status as string) === "PAID") return fee; // 멱등성: 이미 PAID면 그냥 반환

  // Toss API 결제 승인
  const auth = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64");
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentKey: dto.paymentKey,
      orderId: dto.orderId,
      amount: dto.amount,
    }),
  });

  if (!tossRes.ok) {
    const err = await tossRes.json().catch(() => ({}));
    throw new AppError(400, (err as any).code ?? "TOSS_CONFIRM_FAILED");
  }

  // 기간 마감 체크
  const prisma = getPrisma();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 1);
  const lockedEntry = await prisma.ledgerEntry.findFirst({
    where: { periodLocked: true, createdAt: { gte: periodStart, lt: periodEnd } },
    select: { id: true },
  });
  if (lockedEntry) throw new AppError(400, "PERIOD_LOCKED");

  // PAID 전환
  const paid = await this.repo.confirmTossPayment(id, dto.paymentKey);

  // Ledger 생성
  const amount = Number((fee as any).amount ?? 0);
  await prisma.ledgerEntry.create({
    data: {
      type: "INCOME",
      category: "ACADEMY_FEE",
      amount,
      currency: "KRW",
      exchangeRate: 1,
      amountKrw: amount,
      isRefund: false,
      description: formatLedgerDescription("academy_fee", "payment_approved", {
        player: (fee as any).player?.playerName ?? String(fee.playerId),
        period: `${(fee as any).year ?? year}년 ${(fee as any).month ?? month}월`,
      }),
      relatedModule: "AcademyFee",
      relatedId: id,
      createdById: fee.guardianId,
    } as any,
  });

  // guardian 알림
  void this.notifRepo.createForGuardian(
    fee.guardianId,
    "FEE_INVOICE_ISSUED",
    () => ({
      title: "아카데미 회비 납부 완료",
      body: `${(fee as any).player?.playerName} 선수의 ${(fee as any).month}월 회비 결제가 완료됐습니다.`,
    }),
    id,
  ).catch(console.error);

  return paid;
}
```

service 파일 상단 import에 `TossConfirmDto` 추가:

```typescript
import type { FeeListQuery, SubmitPaymentProofDto, TossConfirmDto, AdminSubmitDto } from "./dto/academy-fee.dto";
```

- [x] **Step 5: controller에 `tossConfirm` 핸들러 추가**

`apps/api/src/academy-fee/academy-fee.controller.ts`에 추가:

```typescript
tossConfirm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { paymentKey, orderId, amount } = req.body as import("./dto/academy-fee.dto").TossConfirmDto;
    res.json(await this.service.confirmTossPayment(id, { paymentKey, orderId, amount }));
  } catch (e) { next(e); }
};
```

- [x] **Step 6: 라우트 추가**

`academy-fee.routes.ts`에 추가:

```typescript
// 학부모: Toss 결제 확인
router.post("/:id/toss-confirm", auth, async (req, res, next) => {
  try {
    const { role } = req.user!;
    if (role !== "GUARDIAN") return next(new AppError(403, "FORBIDDEN"));
    const feeId = Number(req.params.id);
    const fee = await service.getById(feeId);
    if (fee.guardianId !== req.user!.id) return next(new AppError(403, "FORBIDDEN"));
    next();
  } catch (e) { next(e); }
}, controller.tossConfirm);
```

- [x] **Step 7: 동작 확인 (Toss 테스트 환경)**

서버 실행 후:
```bash
curl -X POST http://localhost:3001/academy-fees/1/toss-confirm \
  -H "Authorization: Bearer <guardian_token>" \
  -H "Content-Type: application/json" \
  -d '{"paymentKey":"test_paymentKey","orderId":"fee-1-1234567890","amount":100000}'
```

테스트 키 환경에서는 Toss가 승인 응답 반환. fee status가 PAID, receiptIssuedAt이 세팅됨.

- [x] **Step 8: 커밋**

```bash
git add apps/api/src/academy-fee/ apps/api/.env
git commit -m "feat(academy-fee): add Toss payment confirm endpoint with ledger integration"
```

---

## Task 4: BE — Toss Webhook 엔드포인트

**Files:**
- Modify: `apps/api/src/academy-fee/academy-fee.service.ts`
- Modify: `apps/api/src/academy-fee/academy-fee.controller.ts`
- Modify: `apps/api/src/academy-fee/academy-fee.routes.ts`

Toss는 결제 완료 후 서버로 webhook을 보낸다. FE confirm이 성공했더라도 네트워크 단절 등으로 BE가 처리 못한 경우의 보조 안전망.

- [x] **Step 1: service에 `tossWebhook` 추가**

`academy-fee.service.ts`에서 `confirmTossPayment` 아래에 추가:

```typescript
async tossWebhook(body: { status: string; paymentKey: string; orderId: string; totalAmount: number }) {
  // Toss는 DONE 상태일 때만 처리
  if (body.status !== "DONE") return { ok: true };

  // orderId 형식: fee-{id}-{timestamp}
  const parts = body.orderId.split("-");
  const feeId = Number(parts[1]);
  if (isNaN(feeId)) return { ok: true };

  const fee = await this.repo.findById(feeId);
  if (!fee) return { ok: true };
  if ((fee.status as string) === "PAID") return { ok: true }; // 멱등성

  await this.confirmTossPayment(feeId, {
    paymentKey: body.paymentKey,
    orderId: body.orderId,
    amount: body.totalAmount,
  });

  return { ok: true };
}
```

- [x] **Step 2: controller에 `tossWebhook` 핸들러 추가**

```typescript
tossWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await this.service.tossWebhook(req.body);
    res.json(result);
  } catch (e) {
    // webhook은 항상 200 반환해야 Toss가 재시도 안 함
    console.error("Toss webhook error:", e);
    res.json({ ok: false });
  }
};
```

- [x] **Step 3: 라우트 추가 (auth 없음 — Toss 서버가 호출)**

`academy-fee.routes.ts`에서 `router.get("/stats"...` 위에 추가 (파라미터 라우트보다 먼저 선언해야 함):

```typescript
// Toss webhook — auth 없음, Toss 서버가 직접 호출
router.post("/toss-webhook", express.json(), controller.tossWebhook);
```

파일 상단에 `import express from "express";` 추가 (없으면).

- [x] **Step 4: 커밋**

```bash
git add apps/api/src/academy-fee/
git commit -m "feat(academy-fee): add Toss webhook fallback handler"
```

---

## Task 5: BE — 영수증 엔드포인트 + 재무팀 수동 접수

**Files:**
- Modify: `apps/api/src/academy-fee/academy-fee.repo.ts`
- Modify: `apps/api/src/academy-fee/academy-fee.service.ts`
- Modify: `apps/api/src/academy-fee/academy-fee.controller.ts`
- Modify: `apps/api/src/academy-fee/academy-fee.routes.ts`

- [x] **Step 1: repo에 `getReceipt`, `adminSubmitProof` 추가**

```typescript
getReceipt(id: number) {
  return this.prisma.academyFee.findUnique({
    where: { id },
    select: {
      id: true,
      year: true,
      month: true,
      amount: true,
      paidAt: true,
      paymentMethod: true,
      receiptIssuedAt: true,
      player: { select: { playerName: true } },
      guardian: { select: { username: true } },
    },
  });
}

adminSubmitProof(id: number, paymentProofUrl?: string) {
  return this.prisma.academyFee.update({
    where: { id },
    data: {
      status: 'SUBMITTED' as any,
      paymentMethod: 'BANK_TRANSFER' as any,
      paymentSubmittedAt: new Date(),
      ...(paymentProofUrl && { paymentProofUrl }),
    },
    include: INCLUDE,
  });
}
```

- [x] **Step 2: service에 `getReceipt`, `adminSubmitProof` 추가**

```typescript
async getReceipt(id: number, requesterId: number, requesterRole: string, requesterFoRole?: string | null) {
  const fee = await this.repo.findById(id);
  if (!fee) throw new AppError(404, "FEE_NOT_FOUND");
  if ((fee.status as string) !== "PAID") throw new AppError(404, "RECEIPT_NOT_AVAILABLE");

  // GUARDIAN이면 본인 자녀 fee인지 확인
  if (requesterRole === "GUARDIAN" && fee.guardianId !== requesterId) {
    throw new AppError(403, "FORBIDDEN");
  }

  const data = await this.repo.getReceipt(id);
  if (!data || !data.paidAt || !data.receiptIssuedAt) throw new AppError(404, "RECEIPT_NOT_AVAILABLE");

  return {
    id: data.id,
    year: data.year,
    month: data.month,
    amount: data.amount,
    paidAt: data.paidAt,
    paymentMethod: data.paymentMethod,
    receiptIssuedAt: data.receiptIssuedAt,
    playerName: data.player.playerName,
    guardianUsername: data.guardian.username,
  };
}

async adminSubmitProof(id: number, dto: AdminSubmitDto) {
  const fee = await this.repo.findById(id);
  if (!fee) throw new AppError(404, "FEE_NOT_FOUND");
  if (!["PENDING", "OVERDUE"].includes(fee.status as string)) {
    throw new AppError(409, "INVALID_STATUS");
  }
  const updated = await this.repo.adminSubmitProof(id, dto.paymentProofUrl);
  void this.notifRepo.createForGuardian(
    fee.guardianId,
    "FEE_INVOICE_ISSUED",
    () => ({
      title: "회비 증빙이 접수됐습니다",
      body: `${(fee as any).player?.playerName} 선수의 ${(fee as any).month}월 회비 증빙이 재무팀에 접수됐습니다.`,
    }),
    id,
  ).catch(console.error);
  return updated;
}
```

- [x] **Step 3: controller에 `getReceipt`, `adminSubmit` 추가**

```typescript
getReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: requesterId, role, frontOfficeRole } = req.user!;
    res.json(await this.service.getReceipt(Number(req.params.id), requesterId, role, frontOfficeRole));
  } catch (e) { next(e); }
};

adminSubmit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await this.service.adminSubmitProof(Number(req.params.id), req.body));
  } catch (e) { next(e); }
};
```

- [x] **Step 4: 라우트 추가**

```typescript
// 영수증 조회 — Guardian(본인) 또는 재무팀/관리자
router.get("/:id/receipt", auth, async (req, res, next) => {
  const { role, frontOfficeRole } = req.user!;
  const isFinance = canWriteHR(role, frontOfficeRole) || role === "ADMIN" || role === "SUPER_ADMIN";
  if (role !== "GUARDIAN" && !isFinance) return next(new AppError(403, "FORBIDDEN"));
  next();
}, controller.getReceipt);

// 재무팀 수동 접수 (외부 채널로 증빙 받은 경우)
router.patch("/:id/admin-submit", auth, (req, res, next) => {
  const { role, frontOfficeRole } = req.user!;
  if (!canWriteHR(role, frontOfficeRole)) return next(new AppError(403, "FORBIDDEN"));
  next();
}, controller.adminSubmit);
```

- [x] **Step 5: 동작 확인**

```bash
# 영수증 조회 (PAID 상태의 fee)
curl http://localhost:3001/academy-fees/1/receipt \
  -H "Authorization: Bearer <token>"
# 예상: { id, year, month, amount, paidAt, paymentMethod, receiptIssuedAt, playerName, guardianUsername }

# 재무팀 수동 접수
curl -X PATCH http://localhost:3001/academy-fees/2/admin-submit \
  -H "Authorization: Bearer <finance_token>" \
  -H "Content-Type: application/json" \
  -d '{"paymentProofUrl": "/uploads/academy-fee-proofs/manual.jpg"}'
# 예상: fee 객체 status: "SUBMITTED"
```

- [x] **Step 6: 커밋**

```bash
git add apps/api/src/academy-fee/
git commit -m "feat(academy-fee): add receipt endpoint and admin manual submit"
```

---

## Task 6: FE — API 서비스 업데이트 + Toss SDK 설치

**Files:**
- Modify: `football/package.json` (npm install)
- Modify: `football/src/services/academyFee.service.ts`

- [x] **Step 1: Toss SDK 설치**

```bash
cd football && npm install @tosspayments/tosspayments-js
```

- [x] **Step 2: `academyFee.service.ts` 전체 업데이트**

```typescript
import { api } from './api'
import type { AcademyFee, AcademyFinanceStats, FeeReceipt } from '@/types/academy-fee'

export const academyFeeApi = {
  getAll: (params?: { status?: string; teamId?: number; year?: number; month?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.teamId) qs.set('teamId', String(params.teamId))
    if (params?.year) qs.set('year', String(params.year))
    if (params?.month) qs.set('month', String(params.month))
    const q = qs.toString()
    return api.get<AcademyFee[]>(`/academy-fees${q ? `?${q}` : ''}`)
  },
  getByPlayer: (playerId: string) =>
    api.get<AcademyFee[]>(`/academy-fees/player/${playerId}`),
  submitProof: (id: number, paymentProofUrl: string) =>
    api.patch<AcademyFee>(`/academy-fees/${id}/submit-proof`, { paymentProofUrl }),
  approve: (id: number) =>
    api.patch<AcademyFee>(`/academy-fees/${id}/approve`, {}),
  issue: (year: number, month: number, amount: number) =>
    api.post<{ success: boolean }>('/academy-fees/issue', { year, month, amount }),
  getStats: (year?: number, month?: number) => {
    const qs = new URLSearchParams()
    if (year) qs.set('year', String(year))
    if (month) qs.set('month', String(month))
    const q = qs.toString()
    return api.get<AcademyFinanceStats>(`/academy-fees/stats${q ? `?${q}` : ''}`)
  },
  uploadProof: (id: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.postFormData<AcademyFee>(`/academy-fees/${id}/upload-proof`, formData)
  },
  tossConfirm: (id: number, paymentKey: string, orderId: string, amount: number) =>
    api.post<AcademyFee>(`/academy-fees/${id}/toss-confirm`, { paymentKey, orderId, amount }),
  getReceipt: (id: number) =>
    api.get<FeeReceipt>(`/academy-fees/${id}/receipt`),
  adminSubmit: (id: number, paymentProofUrl?: string) =>
    api.patch<AcademyFee>(`/academy-fees/${id}/admin-submit`, { paymentProofUrl }),
}
```

- [x] **Step 3: `api` 래퍼에 `postFormData` 메서드 확인 및 추가**

`football/src/services/api.ts`에 `postFormData`가 없으면 추가:

```typescript
postFormData: <T>(url: string, formData: FormData): Promise<T> =>
  fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  }).then(handleResponse<T>),
```

> `BASE_URL`, `getToken`, `handleResponse`는 기존 `api.ts` 패턴 참고

- [x] **Step 4: 커밋**

```bash
git add football/package.json football/package-lock.json football/src/services/
git commit -m "feat(academy-fee): add uploadProof, tossConfirm, getReceipt API methods"
```

---

## Task 7: FE — PaymentModal 컴포넌트

**Files:**
- Create: `football/src/components/youth/PaymentModal.tsx`

이 컴포넌트는 학부모가 "납부하기" 버튼 클릭 시 나타나는 모달이다. "카드/간편결제" 탭과 "계좌이체" 탭으로 구분된다.

- [x] **Step 1: `PaymentModal.tsx` 생성**

```typescript
import { useState, useRef } from 'react'
import { loadTossPayments } from '@tosspayments/tosspayments-js'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { academyFeeApi } from '@/services/academyFee.service'
import type { AcademyFee } from '@/types/academy-fee'

interface Props {
  fee: AcademyFee
  userId: number
  open: boolean
  onClose: () => void
  onPaid: (updated: AcademyFee) => void
}

const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string

export function PaymentModal({ fee, userId, open, onClose, onPaid }: Props) {
  const [tab, setTab] = useState<'pg' | 'bank'>('pg')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleTossPay = async () => {
    setError(null)
    setLoading(true)
    try {
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
      const payment = tossPayments.payment({ customerKey: String(userId) })
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: fee.amount },
        orderId: `fee-${fee.id}-${Date.now()}`,
        orderName: `${fee.year}년 ${fee.month}월 아카데미 회비`,
        successUrl: `${window.location.origin}/toss-callback`,
        failUrl: `${window.location.origin}/toss-fail`,
      })
      // successUrl로 리다이렉트되면 여기는 실행 안 됨
    } catch (e: any) {
      if (e.code !== 'USER_CANCEL') setError('결제 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleBankUpload = async () => {
    if (!file) { setError('파일을 선택해주세요.'); return }
    setError(null)
    setLoading(true)
    try {
      const updated = await academyFeeApi.uploadProof(fee.id, file)
      onPaid(updated)
      onClose()
    } catch {
      setError('업로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{fee.year}년 {fee.month}월 회비 납부</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">납부금액: <span className="font-semibold text-foreground">{fee.amount.toLocaleString()}원</span></p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'pg' | 'bank')}>
          <TabsList className="w-full">
            <TabsTrigger value="pg" className="flex-1">카드 / 간편결제</TabsTrigger>
            <TabsTrigger value="bank" className="flex-1">계좌이체 증빙</TabsTrigger>
          </TabsList>

          <TabsContent value="pg" className="pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">Toss Payments로 즉시 결제됩니다. 결제 완료 후 자동으로 납부 처리됩니다.</p>
            <Button className="w-full" onClick={handleTossPay} disabled={loading}>
              {loading ? '처리 중...' : '카드 / 간편결제로 납부'}
            </Button>
          </TabsContent>

          <TabsContent value="bank" className="pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">계좌이체 후 이체 확인증(이미지 또는 PDF)을 업로드하세요. 재무팀 확인 후 납부 처리됩니다.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
              {file ? file.name : '파일 선택'}
            </Button>
            <Button className="w-full" onClick={handleBankUpload} disabled={loading || !file}>
              {loading ? '업로드 중...' : '증빙 제출'}
            </Button>
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
```

- [x] **Step 2: `VITE_TOSS_CLIENT_KEY` 환경변수 추가**

`football/.env` (없으면 생성):

```
VITE_TOSS_CLIENT_KEY=test_ck_...
```

- [x] **Step 3: 커밋**

```bash
git add football/src/components/youth/PaymentModal.tsx football/.env
git commit -m "feat(academy-fee): add PaymentModal with PG and bank transfer tabs"
```

---

## Task 8: FE — Toss 콜백 페이지

**Files:**
- Create: `football/src/pages/youth/TossCallbackPage.tsx`
- Modify: `football/src/App.tsx`

Toss 결제 성공 시 `${origin}/toss-callback?paymentKey=X&orderId=fee-{id}-{ts}&amount=Y`로 리다이렉트됨.

- [x] **Step 1: `TossCallbackPage.tsx` 생성**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { academyFeeApi } from '@/services/academyFee.service'

export default function TossCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')
    const amount = Number(searchParams.get('amount'))

    if (!paymentKey || !orderId || isNaN(amount)) {
      setStatus('error')
      setErrorMessage('잘못된 결제 정보입니다.')
      return
    }

    // orderId 형식: fee-{feeId}-{timestamp}
    const parts = orderId.split('-')
    const feeId = Number(parts[1])
    if (isNaN(feeId)) {
      setStatus('error')
      setErrorMessage('결제 정보를 확인할 수 없습니다.')
      return
    }

    academyFeeApi.tossConfirm(feeId, paymentKey, orderId, amount)
      .then(() => {
        setStatus('success')
        setTimeout(() => navigate('/youth/guardian', { replace: true }), 2000)
      })
      .catch((e: any) => {
        setStatus('error')
        setErrorMessage(e?.message ?? '결제 확인 중 오류가 발생했습니다.')
      })
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground">결제를 확인하고 있습니다...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive font-semibold">결제 실패</p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <button
          className="text-primary underline text-sm"
          onClick={() => navigate('/youth/guardian', { replace: true })}
        >
          돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="text-4xl">✓</div>
      <p className="font-semibold">결제가 완료됐습니다!</p>
      <p className="text-sm text-muted-foreground">잠시 후 이동합니다...</p>
    </div>
  )
}
```

- [x] **Step 2: `App.tsx`에 라우트 추가**

`App.tsx`에서 기존 라우트들을 찾아 `/toss-callback` 라우트 추가. 이 페이지는 AppShell 밖에 있어야 한다 (auth 레이아웃 불필요):

```typescript
import TossCallbackPage from '@/pages/youth/TossCallbackPage'

// 기존 <Routes> 안에서 AppShell 라우트와 같은 레벨에 추가:
<Route path="/toss-callback" element={<TossCallbackPage />} />
```

- [x] **Step 3: 커밋**

```bash
git add football/src/pages/youth/TossCallbackPage.tsx football/src/App.tsx
git commit -m "feat(academy-fee): add Toss payment callback page with confirm flow"
```

---

## Task 9: FE — Guardian 뷰 연동 + 관리자 화면 업데이트

**Files:**
- Modify: `football/src/pages/youth/GuardianFeeView.tsx`
- Modify: `football/src/pages/youth/AcademyFeePage.tsx`

- [x] **Step 1: `GuardianFeeView.tsx` 업데이트**

`window.prompt` 방식을 제거하고 `PaymentModal`로 교체:

```typescript
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { guardianApi } from '@/services/guardian.service'
import { academyFeeApi } from '@/services/academyFee.service'
import { PaymentModal } from '@/components/youth/PaymentModal'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { AcademyFee } from '@/types/academy-fee'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline', SUBMITTED: 'secondary', PAID: 'default', OVERDUE: 'destructive', LOCKED: 'destructive'
}

interface Props { playerId: string }

export function GuardianFeeView({ playerId }: Props) {
  const { t } = useTranslation('youth')
  const { user } = useCurrentUser()
  const [fees, setFees] = useState<AcademyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFee, setSelectedFee] = useState<AcademyFee | null>(null)

  useEffect(() => {
    guardianApi.getFees(playerId).then(setFees).finally(() => setLoading(false))
  }, [playerId])

  const handlePaid = (updated: AcademyFee) => {
    setFees(prev => prev.map(f => f.id === updated.id ? updated : f))
  }

  const handleViewReceipt = async (feeId: number) => {
    try {
      const receipt = await academyFeeApi.getReceipt(feeId)
      alert(
        `영수증\n${receipt.year}년 ${receipt.month}월\n` +
        `금액: ${receipt.amount.toLocaleString()}원\n` +
        `결제일: ${new Date(receipt.paidAt).toLocaleDateString('ko-KR')}\n` +
        `결제방법: ${receipt.paymentMethod === 'PG' ? '카드/간편결제' : '계좌이체'}`
      )
    } catch { /* receipt not ready */ }
  }

  if (loading) return <p className="text-muted-foreground">{t('guardianFeeView.loading')}</p>

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{t('guardianFeeView.title')}</h2>
      {fees.map(fee => (
        <div key={fee.id} className="border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">{fee.year}년 {fee.month}월</p>
            <p className="text-sm text-muted-foreground">
              {fee.amount.toLocaleString()}원 · 기한: {new Date(fee.dueDate).toLocaleDateString('ko-KR')}
            </p>
            {fee.status === 'SUBMITTED' && (
              <p className="text-xs text-blue-500 mt-1">{t('guardianFeeView.proofPending')}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[fee.status]}>{t(`guardianFeeView.status.${fee.status}`)}</Badge>
            {(fee.status === 'PENDING' || fee.status === 'OVERDUE') && (
              <Button size="sm" onClick={() => setSelectedFee(fee)}>
                {t('guardianFeeView.submitProof')}
              </Button>
            )}
            {fee.status === 'PAID' && fee.receiptIssuedAt && (
              <Button size="sm" variant="outline" onClick={() => handleViewReceipt(fee.id)}>
                영수증
              </Button>
            )}
          </div>
        </div>
      ))}
      {fees.length === 0 && <p className="text-muted-foreground">{t('guardianFeeView.noData')}</p>}

      {selectedFee && user && (
        <PaymentModal
          fee={selectedFee}
          userId={user.id}
          open={!!selectedFee}
          onClose={() => setSelectedFee(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  )
}
```

- [x] **Step 2: `AcademyFeePage.tsx` 업데이트**

기존 코드에 "수동 접수" 버튼과 영수증 링크 추가:

```typescript
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { academyFeeApi } from '@/services/academyFee.service'
import type { AcademyFee } from '@/types/academy-fee'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline', SUBMITTED: 'secondary', PAID: 'default', OVERDUE: 'destructive', LOCKED: 'destructive'
}

export default function AcademyFeePage() {
  const { t } = useTranslation('youth')
  const [fees, setFees] = useState<AcademyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [submitting, setSubmitting] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    academyFeeApi.getAll(filter ? { status: filter } : {}).then(setFees).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const handleApprove = async (id: number) => {
    await academyFeeApi.approve(id)
    load()
  }

  const handleAdminSubmit = async (id: number) => {
    const url = window.prompt('증빙 URL (없으면 빈칸)')
    setSubmitting(id)
    try {
      await academyFeeApi.adminSubmit(id, url ?? undefined)
      load()
    } finally { setSubmitting(null) }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('feePage.title')}</h1>
        <div className="flex gap-2">
          {['', 'PENDING', 'SUBMITTED', 'OVERDUE', 'LOCKED'].map(s => (
            <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
              {s ? t(`feePage.status.${s}`) : t('feePage.filterAll')}
            </Button>
          ))}
        </div>
      </div>
      {loading ? <p className="text-muted-foreground">{t('feePage.loading')}</p> : (
        <div className="space-y-2">
          {fees.map(fee => (
            <div key={fee.id} className="border rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium">{fee.player.playerName}</p>
                <p className="text-sm text-muted-foreground">
                  {fee.year}년 {fee.month}월 · {fee.amount.toLocaleString()}원 · {t('field.dueDate')} {new Date(fee.dueDate).toLocaleDateString('ko-KR')}
                </p>
                {fee.paymentProofUrl && (
                  <a href={fee.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">
                    {t('feePage.proofLink')}
                  </a>
                )}
                {fee.paymentMethod && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {fee.paymentMethod === 'PG' ? '카드/간편결제' : '계좌이체'}
                  </span>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[fee.status]}>{t(`feePage.status.${fee.status}`)}</Badge>
              {['PENDING', 'OVERDUE'].includes(fee.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdminSubmit(fee.id)}
                  disabled={submitting === fee.id}
                >
                  수동 접수
                </Button>
              )}
              {fee.status === 'SUBMITTED' && (
                <Button size="sm" onClick={() => handleApprove(fee.id)}>
                  {t('feePage.approveButton')}
                </Button>
              )}
              {fee.status === 'PAID' && fee.receiptIssuedAt && (
                <a
                  href={`/academy-fees/${fee.id}/receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 underline whitespace-nowrap"
                >
                  영수증
                </a>
              )}
            </div>
          ))}
          {fees.length === 0 && <p className="text-muted-foreground">{t('feePage.noData')}</p>}
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 3: TypeScript 빌드 확인**

```bash
cd football && npx tsc --noEmit
```

에러 없이 통과해야 함.

- [x] **Step 4: 커밋**

```bash
git add football/src/pages/youth/ football/src/components/youth/
git commit -m "feat(academy-fee): wire up PaymentModal in GuardianFeeView, add admin submit and receipt links in AcademyFeePage"
```

---

## 최종 E2E 확인 체크리스트

로컬 서버(`apps/api` + `football`) 실행 후:

- [x] **계좌이체 플로우**: 학부모 로그인 → 유소년 포털 → 미납 회비의 "납부하기" → "계좌이체" 탭 → 파일 업로드 → SUBMITTED 상태로 변경됨
- [x] **재무팀 승인**: 재무팀 로그인 → 아카데미 회비 페이지 → SUBMITTED 필터 → "승인" → PAID + 영수증 링크 노출
- [x] **재무팀 수동 접수**: PENDING 항목에 "수동 접수" 버튼 클릭 → SUBMITTED 전환
- [x] **PG 플로우**: 학부모 로그인 → "납부하기" → "카드/간편결제" → Toss 팝업 오픈 (테스트 키 환경에서 카드 입력) → `/toss-callback`으로 리다이렉트 → PAID 처리 → `/youth/guardian`으로 이동
- [x] **영수증**: PAID 상태 fee에 "영수증" 버튼 노출, 클릭 시 납부 정보 표시
