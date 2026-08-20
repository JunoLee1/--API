# HR 채용 연간 계획 워크플로우 — 백엔드 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 채용 수요 조사(HiringNeedsSurvey) → 계획 항목(HiringPlanItem) → PlanReport(HR) 승인 → 채용공고 등록 백엔드 플로우 구현

**Architecture:** 새 `hiring-survey` 모듈이 조사 생명주기(OPEN→CLOSED)와 자동 변환을 담당한다. HiringPlanItem CRUD는 `plan-report` 모듈에 추가한다. 기존 `PlanReport`, `JobPosting` 모델에 FK를 추가한다.

**Tech Stack:** Prisma (PostgreSQL), Express, node-cron, Jest

**Spec:** `docs/superpowers/specs/2026-08-13-hiring-survey-annual-plan-design.md`

---

## 파일 구조

```
apps/api/prisma/schema.prisma                          ← 수정: 신규 모델 4개 + enum 2개 + FK 2개 + NotificationType 4개
apps/api/src/hiring-survey/
  dto/hiring-survey.dto.ts                             ← 신규
  hiring-survey.repo.ts                                ← 신규
  hiring-survey.service.ts                             ← 신규
  hiring-survey.controller.ts                          ← 신규
  hiring-survey.routes.ts                              ← 신규
apps/api/src/plan-report/
  plan-report.service.ts                               ← 수정: resolveApproverLevel + HIRING_PLAN_APPROVED 알림
  plan-report.repo.ts                                  ← 수정: createDraftForSurvey, hiringPlanItem CRUD
  plan-report.routes.ts                                ← 수정: hiring-items 엔드포인트 추가
  plan-report.controller.ts                            ← 수정: hiring-items 핸들러 추가
apps/api/src/recruitment/
  dto/recruitment.dto.ts                               ← 수정: CreateJobPostingDto에 hiringPlanItemId 추가
  recruitment.repo.ts                                  ← 수정: createPosting에 hiringPlanItemId 전달
apps/api/src/notification/notification.repo.ts         ← 수정: createForHrManager() 추가
apps/api/src/jobs/hiringSurveyReminder.ts             ← 신규: D-3 미응답 리마인더 cron
apps/api/src/server.ts                                 ← 수정: cron 등록
apps/api/__test__/hiring-survey/hiring-survey.service.test.ts ← 신규
```

---

## Task 1: Prisma 스키마 변경 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: NotificationType enum에 4개 값 추가**

`NotificationType` enum을 찾아 끝에 추가:
```prisma
  HIRING_SURVEY_OPEN
  HIRING_SURVEY_DEADLINE_REMINDER
  HIRING_SURVEY_CLOSED
  HIRING_PLAN_APPROVED
```

- [x] **Step 2: SurveyStatus, SurveyPriority enum 추가**

`PlanStatus` enum 아래에 추가:
```prisma
enum SurveyStatus {
  OPEN
  CLOSED
}

enum SurveyPriority {
  HIGH
  MEDIUM
  LOW
}
```

- [x] **Step 3: HiringNeedsSurvey 모델 추가**

`PlanReport` 모델 아래에 추가:
```prisma
model HiringNeedsSurvey {
  id          Int          @id @default(autoincrement())
  title       String
  deadlineAt  DateTime
  status      SurveyStatus @default(OPEN)
  createdById Int
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  createdBy         User               @relation("SurveyCreatedBy", fields: [createdById], references: [id])
  targetDepartments SurveyTargetDept[]
  responses         SurveyResponse[]
  planReport        PlanReport?
}

model SurveyTargetDept {
  surveyId     Int
  departmentId Int

  survey     HiringNeedsSurvey @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  department Department        @relation("SurveyTargetDept", fields: [departmentId], references: [id])

  @@id([surveyId, departmentId])
}

model SurveyResponse {
  id              Int            @id @default(autoincrement())
  surveyId        Int
  departmentId    Int
  roleTitle       String
  headcount       Int
  quarter         Int?
  priority        SurveyPriority
  estimatedBudget Int?
  reason          String
  submittedById   Int
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  survey         HiringNeedsSurvey @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  department     Department        @relation("SurveyResponse", fields: [departmentId], references: [id])
  submittedBy    User              @relation("SurveyResponseSubmitter", fields: [submittedById], references: [id])
  hiringPlanItem HiringPlanItem?

  @@unique([surveyId, departmentId])
}

model HiringPlanItem {
  id               Int            @id @default(autoincrement())
  planReportId     Int
  surveyResponseId Int?           @unique
  roleTitle        String
  headcount        Int
  quarter          Int?
  priority         SurveyPriority
  estimatedBudget  Int?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  planReport     PlanReport      @relation(fields: [planReportId], references: [id], onDelete: Cascade)
  surveyResponse SurveyResponse? @relation(fields: [surveyResponseId], references: [id])
  jobPostings    JobPosting[]
}
```

- [x] **Step 4: PlanReport 모델에 surveyId + hiringPlanItems 추가**

`PlanReport` 모델에 필드/관계 추가:
```prisma
// 기존 필드들 아래에 추가
  surveyId        Int?            @unique

// 기존 relations 아래에 추가
  survey          HiringNeedsSurvey? @relation(fields: [surveyId], references: [id])
  hiringPlanItems HiringPlanItem[]
```

- [x] **Step 5: JobPosting 모델에 hiringPlanItemId 추가**

`JobPosting` 모델에:
```prisma
// 기존 필드들 아래에 추가
  hiringPlanItemId Int?

// 기존 relations 아래에 추가
  hiringPlanItem   HiringPlanItem? @relation(fields: [hiringPlanItemId], references: [id])
```

- [x] **Step 6: User 모델에 역관계 추가**

`User` 모델에 추가:
```prisma
  createdSurveys       HiringNeedsSurvey[] @relation("SurveyCreatedBy")
  surveyResponses      SurveyResponse[]    @relation("SurveyResponseSubmitter")
```

- [x] **Step 7: Department 모델에 역관계 추가**

`Department` 모델에 추가:
```prisma
  surveyTargets    SurveyTargetDept[] @relation("SurveyTargetDept")
  surveyResponses  SurveyResponse[]   @relation("SurveyResponse")
```

- [x] **Step 8: 마이그레이션 실행**

```bash
cd apps/api
npx prisma migrate dev --name add_hiring_survey_flow
```

Expected: `✔ Generated Prisma Client` 출력, 마이그레이션 파일 생성

- [x] **Step 9: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(prisma): add HiringNeedsSurvey, SurveyResponse, HiringPlanItem models"
```

---

## Task 2: NotificationRepository.createForHrManager() 추가

**Files:**
- Modify: `apps/api/src/notification/notification.repo.ts`

- [x] **Step 1: createForHrManager 메서드 추가**

`createForAdmin` 메서드 아래에 추가:
```typescript
createForHrManager(type: string, getMsg: MsgFactory, entityId?: number) {
  return this.prisma.$transaction(async (tx) => {
    const hrManagers = await tx.user.findMany({
      where: { role: 'FRONT_OFFICE', frontOfficeRole: 'HR_MANAGER', isDeleted: false },
      select: { id: true, language: true },
    })
    if (hrManagers.length === 0) return
    await tx.notification.createMany({
      data: hrManagers.map((u) => {
        const { title, body } = getMsg(u.language)
        return { userId: u.id, type, title, body, entityId }
      }) as any,
    })
  })
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/notification/notification.repo.ts
git commit -m "feat(notification): add createForHrManager helper"
```

---

## Task 3: plan-report.service.ts — HR 승인 레벨 + HIRING_PLAN_APPROVED 알림

**Files:**
- Modify: `apps/api/src/plan-report/plan-report.service.ts`

- [x] **Step 1: resolveApproverLevel에 HR 분기 추가**

`resolveApproverLevel` 함수 첫 번째 분기로 추가:
```typescript
function resolveApproverLevel(
  plan: { templateType: string; budget: number; isNewBusiness: boolean },
  limit: number
): string | null {
  if (plan.templateType === 'HR') return 'ADMIN'   // HR 연간 계획은 항상 구단주 승인
  if (plan.isNewBusiness) return 'ADMIN'
  if (plan.budget > limit) return 'GM'
  return null
}
```

`submit()` 메서드의 `resolveApproverLevel` 호출을 plan 객체를 넘기도록 변경:
```typescript
const requiredApproverLevel = resolveApproverLevel(
  { templateType: plan.templateType, budget: plan.budget, isNewBusiness: plan.isNewBusiness },
  settings.planApprovalLimit
)
```

- [x] **Step 2: approve()에 HIRING_PLAN_APPROVED 알림 추가**

`PlanReportService` 생성자에 `NotificationRepository` 추가:
```typescript
export class PlanReportService {
  constructor(
    private repo: PlanReportRepository,
    private notifRepo?: NotificationRepository,
  ) {}
```

`approve()` 메서드 끝에 알림 추가:
```typescript
  async approve(id: number, userId: number, userRole: string) {
    // ... 기존 로직 유지 ...
    const result = await this.repo.approve(id, userId, vaultPath)

    if (plan.templateType === 'HR' && this.notifRepo) {
      void this.notifRepo.createForHrManager(
        'HIRING_PLAN_APPROVED',
        () => ({ title: '채용 계획서 승인 완료', body: `"${plan.title}" 채용 계획서가 승인됐습니다. 채용공고를 등록할 수 있습니다.` }),
        id,
      ).catch(console.error)
    }

    return result
  }
```

- [x] **Step 3: plan-report.routes.ts에서 NotificationRepository 주입**

`apps/api/src/plan-report/plan-report.routes.ts`에서:
```typescript
import { NotificationRepository } from '../notification/notification.repo'

const notifRepo = new NotificationRepository(prisma)
const service = new PlanReportService(repo, notifRepo)
```

- [x] **Step 4: Commit**

```bash
git add apps/api/src/plan-report/plan-report.service.ts apps/api/src/plan-report/plan-report.routes.ts
git commit -m "feat(plan-report): HR always requires ADMIN approval + HIRING_PLAN_APPROVED notification"
```

---

## Task 4: hiring-survey DTO + Repository

**Files:**
- Create: `apps/api/src/hiring-survey/dto/hiring-survey.dto.ts`
- Create: `apps/api/src/hiring-survey/hiring-survey.repo.ts`

- [x] **Step 1: DTO 파일 작성**

`apps/api/src/hiring-survey/dto/hiring-survey.dto.ts`:
```typescript
export type SurveyPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface CreateHiringSurveyDto {
  title: string
  deadlineAt: string
  targetDeptIds: number[]
}

export interface CreateSurveyResponseDto {
  roleTitle: string
  headcount: number
  quarter?: number      // 1~4
  priority: SurveyPriority
  estimatedBudget?: number
  reason: string
}

export interface CreateHiringPlanItemDto {
  roleTitle: string
  headcount: number
  quarter?: number
  priority: SurveyPriority
  estimatedBudget?: number
}

export interface UpdateHiringPlanItemDto {
  roleTitle?: string
  headcount?: number
  quarter?: number | null
  priority?: SurveyPriority
  estimatedBudget?: number | null
}
```

- [x] **Step 2: Repository 파일 작성**

`apps/api/src/hiring-survey/hiring-survey.repo.ts`:
```typescript
import type { PrismaClient } from '../generated/client'
import type { CreateHiringSurveyDto, CreateSurveyResponseDto } from './dto/hiring-survey.dto'

const SURVEY_INCLUDE = {
  createdBy: { select: { id: true, username: true } },
  targetDepartments: {
    include: { department: { select: { id: true, name: true, headId: true } } },
  },
  responses: {
    include: {
      department: { select: { id: true, name: true } },
      submittedBy: { select: { id: true, username: true } },
    },
  },
} as const

export class HiringSurveyRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.hiringNeedsSurvey.findMany({
      include: SURVEY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: number) {
    return this.prisma.hiringNeedsSurvey.findUnique({ where: { id }, include: SURVEY_INCLUDE })
  }

  create(dto: CreateHiringSurveyDto, createdById: number) {
    return this.prisma.hiringNeedsSurvey.create({
      data: {
        title: dto.title,
        deadlineAt: new Date(dto.deadlineAt),
        createdById,
        targetDepartments: {
          create: dto.targetDeptIds.map((departmentId) => ({ departmentId })),
        },
      },
      include: SURVEY_INCLUDE,
    })
  }

  close(id: number) {
    return this.prisma.hiringNeedsSurvey.update({
      where: { id },
      data: { status: 'CLOSED' },
    })
  }

  findOpenPastDeadline() {
    return this.prisma.hiringNeedsSurvey.findMany({
      where: { status: 'OPEN', deadlineAt: { lte: new Date() } },
      include: SURVEY_INCLUDE,
    })
  }

  findOpenNearDeadline(targetDate: Date) {
    const start = new Date(targetDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(targetDate)
    end.setHours(23, 59, 59, 999)
    return this.prisma.hiringNeedsSurvey.findMany({
      where: { status: 'OPEN', deadlineAt: { gte: start, lte: end } },
      include: SURVEY_INCLUDE,
    })
  }

  upsertResponse(
    surveyId: number,
    departmentId: number,
    submittedById: number,
    dto: CreateSurveyResponseDto,
  ) {
    return this.prisma.surveyResponse.upsert({
      where: { surveyId_departmentId: { surveyId, departmentId } },
      create: { surveyId, departmentId, submittedById, ...dto },
      update: { ...dto, submittedById },
    })
  }

  findResponsesBySurvey(surveyId: number) {
    return this.prisma.surveyResponse.findMany({ where: { surveyId } })
  }
}
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/hiring-survey/
git commit -m "feat(hiring-survey): add DTO and Repository"
```

---

## Task 5: hiring-survey.service.ts

**Files:**
- Create: `apps/api/src/hiring-survey/hiring-survey.service.ts`

- [x] **Step 1: 서비스 파일 작성**

`apps/api/src/hiring-survey/hiring-survey.service.ts`:
```typescript
import { AppError } from '../lib/appError'
import { NotificationRepository } from '../notification/notification.repo'
import { PlanReportRepository } from '../plan-report/plan-report.repo'
import { HiringSurveyRepository } from './hiring-survey.repo'
import type { CreateHiringSurveyDto, CreateSurveyResponseDto } from './dto/hiring-survey.dto'

export class HiringSurveyService {
  constructor(
    private repo: HiringSurveyRepository,
    private planReportRepo: PlanReportRepository,
    private notifRepo: NotificationRepository,
  ) {}

  list() {
    return this.repo.findAll()
  }

  async getById(id: number) {
    const survey = await this.repo.findById(id)
    if (!survey) throw new AppError(404, 'SURVEY_NOT_FOUND')
    return survey
  }

  async create(dto: CreateHiringSurveyDto, createdById: number) {
    if (!dto.title?.trim()) throw new AppError(400, 'TITLE_REQUIRED')
    if (!dto.deadlineAt) throw new AppError(400, 'DEADLINE_REQUIRED')
    if (!dto.targetDeptIds?.length) throw new AppError(400, 'TARGET_DEPTS_REQUIRED')

    const survey = await this.repo.create(dto, createdById)

    // 대상 부서장 알림
    const headIds = survey.targetDepartments
      .map((t) => t.department.headId)
      .filter((id): id is number => id !== null)

    await Promise.all(
      headIds.map((userId) =>
        this.notifRepo.create({
          userId,
          type: 'HIRING_SURVEY_OPEN',
          title: '채용 수요 조사 참여 요청',
          body: `"${survey.title}" 채용 수요 조사에 응답해 주세요. 마감일: ${new Date(dto.deadlineAt).toLocaleDateString('ko-KR')}`,
          entityId: survey.id,
        })
      )
    )

    return survey
  }

  async submitResponse(
    surveyId: number,
    userId: number,
    dto: CreateSurveyResponseDto,
  ) {
    const survey = await this.getById(surveyId)
    if (survey.status !== 'OPEN') throw new AppError(409, 'SURVEY_NOT_OPEN')

    // 제출자가 대상 부서의 headId인지 확인
    const target = survey.targetDepartments.find((t) => t.department.headId === userId)
    if (!target) throw new AppError(403, 'NOT_TARGET_DEPARTMENT_HEAD')

    if (!dto.roleTitle?.trim()) throw new AppError(400, 'ROLE_TITLE_REQUIRED')
    if (!dto.headcount || dto.headcount < 1) throw new AppError(400, 'INVALID_HEADCOUNT')
    if (dto.quarter !== undefined && dto.quarter !== null && (dto.quarter < 1 || dto.quarter > 4)) {
      throw new AppError(400, 'INVALID_QUARTER')
    }

    return this.repo.upsertResponse(surveyId, target.departmentId, userId, dto)
  }

  async close(surveyId: number, closedByUserId: number) {
    const survey = await this.getById(surveyId)
    if (survey.status !== 'OPEN') throw new AppError(409, 'SURVEY_NOT_OPEN')

    await this.repo.close(surveyId)

    const responses = await this.repo.findResponsesBySurvey(surveyId)

    // PlanReport DRAFT 자동 생성
    const planReport = await this.planReportRepo.createDraftForSurvey({
      surveyId,
      createdById: closedByUserId,
      title: `${survey.title} — 연간 채용 계획서`,
    })

    // SurveyResponse → HiringPlanItem 변환
    if (responses.length > 0) {
      await this.planReportRepo.createHiringPlanItems(
        responses.map((r) => ({
          planReportId: planReport.id,
          surveyResponseId: r.id,
          roleTitle: r.roleTitle,
          headcount: r.headcount,
          quarter: r.quarter ?? undefined,
          priority: r.priority as any,
          estimatedBudget: r.estimatedBudget ?? undefined,
        }))
      )
    }

    // HR 매니저 알림
    void this.notifRepo.createForHrManager(
      'HIRING_SURVEY_CLOSED',
      () => ({
        title: '채용 수요 조사 마감',
        body: `"${survey.title}" 조사가 마감됐습니다. 계획 항목 ${responses.length}건이 생성됐습니다.`,
      }),
      surveyId,
    ).catch(console.error)

    return planReport
  }

  // cron에서 호출: deadlineAt 지난 OPEN 조사 자동 마감
  async autoCloseExpired(systemUserId: number) {
    const expired = await this.repo.findOpenPastDeadline()
    for (const survey of expired) {
      await this.close(survey.id, systemUserId).catch(console.error)
    }
  }

  // cron에서 호출: D-3 리마인더
  async sendDeadlineReminders() {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 3)

    const surveys = await this.repo.findOpenNearDeadline(targetDate)

    for (const survey of surveys) {
      const respondedDeptIds = new Set(survey.responses.map((r) => r.departmentId))
      const unrespondedHeadIds = survey.targetDepartments
        .filter((t) => !respondedDeptIds.has(t.departmentId))
        .map((t) => t.department.headId)
        .filter((id): id is number => id !== null)

      await Promise.all(
        unrespondedHeadIds.map((userId) =>
          this.notifRepo.create({
            userId,
            type: 'HIRING_SURVEY_DEADLINE_REMINDER',
            title: '채용 수요 조사 마감 D-3',
            body: `"${survey.title}" 채용 수요 조사 마감이 3일 남았습니다. 아직 응답하지 않으셨습니다.`,
            entityId: survey.id,
          })
        )
      )
    }
  }
}
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/hiring-survey/hiring-survey.service.ts
git commit -m "feat(hiring-survey): add HiringSurveyService with close + auto-conversion"
```

---

## Task 6: plan-report.repo.ts — createDraftForSurvey + HiringPlanItem CRUD

**Files:**
- Modify: `apps/api/src/plan-report/plan-report.repo.ts`

- [x] **Step 1: createDraftForSurvey 메서드 추가**

기존 `create` 메서드 아래에 추가:
```typescript
createDraftForSurvey(data: {
  surveyId: number
  createdById: number
  title: string
}) {
  return this.prisma.planReport.create({
    data: {
      title: data.title,
      purpose: '',
      startDate: new Date(),
      endDate: new Date(new Date().getFullYear(), 11, 31),
      budget: 0,
      expectedEffect: '',
      risks: '',
      resultDueDate: new Date(new Date().getFullYear(), 11, 31),
      templateType: 'HR',
      isNewBusiness: true,
      surveyId: data.surveyId,
      createdById: data.createdById,
      departmentId: (await this.prisma.department.findFirst({ where: { name: { contains: 'HR' } } }))?.id ?? 1,
    },
  })
}
```

- [x] **Step 2: HiringPlanItem CRUD 메서드 추가**

```typescript
listHiringPlanItems(planReportId: number) {
  return this.prisma.hiringPlanItem.findMany({
    where: { planReportId },
    include: { surveyResponse: { select: { id: true, departmentId: true } } },
    orderBy: { createdAt: 'asc' },
  })
}

createHiringPlanItem(planReportId: number, data: {
  roleTitle: string
  headcount: number
  quarter?: number
  priority: string
  estimatedBudget?: number
}) {
  return this.prisma.hiringPlanItem.create({
    data: { planReportId, ...data } as any,
  })
}

createHiringPlanItems(items: Array<{
  planReportId: number
  surveyResponseId: number
  roleTitle: string
  headcount: number
  quarter?: number
  priority: any
  estimatedBudget?: number
}>) {
  return this.prisma.hiringPlanItem.createMany({ data: items as any })
}

updateHiringPlanItem(id: number, planReportId: number, data: {
  roleTitle?: string
  headcount?: number
  quarter?: number | null
  priority?: string
  estimatedBudget?: number | null
}) {
  return this.prisma.hiringPlanItem.update({
    where: { id, planReportId },
    data: data as any,
  })
}

deleteHiringPlanItem(id: number, planReportId: number) {
  return this.prisma.hiringPlanItem.delete({ where: { id, planReportId } })
}
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/plan-report/plan-report.repo.ts
git commit -m "feat(plan-report): add createDraftForSurvey + HiringPlanItem CRUD methods"
```

---

## Task 7: hiring-survey controller + routes

**Files:**
- Create: `apps/api/src/hiring-survey/hiring-survey.controller.ts`
- Create: `apps/api/src/hiring-survey/hiring-survey.routes.ts`

- [x] **Step 1: Controller 작성**

`apps/api/src/hiring-survey/hiring-survey.controller.ts`:
```typescript
import type { Request, Response } from 'express'
import { HiringSurveyService } from './hiring-survey.service'

export class HiringSurveyController {
  constructor(private service: HiringSurveyService) {}

  list = async (_req: Request, res: Response) => {
    const surveys = await this.service.list()
    res.json(surveys)
  }

  get = async (req: Request, res: Response) => {
    const survey = await this.service.getById(Number(req.params.id))
    res.json(survey)
  }

  create = async (req: Request, res: Response) => {
    const userId = (req as any).user.id
    const survey = await this.service.create(req.body, userId)
    res.status(201).json(survey)
  }

  submitResponse = async (req: Request, res: Response) => {
    const userId = (req as any).user.id
    const result = await this.service.submitResponse(Number(req.params.id), userId, req.body)
    res.json(result)
  }

  close = async (req: Request, res: Response) => {
    const userId = (req as any).user.id
    const planReport = await this.service.close(Number(req.params.id), userId)
    res.json(planReport)
  }
}
```

- [x] **Step 2: Routes 작성**

`apps/api/src/hiring-survey/hiring-survey.routes.ts`:
```typescript
import { Router } from 'express'
import { auth } from '../lib/authMiddleware'
import { getPrisma } from '../lib/prisma'
import { HiringSurveyRepository } from './hiring-survey.repo'
import { HiringSurveyService } from './hiring-survey.service'
import { HiringSurveyController } from './hiring-survey.controller'
import { PlanReportRepository } from '../plan-report/plan-report.repo'
import { NotificationRepository } from '../notification/notification.repo'

const router = Router()
const prisma = getPrisma()
const repo = new HiringSurveyRepository(prisma)
const planReportRepo = new PlanReportRepository(prisma)
const notifRepo = new NotificationRepository(prisma)
const service = new HiringSurveyService(repo, planReportRepo, notifRepo)
const controller = new HiringSurveyController(service)

router.get('/', auth, controller.list)
router.post('/', auth, controller.create)
router.get('/:id', auth, controller.get)
router.post('/:id/respond', auth, controller.submitResponse)
router.post('/:id/close', auth, controller.close)

export default router
```

- [x] **Step 3: server.ts에 라우터 등록**

`apps/api/src/server.ts`에서 기존 라우터 등록 블록에 추가:
```typescript
import hiringSurveyRouter from './hiring-survey/hiring-survey.routes'
// ...
app.use('/api/hiring-surveys', hiringSurveyRouter)
```

- [x] **Step 4: Commit**

```bash
git add apps/api/src/hiring-survey/hiring-survey.controller.ts apps/api/src/hiring-survey/hiring-survey.routes.ts apps/api/src/server.ts
git commit -m "feat(hiring-survey): add controller, routes, register in server"
```

---

## Task 8: plan-report 라우터에 HiringPlanItem 엔드포인트 추가

**Files:**
- Modify: `apps/api/src/plan-report/plan-report.controller.ts`
- Modify: `apps/api/src/plan-report/plan-report.routes.ts`

- [x] **Step 1: PlanReportController에 HiringPlanItem 핸들러 추가**

`apps/api/src/plan-report/plan-report.controller.ts`에 추가:
```typescript
listHiringItems = async (req: Request, res: Response) => {
  const planId = Number(req.params.id)
  const items = await this.repo.listHiringPlanItems(planId)
  res.json(items)
}

createHiringItem = async (req: Request, res: Response) => {
  const planId = Number(req.params.id)
  const item = await this.repo.createHiringPlanItem(planId, req.body)
  res.status(201).json(item)
}

updateHiringItem = async (req: Request, res: Response) => {
  const planId = Number(req.params.id)
  const itemId = Number(req.params.itemId)
  const item = await this.repo.updateHiringPlanItem(itemId, planId, req.body)
  res.json(item)
}

deleteHiringItem = async (req: Request, res: Response) => {
  const planId = Number(req.params.id)
  const itemId = Number(req.params.itemId)
  await this.repo.deleteHiringPlanItem(itemId, planId)
  res.status(204).send()
}
```

`PlanReportController` 생성자에 `repo` 직접 접근을 위해 수정:
```typescript
export class PlanReportController {
  constructor(
    private service: PlanReportService,
    private repo: PlanReportRepository,
  ) {}
```

- [x] **Step 2: plan-report.routes.ts에 엔드포인트 추가**

```typescript
router.get('/:id/hiring-items', auth, controller.listHiringItems)
router.post('/:id/hiring-items', auth, controller.createHiringItem)
router.patch('/:id/hiring-items/:itemId', auth, controller.updateHiringItem)
router.delete('/:id/hiring-items/:itemId', auth, controller.deleteHiringItem)
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/plan-report/
git commit -m "feat(plan-report): add HiringPlanItem CRUD endpoints"
```

---

## Task 9: recruitment DTO + repo에 hiringPlanItemId 추가

**Files:**
- Modify: `apps/api/src/recruitment/dto/recruitment.dto.ts`
- Modify: `apps/api/src/recruitment/recruitment.repo.ts`

- [x] **Step 1: CreateJobPostingDto에 필드 추가**

`apps/api/src/recruitment/dto/recruitment.dto.ts`의 `CreateJobPostingDto`에:
```typescript
export interface CreateJobPostingDto {
  // ... 기존 필드 유지 ...
  planReportId?: number
  hiringPlanItemId?: number   // 추가
}
```

- [x] **Step 2: createPosting repo 메서드에 필드 전달 확인**

`apps/api/src/recruitment/recruitment.repo.ts`의 `createPosting`:
```typescript
createPosting(data: CreateJobPostingDto & { createdById: number }) {
  return this.prisma.jobPosting.create({ data: data as any, include: POSTING_INCLUDE })
}
```
`data as any`로 이미 처리되므로 `hiringPlanItemId`가 자동으로 전달된다. 변경 불필요.

- [x] **Step 3: Commit**

```bash
git add apps/api/src/recruitment/dto/recruitment.dto.ts
git commit -m "feat(recruitment): add hiringPlanItemId to CreateJobPostingDto"
```

---

## Task 10: D-3 리마인더 cron job

**Files:**
- Create: `apps/api/src/jobs/hiringSurveyReminder.ts`
- Modify: `apps/api/src/server.ts`

- [x] **Step 1: cron job 파일 작성**

`apps/api/src/jobs/hiringSurveyReminder.ts`:
```typescript
import cron from 'node-cron'
import { getPrisma } from '../lib/prisma'
import { HiringSurveyRepository } from '../hiring-survey/hiring-survey.repo'
import { HiringSurveyService } from '../hiring-survey/hiring-survey.service'
import { PlanReportRepository } from '../plan-report/plan-report.repo'
import { NotificationRepository } from '../notification/notification.repo'

export function startHiringSurveyReminderJob() {
  // 매일 오전 9시: D-3 미응답 리마인더 + 마감 지난 조사 자동 CLOSED
  cron.schedule('0 9 * * *', async () => {
    const prisma = getPrisma()
    const repo = new HiringSurveyRepository(prisma)
    const planReportRepo = new PlanReportRepository(prisma)
    const notifRepo = new NotificationRepository(prisma)
    const service = new HiringSurveyService(repo, planReportRepo, notifRepo)

    const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!systemUser) return

    await service.autoCloseExpired(systemUser.id)
    await service.sendDeadlineReminders()
  })
}
```

- [x] **Step 2: server.ts에 cron 등록**

```typescript
import { startHiringSurveyReminderJob } from './jobs/hiringSurveyReminder'
// ...
startHiringSurveyReminderJob()
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/jobs/hiringSurveyReminder.ts apps/api/src/server.ts
git commit -m "feat(jobs): add hiring survey D-3 reminder + auto-close cron"
```

---

## Task 11: HiringSurveyService 테스트

**Files:**
- Create: `apps/api/__test__/hiring-survey/hiring-survey.service.test.ts`

- [x] **Step 1: 테스트 파일 작성**

`apps/api/__test__/hiring-survey/hiring-survey.service.test.ts`:
```typescript
import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { HiringSurveyService } from '../../src/hiring-survey/hiring-survey.service'

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  close: jest.fn(),
  findOpenPastDeadline: jest.fn(),
  findOpenNearDeadline: jest.fn(),
  upsertResponse: jest.fn(),
  findResponsesBySurvey: jest.fn(),
} as any

const mockPlanReportRepo = {
  createDraftForSurvey: jest.fn(),
  createHiringPlanItems: jest.fn(),
} as any

const mockNotifRepo = {
  create: jest.fn(),
  createForHrManager: jest.fn(),
} as any

const service = new HiringSurveyService(mockRepo, mockPlanReportRepo, mockNotifRepo)

beforeEach(() => jest.clearAllMocks())

describe('create', () => {
  test('targetDeptIds가 비어있으면 400 TARGET_DEPTS_REQUIRED를 던진다', async () => {
    await expect(
      service.create({ title: '2027 채용 조사', deadlineAt: '2027-01-31', targetDeptIds: [] }, 1)
    ).rejects.toMatchObject({ statusCode: 400, code: 'TARGET_DEPTS_REQUIRED' })
  })

  test('조사 생성 후 대상 부서장에게 알림을 보낸다', async () => {
    mockRepo.create.mockResolvedValue({
      id: 1,
      title: '2027 채용 조사',
      targetDepartments: [
        { department: { headId: 10 } },
        { department: { headId: 20 } },
      ],
    })
    mockNotifRepo.create.mockResolvedValue({})

    await service.create({ title: '2027 채용 조사', deadlineAt: '2027-01-31', targetDeptIds: [1, 2] }, 5)

    expect(mockNotifRepo.create).toHaveBeenCalledTimes(2)
    expect(mockNotifRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 10, type: 'HIRING_SURVEY_OPEN' })
    )
  })
})

describe('submitResponse', () => {
  test('CLOSED 조사에 응답하면 409 SURVEY_NOT_OPEN을 던진다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'CLOSED',
      targetDepartments: [],
      responses: [],
    })

    await expect(
      service.submitResponse(1, 10, { roleTitle: '코치', headcount: 1, priority: 'HIGH', reason: '공백' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'SURVEY_NOT_OPEN' })
  })

  test('대상 부서 headId가 아닌 유저는 403 NOT_TARGET_DEPARTMENT_HEAD를 던진다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'OPEN',
      targetDepartments: [{ departmentId: 5, department: { headId: 99 } }],
      responses: [],
    })

    await expect(
      service.submitResponse(1, 10, { roleTitle: '코치', headcount: 1, priority: 'HIGH', reason: '공백' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_TARGET_DEPARTMENT_HEAD' })
  })

  test('정상 응답 시 upsertResponse를 호출한다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'OPEN',
      targetDepartments: [{ departmentId: 5, department: { headId: 10 } }],
      responses: [],
    })
    mockRepo.upsertResponse.mockResolvedValue({ id: 1 })

    await service.submitResponse(1, 10, { roleTitle: '코치', headcount: 2, priority: 'HIGH', reason: '공백' })

    expect(mockRepo.upsertResponse).toHaveBeenCalledWith(1, 5, 10, expect.objectContaining({ roleTitle: '코치' }))
  })
})

describe('close', () => {
  test('이미 CLOSED된 조사를 닫으면 409 SURVEY_NOT_OPEN을 던진다', async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: 'CLOSED', title: '조사', targetDepartments: [], responses: [] })

    await expect(service.close(1, 5)).rejects.toMatchObject({ statusCode: 409, code: 'SURVEY_NOT_OPEN' })
  })

  test('close 시 PlanReport DRAFT와 HiringPlanItem을 생성한다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'OPEN',
      title: '2027 채용 조사',
      targetDepartments: [],
      responses: [],
    })
    mockRepo.close.mockResolvedValue({})
    mockRepo.findResponsesBySurvey.mockResolvedValue([
      { id: 10, roleTitle: '피지컬 코치', headcount: 1, quarter: 1, priority: 'HIGH', estimatedBudget: null },
    ])
    mockPlanReportRepo.createDraftForSurvey.mockResolvedValue({ id: 99 })
    mockPlanReportRepo.createHiringPlanItems.mockResolvedValue({})
    mockNotifRepo.createForHrManager.mockResolvedValue({})

    await service.close(1, 5)

    expect(mockPlanReportRepo.createDraftForSurvey).toHaveBeenCalledWith(expect.objectContaining({ surveyId: 1 }))
    expect(mockPlanReportRepo.createHiringPlanItems).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ planReportId: 99, roleTitle: '피지컬 코치' })])
    )
    expect(mockNotifRepo.createForHrManager).toHaveBeenCalledWith('HIRING_SURVEY_CLOSED', expect.any(Function), 1)
  })
})
```

- [x] **Step 2: 테스트 실행**

```bash
cd apps/api
npx jest __test__/hiring-survey/hiring-survey.service.test.ts --no-coverage
```

Expected: 6 tests pass

- [x] **Step 3: Commit**

```bash
git add apps/api/__test__/hiring-survey/
git commit -m "test(hiring-survey): add HiringSurveyService unit tests"
```

---

## Task 12: plan-report.service.ts — resolveApproverLevel 테스트

**Files:**
- Modify: `apps/api/__test__/plan-report/plan-report.service.test.ts` (신규 또는 추가)

- [x] **Step 1: HR 승인 레벨 테스트 추가**

`apps/api/__test__/plan-report/plan-report.service.test.ts` 작성 (파일 없으면 신규):
```typescript
import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { PlanReportService } from '../../src/plan-report/plan-report.service'

const mockRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  submit: jest.fn(),
  submitWithReviews: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  allReviewsComplete: jest.fn(),
  getClubSettings: jest.fn(),
  findApprovedHrReports: jest.fn(),
  submitResult: jest.fn(),
} as any

const mockNotifRepo = {
  createForHrManager: jest.fn(),
} as any

const service = new PlanReportService(mockRepo, mockNotifRepo)

beforeEach(() => jest.clearAllMocks())

describe('submit — HR 연간 계획 승인 레벨', () => {
  test('templateType=HR이면 requiredApproverLevel이 ADMIN이어야 한다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'DRAFT',
      templateType: 'HR',
      budget: 100,
      isNewBusiness: false,
      department: { headId: 10, id: 1 },
    })
    mockRepo.getClubSettings.mockResolvedValue({ reviewerDeptMap: {}, planApprovalLimit: 10000000 })
    mockRepo.submit.mockResolvedValue({ id: 1 })

    await service.submit(1, 10)

    expect(mockRepo.submit).toHaveBeenCalledWith(1, expect.any(Array), 'ADMIN')
  })

  test('templateType=GENERAL이고 예산 초과면 GM이다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 2,
      status: 'DRAFT',
      templateType: 'GENERAL',
      budget: 99999999,
      isNewBusiness: false,
      department: { headId: 10, id: 1 },
    })
    mockRepo.getClubSettings.mockResolvedValue({ reviewerDeptMap: {}, planApprovalLimit: 10000000 })
    mockRepo.submit.mockResolvedValue({ id: 2 })

    await service.submit(2, 10)

    expect(mockRepo.submit).toHaveBeenCalledWith(2, expect.any(Array), 'GM')
  })
})
```

- [x] **Step 2: 테스트 실행**

```bash
npx jest __test__/plan-report/plan-report.service.test.ts --no-coverage
```

Expected: 2 tests pass

- [x] **Step 3: Commit**

```bash
git add apps/api/__test__/plan-report/plan-report.service.test.ts
git commit -m "test(plan-report): verify HR always gets ADMIN approver level"
```

---

## 최종 확인

- [x] **전체 테스트 통과 확인**

```bash
cd apps/api
npx jest --no-coverage
```

Expected: 기존 테스트 모두 통과 + 신규 테스트 8개 통과

- [x] **서버 기동 확인**

```bash
npx tsx src/server.ts
```

Expected: 오류 없이 기동, `POST /api/hiring-surveys` 라우트 응답 확인
