# TrainingReference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 훈련 관련 외부 자료(영상·문서 링크)를 SessionType별로 등록·태그 검색하고, 동일 SessionType 내 성과 상위 세션을 자동 추천하는 TrainingReference 기능을 구현한다.

**Architecture:** Prisma 스키마에 `TrainingReference` 모델 추가 → BE repo/service/controller/routes 구현 → `apiRouter.ts`에 마운트 → FE `TrainingDetailPage.tsx`의 세션 상세에 레퍼런스 섹션 통합.

**Tech Stack:** Express, Prisma (PostgreSQL String[] 배열), TypeScript, React, shadcn/ui

---

## File Structure

**BE (신규)**
- `apps/api/prisma/schema.prisma` — `TrainingReference` 모델 추가
- `apps/api/src/training-reference/dto/training-reference.dto.ts` — DTO 타입
- `apps/api/src/training-reference/training-reference.repo.ts` — DB 쿼리
- `apps/api/src/training-reference/training-reference.service.ts` — 비즈니스 로직
- `apps/api/src/training-reference/training-reference.controller.ts` — 핸들러
- `apps/api/src/training-reference/training-reference.routes.ts` — 라우트
- `apps/api/src/apiRouter.ts` — 라우터 등록

**BE (테스트)**
- `apps/api/__test__/training-reference/training-reference.controller.test.ts`

**FE (수정)**
- `football/src/types/training-reference.ts` — 타입 정의
- `football/src/services/training-reference.service.ts` — API 클라이언트
- `football/src/pages/training/TrainingDetailPage.tsx` — 레퍼런스 섹션 추가

---

### Task 1: Prisma 스키마 — TrainingReference 모델 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: 스키마에 TrainingReference 모델 추가**

`apps/api/prisma/schema.prisma` 파일에서 `PlayerDevelopmentPlan` 모델 바로 뒤에 추가:

```prisma
model TrainingReference {
  id          Int         @id @default(autoincrement())
  sessionType SessionType
  title       String
  url         String
  source      ReferenceSource
  tags        String[]
  addedById   Int
  createdAt   DateTime    @default(now())

  addedBy User @relation(fields: [addedById], references: [id])
}

enum ReferenceSource {
  INTERNAL
  EXTERNAL
}
```

`User` 모델에 역방향 관계 추가 (User 모델의 관계 목록 끝에):
```prisma
  trainingReferences TrainingReference[]
```

- [x] **Step 2: DB에 반영**

```bash
cd apps/api
npx prisma db push
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.`

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add TrainingReference model with tags and ReferenceSource enum"
```

---

### Task 2: BE DTO

**Files:**
- Create: `apps/api/src/training-reference/dto/training-reference.dto.ts`

- [x] **Step 1: DTO 파일 작성**

```typescript
// apps/api/src/training-reference/dto/training-reference.dto.ts
import { SessionType, ReferenceSource } from "../../generated/enums";

export interface CreateTrainingReferenceDto {
  sessionType: SessionType;
  title: string;
  url: string;
  source: ReferenceSource;
  tags: string[];
}

export interface ListTrainingReferencesQuery {
  sessionType?: SessionType;
  tag?: string;
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/training-reference/
git commit -m "feat(training-reference): add DTO types"
```

---

### Task 3: BE Repository

**Files:**
- Create: `apps/api/src/training-reference/training-reference.repo.ts`

- [x] **Step 1: Write failing test**

`apps/api/__test__/training-reference/training-reference.controller.test.ts` 파일에서 repo 직접 테스트보다 controller mock 테스트를 먼저 작성하므로, 이 단계에서는 repo 파일만 생성:

```typescript
// apps/api/src/training-reference/training-reference.repo.ts
import { PrismaClient } from "../generated/client";
import { SessionType } from "../generated/enums";
import { CreateTrainingReferenceDto, ListTrainingReferencesQuery } from "./dto/training-reference.dto";

export class TrainingReferenceRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: ListTrainingReferencesQuery) {
    return this.prisma.trainingReference.findMany({
      where: {
        ...(query.sessionType && { sessionType: query.sessionType }),
        ...(query.tag && { tags: { hasSome: [query.tag] } }),
      },
      select: {
        id: true,
        sessionType: true,
        title: true,
        url: true,
        source: true,
        tags: true,
        createdAt: true,
        addedBy: { select: { id: true, nickname: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  create(dto: CreateTrainingReferenceDto, addedById: number) {
    return this.prisma.trainingReference.create({
      data: {
        sessionType: dto.sessionType,
        title: dto.title,
        url: dto.url,
        source: dto.source,
        tags: dto.tags,
        addedById,
      },
      select: {
        id: true,
        sessionType: true,
        title: true,
        url: true,
        source: true,
        tags: true,
        createdAt: true,
        addedBy: { select: { id: true, nickname: true } },
      },
    });
  }

  findById(id: number) {
    return this.prisma.trainingReference.findUnique({
      where: { id },
      select: { id: true, addedById: true },
    });
  }

  delete(id: number) {
    return this.prisma.trainingReference.delete({ where: { id } });
  }

  // 동일 sessionType 내 performanceScore 평균 상위 5개 세션 추천
  async getTopSessionsByType(sessionType: SessionType, limit = 5) {
    const results = await this.prisma.trainingResult.groupBy({
      by: ["sessionId"],
      where: {
        session: { sessionType },
        performanceScore: { not: null },
      },
      _avg: { performanceScore: true },
      orderBy: { _avg: { performanceScore: "desc" } },
      take: limit,
    });

    const sessionIds = results.map((r) => r.sessionId);
    const sessions = await this.prisma.trainingSession.findMany({
      where: { id: { in: sessionIds } },
      select: { id: true, date: true, goal: true, sessionType: true },
    });

    // 순서 보존 (avg 내림차순)
    return sessionIds.map((id) => ({
      session: sessions.find((s) => s.id === id)!,
      avgScore: results.find((r) => r.sessionId === id)?._avg.performanceScore ?? null,
    }));
  }
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/training-reference/training-reference.repo.ts
git commit -m "feat(training-reference): add repository with list/create/delete/recommendations"
```

---

### Task 4: BE Service

**Files:**
- Create: `apps/api/src/training-reference/training-reference.service.ts`

- [x] **Step 1: Service 작성**

```typescript
// apps/api/src/training-reference/training-reference.service.ts
import { TrainingReferenceRepository } from "./training-reference.repo";
import { AppError } from "../lib/appError";
import { CreateTrainingReferenceDto, ListTrainingReferencesQuery } from "./dto/training-reference.dto";
import { SessionType } from "../generated/enums";

export class TrainingReferenceService {
  constructor(private repo: TrainingReferenceRepository) {}

  list(query: ListTrainingReferencesQuery) {
    return this.repo.findAll(query);
  }

  create(dto: CreateTrainingReferenceDto, addedById: number) {
    return this.repo.create(dto, addedById);
  }

  async delete(id: number, requesterId: number, isAdmin: boolean) {
    const ref = await this.repo.findById(id);
    if (!ref) throw new AppError(404, "TRAINING_REFERENCE_NOT_FOUND");
    if (!isAdmin && ref.addedById !== requesterId) throw new AppError(403, "FORBIDDEN");
    return this.repo.delete(id);
  }

  getRecommendations(sessionType: SessionType, limit?: number) {
    return this.repo.getTopSessionsByType(sessionType, limit);
  }
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/training-reference/training-reference.service.ts
git commit -m "feat(training-reference): add service with delete ownership check"
```

---

### Task 5: BE Controller + 테스트

**Files:**
- Create: `apps/api/src/training-reference/training-reference.controller.ts`
- Create: `apps/api/__test__/training-reference/training-reference.controller.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// apps/api/__test__/training-reference/training-reference.controller.test.ts
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TrainingReferenceController } from "../../src/training-reference/training-reference.controller";

const mockService = {
  list: jest.fn(),
  create: jest.fn<() => Promise<{ id: number }>>().mockResolvedValue({ id: 1 }),
  delete: jest.fn(),
  getRecommendations: jest.fn(),
} as any;

const controller = new TrainingReferenceController(mockService);

const mockReq = (overrides: any) =>
  ({
    user: { id: 1, role: "COACHING_STAFF", coachingRole: "HEAD_COACH", frontOfficeRole: null },
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

const mockNext = jest.fn() as any;

describe("TrainingReferenceController - list", () => {
  beforeEach(() => jest.clearAllMocks());

  test("COACHING_STAFF can list → 200", async () => {
    mockService.list.mockResolvedValue([]);
    const req = mockReq({ query: { sessionType: "PHYSICAL" } });
    const res = mockRes();
    await controller.list(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("PLAYER role is forbidden → 403", async () => {
    const req = mockReq({ user: { id: 2, role: "PLAYER" }, query: {} });
    const res = mockRes();
    await controller.list(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

describe("TrainingReferenceController - create", () => {
  beforeEach(() => jest.clearAllMocks());

  test("COACHING_STAFF can create → 201", async () => {
    const req = mockReq({
      body: { sessionType: "PHYSICAL", title: "Test", url: "http://x.com", source: "EXTERNAL", tags: ["압박"] },
    });
    const res = mockRes();
    await controller.create(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("FRONT_OFFICE role is forbidden → 403", async () => {
    const req = mockReq({ user: { id: 2, role: "FRONT_OFFICE", frontOfficeRole: "GM" }, body: {} });
    const res = mockRes();
    await controller.create(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
```

- [x] **Step 2: Run test — expect FAIL**

```bash
cd apps/api
npx jest __test__/training-reference/training-reference.controller.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../src/training-reference/training-reference.controller'`

- [x] **Step 3: Write controller**

```typescript
// apps/api/src/training-reference/training-reference.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { TrainingReferenceService } from "./training-reference.service";
import { SessionType } from "../generated/enums";

const READ_ROLES = ["ADMIN", "COACHING_STAFF", "FRONT_OFFICE"] as const;
const WRITE_ROLES = ["ADMIN", "COACHING_STAFF"] as const;

export class TrainingReferenceController {
  constructor(private service: TrainingReferenceService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(READ_ROLES as readonly string[]).includes(req.user!.role))
        throw new AppError(403, "FORBIDDEN");
      const q = req.query as Record<string, string | undefined>;
      res.status(200).json(
        await this.service.list({
          sessionType: q["sessionType"] as SessionType | undefined,
          tag: q["tag"],
        }),
      );
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(WRITE_ROLES as readonly string[]).includes(req.user!.role))
        throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(WRITE_ROLES as readonly string[]).includes(req.user!.role))
        throw new AppError(403, "FORBIDDEN");
      await this.service.delete(
        Number(req.params["id"]),
        req.user!.id,
        req.user!.role === "ADMIN",
      );
      res.status(204).send();
    } catch (err) { next(err); }
  };

  getRecommendations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(READ_ROLES as readonly string[]).includes(req.user!.role))
        throw new AppError(403, "FORBIDDEN");
      const q = req.query as Record<string, string | undefined>;
      if (!q["sessionType"]) throw new AppError(400, "SESSION_TYPE_REQUIRED");
      res.status(200).json(
        await this.service.getRecommendations(q["sessionType"] as SessionType),
      );
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 4: Run test — expect PASS**

```bash
cd apps/api
npx jest __test__/training-reference/training-reference.controller.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 4 passed, 4 total`

- [x] **Step 5: Commit**

```bash
git add apps/api/src/training-reference/training-reference.controller.ts apps/api/__test__/training-reference/
git commit -m "feat(training-reference): add controller with role guards and tests"
```

---

### Task 6: BE Routes + apiRouter 등록

**Files:**
- Create: `apps/api/src/training-reference/training-reference.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: Routes 파일 작성**

```typescript
// apps/api/src/training-reference/training-reference.routes.ts
import { Router } from "express";
import passport from "passport";
import { TrainingReferenceController } from "./training-reference.controller";
import { TrainingReferenceService } from "./training-reference.service";
import { TrainingReferenceRepository } from "./training-reference.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new TrainingReferenceRepository(getPrisma());
const service = new TrainingReferenceService(repo);
const controller = new TrainingReferenceController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.list);
router.get("/recommendations", auth, controller.getRecommendations);
router.post("/", auth, controller.create);
router.delete("/:id", auth, controller.delete);

export default router;
```

- [x] **Step 2: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts` 파일에서:

import 목록 끝에 추가:
```typescript
import trainingReferenceRouter from "./training-reference/training-reference.routes";
```

`apiRouter.use(...)` 목록에 추가 (training 라우터 바로 아래):
```typescript
apiRouter.use("/training-references", trainingReferenceRouter);
```

- [x] **Step 3: 서버 기동 확인**

```bash
cd apps/api && npx ts-node src/server.ts &
sleep 2
curl -s http://localhost:3000/api/training-references | head -20
kill %1
```

Expected: JSON 응답 (빈 배열 또는 401 — 인증 없이 접근 시 정상)

- [x] **Step 4: Commit**

```bash
git add apps/api/src/training-reference/training-reference.routes.ts apps/api/src/apiRouter.ts
git commit -m "feat(training-reference): register routes at /training-references"
```

---

### Task 7: FE 타입 + API 서비스

**Files:**
- Create: `football/src/types/training-reference.ts`
- Create: `football/src/services/training-reference.service.ts`

- [x] **Step 1: 타입 정의**

```typescript
// football/src/types/training-reference.ts
import type { SessionType } from '@/types/training'

export type ReferenceSource = 'INTERNAL' | 'EXTERNAL'

export interface TrainingReference {
  id: number
  sessionType: SessionType
  title: string
  url: string
  source: ReferenceSource
  tags: string[]
  createdAt: string
  addedBy: { id: number; nickname: string }
}

export interface TrainingReferenceRecommendation {
  session: {
    id: number
    date: string
    goal: string
    sessionType: SessionType
  }
  avgScore: number | null
}

export const REFERENCE_SOURCE_LABEL: Record<ReferenceSource, string> = {
  INTERNAL: '내부',
  EXTERNAL: '외부',
}
```

- [x] **Step 2: API 서비스 작성**

```typescript
// football/src/services/training-reference.service.ts
import { api } from '@/services/api'
import type { TrainingReference, TrainingReferenceRecommendation, ReferenceSource } from '@/types/training-reference'
import type { SessionType } from '@/types/training'

export const trainingReferenceApi = {
  list: (params?: { sessionType?: SessionType; tag?: string }) => {
    const qs = new URLSearchParams()
    if (params?.sessionType) qs.set('sessionType', params.sessionType)
    if (params?.tag) qs.set('tag', params.tag)
    const q = qs.toString()
    return api.get<TrainingReference[]>(`/training-references${q ? `?${q}` : ''}`)
  },

  create: (payload: {
    sessionType: SessionType
    title: string
    url: string
    source: ReferenceSource
    tags: string[]
  }) => api.post<TrainingReference>('/training-references', payload),

  delete: (id: number) => api.delete<void>(`/training-references/${id}`),

  getRecommendations: (sessionType: SessionType) =>
    api.get<TrainingReferenceRecommendation[]>(
      `/training-references/recommendations?sessionType=${sessionType}`,
    ),
}
```

- [x] **Step 3: Commit**

```bash
git add football/src/types/training-reference.ts football/src/services/training-reference.service.ts
git commit -m "feat(training-reference): add FE types and API service"
```

---

### Task 8: FE — TrainingDetailPage에 레퍼런스 섹션 추가

**Files:**
- Modify: `football/src/pages/training/TrainingDetailPage.tsx`

TrainingDetailPage에 레퍼런스 섹션을 추가한다. 페이지 구조를 먼저 파악하고 적합한 위치에 삽입한다.

- [x] **Step 1: TrainingDetailPage 상단 import 추가**

기존 import 목록 끝에 추가:
```typescript
import { trainingReferenceApi } from '@/services/training-reference.service'
import type { TrainingReference, ReferenceSource } from '@/types/training-reference'
import { REFERENCE_SOURCE_LABEL } from '@/types/training-reference'
import { ExternalLink, Trash2, Plus } from 'lucide-react'
```

- [x] **Step 2: 레퍼런스 상태 추가**

컴포넌트 내 `useState` 목록에 추가:
```typescript
const [refs, setRefs] = useState<TrainingReference[]>([])
const [refLoading, setRefLoading] = useState(false)
const [newRefTitle, setNewRefTitle] = useState('')
const [newRefUrl, setNewRefUrl] = useState('')
const [newRefSource, setNewRefSource] = useState<ReferenceSource>('EXTERNAL')
const [newRefTags, setNewRefTags] = useState('')
const [addingRef, setAddingRef] = useState(false)
```

- [x] **Step 3: 레퍼런스 데이터 로드 — useEffect에 추가**

세션 조회 useEffect 내부에서 함께 로드:
```typescript
const fetchRefs = () => {
  if (!session) return
  trainingReferenceApi.list({ sessionType: session.sessionType })
    .then(setRefs)
    .catch(() => null)
}
```

- [x] **Step 4: 레퍼런스 섹션 JSX 추가**

페이지 하단 (참가자 섹션 아래)에 추가:

```tsx
{/* 훈련 레퍼런스 */}
<div className="border rounded-lg p-4 space-y-3">
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-semibold">훈련 레퍼런스</h3>
    {canAddRef && (
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingRef(v => !v)}>
        <Plus className="h-3 w-3 mr-1" />추가
      </Button>
    )}
  </div>

  {addingRef && (
    <div className="space-y-2 border-t pt-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">제목 *</Label>
          <Input value={newRefTitle} onChange={e => setNewRefTitle(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">URL *</Label>
          <Input value={newRefUrl} onChange={e => setNewRefUrl(e.target.value)} className="h-8 text-sm" placeholder="https://" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">출처</Label>
          <Select
            value={newRefSource}
            onValueChange={v => setNewRefSource(v as ReferenceSource)}
            items={REFERENCE_SOURCE_LABEL}
          >
            <SelectTrigger className="h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(REFERENCE_SOURCE_LABEL) as ReferenceSource[]).map(s => (
                <SelectItem key={s} value={s}>{REFERENCE_SOURCE_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">태그 (쉼표 구분)</Label>
          <Input value={newRefTags} onChange={e => setNewRefTags(e.target.value)} className="h-8 text-sm" placeholder="압박, 빌드업" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingRef(false)}>취소</Button>
        <Button size="sm" className="h-7 text-xs" disabled={refLoading} onClick={async () => {
          if (!newRefTitle.trim() || !newRefUrl.trim() || !session) return
          setRefLoading(true)
          try {
            await trainingReferenceApi.create({
              sessionType: session.sessionType,
              title: newRefTitle.trim(),
              url: newRefUrl.trim(),
              source: newRefSource,
              tags: newRefTags.split(',').map(t => t.trim()).filter(Boolean),
            })
            setNewRefTitle(''); setNewRefUrl(''); setNewRefTags(''); setAddingRef(false)
            fetchRefs()
            toast.success('레퍼런스가 등록됐습니다.')
          } catch { toast.error('등록에 실패했습니다.') }
          finally { setRefLoading(false) }
        }}>등록</Button>
      </div>
    </div>
  )}

  {refs.length === 0 ? (
    <p className="text-xs text-muted-foreground">등록된 레퍼런스가 없습니다.</p>
  ) : (
    <ul className="space-y-1.5">
      {refs.map(r => (
        <li key={r.id} className="flex items-start gap-2 text-sm">
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline flex-1 min-w-0">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{r.title}</span>
          </a>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground">{REFERENCE_SOURCE_LABEL[r.source]}</span>
            {r.tags.length > 0 && r.tags.map(t => (
              <span key={t} className="text-xs border rounded px-1">{t}</span>
            ))}
            {(canAddRef && (user?.id === r.addedBy.id || user?.role === 'ADMIN')) && (
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={async () => {
                await trainingReferenceApi.delete(r.id)
                fetchRefs()
              }}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )}
</div>
```

`canAddRef` 변수 정의 (컴포넌트 상단 `canApprove` 근처에 추가):
```typescript
const canAddRef = user?.role === 'ADMIN' || user?.role === 'COACHING_STAFF'
```

- [x] **Step 5: Commit**

```bash
git add football/src/pages/training/TrainingDetailPage.tsx
git commit -m "feat(training-reference): add reference section to TrainingDetailPage"
```

---

## 검증 체크리스트

- [x] `GET /training-references?sessionType=PHYSICAL` — 목록 반환
- [x] `GET /training-references?tag=압박` — 태그 필터 동작
- [x] `POST /training-references` (COACHING_STAFF 토큰) — 201 생성
- [x] `POST /training-references` (FRONT_OFFICE 토큰) — 403
- [x] `DELETE /training-references/:id` (본인 토큰) — 204
- [x] `DELETE /training-references/:id` (타인 토큰) — 403
- [x] `GET /training-references/recommendations?sessionType=PHYSICAL` — 상위 5개 세션
- [x] FE: TrainingDetailPage에 레퍼런스 섹션 렌더링
- [x] FE: 등록 후 목록 갱신
- [x] FE: 삭제 후 목록 갱신
