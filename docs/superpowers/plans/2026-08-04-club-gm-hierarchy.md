# Club Entity & GM Role Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Club 엔티티 신설, GM을 독립 Role로 승격, isLite를 Team에서 Club 레벨로 이동해 `SUPER_ADMIN → ADMIN(Club) → GM(Club) → 1군/2군/유소년` 계층을 구축한다.

**Architecture:**
- `Club` 모델이 여러 `Team`을 소유하고, `User`(ADMIN/GM/FRONT_OFFICE)도 `clubId`로 Club에 귀속된다.
- `GM`은 `Role` enum에 최상위로 추가되고 `FrontOfficeRole.GM`은 제거된다.
- `isLite`는 `Team`에서 `Club`으로 이동, Team API 응답에는 `club.isLite`가 포함된다.
- JWT payload에 `clubId`가 포함되어 API 레이어에서 club-scoping을 수행할 수 있다.

**Tech Stack:** Prisma + PostgreSQL, Express (TypeScript), React + TypeScript (Vite)

---

## File Map

**Create:**
- `apps/api/src/club/club.dto.ts`
- `apps/api/src/club/club.repo.ts`
- `apps/api/src/club/club.service.ts`
- `apps/api/src/club/club.controller.ts`
- `apps/api/src/club/club.routes.ts`
- `football/src/services/club.service.ts`

**Modify:**
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `apps/api/src/lib/express.d.ts`
- `apps/api/src/lib/permissions.ts`
- `apps/api/src/lib/dto.ts`
- `apps/api/src/auth/auth.repo.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/admin/dto/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.repo.ts`
- `apps/api/src/team/team.repo.ts`
- `apps/api/src/team/team.service.ts`
- `apps/api/src/team/team.controller.ts`
- `apps/api/src/team/team.routes.ts`
- `apps/api/src/apiRouter.ts`
- `football/src/types/auth.ts`
- `football/src/types/team.ts`
- `football/src/layouts/AppShell.tsx`
- `football/src/hooks/useLiteMode.ts`
- `football/src/services/teamAdmin.service.ts`
- `football/src/pages/admin/TeamSettingsPage.tsx`

---

## Task 1: Prisma Schema — Club 모델, Role enum, clubId 필드 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Role enum에 GM 추가, FrontOfficeRole에서 GM 제거**

`schema.prisma` 최상단 enum 섹션을 아래로 교체:

```prisma
enum Role {
  ADMIN
  SUPER_ADMIN
  GM
  FRONT_OFFICE
  COACHING_STAFF
  PLAYER
  AGENT
  GUARDIAN
}

enum FrontOfficeRole {
  TD
  CONTRACT_MANAGER
  SCOUT
  EQUIPMENT_MANAGER
  TACTICAL_ANALYST
  FINANCE_MANAGER
  ASSET_MANAGER
  HR_MANAGER
  FACILITY_MANAGER
  HR_STAFF
  ASSET_STAFF
  FINANCE_STAFF
  FACILITY_STAFF
}
```

- [ ] **Step 2: Club 모델 추가**

`schema.prisma`에서 `model Team {` 바로 위에 Club 모델 삽입:

```prisma
model Club {
  id       Int     @id @default(autoincrement())
  name     String
  isActive Boolean @default(true)
  isLite   Boolean @default(false)
  createdAt DateTime @default(now())

  teams    Team[]
  users    User[]
}
```

- [ ] **Step 3: Team 모델 — clubId 추가, isLite 제거**

`model Team { ... }` 블록을 다음으로 교체:

```prisma
model Team {
  id               Int      @id @default(autoincrement())
  name             String
  type             TeamType
  ageGroup         String?
  isActive         Boolean  @default(true)
  trackStats       Boolean  @default(true)
  requiresContract Boolean  @default(true)
  clubId           Int?
  createdAt        DateTime @default(now())

  club             Club?                @relation(fields: [clubId], references: [id])
  players          Player[]
  coachingStaff    User[]
  trainingSessions TrainingSession[]
  matches          Match[]
  coaches          Coach[]
  callupsFrom        PlayerCallup[]    @relation("CallupFromTeam")
  callupsTo          PlayerCallup[]    @relation("CallupToTeam")
  jerseyNumbers      JerseyNumber[]
  youthRegistrations YouthRegistration[]
  incidentReports    IncidentReport[]
}
```

- [ ] **Step 4: User 모델 — clubId 추가, Club relation 추가**

User 모델의 `teamId Int?` 바로 아래에 추가:

```prisma
  clubId          Int?
```

User 모델의 relation 영역 (team relation 근처)에 추가:

```prisma
  club                     Club?                   @relation(fields: [clubId], references: [id])
```

- [ ] **Step 5: Migration 실행**

```bash
cd /Users/juno/work/football/apps/api
npx prisma migrate dev --name add-club-and-gm-role
```

Expected: 마이그레이션 파일 생성 후 DB에 적용, `prisma generate` 자동 실행

- [ ] **Step 6: TypeScript 빌드 오류 확인**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | head -50
```

Expected: `FrontOfficeRole.GM` 참조 오류들 나열됨 (다음 Task에서 순차 수정)

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add Club model, GM Role, clubId to Team and User"
```

---

## Task 2: Backend 타입/권한 레이어 수정

**Files:**
- Modify: `apps/api/src/lib/express.d.ts`
- Modify: `apps/api/src/lib/permissions.ts`

- [ ] **Step 1: express.d.ts에 clubId 추가**

`apps/api/src/lib/express.d.ts` 전체 교체:

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
    }
  }
}
```

- [ ] **Step 2: permissions.ts에 GM 추가**

`apps/api/src/lib/permissions.ts` 전체 교체:

```typescript
import { Role } from '../generated/enums'

export const Permission = {
  SYSTEM_MANAGE: 'SYSTEM_MANAGE',
  FINANCE_APPROVE: 'FINANCE_APPROVE',
  VIEW_TEAM_RANKING: 'VIEW_TEAM_RANKING',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [Permission.SYSTEM_MANAGE, Permission.FINANCE_APPROVE, Permission.VIEW_TEAM_RANKING],
  SUPER_ADMIN: [Permission.SYSTEM_MANAGE, Permission.FINANCE_APPROVE, Permission.VIEW_TEAM_RANKING],
  GM: [Permission.FINANCE_APPROVE, Permission.VIEW_TEAM_RANKING],
  FRONT_OFFICE: [Permission.VIEW_TEAM_RANKING],
  COACHING_STAFF: [Permission.VIEW_TEAM_RANKING],
  PLAYER: [Permission.VIEW_TEAM_RANKING],
  AGENT: [],
  GUARDIAN: [],
}

export const isSuperAdmin = (user: Express.User): boolean =>
  user.role === 'SUPER_ADMIN'

export const isAdminLike = (role: string): boolean =>
  role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'GM'

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/express.d.ts apps/api/src/lib/permissions.ts
git commit -m "feat: add GM to permissions and clubId to Express.User"
```

---

## Task 3: Auth 레이어 — clubId를 JWT에 포함

**Files:**
- Modify: `apps/api/src/auth/auth.repo.ts`
- Modify: `apps/api/src/auth/auth.service.ts`

- [ ] **Step 1: auth.repo.ts — findByEmail, findById 쿼리에 clubId 추가**

`apps/api/src/auth/auth.repo.ts`의 두 select 블록에 `clubId: true` 추가:

```typescript
findByEmail(email: string) {
  return this.prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, username: true, nickname: true, role: true, coachingRole: true, frontOfficeRole: true, teamId: true, clubId: true, password: true, language: true },
  });
}
```

```typescript
findById(id: number) {
  return this.prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, username: true, nickname: true, role: true, coachingRole: true, frontOfficeRole: true, teamId: true, clubId: true, language: true },
  });
}
```

- [ ] **Step 2: auth.service.ts — generateTokens에 clubId 포함**

`apps/api/src/auth/auth.service.ts`의 `login` 메서드에서:

```typescript
const tokens = generateTokens({
  id: user.id,
  role: user.role,
  coachingRole: user.coachingRole,
  frontOfficeRole: user.frontOfficeRole,
  teamId: user.teamId,
  clubId: user.clubId,
});
```

- [ ] **Step 3: lib/dto.ts — CreateUserDto에서 GM은 frontOfficeRole 없음 (변경 없음)**

`GM` role은 `frontOfficeRole`을 갖지 않으므로 기존 optional 처리로 충분. 변경 불필요.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/auth.repo.ts apps/api/src/auth/auth.service.ts
git commit -m "feat: include clubId in JWT and auth queries"
```

---

## Task 4: Admin 레이어 — GM Role 처리

**Files:**
- Modify: `apps/api/src/admin/dto/admin.dto.ts`
- Modify: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/src/admin/admin.repo.ts`

- [ ] **Step 1: admin.dto.ts 전체 교체**

```typescript
import { Role, CoachingRole, FrontOfficeRole } from "../../generated/enums";

export interface ListUsersQuery {
  username?: string;
  role?: Role;
  coachingRole?: CoachingRole;
  frontOfficeRole?: FrontOfficeRole;
  isDeleted?: boolean;
}

export interface UpdateUserRoleDto {
  role: Role;
  coachingRole?: CoachingRole | null;
  frontOfficeRole?: FrontOfficeRole | null;
  clubId?: number | null;
}

export interface PlayerWithoutAccountDto {
  id: string;
  playerName: string;
  status: string;
  position: string | null;
}
```

- [ ] **Step 2: admin.repo.ts — USER_SELECT에 clubId 추가, updateRole에 clubId 지원**

`apps/api/src/admin/admin.repo.ts`의 `USER_SELECT` 수정:

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
  player: { select: { id: true, playerName: true } },
} as const;
```

`updateRole` 메서드 교체:

```typescript
updateRole(
  id: number,
  role: Role,
  coachingRole: CoachingRole | null,
  frontOfficeRole: FrontOfficeRole | null,
  clubId?: number | null,
) {
  return this.prisma.user.update({
    where: { id },
    data: { role, coachingRole, frontOfficeRole, ...(clubId !== undefined && { clubId }) },
    select: USER_SELECT,
  });
}
```

- [ ] **Step 3: admin.service.ts — GM role 처리**

`apps/api/src/admin/admin.service.ts`의 `updateUserRole` 메서드 교체:

```typescript
async updateUserRole(id: number, dto: UpdateUserRoleDto, requesterId: number) {
  if (id === requesterId) throw new AppError(403, "CANNOT_MODIFY_SELF");

  const user = await this.repo.findById(id);
  if (!user) throw new AppError(404, "USER_NOT_FOUND");

  const coachingRole = dto.role === "COACHING_STAFF" ? (dto.coachingRole ?? null) : null;
  const frontOfficeRole = dto.role === "FRONT_OFFICE" ? (dto.frontOfficeRole ?? null) : null;

  return this.repo.updateRole(id, dto.role, coachingRole, frontOfficeRole, dto.clubId);
}
```

- [ ] **Step 4: TypeScript 빌드 오류 확인**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | grep -v "generated" | head -30
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/
git commit -m "feat: admin layer supports GM role and clubId assignment"
```

---

## Task 5: Team 레이어 — isLite 제거, GM 권한 추가, club relation 포함

**Files:**
- Modify: `apps/api/src/team/team.repo.ts`
- Modify: `apps/api/src/team/team.service.ts`
- Modify: `apps/api/src/team/team.controller.ts`
- Modify: `apps/api/src/team/team.routes.ts`

- [ ] **Step 1: team.repo.ts 전체 교체**

```typescript
import { PrismaClient } from "../generated/client";

export interface CreateTeamDto {
  name: string;
  type: "FIRST_TEAM" | "B_TEAM" | "YOUTH";
  ageGroup?: string;
  trackStats?: boolean;
  requiresContract?: boolean;
  clubId?: number;
}

export interface UpdateTeamDto {
  name?: string;
  ageGroup?: string;
  trackStats?: boolean;
  requiresContract?: boolean;
  isActive?: boolean;
  clubId?: number | null;
}

export class TeamRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.team.findMany({
      include: { club: { select: { id: true, name: true, isLite: true } } },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
  }

  findById(id: number) {
    return this.prisma.team.findUnique({
      where: { id },
      include: { club: { select: { id: true, name: true, isLite: true } } },
    });
  }

  create(dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        type: dto.type,
        ageGroup: dto.ageGroup ?? null,
        trackStats: dto.trackStats ?? true,
        requiresContract: dto.requiresContract ?? true,
        clubId: dto.clubId ?? null,
      },
      include: { club: { select: { id: true, name: true, isLite: true } } },
    });
  }

  update(id: number, dto: UpdateTeamDto) {
    return this.prisma.team.update({
      where: { id },
      data: dto,
      include: { club: { select: { id: true, name: true, isLite: true } } },
    });
  }
}
```

- [ ] **Step 2: team.service.ts 전체 교체 (setLiteMode 제거)**

```typescript
import { TeamRepository, CreateTeamDto, UpdateTeamDto } from "./team.repo";
import { AppError } from "../lib/appError";

export class TeamService {
  constructor(private repo: TeamRepository) {}

  getAll() {
    return this.repo.findAll();
  }

  async getById(id: number) {
    const team = await this.repo.findById(id);
    if (!team) throw new AppError(404, "TEAM_NOT_FOUND");
    return team;
  }

  create(dto: CreateTeamDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateTeamDto) {
    await this.getById(id);
    return this.repo.update(id, dto);
  }

  async deactivate(id: number) {
    await this.getById(id);
    return this.repo.update(id, { isActive: false });
  }
}
```

- [ ] **Step 3: team.controller.ts 전체 교체 (setLiteMode 제거, GM 권한 추가)**

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { TeamService } from "./team.service";

const canManage = (role: string) =>
  role === "ADMIN" || role === "SUPER_ADMIN" || role === "GM";

export class TeamController {
  constructor(private service: TeamService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canManage(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getAll());
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canManage(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canManage(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canManage(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!canManage(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.deactivate(Number(req.params["id"])));
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 4: team.routes.ts — /lite 라우트 제거**

```typescript
import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { TeamController } from "./team.controller";
import { TeamService } from "./team.service";
import { TeamRepository } from "./team.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new TeamRepository(getPrisma());
const service = new TeamService(repo);
const controller = new TeamController(service);

router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id/deactivate", auth, controller.deactivate);
router.patch("/:id", auth, controller.update);

export default router;
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/team/
git commit -m "feat: team layer uses club.isLite, GM can manage teams, remove setLiteMode"
```

---

## Task 6: Club API 모듈 신설

**Files:**
- Create: `apps/api/src/club/club.dto.ts`
- Create: `apps/api/src/club/club.repo.ts`
- Create: `apps/api/src/club/club.service.ts`
- Create: `apps/api/src/club/club.controller.ts`
- Create: `apps/api/src/club/club.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

권한 규칙:
- `GET /clubs` — SUPER_ADMIN: 전체, ADMIN/GM: 본인 clubId만
- `POST /clubs` — SUPER_ADMIN 전용
- `PATCH /clubs/:id` — SUPER_ADMIN, ADMIN (isActive, isLite, name 변경)

- [ ] **Step 1: club.dto.ts 생성**

```typescript
export interface CreateClubDto {
  name: string;
}

export interface UpdateClubDto {
  name?: string;
  isActive?: boolean;
  isLite?: boolean;
}
```

- [ ] **Step 2: club.repo.ts 생성**

```typescript
import { PrismaClient } from "../generated/client";
import { CreateClubDto, UpdateClubDto } from "./club.dto";

const CLUB_SELECT = {
  id: true,
  name: true,
  isActive: true,
  isLite: true,
  createdAt: true,
  teams: { select: { id: true, name: true, type: true, isActive: true } },
} as const;

export class ClubRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.club.findMany({ select: CLUB_SELECT, orderBy: { name: "asc" } });
  }

  findById(id: number) {
    return this.prisma.club.findUnique({ where: { id }, select: CLUB_SELECT });
  }

  findByIds(ids: number[]) {
    return this.prisma.club.findMany({ where: { id: { in: ids } }, select: CLUB_SELECT });
  }

  create(dto: CreateClubDto) {
    return this.prisma.club.create({ data: { name: dto.name }, select: CLUB_SELECT });
  }

  update(id: number, dto: UpdateClubDto) {
    return this.prisma.club.update({ where: { id }, data: dto, select: CLUB_SELECT });
  }
}
```

- [ ] **Step 3: club.service.ts 생성**

```typescript
import { ClubRepository } from "./club.repo";
import { AppError } from "../lib/appError";
import { CreateClubDto, UpdateClubDto } from "./club.dto";

export class ClubService {
  constructor(private repo: ClubRepository) {}

  async getAll(requesterRole: string, requesterClubId?: number | null) {
    if (requesterRole === "SUPER_ADMIN") return this.repo.findAll();
    if (requesterClubId) return this.repo.findByIds([requesterClubId]);
    return [];
  }

  async getById(id: number) {
    const club = await this.repo.findById(id);
    if (!club) throw new AppError(404, "CLUB_NOT_FOUND");
    return club;
  }

  create(dto: CreateClubDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateClubDto) {
    await this.getById(id);
    return this.repo.update(id, dto);
  }
}
```

- [ ] **Step 4: club.controller.ts 생성**

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { ClubService } from "./club.service";

export class ClubController {
  constructor(private service: ClubService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getAll(req.user!.role, req.user!.clubId));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "SUPER_ADMIN") throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role;
      if (role !== "SUPER_ADMIN" && role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 5: club.routes.ts 생성**

```typescript
import { auth } from "../lib/authMiddleware";
import { Router } from "express";
import { ClubController } from "./club.controller";
import { ClubService } from "./club.service";
import { ClubRepository } from "./club.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new ClubRepository(getPrisma());
const service = new ClubService(repo);
const controller = new ClubController(service);

router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id", auth, controller.update);

export default router;
```

- [ ] **Step 6: apiRouter.ts에 club 라우터 등록**

`apps/api/src/apiRouter.ts` 최상단 import에 추가:

```typescript
import clubRouter from "./club/club.routes";
```

`apiRouter.use("/teams", teamRouter);` 바로 위에 추가:

```typescript
apiRouter.use("/clubs", clubRouter);
```

- [ ] **Step 7: 빌드 오류 확인**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | grep -v "generated" | head -30
```

Expected: 오류 없음 또는 seed.ts 관련 오류만 (다음 Task)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/club/ apps/api/src/apiRouter.ts
git commit -m "feat: add Club CRUD API module"
```

---

## Task 7: Seed 업데이트

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: seed.ts에 Club 생성, GM 유저 추가, clubId 할당**

seed.ts의 `// ── Users ─────────────────────────────────────────────` 섹션 이전에 Club 생성 코드 삽입:

```typescript
// ── Club ──────────────────────────────────────────────
const fcSeoulClub = await prisma.club.upsert({
  where: { id: 1 },
  update: {},
  create: { name: "FC Seoul", isActive: true, isLite: false },
});
```

기존 `admin` upsert를 찾아서 `create` 블록에 `clubId: fcSeoulClub.id` 추가:

```typescript
const admin = await prisma.user.upsert({
  where: { email: "admin@club.com" },
  update: {},
  create: {
    email: "admin@club.com",
    password: hashed,
    username: "관리자",
    nickname: "admin",
    role: "ADMIN",
    dateOfBirth: new Date("1980-01-01"),
    nationalityId: korea.id,
    phoneNumberId: adminPhone.id,
    clubId: fcSeoulClub.id,
  },
});
```

`superAdminPhone` upsert 이후, 기존 `coach` upsert 이전에 GM 유저 추가:

```typescript
await prisma.user.upsert({
  where: { email: "gm@club.com" },
  update: {},
  create: {
    email: "gm@club.com",
    password: hashed,
    username: "단장",
    nickname: "gm",
    role: "GM",
    dateOfBirth: new Date("1970-01-01"),
    nationalityId: korea.id,
    phoneNumberId: gmPhone.id,
    clubId: fcSeoulClub.id,
  },
});
```

기존 seed의 GM frontOfficeRole 유저 (`role: "FRONT_OFFICE", frontOfficeRole: "GM"`)가 있으면 `frontOfficeRole: "TD"` 등으로 변경하거나 제거.

팀 생성 코드(firstTeam, bTeam, youthTeam 등)에 `clubId: fcSeoulClub.id` 추가:

```typescript
const firstTeam = await prisma.team.upsert({
  where: { id: 1 },
  update: {},
  create: { name: "1군", type: "FIRST_TEAM", clubId: fcSeoulClub.id },
});
```

- [ ] **Step 2: Seed 실행**

```bash
cd /Users/juno/work/football/apps/api
npx prisma db seed
```

Expected: 오류 없이 완료

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat: seed Club, GM user, assign clubId to teams and admin"
```

---

## Task 8: Frontend 타입 업데이트

**Files:**
- Modify: `football/src/types/auth.ts`
- Modify: `football/src/types/team.ts`

- [ ] **Step 1: types/auth.ts 전체 교체**

```typescript
export type Role = 'ADMIN' | 'SUPER_ADMIN' | 'GM' | 'FRONT_OFFICE' | 'COACHING_STAFF' | 'PLAYER' | 'AGENT' | 'GUARDIAN'

export type CoachingRole =
  | 'HEAD_COACH'
  | 'ASSISTANT_COACH'
  | 'DEFENSIVE_COACH'
  | 'ATTACKING_COACH'
  | 'PHYSICAL_COACH'
  | 'SET_PIECE_COACH'
  | 'GOALKEEPER_COACH'
  | 'MEDICAL'
  | 'MEDICAL_DIRECTOR'

export type FrontOfficeRole =
  | 'TD'
  | 'CONTRACT_MANAGER'
  | 'SCOUT'
  | 'EQUIPMENT_MANAGER'
  | 'TACTICAL_ANALYST'
  | 'FINANCE_MANAGER'
  | 'ASSET_MANAGER'
  | 'HR_MANAGER'
  | 'FACILITY_MANAGER'
  | 'HR_STAFF'
  | 'ASSET_STAFF'
  | 'FINANCE_STAFF'
  | 'FACILITY_STAFF'

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  GM: '단장 (GM)',
  FRONT_OFFICE: 'Front Office',
  COACHING_STAFF: 'Coaching Staff',
  PLAYER: 'Player',
  AGENT: 'Agent',
  GUARDIAN: 'Guardian',
}

export const COACHING_ROLE_LABEL: Record<CoachingRole, string> = {
  HEAD_COACH: 'Head Coach',
  ASSISTANT_COACH: 'Assistant Coach',
  DEFENSIVE_COACH: 'Defensive Coach',
  ATTACKING_COACH: 'Attacking Coach',
  PHYSICAL_COACH: 'Physical Coach',
  SET_PIECE_COACH: 'Set Piece Coach',
  GOALKEEPER_COACH: 'Goalkeeper Coach',
  MEDICAL: 'Medical',
  MEDICAL_DIRECTOR: 'Medical Director',
}

export const FRONT_OFFICE_ROLE_LABEL: Record<FrontOfficeRole, string> = {
  TD: 'Technical Director',
  CONTRACT_MANAGER: 'Contract Manager',
  SCOUT: 'Scout',
  EQUIPMENT_MANAGER: 'Equipment Manager',
  TACTICAL_ANALYST: 'Tactical Analyst',
  FINANCE_MANAGER: 'Finance Manager',
  ASSET_MANAGER: 'Asset Manager',
  HR_MANAGER: 'HR Manager',
  FACILITY_MANAGER: 'Facility Manager',
  HR_STAFF: 'HR Staff',
  ASSET_STAFF: 'Asset Staff',
  FINANCE_STAFF: 'Finance Staff',
  FACILITY_STAFF: 'Facility Staff',
}

export interface UserDto {
  id: number
  email: string
  username: string
  nickname: string
  role: Role
  coachingRole: CoachingRole | null
  frontOfficeRole: FrontOfficeRole | null
  teamId: number | null
  clubId: number | null
  isOutOfOffice: boolean
  language: 'ko' | 'en'
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
}
```

- [ ] **Step 2: types/team.ts 전체 교체**

```typescript
export type TeamType = 'FIRST_TEAM' | 'B_TEAM' | 'YOUTH'

export interface ClubSummary {
  id: number
  name: string
  isLite: boolean
}

export interface Team {
  id: number
  name: string
  type: TeamType
  ageGroup: string | null
  isActive: boolean
  trackStats: boolean
  requiresContract: boolean
  clubId: number | null
  club: ClubSummary | null
}

export interface Club {
  id: number
  name: string
  isActive: boolean
  isLite: boolean
  createdAt: string
  teams: Array<{ id: number; name: string; type: TeamType; isActive: boolean }>
}

export const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  FIRST_TEAM: 'First Team',
  B_TEAM: 'B Team',
  YOUTH: 'Youth',
}
```

- [ ] **Step 3: Commit**

```bash
git add football/src/types/
git commit -m "feat: frontend types add GM Role, Club, update Team with club relation"
```

---

## Task 9: Frontend — AppShell nav, useLiteMode, Club API 서비스

**Files:**
- Modify: `football/src/layouts/AppShell.tsx`
- Modify: `football/src/hooks/useLiteMode.ts`
- Create: `football/src/services/club.service.ts`
- Modify: `football/src/services/teamAdmin.service.ts`
- Modify: `football/src/pages/admin/TeamSettingsPage.tsx`

- [ ] **Step 1: club.service.ts 생성**

```typescript
import { api } from './api'
import type { Club } from '@/types/team'

export interface UpdateClubPayload {
  name?: string
  isActive?: boolean
  isLite?: boolean
}

export const clubApi = {
  list: () => api.get<Club[]>('/clubs'),
  getById: (id: number) => api.get<Club>(`/clubs/${id}`),
  create: (payload: { name: string }) => api.post<Club>('/clubs', payload),
  update: (id: number, payload: UpdateClubPayload) => api.patch<Club>(`/clubs/${id}`, payload),
}
```

- [ ] **Step 2: teamAdmin.service.ts 전체 교체 (setLite 제거)**

```typescript
// setLite는 club API로 이동됨 — clubApi.update(clubId, { isLite }) 사용
export {}
```

- [ ] **Step 3: AppShell.tsx — GM nav 필터링 업데이트**

`football/src/layouts/AppShell.tsx`에서 `visibleNavItems` 필터 블록을 찾아 GM 추가:

```typescript
const visibleNavItems = NAV_ITEMS.filter((item) => {
  if (item.liteBlocked && isLite) return false
  if (!item.roles) return true
  if (!user) return false
  if (user.role === 'SUPER_ADMIN' || user.role === 'GM') return true  // GM도 전체 메뉴 접근
  if (!item.roles.includes(user.role)) return false
  if (item.coachingRoles && user.role === 'COACHING_STAFF') {
    return user.coachingRole !== null && item.coachingRoles.includes(user.coachingRole)
  }
  if (item.frontOfficeRoles && user.role === 'FRONT_OFFICE') {
    return user.frontOfficeRole !== null && item.frontOfficeRoles.includes(user.frontOfficeRole)
  }
  return true
})
```

- [ ] **Step 4: useLiteMode.ts — club.isLite 읽도록 수정**

```typescript
import { useState, useEffect } from 'react'
import { useCurrentUser } from './useCurrentUser'
import { teamApi } from '@/services/team.service'

export function useLiteMode(): boolean {
  const { user } = useCurrentUser()
  const [isLite, setIsLite] = useState(false)

  useEffect(() => {
    if (!user) return
    teamApi.list()
      .then(teams => {
        const userTeam = teams.find(t => t.id === user.teamId)
        setIsLite(userTeam?.club?.isLite ?? false)
      })
      .catch(() => null)
  }, [user])

  return isLite
}
```

- [ ] **Step 5: TeamSettingsPage.tsx — Club 레벨 isLite 토글로 교체**

```typescript
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { clubApi } from '@/services/club.service'
import { Button } from '@/components/ui/button'
import type { Club } from '@/types/team'

export default function TeamSettingsPage() {
  const { t } = useTranslation('admin')
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { navigate('/dashboard'); return }
    clubApi.list().then(setClubs).finally(() => setLoading(false))
  }, [user])

  const toggleLite = async (club: Club) => {
    const updated = await clubApi.update(club.id, { isLite: !club.isLite })
    setClubs(prev => prev.map(c => c.id === club.id ? updated : c))
  }

  if (loading) return <p className="p-6 text-muted-foreground">{t('teamSettingsPage.loading')}</p>

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{t('teamSettingsPage.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('teamSettingsPage.description')}</p>
      <div className="space-y-3">
        {clubs.map(club => (
          <div key={club.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{club.name}</p>
                <p className="text-xs text-muted-foreground">
                  {club.isLite ? t('teamSettingsPage.liteActive') : t('teamSettingsPage.liteInactive')}
                </p>
              </div>
              <Button
                size="sm"
                variant={club.isLite ? 'default' : 'outline'}
                onClick={() => toggleLite(club)}
              >
                {club.isLite ? t('teamSettingsPage.disableLite') : t('teamSettingsPage.enableLite')}
              </Button>
            </div>
            {club.teams.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {club.teams.map(team => (
                  <span key={team.id} className="text-xs bg-muted px-2 py-1 rounded">
                    {team.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {clubs.length === 0 && <p className="text-muted-foreground">{t('teamSettingsPage.noTeams')}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Frontend TypeScript 빌드 오류 확인**

```bash
cd /Users/juno/work/football/football
npx tsc --noEmit 2>&1 | head -50
```

Expected: `team.isLite` 직접 참조 오류가 있으면 `team.club?.isLite` 로 수정

- [ ] **Step 7: Commit**

```bash
git add football/src/
git commit -m "feat: frontend GM nav, club-level isLite, club API service"
```

---

## Task 10: 전체 빌드 최종 확인

- [ ] **Step 1: Backend 빌드**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | grep -v "generated"
```

Expected: 오류 없음

- [ ] **Step 2: Frontend 빌드**

```bash
cd /Users/juno/work/football/football
npx tsc --noEmit 2>&1
```

Expected: 오류 없음

- [ ] **Step 3: `team.isLite` 직접 참조 잔재 검색**

```bash
grep -rn "\.isLite" /Users/juno/work/football/football/src --include="*.ts" --include="*.tsx"
```

잔재가 있으면 `team.club?.isLite ?? false`로 교체

- [ ] **Step 4: FrontOfficeRole.GM 잔재 검색**

```bash
grep -rn '"GM"\|'\''GM'\''' /Users/juno/work/football/apps/api/src --include="*.ts" | grep -v "generated"
grep -rn '"GM"\|'\''GM'\''' /Users/juno/work/football/football/src --include="*.ts" --include="*.tsx"
```

잔재가 있으면 수정

- [ ] **Step 5: Final Commit**

```bash
git add -A
git commit -m "feat: complete Club/GM hierarchy - final cleanup"
```
