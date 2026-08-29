# Auto-Fill Revenue from N-Season CLOSED Average — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `autoFillRevenueFromPrevSeason` 을 재작성해서 **직전 1개 시즌 실적**이 아닌 **최근 N개 CLOSED 시즌의 실제 매출 평균**으로 타깃 시즌 `FinancialReport` 의 `plannedRevenue*` 필드를 채운다. N default=3, query param `?lookback=N` 로 조정 가능. 실제 매출 집계 로직은 공용 헬퍼 `getSeasonRevenueActuals(seasonId)` 로 뽑아, PR C (budget-automation CAGR) 에서도 재사용할 수 있게 한다.

**Architecture:** 백엔드 서비스 로직 리팩 + 신규 lib 헬퍼 1개. 스키마 변경 없음. `POST /financial-reports/:seasonId/revenue/auto-fill` 의 시맨틱만 변경 (직전 1개 → 최근 N개 CLOSED 평균). `POST /financial-reports/:seasonId/from-prev-season` 는 explicit override 로 남긴다 (기존 body `{ prevSeasonId }` 유지). 대시보드 `/finance` 핸들러의 인라인 집계는 신규 헬퍼로 대체.

**Tech Stack:** Express + Prisma + Jest. TypeScript strict. Zero new dependencies.

**Scope 제한:**
- Prisma 스키마 변경 없음 (`SeasonStatus.CLOSED` 이미 존재)
- Budget-automation CAGR (`autoGenerateBudgetPlan`) 은 이 plan 밖 (PR C)
- 프론트엔드 변경 없음 — 버튼/UI 는 기존 그대로
- `POST /:seasonId/from-prev-season` 시맨틱 (단일 시즌 지정) 유지

---

## File Structure

**Modified:**
- `apps/api/src/financial-report/financial-report.service.ts` — `autoFillRevenueFromPrevSeason` → `autoFillRevenueFromPrevSeasons(seasonId, lookback = 3)` 재작성. `setFromPrevSeasonActuals` 는 헬퍼 사용하도록 재구성.
- `apps/api/src/financial-report/financial-report.controller.ts` — `autoFillRevenue` 핸들러가 `req.query.lookback` 읽어 서비스로 전달.
- `apps/api/src/dashboard/dashboard.routes.ts` — `/finance` 핸들러 인라인 집계 삭제, `getSeasonRevenueActuals` 호출로 대체 (BROADCAST/SUBSIDY/PARENT_COMPANY 는 `FinancialReport` 에서 계속 읽음).

**New:**
- `apps/api/src/lib/season-actuals.ts` — `getSeasonRevenueActuals(seasonId)` 공용 헬퍼.
- `apps/api/__test__/lib/season-actuals.test.ts` — 헬퍼 단위 테스트 (mocked prisma).
- `apps/api/__test__/financial-report/auto-fill-n-season.test.ts` — 서비스 averaging 단위 테스트 (mocked repo + helper).

**참고 (변경 없음):**
- `apps/api/src/financial-report/financial-report.repo.ts` — `upsert(seasonId, totalRevenue, note, breakdown, changedById?)` 그대로 사용해서 8개 `plannedRevenue*` 필드 씀.
- `apps/api/src/financial-report/financial-report.routes.ts` — 라우팅 그대로 (`POST /:seasonId/revenue/auto-fill`, `POST /:seasonId/from-prev-season`).
- `apps/api/src/generated/enums.ts` — `SeasonStatus.CLOSED` 이미 존재.

---

## Task 1: `getSeasonRevenueActuals` 헬퍼 생성

**Files:**
- Create: `apps/api/src/lib/season-actuals.ts`

- [ ] **Step 1: 헬퍼 파일 작성**

```typescript
// apps/api/src/lib/season-actuals.ts
import { getPrisma } from "./prisma";
import { AppError } from "./appError";

/**
 * 특정 시즌의 실제 매출을 소스 테이블에서 집계한다.
 * - Ticket:        SalesRecord TICKET+VIP_TICKET, Match.seasonId 매칭
 * - Sponsorship:   SponsorshipPayment PAID, paidAt in season window
 * - Merchandise:   SalesRecord UNIFORM, saleDate in season window
 * - Other:         SalesRecord OTHER,   saleDate in season window
 * - AcademyFee:    LedgerEntry ACADEMY_FEE INCOME, createdAt in season window
 * - Broadcast/Subsidy/ParentCompany: 소스 테이블 없음. 0 반환. (수동 입력만.)
 *
 * PR C (budget-automation CAGR) 에서도 재사용됨.
 */
export interface SeasonRevenueActuals {
  plannedRevenueTicket: number;
  plannedRevenueSponsorship: number;
  plannedRevenueMerchandise: number;
  plannedRevenueOther: number;
  plannedRevenueAcademyFee: number;
  plannedRevenueBroadcast: number;      // always 0 — manual entry only
  plannedRevenueSubsidy: number;        // always 0 — manual entry only
  plannedRevenueParentCompany: number;  // always 0 — manual entry only
}

export async function getSeasonRevenueActuals(seasonId: number): Promise<SeasonRevenueActuals> {
  const prisma = getPrisma();

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { startDate: true, endDate: true },
  });
  if (!season) throw new AppError(404, "SEASON_NOT_FOUND");

  const [ticketAgg, uniformAgg, otherAgg, sponsorAgg, academyFeeAgg] = await Promise.all([
    prisma.salesRecord.aggregate({
      where: {
        type: { in: ["TICKET", "VIP_TICKET"] as any[] },
        match: { seasonId },
        deletedAt: null,
      } as any,
      _sum: { totalAmount: true },
    }),
    prisma.salesRecord.aggregate({
      where: {
        type: "UNIFORM",
        saleDate: { gte: season.startDate, lte: season.endDate },
        deletedAt: null,
      } as any,
      _sum: { totalAmount: true },
    }),
    prisma.salesRecord.aggregate({
      where: {
        type: "OTHER",
        saleDate: { gte: season.startDate, lte: season.endDate },
        deletedAt: null,
      } as any,
      _sum: { totalAmount: true },
    }),
    prisma.sponsorshipPayment.aggregate({
      where: { status: "PAID", paidAt: { gte: season.startDate, lte: season.endDate } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        category: "ACADEMY_FEE",
        type: "INCOME",
        createdAt: { gte: season.startDate, lte: season.endDate },
      },
      _sum: { amountKrw: true },
    }),
  ]);

  return {
    plannedRevenueTicket:        Number((ticketAgg._sum as any).totalAmount ?? 0),
    plannedRevenueSponsorship:   Number(sponsorAgg._sum.amount ?? 0),
    plannedRevenueMerchandise:   Number((uniformAgg._sum as any).totalAmount ?? 0),
    plannedRevenueOther:         Number((otherAgg._sum as any).totalAmount ?? 0),
    plannedRevenueAcademyFee:    Number(academyFeeAgg._sum.amountKrw ?? 0),
    plannedRevenueBroadcast:     0,
    plannedRevenueSubsidy:       0,
    plannedRevenueParentCompany: 0,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/lib/season-actuals.ts
git commit -m "feat(finance): add getSeasonRevenueActuals helper for per-season aggregate"
```

---

## Task 2: 헬퍼 단위 테스트

**Files:**
- Create: `apps/api/__test__/lib/season-actuals.test.ts`

- [ ] **Step 1: mocked prisma 로 헬퍼 테스트**

```typescript
// apps/api/__test__/lib/season-actuals.test.ts
import { getSeasonRevenueActuals } from "../../src/lib/season-actuals";

const mockPrisma = {
  season: { findUnique: jest.fn() },
  salesRecord: { aggregate: jest.fn() },
  sponsorshipPayment: { aggregate: jest.fn() },
  ledgerEntry: { aggregate: jest.fn() },
};
jest.mock("../../src/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.season.findUnique.mockResolvedValue({
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-12-31"),
  });
});

describe("getSeasonRevenueActuals", () => {
  it("aggregates ticket/uniform/other/sponsor/academy and zeroes manual-only fields", async () => {
    // ticketAgg, uniformAgg, otherAgg (in that call order in Promise.all)
    mockPrisma.salesRecord.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 100_000 } })   // ticket
      .mockResolvedValueOnce({ _sum: { totalAmount: 50_000  } })   // uniform
      .mockResolvedValueOnce({ _sum: { totalAmount: 20_000  } });  // other
    mockPrisma.sponsorshipPayment.aggregate.mockResolvedValue({ _sum: { amount: 300_000 } });
    mockPrisma.ledgerEntry.aggregate.mockResolvedValue({ _sum: { amountKrw: 40_000 } });

    const out = await getSeasonRevenueActuals(1);

    expect(out.plannedRevenueTicket).toBe(100_000);
    expect(out.plannedRevenueMerchandise).toBe(50_000);
    expect(out.plannedRevenueOther).toBe(20_000);
    expect(out.plannedRevenueSponsorship).toBe(300_000);
    expect(out.plannedRevenueAcademyFee).toBe(40_000);
    expect(out.plannedRevenueBroadcast).toBe(0);
    expect(out.plannedRevenueSubsidy).toBe(0);
    expect(out.plannedRevenueParentCompany).toBe(0);
  });

  it("returns 0s when no rows exist", async () => {
    mockPrisma.salesRecord.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });
    mockPrisma.sponsorshipPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.ledgerEntry.aggregate.mockResolvedValue({ _sum: { amountKrw: null } });

    const out = await getSeasonRevenueActuals(1);
    expect(out.plannedRevenueTicket).toBe(0);
    expect(out.plannedRevenueSponsorship).toBe(0);
    expect(out.plannedRevenueAcademyFee).toBe(0);
  });

  it("throws SEASON_NOT_FOUND when season missing", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(null);
    await expect(getSeasonRevenueActuals(999)).rejects.toMatchObject({
      status: 404, code: "SEASON_NOT_FOUND",
    });
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/lib/season-actuals.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/__test__/lib/season-actuals.test.ts
git commit -m "test(finance): getSeasonRevenueActuals unit tests"
```

---

## Task 3: 서비스 재작성 — N-시즌 평균

**Files:**
- Modify: `apps/api/src/financial-report/financial-report.service.ts`

- [ ] **Step 1: import 추가**

```typescript
// 파일 상단 import 블록에 추가
import { getSeasonRevenueActuals } from "../lib/season-actuals";
import { SeasonStatus } from "../generated/client";
```

- [ ] **Step 2: `autoFillRevenueFromPrevSeason` → `autoFillRevenueFromPrevSeasons` 재작성**

기존 `autoFillRevenueFromPrevSeason(seasonId)` 메서드 전체를 아래로 교체:

```typescript
/**
 * 타깃 시즌 startDate 이전에 종료된 CLOSED 시즌 중 최근 N개를 골라
 * getSeasonRevenueActuals 로 필드별 평균을 계산 → repo.upsert 로 저장.
 *
 * @param seasonId 타깃 시즌
 * @param lookback 조회할 최대 CLOSED 시즌 개수 (default 3)
 * @throws AppError(404, "SEASON_NOT_FOUND")   타깃 시즌 없음
 * @throws AppError(404, "NO_PREV_SEASON")     CLOSED 시즌 0개
 */
async autoFillRevenueFromPrevSeasons(seasonId: number, lookback = 3) {
  if (!Number.isInteger(lookback) || lookback < 1) {
    throw new AppError(400, "INVALID_LOOKBACK");
  }

  const prisma = getPrisma();

  const target = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { startDate: true },
  });
  if (!target) throw new AppError(404, "SEASON_NOT_FOUND");

  // CLOSED 시즌 중 endDate < target.startDate, endDate 내림차순 최대 N개
  const prevSeasons = await prisma.season.findMany({
    where: {
      status: SeasonStatus.CLOSED,
      endDate: { lt: target.startDate },
    },
    orderBy: { endDate: "desc" },
    take: lookback,
    select: { id: true },
  });
  if (prevSeasons.length === 0) throw new AppError(404, "NO_PREV_SEASON");

  // 각 시즌 actuals 를 병렬 조회
  const actualsList = await Promise.all(
    prevSeasons.map((s) => getSeasonRevenueActuals(s.id))
  );
  const n = actualsList.length;

  // 8개 필드별 평균 (반올림)
  const avg = (pick: (a: (typeof actualsList)[number]) => number) =>
    Math.round(actualsList.reduce((sum, a) => sum + pick(a), 0) / n);

  const breakdown: RevenueBreakdownDto = {
    plannedRevenueTicket:        avg((a) => a.plannedRevenueTicket),
    plannedRevenueSponsorship:   avg((a) => a.plannedRevenueSponsorship),
    plannedRevenueMerchandise:   avg((a) => a.plannedRevenueMerchandise),
    plannedRevenueOther:         avg((a) => a.plannedRevenueOther),
    plannedRevenueAcademyFee:    avg((a) => a.plannedRevenueAcademyFee),
    plannedRevenueBroadcast:     0,
    plannedRevenueSubsidy:       0,
    plannedRevenueParentCompany: 0,
  };

  const total = sumBreakdown(breakdown);
  const note = `최근 ${n}개 CLOSED 시즌 실적 평균 (요청 lookback=${lookback}, 시즌 ID=${prevSeasons.map((s) => s.id).join(",")})`;
  return this.repo.upsert(seasonId, total, note, breakdown);
}
```

- [ ] **Step 3: `setFromPrevSeasonActuals` 재구성 (헬퍼 재사용)**

기존 `setFromPrevSeasonActuals(prevSeasonId, newSeasonId)` 의 인라인 집계 로직 전체를 삭제하고 아래로 교체 (헬퍼 사용, 시맨틱은 동일 — 특정 1개 시즌 강제):

```typescript
/**
 * 지정한 단일 시즌(prevSeasonId)의 실적을 그대로 새 시즌으로 복사.
 * `POST /:seasonId/from-prev-season` 에서 사용 (수동 override).
 * N-시즌 평균은 autoFillRevenueFromPrevSeasons 사용.
 */
async setFromPrevSeasonActuals(prevSeasonId: number, newSeasonId: number) {
  const actuals = await getSeasonRevenueActuals(prevSeasonId);   // throws 404 if missing
  const breakdown: RevenueBreakdownDto = { ...actuals };
  const total = sumBreakdown(breakdown);
  const note = `전년도(시즌 ${prevSeasonId}) 실적 기반 자동 생성`;
  return this.repo.upsert(newSeasonId, total, note, breakdown);
}
```

> **Note:** 기존 로직은 `SEASON_NOT_FOUND` 대신 `PREV_SEASON_NOT_FOUND` 를 throw 했음. 헬퍼는 `SEASON_NOT_FOUND` 를 던진다. 이건 컨트롤러 응답 코드는 동일(404) 이지만 에러 코드 문자열이 바뀌므로, 컨트롤러 위치에서 다시 감싸든가 하위 호환을 원하면 헬퍼 호출을 try/catch 해서 remap 하기 (아래 Step 4). **결정: remap 해서 하위 호환 유지.**

- [ ] **Step 4: `setFromPrevSeasonActuals` 에러 코드 remap**

```typescript
async setFromPrevSeasonActuals(prevSeasonId: number, newSeasonId: number) {
  let actuals;
  try {
    actuals = await getSeasonRevenueActuals(prevSeasonId);
  } catch (e: any) {
    if (e?.code === "SEASON_NOT_FOUND") throw new AppError(404, "PREV_SEASON_NOT_FOUND");
    throw e;
  }
  const breakdown: RevenueBreakdownDto = { ...actuals };
  const total = sumBreakdown(breakdown);
  const note = `전년도(시즌 ${prevSeasonId}) 실적 기반 자동 생성`;
  return this.repo.upsert(newSeasonId, total, note, breakdown);
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/financial-report/financial-report.service.ts
git commit -m "refactor(finance): auto-fill revenue from N CLOSED seasons average"
```

---

## Task 4: 컨트롤러 — `?lookback=N` query 지원

**Files:**
- Modify: `apps/api/src/financial-report/financial-report.controller.ts`

- [ ] **Step 1: `autoFillRevenue` 핸들러 교체**

기존:

```typescript
autoFillRevenue = async (req, res, next) => {
  ...
  const report = await this.service.autoFillRevenueFromPrevSeason(seasonId);
  ...
}
```

교체:

```typescript
autoFillRevenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole } = requireUser(req);
    if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
    const seasonId = Number(req.params["seasonId"]);

    // ?lookback=N (default 3). 유효하지 않으면 default fallback.
    const raw = req.query["lookback"];
    const parsed = raw !== undefined ? Number(raw) : NaN;
    const lookback = Number.isInteger(parsed) && parsed >= 1 ? parsed : 3;

    const report = await this.service.autoFillRevenueFromPrevSeasons(seasonId, lookback);
    res.status(200).json(report);
  } catch (err) { next(err); }
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/financial-report/financial-report.controller.ts
git commit -m "feat(finance): support ?lookback=N on POST /revenue/auto-fill"
```

---

## Task 5: 서비스 averaging 단위 테스트

**Files:**
- Create: `apps/api/__test__/financial-report/auto-fill-n-season.test.ts`

- [ ] **Step 1: 디렉토리 생성 + 테스트 파일 작성**

```bash
mkdir -p /Users/juno/work/football/apps/api/__test__/financial-report
```

```typescript
// apps/api/__test__/financial-report/auto-fill-n-season.test.ts
import { FinancialReportService } from "../../src/financial-report/financial-report.service";
import { KnapsackService } from "../../src/budget/knapsack.service";
import type { FinancialReportRepository } from "../../src/financial-report/financial-report.repo";

const mockPrisma = {
  season: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};
jest.mock("../../src/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

const mockGetActuals = jest.fn();
jest.mock("../../src/lib/season-actuals", () => ({
  getSeasonRevenueActuals: (id: number) => mockGetActuals(id),
}));

function makeRepo(): FinancialReportRepository {
  return {
    findBySeasonId: jest.fn(),
    upsert: jest.fn().mockResolvedValue({}),
    upsertBudgetPlan: jest.fn(),
    getBudgetPlan: jest.fn(),
    saveOptimizeResult: jest.fn(),
    addOverrideLog: jest.fn(),
    getActuals: jest.fn(),
  } as unknown as FinancialReportRepository;
}

const ZERO_MANUAL = {
  plannedRevenueBroadcast: 0,
  plannedRevenueSubsidy: 0,
  plannedRevenueParentCompany: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.season.findUnique.mockResolvedValue({ startDate: new Date("2027-01-01") });
});

describe("FinancialReportService.autoFillRevenueFromPrevSeasons", () => {
  it("averages 3 CLOSED seasons by field (default lookback=3)", async () => {
    mockPrisma.season.findMany.mockResolvedValue([{ id: 30 }, { id: 20 }, { id: 10 }]);
    mockGetActuals
      .mockResolvedValueOnce({ plannedRevenueTicket: 300, plannedRevenueSponsorship: 900, plannedRevenueMerchandise: 60, plannedRevenueOther: 30, plannedRevenueAcademyFee: 120, ...ZERO_MANUAL })
      .mockResolvedValueOnce({ plannedRevenueTicket: 200, plannedRevenueSponsorship: 600, plannedRevenueMerchandise: 30, plannedRevenueOther: 0,  plannedRevenueAcademyFee: 90,  ...ZERO_MANUAL })
      .mockResolvedValueOnce({ plannedRevenueTicket: 100, plannedRevenueSponsorship: 300, plannedRevenueMerchandise: 0,  plannedRevenueOther: 0,  plannedRevenueAcademyFee: 60,  ...ZERO_MANUAL });

    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService());

    await svc.autoFillRevenueFromPrevSeasons(99);

    expect(mockPrisma.season.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "CLOSED", endDate: { lt: new Date("2027-01-01") } }),
      take: 3,
    }));
    const [seasonIdArg, totalArg, noteArg, breakdownArg] = (repo.upsert as jest.Mock).mock.calls[0];
    expect(seasonIdArg).toBe(99);
    expect(breakdownArg.plannedRevenueTicket).toBe(200);       // (300+200+100)/3
    expect(breakdownArg.plannedRevenueSponsorship).toBe(600);  // (900+600+300)/3
    expect(breakdownArg.plannedRevenueMerchandise).toBe(30);   // (60+30+0)/3
    expect(breakdownArg.plannedRevenueOther).toBe(10);         // (30+0+0)/3
    expect(breakdownArg.plannedRevenueAcademyFee).toBe(90);    // (120+90+60)/3
    expect(breakdownArg.plannedRevenueBroadcast).toBe(0);
    expect(totalArg).toBe(200 + 600 + 30 + 10 + 90);
    expect(noteArg).toContain("3개 CLOSED 시즌");
  });

  it("falls back to however many CLOSED seasons exist when fewer than lookback", async () => {
    mockPrisma.season.findMany.mockResolvedValue([{ id: 5 }]);   // only 1
    mockGetActuals.mockResolvedValueOnce({
      plannedRevenueTicket: 100, plannedRevenueSponsorship: 200, plannedRevenueMerchandise: 0,
      plannedRevenueOther: 0, plannedRevenueAcademyFee: 0, ...ZERO_MANUAL,
    });

    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService());
    await svc.autoFillRevenueFromPrevSeasons(99, 3);

    const [, , noteArg, breakdownArg] = (repo.upsert as jest.Mock).mock.calls[0];
    expect(breakdownArg.plannedRevenueTicket).toBe(100);   // /1 not /3
    expect(noteArg).toContain("1개 CLOSED 시즌");
  });

  it("throws NO_PREV_SEASON when 0 CLOSED seasons exist", async () => {
    mockPrisma.season.findMany.mockResolvedValue([]);
    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService());
    await expect(svc.autoFillRevenueFromPrevSeasons(99)).rejects.toMatchObject({
      status: 404, code: "NO_PREV_SEASON",
    });
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("throws SEASON_NOT_FOUND when target season missing", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(null);
    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService());
    await expect(svc.autoFillRevenueFromPrevSeasons(99)).rejects.toMatchObject({
      status: 404, code: "SEASON_NOT_FOUND",
    });
  });

  it("respects lookback=5 override", async () => {
    mockPrisma.season.findMany.mockResolvedValue([{ id: 50 }, { id: 40 }, { id: 30 }, { id: 20 }, { id: 10 }]);
    mockGetActuals.mockResolvedValue({
      plannedRevenueTicket: 100, plannedRevenueSponsorship: 0, plannedRevenueMerchandise: 0,
      plannedRevenueOther: 0, plannedRevenueAcademyFee: 0, ...ZERO_MANUAL,
    });

    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService());
    await svc.autoFillRevenueFromPrevSeasons(99, 5);

    expect(mockPrisma.season.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(mockGetActuals).toHaveBeenCalledTimes(5);
  });

  it("rejects invalid lookback (<1 or non-integer)", async () => {
    const repo = makeRepo();
    const svc = new FinancialReportService(repo, new KnapsackService());
    await expect(svc.autoFillRevenueFromPrevSeasons(99, 0)).rejects.toMatchObject({
      status: 400, code: "INVALID_LOOKBACK",
    });
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/financial-report/auto-fill-n-season.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/__test__/financial-report/auto-fill-n-season.test.ts
git commit -m "test(finance): N-season averaging auto-fill (default/fallback/error/override)"
```

---

## Task 6: 대시보드 `/finance` 핸들러 refactor

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.routes.ts`

- [ ] **Step 1: import 추가**

파일 상단 import 블록:

```typescript
import { getSeasonRevenueActuals } from "../lib/season-actuals";
```

- [ ] **Step 2: `/finance` 핸들러 seasonDonut 블록 교체**

기존 `if (seasonId) { const season = await prisma.season.findUnique(...); if (season) { const [ticketAgg, uniformAgg, otherAgg, sponsorAgg, academyAgg, fr] = await Promise.all([...]); seasonDonut = {...}; } }` 전체를 아래로 교체:

```typescript
if (seasonId) {
  // Actuals from source tables via shared helper (PR #311/#312 semantics preserved).
  // Manual-only fields (BROADCAST/SUBSIDY/PARENT_COMPANY) still come from FinancialReport
  // since they have no system-of-record source.
  const [actuals, fr] = await Promise.all([
    getSeasonRevenueActuals(seasonId).catch((e) => {
      if (e?.code === "SEASON_NOT_FOUND") return null;
      throw e;
    }),
    prisma.financialReport.findUnique({
      where: { seasonId },
      select: { plannedRevenueBroadcast: true, plannedRevenueSubsidy: true, plannedRevenueParentCompany: true },
    }),
  ]);
  if (actuals) {
    seasonDonut = {
      TICKET:         actuals.plannedRevenueTicket,
      SPONSORSHIP:    actuals.plannedRevenueSponsorship,
      BROADCAST:      fr?.plannedRevenueBroadcast ?? 0,
      MERCHANDISE:    actuals.plannedRevenueMerchandise,
      SUBSIDY:        fr?.plannedRevenueSubsidy ?? 0,
      PARENT_COMPANY: fr?.plannedRevenueParentCompany ?? 0,
      ACADEMY_FEE:    actuals.plannedRevenueAcademyFee,
      OTHER:          actuals.plannedRevenueOther,
    };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/dashboard/dashboard.routes.ts
git commit -m "refactor(dashboard): use getSeasonRevenueActuals in /finance endpoint"
```

---

## Task 7: 타입 확인 + 회귀 sanity check

**Files:**
- (verification only)

- [ ] **Step 1: TypeScript strict check**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -40
```

Expected: no output.

- [ ] **Step 2: 두 새 테스트 파일 실행**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/lib/season-actuals.test.ts __test__/financial-report/auto-fill-n-season.test.ts
```

Expected: all green.

- [ ] **Step 3: 기존 서비스 관련 테스트 회귀**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/budget/auto-generate.service.test.ts __test__/dashboard/
```

- [ ] **Step 4: 수동 sanity — dashboard `/finance` seasonId=CLOSED-시즌 응답이 예전 PR #311/#312 결과와 동일 필드 값인지 curl 로 확인**

```bash
# 참고: FE 에서 시즌 스위치했을 때 도넛 차트가 이전과 동일하게 그려지는지 시각 확인.
# curl 은 프로젝트 auth flow 에 따라 pass — 재로그인 후 스크린샷 비교.
```

---

## Task 8: PR 생성

- [ ] **Step 1: 브랜치, push, PR**

```bash
git checkout -b feat/auto-fill-n-season-average
# ... 모든 커밋 완료 후
git push -u origin feat/auto-fill-n-season-average
gh pr create --title "feat(financial-report): auto-fill from N-season CLOSED average (default 3)" \
  --body "$(cat <<'EOF'
## Summary
- `POST /financial-reports/:seasonId/revenue/auto-fill` 이 이제 최근 N개 CLOSED 시즌 실적의 필드별 평균으로 `plannedRevenue*` 을 채움 (기존: 직전 1개 시즌 단순 복사).
- `?lookback=N` query param 지원 (default 3, min 1). CLOSED 시즌이 N개 미만이면 있는 만큼만 평균. 0개면 404 `NO_PREV_SEASON`.
- 실적 집계 로직을 `apps/api/src/lib/season-actuals.ts` 로 분리, 대시보드 `/finance` 핸들러도 동일 헬퍼로 refactor.
- `POST /:seasonId/from-prev-season` (수동 단일 시즌 override) 시맨틱 유지 — 헬퍼만 재사용하도록 내부 리팩.

## Notes
- Prisma 스키마 변경 없음.
- PR C (`autoGenerateBudgetPlan` CAGR) 가 다음 순번이며 이 helper 를 재사용 예정.

## Test plan
- [ ] `npx jest __test__/lib/season-actuals.test.ts` 그린
- [ ] `npx jest __test__/financial-report/auto-fill-n-season.test.ts` 그린
- [ ] `npx tsc --noEmit` clean
- [ ] `/finance` 대시보드에서 CLOSED 시즌 선택 시 도넛 차트 동일 값 확인 (PR #311/#312 회귀 없음)
- [ ] `POST /financial-reports/:seasonId/revenue/auto-fill` (default), `?lookback=5`, `?lookback=1` 모두 200
- [ ] CLOSED 시즌 0개인 신규 클럽 seed 에서 404 `NO_PREV_SEASON` 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: 머지 후 PR C (budget-automation CAGR) 진행**

`docs/superpowers/plans/2026-08-22-budget-automation.md` 참조 — 동일 헬퍼 `getSeasonRevenueActuals` 재사용.

---

## Self-Review

**Spec coverage (Q14 결정 매핑):**
- Q14a: N default = 3, `?lookback=N` 지원 — Task 3 Step 2 + Task 4 Step 1
- Q14b: CLOSED 시즌만 참여 — Task 3 Step 2 `status: SeasonStatus.CLOSED`
- Q14c: N 미만이면 있는 만큼 (min 1) — Task 3 Step 2 (`take: lookback`, 반환 배열 길이만큼 나눔) + Task 5 fallback 테스트
- Q14d: 0개면 `AppError(404, "NO_PREV_SEASON")` — Task 3 Step 2 + Task 5 error 테스트
- Q14e: 공용 헬퍼 `getSeasonRevenueActuals` in `apps/api/src/lib/season-actuals.ts` — Task 1
- Q14f: PR C 에서 재사용 가능한 계약 — helper interface 는 8개 `plannedRevenue*` 필드 반환 (Task 1 Step 1)

**Non-goals:**
- Prisma 스키마 변경 없음 (`SeasonStatus.CLOSED` 이미 존재)
- 프론트엔드 변경 없음 — 기존 auto-fill 버튼은 default lookback=3 로 그대로 동작
- `autoGenerateBudgetPlan` CAGR 은 이 PR 밖 (PR C)
- 새 endpoint 추가 없음 — 기존 2개 endpoint 재사용

**Follow-ups (별도 이슈):**
- PR C (`autoGenerateBudgetPlan` CAGR) 가 `getSeasonRevenueActuals` 를 재사용 — 이 PR 머지가 선행 조건
- FE 힌트: auto-fill 버튼 클릭 후 응답 note 필드 (`"최근 3개 CLOSED 시즌 실적 평균 (시즌 ID=30,20,10)"`) 를 toast 로 표시하면 사용자에게 어떤 N개 시즌이 평균에 참여했는지 보여줄 수 있음
- CLOSED 시즌 수가 매우 많은 경우 lookback 상한(예: 10) 검증 — 지금은 무제한이지만 실무상 의미 없는 큰 값 방지
- `POST /:seasonId/from-prev-season` 은 그대로 두었지만 새 auto-fill 로 대부분 대체되므로 향후 deprecation 후보
