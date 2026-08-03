# Sponsorship Management Design

**Date:** 2026-08-03  
**Endpoints:** `/api/sponsorships`

---

## Overview

스폰서십(Sponsorship) CRUD API + 납부 일정(SponsorshipPayment) 자동 생성 및 관리. 스폰서십 생성 시 `paymentSchedule`에 따라 납부 레코드를 일괄 자동 생성하며, OVERDUE 상태는 DB에 저장하지 않고 읽기 시 계산한다.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sponsorships` | 목록 (type 필터) |
| POST | `/api/sponsorships` | 생성 + Payment 자동 생성 |
| GET | `/api/sponsorships/:id` | 상세 (payments 포함) |
| PATCH | `/api/sponsorships/:id` | 수정 |
| GET | `/api/sponsorships/:id/payments` | 납부 일정 목록 |
| PATCH | `/api/sponsorships/:id/payments/:paymentId` | 납부 완료 처리 (payment가 해당 sponsorship 소속인지 검증) |

---

## Auto-Generation Logic

`POST /api/sponsorships` 시:

1. `Sponsorship` 레코드 생성
2. `contractStart`부터 `contractEnd`까지 `paymentSchedule` 기준으로 납부일 생성
   - `MONTHLY`: 매월 `contractStart`와 같은 날
   - `QUARTERLY`: 3개월마다
   - `ANNUAL`: 매년 같은 날
3. `amount = totalFee / 납부 횟수` (소수점 차액은 마지막 회차에 반올림 보정)
4. `SponsorshipPayment.createMany`로 일괄 생성 (`status: PENDING`)
5. 응답에 생성된 payments 포함

---

## OVERDUE 계산

DB 저장 없이 읽기 시 계산:

```
status === "PENDING" && dueDate < new Date() → 응답에서 "OVERDUE" 반환
```

`GET /api/sponsorships/:id` 및 `GET /api/sponsorships/:id/payments` 응답에 모두 적용.

---

## Permissions

| 액션 | 허용 역할 |
|------|-----------|
| 생성 / 수정 / 납부 처리 | ADMIN, FRONT_OFFICE(FINANCE_MANAGER) |
| 조회 | 전체 역할 (인증 필요) |

`canWrite`: `role === "ADMIN" || (role === "FRONT_OFFICE" && frontOfficeRole === "FINANCE_MANAGER")`

---

## Module Structure

```
apps/api/src/sponsorship/
├── dto/sponsorship.dto.ts
├── sponsorship.repo.ts
├── sponsorship.service.ts
├── sponsorship.controller.ts
└── sponsorship.routes.ts
```

`apiRouter.ts`에 `/api/sponsorship` 등록.

---

## Key Types

```ts
// dto/sponsorship.dto.ts

interface CreateSponsorshipDto {
  sponsorName: string;
  type: SponsorType;            // TITLE | KIT | STADIUM_NAMING | DIGITAL | OTHER
  totalFee: number;
  contractStart: string;        // ISO date string
  contractEnd: string;
  paymentSchedule: PaymentSchedule; // MONTHLY | QUARTERLY | ANNUAL
  attachedContractId?: number;
}

interface UpdateSponsorshipDto {
  sponsorName?: string;
  type?: SponsorType;
  totalFee?: number;
  contractStart?: string;
  contractEnd?: string;
  paymentSchedule?: PaymentSchedule;
  attachedContractId?: number;
}

interface SponsorshipListQuery {
  type?: SponsorType;
}

interface UpdatePaymentDto {
  status: "PAID";  // 납부 완료만 허용; 서비스에서 paidAt: new Date() 자동 설정
}
```

---

## Error Codes

| 상황 | 상태코드 | 코드 |
|------|----------|------|
| Sponsorship 없음 | 404 | `SPONSORSHIP_NOT_FOUND` |
| Payment 없음 | 404 | `SPONSORSHIP_PAYMENT_NOT_FOUND` |
| 이미 PAID | 409 | `ALREADY_PAID` |
| 권한 없음 | 403 | `FORBIDDEN` |

---

## Out of Scope

- 납부 일정 수동 추가 (생성 시 자동으로만)
- 스폰서십 삭제 (soft delete 없음)
- OVERDUE 알림/알람
