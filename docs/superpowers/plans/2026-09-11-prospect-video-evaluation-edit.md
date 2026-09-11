# ProspectVideoEvaluation Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users with canWrite permission to edit an existing ProspectVideoEvaluation (overwrite in-place, result auto-recalculated).

**Architecture:** PATCH endpoint on BE recomputes `result` via `computeVideoEvalResult`; FE re-uses `VideoEvalDialog` with an `initialData` prop to pre-fill fields; pencil buttons on both the latest card and history cards open the dialog in edit mode.

**Tech Stack:** Express + Prisma (BE), React + shadcn/ui (FE), TypeScript end-to-end.

---

## File Map

| File | Change |
|---|---|
| `apps/api/src/prospect/dto/video-evaluation.dto.ts` | Add `UpdateProspectVideoEvaluationDto` |
| `apps/api/src/prospect/prospect.repo.ts` | Add `updateVideoEvaluation` method |
| `apps/api/src/prospect/prospect.service.ts` | Add `updateVideoEvaluation` method |
| `apps/api/src/prospect/prospect.controller.ts` | Add `updateVideoEvaluation` handler |
| `apps/api/src/prospect/prospect.routes.ts` | Add `PATCH /:id/video-evaluations/:evalId` |
| `apps/api/__test__/prospect/video-evaluation-update.test.ts` | New test file |
| `football/src/types/prospect.ts` | Add `UpdateVideoEvaluationDto` |
| `football/src/services/prospect.service.ts` | Add `videoEvaluations.update()` |
| `football/src/pages/prospects/ProspectDetailSheet.tsx` | Extend `VideoEvalDialog` + edit buttons in `EvalTab` |

---

### Task 1: Add `UpdateProspectVideoEvaluationDto` to BE DTO file

**Files:**
- Modify: `apps/api/src/prospect/dto/video-evaluation.dto.ts`

- [ ] **Step 1: Add the DTO**

Open `apps/api/src/prospect/dto/video-evaluation.dto.ts` and append after the existing exports:

```ts
export interface UpdateProspectVideoEvaluationDto {
  qualityPassed?: boolean;
  identifiable?: boolean;
  continuity?: boolean;
  jerseyNumber?: number | null;
  totalScore?: number | null;
  scoreData?: Record<string, number> | null;
  pipelineData?: PipelineData | null;
  notes?: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/juno/work/football
git add apps/api/src/prospect/dto/video-evaluation.dto.ts
git commit -m "feat(prospect): UpdateProspectVideoEvaluationDto 추가"
```

---

### Task 2: Add `updateVideoEvaluation` to `ProspectRepository`

**Files:**
- Modify: `apps/api/src/prospect/prospect.repo.ts`

- [ ] **Step 1: Import the new DTO at top of file**

In `apps/api/src/prospect/prospect.repo.ts`, update the import from `video-evaluation.dto.ts`:

```ts
import { CreateProspectVideoEvaluationDto, CreateProspectEvaluationLogDto, UpdateProspectVideoEvaluationDto } from "./dto/video-evaluation.dto";
```

- [ ] **Step 2: Add the method**

Add after the `getLatestVideoEvaluation` method (around line 250):

```ts
async updateVideoEvaluation(
  prospectId: number,
  evalId: number,
  dto: UpdateProspectVideoEvaluationDto,
  result: VideoEvalResult,
) {
  const existing = await this.prisma.prospectVideoEvaluation.findFirst({
    where: { id: evalId, prospectId },
    select: { id: true },
  });
  if (!existing) throw new AppError(404, 'VIDEO_EVAL_NOT_FOUND');
  return this.prisma.prospectVideoEvaluation.update({
    where: { id: evalId },
    data: {
      ...(dto.qualityPassed !== undefined && { qualityPassed: dto.qualityPassed }),
      ...(dto.identifiable !== undefined && { identifiable: dto.identifiable }),
      ...(dto.continuity !== undefined && { continuity: dto.continuity }),
      ...(dto.jerseyNumber !== undefined && { jerseyNumber: dto.jerseyNumber }),
      ...(dto.totalScore !== undefined && { totalScore: dto.totalScore }),
      ...(dto.scoreData !== undefined && { scoreData: dto.scoreData ?? Prisma.DbNull }),
      ...(dto.pipelineData !== undefined && { pipelineData: dto.pipelineData ?? Prisma.DbNull }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      result,
    },
    include: { evaluatedBy: { select: { nickname: true } } },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/prospect/prospect.repo.ts
git commit -m "feat(prospect): repo.updateVideoEvaluation 추가"
```

---

### Task 3: Add `updateVideoEvaluation` to `ProspectService`

**Files:**
- Modify: `apps/api/src/prospect/prospect.service.ts`

- [ ] **Step 1: Import the new DTO**

In `apps/api/src/prospect/prospect.service.ts`, update the import from `video-evaluation.dto.ts`:

```ts
import { CreateProspectVideoEvaluationDto, CreateProspectEvaluationLogDto, UpdateProspectVideoEvaluationDto } from "./dto/video-evaluation.dto";
```

- [ ] **Step 2: Add the method**

Add after the `addVideoEvaluation` method:

```ts
async updateVideoEvaluation(
  prospectId: number,
  evalId: number,
  dto: UpdateProspectVideoEvaluationDto,
  actorClubId?: number | null,
) {
  await this.getById(prospectId, actorClubId); // club 스코핑 확인
  // For result recomputation we need the full gate state.
  // Fetch current record to merge with partial dto.
  const evaluations = await this.repo.getVideoEvaluations(prospectId);
  const current = evaluations.find((e) => e.id === evalId);
  if (!current) throw new AppError(404, 'VIDEO_EVAL_NOT_FOUND');
  const qualityPassed = dto.qualityPassed ?? current.qualityPassed;
  const identifiable = dto.identifiable ?? current.identifiable;
  const continuity = dto.continuity ?? current.continuity;
  const totalScore = dto.totalScore !== undefined ? dto.totalScore : current.totalScore;
  const result = computeVideoEvalResult(qualityPassed, identifiable, continuity, totalScore);
  return this.repo.updateVideoEvaluation(prospectId, evalId, dto, result);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/prospect/prospect.service.ts
git commit -m "feat(prospect): service.updateVideoEvaluation 추가"
```

---

### Task 4: Add `updateVideoEvaluation` handler to `ProspectController`

**Files:**
- Modify: `apps/api/src/prospect/prospect.controller.ts`

- [ ] **Step 1: Import the new DTO**

Update the import at the top of `prospect.controller.ts`:

```ts
import { CreateProspectVideoEvaluationDto, CreateProspectEvaluationLogDto, UpdateProspectVideoEvaluationDto } from "./dto/video-evaluation.dto";
```

- [ ] **Step 2: Add the handler method**

Add after the `addVideoEvaluation` handler:

```ts
updateVideoEvaluation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    if (!canWrite(user.role, user.frontOfficeRole)) throw new AppError(403, 'FORBIDDEN');
    res.status(200).json(
      await this.service.updateVideoEvaluation(
        Number(req.params['id']),
        Number(req.params['evalId']),
        req.body as UpdateProspectVideoEvaluationDto,
        user.clubId,
      ),
    );
  } catch (err) { next(err); }
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/prospect/prospect.controller.ts
git commit -m "feat(prospect): controller.updateVideoEvaluation 핸들러 추가"
```

---

### Task 5: Wire `PATCH /:id/video-evaluations/:evalId` route

**Files:**
- Modify: `apps/api/src/prospect/prospect.routes.ts`

- [ ] **Step 1: Add route**

In `apps/api/src/prospect/prospect.routes.ts`, add after line 41 (`router.post("/:id/video-evaluations", ...)`):

```ts
router.patch("/:id/video-evaluations/:evalId", auth, controller.updateVideoEvaluation);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/prospect/prospect.routes.ts
git commit -m "feat(prospect): PATCH /:id/video-evaluations/:evalId 라우트 등록"
```

---

### Task 6: Write BE tests for `updateVideoEvaluation`

**Files:**
- Create: `apps/api/__test__/prospect/video-evaluation-update.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { ProspectService, computeVideoEvalResult } from '../../src/prospect/prospect.service'

const makeEval = (overrides = {}) => ({
  id: 99,
  prospectId: 1,
  qualityPassed: true,
  identifiable: true,
  continuity: true,
  jerseyNumber: null,
  totalScore: 75,
  scoreData: null,
  pipelineData: null,
  result: 'PASS',
  notes: null,
  evaluatedBy: { nickname: 'Scout' },
  evaluatedAt: new Date().toISOString(),
  ...overrides,
})

const makeRepo = (overrides: Record<string, unknown> = {}) => ({
  findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST', visaRequired: false, visaEligibility: null }),
  getVideoEvaluations: jest.fn().mockResolvedValue([makeEval()]),
  updateVideoEvaluation: jest.fn().mockImplementation((_pid, _eid, dto, result) =>
    Promise.resolve({ ...makeEval(), ...dto, result }),
  ),
  ...overrides,
})

describe('ProspectService.updateVideoEvaluation', () => {
  it('totalScore 변경 시 result 재계산 (PASS → PENDING)', async () => {
    const repo = makeRepo() as any
    const svc = new ProspectService(repo)
    const result = await svc.updateVideoEvaluation(1, 99, { totalScore: 60 })
    expect(repo.updateVideoEvaluation).toHaveBeenCalledWith(1, 99, { totalScore: 60 }, 'PENDING')
    expect(result.result).toBe('PENDING')
  })

  it('gate 하나라도 false면 result = FAIL', async () => {
    const repo = makeRepo() as any
    const svc = new ProspectService(repo)
    await svc.updateVideoEvaluation(1, 99, { qualityPassed: false })
    expect(repo.updateVideoEvaluation).toHaveBeenCalledWith(
      1, 99, { qualityPassed: false }, 'FAIL',
    )
  })

  it('evalId가 해당 prospect에 없으면 VIDEO_EVAL_NOT_FOUND', async () => {
    const repo = makeRepo({ getVideoEvaluations: jest.fn().mockResolvedValue([makeEval({ id: 50 })]) }) as any
    const svc = new ProspectService(repo)
    await expect(svc.updateVideoEvaluation(1, 99, {})).rejects.toMatchObject({ message: 'VIDEO_EVAL_NOT_FOUND' })
  })

  it('prospect가 없거나 다른 club이면 PROSPECT_NOT_FOUND', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) }) as any
    const svc = new ProspectService(repo)
    await expect(svc.updateVideoEvaluation(1, 99, {}, 999)).rejects.toMatchObject({ message: 'PROSPECT_NOT_FOUND' })
  })
})

describe('computeVideoEvalResult', () => {
  it('gate 미통과 → FAIL', () => {
    expect(computeVideoEvalResult(false, true, true, 80)).toBe('FAIL')
  })
  it('gate 통과 + score>=70 → PASS', () => {
    expect(computeVideoEvalResult(true, true, true, 70)).toBe('PASS')
  })
  it('gate 통과 + score<70 → PENDING', () => {
    expect(computeVideoEvalResult(true, true, true, 69)).toBe('PENDING')
  })
  it('gate 통과 + score null → PENDING', () => {
    expect(computeVideoEvalResult(true, true, true, null)).toBe('PENDING')
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/juno/work/football
npx jest apps/api/__test__/prospect/video-evaluation-update.test.ts --no-coverage
```

Expected: All 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/__test__/prospect/video-evaluation-update.test.ts
git commit -m "test(prospect): updateVideoEvaluation 단위 테스트 추가"
```

---

### Task 7: Add `UpdateVideoEvaluationDto` to FE types

**Files:**
- Modify: `football/src/types/prospect.ts`

- [ ] **Step 1: Add the type**

In `football/src/types/prospect.ts`, add after the `CreateVideoEvaluationDto` interface (around line 148):

```ts
export interface UpdateVideoEvaluationDto {
  qualityPassed?: boolean
  identifiable?: boolean
  continuity?: boolean
  jerseyNumber?: number | null
  totalScore?: number | null
  scoreData?: Record<string, number> | null
  pipelineData?: PipelineData | null
  notes?: string | null
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/juno/work/football
git add football/src/types/prospect.ts
git commit -m "feat(prospect-fe): UpdateVideoEvaluationDto 타입 추가"
```

---

### Task 8: Add `videoEvaluations.update()` to FE prospect service

**Files:**
- Modify: `football/src/services/prospect.service.ts`

- [ ] **Step 1: Import the new type**

In `football/src/services/prospect.service.ts`, add `UpdateVideoEvaluationDto` to the import from `@/types/prospect`:

```ts
import type {
  Prospect, CreateProspectDto, UpdateProspectDto, ProspectStatus, SignProspectDto,
  ProspectVideoEvaluation, ProspectEvaluationLog,
  CreateVideoEvaluationDto, UpdateVideoEvaluationDto, CreateEvaluationLogDto, AcquisitionGateCheckResult,
  VideoAnalysisJob,
} from '@/types/prospect'
```

- [ ] **Step 2: Add `update` method to `videoEvaluations` object**

In the `videoEvaluations` object (around line 38-43), add the `update` method:

```ts
videoEvaluations: {
  list: (id: number) =>
    api.get<ProspectVideoEvaluation[]>(`/prospects/${id}/video-evaluations`),
  create: (id: number, dto: CreateVideoEvaluationDto) =>
    api.post<ProspectVideoEvaluation>(`/prospects/${id}/video-evaluations`, dto),
  update: (id: number, evalId: number, dto: UpdateVideoEvaluationDto) =>
    api.patch<ProspectVideoEvaluation>(`/prospects/${id}/video-evaluations/${evalId}`, dto),
},
```

- [ ] **Step 3: Commit**

```bash
git add football/src/services/prospect.service.ts
git commit -m "feat(prospect-fe): videoEvaluations.update() API 메서드 추가"
```

---

### Task 9: Extend `VideoEvalDialog` with `initialData` prop and edit mode

**Files:**
- Modify: `football/src/pages/prospects/ProspectDetailSheet.tsx`

- [ ] **Step 1: Update imports**

At the top of `ProspectDetailSheet.tsx`, add `UpdateVideoEvaluationDto` to the type imports:

```ts
import type {
  Prospect, ProspectVideoEvaluation, ProspectEvaluationLog,
  VideoEvalResult, EvaluationLogType, CreateVideoEvaluationDto, UpdateVideoEvaluationDto,
  CreateEvaluationLogDto, PipelineData,
} from '@/types/prospect'
```

- [ ] **Step 2: Update `VideoEvalDialogProps` interface**

Replace the existing `VideoEvalDialogProps` interface:

```ts
interface VideoEvalDialogProps {
  prospectId: number
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  initialData?: ProspectVideoEvaluation
}
```

- [ ] **Step 3: Update `VideoEvalDialog` function signature and initialization**

Replace the function signature line and the `useEffect` reset block:

```ts
function VideoEvalDialog({ prospectId, open, onOpenChange, onSaved, initialData }: VideoEvalDialogProps) {
```

Replace the `useEffect` that resets state on `open` (lines 71-84):

```ts
useEffect(() => {
  if (open) {
    setQualityPassed(initialData?.qualityPassed ?? false)
    setIdentifiable(initialData?.identifiable ?? false)
    setContinuity(initialData?.continuity ?? false)
    setJerseyNumber(initialData?.jerseyNumber != null ? String(initialData.jerseyNumber) : '')
    setTotalScore(initialData?.totalScore != null ? String(initialData.totalScore) : '')
    setNotes(initialData?.notes ?? '')
    setPipelineApplied(initialData?.pipelineData ?? null)
    setVideoUrl('')
    setAnalysisStatus('idle')
  }
  return () => { if (pollRef.current) clearInterval(pollRef.current) }
}, [open, initialData])
```

- [ ] **Step 4: Update `handleSave` to branch on create vs update**

Replace the `handleSave` function (lines 118-139):

```ts
const handleSave = async () => {
  setSaving(true)
  try {
    if (initialData) {
      const dto: UpdateVideoEvaluationDto = {
        qualityPassed,
        identifiable,
        continuity,
        jerseyNumber: jerseyNumber !== '' ? Number(jerseyNumber) : null,
        totalScore: totalScore !== '' ? Number(totalScore) : null,
        pipelineData: pipelineApplied ?? null,
        notes: notes || null,
      }
      await prospectApi.videoEvaluations.update(prospectId, initialData.id, dto)
    } else {
      const dto: CreateVideoEvaluationDto = {
        qualityPassed,
        identifiable,
        continuity,
        jerseyNumber: jerseyNumber !== '' ? Number(jerseyNumber) : null,
        totalScore: totalScore !== '' ? Number(totalScore) : null,
        pipelineData: pipelineApplied ?? null,
        notes: notes || null,
      }
      await prospectApi.videoEvaluations.create(prospectId, dto)
    }
    toast.success('평가가 저장되었습니다')
    onSaved()
    onOpenChange(false)
  } catch {
    toast.error('저장에 실패했습니다')
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 5: Update `DialogTitle` to reflect edit vs create**

Replace the `<DialogTitle>비디오 1차 평가</DialogTitle>` line:

```tsx
<DialogTitle>{initialData ? '비디오 평가 수정' : '비디오 1차 평가'}</DialogTitle>
```

- [ ] **Step 6: Commit**

```bash
git add football/src/pages/prospects/ProspectDetailSheet.tsx
git commit -m "feat(prospect-fe): VideoEvalDialog 수정 모드(initialData) 지원"
```

---

### Task 10: Add pencil edit buttons in `EvalTab`

**Files:**
- Modify: `football/src/pages/prospects/ProspectDetailSheet.tsx`

- [ ] **Step 1: Add Pencil icon import**

Add `Pencil` to the lucide-react import (add new import line near the top of the file, after the existing imports):

```ts
import { Pencil } from 'lucide-react'
```

- [ ] **Step 2: Add `editTarget` state to `EvalTab`**

In `EvalTab`, add state for the evaluation being edited, after the existing state declarations:

```ts
const [editTarget, setEditTarget] = useState<ProspectVideoEvaluation | null>(null)
```

- [ ] **Step 3: Add edit button to the latest card**

In the latest card `div` (around line 323), add a pencil button to the header row. Replace the opening section of the latest card:

```tsx
<div className="rounded border p-3 space-y-2">
  <div className="flex items-center justify-between">
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
    {canWrite && (
      <button
        onClick={() => setEditTarget(latest)}
        className="text-muted-foreground hover:text-foreground transition-colors ml-2 shrink-0"
        aria-label="수정"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
```

- [ ] **Step 4: Add edit button to each history card**

In the history `map` block (around line 355-364), replace each history card with:

```tsx
{history.map((ev) => (
  <div key={ev.id} className="rounded border border-dashed px-3 py-2 flex items-center gap-2 bg-muted/30">
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${VIDEO_EVAL_RESULT_STYLE[ev.result]}`}>
      {VIDEO_EVAL_RESULT_LABEL[ev.result]}
    </span>
    <span className="text-xs text-muted-foreground flex-1">
      {ev.totalScore != null ? `${ev.totalScore}점` : '—'} · {new Date(ev.evaluatedAt).toLocaleDateString('ko-KR')}
    </span>
    {canWrite && (
      <button
        onClick={() => setEditTarget(ev)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="수정"
      >
        <Pencil className="h-3 w-3" />
      </button>
    )}
  </div>
))}
```

- [ ] **Step 5: Wire `VideoEvalDialog` for edit mode**

Replace the `VideoEvalDialog` usage at the bottom of `EvalTab` (around line 430-437):

```tsx
{canWrite && (
  <>
    <VideoEvalDialog
      prospectId={prospect.id}
      open={evalDialogOpen}
      onOpenChange={setEvalDialogOpen}
      onSaved={loadEvals}
    />
    <VideoEvalDialog
      prospectId={prospect.id}
      open={editTarget !== null}
      onOpenChange={(v) => { if (!v) setEditTarget(null) }}
      onSaved={loadEvals}
      initialData={editTarget ?? undefined}
    />
  </>
)}
```

- [ ] **Step 6: Commit**

```bash
git add football/src/pages/prospects/ProspectDetailSheet.tsx
git commit -m "feat(prospect-fe): EvalTab 평가 수정 버튼(Pencil) 및 edit 다이얼로그 연결"
```

---

### Task 11: Manual smoke test

- [ ] **Step 1: Start the API and FE dev servers** (if not already running)

```bash
# API
cd /Users/juno/work/football && npx tsx --watch apps/api/src/index.ts &

# FE
cd /Users/juno/work/football/football && npm run dev &
```

- [ ] **Step 2: Open a prospect with an existing video evaluation**

Navigate to the Prospects page → open a prospect detail sheet → go to the 평가 tab.

- [ ] **Step 3: Click the pencil icon on the latest evaluation**

Expected: Edit dialog opens with all fields pre-filled (gates checked, totalScore populated, notes populated).

- [ ] **Step 4: Change totalScore and save**

Set `totalScore` to a value below 70 while all gates remain checked.
Expected: Dialog closes, the card updates to show `보류` result.

- [ ] **Step 5: Click pencil on a history card**

Expected: Same dialog opens pre-filled with that card's data.

- [ ] **Step 6: Final commit + push**

```bash
git push origin HEAD
```
