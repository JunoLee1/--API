# 유소년 모듈 Plan 6: 성장 리포트 시스템 (Growth Metrics + Coach Evaluation + Parent Report)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코치가 유소년 선수를 4개 차원(태도/기본기/공간이해/신체발달)으로 월간 평가하고, 디지털 배지를 수여하며, 학부모에게 시각화 성장 리포트를 자동 발송하는 시스템을 구현한다.

**Architecture:** `GrowthEvaluation` 엔티티는 선수·코치·기간(year+month)을 키로 하는 월간 레코드로 4개 점수(1-5)와 차원별 텍스트 코멘트를 저장한다. `PlayerBadge` 엔티티는 훈련 세션별 코치 수여 배지를 기록한다. 평가 완료(`isPublished=true`) 시 `NotificationRepository.createForGuardian`으로 GUARDIAN에게 `GROWTH_REPORT_PUBLISHED` 알림을 발송한다. FE는 순수 SVG 레이더 차트로 4개 축을 시각화하고, 학부모 뷰(`/growth-reports/:playerId`)에서 전체 리포트를 조회한다.

**Tech Stack:** Prisma migration, Express BE, React FE, SVG radar chart (no external library)

**의존성:** Plan 1 완료 필요 (GUARDIAN role, Player.guardianId, NotificationRepository.createForGuardian)

---

## 파일 맵

### BE — 신규
- `apps/api/src/growth-report/dto/growth-report.dto.ts`
- `apps/api/src/growth-report/growth-report.repo.ts`
- `apps/api/src/growth-report/growth-report.service.ts`
- `apps/api/src/growth-report/growth-report.controller.ts`
- `apps/api/src/growth-report/growth-report.routes.ts`
- `apps/api/__test__/growth-report/growth-report.service.test.ts`

### BE — 수정
- `apps/api/prisma/schema.prisma` — GrowthEvaluation, PlayerBadge 모델, BadgeType enum, GROWTH_REPORT_PUBLISHED NotificationType 추가
- `apps/api/src/apiRouter.ts` — /growth-reports 등록

### FE — 신규
- `football/src/types/growth-report.ts`
- `football/src/services/growthReport.service.ts`
- `football/src/components/players/GrowthRadarChart.tsx`
- `football/src/pages/youth/GrowthReportPage.tsx`
- `football/src/pages/youth/GrowthEvaluationFormDialog.tsx`
- `football/src/pages/youth/BadgeAwardDialog.tsx`

### FE — 수정
- `football/src/pages/players/PlayerDetailPage.tsx` — 유소년 선수 탭에 성장 리포트 섹션 추가
- `football/src/App.tsx` — `/growth-reports/:playerId` 라우트 추가

---

## Task 1: Schema 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: BadgeType enum 추가**

`schema.prisma`에서 기존 enum 블록 끝에 추가:

```prisma
enum BadgeType {
  PASSION_KING
  SPACE_WIZARD
  BEST_PASSER
  TEAM_PLAYER
  MOST_IMPROVED
  DEFENSIVE_WALL
  GOAL_MACHINE
}
```

- [ ] **Step 2: NotificationType에 GROWTH_REPORT_PUBLISHED 추가**

기존 `enum NotificationType` 블록의 `INCIDENT_REPORT_SUBMITTED` 뒤에 추가:

```prisma
  GROWTH_REPORT_PUBLISHED
```

- [ ] **Step 3: GrowthEvaluation 모델 추가**

YouthRegistration 모델 뒤에 추가:

```prisma
model GrowthEvaluation {
  id                    Int      @id @default(autoincrement())
  playerId              String
  coachId               Int
  year                  Int
  month                 Int      // 1-12
  isPublished           Boolean  @default(false)
  publishedAt           DateTime?

  attitudeScore         Int      // 1-5
  attitudeComment       String   @db.Text
  fundamentalsScore     Int      // 1-5
  fundamentalsComment   String   @db.Text
  spatialScore          Int      // 1-5
  spatialComment        String   @db.Text
  physicalScore         Int      // 1-5
  physicalComment       String   @db.Text

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  player Player @relation(fields: [playerId], references: [id])
  coach  User   @relation("CoachEvaluations", fields: [coachId], references: [id])

  @@unique([playerId, year, month])
}
```

- [ ] **Step 4: PlayerBadge 모델 추가**

GrowthEvaluation 모델 뒤에 추가:

```prisma
model PlayerBadge {
  id        Int       @id @default(autoincrement())
  playerId  String
  coachId   Int
  sessionId Int?
  badgeType BadgeType
  awardedAt DateTime  @default(now())
  note      String?

  player  Player          @relation(fields: [playerId], references: [id])
  coach   User            @relation("CoachBadges", fields: [coachId], references: [id])
  session TrainingSession? @relation(fields: [sessionId], references: [id])
}
```

- [ ] **Step 5: 역관계 추가**

`model Player`에:
```prisma
  growthEvaluations  GrowthEvaluation[]
  badges             PlayerBadge[]
```

`model User`에:
```prisma
  coachEvaluations   GrowthEvaluation[]  @relation("CoachEvaluations")
  awardedBadges      PlayerBadge[]       @relation("CoachBadges")
```

`model TrainingSession`에:
```prisma
  playerBadges       PlayerBadge[]
```

- [ ] **Step 6: 마이그레이션 실행**

```bash
cd apps/api && npx prisma migrate dev --name add-growth-evaluation-badge
```

shadow DB 충돌 시 대안:
```bash
npx prisma db push
TIMESTAMP=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TIMESTAMP}_add_growth_evaluation_badge
echo "-- Migration applied via db push" > prisma/migrations/${TIMESTAMP}_add_growth_evaluation_badge/migration.sql
npx prisma migrate resolve --applied ${TIMESTAMP}_add_growth_evaluation_badge
```

- [ ] **Step 7: Prisma generate**

```bash
npx prisma generate
```

- [ ] **Step 8: TypeScript 확인**

```bash
npx tsc --noEmit 2>&1 | grep -v "country.repo\|monthlyAttendance" | head -20
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(youth): GrowthEvaluation + PlayerBadge 스키마 추가"
```

---

## Task 2: GrowthEvaluation DTO + Repository

**Files:**
- Create: `apps/api/src/growth-report/dto/growth-report.dto.ts`
- Create: `apps/api/src/growth-report/growth-report.repo.ts`

- [ ] **Step 1: DTO 작성**

`apps/api/src/growth-report/dto/growth-report.dto.ts`:

```typescript
export interface CreateGrowthEvaluationDto {
  playerId: string;
  year: number;
  month: number;
  attitudeScore: number;
  attitudeComment: string;
  fundamentalsScore: number;
  fundamentalsComment: string;
  spatialScore: number;
  spatialComment: string;
  physicalScore: number;
  physicalComment: string;
}

export interface UpdateGrowthEvaluationDto {
  attitudeScore?: number;
  attitudeComment?: string;
  fundamentalsScore?: number;
  fundamentalsComment?: string;
  spatialScore?: number;
  spatialComment?: string;
  physicalScore?: number;
  physicalComment?: string;
}

export interface AwardBadgeDto {
  playerId: string;
  badgeType: string;
  sessionId?: number;
  note?: string;
}

export interface GrowthReportListQuery {
  playerId?: string;
  year?: number;
}

function validateScore(score: unknown, field: string): asserts score is number {
  if (typeof score !== 'number' || score < 1 || score > 5 || !Number.isInteger(score)) {
    throw Object.assign(new Error(`${field} must be integer 1-5`), { statusCode: 400, code: 'INVALID_SCORE' });
  }
}

export function parseCreateEvaluationDto(body: Record<string, unknown>): CreateGrowthEvaluationDto {
  const { playerId, year, month, attitudeScore, attitudeComment, fundamentalsScore, fundamentalsComment, spatialScore, spatialComment, physicalScore, physicalComment } = body;
  if (!playerId || typeof playerId !== 'string') throw Object.assign(new Error(), { statusCode: 400, code: 'INVALID_INPUT' });
  if (!year || !month) throw Object.assign(new Error(), { statusCode: 400, code: 'INVALID_INPUT' });
  validateScore(attitudeScore, 'attitudeScore');
  validateScore(fundamentalsScore, 'fundamentalsScore');
  validateScore(spatialScore, 'spatialScore');
  validateScore(physicalScore, 'physicalScore');
  return {
    playerId: playerId as string,
    year: Number(year),
    month: Number(month),
    attitudeScore: attitudeScore as number,
    attitudeComment: String(attitudeComment ?? ''),
    fundamentalsScore: fundamentalsScore as number,
    fundamentalsComment: String(fundamentalsComment ?? ''),
    spatialScore: spatialScore as number,
    spatialComment: String(spatialComment ?? ''),
    physicalScore: physicalScore as number,
    physicalComment: String(physicalComment ?? ''),
  };
}
```

- [ ] **Step 2: Repository 작성**

`apps/api/src/growth-report/growth-report.repo.ts`:

```typescript
import type { PrismaClient } from "../generated/client";
import type { CreateGrowthEvaluationDto, UpdateGrowthEvaluationDto, AwardBadgeDto, GrowthReportListQuery } from "./dto/growth-report.dto";

const EVAL_INCLUDE = {
  player: { select: { id: true, playerName: true, guardianId: true } },
  coach: { select: { id: true, username: true } },
} as const;

export class GrowthReportRepository {
  constructor(private prisma: PrismaClient) {}

  findEvaluations(query: GrowthReportListQuery) {
    return this.prisma.growthEvaluation.findMany({
      where: {
        ...(query.playerId && { playerId: query.playerId }),
        ...(query.year && { year: query.year }),
      },
      include: EVAL_INCLUDE,
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  findEvaluationById(id: number) {
    return this.prisma.growthEvaluation.findUnique({ where: { id }, include: EVAL_INCLUDE });
  }

  findEvaluationByPlayerMonth(playerId: string, year: number, month: number) {
    return this.prisma.growthEvaluation.findUnique({
      where: { playerId_year_month: { playerId, year, month } },
      include: EVAL_INCLUDE,
    });
  }

  createEvaluation(data: CreateGrowthEvaluationDto & { coachId: number }) {
    return this.prisma.growthEvaluation.create({ data, include: EVAL_INCLUDE });
  }

  updateEvaluation(id: number, data: UpdateGrowthEvaluationDto) {
    return this.prisma.growthEvaluation.update({ where: { id }, data, include: EVAL_INCLUDE });
  }

  publishEvaluation(id: number) {
    return this.prisma.growthEvaluation.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
      include: EVAL_INCLUDE,
    });
  }

  findBadgesByPlayer(playerId: string) {
    return this.prisma.playerBadge.findMany({
      where: { playerId },
      include: {
        coach: { select: { id: true, username: true } },
        session: { select: { id: true, date: true } },
      },
      orderBy: { awardedAt: "desc" },
    });
  }

  awardBadge(data: AwardBadgeDto & { coachId: number }) {
    return this.prisma.playerBadge.create({
      data: {
        playerId: data.playerId,
        coachId: data.coachId,
        badgeType: data.badgeType as any,
        sessionId: data.sessionId,
        note: data.note,
      },
      include: {
        coach: { select: { id: true, username: true } },
        player: { select: { id: true, playerName: true } },
      },
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/growth-report/
git commit -m "feat(youth): GrowthReport DTO and Repository"
```

---

## Task 3: GrowthEvaluation Service (TDD)

**Files:**
- Create: `apps/api/src/growth-report/growth-report.service.ts`
- Create: `apps/api/__test__/growth-report/growth-report.service.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/__test__/growth-report/growth-report.service.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { GrowthReportService } from "../../src/growth-report/growth-report.service";

const mockRepo = {
  findEvaluations: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  findEvaluationById: jest.fn(),
  findEvaluationByPlayerMonth: jest.fn(),
  createEvaluation: jest.fn(),
  updateEvaluation: jest.fn(),
  publishEvaluation: jest.fn(),
  findBadgesByPlayer: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  awardBadge: jest.fn(),
} as any;

const mockNotifRepo = {
  createForGuardian: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
} as any;

const service = new GrowthReportService(mockRepo, mockNotifRepo);

describe("GrowthReportService - createEvaluation", () => {
  beforeEach(() => jest.clearAllMocks());

  test("같은 선수·연·월 평가가 이미 존재하면 409", async () => {
    mockRepo.findEvaluationByPlayerMonth.mockResolvedValue({ id: 1 });
    await expect(
      service.createEvaluation({ playerId: "p1", year: 2026, month: 7, attitudeScore: 4, attitudeComment: "좋음", fundamentalsScore: 3, fundamentalsComment: "보통", spatialScore: 4, spatialComment: "양호", physicalScore: 3, physicalComment: "성장 중" }, 10),
    ).rejects.toMatchObject({ statusCode: 409, code: "EVALUATION_EXISTS" });
  });

  test("없으면 생성", async () => {
    mockRepo.findEvaluationByPlayerMonth.mockResolvedValue(null);
    const created = { id: 1, playerId: "p1", year: 2026, month: 7 };
    mockRepo.createEvaluation.mockResolvedValue(created);

    const result = await service.createEvaluation({ playerId: "p1", year: 2026, month: 7, attitudeScore: 4, attitudeComment: "좋음", fundamentalsScore: 3, fundamentalsComment: "보통", spatialScore: 4, spatialComment: "양호", physicalScore: 3, physicalComment: "성장 중" }, 10);
    expect(result).toEqual(created);
    expect(mockRepo.createEvaluation).toHaveBeenCalledWith(expect.objectContaining({ coachId: 10 }));
  });
});

describe("GrowthReportService - publishEvaluation", () => {
  beforeEach(() => jest.clearAllMocks());

  test("이미 published면 409", async () => {
    mockRepo.findEvaluationById.mockResolvedValue({ id: 1, isPublished: true });
    await expect(service.publishEvaluation(1)).rejects.toMatchObject({ statusCode: 409, code: "ALREADY_PUBLISHED" });
  });

  test("publish 후 guardianId 있으면 알림 발송", async () => {
    mockRepo.findEvaluationById.mockResolvedValue({
      id: 1, isPublished: false, year: 2026, month: 7,
      player: { playerName: "홍길동", guardianId: 50 },
    });
    mockRepo.publishEvaluation.mockResolvedValue({ id: 1, isPublished: true });

    await service.publishEvaluation(1);

    expect(mockNotifRepo.createForGuardian).toHaveBeenCalledWith(
      50, "GROWTH_REPORT_PUBLISHED",
      expect.stringContaining("홍길동"),
      expect.stringContaining("7월"),
      1,
    );
  });

  test("guardianId 없으면 알림 미발송", async () => {
    mockRepo.findEvaluationById.mockResolvedValue({
      id: 2, isPublished: false, year: 2026, month: 7,
      player: { playerName: "김철수", guardianId: null },
    });
    mockRepo.publishEvaluation.mockResolvedValue({ id: 2, isPublished: true });

    await service.publishEvaluation(2);
    expect(mockNotifRepo.createForGuardian).not.toHaveBeenCalled();
  });
});

describe("GrowthReportService - awardBadge", () => {
  beforeEach(() => jest.clearAllMocks());

  test("배지 수여", async () => {
    const badge = { id: 1, playerId: "p1", badgeType: "PASSION_KING" };
    mockRepo.awardBadge.mockResolvedValue(badge);

    const result = await service.awardBadge({ playerId: "p1", badgeType: "PASSION_KING" }, 10);
    expect(result).toEqual(badge);
    expect(mockRepo.awardBadge).toHaveBeenCalledWith(expect.objectContaining({ coachId: 10 }));
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd apps/api && npx jest __test__/growth-report/growth-report.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `GrowthReportService is not a function`

- [ ] **Step 3: Service 구현**

`apps/api/src/growth-report/growth-report.service.ts`:

```typescript
import { AppError } from "../lib/appError";
import type { GrowthReportRepository } from "./growth-report.repo";
import type { NotificationRepository } from "../notification/notification.repo";
import type { CreateGrowthEvaluationDto, UpdateGrowthEvaluationDto, AwardBadgeDto, GrowthReportListQuery } from "./dto/growth-report.dto";

export class GrowthReportService {
  constructor(
    private repo: GrowthReportRepository,
    private notifRepo: NotificationRepository,
  ) {}

  getEvaluations(query: GrowthReportListQuery) {
    return this.repo.findEvaluations(query);
  }

  async getEvaluationById(id: number) {
    const evaluation = await this.repo.findEvaluationById(id);
    if (!evaluation) throw new AppError(404, "EVALUATION_NOT_FOUND");
    return evaluation;
  }

  async createEvaluation(dto: CreateGrowthEvaluationDto, coachId: number) {
    const existing = await this.repo.findEvaluationByPlayerMonth(dto.playerId, dto.year, dto.month);
    if (existing) throw new AppError(409, "EVALUATION_EXISTS");
    return this.repo.createEvaluation({ ...dto, coachId });
  }

  async updateEvaluation(id: number, dto: UpdateGrowthEvaluationDto) {
    const evaluation = await this.repo.findEvaluationById(id);
    if (!evaluation) throw new AppError(404, "EVALUATION_NOT_FOUND");
    if (evaluation.isPublished) throw new AppError(409, "ALREADY_PUBLISHED");
    return this.repo.updateEvaluation(id, dto);
  }

  async publishEvaluation(id: number) {
    const evaluation = await this.repo.findEvaluationById(id);
    if (!evaluation) throw new AppError(404, "EVALUATION_NOT_FOUND");
    if (evaluation.isPublished) throw new AppError(409, "ALREADY_PUBLISHED");

    const published = await this.repo.publishEvaluation(id);

    if (evaluation.player.guardianId) {
      void this.notifRepo
        .createForGuardian(
          evaluation.player.guardianId,
          "GROWTH_REPORT_PUBLISHED",
          `${evaluation.player.playerName}의 성장 리포트 도착`,
          `${evaluation.player.playerName} 선수의 ${evaluation.month}월 성장 리포트가 도착했습니다.`,
          id,
        )
        .catch(console.error);
    }

    return published;
  }

  getBadgesByPlayer(playerId: string) {
    return this.repo.findBadgesByPlayer(playerId);
  }

  awardBadge(dto: AwardBadgeDto, coachId: number) {
    return this.repo.awardBadge({ ...dto, coachId });
  }
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd apps/api && npx jest __test__/growth-report/growth-report.service.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/growth-report/ apps/api/__test__/growth-report/
git commit -m "feat(youth): GrowthReportService TDD (6 tests)"
```

---

## Task 4: Controller + Routes + apiRouter

**Files:**
- Create: `apps/api/src/growth-report/growth-report.controller.ts`
- Create: `apps/api/src/growth-report/growth-report.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: Controller 작성**

`apps/api/src/growth-report/growth-report.controller.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import type { GrowthReportService } from "./growth-report.service";
import { parseCreateEvaluationDto } from "./dto/growth-report.dto";

export class GrowthReportController {
  constructor(private service: GrowthReportService) {}

  getEvaluations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = req.query.playerId as string | undefined;
      const year = req.query.year ? Number(req.query.year) : undefined;
      res.json(await this.service.getEvaluations({ playerId, year }));
    } catch (e) { next(e); }
  };

  getEvaluationById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getEvaluationById(Number(req.params.id)));
    } catch (e) { next(e); }
  };

  createEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = parseCreateEvaluationDto(req.body);
      const coachId = (req.user as any).id;
      res.status(201).json(await this.service.createEvaluation(dto, coachId));
    } catch (e) { next(e); }
  };

  updateEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.updateEvaluation(Number(req.params.id), req.body));
    } catch (e) { next(e); }
  };

  publishEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.publishEvaluation(Number(req.params.id)));
    } catch (e) { next(e); }
  };

  getBadgesByPlayer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getBadgesByPlayer(req.params.playerId));
    } catch (e) { next(e); }
  };

  awardBadge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const coachId = (req.user as any).id;
      res.status(201).json(await this.service.awardBadge(req.body, coachId));
    } catch (e) { next(e); }
  };
}
```

- [ ] **Step 2: Routes 작성**

`apps/api/src/growth-report/growth-report.routes.ts`:

```typescript
import { Router } from "express";
import passport from "passport";
import { GrowthReportController } from "./growth-report.controller";
import { GrowthReportService } from "./growth-report.service";
import { GrowthReportRepository } from "./growth-report.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const prisma = getPrisma();
const repo = new GrowthReportRepository(prisma);
const notifRepo = new NotificationRepository(prisma);
const service = new GrowthReportService(repo, notifRepo);
const controller = new GrowthReportController(service);

const auth = passport.authenticate("accessToken", { session: false });

// Evaluations
router.get("/evaluations", auth, controller.getEvaluations);
router.get("/evaluations/:id", auth, controller.getEvaluationById);
router.post("/evaluations", auth, controller.createEvaluation);
router.patch("/evaluations/:id", auth, controller.updateEvaluation);
router.patch("/evaluations/:id/publish", auth, controller.publishEvaluation);

// Badges
router.get("/players/:playerId/badges", auth, controller.getBadgesByPlayer);
router.post("/badges", auth, controller.awardBadge);

export default router;
```

- [ ] **Step 3: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts`에서 다른 router import 패턴을 확인 후:

```typescript
import growthReportRouter from "./growth-report/growth-report.routes";
// 기존 라우트 등록 뒤에:
apiRouter.use("/growth-reports", growthReportRouter);
```

- [ ] **Step 4: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "country.repo\|monthlyAttendance" | head -20
```

- [ ] **Step 5: 전체 테스트**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -15
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/growth-report/ apps/api/src/apiRouter.ts
git commit -m "feat(youth): GrowthReport controller, routes, API 등록"
```

---

## Task 5: FE — 타입 + API 서비스

**Files:**
- Create: `football/src/types/growth-report.ts`
- Create: `football/src/services/growthReport.service.ts`

- [ ] **Step 1: 타입 작성**

`football/src/types/growth-report.ts`:

```typescript
export type BadgeType =
  | 'PASSION_KING'
  | 'SPACE_WIZARD'
  | 'BEST_PASSER'
  | 'TEAM_PLAYER'
  | 'MOST_IMPROVED'
  | 'DEFENSIVE_WALL'
  | 'GOAL_MACHINE'

export const BADGE_LABELS: Record<BadgeType, string> = {
  PASSION_KING: '이주의 열정왕',
  SPACE_WIZARD: '공간 마법사',
  BEST_PASSER: '패스 마스터',
  TEAM_PLAYER: '팀워크 챔피언',
  MOST_IMPROVED: '최고 성장주',
  DEFENSIVE_WALL: '수비의 벽',
  GOAL_MACHINE: '골 제조기',
}

export const BADGE_EMOJI: Record<BadgeType, string> = {
  PASSION_KING: '🔥',
  SPACE_WIZARD: '🧙',
  BEST_PASSER: '⚡',
  TEAM_PLAYER: '🤝',
  MOST_IMPROVED: '📈',
  DEFENSIVE_WALL: '🛡️',
  GOAL_MACHINE: '⚽',
}

export interface GrowthEvaluation {
  id: number
  playerId: string
  player: { id: string; playerName: string; guardianId: number | null }
  coachId: number
  coach: { id: number; username: string }
  year: number
  month: number
  isPublished: boolean
  publishedAt: string | null
  attitudeScore: number
  attitudeComment: string
  fundamentalsScore: number
  fundamentalsComment: string
  spatialScore: number
  spatialComment: string
  physicalScore: number
  physicalComment: string
  createdAt: string
}

export interface PlayerBadge {
  id: number
  playerId: string
  coachId: number
  coach: { id: number; username: string }
  sessionId: number | null
  session: { id: number; date: string } | null
  badgeType: BadgeType
  awardedAt: string
  note: string | null
}

export interface CreateEvaluationPayload {
  playerId: string
  year: number
  month: number
  attitudeScore: number
  attitudeComment: string
  fundamentalsScore: number
  fundamentalsComment: string
  spatialScore: number
  spatialComment: string
  physicalScore: number
  physicalComment: string
}

export interface AwardBadgePayload {
  playerId: string
  badgeType: BadgeType
  sessionId?: number
  note?: string
}
```

- [ ] **Step 2: API 서비스 작성**

`football/src/services/growthReport.service.ts`:

```typescript
import { api } from './api'
import type {
  GrowthEvaluation,
  PlayerBadge,
  CreateEvaluationPayload,
  AwardBadgePayload,
} from '@/types/growth-report'

export const growthReportApi = {
  getEvaluations: (params?: { playerId?: string; year?: number }) =>
    api.get<GrowthEvaluation[]>('/growth-reports/evaluations', { params }).then(r => r.data),

  getEvaluationById: (id: number) =>
    api.get<GrowthEvaluation>(`/growth-reports/evaluations/${id}`).then(r => r.data),

  create: (payload: CreateEvaluationPayload) =>
    api.post<GrowthEvaluation>('/growth-reports/evaluations', payload).then(r => r.data),

  update: (id: number, payload: Partial<CreateEvaluationPayload>) =>
    api.patch<GrowthEvaluation>(`/growth-reports/evaluations/${id}`, payload).then(r => r.data),

  publish: (id: number) =>
    api.patch<GrowthEvaluation>(`/growth-reports/evaluations/${id}/publish`).then(r => r.data),

  getBadgesByPlayer: (playerId: string) =>
    api.get<PlayerBadge[]>(`/growth-reports/players/${playerId}/badges`).then(r => r.data),

  awardBadge: (payload: AwardBadgePayload) =>
    api.post<PlayerBadge>('/growth-reports/badges', payload).then(r => r.data),
}
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add football/src/types/growth-report.ts football/src/services/growthReport.service.ts
git commit -m "feat(youth): GrowthReport FE 타입 + API 서비스"
```

---

## Task 6: FE — SVG 레이더 차트 컴포넌트

**Files:**
- Create: `football/src/components/players/GrowthRadarChart.tsx`

- [ ] **Step 1: 레이더 차트 컴포넌트 작성**

`football/src/components/players/GrowthRadarChart.tsx`:

```typescript
interface RadarDimension {
  key: string
  label: string
  score: number  // 1-5
}

interface Props {
  dimensions: RadarDimension[]
  size?: number
}

export function GrowthRadarChart({ dimensions, size = 200 }: Props) {
  if (dimensions.length === 0) return null

  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.38
  const levels = 5

  // polygon points for each level
  const levelPolygons = Array.from({ length: levels }, (_, lvl) => {
    const r = (maxR * (lvl + 1)) / levels
    return dimensions.map((_, i) => {
      const angle = (2 * Math.PI * i) / dimensions.length - Math.PI / 2
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
    })
  })

  // data polygon
  const dataPoints = dimensions.map((dim, i) => {
    const r = (maxR * dim.score) / 5
    const angle = (2 * Math.PI * i) / dimensions.length - Math.PI / 2
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  })

  const toPath = (pts: number[][]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]!.toFixed(1)} ${p[1]!.toFixed(1)}`).join(' ') + ' Z'

  // axis label positions (slightly outside maxR)
  const labelR = maxR + 16
  const labelPositions = dimensions.map((dim, i) => {
    const angle = (2 * Math.PI * i) / dimensions.length - Math.PI / 2
    return {
      x: cx + labelR * Math.cos(angle),
      y: cy + labelR * Math.sin(angle),
      label: dim.label,
      score: dim.score,
    }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* grid polygons */}
      {levelPolygons.map((pts, lvl) => (
        <path
          key={lvl}
          d={toPath(pts)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={0.8}
        />
      ))}
      {/* axis lines */}
      {dimensions.map((_, i) => {
        const angle = (2 * Math.PI * i) / dimensions.length - Math.PI / 2
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + maxR * Math.cos(angle)}
            y2={cy + maxR * Math.sin(angle)}
            stroke="#e2e8f0"
            strokeWidth={0.8}
          />
        )
      })}
      {/* data polygon */}
      <path
        d={toPath(dataPoints)}
        fill="rgba(99,102,241,0.25)"
        stroke="#6366f1"
        strokeWidth={2}
      />
      {/* data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p[0]!} cy={p[1]!} r={3} fill="#6366f1" />
      ))}
      {/* labels */}
      {labelPositions.map((pos, i) => (
        <text
          key={i}
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="#64748b"
        >
          {pos.label} ({pos.score})
        </text>
      ))}
    </svg>
  )
}
```

- [ ] **Step 2: TypeScript 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add football/src/components/players/GrowthRadarChart.tsx
git commit -m "feat(youth): SVG 레이더 차트 컴포넌트 (4차원 성장 지표)"
```

---

## Task 7: FE — 평가 입력 폼 + 배지 수여 다이얼로그

**Files:**
- Create: `football/src/pages/youth/GrowthEvaluationFormDialog.tsx`
- Create: `football/src/pages/youth/BadgeAwardDialog.tsx`

- [ ] **Step 1: 평가 입력 다이얼로그 작성**

`football/src/pages/youth/GrowthEvaluationFormDialog.tsx`:

```typescript
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { growthReportApi } from '@/services/growthReport.service'
import type { CreateEvaluationPayload } from '@/types/growth-report'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  playerId: string
  playerName: string
}

const DIMENSIONS = [
  { key: 'attitude', label: '태도/흥미도', scoreKey: 'attitudeScore' as const, commentKey: 'attitudeComment' as const },
  { key: 'fundamentals', label: '기본기', scoreKey: 'fundamentalsScore' as const, commentKey: 'fundamentalsComment' as const },
  { key: 'spatial', label: '공간 이해도', scoreKey: 'spatialScore' as const, commentKey: 'spatialComment' as const },
  { key: 'physical', label: '신체 발달', scoreKey: 'physicalScore' as const, commentKey: 'physicalComment' as const },
]

export function GrowthEvaluationFormDialog({ open, onClose, onCreated, playerId, playerName }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [scores, setScores] = useState<Record<string, number>>({
    attitudeScore: 3, fundamentalsScore: 3, spatialScore: 3, physicalScore: 3,
  })
  const [comments, setComments] = useState<Record<string, string>>({
    attitudeComment: '', fundamentalsComment: '', spatialComment: '', physicalComment: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload: CreateEvaluationPayload = {
        playerId, year, month,
        attitudeScore: scores.attitudeScore!, attitudeComment: comments.attitudeComment!,
        fundamentalsScore: scores.fundamentalsScore!, fundamentalsComment: comments.fundamentalsComment!,
        spatialScore: scores.spatialScore!, spatialComment: comments.spatialComment!,
        physicalScore: scores.physicalScore!, physicalComment: comments.physicalComment!,
      }
      await growthReportApi.create(payload)
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{playerName} 월간 성장 평가</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>연도</Label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm mt-1"
                value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
            <div className="flex-1">
              <Label>월</Label>
              <select className="w-full border rounded px-3 py-2 text-sm mt-1"
                value={month} onChange={e => setMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          </div>

          {DIMENSIONS.map(dim => (
            <div key={dim.key} className="space-y-2 border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">{dim.label}</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScores(prev => ({ ...prev, [dim.scoreKey]: s }))}
                      className={`w-7 h-7 rounded text-sm font-medium transition-colors ${
                        scores[dim.scoreKey] === s
                          ? 'bg-indigo-500 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-indigo-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                rows={2}
                placeholder={`${dim.label}에 대한 구체적인 관찰 내용을 적어주세요.`}
                value={comments[dim.commentKey] ?? ''}
                onChange={e => setComments(prev => ({ ...prev, [dim.commentKey]: e.target.value }))}
                className="text-sm"
              />
            </div>
          ))}

          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? '저장 중...' : '평가 저장'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 배지 수여 다이얼로그 작성**

`football/src/pages/youth/BadgeAwardDialog.tsx`:

```typescript
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { growthReportApi } from '@/services/growthReport.service'
import { BADGE_LABELS, BADGE_EMOJI, type BadgeType } from '@/types/growth-report'

interface Props {
  open: boolean
  onClose: () => void
  onAwarded: () => void
  players: { id: string; playerName: string }[]
}

const BADGE_TYPES = Object.keys(BADGE_LABELS) as BadgeType[]

export function BadgeAwardDialog({ open, onClose, onAwarded, players }: Props) {
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '')
  const [selectedBadge, setSelectedBadge] = useState<BadgeType>('PASSION_KING')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!playerId) return
    setLoading(true)
    setError(null)
    try {
      await growthReportApi.awardBadge({ playerId, badgeType: selectedBadge, note: note || undefined })
      onAwarded()
      onClose()
      setNote('')
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>이주의 배지 수여</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>선수</Label>
            <select className="w-full border rounded px-3 py-2 text-sm mt-1"
              value={playerId} onChange={e => setPlayerId(e.target.value)}>
              {players.map(p => <option key={p.id} value={p.id}>{p.playerName}</option>)}
            </select>
          </div>
          <div>
            <Label>배지 선택</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {BADGE_TYPES.map(badge => (
                <button
                  key={badge}
                  type="button"
                  onClick={() => setSelectedBadge(badge)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-sm text-left transition-colors ${
                    selectedBadge === badge
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <span className="text-lg">{BADGE_EMOJI[badge]}</span>
                  <span className="font-medium">{BADGE_LABELS[badge]}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>한마디 (선택)</Label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm mt-1"
              placeholder="예: 오늘 훈련에서 정말 열심히 했어요!"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={handleSubmit} disabled={loading || !playerId}>
              {loading ? '수여 중...' : '배지 수여'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -15
```

- [ ] **Step 4: Commit**

```bash
git add football/src/pages/youth/
git commit -m "feat(youth): 성장 평가 입력 폼 + 배지 수여 다이얼로그"
```

---

## Task 8: FE — 성장 리포트 페이지 + PlayerDetailPage 통합

**Files:**
- Create: `football/src/pages/youth/GrowthReportPage.tsx`
- Modify: `football/src/pages/players/PlayerDetailPage.tsx`
- Modify: `football/src/App.tsx`

- [ ] **Step 1: 성장 리포트 페이지 작성**

`football/src/pages/youth/GrowthReportPage.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GrowthRadarChart } from '@/components/players/GrowthRadarChart'
import { growthReportApi } from '@/services/growthReport.service'
import type { GrowthEvaluation, PlayerBadge } from '@/types/growth-report'
import { BADGE_LABELS, BADGE_EMOJI } from '@/types/growth-report'
import { GrowthEvaluationFormDialog } from './GrowthEvaluationFormDialog'
import { BadgeAwardDialog } from './BadgeAwardDialog'

export default function GrowthReportPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const [evaluations, setEvaluations] = useState<GrowthEvaluation[]>([])
  const [badges, setBadges] = useState<PlayerBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [evalDialogOpen, setEvalDialogOpen] = useState(false)
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false)

  const load = async () => {
    if (!playerId) return
    setLoading(true)
    try {
      const [evals, bdgs] = await Promise.all([
        growthReportApi.getEvaluations({ playerId }),
        growthReportApi.getBadgesByPlayer(playerId),
      ])
      setEvaluations(evals)
      setBadges(bdgs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [playerId])

  const handlePublish = async (id: number) => {
    await growthReportApi.publish(id)
    load()
  }

  const playerName = evaluations[0]?.player.playerName ?? '선수'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{playerName} 성장 리포트</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBadgeDialogOpen(true)}>배지 수여</Button>
          <Button onClick={() => setEvalDialogOpen(true)}>+ 월간 평가 작성</Button>
        </div>
      </div>

      {/* 배지 섹션 */}
      {badges.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">수여된 배지</h2>
          <div className="flex flex-wrap gap-2">
            {badges.map(b => (
              <div key={b.id} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-sm">
                <span>{BADGE_EMOJI[b.badgeType]}</span>
                <span className="font-medium text-amber-800">{BADGE_LABELS[b.badgeType]}</span>
                <span className="text-amber-600 text-xs">{new Date(b.awardedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 평가 목록 */}
      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : evaluations.length === 0 ? (
        <p className="text-muted-foreground">작성된 평가가 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {evaluations.map(ev => {
            const dimensions = [
              { key: 'attitude', label: '태도', score: ev.attitudeScore },
              { key: 'fundamentals', label: '기본기', score: ev.fundamentalsScore },
              { key: 'spatial', label: '공간이해', score: ev.spatialScore },
              { key: 'physical', label: '신체발달', score: ev.physicalScore },
            ]
            return (
              <div key={ev.id} className="border rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{ev.year}년 {ev.month}월</h2>
                  <div className="flex items-center gap-2">
                    {ev.isPublished
                      ? <Badge variant="default">발송됨</Badge>
                      : <Badge variant="outline">미발송</Badge>}
                    {!ev.isPublished && (
                      <Button size="sm" variant="outline" onClick={() => handlePublish(ev.id)}>
                        학부모 발송
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex gap-6 items-start">
                  <GrowthRadarChart dimensions={dimensions} size={180} />
                  <div className="flex-1 space-y-3 text-sm">
                    {[
                      { label: '태도/흥미도', score: ev.attitudeScore, comment: ev.attitudeComment },
                      { label: '기본기', score: ev.fundamentalsScore, comment: ev.fundamentalsComment },
                      { label: '공간 이해도', score: ev.spatialScore, comment: ev.spatialComment },
                      { label: '신체 발달', score: ev.physicalScore, comment: ev.physicalComment },
                    ].map(dim => (
                      <div key={dim.label}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-muted-foreground w-20">{dim.label}</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <div key={s} className={`w-2.5 h-2.5 rounded-sm ${s <= dim.score ? 'bg-indigo-500' : 'bg-muted'}`} />
                            ))}
                          </div>
                        </div>
                        {dim.comment && <p className="text-muted-foreground pl-22 leading-relaxed">{dim.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <GrowthEvaluationFormDialog
        open={evalDialogOpen}
        onClose={() => setEvalDialogOpen(false)}
        onCreated={load}
        playerId={playerId ?? ''}
        playerName={playerName}
      />
      <BadgeAwardDialog
        open={badgeDialogOpen}
        onClose={() => setBadgeDialogOpen(false)}
        onAwarded={load}
        players={[{ id: playerId ?? '', playerName }]}
      />
    </div>
  )
}
```

- [ ] **Step 2: PlayerDetailPage에 성장 리포트 링크 추가**

`football/src/pages/players/PlayerDetailPage.tsx`에서 YOUTH 팀 선수 상세 페이지에 성장 리포트 버튼 추가. 기존 PDI 섹션 아래에 추가:

```typescript
import { useNavigate } from 'react-router-dom'

// 컴포넌트 내부:
const navigate = useNavigate()

// player.team?.type === 'YOUTH' 조건 블록에 추가:
{player?.team?.type === 'YOUTH' && (
  <section className="mt-4">
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate(`/growth-reports/${player.id}`)}
    >
      성장 리포트 보기
    </Button>
  </section>
)}
```

- [ ] **Step 3: App.tsx에 라우트 추가**

```bash
grep -n "incident-reports\|youth" football/src/App.tsx | tail -10
```

추가:
```typescript
import GrowthReportPage from './pages/youth/GrowthReportPage'
// Routes 내:
<Route path="/growth-reports/:playerId" element={<GrowthReportPage />} />
```

- [ ] **Step 4: TypeScript 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: 전체 BE 테스트**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
cd /Users/juno/work/football
git add football/src/
git commit -m "feat(youth): Plan 6 완료 - 성장 리포트 페이지, 레이더 차트, 배지 시스템"
```
