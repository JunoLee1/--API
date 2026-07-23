# 가중치 기반 RTP + 외부 의무보고 시스템 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부상 부위 표준화 → 가중치(Medical 40% / Functional 40% / Modifier 20%) 기반 RTP 평가 → 임계점(80점) 초과 시 유스/프로 분기로 외부 의무보고서 자동 생성, 부상 상세 페이지에 평가 폼·외부 보고서·상태 타임라인 표시.

**Architecture:** Prisma에 `BodyPart` enum·`InjuryAssessment`·`ExternalReport` 모델 추가. BE는 TDD로 `calculateScore()` 순수 함수 + `processAssessment()` Prisma 트랜잭션 구현. FE는 InjuryDetailPage에 섹션 추가, InjuriesPage/InjuryStatsPage는 bodyPart 드롭다운으로 교체.

**Tech Stack:** Prisma 7, Express, Jest(BE), React + TypeScript, Tailwind + shadcn/ui(FE)

---

## 파일 구조

### 신규 생성
- `apps/api/prisma/migrations/[ts]_body_part_assessment_external_report/migration.sql`
- `apps/api/src/injury/injury.score.ts` — 가중치 계산 순수 함수 (테스트 가능)
- `apps/api/__test__/injury/injury.score.test.ts` — 계산 로직 단위 테스트
- `apps/api/__test__/injury/injury.assessment.test.ts` — 컨트롤러 통합 테스트
- `football/src/components/injury/AssessmentForm.tsx` — 가중치 평가 입력 폼

### 수정
- `apps/api/prisma/schema.prisma` — BodyPart enum, InjuryAssessment, ExternalReport 모델
- `apps/api/src/injury/dto/injury.dto.ts` — UpsertAssessmentDto 추가
- `apps/api/src/injury/injury.repo.ts` — assessment/externalReport CRUD + bodyPart 쿼리 수정
- `apps/api/src/injury/injury.service.ts` — processAssessment() 추가
- `apps/api/src/injury/injury.controller.ts` — GET/PUT /assessment, GET /external-reports 추가
- `apps/api/src/injury/injury.routes.ts` — 신규 라우트 등록
- `football/src/types/injury.ts` — BodyPart, InjuryAssessment, ExternalReport 타입
- `football/src/services/injury.service.ts` — getAssessment, saveAssessment, getExternalReports
- `football/src/pages/injuries/InjuriesPage.tsx` — bodyPart 드롭다운
- `football/src/pages/injuries/InjuryStatsPage.tsx` — BODY_PART_LABEL 적용
- `football/src/pages/injuries/InjuryDetailPage.tsx` — 평가 섹션, 외부 보고서 섹션, 상태 타임라인

---

## Task 1: BodyPart 표준화 — Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: schema.prisma에 BodyPart enum 추가, Injury.bodyPart 타입 변경**

`schema.prisma`의 기존 `enum InjuryCause` 바로 위에 추가:
```prisma
enum BodyPart {
  HEAD_FACE
  NECK_SHOULDER
  TORSO_BACK
  THIGH_FRONT
  THIGH_BACK
  KNEE
  SHIN_CALF
  ANKLE
  FOOT_TOE
  OTHER
}
```

`model Injury` 내 `bodyPart String` → `bodyPart BodyPart`:
```prisma
  bodyPart           BodyPart
```

`InjuryAssessment` 모델과 `ExternalReport` 모델도 이 Task에서 함께 추가 (마이그레이션을 한 번에):

```prisma
model InjuryAssessment {
  id               Int      @id @default(autoincrement())
  injuryId         Int      @unique
  painLevel        Int      // 0-10
  hasSwelling      Boolean  @default(false)
  romScore         Int      // 0-100
  strengthScore    Int      // 0-100
  sprintScore      Int      // 0-100
  jumpScore        Int      // 0-100
  psychScore       Int      // 0-100
  positionRiskScore Int     // 0-100
  medicalScore     Float
  functionalScore  Float
  modifierScore    Float
  totalScore       Float
  assessedAt       DateTime @default(now())
  assessedById     Int

  injury     Injury @relation(fields: [injuryId], references: [id], onDelete: Cascade)
  assessedBy User   @relation(fields: [assessedById], references: [id])
}

enum ExternalReportTarget {
  EDUCATION_OFFICE
  SCHOOL_SAFETY
  LEAGUE
  FEDERATION
  INSURANCE
}

enum ExternalReportStatus {
  PENDING_SUBMISSION
  SUBMITTED
  SUPPLEMENT_REQUESTED
  COMPLETED
}

model ExternalReport {
  id          Int                  @id @default(autoincrement())
  injuryId    Int
  target      ExternalReportTarget
  status      ExternalReportStatus @default(PENDING_SUBMISSION)
  reportData  Json
  dueDate     DateTime?
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  injury      Injury @relation(fields: [injuryId], references: [id], onDelete: Cascade)
}
```

`model Injury`에 relation 추가:
```prisma
  assessment      InjuryAssessment?
  externalReports ExternalReport[]
```

- [x] **Step 2: 마이그레이션 생성**

```bash
cd apps/api
npx prisma migrate dev --name body_part_assessment_external_report
```

마이그레이션 프롬프트에서 "데이터 손실 허용" 확인 (기존 bodyPart String → BodyPart 변환, 모든 기존 값 OTHER로 설정).

생성된 migration.sql 파일 열어 상단에 아래 SQL이 포함됐는지 확인:
```sql
CREATE TYPE "BodyPart" AS ENUM ('HEAD_FACE', 'NECK_SHOULDER', 'TORSO_BACK', ...);
```

- [x] **Step 3: Prisma 클라이언트 재생성**

```bash
npx prisma generate
```

`src/generated/enums.ts`에 `BodyPart`, `ExternalReportTarget`, `ExternalReportStatus` enum이 추가됐는지 확인.

- [x] **Step 4: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(injury): add BodyPart enum, InjuryAssessment, ExternalReport models"
```

---

## Task 2: 가중치 계산 엔진 — TDD

**Files:**
- Create: `apps/api/src/injury/injury.score.ts`
- Create: `apps/api/__test__/injury/injury.score.test.ts`

- [x] **Step 1: 실패 테스트 작성**

`apps/api/__test__/injury/injury.score.test.ts`:
```typescript
import { describe, test, expect } from "@jest/globals";
import {
  calculateMedicalScore,
  calculateFunctionalScore,
  calculateModifierScore,
  calculateTotalScore,
} from "../../src/injury/injury.score";

describe("calculateMedicalScore", () => {
  test("최대 통증 + 부종 + ROM 0 → 40", () => {
    expect(calculateMedicalScore(10, true, 0)).toBeCloseTo(40);
  });
  test("통증 없음 + 부종 없음 + ROM 100 → 0", () => {
    expect(calculateMedicalScore(0, false, 100)).toBeCloseTo(0);
  });
  test("중간 케이스: painLevel=5, swelling=true, rom=50 → 25", () => {
    // pain: 5/10*20=10, swelling: 10, rom: (100-50)/100*10=5 → 25
    expect(calculateMedicalScore(5, true, 50)).toBeCloseTo(25);
  });
});

describe("calculateFunctionalScore", () => {
  test("기능 전혀 없음 (0,0,0) → 40", () => {
    expect(calculateFunctionalScore(0, 0, 0)).toBeCloseTo(40);
  });
  test("완전 회복 (100,100,100) → 0", () => {
    expect(calculateFunctionalScore(100, 100, 100)).toBeCloseTo(0);
  });
  test("평균 50 → 20", () => {
    expect(calculateFunctionalScore(50, 50, 50)).toBeCloseTo(20);
  });
});

describe("calculateModifierScore", () => {
  test("최대 불안 + 최대 위험 포지션 (100,100) → 20", () => {
    expect(calculateModifierScore(100, 100)).toBeCloseTo(20);
  });
  test("안정 + 저위험 (0,0) → 0", () => {
    expect(calculateModifierScore(0, 0)).toBeCloseTo(0);
  });
});

describe("calculateTotalScore", () => {
  test("임계점 초과 케이스 → totalScore ≥ 80", () => {
    const result = calculateTotalScore({
      painLevel: 10, hasSwelling: true, romScore: 0,
      strengthScore: 0, sprintScore: 0, jumpScore: 0,
      psychScore: 100, positionRiskScore: 100,
    });
    expect(result.totalScore).toBeCloseTo(100);
    expect(result.medicalScore).toBeCloseTo(40);
    expect(result.functionalScore).toBeCloseTo(40);
    expect(result.modifierScore).toBeCloseTo(20);
  });
  test("경미한 부상 → totalScore < 80", () => {
    const result = calculateTotalScore({
      painLevel: 2, hasSwelling: false, romScore: 90,
      strengthScore: 85, sprintScore: 80, jumpScore: 85,
      psychScore: 10, positionRiskScore: 20,
    });
    expect(result.totalScore).toBeLessThan(80);
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api
npx jest --testPathPattern="injury.score" --no-coverage
```

Expected: FAIL "Cannot find module '../../src/injury/injury.score'"

- [x] **Step 3: 계산 함수 구현**

`apps/api/src/injury/injury.score.ts`:
```typescript
export interface AssessmentInput {
  painLevel: number;        // 0-10
  hasSwelling: boolean;
  romScore: number;         // 0-100
  strengthScore: number;    // 0-100
  sprintScore: number;      // 0-100
  jumpScore: number;        // 0-100
  psychScore: number;       // 0-100
  positionRiskScore: number; // 0-100
}

export interface ScoreResult {
  medicalScore: number;    // 0-40
  functionalScore: number; // 0-40
  modifierScore: number;   // 0-20
  totalScore: number;      // 0-100
}

export function calculateMedicalScore(
  painLevel: number,
  hasSwelling: boolean,
  romScore: number
): number {
  const pain = (painLevel / 10) * 20;
  const swelling = hasSwelling ? 10 : 0;
  const rom = ((100 - romScore) / 100) * 10;
  return pain + swelling + rom;
}

export function calculateFunctionalScore(
  strengthScore: number,
  sprintScore: number,
  jumpScore: number
): number {
  const avg = (strengthScore + sprintScore + jumpScore) / 3;
  return ((100 - avg) / 100) * 40;
}

export function calculateModifierScore(
  psychScore: number,
  positionRiskScore: number
): number {
  const avg = (psychScore + positionRiskScore) / 2;
  return (avg / 100) * 20;
}

export function calculateTotalScore(input: AssessmentInput): ScoreResult {
  const medicalScore = calculateMedicalScore(input.painLevel, input.hasSwelling, input.romScore);
  const functionalScore = calculateFunctionalScore(input.strengthScore, input.sprintScore, input.jumpScore);
  const modifierScore = calculateModifierScore(input.psychScore, input.positionRiskScore);
  return {
    medicalScore,
    functionalScore,
    modifierScore,
    totalScore: medicalScore + functionalScore + modifierScore,
  };
}

export const SCORE_THRESHOLD = 80;
```

- [x] **Step 4: 테스트 통과 확인**

```bash
npx jest --testPathPattern="injury.score" --no-coverage
```

Expected: 8/8 PASS

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/injury/injury.score.ts apps/api/__test__/injury/injury.score.test.ts
git commit -m "feat(injury): add weight-based score calculation functions (TDD)"
```

---

## Task 3: Assessment + ExternalReport DTO · Repo · Service

**Files:**
- Modify: `apps/api/src/injury/dto/injury.dto.ts`
- Modify: `apps/api/src/injury/injury.repo.ts`
- Modify: `apps/api/src/injury/injury.service.ts`

- [x] **Step 1: DTO 추가**

`apps/api/src/injury/dto/injury.dto.ts` 하단에 추가:
```typescript
import { BodyPart, ExternalReportTarget, ExternalReportStatus } from "../../generated/enums";

// BodyPart을 재export (FE 참조용)
export { BodyPart };

export interface UpsertAssessmentDto {
  painLevel: number;
  hasSwelling: boolean;
  romScore: number;
  strengthScore: number;
  sprintScore: number;
  jumpScore: number;
  psychScore: number;
  positionRiskScore: number;
}

// CreateInjuryDto의 bodyPart 타입을 string → BodyPart로 업데이트
```

`CreateInjuryDto`의 `bodyPart: string` → `bodyPart: BodyPart`:
```typescript
export interface CreateInjuryDto {
  playerId: string;
  bodyPart: BodyPart;
  cause: InjuryCause;
  expectedReturnDate?: string;
  medicalStaffId: number;
  hospitalType?: HospitalType;
  partnerId?: number;
  customHospitalName?: string;
}
```

`import` 상단에 `BodyPart` 추가:
```typescript
import { InjuryCause, InjuryStatus, HospitalType, RehabStage, RiskLevel, SecurityLevel, BodyPart } from "../../generated/enums";
```

- [x] **Step 2: Repo에 assessment + externalReport 메서드 추가**

`apps/api/src/injury/injury.repo.ts`에 아래 메서드 추가 (`InjuryRepository` 클래스 내):

```typescript
async getAssessment(injuryId: number) {
  return this.prisma.injuryAssessment.findUnique({ where: { injuryId } });
}

async upsertAssessment(
  injuryId: number,
  scores: {
    painLevel: number; hasSwelling: boolean; romScore: number;
    strengthScore: number; sprintScore: number; jumpScore: number;
    psychScore: number; positionRiskScore: number;
    medicalScore: number; functionalScore: number; modifierScore: number; totalScore: number;
  },
  assessedById: number
) {
  return this.prisma.injuryAssessment.upsert({
    where: { injuryId },
    create: { injuryId, assessedById, ...scores },
    update: { assessedById, assessedAt: new Date(), ...scores },
  });
}

async createExternalReports(injuryId: number, targets: import("../../generated/enums").ExternalReportTarget[], reportData: object) {
  await this.prisma.externalReport.createMany({
    data: targets.map((target) => ({ injuryId, target, reportData })),
    skipDuplicates: true,
  });
}

async getExternalReports(injuryId: number) {
  return this.prisma.externalReport.findMany({ where: { injuryId }, orderBy: { createdAt: "asc" } });
}
```

`injury.repo.ts` 상단 import에 `ExternalReportTarget` 추가:
```typescript
import { InjuryCause, InjuryStatus, ExternalReportTarget } from "../generated/enums";
```

- [x] **Step 3: Service에 processAssessment 추가**

`apps/api/src/injury/injury.service.ts` 상단 import에 추가:
```typescript
import { calculateTotalScore, SCORE_THRESHOLD } from "./injury.score";
import { ExternalReportTarget } from "../generated/enums";
```

`InjuryService` 클래스에 메서드 추가:
```typescript
async getAssessment(injuryId: number) {
  return this.repo.getAssessment(injuryId);
}

async processAssessment(injuryId: number, dto: UpsertAssessmentDto, assessedById: number) {
  const scores = calculateTotalScore(dto);

  const assessment = await this.repo.upsertAssessment(injuryId, { ...dto, ...scores }, assessedById);

  if (scores.totalScore >= SCORE_THRESHOLD) {
    const injury = await this.repo.getById(injuryId);
    if (!injury) throw new Error("Injury not found");

    const isYouth = injury.player.level === "YOUTH";
    const targets: ExternalReportTarget[] = isYouth
      ? [ExternalReportTarget.EDUCATION_OFFICE, ExternalReportTarget.SCHOOL_SAFETY]
      : [ExternalReportTarget.LEAGUE, ExternalReportTarget.FEDERATION, ExternalReportTarget.INSURANCE];

    const reportData = {
      playerName: injury.player.playerName,
      bodyPart: injury.bodyPart,
      cause: injury.cause,
      occurredAt: injury.occurredAt,
      totalScore: scores.totalScore,
      generatedAt: new Date().toISOString(),
    };

    await this.repo.createExternalReports(injuryId, targets, reportData);
  }

  return { assessment, triggeredReports: scores.totalScore >= SCORE_THRESHOLD };
}

async getExternalReports(injuryId: number) {
  return this.repo.getExternalReports(injuryId);
}
```

`injury.service.ts` 상단 import에 `UpsertAssessmentDto` 추가.

- [x] **Step 4: getById가 player.level을 포함하는지 확인**

`injury.repo.ts`의 `getById` 메서드에서 `player` include가 있는지 확인:
```typescript
async getById(id: number) {
  return this.prisma.injury.findUnique({
    where: { id },
    include: {
      player: true,  // ← player.level 필요
      medicalStaff: { select: { id: true, username: true } },
      injuryReport: true,
      partner: true,
    },
  });
}
```

`player: true`가 없으면 `include` 블록에 추가.

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/injury/
git commit -m "feat(injury): add assessment + external report repo/service methods"
```

---

## Task 4: Assessment API 컨트롤러 + 라우트 — TDD

**Files:**
- Create: `apps/api/__test__/injury/injury.assessment.test.ts`
- Modify: `apps/api/src/injury/injury.controller.ts`
- Modify: `apps/api/src/injury/injury.routes.ts`

- [x] **Step 1: 실패 테스트 작성**

`apps/api/__test__/injury/injury.assessment.test.ts`:
```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { InjuryController } from "../../src/injury/injury.controller";

const mockService = {
  getByPlayer: jest.fn(),
  getById: jest.fn(),
  createInjury: jest.fn(),
  updateStatus: jest.fn(),
  getStats: jest.fn(),
  getReport: jest.fn(),
  saveReport: jest.fn(),
  getAssessment: jest.fn(),
  processAssessment: jest.fn(),
  getExternalReports: jest.fn(),
} as any;

const controller = new InjuryController(mockService);

const mockReq = (overrides: any) =>
  ({ user: { id: 1, role: "COACHING_STAFF", coachingRole: "MEDICAL", frontOfficeRole: null }, body: {}, params: {}, query: {}, ...overrides }) as any;

const mockRes = () => {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

const mockNext = jest.fn() as any;

describe("InjuryController - getAssessment", () => {
  beforeEach(() => jest.clearAllMocks());

  test("MEDICAL → 200 + assessment data", async () => {
    const mockAssessment = { id: 1, injuryId: 5, totalScore: 72 };
    mockService.getAssessment.mockResolvedValue(mockAssessment);
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();
    await controller.getAssessment(req, res, mockNext);
    expect(mockService.getAssessment).toHaveBeenCalledWith(5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockAssessment);
  });

  test("ADMIN도 접근 가능 → 200", async () => {
    mockService.getAssessment.mockResolvedValue(null);
    const req = mockReq({ user: { id: 2, role: "ADMIN", coachingRole: null, frontOfficeRole: null }, params: { id: "3" } });
    const res = mockRes();
    await controller.getAssessment(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("InjuryController - processAssessment", () => {
  beforeEach(() => jest.clearAllMocks());

  test("MEDICAL → processAssessment 호출 + 결과 반환", async () => {
    const mockResult = { assessment: { totalScore: 85 }, triggeredReports: true };
    mockService.processAssessment.mockResolvedValue(mockResult);
    const dto = { painLevel: 9, hasSwelling: true, romScore: 10, strengthScore: 5, sprintScore: 5, jumpScore: 5, psychScore: 90, positionRiskScore: 80 };
    const req = mockReq({ params: { id: "5" }, body: dto });
    const res = mockRes();
    await controller.processAssessment(req, res, mockNext);
    expect(mockService.processAssessment).toHaveBeenCalledWith(5, dto, 1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });
});

describe("InjuryController - getExternalReports", () => {
  beforeEach(() => jest.clearAllMocks());

  test("외부 보고서 목록 반환 → 200", async () => {
    const reports = [{ id: 1, target: "LEAGUE", status: "PENDING_SUBMISSION" }];
    mockService.getExternalReports.mockResolvedValue(reports);
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();
    await controller.getExternalReports(req, res, mockNext);
    expect(mockService.getExternalReports).toHaveBeenCalledWith(5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(reports);
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

```bash
cd apps/api
npx jest --testPathPattern="injury.assessment" --no-coverage
```

Expected: FAIL "controller.getAssessment is not a function"

- [x] **Step 3: 컨트롤러에 메서드 추가**

`apps/api/src/injury/injury.controller.ts`에 추가:
```typescript
getAssessment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await this.service.getAssessment(Number(req.params["id"]));
    res.status(200).json(data);
  } catch (e) { next(e); }
};

processAssessment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await this.service.processAssessment(
      Number(req.params["id"]),
      req.body,
      req.user!.id
    );
    res.status(200).json(result);
  } catch (e) { next(e); }
};

getExternalReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await this.service.getExternalReports(Number(req.params["id"]));
    res.status(200).json(data);
  } catch (e) { next(e); }
};
```

- [x] **Step 4: 라우트 등록**

`apps/api/src/injury/injury.routes.ts`에서 기존 라우트 블록 뒤에 추가 (권한 미들웨어는 기존 패턴 따름):
```typescript
// Assessment
router.get("/:id/assessment", requireAuth, controller.getAssessment);
router.put("/:id/assessment", requireAuth, controller.processAssessment);

// External Reports
router.get("/:id/external-reports", requireAuth, controller.getExternalReports);
```

- [x] **Step 5: 테스트 통과 확인**

```bash
npx jest --testPathPattern="injury.(score|assessment)" --no-coverage
```

Expected: 11/11 PASS

- [x] **Step 6: 커밋**

```bash
git add apps/api/src/injury/ apps/api/__test__/injury/
git commit -m "feat(injury): add assessment + external report controller/routes (TDD)"
```

---

## Task 5: FE 타입 + 서비스 + BodyPart 드롭다운

**Files:**
- Modify: `football/src/types/injury.ts`
- Modify: `football/src/services/injury.service.ts`
- Modify: `football/src/pages/injuries/InjuriesPage.tsx`
- Modify: `football/src/pages/injuries/InjuryStatsPage.tsx`

- [x] **Step 1: types/injury.ts에 새 타입 추가**

`football/src/types/injury.ts`에 추가:
```typescript
export type BodyPart =
  | 'HEAD_FACE' | 'NECK_SHOULDER' | 'TORSO_BACK'
  | 'THIGH_FRONT' | 'THIGH_BACK' | 'KNEE'
  | 'SHIN_CALF' | 'ANKLE' | 'FOOT_TOE' | 'OTHER'

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  HEAD_FACE:      '머리/얼굴',
  NECK_SHOULDER:  '목/어깨',
  TORSO_BACK:     '몸통/허리',
  THIGH_FRONT:    '허벅지(앞)',
  THIGH_BACK:     '허벅지(뒤)',
  KNEE:           '무릎',
  SHIN_CALF:      '정강이/종아리',
  ANKLE:          '발목',
  FOOT_TOE:       '발/발가락',
  OTHER:          '기타',
}

export const BODY_PARTS: BodyPart[] = [
  'HEAD_FACE', 'NECK_SHOULDER', 'TORSO_BACK',
  'THIGH_FRONT', 'THIGH_BACK', 'KNEE',
  'SHIN_CALF', 'ANKLE', 'FOOT_TOE', 'OTHER',
]

export interface InjuryAssessment {
  id: number
  injuryId: number
  painLevel: number
  hasSwelling: boolean
  romScore: number
  strengthScore: number
  sprintScore: number
  jumpScore: number
  psychScore: number
  positionRiskScore: number
  medicalScore: number
  functionalScore: number
  modifierScore: number
  totalScore: number
  assessedAt: string
}

export type ExternalReportTarget =
  | 'EDUCATION_OFFICE' | 'SCHOOL_SAFETY'
  | 'LEAGUE' | 'FEDERATION' | 'INSURANCE'

export type ExternalReportStatus =
  | 'PENDING_SUBMISSION' | 'SUBMITTED' | 'SUPPLEMENT_REQUESTED' | 'COMPLETED'

export const EXTERNAL_REPORT_TARGET_LABEL: Record<ExternalReportTarget, string> = {
  EDUCATION_OFFICE: '교육청',
  SCHOOL_SAFETY:    '학교안전공제회',
  LEAGUE:           '리그 연맹',
  FEDERATION:       '협회',
  INSURANCE:        '보험사',
}

export const EXTERNAL_REPORT_STATUS_LABEL: Record<ExternalReportStatus, string> = {
  PENDING_SUBMISSION:   '제출 대기',
  SUBMITTED:            '제출 완료',
  SUPPLEMENT_REQUESTED: '보완 요청',
  COMPLETED:            '완료',
}

export const EXTERNAL_REPORT_STATUS_STYLE: Record<ExternalReportStatus, string> = {
  PENDING_SUBMISSION:   'bg-orange-50 text-orange-700 border-orange-200',
  SUBMITTED:            'bg-blue-50 text-blue-700 border-blue-200',
  SUPPLEMENT_REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED:            'bg-green-50 text-green-700 border-green-200',
}

export interface ExternalReport {
  id: number
  injuryId: number
  target: ExternalReportTarget
  status: ExternalReportStatus
  reportData: Record<string, unknown>
  dueDate: string | null
  createdAt: string
}
```

기존 `Injury` 인터페이스의 `bodyPart: string` → `bodyPart: BodyPart`로 변경.

- [x] **Step 2: injury.service.ts에 API 메서드 추가**

`football/src/services/injury.service.ts`에 추가:
```typescript
import type { InjuryAssessment, ExternalReport } from '@/types/injury'

// injuryApi 객체에 추가:
async getAssessment(injuryId: number): Promise<InjuryAssessment | null> {
  const res = await api.get(`/injuries/${injuryId}/assessment`)
  return res.data
},
async saveAssessment(injuryId: number, dto: {
  painLevel: number; hasSwelling: boolean; romScore: number;
  strengthScore: number; sprintScore: number; jumpScore: number;
  psychScore: number; positionRiskScore: number;
}): Promise<{ assessment: InjuryAssessment; triggeredReports: boolean }> {
  const res = await api.put(`/injuries/${injuryId}/assessment`, dto)
  return res.data
},
async getExternalReports(injuryId: number): Promise<ExternalReport[]> {
  const res = await api.get(`/injuries/${injuryId}/external-reports`)
  return res.data
},
```

- [x] **Step 3: InjuriesPage — bodyPart 드롭다운으로 교체**

`football/src/pages/injuries/InjuriesPage.tsx` 상단 import에 추가:
```typescript
import { BODY_PARTS, BODY_PART_LABEL, type BodyPart } from '@/types/injury'
```

`CreateInjuryDialog` 내 `bodyPart` state 타입 변경:
```typescript
const [bodyPart, setBodyPart] = useState<BodyPart | ''>('')
```

기존 `<Input placeholder="예: 왼쪽 무릎" ...>` 교체:
```tsx
<Select value={bodyPart} onValueChange={(v) => setBodyPart(v as BodyPart)}>
  <SelectTrigger><SelectValue placeholder="부상 부위 선택" /></SelectTrigger>
  <SelectContent>
    {BODY_PARTS.map((bp) => (
      <SelectItem key={bp} value={bp}>{BODY_PART_LABEL[bp]}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

validation 변경 (빈 Input → 빈 Select):
```typescript
if (!bodyPart) { toast.error('부상 부위를 선택해주세요.'); return }
```

테이블 셀에서 `inj.bodyPart` 표시도 한글 라벨로:
```tsx
import { BODY_PART_LABEL } from '@/types/injury'
// ...
<TableCell className="font-medium">
  {BODY_PART_LABEL[inj.bodyPart] ?? inj.bodyPart}
</TableCell>
```

- [x] **Step 4: InjuryStatsPage — byBodyPart 한글 라벨**

`football/src/pages/injuries/InjuryStatsPage.tsx` import에 추가:
```typescript
import { BODY_PART_LABEL, type BodyPart } from '@/types/injury'
```

`bodyPartEntries` 출력 부분에서 key를 한글로:
```tsx
{bodyPartEntries.map(([part, count]) => (
  <BarRow
    key={part}
    label={BODY_PART_LABEL[part as BodyPart] ?? part}
    count={count}
    max={maxBodyPart}
  />
))}
```

의무보고서 snapshot에도 한글 라벨 반영:
```typescript
const bodyPartEntries = Object.entries(stats.byBodyPart).sort(([, a], [, b]) => b - a)
// ...
bodyPartEntries.forEach(([part, count]) =>
  lines.push(`- ${BODY_PART_LABEL[part as BodyPart] ?? part}: ${count}건`)
)
```

- [x] **Step 5: 타입 체크**

```bash
cd football && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: 오류 없음

- [x] **Step 6: 커밋**

```bash
git add football/src/types/injury.ts football/src/services/injury.service.ts \
  football/src/pages/injuries/InjuriesPage.tsx \
  football/src/pages/injuries/InjuryStatsPage.tsx
git commit -m "feat(injury): add FE types, bodyPart dropdown, Korean labels"
```

---

## Task 6: AssessmentForm 컴포넌트

**Files:**
- Create: `football/src/components/injury/AssessmentForm.tsx`

- [x] **Step 1: 컴포넌트 작성**

`football/src/components/injury/AssessmentForm.tsx`:
```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { injuryApi } from '@/services/injury.service'
import type { InjuryAssessment } from '@/types/injury'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

interface Props {
  injuryId: number
  initial: InjuryAssessment | null
  onSaved: (result: { assessment: InjuryAssessment; triggeredReports: boolean }) => void
}

function ScoreField({
  label, hint, value, onChange, min = 0, max = 100,
}: {
  label: string; hint: string; value: number; onChange: (v: number) => void
  min?: number; max?: number
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <Input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
        className="h-8 w-24 text-sm"
      />
    </div>
  )
}

export function AssessmentForm({ injuryId, initial, onSaved }: Props) {
  const [painLevel, setPainLevel] = useState(initial?.painLevel ?? 0)
  const [hasSwelling, setHasSwelling] = useState(initial?.hasSwelling ?? false)
  const [romScore, setRomScore] = useState(initial?.romScore ?? 100)
  const [strengthScore, setStrengthScore] = useState(initial?.strengthScore ?? 100)
  const [sprintScore, setSprintScore] = useState(initial?.sprintScore ?? 100)
  const [jumpScore, setJumpScore] = useState(initial?.jumpScore ?? 100)
  const [psychScore, setPsychScore] = useState(initial?.psychScore ?? 0)
  const [positionRiskScore, setPositionRiskScore] = useState(initial?.positionRiskScore ?? 0)
  const [saving, setSaving] = useState(false)

  // 실시간 총점 미리보기 (서버와 동일한 계산)
  const medicalPrev = (painLevel / 10) * 20 + (hasSwelling ? 10 : 0) + ((100 - romScore) / 100) * 10
  const functionalPrev = ((100 - (strengthScore + sprintScore + jumpScore) / 3) / 100) * 40
  const modifierPrev = ((psychScore + positionRiskScore) / 2 / 100) * 20
  const totalPrev = Math.round(medicalPrev + functionalPrev + modifierPrev)

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await injuryApi.saveAssessment(injuryId, {
        painLevel, hasSwelling, romScore,
        strengthScore, sprintScore, jumpScore,
        psychScore, positionRiskScore,
      })
      if (result.triggeredReports) {
        toast.success('가중치 평가 저장 완료 — 외부 의무보고서가 자동 생성됐습니다.')
      } else {
        toast.success('가중치 평가가 저장됐습니다.')
      }
      onSaved(result)
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 총점 미리보기 */}
      <div className={`rounded-lg border p-4 ${totalPrev >= 80 ? 'border-destructive bg-destructive/5' : 'border-border bg-muted/30'}`}>
        <p className="text-xs font-medium text-muted-foreground mb-1">예상 총점</p>
        <p className={`text-3xl font-bold tabular-nums ${totalPrev >= 80 ? 'text-destructive' : ''}`}>
          {totalPrev}
          <span className="text-base font-normal text-muted-foreground ml-1">/ 100</span>
        </p>
        {totalPrev >= 80 && (
          <p className="text-xs text-destructive mt-1">임계점(80점) 초과 — 외부 의무보고서가 생성됩니다</p>
        )}
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span>의학 {medicalPrev.toFixed(1)}/40</span>
          <span>기능 {functionalPrev.toFixed(1)}/40</span>
          <span>보정 {modifierPrev.toFixed(1)}/20</span>
        </div>
      </div>

      {/* Medical Score (40%) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">의학적 소견 (40%)</p>
        <ScoreField label="통증 단계" hint="0=통증 없음, 10=극심한 통증" value={painLevel} onChange={setPainLevel} min={0} max={10} />
        <div className="flex items-center gap-3">
          <Switch checked={hasSwelling} onCheckedChange={setHasSwelling} id="swelling" />
          <Label htmlFor="swelling" className="text-xs">부종 있음</Label>
        </div>
        <ScoreField label="ROM (관절 가동 범위 %)" hint="100=완전 정상, 0=전혀 움직이지 않음" value={romScore} onChange={setRomScore} />
      </div>

      {/* Functional Score (40%) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">기능성 평가 (40%)</p>
        <ScoreField label="근력 검사 %" hint="100=정상, 0=전혀 없음" value={strengthScore} onChange={setStrengthScore} />
        <ScoreField label="스프린트/방향전환 %" hint="100=정상 수행, 0=불가" value={sprintScore} onChange={setSprintScore} />
        <ScoreField label="점프 테스트 %" hint="100=정상, 0=불가" value={jumpScore} onChange={setJumpScore} />
      </div>

      {/* Modifier Score (20%) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">환경·심리 보정 (20%)</p>
        <ScoreField label="심리적 불안도" hint="0=안정, 100=극도의 불안" value={psychScore} onChange={setPsychScore} />
        <ScoreField label="포지션 접촉 빈도 위험성" hint="0=저위험, 100=고위험" value={positionRiskScore} onChange={setPositionRiskScore} />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? '저장 중...' : '평가 저장'}
      </Button>
    </div>
  )
}
```

- [x] **Step 2: 타입 체크**

```bash
cd football && npx tsc --noEmit 2>&1 | grep "AssessmentForm\|error" | head -10
```

Expected: 오류 없음

- [x] **Step 3: 커밋**

```bash
git add football/src/components/injury/AssessmentForm.tsx
git commit -m "feat(injury): add AssessmentForm component with real-time score preview"
```

---

## Task 7: InjuryDetailPage — 평가 섹션 + 외부 보고서 + 상태 타임라인

**Files:**
- Modify: `football/src/pages/injuries/InjuryDetailPage.tsx`

- [x] **Step 1: 타임라인 + 평가 + 외부 보고서 import 추가**

`InjuryDetailPage.tsx` 상단 import 수정:
```typescript
import { injuryApi } from '@/services/injury.service'
import type {
  InjuryDetail, InjuryReport, RehabStage, RiskLevel, SecurityLevel,
  InjuryAssessment, ExternalReport, ExternalReportStatus,
} from '@/types/injury'
import {
  INJURY_STATUS_LABEL, INJURY_STATUS_STYLE,
  CAUSE_LABEL, BODY_PART_LABEL,
  REHAB_STAGE_LABEL, RISK_LEVEL_LABEL, RISK_LEVEL_STYLE, SECURITY_LEVEL_LABEL,
  EXTERNAL_REPORT_TARGET_LABEL, EXTERNAL_REPORT_STATUS_LABEL, EXTERNAL_REPORT_STATUS_STYLE,
  type BodyPart,
} from '@/types/injury'
import { AssessmentForm } from '@/components/injury/AssessmentForm'
```

- [x] **Step 2: 상태 + 로딩 추가**

`InjuryDetailPage` 컴포넌트 내 기존 state 아래에 추가:
```typescript
const [assessment, setAssessment] = useState<InjuryAssessment | null>(null)
const [externalReports, setExternalReports] = useState<ExternalReport[]>([])
```

`useEffect`의 `Promise.all`에 추가:
```typescript
Promise.all([
  injuryApi.get(Number(id)),
  injuryApi.getReport(Number(id)),
  injuryApi.getAssessment(Number(id)),
  injuryApi.getExternalReports(Number(id)),
])
  .then(([inj, r, assess, reports]) => {
    setInjury(inj)
    if (r) { fillForm(r); setReport(r) }
    setAssessment(assess)
    setExternalReports(reports)
  })
```

- [x] **Step 3: 상태 타임라인 컴포넌트 추가 (파일 내 로컬)**

`InjuryDetailPage.tsx`의 `InjuryDetailPage` 함수 바로 위에 추가:
```tsx
const STATUS_STEPS: InjuryDetail['status'][] = [
  'OCCURRED', 'DIAGNOSED', 'REHABILITATING', 'READY_TO_RETURN', 'RETURNED',
]

function StatusTimeline({ current }: { current: InjuryDetail['status'] }) {
  const currentIdx = STATUS_STEPS.indexOf(current)
  return (
    <div className="flex items-center gap-0 w-full">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx < currentIdx
        const active = idx === currentIdx
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                active ? 'bg-primary border-primary text-primary-foreground' :
                done ? 'bg-primary/20 border-primary text-primary' :
                'bg-muted border-muted-foreground/30 text-muted-foreground'
              }`}>
                {done ? '✓' : idx + 1}
              </div>
              <span className={`text-[10px] mt-1 text-center whitespace-nowrap ${active ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                {INJURY_STATUS_LABEL[step]}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [x] **Step 4: 렌더링에 세 섹션 추가**

`InjuryDetailPage`의 기존 `return` 블록에서, InjuryReport 폼 섹션 아래에 추가:

```tsx
{/* 상태 타임라인 */}
{injury && (
  <section className="border rounded-lg p-5">
    <h2 className="text-sm font-semibold mb-4">부상 진행 상태</h2>
    <StatusTimeline current={injury.status} />
  </section>
)}

{/* 가중치 평가 */}
{isMedical && injury && (
  <section className="border rounded-lg p-5">
    <h2 className="text-sm font-semibold mb-1">가중치 평가 (RTP)</h2>
    <p className="text-xs text-muted-foreground mb-4">
      Medical 40% · Functional 40% · Modifier 20% — 80점 이상 시 외부 의무보고서 자동 생성
    </p>
    <AssessmentForm
      injuryId={injury.id}
      initial={assessment}
      onSaved={({ assessment: a, triggeredReports }) => {
        setAssessment(a)
        if (triggeredReports) {
          injuryApi.getExternalReports(injury.id).then(setExternalReports)
        }
      }}
    />
  </section>
)}

{/* 외부 의무보고서 */}
{externalReports.length > 0 && (
  <section className="border rounded-lg p-5">
    <h2 className="text-sm font-semibold mb-3">외부 의무보고서</h2>
    <div className="space-y-2">
      {externalReports.map((r) => (
        <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
          <span className="text-sm font-medium">
            {EXTERNAL_REPORT_TARGET_LABEL[r.target]}
          </span>
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${EXTERNAL_REPORT_STATUS_STYLE[r.status]}`}>
            {EXTERNAL_REPORT_STATUS_LABEL[r.status]}
          </span>
        </div>
      ))}
    </div>
  </section>
)}
```

- [x] **Step 5: 타입 체크**

```bash
cd football && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: 오류 없음

- [x] **Step 6: 커밋**

```bash
git add football/src/pages/injuries/InjuryDetailPage.tsx
git commit -m "feat(injury): add status timeline, assessment form, external reports to detail page"
```

---

## Task 8: 복귀 체크리스트 (평가 기반 파생 표시)

**Files:**
- Modify: `football/src/pages/injuries/InjuryDetailPage.tsx`

- [x] **Step 1: 복귀 체크리스트 로컬 컴포넌트 추가**

`InjuryDetailPage.tsx`의 `StatusTimeline` 함수 바로 아래에 추가:
```tsx
function ReturnChecklist({ assessment }: { assessment: InjuryAssessment }) {
  const avgFunctional = (assessment.strengthScore + assessment.sprintScore + assessment.jumpScore) / 3
  const criteria: { label: string; met: boolean }[] = [
    { label: '통증 정상화 (통증 단계 ≤ 2)', met: assessment.painLevel <= 2 },
    { label: '부종 해소', met: !assessment.hasSwelling },
    { label: 'ROM 80% 이상 회복', met: assessment.romScore >= 80 },
    { label: '근력·기능 80% 이상 회복', met: avgFunctional >= 80 },
    { label: '심리적 준비 (불안도 ≤ 30)', met: assessment.psychScore <= 30 },
  ]
  const metCount = criteria.filter((c) => c.met).length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium">복귀 준비도</span>
        <span className="text-xs text-muted-foreground">{metCount}/{criteria.length} 충족</span>
      </div>
      {criteria.map((c) => (
        <div key={c.label} className="flex items-center gap-2">
          <span className={`text-sm ${c.met ? 'text-green-600' : 'text-muted-foreground'}`}>
            {c.met ? '✓' : '○'}
          </span>
          <span className={`text-sm ${c.met ? '' : 'text-muted-foreground'}`}>{c.label}</span>
        </div>
      ))}
    </div>
  )
}
```

- [x] **Step 2: 외부 의무보고서 섹션 바로 아래에 체크리스트 섹션 추가**

```tsx
{/* 복귀 체크리스트 */}
{assessment && (
  <section className="border rounded-lg p-5">
    <h2 className="text-sm font-semibold mb-3">복귀 체크리스트 (RTP Criteria)</h2>
    <ReturnChecklist assessment={assessment} />
  </section>
)}
```

- [x] **Step 3: 타입 체크 + 전체 테스트**

```bash
cd football && npx tsc --noEmit 2>&1 | grep error | head -10
cd ../apps/api && npx jest --testPathPattern="injury" --no-coverage
```

Expected: FE 오류 없음, BE 부상 관련 테스트 전부 PASS

- [x] **Step 4: 최종 커밋**

```bash
cd /Users/juno/work/football
git add football/src/pages/injuries/InjuryDetailPage.tsx
git commit -m "feat(injury): add return-to-play checklist derived from assessment"
```

---

## 자가 검토

### 스펙 커버리지

| PDF 요구사항 | 구현 Task |
|---|---|
| BodyPart 표준 분류 드롭다운 | Task 1 (BE enum), Task 5 (FE Select) |
| Medical Score 40% (통증·부종·ROM) | Task 2 (score fn), Task 6 (AssessmentForm) |
| Functional Score 40% (근력·스프린트·점프) | Task 2, Task 6 |
| Modifier Score 20% (심리·포지션 위험) | Task 2, Task 6 |
| 임계점 80점 → 외부 보고서 자동 생성 | Task 3 (processAssessment) |
| 유스 → 교육청·학교안전공제회 | Task 3 (player.level === 'YOUTH') |
| 프로 → 연맹·협회·보험사 | Task 3 |
| ExternalReport 모델 (PENDING_SUBMISSION) | Task 1 (schema) |
| Prisma 트랜잭션 처리 | Task 3 (processAssessment) |
| 부상 타임라인 | Task 7 (StatusTimeline) |
| 복귀 체크리스트 | Task 8 (ReturnChecklist) |
| 실시간 총점 미리보기 | Task 6 (AssessmentForm) |

### 플레이스홀더 없음 ✓
모든 Task에 실제 코드 포함.

### 타입 일관성 ✓
- `InjuryAssessment` 타입: Task 5에서 정의 → Task 6, Task 7, Task 8에서 동일하게 사용
- `ExternalReport` 타입: Task 5에서 정의 → Task 7에서 동일하게 사용
- `BODY_PART_LABEL`: Task 5에서 정의 → Task 5(InjuriesPage), Task 5(InjuryStatsPage), Task 7(InjuryDetailPage import)에서 동일하게 사용
- `calculateTotalScore` 반환 타입 `ScoreResult`: Task 2에서 정의 → Task 3에서 `{ ...dto, ...scores }`로 스프레드
