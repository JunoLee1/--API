# Wage Cap Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contract 생성 시 활성 시즌의 임금상한을 체크하여 0~10% 초과는 경고 토스트, 10% 초과는 생성 차단한다.

**Architecture:** `WageCapService`를 별도 파일로 분리하여 순수 계산 로직을 단위 테스트한다. `ContractService.createContract`에 주입하여 생성 전 체크, BLOCKED 시 AppError(400), WARNING 시 계약 생성 후 응답에 `wageCapWarning` 필드를 포함한다. FE는 응답의 `wageCapWarning` 필드를 읽어 toast.warning을 표시한다.

**Tech Stack:** Prisma (PostgreSQL), Express + TypeScript (BE), React + TypeScript + sonner(toast) (FE), Jest (BE unit test)

---

## 파일 맵

### Task 1: WageCapService
- Create: `apps/api/src/contract/wage-cap.service.ts`
- Create: `apps/api/__test__/contract/wage-cap.service.test.ts`

### Task 2: Contract 생성에 연결
- Modify: `apps/api/src/contract/contract.service.ts` (createContract 수정)
- Modify: `apps/api/src/contract/contract.routes.ts` (WageCapService 주입)

### Task 3: FE 경고 표시
- Modify: `football/src/services/contract.service.ts` (반환 타입 확장)
- Modify: `football/src/pages/contracts/ContractsPage.tsx` (wageCapWarning 처리)

---

## Task 1: WageCapService (단위 테스트 포함)

**Files:**
- Create: `apps/api/src/contract/wage-cap.service.ts`
- Create: `apps/api/__test__/contract/wage-cap.service.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```typescript
// apps/api/__test__/contract/wage-cap.service.test.ts
import { WageCapService } from "../../src/contract/wage-cap.service";

const makeSeason = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  status: "ACTIVE",
  wageCapType: "FIXED",
  wageCapValue: 10_000_000,
  startDate: new Date("2025-01-01"),
  endDate: new Date("2025-12-31"),
  ...overrides,
});

const makeService = (season: unknown, contracts: { salary: number }[]) => {
  const prisma = {
    season: { findFirst: jest.fn().mockResolvedValue(season) },
    contract: { findMany: jest.fn().mockResolvedValue(contracts) },
  };
  return new WageCapService(prisma as any);
};

describe("WageCapService.check", () => {
  it("returns OK when no active season", async () => {
    const svc = makeService(null, []);
    expect(await svc.check(1_000_000, new Date(), new Date())).toEqual({ status: "OK" });
  });

  it("returns OK when season has no wage cap set", async () => {
    const svc = makeService(makeSeason({ wageCapType: null, wageCapValue: null }), []);
    expect(await svc.check(1_000_000, new Date(), new Date())).toEqual({ status: "OK" });
  });

  it("returns OK when projected salary is under cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 5_000_000 }]);
    // 5M existing + 3M new = 8M projected, cap 10M → OK
    expect(await svc.check(3_000_000, new Date(), new Date())).toEqual({ status: "OK" });
  });

  it("returns OK when projected equals cap exactly", async () => {
    const svc = makeService(makeSeason(), [{ salary: 7_000_000 }]);
    // 7M + 3M = 10M = cap → OK
    expect(await svc.check(3_000_000, new Date(), new Date())).toEqual({ status: "OK" });
  });

  it("returns WARNING when 1-10% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 8_000_000 }]);
    // 8M + 3M = 11M, cap 10M → 10% over → WARNING
    const result = await svc.check(3_000_000, new Date(), new Date());
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBeCloseTo(10, 0);
  });

  it("returns WARNING for 5% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 7_500_000 }]);
    // 7.5M + 3M = 10.5M, cap 10M → 5% over → WARNING
    const result = await svc.check(3_000_000, new Date(), new Date());
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBeCloseTo(5, 0);
  });

  it("returns BLOCKED when >10% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 9_000_000 }]);
    // 9M + 3M = 12M, cap 10M → 20% over → BLOCKED
    const result = await svc.check(3_000_000, new Date(), new Date());
    expect(result.status).toBe("BLOCKED");
    expect((result as { status: "BLOCKED"; percentOver: number }).percentOver).toBeCloseTo(20, 0);
  });

  it("skips check for RATIO type (Plan C)", async () => {
    const svc = makeService(makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }), []);
    // RATIO requires FinancialReport (Plan C) — always OK for now
    expect(await svc.check(999_999_999, new Date(), new Date())).toEqual({ status: "OK" });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/contract/wage-cap.service.test.ts --no-coverage 2>&1 | tail -15
```

Expected: `FAIL` with "Cannot find module '../../src/contract/wage-cap.service'"

- [ ] **Step 3: wage-cap.service.ts 작성**

```typescript
// apps/api/src/contract/wage-cap.service.ts
import { PrismaClient } from "../generated/client";

export type WageCapCheckResult =
  | { status: "OK" }
  | { status: "WARNING"; percentOver: number }
  | { status: "BLOCKED"; percentOver: number };

export class WageCapService {
  constructor(private prisma: PrismaClient) {}

  async check(
    newSalary: number,
    contractStartDate: Date,
    contractEndDate: Date,
  ): Promise<WageCapCheckResult> {
    const season = await this.prisma.season.findFirst({
      where: { status: "ACTIVE" },
      select: { wageCapType: true, wageCapValue: true, startDate: true, endDate: true },
    });

    if (!season || !season.wageCapType || season.wageCapValue == null) {
      return { status: "OK" };
    }

    if (season.wageCapType === "RATIO") {
      return { status: "OK" };
    }

    const activeContracts = await this.prisma.contract.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: season.endDate },
        endDate: { gte: season.startDate },
      },
      select: { salary: true },
    });

    const totalSalary = activeContracts.reduce((sum, c) => sum + c.salary, 0);
    const projected = totalSalary + newSalary;
    const cap = season.wageCapValue;

    if (projected <= cap) return { status: "OK" };

    const percentOver = ((projected - cap) / cap) * 100;
    if (percentOver <= 10) return { status: "WARNING", percentOver };
    return { status: "BLOCKED", percentOver };
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/contract/wage-cap.service.test.ts --no-coverage 2>&1 | tail -15
```

Expected: `PASS` with 8 tests passing

- [ ] **Step 5: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/contract/wage-cap.service.ts apps/api/__test__/contract/wage-cap.service.test.ts
git commit -m "feat(wage-cap): WageCapService - FIXED 임금상한 계산 로직"
```

---

## Task 2: Contract 생성에 연결

**Files:**
- Modify: `apps/api/src/contract/contract.service.ts`
- Modify: `apps/api/src/contract/contract.routes.ts`

- [ ] **Step 1: contract.service.ts 수정**

`ContractService` 클래스에 `WageCapService`를 두 번째 생성자 파라미터로 추가하고 `createContract`를 아래와 같이 수정:

```typescript
// apps/api/src/contract/contract.service.ts
import { ContractRepository } from "./contract.repo";
import { WageCapService } from "./wage-cap.service";
import { AppError } from "../lib/appError";
import {
  CreateContractDto,
  UpdateContractStatusDto,
  CreateBuyoutDto,
  CreateExtensionDto,
  CreateBonusDto,
} from "./dto/contract.dto";

export class ContractService {
  constructor(
    private repo: ContractRepository,
    private wageCapService: WageCapService,
  ) {}

  getContractsByPlayer(playerId: string) {
    return this.repo.findByPlayerId(playerId);
  }

  async getContractById(id: number) {
    const contract = await this.repo.findById(id);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    return contract;
  }

  async createContract(dto: CreateContractDto) {
    const capResult = await this.wageCapService.check(
      dto.salary,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );

    if (capResult.status === "BLOCKED") {
      throw new AppError(
        400,
        `WAGE_CAP_EXCEEDED: 임금상한을 ${capResult.percentOver.toFixed(1)}% 초과합니다 (10% 이상 초과 시 계약 불가)`,
      );
    }

    const contract = await this.repo.create(dto);

    if (capResult.status === "WARNING") {
      return { ...contract, wageCapWarning: { percentOver: capResult.percentOver } };
    }

    return contract;
  }

  async updateStatus(id: number, dto: UpdateContractStatusDto) {
    const contract = await this.repo.findById(id);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    return this.repo.updateStatus(id, dto.status);
  }

  async addBuyout(contractId: number, dto: CreateBuyoutDto) {
    const contract = await this.repo.findById(contractId);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    const existing = await this.repo.hasBuyout(contractId);
    if (existing) throw new AppError(409, "BUYOUT_ALREADY_EXISTS");
    return this.repo.createBuyout(contractId, dto);
  }

  async addExtension(contractId: number, dto: CreateExtensionDto) {
    const contract = await this.repo.findById(contractId);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    return this.repo.createExtension(contractId, dto);
  }

  async addBonus(contractId: number, dto: CreateBonusDto) {
    const contract = await this.repo.findById(contractId);
    if (!contract) throw new AppError(404, "CONTRACT_NOT_FOUND");
    return this.repo.createBonus(contractId, dto);
  }
}
```

- [ ] **Step 2: contract.routes.ts 수정**

`WageCapService`를 import하고 `ContractService` 생성자에 두 번째 인자로 전달:

```typescript
// apps/api/src/contract/contract.routes.ts (수정 부분만 — 기존 import 아래에 추가)
import { WageCapService } from "./wage-cap.service";

// 기존 라인들:
// const repo = new ContractRepository(getPrisma());
// const service = new ContractService(repo);
// 아래처럼 교체:
const repo = new ContractRepository(getPrisma());
const wageCapService = new WageCapService(getPrisma());
const service = new ContractService(repo, wageCapService);
```

읽은 후 해당 라인을 위 코드로 교체하면 됨.

- [ ] **Step 3: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/contract/contract.service.ts apps/api/src/contract/contract.routes.ts
git commit -m "feat(wage-cap): Contract 생성 시 임금상한 체크 연결"
```

---

## Task 3: FE 경고 표시

**Files:**
- Modify: `football/src/services/contract.service.ts`
- Modify: `football/src/pages/contracts/ContractsPage.tsx`

- [ ] **Step 1: contract.service.ts 반환 타입 확장**

`football/src/services/contract.service.ts`를 읽어 `contractApi.create`의 반환 타입을 수정:

현재:
```typescript
}) => api.post<ContractDetail>('/contracts', payload),
```

변경 후:
```typescript
export interface ContractCreateResult extends ContractDetail {
  wageCapWarning?: { percentOver: number };
}

// contractApi 내부:
}) => api.post<ContractCreateResult>('/contracts', payload),
```

`ContractCreateResult` 인터페이스는 파일 상단 `import` 아래에 추가한다.

- [ ] **Step 2: ContractsPage.tsx에서 경고 처리**

`ContractsPage.tsx` 의 계약 생성 핸들러를 찾아 아래와 같이 수정. `await contractApi.create(...)` 결과를 변수에 담고 `wageCapWarning` 유무에 따라 분기:

현재 (line ~77):
```typescript
await contractApi.create({ playerId, startDate, endDate, salary: Number(salary) })
toast.success(t('contracts.createDialog.saved'))
onSaved()
```

변경 후:
```typescript
const result = await contractApi.create({ playerId, startDate, endDate, salary: Number(salary) })
if (result.wageCapWarning) {
  toast.warning(
    `계약이 등록되었으나 임금상한을 ${result.wageCapWarning.percentOver.toFixed(1)}% 초과합니다.`
  )
} else {
  toast.success(t('contracts.createDialog.saved'))
}
onSaved()
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 4: Vite 빌드 확인**

```bash
cd /Users/juno/work/football/football && npx vite build 2>&1 | grep -E "error|✓ built"
```

Expected: `✓ built in ...`

- [ ] **Step 5: Commit**

```bash
cd /Users/juno/work/football
git add football/src/services/contract.service.ts football/src/pages/contracts/ContractsPage.tsx
git commit -m "feat(wage-cap): FE 임금상한 경고 토스트 표시"
```

---

## Self-Review

**Spec coverage:**
- [x] FIXED 임금상한 계산 → Task 1 (WageCapService)
- [x] 0-10% 경고 → Task 1 + Task 3 (WARNING + toast.warning)
- [x] >10% 블록 → Task 1 + Task 2 (BLOCKED + AppError 400)
- [x] Contract 생성 연결 → Task 2
- [x] RATIO 타입: 현재 OK 반환 (Plan C에서 구현) → Task 1에 명시

**Placeholder 없음.** 모든 코드 블록 실제 코드 포함.

**타입 일관성:**
- `WageCapCheckResult` → Task 1에서 정의, Task 2에서 사용
- `ContractCreateResult` → Task 3에서 정의 및 사용
- `wageCapWarning: { percentOver: number }` → Task 2 서비스 반환, Task 3 FE에서 소비
