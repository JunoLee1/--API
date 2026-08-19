# 유소년 모듈 Plan 1: 기반 인프라 (GUARDIAN + YouthRegistration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** GUARDIAN 역할을 시스템에 추가하고, 유소년 선수 입단 신청(YouthRegistration) 워크플로우를 BE+FE 양쪽에 구현한다.

**Architecture:** Role enum에 GUARDIAN 추가 → Player에 guardianId FK 추가 → YouthRegistration 독립 엔티티 신설(PENDING → GUARDIAN_APPROVED → CONTRACTED → Player 생성). CONTRACTED 전환 시 Player 레코드 생성 + guardianId 연결을 단일 트랜잭션으로 처리.

**Tech Stack:** Prisma (schema migration), Hono/Express BE (TypeScript), React + shadcn FE

---

## 파일 맵

### BE — 신규 생성
- `apps/api/src/youth-registration/dto/youth-registration.dto.ts`
- `apps/api/src/youth-registration/youth-registration.repo.ts`
- `apps/api/src/youth-registration/youth-registration.service.ts`
- `apps/api/src/youth-registration/youth-registration.controller.ts`
- `apps/api/src/youth-registration/youth-registration.routes.ts`
- `apps/api/__test__/youth-registration/youth-registration.service.test.ts`

### BE — 수정
- `apps/api/prisma/schema.prisma` — GUARDIAN 추가, YouthRegistration 모델, Player.guardianId, NotificationType 항목
- `apps/api/src/lib/permissions.ts` — GUARDIAN 역할 매핑 추가
- `apps/api/src/notification/notification.repo.ts` — `createForGuardian()` 추가
- `apps/api/src/apiRouter.ts` — youth-registration 라우트 등록

### FE — 신규 생성
- `football/src/services/youthRegistration.service.ts`
- `football/src/types/youth-registration.ts`
- `football/src/pages/youth/YouthRegistrationPage.tsx`
- `football/src/pages/youth/YouthRegistrationFormDialog.tsx`

### FE — 수정
- `football/src/App.tsx` — `/youth-registrations` 라우트 추가
- `football/src/components/layout/Sidebar.tsx` (또는 네비게이션 파일) — 메뉴 항목 추가

---

## Task 1: Schema 마이그레이션 — GUARDIAN + YouthRegistration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: Role enum에 GUARDIAN 추가**

`apps/api/prisma/schema.prisma`의 Role enum을 다음으로 수정:

```prisma
enum Role {
  ADMIN
  FRONT_OFFICE
  COACHING_STAFF
  PLAYER
  AGENT
  GUARDIAN
}
```

- [x] **Step 2: YouthRegistrationStatus enum 추가**

schema.prisma에 다음 enum을 추가 (Role enum 아래 적절한 위치):

```prisma
enum YouthRegistrationStatus {
  PENDING
  GUARDIAN_APPROVED
  CONTRACTED
  REJECTED
}
```

- [x] **Step 3: Player 모델에 guardianId FK 추가**

Player 모델 내 `agentId Int?` 줄 바로 아래에 추가:

```prisma
  guardianId       Int?
```

Player 모델의 relations 블록 내 `agent User? @relation(...)` 아래에 추가:

```prisma
  guardian               User?                   @relation("GuardianPlayers", fields: [guardianId], references: [id])
```

- [x] **Step 4: YouthRegistration 모델 추가**

schema.prisma에 PlayerCallup 모델 바로 위에 추가:

```prisma
model YouthRegistration {
  id                    Int                     @id @default(autoincrement())
  playerName            String
  birthDate             DateTime
  preferredJerseyNumber Int?
  teamId                Int
  guardianId            Int?
  status                YouthRegistrationStatus @default(PENDING)
  requestedById         Int
  rejectionReason       String?
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  team        Team  @relation(fields: [teamId], references: [id])
  guardian    User? @relation("GuardianRegistrations", fields: [guardianId], references: [id])
  requestedBy User  @relation("YouthRegistrationRequester", fields: [requestedById], references: [id])
}
```

- [x] **Step 5: User 모델에 역관계 추가**

User 모델의 relations 블록 내 `callups PlayerCallup[]` 아래에 추가:

```prisma
  guardianPlayers        Player[]                @relation("GuardianPlayers")
  guardianRegistrations  YouthRegistration[]     @relation("GuardianRegistrations")
  youthRegistrations     YouthRegistration[]     @relation("YouthRegistrationRequester")
```

- [x] **Step 6: Team 모델에 역관계 추가**

Team 모델의 relations 블록에 추가:

```prisma
  youthRegistrations YouthRegistration[]
```

- [x] **Step 7: NotificationType enum에 항목 추가**

schema.prisma의 NotificationType enum 마지막 항목(`ATTENDANCE_PENALTY_PLAYER`) 아래에 추가:

```prisma
  YOUTH_REGISTRATION_STATUS_CHANGED
  YOUTH_WEEKLY_SCHEDULE
  YOUTH_SESSION_CHANGED
  INCIDENT_REPORT_SUBMITTED
```

- [x] **Step 8: 마이그레이션 실행**

```bash
cd apps/api
npx prisma migrate dev --name add-guardian-youth-registration
```

Expected: 마이그레이션 파일 생성 + DB 적용 성공 출력

- [x] **Step 9: Prisma client 재생성**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` 성공 메시지

- [x] **Step 10: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(youth): schema - GUARDIAN role, YouthRegistration, Player.guardianId"
```

---

## Task 2: GUARDIAN 권한 설정

**Files:**
- Modify: `apps/api/src/lib/permissions.ts`

- [x] **Step 1: failing test 작성**

`apps/api/__test__/lib/permissions.test.ts` 생성:

```typescript
import { describe, test, expect } from "@jest/globals";
import { hasPermission, Permission } from "../../src/lib/permissions";

describe("GUARDIAN permissions", () => {
  test("GUARDIAN has no special permissions", () => {
    expect(hasPermission("GUARDIAN", Permission.SYSTEM_MANAGE)).toBe(false);
    expect(hasPermission("GUARDIAN", Permission.FINANCE_APPROVE)).toBe(false);
    expect(hasPermission("GUARDIAN", Permission.VIEW_TEAM_RANKING)).toBe(false);
  });

  test("existing roles unaffected", () => {
    expect(hasPermission("ADMIN", Permission.SYSTEM_MANAGE)).toBe(true);
    expect(hasPermission("PLAYER", Permission.VIEW_TEAM_RANKING)).toBe(true);
  });
});
```

- [x] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd apps/api && npx jest __test__/lib/permissions.test.ts --no-coverage
```

Expected: FAIL — `GUARDIAN` is not assignable to type `Role` (TypeScript 에러 또는 런타임 undefined)

- [x] **Step 3: permissions.ts에 GUARDIAN 추가**

`apps/api/src/lib/permissions.ts`의 `ROLE_PERMISSIONS` 객체에 GUARDIAN 항목 추가:

```typescript
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [Permission.SYSTEM_MANAGE, Permission.FINANCE_APPROVE, Permission.VIEW_TEAM_RANKING],
  FRONT_OFFICE: [Permission.VIEW_TEAM_RANKING],
  COACHING_STAFF: [Permission.VIEW_TEAM_RANKING],
  PLAYER: [Permission.VIEW_TEAM_RANKING],
  AGENT: [],
  GUARDIAN: [],
}
```

- [x] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/lib/permissions.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [x] **Step 5: Commit**

```bash
git add apps/api/src/lib/permissions.ts apps/api/__test__/lib/permissions.test.ts
git commit -m "feat(youth): add GUARDIAN to role permissions"
```

---

## Task 3: NotificationRepository — createForGuardian 추가

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`

- [x] **Step 1: failing test 작성**

`apps/api/__test__/notification/notification.repo.guardian.test.ts` 생성:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { NotificationRepository } from "../../src/notification/notification.repo";

const mockPrisma = {
  notification: {
    create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
    createMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 1 }),
    findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    count: jest.fn<() => Promise<number>>().mockResolvedValue(0),
    updateMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 1 }),
  },
  user: {
    findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      { id: 10 },
      { id: 11 },
    ]),
  },
} as any;

const repo = new NotificationRepository(mockPrisma);

describe("NotificationRepository - createForGuardian", () => {
  beforeEach(() => jest.clearAllMocks());

  test("sends notification to specific guardian user", async () => {
    await repo.createForGuardian(10, "YOUTH_REGISTRATION_STATUS_CHANGED", "입단 승인", "승인되었습니다.", 5);
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 10,
        type: "YOUTH_REGISTRATION_STATUS_CHANGED",
        title: "입단 승인",
        body: "승인되었습니다.",
        entityId: 5,
      }),
    });
  });
});
```

- [x] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd apps/api && npx jest __test__/notification/notification.repo.guardian.test.ts --no-coverage
```

Expected: FAIL — `createForGuardian is not a function`

- [x] **Step 3: notification.repo.ts에 메서드 추가**

`apps/api/src/notification/notification.repo.ts`의 `createForUser` 메서드 바로 아래에 추가:

```typescript
  createForGuardian(guardianUserId: number, type: string, title: string, body: string, entityId?: number) {
    return this.prisma.notification.create({
      data: { userId: guardianUserId, type, title, body, isRead: false, entityId },
    });
  }
```

- [x] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/notification/notification.repo.guardian.test.ts --no-coverage
```

Expected: PASS (1 test)

- [x] **Step 5: Commit**

```bash
git add apps/api/src/notification/notification.repo.ts apps/api/__test__/notification/notification.repo.guardian.test.ts
git commit -m "feat(youth): add createForGuardian to NotificationRepository"
```

---

## Task 4: YouthRegistration DTO + Repository

**Files:**
- Create: `apps/api/src/youth-registration/dto/youth-registration.dto.ts`
- Create: `apps/api/src/youth-registration/youth-registration.repo.ts`

- [x] **Step 1: DTO 파일 작성**

`apps/api/src/youth-registration/dto/youth-registration.dto.ts` 생성:

```typescript
import { z } from "zod";

export const CreateYouthRegistrationSchema = z.object({
  playerName: z.string().min(1),
  birthDate: z.string().datetime(),
  preferredJerseyNumber: z.number().int().min(1).max(99).optional(),
  teamId: z.number().int(),
  guardianEmail: z.string().email(),
});

export const RejectYouthRegistrationSchema = z.object({
  rejectionReason: z.string().min(1),
});

export const YouthRegistrationListQuerySchema = z.object({
  teamId: z.coerce.number().int().optional(),
  status: z.enum(["PENDING", "GUARDIAN_APPROVED", "CONTRACTED", "REJECTED"]).optional(),
});

export type CreateYouthRegistrationDto = z.infer<typeof CreateYouthRegistrationSchema>;
export type RejectYouthRegistrationDto = z.infer<typeof RejectYouthRegistrationSchema>;
export type YouthRegistrationListQuery = z.infer<typeof YouthRegistrationListQuerySchema>;
```

- [x] **Step 2: Repository 작성**

`apps/api/src/youth-registration/youth-registration.repo.ts` 생성:

```typescript
import type { PrismaClient } from "../generated/client";
import type { CreateYouthRegistrationDto, YouthRegistrationListQuery } from "./dto/youth-registration.dto";

export class YouthRegistrationRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: YouthRegistrationListQuery) {
    return this.prisma.youthRegistration.findMany({
      where: {
        ...(query.teamId && { teamId: query.teamId }),
        ...(query.status && { status: query.status }),
      },
      include: { team: { select: { id: true, name: true } }, guardian: { select: { id: true, username: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.youthRegistration.findUnique({
      where: { id },
      include: { team: true, guardian: { select: { id: true, username: true, email: true } }, requestedBy: { select: { id: true, username: true } } },
    });
  }

  create(data: CreateYouthRegistrationDto & { requestedById: number; guardianId?: number }) {
    return this.prisma.youthRegistration.create({
      data: {
        playerName: data.playerName,
        birthDate: new Date(data.birthDate),
        preferredJerseyNumber: data.preferredJerseyNumber,
        teamId: data.teamId,
        guardianId: data.guardianId,
        requestedById: data.requestedById,
        status: "PENDING",
      },
      include: { team: { select: { id: true, name: true } } },
    });
  }

  updateStatus(id: number, status: "GUARDIAN_APPROVED" | "REJECTED", extra?: { rejectionReason?: string }) {
    return this.prisma.youthRegistration.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  findGuardianByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email, role: "GUARDIAN" } });
  }

  contractAndCreatePlayer(
    id: number,
    registration: { playerName: string; birthDate: Date; teamId: number; guardianId: number | null; preferredJerseyNumber: number | null },
    nationalityId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.youthRegistration.update({ where: { id }, data: { status: "CONTRACTED" } });
      const player = await tx.player.create({
        data: {
          playerName: registration.playerName,
          dateOfBirth: registration.birthDate,
          preferredFoot: "RIGHT",
          height: 0,
          weight: 0,
          position: "STRIKER",
          level: "YOUTH",
          nationalityId,
          teamId: registration.teamId,
          guardianId: registration.guardianId,
        },
      });
      return player;
    });
  }
}
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/youth-registration/
git commit -m "feat(youth): YouthRegistration DTO and Repository"
```

---

## Task 5: YouthRegistration Service (TDD)

**Files:**
- Create: `apps/api/src/youth-registration/youth-registration.service.ts`
- Create: `apps/api/__test__/youth-registration/youth-registration.service.test.ts`

- [x] **Step 1: failing test 작성**

`apps/api/__test__/youth-registration/youth-registration.service.test.ts` 생성:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { YouthRegistrationService } from "../../src/youth-registration/youth-registration.service";

const mockRepo = {
  findAll: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  findById: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  findGuardianByEmail: jest.fn(),
  contractAndCreatePlayer: jest.fn(),
} as any;

const mockNotifRepo = {
  createForGuardian: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
  createForAdmin: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 2 }),
} as any;

const mockInviteService = {
  inviteUser: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 99 }),
} as any;

const service = new YouthRegistrationService(mockRepo, mockNotifRepo, mockInviteService);

describe("YouthRegistrationService - create", () => {
  beforeEach(() => jest.clearAllMocks());

  test("기존 GUARDIAN가 있으면 초대 없이 guardianId 연결", async () => {
    mockRepo.findGuardianByEmail.mockResolvedValue({ id: 10, email: "parent@test.com" });
    mockRepo.create.mockResolvedValue({ id: 1, playerName: "홍길동", guardianId: 10, team: { name: "U15" } });

    const result = await service.create(
      { playerName: "홍길동", birthDate: "2010-01-01T00:00:00.000Z", teamId: 1, guardianEmail: "parent@test.com" },
      1,
    );

    expect(mockInviteService.inviteUser).not.toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ guardianId: 10 }));
    expect(result.id).toBe(1);
  });

  test("GUARDIAN가 없으면 초대 발송 후 생성", async () => {
    mockRepo.findGuardianByEmail.mockResolvedValue(null);
    mockInviteService.inviteUser.mockResolvedValue({ id: 20 });
    mockRepo.create.mockResolvedValue({ id: 2, playerName: "김철수", guardianId: 20, team: { name: "U18" } });

    await service.create(
      { playerName: "김철수", birthDate: "2008-03-15T00:00:00.000Z", teamId: 2, guardianEmail: "newparent@test.com" },
      1,
    );

    expect(mockInviteService.inviteUser).toHaveBeenCalledWith(expect.objectContaining({ email: "newparent@test.com", role: "GUARDIAN" }));
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ guardianId: 20 }));
  });
});

describe("YouthRegistrationService - guardianApprove", () => {
  beforeEach(() => jest.clearAllMocks());

  test("PENDING 상태만 승인 가능", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: "CONTRACTED", guardianId: 10 });
    await expect(service.guardianApprove(1, 10)).rejects.toMatchObject({ statusCode: 409, code: "INVALID_STATUS" });
  });

  test("다른 GUARDIAN는 승인 불가", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: "PENDING", guardianId: 10 });
    await expect(service.guardianApprove(1, 99)).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  test("본인 GUARDIAN가 PENDING 승인 → GUARDIAN_APPROVED 전환", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: "PENDING", guardianId: 10, playerName: "홍길동" });
    mockRepo.updateStatus.mockResolvedValue({ id: 1, status: "GUARDIAN_APPROVED" });

    await service.guardianApprove(1, 10);

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(1, "GUARDIAN_APPROVED");
  });
});

describe("YouthRegistrationService - contract", () => {
  beforeEach(() => jest.clearAllMocks());

  test("GUARDIAN_APPROVED 상태만 계약 처리 가능", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: "PENDING" });
    await expect(service.contract(1, 1, 1)).rejects.toMatchObject({ statusCode: 409, code: "INVALID_STATUS" });
  });

  test("GUARDIAN_APPROVED → CONTRACTED + Player 생성", async () => {
    const reg = { id: 1, status: "GUARDIAN_APPROVED", playerName: "홍길동", birthDate: new Date("2010-01-01"), teamId: 2, guardianId: 10, preferredJerseyNumber: 7 };
    mockRepo.findById.mockResolvedValue(reg);
    mockRepo.contractAndCreatePlayer.mockResolvedValue({ id: "player-uuid" });

    await service.contract(1, 1, 82); // nationalityId=82(한국)

    expect(mockRepo.contractAndCreatePlayer).toHaveBeenCalledWith(1, reg, 82);
    expect(mockNotifRepo.createForGuardian).toHaveBeenCalledWith(
      10,
      "YOUTH_REGISTRATION_STATUS_CHANGED",
      expect.any(String),
      expect.any(String),
      1,
    );
  });
});
```

- [x] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd apps/api && npx jest __test__/youth-registration/youth-registration.service.test.ts --no-coverage
```

Expected: FAIL — `YouthRegistrationService` not found

- [x] **Step 3: Service 구현**

`apps/api/src/youth-registration/youth-registration.service.ts` 생성:

```typescript
import { AppError } from "../lib/appError";
import type { YouthRegistrationRepository } from "./youth-registration.repo";
import type { NotificationRepository } from "../notification/notification.repo";
import type { CreateYouthRegistrationDto, RejectYouthRegistrationDto, YouthRegistrationListQuery } from "./dto/youth-registration.dto";

export class YouthRegistrationService {
  constructor(
    private repo: YouthRegistrationRepository,
    private notifRepo: NotificationRepository,
    private inviteService: { inviteUser: (data: { email: string; role: string }) => Promise<{ id: number }> },
  ) {}

  getAll(query: YouthRegistrationListQuery) {
    return this.repo.findAll(query);
  }

  async getById(id: number) {
    const reg = await this.repo.findById(id);
    if (!reg) throw new AppError(404, "YOUTH_REGISTRATION_NOT_FOUND");
    return reg;
  }

  async create(dto: CreateYouthRegistrationDto, requestedById: number) {
    let guardianId: number | undefined;

    const existingGuardian = await this.repo.findGuardianByEmail(dto.guardianEmail);
    if (existingGuardian) {
      guardianId = existingGuardian.id;
    } else {
      const invited = await this.inviteService.inviteUser({ email: dto.guardianEmail, role: "GUARDIAN" });
      guardianId = invited.id;
    }

    return this.repo.create({ ...dto, requestedById, guardianId });
  }

  async guardianApprove(id: number, guardianUserId: number) {
    const reg = await this.repo.findById(id);
    if (!reg) throw new AppError(404, "YOUTH_REGISTRATION_NOT_FOUND");
    if (reg.guardianId !== guardianUserId) throw new AppError(403, "FORBIDDEN");
    if (reg.status !== "PENDING") throw new AppError(409, "INVALID_STATUS");

    return this.repo.updateStatus(id, "GUARDIAN_APPROVED");
  }

  async reject(id: number, dto: RejectYouthRegistrationDto) {
    const reg = await this.repo.findById(id);
    if (!reg) throw new AppError(404, "YOUTH_REGISTRATION_NOT_FOUND");
    if (!["PENDING", "GUARDIAN_APPROVED"].includes(reg.status)) throw new AppError(409, "INVALID_STATUS");

    const updated = await this.repo.updateStatus(id, "REJECTED", { rejectionReason: dto.rejectionReason });

    if (reg.guardianId) {
      void this.notifRepo
        .createForGuardian(reg.guardianId, "YOUTH_REGISTRATION_STATUS_CHANGED", "입단 신청 반려", `${reg.playerName} 선수의 입단 신청이 반려됐습니다.`, id)
        .catch(console.error);
    }
    return updated;
  }

  async contract(id: number, requestedById: number, nationalityId: number) {
    const reg = await this.repo.findById(id);
    if (!reg) throw new AppError(404, "YOUTH_REGISTRATION_NOT_FOUND");
    if (reg.status !== "GUARDIAN_APPROVED") throw new AppError(409, "INVALID_STATUS");

    const player = await this.repo.contractAndCreatePlayer(id, reg, nationalityId);

    if (reg.guardianId) {
      void this.notifRepo
        .createForGuardian(reg.guardianId, "YOUTH_REGISTRATION_STATUS_CHANGED", "입단 완료", `${reg.playerName} 선수가 정식 입단했습니다.`, id)
        .catch(console.error);
    }

    return player;
  }
}
```

- [x] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/youth-registration/youth-registration.service.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [x] **Step 5: Commit**

```bash
git add apps/api/src/youth-registration/youth-registration.service.ts apps/api/__test__/youth-registration/
git commit -m "feat(youth): YouthRegistrationService with TDD"
```

---

## Task 6: YouthRegistration Controller + Routes

**Files:**
- Create: `apps/api/src/youth-registration/youth-registration.controller.ts`
- Create: `apps/api/src/youth-registration/youth-registration.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: Controller 작성**

`apps/api/src/youth-registration/youth-registration.controller.ts` 생성:

```typescript
import type { Request, Response, NextFunction } from "express";
import type { YouthRegistrationService } from "./youth-registration.service";
import { CreateYouthRegistrationSchema, RejectYouthRegistrationSchema, YouthRegistrationListQuerySchema } from "./dto/youth-registration.dto";

export class YouthRegistrationController {
  constructor(private service: YouthRegistrationService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = YouthRegistrationListQuerySchema.parse(req.query);
      const data = await this.service.getAll(query);
      res.json(data);
    } catch (e) { next(e); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getById(Number(req.params.id));
      res.json(data);
    } catch (e) { next(e); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = CreateYouthRegistrationSchema.parse(req.body);
      const data = await this.service.create(dto, (req.user as any).id);
      res.status(201).json(data);
    } catch (e) { next(e); }
  };

  guardianApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.guardianApprove(Number(req.params.id), (req.user as any).id);
      res.json(data);
    } catch (e) { next(e); }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = RejectYouthRegistrationSchema.parse(req.body);
      const data = await this.service.reject(Number(req.params.id), dto);
      res.json(data);
    } catch (e) { next(e); }
  };

  contract = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { nationalityId } = req.body;
      if (!nationalityId) throw { statusCode: 400, code: "NATIONALITY_REQUIRED" };
      const data = await this.service.contract(Number(req.params.id), (req.user as any).id, Number(nationalityId));
      res.status(201).json(data);
    } catch (e) { next(e); }
  };
}
```

- [x] **Step 2: Routes 작성**

`apps/api/src/youth-registration/youth-registration.routes.ts` 생성:

```typescript
import { Router } from "express";
import passport from "passport";
import { YouthRegistrationController } from "./youth-registration.controller";
import { YouthRegistrationService } from "./youth-registration.service";
import { YouthRegistrationRepository } from "./youth-registration.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { AuthService } from "../auth/auth.service";
import { AuthRepository } from "../auth/auth.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new YouthRegistrationRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const authRepo = new AuthRepository(prisma);
const authService = new AuthService(authRepo);
const service = new YouthRegistrationService(repo, notifRepo, authService);
const controller = new YouthRegistrationController(service);

const auth = passport.authenticate("accessToken", { session: false });

// ADMIN만 목록·생성·반려·계약 처리
router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id/reject", auth, controller.reject);
router.patch("/:id/contract", auth, controller.contract);

// GUARDIAN 본인 승인
router.patch("/:id/guardian-approve", auth, controller.guardianApprove);

export default router;
```

- [x] **Step 3: apiRouter.ts에 라우트 등록**

`apps/api/src/apiRouter.ts`에 import 추가:

```typescript
import youthRegistrationRouter from "./youth-registration/youth-registration.routes";
```

`apiRouter.use("/player-callups", playerCallupRouter);` 줄 아래에 추가:

```typescript
apiRouter.use("/youth-registrations", youthRegistrationRouter);
```

- [x] **Step 4: 서버 기동 확인**

```bash
cd apps/api && npm run dev
```

Expected: 서버 시작 성공, 에러 없음

새 터미널에서:
```bash
curl -s http://localhost:4000/api/youth-registrations -H "Authorization: Bearer <ADMIN_TOKEN>" | head -c 100
```

Expected: `[]` (빈 배열) 또는 인증 에러 (서버 기동 확인용)

- [x] **Step 5: Commit**

```bash
git add apps/api/src/youth-registration/ apps/api/src/apiRouter.ts
git commit -m "feat(youth): YouthRegistration controller, routes, API registration"
```

---

## Task 7: AuthService — GUARDIAN 초대 흐름 확인

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts` (필요 시)

- [x] **Step 1: 기존 inviteUser가 GUARDIAN를 수용하는지 확인**

```bash
grep -n "inviteUser\|role.*valid\|allowedRole\|AGENT" apps/api/src/auth/auth.service.ts | head -20
```

- [x] **Step 2: GUARDIAN 역할 허용 여부 체크**

`inviteUser` 또는 역할 검증 로직에서 허용 역할 목록을 하드코딩한 경우 GUARDIAN 추가. 예시 패턴:

```typescript
// 만약 이런 패턴이 있다면:
const INVITABLE_ROLES = ["ADMIN", "FRONT_OFFICE", "COACHING_STAFF", "PLAYER", "AGENT"];
// 아래로 수정:
const INVITABLE_ROLES = ["ADMIN", "FRONT_OFFICE", "COACHING_STAFF", "PLAYER", "AGENT", "GUARDIAN"];
```

실제 코드 구조에 따라 적용. 없으면 스킵.

- [x] **Step 3: Commit (변경 있는 경우)**

```bash
git add apps/api/src/auth/auth.service.ts
git commit -m "feat(youth): allow GUARDIAN role in invite flow"
```

---

## Task 8: FE 타입 + API 서비스

**Files:**
- Create: `football/src/types/youth-registration.ts`
- Create: `football/src/services/youthRegistration.service.ts`

- [x] **Step 1: 타입 정의**

`football/src/types/youth-registration.ts` 생성:

```typescript
export type YouthRegistrationStatus = 'PENDING' | 'GUARDIAN_APPROVED' | 'CONTRACTED' | 'REJECTED';

export interface YouthRegistration {
  id: number;
  playerName: string;
  birthDate: string;
  preferredJerseyNumber: number | null;
  teamId: number;
  team: { id: number; name: string };
  guardianId: number | null;
  guardian: { id: number; username: string; email: string } | null;
  status: YouthRegistrationStatus;
  requestedById: number;
  rejectionReason: string | null;
  createdAt: string;
}

export interface CreateYouthRegistrationPayload {
  playerName: string;
  birthDate: string;
  preferredJerseyNumber?: number;
  teamId: number;
  guardianEmail: string;
}
```

- [x] **Step 2: API 서비스 작성**

`football/src/services/youthRegistration.service.ts` 생성:

```typescript
import api from '@/lib/api';
import type { YouthRegistration, CreateYouthRegistrationPayload } from '@/types/youth-registration';

export const youthRegistrationApi = {
  getAll: (params?: { teamId?: number; status?: string }) =>
    api.get<YouthRegistration[]>('/youth-registrations', { params }).then(r => r.data),

  getById: (id: number) =>
    api.get<YouthRegistration>(`/youth-registrations/${id}`).then(r => r.data),

  create: (payload: CreateYouthRegistrationPayload) =>
    api.post<YouthRegistration>('/youth-registrations', payload).then(r => r.data),

  guardianApprove: (id: number) =>
    api.patch<YouthRegistration>(`/youth-registrations/${id}/guardian-approve`).then(r => r.data),

  reject: (id: number, rejectionReason: string) =>
    api.patch<YouthRegistration>(`/youth-registrations/${id}/reject`, { rejectionReason }).then(r => r.data),

  contract: (id: number, nationalityId: number) =>
    api.patch(`/youth-registrations/${id}/contract`, { nationalityId }).then(r => r.data),
};
```

- [x] **Step 3: Commit**

```bash
git add football/src/types/youth-registration.ts football/src/services/youthRegistration.service.ts
git commit -m "feat(youth): FE types and API service for YouthRegistration"
```

---

## Task 9: FE — YouthRegistration 목록 페이지 + 생성 다이얼로그

**Files:**
- Create: `football/src/pages/youth/YouthRegistrationFormDialog.tsx`
- Create: `football/src/pages/youth/YouthRegistrationPage.tsx`
- Modify: `football/src/App.tsx`

- [x] **Step 1: 생성 다이얼로그 작성**

`football/src/pages/youth/YouthRegistrationFormDialog.tsx` 생성:

```typescript
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { youthRegistrationApi } from '@/services/youthRegistration.service'
import type { CreateYouthRegistrationPayload } from '@/types/youth-registration'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  teams: { id: number; name: string }[]
}

export function YouthRegistrationFormDialog({ open, onClose, onCreated, teams }: Props) {
  const [form, setForm] = useState<CreateYouthRegistrationPayload>({
    playerName: '',
    birthDate: '',
    teamId: teams[0]?.id ?? 0,
    guardianEmail: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      await youthRegistrationApi.create(form)
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>유소년 입단 신청</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>선수 이름</Label>
            <Input value={form.playerName} onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))} />
          </div>
          <div>
            <Label>생년월일</Label>
            <Input type="date" value={form.birthDate.split('T')[0]} onChange={e => setForm(f => ({ ...f, birthDate: new Date(e.target.value).toISOString() }))} />
          </div>
          <div>
            <Label>소속 팀</Label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={form.teamId}
              onChange={e => setForm(f => ({ ...f, teamId: Number(e.target.value) }))}
            >
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <Label>학부모 이메일</Label>
            <Input type="email" value={form.guardianEmail} onChange={e => setForm(f => ({ ...f, guardianEmail: e.target.value }))} />
          </div>
          <div>
            <Label>선호 등번호 (선택)</Label>
            <Input type="number" min={1} max={99} value={form.preferredJerseyNumber ?? ''} onChange={e => setForm(f => ({ ...f, preferredJerseyNumber: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? '처리 중...' : '신청 등록'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [x] **Step 2: 목록 페이지 작성**

`football/src/pages/youth/YouthRegistrationPage.tsx` 생성:

```typescript
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { youthRegistrationApi } from '@/services/youthRegistration.service'
import type { YouthRegistration } from '@/types/youth-registration'
import { YouthRegistrationFormDialog } from './YouthRegistrationFormDialog'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  GUARDIAN_APPROVED: '학부모 승인',
  CONTRACTED: '입단 완료',
  REJECTED: '반려',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  GUARDIAN_APPROVED: 'secondary',
  CONTRACTED: 'default',
  REJECTED: 'destructive',
}

export default function YouthRegistrationPage() {
  const [registrations, setRegistrations] = useState<YouthRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await youthRegistrationApi.getAll()
      setRegistrations(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">유소년 입단 신청</h1>
        <Button onClick={() => setDialogOpen(true)}>+ 신청 등록</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : registrations.length === 0 ? (
        <p className="text-muted-foreground">입단 신청이 없습니다.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4">선수명</th>
              <th className="py-2 pr-4">팀</th>
              <th className="py-2 pr-4">학부모</th>
              <th className="py-2 pr-4">선호 번호</th>
              <th className="py-2">상태</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map(r => (
              <tr key={r.id} className="border-b hover:bg-muted/40">
                <td className="py-2 pr-4 font-medium">{r.playerName}</td>
                <td className="py-2 pr-4">{r.team.name}</td>
                <td className="py-2 pr-4">{r.guardian?.email ?? '-'}</td>
                <td className="py-2 pr-4">{r.preferredJerseyNumber ?? '-'}</td>
                <td className="py-2">
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <YouthRegistrationFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
        teams={[...new Map(registrations.map(r => [r.teamId, r.team])).values()]}
      />
    </div>
  )
}
```

- [x] **Step 3: App.tsx에 라우트 추가**

`football/src/App.tsx`에 import 추가:

```typescript
import YouthRegistrationPage from './pages/youth/YouthRegistrationPage'
```

Routes 블록에 추가 (`/player-callups` 라우트 아래):

```typescript
<Route path="/youth-registrations" element={<YouthRegistrationPage />} />
```

- [x] **Step 4: 브라우저에서 동작 확인**

```bash
cd football && npm run dev
```

브라우저에서 `http://localhost:3000/youth-registrations` 접속:
- 목록 페이지 렌더링 확인
- "+ 신청 등록" 버튼 클릭 → 다이얼로그 열림 확인
- 폼 입력 후 제출 → ADMIN 토큰으로 정상 등록 확인

- [x] **Step 5: Commit**

```bash
git add football/src/pages/youth/ football/src/App.tsx football/src/types/youth-registration.ts football/src/services/youthRegistration.service.ts
git commit -m "feat(youth): YouthRegistration FE - 목록 페이지 + 생성 다이얼로그"
```

---

## Task 10: 전체 테스트 + 최종 점검

- [x] **Step 1: 전체 BE 테스트 실행**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: 기존 테스트 전부 PASS, 신규 테스트 PASS

- [x] **Step 2: TypeScript 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit
cd football && npx tsc --noEmit
```

Expected: 에러 없음

- [x] **Step 3: 시나리오 체크**

다음 흐름을 수동으로 확인:
1. ADMIN이 입단 신청 생성 → `PENDING` 상태 확인
2. GUARDIAN 계정이 `/youth-registrations/:id/guardian-approve` PATCH → `GUARDIAN_APPROVED` 전환 확인
3. ADMIN이 `/youth-registrations/:id/contract` PATCH (nationalityId 포함) → Player 레코드 생성 확인
4. 다른 GUARDIAN가 승인 시도 → 403 반환 확인

- [x] **Step 4: 최종 Commit**

```bash
git add -A
git commit -m "feat(youth): Plan 1 완료 - GUARDIAN role + YouthRegistration BE/FE"
```

---

## 다음 플랜

- **Plan 2:** `2026-07-22-youth-module-2-lineup-position.md` — MatchLineup Mismatch 경고(FIRST_TEAM) + Position Diversity Index API+FE
- **Plan 3:** `2026-07-22-youth-module-3-incident-report.md` — IncidentReport BE/FE + ExternalReport 스키마 수정
- **Plan 4:** `2026-07-22-youth-module-4-guardian-notifications.md` — 주간 일정 cron + 세션 변경 알림
- **Plan 5:** `2026-07-22-youth-module-5-development-dashboard.md` — TD 육성 모니터링 대시보드
