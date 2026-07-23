# Issues #10 & #7 — Role/Permission Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 완료된 스키마/JWT 기반 위에 남은 컨트롤러 로직·라우트·테스트를 구현하여 #10(TD Transfer 권한, GOALKEEPER SessionType)과 #7(TACTICAL_ANALYST, MEDICAL_DIRECTOR) 이슈를 완전히 종료한다.

**Architecture:** 모든 변경은 `worktree-feat+issues-5-6-7-8-9-10` 워크트리에서 진행. 스키마·JWT·Express.User 확장은 이미 완료됐으므로 컨트롤러 가드·서비스 메서드·라우트·단위 테스트만 추가한다. 테스트는 mockService + mockReq 패턴으로 Controller 단위 테스트만 작성한다(기존 test 파일 스타일 따름).

**Tech Stack:** TypeScript · Express · Prisma · Jest · passport-jwt

**Working directory:** `/Users/juno/work/football/.claude/worktrees/feat+issues-5-6-7-8-9-10`

---

## 현재 완료 상태 (건드릴 필요 없음)

- `prisma/schema.prisma` — FrontOfficeRole enum, GOALKEEPER SessionType, MEDICAL_DIRECTOR in CoachingRole, TacticalStatus(DRAFT/CONFIRMED), User.frontOfficeRole, TacticalAnalysis.status 추가 완료
- `src/lib/express.d.ts` — `coachingRole?`, `frontOfficeRole?` Express.User에 추가 완료
- `src/lib/token.ts` — JWT payload에 coachingRole/frontOfficeRole 포함 완료
- `src/auth/**` — 로그인·회원가입 flow에 frontOfficeRole 반영 완료
- `src/transfer/transfer.controller.ts` — TD Transfer write guard 완료
- `src/training/training.controller.ts` — GOALKEEPER sessionType guard 완료
- `__test__/transfer/transfer.controller.test.ts` — TD guard 테스트 완료
- `__test__/training/training.controller.test.ts` — GOALKEEPER guard 테스트 완료

## 의존성 미구현으로 이번 범위 제외

- **TD Prospect write** (#10): Prospect 모듈 자체가 미구현(#6). #6 완료 후 처리.
- **MEDICAL_DIRECTOR 장비 쓰기** (#7): Equipment 모듈 미구현(#5). #5 완료 후 처리.

---

## 파일 구조

| 파일 | 작업 |
|------|------|
| `src/training/training.controller.ts` | `approveSession`: HEAD_COACH 추가 |
| `__test__/training/training.controller.test.ts` | approveSession 테스트 추가 |
| `src/tactical/tactical.repo.ts` | `confirm(id)` 추가 |
| `src/tactical/tactical.service.ts` | `confirmAnalysis(id)` 추가 |
| `src/tactical/tactical.controller.ts` | `create` TACTICAL_ANALYST 허용 + `confirm` 액션 추가 |
| `src/tactical/tactical.routes.ts` | `PATCH /:id/confirm` 라우트 추가 |
| `__test__/tactical/tactical.controller.test.ts` | 신규 생성 |
| `src/injury/injury.repo.ts` | `getStats()` 추가 |
| `src/injury/injury.service.ts` | `getStats()` 추가 |
| `src/injury/injury.controller.ts` | `getStats` 핸들러 추가 |
| `src/injury/injury.routes.ts` | `GET /stats` 라우트 추가 |
| `__test__/injury/injury.controller.test.ts` | 신규 생성 |

---

## Task 1: approveSession — HEAD_COACH 추가 (#10)

**Files:**
- Modify: `src/training/training.controller.ts:37-41`

- [x] **Step 1: approveSession 가드 수정**

현재 코드:
```ts
approveSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
```

교체할 코드:
```ts
approveSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, coachingRole } = req.user!;
    const canApprove =
      role === "ADMIN" || (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");
    if (!canApprove) throw new AppError(403, "FORBIDDEN");
```

- [x] **Step 2: 테스트 추가** — `__test__/training/training.controller.test.ts` 파일 끝에 describe 블록 추가:

```ts
describe("TrainingController - approveSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockService.approveSession.mockResolvedValue({ id: 1, isApproved: true });
  });

  test("ADMIN can approve session → 200", async () => {
    const req = mockReq({
      user: { id: 1, role: "ADMIN", coachingRole: null, frontOfficeRole: null },
      params: { id: "1" },
    });
    const res = mockRes();
    await controller.approveSession(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.approveSession).toHaveBeenCalled();
  });

  test("HEAD_COACH can approve session → 200", async () => {
    const req = mockReq({
      user: { id: 2, role: "COACHING_STAFF", coachingRole: "HEAD_COACH", frontOfficeRole: null },
      params: { id: "1" },
    });
    const res = mockRes();
    await controller.approveSession(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.approveSession).toHaveBeenCalled();
  });

  test("GOALKEEPER_COACH cannot approve session → 403", async () => {
    const req = mockReq({
      user: { id: 3, role: "COACHING_STAFF", coachingRole: "GOALKEEPER_COACH", frontOfficeRole: null },
      params: { id: "1" },
    });
    const res = mockRes();
    await controller.approveSession(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
    expect(res.status).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 3: 테스트 실행**

```bash
cd apps/api && npx jest __test__/training/training.controller.test.ts --no-coverage
```

Expected: 모든 테스트 PASS

- [x] **Step 4: Commit**

```bash
git add apps/api/src/training/training.controller.ts apps/api/__test__/training/training.controller.test.ts
git commit -m "feat(training): allow HEAD_COACH to approve sessions (#10)"
```

---

## Task 2: TacticalAnalysis — TACTICAL_ANALYST create + HEAD_COACH confirm (#7)

**Files:**
- Modify: `src/tactical/tactical.repo.ts`
- Modify: `src/tactical/tactical.service.ts`
- Modify: `src/tactical/tactical.controller.ts`
- Modify: `src/tactical/tactical.routes.ts`

- [x] **Step 1: tactical.repo.ts — confirm 메서드 추가**

파일 맨 끝 `addMedia` 다음에 추가:

```ts
confirm(id: number) {
  return this.prisma.tacticalAnalysis.update({
    where: { id },
    data: { status: "CONFIRMED" },
    select: { id: true, status: true },
  });
}
```

- [x] **Step 2: tactical.service.ts — confirmAnalysis 추가**

`addMedia` 메서드 다음에 추가:

```ts
async confirmAnalysis(id: number) {
  const analysis = await this.repo.findById(id);
  if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND");
  if (analysis.status === "CONFIRMED") throw new AppError(409, "ALREADY_CONFIRMED");
  return this.repo.confirm(id);
}
```

- [x] **Step 3: tactical.controller.ts — create 가드 + confirm 액션**

`create` 메서드 전체 교체:

```ts
create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole } = req.user!;
    const canCreate =
      role === "ADMIN" ||
      role === "COACHING_STAFF" ||
      (role === "FRONT_OFFICE" && frontOfficeRole === "TACTICAL_ANALYST");
    if (!canCreate) throw new AppError(403, "FORBIDDEN");
    res.status(201).json(await this.service.createAnalysis(req.body, req.user!.id));
  } catch (err) { next(err); }
};
```

`addMedia` 다음에 `confirm` 추가:

```ts
confirm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, coachingRole } = req.user!;
    const canConfirm =
      role === "ADMIN" || (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");
    if (!canConfirm) throw new AppError(403, "FORBIDDEN");
    res.status(200).json(await this.service.confirmAnalysis(Number(req.params["id"])));
  } catch (err) { next(err); }
};
```

- [x] **Step 4: tactical.routes.ts — confirm 라우트 추가**

마지막 라우트 다음에 추가:

```ts
// 전술 분석 확정 (ADMIN, HEAD_COACH)
router.patch("/:id/confirm", auth, controller.confirm);
```

- [x] **Step 5: Commit**

```bash
git add apps/api/src/tactical/
git commit -m "feat(tactical): allow TACTICAL_ANALYST to create DRAFT, HEAD_COACH to confirm (#7)"
```

---

## Task 3: TacticalController 단위 테스트 (#7)

**Files:**
- Create: `__test__/tactical/tactical.controller.test.ts`

- [x] **Step 1: 테스트 파일 작성**

```ts
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TacticalController } from "../../src/tactical/tactical.controller";

const mockService = {
  getByMatch: jest.fn(),
  getById: jest.fn(),
  createAnalysis: jest.fn<() => Promise<{ id: number }>>().mockResolvedValue({ id: 1 }),
  addLineup: jest.fn(),
  addMedia: jest.fn(),
  confirmAnalysis: jest
    .fn<() => Promise<{ id: number; status: string }>>()
    .mockResolvedValue({ id: 1, status: "CONFIRMED" }),
} as any;

const controller = new TacticalController(mockService);

const mockReq = (overrides: any) =>
  ({
    user: { id: 1, role: "ADMIN", coachingRole: null, frontOfficeRole: null },
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

describe("TacticalController - create (TACTICAL_ANALYST)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ADMIN can create TacticalAnalysis → 201", async () => {
    const req = mockReq({ user: { id: 1, role: "ADMIN", coachingRole: null, frontOfficeRole: null } });
    const res = mockRes();
    await controller.create(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockService.createAnalysis).toHaveBeenCalled();
  });

  test("COACHING_STAFF can create TacticalAnalysis → 201", async () => {
    const req = mockReq({
      user: { id: 2, role: "COACHING_STAFF", coachingRole: "DEFENSIVE_COACH", frontOfficeRole: null },
    });
    const res = mockRes();
    await controller.create(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("TACTICAL_ANALYST (FRONT_OFFICE) can create TacticalAnalysis → 201", async () => {
    const req = mockReq({
      user: { id: 3, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "TACTICAL_ANALYST" },
    });
    const res = mockRes();
    await controller.create(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockService.createAnalysis).toHaveBeenCalled();
  });

  test("GM (FRONT_OFFICE, non-analyst) cannot create TacticalAnalysis → 403", async () => {
    const req = mockReq({
      user: { id: 4, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "GM" },
    });
    const res = mockRes();
    await controller.create(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  test("PLAYER cannot create TacticalAnalysis → 403", async () => {
    const req = mockReq({
      user: { id: 5, role: "PLAYER", coachingRole: null, frontOfficeRole: null },
    });
    const res = mockRes();
    await controller.create(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
  });
});

describe("TacticalController - confirm", () => {
  beforeEach(() => jest.clearAllMocks());

  test("HEAD_COACH can confirm TacticalAnalysis → 200", async () => {
    const req = mockReq({
      user: { id: 1, role: "COACHING_STAFF", coachingRole: "HEAD_COACH", frontOfficeRole: null },
      params: { id: "1" },
    });
    const res = mockRes();
    await controller.confirm(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.confirmAnalysis).toHaveBeenCalledWith(1);
  });

  test("ADMIN can confirm TacticalAnalysis → 200", async () => {
    const req = mockReq({
      user: { id: 2, role: "ADMIN", coachingRole: null, frontOfficeRole: null },
      params: { id: "1" },
    });
    const res = mockRes();
    await controller.confirm(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("TACTICAL_ANALYST cannot confirm TacticalAnalysis → 403", async () => {
    const req = mockReq({
      user: { id: 3, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "TACTICAL_ANALYST" },
      params: { id: "1" },
    });
    const res = mockRes();
    await controller.confirm(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  test("DEFENSIVE_COACH cannot confirm TacticalAnalysis → 403", async () => {
    const req = mockReq({
      user: { id: 4, role: "COACHING_STAFF", coachingRole: "DEFENSIVE_COACH", frontOfficeRole: null },
      params: { id: "1" },
    });
    const res = mockRes();
    await controller.confirm(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
  });
});
```

- [x] **Step 2: 테스트 실행**

```bash
cd apps/api && npx jest __test__/tactical/tactical.controller.test.ts --no-coverage
```

Expected: 모든 테스트 PASS

- [x] **Step 3: Commit**

```bash
git add apps/api/__test__/tactical/
git commit -m "test(tactical): TACTICAL_ANALYST create + HEAD_COACH confirm coverage (#7)"
```

---

## Task 4: Injury Stats — MEDICAL_DIRECTOR 전용 집계 엔드포인트 (#7)

**Files:**
- Modify: `src/injury/injury.repo.ts`
- Modify: `src/injury/injury.service.ts`
- Modify: `src/injury/injury.controller.ts`
- Modify: `src/injury/injury.routes.ts`

- [x] **Step 1: injury.repo.ts — getStats 추가**

`updateStatus` 메서드 다음에 추가:

```ts
async getStats() {
  const [byBodyPart, byCause, withDates, activeCount] = await Promise.all([
    this.prisma.injury.groupBy({ by: ["bodyPart"], _count: { id: true } }),
    this.prisma.injury.groupBy({ by: ["cause"], _count: { id: true } }),
    this.prisma.injury.findMany({
      where: { expectedReturnDate: { not: null } },
      select: { occurredAt: true, expectedReturnDate: true },
    }),
    this.prisma.injury.count({ where: { status: { not: "RETURNED" } } }),
  ]);

  const avgRecoveryDays =
    withDates.length > 0
      ? Math.round(
          withDates.reduce(
            (sum, i) =>
              sum + (i.expectedReturnDate!.getTime() - i.occurredAt.getTime()) / 86_400_000,
            0,
          ) / withDates.length,
        )
      : null;

  return {
    activeCount,
    byBodyPart: Object.fromEntries(byBodyPart.map((b) => [b.bodyPart, b._count.id])),
    byCause: Object.fromEntries(byCause.map((b) => [b.cause, b._count.id])),
    avgRecoveryDays,
  };
}
```

- [x] **Step 2: injury.service.ts — getStats 추가**

`updateStatus` 다음에:

```ts
getStats() {
  return this.repo.getStats();
}
```

- [x] **Step 3: injury.controller.ts — getStats 핸들러 추가**

`InjuryController` 클래스 안 `create` 앞에 추가:

```ts
getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, coachingRole } = req.user!;
    const isMedicalDirector =
      role === "COACHING_STAFF" && coachingRole === "MEDICAL_DIRECTOR";
    if (role !== "ADMIN" && !isMedicalDirector) throw new AppError(403, "FORBIDDEN");
    res.status(200).json(await this.service.getStats());
  } catch (err) { next(err); }
};
```

- [x] **Step 4: injury.routes.ts — GET /stats 라우트 추가**

`router.get("/player/:playerId", ...)` 앞에 추가 (`:id` 보다 먼저 매칭되도록):

```ts
router.get("/stats", auth, controller.getStats);
```

- [x] **Step 5: Commit**

```bash
git add apps/api/src/injury/
git commit -m "feat(injury): add GET /stats for MEDICAL_DIRECTOR (#7)"
```

---

## Task 5: InjuryController 단위 테스트 (#7)

**Files:**
- Create: `__test__/injury/injury.controller.test.ts`

- [x] **Step 1: 테스트 파일 작성**

```ts
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { InjuryController } from "../../src/injury/injury.controller";

const mockService = {
  getByPlayer: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  getById: jest.fn(),
  createInjury: jest.fn(),
  updateStatus: jest.fn(),
  getStats: jest
    .fn<() => Promise<any>>()
    .mockResolvedValue({ activeCount: 3, byBodyPart: {}, byCause: {}, avgRecoveryDays: 14 }),
} as any;

const controller = new InjuryController(mockService);

const mockReq = (overrides: any) =>
  ({
    user: { id: 1, role: "ADMIN", coachingRole: null, frontOfficeRole: null },
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

describe("InjuryController - getStats (MEDICAL_DIRECTOR)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ADMIN can access injury stats → 200", async () => {
    const req = mockReq({ user: { id: 1, role: "ADMIN", coachingRole: null, frontOfficeRole: null } });
    const res = mockRes();
    await controller.getStats(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.getStats).toHaveBeenCalled();
  });

  test("MEDICAL_DIRECTOR can access injury stats → 200", async () => {
    const req = mockReq({
      user: { id: 2, role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR", frontOfficeRole: null },
    });
    const res = mockRes();
    await controller.getStats(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.getStats).toHaveBeenCalled();
  });

  test("plain MEDICAL cannot access injury stats → 403", async () => {
    const req = mockReq({
      user: { id: 3, role: "COACHING_STAFF", coachingRole: "MEDICAL", frontOfficeRole: null },
    });
    const res = mockRes();
    await controller.getStats(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  test("FRONT_OFFICE cannot access injury stats → 403", async () => {
    const req = mockReq({
      user: { id: 4, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "TACTICAL_ANALYST" },
    });
    const res = mockRes();
    await controller.getStats(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" }),
    );
  });
});

describe("InjuryController - getByPlayer (TACTICAL_ANALYST 읽기 접근)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("TACTICAL_ANALYST (FRONT_OFFICE) can read injuries → 200", async () => {
    const req = mockReq({
      user: { id: 5, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "TACTICAL_ANALYST" },
      params: { playerId: "player-uuid-1" },
    });
    const res = mockRes();
    await controller.getByPlayer(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.getByPlayer).toHaveBeenCalledWith("player-uuid-1");
  });
});
```

- [x] **Step 2: 테스트 실행**

```bash
cd apps/api && npx jest __test__/injury/injury.controller.test.ts --no-coverage
```

Expected: 모든 테스트 PASS

- [x] **Step 3: 전체 테스트 실행**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: 전체 PASS (기존 테스트 회귀 없음)

- [x] **Step 4: Commit**

```bash
git add apps/api/__test__/injury/
git commit -m "test(injury): MEDICAL_DIRECTOR stats + TACTICAL_ANALYST read coverage (#7)"
```

---

## Self-Review

### Spec Coverage

| 요구사항 | Task | 상태 |
|---------|------|------|
| TD Transfer write (#10) | 이미 완료 | ✅ |
| TD Transfer test (#10) | 이미 완료 | ✅ |
| GOALKEEPER SessionType (#10) | 이미 완료 | ✅ |
| GOALKEEPER guard test (#10) | 이미 완료 | ✅ |
| HEAD_COACH approveSession (#10) | Task 1 | ✅ |
| TACTICAL_ANALYST create DRAFT (#7) | Task 2 | ✅ |
| HEAD_COACH confirm TacticalAnalysis (#7) | Task 2-3 | ✅ |
| TACTICAL_ANALYST cannot confirm (#7) | Task 3 | ✅ |
| TACTICAL_ANALYST injury/training read (#7) | Task 5 | ✅ |
| MEDICAL_DIRECTOR in CoachingRole enum (#7) | 이미 완료 | ✅ |
| GET /injuries/stats for MEDICAL_DIRECTOR (#7) | Task 4-5 | ✅ |
| TD Prospect write (#10) | **스코프 제외 (#6 미구현)** | ⚠️ |
| MEDICAL_DIRECTOR REHABILITATION equipment (#7) | **스코프 제외 (#5 미구현)** | ⚠️ |

### Type Consistency

- `confirm()` repo 메서드: `{ id: number; status: string }` 반환 → `confirmAnalysis()` service에서 그대로 반환 ✅
- `getStats()` repo 반환: `{ activeCount, byBodyPart, byCause, avgRecoveryDays }` → service 통과 → controller JSON 직렬화 ✅
- `req.user!.coachingRole` — `CoachingRole | null | undefined`로 타입 정의됨. `=== "HEAD_COACH"` 비교 안전 ✅
