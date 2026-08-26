# Cron: Auto-Generate HiringNeedsSurvey Draft (Fix #360) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** [#360](https://github.com/JunoLee1/--API/issues/360)

**Goal:** 분기별 자동 채용 draft cron 이 HR 승인 파이프라인을 우회하는 문제 해결. `JobPosting` draft 대신 `HiringNeedsSurvey` draft 를 생성하도록 변경하여 정상 채용 파이프라인 (Survey → PlanReport → JobPosting) 에 진입시킨다.

**Architecture:** 
- `SurveyStatus` enum 에 `DRAFT` 값 추가 (`create()` 기본값은 기존 `OPEN` 유지 — 기존 flow 무영향).
- 분기 첫 날 cron 이 `HiringAutomationService.computePriorityQueue()` 로 target 부서 선정 후 `HiringNeedsSurvey` draft 생성.
- HR 매니저에게 신규 `HIRING_SURVEY_DRAFT_CREATED` 알림. HR 매니저가 draft 편집(`PATCH`) 후 open(`POST /open`) 하면 정상 파이프라인 진입.

**Tech Stack:** TypeScript · Prisma · Jest · Express · node-cron (`apps/api`)

**Out of scope (별도 이슈):**
- Legacy JobPosting draft 정리 스크립트 — 자연 소멸 방침 (grill Q7)
- Priority queue 알고리즘 개선 — 재사용만
- FE 편집 페이지 — API 만, FE 는 후속 이슈

---

## File Structure

각 파일의 책임을 미리 정의하여 스코프 확정.

**Modify:**
- `apps/api/prisma/schema.prisma:3578-3581` — `SurveyStatus` enum + `DRAFT`
- `apps/api/prisma/schema.prisma:276-... (NotificationType)` — 신규 `HIRING_SURVEY_DRAFT_CREATED` 값 추가 (기존 `JOB_POSTING_DRAFT_CREATED` 는 남겨두어 legacy notification record 보존)
- `apps/api/prisma/schema.prisma:2493-2501 (ClubSettings)` — `autoSurveyTopN Int? @default(3)` 필드 추가
- `apps/api/src/hiring-survey/hiring-survey.repo.ts` — `updateDraft`, `deleteDraft`, `createDraft` 메서드 추가
- `apps/api/src/hiring-survey/hiring-survey.service.ts` — `updateDraft`, `open`, `deleteDraft`, `createQuarterlyDraft` 메서드 추가
- `apps/api/src/hiring-survey/hiring-survey.controller.ts` — 3개 신규 handler
- `apps/api/src/hiring-survey/hiring-survey.routes.ts` — 3개 신규 route
- `apps/api/src/hiring-survey/dto/hiring-survey.dto.ts` — `UpdateHiringSurveyDraftDto` 추가
- `apps/api/src/server.ts:25` — cron import 이름 변경
- `apps/api/__test__/hiring-survey/hiring-survey.service.test.ts` — 신규 테스트 추가 (파일 없으면 생성)

**Create:**
- `apps/api/prisma/migrations/YYYYMMDDHHMMSS_cron_hiring_survey_draft/migration.sql` — Prisma auto-generated
- `apps/api/src/jobs/quarterlyHiringSurveyDraft.ts` — 신규 파일 (rename from old)

**Delete:**
- `apps/api/src/jobs/quarterlyJobPostingDraft.ts` — 구 파일 (신규 파일로 rename)

**Verify (no changes):**
- `football/src/*` — draft 편집 UX 는 후속 FE 이슈. API 만 노출.
- 기존 `JobPosting` draft records — 유지 (자연 소멸)

---

## Task 1: Schema changes + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (3 spots)
- Create: `apps/api/prisma/migrations/{new_timestamp}_cron_hiring_survey_draft/migration.sql` (Prisma auto-generate)

- [ ] **Step 1: `SurveyStatus` enum 에 `DRAFT` 추가**

`apps/api/prisma/schema.prisma:3578-3581`:

```prisma
// 변경 전
enum SurveyStatus {
  OPEN
  CLOSED
}

// 변경 후
enum SurveyStatus {
  DRAFT
  OPEN
  CLOSED
}
```

**주의**: `HiringNeedsSurvey.status @default(OPEN)` 은 유지 (grill Q2 → create() 기본값 그대로).

- [ ] **Step 2: `NotificationType` enum 에 `HIRING_SURVEY_DRAFT_CREATED` 추가**

`apps/api/prisma/schema.prisma:276` (enum NotificationType) 블록 안. 정확한 위치는 파일 읽어서 파악. 기존 `HIRING_SURVEY_OPEN`, `JOB_POSTING_DRAFT_CREATED` 근처에 추가:

```prisma
enum NotificationType {
  ...
  HIRING_SURVEY_OPEN
  HIRING_SURVEY_DRAFT_CREATED   // ← 신규 추가
  JOB_POSTING_DRAFT_CREATED     // ← 유지 (legacy notification 보존, 신규 발송은 없음)
  ...
}
```

- [ ] **Step 3: `ClubSettings` 에 `autoSurveyTopN` 필드 추가**

`apps/api/prisma/schema.prisma:2493-2501`:

```prisma
// 변경 전
model ClubSettings {
  id                       Int    @id @default(1)
  currency                 String @default("KRW")
  ibiBeta                  Float  @default(1.0)
  planApprovalLimit        Int    @default(10000000)
  maintenanceCostLimit     Int    @default(1000000)
  complimentaryTicketLimit Int    @default(10)
  reviewerDeptMap          Json?
}

// 변경 후
model ClubSettings {
  id                       Int    @id @default(1)
  currency                 String @default("KRW")
  ibiBeta                  Float  @default(1.0)
  planApprovalLimit        Int    @default(10000000)
  maintenanceCostLimit     Int    @default(1000000)
  complimentaryTicketLimit Int    @default(10)
  reviewerDeptMap          Json?
  autoSurveyTopN           Int?   @default(3)
}
```

- [ ] **Step 4: schema 형식 확인 + 검증**

Run:
```bash
cd apps/api && pnpm prisma format && pnpm prisma validate
```

Expected: "The schema is valid." 출력.

- [ ] **Step 5: Migration 생성**

Run:
```bash
cd apps/api && pnpm prisma migrate dev --name cron_hiring_survey_draft
```

Expected:
- 새 migration 파일 생성 (`prisma/migrations/{timestamp}_cron_hiring_survey_draft/migration.sql`)
- Dev DB 자동 적용
- Prisma Client 자동 재생성

Migration SQL 예상 내용 (Prisma auto-gen):
```sql
-- AlterEnum
ALTER TYPE "SurveyStatus" ADD VALUE 'DRAFT' BEFORE 'OPEN';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'HIRING_SURVEY_DRAFT_CREATED';

-- AlterTable
ALTER TABLE "ClubSettings" ADD COLUMN "autoSurveyTopN" INTEGER DEFAULT 3;
```

**Note**: PostgreSQL enum ADD VALUE 는 트랜잭션 밖에서 실행되어야 함. Prisma 는 이를 자동 처리. 만약 migrate dev 가 실패하면 (drift 등), `pnpm prisma migrate diff --from-schema-datamodel ... --to-schema-datamodel ... --script` 로 SQL 확인 후 수동 적용 (PR #359 fix 처럼).

**주의**: 만약 SQL 이 예상 외 변경 (다른 필드 rename/drop 등) 포함하면 **중단** — 스키마 편집 실수 가능성.

- [ ] **Step 6: 기존 테스트 여전히 통과 확인**

Run:
```bash
cd apps/api && pnpm test -- src/hiring-survey/ __test__/hiring-survey/ 2>&1 | tail -20
```

Expected: 모든 기존 테스트 통과 (pre-existing DB fail 있으면 그대로). 이 단계에서 새 값 사용은 없으니 breakage 없어야 함.

---

## Task 2: Service layer — 3 draft lifecycle methods + createQuarterlyDraft

**Files:**
- Modify: `apps/api/src/hiring-survey/hiring-survey.repo.ts` — 3 신규 repo methods
- Modify: `apps/api/src/hiring-survey/hiring-survey.service.ts` — 4 신규 service methods
- Modify: `apps/api/src/hiring-survey/dto/hiring-survey.dto.ts` — 신규 DTO
- Modify: `apps/api/__test__/hiring-survey/hiring-survey.service.test.ts` (파일 없으면 생성) — 신규 테스트

- [ ] **Step 1: Repo 에 3 신규 메서드 추가**

`apps/api/src/hiring-survey/hiring-survey.repo.ts` 파일 끝 (`findResponsesBySurvey` 뒤) 에 추가:

```typescript
  createDraft(data: { title: string; deadlineAt: Date; targetDeptIds: number[]; createdById: number }) {
    return this.prisma.hiringNeedsSurvey.create({
      data: {
        title: data.title,
        deadlineAt: data.deadlineAt,
        status: 'DRAFT',
        createdById: data.createdById,
        targetDepartments: {
          create: data.targetDeptIds.map((departmentId) => ({ departmentId })),
        },
      },
      include: SURVEY_INCLUDE,
    })
  }

  updateDraft(id: number, data: { title?: string; deadlineAt?: Date; targetDeptIds?: number[] }) {
    return this.prisma.$transaction(async (tx) => {
      if (data.targetDeptIds !== undefined) {
        await tx.surveyTargetDept.deleteMany({ where: { surveyId: id } })
        await tx.surveyTargetDept.createMany({
          data: data.targetDeptIds.map((departmentId) => ({ surveyId: id, departmentId })),
        })
      }
      return tx.hiringNeedsSurvey.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.deadlineAt !== undefined && { deadlineAt: data.deadlineAt }),
        },
        include: SURVEY_INCLUDE,
      })
    })
  }

  openDraft(id: number) {
    return this.prisma.hiringNeedsSurvey.update({
      where: { id },
      data: { status: 'OPEN' },
      include: SURVEY_INCLUDE,
    })
  }

  deleteDraft(id: number) {
    return this.prisma.hiringNeedsSurvey.delete({
      where: { id },
    })
  }
```

**주의**: `updateDraft` 는 `targetDeptIds` 재정의 방식으로 delete+recreate 사용 (Prisma nested update 는 복잡). `deleteDraft` 는 `SurveyTargetDept` 을 cascade 로 함께 삭제 (schema 상 `onDelete: Cascade` 확인 필요 — 없으면 명시적 삭제).

**Cascade 확인**: `apps/api/prisma/schema.prisma:3651` 에서 `SurveyTargetDept.survey ... @relation(fields: [surveyId], references: [id], onDelete: Cascade)` — cascade 이미 있음 ✓

- [ ] **Step 2: DTO 추가**

`apps/api/src/hiring-survey/dto/hiring-survey.dto.ts` 파일 끝에 추가:

```typescript
export interface UpdateHiringSurveyDraftDto {
  title?: string
  deadlineAt?: string
  targetDeptIds?: number[]
}
```

- [ ] **Step 3: Failing test 추가 — `updateDraft` (DRAFT only, HR only)**

`apps/api/__test__/hiring-survey/hiring-survey.service.test.ts` (파일 없으면 신규 생성):

```typescript
import { HiringSurveyService } from '../../src/hiring-survey/hiring-survey.service'
import type { HiringSurveyRepository } from '../../src/hiring-survey/hiring-survey.repo'
import type { PlanReportRepository } from '../../src/plan-report/plan-report.repo'
import type { NotificationRepository } from '../../src/notification/notification.repo'

const makeSurveyRepo = (overrides: Partial<HiringSurveyRepository> = {}): HiringSurveyRepository =>
  ({
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    create: jest.fn(),
    close: jest.fn(),
    findOpenPastDeadline: jest.fn().mockResolvedValue([]),
    findOpenNearDeadline: jest.fn().mockResolvedValue([]),
    upsertResponse: jest.fn(),
    findResponsesBySurvey: jest.fn().mockResolvedValue([]),
    createDraft: jest.fn(),
    updateDraft: jest.fn(),
    openDraft: jest.fn(),
    deleteDraft: jest.fn(),
    ...overrides,
  } as unknown as HiringSurveyRepository)

const makePlanRepo = (): PlanReportRepository =>
  ({
    createDraftForSurvey: jest.fn(),
    createHiringPlanItems: jest.fn(),
  } as unknown as PlanReportRepository)

const makeNotifRepo = (): NotificationRepository =>
  ({
    create: jest.fn().mockResolvedValue({}),
    createForHrManager: jest.fn().mockResolvedValue({}),
    createForUsers: jest.fn().mockResolvedValue({}),
  } as unknown as NotificationRepository)

const makeSvc = (repoOverrides: Partial<HiringSurveyRepository> = {}) =>
  new HiringSurveyService(makeSurveyRepo(repoOverrides), makePlanRepo(), makeNotifRepo())

describe('HiringSurveyService.updateDraft', () => {
  const draftSurvey = {
    id: 1,
    title: '2026 Q4 채용 수요 조사',
    deadlineAt: new Date('2026-12-31T23:59:59Z'),
    status: 'DRAFT' as const,
    createdById: 1,
    targetDepartments: [{ department: { id: 10, name: '코칭', headId: 100 } }],
    responses: [],
  }

  it('DRAFT 상태에서 title/deadlineAt/targetDeptIds 편집 가능', async () => {
    const updateDraft = jest.fn().mockResolvedValue({ ...draftSurvey, title: '수정됨' })
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue(draftSurvey),
      updateDraft,
    })

    const result = await svc.updateDraft(1, { title: '수정됨', targetDeptIds: [20] })

    expect(updateDraft).toHaveBeenCalledWith(1, { title: '수정됨', targetDeptIds: [20] })
    expect(result.title).toBe('수정됨')
  })

  it('OPEN 상태의 survey 는 편집 불가 → 409 SURVEY_NOT_DRAFT', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue({ ...draftSurvey, status: 'OPEN' }),
    })

    await expect(svc.updateDraft(1, { title: '수정 시도' })).rejects.toMatchObject({
      statusCode: 409,
      message: 'SURVEY_NOT_DRAFT',
    })
  })

  it('없는 survey 는 404 SURVEY_NOT_FOUND', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue(null),
    })

    await expect(svc.updateDraft(999, { title: 'x' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'SURVEY_NOT_FOUND',
    })
  })

  it('deadlineAt string 은 Date 로 변환', async () => {
    const updateDraft = jest.fn().mockResolvedValue(draftSurvey)
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue(draftSurvey),
      updateDraft,
    })

    await svc.updateDraft(1, { deadlineAt: '2027-01-15T00:00:00Z' })

    const callArg = updateDraft.mock.calls[0][1]
    expect(callArg.deadlineAt).toBeInstanceOf(Date)
    expect((callArg.deadlineAt as Date).toISOString()).toBe('2027-01-15T00:00:00.000Z')
  })
})
```

- [ ] **Step 4: 테스트 실행 (FAIL 예상 — service method 없음)**

Run:
```bash
cd apps/api && pnpm test -- __test__/hiring-survey/hiring-survey.service.test.ts 2>&1 | tail -20
```

Expected: **FAIL** with `svc.updateDraft is not a function` (또는 method 없어서 TypeScript 컴파일 에러).

- [ ] **Step 5: Service `updateDraft` 구현**

`apps/api/src/hiring-survey/hiring-survey.service.ts` — `close` 메서드 뒤 (line ~141) 에 추가. Import 도 필요:

Import 추가 (기존 import 블록 확장):

```typescript
import type { CreateHiringSurveyDto, CreateSurveyResponseDto, UpdateHiringSurveyDraftDto } from './dto/hiring-survey.dto'
```

메서드 추가:

```typescript
  async updateDraft(id: number, dto: UpdateHiringSurveyDraftDto) {
    const survey = await this.getById(id)
    if (survey.status !== 'DRAFT') throw new AppError(409, 'SURVEY_NOT_DRAFT')

    const data: { title?: string; deadlineAt?: Date; targetDeptIds?: number[] } = {}
    if (dto.title !== undefined) {
      if (!dto.title.trim()) throw new AppError(400, 'TITLE_REQUIRED')
      data.title = dto.title
    }
    if (dto.deadlineAt !== undefined) {
      data.deadlineAt = new Date(dto.deadlineAt)
    }
    if (dto.targetDeptIds !== undefined) {
      if (dto.targetDeptIds.length === 0) throw new AppError(400, 'TARGET_DEPTS_REQUIRED')
      data.targetDeptIds = dto.targetDeptIds
    }

    return this.repo.updateDraft(id, data)
  }
```

- [ ] **Step 6: 테스트 통과 확인**

Run:
```bash
cd apps/api && pnpm test -- __test__/hiring-survey/hiring-survey.service.test.ts -t "updateDraft" 2>&1 | tail -15
```

Expected: **PASS** (4개 updateDraft 테스트).

- [ ] **Step 7: Failing test 추가 — `open`**

동일 파일 `describe('HiringSurveyService.updateDraft', ...)` 뒤에 추가:

```typescript
describe('HiringSurveyService.open', () => {
  const draftSurvey = {
    id: 1,
    title: '2026 Q4 채용 수요 조사',
    deadlineAt: new Date('2026-12-31T23:59:59Z'),
    status: 'DRAFT' as const,
    createdById: 1,
    targetDepartments: [
      { department: { id: 10, name: '코칭', headId: 100 } },
      { department: { id: 20, name: '의료', headId: 200 } },
    ],
    responses: [],
  }

  it('DRAFT → OPEN 전이 시 대상 부서장들에게 HIRING_SURVEY_OPEN 알림', async () => {
    const openDraft = jest.fn().mockResolvedValue({ ...draftSurvey, status: 'OPEN' })
    const notifCreate = jest.fn().mockResolvedValue({})
    const notifRepo = {
      create: notifCreate,
      createForHrManager: jest.fn(),
      createForUsers: jest.fn(),
    } as unknown as NotificationRepository

    const svc = new HiringSurveyService(
      makeSurveyRepo({
        findById: jest.fn().mockResolvedValue(draftSurvey),
        openDraft,
      }),
      makePlanRepo(),
      notifRepo,
    )

    const result = await svc.open(1)

    expect(openDraft).toHaveBeenCalledWith(1)
    expect(result.status).toBe('OPEN')
    // 부서장 2명에게 알림
    expect(notifCreate).toHaveBeenCalledTimes(2)
    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 100, type: 'HIRING_SURVEY_OPEN' })
    )
    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 200, type: 'HIRING_SURVEY_OPEN' })
    )
  })

  it('DRAFT 아니면 409 SURVEY_NOT_DRAFT', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue({ ...draftSurvey, status: 'OPEN' }),
    })

    await expect(svc.open(1)).rejects.toMatchObject({
      statusCode: 409,
      message: 'SURVEY_NOT_DRAFT',
    })
  })

  it('대상 부서 없으면 409 TARGET_DEPTS_REQUIRED', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue({ ...draftSurvey, targetDepartments: [] }),
    })

    await expect(svc.open(1)).rejects.toMatchObject({
      statusCode: 409,
      message: 'TARGET_DEPTS_REQUIRED',
    })
  })

  it('deadlineAt 과거면 409 DEADLINE_IN_PAST', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue({ ...draftSurvey, deadlineAt: new Date('2020-01-01') }),
    })

    await expect(svc.open(1)).rejects.toMatchObject({
      statusCode: 409,
      message: 'DEADLINE_IN_PAST',
    })
  })
})
```

- [ ] **Step 8: 테스트 실행 (FAIL 예상)**

Run:
```bash
cd apps/api && pnpm test -- __test__/hiring-survey/hiring-survey.service.test.ts -t "open" 2>&1 | tail -15
```

Expected: FAIL.

- [ ] **Step 9: Service `open` 구현**

`hiring-survey.service.ts` 에 `updateDraft` 뒤에 추가:

```typescript
  async open(id: number) {
    const survey = await this.getById(id)
    if (survey.status !== 'DRAFT') throw new AppError(409, 'SURVEY_NOT_DRAFT')
    if (survey.targetDepartments.length === 0) throw new AppError(409, 'TARGET_DEPTS_REQUIRED')
    if (survey.deadlineAt < new Date()) throw new AppError(409, 'DEADLINE_IN_PAST')

    const opened = await this.repo.openDraft(id)

    // 대상 부서장들에게 HIRING_SURVEY_OPEN 알림 (기존 create() flow 와 동일)
    const headIds = survey.targetDepartments
      .map((t) => t.department.headId)
      .filter((hid): hid is number => hid !== null)

    await Promise.all(
      headIds.map((userId) =>
        this.notifRepo.create({
          userId,
          type: 'HIRING_SURVEY_OPEN',
          title: '채용 수요 조사 참여 요청',
          body: `"${survey.title}" 채용 수요 조사에 응답해 주세요. 마감일: ${survey.deadlineAt.toLocaleDateString('ko-KR')}`,
          entityId: survey.id,
        })
      )
    )

    return opened
  }
```

- [ ] **Step 10: open 테스트 통과 확인**

Run:
```bash
cd apps/api && pnpm test -- __test__/hiring-survey/hiring-survey.service.test.ts -t "open" 2>&1 | tail -15
```

Expected: PASS (4개 open 테스트).

- [ ] **Step 11: Failing test 추가 — `deleteDraft`**

동일 파일에 추가:

```typescript
describe('HiringSurveyService.deleteDraft', () => {
  const draftSurvey = {
    id: 1,
    title: '2026 Q4 채용 수요 조사',
    deadlineAt: new Date('2026-12-31T23:59:59Z'),
    status: 'DRAFT' as const,
    createdById: 1,
    targetDepartments: [],
    responses: [],
  }

  it('DRAFT 상태 삭제 성공', async () => {
    const deleteDraft = jest.fn().mockResolvedValue({ id: 1 })
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue(draftSurvey),
      deleteDraft,
    })

    await svc.deleteDraft(1)

    expect(deleteDraft).toHaveBeenCalledWith(1)
  })

  it('DRAFT 아니면 409 SURVEY_NOT_DRAFT', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue({ ...draftSurvey, status: 'OPEN' }),
    })

    await expect(svc.deleteDraft(1)).rejects.toMatchObject({
      statusCode: 409,
      message: 'SURVEY_NOT_DRAFT',
    })
  })

  it('없는 survey 는 404', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue(null),
    })

    await expect(svc.deleteDraft(999)).rejects.toMatchObject({
      statusCode: 404,
      message: 'SURVEY_NOT_FOUND',
    })
  })
})
```

- [ ] **Step 12: 테스트 실행 → FAIL → 구현 → PASS**

Run FAIL 확인:
```bash
cd apps/api && pnpm test -- __test__/hiring-survey/hiring-survey.service.test.ts -t "deleteDraft" 2>&1 | tail -10
```

`hiring-survey.service.ts` 에 추가:

```typescript
  async deleteDraft(id: number) {
    const survey = await this.getById(id)
    if (survey.status !== 'DRAFT') throw new AppError(409, 'SURVEY_NOT_DRAFT')
    await this.repo.deleteDraft(id)
  }
```

Run PASS 확인:
```bash
cd apps/api && pnpm test -- __test__/hiring-survey/hiring-survey.service.test.ts -t "deleteDraft" 2>&1 | tail -10
```

- [ ] **Step 13: Failing test 추가 — `createQuarterlyDraft` (cron 이 호출)**

```typescript
describe('HiringSurveyService.createQuarterlyDraft', () => {
  const targetDeptIds = [10, 20, 30]

  it('DRAFT status 로 survey 생성 + HR 매니저에게 HIRING_SURVEY_DRAFT_CREATED 알림', async () => {
    const createDraft = jest.fn().mockResolvedValue({
      id: 42,
      title: '2026 Q4 채용 수요 조사',
      status: 'DRAFT',
      targetDepartments: targetDeptIds.map((id) => ({ department: { id, name: 'x', headId: null } })),
    })
    const notifHrCreate = jest.fn().mockResolvedValue({})
    const notifRepo = {
      create: jest.fn(),
      createForHrManager: notifHrCreate,
      createForUsers: jest.fn(),
    } as unknown as NotificationRepository

    const svc = new HiringSurveyService(
      makeSurveyRepo({ createDraft }),
      makePlanRepo(),
      notifRepo,
    )

    const result = await svc.createQuarterlyDraft({
      title: '2026 Q4 채용 수요 조사',
      deadlineAt: new Date('2026-12-31T23:59:59Z'),
      targetDeptIds,
      systemUserId: 1,
    })

    expect(createDraft).toHaveBeenCalledWith({
      title: '2026 Q4 채용 수요 조사',
      deadlineAt: new Date('2026-12-31T23:59:59Z'),
      targetDeptIds,
      createdById: 1,
    })
    expect(result.id).toBe(42)
    expect(notifHrCreate).toHaveBeenCalledWith(
      'HIRING_SURVEY_DRAFT_CREATED',
      expect.any(Function),
      42,
    )
  })

  it('targetDeptIds 비어있으면 400 TARGET_DEPTS_REQUIRED (defensive)', async () => {
    const svc = makeSvc()
    await expect(
      svc.createQuarterlyDraft({
        title: 'x',
        deadlineAt: new Date(),
        targetDeptIds: [],
        systemUserId: 1,
      })
    ).rejects.toMatchObject({ statusCode: 400, message: 'TARGET_DEPTS_REQUIRED' })
  })
})
```

- [ ] **Step 14: `createQuarterlyDraft` 구현**

`hiring-survey.service.ts` 에 `deleteDraft` 뒤에 추가:

```typescript
  async createQuarterlyDraft(args: {
    title: string
    deadlineAt: Date
    targetDeptIds: number[]
    systemUserId: number
  }) {
    if (!args.targetDeptIds || args.targetDeptIds.length === 0) {
      throw new AppError(400, 'TARGET_DEPTS_REQUIRED')
    }

    const draft = await this.repo.createDraft({
      title: args.title,
      deadlineAt: args.deadlineAt,
      targetDeptIds: args.targetDeptIds,
      createdById: args.systemUserId,
    })

    void this.notifRepo
      .createForHrManager(
        'HIRING_SURVEY_DRAFT_CREATED',
        () => ({
          title: '채용 수요 조사 자동 초안 생성',
          body: `"${draft.title}" 초안이 자동 생성됐습니다. 검토 후 open 해 주세요.`,
        }),
        draft.id,
      )
      .catch(console.error)

    return draft
  }
```

- [ ] **Step 15: 전체 hiring-survey 테스트 실행**

Run:
```bash
cd apps/api && pnpm test -- __test__/hiring-survey/ src/hiring-survey/ 2>&1 | tail -20
```

Expected: 전체 PASS. 신규 테스트 수 ≈ 14개 (updateDraft 4 + open 4 + deleteDraft 3 + createQuarterlyDraft 2 + 기존 유지).

---

## Task 3: Controller + Routes wiring

**Files:**
- Modify: `apps/api/src/hiring-survey/hiring-survey.controller.ts` — 3개 신규 handler
- Modify: `apps/api/src/hiring-survey/hiring-survey.routes.ts` — 3개 신규 route

- [ ] **Step 1: Controller 에 3 handler 추가**

`apps/api/src/hiring-survey/hiring-survey.controller.ts` — 파일 마지막 (기존 handler 뒤) 에 추가. Class body 안:

```typescript
  updateDraft = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id)
      const result = await this.service.updateDraft(id, req.body)
      res.json(result)
    } catch (e) { next(e) }
  }

  open = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id)
      const result = await this.service.open(id)
      res.json(result)
    } catch (e) { next(e) }
  }

  deleteDraft = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id)
      await this.service.deleteDraft(id)
      res.status(204).send()
    } catch (e) { next(e) }
  }
```

**주의**: 정확한 handler 형식은 파일 내 기존 handler 패턴 (arrow function vs method) 을 따를 것. 파일 열어서 확인.

- [ ] **Step 2: Routes 에 3 route 추가**

`apps/api/src/hiring-survey/hiring-survey.routes.ts` — 기존 route 뒤 (line 32 `close` 뒤) 에 추가:

```typescript
router.patch('/:id', auth, requireHR, controller.updateDraft)
router.post('/:id/open', auth, requireHR, controller.open)
router.delete('/:id', auth, requireHR, controller.deleteDraft)
```

- [ ] **Step 3: TypeScript 컴파일 확인**

Run:
```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | grep hiring-survey | head -10
```

Expected: 에러 없음 (기존 pre-existing 무관 에러는 무시).

- [ ] **Step 4: 전체 스코프 테스트**

Run:
```bash
cd apps/api && pnpm test -- __test__/hiring-survey/ src/hiring-survey/ 2>&1 | tail -15
```

Expected: 모두 PASS.

---

## Task 4: Cron rewrite — rename + logic + ClubSettings TOP_N

**Files:**
- Create: `apps/api/src/jobs/quarterlyHiringSurveyDraft.ts` (신규 파일)
- Delete: `apps/api/src/jobs/quarterlyJobPostingDraft.ts` (기존 파일)
- Modify: `apps/api/src/server.ts:25` — import 이름 변경
- Modify: `apps/api/__test__/jobs/quarterlyHiringSurveyDraft.test.ts` (신규 or 기존 파일 확인 후)

- [ ] **Step 1: Failing test — cron helper function**

Cron 내부 로직을 테스트 가능하게 하려면 로직을 export 된 helper 로 분리. `apps/api/__test__/jobs/quarterlyHiringSurveyDraft.test.ts` (파일 없으면 생성):

```typescript
import { runQuarterlyHiringSurveyDraft } from '../../src/jobs/quarterlyHiringSurveyDraft'

describe('runQuarterlyHiringSurveyDraft', () => {
  it('active season + priority queue 결과로 draft 생성', async () => {
    const createQuarterlyDraft = jest.fn().mockResolvedValue({ id: 42 })
    const computePriorityQueue = jest.fn().mockResolvedValue({
      queue: [
        { departmentId: 10, departmentName: '코칭', highPriority: true },
        { departmentId: 20, departmentName: '의료', highPriority: false },
        { departmentId: 30, departmentName: 'FO', highPriority: false },
        { departmentId: 40, departmentName: '유소년', highPriority: false },
      ],
    })
    const findActiveSeason = jest.fn().mockResolvedValue({ id: 1, leagueLevel: 'PROFESSIONAL' })
    const findClubSettings = jest.fn().mockResolvedValue({ ibiBeta: 1.0, autoSurveyTopN: 3 })
    const findSystemUser = jest.fn().mockResolvedValue({ id: 1 })
    const findHrManagerExists = jest.fn().mockResolvedValue(true)

    const runAt = new Date('2026-10-01T09:00:00+09:00')

    await runQuarterlyHiringSurveyDraft({
      findActiveSeason,
      findClubSettings,
      findSystemUser,
      findHrManagerExists,
      computePriorityQueue,
      createQuarterlyDraft,
      now: () => runAt,
    })

    // computePriorityQueue 호출됨
    expect(computePriorityQueue).toHaveBeenCalledWith(
      { id: 1, leagueLevel: 'PROFESSIONAL' },
      1.0,
    )

    // createQuarterlyDraft 호출: title = "2026 Q4 채용 수요 조사"
    // targetDeptIds = TOP_3 + highPriority (dedup) = [10, 20, 30] (10 은 이미 top3 라 중복 제거됨)
    expect(createQuarterlyDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '2026 Q4 채용 수요 조사',
        targetDeptIds: [10, 20, 30],
        systemUserId: 1,
      })
    )

    // deadline 은 분기 마지막날 (Q4 → 12/31 23:59:59)
    const callArg = createQuarterlyDraft.mock.calls[0][0]
    const deadline = callArg.deadlineAt as Date
    expect(deadline.getMonth()).toBe(11) // December (0-indexed)
    expect(deadline.getDate()).toBe(31)
  })

  it('active season 없으면 return (draft 생성 안 함)', async () => {
    const createQuarterlyDraft = jest.fn()
    await runQuarterlyHiringSurveyDraft({
      findActiveSeason: jest.fn().mockResolvedValue(null),
      findClubSettings: jest.fn(),
      findSystemUser: jest.fn(),
      findHrManagerExists: jest.fn().mockResolvedValue(true),
      computePriorityQueue: jest.fn(),
      createQuarterlyDraft,
      now: () => new Date('2026-10-01'),
    })
    expect(createQuarterlyDraft).not.toHaveBeenCalled()
  })

  it('HR_MANAGER 없으면 skip + warn (draft 만들지 않음)', async () => {
    const createQuarterlyDraft = jest.fn()
    const warn = jest.fn()
    await runQuarterlyHiringSurveyDraft({
      findActiveSeason: jest.fn().mockResolvedValue({ id: 1, leagueLevel: 'PROFESSIONAL' }),
      findClubSettings: jest.fn().mockResolvedValue({ ibiBeta: 1.0, autoSurveyTopN: 3 }),
      findSystemUser: jest.fn().mockResolvedValue({ id: 1 }),
      findHrManagerExists: jest.fn().mockResolvedValue(false),
      computePriorityQueue: jest.fn(),
      createQuarterlyDraft,
      now: () => new Date('2026-10-01'),
      warn,
    })
    expect(createQuarterlyDraft).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('HR_MANAGER'))
  })

  it('systemUser (admin) 없으면 return (draft 생성 안 함)', async () => {
    const createQuarterlyDraft = jest.fn()
    await runQuarterlyHiringSurveyDraft({
      findActiveSeason: jest.fn().mockResolvedValue({ id: 1, leagueLevel: 'PROFESSIONAL' }),
      findClubSettings: jest.fn().mockResolvedValue({ ibiBeta: 1.0, autoSurveyTopN: 3 }),
      findSystemUser: jest.fn().mockResolvedValue(null),
      findHrManagerExists: jest.fn().mockResolvedValue(true),
      computePriorityQueue: jest.fn().mockResolvedValue({ queue: [{ departmentId: 10, departmentName: 'x', highPriority: false }] }),
      createQuarterlyDraft,
      now: () => new Date('2026-01-01'),
    })
    expect(createQuarterlyDraft).not.toHaveBeenCalled()
  })

  it('autoSurveyTopN null 이면 default 3', async () => {
    const createQuarterlyDraft = jest.fn().mockResolvedValue({ id: 42 })
    await runQuarterlyHiringSurveyDraft({
      findActiveSeason: jest.fn().mockResolvedValue({ id: 1, leagueLevel: 'PROFESSIONAL' }),
      findClubSettings: jest.fn().mockResolvedValue({ ibiBeta: 1.0, autoSurveyTopN: null }),
      findSystemUser: jest.fn().mockResolvedValue({ id: 1 }),
      findHrManagerExists: jest.fn().mockResolvedValue(true),
      computePriorityQueue: jest.fn().mockResolvedValue({
        queue: [
          { departmentId: 10, departmentName: 'x', highPriority: false },
          { departmentId: 20, departmentName: 'x', highPriority: false },
          { departmentId: 30, departmentName: 'x', highPriority: false },
          { departmentId: 40, departmentName: 'x', highPriority: false },
        ],
      }),
      createQuarterlyDraft,
      now: () => new Date('2026-01-01'),
    })
    const targetIds = createQuarterlyDraft.mock.calls[0][0].targetDeptIds as number[]
    expect(targetIds.length).toBe(3) // default TOP_N=3
  })
})
```

- [ ] **Step 2: 테스트 실행 (FAIL — 파일 없음)**

Run:
```bash
cd apps/api && pnpm test -- __test__/jobs/quarterlyHiringSurveyDraft.test.ts 2>&1 | tail -10
```

Expected: FAIL with import error (파일 없음).

- [ ] **Step 3: 신규 cron 파일 생성**

Create `apps/api/src/jobs/quarterlyHiringSurveyDraft.ts`:

```typescript
import cron from 'node-cron'
import type { LeagueLevel } from '../generated/enums'
import { getPrisma } from '../lib/prisma'
import { HiringAutomationRepository } from '../hiring-automation/hiring-automation.repo'
import { HiringAutomationService } from '../hiring-automation/hiring-automation.service'
import { HiringSurveyRepository } from '../hiring-survey/hiring-survey.repo'
import { HiringSurveyService } from '../hiring-survey/hiring-survey.service'
import { NotificationRepository } from '../notification/notification.repo'
import { PlanReportRepository } from '../plan-report/plan-report.repo'

const DEFAULT_TOP_N = 3

interface RunDeps {
  findActiveSeason: () => Promise<{ id: number; leagueLevel: LeagueLevel } | null>
  findClubSettings: () => Promise<{ ibiBeta: number; autoSurveyTopN: number | null } | null>
  findSystemUser: () => Promise<{ id: number } | null>
  findHrManagerExists: () => Promise<boolean>
  computePriorityQueue: (
    season: { id: number; leagueLevel: LeagueLevel },
    ibiBeta: number,
  ) => Promise<{ queue: Array<{ departmentId: number; departmentName: string; highPriority: boolean }> }>
  createQuarterlyDraft: (args: {
    title: string
    deadlineAt: Date
    targetDeptIds: number[]
    systemUserId: number
  }) => Promise<{ id: number }>
  now: () => Date
  warn?: (msg: string) => void
}

function quarterOf(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1
}

function quarterEndAt(date: Date): Date {
  const q = quarterOf(date)
  const endMonth = q * 3 - 1 // Q1→2(Mar), Q2→5(Jun), Q3→8(Sep), Q4→11(Dec)
  const year = date.getFullYear()
  return new Date(year, endMonth + 1, 0, 23, 59, 59) // day 0 of next month = last day of endMonth
}

export async function runQuarterlyHiringSurveyDraft(deps: RunDeps): Promise<void> {
  const warn = deps.warn ?? console.warn

  const season = await deps.findActiveSeason()
  if (!season || !season.leagueLevel) return

  const systemUser = await deps.findSystemUser()
  if (!systemUser) return

  // Q6 결정: HR_MANAGER 없으면 draft 만들어도 편집할 사람 없음 → skip + warn
  const hrExists = await deps.findHrManagerExists()
  if (!hrExists) {
    warn('[quarterlyHiringSurveyDraft] no HR_MANAGER role found — skipping cron (draft would have no editor)')
    return
  }

  const settings = await deps.findClubSettings()
  const ibiBeta = settings?.ibiBeta ?? 1.0
  const topN = settings?.autoSurveyTopN ?? DEFAULT_TOP_N

  const { queue } = await deps.computePriorityQueue(season, ibiBeta)

  const highPriority = queue.filter((q) => q.highPriority)
  const topSlice = queue.slice(0, topN)
  const targetDeptIds = Array.from(
    new Map([...highPriority, ...topSlice].map((q) => [q.departmentId, q])).keys(),
  )

  if (targetDeptIds.length === 0) return

  const now = deps.now()
  const year = now.getFullYear()
  const quarter = quarterOf(now)
  const title = `${year} Q${quarter} 채용 수요 조사`
  const deadlineAt = quarterEndAt(now)

  await deps.createQuarterlyDraft({
    title,
    deadlineAt,
    targetDeptIds,
    systemUserId: systemUser.id,
  })
}

export function startQuarterlyHiringSurveyDraftJob() {
  // 매 분기 첫째 날 오전 9시 (1월·4월·7월·10월 1일)
  cron.schedule('0 9 1 1,4,7,10 *', async () => {
    const prisma = getPrisma()
    const autoRepo = new HiringAutomationRepository(prisma)
    const autoService = new HiringAutomationService(autoRepo)
    const surveyRepo = new HiringSurveyRepository(prisma)
    const planRepo = new PlanReportRepository(prisma)
    const notifRepo = new NotificationRepository(prisma)
    const surveyService = new HiringSurveyService(surveyRepo, planRepo, notifRepo)

    try {
      await runQuarterlyHiringSurveyDraft({
        findActiveSeason: async () => {
          const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } })
          if (!season || !season.leagueLevel) return null
          return { id: season.id, leagueLevel: season.leagueLevel as LeagueLevel }
        },
        findClubSettings: async () => {
          const settings = await prisma.clubSettings.findFirst()
          if (!settings) return null
          return { ibiBeta: settings.ibiBeta, autoSurveyTopN: settings.autoSurveyTopN }
        },
        findSystemUser: async () => {
          const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
          return admin ? { id: admin.id } : null
        },
        findHrManagerExists: async () => {
          const hr = await prisma.user.findFirst({
            where: { role: 'FRONT_OFFICE', frontOfficeRole: 'HR_MANAGER', isDeleted: false },
            select: { id: true },
          })
          return !!hr
        },
        computePriorityQueue: (season, ibiBeta) => autoService.computePriorityQueue(season, ibiBeta),
        createQuarterlyDraft: (args) => surveyService.createQuarterlyDraft(args),
        now: () => new Date(),
      })
    } catch (err) {
      console.error('[quarterlyHiringSurveyDraft] cron failed:', err)
    }
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd apps/api && pnpm test -- __test__/jobs/quarterlyHiringSurveyDraft.test.ts 2>&1 | tail -15
```

Expected: PASS (5개 테스트).

- [ ] **Step 5: 구 cron 파일 삭제**

Run:
```bash
rm /Users/juno/work/football/.claude/worktrees/{worktree_name}/apps/api/src/jobs/quarterlyJobPostingDraft.ts
```

(worktree name 은 실행 시점 branch 명으로 대체)

- [ ] **Step 6: `server.ts` import 수정**

`apps/api/src/server.ts:25`:

```typescript
// 변경 전
import { startQuarterlyJobPostingDraftJob } from "./jobs/quarterlyJobPostingDraft";

// 변경 후
import { startQuarterlyHiringSurveyDraftJob } from "./jobs/quarterlyHiringSurveyDraft";
```

동일 파일에서 `startQuarterlyJobPostingDraftJob()` 호출 위치도 `startQuarterlyHiringSurveyDraftJob()` 로 변경. 파일 내 grep 으로 확인:

```bash
cd /Users/juno/work/football/.claude/worktrees/{worktree_name} && grep -n "startQuarterlyJobPostingDraftJob\|startQuarterlyHiringSurveyDraftJob" apps/api/src/server.ts
```

- [ ] **Step 7: TypeScript 전체 컴파일 확인**

Run:
```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | tail -20
```

Expected: 신규 에러 없음. 기존 pre-existing 에러 (다른 파일들) 는 그대로.

- [ ] **Step 8: 전체 스코프 테스트**

Run:
```bash
cd apps/api && pnpm test -- __test__/hiring-survey/ __test__/jobs/ src/hiring-survey/ 2>&1 | tail -20
```

Expected: 모두 PASS. 신규 테스트 ~19개 (Task 2 의 14개 + Task 4 의 5개).

---

## Task 5: Final verification + commit

- [ ] **Step 1: 전체 관련 테스트**

Run:
```bash
cd apps/api && pnpm test -- __test__/hiring-survey/ __test__/jobs/ __test__/plan-report/ __test__/recruitment/ src/hiring-survey/ src/plan-report/ src/recruitment/ 2>&1 | tail -15
```

Expected: 모두 PASS. Pre-existing AuditLog 실패는 그대로 OK.

- [ ] **Step 2: `NotificationType` 활용 grep — 신규 값이 정확히 hiring-survey.service 에서만 emit 되는지**

Run:
```bash
cd /Users/juno/work/football/.claude/worktrees/{worktree_name} && grep -rn "HIRING_SURVEY_DRAFT_CREATED" apps/api/src --include="*.ts" | grep -v generated
```

Expected: `hiring-survey.service.ts` 의 `createQuarterlyDraft` 안에서만 사용. 테스트 파일 노출은 OK.

- [ ] **Step 3: 구 `JOB_POSTING_DRAFT_CREATED` 사용처 재확인**

Run:
```bash
cd /Users/juno/work/football/.claude/worktrees/{worktree_name} && grep -rn "JOB_POSTING_DRAFT_CREATED" apps/api/src --include="*.ts" | grep -v generated
```

Expected: 빈 출력 (구 cron 파일 삭제됐고 다른 곳 사용 없음). 만약 발견되면 확인 후 정리.

- [ ] **Step 4: FE 영향 확인 (grep)**

Run:
```bash
cd /Users/juno/work/football/.claude/worktrees/{worktree_name} && grep -rn "JOB_POSTING_DRAFT_CREATED\|startQuarterlyJobPostingDraftJob\|quarterlyJobPostingDraft" football/src --include="*.ts" --include="*.tsx" 2>&1
```

Expected: 빈 출력.

- [ ] **Step 5: FE TypeScript 컴파일**

Run:
```bash
cd football && pnpm tsc --noEmit 2>&1 | tail -10
```

Expected: 에러 없음.

- [ ] **Step 6: git status 확인**

Run:
```bash
git status --short
```

Expected 파일 리스트:
- Modified: `apps/api/prisma/schema.prisma`
- Modified: `apps/api/src/server.ts`
- Modified: `apps/api/src/hiring-survey/hiring-survey.service.ts`
- Modified: `apps/api/src/hiring-survey/hiring-survey.repo.ts`
- Modified: `apps/api/src/hiring-survey/hiring-survey.controller.ts`
- Modified: `apps/api/src/hiring-survey/hiring-survey.routes.ts`
- Modified: `apps/api/src/hiring-survey/dto/hiring-survey.dto.ts`
- Deleted: `apps/api/src/jobs/quarterlyJobPostingDraft.ts`
- Untracked: `apps/api/src/jobs/quarterlyHiringSurveyDraft.ts`
- Untracked: `apps/api/prisma/migrations/{new}/migration.sql`
- Untracked: `apps/api/__test__/hiring-survey/hiring-survey.service.test.ts` (또는 modified 만약 파일 있었으면)
- Untracked: `apps/api/__test__/jobs/quarterlyHiringSurveyDraft.test.ts`
- Untracked: `docs/superpowers/plans/2026-08-26-cron-hiring-survey-draft.md` (이 plan 문서)

Pre-existing untracked (커밋 안 함): `pnpm-lock.yaml` (root 및 apps/api)

- [ ] **Step 7: Commit**

Run:
```bash
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations \
        apps/api/src/server.ts \
        apps/api/src/hiring-survey \
        apps/api/src/jobs/quarterlyHiringSurveyDraft.ts \
        apps/api/__test__/hiring-survey \
        apps/api/__test__/jobs \
        docs/superpowers/plans/2026-08-26-cron-hiring-survey-draft.md

git rm apps/api/src/jobs/quarterlyJobPostingDraft.ts

git commit -m "$(cat <<'EOF'
feat(recruitment): quarterly cron 이 HiringNeedsSurvey draft 자동 생성 (fix #360)

- schema: SurveyStatus.DRAFT 추가, NotificationType.HIRING_SURVEY_DRAFT_CREATED 추가, ClubSettings.autoSurveyTopN 추가
- cron: quarterlyJobPostingDraft → quarterlyHiringSurveyDraft rename + 로직 재작성 (JobPosting 대신 Survey draft 생성)
- service: hiring-survey.service.{createQuarterlyDraft, updateDraft, open, deleteDraft} 신규
- API: PATCH /hiring-surveys/:id, POST /:id/open, DELETE /:id (HR 만, DRAFT 상태만)
- HR 매니저에게 HIRING_SURVEY_DRAFT_CREATED 알림 (기존 JOB_POSTING_DRAFT_CREATED 는 legacy 로 보존)

Cron 이 HR 승인 파이프라인을 우회하던 문제 해결. 정상 flow (Survey → PlanReport → JobPosting) 로 진입 가능.

Closes #360

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git log -1 --stat
```

- [ ] **Step 8: Commit 검증**

Expected:
- 신규 파일 3개 create
- 기존 파일 1개 delete (`quarterlyJobPostingDraft.ts`)
- 6~7개 modified 파일
- Commit message 정상

---

## Self-Review Checklist

**1. Spec coverage** (issue #360 acceptance):
- [x] Cron 이 JobPosting 대신 Survey draft 생성 → Task 4
- [x] HR 매니저에게 알림 → Task 2 Step 14
- [x] Draft 편집 API 존재 → Task 3
- [x] Draft → Open 전이 API 존재 → Task 3
- [x] Draft 삭제 API 존재 → Task 3
- [x] `TOP_N` ClubSettings 로 이동 → Task 1 + Task 4
- [x] 파일 rename → Task 4

**2. Placeholder scan:** 없음. 모든 step 에 완전 코드/커맨드 존재. `{worktree_name}` 은 실행 시점 대체 명확 표시.

**3. Type consistency:**
- `SurveyStatus`, `NotificationType`, `HiringSurveyService`, method 이름 (`createQuarterlyDraft`, `updateDraft`, `open`, `deleteDraft`) 일관 사용
- Repo method (`createDraft`, `updateDraft`, `openDraft`, `deleteDraft`) 일관 사용
- Cron helper (`runQuarterlyHiringSurveyDraft`, `startQuarterlyHiringSurveyDraftJob`) 일관 사용

## 실행 후 확인 사항

- [ ] `pnpm jest` 전체 스코프 통과 (신규 ~19 개, 기존 유지)
- [ ] `pnpm tsc --noEmit` 신규 에러 없음
- [ ] FE `pnpm tsc --noEmit` 통과
- [ ] Migration SQL 이 예상대로 (SurveyStatus + NotificationType enum ADD VALUE + ClubSettings ADD COLUMN)
- [ ] `JOB_POSTING_DRAFT_CREATED` 사용처 grep 시 비어있음
- [ ] `quarterlyJobPostingDraft.ts` 파일 삭제 확인
