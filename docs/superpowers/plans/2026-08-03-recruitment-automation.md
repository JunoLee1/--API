# Recruitment Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 지원자 상태 자동 전환 + 채용 자동화 레이어(LeagueLevelWeightConfig · DepartmentIbiConfig · SeasonComplianceCheck · ComplianceDeadline · HiringPriorityQueue · 분기 cron) 완전 구현

**Architecture:** 지원자 상태 전환은 `scheduleInterview` / `createReferenceCheck` 호출 시 자동 처리. 채용 자동화 엔티티 CRUD는 새 `hiring-automation/` 모듈로 분리. 채용 우선순위 큐는 `GET /hr-reports/hiring-priority` 온디맨드 계산. 분기 cron은 `jobs/` 폴더 기존 패턴 그대로 추가.

**Tech Stack:** Express · Prisma (generated client at `src/generated/`) · Jest · node-cron · TypeScript

---

## File Map

### Modified
- `prisma/schema.prisma` — ClubSettings에 `ibiBeta` 추가
- `apps/api/src/recruitment/dto/recruitment.dto.ts` — `UpdateJobApplicationDto`에 `status?: "SCREENING"` 추가
- `apps/api/src/recruitment/recruitment.repo.ts` — `setApplicationStatus()` 추가
- `apps/api/src/recruitment/recruitment.service.ts` — scheduleInterview, createReferenceCheck, updateApplication 수정
- `apps/api/src/department/department.repo.ts` — `category` 필드 노출
- `apps/api/src/department/department.service.ts` — `category` 필드 노출
- `apps/api/src/club-settings/club-settings.repo.ts` — `ibiBeta` 포함
- `apps/api/src/club-settings/club-settings.service.ts` — `ibiBeta` 업데이트 허용
- `apps/api/src/club-settings/club-settings.controller.ts` — `ibiBeta` 수신
- `apps/api/src/hr-report/hr-report.service.ts` — `getHiringPriorityQueue()` 추가
- `apps/api/src/hr-report/hr-report.controller.ts` — `getHiringPriorityQueue` 핸들러 추가
- `apps/api/src/hr-report/hr-report.routes.ts` — `GET /hiring-priority` 추가
- `apps/api/src/apiRouter.ts` — `hiring-automation` 라우터 등록

### Created
- `apps/api/src/hiring-automation/dto/hiring-automation.dto.ts`
- `apps/api/src/hiring-automation/hiring-automation.repo.ts`
- `apps/api/src/hiring-automation/hiring-automation.service.ts`
- `apps/api/src/hiring-automation/hiring-automation.controller.ts`
- `apps/api/src/hiring-automation/hiring-automation.routes.ts`
- `apps/api/src/jobs/quarterlyJobPostingDraft.ts`
- `apps/api/__test__/recruitment/recruitment.service.test.ts`
- `apps/api/__test__/hiring-automation/hiring-automation.service.test.ts`

---

## Task 1: Prisma — ibiBeta 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: schema.prisma에서 ClubSettings 모델에 ibiBeta 추가**

`ClubSettings` 모델 찾아서 아래 필드 추가:
```prisma
model ClubSettings {
  id       Int     @id @default(autoincrement())
  currency String? @default("KRW")
  ibiBeta  Float   @default(1.0)   // ← 추가
}
```

- [x] **Step 2: 마이그레이션 실행**

```bash
cd /Users/juno/work/football
npx prisma migrate dev --name add-ibi-beta-to-club-settings
```

Expected: `✔ Your database is now in sync with your schema.`

- [x] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ibiBeta to ClubSettings for hiring priority β"
```

---

## Task 2: Recruitment 지원자 상태 자동 전환

**Files:**
- Modify: `apps/api/src/recruitment/dto/recruitment.dto.ts`
- Modify: `apps/api/src/recruitment/recruitment.repo.ts`
- Modify: `apps/api/src/recruitment/recruitment.service.ts`

- [x] **Step 1: DTO 수정 — UpdateJobApplicationDto에 status 추가**

`apps/api/src/recruitment/dto/recruitment.dto.ts`의 `UpdateJobApplicationDto` 수정:
```typescript
export interface UpdateJobApplicationDto {
  applicantName?: string;
  email?: string;
  phone?: string;
  resumeUrl?: string;
  status?: "SCREENING"; // PATCH로 허용되는 유일한 상태 전환
}
```

- [x] **Step 2: Repo에 setApplicationStatus 추가**

`apps/api/src/recruitment/recruitment.repo.ts`에 아래 메서드 추가 (ApplicationSource import 기존 유지):
```typescript
import type { InterviewRound, JobApplicationStatus } from "../generated/enums";
```

`RecruitmentRepository` 클래스 내부에 추가:
```typescript
setApplicationStatus(id: number, status: JobApplicationStatus) {
  return this.prisma.jobApplication.update({
    where: { id },
    data: { status },
    include: APPLICATION_INCLUDE,
  });
}
```

- [x] **Step 3: Service 수정 — scheduleInterview 자동 전환**

`apps/api/src/recruitment/recruitment.service.ts`의 `scheduleInterview` 메서드를 아래로 교체:
```typescript
async scheduleInterview(applicationId: number, dto: CreateInterviewDto) {
  await this.getApplication(applicationId);
  const existing = await this.repo.findInterview(applicationId, dto.round);
  if (existing) throw new AppError(409, "INTERVIEW_ALREADY_EXISTS");
  const targetStatus: "INTERVIEW_1" | "INTERVIEW_2" =
    dto.round === "ROUND_1" ? "INTERVIEW_1" : "INTERVIEW_2";
  await this.repo.setApplicationStatus(applicationId, targetStatus);
  return this.repo.createInterview(applicationId, dto);
}
```

- [x] **Step 4: Service 수정 — createReferenceCheck 자동 전환**

`createReferenceCheck` 메서드를 아래로 교체:
```typescript
async createReferenceCheck(applicationId: number, dto: CreateReferenceCheckDto) {
  await this.getApplication(applicationId);
  await this.repo.setApplicationStatus(applicationId, "REFERENCE_CHECK");
  return this.repo.createReferenceCheck(applicationId, dto);
}
```

- [x] **Step 5: Service 수정 — updateApplication SCREENING 전용 검증**

`updateApplication` 메서드를 아래로 교체:
```typescript
async updateApplication(id: number, dto: UpdateJobApplicationDto) {
  await this.getApplication(id);
  if (dto.status !== undefined && dto.status !== "SCREENING") {
    throw new AppError(400, "INVALID_STATUS_TRANSITION");
  }
  return this.repo.updateApplication(id, dto);
}
```

- [x] **Step 6: Commit**

```bash
git add apps/api/src/recruitment/
git commit -m "feat: auto-transition application status on interview scheduling and reference check creation"
```

---

## Task 3: RecruitmentService 상태 전환 테스트

**Files:**
- Create: `apps/api/__test__/recruitment/recruitment.service.test.ts`

- [x] **Step 1: 테스트 파일 작성**

```typescript
import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { RecruitmentService } from "../../src/recruitment/recruitment.service";

const mockRepo = {
  findPostingById: jest.fn(),
  findAllPostings: jest.fn(),
  createPosting: jest.fn(),
  updatePosting: jest.fn(),
  approvePosting: jest.fn(),
  closePosting: jest.fn(),
  findApplicationsByPosting: jest.fn(),
  findApplicationById: jest.fn(),
  createApplication: jest.fn(),
  updateApplication: jest.fn(),
  rejectApplication: jest.fn(),
  offerApplication: jest.fn(),
  setApplicationStatus: jest.fn(),
  findInterview: jest.fn(),
  createInterview: jest.fn(),
  updateInterview: jest.fn(),
  createReferenceCheck: jest.fn(),
  updateReferenceCheck: jest.fn(),
  createOnboarding: jest.fn(),
  findOnboardingByApplication: jest.fn(),
  markEmailVerified: jest.fn(),
  markMfaRegistered: jest.fn(),
} as any;

const service = new RecruitmentService(mockRepo);

beforeEach(() => jest.clearAllMocks());

describe("scheduleInterview", () => {
  test("ROUND_1 예약 시 status를 INTERVIEW_1로 전환한다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "APPLIED" });
    mockRepo.findInterview.mockResolvedValue(null);
    mockRepo.setApplicationStatus.mockResolvedValue({});
    mockRepo.createInterview.mockResolvedValue({ id: 10 });

    await service.scheduleInterview(1, { round: "ROUND_1" });

    expect(mockRepo.setApplicationStatus).toHaveBeenCalledWith(1, "INTERVIEW_1");
  });

  test("ROUND_2 예약 시 status를 INTERVIEW_2로 전환한다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "INTERVIEW_1" });
    mockRepo.findInterview.mockResolvedValue(null);
    mockRepo.setApplicationStatus.mockResolvedValue({});
    mockRepo.createInterview.mockResolvedValue({ id: 11 });

    await service.scheduleInterview(1, { round: "ROUND_2" });

    expect(mockRepo.setApplicationStatus).toHaveBeenCalledWith(1, "INTERVIEW_2");
  });

  test("이미 면접이 있으면 409 INTERVIEW_ALREADY_EXISTS를 던진다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "INTERVIEW_1" });
    mockRepo.findInterview.mockResolvedValue({ round: "ROUND_1" });

    await expect(service.scheduleInterview(1, { round: "ROUND_1" })).rejects.toMatchObject({
      statusCode: 409,
      code: "INTERVIEW_ALREADY_EXISTS",
    });

    expect(mockRepo.setApplicationStatus).not.toHaveBeenCalled();
  });
});

describe("createReferenceCheck", () => {
  test("레퍼런스 체크 생성 시 status를 REFERENCE_CHECK로 전환한다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "INTERVIEW_2" });
    mockRepo.setApplicationStatus.mockResolvedValue({});
    mockRepo.createReferenceCheck.mockResolvedValue({ id: 5 });

    await service.createReferenceCheck(1, { contactName: "홍길동", relationship: "전 직장 상사" });

    expect(mockRepo.setApplicationStatus).toHaveBeenCalledWith(1, "REFERENCE_CHECK");
    expect(mockRepo.createReferenceCheck).toHaveBeenCalledWith(1, {
      contactName: "홍길동",
      relationship: "전 직장 상사",
    });
  });
});

describe("offerApplication", () => {
  test("REFERENCE_CHECK 상태가 아니면 409 APPLICATION_NOT_IN_REFERENCE_CHECK를 던진다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "INTERVIEW_2" });

    await expect(service.offerApplication(1, 99)).rejects.toMatchObject({
      statusCode: 409,
      code: "APPLICATION_NOT_IN_REFERENCE_CHECK",
    });
  });
});

describe("rejectApplication", () => {
  test("이미 REJECTED이면 409 APPLICATION_ALREADY_REJECTED를 던진다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "REJECTED" });

    await expect(service.rejectApplication(1)).rejects.toMatchObject({
      statusCode: 409,
      code: "APPLICATION_ALREADY_REJECTED",
    });
  });
});

describe("approvePosting", () => {
  test("DRAFT가 아니면 409 JOB_POSTING_NOT_DRAFT를 던진다", async () => {
    mockRepo.findPostingById.mockResolvedValue({ id: 1, status: "OPEN" });

    await expect(service.approvePosting(1, 99)).rejects.toMatchObject({
      statusCode: 409,
      code: "JOB_POSTING_NOT_DRAFT",
    });
  });
});

describe("updateApplication", () => {
  test("SCREENING으로 status 변경이 허용된다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "APPLIED" });
    mockRepo.updateApplication.mockResolvedValue({ id: 1, status: "SCREENING" });

    await service.updateApplication(1, { status: "SCREENING" });

    expect(mockRepo.updateApplication).toHaveBeenCalledWith(1, { status: "SCREENING" });
  });

  test("SCREENING 외 status는 400 INVALID_STATUS_TRANSITION을 던진다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "APPLIED" });

    await expect(
      service.updateApplication(1, { status: "INTERVIEW_1" as any }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_STATUS_TRANSITION" });

    expect(mockRepo.updateApplication).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/juno/work/football
npx jest __test__/recruitment/recruitment.service.test.ts --no-coverage
```

Expected: FAIL — `setApplicationStatus is not a function` 또는 유사 오류

- [x] **Step 3: 테스트 재실행 — 통과 확인 (Task 2 구현 후)**

```bash
npx jest __test__/recruitment/recruitment.service.test.ts --no-coverage
```

Expected: 8 tests passed

- [x] **Step 4: Commit**

```bash
git add apps/api/__test__/recruitment/
git commit -m "test: recruitment service status transition coverage"
```

---

## Task 4: Department — category 필드 노출

**Files:**
- Modify: `apps/api/src/department/department.repo.ts`
- Modify: `apps/api/src/department/department.service.ts`

- [x] **Step 1: Repo 수정**

`apps/api/src/department/department.repo.ts` 파일에서 import 추가:
```typescript
import type { DepartmentCategory } from "../generated/enums";
```

`create` 메서드 시그니처 수정:
```typescript
create(data: { name: string; parentId?: number; category?: DepartmentCategory | null }) {
  return this.prisma.department.create({
    data,
    include: { children: { orderBy: { name: "asc" } }, parent: true },
  });
}
```

`update` 메서드 시그니처 수정:
```typescript
update(
  id: number,
  data: { name?: string; isActive?: boolean; parentId?: number | null; category?: DepartmentCategory | null },
) {
  return this.prisma.department.update({
    where: { id },
    data,
    include: { children: { orderBy: { name: "asc" } }, parent: true },
  });
}
```

- [x] **Step 2: Service 수정**

`apps/api/src/department/department.service.ts` 파일에서 import 추가:
```typescript
import type { DepartmentCategory } from "../generated/enums";
```

`create` 메서드 시그니처 수정:
```typescript
async create(data: { name: string; parentId?: number; category?: DepartmentCategory | null }) {
```

`update` 메서드 시그니처 수정:
```typescript
async update(
  id: number,
  data: { name?: string; isActive?: boolean; parentId?: number | null; category?: DepartmentCategory | null },
) {
```

(기존 로직 그대로, 시그니처만 확장)

- [x] **Step 3: 빌드 확인**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음

- [x] **Step 4: Commit**

```bash
git add apps/api/src/department/
git commit -m "feat: expose category field in department CRUD"
```

---

## Task 5: ClubSettings — ibiBeta API 노출

**Files:**
- Modify: `apps/api/src/club-settings/club-settings.repo.ts`
- Modify: `apps/api/src/club-settings/club-settings.service.ts`
- Modify: `apps/api/src/club-settings/club-settings.controller.ts`

- [x] **Step 1: Repo 수정**

`apps/api/src/club-settings/club-settings.repo.ts` 전체 교체:
```typescript
import { PrismaClient } from "../generated/client";

export class ClubSettingsRepository {
  constructor(private prisma: PrismaClient) {}

  async get() {
    return this.prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, currency: "KRW", ibiBeta: 1.0 },
      update: {},
    });
  }

  async update(data: { currency?: string; ibiBeta?: number }) {
    return this.prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, currency: "KRW", ibiBeta: 1.0, ...data },
      update: data,
    });
  }
}
```

- [x] **Step 2: Service 수정**

`apps/api/src/club-settings/club-settings.service.ts` 전체 교체:
```typescript
import { ClubSettingsRepository } from "./club-settings.repo";
import { AppError } from "../lib/appError";

export class ClubSettingsService {
  constructor(private repo: ClubSettingsRepository) {}

  get() {
    return this.repo.get();
  }

  async update(data: { currency?: string; ibiBeta?: number }) {
    if (data.currency !== undefined && !/^[A-Z]{3}$/.test(data.currency)) {
      throw new AppError(400, "INVALID_CURRENCY");
    }
    if (data.ibiBeta !== undefined && (data.ibiBeta <= 0 || data.ibiBeta > 100)) {
      throw new AppError(400, "INVALID_IBI_BETA");
    }
    return this.repo.update(data);
  }
}
```

- [x] **Step 3: Controller 수정**

`apps/api/src/club-settings/club-settings.controller.ts`의 update 핸들러를 찾아서 body 처리 수정:
```typescript
update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currency, ibiBeta } = req.body as { currency?: string; ibiBeta?: number };
    res.json(await this.service.update({ currency, ibiBeta }));
  } catch (err) {
    next(err);
  }
};
```

- [x] **Step 4: Commit**

```bash
git add apps/api/src/club-settings/
git commit -m "feat: expose ibiBeta in ClubSettings API"
```

---

## Task 6: hiring-automation DTOs

**Files:**
- Create: `apps/api/src/hiring-automation/dto/hiring-automation.dto.ts`

- [x] **Step 1: DTO 파일 작성**

```typescript
import type { LeagueLevel, DepartmentCategory } from "../../generated/enums";

// LeagueLevelWeightConfig
export interface UpsertLeagueWeightDto {
  weight: number; // 0.0 ~ 1.0
}

// DepartmentIbiConfig
export interface CreateDepartmentIbiConfigDto {
  departmentId: number;
  jobTitle: string;
  coreTaskRatio: number; // 0.0 ~ 1.0
  replacementDays: number;
  backupHeadcount: number;
}

export interface UpdateDepartmentIbiConfigDto {
  coreTaskRatio?: number;
  replacementDays?: number;
  backupHeadcount?: number;
}

// SeasonComplianceCheck
export interface UpsertSeasonComplianceCheckDto {
  afcQualificationMet: boolean;
  officeStaffCountMet: boolean;
}

// ComplianceDeadline
export interface CreateComplianceDeadlineDto {
  name: string;
  deadlineDate: string; // ISO date string
  triggerDaysBefore: number;
  betaMultiplier: number;
  isActive?: boolean;
}

export interface UpdateComplianceDeadlineDto {
  name?: string;
  deadlineDate?: string;
  triggerDaysBefore?: number;
  betaMultiplier?: number;
  isActive?: boolean;
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/hiring-automation/
git commit -m "feat: hiring-automation DTOs"
```

---

## Task 7: hiring-automation Repo

**Files:**
- Create: `apps/api/src/hiring-automation/hiring-automation.repo.ts`

- [x] **Step 1: Repo 파일 작성**

```typescript
import type { PrismaClient } from "../generated/client";
import type { LeagueLevel, DepartmentCategory } from "../generated/enums";
import type {
  CreateDepartmentIbiConfigDto,
  UpdateDepartmentIbiConfigDto,
  UpsertLeagueWeightDto,
  UpsertSeasonComplianceCheckDto,
  CreateComplianceDeadlineDto,
  UpdateComplianceDeadlineDto,
} from "./dto/hiring-automation.dto";

export class HiringAutomationRepository {
  constructor(private prisma: PrismaClient) {}

  // --- LeagueLevelWeightConfig ---

  listLeagueWeights() {
    return this.prisma.leagueLevelWeightConfig.findMany({
      orderBy: [{ leagueLevel: "asc" }, { category: "asc" }],
    });
  }

  upsertLeagueWeight(leagueLevel: LeagueLevel, category: DepartmentCategory, dto: UpsertLeagueWeightDto) {
    return this.prisma.leagueLevelWeightConfig.upsert({
      where: { leagueLevel_category: { leagueLevel, category } },
      create: { leagueLevel, category, weight: dto.weight },
      update: { weight: dto.weight },
    });
  }

  // --- DepartmentIbiConfig ---

  listIbiConfigs(departmentId?: number) {
    return this.prisma.departmentIbiConfig.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: { department: { select: { id: true, name: true, category: true } } },
      orderBy: [{ departmentId: "asc" }, { jobTitle: "asc" }],
    });
  }

  findIbiConfigById(id: number) {
    return this.prisma.departmentIbiConfig.findUnique({
      where: { id },
      include: { department: { select: { id: true, name: true, category: true } } },
    });
  }

  createIbiConfig(data: CreateDepartmentIbiConfigDto & { updatedById: number }) {
    const { updatedById, ...rest } = data;
    return this.prisma.departmentIbiConfig.create({
      data: { ...rest, updatedById, updatedAt: new Date() },
      include: { department: { select: { id: true, name: true, category: true } } },
    });
  }

  updateIbiConfig(id: number, data: UpdateDepartmentIbiConfigDto & { updatedById: number }) {
    const { updatedById, ...rest } = data;
    return this.prisma.departmentIbiConfig.update({
      where: { id },
      data: { ...rest, updatedById, updatedAt: new Date() },
      include: { department: { select: { id: true, name: true, category: true } } },
    });
  }

  deleteIbiConfig(id: number) {
    return this.prisma.departmentIbiConfig.delete({ where: { id } });
  }

  // --- SeasonComplianceCheck ---

  findComplianceCheck(seasonId: number) {
    return this.prisma.seasonComplianceCheck.findUnique({ where: { seasonId } });
  }

  upsertComplianceCheck(seasonId: number, data: UpsertSeasonComplianceCheckDto & { updatedById: number }) {
    const { updatedById, ...rest } = data;
    return this.prisma.seasonComplianceCheck.upsert({
      where: { seasonId },
      create: { seasonId, ...rest, updatedById, updatedAt: new Date() },
      update: { ...rest, updatedById, updatedAt: new Date() },
    });
  }

  // --- ComplianceDeadline ---

  listComplianceDeadlines() {
    return this.prisma.complianceDeadline.findMany({
      orderBy: { deadlineDate: "asc" },
    });
  }

  findComplianceDeadlineById(id: number) {
    return this.prisma.complianceDeadline.findUnique({ where: { id } });
  }

  createComplianceDeadline(data: CreateComplianceDeadlineDto) {
    return this.prisma.complianceDeadline.create({
      data: {
        ...data,
        deadlineDate: new Date(data.deadlineDate),
        isActive: data.isActive ?? true,
      },
    });
  }

  updateComplianceDeadline(id: number, data: UpdateComplianceDeadlineDto) {
    return this.prisma.complianceDeadline.update({
      where: { id },
      data: {
        ...data,
        ...(data.deadlineDate && { deadlineDate: new Date(data.deadlineDate) }),
      },
    });
  }

  deleteComplianceDeadline(id: number) {
    return this.prisma.complianceDeadline.delete({ where: { id } });
  }

  // --- 우선순위 큐 계산용 데이터 조회 ---

  getActiveComplianceDeadlineNearby(today: Date) {
    return this.prisma.complianceDeadline.findFirst({
      where: { isActive: true, deadlineDate: { gte: today } },
      orderBy: { deadlineDate: "asc" },
    });
  }

  getLeagueWeightMap(leagueLevel: LeagueLevel) {
    return this.prisma.leagueLevelWeightConfig.findMany({ where: { leagueLevel } });
  }

  getAllIbiConfigs() {
    return this.prisma.departmentIbiConfig.findMany({
      include: { department: { select: { id: true, name: true, category: true } } },
    });
  }

  getSeasonComplianceCheck(seasonId: number) {
    return this.prisma.seasonComplianceCheck.findUnique({ where: { seasonId } });
  }

  // 자동 규정 준수 4개 항목 체크
  async checkAutoCompliance() {
    const [playerCount, coachingCount, medicalCount, youthTeamCount] = await Promise.all([
      this.prisma.player.count({ where: { status: "ACTIVE" } }),
      this.prisma.user.count({ where: { role: "COACHING_STAFF", isDeleted: false } }),
      this.prisma.user.count({
        where: { role: "COACHING_STAFF", coachingRole: "MEDICAL", isDeleted: false },
      }),
      this.prisma.team.count({ where: { type: "YOUTH", isActive: true } }),
    ]);
    return { playerCount, coachingCount, medicalCount, youthTeamCount };
  }

  getActiveJobPostingsForDepartment(departmentId: number) {
    return this.prisma.jobPosting.findMany({
      where: { departmentId, status: { in: ["DRAFT", "OPEN"] } },
      select: { id: true, status: true },
    });
  }

  createJobPostingDraft(data: {
    title: string;
    departmentId: number;
    headcount: number;
    description: string;
    createdById: number;
  }) {
    return this.prisma.jobPosting.create({ data });
  }
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/hiring-automation/hiring-automation.repo.ts
git commit -m "feat: hiring-automation repository"
```

---

## Task 8: hiring-automation Service

**Files:**
- Create: `apps/api/src/hiring-automation/hiring-automation.service.ts`

- [x] **Step 1: Service 파일 작성**

```typescript
import { HiringAutomationRepository } from "./hiring-automation.repo";
import { AppError } from "../lib/appError";
import type { LeagueLevel, DepartmentCategory } from "../generated/enums";
import type {
  CreateDepartmentIbiConfigDto,
  UpdateDepartmentIbiConfigDto,
  UpsertLeagueWeightDto,
  UpsertSeasonComplianceCheckDto,
  CreateComplianceDeadlineDto,
  UpdateComplianceDeadlineDto,
} from "./dto/hiring-automation.dto";

// K3 기준 최소 규정 — 규정 개정 시 여기만 수정
const MIN_PLAYERS = 18;
const MIN_COACHING = 5;
const MIN_MEDICAL = 1;
const MIN_YOUTH_TEAMS = 1;

export class HiringAutomationService {
  constructor(private repo: HiringAutomationRepository) {}

  // --- LeagueLevelWeightConfig ---

  listLeagueWeights() {
    return this.repo.listLeagueWeights();
  }

  upsertLeagueWeight(leagueLevel: LeagueLevel, category: DepartmentCategory, dto: UpsertLeagueWeightDto) {
    if (dto.weight < 0 || dto.weight > 1) throw new AppError(400, "INVALID_WEIGHT");
    return this.repo.upsertLeagueWeight(leagueLevel, category, dto);
  }

  // --- DepartmentIbiConfig ---

  listIbiConfigs(departmentId?: number) {
    return this.repo.listIbiConfigs(departmentId);
  }

  async getIbiConfig(id: number) {
    const config = await this.repo.findIbiConfigById(id);
    if (!config) throw new AppError(404, "IBI_CONFIG_NOT_FOUND");
    return config;
  }

  createIbiConfig(dto: CreateDepartmentIbiConfigDto, updatedById: number) {
    if (dto.coreTaskRatio < 0 || dto.coreTaskRatio > 1)
      throw new AppError(400, "INVALID_CORE_TASK_RATIO");
    return this.repo.createIbiConfig({ ...dto, updatedById });
  }

  async updateIbiConfig(id: number, dto: UpdateDepartmentIbiConfigDto, updatedById: number) {
    await this.getIbiConfig(id);
    if (dto.coreTaskRatio !== undefined && (dto.coreTaskRatio < 0 || dto.coreTaskRatio > 1))
      throw new AppError(400, "INVALID_CORE_TASK_RATIO");
    return this.repo.updateIbiConfig(id, { ...dto, updatedById });
  }

  async deleteIbiConfig(id: number) {
    await this.getIbiConfig(id);
    return this.repo.deleteIbiConfig(id);
  }

  // --- SeasonComplianceCheck ---

  getComplianceCheck(seasonId: number) {
    return this.repo.findComplianceCheck(seasonId);
  }

  upsertComplianceCheck(seasonId: number, dto: UpsertSeasonComplianceCheckDto, updatedById: number) {
    return this.repo.upsertComplianceCheck(seasonId, { ...dto, updatedById });
  }

  // --- ComplianceDeadline ---

  listComplianceDeadlines() {
    return this.repo.listComplianceDeadlines();
  }

  async getComplianceDeadline(id: number) {
    const d = await this.repo.findComplianceDeadlineById(id);
    if (!d) throw new AppError(404, "COMPLIANCE_DEADLINE_NOT_FOUND");
    return d;
  }

  createComplianceDeadline(dto: CreateComplianceDeadlineDto) {
    if (dto.betaMultiplier <= 0) throw new AppError(400, "INVALID_BETA_MULTIPLIER");
    return this.repo.createComplianceDeadline(dto);
  }

  async updateComplianceDeadline(id: number, dto: UpdateComplianceDeadlineDto) {
    await this.getComplianceDeadline(id);
    if (dto.betaMultiplier !== undefined && dto.betaMultiplier <= 0)
      throw new AppError(400, "INVALID_BETA_MULTIPLIER");
    return this.repo.updateComplianceDeadline(id, dto);
  }

  async deleteComplianceDeadline(id: number) {
    await this.getComplianceDeadline(id);
    return this.repo.deleteComplianceDeadline(id);
  }

  // --- HiringPriorityQueue 공유 계산 ---

  async computePriorityQueue(currentSeason: { id: number; leagueLevel: LeagueLevel }, ibiBeta: number) {
    const today = new Date();

    const [ibiConfigs, weightConfigs, autoCompliance, manualCompliance, nearbyDeadline] =
      await Promise.all([
        this.repo.getAllIbiConfigs(),
        this.repo.getLeagueWeightMap(currentSeason.leagueLevel),
        this.repo.checkAutoCompliance(),
        this.repo.getSeasonComplianceCheck(currentSeason.id),
        this.repo.getActiveComplianceDeadlineNearby(today),
      ]);

    // β_eff 계산
    let betaEff = ibiBeta;
    if (nearbyDeadline) {
      const daysUntil = Math.floor(
        (nearbyDeadline.deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil <= nearbyDeadline.triggerDaysBefore) {
        betaEff = ibiBeta * Number(nearbyDeadline.betaMultiplier);
      }
    }

    // 규정 위반 여부
    const complianceViolation =
      autoCompliance.playerCount < MIN_PLAYERS ||
      autoCompliance.coachingCount < MIN_COACHING ||
      autoCompliance.medicalCount < MIN_MEDICAL ||
      autoCompliance.youthTeamCount < MIN_YOUTH_TEAMS ||
      manualCompliance?.afcQualificationMet === false ||
      manualCompliance?.officeStaffCountMet === false;

    // 부서별 IBI 집계 (부서 단위 평균)
    const deptIbiMap = new Map<number, { ibi: number; dept: { id: number; name: string; category: DepartmentCategory | null } }>();
    for (const cfg of ibiConfigs) {
      if (!cfg.department || cfg.coreTaskRatio == null || cfg.replacementDays == null || cfg.backupHeadcount == null)
        continue;
      const ibi =
        (Number(cfg.coreTaskRatio) * cfg.replacementDays) / (cfg.backupHeadcount + 1);
      const existing = deptIbiMap.get(cfg.departmentId);
      if (existing) {
        existing.ibi = (existing.ibi + ibi) / 2; // 부서 내 복수 직무 평균
      } else {
        deptIbiMap.set(cfg.departmentId, { ibi, dept: cfg.department as any });
      }
    }

    // 가중치 맵
    const weightMap = new Map<DepartmentCategory, number>(
      weightConfigs.map((w) => [w.category as DepartmentCategory, Number(w.weight)]),
    );

    // 점수 계산
    const results = Array.from(deptIbiMap.entries()).map(([deptId, { ibi, dept }]) => {
      const category = dept.category as DepartmentCategory | null;
      const highPriorityBonus =
        complianceViolation && category === "COMPLIANCE" ? 10000 : 0;
      const targetWeight = category ? (weightMap.get(category) ?? 0) : 0;
      const score = highPriorityBonus + targetWeight + betaEff * ibi;
      return { departmentId: deptId, departmentName: dept.name, category, score: Math.round(score * 100) / 100, ibi: Math.round(ibi * 100) / 100, betaEff: Math.round(betaEff * 100) / 100, highPriority: highPriorityBonus > 0 };
    });

    results.sort((a, b) => b.score - a.score);
    return {
      leagueLevel: currentSeason.leagueLevel,
      betaEff: Math.round(betaEff * 100) / 100,
      complianceViolation,
      autoCompliance,
      queue: results,
    };
  }
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/hiring-automation/hiring-automation.service.ts
git commit -m "feat: hiring-automation service with priority queue calculation"
```

---

## Task 9: hiring-automation Controller + Routes

**Files:**
- Create: `apps/api/src/hiring-automation/hiring-automation.controller.ts`
- Create: `apps/api/src/hiring-automation/hiring-automation.routes.ts`

- [x] **Step 1: Controller 파일 작성**

```typescript
import { Request, Response, NextFunction } from "express";
import { HiringAutomationService } from "./hiring-automation.service";
import type { LeagueLevel, DepartmentCategory } from "../generated/enums";
import type {
  UpsertLeagueWeightDto,
  CreateDepartmentIbiConfigDto,
  UpdateDepartmentIbiConfigDto,
  UpsertSeasonComplianceCheckDto,
  CreateComplianceDeadlineDto,
  UpdateComplianceDeadlineDto,
} from "./dto/hiring-automation.dto";

export class HiringAutomationController {
  constructor(private service: HiringAutomationService) {}

  // LeagueLevelWeightConfig
  listLeagueWeights = async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json(await this.service.listLeagueWeights()); } catch (e) { next(e); }
  };

  upsertLeagueWeight = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { leagueLevel, category } = req.params as { leagueLevel: LeagueLevel; category: DepartmentCategory };
      res.json(await this.service.upsertLeagueWeight(leagueLevel, category, req.body as UpsertLeagueWeightDto));
    } catch (e) { next(e); }
  };

  // DepartmentIbiConfig
  listIbiConfigs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
      res.json(await this.service.listIbiConfigs(departmentId));
    } catch (e) { next(e); }
  };

  createIbiConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(
        await this.service.createIbiConfig(req.body as CreateDepartmentIbiConfigDto, req.user!.id),
      );
    } catch (e) { next(e); }
  };

  updateIbiConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(
        await this.service.updateIbiConfig(
          Number(req.params["id"]),
          req.body as UpdateDepartmentIbiConfigDto,
          req.user!.id,
        ),
      );
    } catch (e) { next(e); }
  };

  deleteIbiConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteIbiConfig(Number(req.params["id"]));
      res.status(204).send();
    } catch (e) { next(e); }
  };

  // SeasonComplianceCheck
  getComplianceCheck = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await this.service.getComplianceCheck(Number(req.params["seasonId"]))); } catch (e) { next(e); }
  };

  upsertComplianceCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(
        await this.service.upsertComplianceCheck(
          Number(req.params["seasonId"]),
          req.body as UpsertSeasonComplianceCheckDto,
          req.user!.id,
        ),
      );
    } catch (e) { next(e); }
  };

  // ComplianceDeadline
  listComplianceDeadlines = async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json(await this.service.listComplianceDeadlines()); } catch (e) { next(e); }
  };

  createComplianceDeadline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.service.createComplianceDeadline(req.body as CreateComplianceDeadlineDto));
    } catch (e) { next(e); }
  };

  updateComplianceDeadline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(
        await this.service.updateComplianceDeadline(
          Number(req.params["id"]),
          req.body as UpdateComplianceDeadlineDto,
        ),
      );
    } catch (e) { next(e); }
  };

  deleteComplianceDeadline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteComplianceDeadline(Number(req.params["id"]));
      res.status(204).send();
    } catch (e) { next(e); }
  };
}
```

- [x] **Step 2: Routes 파일 작성**

```typescript
import { Router } from "express";
import passport from "passport";
import { getPrisma } from "../lib/prisma";
import { HiringAutomationRepository } from "./hiring-automation.repo";
import { HiringAutomationService } from "./hiring-automation.service";
import { HiringAutomationController } from "./hiring-automation.controller";
import { AppError } from "../lib/appError";

const router = Router();
const auth = passport.authenticate("accessToken", { session: false });
const repo = new HiringAutomationRepository(getPrisma());
const service = new HiringAutomationService(repo);
const controller = new HiringAutomationController(service);

const requireAdmin = (req: any, _res: any, next: any) => {
  if (req.user?.role === "ADMIN") return next();
  next(new AppError(403, "FORBIDDEN"));
};

const requireHRorGMorAdmin = (req: any, _res: any, next: any) => {
  const { role, frontOfficeRole } = req.user ?? {};
  if (role === "ADMIN") return next();
  if (role === "FRONT_OFFICE" && (frontOfficeRole === "GM" || frontOfficeRole === "HR_MANAGER"))
    return next();
  next(new AppError(403, "FORBIDDEN"));
};

const requireHRManager = (req: any, _res: any, next: any) => {
  const { role, frontOfficeRole } = req.user ?? {};
  if (role === "ADMIN") return next();
  if (role === "FRONT_OFFICE" && frontOfficeRole === "HR_MANAGER") return next();
  next(new AppError(403, "FORBIDDEN"));
};

// LeagueLevelWeightConfig
router.get("/league-weights", auth, requireHRorGMorAdmin, controller.listLeagueWeights);
router.put("/league-weights/:leagueLevel/:category", auth, requireAdmin, controller.upsertLeagueWeight);

// DepartmentIbiConfig
router.get("/ibi-configs", auth, requireHRorGMorAdmin, controller.listIbiConfigs);
router.post("/ibi-configs", auth, requireHRManager, controller.createIbiConfig);
router.patch("/ibi-configs/:id", auth, requireHRManager, controller.updateIbiConfig);
router.delete("/ibi-configs/:id", auth, requireHRManager, controller.deleteIbiConfig);

// SeasonComplianceCheck
router.get("/compliance-checks/:seasonId", auth, requireHRorGMorAdmin, controller.getComplianceCheck);
router.put("/compliance-checks/:seasonId", auth, requireHRManager, controller.upsertComplianceCheck);

// ComplianceDeadline
router.get("/compliance-deadlines", auth, requireHRorGMorAdmin, controller.listComplianceDeadlines);
router.post("/compliance-deadlines", auth, requireAdmin, controller.createComplianceDeadline);
router.patch("/compliance-deadlines/:id", auth, requireAdmin, controller.updateComplianceDeadline);
router.delete("/compliance-deadlines/:id", auth, requireAdmin, controller.deleteComplianceDeadline);

export default router;
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/hiring-automation/
git commit -m "feat: hiring-automation controller and routes"
```

---

## Task 10: HiringPriorityQueue — hr-report에 추가

**Files:**
- Modify: `apps/api/src/hr-report/hr-report.service.ts`
- Modify: `apps/api/src/hr-report/hr-report.controller.ts`
- Modify: `apps/api/src/hr-report/hr-report.routes.ts`

- [x] **Step 1: hr-report.service.ts에 getHiringPriorityQueue 추가**

`apps/api/src/hr-report/hr-report.service.ts` 파일 맨 위 import 추가:
```typescript
import type { PrismaClient } from "../generated/client";
import { HiringAutomationRepository } from "../hiring-automation/hiring-automation.repo";
import { HiringAutomationService } from "../hiring-automation/hiring-automation.service";
```

`HrReportService` 생성자와 `getAnnual` 이후에 아래 메서드 추가:
```typescript
async getHiringPriorityQueue(prisma: PrismaClient) {
  const season = await prisma.season.findFirst({ where: { status: "ACTIVE" } });
  if (!season?.leagueLevel) throw new Error("NO_ACTIVE_SEASON");

  const settings = await prisma.clubSettings.findFirst();
  const ibiBeta = settings?.ibiBeta ?? 1.0;

  const autoRepo = new HiringAutomationRepository(prisma);
  const autoService = new HiringAutomationService(autoRepo);
  return autoService.computePriorityQueue(
    { id: season.id, leagueLevel: season.leagueLevel as any },
    ibiBeta,
  );
}
```

- [x] **Step 2: hr-report.controller.ts에 핸들러 추가**

`HrReportController`에 아래 추가:
```typescript
import type { PrismaClient } from "../generated/client";
import { getPrisma } from "../lib/prisma";

getHiringPriorityQueue = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await this.service.getHiringPriorityQueue(getPrisma()));
  } catch (err) {
    next(err);
  }
};
```

- [x] **Step 3: hr-report.routes.ts에 라우트 추가**

기존 `router.get("/annual", ...)` 이후에 추가:
```typescript
router.get("/hiring-priority", auth, requireHR, controller.getHiringPriorityQueue);
```

단, `requireHR`의 조건을 HR_MANAGER도 포함하도록 수정:
```typescript
const requireHR = (req: any, res: any, next: any) => {
  const { role, frontOfficeRole } = req.user as any;
  if (role === "ADMIN") return next();
  if (
    role === "FRONT_OFFICE" &&
    (frontOfficeRole === "GM" || frontOfficeRole === "TD" || frontOfficeRole === "HR_MANAGER")
  )
    return next();
  res.status(403).json({ message: "Forbidden" });
};
```

- [x] **Step 4: Commit**

```bash
git add apps/api/src/hr-report/
git commit -m "feat: GET /hr-reports/hiring-priority for on-demand priority queue"
```

---

## Task 11: 분기 Cron — JobPosting 자동 초안 생성

**Files:**
- Create: `apps/api/src/jobs/quarterlyJobPostingDraft.ts`

- [x] **Step 1: Cron 파일 작성**

```typescript
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { HiringAutomationRepository } from "../hiring-automation/hiring-automation.repo";
import { HiringAutomationService } from "../hiring-automation/hiring-automation.service";

const TOP_N = 3;

export function startQuarterlyJobPostingDraftJob() {
  // 매 분기 첫째 날 오전 9시 (1월·4월·7월·10월 1일)
  cron.schedule("0 9 1 1,4,7,10 *", async () => {
    const prisma = getPrisma();

    const season = await prisma.season.findFirst({ where: { status: "ACTIVE" } });
    if (!season?.leagueLevel) return;

    const settings = await prisma.clubSettings.findFirst();
    const ibiBeta = settings?.ibiBeta ?? 1.0;

    const autoRepo = new HiringAutomationRepository(prisma);
    const autoService = new HiringAutomationService(autoRepo);

    const queue = await autoService.computePriorityQueue(
      { id: season.id, leagueLevel: season.leagueLevel as any },
      ibiBeta,
    );

    // HIGH_PRIORITY + 상위 N개 선정
    const highPriority = queue.queue.filter((q) => q.highPriority);
    const topN = queue.queue.slice(0, TOP_N);
    const selected = [...new Map([...highPriority, ...topN].map((q) => [q.departmentId, q])).values()];

    const systemUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!systemUser) return;

    for (const item of selected) {
      // 이미 DRAFT/OPEN 공고가 있는 부서는 건너뜀
      const existing = await autoRepo.getActiveJobPostingsForDepartment(item.departmentId);
      if (existing.length > 0) continue;

      const draft = await autoRepo.createJobPostingDraft({
        title: `${item.departmentName} 채용`,
        departmentId: item.departmentId,
        headcount: 1,
        description: `현재 시즌(${season.leagueLevel}) 기준 채용 공고 자동 초안`,
        createdById: systemUser.id,
      });

      // HR_MANAGER·GM에게 알림
      const recipients = await prisma.user.findMany({
        where: {
          role: "FRONT_OFFICE",
          frontOfficeRole: { in: ["HR_MANAGER", "GM"] },
          isDeleted: false,
        },
        select: { id: true },
      });

      if (recipients.length > 0) {
        await prisma.notification.createMany({
          data: recipients.map((r) => ({
            userId: r.id,
            type: "JOB_POSTING_DRAFT_CREATED" as any,
            message: `채용 공고 자동 초안이 생성되었습니다: ${draft.title}`,
            relatedId: draft.id,
          })),
        });
      }
    }
  });
}
```

- [x] **Step 2: server.ts에서 cron 등록**

`apps/api/src/server.ts`에서 기존 cron 등록 패턴 참고하여 import 및 호출 추가:
```typescript
import { startQuarterlyJobPostingDraftJob } from "./jobs/quarterlyJobPostingDraft";
// ... 기존 startXxxJob() 호출들 이후
startQuarterlyJobPostingDraftJob();
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/jobs/quarterlyJobPostingDraft.ts apps/api/src/server.ts
git commit -m "feat: quarterly cron for auto JobPosting draft generation"
```

---

## Task 12: apiRouter에 hiring-automation 등록

**Files:**
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: import 추가**

`apps/api/src/apiRouter.ts`에서 기존 import들 마지막에 추가:
```typescript
import hiringAutomationRouter from "./hiring-automation/hiring-automation.routes";
```

- [x] **Step 2: 라우터 등록**

기존 `apiRouter.use("/payroll", payrollRouter);` 이후에 추가:
```typescript
apiRouter.use("/hiring-automation", hiringAutomationRouter);
```

- [x] **Step 3: 빌드 확인**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit 2>&1 | head -30
```

Expected: 오류 없음

- [x] **Step 4: Commit**

```bash
git add apps/api/src/apiRouter.ts
git commit -m "feat: register hiring-automation router"
```

---

## Task 13: hiring-automation Service 테스트

**Files:**
- Create: `apps/api/__test__/hiring-automation/hiring-automation.service.test.ts`

- [x] **Step 1: 테스트 파일 작성**

```typescript
import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { HiringAutomationService } from "../../src/hiring-automation/hiring-automation.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  listLeagueWeights: jest.fn(),
  upsertLeagueWeight: jest.fn(),
  listIbiConfigs: jest.fn(),
  findIbiConfigById: jest.fn(),
  createIbiConfig: jest.fn(),
  updateIbiConfig: jest.fn(),
  deleteIbiConfig: jest.fn(),
  findComplianceCheck: jest.fn(),
  upsertComplianceCheck: jest.fn(),
  listComplianceDeadlines: jest.fn(),
  findComplianceDeadlineById: jest.fn(),
  createComplianceDeadline: jest.fn(),
  updateComplianceDeadline: jest.fn(),
  deleteComplianceDeadline: jest.fn(),
  getActiveComplianceDeadlineNearby: jest.fn(),
  getLeagueWeightMap: jest.fn(),
  getAllIbiConfigs: jest.fn(),
  getSeasonComplianceCheck: jest.fn(),
  checkAutoCompliance: jest.fn(),
  getActiveJobPostingsForDepartment: jest.fn(),
  createJobPostingDraft: jest.fn(),
} as any;

const service = new HiringAutomationService(mockRepo);

beforeEach(() => jest.clearAllMocks());

describe("upsertLeagueWeight", () => {
  test("weight가 0~1 범위를 벗어나면 400을 던진다", async () => {
    await expect(service.upsertLeagueWeight("K3" as any, "COMPLIANCE" as any, { weight: 1.5 }))
      .rejects.toMatchObject({ statusCode: 400, code: "INVALID_WEIGHT" });
  });

  test("유효한 weight이면 repo.upsertLeagueWeight를 호출한다", async () => {
    mockRepo.upsertLeagueWeight.mockResolvedValue({ weight: 0.28 });
    await service.upsertLeagueWeight("K3" as any, "COMPLIANCE" as any, { weight: 0.28 });
    expect(mockRepo.upsertLeagueWeight).toHaveBeenCalledWith("K3", "COMPLIANCE", { weight: 0.28 });
  });
});

describe("createIbiConfig", () => {
  test("coreTaskRatio가 범위를 벗어나면 400을 던진다", async () => {
    await expect(
      service.createIbiConfig({ departmentId: 1, jobTitle: "HR", coreTaskRatio: 1.5, replacementDays: 30, backupHeadcount: 0 }, 99),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_CORE_TASK_RATIO" });
  });
});

describe("getIbiConfig", () => {
  test("존재하지 않으면 404를 던진다", async () => {
    mockRepo.findIbiConfigById.mockResolvedValue(null);
    await expect(service.getIbiConfig(999)).rejects.toMatchObject({ statusCode: 404, code: "IBI_CONFIG_NOT_FOUND" });
  });
});

describe("createComplianceDeadline", () => {
  test("betaMultiplier가 0 이하면 400을 던진다", async () => {
    await expect(
      service.createComplianceDeadline({ name: "test", deadlineDate: "2026-12-01", triggerDaysBefore: 30, betaMultiplier: 0 }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_BETA_MULTIPLIER" });
  });
});

describe("computePriorityQueue", () => {
  test("규정 위반 없는 정상 케이스에서 점수를 계산한다", async () => {
    mockRepo.getAllIbiConfigs.mockResolvedValue([
      {
        departmentId: 1,
        coreTaskRatio: 0.8,
        replacementDays: 30,
        backupHeadcount: 1,
        department: { id: 1, name: "인사팀", category: "COMPLIANCE" },
      },
    ]);
    mockRepo.getLeagueWeightMap.mockResolvedValue([{ category: "COMPLIANCE", weight: 0.28 }]);
    mockRepo.checkAutoCompliance.mockResolvedValue({
      playerCount: 20,
      coachingCount: 6,
      medicalCount: 2,
      youthTeamCount: 1,
    });
    mockRepo.getSeasonComplianceCheck.mockResolvedValue({
      afcQualificationMet: true,
      officeStaffCountMet: true,
    });
    mockRepo.getActiveComplianceDeadlineNearby.mockResolvedValue(null);

    const result = await service.computePriorityQueue({ id: 1, leagueLevel: "K3" as any }, 1.0);

    // IBI = (0.8 * 30) / (1 + 1) = 12, score = 0 + 0.28 + 1.0 * 12 = 12.28
    expect(result.queue[0]!.score).toBe(12.28);
    expect(result.complianceViolation).toBe(false);
    expect(result.queue[0]!.highPriority).toBe(false);
  });

  test("규정 위반 시 COMPLIANCE 카테고리 부서가 highPriority를 받는다", async () => {
    mockRepo.getAllIbiConfigs.mockResolvedValue([
      {
        departmentId: 1,
        coreTaskRatio: 0.5,
        replacementDays: 10,
        backupHeadcount: 0,
        department: { id: 1, name: "인사팀", category: "COMPLIANCE" },
      },
    ]);
    mockRepo.getLeagueWeightMap.mockResolvedValue([{ category: "COMPLIANCE", weight: 0.28 }]);
    mockRepo.checkAutoCompliance.mockResolvedValue({
      playerCount: 10, // MIN_PLAYERS(18) 미달
      coachingCount: 6,
      medicalCount: 1,
      youthTeamCount: 1,
    });
    mockRepo.getSeasonComplianceCheck.mockResolvedValue(null);
    mockRepo.getActiveComplianceDeadlineNearby.mockResolvedValue(null);

    const result = await service.computePriorityQueue({ id: 1, leagueLevel: "K3" as any }, 1.0);

    expect(result.complianceViolation).toBe(true);
    expect(result.queue[0]!.highPriority).toBe(true);
    expect(result.queue[0]!.score).toBeGreaterThan(9000);
  });

  test("ComplianceDeadline이 triggerDaysBefore 이내이면 β_eff에 multiplier가 적용된다", async () => {
    mockRepo.getAllIbiConfigs.mockResolvedValue([
      {
        departmentId: 1,
        coreTaskRatio: 1.0,
        replacementDays: 10,
        backupHeadcount: 0,
        department: { id: 1, name: "재무팀", category: "FINANCE" },
      },
    ]);
    mockRepo.getLeagueWeightMap.mockResolvedValue([{ category: "FINANCE", weight: 0.23 }]);
    mockRepo.checkAutoCompliance.mockResolvedValue({ playerCount: 20, coachingCount: 6, medicalCount: 1, youthTeamCount: 1 });
    mockRepo.getSeasonComplianceCheck.mockResolvedValue({ afcQualificationMet: true, officeStaffCountMet: true });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5); // 5일 후
    mockRepo.getActiveComplianceDeadlineNearby.mockResolvedValue({
      deadlineDate: futureDate,
      triggerDaysBefore: 30, // 5 ≤ 30 이므로 발동
      betaMultiplier: { toNumber: () => 3.0, toString: () => "3.0", valueOf: () => 3.0 }, // Decimal mock
    });

    const result = await service.computePriorityQueue({ id: 1, leagueLevel: "K3" as any }, 1.0);

    // β_eff = 1.0 * 3.0 = 3.0, IBI = 10, score = 0.23 + 3.0*10 = 30.23
    expect(result.betaEff).toBe(3);
  });
});
```

- [x] **Step 2: 테스트 실행**

```bash
cd /Users/juno/work/football
npx jest __test__/hiring-automation/hiring-automation.service.test.ts --no-coverage
```

Expected: 7 tests passed

- [x] **Step 3: 전체 테스트 스위트 확인**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: 기존 테스트 모두 통과 + 새 테스트 추가

- [x] **Step 4: Commit**

```bash
git add apps/api/__test__/hiring-automation/
git commit -m "test: hiring-automation service priority queue coverage"
```

---

## Self-Review

### Spec Coverage
| 요구사항 | 구현 Task |
|---------|-----------|
| SCREENING via PATCH | Task 2 |
| scheduleInterview → INTERVIEW_1/2 자동 | Task 2 |
| createReferenceCheck → REFERENCE_CHECK 자동 | Task 2 |
| ibiBeta 마이그레이션 | Task 1 |
| ibiBeta API 노출 | Task 5 |
| Department.category CRUD | Task 4 |
| LeagueLevelWeightConfig CRUD | Task 7·9 |
| DepartmentIbiConfig CRUD | Task 7·9 |
| SeasonComplianceCheck CRUD | Task 7·9 |
| ComplianceDeadline CRUD | Task 7·9 |
| GET /hr-reports/hiring-priority | Task 10 |
| 분기 cron 자동 초안 생성 (상위 3개 + HIGH_PRIORITY) | Task 11 |
| RecruitmentService 상태 전환 테스트 | Task 3 |
| HiringAutomationService 테스트 | Task 13 |
| apiRouter 등록 | Task 12 |

### 알림 타입 (`JOB_POSTING_DRAFT_CREATED`)
Task 11 cron에서 `type: "JOB_POSTING_DRAFT_CREATED"` 알림을 사용합니다. 이 타입이 `NotificationType` enum에 없을 경우 Prisma 에러가 발생합니다. **실행 전 `prisma/schema.prisma`의 NotificationType에 추가하고 마이그레이션 실행 필요** — Task 1과 동시 처리 권장:
```prisma
JOB_POSTING_DRAFT_CREATED
```

### betaMultiplier Decimal 처리
`ComplianceDeadline.betaMultiplier`는 Prisma `Decimal` 타입입니다. `Number(nearbyDeadline.betaMultiplier)`로 변환하는 코드가 Task 8 Service에 있습니다. 테스트에서 `{ toNumber: () => 3.0 }` mock이 필요합니다.
