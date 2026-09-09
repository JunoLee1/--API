# Contract.signingBonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 계약 생성 시 서명 보너스 예정 지급일을 저장하고, 상세 페이지에서 실제 지급 완료를 기록하는 `PATCH /contracts/:id/signing-bonus-paid` 엔드포인트를 추가한다.

**Architecture:** DB에 `signingBonusScheduledAt` 필드 추가(마이그레이션 1개), BE create DTO·repo·service·controller·route 확장, FE 타입·서비스·CreateContractDialog 필드 rename·ContractDetailPage에 서명 보너스 카드 추가.

**Tech Stack:** Express + Prisma (BE) / React 18 + TypeScript + shadcn/ui + react-i18next (FE) / Vitest + Testing Library (FE 테스트)

---

## 파일 변경 목록

| 파일 | 변경 |
|---|---|
| `apps/api/prisma/schema.prisma` | `Contract` 모델에 `signingBonusScheduledAt DateTime?` 추가 |
| `apps/api/prisma/migrations/…` | 신규 마이그레이션 |
| `apps/api/src/contract/dto/contract.dto.ts` | `CreateContractDto` 확장 + `MarkSigningBonusPaidDto` 신설 |
| `apps/api/src/contract/contract.repo.ts` | `CONTRACT_DETAIL` select 확장 + `create()` 반영 + `markSigningBonusPaid()` 추가 |
| `apps/api/src/contract/contract.service.ts` | `createContract()` 검증 추가 + `markSigningBonusPaid()` 추가 |
| `apps/api/src/contract/contract.controller.ts` | `markSigningBonusPaid` 핸들러 추가 |
| `apps/api/src/contract/contract.routes.ts` | `PATCH /:id/signing-bonus-paid` 추가 |
| `football/src/types/contract.ts` | `ContractDetail` 에 signingBonus 3개 필드 추가 |
| `football/src/services/contract.service.ts` | `create()` payload rename + `markSigningBonusPaid()` 추가 |
| `football/src/pages/contracts/ContractsPage.tsx` | `signingBonusPaidAt` → `signingBonusScheduledAt` rename |
| `football/src/locales/ko/contract.json` | 키 rename + 상세 카드 키 추가 |
| `football/src/locales/en/contract.json` | 동일 |
| `football/src/pages/contracts/ContractDetailPage.tsx` | 서명 보너스 카드 + 지급 완료 다이얼로그 추가 |
| `football/src/pages/contracts/__tests__/CreateContractDialog.signingBonus.test.tsx` | 필드 rename 반영 |

---

## Task 1: DB 스키마 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration (자동 생성)

- [ ] **Step 1: schema.prisma 수정**

`apps/api/prisma/schema.prisma` 의 `Contract` 모델에서 `signingBonusPaidAt` 줄 **바로 위**에 아래 줄을 추가:

```prisma
  signingBonusScheduledAt DateTime?
```

결과 (해당 모델 섹션):
```prisma
  signingBonus            BigInt    @default(0)
  signingBonusScheduledAt DateTime?
  signingBonusPaidAt      DateTime?
```

- [ ] **Step 2: 마이그레이션 실행**

```bash
cd /Users/juno/work/football/apps/api && npx prisma migrate dev --name add_signing_bonus_scheduled_at
```

Expected: `Your database is now in sync with your schema.` 출력. 새 마이그레이션 파일이 `prisma/migrations/` 에 생성됨.

- [ ] **Step 3: TypeScript 재생성 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음 (또는 기존 오류와 동일).

- [ ] **Step 4: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(db): Contract 모델에 signingBonusScheduledAt 필드 추가"
```

---

## Task 2: BE DTO + Repo 확장

**Files:**
- Modify: `apps/api/src/contract/dto/contract.dto.ts`
- Modify: `apps/api/src/contract/contract.repo.ts`

- [ ] **Step 1: DTO 수정**

`apps/api/src/contract/dto/contract.dto.ts` 전체를 아래로 교체:

```typescript
import { ContractStatus, BonusMetric, BonusPeriod, CompetitionType } from "../../generated/enums";

export interface CreateContractDto {
  playerId: string;
  startDate: string;
  endDate: string;
  salary: number;
  managedById?: number;
  agencyId?: number;
  agencyCommission?: number;
  signingBonus?: number;          // ≥ 0
  signingBonusScheduledAt?: string; // ISO date; signingBonus > 0 일 때만 유효
}

export interface MarkSigningBonusPaidDto {
  paidAt?: string; // ISO date; 생략 시 서비스에서 new Date() 사용
}

export interface UpdateContractStatusDto {
  status: ContractStatus;
}

export interface CreateBuyoutDto {
  amount: number;
  validUntil?: string;
}

export interface CreateExtensionDto {
  condition: string;
  durationMonths: number;
  conditionText?: string;
  minAppearances?: number;
}

export interface BonusTriggerDto {
  metric: BonusMetric;
  threshold: number;
  period: BonusPeriod;
  competitionType?: CompetitionType;
}

export interface CreateBonusDto {
  amount: number;
  description: string;
  triggers: BonusTriggerDto[];
}
```

- [ ] **Step 2: Repo의 CONTRACT_DETAIL select 확장**

`apps/api/src/contract/contract.repo.ts` 에서 `CONTRACT_DETAIL` 상수를 아래로 교체:

```typescript
const CONTRACT_DETAIL = {
  id: true,
  startDate: true,
  endDate: true,
  salary: true,
  status: true,
  playerId: true,
  managedById: true,
  agencyId: true,
  agencyCommission: true,
  signingBonus: true,
  signingBonusScheduledAt: true,
  signingBonusPaidAt: true,
  buyoutClause: true,
  extensionOptions: true,
  performanceBonuses: {
    include: { triggers: true },
  },
} as const;
```

- [ ] **Step 3: Repo create() 에 새 필드 반영**

`contract.repo.ts` 의 `create()` 메서드를 아래로 교체:

```typescript
create(dto: CreateContractDto) {
  return this.prisma.contract.create({
    data: {
      playerId: dto.playerId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      salary: dto.salary,
      ...(dto.signingBonus && dto.signingBonus > 0 && { signingBonus: BigInt(dto.signingBonus) }),
      ...(dto.signingBonusScheduledAt && { signingBonusScheduledAt: new Date(dto.signingBonusScheduledAt) }),
      ...(dto.managedById && { managedById: dto.managedById }),
      ...(dto.agencyId && { agencyId: dto.agencyId }),
      ...(dto.agencyCommission !== undefined && { agencyCommission: dto.agencyCommission }),
    },
    select: CONTRACT_DETAIL,
  });
}
```

- [ ] **Step 4: Repo markSigningBonusPaid() 추가**

`contract.repo.ts` 의 `terminateActiveContracts()` 메서드 **바로 위**에 추가:

```typescript
markSigningBonusPaid(id: number, paidAt: Date) {
  return this.prisma.contract.update({
    where: { id },
    data: { signingBonusPaidAt: paidAt },
    select: CONTRACT_DETAIL,
  });
}
```

- [ ] **Step 5: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep "contract" | head -20
```

Expected: 오류 없음.

- [ ] **Step 6: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/src/contract/dto/contract.dto.ts apps/api/src/contract/contract.repo.ts
git commit -m "feat(contract): DTO·Repo에 signingBonus 필드 + markSigningBonusPaid 추가"
```

---

## Task 3: BE Service + Controller + Route

**Files:**
- Modify: `apps/api/src/contract/contract.service.ts`
- Modify: `apps/api/src/contract/contract.controller.ts`
- Modify: `apps/api/src/contract/contract.routes.ts`

- [ ] **Step 1: service.ts import 추가**

`contract.service.ts` 상단 import 구역에서 `MarkSigningBonusPaidDto` 를 추가:

```typescript
import {
  CreateContractDto,
  MarkSigningBonusPaidDto,
  UpdateContractStatusDto,
  CreateBuyoutDto,
  CreateExtensionDto,
  CreateBonusDto,
} from "./dto/contract.dto";
```

- [ ] **Step 2: createContract() 에 signingBonus 검증 추가**

`contract.service.ts` 의 `createContract()` 에서 `if (dto.salary <= 0)` 블록 **바로 뒤** (플레이어 조회 전)에 추가:

```typescript
if (dto.signingBonus !== undefined && dto.signingBonus < 0) {
  throw new AppError(400, "INVALID_SIGNING_BONUS");
}
if (dto.signingBonusScheduledAt && (!dto.signingBonus || dto.signingBonus === 0)) {
  throw new AppError(400, "SIGNING_BONUS_SCHEDULED_WITHOUT_AMOUNT");
}
```

- [ ] **Step 3: markSigningBonusPaid() 추가**

`contract.service.ts` 에서 `addBonus()` 메서드 **바로 뒤**에 추가:

```typescript
async markSigningBonusPaid(id: number, dto: MarkSigningBonusPaidDto, actorId: number) {
  const contract = await this.repo.findById(id);
  if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
  if (!contract.signingBonus || Number(contract.signingBonus) === 0) {
    throw new AppError(400, "NO_SIGNING_BONUS");
  }
  if (contract.signingBonusPaidAt) {
    throw new AppError(409, "ALREADY_PAID");
  }
  const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
  const updated = await this.repo.markSigningBonusPaid(id, paidAt);
  await writeAuditLog({
    actorId,
    action: "CONTRACT_SIGNING_BONUS_PAID",
    targetId: id,
    detail: { paidAt: paidAt.toISOString() },
  });
  return updated;
}
```

- [ ] **Step 4: controller에 markSigningBonusPaid 핸들러 추가**

`contract.controller.ts` 에서 `addBonus` 핸들러 **바로 뒤**에 추가:

```typescript
markSigningBonusPaid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const { role } = user;
    const foRole = (user as { frontOfficeRole?: string | null }).frontOfficeRole ?? null;
    const canMark =
      isAdminLike(role) ||
      (role === "FRONT_OFFICE" &&
        (foRole === "FINANCE_MANAGER" || foRole === "CONTRACT_MANAGER"));
    if (!canMark) throw new AppError(403, "FORBIDDEN");
    res.status(200).json(
      await this.service.markSigningBonusPaid(Number(req.params["id"]), req.body, user.id)
    );
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 5: route 추가**

`contract.routes.ts` 에서 `router.patch("/:id/status", ...)` 줄 **바로 뒤**에 추가:

```typescript
// 서명 보너스 지급 완료 처리 (ADMIN, FRONT_OFFICE(FINANCE_MANAGER, CONTRACT_MANAGER))
router.patch("/:id/signing-bonus-paid", auth, controller.markSigningBonusPaid);
```

- [ ] **Step 6: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음.

- [ ] **Step 7: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/src/contract/contract.service.ts apps/api/src/contract/contract.controller.ts apps/api/src/contract/contract.routes.ts
git commit -m "feat(contract): PATCH /contracts/:id/signing-bonus-paid 엔드포인트 추가"
```

---

## Task 4: FE 타입 + 서비스

**Files:**
- Modify: `football/src/types/contract.ts`
- Modify: `football/src/services/contract.service.ts`

- [ ] **Step 1: ContractDetail 타입에 signingBonus 필드 추가**

`football/src/types/contract.ts` 의 `ContractDetail` 인터페이스를 아래로 교체:

```typescript
export interface ContractDetail extends ContractSummary {
  playerId: string
  signingBonus: number
  signingBonusScheduledAt: string | null
  signingBonusPaidAt: string | null
  buyoutClause: { id: number; amount: number } | null
  extensionOptions: Array<{ id: number; condition: string; durationMonths: number }>
  performanceBonuses: PerformanceBonus[]
}
```

- [ ] **Step 2: contractApi.create() payload 교체**

`football/src/services/contract.service.ts` 의 `create` 함수를 아래로 교체:

```typescript
create: (payload: {
  playerId: string
  startDate: string
  endDate: string
  salary: number
  managedById?: number
  signingBonus?: number
  signingBonusScheduledAt?: string
}) => api.post<ContractCreateResult>('/contracts', payload),
```

- [ ] **Step 3: markSigningBonusPaid 추가**

`football/src/services/contract.service.ts` 의 `addBonus` 줄 **바로 뒤**에 추가:

```typescript
markSigningBonusPaid: (id: number, paidAt?: string) =>
  api.patch<ContractDetail>(`/contracts/${id}/signing-bonus-paid`, paidAt ? { paidAt } : {}),
```

- [ ] **Step 4: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "contract" | head -20
```

Expected: 오류 없음.

- [ ] **Step 5: 커밋**

```bash
cd /Users/juno/work/football && git add football/src/types/contract.ts football/src/services/contract.service.ts
git commit -m "feat(fe): ContractDetail 타입 + markSigningBonusPaid API 추가"
```

---

## Task 5: FE CreateContractDialog rename + i18n

**Files:**
- Modify: `football/src/pages/contracts/ContractsPage.tsx`
- Modify: `football/src/locales/ko/contract.json`
- Modify: `football/src/locales/en/contract.json`
- Modify: `football/src/pages/contracts/__tests__/CreateContractDialog.signingBonus.test.tsx`

- [ ] **Step 1: ContractsPage.tsx — state + payload rename**

`football/src/pages/contracts/ContractsPage.tsx` 에서 아래 3곳을 수정:

**(a) state 선언** — 기존:
```typescript
const [signingBonusPaidAt, setSigningBonusPaidAt] = useState('')
```
교체:
```typescript
const [signingBonusScheduledAt, setSigningBonusScheduledAt] = useState('')
```

**(b) contractApi.create() 호출** — 기존:
```typescript
signingBonusPaidAt: signingBonusPaidAt || undefined,
```
교체:
```typescript
signingBonusScheduledAt: signingBonusScheduledAt || undefined,
```

**(c) JSX input** — 기존:
```tsx
<Label>{t('contracts.createDialog.signingBonusPaidAt')}</Label>
<Input
  type="date"
  value={signingBonusPaidAt}
  onChange={(e) => setSigningBonusPaidAt(e.target.value)}
/>
```
교체:
```tsx
<Label>{t('contracts.createDialog.signingBonusScheduledAt')}</Label>
<Input
  type="date"
  value={signingBonusScheduledAt}
  onChange={(e) => setSigningBonusScheduledAt(e.target.value)}
/>
```

- [ ] **Step 2: ko/contract.json — 키 rename + 상세 카드 키 추가**

`football/src/locales/ko/contract.json` 에서:

`"signingBonusPaidAt": "계약금 지급일 (선택)"` → 삭제
아래 키 추가 (createDialog 오브젝트 내 `signingBonusPreview` 뒤):
```json
"signingBonusScheduledAt": "예정 지급일 (선택)"
```

파일 내 `contractDetail` 오브젝트 안에 아래 키들 추가 (기존 키들 뒤에):
```json
"signingBonus": "서명 보너스",
"signingBonusAmount": "금액",
"signingBonusAnnual": "연분할",
"signingBonusScheduled": "예정 지급일",
"signingBonusStatus": "지급 상태",
"signingBonusUnpaid": "미지급",
"signingBonusPaid": "완료",
"signingBonusMarkPaid": "지급 완료 처리",
"signingBonusMarkPaidTitle": "지급 완료 처리",
"signingBonusMarkPaidDesc": "실제 지급일을 입력하세요.",
"signingBonusPaidAt": "지급일",
"signingBonusMarkPaidConfirm": "완료 처리",
"signingBonusMarkPaidSuccess": "서명 보너스 지급 완료 처리됐습니다"
```

- [ ] **Step 3: en/contract.json — 동일 수정**

`football/src/locales/en/contract.json` 에서:

`"signingBonusPaidAt": "Signing Bonus Pay Date (optional)"` → 삭제
추가:
```json
"signingBonusScheduledAt": "Scheduled Payment Date (optional)"
```

`contractDetail` 오브젝트 안에 추가:
```json
"signingBonus": "Signing Bonus",
"signingBonusAmount": "Amount",
"signingBonusAnnual": "Annual amortized",
"signingBonusScheduled": "Scheduled payment",
"signingBonusStatus": "Payment status",
"signingBonusUnpaid": "Unpaid",
"signingBonusPaid": "Paid",
"signingBonusMarkPaid": "Mark as Paid",
"signingBonusMarkPaidTitle": "Mark Signing Bonus as Paid",
"signingBonusMarkPaidDesc": "Enter the actual payment date.",
"signingBonusPaidAt": "Payment date",
"signingBonusMarkPaidConfirm": "Confirm",
"signingBonusMarkPaidSuccess": "Signing bonus payment recorded."
```

- [ ] **Step 4: 기존 테스트 파일 업데이트 (영향 없음 확인)**

`football/src/pages/contracts/__tests__/CreateContractDialog.signingBonus.test.tsx` 는 `signingBonusPaidAt` 를 참조하지 않으므로 변경 불필요. 확인 후 통과.

```bash
cd /Users/juno/work/football/football && npx vitest run src/pages/contracts/__tests__/CreateContractDialog.signingBonus.test.tsx 2>&1 | tail -10
```

Expected: 3 tests passed.

- [ ] **Step 5: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음.

- [ ] **Step 6: 커밋**

```bash
cd /Users/juno/work/football && git add football/src/pages/contracts/ContractsPage.tsx \
  football/src/locales/ko/contract.json football/src/locales/en/contract.json
git commit -m "feat(fe): CreateContractDialog signingBonusScheduledAt rename + i18n 키 추가"
```

---

## Task 6: FE ContractDetailPage — 서명 보너스 카드

**Files:**
- Modify: `football/src/pages/contracts/ContractDetailPage.tsx`
- Create: `football/src/pages/contracts/__tests__/ContractDetailPage.signingBonus.test.tsx`

- [ ] **Step 1: 테스트 먼저 작성**

`football/src/pages/contracts/__tests__/ContractDetailPage.signingBonus.test.tsx` 파일 생성:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/contract.service', () => ({
  contractApi: {
    get: vi.fn(),
    markSigningBonusPaid: vi.fn().mockResolvedValue({}),
  },
}))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { role: 'ADMIN', frontOfficeRole: null } }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { contractApi } from '@/services/contract.service'
import { ContractDetailPage } from '../ContractDetailPage'
import type { ContractDetail } from '@/types/contract'

function makeContract(overrides: Partial<ContractDetail> = {}): ContractDetail {
  return {
    id: 1,
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
    salary: 50_000_000,
    status: 'ACTIVE',
    managedById: null,
    playerId: 'p1',
    signingBonus: 10_000_000,
    signingBonusScheduledAt: '2024-02-01T00:00:00.000Z',
    signingBonusPaidAt: null,
    buyoutClause: null,
    extensionOptions: [],
    performanceBonuses: [],
    ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter initialEntries={['/contracts/1']}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/contracts/:id" element={children} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(contractApi.get).mockResolvedValue(makeContract())
})

describe('ContractDetailPage — signing bonus card', () => {
  it('서명 보너스 카드가 signingBonus > 0 일 때 렌더된다', async () => {
    render(<ContractDetailPage />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('signing-bonus-card')).toBeTruthy())
  })

  it('signingBonus === 0 이면 카드가 렌더되지 않는다', async () => {
    vi.mocked(contractApi.get).mockResolvedValue(makeContract({ signingBonus: 0 }))
    render(<ContractDetailPage />, { wrapper })
    await waitFor(() => expect(screen.queryByTestId('signing-bonus-card')).toBeNull())
  })

  it('미지급 상태에서 [지급 완료 처리] 버튼이 보인다', async () => {
    render(<ContractDetailPage />, { wrapper })
    await waitFor(() =>
      expect(screen.getByTestId('mark-paid-btn')).toBeTruthy()
    )
  })

  it('지급 완료 후 버튼이 사라지고 완료 날짜가 표시된다', async () => {
    vi.mocked(contractApi.get).mockResolvedValue(
      makeContract({ signingBonusPaidAt: '2024-02-01T00:00:00.000Z' })
    )
    render(<ContractDetailPage />, { wrapper })
    await waitFor(() => expect(screen.queryByTestId('mark-paid-btn')).toBeNull())
    expect(screen.getByTestId('paid-date')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd /Users/juno/work/football/football && npx vitest run src/pages/contracts/__tests__/ContractDetailPage.signingBonus.test.tsx 2>&1 | tail -15
```

Expected: 4 tests FAIL (ContractDetailPage에 카드 없음).

- [ ] **Step 3: ContractDetailPage.tsx에 서명 보너스 카드 추가**

`football/src/pages/contracts/ContractDetailPage.tsx` 에서:

**(a) import 추가** — 파일 상단 import 구역에 추가:
```typescript
import { computeSigningBonusAnnual } from './lib/signing-bonus'
import { CheckCircle2 } from 'lucide-react'
```

**(b) state 추가** — `ContractDetailPage` 함수 내 기존 state 선언들 뒤에 추가:
```typescript
const [markPaidOpen, setMarkPaidOpen] = useState(false)
const [markPaidDate, setMarkPaidDate] = useState('')
const [markingPaid, setMarkingPaid] = useState(false)
```

**(c) 권한 변수 추가** — `canWrite` 선언 뒤에 추가:
```typescript
const canMarkPaid =
  user?.role === 'ADMIN' ||
  user?.role === 'SUPER_ADMIN' ||
  user?.role === 'GM' ||
  (user?.role === 'FRONT_OFFICE' &&
    (user?.frontOfficeRole === 'FINANCE_MANAGER' || user?.frontOfficeRole === 'CONTRACT_MANAGER'))
```

**(d) handleMarkPaid 핸들러 추가** — `handleAddBuyout` 함수 **바로 뒤**에 추가:
```typescript
const handleMarkPaid = async () => {
  if (!contract) return
  setMarkingPaid(true)
  try {
    await contractApi.markSigningBonusPaid(contract.id, markPaidDate || undefined)
    toast.success(t('contractDetail.signingBonusMarkPaidSuccess'))
    setMarkPaidOpen(false)
    setMarkPaidDate('')
    void load()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : t('contractDetail.saveFailed'))
  } finally {
    setMarkingPaid(false)
  }
}
```

**(e) 서명 보너스 카드 JSX 추가** — `ContractDetailPage` 의 `<div className="flex-1 overflow-auto p-6 space-y-8">` 내부에서 기본 정보 `<section>` **바로 뒤**에 삽입:

```tsx
{/* 서명 보너스 */}
{contract.signingBonus > 0 && (
  <section data-testid="signing-bonus-card">
    <h2 className="text-sm font-semibold text-muted-foreground mb-3">
      {t('contractDetail.signingBonus')}
    </h2>
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <dt className="text-muted-foreground">{t('contractDetail.signingBonusAmount')}</dt>
        <dd className="font-medium tabular-nums">{formatSalary(contract.signingBonus)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('contractDetail.signingBonusAnnual')}</dt>
        <dd className="font-medium tabular-nums">
          {formatSalary(
            computeSigningBonusAnnual(contract.signingBonus, contract.startDate, contract.endDate)
          )} / 년
        </dd>
      </div>
      {contract.signingBonusScheduledAt && (
        <div>
          <dt className="text-muted-foreground">{t('contractDetail.signingBonusScheduled')}</dt>
          <dd className="font-medium tabular-nums">{formatDate(contract.signingBonusScheduledAt)}</dd>
        </div>
      )}
      <div className="col-span-2 flex items-center justify-between">
        <div>
          <dt className="text-muted-foreground">{t('contractDetail.signingBonusStatus')}</dt>
          {contract.signingBonusPaidAt ? (
            <dd className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>{t('contractDetail.signingBonusPaid')}</span>
              <span data-testid="paid-date" className="tabular-nums">
                · {formatDate(contract.signingBonusPaidAt)}
              </span>
            </dd>
          ) : (
            <dd className="text-sm text-muted-foreground">{t('contractDetail.signingBonusUnpaid')}</dd>
          )}
        </div>
        {!contract.signingBonusPaidAt && canMarkPaid && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            data-testid="mark-paid-btn"
            onClick={() => {
              setMarkPaidDate(new Date().toISOString().slice(0, 10))
              setMarkPaidOpen(true)
            }}
          >
            {t('contractDetail.signingBonusMarkPaid')}
          </Button>
        )}
      </div>
    </dl>
  </section>
)}
```

**(f) 지급 완료 처리 다이얼로그 추가** — `AddExtensionDialog`, `AddBonusDialog` 와 같은 레벨 (return 문 맨 아래, `</div>` 직전)에 추가:

```tsx
{/* 서명 보너스 지급 완료 처리 다이얼로그 */}
<Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>{t('contractDetail.signingBonusMarkPaidTitle')}</DialogTitle>
    </DialogHeader>
    <div className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">{t('contractDetail.signingBonusMarkPaidDesc')}</p>
      <div className="space-y-1.5">
        <Label>{t('contractDetail.signingBonusPaidAt')}</Label>
        <Input
          type="date"
          value={markPaidDate}
          onChange={(e) => setMarkPaidDate(e.target.value)}
        />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setMarkPaidOpen(false)} disabled={markingPaid}>
        {t('contractDetail.cancel')}
      </Button>
      <Button onClick={() => void handleMarkPaid()} disabled={markingPaid}>
        {markingPaid ? t('contractDetail.saving') : t('contractDetail.signingBonusMarkPaidConfirm')}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd /Users/juno/work/football/football && npx vitest run src/pages/contracts/__tests__/ContractDetailPage.signingBonus.test.tsx 2>&1 | tail -10
```

Expected: 4 tests passed.

- [ ] **Step 5: 전체 테스트 통과 확인**

```bash
cd /Users/juno/work/football/football && npx vitest run 2>&1 | tail -10
```

Expected: All tests passed.

- [ ] **Step 6: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음.

- [ ] **Step 7: 커밋**

```bash
cd /Users/juno/work/football && git add football/src/pages/contracts/ContractDetailPage.tsx \
  "football/src/pages/contracts/__tests__/ContractDetailPage.signingBonus.test.tsx"
git commit -m "feat(fe): ContractDetailPage 서명 보너스 카드 + 지급 완료 처리 다이얼로그 추가"
```

---

## 전체 검증

- [ ] 계약 생성 시 signingBonus + signingBonusScheduledAt 이 DB에 저장됨
- [ ] `GET /contracts/:id` 응답에 `signingBonus`, `signingBonusScheduledAt`, `signingBonusPaidAt` 포함
- [ ] `PATCH /contracts/:id/signing-bonus-paid`: signingBonus=0 → 400 `NO_SIGNING_BONUS`
- [ ] `PATCH /contracts/:id/signing-bonus-paid`: 이미 지급 → 409 `ALREADY_PAID`
- [ ] `PATCH /contracts/:id/signing-bonus-paid`: 성공 시 `signingBonusPaidAt` 설정됨
- [ ] ContractDetailPage: signingBonus=0 이면 카드 미표시
- [ ] ContractDetailPage: 미지급 상태 → [지급 완료 처리] 버튼 표시 (권한 있는 사용자)
- [ ] ContractDetailPage: 지급 완료 후 버튼 사라지고 완료 날짜 표시
- [ ] CreateContractDialog: 예정 지급일 필드 정상 동작 (signingBonusScheduledAt 으로 전송)
