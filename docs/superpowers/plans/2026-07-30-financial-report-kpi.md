# Financial Report & Wage Cap KPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FinancialReport 모델로 시즌 수익 데이터를 수동 입력 또는 CSV 업로드로 저장하고, RATIO 임금상한 계산을 구현하며, 임금 KPI 대시보드 페이지를 제공한다.

**Architecture:** `FinancialReport`(seasonId unique, totalRevenue Int) 모델을 추가하고 Season에 wage cap 설정 API를 연결한다. `WageCapService.check()`가 RATIO 타입 시 FinancialReport.totalRevenue를 읽어 cap을 계산한다. FE는 `/admin/financial-report` 페이지에서 수익 입력(폼 + CSV 업로드)과 KPI 스탯 카드를 제공한다.

**Tech Stack:** Prisma (PostgreSQL), Express + TypeScript + multer (BE), React + TypeScript + sonner + react-i18next (FE), Jest (BE unit test)

## ✅ 구현 완료 (2026-08-19 확인)

`FinancialReport` 모델 + BE API + FE `FinancialReportPage.tsx` + AppShell nav 등록 모두 완료. RATIO 임금상한 계산 `wage-cap.service.ts`에 반영. 잔여 구현 없음.

---

## 파일 맵

### Task 1: FinancialReport 스키마 + 마이그레이션
- Modify: `apps/api/prisma/schema.prisma`

### Task 2: FinancialReport API
- Create: `apps/api/src/financial-report/financial-report.repo.ts`
- Create: `apps/api/src/financial-report/financial-report.service.ts`
- Create: `apps/api/src/financial-report/financial-report.controller.ts`
- Create: `apps/api/src/financial-report/financial-report.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

### Task 3: Season 임금상한 설정 + KPI 엔드포인트
- Modify: `apps/api/src/season/dto/season.dto.ts`
- Modify: `apps/api/src/season/season.repo.ts`
- Modify: `apps/api/src/season/season.service.ts`
- Modify: `apps/api/src/season/season.controller.ts`
- Modify: `apps/api/src/season/season.routes.ts`

### Task 4: RATIO WageCapService (TDD)
- Modify: `apps/api/src/contract/wage-cap.service.ts`
- Modify: `apps/api/__test__/contract/wage-cap.service.test.ts`

### Task 5: FE 타입 + 시즌 임금상한 설정 UI
- Modify: `football/src/types/season.ts`
- Modify: `football/src/services/season.service.ts`
- Modify: `football/src/pages/admin/SeasonsPage.tsx`

### Task 6: FE FinancialReport + KPI 페이지
- Create: `football/src/services/financial-report.service.ts`
- Create: `football/src/pages/admin/FinancialReportPage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/locales/ko/admin.json`
- Modify: `football/src/locales/en/admin.json`

---

## Task 1: FinancialReport 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: schema.prisma에 FinancialReport 모델 추가**

Season 모델 뒤에 다음 모델을 추가하고, Season 모델에 relation을 추가한다.

```prisma
// Season 모델 내 relation 추가 (기존 relations 아래):
//   financialReport FinancialReport?

model FinancialReport {
  id           Int      @id @default(autoincrement())
  seasonId     Int      @unique
  totalRevenue Int
  note         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  season       Season   @relation(fields: [seasonId], references: [id])
}
```

`apps/api/prisma/schema.prisma`의 Season 모델에서 기존 relation 목록(matches, trainingSessions 등) 끝에 `financialReport FinancialReport?` 한 줄을 추가하고, 파일 말미에 FinancialReport 모델을 추가한다.

- [ ] **Step 2: 마이그레이션 생성 및 적용**

```bash
cd /Users/juno/work/football/apps/api
npx prisma migrate dev --name financial_report
```

Expected: `apps/api/prisma/migrations/20260730000002_financial_report/migration.sql` 생성, "Done" 출력

- [ ] **Step 3: Prisma Client 재생성 확인**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | head -10
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(financial-report): FinancialReport 스키마 추가"
```

---

## Task 2: FinancialReport API

**Files:**
- Create: `apps/api/src/financial-report/financial-report.repo.ts`
- Create: `apps/api/src/financial-report/financial-report.service.ts`
- Create: `apps/api/src/financial-report/financial-report.controller.ts`
- Create: `apps/api/src/financial-report/financial-report.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

**Endpoints:**
- `POST /financial-reports/:seasonId` — totalRevenue 직접 입력 (upsert). ADMIN only.
- `POST /financial-reports/:seasonId/csv` — CSV 파일 업로드, 파싱 후 upsert. ADMIN only.
- `GET /financial-reports/:seasonId` — 단건 조회. 인증 필요.

**CSV 포맷 (헤더 선택적):**
```
category,amount
티켓 수입,500000000
방송권료,200000000
스폰서십,300000000
```
또는 헤더 없이 한 줄로 `전체,1000000000`. 두 번째 컬럼 숫자들의 합이 totalRevenue가 된다.

- [ ] **Step 1: financial-report.repo.ts 작성**

```typescript
// apps/api/src/financial-report/financial-report.repo.ts
import { PrismaClient } from "../generated/client";

export class FinancialReportRepository {
  constructor(private prisma: PrismaClient) {}

  async upsert(seasonId: number, totalRevenue: number, note?: string) {
    return this.prisma.financialReport.upsert({
      where: { seasonId },
      create: { seasonId, totalRevenue, note },
      update: { totalRevenue, note },
    });
  }

  async findBySeasonId(seasonId: number) {
    return this.prisma.financialReport.findUnique({ where: { seasonId } });
  }
}
```

- [ ] **Step 2: financial-report.service.ts 작성**

```typescript
// apps/api/src/financial-report/financial-report.service.ts
import { AppError } from "../lib/appError";
import { FinancialReportRepository } from "./financial-report.repo";

export class FinancialReportService {
  constructor(private repo: FinancialReportRepository) {}

  async set(seasonId: number, totalRevenue: number, note?: string) {
    if (totalRevenue <= 0) throw new AppError(400, "INVALID_REVENUE");
    return this.repo.upsert(seasonId, totalRevenue, note);
  }

  async setFromCSV(seasonId: number, csvContent: string, note?: string) {
    const totalRevenue = this.parseCSV(csvContent);
    return this.repo.upsert(seasonId, totalRevenue, note);
  }

  async get(seasonId: number) {
    const report = await this.repo.findBySeasonId(seasonId);
    if (!report) throw new AppError(404, "FINANCIAL_REPORT_NOT_FOUND");
    return report;
  }

  private parseCSV(content: string): number {
    const lines = content.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let total = 0;
    for (const line of lines) {
      const cols = line.split(",");
      const raw = cols[cols.length - 1].trim().replace(/[^0-9.]/g, "");
      const amount = parseFloat(raw);
      if (!isNaN(amount) && amount > 0) total += Math.round(amount);
    }
    if (total === 0) throw new AppError(400, "CSV_NO_VALID_AMOUNTS");
    return total;
  }
}
```

- [ ] **Step 3: financial-report.controller.ts 작성**

```typescript
// apps/api/src/financial-report/financial-report.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { FinancialReportService } from "./financial-report.service";

export class FinancialReportController {
  constructor(private service: FinancialReportService) {}

  set = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      const { totalRevenue, note } = req.body as { totalRevenue: number; note?: string };
      if (!Number.isInteger(totalRevenue)) throw new AppError(400, "INVALID_REVENUE");
      const report = await this.service.set(seasonId, totalRevenue, note);
      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  };

  setFromCSV = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.params["seasonId"]);
      if (!req.file) throw new AppError(400, "FILE_REQUIRED");
      const csvContent = req.file.buffer.toString("utf-8");
      const note = (req.body as { note?: string }).note;
      const report = await this.service.setFromCSV(seasonId, csvContent, note);
      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const seasonId = Number(req.params["seasonId"]);
      const report = await this.service.get(seasonId);
      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 4: financial-report.routes.ts 작성**

multer를 `memoryStorage`로 사용해 디스크 저장 없이 버퍼를 직접 읽는다.

```typescript
// apps/api/src/financial-report/financial-report.routes.ts
import { Router } from "express";
import passport from "passport";
import multer from "multer";
import { FinancialReportController } from "./financial-report.controller";
import { FinancialReportService } from "./financial-report.service";
import { FinancialReportRepository } from "./financial-report.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new FinancialReportRepository(getPrisma());
const service = new FinancialReportService(repo);
const controller = new FinancialReportController(service);

const auth = passport.authenticate("accessToken", { session: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1 * 1024 * 1024 } });

router.post("/:seasonId", auth, controller.set);
router.post("/:seasonId/csv", auth, upload.single("file"), controller.setFromCSV);
router.get("/:seasonId", auth, controller.get);

export default router;
```

- [ ] **Step 5: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts`의 기존 import 목록 끝에 추가:

```typescript
import financialReportRouter from "./financial-report/financial-report.routes";
```

`apiRouter.use("/meal-expenses", mealExpenseRouter);` 아래에 추가:

```typescript
apiRouter.use("/financial-reports", financialReportRouter);
```

- [ ] **Step 6: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 7: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/financial-report/ apps/api/src/apiRouter.ts
git commit -m "feat(financial-report): FinancialReport API - 수동 입력 + CSV 업로드"
```

---

## Task 3: Season 임금상한 설정 + KPI 엔드포인트

**Files:**
- Modify: `apps/api/src/season/dto/season.dto.ts`
- Modify: `apps/api/src/season/season.repo.ts`
- Modify: `apps/api/src/season/season.service.ts`
- Modify: `apps/api/src/season/season.controller.ts`
- Modify: `apps/api/src/season/season.routes.ts`

**새 엔드포인트:**
- `PATCH /seasons/:id/wage-cap` — wageCapType + wageCapValue 설정. ADMIN only.
- `GET /seasons/active/wage-cap-kpi` — 활성 시즌 임금 KPI. 인증 필요.

- [ ] **Step 1: season.dto.ts에 SetWageCapDto 추가**

기존 `CreateSeasonDto` 아래에 추가:

```typescript
// apps/api/src/season/dto/season.dto.ts
export interface CreateSeasonDto {
  name: string;
  startDate: string;
  endDate: string;
}

export interface SetWageCapDto {
  wageCapType: "FIXED" | "RATIO" | null;
  wageCapValue: number | null;
}
```

- [ ] **Step 2: season.repo.ts에 updateWageCap + KPI 쿼리 추가**

```typescript
// apps/api/src/season/season.repo.ts
import { PrismaClient, SeasonStatus } from "../generated/client";

export class SeasonRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: { name: string; startDate: Date; endDate: Date }) {
    return await this.prisma.season.create({ data });
  }

  async findById(id: number) {
    return await this.prisma.season.findUnique({
      where: { id },
      include: { _count: { select: { matches: true, trainingSessions: true } } },
    });
  }

  async findAll(status?: SeasonStatus) {
    return await this.prisma.season.findMany({
      ...(status !== undefined && { where: { status } }),
      orderBy: { startDate: "desc" },
    });
  }

  async findActive() {
    return await this.prisma.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
    });
  }

  async updateStatus(id: number, status: SeasonStatus) {
    return await this.prisma.season.update({ where: { id }, data: { status } });
  }

  async updateWageCap(id: number, wageCapType: string | null, wageCapValue: number | null) {
    return await this.prisma.season.update({
      where: { id },
      data: { wageCapType: wageCapType as any, wageCapValue },
    });
  }

  async findActiveWithKPI() {
    const season = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
      include: { financialReport: { select: { totalRevenue: true } } },
    });
    if (!season) return null;

    const contracts = await this.prisma.contract.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: season.endDate },
        endDate: { gte: season.startDate },
      },
      select: { salary: true },
    });

    const totalPayroll = contracts.reduce((sum, c) => sum + c.salary, 0);
    const totalRevenue = season.financialReport?.totalRevenue ?? null;

    let cap: number | null = null;
    if (season.wageCapType === "FIXED" && season.wageCapValue != null) {
      cap = season.wageCapValue;
    } else if (season.wageCapType === "RATIO" && season.wageCapValue != null && totalRevenue != null) {
      cap = Math.round(totalRevenue * season.wageCapValue);
    }

    return {
      wageCapType: season.wageCapType,
      wageCapValue: season.wageCapValue,
      totalRevenue,
      cap,
      totalPayroll,
      percentUsed: cap != null ? Math.round((totalPayroll / cap) * 1000) / 10 : null,
      remaining: cap != null ? cap - totalPayroll : null,
    };
  }
}
```

- [ ] **Step 3: season.service.ts에 setWageCap + getWageCapKPI 추가**

```typescript
// apps/api/src/season/season.service.ts
import { SeasonStatus } from "../generated/client";
import { AppError } from "../lib/appError";
import { SeasonRepository } from "./season.repo";
import { CreateSeasonDto, SetWageCapDto } from "./dto/season.dto";

export class SeasonService {
  constructor(private repo: SeasonRepository) {}

  async createSeason(data: CreateSeasonDto) {
    return await this.repo.create({
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    });
  }

  async getSeasons(status?: string) {
    const parsed = status as SeasonStatus | undefined;
    return await this.repo.findAll(parsed);
  }

  async getActiveSeason() {
    const season = await this.repo.findActive();
    if (!season) throw new AppError(404, "NO_ACTIVE_SEASON");
    return season;
  }

  async getSeasonById(id: number) {
    const season = await this.repo.findById(id);
    if (!season) throw new AppError(404, "SEASON_NOT_FOUND");
    return season;
  }

  async activateSeason(id: number) {
    const season = await this.repo.findById(id);
    if (!season) throw new AppError(404, "SEASON_NOT_FOUND");
    if (season.status !== SeasonStatus.UPCOMING) throw new AppError(400, "SEASON_NOT_UPCOMING");
    const active = await this.repo.findActive();
    if (active) throw new AppError(409, "ACTIVE_SEASON_EXISTS");
    return await this.repo.updateStatus(id, SeasonStatus.ACTIVE);
  }

  async closeSeason(id: number) {
    const season = await this.repo.findById(id);
    if (!season) throw new AppError(404, "SEASON_NOT_FOUND");
    if (season.status !== SeasonStatus.ACTIVE) throw new AppError(400, "SEASON_NOT_ACTIVE");
    return await this.repo.updateStatus(id, SeasonStatus.CLOSED);
  }

  async setWageCap(id: number, dto: SetWageCapDto) {
    const season = await this.repo.findById(id);
    if (!season) throw new AppError(404, "SEASON_NOT_FOUND");

    if (dto.wageCapType !== null && dto.wageCapValue == null) {
      throw new AppError(400, "WAGE_CAP_VALUE_REQUIRED");
    }
    if (dto.wageCapType === "RATIO" && dto.wageCapValue != null) {
      if (dto.wageCapValue <= 0 || dto.wageCapValue > 1) {
        throw new AppError(400, "RATIO_MUST_BE_0_TO_1");
      }
    }
    if (dto.wageCapType === "FIXED" && dto.wageCapValue != null && dto.wageCapValue <= 0) {
      throw new AppError(400, "INVALID_WAGE_CAP_VALUE");
    }

    return await this.repo.updateWageCap(id, dto.wageCapType, dto.wageCapValue);
  }

  async getWageCapKPI() {
    const kpi = await this.repo.findActiveWithKPI();
    if (!kpi) throw new AppError(404, "NO_ACTIVE_SEASON");
    return kpi;
  }
}
```

- [ ] **Step 4: season.controller.ts에 setWageCap + getWageCapKPI 추가**

기존 컨트롤러 클래스 내 `closeSeason` 메서드 뒤에 추가:

```typescript
  setWageCap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      const season = await this.service.setWageCap(id, req.body);
      res.status(200).json(season);
    } catch (err) {
      next(err);
    }
  };

  getWageCapKPI = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kpi = await this.service.getWageCapKPI();
      res.status(200).json(kpi);
    } catch (err) {
      next(err);
    }
  };
```

- [ ] **Step 5: season.routes.ts에 새 라우트 등록**

기존 라우트 목록에서 `router.patch("/:id/close", ...)` 아래에 추가:

```typescript
// 활성 시즌 임금 KPI — /active/wage-cap-kpi 는 /:id 보다 먼저 등록해야 함
router.get("/active/wage-cap-kpi", auth, controller.getWageCapKPI);

// 시즌 임금상한 설정 (ADMIN)
router.patch("/:id/wage-cap", auth, controller.setWageCap);
```

주의: `GET /seasons/active/wage-cap-kpi`는 `/active` 경로를 `/:id`보다 먼저 등록해야 한다. 기존 `router.get("/active", ...)` 다음에 추가한다.

- [ ] **Step 6: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 7: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/season/
git commit -m "feat(season): 임금상한 설정 API + 임금 KPI 엔드포인트"
```

---

## Task 4: RATIO WageCapService (TDD)

**Files:**
- Modify: `apps/api/src/contract/wage-cap.service.ts`
- Modify: `apps/api/__test__/contract/wage-cap.service.test.ts`

RATIO 타입 시 `FinancialReport.totalRevenue * wageCapValue`를 cap으로 사용한다. FinancialReport가 없으면 OK 반환(graceful degradation).

- [ ] **Step 1: 실패 테스트 먼저 추가**

`apps/api/__test__/contract/wage-cap.service.test.ts`에서 `makeService` 시그니처를 변경하고 RATIO 테스트 4개를 추가한다. 기존 파일을 완전히 교체:

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

const makeService = (
  season: unknown,
  contracts: { salary: number }[],
  financialReport?: { totalRevenue: number } | null,
) => {
  const prisma = {
    season: { findFirst: jest.fn().mockResolvedValue(season) },
    contract: { findMany: jest.fn().mockResolvedValue(contracts) },
    financialReport: { findUnique: jest.fn().mockResolvedValue(financialReport ?? null) },
  };
  return new WageCapService(prisma as any);
};

describe("WageCapService.check — FIXED", () => {
  it("returns OK when no active season", async () => {
    const svc = makeService(null, []);
    expect(await svc.check(1_000_000)).toEqual({ status: "OK" });
  });

  it("returns OK when season has no wage cap set", async () => {
    const svc = makeService(makeSeason({ wageCapType: null, wageCapValue: null }), []);
    expect(await svc.check(1_000_000)).toEqual({ status: "OK" });
  });

  it("returns OK when projected salary is under cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 5_000_000 }]);
    // 5M existing + 3M new = 8M projected, cap 10M → OK
    expect(await svc.check(3_000_000)).toEqual({ status: "OK" });
  });

  it("returns OK when projected equals cap exactly", async () => {
    const svc = makeService(makeSeason(), [{ salary: 7_000_000 }]);
    // 7M + 3M = 10M = cap → OK
    expect(await svc.check(3_000_000)).toEqual({ status: "OK" });
  });

  it("returns WARNING when exactly 10% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 8_000_000 }]);
    // 8M + 3M = 11M, cap 10M → 10% over → WARNING
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBe(10);
  });

  it("returns WARNING for 5% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 7_500_000 }]);
    // 7.5M + 3M = 10.5M, cap 10M → 5% over → WARNING
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBe(5);
  });

  it("returns BLOCKED when just over 10% (10.1%)", async () => {
    const svc = makeService(makeSeason(), [{ salary: 8_010_000 }]);
    // 8.01M + 3M = 11.01M, cap 10M → 10.1% over → BLOCKED
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("BLOCKED");
    expect((result as { status: "BLOCKED"; percentOver: number }).percentOver).toBeCloseTo(10.1, 1);
  });

  it("returns BLOCKED when >10% over cap", async () => {
    const svc = makeService(makeSeason(), [{ salary: 9_000_000 }]);
    // 9M + 3M = 12M, cap 10M → 20% over → BLOCKED
    const result = await svc.check(3_000_000);
    expect(result.status).toBe("BLOCKED");
    expect((result as { status: "BLOCKED"; percentOver: number }).percentOver).toBe(20);
  });
});

describe("WageCapService.check — RATIO", () => {
  it("returns OK when no financial report exists", async () => {
    const svc = makeService(makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }), [], null);
    // No FinancialReport → graceful degradation
    expect(await svc.check(999_999_999)).toEqual({ status: "OK" });
  });

  it("returns OK when projected is under RATIO cap", async () => {
    // revenue=10M, ratio=0.5 → cap=5M; existing=2M, new=2M → projected=4M → OK
    const svc = makeService(
      makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }),
      [{ salary: 2_000_000 }],
      { totalRevenue: 10_000_000 },
    );
    expect(await svc.check(2_000_000)).toEqual({ status: "OK" });
  });

  it("returns WARNING for RATIO when 5% over cap", async () => {
    // revenue=10M, ratio=0.5 → cap=5M; existing=2.75M, new=2.5M → projected=5.25M → 5% over
    const svc = makeService(
      makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }),
      [{ salary: 2_750_000 }],
      { totalRevenue: 10_000_000 },
    );
    const result = await svc.check(2_500_000);
    expect(result.status).toBe("WARNING");
    expect((result as { status: "WARNING"; percentOver: number }).percentOver).toBe(5);
  });

  it("returns BLOCKED for RATIO when 20% over cap", async () => {
    // revenue=10M, ratio=0.5 → cap=5M; existing=4M, new=2M → projected=6M → 20% over
    const svc = makeService(
      makeSeason({ wageCapType: "RATIO", wageCapValue: 0.5 }),
      [{ salary: 4_000_000 }],
      { totalRevenue: 10_000_000 },
    );
    const result = await svc.check(2_000_000);
    expect(result.status).toBe("BLOCKED");
    expect((result as { status: "BLOCKED"; percentOver: number }).percentOver).toBe(20);
  });
});
```

- [ ] **Step 2: 테스트 실행 — RATIO 4개 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/contract/wage-cap.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: RATIO describe 블록 4개 FAIL ("Cannot read properties of undefined (reading 'findUnique')" 또는 유사)

- [ ] **Step 3: wage-cap.service.ts 수정 — RATIO 지원 추가**

```typescript
// apps/api/src/contract/wage-cap.service.ts
import { PrismaClient } from "../generated/client";

export type WageCapCheckResult =
  | { status: "OK" }
  | { status: "WARNING"; percentOver: number }
  | { status: "BLOCKED"; percentOver: number };

export class WageCapService {
  constructor(private prisma: PrismaClient) {}

  async check(newSalary: number): Promise<WageCapCheckResult> {
    const season = await this.prisma.season.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true, wageCapType: true, wageCapValue: true, startDate: true, endDate: true },
    });

    if (!season || !season.wageCapType || season.wageCapValue == null) {
      return { status: "OK" };
    }

    let cap: number;

    if (season.wageCapType === "FIXED") {
      cap = season.wageCapValue;
    } else {
      // RATIO: cap = totalRevenue * wageCapValue
      const report = await this.prisma.financialReport.findUnique({
        where: { seasonId: season.id },
        select: { totalRevenue: true },
      });
      if (!report) return { status: "OK" };
      cap = Math.round(report.totalRevenue * season.wageCapValue);
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

    if (projected <= cap) return { status: "OK" };

    const percentOver = ((projected - cap) / cap) * 100;
    if (percentOver <= 10) return { status: "WARNING", percentOver };
    return { status: "BLOCKED", percentOver };
  }
}
```

- [ ] **Step 4: 테스트 실행 — 전체 통과 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest __test__/contract/wage-cap.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: `PASS`, 13 tests passing (FIXED 8 + RATIO 4 = 12... wait, 8 + 4 = 12)

- [ ] **Step 5: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -10
```

Expected: 에러 없음

- [ ] **Step 6: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/contract/wage-cap.service.ts apps/api/__test__/contract/wage-cap.service.test.ts
git commit -m "feat(wage-cap): RATIO 임금상한 계산 구현 (FinancialReport 연동)"
```

---

## Task 5: FE 타입 + 시즌 임금상한 설정 UI

**Files:**
- Modify: `football/src/types/season.ts`
- Modify: `football/src/services/season.service.ts`
- Modify: `football/src/pages/admin/SeasonsPage.tsx`

- [ ] **Step 1: types/season.ts 확장**

```typescript
// football/src/types/season.ts
export type SeasonStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED'
export type WageCapType = 'FIXED' | 'RATIO'

export interface Season {
  id: number
  name: string
  startDate: string
  endDate: string
  status: SeasonStatus
  wageCapType: WageCapType | null
  wageCapValue: number | null
}

export interface WageCapKPI {
  wageCapType: WageCapType | null
  wageCapValue: number | null
  totalRevenue: number | null
  cap: number | null
  totalPayroll: number
  percentUsed: number | null
  remaining: number | null
}

export const SEASON_STATUS_LABEL: Record<SeasonStatus, string> = {
  UPCOMING: 'Upcoming',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
}

export const SEASON_STATUS_STYLE: Record<SeasonStatus, string> = {
  UPCOMING: 'border-yellow-300 text-yellow-700 bg-yellow-50',
  ACTIVE: 'border-green-300 text-green-700 bg-green-50',
  CLOSED: 'border-gray-300 text-gray-600 bg-gray-50',
}
```

- [ ] **Step 2: services/season.service.ts에 setWageCap + getWageCapKPI 추가**

```typescript
// football/src/services/season.service.ts
import { api } from './api'
import type { Season, WageCapKPI } from '@/types/season'

export const seasonApi = {
  list: (status?: string) =>
    api.get<Season[]>(`/seasons${status ? `?status=${status}` : ''}`),

  active: () => api.get<Season | null>('/seasons/active'),

  create: (payload: { name: string; startDate: string; endDate: string }) =>
    api.post<Season>('/seasons', payload),

  activate: (id: number) => api.patch<Season>(`/seasons/${id}/activate`, {}),

  close: (id: number) => api.patch<Season>(`/seasons/${id}/close`, {}),

  setWageCap: (id: number, payload: { wageCapType: string | null; wageCapValue: number | null }) =>
    api.patch<Season>(`/seasons/${id}/wage-cap`, payload),

  getWageCapKPI: () => api.get<WageCapKPI>('/seasons/active/wage-cap-kpi'),
}
```

- [ ] **Step 3: SeasonsPage.tsx에 임금상한 설정 다이얼로그 추가**

기존 SeasonsPage.tsx를 읽은 후 아래를 반영:

1. `import { seasonApi }` 에 `setWageCap` 사용 (이미 있음)
2. `Season` 타입에 `wageCapType`, `wageCapValue` 추가됨 (types 수정 완료)
3. 테이블에 "임금상한" 컬럼 추가 (`wageCapType`/`wageCapValue` 표시)
4. ADMIN에게 "상한 설정" 버튼 → `WageCapConfigDialog` 열기

`SeasonsPage.tsx`의 전체 내용 (기존 파일 전체 교체):

```typescript
// football/src/pages/admin/SeasonsPage.tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { seasonApi } from '@/services/season.service'
import type { Season, SeasonStatus, WageCapType } from '@/types/season'
import { SEASON_STATUS_LABEL, SEASON_STATUS_STYLE } from '@/types/season'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import { Plus } from 'lucide-react'

const PAGE_SIZE = 10

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

function formatWageCap(s: Season): string {
  if (!s.wageCapType || s.wageCapValue == null) return '-'
  if (s.wageCapType === 'FIXED') return `고정 ${s.wageCapValue.toLocaleString()}원`
  return `수익 ${(s.wageCapValue * 100).toFixed(0)}%`
}

interface CreateSeasonDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateSeasonDialog({ open, onOpenChange, onSaved }: CreateSeasonDialogProps) {
  const { t } = useTranslation('admin')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error(t('seasonsPage.createDialog.allRequired'))
      return
    }
    if (endDate <= startDate) {
      toast.error(t('seasonsPage.createDialog.endAfterStart'))
      return
    }
    setSaving(true)
    try {
      await seasonApi.create({ name: name.trim(), startDate, endDate })
      toast.success(t('seasonsPage.createDialog.createSuccess'))
      setName(''); setStartDate(''); setEndDate('')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('seasonsPage.createDialog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('seasonsPage.createDialog.title')}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('seasonsPage.createDialog.nameLabel')}</Label>
            <Input placeholder={t('seasonsPage.createDialog.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('seasonsPage.createDialog.startDateLabel')}</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('seasonsPage.createDialog.endDateLabel')}</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('seasonsPage.createDialog.cancel')}</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? t('seasonsPage.createDialog.saving') : t('seasonsPage.createDialog.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface WageCapConfigDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  season: Season
  onSaved: () => void
}

function WageCapConfigDialog({ open, onOpenChange, season, onSaved }: WageCapConfigDialogProps) {
  const { t } = useTranslation('admin')
  const [capType, setCapType] = useState<WageCapType | 'NONE'>(season.wageCapType ?? 'NONE')
  const [capValue, setCapValue] = useState(season.wageCapValue?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const wageCapType = capType === 'NONE' ? null : capType
      const wageCapValue = capType === 'NONE' ? null : Number(capValue)
      if (wageCapType !== null && (!capValue || isNaN(wageCapValue!))) {
        toast.error(t('seasonsPage.wageCapDialog.valueRequired'))
        return
      }
      await seasonApi.setWageCap(season.id, { wageCapType, wageCapValue })
      toast.success(t('seasonsPage.wageCapDialog.saved'))
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('seasonsPage.wageCapDialog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('seasonsPage.wageCapDialog.title', { name: season.name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('seasonsPage.wageCapDialog.type')}</Label>
            <Select value={capType} onValueChange={(v) => setCapType(v as WageCapType | 'NONE')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">{t('seasonsPage.wageCapDialog.typeNone')}</SelectItem>
                <SelectItem value="FIXED">{t('seasonsPage.wageCapDialog.typeFixed')}</SelectItem>
                <SelectItem value="RATIO">{t('seasonsPage.wageCapDialog.typeRatio')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {capType !== 'NONE' && (
            <div className="space-y-1.5">
              <Label>
                {capType === 'FIXED'
                  ? t('seasonsPage.wageCapDialog.valueFixed')
                  : t('seasonsPage.wageCapDialog.valueRatio')}
              </Label>
              <Input
                type="number"
                step={capType === 'RATIO' ? '0.01' : '1000000'}
                min={0}
                max={capType === 'RATIO' ? 1 : undefined}
                value={capValue}
                onChange={e => setCapValue(e.target.value)}
                placeholder={capType === 'RATIO' ? '0.5' : '1000000000'}
              />
              {capType === 'RATIO' && (
                <p className="text-xs text-muted-foreground">{t('seasonsPage.wageCapDialog.ratioHint')}</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('seasonsPage.wageCapDialog.cancel')}</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? t('seasonsPage.wageCapDialog.saving') : t('seasonsPage.wageCapDialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SeasonsPage() {
  const { t } = useTranslation('admin')
  const { user } = useCurrentUser()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [wageCapTarget, setWageCapTarget] = useState<Season | null>(null)
  const [page, setPage] = useState(1)

  const isAdmin = user?.role === 'ADMIN'

  const fetchSeasons = () => {
    setLoading(true)
    setPage(1)
    seasonApi
      .list()
      .then(setSeasons)
      .catch(() => toast.error(t('seasonsPage.loadFailed')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSeasons() }, [])

  const handleActivate = async (id: number) => {
    try {
      await seasonApi.activate(id)
      toast.success(t('seasonsPage.activateSuccess'))
      fetchSeasons()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('seasonsPage.activateFailed'))
    }
  }

  const handleClose = async (id: number) => {
    try {
      await seasonApi.close(id)
      toast.success(t('seasonsPage.closeSuccess'))
      fetchSeasons()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('seasonsPage.closeFailed'))
    }
  }

  const totalPages = Math.ceil(seasons.length / PAGE_SIZE)
  const paged = seasons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('seasonsPage.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('seasonsPage.description', { count: seasons.length })}</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('seasonsPage.addSeason')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('seasonsPage.loading')}
          </div>
        ) : seasons.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {t('seasonsPage.noSeasons')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('seasonsPage.table.name')}</TableHead>
                <TableHead className="w-28">{t('seasonsPage.table.startDate')}</TableHead>
                <TableHead className="w-28">{t('seasonsPage.table.endDate')}</TableHead>
                <TableHead className="w-24">{t('seasonsPage.table.status')}</TableHead>
                <TableHead className="w-36">{t('seasonsPage.table.wageCap')}</TableHead>
                {isAdmin && <TableHead className="w-48" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(s.startDate)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(s.endDate)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${SEASON_STATUS_STYLE[s.status as SeasonStatus]}`}>
                      {SEASON_STATUS_LABEL[s.status as SeasonStatus]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatWageCap(s)}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => setWageCapTarget(s)}
                      >
                        {t('seasonsPage.setWageCap')}
                      </Button>
                      {s.status === 'UPCOMING' && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => void handleActivate(s.id)}
                        >
                          {t('seasonsPage.activate')}
                        </Button>
                      )}
                      {s.status === 'ACTIVE' && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs text-destructive"
                          onClick={() => void handleClose(s.id)}
                        >
                          {t('seasonsPage.close')}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={seasons.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <CreateSeasonDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchSeasons() }}
      />

      {wageCapTarget && (
        <WageCapConfigDialog
          open={!!wageCapTarget}
          onOpenChange={(v) => { if (!v) setWageCapTarget(null) }}
          season={wageCapTarget}
          onSaved={() => { setWageCapTarget(null); fetchSeasons() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: i18n 키 추가 (ko)**

`football/src/locales/ko/admin.json`의 `seasonsPage` 객체 내 기존 마지막 키 뒤에 추가:

```json
"table": {
  "name": "시즌명",
  "startDate": "시작일",
  "endDate": "종료일",
  "status": "상태",
  "wageCap": "임금상한"
},
"setWageCap": "상한 설정",
"wageCapDialog": {
  "title": "{{name}} 임금상한 설정",
  "type": "상한 유형",
  "typeNone": "없음",
  "typeFixed": "고정금액 (FIXED)",
  "typeRatio": "수익비율 (RATIO)",
  "valueFixed": "상한금액 (원)",
  "valueRatio": "비율 (0~1)",
  "ratioHint": "예: 0.5 = 수익의 50%",
  "valueRequired": "금액 또는 비율을 입력하세요.",
  "saved": "임금상한이 설정됐습니다.",
  "saveFailed": "저장에 실패했습니다.",
  "cancel": "취소",
  "saving": "저장 중...",
  "save": "저장"
}
```

- [ ] **Step 5: i18n 키 추가 (en)**

`football/src/locales/en/admin.json`의 `seasonsPage` 내 동일 위치에:

```json
"table": {
  "name": "Season",
  "startDate": "Start Date",
  "endDate": "End Date",
  "status": "Status",
  "wageCap": "Wage Cap"
},
"setWageCap": "Set Cap",
"wageCapDialog": {
  "title": "Wage Cap — {{name}}",
  "type": "Cap Type",
  "typeNone": "None",
  "typeFixed": "Fixed Amount",
  "typeRatio": "Revenue Ratio",
  "valueFixed": "Cap Amount (₩)",
  "valueRatio": "Ratio (0–1)",
  "ratioHint": "e.g. 0.5 = 50% of revenue",
  "valueRequired": "Please enter an amount or ratio.",
  "saved": "Wage cap saved.",
  "saveFailed": "Failed to save.",
  "cancel": "Cancel",
  "saving": "Saving...",
  "save": "Save"
}
```

- [ ] **Step 6: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 7: Commit**

```bash
cd /Users/juno/work/football
git add football/src/types/season.ts football/src/services/season.service.ts football/src/pages/admin/SeasonsPage.tsx football/src/locales/
git commit -m "feat(season): FE 임금상한 설정 UI + Season 타입 확장"
```

---

## Task 6: FE FinancialReport + KPI 페이지

**Files:**
- Create: `football/src/services/financial-report.service.ts`
- Create: `football/src/pages/admin/FinancialReportPage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/locales/ko/admin.json`
- Modify: `football/src/locales/en/admin.json`

**페이지 기능:**
- 활성 시즌의 재무 보고서 현황 (KPI 스탯 카드: 총 페이롤, 임금상한, 사용률%, 잔여)
- 수동 입력: totalRevenue 숫자 입력 → POST /financial-reports/:seasonId
- CSV 업로드: 파일 선택 → POST /financial-reports/:seasonId/csv

- [ ] **Step 1: financial-report.service.ts 작성**

```typescript
// football/src/services/financial-report.service.ts
import { api } from './api'

export interface FinancialReport {
  id: number
  seasonId: number
  totalRevenue: number
  note: string | null
  createdAt: string
  updatedAt: string
}

export const financialReportApi = {
  get: (seasonId: number) =>
    api.get<FinancialReport>(`/financial-reports/${seasonId}`),

  set: (seasonId: number, payload: { totalRevenue: number; note?: string }) =>
    api.post<FinancialReport>(`/financial-reports/${seasonId}`, payload),

  uploadCSV: (seasonId: number, file: File, note?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (note) form.append('note', note)
    return api.postForm<FinancialReport>(`/financial-reports/${seasonId}/csv`, form)
  },
}
```

`api.postForm`이 없으면 `api.ts` 파일을 읽어 기존 `post` 메서드를 참고해 `postForm`을 추가한다:

```typescript
// football/src/services/api.ts에 추가 (post 메서드 옆):
postForm: <T>(url: string, body: FormData): Promise<T> =>
  fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body,
  }).then(handleResponse<T>),
```

`football/src/services/api.ts`를 읽어 실제 구조를 확인한 후 `postForm`을 추가한다.

- [ ] **Step 2: FinancialReportPage.tsx 작성**

```typescript
// football/src/pages/admin/FinancialReportPage.tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { financialReportApi, type FinancialReport } from '@/services/financial-report.service'
import { seasonApi } from '@/services/season.service'
import type { WageCapKPI } from '@/types/season'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export function FinancialReportPage() {
  const { t } = useTranslation('admin')
  const [activeSeason, setActiveSeason] = useState<{ id: number; name: string } | null>(null)
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [kpi, setKpi] = useState<WageCapKPI | null>(null)
  const [revenue, setRevenue] = useState('')
  const [note, setNote] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    try {
      const season = await seasonApi.active()
      if (!season) { setActiveSeason(null); return }
      setActiveSeason(season)
      const [rep, k] = await Promise.allSettled([
        financialReportApi.get(season.id),
        seasonApi.getWageCapKPI(),
      ])
      setReport(rep.status === 'fulfilled' ? rep.value : null)
      setKpi(k.status === 'fulfilled' ? k.value : null)
      if (rep.status === 'fulfilled') setRevenue(rep.value.totalRevenue.toString())
    } catch {
      toast.error(t('financialReport.loadFailed'))
    }
  }

  useEffect(() => { void fetchAll() }, [])

  const handleManualSave = async () => {
    if (!activeSeason) return
    const totalRevenue = parseInt(revenue, 10)
    if (isNaN(totalRevenue) || totalRevenue <= 0) {
      toast.error(t('financialReport.invalidRevenue'))
      return
    }
    setSaving(true)
    try {
      await financialReportApi.set(activeSeason.id, { totalRevenue, note: note || undefined })
      toast.success(t('financialReport.saved'))
      void fetchAll()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('financialReport.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleCSVUpload = async () => {
    if (!activeSeason || !csvFile) return
    setSaving(true)
    try {
      await financialReportApi.uploadCSV(activeSeason.id, csvFile, note || undefined)
      toast.success(t('financialReport.csvSaved'))
      setCsvFile(null)
      void fetchAll()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('financialReport.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (!activeSeason) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">{t('financialReport.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('financialReport.noActiveSeason')}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold">{t('financialReport.title')} — {activeSeason.name}</h1>

      {/* KPI 스탯 */}
      {kpi && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t('financialReport.kpi.totalPayroll'), value: fmt(kpi.totalPayroll) },
            { label: t('financialReport.kpi.cap'), value: kpi.cap != null ? fmt(kpi.cap) : '-' },
            { label: t('financialReport.kpi.percentUsed'), value: kpi.percentUsed != null ? `${kpi.percentUsed}%` : '-' },
            { label: t('financialReport.kpi.remaining'), value: kpi.remaining != null ? fmt(kpi.remaining) : '-' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border p-3 space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 수동 입력 */}
      <div className="space-y-3 border rounded-lg p-4">
        <h2 className="text-sm font-semibold">{t('financialReport.manualEntry')}</h2>
        {report && (
          <p className="text-xs text-muted-foreground">
            {t('financialReport.lastUpdated', { date: new Date(report.updatedAt).toLocaleDateString('ko-KR') })}
          </p>
        )}
        <div className="space-y-1.5">
          <Label>{t('financialReport.totalRevenue')}</Label>
          <Input type="number" min={1} value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="1000000000" />
        </div>
        <div className="space-y-1.5">
          <Label>{t('financialReport.note')}</Label>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('financialReport.notePlaceholder')} />
        </div>
        <Button onClick={() => void handleManualSave()} disabled={saving} className="w-full">
          {t('financialReport.save')}
        </Button>
      </div>

      {/* CSV 업로드 */}
      <div className="space-y-3 border rounded-lg p-4">
        <h2 className="text-sm font-semibold">{t('financialReport.csvUpload')}</h2>
        <p className="text-xs text-muted-foreground">{t('financialReport.csvHint')}</p>
        <div className="space-y-1.5">
          <Label>{t('financialReport.csvFile')}</Label>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button
          onClick={() => void handleCSVUpload()}
          disabled={saving || !csvFile}
          variant="outline"
          className="w-full"
        >
          {t('financialReport.csvSubmit')}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: App.tsx에 라우트 추가**

기존 `import { MealExpensePage }` 아래에:
```typescript
import { FinancialReportPage } from '@/pages/admin/FinancialReportPage'
```

기존 `<Route path="/admin/meal-expenses" ...>` 아래에:
```typescript
<Route path="/admin/financial-report" element={<FinancialReportPage />} />
```

- [ ] **Step 4: AppShell.tsx에 네비게이션 항목 추가**

기존 meal-expenses 항목(to: '/admin/meal-expenses') 아래에:

```typescript
{
  to: '/admin/financial-report',
  label: 'nav.item.financialReport',
  icon: BarChart2,
  section: 'nav.section.management',
  roles: ['ADMIN', 'FRONT_OFFICE'],
  frontOfficeRoles: ['FINANCE_MANAGER'],
},
```

`AppShell.tsx` 상단 import에 `BarChart2`가 없다면 `import { ..., BarChart2 } from 'lucide-react'`에 추가.

- [ ] **Step 5: i18n 키 추가 (ko)**

`football/src/locales/ko/admin.json`에 최상위 수준 키로 추가:

```json
"financialReport": {
  "title": "재무 보고서",
  "loadFailed": "불러오기 실패",
  "noActiveSeason": "활성 시즌이 없습니다.",
  "lastUpdated": "마지막 업데이트: {{date}}",
  "manualEntry": "수동 입력",
  "totalRevenue": "총 수익 (원)",
  "note": "메모",
  "notePlaceholder": "예: 2025/26 시즌 수익",
  "save": "저장",
  "saved": "재무 보고서가 저장됐습니다.",
  "saveFailed": "저장에 실패했습니다.",
  "invalidRevenue": "올바른 수익 금액을 입력하세요.",
  "csvUpload": "CSV 업로드",
  "csvHint": "category,amount 형식의 CSV. 두 번째 컬럼 합계가 총 수익이 됩니다.",
  "csvFile": "CSV 파일",
  "csvSubmit": "CSV로 저장",
  "csvSaved": "CSV에서 재무 보고서가 업데이트됐습니다.",
  "kpi": {
    "totalPayroll": "총 페이롤",
    "cap": "임금 상한",
    "percentUsed": "사용률",
    "remaining": "잔여 한도"
  }
},
"nav": {
  "item": {
    "financialReport": "재무 보고서"
  }
}
```

- [ ] **Step 6: i18n 키 추가 (en)**

`football/src/locales/en/admin.json`에:

```json
"financialReport": {
  "title": "Financial Report",
  "loadFailed": "Failed to load",
  "noActiveSeason": "No active season.",
  "lastUpdated": "Last updated: {{date}}",
  "manualEntry": "Manual Entry",
  "totalRevenue": "Total Revenue (₩)",
  "note": "Note",
  "notePlaceholder": "e.g. 2025/26 season revenue",
  "save": "Save",
  "saved": "Financial report saved.",
  "saveFailed": "Failed to save.",
  "invalidRevenue": "Please enter a valid revenue amount.",
  "csvUpload": "CSV Upload",
  "csvHint": "CSV format: category,amount. The sum of the second column becomes total revenue.",
  "csvFile": "CSV File",
  "csvSubmit": "Upload CSV",
  "csvSaved": "Financial report updated from CSV.",
  "kpi": {
    "totalPayroll": "Total Payroll",
    "cap": "Wage Cap",
    "percentUsed": "Utilization",
    "remaining": "Remaining"
  }
},
"nav": {
  "item": {
    "financialReport": "Financial Report"
  }
}
```

주의: `nav.item.financialReport` 키가 AppShell.tsx에서 참조되는 네임스페이스 경로와 정확히 일치해야 한다. AppShell.tsx가 `useTranslation('common')`을 쓴다면 `common.json`에, `useTranslation('admin')`이면 `admin.json`에 추가한다. 실제 파일을 읽어 확인 후 올바른 위치에 추가한다.

- [ ] **Step 7: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 8: Vite 빌드 확인**

```bash
cd /Users/juno/work/football/football && npx vite build 2>&1 | grep -E "error|✓ built"
```

Expected: `✓ built in ...`

- [ ] **Step 9: Commit**

```bash
cd /Users/juno/work/football
git add football/src/services/financial-report.service.ts football/src/pages/admin/FinancialReportPage.tsx football/src/App.tsx football/src/layouts/AppShell.tsx football/src/locales/
git commit -m "feat(financial-report): FE 재무보고서 + 임금 KPI 페이지"
```

---

## Self-Review

**Spec coverage:**
- [x] FinancialReport CSV import → Task 2 (CSV 업로드 엔드포인트), Task 6 (FE CSV 업로드)
- [x] RATIO 임금상한 → Task 3 (Season wage cap 설정 API), Task 4 (WageCapService RATIO 계산)
- [x] KPI 대시보드 → Task 3 (KPI 엔드포인트), Task 6 (KPI 스탯 카드)
- [x] FinancialReport 없을 때 graceful degradation → Task 4 (RATIO OK 반환)
- [x] ADMIN only write → Task 2, 3 (컨트롤러 role guard)

**Placeholder 없음.** 모든 코드 블록은 실제 동작하는 코드.

**타입 일관성:**
- `WageCapKPI` → Task 5에서 정의, Task 6 FE에서 소비
- `financialReportApi.uploadCSV` → `api.postForm` 필요 — Task 6 Step 1에서 확인 후 추가
- `seasonApi.active()` → 기존 `Season | null` 반환, Task 5 타입 확장 후에도 null 가능

**주의사항:**
- Task 5의 `seasonsPage.table` i18n 키가 기존 파일에 이미 있을 수 있음 — 실제 파일을 읽어 중복 없이 머지
- Task 6의 `nav.item.financialReport` 키가 어느 네임스페이스에 있는지 AppShell.tsx를 먼저 읽어 확인
