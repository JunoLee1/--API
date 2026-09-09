# Contract.signingBonus 설계

**Goal:** 계약 서명 보너스(signingBonus) 를 생성 시 저장하고, 별도 지급 완료 처리 액션으로 실제 지급일을 기록한다.

**Issues:** #482 (BE), #483 (FE)

**Tech Stack:** Hono + Prisma (BE) / React + TypeScript + shadcn/ui (FE)

---

## 1. DB 스키마

`Contract` 모델에 필드 1개 추가 (`signingBonusPaidAt` 는 기존 유지).

```prisma
model Contract {
  // ... 기존 필드 ...
  signingBonus            BigInt    @default(0)
  signingBonusScheduledAt DateTime?   // 신규: 예정 지급일 (생성 시 입력)
  signingBonusPaidAt      DateTime?   // 기존: 실제 완료일 (지급 완료 처리 시 설정)
}
```

마이그레이션 파일 1개 추가.

### 불변식
- `signingBonusScheduledAt` 이 있으면 반드시 `signingBonus > 0`
- `signingBonusPaidAt` 이 있으면 반드시 `signingBonus > 0`
- `signingBonusPaidAt != null` = 지급 완료 상태

---

## 2. BE API (#482)

### 2-1. `POST /contracts` — 생성 DTO 확장

```typescript
interface CreateContractDto {
  // 기존 필드 유지
  signingBonus?: number           // ≥ 0, optional (기본 0)
  signingBonusScheduledAt?: string  // ISO date. signingBonus > 0 일 때만 유효
}
```

**검증:**
- `signingBonus < 0` → 400
- `signingBonusScheduledAt` 있는데 `signingBonus === 0` → 400

### 2-2. `GET /contracts/:id` — 응답 확장

```typescript
interface ContractDetailResponse {
  // 기존 필드 유지
  signingBonus: number
  signingBonusScheduledAt: string | null
  signingBonusPaidAt: string | null
}
```

### 2-3. `PATCH /contracts/:id/signing-bonus-paid` — 신규

**Body:**
```typescript
interface MarkSigningBonusPaidDto {
  paidAt?: string  // ISO date. 생략 시 오늘(서버 UTC)
}
```

**Guard (순서대로):**
1. 계약 존재 여부 → 404
2. `signingBonus === 0` → 400 `NO_SIGNING_BONUS`
3. `signingBonusPaidAt != null` → 409 `ALREADY_PAID`

**권한:** `ADMIN` | `FRONT_OFFICE(FINANCE_MANAGER, CONTRACT_MANAGER)`

**성공:** `signingBonusPaidAt` 업데이트, 200으로 갱신된 contract 반환.

---

## 3. FE (#483)

### 3-1. 타입 (`football/src/types/contract.ts`)

```typescript
interface ContractDetail {
  // 기존 필드 유지
  signingBonus: number
  signingBonusScheduledAt: string | null  // 신규
  signingBonusPaidAt: string | null
}
```

### 3-2. API 서비스 (`football/src/services/contract.service.ts`)

```typescript
// create() payload: signingBonusPaidAt → signingBonusScheduledAt 로 교체
contractApi.create({
  // ...
  signingBonus?: number
  signingBonusScheduledAt?: string
})

// 신규
contractApi.markSigningBonusPaid(id: number, paidAt?: string): Promise<ContractDetail>
// → PATCH /contracts/:id/signing-bonus-paid
```

### 3-3. `CreateContractDialog` 수정

기존 `signingBonusPaidAt` 입력 필드를 `signingBonusScheduledAt` 로 rename.
- 라벨: "예정 지급일"
- `contractApi.create()` payload 교체

### 3-4. `ContractDetailPage` — 서명 보너스 카드

`signingBonus > 0` 일 때만 렌더.

```
┌─ 서명 보너스 ──────────────────────────────────┐
│ 금액         ₩5,000,000                        │
│ 연분할        ₩2,500,000 / 년                  │
│ 예정 지급일   2026-10-01                        │
│ 지급 상태     ● 미지급         [지급 완료 처리] │
└────────────────────────────────────────────────┘

지급 완료 후:
┌─ 서명 보너스 ──────────────────────────────────┐
│ 금액         ₩5,000,000                        │
│ 연분할        ₩2,500,000 / 년                  │
│ 예정 지급일   2026-10-01                        │
│ 지급 상태     ✓ 완료 · 2026-10-02              │
└────────────────────────────────────────────────┘
```

**[지급 완료 처리] 버튼:**
- 권한: ADMIN | FRONT_OFFICE(FINANCE_MANAGER, CONTRACT_MANAGER)
- 클릭 → 날짜 picker 다이얼로그(기본=오늘) → 확인 → `contractApi.markSigningBonusPaid(id, paidAt)`
- 성공 → toast.success + 카드 갱신

**연분할 계산:** 기존 `computeSigningBonusAnnual(signingBonus, startDate, endDate)` 재사용.

---

## 4. 파일 변경 목록

| 파일 | 변경 |
|---|---|
| `apps/api/prisma/schema.prisma` | `signingBonusScheduledAt DateTime?` 추가 |
| `apps/api/prisma/migrations/…` | 신규 마이그레이션 |
| `apps/api/src/contract/dto/contract.dto.ts` | `CreateContractDto` 확장, `MarkSigningBonusPaidDto` 신설 |
| `apps/api/src/contract/contract.repo.ts` | `create()` 필드 반영, `markSigningBonusPaid()` 추가 |
| `apps/api/src/contract/contract.service.ts` | `create()` 반영, `markSigningBonusPaid()` 추가 |
| `apps/api/src/contract/contract.controller.ts` | `markSigningBonusPaid` 핸들러 추가 |
| `apps/api/src/contract/contract.routes.ts` | `PATCH /:id/signing-bonus-paid` 추가 |
| `football/src/types/contract.ts` | `ContractDetail` 필드 추가 |
| `football/src/services/contract.service.ts` | `create()` payload 교체, `markSigningBonusPaid()` 추가 |
| `football/src/pages/contracts/ContractsPage.tsx` | `CreateContractDialog` 필드 rename |
| `football/src/pages/contracts/ContractDetailPage.tsx` | 서명 보너스 카드 추가 |

---

## 5. 테스트

- BE: `markSigningBonusPaid` guard 3개 단위 테스트 (NO_SIGNING_BONUS / ALREADY_PAID / 성공)
- BE: `create()` signingBonus/signingBonusScheduledAt 저장 검증
- FE: `ContractDetailPage` 서명 보너스 카드 렌더 (미지급/완료 두 상태)
- FE: `CreateContractDialog.signingBonus.test.tsx` — scheduledAt 필드 rename 반영
