# Demo Account PII Masking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 데모 계정(`isDemo: true`)이 사용자 관리 / 감사 로그 조회 시 `email`, `username`을 부분 마스킹해서 반환하도록 백엔드에서 처리한다.

**Architecture:** `isDemo` 플래그를 User 스키마에 추가하고, JWT 페이로드에 포함시켜 `req.user.isDemo`로 접근 가능하게 한다. AdminService의 `listUsers`, `getUserById`, `getAuditLogs`에서 요청자가 isDemo이면 마스킹 유틸을 적용한다. isDemo 설정은 SUPER_ADMIN 전용 엔드포인트로 분리한다.

**Tech Stack:** Express, Prisma (PostgreSQL), TypeScript, Jest

---

### Task 1: Prisma 스키마에 `isDemo` 추가 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: schema.prisma User 모델에 `isDemo` 필드 추가**

`apps/api/prisma/schema.prisma`의 User 모델에서 `isOutOfOffice` 다음 줄에 추가:

```prisma
isDemo          Boolean          @default(false)
```

결과:
```prisma
model User {
  id              Int              @id @default(autoincrement())
  email           String           @unique
  password        String
  username        String
  nickname        String           @unique
  role            Role
  coachingRole    CoachingRole?
  frontOfficeRole FrontOfficeRole?
  isDeleted       Boolean          @default(false)
  isOutOfOffice   Boolean          @default(false)
  isDemo          Boolean          @default(false)   // ← 추가
  language        String           @default("ko")
  ...
}
```

- [x] **Step 2: 마이그레이션 실행**

```bash
cd apps/api && npx prisma migrate dev --name add_is_demo_to_user
```

Expected: `✔ Your database is now in sync with your schema.`

- [x] **Step 3: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add isDemo flag to User model"
```

---

### Task 2: `maskPii` 유틸 작성 (TDD)

**Files:**
- Create: `apps/api/src/lib/maskPii.ts`
- Create: `apps/api/__test__/lib/maskPii.test.ts`

- [x] **Step 1: 실패하는 테스트 작성**

`apps/api/__test__/lib/maskPii.test.ts`:

```typescript
import { describe, test, expect } from "@jest/globals";
import { maskEmail, maskUsername } from "../../src/lib/maskPii";

describe("maskEmail", () => {
  test("local part가 4자 이상이면 앞 2자만 남기고 ***@domain", () => {
    expect(maskEmail("hong@kfa.kr")).toBe("ho***@kfa.kr");
  });

  test("local part가 3자면 앞 1자만 남기고 ***@domain", () => {
    expect(maskEmail("abc@test.com")).toBe("a***@test.com");
  });

  test("local part가 2자 이하면 전체 ***@domain", () => {
    expect(maskEmail("ab@test.com")).toBe("***@test.com");
    expect(maskEmail("a@test.com")).toBe("***@test.com");
  });

  test("@ 없는 비정상 입력은 ***로 처리", () => {
    expect(maskEmail("notanemail")).toBe("***");
  });
});

describe("maskUsername", () => {
  test("4자 이상이면 앞 3자 + ***", () => {
    expect(maskUsername("hong_gildong")).toBe("hon***");
    expect(maskUsername("juno")).toBe("jun***");
  });

  test("3자 이하면 전체 ***", () => {
    expect(maskUsername("ab")).toBe("***");
    expect(maskUsername("a")).toBe("***");
    expect(maskUsername("abc")).toBe("***");
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api && npx jest __test__/lib/maskPii.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/lib/maskPii'`

- [x] **Step 3: `maskPii.ts` 구현**

`apps/api/src/lib/maskPii.ts`:

```typescript
export function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "***";
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  const visibleLen = local.length >= 4 ? 2 : local.length >= 3 ? 1 : 0;
  return visibleLen > 0 ? `${local.slice(0, visibleLen)}***${domain}` : `***${domain}`;
}

export function maskUsername(username: string): string {
  return username.length >= 4 ? `${username.slice(0, 3)}***` : "***";
}
```

- [x] **Step 4: 테스트 통과 확인**

```bash
cd apps/api && npx jest __test__/lib/maskPii.test.ts --no-coverage
```

Expected: PASS (모든 테스트)

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/lib/maskPii.ts apps/api/__test__/lib/maskPii.test.ts
git commit -m "feat: add maskEmail and maskUsername PII utilities"
```

---

### Task 3: `Express.User` 타입 및 JWT 페이로드에 `isDemo` 추가

**Files:**
- Modify: `apps/api/src/lib/express.d.ts`
- Modify: `apps/api/src/auth/auth.repo.ts`
- Modify: `apps/api/src/auth/auth.service.ts`

- [x] **Step 1: `Express.User`에 `isDemo` 추가**

`apps/api/src/lib/express.d.ts`:

```typescript
import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";

declare global {
  namespace Express {
    interface User {
      id: number;
      role: Role;
      coachingRole: CoachingRole | null | undefined;
      frontOfficeRole: FrontOfficeRole | null | undefined;
      teamId?: number | null;
      clubId?: number | null;
      isDemo?: boolean;
    }
    interface Request {
      childPlayerId?: string;
    }
  }
}
```

- [x] **Step 2: `auth.repo.ts` — `findByEmail` select에 `isDemo` 추가**

`apps/api/src/auth/auth.repo.ts`의 `findByEmail`:

```typescript
findByEmail(email: string) {
  return this.prisma.user.findUnique({
    where: { email },
    select: {
      id: true, email: true, username: true, nickname: true,
      role: true, coachingRole: true, frontOfficeRole: true,
      teamId: true, clubId: true, password: true, isDemo: true,
    },
  });
}
```

- [x] **Step 3: `auth.service.ts` — `generateTokens` 호출에 `isDemo` 포함**

`apps/api/src/auth/auth.service.ts`의 `login` 메서드에서:

```typescript
const tokens = generateTokens({
  id: user.id,
  role: user.role,
  coachingRole: user.coachingRole,
  frontOfficeRole: user.frontOfficeRole,
  teamId: user.teamId,
  clubId: user.clubId,
  isDemo: user.isDemo,
});
```

- [x] **Step 4: 타입 에러 없는지 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/lib/express.d.ts apps/api/src/auth/auth.repo.ts apps/api/src/auth/auth.service.ts
git commit -m "feat: include isDemo in JWT payload"
```

---

### Task 4: `AdminRepository` — `USER_SELECT`에 `isDemo` 추가 + `setDemo()` 메서드

**Files:**
- Modify: `apps/api/src/admin/admin.repo.ts`

- [x] **Step 1: `USER_SELECT`에 `isDemo` 추가**

`apps/api/src/admin/admin.repo.ts`의 `USER_SELECT`:

```typescript
export const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  nickname: true,
  role: true,
  coachingRole: true,
  frontOfficeRole: true,
  teamId: true,
  clubId: true,
  isDeleted: true,
  isOutOfOffice: true,
  isDemo: true,
  player: { select: { id: true, playerName: true } },
} as const;
```

- [x] **Step 2: `setDemo()` 메서드 추가**

`AdminRepository` 클래스에 추가:

```typescript
setDemo(id: number, isDemo: boolean) {
  return this.prisma.user.update({
    where: { id },
    data: { isDemo },
    select: USER_SELECT,
  });
}
```

- [x] **Step 3: 커밋**

```bash
git add apps/api/src/admin/admin.repo.ts
git commit -m "feat: add isDemo to USER_SELECT and setDemo repo method"
```

---

### Task 5: `AdminService` — 마스킹 적용 + `setDemoStatus()` (TDD)

**Files:**
- Modify: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/__test__/admin/admin.service.test.ts`
- Modify: `apps/api/src/admin/dto/admin.dto.ts`

- [x] **Step 1: `admin.dto.ts`에 `SetDemoDto` 추가**

`apps/api/src/admin/dto/admin.dto.ts`:

```typescript
export interface SetDemoDto {
  isDemo: boolean;
}
```

- [x] **Step 2: 실패하는 테스트 작성**

`apps/api/__test__/admin/admin.service.test.ts`에 추가 (기존 코드 유지, 아래 블록 맨 끝에 추가):

```typescript
describe("AdminService - listUsers (isDemo masking)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("isDemo=false이면 email/username 원본 반환", async () => {
    mockRepo.listUsers.mockResolvedValue([
      { id: 1, email: "hong@kfa.kr", username: "hong_gildong", nickname: "홍길동", role: "ADMIN", isDemo: false },
    ]);
    const result = await service.listUsers({}, false);
    expect(result[0]!.email).toBe("hong@kfa.kr");
    expect(result[0]!.username).toBe("hong_gildong");
  });

  test("isDemo=true이면 email/username 마스킹", async () => {
    mockRepo.listUsers.mockResolvedValue([
      { id: 1, email: "hong@kfa.kr", username: "hong_gildong", nickname: "홍길동", role: "ADMIN", isDemo: false },
    ]);
    const result = await service.listUsers({}, true);
    expect(result[0]!.email).toBe("ho***@kfa.kr");
    expect(result[0]!.username).toBe("hon***");
  });
});

describe("AdminService - getUserById (isDemo masking)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("isDemo=true이면 단건 조회도 마스킹", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, email: "abc@test.com", username: "abcdef", nickname: "테스트", role: "ADMIN" });
    const result = await service.getUserById(1, true);
    expect(result.email).toBe("a***@test.com");
    expect(result.username).toBe("abc***");
  });
});

describe("AdminService - getAuditLogs (isDemo masking)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("isDemo=true이면 actor.username 마스킹", async () => {
    mockRepo.listAuditLogs.mockResolvedValue([
      { id: 1, action: "ROLE_UPDATE", targetId: 2, detail: {}, createdAt: new Date(),
        actor: { id: 1, username: "hong_gildong", nickname: "홍길동", role: "ADMIN" } },
    ]);
    mockRepo.countAuditLogs.mockResolvedValue(1);
    const { logs } = await service.getAuditLogs({}, true);
    expect(logs[0]!.actor.username).toBe("hon***");
  });

  test("isDemo=false이면 actor.username 원본", async () => {
    mockRepo.listAuditLogs.mockResolvedValue([
      { id: 1, action: "ROLE_UPDATE", targetId: 2, detail: {}, createdAt: new Date(),
        actor: { id: 1, username: "hong_gildong", nickname: "홍길동", role: "ADMIN" } },
    ]);
    mockRepo.countAuditLogs.mockResolvedValue(1);
    const { logs } = await service.getAuditLogs({}, false);
    expect(logs[0]!.actor.username).toBe("hong_gildong");
  });
});

describe("AdminService - setDemoStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  test("자기 자신에게는 설정 불가 → 403", async () => {
    await expect(service.setDemoStatus(1, { isDemo: true }, 1, "SUPER_ADMIN")).rejects.toMatchObject({
      statusCode: 403,
      code: "CANNOT_MODIFY_SELF",
    });
  });

  test("SUPER_ADMIN이 아니면 403", async () => {
    await expect(service.setDemoStatus(2, { isDemo: true }, 1, "ADMIN")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  test("대상 유저 없으면 404", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.setDemoStatus(2, { isDemo: true }, 1, "SUPER_ADMIN")).rejects.toMatchObject({
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  });

  test("SUPER_ADMIN이면 isDemo 설정 성공", async () => {
    mockRepo.findById.mockResolvedValue({ id: 2, isDemo: false });
    mockRepo.setDemo.mockResolvedValue({ id: 2, isDemo: true });
    const result = await service.setDemoStatus(2, { isDemo: true }, 1, "SUPER_ADMIN");
    expect(mockRepo.setDemo).toHaveBeenCalledWith(2, true);
    expect(result.isDemo).toBe(true);
  });
});
```

- [x] **Step 3: 테스트 실패 확인**

```bash
cd apps/api && npx jest __test__/admin/admin.service.test.ts --no-coverage
```

Expected: FAIL — `listUsers` 시그니처 불일치, `setDemoStatus` 없음 등

- [x] **Step 4: `AdminService` 구현 수정**

`apps/api/src/admin/admin.service.ts`를 아래로 교체:

```typescript
import { AdminRepository } from "./admin.repo";
import { AppError } from "../lib/appError";
import { maskEmail, maskUsername } from "../lib/maskPii";
import { ListUsersQuery, UpdateUserRoleDto, PlayerWithoutAccountDto, SetDemoDto } from "./dto/admin.dto";
import { Role } from "../generated/enums";

type UserRecord = Awaited<ReturnType<AdminRepository["findById"]>>;
type AuditLogRecord = Awaited<ReturnType<AdminRepository["listAuditLogs"]>>[number];

function applyUserMask<T extends { email: string; username: string }>(user: T): T {
  return { ...user, email: maskEmail(user.email), username: maskUsername(user.username) };
}

export class AdminService {
  constructor(private repo: AdminRepository) {}

  async listUsers(filters: ListUsersQuery, isDemo: boolean = false) {
    const users = await this.repo.listUsers(filters);
    if (!isDemo) return users;
    return users.map(applyUserMask);
  }

  async getPlayersWithoutAccounts(nameFilter?: string): Promise<PlayerWithoutAccountDto[]> {
    return this.repo.findPlayersWithoutAccounts(nameFilter);
  }

  async getUserById(id: number, isDemo: boolean = false) {
    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");
    return isDemo ? applyUserMask(user) : user;
  }

  async updateUserRole(id: number, dto: UpdateUserRoleDto, requesterId: number, requesterRole?: string) {
    if (id === requesterId) throw new AppError(403, "CANNOT_MODIFY_SELF");
    if (dto.role === "SUPER_ADMIN" && requesterRole !== "SUPER_ADMIN") {
      throw new AppError(403, "ONLY_SUPER_ADMIN_CAN_GRANT_SUPER_ADMIN");
    }

    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");

    const coachingRole = dto.role === "COACHING_STAFF" ? (dto.coachingRole ?? null) : null;
    const frontOfficeRole = dto.role === "FRONT_OFFICE" ? (dto.frontOfficeRole ?? null) : null;

    return this.repo.updateRole(id, dto.role, coachingRole, frontOfficeRole, dto.clubId);
  }

  async deactivateUser(id: number, requesterId: number) {
    if (id === requesterId) throw new AppError(403, "CANNOT_MODIFY_SELF");

    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");

    return this.repo.setDeleted(id, true);
  }

  async reactivateUser(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");

    return this.repo.setDeleted(id, false);
  }

  async deleteUser(id: number, requesterId: number) {
    if (id === requesterId) throw new AppError(403, "CANNOT_MODIFY_SELF");

    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");

    const linked = await this.repo.getLinkedData(id);
    if (!linked) throw new AppError(404, "USER_NOT_FOUND");

    const hasLinkedData =
      linked.player !== null ||
      linked._count.managedContracts > 0 ||
      linked._count.createdSessions > 0 ||
      linked._count.approvedSessions > 0 ||
      linked._count.tacticalAnalyses > 0 ||
      linked._count.managedInjuries > 0 ||
      linked._count.agentPlayers > 0 ||
      linked._count.recallRequests > 0 ||
      linked._count.recallApprovals > 0;

    if (hasLinkedData) throw new AppError(409, "USER_HAS_LINKED_DATA");

    await this.repo.hardDelete(id);
  }

  async getAuditLogs(
    filters: { actorId?: number; action?: string; from?: string; to?: string; page?: number; limit?: number },
    isDemo: boolean = false,
  ) {
    const [logs, total] = await Promise.all([
      this.repo.listAuditLogs(filters),
      this.repo.countAuditLogs(filters),
    ]);
    if (!isDemo) return { logs, total };
    return {
      logs: logs.map((log: AuditLogRecord) => ({
        ...log,
        actor: { ...log.actor, username: maskUsername(log.actor.username) },
      })),
      total,
    };
  }

  async setDemoStatus(id: number, dto: SetDemoDto, requesterId: number, requesterRole: string) {
    if (id === requesterId) throw new AppError(403, "CANNOT_MODIFY_SELF");
    if (requesterRole !== "SUPER_ADMIN") throw new AppError(403, "FORBIDDEN");

    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");

    return this.repo.setDemo(id, dto.isDemo);
  }
}
```

- [x] **Step 5: 테스트 통과 확인**

```bash
cd apps/api && npx jest __test__/admin/admin.service.test.ts --no-coverage
```

Expected: PASS (모든 테스트)

- [x] **Step 6: 커밋**

```bash
git add apps/api/src/admin/admin.service.ts apps/api/__test__/admin/admin.service.test.ts apps/api/src/admin/dto/admin.dto.ts
git commit -m "feat: apply PII masking in AdminService for demo accounts"
```

---

### Task 6: `AdminController` + Routes 연결

**Files:**
- Modify: `apps/api/src/admin/admin.controller.ts`
- Modify: `apps/api/src/admin/admin.routes.ts`

- [x] **Step 1: controller에 `isDemo` 전달 + `setDemoStatus` 핸들러 추가**

`apps/api/src/admin/admin.controller.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { AdminService } from "./admin.service";
import { ListUsersQuery, SetDemoDto } from "./dto/admin.dto";
import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";
import { hasPermission, Permission } from "../lib/permissions";
import { writeAuditLog } from "../lib/auditLog";

const requireAdmin = (req: Request): void => {
  if (!hasPermission(req.user!.role as Role, Permission.SYSTEM_MANAGE)) {
    throw new AppError(403, "FORBIDDEN");
  }
};

export class AdminController {
  constructor(private service: AdminService) {}

  listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const filters: ListUsersQuery = {
        ...(req.query["username"] && { username: req.query["username"] as string }),
        ...(req.query["role"] && { role: req.query["role"] as Role }),
        ...(req.query["coachingRole"] && { coachingRole: req.query["coachingRole"] as CoachingRole }),
        ...(req.query["frontOfficeRole"] && { frontOfficeRole: req.query["frontOfficeRole"] as FrontOfficeRole }),
        ...(req.query["isDeleted"] !== undefined && { isDeleted: req.query["isDeleted"] === "true" }),
      };
      res.status(200).json(await this.service.listUsers(filters, req.user!.isDemo ?? false));
    } catch (err) {
      next(err);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      res.status(200).json(await this.service.getUserById(Number(req.params["id"]), req.user!.isDemo ?? false));
    } catch (err) {
      next(err);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const targetId = Number(req.params["id"]);
      const result = await this.service.updateUserRole(targetId, req.body, req.user!.id, req.user!.role as Role);
      await writeAuditLog({
        actorId: req.user!.id,
        action: "ROLE_UPDATE",
        targetId,
        detail: { newRole: req.body.role },
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  deactivateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const targetId = Number(req.params["id"]);
      const result = await this.service.deactivateUser(targetId, req.user!.id);
      await writeAuditLog({
        actorId: req.user!.id,
        action: "USER_DEACTIVATE",
        targetId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  reactivateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const targetId = Number(req.params["id"]);
      const result = await this.service.reactivateUser(targetId);
      await writeAuditLog({
        actorId: req.user!.id,
        action: "USER_REACTIVATE",
        targetId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      await this.service.deleteUser(Number(req.params["id"]), req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  listPlayersWithoutAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const nameFilter = req.query["name"] as string | undefined;
      res.status(200).json(await this.service.getPlayersWithoutAccounts(nameFilter));
    } catch (err) {
      next(err);
    }
  };

  listAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const filters: Parameters<typeof this.service.getAuditLogs>[0] = {};
      if (req.query["actorId"]) filters.actorId = Number(req.query["actorId"]);
      if (req.query["action"]) filters.action = req.query["action"] as string;
      if (req.query["from"]) filters.from = req.query["from"] as string;
      if (req.query["to"]) filters.to = req.query["to"] as string;
      if (req.query["page"]) filters.page = Number(req.query["page"]);
      if (req.query["limit"]) filters.limit = Number(req.query["limit"]);
      res.status(200).json(await this.service.getAuditLogs(filters, req.user!.isDemo ?? false));
    } catch (err) {
      next(err);
    }
  };

  setDemoStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAdmin(req);
      const targetId = Number(req.params["id"]);
      const dto: SetDemoDto = { isDemo: Boolean(req.body.isDemo) };
      const result = await this.service.setDemoStatus(targetId, dto, req.user!.id, req.user!.role as string);
      await writeAuditLog({
        actorId: req.user!.id,
        action: "DEMO_STATUS_UPDATE",
        targetId,
        detail: { isDemo: dto.isDemo },
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
```

- [x] **Step 2: `admin.routes.ts`에 demo 엔드포인트 추가**

`apps/api/src/admin/admin.routes.ts`:

```typescript
import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminRepository } from "./admin.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new AdminRepository(getPrisma());
const service = new AdminService(repo);
const controller = new AdminController(service);

router.get("/audit-logs", auth, controller.listAuditLogs);
router.get("/users", auth, controller.listUsers);
router.get("/players-without-accounts", auth, controller.listPlayersWithoutAccounts);
router.get("/users/:id", auth, controller.getUser);
router.patch("/users/:id/role", auth, controller.updateRole);
router.patch("/users/:id/demo", auth, controller.setDemoStatus);
router.patch("/users/:id/deactivate", auth, controller.deactivateUser);
router.patch("/users/:id/reactivate", auth, controller.reactivateUser);
router.delete("/users/:id", auth, controller.deleteUser);

export default router;
```

- [x] **Step 3: 타입 에러 없는지 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 4: 전체 테스트 통과 확인**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: PASS (전체)

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/admin/admin.controller.ts apps/api/src/admin/admin.routes.ts
git commit -m "feat: wire isDemo masking and setDemoStatus endpoint in admin controller"
```
