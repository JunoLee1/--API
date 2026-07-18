# Role-Based Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DashboardPage를 역할별 위젯 레지스트리로 구현 — 숫자 카드·액션 요청·최근 활동·일정 4종 위젯을 각 role/sub-role 에 맞게 조합한다.

**Architecture:** 단일 `DashboardPage` + 위젯 레지스트리 config. 숫자 카드 데이터는 `GET /api/dashboard/stats` (역할별 다른 응답 구조), 액션 요청은 `/api/notifications/my`, 최근 활동·일정은 도메인 API. BE에 `dashboard` 모듈을 새로 추가하고 FE에 4개 범용 위젯 컴포넌트 + 역할별 config를 작성한다.

**Tech Stack:** Express + Prisma (BE), React + TypeScript (FE), shadcn/ui Card 컴포넌트

---

## 파일 구조

### BE (신규)
- `apps/api/src/dashboard/dashboard.repo.ts` — 역할별 Prisma count 쿼리
- `apps/api/src/dashboard/dashboard.service.ts` — role/subRole 분기 후 repo 호출
- `apps/api/src/dashboard/dashboard.controller.ts` — `GET /stats` 핸들러
- `apps/api/src/dashboard/dashboard.routes.ts` — 라우트 등록
- `apps/api/__test__/dashboard/dashboard.service.test.ts` — 서비스 단위 테스트

### BE (수정)
- `apps/api/src/apiRouter.ts` — dashboardRouter 등록

### FE (신규)
- `football/src/types/dashboard.ts` — `DashboardStats` union 타입
- `football/src/services/dashboard.service.ts` — `GET /dashboard/stats` API 클라이언트
- `football/src/components/dashboard/StatCard.tsx` — 숫자 카드 위젯
- `football/src/components/dashboard/ActionQueueCard.tsx` — 액션 요청 위젯
- `football/src/components/dashboard/RecentFeedCard.tsx` — 최근 활동 위젯
- `football/src/components/dashboard/ScheduleCard.tsx` — 일정 위젯
- `football/src/pages/dashboard/dashboardConfig.ts` — 역할별 위젯 레지스트리

### FE (수정)
- `football/src/pages/dashboard/DashboardPage.tsx` — 위젯 레지스트리 기반으로 교체

---

## Task 1: BE — DashboardRepository

**Files:**
- Create: `apps/api/src/dashboard/dashboard.repo.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// apps/api/src/dashboard/dashboard.repo.ts
import { PrismaClient } from "../generated/client";

const NOW = () => new Date();
const IN_30_DAYS = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const START_OF_MONTH = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

// 포지션 그룹 (전문 코치 필터용)
const DEFENSIVE_POSITIONS = [
  "CENTER_BACK",
  "LEFT_WING_BACK",
  "RIGHT_WING_BACK",
  "LEFT_FULL_BACK",
  "RIGHT_FULL_BACK",
] as const;

const ATTACKING_POSITIONS = [
  "STRIKER",
  "SHADOW_STRIKER",
  "WINGER",
  "CENTRAL_ATTACK_MIDFIELDER",
  "RIGHT_ATTACK_MIDFIELDER",
  "LEFT_ATTACK_MIDFIELDER",
] as const;

export class DashboardRepository {
  constructor(private prisma: PrismaClient) {}

  // ── ADMIN ──────────────────────────────────────────────
  async getAdminStats() {
    const [activePlayerCount, expiringContractCount, injuredPlayerCount, lowStockEquipmentCount] =
      await Promise.all([
        this.prisma.player.count({ where: { status: "ACTIVE" } }),
        this.prisma.contract.count({
          where: { status: "ACTIVE", endDate: { lte: IN_30_DAYS(), gte: NOW() } },
        }),
        this.prisma.injury.count({
          where: { status: { notIn: ["RETURNED"] } },
        }),
        this.prisma.equipmentItem.count({
          where: {
            trackedIndividually: false,
            lowStockThreshold: { not: null },
            AND: [{ quantity: { not: null } }],
          },
        }).then(async () =>
          // quantity <= lowStockThreshold 인 항목 수 (Prisma는 컬럼 비교를 지원 안 해 raw 사용)
          this.prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count FROM "EquipmentItem"
            WHERE "trackedIndividually" = false
              AND "lowStockThreshold" IS NOT NULL
              AND "quantity" IS NOT NULL
              AND "quantity" <= "lowStockThreshold"
          `.then((r) => Number(r[0]?.count ?? 0))
        ),
      ]);
    return { activePlayerCount, expiringContractCount, injuredPlayerCount, lowStockEquipmentCount };
  }

  // ── GM ─────────────────────────────────────────────────
  async getGmStats() {
    const [expiringContractCount, injuredPlayerCount, activeTransferCount] = await Promise.all([
      this.prisma.contract.count({
        where: { status: "ACTIVE", endDate: { lte: IN_30_DAYS(), gte: NOW() } },
      }),
      this.prisma.injury.count({ where: { status: { notIn: ["RETURNED"] } } }),
      this.prisma.transfer.count({
        where: {
          type: { in: ["LOAN_OUT", "LOAN_IN"] },
          startDate: { lte: NOW() },
          OR: [{ endDate: null }, { endDate: { gte: NOW() } }],
        },
      }),
    ]);
    return { expiringContractCount, injuredPlayerCount, activeTransferCount };
  }

  // ── TD ─────────────────────────────────────────────────
  async getTdStats() {
    const [activeTransferCount, prospectCount, injuredPlayerCount] = await Promise.all([
      this.prisma.transfer.count({
        where: {
          type: { in: ["LOAN_OUT", "LOAN_IN"] },
          startDate: { lte: NOW() },
          OR: [{ endDate: null }, { endDate: { gte: NOW() } }],
        },
      }),
      this.prisma.prospect.count({ where: { status: "ACTIVE" } }),
      this.prisma.injury.count({ where: { status: { notIn: ["RETURNED"] } } }),
    ]);
    return { activeTransferCount, prospectCount, injuredPlayerCount };
  }

  // ── CONTRACT_MANAGER ────────────────────────────────────
  async getContractManagerStats() {
    const [expiringContractCount, totalActiveContractCount] = await Promise.all([
      this.prisma.contract.count({
        where: { status: "ACTIVE", endDate: { lte: IN_30_DAYS(), gte: NOW() } },
      }),
      this.prisma.contract.count({ where: { status: "ACTIVE" } }),
    ]);
    return { expiringContractCount, totalActiveContractCount };
  }

  // ── SCOUT ───────────────────────────────────────────────
  async getScoutStats() {
    const [prospectCount, thisMonthProspectCount] = await Promise.all([
      this.prisma.prospect.count({ where: { status: "ACTIVE" } }),
      this.prisma.prospect.count({
        where: { status: "ACTIVE", createdAt: { gte: START_OF_MONTH() } },
      }),
    ]);
    return { prospectCount, thisMonthProspectCount };
  }

  // ── EQUIPMENT_MANAGER ───────────────────────────────────
  async getEquipmentManagerStats() {
    const [lowStockEquipmentCount, totalEquipmentItemCount] = await Promise.all([
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "EquipmentItem"
        WHERE "trackedIndividually" = false
          AND "lowStockThreshold" IS NOT NULL
          AND "quantity" IS NOT NULL
          AND "quantity" <= "lowStockThreshold"
      `.then((r) => Number(r[0]?.count ?? 0)),
      this.prisma.equipmentItem.count(),
    ]);
    return { lowStockEquipmentCount, totalEquipmentItemCount };
  }

  // ── TACTICAL_ANALYST ────────────────────────────────────
  async getTacticalAnalystStats(userId: number) {
    const [myDraftAnalysisCount, thisMonthMatchCount] = await Promise.all([
      this.prisma.tacticalAnalysis.count({
        where: { createdById: userId, status: "DRAFT" },
      }),
      this.prisma.match.count({ where: { date: { gte: START_OF_MONTH() } } }),
    ]);
    return { myDraftAnalysisCount, thisMonthMatchCount };
  }

  // ── HEAD_COACH / ASSISTANT_COACH ────────────────────────
  async getHeadCoachStats() {
    const [injuredPlayerCount, thisMonthSessionCount, attendanceWarningPlayerCount] =
      await Promise.all([
        this.prisma.injury.count({ where: { status: { notIn: ["RETURNED"] } } }),
        this.prisma.trainingSession.count({ where: { date: { gte: START_OF_MONTH() } } }),
        // TRAINING_ATTENDANCE_WARNING 알림 수신자 중 이번 달 미처리 건수로 근사
        this.prisma.notification.count({
          where: { type: "TRAINING_ATTENDANCE_WARNING", readAt: null },
        }),
      ]);
    return { injuredPlayerCount, thisMonthSessionCount, attendanceWarningPlayerCount };
  }

  // ── 전문 코치 (DEFENSIVE/ATTACKING/SET_PIECE/GOALKEEPER) ─
  async getSpecialistCoachStats(coachingRole: string, userId: number) {
    const positionFilter =
      coachingRole === "DEFENSIVE_COACH"
        ? { in: [...DEFENSIVE_POSITIONS] as string[] }
        : coachingRole === "ATTACKING_COACH"
          ? { in: [...ATTACKING_POSITIONS] as string[] }
          : coachingRole === "GOALKEEPER_COACH"
            ? { equals: "GOALKEEPER" }
            : undefined; // SET_PIECE_COACH — 전체

    const sessionTypeFilter =
      coachingRole === "SET_PIECE_COACH"
        ? "SET_PIECE"
        : coachingRole === "GOALKEEPER_COACH"
          ? "GOALKEEPER"
          : undefined;

    const [assignedPlayerCount, myThisMonthSessionCount] = await Promise.all([
      positionFilter
        ? this.prisma.player.count({
            where: { status: "ACTIVE", position: positionFilter as any },
          })
        : this.prisma.player.count({ where: { status: "ACTIVE" } }),
      this.prisma.trainingSession.count({
        where: {
          createdById: userId,
          date: { gte: START_OF_MONTH() },
          ...(sessionTypeFilter ? { sessionType: sessionTypeFilter as any } : {}),
        },
      }),
    ]);
    return { assignedPlayerCount, myThisMonthSessionCount };
  }

  // ── PHYSICAL_COACH ──────────────────────────────────────
  async getPhysicalCoachStats(userId: number) {
    const [assignedPlayerCount, myThisMonthSessionCount] = await Promise.all([
      this.prisma.player.count({ where: { status: "ACTIVE" } }),
      this.prisma.trainingSession.count({
        where: {
          createdById: userId,
          sessionType: "PHYSICAL",
          date: { gte: START_OF_MONTH() },
        },
      }),
    ]);
    return { assignedPlayerCount, myThisMonthSessionCount };
  }

  // ── MEDICAL ─────────────────────────────────────────────
  async getMedicalStats(userId: number) {
    const [myActiveInjuryCaseCount, thisMonthReturnReadyCount] = await Promise.all([
      this.prisma.injury.count({
        where: {
          medicalStaffId: userId,
          status: { notIn: ["RETURNED"] },
        },
      }),
      this.prisma.injury.count({
        where: {
          medicalStaffId: userId,
          status: "READY_TO_RETURN",
          occurredAt: { gte: START_OF_MONTH() },
        },
      }),
    ]);
    return { myActiveInjuryCaseCount, thisMonthReturnReadyCount };
  }

  // ── MEDICAL_DIRECTOR ────────────────────────────────────
  async getMedicalDirectorStats(userId: number) {
    const base = await this.getMedicalStats(userId);
    const totalInjuredPlayerCount = await this.prisma.injury.count({
      where: { status: { notIn: ["RETURNED"] } },
    });
    return { ...base, totalInjuredPlayerCount };
  }

  // ── PLAYER ──────────────────────────────────────────────
  async getPlayerStats(userId: number) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) return { thisSeasonMatchCount: 0, thisMonthAttendanceRate: 0 };

    const [thisSeasonMatchCount, attendanceStats] = await Promise.all([
      this.prisma.playerMatchStats.count({ where: { playerId: player.id } }),
      this.prisma.trainingParticipant.aggregate({
        where: {
          playerId: player.id,
          session: { date: { gte: START_OF_MONTH() } },
        },
        _count: { _all: true },
        // attended 필드 확인 필요 - 없으면 단순 참가 세션 수로 대체
      }),
    ]);

    const totalSessions = await this.prisma.trainingSession.count({
      where: { date: { gte: START_OF_MONTH() } },
    });
    const attendedSessions = attendanceStats._count._all;
    const thisMonthAttendanceRate =
      totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

    return { thisSeasonMatchCount, thisMonthAttendanceRate };
  }

  // ── AGENT ───────────────────────────────────────────────
  async getAgentStats(userId: number) {
    const [managedPlayerCount, injuredManagedPlayerCount, expiringManagedContractCount] =
      await Promise.all([
        this.prisma.player.count({ where: { agentId: userId, status: "ACTIVE" } }),
        this.prisma.injury.count({
          where: {
            status: { notIn: ["RETURNED"] },
            player: { agentId: userId },
          },
        }),
        this.prisma.contract.count({
          where: {
            status: "ACTIVE",
            endDate: { lte: IN_30_DAYS(), gte: NOW() },
            player: { agentId: userId },
          },
        }),
      ]);
    return { managedPlayerCount, injuredManagedPlayerCount, expiringManagedContractCount };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/dashboard/dashboard.repo.ts
git commit -m "feat(dashboard): add DashboardRepository with per-role Prisma queries"
```

---

## Task 2: BE — DashboardService + 테스트

**Files:**
- Create: `apps/api/src/dashboard/dashboard.service.ts`
- Create: `apps/api/__test__/dashboard/dashboard.service.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// apps/api/__test__/dashboard/dashboard.service.test.ts
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { DashboardService } from "../../src/dashboard/dashboard.service";

const mockRepo = {
  getAdminStats: jest.fn(),
  getGmStats: jest.fn(),
  getTdStats: jest.fn(),
  getContractManagerStats: jest.fn(),
  getScoutStats: jest.fn(),
  getEquipmentManagerStats: jest.fn(),
  getTacticalAnalystStats: jest.fn(),
  getHeadCoachStats: jest.fn(),
  getSpecialistCoachStats: jest.fn(),
  getPhysicalCoachStats: jest.fn(),
  getMedicalStats: jest.fn(),
  getMedicalDirectorStats: jest.fn(),
  getPlayerStats: jest.fn(),
  getAgentStats: jest.fn(),
} as any;

const service = new DashboardService(mockRepo);

describe("DashboardService.getStats", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ADMIN → getAdminStats 호출", async () => {
    mockRepo.getAdminStats.mockResolvedValue({ activePlayerCount: 30 });
    const result = await service.getStats({ id: 1, role: "ADMIN", coachingRole: null, frontOfficeRole: null });
    expect(mockRepo.getAdminStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ activePlayerCount: 30 });
  });

  test("FRONT_OFFICE + GM → getGmStats 호출", async () => {
    mockRepo.getGmStats.mockResolvedValue({ expiringContractCount: 2 });
    const result = await service.getStats({ id: 2, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "GM" });
    expect(mockRepo.getGmStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ expiringContractCount: 2 });
  });

  test("FRONT_OFFICE + EQUIPMENT_MANAGER → getEquipmentManagerStats 호출", async () => {
    mockRepo.getEquipmentManagerStats.mockResolvedValue({ lowStockEquipmentCount: 3 });
    const result = await service.getStats({ id: 3, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "EQUIPMENT_MANAGER" });
    expect(mockRepo.getEquipmentManagerStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ lowStockEquipmentCount: 3 });
  });

  test("COACHING_STAFF + HEAD_COACH → getHeadCoachStats 호출", async () => {
    mockRepo.getHeadCoachStats.mockResolvedValue({ injuredPlayerCount: 2 });
    const result = await service.getStats({ id: 4, role: "COACHING_STAFF", coachingRole: "HEAD_COACH", frontOfficeRole: null });
    expect(mockRepo.getHeadCoachStats).toHaveBeenCalledTimes(1);
  });

  test("COACHING_STAFF + ASSISTANT_COACH → getHeadCoachStats 호출 (동일 대시보드)", async () => {
    mockRepo.getHeadCoachStats.mockResolvedValue({ injuredPlayerCount: 2 });
    await service.getStats({ id: 5, role: "COACHING_STAFF", coachingRole: "ASSISTANT_COACH", frontOfficeRole: null });
    expect(mockRepo.getHeadCoachStats).toHaveBeenCalledTimes(1);
  });

  test("COACHING_STAFF + MEDICAL_DIRECTOR → getMedicalDirectorStats 호출", async () => {
    mockRepo.getMedicalDirectorStats.mockResolvedValue({ totalInjuredPlayerCount: 5 });
    await service.getStats({ id: 6, role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR", frontOfficeRole: null });
    expect(mockRepo.getMedicalDirectorStats).toHaveBeenCalledWith(6);
  });

  test("PLAYER → getPlayerStats(userId) 호출", async () => {
    mockRepo.getPlayerStats.mockResolvedValue({ thisSeasonMatchCount: 10 });
    await service.getStats({ id: 7, role: "PLAYER", coachingRole: null, frontOfficeRole: null });
    expect(mockRepo.getPlayerStats).toHaveBeenCalledWith(7);
  });

  test("AGENT → getAgentStats(userId) 호출", async () => {
    mockRepo.getAgentStats.mockResolvedValue({ managedPlayerCount: 3 });
    await service.getStats({ id: 8, role: "AGENT", coachingRole: null, frontOfficeRole: null });
    expect(mockRepo.getAgentStats).toHaveBeenCalledWith(8);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd apps/api && npx jest __test__/dashboard/dashboard.service.test.ts --no-coverage
```
Expected: FAIL (DashboardService not found)

- [ ] **Step 3: DashboardService 구현**

```typescript
// apps/api/src/dashboard/dashboard.service.ts
import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";
import { DashboardRepository } from "./dashboard.repo";

type UserCtx = {
  id: number;
  role: Role;
  coachingRole: CoachingRole | null | undefined;
  frontOfficeRole: FrontOfficeRole | null | undefined;
};

const SPECIALIST_COACHING_ROLES: CoachingRole[] = [
  "DEFENSIVE_COACH",
  "ATTACKING_COACH",
  "SET_PIECE_COACH",
  "GOALKEEPER_COACH",
  "PHYSICAL_COACH",
];

export class DashboardService {
  constructor(private repo: DashboardRepository) {}

  getStats(user: UserCtx) {
    switch (user.role) {
      case "ADMIN":
        return this.repo.getAdminStats();
      case "FRONT_OFFICE":
        return this.getFrontOfficeStats(user);
      case "COACHING_STAFF":
        return this.getCoachingStats(user);
      case "PLAYER":
        return this.repo.getPlayerStats(user.id);
      case "AGENT":
        return this.repo.getAgentStats(user.id);
    }
  }

  private getFrontOfficeStats(user: UserCtx) {
    switch (user.frontOfficeRole) {
      case "GM":
        return this.repo.getGmStats();
      case "TD":
        return this.repo.getTdStats();
      case "CONTRACT_MANAGER":
        return this.repo.getContractManagerStats();
      case "SCOUT":
        return this.repo.getScoutStats();
      case "EQUIPMENT_MANAGER":
        return this.repo.getEquipmentManagerStats();
      case "TACTICAL_ANALYST":
        return this.repo.getTacticalAnalystStats(user.id);
      default:
        return this.repo.getAdminStats(); // fallback
    }
  }

  private getCoachingStats(user: UserCtx) {
    switch (user.coachingRole) {
      case "HEAD_COACH":
      case "ASSISTANT_COACH":
        return this.repo.getHeadCoachStats();
      case "PHYSICAL_COACH":
        return this.repo.getPhysicalCoachStats(user.id);
      case "MEDICAL":
        return this.repo.getMedicalStats(user.id);
      case "MEDICAL_DIRECTOR":
        return this.repo.getMedicalDirectorStats(user.id);
      default:
        // DEFENSIVE/ATTACKING/SET_PIECE/GOALKEEPER
        return this.repo.getSpecialistCoachStats(user.coachingRole!, user.id);
    }
  }
}
```

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

```bash
cd apps/api && npx jest __test__/dashboard/dashboard.service.test.ts --no-coverage
```
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dashboard/dashboard.service.ts apps/api/__test__/dashboard/dashboard.service.test.ts
git commit -m "feat(dashboard): add DashboardService with role-based dispatch + tests"
```

---

## Task 3: BE — Controller · Routes · apiRouter 등록

**Files:**
- Create: `apps/api/src/dashboard/dashboard.controller.ts`
- Create: `apps/api/src/dashboard/dashboard.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: Controller 작성**

```typescript
// apps/api/src/dashboard/dashboard.controller.ts
import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";

export class DashboardController {
  constructor(private service: DashboardService) {}

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getStats(req.user!));
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 2: Routes 작성**

```typescript
// apps/api/src/dashboard/dashboard.routes.ts
import { Router } from "express";
import passport from "passport";
import { getPrisma } from "../lib/prisma";
import { DashboardRepository } from "./dashboard.repo";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";

const router = Router();
const repo = new DashboardRepository(getPrisma());
const service = new DashboardService(repo);
const controller = new DashboardController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/stats", auth, controller.getStats);

export default router;
```

- [ ] **Step 3: apiRouter에 등록**

`apps/api/src/apiRouter.ts` 파일을 열어 아래 두 줄을 추가:

```typescript
// 기존 import 목록 마지막에 추가
import dashboardRouter from "./dashboard/dashboard.routes";

// apiRouter.use 목록에 추가 (알파벳 순서, contracts 앞)
apiRouter.use("/dashboard", dashboardRouter);
```

- [ ] **Step 4: 서버 실행 후 동작 확인**

```bash
cd apps/api && npx ts-node src/server.ts &
# 로그인 후 accessToken 쿠키로 테스트
curl -s http://localhost:3000/api/dashboard/stats \
  -H "Cookie: accessToken=<your-token>" | jq .
```
Expected: 역할에 맞는 stats JSON 반환

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dashboard/
git add apps/api/src/apiRouter.ts
git commit -m "feat(dashboard): register dashboard router — GET /api/dashboard/stats"
```

---

## Task 4: FE — 타입 + API 서비스

**Files:**
- Create: `football/src/types/dashboard.ts`
- Create: `football/src/services/dashboard.service.ts`

- [ ] **Step 1: 타입 정의**

```typescript
// football/src/types/dashboard.ts

export interface AdminStats {
  activePlayerCount: number
  expiringContractCount: number
  injuredPlayerCount: number
  lowStockEquipmentCount: number
}

export interface GmStats {
  expiringContractCount: number
  injuredPlayerCount: number
  activeTransferCount: number
}

export interface TdStats {
  activeTransferCount: number
  prospectCount: number
  injuredPlayerCount: number
}

export interface ContractManagerStats {
  expiringContractCount: number
  totalActiveContractCount: number
}

export interface ScoutStats {
  prospectCount: number
  thisMonthProspectCount: number
}

export interface EquipmentManagerStats {
  lowStockEquipmentCount: number
  totalEquipmentItemCount: number
}

export interface TacticalAnalystStats {
  myDraftAnalysisCount: number
  thisMonthMatchCount: number
}

export interface HeadCoachStats {
  injuredPlayerCount: number
  thisMonthSessionCount: number
  attendanceWarningPlayerCount: number
}

export interface SpecialistCoachStats {
  assignedPlayerCount: number
  myThisMonthSessionCount: number
}

export interface MedicalStats {
  myActiveInjuryCaseCount: number
  thisMonthReturnReadyCount: number
}

export interface MedicalDirectorStats extends MedicalStats {
  totalInjuredPlayerCount: number
}

export interface PlayerStats {
  thisSeasonMatchCount: number
  thisMonthAttendanceRate: number
}

export interface AgentStats {
  managedPlayerCount: number
  injuredManagedPlayerCount: number
  expiringManagedContractCount: number
}

export type DashboardStats =
  | AdminStats
  | GmStats
  | TdStats
  | ContractManagerStats
  | ScoutStats
  | EquipmentManagerStats
  | TacticalAnalystStats
  | HeadCoachStats
  | SpecialistCoachStats
  | MedicalStats
  | MedicalDirectorStats
  | PlayerStats
  | AgentStats
```

- [ ] **Step 2: API 서비스 작성**

```typescript
// football/src/services/dashboard.service.ts
import { api } from './api'
import type { DashboardStats } from '@/types/dashboard'

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
}
```

- [ ] **Step 3: Commit**

```bash
git add football/src/types/dashboard.ts football/src/services/dashboard.service.ts
git commit -m "feat(dashboard): add DashboardStats types + API client"
```

---

## Task 5: FE — 범용 위젯 컴포넌트 4종

**Files:**
- Create: `football/src/components/dashboard/StatCard.tsx`
- Create: `football/src/components/dashboard/ActionQueueCard.tsx`
- Create: `football/src/components/dashboard/RecentFeedCard.tsx`
- Create: `football/src/components/dashboard/ScheduleCard.tsx`

- [ ] **Step 1: StatCard (숫자 카드)**

```tsx
// football/src/components/dashboard/StatCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  label: string
  value: number | string
  unit?: string
  highlight?: boolean // 빨간 강조 (재고 부족, 만료 임박 등)
}

export function StatCard({ label, value, unit, highlight }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${highlight ? 'text-destructive' : ''}`}>
          {value}
          {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: ActionQueueCard (액션 요청)**

```tsx
// football/src/components/dashboard/ActionQueueCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigate } from 'react-router-dom'
import { type NotificationItem } from '@/services/notification.service'

interface Props {
  notifications: NotificationItem[]
  loading: boolean
}

const ACTION_LABELS: Record<string, string> = {
  RECALL_APPROVAL_REQUESTED: 'Recall 승인 대기',
  TRAINING_SESSION_CONFIRM_REQUESTED: '훈련 세션 확인 요청',
  TACTICAL_ANALYSIS_CONFIRM_REQUESTED: '전술 분석 확인 요청',
  INJURY_READY_TO_RETURN: '부상 복귀 가능',
  CONTRACT_EXPIRY: '계약 만료 임박',
  PERFORMANCE_BONUS_ACHIEVED: '성과 보너스 달성',
  EQUIPMENT_LOW_STOCK: '장비 재고 부족',
  TRAINING_ATTENDANCE_WARNING: '훈련 출석 경고',
  PLAYER_EXTERNAL_ID_UNMAPPED: '선수 외부 ID 미매핑',
  LOAN_OUT_EXPIRED: '임대 만료',
}

export function ActionQueueCard({ notifications, loading }: Props) {
  const navigate = useNavigate()
  const unread = notifications.filter((n) => n.readAt === null)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          처리 대기 항목
          {unread.length > 0 && (
            <span className="ml-2 text-xs font-bold text-destructive">{unread.length}건</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : unread.length === 0 ? (
          <p className="text-sm text-muted-foreground">처리할 항목이 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {unread.slice(0, 5).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="w-full text-left text-sm hover:underline truncate"
                  onClick={() => navigate('/notifications')}
                >
                  {ACTION_LABELS[n.type] ?? n.title} — {n.body}
                </button>
              </li>
            ))}
            {unread.length > 5 && (
              <li>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/notifications')}
                >
                  +{unread.length - 5}건 더 보기
                </button>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: RecentFeedCard (최근 활동)**

```tsx
// football/src/components/dashboard/RecentFeedCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface FeedItem {
  id: string | number
  label: string
  sub?: string
  date: string
}

interface Props {
  title: string
  items: FeedItem[]
  loading: boolean
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function RecentFeedCard({ title, items, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">최근 항목이 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-sm truncate">{item.label}</p>
                  {item.sub && (
                    <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(item.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: ScheduleCard (일정)**

```tsx
// football/src/components/dashboard/ScheduleCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface ScheduleItem {
  id: string | number
  label: string
  date: string
}

interface Props {
  items: ScheduleItem[]
  loading: boolean
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
}

export function ScheduleCard({ items, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">다가오는 일정</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">예정된 일정이 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 3).map((item) => (
              <li key={item.id} className="flex justify-between items-center gap-2">
                <p className="text-sm truncate">{item.label}</p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDateTime(item.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add football/src/components/dashboard/
git commit -m "feat(dashboard): add StatCard, ActionQueueCard, RecentFeedCard, ScheduleCard widgets"
```

---

## Task 6: FE — DashboardPage 구현

**Files:**
- Create: `football/src/pages/dashboard/dashboardConfig.ts`
- Modify: `football/src/pages/dashboard/DashboardPage.tsx`

- [ ] **Step 1: dashboardConfig 작성**

```typescript
// football/src/pages/dashboard/dashboardConfig.ts
import type { UserDto } from '@/types/auth'
import type {
  AdminStats, GmStats, TdStats, ContractManagerStats, ScoutStats,
  EquipmentManagerStats, TacticalAnalystStats, HeadCoachStats,
  SpecialistCoachStats, MedicalStats, MedicalDirectorStats,
  PlayerStats, AgentStats, DashboardStats,
} from '@/types/dashboard'

export interface StatCardConfig {
  label: string
  getValue: (stats: DashboardStats) => number | string
  unit?: string
  highlight?: boolean
}

export interface DashboardConfig {
  statCards: StatCardConfig[]
  showActionQueue: boolean
  showSchedule: boolean
  recentFeedTitle?: string
}

export function getDashboardConfig(user: UserDto): DashboardConfig {
  const { role, coachingRole, frontOfficeRole } = user

  if (role === 'ADMIN') {
    return {
      statCards: [
        { label: '활성 선수', getValue: (s) => (s as AdminStats).activePlayerCount, unit: '명' },
        { label: '만료 임박 계약', getValue: (s) => (s as AdminStats).expiringContractCount, unit: '건', highlight: true },
        { label: '부상 선수', getValue: (s) => (s as AdminStats).injuredPlayerCount, unit: '명', highlight: true },
        { label: '재고 부족 장비', getValue: (s) => (s as AdminStats).lowStockEquipmentCount, unit: '종', highlight: true },
      ],
      showActionQueue: true,
      showSchedule: true,
    }
  }

  if (role === 'FRONT_OFFICE') {
    if (frontOfficeRole === 'GM') {
      return {
        statCards: [
          { label: '만료 임박 계약', getValue: (s) => (s as GmStats).expiringContractCount, unit: '건', highlight: true },
          { label: '부상 선수', getValue: (s) => (s as GmStats).injuredPlayerCount, unit: '명' },
          { label: '진행 중 이적', getValue: (s) => (s as GmStats).activeTransferCount, unit: '건' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: '최근 이적 내역',
      }
    }
    if (frontOfficeRole === 'TD') {
      return {
        statCards: [
          { label: '진행 중 이적', getValue: (s) => (s as TdStats).activeTransferCount, unit: '건' },
          { label: '등록된 Prospect', getValue: (s) => (s as TdStats).prospectCount, unit: '명' },
          { label: '부상 선수', getValue: (s) => (s as TdStats).injuredPlayerCount, unit: '명' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: '최근 Prospect',
      }
    }
    if (frontOfficeRole === 'CONTRACT_MANAGER') {
      return {
        statCards: [
          { label: '만료 임박 계약', getValue: (s) => (s as ContractManagerStats).expiringContractCount, unit: '건', highlight: true },
          { label: '전체 활성 계약', getValue: (s) => (s as ContractManagerStats).totalActiveContractCount, unit: '건' },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: '최근 계약 현황',
      }
    }
    if (frontOfficeRole === 'SCOUT') {
      return {
        statCards: [
          { label: '등록된 Prospect', getValue: (s) => (s as ScoutStats).prospectCount, unit: '명' },
          { label: '이번 달 신규 Prospect', getValue: (s) => (s as ScoutStats).thisMonthProspectCount, unit: '명' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: '최근 Prospect 목록',
      }
    }
    if (frontOfficeRole === 'EQUIPMENT_MANAGER') {
      return {
        statCards: [
          { label: '재고 부족 장비', getValue: (s) => (s as EquipmentManagerStats).lowStockEquipmentCount, unit: '종', highlight: true },
          { label: '전체 장비 품목', getValue: (s) => (s as EquipmentManagerStats).totalEquipmentItemCount, unit: '종' },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: '최근 장비 지급 내역',
      }
    }
    if (frontOfficeRole === 'TACTICAL_ANALYST') {
      return {
        statCards: [
          { label: '내 DRAFT 분석', getValue: (s) => (s as TacticalAnalystStats).myDraftAnalysisCount, unit: '건' },
          { label: '이번 달 경기', getValue: (s) => (s as TacticalAnalystStats).thisMonthMatchCount, unit: '경기' },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: '최근 경기 결과',
      }
    }
  }

  if (role === 'COACHING_STAFF') {
    if (coachingRole === 'HEAD_COACH' || coachingRole === 'ASSISTANT_COACH') {
      return {
        statCards: [
          { label: '부상 선수', getValue: (s) => (s as HeadCoachStats).injuredPlayerCount, unit: '명', highlight: true },
          { label: '이번 달 훈련 세션', getValue: (s) => (s as HeadCoachStats).thisMonthSessionCount, unit: '회' },
          { label: '출석 경고 선수', getValue: (s) => (s as HeadCoachStats).attendanceWarningPlayerCount, unit: '명', highlight: true },
        ],
        showActionQueue: true,
        showSchedule: true,
        recentFeedTitle: '최근 경기 결과',
      }
    }
    if (coachingRole === 'MEDICAL_DIRECTOR') {
      return {
        statCards: [
          { label: '내 담당 부상 케이스', getValue: (s) => (s as MedicalDirectorStats).myActiveInjuryCaseCount, unit: '건' },
          { label: '이번 달 복귀 가능 전환', getValue: (s) => (s as MedicalDirectorStats).thisMonthReturnReadyCount, unit: '건' },
          { label: '전체 부상 선수', getValue: (s) => (s as MedicalDirectorStats).totalInjuredPlayerCount, unit: '명', highlight: true },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: '최근 부상 업데이트',
      }
    }
    if (coachingRole === 'MEDICAL') {
      return {
        statCards: [
          { label: '내 담당 부상 케이스', getValue: (s) => (s as MedicalStats).myActiveInjuryCaseCount, unit: '건' },
          { label: '이번 달 복귀 가능 전환', getValue: (s) => (s as MedicalStats).thisMonthReturnReadyCount, unit: '건' },
        ],
        showActionQueue: true,
        showSchedule: false,
        recentFeedTitle: '최근 부상 업데이트',
      }
    }
    // DEFENSIVE/ATTACKING/SET_PIECE/GOALKEEPER/PHYSICAL
    return {
      statCards: [
        { label: '담당 선수 수', getValue: (s) => (s as SpecialistCoachStats).assignedPlayerCount, unit: '명' },
        { label: '이번 달 내 세션', getValue: (s) => (s as SpecialistCoachStats).myThisMonthSessionCount, unit: '회' },
      ],
      showActionQueue: true,
      showSchedule: true,
      recentFeedTitle: '최근 훈련 세션',
    }
  }

  if (role === 'PLAYER') {
    return {
      statCards: [
        { label: '이번 시즌 출전 경기', getValue: (s) => (s as PlayerStats).thisSeasonMatchCount, unit: '경기' },
        { label: '이번 달 출석률', getValue: (s) => (s as PlayerStats).thisMonthAttendanceRate, unit: '%' },
      ],
      showActionQueue: true,
      showSchedule: true,
      recentFeedTitle: '최근 출전 경기',
    }
  }

  // AGENT
  return {
    statCards: [
      { label: '담당 선수', getValue: (s) => (s as AgentStats).managedPlayerCount, unit: '명' },
      { label: '부상 중인 담당 선수', getValue: (s) => (s as AgentStats).injuredManagedPlayerCount, unit: '명', highlight: true },
      { label: '만료 임박 계약', getValue: (s) => (s as AgentStats).expiringManagedContractCount, unit: '건', highlight: true },
    ],
    showActionQueue: true,
    showSchedule: true,
    recentFeedTitle: '담당 선수 최근 경기',
  }
}
```

- [ ] **Step 2: DashboardPage 구현**

```tsx
// football/src/pages/dashboard/DashboardPage.tsx
import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { dashboardApi } from '@/services/dashboard.service'
import { notificationApi, type NotificationItem } from '@/services/notification.service'
import type { DashboardStats } from '@/types/dashboard'
import { getDashboardConfig } from './dashboardConfig'
import { StatCard } from '@/components/dashboard/StatCard'
import { ActionQueueCard } from '@/components/dashboard/ActionQueueCard'
import { ScheduleCard } from '@/components/dashboard/ScheduleCard'
import { RecentFeedCard } from '@/components/dashboard/RecentFeedCard'

export function DashboardPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [notiLoading, setNotiLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    dashboardApi.stats()
      .then(setStats)
      .finally(() => setStatsLoading(false))
    notificationApi.my()
      .then(setNotifications)
      .finally(() => setNotiLoading(false))
  }, [user])

  if (userLoading) {
    return <div className="p-8 text-muted-foreground">불러오는 중...</div>
  }
  if (!user) return null

  const config = getDashboardConfig(user)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">대시보드</h2>
        <p className="text-muted-foreground text-sm">{user.nickname}님, 안녕하세요</p>
      </div>

      {/* 숫자 카드 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {config.statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={stats ? card.getValue(stats) : '—'}
            unit={card.unit}
            highlight={card.highlight && stats ? (card.getValue(stats) as number) > 0 : false}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* 액션 요청 */}
        {config.showActionQueue && (
          <ActionQueueCard notifications={notifications} loading={notiLoading} />
        )}

        {/* 최근 활동 */}
        {config.recentFeedTitle && (
          <RecentFeedCard
            title={config.recentFeedTitle}
            items={[]}
            loading={false}
          />
        )}

        {/* 일정 */}
        {config.showSchedule && (
          <ScheduleCard items={[]} loading={false} />
        )}
      </div>
    </div>
  )
}
```

> **Note:** `RecentFeedCard`와 `ScheduleCard`의 `items`는 현재 빈 배열로 시작합니다. 이 데이터는 각 도메인 API(`/matches`, `/training` 등)에서 추가로 fetch해야 하며, 추후 개선 태스크로 분리됩니다. 현재 구현은 위젯 레이아웃과 stats + 액션 요청 동작 확인에 집중합니다.

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
cd football && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add football/src/pages/dashboard/
git commit -m "feat(dashboard): implement role-based DashboardPage with widget registry"
```

---

## Self-Review

**Spec coverage 체크:**
- ✅ 단일 DashboardPage
- ✅ 서브롤까지 구분 (frontOfficeRole / coachingRole)
- ✅ 4종 위젯 유형
- ✅ ADMIN / GM / TD / CONTRACT_MANAGER / SCOUT / EQUIPMENT_MANAGER / TACTICAL_ANALYST
- ✅ HEAD_COACH = ASSISTANT_COACH 동일
- ✅ 전문 코치 4종 공통 템플릿
- ✅ PHYSICAL_COACH (assignedPlayerCount + Physical 세션)
- ✅ MEDICAL / MEDICAL_DIRECTOR
- ✅ PLAYER / AGENT
- ✅ GET /dashboard/stats (역할별 다른 응답)
- ✅ 하이브리드 fetch (stats API + notifications/my)
- ⚠️ RecentFeedCard·ScheduleCard items는 빈 배열 — 도메인 API 연결은 추후 태스크

**Placeholder scan:** 위 ⚠️ 항목은 의도적 scope-out이며 Note에 명시됨.

**Type consistency:** `DashboardStats` union이 Task 4에서 정의되고 Task 6 config에서 동일 타입으로 사용됨. 확인 완료.
