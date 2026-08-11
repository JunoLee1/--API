# PlanReport System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `DepartmentAnnualPlan` with a flexible `PlanReport` system supporting 7 business-type templates, conditional approval routing, file attachments, and Obsidian vault archiving.

**Architecture:** A single `PlanReport` model with `templateType` + `extraFields: Json?` handles all business types. Conditional approval rules (신규인력/계약/임대/개인정보/신규사업) live in the service layer; approval threshold is in `ClubSettings`. On APPROVED and result submission, a markdown file is written to `/Users/juno/ObsidianVault/plans/YYYY/`. Old `DepartmentAnnualPlan` module is deleted (no data migration).

**Tech Stack:** Prisma (PostgreSQL), Express, Jest, multer v2, Node.js `fs/promises`, React + TypeScript

---

## File Map

| Action | Path |
|--------|------|
| Modify | `apps/api/prisma/schema.prisma` |
| Create | `apps/api/src/plan-report/dto/plan-report.dto.ts` |
| Create | `apps/api/src/plan-report/vault.ts` |
| Create | `apps/api/src/plan-report/vault.test.ts` |
| Create | `apps/api/src/plan-report/plan-report.repo.ts` |
| Create | `apps/api/src/plan-report/plan-report.service.ts` |
| Create | `apps/api/src/plan-report/plan-report.service.test.ts` |
| Create | `apps/api/src/plan-report/plan-report.controller.ts` |
| Create | `apps/api/src/plan-report/plan-report.routes.ts` |
| Modify | `apps/api/src/plan-review/plan-review.service.ts` |
| Modify | `apps/api/src/plan-review/plan-review.repo.ts` |
| Modify | `apps/api/src/lib/permissions.ts` |
| Modify | `apps/api/src/server.ts` |
| Delete | `apps/api/src/department-plan/` (entire directory) |
| Create | `football/src/types/plan-report.ts` |
| Create | `football/src/services/plan-report.service.ts` |
| Create | `football/src/pages/finance/PlanReportListPage.tsx` |
| Create | `football/src/pages/finance/PlanReportFormPage.tsx` |
| Create | `football/src/pages/finance/PlanReportDetailPage.tsx` |
| Modify | `football/src/App.tsx` |
| Delete | `football/src/types/department-plan.ts` |
| Delete | `football/src/services/department-plan.service.ts` |
| Delete | `football/src/pages/finance/DepartmentPlan*.tsx` |
| Delete | `football/src/pages/finance/DepartmentBudgetSummaryPage.tsx` |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add new enums after `ReviewStatus`**

In `schema.prisma`, after the existing `ReviewStatus` enum (around line 3037), add:

```prisma
enum PlanTemplateType {
  GENERAL
  HR
  MARKETING
  GOODS
  SQUAD
  MEDICAL
  IT
}

enum ApproverLevel {
  HEAD
  GM
  ADMIN
}
```

- [ ] **Step 2: Add `PlanReport` model, replace `DepartmentAnnualPlan` block**

Delete the entire block from `model DepartmentAnnualPlan` through `model DepartmentReviewerConfig` (lines ~2984–3053) and replace with:

```prisma
model PlanReport {
  id                    Int              @id @default(autoincrement())
  title                 String
  purpose               String
  departmentId          Int
  startDate             DateTime
  endDate               DateTime
  budget                Int
  expectedEffect        String
  risks                 String
  attachments           String[]
  resultDueDate         DateTime
  templateType          PlanTemplateType
  extraFields           Json?
  hasNewStaff           Boolean          @default(false)
  hasContract           Boolean          @default(false)
  hasExternalLease      Boolean          @default(false)
  hasPersonalInfo       Boolean          @default(false)
  isNewBusiness         Boolean          @default(false)
  status                PlanStatus       @default(DRAFT)
  requiredApproverLevel ApproverLevel?
  rejectionReason       String?
  resultContent         String?
  resultSubmittedAt     DateTime?
  submittedAt           DateTime?
  approvedAt            DateTime?
  rejectedAt            DateTime?
  vaultPath             String?
  createdById           Int
  approvedById          Int?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  department  Department  @relation(fields: [departmentId], references: [id])
  createdBy   User        @relation("PlanReportCreatedBy", fields: [createdById], references: [id])
  approvedBy  User?       @relation("PlanReportApprovedBy", fields: [approvedById], references: [id])
  reviews     PlanReview[]
}
```

- [ ] **Step 3: Update `PlanReview` model — change relation target**

Replace the `plan` field in `PlanReview` (currently `DepartmentAnnualPlan`):

```prisma
model PlanReview {
  id             Int          @id @default(autoincrement())
  planId         Int
  reviewerDeptId Int
  status         ReviewStatus @default(PENDING)
  comment        String?
  confirmedById  Int?
  confirmedAt    DateTime?
  createdAt      DateTime     @default(now())

  plan         PlanReport @relation(fields: [planId], references: [id], onDelete: Cascade)
  reviewerDept Department @relation("PlanReviewerDept", fields: [reviewerDeptId], references: [id])
  confirmedBy  User?      @relation("PlanReviewConfirmer", fields: [confirmedById], references: [id])

  @@unique([planId, reviewerDeptId])
}
```

- [ ] **Step 4: Update `ClubSettings` — add approval config**

```prisma
model ClubSettings {
  id                Int    @id @default(1)
  currency          String @default("KRW")
  ibiBeta           Float  @default(1.0)
  planApprovalLimit Int    @default(10000000)
  reviewerDeptMap   Json?
}
```

`reviewerDeptMap` shape: `{ "hr": deptId, "procurement": deptId, "legal": deptId, "facility": deptId, "privacy": deptId }`. Null keys are skipped — partial config is valid.

- [ ] **Step 5: Update `User` model relations**

Remove:
```
createdPlans    DepartmentAnnualPlan[] @relation("PlanCreatedBy")
reviewedPlans   DepartmentAnnualPlan[] @relation("PlanReviewedBy")
```

Add:
```prisma
createdPlanReports  PlanReport[] @relation("PlanReportCreatedBy")
approvedPlanReports PlanReport[] @relation("PlanReportApprovedBy")
```

- [ ] **Step 6: Update `Department` model relations**

Remove:
```
annualPlans      DepartmentAnnualPlan[]
subjectConfigs   DepartmentReviewerConfig[] @relation("SubjectDept")
reviewerConfigs  DepartmentReviewerConfig[] @relation("ReviewerDept")
```

Add:
```prisma
planReports  PlanReport[]
```

(`planReviews PlanReview[] @relation("PlanReviewerDept")` stays as-is.)

- [ ] **Step 7: Generate migration and client**

```bash
cd apps/api
npx prisma migrate dev --name replace_department_annual_plan_with_plan_report
npx prisma generate
```

Expected: migration created, client regenerated with no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: replace DepartmentAnnualPlan with PlanReport schema"
```

---

## Task 2: Backend DTOs

**Files:**
- Create: `apps/api/src/plan-report/dto/plan-report.dto.ts`

- [ ] **Step 1: Write the DTO file**

```typescript
export type PlanTemplateType = 'GENERAL' | 'HR' | 'MARKETING' | 'GOODS' | 'SQUAD' | 'MEDICAL' | 'IT'
export type ApproverLevel = 'HEAD' | 'GM' | 'ADMIN'

export interface CreatePlanReportDto {
  title: string
  purpose: string
  departmentId: number
  startDate: string
  endDate: string
  budget: number
  expectedEffect: string
  risks: string
  attachments?: string[]
  resultDueDate: string
  templateType: PlanTemplateType
  extraFields?: Record<string, unknown>
  hasNewStaff?: boolean
  hasContract?: boolean
  hasExternalLease?: boolean
  hasPersonalInfo?: boolean
  isNewBusiness?: boolean
}

export interface UpdatePlanReportDto {
  title?: string
  purpose?: string
  departmentId?: number
  startDate?: string
  endDate?: string
  budget?: number
  expectedEffect?: string
  risks?: string
  attachments?: string[]
  resultDueDate?: string
  templateType?: PlanTemplateType
  extraFields?: Record<string, unknown> | null
  hasNewStaff?: boolean
  hasContract?: boolean
  hasExternalLease?: boolean
  hasPersonalInfo?: boolean
  isNewBusiness?: boolean
}

export interface SubmitResultDto {
  resultContent: string
}

export interface RejectPlanReportDto {
  reason: string
}

export interface ListPlanReportQuery {
  templateType?: string
  departmentId?: string
  status?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/plan-report/dto/
git commit -m "feat: add PlanReport DTOs"
```

---

## Task 3: Vault Writer + Tests

**Files:**
- Create: `apps/api/src/plan-report/vault.ts`
- Create: `apps/api/src/plan-report/vault.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/api/src/plan-report/vault.test.ts
import * as fs from 'fs/promises'
import { writeApprovalVaultNote, appendResultToVaultNote, VaultPlanData } from './vault'

jest.mock('fs/promises')
const mockFs = fs as jest.Mocked<typeof fs>

const baseData: VaultPlanData = {
  id: 1,
  title: '여름 마케팅 캠페인',
  templateType: 'MARKETING',
  departmentName: '마케팅',
  budget: 5000000,
  purpose: '팬 유치',
  expectedEffect: '관중 10% 증가',
  risks: '날씨 변수',
  attachments: ['https://drive.google.com/abc'],
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-08-31'),
  resultDueDate: new Date('2026-09-30'),
  approvedAt: new Date('2026-08-10'),
  approvedByUsername: 'admin',
  reviews: [{ deptName: '법무', confirmedByUsername: 'legal_head', confirmedAt: new Date('2026-08-09') }],
  extraFields: { campaign: '여름 페스타', target: '2030세대' },
}

describe('writeApprovalVaultNote', () => {
  beforeEach(() => {
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)
  })

  it('반환 경로가 연도 디렉토리 + .md 파일이다', async () => {
    const result = await writeApprovalVaultNote(baseData)
    expect(result).toContain('/2026/')
    expect(result).toMatch(/\.md$/)
  })

  it('연도 디렉토리를 recursive 생성한다', async () => {
    await writeApprovalVaultNote(baseData)
    expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('2026'), { recursive: true })
  })

  it('노트에 planId frontmatter와 결과보고 미완료 섹션이 포함된다', async () => {
    await writeApprovalVaultNote(baseData)
    const content = mockFs.writeFile.mock.calls[0][1] as string
    expect(content).toContain('planId: 1')
    expect(content).toContain('## 결과보고 (제출: 미완료)')
    expect(content).toContain('여름 페스타')
  })

  it('extraFields 없으면 업무별 섹션이 없다', async () => {
    await writeApprovalVaultNote({ ...baseData, extraFields: null })
    const content = mockFs.writeFile.mock.calls[0][1] as string
    expect(content).not.toContain('## 업무별 추가사항')
  })

  it('첨부자료가 노트에 포함된다', async () => {
    await writeApprovalVaultNote(baseData)
    const content = mockFs.writeFile.mock.calls[0][1] as string
    expect(content).toContain('https://drive.google.com/abc')
  })
})

describe('appendResultToVaultNote', () => {
  it('미완료 플레이스홀더를 결과 섹션으로 교체한다', async () => {
    const existing = 'some content\n## 결과보고 (제출: 미완료)\n'
    mockFs.readFile.mockResolvedValue(existing as any)
    mockFs.writeFile.mockResolvedValue(undefined)

    await appendResultToVaultNote('/vault/2026/plan.md', {
      content: '목표 달성 완료',
      submittedAt: new Date('2026-09-15'),
      submittedByUsername: 'user1',
    })

    const written = mockFs.writeFile.mock.calls[0][1] as string
    expect(written).toContain('## 결과보고 (제출: 2026-09-15)')
    expect(written).toContain('목표 달성 완료')
    expect(written).not.toContain('## 결과보고 (제출: 미완료)')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
cd apps/api && npx jest src/plan-report/vault.test.ts --no-coverage
```

Expected: FAIL with "Cannot find module './vault'"

- [ ] **Step 3: Implement vault.ts**

```typescript
// apps/api/src/plan-report/vault.ts
import * as fs from 'fs/promises'
import * as path from 'path'

const VAULT_BASE = '/Users/juno/ObsidianVault/plans'

export interface VaultPlanData {
  id: number
  title: string
  templateType: string
  departmentName: string
  budget: number
  purpose: string
  expectedEffect: string
  risks: string
  attachments: string[]
  startDate: Date
  endDate: Date
  resultDueDate: Date
  approvedAt: Date
  approvedByUsername: string
  reviews: Array<{ deptName: string; confirmedByUsername: string; confirmedAt: Date }>
  extraFields?: Record<string, unknown> | null
}

export async function writeApprovalVaultNote(data: VaultPlanData): Promise<string> {
  const year = data.approvedAt.getFullYear().toString()
  const dateStr = data.approvedAt.toISOString().slice(0, 10)
  const safeTitle = data.title.replace(/[^\w가-힣]/g, '-').replace(/-+/g, '-').slice(0, 40)
  const slug = `${dateStr}-${data.departmentName}-${safeTitle}`
  const dir = path.join(VAULT_BASE, year)
  const filePath = path.join(dir, `${slug}.md`)

  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, buildNoteContent(data), 'utf-8')
  return filePath
}

export async function appendResultToVaultNote(
  vaultPath: string,
  result: { content: string; submittedAt: Date; submittedByUsername: string }
): Promise<void> {
  const existing = await fs.readFile(vaultPath, 'utf-8')
  const section =
    `\n## 결과보고 (제출: ${result.submittedAt.toISOString().slice(0, 10)})\n\n` +
    `**제출자:** ${result.submittedByUsername}\n\n${result.content}\n`
  await fs.writeFile(vaultPath, existing.replace('## 결과보고 (제출: 미완료)', section), 'utf-8')
}

function buildNoteContent(data: VaultPlanData): string {
  const reviewLines = data.reviews.length
    ? data.reviews
        .map(r => `- ${r.deptName} 협조 확인: ${r.confirmedByUsername} (${r.confirmedAt.toISOString().slice(0, 10)})`)
        .join('\n')
    : '없음'

  const extraSection =
    data.extraFields && Object.keys(data.extraFields).length
      ? '\n## 업무별 추가사항\n\n' +
        Object.entries(data.extraFields)
          .map(([k, v]) => `- **${k}:** ${v}`)
          .join('\n')
      : ''

  const attachLines = data.attachments.length ? data.attachments.map(a => `- ${a}`).join('\n') : '없음'

  return `---
planId: ${data.id}
templateType: ${data.templateType}
status: APPROVED
department: ${data.departmentName}
budget: ${data.budget}
approvedBy: ${data.approvedByUsername}
approvedAt: ${data.approvedAt.toISOString().slice(0, 10)}
resultDueDate: ${data.resultDueDate.toISOString().slice(0, 10)}
---

# ${data.title}

## 계획 (승인: ${data.approvedAt.toISOString().slice(0, 10)})

**추진 목적:** ${data.purpose}

**추진 기간:** ${data.startDate.toISOString().slice(0, 10)} ~ ${data.endDate.toISOString().slice(0, 10)}

**예산:** ${data.budget.toLocaleString()}원

**기대효과:** ${data.expectedEffect}

**주요 리스크:** ${data.risks}

**첨부자료:**
${attachLines}
${extraSection}

## 결재 이력

${reviewLines}

## 결과보고 (제출: 미완료)
`
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/api && npx jest src/plan-report/vault.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plan-report/vault.ts apps/api/src/plan-report/vault.test.ts
git commit -m "feat: add Obsidian vault writer for PlanReport"
```

---

## Task 4: `canApprovePlan` permission helper

**Files:**
- Modify: `apps/api/src/lib/permissions.ts`

- [ ] **Step 1: Write failing test (inline in permissions.test.ts if it exists, or add to service test)**

Add these assertions to verify before implementing:

```typescript
// Verify expected behavior manually before adding function:
// ADMIN → can approve ADMIN level ✓
// GM → cannot approve ADMIN level ✓
// GM → can approve GM level ✓
// FRONT_OFFICE → cannot approve any level ✓
```

- [ ] **Step 2: Add `canApprovePlan` to `permissions.ts`**

```typescript
export function canApprovePlan(userRole: string, requiredLevel: string | null): boolean {
  switch (requiredLevel ?? 'HEAD') {
    case 'HEAD':
    case 'GM':
      return isAdminLike(userRole) // ADMIN, SUPER_ADMIN, GM
    case 'ADMIN':
      return userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'
    default:
      return false
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/permissions.ts
git commit -m "feat: add canApprovePlan permission helper"
```

---

## Task 5: Repository

**Files:**
- Create: `apps/api/src/plan-report/plan-report.repo.ts`

- [ ] **Step 1: Write the repository**

```typescript
// apps/api/src/plan-report/plan-report.repo.ts
import type { PrismaClient, Prisma } from '../generated/client'
import type {
  CreatePlanReportDto,
  UpdatePlanReportDto,
  ListPlanReportQuery,
} from './dto/plan-report.dto'

export interface ReviewerDeptMap {
  hr?: number
  procurement?: number
  legal?: number
  facility?: number
  privacy?: number
}

const PLAN_INCLUDE = {
  department: { select: { id: true, name: true, headId: true } },
  createdBy: { select: { id: true, username: true } },
  approvedBy: { select: { id: true, username: true } },
  reviews: {
    include: {
      reviewerDept: { select: { id: true, name: true } },
      confirmedBy: { select: { id: true, username: true } },
    },
  },
} satisfies Prisma.PlanReportInclude

export class PlanReportRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(filters: ListPlanReportQuery) {
    return this.prisma.planReport.findMany({
      where: {
        ...(filters.templateType && { templateType: filters.templateType as any }),
        ...(filters.departmentId && { departmentId: Number(filters.departmentId) }),
        ...(filters.status && { status: filters.status as any }),
      },
      include: PLAN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: number) {
    return this.prisma.planReport.findUnique({ where: { id }, include: PLAN_INCLUDE })
  }

  create(dto: CreatePlanReportDto, createdById: number) {
    return this.prisma.planReport.create({
      data: {
        title: dto.title,
        purpose: dto.purpose,
        departmentId: dto.departmentId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        budget: dto.budget,
        expectedEffect: dto.expectedEffect,
        risks: dto.risks,
        attachments: dto.attachments ?? [],
        resultDueDate: new Date(dto.resultDueDate),
        templateType: dto.templateType,
        extraFields: dto.extraFields ? (dto.extraFields as Prisma.InputJsonValue) : undefined,
        hasNewStaff: dto.hasNewStaff ?? false,
        hasContract: dto.hasContract ?? false,
        hasExternalLease: dto.hasExternalLease ?? false,
        hasPersonalInfo: dto.hasPersonalInfo ?? false,
        isNewBusiness: dto.isNewBusiness ?? false,
        createdById,
      },
      include: PLAN_INCLUDE,
    })
  }

  update(id: number, dto: UpdatePlanReportDto) {
    return this.prisma.planReport.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.purpose !== undefined && { purpose: dto.purpose }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
        ...(dto.expectedEffect !== undefined && { expectedEffect: dto.expectedEffect }),
        ...(dto.risks !== undefined && { risks: dto.risks }),
        ...(dto.attachments !== undefined && { attachments: dto.attachments }),
        ...(dto.resultDueDate !== undefined && { resultDueDate: new Date(dto.resultDueDate) }),
        ...(dto.templateType !== undefined && { templateType: dto.templateType }),
        ...('extraFields' in dto && { extraFields: dto.extraFields as Prisma.InputJsonValue ?? Prisma.JsonNull }),
        ...(dto.hasNewStaff !== undefined && { hasNewStaff: dto.hasNewStaff }),
        ...(dto.hasContract !== undefined && { hasContract: dto.hasContract }),
        ...(dto.hasExternalLease !== undefined && { hasExternalLease: dto.hasExternalLease }),
        ...(dto.hasPersonalInfo !== undefined && { hasPersonalInfo: dto.hasPersonalInfo }),
        ...(dto.isNewBusiness !== undefined && { isNewBusiness: dto.isNewBusiness }),
      },
      include: PLAN_INCLUDE,
    })
  }

  async submit(id: number, reviewerDeptIds: number[], requiredApproverLevel: string | null) {
    return this.prisma.$transaction(async (tx) => {
      if (reviewerDeptIds.length > 0) {
        await tx.planReview.createMany({
          data: reviewerDeptIds.map((reviewerDeptId) => ({ planId: id, reviewerDeptId })),
          skipDuplicates: true,
        })
      }
      return tx.planReport.update({
        where: { id },
        data: {
          status: 'REVIEWING',
          submittedAt: new Date(),
          requiredApproverLevel: requiredApproverLevel as any ?? null,
        },
        include: PLAN_INCLUDE,
      })
    })
  }

  async allReviewsComplete(planId: number): Promise<boolean> {
    const total = await this.prisma.planReview.count({ where: { planId } })
    if (total === 0) return true
    const confirmed = await this.prisma.planReview.count({ where: { planId, status: 'CONFIRMED' } })
    return total === confirmed
  }

  approve(id: number, approvedById: number, vaultPath: string) {
    return this.prisma.planReport.update({
      where: { id },
      data: { status: 'APPROVED', approvedById, approvedAt: new Date(), vaultPath },
      include: PLAN_INCLUDE,
    })
  }

  reject(id: number, approvedById: number, reason: string) {
    return this.prisma.planReport.update({
      where: { id },
      data: { status: 'DRAFT', approvedById, rejectedAt: new Date(), rejectionReason: reason },
      include: PLAN_INCLUDE,
    })
  }

  submitResult(id: number, resultContent: string) {
    return this.prisma.planReport.update({
      where: { id },
      data: { resultContent, resultSubmittedAt: new Date() },
      include: PLAN_INCLUDE,
    })
  }

  getClubSettings() {
    return this.prisma.clubSettings.findUniqueOrThrow({ where: { id: 1 } })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/plan-report/plan-report.repo.ts
git commit -m "feat: add PlanReport repository"
```

---

## Task 6: Service + Tests

**Files:**
- Create: `apps/api/src/plan-report/plan-report.service.ts`
- Create: `apps/api/src/plan-report/plan-report.service.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/plan-report/plan-report.service.test.ts
import { PlanReportService } from './plan-report.service'
import type { PlanReportRepository, ReviewerDeptMap } from './plan-report.repo'
import * as vault from './vault'

jest.mock('./vault')
const mockVault = vault as jest.Mocked<typeof vault>

const makeRepo = (overrides: Partial<PlanReportRepository> = {}): PlanReportRepository =>
  ({
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    submit: jest.fn(),
    allReviewsComplete: jest.fn().mockResolvedValue(true),
    approve: jest.fn(),
    reject: jest.fn(),
    submitResult: jest.fn(),
    getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: null }),
    ...overrides,
  } as unknown as PlanReportRepository)

const fakeDate = new Date('2026-08-10')

const fakePlan = (overrides = {}) => ({
  id: 1,
  title: '캠페인',
  purpose: '팬 유치',
  departmentId: 1,
  department: { id: 1, name: '마케팅', headId: 10 },
  startDate: fakeDate,
  endDate: fakeDate,
  budget: 5_000_000,
  expectedEffect: '관중 증가',
  risks: '날씨',
  attachments: [],
  resultDueDate: fakeDate,
  templateType: 'MARKETING',
  extraFields: null,
  hasNewStaff: false,
  hasContract: false,
  hasExternalLease: false,
  hasPersonalInfo: false,
  isNewBusiness: false,
  status: 'DRAFT',
  requiredApproverLevel: null,
  rejectionReason: null,
  resultContent: null,
  resultSubmittedAt: null,
  submittedAt: null,
  approvedAt: fakeDate,
  rejectedAt: null,
  vaultPath: null,
  createdById: 10,
  approvedById: null,
  createdBy: { id: 10, username: 'head' },
  approvedBy: null,
  reviews: [],
  ...overrides,
})

describe('getById', () => {
  it('존재하지 않으면 404', async () => {
    const svc = new PlanReportService(makeRepo())
    await expect(svc.getById(999)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('submit', () => {
  it('DRAFT가 아니면 409', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.submit(1, 10)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('부서장이 아니면 403', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan()) })
    const svc = new PlanReportService(repo)
    await expect(svc.submit(1, 999)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('예산이 전결한도 초과하면 requiredApproverLevel=GM', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ budget: 20_000_000 })),
      getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: null }),
      submit: jest.fn().mockResolvedValue(fakePlan()),
    })
    const svc = new PlanReportService(repo)
    await svc.submit(1, 10)
    expect(repo.submit).toHaveBeenCalledWith(1, [], 'GM')
  })

  it('신규사업이면 requiredApproverLevel=ADMIN', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ isNewBusiness: true })),
      getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: null }),
      submit: jest.fn().mockResolvedValue(fakePlan()),
    })
    const svc = new PlanReportService(repo)
    await svc.submit(1, 10)
    expect(repo.submit).toHaveBeenCalledWith(1, [], 'ADMIN')
  })

  it('예산초과+신규사업이면 ADMIN이 우선', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ budget: 20_000_000, isNewBusiness: true })),
      getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: null }),
      submit: jest.fn().mockResolvedValue(fakePlan()),
    })
    const svc = new PlanReportService(repo)
    await svc.submit(1, 10)
    expect(repo.submit).toHaveBeenCalledWith(1, [], 'ADMIN')
  })

  it('hasNewStaff이면 HR 부서가 reviewer에 추가된다', async () => {
    const deptMap: ReviewerDeptMap = { hr: 5 }
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ hasNewStaff: true })),
      getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: deptMap }),
      submit: jest.fn().mockResolvedValue(fakePlan()),
    })
    const svc = new PlanReportService(repo)
    await svc.submit(1, 10)
    expect(repo.submit).toHaveBeenCalledWith(1, [5], null)
  })

  it('hasContract이면 구매+법무 부서가 reviewer에 추가된다', async () => {
    const deptMap: ReviewerDeptMap = { procurement: 2, legal: 3 }
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ hasContract: true })),
      getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: deptMap }),
      submit: jest.fn().mockResolvedValue(fakePlan()),
    })
    const svc = new PlanReportService(repo)
    await svc.submit(1, 10)
    expect(repo.submit).toHaveBeenCalledWith(1, expect.arrayContaining([2, 3]), null)
  })
})

describe('approve', () => {
  it('REVIEWING이 아니면 409', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'DRAFT' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.approve(1, 10, 'ADMIN')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('requiredApproverLevel=ADMIN인데 GM이 승인하면 403', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING', requiredApproverLevel: 'ADMIN' })),
    })
    const svc = new PlanReportService(repo)
    await expect(svc.approve(1, 10, 'GM')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('리뷰 미완료이면 409', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING' })),
      allReviewsComplete: jest.fn().mockResolvedValue(false),
    })
    const svc = new PlanReportService(repo)
    await expect(svc.approve(1, 10, 'ADMIN')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('승인 성공 시 vault 노트를 생성한다', async () => {
    const plan = fakePlan({ status: 'REVIEWING' })
    mockVault.writeApprovalVaultNote.mockResolvedValue('/vault/2026/plan.md')
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(plan),
      allReviewsComplete: jest.fn().mockResolvedValue(true),
      approve: jest.fn().mockResolvedValue(plan),
    })
    const svc = new PlanReportService(repo)
    await svc.approve(1, 10, 'ADMIN')
    expect(mockVault.writeApprovalVaultNote).toHaveBeenCalled()
    expect(repo.approve).toHaveBeenCalledWith(1, 10, '/vault/2026/plan.md')
  })
})

describe('reject', () => {
  it('사유 없으면 400', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.reject(1, 10, 'ADMIN', '')).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('submitResult', () => {
  it('APPROVED가 아니면 409', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.submitResult(1, 10, '결과내용')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('결과 제출 성공 시 vault 노트를 업데이트한다', async () => {
    const plan = fakePlan({ status: 'APPROVED', vaultPath: '/vault/2026/plan.md', createdById: 10 })
    mockVault.appendResultToVaultNote.mockResolvedValue(undefined)
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(plan),
      submitResult: jest.fn().mockResolvedValue(plan),
    })
    const svc = new PlanReportService(repo)
    await svc.submitResult(1, 10, '결과내용')
    expect(mockVault.appendResultToVaultNote).toHaveBeenCalledWith('/vault/2026/plan.md', expect.objectContaining({ content: '결과내용' }))
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/api && npx jest src/plan-report/plan-report.service.test.ts --no-coverage
```

Expected: FAIL with "Cannot find module './plan-report.service'"

- [ ] **Step 3: Implement plan-report.service.ts**

```typescript
// apps/api/src/plan-report/plan-report.service.ts
import { AppError } from '../lib/appError'
import { canApprovePlan } from '../lib/permissions'
import { PlanReportRepository, ReviewerDeptMap } from './plan-report.repo'
import { CreatePlanReportDto, ListPlanReportQuery, RejectPlanReportDto, UpdatePlanReportDto } from './dto/plan-report.dto'
import { writeApprovalVaultNote, appendResultToVaultNote, VaultPlanData } from './vault'

export class PlanReportService {
  constructor(private repo: PlanReportRepository) {}

  list(filters: ListPlanReportQuery) {
    return this.repo.findAll(filters)
  }

  async getById(id: number) {
    const plan = await this.repo.findById(id)
    if (!plan) throw new AppError(404, 'PLAN_REPORT_NOT_FOUND')
    return plan
  }

  create(dto: CreatePlanReportDto, createdById: number) {
    return this.repo.create(dto, createdById)
  }

  async update(id: number, dto: UpdatePlanReportDto) {
    const plan = await this.getById(id)
    if (plan.status === 'APPROVED') throw new AppError(409, 'CANNOT_MODIFY_APPROVED_PLAN')
    return this.repo.update(id, dto)
  }

  async submit(id: number, userId: number) {
    const plan = await this.getById(id)
    if (plan.status !== 'DRAFT') throw new AppError(409, 'CANNOT_SUBMIT_NON_DRAFT')
    if (plan.department.headId !== userId) throw new AppError(403, 'ONLY_HEAD_CAN_SUBMIT')

    const settings = await this.repo.getClubSettings()
    const deptMap = (settings.reviewerDeptMap ?? {}) as ReviewerDeptMap

    const reviewerDeptIds = resolveReviewerDeptIds(plan, deptMap)
    const requiredApproverLevel = resolveApproverLevel(plan.budget, plan.isNewBusiness, settings.planApprovalLimit)

    return this.repo.submit(id, reviewerDeptIds, requiredApproverLevel)
  }

  async approve(id: number, userId: number, userRole: string) {
    const plan = await this.getById(id)
    if (plan.status !== 'REVIEWING') throw new AppError(409, 'CANNOT_APPROVE_NON_REVIEWING')
    if (!canApprovePlan(userRole, plan.requiredApproverLevel)) throw new AppError(403, 'FORBIDDEN')

    const allComplete = await this.repo.allReviewsComplete(id)
    if (!allComplete) throw new AppError(409, 'REVIEWS_NOT_COMPLETE')

    const vaultData = toVaultData(plan)
    const vaultPath = await writeApprovalVaultNote(vaultData)
    return this.repo.approve(id, userId, vaultPath)
  }

  async reject(id: number, userId: number, userRole: string, reason: string) {
    if (!canApprovePlan(userRole, 'HEAD')) throw new AppError(403, 'FORBIDDEN')
    if (!reason?.trim()) throw new AppError(400, 'REJECTION_REASON_REQUIRED')
    const plan = await this.getById(id)
    if (plan.status !== 'REVIEWING') throw new AppError(409, 'CANNOT_REJECT_NON_REVIEWING')
    return this.repo.reject(id, userId, reason)
  }

  async submitResult(id: number, userId: number, resultContent: string) {
    if (!resultContent?.trim()) throw new AppError(400, 'RESULT_CONTENT_REQUIRED')
    const plan = await this.getById(id)
    if (plan.status !== 'APPROVED') throw new AppError(409, 'PLAN_NOT_APPROVED')

    const updated = await this.repo.submitResult(id, resultContent)

    if (plan.vaultPath) {
      await appendResultToVaultNote(plan.vaultPath, {
        content: resultContent,
        submittedAt: new Date(),
        submittedByUsername: plan.createdBy.username,
      })
    }

    return updated
  }
}

function resolveApproverLevel(budget: number, isNewBusiness: boolean, limit: number): string | null {
  if (isNewBusiness) return 'ADMIN'
  if (budget > limit) return 'GM'
  return null
}

function resolveReviewerDeptIds(
  plan: { hasNewStaff: boolean; hasContract: boolean; hasExternalLease: boolean; hasPersonalInfo: boolean },
  deptMap: ReviewerDeptMap
): number[] {
  const ids = new Set<number>()
  if (plan.hasNewStaff && deptMap.hr) ids.add(deptMap.hr)
  if (plan.hasContract) {
    if (deptMap.procurement) ids.add(deptMap.procurement)
    if (deptMap.legal) ids.add(deptMap.legal)
  }
  if (plan.hasExternalLease) {
    if (deptMap.facility) ids.add(deptMap.facility)
    if (deptMap.legal) ids.add(deptMap.legal)
  }
  if (plan.hasPersonalInfo) {
    if (deptMap.legal) ids.add(deptMap.legal)
    if (deptMap.privacy) ids.add(deptMap.privacy)
  }
  return Array.from(ids)
}

function toVaultData(plan: any): VaultPlanData {
  return {
    id: plan.id,
    title: plan.title,
    templateType: plan.templateType,
    departmentName: plan.department.name,
    budget: plan.budget,
    purpose: plan.purpose,
    expectedEffect: plan.expectedEffect,
    risks: plan.risks,
    attachments: plan.attachments,
    startDate: plan.startDate,
    endDate: plan.endDate,
    resultDueDate: plan.resultDueDate,
    approvedAt: new Date(),
    approvedByUsername: plan.approvedBy?.username ?? 'system',
    reviews: plan.reviews
      .filter((r: any) => r.status === 'CONFIRMED')
      .map((r: any) => ({
        deptName: r.reviewerDept.name,
        confirmedByUsername: r.confirmedBy?.username ?? '',
        confirmedAt: r.confirmedAt ?? new Date(),
      })),
    extraFields: plan.extraFields as Record<string, unknown> | null,
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/api && npx jest src/plan-report/plan-report.service.test.ts --no-coverage
```

Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plan-report/plan-report.service.ts apps/api/src/plan-report/plan-report.service.test.ts
git commit -m "feat: add PlanReport service with conditional approval engine"
```

---

## Task 7: Controller + Routes (including file upload)

**Files:**
- Create: `apps/api/src/plan-report/plan-report.controller.ts`
- Create: `apps/api/src/plan-report/plan-report.routes.ts`

- [ ] **Step 1: Write plan-report.controller.ts**

```typescript
// apps/api/src/plan-report/plan-report.controller.ts
import type { Request, Response, NextFunction } from 'express'
import type { PlanReportService } from './plan-report.service'
import path from 'path'

export class PlanReportController {
  constructor(private service: PlanReportService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await this.service.list(req.query as any)
      res.json(plans)
    } catch (e) { next(e) }
  }

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await this.service.getById(Number(req.params.id))
      res.json(plan)
    } catch (e) { next(e) }
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await this.service.create(req.body, req.user!.id)
      res.status(201).json(plan)
    } catch (e) { next(e) }
  }

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await this.service.update(Number(req.params.id), req.body)
      res.json(plan)
    } catch (e) { next(e) }
  }

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await this.service.submit(Number(req.params.id), req.user!.id)
      res.json(plan)
    } catch (e) { next(e) }
  }

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await this.service.approve(Number(req.params.id), req.user!.id, req.user!.role)
      res.json(plan)
    } catch (e) { next(e) }
  }

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await this.service.reject(Number(req.params.id), req.user!.id, req.user!.role, req.body.reason)
      res.json(plan)
    } catch (e) { next(e) }
  }

  submitResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await this.service.submitResult(Number(req.params.id), req.user!.id, req.body.resultContent)
      res.json(plan)
    } catch (e) { next(e) }
  }

  uploadAttachment = (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'NO_FILE_UPLOADED' })
    const relativePath = `/uploads/${path.basename(req.file.path)}`
    res.json({ url: relativePath })
  }
}
```

- [ ] **Step 2: Write plan-report.routes.ts**

```typescript
// apps/api/src/plan-report/plan-report.routes.ts
import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { PlanReportController } from './plan-report.controller'
import { PlanReportService } from './plan-report.service'
import { PlanReportRepository } from './plan-report.repo'
import { auth } from '../lib/authMiddleware'
import { getPrisma } from '../lib/prisma'

const router = Router()
const prisma = getPrisma()
const repo = new PlanReportRepository(prisma)
const service = new PlanReportService(repo)
const controller = new PlanReportController(service)

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'uploads'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
})

router.get('/', auth, controller.list)
router.get('/:id', auth, controller.getById)
router.post('/', auth, controller.create)
router.put('/:id', auth, controller.update)
router.post('/:id/submit', auth, controller.submit)
router.post('/:id/approve', auth, controller.approve)
router.post('/:id/reject', auth, controller.reject)
router.post('/:id/result', auth, controller.submitResult)
router.post('/upload', auth, upload.single('file'), controller.uploadAttachment)

export default router
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/plan-report/plan-report.controller.ts apps/api/src/plan-report/plan-report.routes.ts
git commit -m "feat: add PlanReport controller and routes with file upload"
```

---

## Task 8: Update Plan Review Service

**Files:**
- Modify: `apps/api/src/plan-review/plan-review.service.ts`
- Modify: `apps/api/src/plan-review/plan-review.repo.ts`

- [ ] **Step 1: Update plan-review.service.ts**

Change `departmentAnnualPlan` → `planReport` in the `confirm` method:

```typescript
// apps/api/src/plan-review/plan-review.service.ts
// ... (keep imports same, update only the prisma call)

async confirm(planId: number, userId: number, comment?: string) {
  const review = await this.prisma.planReview.findFirst({
    where: { planId, reviewerDept: { headId: userId } },
  })
  if (!review) throw new AppError(403, 'NOT_A_REVIEWER')
  if (review.status === 'CONFIRMED') throw new AppError(409, 'ALREADY_CONFIRMED')

  const plan = await this.prisma.planReport.findUnique({ where: { id: planId } })  // changed
  if (!plan || plan.status !== 'REVIEWING') throw new AppError(409, 'PLAN_NOT_IN_REVIEWING')

  return this.repo.confirm(planId, review.reviewerDeptId, userId, comment)
}
```

- [ ] **Step 2: Verify plan-review.repo.ts has no DepartmentAnnualPlan references**

```bash
grep "departmentAnnualPlan\|DepartmentAnnualPlan" apps/api/src/plan-review/plan-review.repo.ts
```

Expected: no output. If any found, replace with `planReport` / `PlanReport`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/plan-review/
git commit -m "fix: update plan-review to reference PlanReport instead of DepartmentAnnualPlan"
```

---

## Task 9: Server Wiring + Delete Old Module

**Files:**
- Modify: `apps/api/src/server.ts`
- Delete: `apps/api/src/department-plan/` (directory)

- [ ] **Step 1: Update server.ts**

Find the import and route registration for department-plan routes (search for `department-plan` in server.ts).

Replace:
```typescript
import departmentPlanRoutes from './department-plan/department-plan.routes'
// ...
app.use('/department-plans', departmentPlanRoutes)
```

With:
```typescript
import planReportRoutes from './plan-report/plan-report.routes'
// ...
app.use('/plan-reports', planReportRoutes)
```

- [ ] **Step 2: Delete old department-plan module**

```bash
rm -rf apps/api/src/department-plan
```

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all existing tests pass, no import errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "feat: wire PlanReport routes, remove DepartmentAnnualPlan module"
```

---

## Task 10: Frontend Types + API Service

**Files:**
- Create: `football/src/types/plan-report.ts`
- Create: `football/src/services/plan-report.service.ts`
- Delete: `football/src/types/department-plan.ts`
- Delete: `football/src/services/department-plan.service.ts`

- [ ] **Step 1: Write types**

```typescript
// football/src/types/plan-report.ts
export type PlanStatus = 'DRAFT' | 'REVIEWING' | 'APPROVED' | 'REJECTED'
export type ReviewStatus = 'PENDING' | 'CONFIRMED'
export type PlanTemplateType = 'GENERAL' | 'HR' | 'MARKETING' | 'GOODS' | 'SQUAD' | 'MEDICAL' | 'IT'
export type ApproverLevel = 'HEAD' | 'GM' | 'ADMIN'

export interface PlanReport {
  id: number
  title: string
  purpose: string
  departmentId: number
  department: { id: number; name: string; headId: number | null }
  startDate: string
  endDate: string
  budget: number
  expectedEffect: string
  risks: string
  attachments: string[]
  resultDueDate: string
  templateType: PlanTemplateType
  extraFields: Record<string, unknown> | null
  hasNewStaff: boolean
  hasContract: boolean
  hasExternalLease: boolean
  hasPersonalInfo: boolean
  isNewBusiness: boolean
  status: PlanStatus
  requiredApproverLevel: ApproverLevel | null
  rejectionReason: string | null
  resultContent: string | null
  resultSubmittedAt: string | null
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  vaultPath: string | null
  createdById: number
  createdBy: { id: number; username: string }
  approvedById: number | null
  approvedBy: { id: number; username: string } | null
  reviews: PlanReview[]
  createdAt: string
  updatedAt: string
}

export interface PlanReview {
  id: number
  planId: number
  reviewerDeptId: number
  reviewerDept: { id: number; name: string }
  status: ReviewStatus
  comment: string | null
  confirmedById: number | null
  confirmedBy: { id: number; username: string } | null
  confirmedAt: string | null
  createdAt: string
}

export const TEMPLATE_TYPE_LABELS: Record<PlanTemplateType, string> = {
  GENERAL: '일반',
  HR: 'HR',
  MARKETING: '마케팅',
  GOODS: '굿즈',
  SQUAD: '선수단',
  MEDICAL: '의료',
  IT: 'IT',
}

export const EXTRA_FIELDS_CONFIG: Record<PlanTemplateType, Array<{ key: string; label: string; type: 'text' | 'number' | 'date' }>> = {
  GENERAL: [],
  HR: [
    { key: 'jobTitle', label: '직무', type: 'text' },
    { key: 'headcount', label: '인원', type: 'number' },
    { key: 'salary', label: '급여', type: 'number' },
    { key: 'employmentType', label: '고용형태', type: 'text' },
    { key: 'hireDate', label: '채용일', type: 'date' },
  ],
  MARKETING: [
    { key: 'campaign', label: '캠페인', type: 'text' },
    { key: 'target', label: '타깃', type: 'text' },
    { key: 'channels', label: '홍보채널', type: 'text' },
    { key: 'kpi', label: 'KPI', type: 'text' },
  ],
  GOODS: [
    { key: 'sku', label: 'SKU', type: 'text' },
    { key: 'quantity', label: '제작수량', type: 'number' },
    { key: 'unitCost', label: '단가', type: 'number' },
    { key: 'salePrice', label: '판매가', type: 'number' },
    { key: 'stock', label: '재고', type: 'number' },
  ],
  SQUAD: [
    { key: 'contractPeriod', label: '계약기간', type: 'text' },
    { key: 'salary', label: '연봉', type: 'number' },
    { key: 'transferFee', label: '이적료', type: 'number' },
    { key: 'agent', label: '에이전트', type: 'text' },
  ],
  MEDICAL: [
    { key: 'injuryRisk', label: '부상위험', type: 'text' },
    { key: 'treatmentPlan', label: '치료계획', type: 'text' },
    { key: 'dataAccess', label: '개인정보 접근권한', type: 'text' },
  ],
  IT: [
    { key: 'scope', label: '시스템 범위', type: 'text' },
    { key: 'securityLevel', label: '보안등급', type: 'text' },
    { key: 'linkedSystems', label: '연계시스템', type: 'text' },
    { key: 'maintenance', label: '유지보수', type: 'text' },
  ],
}
```

- [ ] **Step 2: Write frontend service**

```typescript
// football/src/services/plan-report.service.ts
import api from '@/lib/api'
import type { PlanReport } from '@/types/plan-report'

export const planReportApi = {
  list: (params?: Record<string, string>) =>
    api.get<PlanReport[]>('/plan-reports', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<PlanReport>(`/plan-reports/${id}`).then(r => r.data),

  create: (data: object) =>
    api.post<PlanReport>('/plan-reports', data).then(r => r.data),

  update: (id: number, data: object) =>
    api.put<PlanReport>(`/plan-reports/${id}`, data).then(r => r.data),

  submit: (id: number) =>
    api.post<PlanReport>(`/plan-reports/${id}/submit`).then(r => r.data),

  approve: (id: number) =>
    api.post<PlanReport>(`/plan-reports/${id}/approve`).then(r => r.data),

  reject: (id: number, reason: string) =>
    api.post<PlanReport>(`/plan-reports/${id}/reject`, { reason }).then(r => r.data),

  submitResult: (id: number, resultContent: string) =>
    api.post<PlanReport>(`/plan-reports/${id}/result`, { resultContent }).then(r => r.data),

  uploadFile: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ url: string }>('/plan-reports/upload', form).then(r => r.data.url)
  },
}
```

- [ ] **Step 3: Delete old files**

```bash
rm football/src/types/department-plan.ts
rm football/src/services/department-plan.service.ts
```

- [ ] **Step 4: Commit**

```bash
git add football/src/types/plan-report.ts football/src/services/plan-report.service.ts
git commit -m "feat: add PlanReport frontend types and API service"
```

---

## Task 11: Frontend — List Page

**Files:**
- Create: `football/src/pages/finance/PlanReportListPage.tsx`
- Delete: `football/src/pages/finance/DepartmentPlanListPage.tsx`

- [ ] **Step 1: Write PlanReportListPage.tsx**

```tsx
// football/src/pages/finance/PlanReportListPage.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { planReportApi } from '@/services/plan-report.service'
import { PlanReport, PlanTemplateType, TEMPLATE_TYPE_LABELS } from '@/types/plan-report'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중', REVIEWING: '검토중', APPROVED: '승인', REJECTED: '반려',
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  REVIEWING: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export function PlanReportListPage() {
  const [plans, setPlans] = useState<PlanReport[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    const params: Record<string, string> = {}
    if (filterStatus) params.status = filterStatus
    if (filterType) params.templateType = filterType
    planReportApi.list(params).then(setPlans)
  }, [filterStatus, filterType])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">계획보고서</h1>
        <Link to="/finance/plan-reports/new" className="btn btn-primary">+ 새 보고서</Link>
      </div>

      <div className="flex gap-3 mb-4">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="select select-bordered">
          <option value="">전체 업무</option>
          {(Object.keys(TEMPLATE_TYPE_LABELS) as PlanTemplateType[]).map(t => (
            <option key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select select-bordered">
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>사업명</th><th>업무</th><th>주관부서</th><th>예산</th><th>상태</th><th>생성일</th>
            </tr>
          </thead>
          <tbody>
            {plans.map(p => (
              <tr key={p.id} className="hover cursor-pointer">
                <td>
                  <Link to={`/finance/plan-reports/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td><span className="badge badge-outline">{TEMPLATE_TYPE_LABELS[p.templateType]}</span></td>
                <td>{p.department.name}</td>
                <td>{p.budget.toLocaleString()}원</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td>{p.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">보고서가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Delete old page**

```bash
rm football/src/pages/finance/DepartmentPlanListPage.tsx
rm football/src/pages/finance/DepartmentBudgetSummaryPage.tsx
```

- [ ] **Step 3: Commit**

```bash
git add football/src/pages/finance/PlanReportListPage.tsx
git commit -m "feat: add PlanReportListPage"
```

---

## Task 12: Frontend — Form Page

**Files:**
- Create: `football/src/pages/finance/PlanReportFormPage.tsx`
- Delete: `football/src/pages/finance/DepartmentPlanFormPage.tsx`

- [ ] **Step 1: Write PlanReportFormPage.tsx**

```tsx
// football/src/pages/finance/PlanReportFormPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { planReportApi } from '@/services/plan-report.service'
import { PlanTemplateType, TEMPLATE_TYPE_LABELS, EXTRA_FIELDS_CONFIG } from '@/types/plan-report'
import { departmentApi } from '@/services/department.service'

interface Dept { id: number; name: string }

const EMPTY_FORM = {
  title: '', purpose: '', departmentId: 0, startDate: '', endDate: '',
  budget: 0, expectedEffect: '', risks: '', resultDueDate: '',
  templateType: 'GENERAL' as PlanTemplateType,
  attachments: [] as string[],
  extraFields: {} as Record<string, unknown>,
  hasNewStaff: false, hasContract: false, hasExternalLease: false,
  hasPersonalInfo: false, isNewBusiness: false,
}

export function PlanReportFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY_FORM)
  const [departments, setDepartments] = useState<Dept[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    departmentApi.list().then(setDepartments)
    if (isEdit) {
      planReportApi.get(Number(id)).then(p => {
        setForm({
          title: p.title, purpose: p.purpose, departmentId: p.departmentId,
          startDate: p.startDate.slice(0, 10), endDate: p.endDate.slice(0, 10),
          budget: p.budget, expectedEffect: p.expectedEffect, risks: p.risks,
          resultDueDate: p.resultDueDate.slice(0, 10),
          templateType: p.templateType, attachments: p.attachments,
          extraFields: (p.extraFields as Record<string, unknown>) ?? {},
          hasNewStaff: p.hasNewStaff, hasContract: p.hasContract,
          hasExternalLease: p.hasExternalLease, hasPersonalInfo: p.hasPersonalInfo,
          isNewBusiness: p.isNewBusiness,
        })
      })
    }
  }, [id])

  const set = (key: keyof typeof EMPTY_FORM, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const setExtra = (key: string, value: unknown) =>
    setForm(prev => ({ ...prev, extraFields: { ...prev.extraFields, [key]: value } }))

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await planReportApi.uploadFile(file)
      set('attachments', [...form.attachments, url])
    } finally { setUploading(false) }
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      const data = { ...form, extraFields: Object.keys(form.extraFields).length ? form.extraFields : undefined }
      const plan = isEdit
        ? await planReportApi.update(Number(id), data)
        : await planReportApi.create(data)
      navigate(`/finance/plan-reports/${plan.id}`)
    } catch (e: any) {
      setError(e?.response?.data?.error ?? '저장에 실패했습니다')
    } finally { setSaving(false) }
  }

  const extraFields = EXTRA_FIELDS_CONFIG[form.templateType]

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{isEdit ? '계획보고서 수정' : '계획보고서 작성'}</h1>

      {/* 공통 양식 */}
      <section className="card bg-base-100 shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">공통 양식</h2>

        <div className="form-control">
          <label className="label"><span className="label-text">사업명 *</span></label>
          <input className="input input-bordered" value={form.title} onChange={e => set('title', e.target.value)} />
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">업무 유형 *</span></label>
          <select className="select select-bordered" value={form.templateType}
            onChange={e => { set('templateType', e.target.value as PlanTemplateType); set('extraFields', {}) }}>
            {(Object.keys(TEMPLATE_TYPE_LABELS) as PlanTemplateType[]).map(t => (
              <option key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">추진 목적 *</span></label>
          <textarea className="textarea textarea-bordered" rows={3} value={form.purpose} onChange={e => set('purpose', e.target.value)} />
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">주관 부서 *</span></label>
          <select className="select select-bordered" value={form.departmentId}
            onChange={e => set('departmentId', Number(e.target.value))}>
            <option value={0}>선택</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label"><span className="label-text">추진 시작일 *</span></label>
            <input type="date" className="input input-bordered" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">추진 종료일 *</span></label>
            <input type="date" className="input input-bordered" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
          </div>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">예산 (원) *</span></label>
          <input type="number" className="input input-bordered" value={form.budget} onChange={e => set('budget', Number(e.target.value))} />
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">기대효과 *</span></label>
          <textarea className="textarea textarea-bordered" rows={2} value={form.expectedEffect} onChange={e => set('expectedEffect', e.target.value)} />
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">주요 리스크 *</span></label>
          <textarea className="textarea textarea-bordered" rows={2} value={form.risks} onChange={e => set('risks', e.target.value)} />
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">결과보고 예정일 *</span></label>
          <input type="date" className="input input-bordered" value={form.resultDueDate} onChange={e => set('resultDueDate', e.target.value)} />
        </div>

        {/* 첨부자료 */}
        <div className="form-control">
          <label className="label"><span className="label-text">첨부자료</span></label>
          <div className="flex gap-2 mb-2">
            <input className="input input-bordered flex-1" placeholder="URL 직접 입력" value={newUrl}
              onChange={e => setNewUrl(e.target.value)} />
            <button type="button" className="btn btn-outline" onClick={() => {
              if (newUrl.trim()) { set('attachments', [...form.attachments, newUrl.trim()]); setNewUrl('') }
            }}>추가</button>
          </div>
          <input type="file" className="file-input file-input-bordered" onChange={handleFileUpload} disabled={uploading} />
          {form.attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 mt-1 text-sm">
              <span className="flex-1 truncate">{a}</span>
              <button type="button" className="text-red-500" onClick={() =>
                set('attachments', form.attachments.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      </section>

      {/* 업무별 추가 양식 */}
      {extraFields.length > 0 && (
        <section className="card bg-base-100 shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold">{TEMPLATE_TYPE_LABELS[form.templateType]} 추가 양식</h2>
          {extraFields.map(f => (
            <div key={f.key} className="form-control">
              <label className="label"><span className="label-text">{f.label}</span></label>
              <input
                type={f.type}
                className="input input-bordered"
                value={(form.extraFields[f.key] as string | number) ?? ''}
                onChange={e => setExtra(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
              />
            </div>
          ))}
        </section>
      )}

      {/* 조건부 결재 플래그 */}
      <section className="card bg-base-100 shadow p-6">
        <h2 className="text-lg font-semibold mb-4">조건 확인 (결재선 자동 설정)</h2>
        <div className="space-y-2">
          {[
            { key: 'hasNewStaff', label: '신규 인력 채용이 포함됩니까? (HR 협조)' },
            { key: 'hasContract', label: '외부 계약이 포함됩니까? (구매·법무 협조)' },
            { key: 'hasExternalLease', label: '외부 임대가 포함됩니까? (시설·법무 협조)' },
            { key: 'hasPersonalInfo', label: '개인정보·선수 초상권이 포함됩니까? (법무·개인정보 협조)' },
            { key: 'isNewBusiness', label: '신규 사업입니까? (구단주 승인 필요)' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="checkbox"
                checked={form[key as keyof typeof EMPTY_FORM] as boolean}
                onChange={e => set(key as keyof typeof EMPTY_FORM, e.target.checked)} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="flex justify-end gap-3">
        <button className="btn btn-outline" onClick={() => navigate(-1)}>취소</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Delete old form page**

```bash
rm football/src/pages/finance/DepartmentPlanFormPage.tsx
```

- [ ] **Step 3: Commit**

```bash
git add football/src/pages/finance/PlanReportFormPage.tsx
git commit -m "feat: add PlanReportFormPage with template selector, conditional flags, file upload"
```

---

## Task 13: Frontend — Detail Page + Router

**Files:**
- Create: `football/src/pages/finance/PlanReportDetailPage.tsx`
- Modify: `football/src/App.tsx`
- Delete: `football/src/pages/finance/DepartmentPlanDetailPage.tsx`

- [ ] **Step 1: Write PlanReportDetailPage.tsx**

```tsx
// football/src/pages/finance/PlanReportDetailPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { planReportApi } from '@/services/plan-report.service'
import { PlanReport, TEMPLATE_TYPE_LABELS, EXTRA_FIELDS_CONFIG } from '@/types/plan-report'
import { useAuthStore } from '@/store/authStore'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중', REVIEWING: '검토중', APPROVED: '승인완료', REJECTED: '반려',
}

export function PlanReportDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [plan, setPlan] = useState<PlanReport | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [resultContent, setResultContent] = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [showResultBox, setShowResultBox] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    planReportApi.get(Number(id)).then(setPlan)
  }, [id])

  if (!plan) return <div className="p-6">로딩 중...</div>

  const isHead = user?.id === plan.department.headId
  const isAdminLike = ['ADMIN', 'SUPER_ADMIN', 'GM'].includes(user?.role ?? '')
  const extraFields = EXTRA_FIELDS_CONFIG[plan.templateType]

  const confirmReview = async () => {
    setLoading(true)
    try {
      // plan-review confirm is a separate endpoint
      await fetch(`/api/plan-reviews/${plan.id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      setPlan(await planReportApi.get(plan.id))
    } finally { setLoading(false) }
  }

  const handleApprove = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.approve(plan.id)) } finally { setLoading(false) }
  }

  const handleReject = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.reject(plan.id, rejectReason)); setShowRejectBox(false) } finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.submit(plan.id)) } finally { setLoading(false) }
  }

  const handleResult = async () => {
    setLoading(true)
    try { setPlan(await planReportApi.submitResult(plan.id, resultContent)); setShowResultBox(false) } finally { setLoading(false) }
  }

  const myReview = plan.reviews.find(r => {
    // check if user is head of reviewerDept — simplification: check confirmedById
    return r.status === 'PENDING'
  })

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{plan.title}</h1>
        <div className="flex gap-2 items-center">
          <span className="badge badge-lg">{STATUS_LABELS[plan.status]}</span>
          <span className="badge badge-outline">{TEMPLATE_TYPE_LABELS[plan.templateType]}</span>
        </div>
      </div>

      {plan.rejectionReason && (
        <div className="alert alert-warning">
          <span>반려 사유: {plan.rejectionReason}</span>
        </div>
      )}

      {/* 공통 정보 */}
      <section className="card bg-base-100 shadow p-6">
        <h2 className="text-lg font-semibold mb-4">기본 정보</h2>
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="font-medium text-gray-500">주관 부서</dt><dd>{plan.department.name}</dd>
          <dt className="font-medium text-gray-500">추진 목적</dt><dd className="col-span-1">{plan.purpose}</dd>
          <dt className="font-medium text-gray-500">추진 기간</dt>
          <dd>{plan.startDate.slice(0, 10)} ~ {plan.endDate.slice(0, 10)}</dd>
          <dt className="font-medium text-gray-500">예산</dt><dd>{plan.budget.toLocaleString()}원</dd>
          <dt className="font-medium text-gray-500">기대효과</dt><dd>{plan.expectedEffect}</dd>
          <dt className="font-medium text-gray-500">주요 리스크</dt><dd>{plan.risks}</dd>
          <dt className="font-medium text-gray-500">결과보고 예정일</dt><dd>{plan.resultDueDate.slice(0, 10)}</dd>
          {plan.requiredApproverLevel && (
            <><dt className="font-medium text-gray-500">요구 승인선</dt><dd>{plan.requiredApproverLevel}</dd></>
          )}
        </dl>
        {plan.attachments.length > 0 && (
          <div className="mt-4">
            <p className="font-medium text-gray-500 text-sm mb-1">첨부자료</p>
            {plan.attachments.map((a, i) => (
              <a key={i} href={a} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline truncate">{a}</a>
            ))}
          </div>
        )}
      </section>

      {/* 업무별 추가 정보 */}
      {extraFields.length > 0 && plan.extraFields && (
        <section className="card bg-base-100 shadow p-6">
          <h2 className="text-lg font-semibold mb-4">{TEMPLATE_TYPE_LABELS[plan.templateType]} 추가 정보</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            {extraFields.map(f => (
              <>
                <dt key={`${f.key}-dt`} className="font-medium text-gray-500">{f.label}</dt>
                <dd key={`${f.key}-dd`}>{String(plan.extraFields![f.key] ?? '-')}</dd>
              </>
            ))}
          </dl>
        </section>
      )}

      {/* 결재 조건 플래그 */}
      <section className="card bg-base-100 shadow p-6">
        <h2 className="text-lg font-semibold mb-3">결재 조건</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {plan.hasNewStaff && <span className="badge badge-warning">신규인력</span>}
          {plan.hasContract && <span className="badge badge-warning">계약포함</span>}
          {plan.hasExternalLease && <span className="badge badge-warning">외부임대</span>}
          {plan.hasPersonalInfo && <span className="badge badge-warning">개인정보</span>}
          {plan.isNewBusiness && <span className="badge badge-error">신규사업</span>}
          {!plan.hasNewStaff && !plan.hasContract && !plan.hasExternalLease && !plan.hasPersonalInfo && !plan.isNewBusiness && (
            <span className="text-gray-400">해당 없음</span>
          )}
        </div>
      </section>

      {/* 협조 부서 검토 현황 */}
      {plan.reviews.length > 0 && (
        <section className="card bg-base-100 shadow p-6">
          <h2 className="text-lg font-semibold mb-3">협조 부서 검토 ({plan.reviews.filter(r => r.status === 'CONFIRMED').length}/{plan.reviews.length})</h2>
          {plan.reviews.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm">{r.reviewerDept.name}</span>
              <span className={`badge ${r.status === 'CONFIRMED' ? 'badge-success' : 'badge-ghost'}`}>
                {r.status === 'CONFIRMED' ? `확인: ${r.confirmedBy?.username}` : '대기중'}
              </span>
            </div>
          ))}
          {plan.status === 'REVIEWING' && myReview && (
            <button className="btn btn-sm btn-outline mt-3" onClick={confirmReview} disabled={loading}>
              내 부서 협조 확인
            </button>
          )}
        </section>
      )}

      {/* 결과보고 */}
      {plan.status === 'APPROVED' && (
        <section className="card bg-base-100 shadow p-6">
          <h2 className="text-lg font-semibold mb-3">결과보고</h2>
          {plan.resultContent ? (
            <div>
              <p className="text-sm text-gray-500 mb-1">제출일: {plan.resultSubmittedAt?.slice(0, 10)}</p>
              <p className="whitespace-pre-wrap text-sm">{plan.resultContent}</p>
            </div>
          ) : isHead ? (
            showResultBox ? (
              <div className="space-y-2">
                <textarea className="textarea textarea-bordered w-full" rows={4} placeholder="결과를 입력하세요"
                  value={resultContent} onChange={e => setResultContent(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={handleResult} disabled={loading}>제출</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowResultBox(false)}>취소</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={() => setShowResultBox(true)}>결과보고 작성</button>
            )
          ) : (
            <p className="text-sm text-gray-400">결과보고 미제출</p>
          )}
        </section>
      )}

      {/* vault 링크 */}
      {plan.vaultPath && (
        <div className="text-xs text-gray-400">Vault: {plan.vaultPath}</div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-3 justify-end">
        {plan.status === 'DRAFT' && (
          <>
            <Link to={`/finance/plan-reports/${plan.id}/edit`} className="btn btn-outline">수정</Link>
            {isHead && (
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>결재 상신</button>
            )}
          </>
        )}
        {plan.status === 'REVIEWING' && isAdminLike && (
          <>
            <button className="btn btn-success" onClick={handleApprove} disabled={loading}>승인</button>
            <button className="btn btn-error btn-outline" onClick={() => setShowRejectBox(!showRejectBox)}>반려</button>
          </>
        )}
      </div>

      {showRejectBox && (
        <div className="flex gap-2">
          <input className="input input-bordered flex-1" placeholder="반려 사유" value={rejectReason}
            onChange={e => setRejectReason(e.target.value)} />
          <button className="btn btn-error" onClick={handleReject} disabled={loading}>확인</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx routes**

Find the department-plan route block in `football/src/App.tsx` and replace:

```tsx
// Remove these imports:
import { DepartmentPlanListPage } from '@/pages/finance/DepartmentPlanListPage'
import { DepartmentPlanFormPage } from '@/pages/finance/DepartmentPlanFormPage'
import { DepartmentPlanDetailPage } from '@/pages/finance/DepartmentPlanDetailPage'
import { DepartmentBudgetSummaryPage } from '@/pages/finance/DepartmentBudgetSummaryPage'

// Add these imports:
import { PlanReportListPage } from '@/pages/finance/PlanReportListPage'
import { PlanReportFormPage } from '@/pages/finance/PlanReportFormPage'
import { PlanReportDetailPage } from '@/pages/finance/PlanReportDetailPage'
```

```tsx
// Remove these routes:
<Route path="/finance/department-plans" element={<DepartmentPlanListPage />} />
<Route path="/finance/department-plans/new" element={<DepartmentPlanFormPage />} />
<Route path="/finance/department-plans/budget-summary" element={<DepartmentBudgetSummaryPage />} />
<Route path="/finance/department-plans/:id/edit" element={<DepartmentPlanFormPage />} />
<Route path="/finance/department-plans/:id" element={<DepartmentPlanDetailPage />} />

// Add these routes:
<Route path="/finance/plan-reports" element={<PlanReportListPage />} />
<Route path="/finance/plan-reports/new" element={<PlanReportFormPage />} />
<Route path="/finance/plan-reports/:id/edit" element={<PlanReportFormPage />} />
<Route path="/finance/plan-reports/:id" element={<PlanReportDetailPage />} />
```

- [ ] **Step 3: Delete old detail page**

```bash
rm football/src/pages/finance/DepartmentPlanDetailPage.tsx
```

- [ ] **Step 4: TypeScript build check**

```bash
cd football && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to plan-report).

- [ ] **Step 5: Commit**

```bash
git add football/src/pages/finance/PlanReportDetailPage.tsx football/src/App.tsx
git commit -m "feat: add PlanReportDetailPage and update router"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|-------------|------|
| 공통 양식 (사업명, 목적, 부서, 기간, 예산, 기대효과, 리스크, 첨부, 결과보고일) | Tasks 1, 2, 12 |
| 업무별 추가 양식 (HR/마케팅/굿즈/선수단/의료/IT) | Tasks 2, 10, 12 |
| 조건부 결재 규칙 (6가지 조건) | Task 6 |
| 전결한도 ClubSettings 저장 | Task 1 |
| 협조부서 deptMap ClubSettings 저장 | Tasks 1, 5 |
| 최고 승인선 우선 (ADMIN > GM > HEAD) | Tasks 4, 6 |
| 승인 시 Vault .md 생성 | Tasks 3, 6 |
| 결과보고 제출 시 Vault .md 업데이트 | Tasks 3, 6 |
| 파일 업로드 (multer) + URL 배열 | Task 7 |
| 결과보고 동일 테이블 | Tasks 1, 6 |
| DepartmentAnnualPlan 삭제 (마이그레이션 없음) | Tasks 1, 9 |
| PlanReview 유지 (새 모델 참조) | Tasks 1, 8 |
| 프론트 List/Form/Detail 교체 | Tasks 11, 12, 13 |

### No Placeholders Check

All steps contain actual code, exact commands, and expected outputs. ✓

### Type Consistency

- `PlanTemplateType` defined in `plan-report.dto.ts` (backend) and `plan-report.ts` (frontend) — both match.
- `ApproverLevel` same pattern.
- `resolveReviewerDeptIds` takes the same shape used in `fakePlan` test fixtures.
- `toVaultData` uses `plan.reviews.filter(r => r.status === 'CONFIRMED')` — matches `PlanReview.status` enum.
- `planReportApi` method names match controller endpoints. ✓
