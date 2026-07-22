# Coach 채용 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prisma 스키마에만 존재하는 Coach 채용 도메인(CoachHiringRound, Coach, 역할별 평가, TutorAssignment)에 대한 BE REST API와 FE 관리 UI를 구현한다.

**Architecture:** prospect 모듈 패턴을 그대로 따른다(repo → service → controller → routes). 알림은 기존 NotificationService/Repo에 coach 메서드를 추가한다. FE는 `/coaches/rounds`(라운드 목록) → `/coaches?roundId=X`(후보 목록) → `/coaches/:id`(상세/평가/튜터) 3단계 네비게이션.

**Tech Stack:** Express + Prisma 7 + TypeScript (BE), React + shadcn/ui + React Router v6 (FE), Jest + PrismaPg (integration tests)

---

## File Structure

**BE — 신규 생성:**
- `apps/api/src/coach/dto/coach.dto.ts` — 모든 DTO 인터페이스
- `apps/api/src/coach/coach.repo.ts` — DB 레이어 (HiringRound CRUD + Coach CRUD + 상태머신 + eval upsert + tutor CRUD)
- `apps/api/src/coach/coach.service.ts` — 비즈니스 로직 + 알림 트리거
- `apps/api/src/coach/coach.controller.ts` — HTTP 핸들러 + 권한 체크
- `apps/api/src/coach/coach.routes.ts` — Express 라우터 배선
- `apps/api/__test__/coach/coach.hiring.test.ts` — 통합 테스트

**BE — 수정:**
- `apps/api/src/notification/notification.repo.ts` — `createForTD` 메서드 추가
- `apps/api/src/notification/notification.service.ts` — coach 도메인 알림 4종 추가
- `apps/api/src/apiRouter.ts` — `/coaches` 마운트

**FE — 신규 생성:**
- `football/src/types/coach.ts` — 타입 + 레이블 상수
- `football/src/services/coach.service.ts` — API 호출 헬퍼
- `football/src/pages/coaches/HiringRoundsPage.tsx` — 채용 라운드 목록 + 생성 Dialog
- `football/src/pages/coaches/CoachListPage.tsx` — 라운드별 후보 목록 + 상태 전환
- `football/src/pages/coaches/CoachDetailPage.tsx` — 상세 + 평가 입력 + 튜터 배정

**FE — 수정:**
- `football/src/App.tsx` — 라우트 3개 추가
- `football/src/layouts/AppShell.tsx` — `Briefcase` 아이콘 import + NAV_ITEMS 항목 추가

---

## 권한 규칙 (모든 태스크 참고)

| 작업 | 허용 role |
|------|-----------|
| 읽기 전체 | ADMIN, FRONT_OFFICE(GM, TD) |
| 쓰기 (라운드 생성/후보 등록/전환) | FRONT_OFFICE(GM, TD) |
| CONTRACTED 최종 승인 | FRONT_OFFICE(GM) only |
| SCOUT은 Coach 도메인 접근 불가 | — |

## 상태머신

```
CANDIDATE → SHORTLISTED → APPROVAL_PENDING → CONTRACTED → RETIRED
                                          ↘
                           ARCHIVED (어느 단계에서든)
```

역방향 전환 없음.

## 알림 트리거

| 전환 | 수신자 | 메서드 |
|------|--------|--------|
| CANDIDATE→SHORTLISTED (수동, GM 실행) | TD | `notifyCoachShortlisted` |
| SHORTLISTED→APPROVAL_PENDING (TD 실행) | GM | `notifyCoachApprovalPending` |
| APPROVAL_PENDING→CONTRACTED (GM 실행) | ADMIN | `notifyCoachContracted` |
| 어느 단계→ARCHIVED | 라운드 개설 GM (roundCreatorId) | `notifyCoachArchived` |

---

## Task 1: NotificationRepo + NotificationService — coach 알림 메서드

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`
- Modify: `apps/api/src/notification/notification.service.ts`

- [x] **Step 1: notification.repo.ts에 `createForTD` 추가**

`createForAdmin` 바로 뒤에 삽입:

```typescript
createForTD(type: string, title: string, body: string, entityId?: number) {
  return this.prisma.$transaction(async (tx) => {
    const tdUsers = await tx.user.findMany({
      where: { role: "FRONT_OFFICE", frontOfficeRole: "TD" },
      select: { id: true },
    });
    if (tdUsers.length === 0) return;
    await tx.notification.createMany({
      data: tdUsers.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
    });
  });
}
```

- [x] **Step 2: notification.service.ts에 coach 알림 4개 추가**

`notifyProspectSigned` 메서드 뒤에 추가:

```typescript
async notifyCoachShortlisted(coachName: string, coachId: number) {
  const title = "코치 후보 숏리스트 등록";
  const body = `${coachName} 코치가 숏리스트에 추가됐습니다. 검토 바랍니다.`;
  await this.repo.createForTD("COACH_SHORTLISTED", title, body, coachId);
  getIO().to("staff-room").emit("notification:coach", { type: "COACH_SHORTLISTED", title, body, createdAt: new Date().toISOString() });
}

async notifyCoachApprovalPending(coachName: string, coachId: number) {
  const title = "코치 채용 승인 요청";
  const body = `${coachName} 코치 채용 건에 GM 최종 승인이 필요합니다.`;
  await this.repo.createForGM("COACH_APPROVAL_PENDING", title, body, coachId);
  getIO().to("staff-room").emit("notification:coach", { type: "COACH_APPROVAL_PENDING", title, body, createdAt: new Date().toISOString() });
}

async notifyCoachContracted(coachName: string, coachId: number) {
  const title = "코치 채용 완료 — 계정 생성 필요";
  const body = `${coachName} 코치 계약이 확정됐습니다. ADMIN이 User 계정을 생성하고 초대해주세요.`;
  await this.repo.createForAdmin("COACH_CONTRACTED", title, body, coachId);
  getIO().to("staff-room").emit("notification:coach", { type: "COACH_CONTRACTED", title, body, createdAt: new Date().toISOString() });
}

async notifyCoachArchived(coachName: string, coachId: number, roundCreatorId: number) {
  const title = "코치 후보 탈락";
  const body = `${coachName} 코치 후보가 탈락 처리됐습니다.`;
  await this.repo.create({ userId: roundCreatorId, type: "COACH_ARCHIVED", title, body, entityId: coachId });
}
```

- [x] **Step 3: tsc 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [x] **Step 4: commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/notification/notification.repo.ts apps/api/src/notification/notification.service.ts
git commit -m "feat(coach): add coach domain notification methods"
```

---

## Task 2: BE DTOs

**Files:**
- Create: `apps/api/src/coach/dto/coach.dto.ts`

- [x] **Step 1: DTO 파일 작성**

```typescript
import {
  CoachingRole, CoachStatus, HiringRoundStatus,
  TutorType, LanguageProficiency, ShortlistSource,
} from "../../generated/enums";

// ─── HiringRound ────────────────────────────────────────────────────────────
export interface CreateHiringRoundDto {
  targetRole: CoachingRole;
  fitScoreThreshold?: number;
  deadline?: string;
  budget?: number;
  notes?: string;
  createdById: number;
}

export interface UpdateHiringRoundStatusDto {
  status: HiringRoundStatus;
  result?: string;
}

// ─── Coach ──────────────────────────────────────────────────────────────────
export interface CreateCoachDto {
  name: string;
  nationality?: string;
  coachingRole: CoachingRole;
  notes?: string;
  hiringRoundId?: number;
  packageLeadId?: number;
  createdById?: number;
}

export interface UpdateCoachDto {
  name?: string;
  nationality?: string;
  notes?: string;
  packageLeadId?: number;
}

export interface TransitionCoachStatusDto {
  status: CoachStatus;
  shortlistSource?: ShortlistSource;
}

// ─── Evaluation ─────────────────────────────────────────────────────────────
export interface UpsertHeadCoachEvalDto {
  possession?: number;
  pressingIntensity?: number;
  progressivePassAccuracy?: number;
  teamActivity?: number;
  philosophyFitScore?: number;
  dataSource?: string;
  evaluatedAt?: string;
}

export interface UpsertDefensiveEvalDto {
  tackleSuccessRate?: number;
  clearances?: number;
  blocks?: number;
  defensiveErrors?: number;
  ballRecovery?: number;
  pressingIntensity?: number;
  dataSource?: string;
  evaluatedAt?: string;
}

export interface UpsertAttackingEvalDto {
  xG?: number;
  xA?: number;
  chanceCreation?: number;
  dribbleSuccessRate?: number;
  progressivePassAccuracy?: number;
  shotConversionRate?: number;
  goalInvolvement?: number;
  dataSource?: string;
  evaluatedAt?: string;
}

export interface UpsertGoalkeeperEvalDto {
  psxG?: number;
  xGConcededDiff?: number;
  buildupPassAccuracy?: number;
  dataSource?: string;
  evaluatedAt?: string;
}

export interface UpsertTier2EvalDto {
  fitScore?: number;
  notes?: string;
  evaluatedAt?: string;
}

// ─── TutorAssignment ────────────────────────────────────────────────────────
export interface CreateTutorAssignmentDto {
  type: TutorType;
  internalTutorId?: number;
  externalName?: string;
  externalContact?: string;
  sessionCount?: number;
  languageProficiency?: LanguageProficiency;
}

export interface UpdateTutorAssignmentDto {
  sessionCount?: number;
  languageProficiency?: LanguageProficiency;
  tacticalImplementationRate?: number;
}
```

- [x] **Step 2: commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/coach/dto/coach.dto.ts
git commit -m "feat(coach): add coach BE DTOs"
```

---

## Task 3: BE Repository

**Files:**
- Create: `apps/api/src/coach/coach.repo.ts`

- [x] **Step 1: repo 작성 (상태머신 포함)**

```typescript
import { PrismaClient } from "../generated/client";
import { CoachStatus, CoachingRole } from "../generated/enums";
import { AppError } from "../lib/appError";
import {
  CreateHiringRoundDto, UpdateHiringRoundStatusDto,
  CreateCoachDto, UpdateCoachDto, TransitionCoachStatusDto,
  UpsertHeadCoachEvalDto, UpsertDefensiveEvalDto, UpsertAttackingEvalDto,
  UpsertGoalkeeperEvalDto, UpsertTier2EvalDto,
  CreateTutorAssignmentDto, UpdateTutorAssignmentDto,
} from "./dto/coach.dto";

const VALID_TRANSITIONS: Record<CoachStatus, CoachStatus[]> = {
  CANDIDATE:        ["SHORTLISTED", "ARCHIVED"],
  SHORTLISTED:      ["APPROVAL_PENDING", "ARCHIVED"],
  APPROVAL_PENDING: ["CONTRACTED", "ARCHIVED"],
  CONTRACTED:       ["RETIRED"],
  RETIRED:          [],
  ARCHIVED:         [],
};

const TIER1_ROLES: CoachingRole[] = ["HEAD_COACH", "DEFENSIVE_COACH", "ATTACKING_COACH", "GOALKEEPER_COACH"];

const ROUND_SELECT = {
  id: true, targetRole: true, fitScoreThreshold: true, status: true,
  deadline: true, budget: true, notes: true, result: true,
  createdAt: true,
  createdBy: { select: { nickname: true } },
  _count: { select: { coaches: true } },
} as const;

const COACH_SELECT = {
  id: true, name: true, nationality: true, coachingRole: true,
  status: true, shortlistSource: true, notes: true,
  isDeleted: true, packageLeadId: true, hiringRoundId: true, userId: true,
  createdAt: true, updatedAt: true,
  packageLead: { select: { id: true, name: true } },
  headCoachEval: true,
  defensiveCoachEval: true,
  attackingCoachEval: true,
  goalkeeperCoachEval: true,
  tier2Eval: true,
  tutorAssignments: {
    select: {
      id: true, type: true, sessionCount: true,
      languageProficiency: true, tacticalImplementationRate: true,
      externalName: true, externalContact: true,
      internalTutorId: true,
      internalTutor: { select: { nickname: true } },
      createdAt: true,
    },
  },
} as const;

export class CoachRepository {
  constructor(private prisma: PrismaClient) {}

  // ── HiringRound ────────────────────────────────────────────────────────────

  findAllRounds() {
    return this.prisma.coachHiringRound.findMany({
      select: ROUND_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findRoundById(id: number) {
    return this.prisma.coachHiringRound.findUnique({ where: { id }, select: ROUND_SELECT });
  }

  createRound(dto: CreateHiringRoundDto) {
    return this.prisma.coachHiringRound.create({
      data: {
        targetRole: dto.targetRole,
        fitScoreThreshold: dto.fitScoreThreshold ?? 70,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        budget: dto.budget ?? null,
        notes: dto.notes ?? null,
        createdById: dto.createdById,
      },
      select: ROUND_SELECT,
    });
  }

  updateRoundStatus(id: number, dto: UpdateHiringRoundStatusDto) {
    return this.prisma.coachHiringRound.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.result !== undefined && { result: dto.result }),
      },
      select: ROUND_SELECT,
    });
  }

  // ── Coach ──────────────────────────────────────────────────────────────────

  findAll(filters: { roundId?: number; status?: CoachStatus }) {
    return this.prisma.coach.findMany({
      where: {
        isDeleted: false,
        ...(filters.roundId !== undefined && { hiringRoundId: filters.roundId }),
        ...(filters.status !== undefined && { status: filters.status }),
      },
      select: COACH_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.coach.findFirst({ where: { id, isDeleted: false }, select: COACH_SELECT });
  }

  create(dto: CreateCoachDto) {
    return this.prisma.coach.create({
      data: {
        name: dto.name,
        nationality: dto.nationality ?? null,
        coachingRole: dto.coachingRole,
        notes: dto.notes ?? null,
        hiringRoundId: dto.hiringRoundId ?? null,
        packageLeadId: dto.packageLeadId ?? null,
      },
      select: COACH_SELECT,
    });
  }

  update(id: number, dto: UpdateCoachDto) {
    return this.prisma.coach.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nationality !== undefined && { nationality: dto.nationality }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.packageLeadId !== undefined && { packageLeadId: dto.packageLeadId }),
      },
      select: COACH_SELECT,
    });
  }

  async updateStatus(id: number, dto: TransitionCoachStatusDto) {
    const coach = await this.prisma.coach.findUnique({
      where: { id },
      select: { status: true, hiringRound: { select: { createdById: true } } },
    });
    if (!coach) throw new AppError(404, "COACH_NOT_FOUND");
    const allowed = VALID_TRANSITIONS[coach.status];
    if (!allowed.includes(dto.status)) throw new AppError(409, "INVALID_STATUS_TRANSITION");
    return {
      coach: await this.prisma.coach.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.shortlistSource !== undefined && { shortlistSource: dto.shortlistSource }),
        },
        select: COACH_SELECT,
      }),
      roundCreatorId: coach.hiringRound?.createdById ?? null,
    };
  }

  // ── Evaluation ─────────────────────────────────────────────────────────────

  async upsertEvaluation(coachId: number, role: CoachingRole, dto: Record<string, unknown>) {
    const evalAt = dto["evaluatedAt"] ? new Date(dto["evaluatedAt"] as string) : new Date();
    const base = { coachId, ...dto, evaluatedAt: evalAt };
    delete base["evaluatedAt"];

    if (role === "HEAD_COACH") {
      return this.prisma.headCoachEvaluation.upsert({
        where: { coachId },
        create: base as any,
        update: base as any,
      });
    }
    if (role === "DEFENSIVE_COACH") {
      return this.prisma.defensiveCoachEvaluation.upsert({
        where: { coachId },
        create: base as any,
        update: base as any,
      });
    }
    if (role === "ATTACKING_COACH") {
      return this.prisma.attackingCoachEvaluation.upsert({
        where: { coachId },
        create: base as any,
        update: base as any,
      });
    }
    if (role === "GOALKEEPER_COACH") {
      return this.prisma.goalkeeperCoachEvaluation.upsert({
        where: { coachId },
        create: base as any,
        update: base as any,
      });
    }
    // Tier 2
    return this.prisma.coachTier2Evaluation.upsert({
      where: { coachId },
      create: base as any,
      update: base as any,
    });
  }

  isTier1(role: CoachingRole): boolean {
    return (TIER1_ROLES as string[]).includes(role);
  }

  // ── TutorAssignment ────────────────────────────────────────────────────────

  findTutors(coachId: number) {
    return this.prisma.coachTutorAssignment.findMany({
      where: { coachId },
      select: {
        id: true, type: true, sessionCount: true,
        languageProficiency: true, tacticalImplementationRate: true,
        externalName: true, externalContact: true,
        internalTutorId: true,
        internalTutor: { select: { nickname: true } },
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  createTutor(coachId: number, dto: CreateTutorAssignmentDto) {
    return this.prisma.coachTutorAssignment.create({
      data: {
        coachId,
        type: dto.type,
        internalTutorId: dto.internalTutorId ?? null,
        externalName: dto.externalName ?? null,
        externalContact: dto.externalContact ?? null,
        sessionCount: dto.sessionCount ?? 0,
        languageProficiency: dto.languageProficiency ?? null,
      },
    });
  }

  updateTutor(id: number, dto: UpdateTutorAssignmentDto) {
    return this.prisma.coachTutorAssignment.update({
      where: { id },
      data: {
        ...(dto.sessionCount !== undefined && { sessionCount: dto.sessionCount }),
        ...(dto.languageProficiency !== undefined && { languageProficiency: dto.languageProficiency }),
        ...(dto.tacticalImplementationRate !== undefined && { tacticalImplementationRate: dto.tacticalImplementationRate }),
      },
    });
  }
}
```

- [x] **Step 2: tsc 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [x] **Step 3: commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/coach/coach.repo.ts
git commit -m "feat(coach): add CoachRepository with state machine + eval upsert + tutor CRUD"
```

---

## Task 4: BE Service

**Files:**
- Create: `apps/api/src/coach/coach.service.ts`

- [x] **Step 1: service 작성**

```typescript
import { CoachRepository } from "./coach.repo";
import { AppError } from "../lib/appError";
import {
  CreateHiringRoundDto, UpdateHiringRoundStatusDto,
  CreateCoachDto, UpdateCoachDto, TransitionCoachStatusDto,
  UpsertHeadCoachEvalDto, UpsertDefensiveEvalDto, UpsertAttackingEvalDto,
  UpsertGoalkeeperEvalDto, UpsertTier2EvalDto,
  CreateTutorAssignmentDto, UpdateTutorAssignmentDto,
} from "./dto/coach.dto";
import { CoachingRole } from "../generated/enums";
import { NotificationService } from "../notification/notification.service";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const notificationService = new NotificationService(new NotificationRepository(getPrisma()));

export class CoachService {
  constructor(private repo: CoachRepository) {}

  // ── HiringRound ────────────────────────────────────────────────────────────

  getAllRounds() {
    return this.repo.findAllRounds();
  }

  async getRoundById(id: number) {
    const round = await this.repo.findRoundById(id);
    if (!round) throw new AppError(404, "HIRING_ROUND_NOT_FOUND");
    return round;
  }

  createRound(dto: CreateHiringRoundDto) {
    return this.repo.createRound(dto);
  }

  async updateRoundStatus(id: number, dto: UpdateHiringRoundStatusDto) {
    const round = await this.repo.findRoundById(id);
    if (!round) throw new AppError(404, "HIRING_ROUND_NOT_FOUND");
    return this.repo.updateRoundStatus(id, dto);
  }

  // ── Coach ──────────────────────────────────────────────────────────────────

  getAll(filters: { roundId?: number; status?: import("../generated/enums").CoachStatus }) {
    return this.repo.findAll(filters);
  }

  async getById(id: number) {
    const coach = await this.repo.findById(id);
    if (!coach) throw new AppError(404, "COACH_NOT_FOUND");
    return coach;
  }

  create(dto: CreateCoachDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateCoachDto) {
    const coach = await this.repo.findById(id);
    if (!coach) throw new AppError(404, "COACH_NOT_FOUND");
    return this.repo.update(id, dto);
  }

  async updateStatus(id: number, dto: TransitionCoachStatusDto) {
    const { coach, roundCreatorId } = await this.repo.updateStatus(id, dto);
    const name = coach.name;

    // 알림 (fire-and-forget)
    if (dto.status === "SHORTLISTED" && dto.shortlistSource === "MANUAL") {
      void notificationService.notifyCoachShortlisted(name, id).catch(console.error);
    } else if (dto.status === "APPROVAL_PENDING") {
      void notificationService.notifyCoachApprovalPending(name, id).catch(console.error);
    } else if (dto.status === "CONTRACTED") {
      void notificationService.notifyCoachContracted(name, id).catch(console.error);
    } else if (dto.status === "ARCHIVED" && roundCreatorId) {
      void notificationService.notifyCoachArchived(name, id, roundCreatorId).catch(console.error);
    }

    return coach;
  }

  // ── Evaluation ─────────────────────────────────────────────────────────────

  async upsertEvaluation(
    coachId: number,
    dto: UpsertHeadCoachEvalDto | UpsertDefensiveEvalDto | UpsertAttackingEvalDto | UpsertGoalkeeperEvalDto | UpsertTier2EvalDto,
  ) {
    const coach = await this.repo.findById(coachId);
    if (!coach) throw new AppError(404, "COACH_NOT_FOUND");
    return this.repo.upsertEvaluation(coachId, coach.coachingRole as CoachingRole, dto as Record<string, unknown>);
  }

  // ── TutorAssignment ────────────────────────────────────────────────────────

  async getTutors(coachId: number) {
    const coach = await this.repo.findById(coachId);
    if (!coach) throw new AppError(404, "COACH_NOT_FOUND");
    return this.repo.findTutors(coachId);
  }

  async createTutor(coachId: number, dto: CreateTutorAssignmentDto) {
    const coach = await this.repo.findById(coachId);
    if (!coach) throw new AppError(404, "COACH_NOT_FOUND");
    if (dto.type === "INTERNAL" && !dto.internalTutorId) {
      throw new AppError(400, "INTERNAL_TUTOR_ID_REQUIRED");
    }
    if (dto.type === "EXTERNAL" && !dto.externalName) {
      throw new AppError(400, "EXTERNAL_NAME_REQUIRED");
    }
    return this.repo.createTutor(coachId, dto);
  }

  updateTutor(id: number, dto: UpdateTutorAssignmentDto) {
    return this.repo.updateTutor(id, dto);
  }
}
```

- [x] **Step 2: tsc 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [x] **Step 3: commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/coach/coach.service.ts
git commit -m "feat(coach): add CoachService with notification triggers"
```

---

## Task 5: BE Controller + Routes + apiRouter 등록

**Files:**
- Create: `apps/api/src/coach/coach.controller.ts`
- Create: `apps/api/src/coach/coach.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: controller 작성**

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { CoachService } from "./coach.service";
import { CoachStatus } from "../generated/enums";

const canRead = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "ADMIN" || (role === "FRONT_OFFICE" && (frontOfficeRole === "GM" || frontOfficeRole === "TD"));

const canWrite = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "FRONT_OFFICE" && (frontOfficeRole === "GM" || frontOfficeRole === "TD");

const canApprove = (role: string, frontOfficeRole: string | null | undefined) =>
  role === "FRONT_OFFICE" && frontOfficeRole === "GM";

export class CoachController {
  constructor(private service: CoachService) {}

  // ── HiringRound ────────────────────────────────────────────────────────────

  listRounds = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getAllRounds());
    } catch (err) { next(err); }
  };

  createRound = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = req.user!;
      if (!canApprove(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createRound({ ...req.body, createdById: id }));
    } catch (err) { next(err); }
  };

  updateRoundStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canApprove(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.updateRoundStatus(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  // ── Coach ──────────────────────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      const roundId = req.query["roundId"] ? Number(req.query["roundId"]) : undefined;
      const status = req.query["status"] as CoachStatus | undefined;
      res.json(await this.service.getAll({ roundId, status }));
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      // CONTRACTED는 GM만 가능
      if (req.body.status === "CONTRACTED") {
        if (!canApprove(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      } else {
        if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      }
      res.json(await this.service.updateStatus(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  // ── Evaluation ─────────────────────────────────────────────────────────────

  upsertEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.upsertEvaluation(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  // ── TutorAssignment ────────────────────────────────────────────────────────

  listTutors = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canRead(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getTutors(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  createTutor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createTutor(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  updateTutor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole } = req.user!;
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.updateTutor(Number(req.params["tutorId"]), req.body));
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 2: routes 작성**

```typescript
import { Router } from "express";
import passport from "passport";
import { CoachRepository } from "./coach.repo";
import { CoachService } from "./coach.service";
import { CoachController } from "./coach.controller";
import { getPrisma } from "../lib/prisma";

const repo = new CoachRepository(getPrisma());
const service = new CoachService(repo);
const controller = new CoachController(service);
const auth = passport.authenticate("accessToken", { session: false });

const router = Router();

// HiringRound
router.get("/rounds", auth, controller.listRounds);
router.post("/rounds", auth, controller.createRound);
router.patch("/rounds/:id/status", auth, controller.updateRoundStatus);

// Coach
router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.get("/:id", auth, controller.getById);
router.patch("/:id", auth, controller.update);
router.patch("/:id/status", auth, controller.updateStatus);

// Evaluation
router.put("/:id/evaluation", auth, controller.upsertEvaluation);

// TutorAssignment
router.get("/:id/tutors", auth, controller.listTutors);
router.post("/:id/tutors", auth, controller.createTutor);
router.patch("/:id/tutors/:tutorId", auth, controller.updateTutor);

export default router;
```

- [x] **Step 3: apiRouter.ts에 마운트**

`apps/api/src/apiRouter.ts`에서 `import medicalExpenseRouter` 줄 아래에 추가:

```typescript
import coachRouter from "./coach/coach.routes";
```

`apiRouter.use("/medical-expenses", medicalExpenseRouter);` 줄 아래에 추가:

```typescript
apiRouter.use("/coaches", coachRouter);
```

- [x] **Step 4: tsc 체크**

```bash
cd /Users/juno/work/football/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [x] **Step 5: commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/coach/coach.controller.ts apps/api/src/coach/coach.routes.ts apps/api/src/apiRouter.ts
git commit -m "feat(coach): add coach controller, routes, and apiRouter registration"
```

---

## Task 6: BE 통합 테스트

**Files:**
- Create: `apps/api/__test__/coach/coach.hiring.test.ts`

- [x] **Step 1: 테스트 파일 작성**

```typescript
import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

let roundId: number;
let coachId: number;

afterAll(async () => {
  await prisma.coachTier2Evaluation.deleteMany({});
  await prisma.headCoachEvaluation.deleteMany({});
  await prisma.coachTutorAssignment.deleteMany({});
  await prisma.coach.deleteMany({ where: { name: { startsWith: 'Test Coach' } } });
  if (roundId) await prisma.coachHiringRound.delete({ where: { id: roundId } }).catch(() => null);
  await prisma.$disconnect();
});

describe('CoachHiringRound 모델', () => {
  it('OPEN 상태로 채용 라운드를 생성할 수 있다', async () => {
    // createdById: 실제 DB에 존재하는 user id 1이 있다고 가정; 없으면 테스트 DB에 맞게 조정
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) throw new Error('테스트 user가 없습니다. DB를 확인하세요.');

    const round = await prisma.coachHiringRound.create({
      data: {
        targetRole: 'HEAD_COACH',
        fitScoreThreshold: 75,
        createdById: user.id,
      },
    });
    roundId = round.id;
    expect(round.status).toBe('OPEN');
    expect(round.targetRole).toBe('HEAD_COACH');
    expect(round.fitScoreThreshold).toBe(75);
  });

  it('라운드 상태를 CLOSED로 변경할 수 있다', async () => {
    const round = await prisma.coachHiringRound.update({
      where: { id: roundId },
      data: { status: 'CLOSED', result: '채용 완료' },
    });
    expect(round.status).toBe('CLOSED');
    expect(round.result).toBe('채용 완료');
  });
});

describe('Coach 모델 + 상태머신', () => {
  it('CANDIDATE 상태로 코치 후보를 등록할 수 있다', async () => {
    const coach = await prisma.coach.create({
      data: {
        name: 'Test Coach HEAD',
        coachingRole: 'HEAD_COACH',
        status: 'CANDIDATE',
        hiringRoundId: roundId,
      },
    });
    coachId = coach.id;
    expect(coach.status).toBe('CANDIDATE');
    expect(coach.isDeleted).toBe(false);
  });

  it('CANDIDATE → SHORTLISTED 전환이 가능하다', async () => {
    const coach = await prisma.coach.update({
      where: { id: coachId },
      data: { status: 'SHORTLISTED', shortlistSource: 'MANUAL' },
    });
    expect(coach.status).toBe('SHORTLISTED');
    expect(coach.shortlistSource).toBe('MANUAL');
  });

  it('SHORTLISTED → APPROVAL_PENDING 전환이 가능하다', async () => {
    const coach = await prisma.coach.update({
      where: { id: coachId },
      data: { status: 'APPROVAL_PENDING' },
    });
    expect(coach.status).toBe('APPROVAL_PENDING');
  });

  it('APPROVAL_PENDING → CONTRACTED 전환이 가능하다', async () => {
    const coach = await prisma.coach.update({
      where: { id: coachId },
      data: { status: 'CONTRACTED' },
    });
    expect(coach.status).toBe('CONTRACTED');
  });
});

describe('HeadCoachEvaluation', () => {
  it('Coach에 HeadCoachEvaluation을 upsert할 수 있다', async () => {
    const eval_ = await prisma.headCoachEvaluation.upsert({
      where: { coachId },
      create: { coachId, possession: 56.2, philosophyFitScore: 88.0 },
      update: { possession: 56.2, philosophyFitScore: 88.0 },
    });
    expect(eval_.possession).toBe(56.2);
    expect(eval_.philosophyFitScore).toBe(88.0);
  });
});

describe('CoachTier2Evaluation', () => {
  it('Tier2 Coach에 평가를 upsert할 수 있다', async () => {
    const tier2Coach = await prisma.coach.create({
      data: { name: 'Test Coach ASSISTANT', coachingRole: 'ASSISTANT_COACH', status: 'CANDIDATE' },
    });
    const eval_ = await prisma.coachTier2Evaluation.upsert({
      where: { coachId: tier2Coach.id },
      create: { coachId: tier2Coach.id, fitScore: 75, notes: '팀 적응 양호' },
      update: { fitScore: 75, notes: '팀 적응 양호' },
    });
    expect(eval_.fitScore).toBe(75);
    await prisma.coachTier2Evaluation.delete({ where: { coachId: tier2Coach.id } });
    await prisma.coach.delete({ where: { id: tier2Coach.id } });
  });
});

describe('CoachTutorAssignment', () => {
  it('외부 튜터를 배정할 수 있다', async () => {
    const tutor = await prisma.coachTutorAssignment.create({
      data: {
        coachId,
        type: 'EXTERNAL',
        externalName: '김통역사',
        externalContact: '010-0000-0000',
        sessionCount: 0,
      },
    });
    expect(tutor.type).toBe('EXTERNAL');
    expect(tutor.externalName).toBe('김통역사');
  });
});
```

- [x] **Step 2: 실패 확인 (파일만 작성, 아직 API 서버 불필요 - 직접 DB 테스트)**

```bash
cd /Users/juno/work/football/apps/api && npx jest __test__/coach/coach.hiring.test.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS (DB 통합 테스트, schema 검증)

- [x] **Step 3: commit**

```bash
cd /Users/juno/work/football
git add apps/api/__test__/coach/coach.hiring.test.ts
git commit -m "test(coach): add coach hiring integration tests"
```

---

## Task 7: FE 타입 + API 서비스

**Files:**
- Create: `football/src/types/coach.ts`
- Create: `football/src/services/coach.service.ts`

- [x] **Step 1: types/coach.ts 작성**

```typescript
export type CoachingRole =
  | 'HEAD_COACH'
  | 'ASSISTANT_COACH'
  | 'DEFENSIVE_COACH'
  | 'ATTACKING_COACH'
  | 'GOALKEEPER_COACH'
  | 'PHYSICAL_COACH'
  | 'SET_PIECE_COACH'

export type CoachStatus =
  | 'CANDIDATE'
  | 'SHORTLISTED'
  | 'APPROVAL_PENDING'
  | 'CONTRACTED'
  | 'RETIRED'
  | 'ARCHIVED'

export type HiringRoundStatus = 'OPEN' | 'CLOSED' | 'CANCELLED'
export type ShortlistSource = 'SYSTEM' | 'MANUAL'
export type TutorType = 'INTERNAL' | 'EXTERNAL'
export type LanguageProficiency = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface CoachHiringRound {
  id: number
  targetRole: CoachingRole
  fitScoreThreshold: number
  status: HiringRoundStatus
  deadline: string | null
  budget: number | null
  notes: string | null
  result: string | null
  createdAt: string
  createdBy: { nickname: string }
  _count: { coaches: number }
}

export interface Coach {
  id: number
  name: string
  nationality: string | null
  coachingRole: CoachingRole
  status: CoachStatus
  shortlistSource: ShortlistSource | null
  notes: string | null
  isDeleted: boolean
  packageLeadId: number | null
  hiringRoundId: number | null
  userId: number | null
  createdAt: string
  updatedAt: string
  packageLead: { id: number; name: string } | null
  headCoachEval: HeadCoachEval | null
  defensiveCoachEval: DefensiveCoachEval | null
  attackingCoachEval: AttackingCoachEval | null
  goalkeeperCoachEval: GoalkeeperCoachEval | null
  tier2Eval: Tier2Eval | null
  tutorAssignments: TutorAssignment[]
}

export interface HeadCoachEval {
  id: number; coachId: number
  possession: number | null; pressingIntensity: number | null
  progressivePassAccuracy: number | null; teamActivity: number | null
  philosophyFitScore: number | null; dataSource: string | null; evaluatedAt: string | null
}

export interface DefensiveCoachEval {
  id: number; coachId: number
  tackleSuccessRate: number | null; clearances: number | null; blocks: number | null
  defensiveErrors: number | null; ballRecovery: number | null; pressingIntensity: number | null
  dataSource: string | null; evaluatedAt: string | null
}

export interface AttackingCoachEval {
  id: number; coachId: number
  xG: number | null; xA: number | null; chanceCreation: number | null
  dribbleSuccessRate: number | null; progressivePassAccuracy: number | null
  shotConversionRate: number | null; goalInvolvement: number | null
  dataSource: string | null; evaluatedAt: string | null
}

export interface GoalkeeperCoachEval {
  id: number; coachId: number
  psxG: number | null; xGConcededDiff: number | null; buildupPassAccuracy: number | null
  dataSource: string | null; evaluatedAt: string | null
}

export interface Tier2Eval {
  id: number; coachId: number
  fitScore: number | null; notes: string | null; evaluatedAt: string | null
}

export interface TutorAssignment {
  id: number; type: TutorType; sessionCount: number
  languageProficiency: LanguageProficiency | null; tacticalImplementationRate: number | null
  externalName: string | null; externalContact: string | null
  internalTutorId: number | null
  internalTutor: { nickname: string } | null
  createdAt: string; updatedAt: string
}

// ── CreateDTOs ───────────────────────────────────────────────────────────────

export interface CreateHiringRoundDto {
  targetRole: CoachingRole
  fitScoreThreshold?: number
  deadline?: string
  budget?: number
  notes?: string
}

export interface CreateCoachDto {
  name: string
  nationality?: string
  coachingRole: CoachingRole
  notes?: string
  hiringRoundId?: number
  packageLeadId?: number
}

export interface CreateTutorDto {
  type: TutorType
  internalTutorId?: number
  externalName?: string
  externalContact?: string
  sessionCount?: number
  languageProficiency?: LanguageProficiency
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const COACHING_ROLE_LABEL: Record<CoachingRole, string> = {
  HEAD_COACH: '감독',
  ASSISTANT_COACH: '수석 코치',
  DEFENSIVE_COACH: '수비 코치',
  ATTACKING_COACH: '공격 코치',
  GOALKEEPER_COACH: 'GK 코치',
  PHYSICAL_COACH: '피지컬 코치',
  SET_PIECE_COACH: '세트피스 코치',
}

export const COACH_STATUS_LABEL: Record<CoachStatus, string> = {
  CANDIDATE: '후보',
  SHORTLISTED: '숏리스트',
  APPROVAL_PENDING: '승인 대기',
  CONTRACTED: '채용 완료',
  RETIRED: '퇴임',
  ARCHIVED: '탈락',
}

export const COACH_STATUS_STYLE: Record<CoachStatus, string> = {
  CANDIDATE: 'bg-gray-100 text-gray-700 border-gray-200',
  SHORTLISTED: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVAL_PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  CONTRACTED: 'bg-green-100 text-green-700 border-green-200',
  RETIRED: 'bg-purple-100 text-purple-700 border-purple-200',
  ARCHIVED: 'bg-red-100 text-red-500 border-red-200',
}

export const ROUND_STATUS_LABEL: Record<HiringRoundStatus, string> = {
  OPEN: '진행 중',
  CLOSED: '완료',
  CANCELLED: '취소',
}

export const LANGUAGE_LABEL: Record<LanguageProficiency, string> = {
  A1: 'A1 (입문)', A2: 'A2 (초급)', B1: 'B1 (중급)',
  B2: 'B2 (상급)', C1: 'C1 (고급)', C2: 'C2 (원어민급)',
}

export const SHORTLIST_SOURCE_LABEL: Record<ShortlistSource, string> = {
  SYSTEM: '자동(시스템)',
  MANUAL: '수동(GM/TD)',
}

export const TIER1_ROLES: CoachingRole[] = [
  'HEAD_COACH', 'DEFENSIVE_COACH', 'ATTACKING_COACH', 'GOALKEEPER_COACH',
]
```

- [x] **Step 2: services/coach.service.ts 작성**

```typescript
import { api } from './api'
import type {
  CoachHiringRound, Coach, TutorAssignment,
  CreateHiringRoundDto, CreateCoachDto, CreateTutorDto,
  CoachStatus, HiringRoundStatus, ShortlistSource,
} from '@/types/coach'

export const coachApi = {
  // HiringRound
  listRounds: () => api.get<CoachHiringRound[]>('/coaches/rounds'),
  createRound: (dto: CreateHiringRoundDto) => api.post<CoachHiringRound>('/coaches/rounds', dto),
  updateRoundStatus: (id: number, status: HiringRoundStatus, result?: string) =>
    api.patch<CoachHiringRound>(`/coaches/rounds/${id}/status`, { status, result }),

  // Coach
  list: (params?: { roundId?: number; status?: CoachStatus }) => {
    const qs = new URLSearchParams()
    if (params?.roundId !== undefined) qs.set('roundId', String(params.roundId))
    if (params?.status) qs.set('status', params.status)
    const q = qs.toString()
    return api.get<Coach[]>(`/coaches${q ? `?${q}` : ''}`)
  },
  create: (dto: CreateCoachDto) => api.post<Coach>('/coaches', dto),
  getById: (id: number) => api.get<Coach>(`/coaches/${id}`),
  update: (id: number, dto: Partial<CreateCoachDto>) => api.patch<Coach>(`/coaches/${id}`, dto),
  updateStatus: (id: number, status: CoachStatus, shortlistSource?: ShortlistSource) =>
    api.patch<Coach>(`/coaches/${id}/status`, { status, ...(shortlistSource && { shortlistSource }) }),

  // Evaluation (generic — dto shape depends on role)
  upsertEvaluation: (coachId: number, dto: Record<string, unknown>) =>
    api.put<unknown>(`/coaches/${coachId}/evaluation`, dto),

  // TutorAssignment
  listTutors: (coachId: number) => api.get<TutorAssignment[]>(`/coaches/${coachId}/tutors`),
  createTutor: (coachId: number, dto: CreateTutorDto) =>
    api.post<TutorAssignment>(`/coaches/${coachId}/tutors`, dto),
  updateTutor: (coachId: number, tutorId: number, dto: Record<string, unknown>) =>
    api.patch<TutorAssignment>(`/coaches/${coachId}/tutors/${tutorId}`, dto),
}
```

- [x] **Step 3: tsc 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [x] **Step 4: commit**

```bash
cd /Users/juno/work/football
git add football/src/types/coach.ts football/src/services/coach.service.ts
git commit -m "feat(coach): add FE types and coach API service"
```

---

## Task 8: FE HiringRoundsPage

**Files:**
- Create: `football/src/pages/coaches/HiringRoundsPage.tsx`

- [x] **Step 1: HiringRoundsPage 작성**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { coachApi } from '@/services/coach.service'
import type { CoachHiringRound, CoachingRole, HiringRoundStatus } from '@/types/coach'
import { COACHING_ROLE_LABEL, ROUND_STATUS_LABEL } from '@/types/coach'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'

const ALL_ROLES: CoachingRole[] = [
  'HEAD_COACH', 'ASSISTANT_COACH', 'DEFENSIVE_COACH',
  'ATTACKING_COACH', 'GOALKEEPER_COACH', 'PHYSICAL_COACH', 'SET_PIECE_COACH',
]

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface CreateRoundDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateRoundDialog({ open, onOpenChange, onSaved }: CreateRoundDialogProps) {
  const [targetRole, setTargetRole] = useState<CoachingRole | ''>('')
  const [threshold, setThreshold] = useState('70')
  const [deadline, setDeadline] = useState('')
  const [budget, setBudget] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!targetRole) { toast.error('채용 대상 역할을 선택해주세요.'); return }
    setSaving(true)
    try {
      await coachApi.createRound({
        targetRole,
        fitScoreThreshold: Number(threshold) || 70,
        ...(deadline && { deadline }),
        ...(budget && { budget: Number(budget) }),
        ...(notes.trim() && { notes: notes.trim() }),
      })
      toast.success('채용 라운드가 개설됐습니다.')
      setTargetRole(''); setThreshold('70'); setDeadline(''); setBudget(''); setNotes('')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>채용 라운드 개설</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>채용 대상 역할 *</Label>
            <Select value={targetRole} onValueChange={(v) => setTargetRole(v as CoachingRole)}>
              <SelectTrigger><SelectValue placeholder="역할 선택" /></SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{COACHING_ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>자동 숏리스트 임계값 (fitScore)</Label>
            <Input type="number" min="0" max="100" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>마감일</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>예산 (원)</Label>
            <Input type="number" placeholder="예: 300000000" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '개설'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function HiringRoundsPage() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [rounds, setRounds] = useState<CoachHiringRound[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const isGM = user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'GM'
  const canRead =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD'))

  const fetchRounds = () => {
    setLoading(true)
    coachApi.listRounds()
      .then(setRounds)
      .catch(() => toast.error('채용 라운드를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { void fetchRounds() }, [])

  const handleClose = async (round: CoachHiringRound, status: HiringRoundStatus) => {
    try {
      await coachApi.updateRoundStatus(round.id, status)
      toast.success(status === 'CLOSED' ? '라운드가 종료됐습니다.' : '라운드가 취소됐습니다.')
      fetchRounds()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        접근 권한이 없습니다.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">코치 채용 라운드</h1>
          <p className="text-sm text-muted-foreground mt-0.5">GM이 개설하는 채용 단위</p>
        </div>
        {isGM && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />라운드 개설
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : rounds.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            개설된 채용 라운드가 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>대상 역할</TableHead>
                <TableHead className="w-20">임계값</TableHead>
                <TableHead className="w-28">상태</TableHead>
                <TableHead className="w-24">후보 수</TableHead>
                <TableHead className="w-28">마감일</TableHead>
                <TableHead className="w-28 text-muted-foreground">개설일</TableHead>
                <TableHead className="w-20 text-muted-foreground">개설자</TableHead>
                {isGM && <TableHead className="w-36" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/coaches?roundId=${r.id}`)}
                >
                  <TableCell className="font-medium">{COACHING_ROLE_LABEL[r.targetRole]}</TableCell>
                  <TableCell className="font-mono text-sm">{r.fitScoreThreshold}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${
                      r.status === 'OPEN' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      r.status === 'CLOSED' ? 'bg-green-100 text-green-700 border-green-200' :
                      'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {ROUND_STATUS_LABEL[r.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{r._count.coaches}명</TableCell>
                  <TableCell className="text-sm">{formatDate(r.deadline)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.createdBy.nickname}
                  </TableCell>
                  {isGM && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {r.status === 'OPEN' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => handleClose(r, 'CLOSED')}>종료</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleClose(r, 'CANCELLED')}>취소</Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateRoundDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchRounds() }}
      />
    </div>
  )
}
```

- [x] **Step 2: tsc 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [x] **Step 3: commit**

```bash
cd /Users/juno/work/football
git add football/src/pages/coaches/HiringRoundsPage.tsx
git commit -m "feat(coach): add HiringRoundsPage"
```

---

## Task 9: FE CoachListPage

**Files:**
- Create: `football/src/pages/coaches/CoachListPage.tsx`

- [x] **Step 1: CoachListPage 작성**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { coachApi } from '@/services/coach.service'
import type { Coach, CoachingRole, CoachStatus } from '@/types/coach'
import {
  COACHING_ROLE_LABEL, COACH_STATUS_LABEL, COACH_STATUS_STYLE,
  SHORTLIST_SOURCE_LABEL,
} from '@/types/coach'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Plus } from 'lucide-react'

const ALL_ROLES: CoachingRole[] = [
  'HEAD_COACH', 'ASSISTANT_COACH', 'DEFENSIVE_COACH',
  'ATTACKING_COACH', 'GOALKEEPER_COACH', 'PHYSICAL_COACH', 'SET_PIECE_COACH',
]
const ALL_STATUSES: (CoachStatus | 'ALL')[] = [
  'ALL', 'CANDIDATE', 'SHORTLISTED', 'APPROVAL_PENDING', 'CONTRACTED', 'RETIRED', 'ARCHIVED',
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface CreateCoachDialogProps {
  roundId: number | undefined
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateCoachDialog({ roundId, open, onOpenChange, onSaved }: CreateCoachDialogProps) {
  const [name, setName] = useState('')
  const [nationality, setNationality] = useState('')
  const [coachingRole, setCoachingRole] = useState<CoachingRole | ''>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('이름을 입력해주세요.'); return }
    if (!coachingRole) { toast.error('역할을 선택해주세요.'); return }
    setSaving(true)
    try {
      await coachApi.create({
        name: name.trim(),
        coachingRole,
        ...(nationality.trim() && { nationality: nationality.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
        ...(roundId !== undefined && { hiringRoundId: roundId }),
      })
      toast.success('코치 후보가 등록됐습니다.')
      setName(''); setNationality(''); setCoachingRole(''); setNotes('')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>코치 후보 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이름 *</Label>
            <Input placeholder="코치 이름" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>역할 *</Label>
            <Select value={coachingRole} onValueChange={(v) => setCoachingRole(v as CoachingRole)}>
              <SelectTrigger><SelectValue placeholder="역할 선택" /></SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{COACHING_ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>국적</Label>
            <Input placeholder="예: 스페인" value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CoachListPage() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roundId = searchParams.get('roundId') ? Number(searchParams.get('roundId')) : undefined

  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<CoachStatus | 'ALL'>('ALL')
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite =
    user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD')
  const isGM = user?.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'GM'
  const canRead =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD'))

  const fetchCoaches = () => {
    setLoading(true)
    coachApi.list({
      ...(roundId !== undefined && { roundId }),
      ...(statusFilter !== 'ALL' && { status: statusFilter }),
    })
      .then(setCoaches)
      .catch(() => toast.error('코치 후보 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { void fetchCoaches() }, [roundId, statusFilter])

  const handleTransition = async (coach: Coach, status: CoachStatus) => {
    try {
      // SHORTLISTED 수동 전환 시 shortlistSource=MANUAL 포함
      const shortlistSource = status === 'SHORTLISTED' ? 'MANUAL' as const : undefined
      await coachApi.updateStatus(coach.id, status, shortlistSource)
      toast.success(`'${COACH_STATUS_LABEL[status]}'로 변경됐습니다.`)
      void fetchCoaches()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '변경에 실패했습니다.')
    }
  }

  const renderActions = (coach: Coach) => {
    if (!canWrite && !isGM) return null
    switch (coach.status) {
      case 'CANDIDATE':
        return canWrite ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'SHORTLISTED') }}>
              숏리스트
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'ARCHIVED') }}>
              탈락
            </Button>
          </div>
        ) : null
      case 'SHORTLISTED':
        return canWrite ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'APPROVAL_PENDING') }}>
              승인 요청
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'ARCHIVED') }}>
              탈락
            </Button>
          </div>
        ) : null
      case 'APPROVAL_PENDING':
        return (
          <div className="flex gap-1">
            {isGM && (
              <Button size="sm" className="h-7 text-xs"
                onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'CONTRACTED') }}>
                최종 승인
              </Button>
            )}
            {canWrite && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); void handleTransition(coach, 'ARCHIVED') }}>
                탈락
              </Button>
            )}
          </div>
        )
      default:
        return null
    }
  }

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        접근 권한이 없습니다.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate('/coaches/rounds')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">코치 후보</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {roundId ? `라운드 #${roundId}` : '전체 후보'}
            </p>
          </div>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />후보 등록
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CoachStatus | 'ALL')}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === 'ALL' ? '전체' : COACH_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : coaches.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            등록된 코치 후보가 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>이름</TableHead>
                <TableHead className="w-28">역할</TableHead>
                <TableHead className="w-20">국적</TableHead>
                <TableHead className="w-28">상태</TableHead>
                <TableHead className="w-32">숏리스트 경위</TableHead>
                <TableHead className="w-28 text-muted-foreground">등록일</TableHead>
                {(canWrite || isGM) && <TableHead className="w-44" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/coaches/${c.id}`)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{COACHING_ROLE_LABEL[c.coachingRole]}</TableCell>
                  <TableCell className="text-sm">{c.nationality ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${COACH_STATUS_STYLE[c.status]}`}>
                      {COACH_STATUS_LABEL[c.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.shortlistSource ? SHORTLIST_SOURCE_LABEL[c.shortlistSource] : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  {(canWrite || isGM) && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {renderActions(c)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateCoachDialog
        roundId={roundId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchCoaches() }}
      />
    </div>
  )
}
```

- [x] **Step 2: tsc 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [x] **Step 3: commit**

```bash
cd /Users/juno/work/football
git add football/src/pages/coaches/CoachListPage.tsx
git commit -m "feat(coach): add CoachListPage with status transitions"
```

---

## Task 10: FE CoachDetailPage

**Files:**
- Create: `football/src/pages/coaches/CoachDetailPage.tsx`

- [x] **Step 1: CoachDetailPage 작성**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { coachApi } from '@/services/coach.service'
import type {
  Coach, TutorAssignment, TutorType, LanguageProficiency,
  HeadCoachEval, DefensiveCoachEval, AttackingCoachEval,
  GoalkeeperCoachEval, Tier2Eval,
} from '@/types/coach'
import {
  COACHING_ROLE_LABEL, COACH_STATUS_LABEL, COACH_STATUS_STYLE,
  LANGUAGE_LABEL, TIER1_ROLES,
} from '@/types/coach'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Plus } from 'lucide-react'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function NumericField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number" step="0.01"
        className="h-8 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// ─── Evaluation Section ──────────────────────────────────────────────────────

interface EvalSectionProps {
  coach: Coach
  canWrite: boolean
  onSaved: () => void
}

function EvaluationSection({ coach, canWrite, onSaved }: EvalSectionProps) {
  const isTier1 = (TIER1_ROLES as string[]).includes(coach.coachingRole)

  // HEAD_COACH
  const [hcPossession, setHcPossession] = useState(String(coach.headCoachEval?.possession ?? ''))
  const [hcPressing, setHcPressing] = useState(String(coach.headCoachEval?.pressingIntensity ?? ''))
  const [hcPassAcc, setHcPassAcc] = useState(String(coach.headCoachEval?.progressivePassAccuracy ?? ''))
  const [hcActivity, setHcActivity] = useState(String(coach.headCoachEval?.teamActivity ?? ''))
  const [hcPhilosophy, setHcPhilosophy] = useState(String(coach.headCoachEval?.philosophyFitScore ?? ''))
  const [hcSource, setHcSource] = useState(coach.headCoachEval?.dataSource ?? '')

  // DEFENSIVE_COACH
  const [dcTackle, setDcTackle] = useState(String(coach.defensiveCoachEval?.tackleSuccessRate ?? ''))
  const [dcClear, setDcClear] = useState(String(coach.defensiveCoachEval?.clearances ?? ''))
  const [dcBlocks, setDcBlocks] = useState(String(coach.defensiveCoachEval?.blocks ?? ''))
  const [dcErrors, setDcErrors] = useState(String(coach.defensiveCoachEval?.defensiveErrors ?? ''))
  const [dcRecovery, setDcRecovery] = useState(String(coach.defensiveCoachEval?.ballRecovery ?? ''))
  const [dcPressing, setDcPressing] = useState(String(coach.defensiveCoachEval?.pressingIntensity ?? ''))
  const [dcSource, setDcSource] = useState(coach.defensiveCoachEval?.dataSource ?? '')

  // ATTACKING_COACH
  const [acXG, setAcXG] = useState(String(coach.attackingCoachEval?.xG ?? ''))
  const [acXA, setAcXA] = useState(String(coach.attackingCoachEval?.xA ?? ''))
  const [acChance, setAcChance] = useState(String(coach.attackingCoachEval?.chanceCreation ?? ''))
  const [acDribble, setAcDribble] = useState(String(coach.attackingCoachEval?.dribbleSuccessRate ?? ''))
  const [acPassAcc, setAcPassAcc] = useState(String(coach.attackingCoachEval?.progressivePassAccuracy ?? ''))
  const [acShot, setAcShot] = useState(String(coach.attackingCoachEval?.shotConversionRate ?? ''))
  const [acGoalInv, setAcGoalInv] = useState(String(coach.attackingCoachEval?.goalInvolvement ?? ''))
  const [acSource, setAcSource] = useState(coach.attackingCoachEval?.dataSource ?? '')

  // GOALKEEPER_COACH
  const [gkPsxG, setGkPsxG] = useState(String(coach.goalkeeperCoachEval?.psxG ?? ''))
  const [gkDiff, setGkDiff] = useState(String(coach.goalkeeperCoachEval?.xGConcededDiff ?? ''))
  const [gkPass, setGkPass] = useState(String(coach.goalkeeperCoachEval?.buildupPassAccuracy ?? ''))
  const [gkSource, setGkSource] = useState(coach.goalkeeperCoachEval?.dataSource ?? '')

  // Tier2
  const [t2Score, setT2Score] = useState(String(coach.tier2Eval?.fitScore ?? ''))
  const [t2Notes, setT2Notes] = useState(coach.tier2Eval?.notes ?? '')

  const [saving, setSaving] = useState(false)

  const buildDto = (): Record<string, unknown> => {
    if (coach.coachingRole === 'HEAD_COACH') {
      return {
        ...(hcPossession && { possession: Number(hcPossession) }),
        ...(hcPressing && { pressingIntensity: Number(hcPressing) }),
        ...(hcPassAcc && { progressivePassAccuracy: Number(hcPassAcc) }),
        ...(hcActivity && { teamActivity: Number(hcActivity) }),
        ...(hcPhilosophy && { philosophyFitScore: Number(hcPhilosophy) }),
        ...(hcSource.trim() && { dataSource: hcSource.trim() }),
      }
    }
    if (coach.coachingRole === 'DEFENSIVE_COACH') {
      return {
        ...(dcTackle && { tackleSuccessRate: Number(dcTackle) }),
        ...(dcClear && { clearances: Number(dcClear) }),
        ...(dcBlocks && { blocks: Number(dcBlocks) }),
        ...(dcErrors && { defensiveErrors: Number(dcErrors) }),
        ...(dcRecovery && { ballRecovery: Number(dcRecovery) }),
        ...(dcPressing && { pressingIntensity: Number(dcPressing) }),
        ...(dcSource.trim() && { dataSource: dcSource.trim() }),
      }
    }
    if (coach.coachingRole === 'ATTACKING_COACH') {
      return {
        ...(acXG && { xG: Number(acXG) }),
        ...(acXA && { xA: Number(acXA) }),
        ...(acChance && { chanceCreation: Number(acChance) }),
        ...(acDribble && { dribbleSuccessRate: Number(acDribble) }),
        ...(acPassAcc && { progressivePassAccuracy: Number(acPassAcc) }),
        ...(acShot && { shotConversionRate: Number(acShot) }),
        ...(acGoalInv && { goalInvolvement: Number(acGoalInv) }),
        ...(acSource.trim() && { dataSource: acSource.trim() }),
      }
    }
    if (coach.coachingRole === 'GOALKEEPER_COACH') {
      return {
        ...(gkPsxG && { psxG: Number(gkPsxG) }),
        ...(gkDiff && { xGConcededDiff: Number(gkDiff) }),
        ...(gkPass && { buildupPassAccuracy: Number(gkPass) }),
        ...(gkSource.trim() && { dataSource: gkSource.trim() }),
      }
    }
    // Tier2
    return {
      ...(t2Score && { fitScore: Number(t2Score) }),
      ...(t2Notes.trim() && { notes: t2Notes.trim() }),
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await coachApi.upsertEvaluation(coach.id, buildDto())
      toast.success('평가 데이터가 저장됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">평가 데이터</h2>
        {canWrite && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        )}
      </div>

      {coach.coachingRole === 'HEAD_COACH' && (
        <div className="grid grid-cols-2 gap-3">
          <NumericField label="점유율 (%)" value={hcPossession} onChange={setHcPossession} />
          <NumericField label="압박 강도" value={hcPressing} onChange={setHcPressing} />
          <NumericField label="전진패스 성공률 (%)" value={hcPassAcc} onChange={setHcPassAcc} />
          <NumericField label="활동량" value={hcActivity} onChange={setHcActivity} />
          <NumericField label="철학 부합도 (0–100)" value={hcPhilosophy} onChange={setHcPhilosophy} />
          <div className="space-y-1.5">
            <Label className="text-xs">데이터 출처</Label>
            <Input className="h-8 text-sm" value={hcSource} onChange={(e) => setHcSource(e.target.value)} />
          </div>
        </div>
      )}

      {coach.coachingRole === 'DEFENSIVE_COACH' && (
        <div className="grid grid-cols-2 gap-3">
          <NumericField label="태클 성공률 (%)" value={dcTackle} onChange={setDcTackle} />
          <NumericField label="클리어" value={dcClear} onChange={setDcClear} />
          <NumericField label="블록" value={dcBlocks} onChange={setDcBlocks} />
          <NumericField label="수비 실책" value={dcErrors} onChange={setDcErrors} />
          <NumericField label="볼 리커버리" value={dcRecovery} onChange={setDcRecovery} />
          <NumericField label="압박 강도" value={dcPressing} onChange={setDcPressing} />
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">데이터 출처</Label>
            <Input className="h-8 text-sm" value={dcSource} onChange={(e) => setDcSource(e.target.value)} />
          </div>
        </div>
      )}

      {coach.coachingRole === 'ATTACKING_COACH' && (
        <div className="grid grid-cols-2 gap-3">
          <NumericField label="xG" value={acXG} onChange={setAcXG} />
          <NumericField label="xA" value={acXA} onChange={setAcXA} />
          <NumericField label="찬스 메이킹" value={acChance} onChange={setAcChance} />
          <NumericField label="드리블 성공률 (%)" value={acDribble} onChange={setAcDribble} />
          <NumericField label="전진패스 성공률 (%)" value={acPassAcc} onChange={setAcPassAcc} />
          <NumericField label="샷 전환율 (%)" value={acShot} onChange={setAcShot} />
          <NumericField label="득점 관여율 (%)" value={acGoalInv} onChange={setAcGoalInv} />
          <div className="space-y-1.5">
            <Label className="text-xs">데이터 출처</Label>
            <Input className="h-8 text-sm" value={acSource} onChange={(e) => setAcSource(e.target.value)} />
          </div>
        </div>
      )}

      {coach.coachingRole === 'GOALKEEPER_COACH' && (
        <div className="grid grid-cols-2 gap-3">
          <NumericField label="PSxG" value={gkPsxG} onChange={setGkPsxG} />
          <NumericField label="xG 대비 실점 차" value={gkDiff} onChange={setGkDiff} />
          <NumericField label="빌드업 패스 성공률 (%)" value={gkPass} onChange={setGkPass} />
          <div className="space-y-1.5">
            <Label className="text-xs">데이터 출처</Label>
            <Input className="h-8 text-sm" value={gkSource} onChange={(e) => setGkSource(e.target.value)} />
          </div>
        </div>
      )}

      {!isTier1 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">fitScore (0–100)</Label>
            <Input type="number" className="h-8 text-sm" value={t2Score} onChange={(e) => setT2Score(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">메모</Label>
            <Textarea rows={2} className="text-sm" value={t2Notes} onChange={(e) => setT2Notes(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tutor Section ───────────────────────────────────────────────────────────

interface TutorSectionProps {
  coachId: number
  tutors: TutorAssignment[]
  canWrite: boolean
  onSaved: () => void
}

function TutorSection({ coachId, tutors, canWrite, onSaved }: TutorSectionProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [type, setType] = useState<TutorType>('EXTERNAL')
  const [externalName, setExternalName] = useState('')
  const [externalContact, setExternalContact] = useState('')
  const [language, setLanguage] = useState<LanguageProficiency | ''>('')
  const [saving, setSaving] = useState(false)

  const LANGS: LanguageProficiency[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

  const handleAdd = async () => {
    if (type === 'EXTERNAL' && !externalName.trim()) {
      toast.error('외부 튜터 이름을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await coachApi.createTutor(coachId, {
        type,
        ...(type === 'EXTERNAL' && externalName.trim() && { externalName: externalName.trim() }),
        ...(type === 'EXTERNAL' && externalContact.trim() && { externalContact: externalContact.trim() }),
        ...(language && { languageProficiency: language }),
      })
      toast.success('튜터가 배정됐습니다.')
      setType('EXTERNAL'); setExternalName(''); setExternalContact(''); setLanguage('')
      setAddOpen(false)
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSession = async (tutor: TutorAssignment, delta: number) => {
    try {
      await coachApi.updateTutor(coachId, tutor.id, { sessionCount: tutor.sessionCount + delta })
      onSaved()
    } catch {
      toast.error('세션 수 변경에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">튜터 배정</h2>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />튜터 추가
          </Button>
        )}
      </div>

      {tutors.length === 0 ? (
        <p className="text-sm text-muted-foreground">배정된 튜터가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {tutors.map((t) => (
            <div key={t.id} className="rounded border px-3 py-2 text-sm flex items-center justify-between gap-2">
              <div>
                <span className="font-medium">
                  {t.type === 'INTERNAL' ? t.internalTutor?.nickname ?? '—' : t.externalName}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t.type === 'EXTERNAL' ? '외부' : '내부'}
                  {t.languageProficiency && ` · ${LANGUAGE_LABEL[t.languageProficiency]}`}
                  {t.tacticalImplementationRate !== null && ` · 전술이행률 ${t.tacticalImplementationRate}%`}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canWrite && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                    onClick={() => void handleUpdateSession(t, -1)}
                    disabled={t.sessionCount <= 0}>−</Button>
                )}
                <span className="text-xs tabular-nums w-12 text-center">
                  {t.sessionCount}세션
                </span>
                {canWrite && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                    onClick={() => void handleUpdateSession(t, 1)}>+</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>튜터 배정</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>유형</Label>
              <Select value={type} onValueChange={(v) => setType(v as TutorType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXTERNAL">외부 전문가</SelectItem>
                  <SelectItem value="INTERNAL">내부 코칭스태프</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === 'EXTERNAL' && (
              <>
                <div className="space-y-1.5">
                  <Label>이름 *</Label>
                  <Input value={externalName} onChange={(e) => setExternalName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>연락처</Label>
                  <Input placeholder="010-0000-0000" value={externalContact} onChange={(e) => setExternalContact(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>언어 숙련도 (CEFR)</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as LanguageProficiency)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => <SelectItem key={l} value={l}>{LANGUAGE_LABEL[l]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>취소</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? '저장 중...' : '배정'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── CoachDetailPage ─────────────────────────────────────────────────────────

export function CoachDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [coach, setCoach] = useState<Coach | null>(null)
  const [loading, setLoading] = useState(true)

  const canWrite =
    user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD')
  const canRead =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && (user.frontOfficeRole === 'GM' || user.frontOfficeRole === 'TD'))

  const fetchCoach = () => {
    if (!id) return
    setLoading(true)
    coachApi.getById(Number(id))
      .then(setCoach)
      .catch(() => toast.error('코치 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { void fetchCoach() }, [id])

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        접근 권한이 없습니다.
      </div>
    )
  }

  if (loading || !coach) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const backUrl = coach.hiringRoundId ? `/coaches?roundId=${coach.hiringRoundId}` : '/coaches'

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate(backUrl)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{coach.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {COACHING_ROLE_LABEL[coach.coachingRole]}
            {coach.nationality && ` · ${coach.nationality}`}
          </p>
        </div>
        <span className={`ml-auto inline-flex items-center rounded border px-2 py-0.5 text-xs ${COACH_STATUS_STYLE[coach.status]}`}>
          {COACH_STATUS_LABEL[coach.status]}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* 기본 정보 */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">기본 정보</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">역할</span>
              <span>{COACHING_ROLE_LABEL[coach.coachingRole]}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">국적</span>
              <span>{coach.nationality ?? '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">채용 라운드</span>
              <span>{coach.hiringRoundId ? `#${coach.hiringRoundId}` : '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">패키지 리드</span>
              <span>{coach.packageLead ? coach.packageLead.name : '—'}</span>
            </div>
            {coach.notes && (
              <div className="flex gap-2 col-span-2">
                <span className="text-muted-foreground w-20 shrink-0">메모</span>
                <span className="text-sm">{coach.notes}</span>
              </div>
            )}
          </div>
        </div>

        <hr />

        {/* 평가 데이터 */}
        <EvaluationSection coach={coach} canWrite={canWrite} onSaved={fetchCoach} />

        <hr />

        {/* 튜터 배정 */}
        <TutorSection
          coachId={coach.id}
          tutors={coach.tutorAssignments}
          canWrite={canWrite}
          onSaved={fetchCoach}
        />
      </div>
    </div>
  )
}
```

- [x] **Step 2: tsc 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [x] **Step 3: commit**

```bash
cd /Users/juno/work/football
git add football/src/pages/coaches/CoachDetailPage.tsx
git commit -m "feat(coach): add CoachDetailPage with evaluation and tutor sections"
```

---

## Task 11: FE App.tsx 라우트 + AppShell.tsx 네비게이션

**Files:**
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [x] **Step 1: App.tsx — import 3개 추가**

기존 `import { MedicalExpensesPage }` 줄 아래에 삽입:

```typescript
import { HiringRoundsPage } from '@/pages/coaches/HiringRoundsPage'
import { CoachListPage } from '@/pages/coaches/CoachListPage'
import { CoachDetailPage } from '@/pages/coaches/CoachDetailPage'
```

- [x] **Step 2: App.tsx — Route 3개 추가**

`<Route path="/admin/users" element={<UsersPage />} />` 줄 바로 위에 삽입:

```tsx
<Route path="/coaches/rounds" element={<HiringRoundsPage />} />
<Route path="/coaches" element={<CoachListPage />} />
<Route path="/coaches/:id" element={<CoachDetailPage />} />
```

- [x] **Step 3: AppShell.tsx — Briefcase import 추가**

기존 lucide-react import 목록에 `Briefcase` 추가:

```typescript
import {
  Activity,
  BarChart3,
  Briefcase,  // ← 추가
  Building2,
  // ... 기존 항목들
} from 'lucide-react'
```

- [x] **Step 4: AppShell.tsx — NAV_ITEMS에 항목 추가**

`// 계약·영입` 섹션의 마지막 항목(`/transfers`) 뒤에 삽입:

```typescript
{
  to: '/coaches/rounds',
  label: '코치 채용',
  icon: Briefcase,
  section: '계약·영입',
  roles: ['ADMIN', 'FRONT_OFFICE'],
  frontOfficeRoles: ['GM', 'TD'],
},
```

- [x] **Step 5: tsc 체크**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [x] **Step 6: commit**

```bash
cd /Users/juno/work/football
git add football/src/App.tsx football/src/layouts/AppShell.tsx
git commit -m "feat(coach): add coach hiring routes and nav entry"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] CoachHiringRound CRUD (list, create, close/cancel) — Task 3 + 5
- [x] Coach CRUD + 상태머신 전환 — Task 3 + 5
- [x] 역할별 평가 upsert (Tier1 4종 + Tier2) — Task 3 + 5
- [x] CoachTutorAssignment (INTERNAL/EXTERNAL) — Task 3 + 5
- [x] 알림 트리거 4종 — Task 1
- [x] 권한 규칙 (GM/TD write, GM-only contracted, ADMIN read) — Task 5
- [x] shortlistSource 추적 — Task 4, 9
- [x] FE HiringRoundsPage — Task 8
- [x] FE CoachListPage — Task 9
- [x] FE CoachDetailPage (eval + tutor) — Task 10
- [x] AppShell nav + App.tsx routes — Task 11

**Placeholder scan:** 없음 — 모든 스텝에 실제 코드 포함

**Type consistency:**
- `CoachingRole`, `CoachStatus`, `HiringRoundStatus` 열거형이 types/coach.ts에 정의되고 service/pages에서 임포트해 사용
- `COACHING_ROLE_LABEL`, `COACH_STATUS_LABEL`, `COACH_STATUS_STYLE` 레이블 상수 동일 파일에서 export
- `TIER1_ROLES` 상수 BE(repo.ts)와 FE(types/coach.ts) 각자 정의 (각자의 레이어에서 자급)
- `coachApi.upsertEvaluation` 파라미터 타입 `Record<string, unknown>` — 역할별 dto 타입을 개별 제네릭으로 쪼개지 않고 범용 처리, 일관성 유지
