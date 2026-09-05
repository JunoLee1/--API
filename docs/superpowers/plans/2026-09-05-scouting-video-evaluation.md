# 스카우팅 비디오 평가 파이프라인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prospect 스카우팅 평가 파이프라인 구현 — 비디오 1차 평가(Hard/Soft gate), 평가 로그 타임라인, 예산·포지션 soft warning, SHORTLIST 승격 시 PASS 필수 게이트 (#502~#505)

**Architecture:** `ProspectVideoEvaluation`(평가 이력, N records/prospect)과 `ProspectEvaluationLog`(서술 타임라인)를 분리된 모델로 구현. LONGLIST→SHORTLIST 전환 시 BE에서 최신 VideoEvaluation.result===PASS 강제 검증(hard). 예산·포지션 체크는 FE soft warning만. FE는 ProspectsPage에 Sheet 상세 패널(탭 2개)을 추가.

**Tech Stack:** Prisma ORM, Express/TypeScript, Jest (BE 테스트), React/Vite/TypeScript (FE), shadcn/ui Sheet + Tabs

---

## 파일 구조

**신규 생성:**
- `apps/api/src/prospect/dto/video-evaluation.dto.ts` — VideoEvaluation, EvaluationLog DTO
- `apps/api/src/prospect/prospect.service.test.ts` — 서비스 유닛 테스트
- `football/src/pages/prospects/ProspectDetailSheet.tsx` — Sheet 상세 패널

**수정:**
- `apps/api/prisma/schema.prisma` — 2 enum + 2 model + Prospect.currentMarketValue
- `apps/api/src/prospect/prospect.repo.ts` — 5개 메서드 추가, PROSPECT_SELECT 확장, update 확장
- `apps/api/src/prospect/prospect.service.ts` — 5개 메서드 추가, updateStatus SHORTLIST gate
- `apps/api/src/prospect/prospect.controller.ts` — 5개 핸들러 추가
- `apps/api/src/prospect/prospect.routes.ts` — 5개 라우트 추가
- `football/src/types/prospect.ts` — 신규 타입 추가
- `football/src/services/prospect.service.ts` — 5개 API 메서드 추가
- `football/src/pages/prospects/ProspectsPage.tsx` — Sheet 연동, 승격 플로우 변경

---

## Task 1: Prisma 스키마 — 신규 enum + 모델 + 필드 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Prospect 모델에 currentMarketValue 필드 추가**

`schema.prisma`의 `model Prospect` 블록에서 `externalId` 줄 바로 다음에 추가:

```prisma
  currentMarketValue  Int?
```

- [ ] **Step 2: VideoEvalResult enum 추가**

`schema.prisma` 파일 끝(또는 ProspectStatus enum 근처)에 추가:

```prisma
enum VideoEvalResult {
  PASS
  FAIL
  PENDING
}

enum EvaluationLogType {
  VIDEO_ANALYSIS
  CONSISTENCY
  FIELD_VISIT
  LEAGUE_LEVEL
}
```

- [ ] **Step 3: ProspectVideoEvaluation 모델 추가**

`model ProspectNegotiationLog` 바로 뒤에 추가:

```prisma
model ProspectVideoEvaluation {
  id            Int             @id @default(autoincrement())
  prospectId    Int
  qualityPassed Boolean
  identifiable  Boolean
  continuity    Boolean
  totalScore    Int?
  scoreData     Json?
  result        VideoEvalResult
  notes         String?
  evaluatedById Int
  evaluatedAt   DateTime        @default(now())

  prospect    Prospect @relation(fields: [prospectId], references: [id])
  evaluatedBy User     @relation(fields: [evaluatedById], references: [id])

  @@index([prospectId])
}

model ProspectEvaluationLog {
  id            Int               @id @default(autoincrement())
  prospectId    Int
  type          EvaluationLogType
  note          String
  evaluatedById Int
  evaluatedAt   DateTime          @default(now())

  prospect    Prospect @relation(fields: [prospectId], references: [id])
  evaluatedBy User     @relation(fields: [evaluatedById], references: [id])

  @@index([prospectId])
}
```

- [ ] **Step 4: Prospect 모델에 역방향 relations 추가**

`model Prospect` 블록 내 `negotiationLogs` 줄 다음에 추가:

```prisma
  videoEvaluations ProspectVideoEvaluation[]
  evaluationLogs   ProspectEvaluationLog[]
```

- [ ] **Step 5: User 모델에 역방향 relations 추가**

`model User` 블록에서 `prospectNegotiationLogs` 줄 다음에 추가:

```prisma
  prospectVideoEvaluations ProspectVideoEvaluation[]
  prospectEvaluationLogs   ProspectEvaluationLog[]
```

- [ ] **Step 6: 마이그레이션 실행**

```bash
cd /Users/juno/work/football/apps/api
npx prisma migrate dev --name add_prospect_evaluation_models
```

Expected: 마이그레이션 파일 생성 + `prisma generate` 자동 실행. `✓ Generated Prisma Client` 확인.

- [ ] **Step 7: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): Prospect 평가 모델 추가 — ProspectVideoEvaluation, ProspectEvaluationLog (#502~#505)"
```

---

## Task 2: BE DTO 추가

**Files:**
- Create: `apps/api/src/prospect/dto/video-evaluation.dto.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// apps/api/src/prospect/dto/video-evaluation.dto.ts

export interface CreateProspectVideoEvaluationDto {
  qualityPassed: boolean;
  identifiable: boolean;
  continuity: boolean;
  totalScore?: number | null;
  scoreData?: Record<string, number> | null;
  notes?: string | null;
}

export interface CreateProspectEvaluationLogDto {
  type: 'VIDEO_ANALYSIS' | 'CONSISTENCY' | 'FIELD_VISIT' | 'LEAGUE_LEVEL';
  note: string;
  evaluatedAt?: string; // ISO 날짜. 없으면 서버 now()
}
```

- [ ] **Step 2: prospect.dto.ts에 currentMarketValue 추가**

`apps/api/src/prospect/dto/prospect.dto.ts`의 `UpdateProspectDto` 인터페이스에 추가:

```typescript
export interface UpdateProspectDto {
  name?: string;
  nationality?: string;
  position?: Position;
  currentTeam?: string;
  notes?: string;
  visaRequired?: boolean;
  visaEligibility?: VisaEligibility;
  currentMarketValue?: number | null;   // 추가
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/prospect/dto/
git commit -m "feat(prospect): VideoEvaluation, EvaluationLog DTO 추가"
```

---

## Task 3: BE Repo — ProspectVideoEvaluation 메서드

**Files:**
- Modify: `apps/api/src/prospect/prospect.repo.ts`

- [ ] **Step 1: import 추가**

파일 상단 import 블록에 추가:

```typescript
import { VideoEvalResult, EvaluationLogType } from "../generated/enums";
import { CreateProspectVideoEvaluationDto, CreateProspectEvaluationLogDto } from "./dto/video-evaluation.dto";
```

- [ ] **Step 2: PROSPECT_SELECT에 currentMarketValue 추가**

`PROSPECT_SELECT` 상수에 추가:

```typescript
const PROSPECT_SELECT = {
  // ... 기존 필드 ...
  currentMarketValue: true,   // 추가
} as const;
```

- [ ] **Step 3: update() 메서드에 currentMarketValue 반영**

`update()` 메서드의 `data` 객체에 추가:

```typescript
async update(id: number, dto: UpdateProspectDto) {
  return this.prisma.prospect.update({
    where: { id },
    data: {
      name: dto.name,
      nationality: dto.nationality,
      position: dto.position,
      currentTeam: dto.currentTeam,
      notes: dto.notes,
      visaRequired: dto.visaRequired,
      visaEligibility: dto.visaEligibility,
      ...(dto.currentMarketValue !== undefined && { currentMarketValue: dto.currentMarketValue }),
    },
    select: PROSPECT_SELECT,
  });
}
```

- [ ] **Step 4: addVideoEvaluation 메서드 추가**

`addNegotiationLog` 메서드 아래에 추가:

```typescript
addVideoEvaluation(
  prospectId: number,
  dto: CreateProspectVideoEvaluationDto,
  evaluatedById: number,
  result: VideoEvalResult,
) {
  return this.prisma.prospectVideoEvaluation.create({
    data: {
      prospectId,
      qualityPassed: dto.qualityPassed,
      identifiable: dto.identifiable,
      continuity: dto.continuity,
      totalScore: dto.totalScore ?? null,
      scoreData: dto.scoreData ?? null,
      result,
      notes: dto.notes ?? null,
      evaluatedById,
    },
    include: { evaluatedBy: { select: { nickname: true } } },
  });
}
```

- [ ] **Step 5: getVideoEvaluations 메서드 추가**

```typescript
getVideoEvaluations(prospectId: number) {
  return this.prisma.prospectVideoEvaluation.findMany({
    where: { prospectId },
    orderBy: { evaluatedAt: 'desc' },
    include: { evaluatedBy: { select: { nickname: true } } },
  });
}
```

- [ ] **Step 6: getLatestVideoEvaluation 메서드 추가**

```typescript
getLatestVideoEvaluation(prospectId: number) {
  return this.prisma.prospectVideoEvaluation.findFirst({
    where: { prospectId },
    orderBy: { evaluatedAt: 'desc' },
    select: { result: true },
  });
}
```

- [ ] **Step 7: 커밋**

```bash
git add apps/api/src/prospect/prospect.repo.ts
git commit -m "feat(prospect): VideoEvaluation repo 메서드 추가"
```

---

## Task 4: BE Repo — EvaluationLog + AcquisitionGate 메서드

**Files:**
- Modify: `apps/api/src/prospect/prospect.repo.ts`

- [ ] **Step 1: addEvaluationLog 메서드 추가**

```typescript
addEvaluationLog(
  prospectId: number,
  dto: CreateProspectEvaluationLogDto,
  evaluatedById: number,
) {
  return this.prisma.prospectEvaluationLog.create({
    data: {
      prospectId,
      type: dto.type as EvaluationLogType,
      note: dto.note,
      evaluatedById,
      ...(dto.evaluatedAt && { evaluatedAt: new Date(dto.evaluatedAt) }),
    },
    include: { evaluatedBy: { select: { nickname: true } } },
  });
}
```

- [ ] **Step 2: getEvaluationLogs 메서드 추가**

```typescript
getEvaluationLogs(prospectId: number) {
  return this.prisma.prospectEvaluationLog.findMany({
    where: { prospectId },
    orderBy: { evaluatedAt: 'desc' },
    include: { evaluatedBy: { select: { nickname: true } } },
  });
}
```

- [ ] **Step 3: checkAcquisitionGate 메서드 추가**

```typescript
async checkAcquisitionGate(prospectId: number) {
  const prospect = await this.prisma.prospect.findUnique({
    where: { id: prospectId },
    select: { position: true, currentMarketValue: true },
  });
  if (!prospect) throw new AppError(404, 'PROSPECT_NOT_FOUND');

  if (!prospect.position) {
    return { positionMatched: false, budgetWarning: false, matchedSurveys: [] };
  }

  const items = await this.prisma.playerAcquisitionSurveyResponseItem.findMany({
    where: {
      position: prospect.position,
      response: { survey: { status: 'OPEN' } },
    },
    select: {
      position: true,
      budgetMin: true,
      budgetMax: true,
      response: { select: { surveyId: true } },
    },
  });

  const positionMatched = items.length > 0;
  let budgetWarning = false;
  if (positionMatched && prospect.currentMarketValue != null) {
    budgetWarning = items.every(
      (item) => item.budgetMax != null && prospect.currentMarketValue! > item.budgetMax,
    );
  }

  return {
    positionMatched,
    budgetWarning,
    matchedSurveys: items.map((item) => ({
      id: item.response.surveyId,
      position: item.position,
      budgetMin: item.budgetMin,
      budgetMax: item.budgetMax,
    })),
  };
}
```

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/prospect/prospect.repo.ts
git commit -m "feat(prospect): EvaluationLog, AcquisitionGate repo 메서드 추가"
```

---

## Task 5: BE Service — 신규 메서드 + SHORTLIST gate

**Files:**
- Modify: `apps/api/src/prospect/prospect.service.ts`

- [ ] **Step 1: import 추가**

파일 상단에 추가:

```typescript
import { VideoEvalResult } from "../generated/enums";
import { CreateProspectVideoEvaluationDto, CreateProspectEvaluationLogDto } from "./dto/video-evaluation.dto";
```

- [ ] **Step 2: computeVideoEvalResult 순수 함수 추가**

클래스 선언 전에 추가:

```typescript
export function computeVideoEvalResult(
  qualityPassed: boolean,
  identifiable: boolean,
  continuity: boolean,
  totalScore: number | null | undefined,
): VideoEvalResult {
  if (!qualityPassed || !identifiable || !continuity) return 'FAIL';
  if (totalScore != null && totalScore >= 70) return 'PASS';
  return 'PENDING';
}
```

- [ ] **Step 3: updateStatus에 SHORTLIST gate 추가**

기존 `updateStatus` 메서드를 교체:

```typescript
async updateStatus(id: number, dto: TransitionProspectStatusDto) {
  if (dto.status === 'SIGNED') throw new AppError(400, 'USE_SIGN_ENDPOINT');
  if (dto.status === 'SHORTLIST') {
    const latest = await this.repo.getLatestVideoEvaluation(id);
    if (!latest || latest.result !== 'PASS') {
      throw new AppError(400, 'VIDEO_EVAL_REQUIRED');
    }
  }
  return this.repo.updateStatus(id, dto.status);
}
```

- [ ] **Step 4: VideoEvaluation 서비스 메서드 추가**

```typescript
async addVideoEvaluation(id: number, dto: CreateProspectVideoEvaluationDto, evaluatedById: number) {
  await this.getById(id); // 존재 확인
  const result = computeVideoEvalResult(dto.qualityPassed, dto.identifiable, dto.continuity, dto.totalScore);
  return this.repo.addVideoEvaluation(id, dto, evaluatedById, result);
}

getVideoEvaluations(id: number) {
  return this.repo.getVideoEvaluations(id);
}
```

- [ ] **Step 5: EvaluationLog + GateCheck 서비스 메서드 추가**

```typescript
async addEvaluationLog(id: number, dto: CreateProspectEvaluationLogDto, evaluatedById: number) {
  await this.getById(id); // 존재 확인
  return this.repo.addEvaluationLog(id, dto, evaluatedById);
}

getEvaluationLogs(id: number) {
  return this.repo.getEvaluationLogs(id);
}

checkAcquisitionGate(id: number) {
  return this.repo.checkAcquisitionGate(id);
}
```

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/prospect/prospect.service.ts
git commit -m "feat(prospect): 평가 서비스 메서드 추가 + SHORTLIST hard gate"
```

---

## Task 6: BE Service 테스트

**Files:**
- Create: `apps/api/src/prospect/prospect.service.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```typescript
// apps/api/src/prospect/prospect.service.test.ts
import { ProspectService, computeVideoEvalResult } from './prospect.service';
import { AppError } from '../lib/appError';
import type { ProspectRepository } from './prospect.repo';

const makeRepo = (overrides: Partial<ProspectRepository> = {}): ProspectRepository => ({
  checkDuplicate: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn().mockResolvedValue({ id: 1, status: 'SHORTLIST' }),
  sign: jest.fn(),
  recordMedicalResult: jest.fn(),
  addNegotiationLog: jest.fn(),
  getNegotiationLogs: jest.fn(),
  addVideoEvaluation: jest.fn(),
  getVideoEvaluations: jest.fn(),
  getLatestVideoEvaluation: jest.fn(),
  addEvaluationLog: jest.fn(),
  getEvaluationLogs: jest.fn(),
  checkAcquisitionGate: jest.fn(),
  ...overrides,
} as unknown as ProspectRepository);

// ─── computeVideoEvalResult ──────────────────────────────────────────────────

describe('computeVideoEvalResult', () => {
  it('hard gate 하나라도 false면 FAIL', () => {
    expect(computeVideoEvalResult(false, true, true, 80)).toBe('FAIL');
    expect(computeVideoEvalResult(true, false, true, 80)).toBe('FAIL');
    expect(computeVideoEvalResult(true, true, false, 80)).toBe('FAIL');
  });

  it('hard gate 전부 true + totalScore >= 70이면 PASS', () => {
    expect(computeVideoEvalResult(true, true, true, 70)).toBe('PASS');
    expect(computeVideoEvalResult(true, true, true, 100)).toBe('PASS');
  });

  it('hard gate 전부 true + totalScore < 70이면 PENDING', () => {
    expect(computeVideoEvalResult(true, true, true, 69)).toBe('PENDING');
    expect(computeVideoEvalResult(true, true, true, 0)).toBe('PENDING');
  });

  it('hard gate 전부 true + totalScore null이면 PENDING', () => {
    expect(computeVideoEvalResult(true, true, true, null)).toBe('PENDING');
    expect(computeVideoEvalResult(true, true, true, undefined)).toBe('PENDING');
  });
});

// ─── ProspectService.updateStatus — SHORTLIST gate ──────────────────────────

describe('ProspectService.updateStatus — SHORTLIST gate', () => {
  it('최신 VideoEvaluation 없으면 VIDEO_EVAL_REQUIRED 400', async () => {
    const service = new ProspectService(makeRepo({
      getLatestVideoEvaluation: jest.fn().mockResolvedValue(null),
    }));
    await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
      .rejects.toThrow(new AppError(400, 'VIDEO_EVAL_REQUIRED'));
  });

  it('최신 VideoEvaluation result가 FAIL이면 VIDEO_EVAL_REQUIRED 400', async () => {
    const service = new ProspectService(makeRepo({
      getLatestVideoEvaluation: jest.fn().mockResolvedValue({ result: 'FAIL' }),
    }));
    await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
      .rejects.toThrow(new AppError(400, 'VIDEO_EVAL_REQUIRED'));
  });

  it('최신 VideoEvaluation result가 PENDING이면 VIDEO_EVAL_REQUIRED 400', async () => {
    const service = new ProspectService(makeRepo({
      getLatestVideoEvaluation: jest.fn().mockResolvedValue({ result: 'PENDING' }),
    }));
    await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
      .rejects.toThrow(new AppError(400, 'VIDEO_EVAL_REQUIRED'));
  });

  it('최신 VideoEvaluation result가 PASS면 repo.updateStatus 호출', async () => {
    const updateStatus = jest.fn().mockResolvedValue({ id: 1, status: 'SHORTLIST' });
    const service = new ProspectService(makeRepo({
      getLatestVideoEvaluation: jest.fn().mockResolvedValue({ result: 'PASS' }),
      updateStatus,
    }));
    await service.updateStatus(1, { status: 'SHORTLIST' });
    expect(updateStatus).toHaveBeenCalledWith(1, 'SHORTLIST');
  });

  it('SHORTLIST 이외 전환은 VideoEval 체크 없이 진행', async () => {
    const getLatest = jest.fn();
    const service = new ProspectService(makeRepo({ getLatestVideoEvaluation: getLatest }));
    await service.updateStatus(1, { status: 'ARCHIVED' });
    expect(getLatest).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
cd /Users/juno/work/football/apps/api
npx jest src/prospect/prospect.service.test.ts --no-coverage
```

Expected: `computeVideoEvalResult is not exported` 또는 `addVideoEvaluation is not a function` 에러 (Task 5가 완료됐으면 PASS)

- [ ] **Step 3: 테스트 통과 확인**

모든 테스트 PASS 확인. 실패하면 service.ts 구현 수정.

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/prospect/prospect.service.test.ts
git commit -m "test(prospect): VideoEvaluation result 계산 + SHORTLIST gate 테스트"
```

---

## Task 7: BE Controller + Routes

**Files:**
- Modify: `apps/api/src/prospect/prospect.controller.ts`
- Modify: `apps/api/src/prospect/prospect.routes.ts`

- [ ] **Step 1: controller import 추가**

`prospect.controller.ts` 상단 import에 추가:

```typescript
import { CreateProspectVideoEvaluationDto, CreateProspectEvaluationLogDto } from "./dto/video-evaluation.dto";
```

- [ ] **Step 2: controller에 5개 핸들러 추가**

`ProspectController` 클래스 끝(마지막 메서드 뒤)에 추가:

```typescript
  addVideoEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, 'FORBIDDEN');
      res.status(201).json(
        await this.service.addVideoEvaluation(
          Number(req.params['id']),
          req.body as CreateProspectVideoEvaluationDto,
          id,
        ),
      );
    } catch (err) { next(err); }
  };

  getVideoEvaluations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      if (!canRead(role, coachingRole)) throw new AppError(403, 'FORBIDDEN');
      res.status(200).json(await this.service.getVideoEvaluations(Number(req.params['id'])));
    } catch (err) { next(err); }
  };

  addEvaluationLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, frontOfficeRole, id } = requireUser(req);
      if (!canWrite(role, frontOfficeRole)) throw new AppError(403, 'FORBIDDEN');
      res.status(201).json(
        await this.service.addEvaluationLog(
          Number(req.params['id']),
          req.body as CreateProspectEvaluationLogDto,
          id,
        ),
      );
    } catch (err) { next(err); }
  };

  getEvaluationLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      if (!canRead(role, coachingRole)) throw new AppError(403, 'FORBIDDEN');
      res.status(200).json(await this.service.getEvaluationLogs(Number(req.params['id'])));
    } catch (err) { next(err); }
  };

  checkAcquisitionGate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = requireUser(req);
      if (!canRead(role, coachingRole)) throw new AppError(403, 'FORBIDDEN');
      res.status(200).json(await this.service.checkAcquisitionGate(Number(req.params['id'])));
    } catch (err) { next(err); }
  };
```

- [ ] **Step 3: routes에 5개 라우트 추가**

`prospect.routes.ts`에서 `router.patch('/:id', ...)` 줄 바로 앞에 추가:

```typescript
router.get('/:id/video-evaluations', auth, controller.getVideoEvaluations);
router.post('/:id/video-evaluations', auth, controller.addVideoEvaluation);
router.get('/:id/evaluation-logs', auth, controller.getEvaluationLogs);
router.post('/:id/evaluation-logs', auth, controller.addEvaluationLog);
router.get('/:id/acquisition-gate-check', auth, controller.checkAcquisitionGate);
```

- [ ] **Step 4: 빌드 체크**

```bash
cd /Users/juno/work/football/apps/api
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/prospect/prospect.controller.ts apps/api/src/prospect/prospect.routes.ts
git commit -m "feat(prospect): VideoEvaluation, EvaluationLog, GateCheck 엔드포인트 추가"
```

---

## Task 8: FE — 타입 + prospect.service.ts 업데이트

**Files:**
- Modify: `football/src/types/prospect.ts`
- Modify: `football/src/services/prospect.service.ts`

- [ ] **Step 1: prospect.ts에 신규 타입 추가**

`football/src/types/prospect.ts` 파일 끝에 추가:

```typescript
export type VideoEvalResult = 'PASS' | 'FAIL' | 'PENDING'
export type EvaluationLogType = 'VIDEO_ANALYSIS' | 'CONSISTENCY' | 'FIELD_VISIT' | 'LEAGUE_LEVEL'

export interface ProspectVideoEvaluation {
  id: number
  prospectId: number
  qualityPassed: boolean
  identifiable: boolean
  continuity: boolean
  totalScore: number | null
  scoreData: Record<string, number> | null
  result: VideoEvalResult
  notes: string | null
  evaluatedBy: { nickname: string }
  evaluatedAt: string
}

export interface ProspectEvaluationLog {
  id: number
  prospectId: number
  type: EvaluationLogType
  note: string
  evaluatedBy: { nickname: string }
  evaluatedAt: string
}

export interface CreateVideoEvaluationDto {
  qualityPassed: boolean
  identifiable: boolean
  continuity: boolean
  totalScore?: number | null
  scoreData?: Record<string, number> | null
  notes?: string | null
}

export interface CreateEvaluationLogDto {
  type: EvaluationLogType
  note: string
  evaluatedAt?: string
}

export interface AcquisitionGateCheckResult {
  positionMatched: boolean
  budgetWarning: boolean
  matchedSurveys: { id: number; position: string; budgetMin: number | null; budgetMax: number | null }[]
}

export const VIDEO_EVAL_RESULT_LABEL: Record<VideoEvalResult, string> = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PENDING: '보류',
}

export const VIDEO_EVAL_RESULT_STYLE: Record<VideoEvalResult, string> = {
  PASS: 'bg-green-100 text-green-700 border-green-200',
  FAIL: 'bg-red-100 text-red-700 border-red-200',
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
}

export const EVAL_LOG_TYPE_LABEL: Record<EvaluationLogType, string> = {
  VIDEO_ANALYSIS: '풀매치 비디오',
  CONSISTENCY: '일관성 평가',
  FIELD_VISIT: '현장 확인',
  LEAGUE_LEVEL: '리그 수준',
}

export const EVAL_LOG_TYPE_COLOR: Record<EvaluationLogType, string> = {
  VIDEO_ANALYSIS: 'bg-indigo-400',
  CONSISTENCY: 'bg-violet-400',
  FIELD_VISIT: 'bg-teal-400',
  LEAGUE_LEVEL: 'bg-amber-400',
}
```

- [ ] **Step 2: Prospect 인터페이스에 currentMarketValue 추가**

`football/src/types/prospect.ts`의 `Prospect` 인터페이스에 추가:

```typescript
export interface Prospect {
  // ... 기존 필드 ...
  currentMarketValue: number | null   // 추가
}
```

- [ ] **Step 3: UpdateProspectDto에 currentMarketValue 추가**

```typescript
export interface UpdateProspectDto extends Partial<CreateProspectDto> {
  visaRequired?: boolean
  visaEligibility?: VisaEligibility
  currentMarketValue?: number | null   // 추가
}
```

- [ ] **Step 4: prospect.service.ts에 API 메서드 추가**

`football/src/services/prospect.service.ts` 상단 import에 추가:

```typescript
import type {
  Prospect, CreateProspectDto, UpdateProspectDto, ProspectStatus, SignProspectDto,
  ProspectVideoEvaluation, ProspectEvaluationLog,
  CreateVideoEvaluationDto, CreateEvaluationLogDto, AcquisitionGateCheckResult,
} from '@/types/prospect'
```

파일 끝 `prospectApi` 객체 안에 추가:

```typescript
  videoEvaluations: {
    list: (id: number) =>
      api.get<ProspectVideoEvaluation[]>(`/prospects/${id}/video-evaluations`),
    create: (id: number, dto: CreateVideoEvaluationDto) =>
      api.post<ProspectVideoEvaluation>(`/prospects/${id}/video-evaluations`, dto),
  },

  evaluationLogs: {
    list: (id: number) =>
      api.get<ProspectEvaluationLog[]>(`/prospects/${id}/evaluation-logs`),
    create: (id: number, dto: CreateEvaluationLogDto) =>
      api.post<ProspectEvaluationLog>(`/prospects/${id}/evaluation-logs`, dto),
  },

  acquisitionGateCheck: (id: number) =>
    api.get<AcquisitionGateCheckResult>(`/prospects/${id}/acquisition-gate-check`),
```

- [ ] **Step 5: 타입 체크**

```bash
cd /Users/juno/work/football/football
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add football/src/types/prospect.ts football/src/services/prospect.service.ts
git commit -m "feat(prospect-fe): 평가 관련 타입 + API 서비스 메서드 추가"
```

---

## Task 9: FE — ProspectDetailSheet 컴포넌트

**Files:**
- Create: `football/src/pages/prospects/ProspectDetailSheet.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// football/src/pages/prospects/ProspectDetailSheet.tsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { prospectApi } from '@/services/prospect.service'
import type {
  Prospect, ProspectVideoEvaluation, ProspectEvaluationLog,
  VideoEvalResult, EvaluationLogType, CreateVideoEvaluationDto, CreateEvaluationLogDto,
} from '@/types/prospect'
import {
  VIDEO_EVAL_RESULT_LABEL, VIDEO_EVAL_RESULT_STYLE,
  EVAL_LOG_TYPE_LABEL, EVAL_LOG_TYPE_COLOR,
  STATUS_LABEL, STATUS_STYLE,
} from '@/types/prospect'
import { POSITION_LABEL, PLAY_STYLE_LABEL } from '@/types/player'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// ─── VideoEvalDialog ─────────────────────────────────────────────────────────

function computePreviewResult(
  qualityPassed: boolean,
  identifiable: boolean,
  continuity: boolean,
  totalScore: string,
): VideoEvalResult {
  if (!qualityPassed || !identifiable || !continuity) return 'FAIL'
  const score = Number(totalScore)
  if (!isNaN(score) && score >= 70) return 'PASS'
  return 'PENDING'
}

interface VideoEvalDialogProps {
  prospectId: number
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function VideoEvalDialog({ prospectId, open, onOpenChange, onSaved }: VideoEvalDialogProps) {
  const [qualityPassed, setQualityPassed] = useState(false)
  const [identifiable, setIdentifiable] = useState(false)
  const [continuity, setContinuity] = useState(false)
  const [totalScore, setTotalScore] = useState('')
  const [scoreData, setScoreData] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const previewResult = computePreviewResult(qualityPassed, identifiable, continuity, totalScore)

  const handleSave = async () => {
    setSaving(true)
    try {
      const dto: CreateVideoEvaluationDto = {
        qualityPassed,
        identifiable,
        continuity,
        totalScore: totalScore !== '' ? Number(totalScore) : null,
        scoreData: Object.keys(scoreData).length > 0
          ? Object.fromEntries(Object.entries(scoreData).map(([k, v]) => [k, Number(v)]))
          : null,
        notes: notes || null,
      }
      await prospectApi.videoEvaluations.create(prospectId, dto)
      toast.success('평가가 저장되었습니다')
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>비디오 1차 평가</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Hard Gate (모두 충족 필수)</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="quality" checked={qualityPassed} onCheckedChange={(v) => setQualityPassed(!!v)} />
                <Label htmlFor="quality" className="text-sm">화질 720p 이상</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="identifiable" checked={identifiable} onCheckedChange={(v) => setIdentifiable(!!v)} />
                <Label htmlFor="identifiable" className="text-sm">타겟 선수 식별 가능</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="continuity" checked={continuity} onCheckedChange={(v) => setContinuity(!!v)} />
                <Label htmlFor="continuity" className="text-sm">풀타임 추적 연속성</Label>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Soft 합산 점수 (0~100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={totalScore}
              onChange={(e) => setTotalScore(e.target.value)}
              placeholder="예: 78"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">메모</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="평가 내용 메모"
              className="mt-1 h-20 resize-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">예상 결과:</span>
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${VIDEO_EVAL_RESULT_STYLE[previewResult]}`}>
              {VIDEO_EVAL_RESULT_LABEL[previewResult]}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── EvalTab ─────────────────────────────────────────────────────────────────

interface EvalTabProps {
  prospect: Prospect
  canWrite: boolean
}

function EvalTab({ prospect, canWrite }: EvalTabProps) {
  const [evaluations, setEvaluations] = useState<ProspectVideoEvaluation[]>([])
  const [logs, setLogs] = useState<ProspectEvaluationLog[]>([])
  const [loadingEval, setLoadingEval] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [evalDialogOpen, setEvalDialogOpen] = useState(false)

  // Log form state
  const [logType, setLogType] = useState<EvaluationLogType>('FIELD_VISIT')
  const [logNote, setLogNote] = useState('')
  const [logDate, setLogDate] = useState('')
  const [addingLog, setAddingLog] = useState(false)
  const [logFormOpen, setLogFormOpen] = useState(false)

  const loadEvals = () => {
    setLoadingEval(true)
    prospectApi.videoEvaluations.list(prospect.id)
      .then(setEvaluations)
      .catch(() => toast.error('평가 이력을 불러오지 못했습니다'))
      .finally(() => setLoadingEval(false))
  }

  const loadLogs = () => {
    setLoadingLogs(true)
    prospectApi.evaluationLogs.list(prospect.id)
      .then(setLogs)
      .catch(() => toast.error('스카우팅 로그를 불러오지 못했습니다'))
      .finally(() => setLoadingLogs(false))
  }

  useEffect(() => { loadEvals(); loadLogs() }, [prospect.id])

  const handleAddLog = async () => {
    if (!logNote.trim()) return
    setAddingLog(true)
    try {
      const dto: CreateEvaluationLogDto = {
        type: logType,
        note: logNote.trim(),
        ...(logDate && { evaluatedAt: logDate }),
      }
      await prospectApi.evaluationLogs.create(prospect.id, dto)
      toast.success('로그가 추가되었습니다')
      setLogNote('')
      setLogDate('')
      setLogFormOpen(false)
      loadLogs()
    } catch {
      toast.error('로그 추가에 실패했습니다')
    } finally {
      setAddingLog(false)
    }
  }

  const [latest, ...history] = evaluations

  return (
    <div className="space-y-6">
      {/* 비디오 1차 평가 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">비디오 1차 평가</h3>
          {canWrite && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEvalDialogOpen(true)}>
              + 새 평가
            </Button>
          )}
        </div>
        {loadingEval ? (
          <Skeleton className="h-20 w-full" />
        ) : !latest ? (
          <p className="text-sm text-muted-foreground">평가 기록 없음</p>
        ) : (
          <div className="space-y-2">
            {/* 최신 평가 */}
            <div className="rounded border p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${VIDEO_EVAL_RESULT_STYLE[latest.result]}`}>
                  {VIDEO_EVAL_RESULT_LABEL[latest.result]}
                </span>
                {latest.qualityPassed && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">화질 ✓</span>}
                {!latest.qualityPassed && <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">화질 ✗</span>}
                {latest.identifiable && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">식별 ✓</span>}
                {!latest.identifiable && <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">식별 ✗</span>}
                {latest.continuity && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">연속성 ✓</span>}
                {!latest.continuity && <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">연속성 ✗</span>}
              </div>
              {latest.totalScore != null && (
                <p className="text-xs text-muted-foreground">총점: {latest.totalScore} / 100</p>
              )}
              {latest.notes && <p className="text-xs text-muted-foreground">{latest.notes}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(latest.evaluatedAt).toLocaleDateString('ko-KR')} · {latest.evaluatedBy.nickname}
              </p>
            </div>
            {/* 이전 이력 */}
            {history.length > 0 && (
              <div className="space-y-1">
                {history.map((ev) => (
                  <div key={ev.id} className="rounded border border-dashed px-3 py-2 flex items-center gap-2 bg-muted/30">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${VIDEO_EVAL_RESULT_STYLE[ev.result]}`}>
                      {VIDEO_EVAL_RESULT_LABEL[ev.result]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ev.totalScore != null ? `${ev.totalScore}점` : '—'} · {new Date(ev.evaluatedAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 스카우팅 로그 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">스카우팅 로그</h3>
          {canWrite && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLogFormOpen((v) => !v)}>
              {logFormOpen ? '취소' : '+ 로그 추가'}
            </Button>
          )}
        </div>

        {logFormOpen && (
          <div className="rounded border p-3 mb-3 space-y-2 bg-muted/20">
            <Select value={logType} onValueChange={(v) => setLogType(v as EvaluationLogType)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(EVAL_LOG_TYPE_LABEL) as EvaluationLogType[]).map((t) => (
                  <SelectItem key={t} value={t}>{EVAL_LOG_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
              placeholder="평가 내용"
              className="h-16 resize-none text-sm"
            />
            <Input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="h-8 text-sm"
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleAddLog} disabled={addingLog || !logNote.trim()}>
              저장
            </Button>
          </div>
        )}

        {loadingLogs ? (
          <Skeleton className="h-20 w-full" />
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">로그 없음</p>
        ) : (
          <div className="border-l-2 border-muted pl-4 space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="relative">
                <div className={`absolute -left-[21px] top-1 w-2 h-2 rounded-full ${EVAL_LOG_TYPE_COLOR[log.type]}`} />
                <p className="text-xs font-medium">{EVAL_LOG_TYPE_LABEL[log.type]}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{log.note}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(log.evaluatedAt).toLocaleDateString('ko-KR')} · {log.evaluatedBy.nickname}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {canWrite && (
        <VideoEvalDialog
          prospectId={prospect.id}
          open={evalDialogOpen}
          onOpenChange={setEvalDialogOpen}
          onSaved={loadEvals}
        />
      )}
    </div>
  )
}

// ─── InfoTab ─────────────────────────────────────────────────────────────────

interface InfoTabProps {
  prospect: Prospect
  canWrite: boolean
  onUpdated: (p: Prospect) => void
}

function InfoTab({ prospect, canWrite, onUpdated }: InfoTabProps) {
  const [marketValue, setMarketValue] = useState(String(prospect.currentMarketValue ?? ''))
  const [saving, setSaving] = useState(false)

  const handleSaveMarketValue = async () => {
    setSaving(true)
    try {
      const updated = await prospectApi.update(prospect.id, {
        currentMarketValue: marketValue !== '' ? Number(marketValue) : null,
      })
      onUpdated(updated)
      toast.success('저장되었습니다')
    } catch {
      toast.error('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">이름</p>
          <p className="font-medium">{prospect.name}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">포지션</p>
          <p>{prospect.position ? POSITION_LABEL[prospect.position] : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">국적</p>
          <p>{prospect.nationality ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">현소속</p>
          <p>{prospect.currentTeam ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">상태</p>
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLE[prospect.status]}`}>
            {STATUS_LABEL[prospect.status]}
          </span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">플레이스타일</p>
          <p>{prospect.playStyle ? PLAY_STYLE_LABEL[prospect.playStyle] : '—'}</p>
        </div>
      </div>

      {canWrite && (
        <div>
          <Label className="text-xs text-muted-foreground">예상 시가 (만원)</Label>
          <div className="flex gap-2 mt-1">
            <Input
              type="number"
              value={marketValue}
              onChange={(e) => setMarketValue(e.target.value)}
              placeholder="예: 20000"
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSaveMarketValue} disabled={saving}>
              저장
            </Button>
          </div>
        </div>
      )}

      {prospect.notes && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">메모</p>
          <p className="text-sm whitespace-pre-wrap">{prospect.notes}</p>
        </div>
      )}
    </div>
  )
}

// ─── ProspectDetailSheet ─────────────────────────────────────────────────────

interface ProspectDetailSheetProps {
  prospect: Prospect | null
  open: boolean
  onOpenChange: (v: boolean) => void
  canWrite: boolean
  onUpdated: (p: Prospect) => void
}

export function ProspectDetailSheet({
  prospect,
  open,
  onOpenChange,
  canWrite,
  onUpdated,
}: ProspectDetailSheetProps) {
  if (!prospect) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] max-w-full overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{prospect.name}</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="info">
          <TabsList className="mb-4">
            <TabsTrigger value="info">기본정보</TabsTrigger>
            <TabsTrigger value="eval">평가</TabsTrigger>
          </TabsList>
          <TabsContent value="info">
            <InfoTab prospect={prospect} canWrite={canWrite} onUpdated={onUpdated} />
          </TabsContent>
          <TabsContent value="eval">
            <EvalTab prospect={prospect} canWrite={canWrite} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/juno/work/football/football
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add football/src/pages/prospects/ProspectDetailSheet.tsx
git commit -m "feat(prospect-fe): ProspectDetailSheet 컴포넌트 — 기본정보 + 평가 탭"
```

---

## Task 10: FE — ProspectsPage 통합

**Files:**
- Modify: `football/src/pages/prospects/ProspectsPage.tsx`

- [ ] **Step 1: import 추가**

파일 상단 import 블록에 추가:

```tsx
import { ProspectDetailSheet } from './ProspectDetailSheet'
```

- [ ] **Step 2: selectedProspect 상태 추가**

`ProspectsPage` 함수 내 기존 state 선언 아래에 추가:

```tsx
const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
const [sheetOpen, setSheetOpen] = useState(false)
```

- [ ] **Step 3: SHORTLIST 승격 플로우 변경**

기존 `handleTransition` 함수를 교체:

```tsx
const handleTransition = async (id: number, status: ProspectStatus) => {
  if (status === 'SHORTLIST') {
    // #503 soft gate check
    try {
      const gate = await prospectApi.acquisitionGateCheck(id)
      const warnings: string[] = []
      if (!gate.positionMatched) warnings.push('활성 수요조사에 해당 포지션 요청이 없습니다')
      if (gate.budgetWarning) warnings.push('예상 시가가 수요조사 예산 범위를 초과합니다')
      if (warnings.length > 0) {
        const confirmed = window.confirm(`주의:\n${warnings.join('\n')}\n\n그래도 쇼트리스트로 승격하시겠습니까?`)
        if (!confirmed) return
      }
    } catch {
      // gate check 실패해도 전환 시도는 진행
    }
  }

  try {
    await prospectApi.transition(id, status)
    toast.success('상태가 변경되었습니다')
    const s = statusFilter === 'ALL' ? undefined : statusFilter
    void fetchProspects(s)
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('VIDEO_EVAL_REQUIRED')) {
      toast.error('비디오 평가 PASS 필요 — 평가 탭에서 먼저 평가를 완료해주세요')
    } else {
      toast.error(err instanceof Error ? err.message : t('prospects.deleteFailed'))
    }
  }
}
```

- [ ] **Step 4: 테이블 행에 클릭 핸들러 추가**

`<TableRow key={p.id}>` 태그에 className과 onClick 추가:

```tsx
<TableRow
  key={p.id}
  className="cursor-pointer"
  onClick={() => { setSelectedProspect(p); setSheetOpen(true) }}
>
```

- [ ] **Step 5: Sheet 컴포넌트 추가**

`return` 블록 끝, `</div>` 닫기 태그 바로 위에 추가:

```tsx
<ProspectDetailSheet
  prospect={selectedProspect}
  open={sheetOpen}
  onOpenChange={(v) => {
    setSheetOpen(v)
    if (!v) {
      // Sheet 닫힐 때 목록 갱신 (currentMarketValue 등 업데이트 반영)
      const s = statusFilter === 'ALL' ? undefined : statusFilter
      void fetchProspects(s)
    }
  }}
  canWrite={canWrite}
  onUpdated={(updated) => {
    setSelectedProspect(updated)
    setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }}
/>
```

- [ ] **Step 6: 타입 체크**

```bash
cd /Users/juno/work/football/football
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add football/src/pages/prospects/ProspectsPage.tsx
git commit -m "feat(prospect-fe): Sheet 상세 패널 통합, SHORTLIST 승격 gate 플로우 추가"
```

---

## Task 11: CONTEXT.md 업데이트

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: 영입 후보 섹션에 평가 모델 문서화 추가**

CONTEXT.md의 `## 영입 후보 (Prospect)` 섹션 끝, `---` 구분선 바로 위에 추가:

```markdown
### 비디오 평가 (ProspectVideoEvaluation)

SCOUT이 LONGLIST 단계에서 비디오 영상을 기반으로 제출하는 구조화 평가. Prospect당 N개 레코드 허용(이력 보존), 최신 레코드가 현재 상태를 대표.

**Hard gate (모두 true여야 PASS 가능):**
- `qualityPassed`: 화질 720p 이상
- `identifiable`: 타겟 선수 식별 가능
- `continuity`: 풀타임 추적 연속성 확보

**result 계산 규칙 (서비스 레이어):**
- hard gate 하나라도 false → `FAIL`
- 전부 true + `totalScore >= 70` → `PASS`
- 전부 true + (`totalScore < 70` 또는 null) → `PENDING`

**SHORTLIST 전환 조건:** 최신 `ProspectVideoEvaluation.result === PASS` 필수. 미충족 시 `400 VIDEO_EVAL_REQUIRED`.

**속성:**
- `scoreData`: 포지션별 지표를 자유 JSON으로 저장 `{ "sprints": 72, "passAcc": 85 }`
- `totalScore`: soft 합산 점수 0~100

### 스카우팅 로그 (ProspectEvaluationLog)

LONGLIST 단계부터 추가 가능한 서술형 평가 타임라인. NegotiationLog와 달리 단계 제한 없음.

**type:**
- `VIDEO_ANALYSIS`: 풀매치 비디오 분석
- `CONSISTENCY`: 복수 경기 일관성 평가
- `FIELD_VISIT`: 현장 직접 관전
- `LEAGUE_LEVEL`: 리그 수준 적절성 확인

**쓰기 권한:** SCOUT, GM, TD  
**읽기 권한:** FRONT_OFFICE 전체, HEAD_COACH
```

- [ ] **Step 2: Prospect 속성 목록에 currentMarketValue 추가**

`**속성:**` 목록에 추가:

```markdown
- `currentMarketValue`: 예상 시가(만원). 수동 입력. #503 예산 soft 체크 기준.
```

- [ ] **Step 3: 커밋**

```bash
git add CONTEXT.md
git commit -m "docs: CONTEXT.md — ProspectVideoEvaluation, ProspectEvaluationLog 문서화"
```
