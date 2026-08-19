# IDOR Authorization Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 그래프 분석으로 발견된 4개 도메인의 IDOR·인가 누락 버그를 수정한다 — guardian feeId 소유권, growth report 열람 범위, 티켓 취소 인가 가드, 시설 구역 접근 RBAC.

**Architecture:** 공통 패턴은 "인증(auth)은 통과했지만 소유권 검증이 없다"는 것. 각 수정은 서비스 레이어 또는 컨트롤러에서 리소스를 먼저 조회한 뒤 요청자가 소유자인지 확인하는 가드를 삽입한다. 시설 구역 접근은 `canAccessZone` 함수 시그니처를 확장해 `frontOfficeRole`을 인자로 받도록 수정한다.

**Tech Stack:** TypeScript, Express, Prisma, Jest (mock repo 패턴)

---

## 파일 맵

| 파일 | 변경 내용 |
|------|-----------|
| `apps/api/src/guardian/guardian.service.ts` | `submitFeeProof` 시그니처에 `playerId` 추가, feeId 소유권 검증 |
| `apps/api/src/guardian/guardian.controller.ts` | `submitFeeProof` 호출 시 `req.childPlayerId` 전달 |
| `apps/api/src/guardian/guardian.service.test.ts` | `submitFeeProof` IDOR 테스트 추가 |
| `apps/api/src/growth-report/growth-report.service.ts` | `GuardianRepository` 의존성 추가, `getEvaluationsByPlayerForGuardian` 신규 메서드 |
| `apps/api/src/growth-report/growth-report.controller.ts` | `getEvaluationsByPlayer`에서 GUARDIAN role 분기 처리 |
| `apps/api/src/growth-report/growth-report.routes.ts` | `GuardianRepository` 주입 |
| `apps/api/src/growth-report/growth-report.service.test.ts` | guardian IDOR 테스트 추가 |
| `apps/api/src/sales/sales.controller.ts` | `cancel`에 `requireUser(req)` + `checkWriteFinance`에 상응하는 role 체크 추가 |
| `apps/api/src/lib/facilityAccessControl.ts` | `canAccessZone` 시그니처 확장 — `frontOfficeRole` 분기 추가 |
| `apps/api/src/lib/facilityAccessControl.test.ts` | 신규 생성 — 구역별 접근 규칙 유닛 테스트 |

---

### Task 1: Guardian feeId IDOR 수정 (LS8)

현재: `submitFeeProof(feeId, url)` 가 feeId가 요청자의 자녀 것인지 확인하지 않음. `requireGuardianChild` 미들웨어가 `playerId` 소유권은 검증하지만, `feeId`가 그 자녀의 것인지는 검증하지 않음.

**Files:**
- Modify: `apps/api/src/guardian/guardian.service.ts:74-76`
- Modify: `apps/api/src/guardian/guardian.controller.ts:82-89`
- Modify: `apps/api/src/guardian/guardian.service.test.ts`

- [x] **Step 1: 실패하는 테스트 작성**

`apps/api/src/guardian/guardian.service.test.ts` 에 아래 describe 블록 추가 (파일 맨 끝에 추가):

```typescript
describe("GuardianService.submitFeeProof — IDOR 방지", () => {
  const makeFeeRepo = (overrides: Partial<AcademyFeeRepository> = {}): AcademyFeeRepository =>
    ({
      findById: jest.fn().mockResolvedValue(null),
      submitPaymentProof: jest.fn().mockResolvedValue({ id: 10, status: "SUBMITTED" }),
      ...overrides,
    } as unknown as AcademyFeeRepository);

  it("fee가 존재하지 않으면 404", async () => {
    const feeRepo = makeFeeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const svc = new GuardianService(makeRepo(), {} as any, {} as any, feeRepo);
    await expect(svc.submitFeeProof(999, "http://proof.url", "player-1"))
      .rejects.toMatchObject({ statusCode: 404, message: "ACADEMY_FEE_NOT_FOUND" });
  });

  it("feeId가 다른 선수 것이면 403", async () => {
    const feeRepo = makeFeeRepo({
      findById: jest.fn().mockResolvedValue({ id: 10, playerId: "player-OTHER" }),
    });
    const svc = new GuardianService(makeRepo(), {} as any, {} as any, feeRepo);
    await expect(svc.submitFeeProof(10, "http://proof.url", "player-1"))
      .rejects.toMatchObject({ statusCode: 403, message: "FORBIDDEN" });
  });

  it("feeId가 자녀 것이면 정상 처리", async () => {
    const feeRepo = makeFeeRepo({
      findById: jest.fn().mockResolvedValue({ id: 10, playerId: "player-1" }),
    });
    const svc = new GuardianService(makeRepo(), {} as any, {} as any, feeRepo);
    await svc.submitFeeProof(10, "http://proof.url", "player-1");
    expect(feeRepo.submitPaymentProof).toHaveBeenCalledWith(10, "http://proof.url");
  });
});
```

파일 상단에 import 추가:
```typescript
import type { AcademyFeeRepository } from "../academy-fee/academy-fee.repo";
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd apps/api && npx jest guardian.service.test --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `svc.submitFeeProof` expects 2 args, not 3.

- [x] **Step 3: `guardian.service.ts` 수정**

`submitFeeProof` 메서드를:

```typescript
async submitFeeProof(feeId: number, url: string) {
  return this.feeRepo.submitPaymentProof(feeId, url);
}
```

아래로 교체:

```typescript
async submitFeeProof(feeId: number, url: string, playerId: string) {
  const fee = await this.feeRepo.findById(feeId);
  if (!fee) throw new AppError(404, "ACADEMY_FEE_NOT_FOUND");
  if (fee.playerId !== playerId) throw new AppError(403, "FORBIDDEN");
  return this.feeRepo.submitPaymentProof(feeId, url);
}
```

- [x] **Step 4: `guardian.controller.ts` 수정**

`submitFeeProof` 핸들러를:

```typescript
submitFeeProof = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feeId = parseInt(req.params['feeId'] as string, 10);
    const { url } = req.body;
    if (!url) throw new AppError(400, "MISSING_FIELDS");
    const result = await this.service.submitFeeProof(feeId, url);
    res.status(200).json(result);
  } catch (e) { next(e); }
};
```

아래로 교체:

```typescript
submitFeeProof = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feeId = parseInt(req.params['feeId'] as string, 10);
    const playerId = req.childPlayerId!;
    const { url } = req.body;
    if (!url) throw new AppError(400, "MISSING_FIELDS");
    const result = await this.service.submitFeeProof(feeId, url, playerId);
    res.status(200).json(result);
  } catch (e) { next(e); }
};
```

(`req.childPlayerId`는 `requireGuardianChild` 미들웨어가 이미 설정해 두며, `PATCH /me/children/:playerId/fees/:feeId/submit-proof` 라우트에는 해당 미들웨어가 이미 적용되어 있음.)

- [x] **Step 5: 테스트 실행 — 통과 확인**

```bash
cd apps/api && npx jest guardian.service.test --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS.

- [x] **Step 6: 커밋**

```bash
git add apps/api/src/guardian/guardian.service.ts \
        apps/api/src/guardian/guardian.controller.ts \
        apps/api/src/guardian/guardian.service.test.ts
git commit -m "fix(guardian): verify feeId belongs to child before submitFeeProof (LS8 IDOR)"
```

---

### Task 2: Growth Report GUARDIAN IDOR 수정 (LS7)

현재: `GET /growth-reports/player/:playerId` 에 role 체크가 전혀 없어, GUARDIAN이 임의의 선수 성장평가를 열람할 수 있음.

Fix 방향: `GrowthReportService`에 `GuardianRepository`를 주입하고, 요청자가 GUARDIAN이면 `getEvaluationsByPlayerForGuardian(playerId, guardianId)`를 호출해 자녀 소유권을 검증한다.

**Files:**
- Modify: `apps/api/src/growth-report/growth-report.service.ts`
- Modify: `apps/api/src/growth-report/growth-report.controller.ts`
- Modify: `apps/api/src/growth-report/growth-report.routes.ts`
- Modify: `apps/api/src/growth-report/growth-report.service.test.ts`

- [x] **Step 1: 실패하는 테스트 작성**

`apps/api/src/growth-report/growth-report.service.test.ts` 맨 끝에 추가:

```typescript
describe("GrowthReportService.getEvaluationsByPlayerForGuardian — IDOR 방지", () => {
  const makeGuardianRepo = (child: { id: string } | null) => ({
    findChildByIdAndGuardian: jest.fn().mockResolvedValue(child),
  });

  it("자녀가 아니면 403", async () => {
    const guardianRepo = makeGuardianRepo(null);
    const service = new GrowthReportService(
      makeRepo(),
      makeNotifRepo(),
      makePlanRepo(),
      guardianRepo as any,
    );
    await expect(service.getEvaluationsByPlayerForGuardian("player-uuid-1", 99))
      .rejects.toMatchObject({ statusCode: 403, message: "FORBIDDEN" });
  });

  it("자녀이면 evaluations 반환", async () => {
    const guardianRepo = makeGuardianRepo({ id: "player-uuid-1" });
    const evals = [{ id: 1, playerId: "player-uuid-1" }];
    const repo = makeRepo({ findEvaluationsByPlayer: jest.fn().mockResolvedValue(evals) });
    const service = new GrowthReportService(repo, makeNotifRepo(), makePlanRepo(), guardianRepo as any);
    const result = await service.getEvaluationsByPlayerForGuardian("player-uuid-1", 99);
    expect(result).toBe(evals);
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd apps/api && npx jest growth-report.service.test --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `GrowthReportService` constructor does not accept 4th arg.

- [x] **Step 3: `guardian.repo.ts` 에 `findChildByIdAndGuardian` 추가**

`apps/api/src/guardian/guardian.repo.ts` 의 `findChildById` 메서드 아래에 추가:

```typescript
findChildByIdAndGuardian(playerId: string, guardianId: number) {
  return this.prisma.player.findFirst({
    where: { id: playerId, guardianId },
    select: { id: true },
  });
}
```

- [x] **Step 4: `growth-report.service.ts` 수정**

파일 상단 import 블록에 추가:
```typescript
import type { GuardianRepository } from "../guardian/guardian.repo";
```

`GrowthReportService` 생성자를:
```typescript
constructor(
  private repo: GrowthReportRepository,
  private notifRepo: NotificationRepository,
  private planRepo: DevelopmentPlanRepository,
) {}
```

아래로 교체:
```typescript
constructor(
  private repo: GrowthReportRepository,
  private notifRepo: NotificationRepository,
  private planRepo: DevelopmentPlanRepository,
  private guardianRepo?: GuardianRepository,
) {}
```

`getEvaluationsByPlayer` 메서드 바로 아래에 신규 메서드 추가:

```typescript
async getEvaluationsByPlayerForGuardian(playerId: string, guardianId: number) {
  const child = await this.guardianRepo!.findChildByIdAndGuardian(playerId, guardianId);
  if (!child) throw new AppError(403, "FORBIDDEN");
  return this.repo.findEvaluationsByPlayer(playerId);
}
```

- [x] **Step 5: `growth-report.controller.ts` 수정**

`getEvaluationsByPlayer` 핸들러를:

```typescript
getEvaluationsByPlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await this.service.getEvaluationsByPlayer(String(req.params["playerId"])));
  } catch (e) { next(e); }
};
```

아래로 교체:

```typescript
getEvaluationsByPlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const playerId = String(req.params["playerId"]);
    if (user.role === "GUARDIAN") {
      return res.json(await this.service.getEvaluationsByPlayerForGuardian(playerId, user.id));
    }
    res.json(await this.service.getEvaluationsByPlayer(playerId));
  } catch (e) { next(e); }
};
```

- [x] **Step 6: `growth-report.routes.ts` 수정**

`GuardianRepository` 주입. 현재 라우트 파일의 상단 import 영역과 서비스 생성 부분을 업데이트:

현재:
```typescript
import { GrowthReportController } from "./growth-report.controller";
import { GrowthReportService } from "./growth-report.service";
import { GrowthReportRepository } from "./growth-report.repo";
import { DevelopmentPlanRepository } from "../development-plan/development-plan.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new GrowthReportRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const planRepo = new DevelopmentPlanRepository(prisma);
const service = new GrowthReportService(repo, notifRepo, planRepo);
```

교체:
```typescript
import { GrowthReportController } from "./growth-report.controller";
import { GrowthReportService } from "./growth-report.service";
import { GrowthReportRepository } from "./growth-report.repo";
import { DevelopmentPlanRepository } from "../development-plan/development-plan.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { GuardianRepository } from "../guardian/guardian.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new GrowthReportRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const planRepo = new DevelopmentPlanRepository(prisma);
const guardianRepo = new GuardianRepository(prisma);
const service = new GrowthReportService(repo, notifRepo, planRepo, guardianRepo);
```

- [x] **Step 7: 테스트 실행 — 통과 확인**

```bash
cd apps/api && npx jest growth-report.service.test --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS.

- [x] **Step 8: 커밋**

```bash
git add apps/api/src/guardian/guardian.repo.ts \
        apps/api/src/growth-report/growth-report.service.ts \
        apps/api/src/growth-report/growth-report.controller.ts \
        apps/api/src/growth-report/growth-report.routes.ts \
        apps/api/src/growth-report/growth-report.service.test.ts
git commit -m "fix(growth-report): require guardian child ownership for player evaluations (LS7 IDOR)"
```

---

### Task 3: 티켓 cancel 인가 가드 추가 (J2)

현재: `cancel` 핸들러가 `req.user!.id`를 non-null assertion으로 사용. 라우트 미들웨어(`auth`, `checkWriteFinance`)가 있지만 컨트롤러 내부에 `requireUser()` 안전망이 없어 미들웨어 우회 시 crash.

**Files:**
- Modify: `apps/api/src/sales/sales.controller.ts:120-128`

- [x] **Step 1: 실패하는 테스트 작성**

`apps/api/src/sales/sales.service.test.ts` 맨 끝에 추가:

```typescript
describe("SalesController.cancel — requireUser 가드", () => {
  it("user가 없는 요청은 401을 next로 전달해야 한다", async () => {
    // 이 테스트는 컨트롤러를 직접 호출해 미들웨어 우회를 시뮬레이션
    const { SalesController } = require("./sales.controller");
    const mockService = { createCancellation: jest.fn() } as any;
    const ctrl = new SalesController(mockService);
    const req = { params: { id: "1" }, body: {}, user: undefined } as any;
    const res = { json: jest.fn() } as any;
    const next = jest.fn();
    await ctrl.cancel(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(mockService.createCancellation).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd apps/api && npx jest sales.service.test --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `next` is not called with 401; instead `req.user!.id` crashes or service is called.

- [x] **Step 3: `sales.controller.ts` 수정**

`cancel` 핸들러를:

```typescript
cancel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params["id"]);
    const record = await this.service.createCancellation(id, req.body, req.user!.id);
    res.json(record);
  } catch (err) {
    next(err);
  }
};
```

아래로 교체:

```typescript
cancel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole, id: userId } = requireUser(req);
    if (!canWriteFinance(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
    const id = Number(req.params["id"]);
    const record = await this.service.createCancellation(id, req.body, userId);
    res.json(record);
  } catch (err) {
    next(err);
  }
};
```

상단 import에 `canWriteFinance` 추가 (아직 없으면):
```typescript
import { canWriteFinance } from "../lib/permissions";
import { AppError } from "../lib/appError";
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd apps/api && npx jest sales.service.test --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS.

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/sales/sales.controller.ts \
        apps/api/src/sales/sales.service.test.ts
git commit -m "fix(sales): add requireUser + canWriteFinance guard to cancel endpoint (J2)"
```

---

### Task 4: 시설 구역 접근 제어 — frontOfficeRole 분기 (TR8 확장)

현재: `canAccessZone(role, zone)` 이 `role: "FRONT_OFFICE"` 만 보고 `frontOfficeRole` 을 무시. FRONT_OFFICE 전원이 동일한 구역 접근권 보유.

Fix: `GROUND`, `SAFETY`, `OPERATIONS` 구역은 모든 FRONT_OFFICE에게 허용하되, `MECHANICAL`, `STRUCTURAL`, `SANITATION` 구역은 `frontOfficeRole === "ASSET_MANAGER"` 인 경우에만 허용.

**Files:**
- Modify: `apps/api/src/lib/facilityAccessControl.ts`
- Create: `apps/api/src/lib/facilityAccessControl.test.ts`

- [x] **Step 1: 실패하는 테스트 작성**

`apps/api/src/lib/facilityAccessControl.test.ts` 신규 생성:

```typescript
import { canAccessZone } from "./facilityAccessControl";

describe("canAccessZone", () => {
  describe("FRONT_OFFICE — 일반 (frontOfficeRole 없음)", () => {
    it("GROUND 허용", () => {
      expect(canAccessZone("FRONT_OFFICE", "GROUND")).toBe(true);
    });
    it("SAFETY 허용", () => {
      expect(canAccessZone("FRONT_OFFICE", "SAFETY")).toBe(true);
    });
    it("OPERATIONS 허용", () => {
      expect(canAccessZone("FRONT_OFFICE", "OPERATIONS")).toBe(true);
    });
    it("MECHANICAL 거부 (ASSET_MANAGER만 가능)", () => {
      expect(canAccessZone("FRONT_OFFICE", "MECHANICAL")).toBe(false);
    });
    it("STRUCTURAL 거부 (ASSET_MANAGER만 가능)", () => {
      expect(canAccessZone("FRONT_OFFICE", "STRUCTURAL")).toBe(false);
    });
    it("SANITATION 거부 (ASSET_MANAGER만 가능)", () => {
      expect(canAccessZone("FRONT_OFFICE", "SANITATION")).toBe(false);
    });
  });

  describe("FRONT_OFFICE — ASSET_MANAGER", () => {
    it("MECHANICAL 허용", () => {
      expect(canAccessZone("FRONT_OFFICE", "MECHANICAL", "ASSET_MANAGER")).toBe(true);
    });
    it("STRUCTURAL 허용", () => {
      expect(canAccessZone("FRONT_OFFICE", "STRUCTURAL", "ASSET_MANAGER")).toBe(true);
    });
    it("SANITATION 허용", () => {
      expect(canAccessZone("FRONT_OFFICE", "SANITATION", "ASSET_MANAGER")).toBe(true);
    });
    it("LOCKER_ROOM 거부 (COACHING_STAFF·PLAYER만)", () => {
      expect(canAccessZone("FRONT_OFFICE", "LOCKER_ROOM", "ASSET_MANAGER")).toBe(false);
    });
    it("MEDICAL_ROOM 거부 (COACHING_STAFF만)", () => {
      expect(canAccessZone("FRONT_OFFICE", "MEDICAL_ROOM", "ASSET_MANAGER")).toBe(false);
    });
  });

  describe("다른 역할", () => {
    it("ADMIN은 모든 구역 허용", () => {
      expect(canAccessZone("ADMIN", "LOCKER_ROOM")).toBe(true);
      expect(canAccessZone("ADMIN", "MEDICAL_ROOM")).toBe(true);
    });
    it("PLAYER는 LOCKER_ROOM 허용, MECHANICAL 거부", () => {
      expect(canAccessZone("PLAYER", "LOCKER_ROOM")).toBe(true);
      expect(canAccessZone("PLAYER", "MECHANICAL")).toBe(false);
    });
    it("COACHING_STAFF는 MEDICAL_ROOM 허용, SANITATION 거부", () => {
      expect(canAccessZone("COACHING_STAFF", "MEDICAL_ROOM")).toBe(true);
      expect(canAccessZone("COACHING_STAFF", "SANITATION")).toBe(false);
    });
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd apps/api && npx jest facilityAccessControl.test --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `canAccessZone` does not accept 3rd arg; FRONT_OFFICE currently allowed on MECHANICAL/STRUCTURAL/SANITATION.

- [x] **Step 3: `facilityAccessControl.ts` 수정**

파일 전체를 아래로 교체:

```typescript
import type { FacilityZone } from "../generated/enums";

type Role = string;
type FrontOfficeRole = string | null | undefined;

// FRONT_OFFICE 전체 허용 구역
const FRONT_OFFICE_OPEN_ZONES: FacilityZone[] = ["GROUND", "SAFETY", "OPERATIONS"];

// ASSET_MANAGER만 추가 접근 가능한 구역
const ASSET_MANAGER_ONLY_ZONES: FacilityZone[] = ["MECHANICAL", "STRUCTURAL", "SANITATION"];

export const ZONE_ACCESS_RULES: Record<FacilityZone, Role[]> = {
  GROUND:      ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER", "FRONT_OFFICE"],
  MECHANICAL:  ["ADMIN", "SUPER_ADMIN", "GM"],
  STRUCTURAL:  ["ADMIN", "SUPER_ADMIN", "GM"],
  SAFETY:      ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE", "COACHING_STAFF"],
  SANITATION:  ["ADMIN", "SUPER_ADMIN", "GM"],
  OPERATIONS:  ["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"],
  LOCKER_ROOM: ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER"],
  MEDICAL_ROOM:["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF"],
  SHOWER_ROOM: ["ADMIN", "SUPER_ADMIN", "GM", "COACHING_STAFF", "PLAYER"],
};

export function canAccessZone(role: Role, zone: FacilityZone, frontOfficeRole?: FrontOfficeRole): boolean {
  if (role === "FRONT_OFFICE" && ASSET_MANAGER_ONLY_ZONES.includes(zone)) {
    return frontOfficeRole === "ASSET_MANAGER";
  }
  return ZONE_ACCESS_RULES[zone]?.includes(role) ?? false;
}
```

- [x] **Step 4: `access-log.service.ts` 호출부 확인**

`apps/api/src/facility/access-log/access-log.service.ts:14` 에서 `canAccessZone(userRole, dto.zone)` 으로 호출 중. `frontOfficeRole` 을 전달해야 함. 서비스에 `frontOfficeRole` 파라미터 추가:

```typescript
async logAccess(userId: number, userRole: string, dto: LogAccessDto, frontOfficeRole?: string | null) {
  const allowed = canAccessZone(userRole, dto.zone, frontOfficeRole ?? undefined);
  const action = allowed ? dto.action : "ATTEMPT_DENIED";
  await this.repo.create({ userId, zone: dto.zone, action, ...(dto.reason !== undefined && { reason: dto.reason }) });
  if (!allowed) throw new AppError(403, "ZONE_ACCESS_DENIED");
}
```

- [x] **Step 5: `access-log.controller.ts` 수정**

`logAccess` 핸들러에서 `frontOfficeRole` 전달:

현재:
```typescript
logAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    await this.service.logAccess(user.id, user.role, req.body as LogAccessDto);
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
};
```

교체:
```typescript
logAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    await this.service.logAccess(user.id, user.role, req.body as LogAccessDto, user.frontOfficeRole);
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
};
```

- [x] **Step 6: 테스트 실행 — 통과 확인**

```bash
cd apps/api && npx jest facilityAccessControl.test --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS.

- [x] **Step 7: 전체 테스트 실행**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -30
```

Expected: All tests PASS (기존 테스트 회귀 없음).

- [x] **Step 8: 커밋**

```bash
git add apps/api/src/lib/facilityAccessControl.ts \
        apps/api/src/lib/facilityAccessControl.test.ts \
        apps/api/src/facility/access-log/access-log.service.ts \
        apps/api/src/facility/access-log/access-log.controller.ts
git commit -m "fix(facility): restrict MECHANICAL/STRUCTURAL/SANITATION to ASSET_MANAGER frontOfficeRole (IDOR)"
```

---

## Self-Review

**Spec coverage 체크:**
- LS8 guardian feeId IDOR → Task 1 ✅
- LS7 growth report GUARDIAN IDOR → Task 2 ✅
- J2 cancel 인가 가드 누락 → Task 3 ✅
- 시설 frontOfficeRole 무시 → Task 4 ✅

**Placeholder scan:** 없음 — 모든 스텝에 실제 코드 포함.

**Type consistency:**
- `submitFeeProof(feeId, url, playerId)` — Task 1 서비스·컨트롤러·테스트 모두 동일 시그니처 사용 ✅
- `getEvaluationsByPlayerForGuardian(playerId, guardianId)` — Task 2 서비스·컨트롤러·테스트 모두 동일 ✅
- `canAccessZone(role, zone, frontOfficeRole?)` — Task 4 함수·서비스·컨트롤러·테스트 모두 동일 ✅
- `findChildByIdAndGuardian(playerId, guardianId)` — guardian.repo와 growth-report.service.test 모두 동일 ✅
