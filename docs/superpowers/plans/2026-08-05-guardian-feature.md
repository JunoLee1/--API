# Guardian(유소년 학부모) Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** GUARDIAN 역할 유저가 자녀(Player)를 연동하고, 자녀 정보 풀패키지 대시보드를 조회하며, 부상·콜업 시 인앱+이메일 알림을 받는 기능 구현.

**Architecture:** `src/guardian/` 전용 모듈에 모든 guardian API를 집중. `requireGuardian` 미들웨어로 role 체크, `requireGuardianChild` 미들웨어로 자녀 소유권 체크를 공통화. 기존 injury/callup service에 guardian 알림 trigger만 추가.

**Tech Stack:** Express, Prisma (PostgreSQL), Jest (unit test), nodemailer (email)

**Spec:** `docs/superpowers/specs/2026-08-05-guardian-feature-design.md`

---

## File Map

| 파일 | 역할 |
|---|---|
| `src/guardian/guardian.middleware.ts` | requireGuardian, requireGuardianChild |
| `src/guardian/guardian.repo.ts` | DB 쿼리 (자녀 조회, 연동, 코드 발급, 대시보드 집계) |
| `src/guardian/guardian.service.ts` | 비즈니스 로직 |
| `src/guardian/guardian.controller.ts` | 요청/응답 |
| `src/guardian/guardian.routes.ts` | 라우트 등록 |
| `src/guardian/dto/guardian.dto.ts` | DTO 타입 |
| `src/guardian/guardian.service.test.ts` | 서비스 유닛 테스트 |
| `src/lib/email.ts` | sendGuardianInjuryEmail, sendGuardianCallupEmail 추가 |
| `src/injury/injury.repo.ts` | getPlayerWithGuardian 메서드 추가 |
| `src/injury/injury.service.ts` | createInjury에 guardian 알림 추가 |
| `src/player-callup/player-callup.service.ts` | approve에 guardian 알림 추가 |
| `src/server.ts` | guardian 라우터 등록 |

---

## Task 1: DTO 및 미들웨어

**Files:**
- Create: `src/guardian/dto/guardian.dto.ts`
- Create: `src/guardian/guardian.middleware.ts`

- [x] **Step 1: DTO 파일 생성**

```ts
// src/guardian/dto/guardian.dto.ts
export interface LinkBySearchDto {
  studentCode: string;
  playerName: string;
  dateOfBirth: string; // ISO string
}

export interface LinkByCodeDto {
  code: string;
}

export interface IssueInviteCodeDto {
  playerId: string;
}
```

- [x] **Step 2: 미들웨어 파일 생성**

```ts
// src/guardian/guardian.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { getPrisma } from "../lib/prisma";

export function requireGuardian(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "GUARDIAN") {
    return res.status(403).json({ code: "FORBIDDEN" });
  }
  next();
}

export async function requireGuardianChild(req: Request, res: Response, next: NextFunction) {
  try {
    const guardianId = req.user?.id;
    if (!guardianId) return res.status(401).json({ code: "UNAUTHORIZED" });

    const player = await getPrisma().player.findFirst({
      where: { guardianId },
      select: { id: true },
    });

    if (!player) return res.status(403).json({ code: "FORBIDDEN" });

    (req as any).childPlayerId = player.id;
    next();
  } catch {
    res.status(500).json({ code: "INTERNAL_ERROR" });
  }
}
```

- [x] **Step 3: 커밋**

```bash
git add src/guardian/dto/guardian.dto.ts src/guardian/guardian.middleware.ts
git commit -m "feat(guardian): DTO 및 미들웨어 추가"
```

---

## Task 2: Guardian Repository

**Files:**
- Create: `src/guardian/guardian.repo.ts`

- [x] **Step 1: repo 파일 생성**

```ts
// src/guardian/guardian.repo.ts
import type { PrismaClient } from "../generated/client";

export class GuardianRepository {
  constructor(private prisma: PrismaClient) {}

  findPlayerBySearch(studentCode: string, playerName: string, dateOfBirth: Date) {
    return this.prisma.player.findFirst({
      where: { studentCode, playerName, dateOfBirth },
      select: { id: true, guardianId: true, playerName: true },
    });
  }

  findInviteCode(code: string) {
    return this.prisma.guardianInviteCode.findUnique({
      where: { code },
      select: { id: true, playerId: true, usedAt: true, expiresAt: true },
    });
  }

  findActiveInviteCode(playerId: string) {
    return this.prisma.guardianInviteCode.findFirst({
      where: { playerId, usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  createInviteCode(data: { code: string; playerId: string; issuedById: number; expiresAt: Date }) {
    return this.prisma.guardianInviteCode.create({ data });
  }

  linkGuardianToPlayer(playerId: string, guardianId: number) {
    return this.prisma.player.update({
      where: { id: playerId },
      data: { guardianId },
    });
  }

  markCodeUsed(id: number, usedById: number) {
    return this.prisma.guardianInviteCode.update({
      where: { id },
      data: { usedById, usedAt: new Date() },
    });
  }

  findChildByGuardian(guardianId: number) {
    return this.prisma.player.findFirst({
      where: { guardianId },
      select: {
        id: true,
        playerName: true,
        position: true,
        level: true,
        teamId: true,
        team: { select: { name: true } },
      },
    });
  }

  findDashboard(playerId: string, teamId: number | null, now: Date) {
    const weekLater = new Date(now);
    weekLater.setDate(weekLater.getDate() + 7);

    return Promise.all([
      // 자녀 기본 정보
      this.prisma.player.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          playerName: true,
          position: true,
          level: true,
          team: { select: { name: true } },
        },
      }),
      // 다음 7일 경기 (자녀 소속 팀)
      teamId
        ? this.prisma.match.findMany({
            where: { teamId, date: { gte: now, lt: weekLater } },
            select: { id: true, date: true, homeTeamName: true, awayTeamName: true },
            take: 5,
          })
        : Promise.resolve([]),
      // 다음 7일 훈련
      this.prisma.trainingSession.findMany({
        where: {
          participants: { some: { playerId } },
          date: { gte: now, lt: weekLater },
        },
        select: { id: true, date: true, sessionType: true },
        take: 5,
      }),
      // 출결 현황
      this.prisma.trainingParticipant.groupBy({
        by: ["status"],
        where: { playerId },
        _count: { status: true },
      }),
      // 최신 성장평가
      this.prisma.growthEvaluation.findFirst({
        where: { playerId, isPublished: true },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      }),
      // 활성 발달계획
      this.prisma.playerDevelopmentPlan.findFirst({
        where: { playerId, status: "ACTIVE" },
      }),
      // 부상
      this.prisma.injury.findMany({
        where: { playerId },
        orderBy: { occurredAt: "desc" },
        select: { id: true, bodyPart: true, type: true, status: true, occurredAt: true, recoveredAt: true },
      }),
      // 최근 경기 스탯
      this.prisma.playerMatchStats.findFirst({
        where: { playerId },
        orderBy: { match: { date: "desc" } },
      }),
      // 납부 현황
      this.prisma.academyFee.findMany({
        where: { playerId, status: { in: ["PENDING", "OVERDUE"] } },
        orderBy: { dueDate: "asc" },
      }),
    ]);
  }
}
```

- [x] **Step 2: 커밋**

```bash
git add src/guardian/guardian.repo.ts
git commit -m "feat(guardian): GuardianRepository 추가"
```

---

## Task 3: Guardian Service — 자녀 연동 로직 + 테스트

**Files:**
- Create: `src/guardian/guardian.service.ts`
- Create: `src/guardian/guardian.service.test.ts`

- [x] **Step 1: 실패 테스트 작성**

```ts
// src/guardian/guardian.service.test.ts
import { GuardianService } from "./guardian.service";
import type { GuardianRepository } from "./guardian.repo";

const makeRepo = (overrides: Partial<GuardianRepository> = {}): GuardianRepository =>
  ({
    findPlayerBySearch: jest.fn().mockResolvedValue(null),
    findInviteCode: jest.fn().mockResolvedValue(null),
    findActiveInviteCode: jest.fn().mockResolvedValue(null),
    createInviteCode: jest.fn(),
    linkGuardianToPlayer: jest.fn().mockResolvedValue({}),
    markCodeUsed: jest.fn().mockResolvedValue({}),
    findChildByGuardian: jest.fn().mockResolvedValue(null),
    findDashboard: jest.fn().mockResolvedValue([null, [], [], [], null, null, [], null, []]),
    ...overrides,
  } as unknown as GuardianRepository);

const fakePlayer = { id: "player-1", guardianId: null, playerName: "김유소" };

describe("GuardianService.linkBySearch", () => {
  it("존재하지 않는 자녀 → 404", async () => {
    const svc = new GuardianService(makeRepo());
    await expect(
      svc.linkBySearch({ studentCode: "SC001", playerName: "김유소", dateOfBirth: "2015-01-01" }, 1)
    ).rejects.toMatchObject({ statusCode: 404, message: "PLAYER_NOT_FOUND" });
  });

  it("이미 다른 guardian에 연동된 자녀 → 409", async () => {
    const svc = new GuardianService(
      makeRepo({ findPlayerBySearch: jest.fn().mockResolvedValue({ ...fakePlayer, guardianId: 99 }) })
    );
    await expect(
      svc.linkBySearch({ studentCode: "SC001", playerName: "김유소", dateOfBirth: "2015-01-01" }, 1)
    ).rejects.toMatchObject({ statusCode: 409, message: "ALREADY_LINKED" });
  });

  it("성공 → linkGuardianToPlayer 호출", async () => {
    const repo = makeRepo({ findPlayerBySearch: jest.fn().mockResolvedValue(fakePlayer) });
    const svc = new GuardianService(repo);
    await svc.linkBySearch({ studentCode: "SC001", playerName: "김유소", dateOfBirth: "2015-01-01" }, 1);
    expect(repo.linkGuardianToPlayer).toHaveBeenCalledWith("player-1", 1);
  });
});

describe("GuardianService.linkByCode", () => {
  it("존재하지 않는 코드 → 404", async () => {
    const svc = new GuardianService(makeRepo());
    await expect(svc.linkByCode({ code: "ABCD1234" }, 1)).rejects.toMatchObject({ statusCode: 404, message: "INVALID_CODE" });
  });

  it("이미 사용된 코드 → 409", async () => {
    const repo = makeRepo({
      findInviteCode: jest.fn().mockResolvedValue({
        id: 1, playerId: "player-1", usedAt: new Date(), expiresAt: new Date(Date.now() + 1000),
      }),
    });
    const svc = new GuardianService(repo);
    await expect(svc.linkByCode({ code: "ABCD1234" }, 1)).rejects.toMatchObject({ statusCode: 409, message: "CODE_ALREADY_USED" });
  });

  it("만료된 코드 → 410", async () => {
    const repo = makeRepo({
      findInviteCode: jest.fn().mockResolvedValue({
        id: 1, playerId: "player-1", usedAt: null, expiresAt: new Date(Date.now() - 1000),
      }),
    });
    const svc = new GuardianService(repo);
    await expect(svc.linkByCode({ code: "ABCD1234" }, 1)).rejects.toMatchObject({ statusCode: 410, message: "CODE_EXPIRED" });
  });

  it("성공 → linkGuardianToPlayer + markCodeUsed 호출", async () => {
    const repo = makeRepo({
      findInviteCode: jest.fn().mockResolvedValue({
        id: 1, playerId: "player-1", usedAt: null, expiresAt: new Date(Date.now() + 100000),
      }),
    });
    const svc = new GuardianService(repo);
    await svc.linkByCode({ code: "ABCD1234" }, 1);
    expect(repo.linkGuardianToPlayer).toHaveBeenCalledWith("player-1", 1);
    expect(repo.markCodeUsed).toHaveBeenCalledWith(1, 1);
  });
});

describe("GuardianService.issueInviteCode", () => {
  it("미사용·미만료 코드가 있으면 기존 코드 반환", async () => {
    const existing = { id: 1, code: "EXIST123", playerId: "player-1", usedAt: null, expiresAt: new Date(Date.now() + 1000), issuedById: 2 };
    const repo = makeRepo({ findActiveInviteCode: jest.fn().mockResolvedValue(existing) });
    const svc = new GuardianService(repo);
    const result = await svc.issueInviteCode({ playerId: "player-1" }, 2);
    expect(result).toBe(existing);
    expect(repo.createInviteCode).not.toHaveBeenCalled();
  });

  it("없으면 새 코드 생성", async () => {
    const repo = makeRepo({ createInviteCode: jest.fn().mockResolvedValue({ code: "NEW12345" }) });
    const svc = new GuardianService(repo);
    await svc.issueInviteCode({ playerId: "player-1" }, 2);
    expect(repo.createInviteCode).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football/apps/api && npx jest guardian.service.test.ts --no-coverage 2>&1 | tail -10
```
Expected: `Cannot find module './guardian.service'`

- [x] **Step 3: GuardianService 구현**

```ts
// src/guardian/guardian.service.ts
import crypto from "crypto";
import { AppError } from "../lib/appError";
import type { GuardianRepository } from "./guardian.repo";
import type { LinkBySearchDto, LinkByCodeDto, IssueInviteCodeDto } from "./dto/guardian.dto";

export class GuardianService {
  constructor(private repo: GuardianRepository) {}

  async linkBySearch(dto: LinkBySearchDto, guardianId: number) {
    const player = await this.repo.findPlayerBySearch(
      dto.studentCode,
      dto.playerName,
      new Date(dto.dateOfBirth),
    );
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    if (player.guardianId !== null) throw new AppError(409, "ALREADY_LINKED");
    return this.repo.linkGuardianToPlayer(player.id, guardianId);
  }

  async linkByCode(dto: LinkByCodeDto, guardianId: number) {
    const record = await this.repo.findInviteCode(dto.code);
    if (!record) throw new AppError(404, "INVALID_CODE");
    if (record.usedAt !== null) throw new AppError(409, "CODE_ALREADY_USED");
    if (record.expiresAt < new Date()) throw new AppError(410, "CODE_EXPIRED");

    await Promise.all([
      this.repo.linkGuardianToPlayer(record.playerId, guardianId),
      this.repo.markCodeUsed(record.id, guardianId),
    ]);
  }

  async issueInviteCode(dto: IssueInviteCodeDto, issuedById: number) {
    const existing = await this.repo.findActiveInviteCode(dto.playerId);
    if (existing) return existing;

    const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8자리 영숫자
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    return this.repo.createInviteCode({ code, playerId: dto.playerId, issuedById, expiresAt });
  }

  async getChild(guardianId: number) {
    const child = await this.repo.findChildByGuardian(guardianId);
    if (!child) throw new AppError(404, "CHILD_NOT_FOUND");
    return child;
  }

  async getDashboard(guardianId: number) {
    const child = await this.repo.findChildByGuardian(guardianId);
    if (!child) throw new AppError(404, "CHILD_NOT_FOUND");

    const [
      childInfo, matches, sessions, attendanceGroups,
      latestEval, activePlan, injuries, lastMatchStats, fees,
    ] = await this.repo.findDashboard(child.id, (child as any).teamId ?? null, new Date());

    const attendanceMap = Object.fromEntries(
      attendanceGroups.map((g: any) => [g.status, g._count.status])
    );

    const activeInjuries = injuries.filter((i: any) =>
      !["RECOVERED", "RETURNED"].includes(i.status)
    );
    const historyInjuries = injuries.filter((i: any) =>
      ["RECOVERED", "RETURNED"].includes(i.status)
    );

    return {
      child: childInfo,
      upcoming: { matches, sessions },
      attendance: {
        total: (attendanceGroups as any[]).reduce((s: number, g: any) => s + g._count.status, 0),
        attended: attendanceMap["ATTENDED"] ?? 0,
        absent: attendanceMap["ABSENT"] ?? 0,
        late: attendanceMap["LATE"] ?? 0,
      },
      growth: { latestEvaluation: latestEval ?? null, activeDevelopmentPlan: activePlan ?? null },
      injuries: { active: activeInjuries, history: historyInjuries },
      stats: { lastMatch: lastMatchStats ?? null },
      fees: {
        pending: fees.filter((f: any) => f.status === "PENDING"),
        overdue: fees.filter((f: any) => f.status === "OVERDUE"),
      },
    };
  }
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx jest guardian.service.test.ts --no-coverage 2>&1 | tail -10
```
Expected: `Tests: 7 passed`

- [x] **Step 5: 커밋**

```bash
git add src/guardian/guardian.service.ts src/guardian/guardian.service.test.ts
git commit -m "feat(guardian): GuardianService 자녀 연동 + 대시보드 로직 추가"
```

---

## Task 4: Guardian Controller + Routes + server 등록

**Files:**
- Create: `src/guardian/guardian.controller.ts`
- Create: `src/guardian/guardian.routes.ts`
- Modify: `src/server.ts`

- [x] **Step 1: Controller 생성**

```ts
// src/guardian/guardian.controller.ts
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import type { GuardianService } from "./guardian.service";
import type { LinkBySearchDto, LinkByCodeDto, IssueInviteCodeDto } from "./dto/guardian.dto";

export class GuardianController {
  constructor(private service: GuardianService) {}

  linkBySearch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentCode, playerName, dateOfBirth } = req.body as LinkBySearchDto;
      if (!studentCode || !playerName || !dateOfBirth) throw new AppError(400, "MISSING_FIELDS");
      const result = await this.service.linkBySearch({ studentCode, playerName, dateOfBirth }, req.user!.id);
      res.status(200).json(result);
    } catch (e) { next(e); }
  };

  linkByCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = req.body as LinkByCodeDto;
      if (!code) throw new AppError(400, "MISSING_FIELDS");
      await this.service.linkByCode({ code }, req.user!.id);
      res.status(200).json({ ok: true });
    } catch (e) { next(e); }
  };

  issueInviteCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { playerId } = req.body as IssueInviteCodeDto;
      if (!playerId) throw new AppError(400, "MISSING_FIELDS");
      const role = req.user!.role;
      if (!["ADMIN", "SUPER_ADMIN", "GM", "FRONT_OFFICE"].includes(role)) throw new AppError(403, "FORBIDDEN");
      const result = await this.service.issueInviteCode({ playerId }, req.user!.id);
      res.status(200).json(result);
    } catch (e) { next(e); }
  };

  getChild = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getChild(req.user!.id);
      res.json(result);
    } catch (e) { next(e); }
  };

  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getDashboard(req.user!.id);
      res.json(result);
    } catch (e) { next(e); }
  };
}
```

- [x] **Step 2: Routes 생성**

```ts
// src/guardian/guardian.routes.ts
import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { requireGuardian } from "./guardian.middleware";
import { GuardianController } from "./guardian.controller";
import { GuardianService } from "./guardian.service";
import { GuardianRepository } from "./guardian.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new GuardianRepository(getPrisma());
const service = new GuardianService(repo);
const controller = new GuardianController(service);

// 초대 코드 발급 — auth만 (ADMIN/FRONT_OFFICE/GM, controller에서 체크)
router.post("/invite-code", auth, controller.issueInviteCode);

// 자녀 연동 — auth + requireGuardian (자녀 없어도 연동 가능)
router.post("/link/search", auth, requireGuardian, controller.linkBySearch);
router.post("/link/code", auth, requireGuardian, controller.linkByCode);

// 자녀 정보 조회 — auth + requireGuardian
router.get("/me/child", auth, requireGuardian, controller.getChild);
router.get("/me/dashboard", auth, requireGuardian, controller.getDashboard);

export default router;
```

- [x] **Step 3: server.ts에 라우터 등록**

`src/server.ts`에서 다른 라우터가 등록된 곳을 찾아 아래 패턴으로 추가:
```ts
import guardianRouter from "./guardian/guardian.routes";
// ...
app.use("/api/guardian", guardianRouter);
```

- [x] **Step 4: 서버 재시작 후 smoke test**

```bash
# 비로그인 → 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/guardian/me/child
# Expected: 401

# GUARDIAN 아닌 토큰으로 → 403
# (로그인 후 access-token 쿠키 사용)
```

- [x] **Step 5: 커밋**

```bash
git add src/guardian/guardian.controller.ts src/guardian/guardian.routes.ts src/server.ts
git commit -m "feat(guardian): controller, routes, server 등록"
```

---

## Task 5: 이메일 템플릿 추가

**Files:**
- Modify: `src/lib/email.ts`

- [x] **Step 1: email.ts에 guardian 이메일 함수 추가**

기존 `sendInviteEmail` 아래에 추가:

```ts
export async function sendGuardianInjuryEmail(
  to: string,
  playerName: string,
  description: string,
) {
  await transporter.sendMail({
    from: process.env["SMTP_FROM"] ?? "Football ERP <no-reply@example.com>",
    to,
    subject: `[Football ERP] ${playerName} 선수 부상 발생 알림`,
    html: `
      <p><strong>${playerName}</strong> 선수에게 부상이 발생했습니다.</p>
      <p>부상 내용: ${description}</p>
      <p>자세한 내용은 앱에서 확인해주세요.</p>
    `,
  });
}

export async function sendGuardianCallupEmail(
  to: string,
  playerName: string,
  requiredDocuments: string[],
) {
  const docList = requiredDocuments.length > 0
    ? `<ul>${requiredDocuments.map(d => `<li>${d}</li>`).join("")}</ul>`
    : "<p>담당자에게 문의해주세요.</p>";

  await transporter.sendMail({
    from: process.env["SMTP_FROM"] ?? "Football ERP <no-reply@example.com>",
    to,
    subject: `[Football ERP] ${playerName} 선수 1군 콜업 알림`,
    html: `
      <p><strong>${playerName}</strong> 선수의 1군 콜업이 승인됐습니다.</p>
      <p>필요 서류 목록:</p>
      ${docList}
    `,
  });
}
```

- [x] **Step 2: 커밋**

```bash
git add src/lib/email.ts
git commit -m "feat(guardian): 부상/콜업 학부모 이메일 템플릿 추가"
```

---

## Task 6: Injury Service — Guardian 알림 추가

**Files:**
- Modify: `src/injury/injury.repo.ts`
- Modify: `src/injury/injury.service.ts`

- [x] **Step 1: injury.repo.ts의 getPlayerName 쿼리에 guardianId + email 추가**

기존 `getPlayerName` 메서드를 찾아 수정:

```ts
// 기존
getPlayerName(playerId: string) {
  return this.prisma.player.findUnique({
    where: { id: playerId },
    select: { playerName: true, position: true },
  });
}

// 변경 후
getPlayerWithGuardian(playerId: string) {
  return this.prisma.player.findUnique({
    where: { id: playerId },
    select: {
      playerName: true,
      position: true,
      guardianId: true,
      guardian: { select: { email: true } },
    },
  });
}
```

- [x] **Step 2: injury.service.ts의 createInjury에서 getPlayerName → getPlayerWithGuardian 교체 후 guardian 알림 추가**

`createInjury` 내 try 블록 안에서 기존 알림 아래에 추가:

```ts
// 기존 코드 (수정)
const player = await this.repo.getPlayerWithGuardian(dto.playerId);
const playerName = player?.playerName ?? "선수";
const title = "부상 발생";
const body = `${playerName} 선수에게 부상이 발생했습니다. 부상 기록을 확인하세요.`;
await this.notifRepo.createForCoachingStaff("INJURY_OCCURRED", () => ({ title, body }), result.id);
getIO().to("staff-room").emit("notification:injury", {
  type: "INJURY_OCCURRED", title, body, createdAt: new Date().toISOString(),
});
await this.checkAndNotifySquadDepth(result.id);

// 추가
if (player?.guardianId) {
  void this.notifRepo
    .createForGuardian(
      player.guardianId,
      "GUARDIAN_CHILD_INJURY",
      () => ({ title: "자녀 부상 알림", body: `${playerName} 선수에게 부상이 발생했습니다.` }),
      result.id,
    )
    .catch(console.error);

  if (player.guardian?.email) {
    const { sendGuardianInjuryEmail } = await import("../lib/email");
    void sendGuardianInjuryEmail(
      player.guardian.email,
      playerName,
      dto.description ?? "부상이 발생했습니다.",
    ).catch(console.error);
  }
}
```

- [x] **Step 3: 기존 `getPlayerName` 호출부가 있으면 `getPlayerWithGuardian`으로 교체**

```bash
grep -n "getPlayerName" /Users/juno/work/football/apps/api/src/injury/injury.service.ts
```

- [x] **Step 4: 커밋**

```bash
git add src/injury/injury.repo.ts src/injury/injury.service.ts
git commit -m "feat(guardian): 부상 발생 시 학부모 인앱+이메일 알림 추가"
```

---

## Task 7: PlayerCallup Service — APPROVED 시 Guardian 알림 추가

**Files:**
- Modify: `src/player-callup/player-callup.service.ts`

- [x] **Step 1: approve 메서드에서 OFFICIAL 콜업 승인 시 guardian 알림 추가**

`approve` 메서드 안에서 `await this.repo.approve(id, approvedById)` 이후, `return updated` 전에 추가:

```ts
// OFFICIAL 승인 완료 후
const guardianId = callup.player.guardianId;
if (guardianId) {
  void this.notifRepo
    .createForGuardian(
      guardianId,
      "GUARDIAN_CHILD_CALLUP",
      () => ({
        title: "1군 콜업 승인",
        body: `${callup.player.playerName} 선수의 1군 콜업이 승인됐습니다. 필요 서류를 확인해주세요.`,
      }),
      id,
    )
    .catch(console.error);

  // guardian email 조회
  const guardianUser = await this.repo.findGuardianEmail(guardianId).catch(() => null);
  if (guardianUser?.email) {
    const { sendGuardianCallupEmail } = await import("../lib/email");
    void sendGuardianCallupEmail(
      guardianUser.email,
      callup.player.playerName,
      updated.requiredDocuments,
    ).catch(console.error);
  }
}
```

- [x] **Step 2: player-callup.repo.ts에 findGuardianEmail 추가**

```ts
findGuardianEmail(guardianId: number) {
  return this.prisma.user.findUnique({
    where: { id: guardianId },
    select: { email: true },
  });
}
```

- [x] **Step 3: 커밋**

```bash
git add src/player-callup/player-callup.service.ts src/player-callup/player-callup.repo.ts
git commit -m "feat(guardian): 1군 콜업 승인 시 학부모 인앱+이메일 알림 추가"
```

---

## Task 8: 전체 검증

- [x] **Step 1: TypeScript 타입 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1
```
Expected: 에러 없음

- [x] **Step 2: 전체 테스트 실행**

```bash
npx jest --no-coverage 2>&1 | tail -15
```
Expected: 기존 테스트 모두 통과 + guardian 7개 통과

- [x] **Step 3: 서버 재시작 후 E2E smoke test**

```bash
# 1. 비로그인 → 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/guardian/me/dashboard

# 2. 초대 코드 발급 (ADMIN 토큰 필요)
curl -s -X POST http://localhost:3001/api/guardian/invite-code \
  -H "Content-Type: application/json" \
  -b "access-token=<ADMIN_TOKEN>" \
  -d '{"playerId":"<PLAYER_ID>"}' | jq .

# 3. 초대 코드로 자녀 연동 (GUARDIAN 토큰 필요)
curl -s -X POST http://localhost:3001/api/guardian/link/code \
  -H "Content-Type: application/json" \
  -b "access-token=<GUARDIAN_TOKEN>" \
  -d '{"code":"<CODE>"}' | jq .

# 4. 대시보드 조회
curl -s http://localhost:3001/api/guardian/me/dashboard \
  -b "access-token=<GUARDIAN_TOKEN>" | jq .
```

- [x] **Step 4: 최종 커밋 + PR 생성**

```bash
git push origin feat/guardian-feature
```
