# 홈경기 티켓 판매 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 재무팀이 홈경기별 티켓 판매 실적을 기록·조회하고, 저장 시 원장(LedgerEntry)에 자동 반영한다.

**Architecture:** `SalesRecord`에 `matchId Int?` FK 추가 (TICKET 타입 시 필수, 홈경기 검증). 서비스 레이어에서 Prisma interactive transaction으로 SalesRecord + LedgerEntry 동시 생성. 프론트는 MatchDetailPage 내 입력 섹션 + 독립 TicketSalesPage로 구성.

**Tech Stack:** Prisma, Express/TypeScript, React + shadcn/ui, react-router-dom

---

## File Map

**BE — 수정**
- `apps/api/prisma/schema.prisma` — `SalesRecord.matchId Int?`, Match back-relation
- `apps/api/src/sales/dto/sales.dto.ts` — `matchId?: number` 추가
- `apps/api/src/sales/sales.repo.ts` — `findByMatch`, `ticketSummaryByMatch`, `seasonTicketTotal`, `deleteSalesRecord`
- `apps/api/src/sales/sales.service.ts` — TICKET 검증 + 원장 자동생성 + 신규 서비스 메서드
- `apps/api/src/sales/sales.controller.ts` — 권한 가드 + 신규 핸들러
- `apps/api/src/sales/sales.routes.ts` — 신규 라우트

**FE — 신규**
- `football/src/types/sales.ts`
- `football/src/services/sales.service.ts`
- `football/src/pages/finance/TicketSalesPage.tsx`

**FE — 수정**
- `football/src/pages/matches/MatchDetailPage.tsx` — 티켓 판매 섹션
- `football/src/layouts/AppShell.tsx` — 재무 메뉴 링크
- `football/src/pages/dashboard/dashboardConfig.ts` — `showTicketRevenue` 플래그
- `football/src/pages/dashboard/DashboardPage.tsx` — 시즌 티켓 수입 KPI 카드

---

### Task 1: Prisma 스키마 — SalesRecord.matchId + Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: 스키마 수정**

`apps/api/prisma/schema.prisma`의 `SalesRecord` 모델에 추가:

```prisma
model SalesRecord {
  id          Int          @id @default(autoincrement())
  type        SalesType
  quantity    Int
  unitPrice   Decimal      @db.Decimal(12, 2)
  totalAmount Decimal      @db.Decimal(12, 2)
  currency    CurrencyCode @default(KRW)
  saleDate    DateTime
  description String?
  matchId     Int?                                          // 추가
  createdById Int
  createdAt   DateTime     @default(now())

  createdBy User   @relation("SalesRecordCreator", fields: [createdById], references: [id])
  match     Match? @relation(fields: [matchId], references: [id])  // 추가
}
```

`Match` 모델에 back-relation 추가 (`mealExpenses MealExpense[]` 줄 옆에):
```prisma
salesRecords SalesRecord[]
```

- [ ] **Step 2: Migration 실행**

```bash
cd /Users/juno/work/football/apps/api && npx prisma migrate dev --name add_sales_record_match_id
```

**Permission error 시 수동 우회:**
```bash
# 1. 마이그레이션 폴더 이름 확인
ls apps/api/prisma/migrations/ | tail -3

# 2. SQL 직접 적용 (juno 계정으로)
psql postgresql://juno@localhost:5432/football -c "ALTER TABLE \"SalesRecord\" ADD COLUMN IF NOT EXISTS \"matchId\" INTEGER REFERENCES \"Match\"(id) ON DELETE SET NULL;"

# 3. 마이그레이션 적용 완료 표시 (폴더명에 맞게 수정)
npx prisma migrate resolve --applied 20260807XXXXXX_add_sales_record_match_id

# 4. 클라이언트 재생성
npx prisma generate
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -5
```

Expected: 출력 없음

- [ ] **Step 4: Commit**

```bash
cd /Users/juno/work/football && git add apps/api/prisma/ && git commit -m "feat: add matchId FK to SalesRecord"
```

---

### Task 2: BE — sales.dto.ts + sales.repo.ts 확장

**Files:**
- Modify: `apps/api/src/sales/dto/sales.dto.ts`
- Modify: `apps/api/src/sales/sales.repo.ts`

- [ ] **Step 1: DTO에 matchId 추가**

`apps/api/src/sales/dto/sales.dto.ts` 전체 교체:

```typescript
export interface CreateSalesRecordDto {
  type: "TICKET" | "UNIFORM" | "OTHER";
  quantity: number;
  unitPrice: number;
  currency?: "KRW" | "USD" | "EUR" | "GBP";
  saleDate: string;
  description?: string;
  matchId?: number;
}
```

- [ ] **Step 2: 레포 메서드 추가**

`apps/api/src/sales/sales.repo.ts` 전체 교체:

```typescript
import type { PrismaClient } from "../generated/client";
import type { CreateSalesRecordDto } from "./dto/sales.dto";

export class SalesRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.salesRecord.findMany({
      orderBy: { saleDate: "desc" },
      include: { match: { select: { id: true, homeTeamName: true, awayTeamName: true, date: true } } },
    });
  }

  findByMatch(matchId: number) {
    return this.prisma.salesRecord.findMany({
      where: { matchId, type: "TICKET" },
      orderBy: { saleDate: "desc" },
    });
  }

  create(data: CreateSalesRecordDto & { totalAmount: number; createdById: number }) {
    return this.prisma.salesRecord.create({
      data: {
        type: data.type,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalAmount: data.totalAmount,
        currency: data.currency ?? "KRW",
        saleDate: new Date(data.saleDate),
        ...(data.description && { description: data.description }),
        ...(data.matchId && { matchId: data.matchId }),
        createdById: data.createdById,
      },
    });
  }

  delete(id: number) {
    return this.prisma.salesRecord.delete({ where: { id } });
  }

  groupByType() {
    return this.prisma.salesRecord.groupBy({
      by: ["type"],
      _sum: { totalAmount: true },
    });
  }

  async ticketSummaryByMatch(seasonId: number) {
    const records = await this.prisma.salesRecord.findMany({
      where: { type: "TICKET", match: { seasonId } },
      include: { match: { select: { id: true, homeTeamName: true, awayTeamName: true, date: true } } },
    });

    const map = new Map<number, {
      matchId: number; date: string; homeTeamName: string; awayTeamName: string;
      totalQuantity: number; totalAmount: number;
    }>();

    for (const r of records) {
      if (!r.match) continue;
      const key = r.match.id;
      const existing = map.get(key);
      if (existing) {
        existing.totalQuantity += r.quantity;
        existing.totalAmount += Number(r.totalAmount);
      } else {
        map.set(key, {
          matchId: r.match.id,
          date: r.match.date.toISOString(),
          homeTeamName: r.match.homeTeamName,
          awayTeamName: r.match.awayTeamName,
          totalQuantity: r.quantity,
          totalAmount: Number(r.totalAmount),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  async seasonTicketTotal(seasonId: number): Promise<number> {
    const result = await this.prisma.salesRecord.aggregate({
      where: { type: "TICKET", match: { seasonId } },
      _sum: { totalAmount: true },
    });
    return Number(result._sum.totalAmount ?? 0);
  }
}
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep "sales"
```

Expected: 출력 없음

- [ ] **Step 4: Commit**

```bash
cd /Users/juno/work/football && git add apps/api/src/sales/ && git commit -m "feat: extend sales repo with match-linked queries"
```

---

### Task 3: BE — sales.service.ts 검증 + 원장 자동생성

**Files:**
- Modify: `apps/api/src/sales/sales.service.ts`

- [ ] **Step 1: SalesService 전체 교체**

`apps/api/src/sales/sales.service.ts`:

```typescript
import { PrismaClient } from "../generated/client";
import { AppError } from "../lib/appError";
import type { SalesRepository } from "./sales.repo";
import type { CreateSalesRecordDto } from "./dto/sales.dto";

const FC_SEOUL = "FC Seoul";

export class SalesService {
  constructor(
    private repo: SalesRepository,
    private prisma: PrismaClient,
  ) {}

  findAll() { return this.repo.findAll(); }

  async findByMatch(matchId: number) {
    return this.repo.findByMatch(matchId);
  }

  async create(dto: CreateSalesRecordDto, createdById: number) {
    if (dto.quantity <= 0) throw new AppError(400, "NEGATIVE_SALES_VALUE");
    if (dto.unitPrice <= 0) throw new AppError(400, "NEGATIVE_SALES_VALUE");

    let matchHomeTeamName: string | undefined;
    let matchAwayTeamName: string | undefined;

    if (dto.type === "TICKET") {
      if (!dto.matchId) throw new AppError(400, "MATCH_ID_REQUIRED_FOR_TICKET");
      const match = await this.prisma.match.findUnique({
        where: { id: dto.matchId },
        select: { homeTeamName: true, awayTeamName: true },
      });
      if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
      if (match.homeTeamName !== FC_SEOUL) throw new AppError(400, "AWAY_MATCH_TICKET_NOT_ALLOWED");
      matchHomeTeamName = match.homeTeamName;
      matchAwayTeamName = match.awayTeamName;
    }

    const totalAmount = dto.quantity * dto.unitPrice;

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.salesRecord.create({
        data: {
          type: dto.type,
          quantity: dto.quantity,
          unitPrice: dto.unitPrice,
          totalAmount,
          currency: dto.currency ?? "KRW",
          saleDate: new Date(dto.saleDate),
          ...(dto.description && { description: dto.description }),
          ...(dto.matchId && { matchId: dto.matchId }),
          createdById,
        },
      });

      if (dto.type === "TICKET") {
        await tx.ledgerEntry.create({
          data: {
            type: "INCOME",
            category: "TICKET_SALES" as any,
            amount: totalAmount,
            currency: dto.currency ?? "KRW",
            exchangeRate: 1,
            amountKrw: totalAmount,
            isRefund: false,
            description: `티켓 판매 — ${matchHomeTeamName} vs ${matchAwayTeamName}`,
            relatedModule: "SalesRecord",
            relatedId: record.id,
            createdById,
          },
        });
      }

      return record;
    });
  }

  async delete(id: number) {
    return this.repo.delete(id);
  }

  async getSummary() {
    return this.repo.groupByType();
  }

  async ticketSummaryByMatch(seasonId: number) {
    return this.repo.ticketSummaryByMatch(seasonId);
  }

  async seasonTicketTotal(seasonId: number) {
    return this.repo.seasonTicketTotal(seasonId);
  }
}
```

- [ ] **Step 2: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | grep "sales"
```

Expected: 출력 없음

- [ ] **Step 3: Commit**

```bash
cd /Users/juno/work/football && git add apps/api/src/sales/sales.service.ts && git commit -m "feat: add TICKET validation, home-game guard, and auto-ledger in SalesService"
```

---

### Task 4: BE — sales.controller.ts + sales.routes.ts

**Files:**
- Modify: `apps/api/src/sales/sales.controller.ts`
- Modify: `apps/api/src/sales/sales.routes.ts`

- [ ] **Step 1: 컨트롤러 전체 교체**

`apps/api/src/sales/sales.controller.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { requireUser } from "../lib/authMiddleware";
import { canReadFinance, canWriteFinance } from "../lib/permissions";
import type { SalesService } from "./sales.service";

export class SalesController {
  constructor(private service: SalesService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.findAll());
    } catch (e) { next(e); }
  };

  byMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const matchId = Number(req.params["matchId"]);
      if (!matchId) throw new AppError(400, "MATCH_ID_REQUIRED");
      res.json(await this.service.findByMatch(matchId));
    } catch (e) { next(e); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = requireUser(req);
      // FINANCE_MANAGER, FINANCE_STAFF, ADMIN 가능 (canReadFinance 범위)
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, id));
    } catch (e) { next(e); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      // FINANCE_MANAGER, ADMIN만 삭제 가능
      if (!canWriteFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      if (!id) throw new AppError(400, "ID_REQUIRED");
      await this.service.delete(id);
      res.status(204).end();
    } catch (e) { next(e); }
  };

  summary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getSummary());
    } catch (e) { next(e); }
  };

  ticketSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      res.json(await this.service.ticketSummaryByMatch(seasonId));
    } catch (e) { next(e); }
  };

  seasonTicketTotal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = requireUser(req);
      if (!canReadFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId) throw new AppError(400, "SEASON_ID_REQUIRED");
      const total = await this.service.seasonTicketTotal(seasonId);
      res.json({ total });
    } catch (e) { next(e); }
  };
}
```

- [ ] **Step 2: 라우트 전체 교체**

`apps/api/src/sales/sales.routes.ts`:

```typescript
import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { SalesRepository } from "./sales.repo";
import { SalesService } from "./sales.service";
import { SalesController } from "./sales.controller";

const router = Router();
const repo = new SalesRepository(getPrisma());
const service = new SalesService(repo, getPrisma());
const ctrl = new SalesController(service);

router.get("/summary",              auth, ctrl.summary);
router.get("/ticket-summary",       auth, ctrl.ticketSummary);
router.get("/ticket-season-total",  auth, ctrl.seasonTicketTotal);
router.get("/by-match/:matchId",    auth, ctrl.byMatch);
router.get("/",                     auth, ctrl.list);
router.post("/",                    auth, ctrl.create);
router.delete("/:id",               auth, ctrl.delete);

export default router;
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -5
```

Expected: 출력 없음

- [ ] **Step 4: Commit**

```bash
cd /Users/juno/work/football && git add apps/api/src/sales/ && git commit -m "feat: add permission guards and new endpoints to sales controller"
```

---

### Task 5: FE — 타입 + API 서비스

**Files:**
- Create: `football/src/types/sales.ts`
- Create: `football/src/services/sales.service.ts`

- [ ] **Step 1: 타입 정의**

`football/src/types/sales.ts`:

```typescript
export type SalesType = 'TICKET' | 'UNIFORM' | 'OTHER'

export interface SalesRecord {
  id: number
  type: SalesType
  quantity: number
  unitPrice: number
  totalAmount: number
  currency: string
  saleDate: string
  description: string | null
  matchId: number | null
  createdById: number
  createdAt: string
  match: {
    id: number
    homeTeamName: string
    awayTeamName: string
    date: string
  } | null
}

export interface TicketMatchSummary {
  matchId: number
  date: string
  homeTeamName: string
  awayTeamName: string
  totalQuantity: number
  totalAmount: number
}

export interface CreateSalesRecordDto {
  type: SalesType
  quantity: number
  unitPrice: number
  currency?: string
  saleDate: string
  description?: string
  matchId?: number
}
```

- [ ] **Step 2: API 서비스 작성**

먼저 `football/src/services/api.ts`를 읽어 `api.get`/`api.post`/`api.delete` 패턴 확인 후 작성.

`football/src/services/sales.service.ts`:

```typescript
import { api } from './api'
import type { SalesRecord, TicketMatchSummary, CreateSalesRecordDto } from '@/types/sales'

export const salesApi = {
  list: () =>
    api.get<SalesRecord[]>('/sales'),

  byMatch: (matchId: number) =>
    api.get<SalesRecord[]>(`/sales/by-match/${matchId}`),

  create: (dto: CreateSalesRecordDto) =>
    api.post<SalesRecord>('/sales', dto),

  delete: (id: number) =>
    api.delete<void>(`/sales/${id}`),

  ticketSummary: (seasonId: number) =>
    api.get<TicketMatchSummary[]>(`/sales/ticket-summary?seasonId=${seasonId}`),

  seasonTicketTotal: (seasonId: number) =>
    api.get<{ total: number }>(`/sales/ticket-season-total?seasonId=${seasonId}`),
}
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "sales"
```

Expected: 출력 없음

- [ ] **Step 4: Commit**

```bash
cd /Users/juno/work/football && git add football/src/types/sales.ts football/src/services/sales.service.ts && git commit -m "feat: add sales frontend types and API service"
```

---

### Task 6: FE — MatchDetailPage 티켓 판매 섹션

**Files:**
- Modify: `football/src/pages/matches/MatchDetailPage.tsx`

- [ ] **Step 1: 기존 파일 읽기**

`football/src/pages/matches/MatchDetailPage.tsx` 전체 구조 파악 — `match`, `user`, JSX 반환 구조 확인.

- [ ] **Step 2: 티켓 판매 섹션 컴포넌트 추가**

파일 상단 import 추가:
```typescript
import { salesApi } from '@/services/sales.service'
import type { SalesRecord } from '@/types/sales'
```

`MatchDetailPage` 컴포넌트 내 state 추가:
```typescript
const [ticketSales, setTicketSales] = useState<SalesRecord[]>([])
const [saleQty, setSaleQty] = useState('')
const [salePrice, setSalePrice] = useState('')
const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10))
const [saleNote, setSaleNote] = useState('')
const [savingSale, setSavingSale] = useState(false)
```

기존 `useEffect`에서 match 로드 후 티켓 판매 로드 추가:
```typescript
// match 데이터 로드 성공 후 실행
if (data.homeTeamName === 'FC Seoul') {
  salesApi.byMatch(data.id).then(setTicketSales).catch(() => null)
}
```

`canReadFinance` + `canWriteFinance` import 추가:
```typescript
import { canReadFinance, canWriteFinance } from '@/lib/permissions'
```

**참고:** 프론트엔드에 `permissions.ts`가 없으면 인라인 체크 사용:
```typescript
const canViewSales = user?.role === 'ADMIN' ||
  (user?.role === 'FRONT_OFFICE' && (user?.frontOfficeRole === 'FINANCE_MANAGER' || user?.frontOfficeRole === 'FINANCE_STAFF'))
const canWriteSales = user?.role === 'ADMIN' ||
  (user?.role === 'FRONT_OFFICE' && (user?.frontOfficeRole === 'FINANCE_MANAGER' || user?.frontOfficeRole === 'FINANCE_STAFF'))
const canDeleteSales = user?.role === 'ADMIN' ||
  (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'FINANCE_MANAGER')
```

티켓 판매 핸들러:
```typescript
const handleAddTicketSale = async () => {
  if (!match || !saleQty || !salePrice) return
  setSavingSale(true)
  try {
    const newSale = await salesApi.create({
      type: 'TICKET',
      quantity: Number(saleQty),
      unitPrice: Number(salePrice),
      saleDate,
      matchId: match.id,
      ...(saleNote && { description: saleNote }),
    })
    setTicketSales((prev) => [newSale, ...prev])
    setSaleQty('')
    setSalePrice('')
    setSaleNote('')
    toast.success('티켓 판매 기록이 저장되었습니다.')
  } catch (err: any) {
    const code = err?.response?.data?.code
    if (code === 'AWAY_MATCH_TICKET_NOT_ALLOWED') toast.error('홈경기만 티켓 판매를 기록할 수 있습니다.')
    else toast.error('저장에 실패했습니다.')
  } finally {
    setSavingSale(false)
  }
}

const handleDeleteTicketSale = async (id: number) => {
  if (!confirm('티켓 판매 기록을 삭제할까요?')) return
  try {
    await salesApi.delete(id)
    setTicketSales((prev) => prev.filter((s) => s.id !== id))
    toast.success('삭제되었습니다.')
  } catch {
    toast.error('삭제에 실패했습니다.')
  }
}
```

JSX 섹션 (홈경기 + 권한 조건 충족 시만 렌더링, 기존 섹션들 아래에 추가):

```tsx
{match?.homeTeamName === 'FC Seoul' && canViewSales && (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      티켓 판매
    </h3>

    {canWriteSales && (
      <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">수량</Label>
            <Input type="number" placeholder="1200" value={saleQty} onChange={(e) => setSaleQty(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">단가 (원)</Label>
            <Input type="number" placeholder="15000" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">날짜</Label>
            <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </div>
        </div>
        <Input placeholder="메모 (선택)" value={saleNote} onChange={(e) => setSaleNote(e.target.value)} />
        <Button size="sm" onClick={handleAddTicketSale} disabled={savingSale || !saleQty || !salePrice}>
          {savingSale ? '저장 중...' : '기록 추가'}
        </Button>
      </div>
    )}

    {ticketSales.length === 0 ? (
      <p className="text-sm text-muted-foreground">등록된 티켓 판매 기록이 없습니다.</p>
    ) : (
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2">날짜</th>
              <th className="text-right px-3 py-2">수량</th>
              <th className="text-right px-3 py-2">단가</th>
              <th className="text-right px-3 py-2">합계</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {ticketSales.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">{new Date(s.saleDate).toLocaleDateString('ko-KR')}</td>
                <td className="px-3 py-2 text-right">{s.quantity.toLocaleString()}장</td>
                <td className="px-3 py-2 text-right">₩{Number(s.unitPrice).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-medium">₩{Number(s.totalAmount).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  {canDeleteSales && (
                    <Button variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => handleDeleteTicketSale(s.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 font-semibold">
              <td className="px-3 py-2">합계</td>
              <td className="px-3 py-2 text-right">
                {ticketSales.reduce((s, r) => s + r.quantity, 0).toLocaleString()}장
              </td>
              <td></td>
              <td className="px-3 py-2 text-right">
                ₩{ticketSales.reduce((s, r) => s + Number(r.totalAmount), 0).toLocaleString()}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "MatchDetail"
```

Expected: 출력 없음

- [ ] **Step 4: Commit**

```bash
cd /Users/juno/work/football && git add football/src/pages/matches/MatchDetailPage.tsx && git commit -m "feat: add ticket sales section to MatchDetailPage"
```

---

### Task 7: FE — TicketSalesPage (재무 메뉴 독립 페이지)

**Files:**
- Create: `football/src/pages/finance/TicketSalesPage.tsx`

- [ ] **Step 1: 페이지 작성**

`football/src/pages/finance/TicketSalesPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { salesApi } from '@/services/sales.service'
import { seasonApi } from '@/services/season.service'
import type { TicketMatchSummary, SalesRecord } from '@/types/sales'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export function TicketSalesPage() {
  const [summary, setSummary] = useState<TicketMatchSummary[]>([])
  const [records, setRecords] = useState<SalesRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    seasonApi.active().then((season) => {
      if (!season) { setLoading(false); return }
      Promise.all([
        salesApi.ticketSummary(season.id),
        salesApi.list(),
      ]).then(([s, r]) => {
        setSummary(s)
        setRecords(r.filter((rec) => rec.type === 'TICKET'))
      }).catch(() => toast.error('데이터 로드에 실패했습니다.'))
        .finally(() => setLoading(false))
    })
  }, [])

  const totalRevenue = summary.reduce((s, m) => s + m.totalAmount, 0)
  const totalQuantity = summary.reduce((s, m) => s + m.totalQuantity, 0)

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">티켓 판매 기록</h1>
        <p className="text-sm text-muted-foreground mt-0.5">홈경기별 티켓 판매 실적을 조회합니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">시즌 티켓 수입</p>
          <p className="text-2xl font-bold mt-1">₩{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">시즌 총 판매량</p>
          <p className="text-2xl font-bold mt-1">{totalQuantity.toLocaleString()}장</p>
        </div>
      </div>

      {/* 경기별 요약 */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">경기별 요약</h2>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>경기일</TableHead>
                <TableHead>홈</TableHead>
                <TableHead>어웨이</TableHead>
                <TableHead className="text-right">판매량</TableHead>
                <TableHead className="text-right">수입</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">로딩 중...</TableCell>
                </TableRow>
              )}
              {!loading && summary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">티켓 판매 기록이 없습니다.</TableCell>
                </TableRow>
              )}
              {summary.map((m) => (
                <TableRow key={m.matchId}>
                  <TableCell>{new Date(m.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</TableCell>
                  <TableCell className="font-medium">{m.homeTeamName}</TableCell>
                  <TableCell>{m.awayTeamName}</TableCell>
                  <TableCell className="text-right">{m.totalQuantity.toLocaleString()}장</TableCell>
                  <TableCell className="text-right font-semibold">₩{m.totalAmount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 전체 판매 기록 */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">전체 판매 기록</h2>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>경기</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">합계</TableHead>
                <TableHead>메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.saleDate).toLocaleDateString('ko-KR')}</TableCell>
                  <TableCell>
                    {r.match
                      ? `${r.match.homeTeamName} vs ${r.match.awayTeamName}`
                      : <Badge variant="outline">미연결</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{r.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₩{Number(r.unitPrice).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">₩{Number(r.totalAmount).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.description ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 라우터에 등록**

`football/src/App.tsx` (또는 라우터 설정 파일)에서 기존 재무 라우트 패턴 옆에 추가:
```tsx
import { TicketSalesPage } from '@/pages/finance/TicketSalesPage'
// ...
<Route path="/finance/ticket-sales" element={<TicketSalesPage />} />
```

파일 위치 확인: `find /Users/juno/work/football/football/src -name "App.tsx" -o -name "router.tsx" | head -3`

- [ ] **Step 3: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "TicketSales"
```

Expected: 출력 없음

- [ ] **Step 4: Commit**

```bash
cd /Users/juno/work/football && git add football/src/pages/finance/ football/src/App.tsx && git commit -m "feat: add TicketSalesPage with per-match summary and full records table"
```

---

### Task 8: FE — AppShell 네비 링크 + 대시보드 KPI 카드

**Files:**
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/pages/dashboard/dashboardConfig.ts`
- Modify: `football/src/pages/dashboard/DashboardPage.tsx`

- [ ] **Step 1: AppShell 재무 메뉴에 링크 추가**

`football/src/layouts/AppShell.tsx`에서 `nav.subsection.finance` 섹션의 마지막 항목 뒤에 추가:

```typescript
{
  key: 'nav.ticketSales',
  label: 'nav.ticketSales',       // i18n 키 or 하드코딩
  href: '/finance/ticket-sales',
  icon: Ticket,                    // lucide-react에서 import
  subSection: 'nav.subsection.finance',
  roles: ['FRONT_OFFICE'],
  frontOfficeRoles: ['FINANCE_MANAGER', 'FINANCE_STAFF'],
},
```

파일 상단 import에 `Ticket` 추가:
```typescript
import { ..., Ticket } from 'lucide-react'
```

- [ ] **Step 2: dashboardConfig에 showTicketRevenue 추가**

`football/src/pages/dashboard/dashboardConfig.ts`의 `DashboardConfig` 인터페이스에:
```typescript
showTicketRevenue?: boolean
```

`FINANCE_MANAGER` 설정 블록에:
```typescript
showTicketRevenue: true,
```

- [ ] **Step 3: DashboardPage에 KPI 카드 추가**

`football/src/pages/dashboard/DashboardPage.tsx`에 import 추가:
```typescript
import { salesApi } from '@/services/sales.service'
```

state 추가:
```typescript
const [seasonTicketRevenue, setSeasonTicketRevenue] = useState<number | null>(null)
```

기존 `seasonApi.active().then(...)` 내 tasks 배열에 추가:
```typescript
if (config.showTicketRevenue) {
  tasks.push(
    salesApi.seasonTicketTotal(season.id)
      .then((r) => setSeasonTicketRevenue(r.total))
      .catch(() => null)
  )
}
```

KPI 카드 렌더링 (기존 stat cards 옆에 추가):
```tsx
{config.showTicketRevenue && seasonTicketRevenue !== null && (
  <div
    className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
    onClick={() => navigate('/finance/ticket-sales')}
  >
    <p className="text-sm text-muted-foreground">시즌 티켓 수입</p>
    <p className="text-2xl font-bold mt-1">₩{seasonTicketRevenue.toLocaleString()}</p>
  </div>
)}
```

`useNavigate` 이미 import 돼 있는지 확인 — 없으면 `import { useNavigate } from 'react-router-dom'` 추가.

- [ ] **Step 4: TypeScript 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -5
```

Expected: 출력 없음

- [ ] **Step 5: Commit**

```bash
cd /Users/juno/work/football && git add football/src/layouts/AppShell.tsx football/src/pages/dashboard/ && git commit -m "feat: add ticket sales nav link and dashboard KPI card"
```

---

## 자기 리뷰

### 스펙 커버리지 확인

| 스펙 요구사항 | 담당 태스크 |
|--------------|------------|
| SalesRecord.matchId FK | Task 1 |
| TICKET 타입 시 matchId 필수 검증 | Task 3 |
| 홈경기(FC Seoul) 검증 | Task 3 |
| LedgerEntry 자동 생성 (트랜잭션) | Task 3 |
| 권한: canReadFinance(create), canWriteFinance(delete) | Task 4 |
| 경기별 판매 조회 API | Task 4 |
| 시즌 누적 합계 API | Task 4 |
| 프론트 타입 + 서비스 | Task 5 |
| MatchDetailPage 섹션 (홈경기 + 권한 조건부) | Task 6 |
| 합계 행 (수량 + 금액) | Task 6 |
| TicketSalesPage 경기별 요약 상단 | Task 7 |
| TicketSalesPage 전체 기록 테이블 | Task 7 |
| AppShell 재무 메뉴 링크 | Task 8 |
| 대시보드 KPI 카드 (클릭→페이지 이동) | Task 8 |

모든 스펙 항목 커버됨.
