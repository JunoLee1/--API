# HR 채용 연간 계획 워크플로우 설계

## 개요

HR 채용 프로세스 앞단에 "부서별 채용 수요 조사 → 연간 채용 계획서 → 다부서·구단주 승인 → 채용공고 등록"
흐름을 추가한다. 백엔드의 `PlanReport(templateType=HR)` → `createPosting` 연결은 이미 존재하므로,
신규 구현은 조사(`HiringNeedsSurvey`) 모델군과 프론트엔드 페이지에 집중한다.

**전체 플로우:**
```
HR_MANAGER → HiringNeedsSurvey 생성 (대상 부서 선택, 마감일 설정) → OPEN
  → 대상 부서장 알림 발송
  → 각 부서장 SurveyResponse 제출
  → deadlineAt 도달 시 cron 자동 CLOSED (or HR 수동 마감)
  → SurveyResponse[] → HiringPlanItem[] 자동 변환
  → HR_MANAGER 알림 ("계획 항목 N건 생성됨")
  → HR이 HiringPlanItem 검토·수정
  → PlanReport(templateType=HR, isNewBusiness=true, surveyId) DRAFT 생성 → 상신
  → 다부서 검토 + ADMIN 최종 승인
  → HR_MANAGER 알림 ("채용공고 등록 가능")
  → JobPosting 생성 (planReportId, hiringPlanItemId)
```

## 범위 외 (이번 구현 제외)

- 조사 응답 수정 이력 관리 — 마감 전 부서장 재제출로 덮어쓰기만 허용
- 조사 결과 통계 차트 — 별도 이슈
- 비정기 긴급 채용 UI — `surveyId` 없는 PlanReport(HR) 직접 생성 경로는 기존 plan-report 페이지 재활용

## 데이터 모델

### HiringNeedsSurvey (신규)

```prisma
model HiringNeedsSurvey {
  id            Int              @id @default(autoincrement())
  title         String
  deadlineAt    DateTime
  status        SurveyStatus     @default(OPEN)
  createdById   Int
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  createdBy          User               @relation("SurveyCreatedBy", fields: [createdById], references: [id])
  targetDepartments  SurveyTargetDept[]
  responses          SurveyResponse[]
  planReport         PlanReport?
}

enum SurveyStatus {
  OPEN
  CLOSED
}
```

### SurveyTargetDept (신규)

```prisma
model SurveyTargetDept {
  surveyId     Int
  departmentId Int

  survey       HiringNeedsSurvey @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  department   Department        @relation("SurveyTarget", fields: [departmentId], references: [id])

  @@id([surveyId, departmentId])
}
```

### SurveyResponse (신규)

```prisma
model SurveyResponse {
  id              Int            @id @default(autoincrement())
  surveyId        Int
  departmentId    Int
  roleTitle       String
  headcount       Int
  quarter         Int?           // 1~4, null = 연간 통합
  priority        SurveyPriority
  estimatedBudget Int?
  reason          String
  submittedById   Int            // Department.headId
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  survey         HiringNeedsSurvey @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  department     Department        @relation("SurveyResponse", fields: [departmentId], references: [id])
  submittedBy    User              @relation("SurveyResponseSubmitter", fields: [submittedById], references: [id])
  hiringPlanItem HiringPlanItem?

  @@unique([surveyId, departmentId])  // 부서당 응답 1건
}

enum SurveyPriority {
  HIGH
  MEDIUM
  LOW
}
```

**제약:** `submittedById === dept.headId` 서비스 레이어 검증. Survey가 OPEN 상태에서만 제출/수정 가능.

### HiringPlanItem (신규)

```prisma
model HiringPlanItem {
  id               Int            @id @default(autoincrement())
  planReportId     Int
  surveyResponseId Int?           @unique  // 자동 변환 출처, HR 직접 추가 시 null
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

### 기존 모델 변경

```prisma
// PlanReport에 추가
model PlanReport {
  // ... 기존 필드 유지 ...
  surveyId        Int?            @unique   // optional — 긴급 채용 시 null
  hiringPlanItems HiringPlanItem[]
  survey          HiringNeedsSurvey? @relation(fields: [surveyId], references: [id])
}

// JobPosting에 추가
model JobPosting {
  // ... 기존 필드 유지 ...
  hiringPlanItemId Int?
  hiringPlanItem   HiringPlanItem? @relation(fields: [hiringPlanItemId], references: [id])
}
```

## 로직 변경

### plan-report.service.ts — `resolveApproverLevel`

```typescript
function resolveApproverLevel(
  plan: { templateType: string; budget: number; isNewBusiness: boolean },
  limit: number
): string | null {
  if (plan.templateType === 'HR') return 'ADMIN'  // HR 연간 계획은 항상 구단주 승인
  if (plan.isNewBusiness) return 'ADMIN'
  if (plan.budget > limit) return 'GM'
  return null
}
```

### Survey CLOSED 시 자동 변환 로직 (hiring-survey.service.ts)

```typescript
async closeSurvey(id: number) {
  const survey = await this.repo.findById(id)
  if (survey.status !== 'OPEN') throw new AppError(409, 'SURVEY_NOT_OPEN')

  const responses = await this.repo.findResponses(id)

  await this.repo.closeSurvey(id)

  // SurveyResponse[] → HiringPlanItem[] (planReportId 없이 생성, HR이 나중에 PlanReport 연결)
  // 단, HiringPlanItem은 planReportId가 NOT NULL이므로 아래 방식 중 하나:
  // 옵션: PlanReport DRAFT를 자동 생성 후 아이템 연결, HR이 내용 채워서 상신
  const planReport = await this.planReportRepo.createDraft({
    templateType: 'HR',
    isNewBusiness: true,
    surveyId: id,
    createdById: survey.createdById,
    title: `${survey.title} — 연간 채용 계획서`,
  })

  await this.repo.createHiringPlanItems(
    responses.map(r => ({
      planReportId: planReport.id,
      surveyResponseId: r.id,
      roleTitle: r.roleTitle,
      headcount: r.headcount,
      quarter: r.quarter,
      priority: r.priority,
      estimatedBudget: r.estimatedBudget,
    }))
  )

  await this.notifRepo.createForHrManager(
    'HIRING_SURVEY_CLOSED',
    () => ({ title: '채용 수요 조사 마감', body: `"${survey.title}" 조사가 마감됐습니다. 계획 항목 ${responses.length}건이 생성됐습니다.` }),
    id,
  )
}
```

## 알림

| 타입 | 수신자 | 시점 |
|------|--------|------|
| `HIRING_SURVEY_OPEN` | 대상 부서장 전원 (`targetDepts[].dept.headId`) | Survey OPEN 시 |
| `HIRING_SURVEY_DEADLINE_REMINDER` | **미응답** 부서장만 (`targetDepts - responses`) | 마감 D-3 cron |
| `HIRING_SURVEY_CLOSED` | HR_MANAGER | Survey CLOSED + HiringPlanItem 생성 후 |
| `HIRING_PLAN_APPROVED` | HR_MANAGER | PlanReport(HR) APPROVED 시 |

D-3 cron (`/jobs/hiringSurveyReminder.ts`):
```
0 9 * * *  // 매일 오전 9시
→ status=OPEN이고 deadlineAt = now+3일인 Survey 조회
→ 미응답 부서장 필터 (targetDepts where no SurveyResponse)
→ HIRING_SURVEY_DEADLINE_REMINDER 발송
```

## 백엔드 API

### HiringNeedsSurvey

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| POST | `/hiring-survey` | HR_MANAGER | 조사 생성 (targetDeptIds[], deadlineAt) |
| GET | `/hiring-survey` | HR_MANAGER | 조사 목록 |
| GET | `/hiring-survey/:id` | HR_MANAGER | 조사 상세 + 응답 현황 |
| PATCH | `/hiring-survey/:id/close` | HR_MANAGER | 수동 마감 → HiringPlanItem 자동 생성 |

### SurveyResponse

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| POST | `/hiring-survey/:id/response` | Department.headId | 응답 제출 |
| PUT | `/hiring-survey/:id/response` | 응답한 부서장 본인 | 응답 수정 (OPEN 상태에서만) |

### HiringPlanItem

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/plan-report/:id/hiring-items` | HR_MANAGER | 계획 항목 목록 |
| POST | `/plan-report/:id/hiring-items` | HR_MANAGER | 항목 직접 추가 |
| PUT | `/plan-report/:id/hiring-items/:itemId` | HR_MANAGER | 항목 수정 |
| DELETE | `/plan-report/:id/hiring-items/:itemId` | HR_MANAGER | 항목 삭제 |

## 프론트엔드

### 신규 페이지

| 페이지 | 경로 | 접근 역할 |
|--------|------|---------|
| 채용 수요 조사 목록 | `/recruitment/surveys` | HR_MANAGER |
| 채용 수요 조사 생성 | `/recruitment/surveys/new` | HR_MANAGER |
| 채용 수요 조사 상세 | `/recruitment/surveys/:id` | HR_MANAGER |
| 조사 응답 입력 | `/recruitment/surveys/:id/respond` | 대상 부서장 |
| 채용 계획 항목 편집 | `/recruitment/plan/:planReportId/items` | HR_MANAGER |

### 조사 상세 페이지 핵심 UI

- 대상 부서 목록 + 응답 완료 여부 (✅ / ⏳)
- 미응답 부서 강조 표시
- 마감까지 D-N일 카운트다운
- "지금 마감" 버튼 → CLOSED + 자동 변환 트리거

### 기존 페이지 연결

- `JobPosting` 생성 폼에 `hiringPlanItemId` 선택 드롭다운 추가
  (해당 PlanReport의 HiringPlanItem 목록에서 선택)

## 구현 순서

1. Prisma 스키마 추가 + migration
   - `HiringNeedsSurvey`, `SurveyTargetDept`, `SurveyResponse`, `SurveyPriority` enum
   - `HiringPlanItem`, `SurveyStatus` enum
   - `PlanReport.surveyId`, `JobPosting.hiringPlanItemId` 필드 추가
2. `plan-report.service.ts` — `resolveApproverLevel` HR 분기 추가
3. `hiring-survey` 모듈 (repo / service / controller / routes) 작성
4. `HiringPlanItem` CRUD API (`/plan-report/:id/hiring-items`) 추가
5. `JobPosting` 생성 DTO에 `hiringPlanItemId?: number` 추가
6. D-3 리마인더 cron job (`/jobs/hiringSurveyReminder.ts`) + `server.ts` 등록
7. 신규 알림 타입 4개 추가
8. 프론트엔드 — 조사 목록/생성/상세 페이지
9. 프론트엔드 — 조사 응답 입력 페이지
10. 프론트엔드 — 계획 항목 편집 페이지
11. 프론트엔드 — JobPosting 생성 폼 `hiringPlanItemId` 드롭다운 추가
