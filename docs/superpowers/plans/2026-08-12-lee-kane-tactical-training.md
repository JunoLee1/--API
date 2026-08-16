# 이영표 + Kane (TD + Head Coach) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 design decisions from the 이영표+Kane persona grill-me session: structured opponent threat scores on TacticalAnalysis, FormationSnapshot model + API for in-match formation change tracking, training eval entry rate KPI on the Head Coach dashboard, and position-average comparison with N<3 warning on the GrowthReport tab.

**Architecture:** Schema changes use the known workaround (direct SQL + `prisma migrate resolve --applied`) to avoid shadow DB enum conflict. FormationSnapshot is a new standalone module following the existing tactical module pattern. Dashboard KPI and growth report position average are additive changes on existing repos/services.

**Tech Stack:** Express + TypeScript + Prisma (backend), React + Vite + i18next (frontend), Jest (unit tests)

---

## File Map

**Task 1 — TacticalAnalysis threat scores**
- Modify: `apps/api/prisma/schema.prisma` — add 3 score fields to `TacticalAnalysis`
- Create: `apps/api/prisma/migrations/20260812000003_tactical_threat_scores/migration.sql`
- Modify: `apps/api/src/tactical/tactical.repo.ts` — ANALYSIS_SELECT + update()
- Modify: `apps/api/src/tactical/dto/tactical.dto.ts` — UpdateAnalysisDto
- Create: `apps/api/__test__/tactical/tactical.threat-scores.test.ts`

**Task 2 — FormationSnapshot schema + API**
- Modify: `apps/api/prisma/schema.prisma` — new `FormationSnapshot` model
- Modify: `apps/api/prisma/schema.prisma` — add `formationSnapshots` relation to `Match`
- Create: `apps/api/prisma/migrations/20260812000004_formation_snapshot/migration.sql`
- Create: `apps/api/src/formation-snapshot/dto/formation-snapshot.dto.ts`
- Create: `apps/api/src/formation-snapshot/formation-snapshot.repo.ts`
- Create: `apps/api/src/formation-snapshot/formation-snapshot.service.ts`
- Create: `apps/api/src/formation-snapshot/formation-snapshot.controller.ts`
- Create: `apps/api/src/formation-snapshot/formation-snapshot.routes.ts`
- Modify: `apps/api/src/apiRouter.ts` — register `/formation-snapshots` route
- Create: `apps/api/__test__/formation-snapshot/formation-snapshot.repo.test.ts`

**Task 3 — FormationSnapshot frontend**
- Create: `football/src/services/formationSnapshot.service.ts`
- Create: `football/src/types/formation-snapshot.ts`
- Create: `football/src/components/match/FormationSnapshotCard.tsx`
- Modify: `football/src/pages/matches/MatchDetailPage.tsx` — add snapshot card section
- Modify: `football/src/locales/ko/match.json` — new i18n keys
- Modify: `football/src/locales/en/match.json` — new i18n keys

**Task 4 — Training eval entry rate KPI (HEAD_COACH dashboard)**
- Modify: `apps/api/src/dashboard/dashboard.repo.ts` — add `getTrainingEvalEntryRate()`
- Modify: `apps/api/src/dashboard/dashboard.repo.ts` — update `getHeadCoachStats()`
- Modify: `football/src/types/dashboard.ts` — add field to `HeadCoachStats`
- Modify: `football/src/pages/dashboard/dashboardConfig.ts` — add stat card for HEAD_COACH
- Modify: `football/src/locales/ko/common.json` — new i18n key
- Modify: `football/src/locales/en/common.json` — new i18n key
- Modify: `apps/api/__test__/dashboard/dashboard.service.test.ts` — add HEAD_COACH stat test

**Task 5 — GrowthEvaluation position average with N<3 warning**
- Modify: `apps/api/src/growth-report/growth-report.repo.ts` — add `getPositionAverage(playerId)`
- Modify: `apps/api/src/growth-report/growth-report.service.ts` — expose `getPositionAverage`
- Modify: `apps/api/src/growth-report/growth-report.controller.ts` — add `getPositionAverage` handler
- Modify: `apps/api/src/growth-report/growth-report.routes.ts` — register GET `/position-average`
- Modify: `football/src/services/growthReport.service.ts` — add `getPositionAverage(playerId)`
- Modify: `football/src/types/growth-report.ts` — add `PositionAverage` type
- Modify: `football/src/pages/players/tabs/GrowthReportTab.tsx` — fetch + display position avg with N<3 warning
- Modify: `football/src/locales/ko/player.json` — new i18n keys
- Modify: `football/src/locales/en/player.json` — new i18n keys
- Create: `apps/api/__test__/growth-report/growth-report.position-avg.test.ts`

---

## Task 1: TacticalAnalysis Threat Scores

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (TacticalAnalysis model)
- Create: `apps/api/prisma/migrations/20260812000003_tactical_threat_scores/migration.sql`
- Modify: `apps/api/src/tactical/tactical.repo.ts`
- Modify: `apps/api/src/tactical/dto/tactical.dto.ts`
- Test: `apps/api/__test__/tactical/tactical.threat-scores.test.ts`

- [x] **Step 1: Write the failing test**

Create `apps/api/__test__/tactical/tactical.threat-scores.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { TacticalRepository } from "../../src/tactical/tactical.repo";

const mockUpdate = jest.fn();
const mockPrisma = {
  tacticalAnalysis: { update: mockUpdate },
} as any;

describe("TacticalRepository — threat scores", () => {
  let repo: TacticalRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TacticalRepository(mockPrisma);
  });

  test("update() passes opponentPressureScore to Prisma", async () => {
    mockUpdate.mockResolvedValue({ id: 1, opponentPressureScore: 7 });
    await repo.update(1, { opponentPressureScore: 7 });
    const call = mockUpdate.mock.calls[0]![0] as any;
    expect(call.data.opponentPressureScore).toBe(7);
  });

  test("update() passes null for opponentSetPieceScore when 0 passed", async () => {
    mockUpdate.mockResolvedValue({ id: 1, opponentSetPieceScore: 0 });
    await repo.update(1, { opponentSetPieceScore: 0 });
    const call = mockUpdate.mock.calls[0]![0] as any;
    // 0 is valid (not the empty-string sentinel), should remain 0
    expect(call.data.opponentSetPieceScore).toBe(0);
  });

  test("update() omits threat score fields when not provided", async () => {
    mockUpdate.mockResolvedValue({ id: 1 });
    await repo.update(1, { formation: "4-3-3" });
    const call = mockUpdate.mock.calls[0]![0] as any;
    expect(call.data.opponentPressureScore).toBeUndefined();
    expect(call.data.opponentSetPieceScore).toBeUndefined();
    expect(call.data.opponentCounterScore).toBeUndefined();
  });
});
```

- [x] **Step 2: Run test to confirm it fails**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="tactical.threat-scores" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `opponentPressureScore` does not exist on the repo yet.

- [x] **Step 3: Add migration SQL**

Create `apps/api/prisma/migrations/20260812000003_tactical_threat_scores/migration.sql`:

```sql
ALTER TABLE "TacticalAnalysis"
  ADD COLUMN IF NOT EXISTS "opponentPressureScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "opponentSetPieceScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "opponentCounterScore" INTEGER;

ALTER TABLE "TacticalAnalysis"
  ADD CONSTRAINT "TacticalAnalysis_opponentPressureScore_range" CHECK ("opponentPressureScore" BETWEEN 1 AND 10),
  ADD CONSTRAINT "TacticalAnalysis_opponentSetPieceScore_range" CHECK ("opponentSetPieceScore" BETWEEN 1 AND 10),
  ADD CONSTRAINT "TacticalAnalysis_opponentCounterScore_range" CHECK ("opponentCounterScore" BETWEEN 1 AND 10);
```

> **Design decision:** Score range is 1–10 (slider UI). `0` is rejected by constraint — "no rating" must be represented as `NULL`, not `0`.

Run it:

```bash
cd /Users/juno/work/football/apps/api
npx prisma db execute --file prisma/migrations/20260812000003_tactical_threat_scores/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260812000003_tactical_threat_scores
```

- [x] **Step 4: Update `schema.prisma`**

In `apps/api/prisma/schema.prisma`, find the `TacticalAnalysis` model (around line 1388) and add the three fields after the `opponentKeyPlayer` line:

```prisma
  // PRE_MATCH
  opponentFormation   String?
  opponentKeyThreat   String? @db.Text
  opponentWeakness    String? @db.Text
  opponentKeyPlayer   String?
  opponentPressureScore Int?
  opponentSetPieceScore Int?
  opponentCounterScore  Int?
```

Then regenerate the client:

```bash
cd /Users/juno/work/football/apps/api
npx prisma generate
```

- [x] **Step 5: Update `tactical.dto.ts`**

In `apps/api/src/tactical/dto/tactical.dto.ts`, add optional score fields to `UpdateAnalysisDto` (or wherever opponent fields are listed):

```typescript
export interface UpdateAnalysisDto {
  formation?: string;
  opponentAnalysis?: string;
  opponentFormation?: string;
  opponentKeyThreat?: string;
  opponentWeakness?: string;
  opponentKeyPlayer?: string;
  opponentPressureScore?: number;
  opponentSetPieceScore?: number;
  opponentCounterScore?: number;
  tacticalCompliance?: string;
  concededAnalysis?: string;
  momPlayerId?: string;
  momNote?: string;
  improvementPlayerId?: string;
  improvementNote?: string;
}
```

- [x] **Step 6: Update `tactical.repo.ts`**

In `ANALYSIS_SELECT`, add the three new fields:

```typescript
const ANALYSIS_SELECT = {
  // ... existing fields ...
  opponentKeyPlayer: true,
  opponentPressureScore: true,
  opponentSetPieceScore: true,
  opponentCounterScore: true,
  // ... rest of existing fields ...
} as const;
```

In the `update()` method, add the score fields (integers — no `snv` needed, just undefined-guard):

```typescript
if (dto.opponentPressureScore !== undefined) data.opponentPressureScore = dto.opponentPressureScore;
if (dto.opponentSetPieceScore !== undefined) data.opponentSetPieceScore = dto.opponentSetPieceScore;
if (dto.opponentCounterScore !== undefined) data.opponentCounterScore = dto.opponentCounterScore;
```

Add these lines after the `opponentKeyPlayer` update block.

- [x] **Step 7: Run tests to confirm they pass**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="tactical.threat-scores" --no-coverage 2>&1 | tail -20
```

Expected: PASS — 3 tests passing.

- [x] **Step 8: Commit**

```bash
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations/20260812000003_tactical_threat_scores/ \
        apps/api/src/tactical/dto/tactical.dto.ts \
        apps/api/src/tactical/tactical.repo.ts \
        apps/api/__test__/tactical/tactical.threat-scores.test.ts
git commit -m "feat(tactical): add opponent threat score fields to TacticalAnalysis"
```

---

## Task 2: FormationSnapshot Schema + API

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260812000004_formation_snapshot/migration.sql`
- Create: `apps/api/src/formation-snapshot/dto/formation-snapshot.dto.ts`
- Create: `apps/api/src/formation-snapshot/formation-snapshot.repo.ts`
- Create: `apps/api/src/formation-snapshot/formation-snapshot.service.ts`
- Create: `apps/api/src/formation-snapshot/formation-snapshot.controller.ts`
- Create: `apps/api/src/formation-snapshot/formation-snapshot.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`
- Test: `apps/api/__test__/formation-snapshot/formation-snapshot.repo.test.ts`

- [x] **Step 1: Write the failing test**

Create `apps/api/__test__/formation-snapshot/formation-snapshot.repo.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { FormationSnapshotRepository } from "../../src/formation-snapshot/formation-snapshot.repo";

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockPrisma = {
  formationSnapshot: { create: mockCreate, findMany: mockFindMany },
} as any;

describe("FormationSnapshotRepository", () => {
  let repo: FormationSnapshotRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new FormationSnapshotRepository(mockPrisma);
  });

  test("create() passes all DTO fields to Prisma", async () => {
    mockCreate.mockResolvedValue({ id: 1, matchId: 5, minute: 35, formation: "4-4-2", changeReason: "injury" });
    await repo.create({ matchId: 5, minute: 35, formation: "4-4-2", changeReason: "injury" }, 1);
    const call = mockCreate.mock.calls[0]![0] as any;
    expect(call.data.matchId).toBe(5);
    expect(call.data.minute).toBe(35);
    expect(call.data.formation).toBe("4-4-2");
    expect(call.data.changeReason).toBe("injury");
    expect(call.data.createdById).toBe(1);
  });

  test("findByMatch() queries by matchId ordered by minute asc", async () => {
    mockFindMany.mockResolvedValue([]);
    await repo.findByMatch(5);
    const call = mockFindMany.mock.calls[0]![0] as any;
    expect(call.where.matchId).toBe(5);
    expect(call.orderBy.minute).toBe("asc");
  });
});
```

- [x] **Step 2: Run test to confirm it fails**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="formation-snapshot.repo" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [x] **Step 3: Add migration SQL and update schema**

Create `apps/api/prisma/migrations/20260812000004_formation_snapshot/migration.sql`:

```sql
CREATE TABLE IF NOT EXISTS "FormationSnapshot" (
  "id"             SERIAL PRIMARY KEY,
  "matchId"        INTEGER NOT NULL REFERENCES "Match"("id") ON DELETE CASCADE,
  "minute"         INTEGER,
  "formation"      TEXT NOT NULL,
  "changeReason"   TEXT,
  "createdById"    INTEGER NOT NULL REFERENCES "User"("id"),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Run it:

```bash
cd /Users/juno/work/football/apps/api
npx prisma db execute --file prisma/migrations/20260812000004_formation_snapshot/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260812000004_formation_snapshot
```

In `apps/api/prisma/schema.prisma`, add the `FormationSnapshot` model after `MatchLineup` (around line 2175+) and add the relation to `Match`:

In the `Match` model, add to the existing relation block:
```prisma
  formationSnapshots FormationSnapshot[]
```

New model:
```prisma
model FormationSnapshot {
  id            Int      @id @default(autoincrement())
  matchId       Int
  minute        Int?
  formation     String
  changeReason  String?
  createdById   Int
  createdAt     DateTime @default(now())

  match     Match @relation(fields: [matchId], references: [id], onDelete: Cascade)
  createdBy User  @relation("FormationSnapshotCreatedBy", fields: [createdById], references: [id])
}
```

Also add the back-reference on `User` model: find the `User` model and add:
```prisma
  formationSnapshots FormationSnapshot[] @relation("FormationSnapshotCreatedBy")
```

Then regenerate:

```bash
cd /Users/juno/work/football/apps/api
npx prisma generate
```

- [x] **Step 4: Create DTO**

Create `apps/api/src/formation-snapshot/dto/formation-snapshot.dto.ts`:

```typescript
export interface CreateFormationSnapshotDto {
  matchId: number;
  minute?: number;
  formation: string;
  changeReason?: string;
}
```

- [x] **Step 5: Create repository**

Create `apps/api/src/formation-snapshot/formation-snapshot.repo.ts`:

```typescript
import type { PrismaClient } from "../generated/client";
import type { CreateFormationSnapshotDto } from "./dto/formation-snapshot.dto";

const SNAPSHOT_SELECT = {
  id: true,
  matchId: true,
  minute: true,
  formation: true,
  changeReason: true,
  createdAt: true,
  createdBy: { select: { id: true, nickname: true } },
} as const;

export class FormationSnapshotRepository {
  constructor(private prisma: PrismaClient) {}

  create(dto: CreateFormationSnapshotDto, createdById: number) {
    return this.prisma.formationSnapshot.create({
      data: {
        matchId: dto.matchId,
        formation: dto.formation,
        ...(dto.minute !== undefined && { minute: dto.minute }),
        ...(dto.changeReason !== undefined && { changeReason: dto.changeReason }),
        createdById,
      },
      select: SNAPSHOT_SELECT,
    });
  }

  findByMatch(matchId: number) {
    return this.prisma.formationSnapshot.findMany({
      where: { matchId },
      select: SNAPSHOT_SELECT,
      orderBy: { minute: "asc" },
    });
  }

  remove(id: number) {
    return this.prisma.formationSnapshot.delete({ where: { id } });
  }
}
```

- [x] **Step 6: Create service**

Create `apps/api/src/formation-snapshot/formation-snapshot.service.ts`:

```typescript
import { FormationSnapshotRepository } from "./formation-snapshot.repo";
import type { CreateFormationSnapshotDto } from "./dto/formation-snapshot.dto";

export class FormationSnapshotService {
  constructor(private repo: FormationSnapshotRepository) {}

  create(dto: CreateFormationSnapshotDto, createdById: number) {
    return this.repo.create(dto, createdById);
  }

  findByMatch(matchId: number) {
    return this.repo.findByMatch(matchId);
  }

  remove(id: number) {
    return this.repo.remove(id);
  }
}
```

- [x] **Step 7: Create controller**

Create `apps/api/src/formation-snapshot/formation-snapshot.controller.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { requireUser } from "../lib/authMiddleware";
import { isAdminLike } from "../lib/permissions";
import { AppError } from "../lib/appError";
import { FormationSnapshotService } from "./formation-snapshot.service";

const CAN_WRITE_ROLES = ["ADMIN", "SUPER_ADMIN", "COACHING_STAFF"] as const;

export class FormationSnapshotController {
  constructor(private service: FormationSnapshotService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = requireUser(req);
      if (!isAdminLike(role) && role !== "COACHING_STAFF") throw new AppError(403, "FORBIDDEN");
      const user = requireUser(req);
      res.status(201).json(await this.service.create(req.body, user.id));
    } catch (err) { next(err); }
  };

  findByMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.findByMatch(Number(req.params["matchId"])));
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = requireUser(req);
      if (!isAdminLike(role) && role !== "COACHING_STAFF") throw new AppError(403, "FORBIDDEN");
      await this.service.remove(Number(req.params["id"]));
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
```

- [x] **Step 8: Create routes**

Create `apps/api/src/formation-snapshot/formation-snapshot.routes.ts`:

```typescript
import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { FormationSnapshotRepository } from "./formation-snapshot.repo";
import { FormationSnapshotService } from "./formation-snapshot.service";
import { FormationSnapshotController } from "./formation-snapshot.controller";

const router = Router();
const prisma = getPrisma();
const repo = new FormationSnapshotRepository(prisma);
const service = new FormationSnapshotService(repo);
const controller = new FormationSnapshotController(service);

router.post("/", auth, controller.create);
router.get("/match/:matchId", auth, controller.findByMatch);
router.delete("/:id", auth, controller.remove);

export default router;
```

- [x] **Step 9: Register route in apiRouter.ts**

In `apps/api/src/apiRouter.ts`, add after existing imports (e.g., after the `leagueRouter` import):

```typescript
import formationSnapshotRouter from "./formation-snapshot/formation-snapshot.routes";
```

And register it in the router block:

```typescript
apiRouter.use("/formation-snapshots", formationSnapshotRouter);
```

- [x] **Step 10: Run test to confirm it passes**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="formation-snapshot.repo" --no-coverage 2>&1 | tail -20
```

Expected: PASS — 2 tests passing.

- [x] **Step 11: Commit**

```bash
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations/20260812000004_formation_snapshot/ \
        apps/api/src/formation-snapshot/ \
        apps/api/src/apiRouter.ts \
        apps/api/__test__/formation-snapshot/
git commit -m "feat(tactical): add FormationSnapshot model and CRUD API"
```

---

## Task 3: FormationSnapshot Frontend Comparison Card

**Files:**
- Create: `football/src/types/formation-snapshot.ts`
- Create: `football/src/services/formationSnapshot.service.ts`
- Create: `football/src/components/match/FormationSnapshotCard.tsx`
- Modify: `football/src/pages/matches/MatchDetailPage.tsx`
- Modify: `football/src/locales/ko/match.json`
- Modify: `football/src/locales/en/match.json`

- [x] **Step 1: Add i18n keys**

In `football/src/locales/ko/match.json`, add to the root object:

```json
"formationSnapshot": {
  "title": "대형 변화 기록",
  "empty": "기록된 대형 변화가 없습니다.",
  "addSnapshot": "대형 변화 추가",
  "minute": "분",
  "formation": "대형",
  "changeReason": "교체 사유",
  "changeReasonPlaceholder": "예: 부상 대응, 리드 방어",
  "submit": "저장",
  "cancel": "취소",
  "by": "작성"
}
```

In `football/src/locales/en/match.json`, add:

```json
"formationSnapshot": {
  "title": "Formation Changes",
  "empty": "No formation changes recorded.",
  "addSnapshot": "Add Formation Change",
  "minute": "min",
  "formation": "Formation",
  "changeReason": "Change Reason",
  "changeReasonPlaceholder": "e.g., Injury response, protect lead",
  "submit": "Save",
  "cancel": "Cancel",
  "by": "by"
}
```

- [x] **Step 2: Create types**

Create `football/src/types/formation-snapshot.ts`:

```typescript
export interface FormationSnapshot {
  id: number
  matchId: number
  minute: number | null
  formation: string
  changeReason: string | null
  createdAt: string
  createdBy: { id: number; nickname: string }
}

export interface CreateFormationSnapshotPayload {
  matchId: number
  minute?: number
  formation: string
  changeReason?: string
}
```

- [x] **Step 3: Create API service**

Create `football/src/services/formationSnapshot.service.ts`:

```typescript
import api from '@/lib/api'
import type { FormationSnapshot, CreateFormationSnapshotPayload } from '@/types/formation-snapshot'

export const formationSnapshotApi = {
  create: (payload: CreateFormationSnapshotPayload): Promise<FormationSnapshot> =>
    api.post('/formation-snapshots', payload).then(r => r.data),

  listByMatch: (matchId: number): Promise<FormationSnapshot[]> =>
    api.get(`/formation-snapshots/match/${matchId}`).then(r => r.data),

  remove: (id: number): Promise<void> =>
    api.delete(`/formation-snapshots/${id}`).then(() => undefined),
}
```

- [x] **Step 4: Create FormationSnapshotCard component**

Create `football/src/components/match/FormationSnapshotCard.tsx`:

```typescript
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formationSnapshotApi } from '@/services/formationSnapshot.service'
import type { FormationSnapshot } from '@/types/formation-snapshot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  matchId: number
  snapshots: FormationSnapshot[]
  canEdit: boolean
  onAdded: (s: FormationSnapshot) => void
  onRemoved: (id: number) => void
}

export function FormationSnapshotCard({ matchId, snapshots, canEdit, onAdded, onRemoved }: Props) {
  const { t } = useTranslation('match')
  const [adding, setAdding] = useState(false)
  const [minute, setMinute] = useState('')
  const [formation, setFormation] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const handleRemove = async (id: number) => {
    setRemovingId(id)
    try {
      await formationSnapshotApi.remove(id)
      onRemoved(id)
    } catch {
      toast.error(t('formationSnapshot.removeError', 'Failed to delete'))
    } finally {
      setRemovingId(null)
    }
  }

  const handleSubmit = async () => {
    if (!formation.trim()) return
    setSaving(true)
    try {
      const snapshot = await formationSnapshotApi.create({
        matchId,
        ...(minute ? { minute: Number(minute) } : {}),
        formation: formation.trim(),
        ...(changeReason.trim() ? { changeReason: changeReason.trim() } : {}),
      })
      onAdded(snapshot)
      setAdding(false)
      setMinute('')
      setFormation('')
      setChangeReason('')
    } catch {
      toast.error(t('formationSnapshot.submitError', 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t('formationSnapshot.title')}</h4>
        {canEdit && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t('formationSnapshot.addSnapshot')}
          </Button>
        )}
      </div>

      {adding && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
          <div className="flex gap-2">
            <div className="w-20">
              <Label className="text-xs">{t('formationSnapshot.minute')}</Label>
              <Input
                type="number"
                className="h-8 text-sm"
                placeholder="45"
                value={minute}
                onChange={e => setMinute(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">{t('formationSnapshot.formation')}</Label>
              <Input
                className="h-8 text-sm"
                placeholder="4-3-3"
                value={formation}
                onChange={e => setFormation(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('formationSnapshot.changeReason')}</Label>
            <Input
              className="h-8 text-sm"
              placeholder={t('formationSnapshot.changeReasonPlaceholder')}
              value={changeReason}
              onChange={e => setChangeReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
              {t('formationSnapshot.cancel')}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving || !formation.trim()}>
              {t('formationSnapshot.submit')}
            </Button>
          </div>
        </div>
      )}

      {snapshots.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">{t('formationSnapshot.empty')}</p>
      ) : (
        <div className="space-y-1">
          {snapshots.map(s => (
            <div key={s.id} className="flex items-start gap-3 text-sm py-1 border-b last:border-0">
              <span className="w-12 text-muted-foreground text-xs shrink-0">
                {s.minute != null ? `${s.minute}${t('formationSnapshot.minute')}` : '—'}
              </span>
              <span className="font-mono font-medium">{s.formation}</span>
              {s.changeReason && (
                <span className="text-muted-foreground text-xs flex-1">{s.changeReason}</span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">
                {t('formationSnapshot.by')} {s.createdBy.nickname}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(s.id)}
                  disabled={removingId === s.id}
                  className="ml-auto text-muted-foreground hover:text-destructive disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 5: Integrate into MatchDetailPage**

In `football/src/pages/matches/MatchDetailPage.tsx`:

1. Add imports at top:
```typescript
import { formationSnapshotApi } from '@/services/formationSnapshot.service'
import type { FormationSnapshot } from '@/types/formation-snapshot'
import { FormationSnapshotCard } from '@/components/match/FormationSnapshotCard'
```

2. Add state inside the component (near other `useState` declarations):
```typescript
const [snapshots, setSnapshots] = useState<FormationSnapshot[]>([])
```

3. Inside the `useEffect` that loads the match, also fetch snapshots (add to `Promise.all` or add a separate call after match loads):
```typescript
formationSnapshotApi.listByMatch(Number(id)).then(setSnapshots).catch(() => {})
```

4. Determine `canEdit` for snapshots — add near where `user` is used:
```typescript
const canEditSnapshot = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'COACHING_STAFF'
```

5. Add the card in the JSX, inside the match detail content area (e.g., after the shot events section or at the bottom of the main content area):
```tsx
<FormationSnapshotCard
  matchId={match.id}
  snapshots={snapshots}
  canEdit={canEditSnapshot}
  onAdded={(s) => setSnapshots(prev => [...prev, s])}
  onRemoved={(id) => setSnapshots(prev => prev.filter(s => s.id !== id))}
/>
```

- [x] **Step 6: Commit**

```bash
git add football/src/types/formation-snapshot.ts \
        football/src/services/formationSnapshot.service.ts \
        football/src/components/match/FormationSnapshotCard.tsx \
        football/src/pages/matches/MatchDetailPage.tsx \
        football/src/locales/ko/match.json \
        football/src/locales/en/match.json
git commit -m "feat(tactical): add FormationSnapshot card to MatchDetailPage"
```

---

## Task 4: Training Eval Entry Rate KPI on HEAD_COACH Dashboard

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.repo.ts`
- Modify: `football/src/types/dashboard.ts`
- Modify: `football/src/pages/dashboard/dashboardConfig.ts`
- Modify: `football/src/locales/ko/common.json`
- Modify: `football/src/locales/en/common.json`
- Test: `apps/api/__test__/dashboard/dashboard.service.test.ts`

**What this KPI measures:** For all approved training sessions this month, the percentage of `TrainingResult` entries that have `performanceScore != null` out of total `TrainingParticipant` entries.

- [x] **Step 1: Write the failing test**

In `apps/api/__test__/dashboard/dashboard.service.test.ts`, add the following test inside the `DashboardService.getStats` describe block (or in its own describe block at the end of the file):

```typescript
describe("DashboardService — HEAD_COACH trainingEvalEntryRate", () => {
  test("HEAD_COACH stats include trainingEvalEntryRate from repo", async () => {
    mockRepo.getHeadCoachStats.mockResolvedValue({
      injuredPlayerCount: 2,
      thisMonthSessionCount: 5,
      attendanceWarningPlayerCount: 1,
      trainingEvalEntryRate: 72,
    });
    mockRepo.getMedicalDashboardStats.mockResolvedValue(mockMedicalDashboard);

    const result = await service.getStats({
      id: 10,
      role: "COACHING_STAFF",
      coachingRole: "HEAD_COACH",
      frontOfficeRole: null,
    }) as any;

    expect(result.trainingEvalEntryRate).toBe(72);
  });
});
```

- [x] **Step 2: Run test to confirm it fails**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="dashboard.service" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `trainingEvalEntryRate` is undefined.

- [x] **Step 3: Update `dashboard.repo.ts`**

In `apps/api/src/dashboard/dashboard.repo.ts`, update `getHeadCoachStats()` to include the new metric:

```typescript
async getHeadCoachStats() {
  const [injuredPlayerCount, thisMonthSessionCount, attendanceWarningPlayerCount, trainingEvalEntryRate] =
    await Promise.all([
      this.prisma.injury.count({ where: { status: { notIn: ["RETURNED"] } } }),
      this.prisma.trainingSession.count({ where: { date: { gte: START_OF_MONTH() } } }),
      this.prisma.notification.count({
        where: { type: "TRAINING_ATTENDANCE_WARNING", readAt: null },
      }),
      this.getTrainingEvalEntryRate(),
    ]);
  return { injuredPlayerCount, thisMonthSessionCount, attendanceWarningPlayerCount, trainingEvalEntryRate };
}

private async getTrainingEvalEntryRate(): Promise<number> {
  const sessionFilter = { isApproved: true, date: { gte: START_OF_MONTH() } };
  const [scored, total] = await Promise.all([
    this.prisma.trainingResult.count({
      where: {
        attendance: { not: "ABSENT" },
        performanceScore: { not: null },
        session: sessionFilter,
      },
    }),
    this.prisma.trainingResult.count({
      where: {
        attendance: { not: "ABSENT" },
        session: sessionFilter,
      },
    }),
  ]);
  return total === 0 ? 0 : Math.round((scored / total) * 100);
}
// Denominator: present/late attendees only — absent players cannot receive a performanceScore.
```

- [x] **Step 4: Run test to confirm it passes**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="dashboard.service" --no-coverage 2>&1 | tail -20
```

Expected: all tests pass including the new one.

- [x] **Step 5: Update frontend types**

In `football/src/types/dashboard.ts`, update `HeadCoachStats`:

```typescript
export interface HeadCoachStats {
  injuredPlayerCount: number
  thisMonthSessionCount: number
  attendanceWarningPlayerCount: number
  trainingEvalEntryRate: number
  medicalDashboard?: MedicalDashboardStats
}
```

- [x] **Step 6: Add i18n keys**

In `football/src/locales/ko/common.json`, in the `dashboard.stat` object, add:

```json
"trainingEvalEntryRate": "훈련 평가 입력률"
```

In `football/src/locales/en/common.json`, in the `dashboard.stat` object, add:

```json
"trainingEvalEntryRate": "Training Eval Entry Rate"
```

Also add the `%` unit key if not already present — check for `unit.rate` key in the same file. If it exists and shows `%`, reuse it. The unit for this KPI is `%`.

- [x] **Step 7: Update `dashboardConfig.ts`**

In `football/src/pages/dashboard/dashboardConfig.ts`, in the `HEAD_COACH` case (around line 190), add a fourth stat card:

```typescript
if (coachingRole === 'HEAD_COACH') {
  return {
    statCards: [
      { label: 'dashboard.stat.injuredPlayerCount', getValue: (s) => (s as HeadCoachStats).injuredPlayerCount, unit: 'dashboard.stat.unit.person', highlight: true },
      { label: 'dashboard.stat.thisMonthSessionCount', getValue: (s) => (s as HeadCoachStats).thisMonthSessionCount, unit: 'dashboard.stat.unit.session' },
      { label: 'dashboard.stat.attendanceWarningPlayerCount', getValue: (s) => (s as HeadCoachStats).attendanceWarningPlayerCount, unit: 'dashboard.stat.unit.person', highlight: true },
      { label: 'dashboard.stat.trainingEvalEntryRate', getValue: (s) => (s as HeadCoachStats).trainingEvalEntryRate, unit: 'dashboard.stat.unit.rate' },
    ],
    // ... rest unchanged
  }
}
```

- [x] **Step 8: Commit**

```bash
git add apps/api/src/dashboard/dashboard.repo.ts \
        apps/api/__test__/dashboard/dashboard.service.test.ts \
        football/src/types/dashboard.ts \
        football/src/pages/dashboard/dashboardConfig.ts \
        football/src/locales/ko/common.json \
        football/src/locales/en/common.json
git commit -m "feat(dashboard): add training eval entry rate KPI for HEAD_COACH"
```

---

## Task 5: GrowthEvaluation Position Average with N<3 Warning

**Files:**
- Modify: `apps/api/src/growth-report/growth-report.repo.ts`
- Modify: `apps/api/src/growth-report/growth-report.service.ts`
- Modify: `apps/api/src/growth-report/growth-report.controller.ts`
- Modify: `apps/api/src/growth-report/growth-report.routes.ts`
- Modify: `football/src/services/growthReport.service.ts`
- Modify: `football/src/types/growth-report.ts`
- Modify: `football/src/pages/players/tabs/GrowthReportTab.tsx`
- Modify: `football/src/locales/ko/player.json`
- Modify: `football/src/locales/en/player.json`
- Test: `apps/api/__test__/growth-report/growth-report.position-avg.test.ts`

**Design:** The endpoint takes `?playerId=<id>`, looks up the player's position, then aggregates `GrowthEvaluation` averages for all published evaluations of players at that position. Returns scores + sample count. Frontend shows N<3 warning.

- [x] **Step 1: Write the failing test**

Create `apps/api/__test__/growth-report/growth-report.position-avg.test.ts`:

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { GrowthReportRepository } from "../../src/growth-report/growth-report.repo";

const mockFindFirst = jest.fn();
const mockAggregate = jest.fn();
const mockCount = jest.fn();
const mockPrisma = {
  player: { findFirst: mockFindFirst },
  growthEvaluation: { aggregate: mockAggregate, count: mockCount },
} as any;

describe("GrowthReportRepository.getPositionAverage", () => {
  let repo: GrowthReportRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new GrowthReportRepository(mockPrisma);
  });

  test("returns position average scores and sample count", async () => {
    mockFindFirst.mockResolvedValue({ position: "STRIKER" });
    mockAggregate.mockResolvedValue({
      _avg: { attitudeScore: 7.5, fundamentalsScore: 6.8, spatialScore: 8.0, physicalScore: 7.2 },
    });
    mockCount.mockResolvedValue(4);

    const result = await repo.getPositionAverage("player-id-1");

    expect(result.position).toBe("STRIKER");
    expect(result.sampleCount).toBe(4);
    expect(result.avgAttitudeScore).toBe(7.5);
    expect(result.avgFundamentalsScore).toBe(6.8);
  });

  test("returns null when player not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await repo.getPositionAverage("unknown-player");
    expect(result).toBeNull();
  });

  test("returns sampleCount 0 with null averages when no evaluations exist", async () => {
    mockFindFirst.mockResolvedValue({ position: "GOALKEEPER" });
    mockAggregate.mockResolvedValue({
      _avg: { attitudeScore: null, fundamentalsScore: null, spatialScore: null, physicalScore: null },
    });
    mockCount.mockResolvedValue(0);

    const result = await repo.getPositionAverage("player-id-gk");
    expect(result!.sampleCount).toBe(0);
    expect(result!.avgAttitudeScore).toBeNull();
  });
});
```

- [x] **Step 2: Run test to confirm it fails**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="growth-report.position-avg" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — method doesn't exist.

- [x] **Step 3: Implement `getPositionAverage` in repo**

In `apps/api/src/growth-report/growth-report.repo.ts`, add method:

```typescript
async getPositionAverage(playerId: string) {
  const player = await this.prisma.player.findFirst({
    where: { id: playerId },
    select: { position: true },
  });
  if (!player) return null;

  const peerFilter = { isPublished: true, player: { position: player.position }, playerId: { not: playerId } };

  const [agg, sampleCount] = await Promise.all([
    this.prisma.growthEvaluation.aggregate({
      where: peerFilter,
      _avg: {
        attitudeScore: true,
        fundamentalsScore: true,
        spatialScore: true,
        physicalScore: true,
      },
    }),
    this.prisma.growthEvaluation.count({ where: peerFilter }),
  ]);
  // playerId excluded from peerFilter so the player is not compared against themselves.

  return {
    position: player.position,
    sampleCount,
    avgAttitudeScore: agg._avg.attitudeScore ?? null,
    avgFundamentalsScore: agg._avg.fundamentalsScore ?? null,
    avgSpatialScore: agg._avg.spatialScore ?? null,
    avgPhysicalScore: agg._avg.physicalScore ?? null,
  };
}
```

- [x] **Step 4: Run test to confirm it passes**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="growth-report.position-avg" --no-coverage 2>&1 | tail -20
```

Expected: PASS — 3 tests passing.

- [x] **Step 5: Expose via service and controller**

In `apps/api/src/growth-report/growth-report.service.ts`, add:

```typescript
getPositionAverage(playerId: string) {
  return this.repo.getPositionAverage(playerId);
}
```

In `apps/api/src/growth-report/growth-report.controller.ts`, add handler (check existing controller for the class structure):

```typescript
getPositionAverage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playerId = req.query["playerId"] as string;
    if (!playerId) throw new AppError(400, "PLAYER_ID_REQUIRED");
    const result = await this.service.getPositionAverage(playerId);
    if (!result) throw new AppError(404, "PLAYER_NOT_FOUND");
    res.status(200).json(result);
  } catch (err) { next(err); }
};
```

In `apps/api/src/growth-report/growth-report.routes.ts`, add before the existing `router.get("/player/:playerId", ...)` line (specific routes must come before parameterized ones):

```typescript
router.get("/position-average", auth, controller.getPositionAverage);
```

- [x] **Step 6: Add frontend type**

In `football/src/types/growth-report.ts`, add:

```typescript
export interface PositionAverage {
  position: string
  sampleCount: number
  avgAttitudeScore: number | null
  avgFundamentalsScore: number | null
  avgSpatialScore: number | null
  avgPhysicalScore: number | null
}
```

- [x] **Step 7: Add frontend API call**

In `football/src/services/growthReport.service.ts`, add:

```typescript
getPositionAverage: (playerId: string): Promise<PositionAverage> =>
  api.get('/growth-reports/position-average', { params: { playerId } }).then(r => r.data),
```

Also import `PositionAverage` from types if needed.

- [x] **Step 8: Add i18n keys**

In `football/src/locales/ko/player.json`, add to the `growthReport` object:

```json
"positionAvg": "포지션 평균",
"sampleInsufficient": "⚠ 샘플 부족 (N={{count}})",
"comparedToPosition": "포지션 대비"
```

In `football/src/locales/en/player.json`, add:

```json
"positionAvg": "Position Average",
"sampleInsufficient": "⚠ Insufficient sample (N={{count}})",
"comparedToPosition": "vs Position"
```

- [x] **Step 9: Update `GrowthReportTab.tsx`**

In `football/src/pages/players/tabs/GrowthReportTab.tsx`:

1. Add `PositionAverage` import from types.
2. Add state:
```typescript
const [positionAvg, setPositionAvg] = useState<PositionAverage | null>(null)
```

3. In `fetchAll()`, add the position average fetch:
```typescript
growthReportApi.getPositionAverage(playerId)
  .then(setPositionAvg)
  .catch(() => {}) // non-critical — swallow silently
```

4. After the eval fields list, add a position comparison section. Place it inside the `selected && (...)` block, after the existing `evalFields.map(...)` div:

```tsx
{positionAvg && (
  <div className="border-t pt-3 space-y-2">
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{t('growthReport.positionAvg')}</span>
      {positionAvg.sampleCount < 3 && (
        <span className="text-xs text-amber-600 font-medium">
          {t('growthReport.sampleInsufficient', { count: positionAvg.sampleCount })}
        </span>
      )}
    </div>
    {[
      { label: t('growthReport.attitude'), playerScore: selected.attitudeScore, avgScore: positionAvg.avgAttitudeScore },
      { label: t('growthReport.fundamentals'), playerScore: selected.fundamentalsScore, avgScore: positionAvg.avgFundamentalsScore },
      { label: t('growthReport.spatial'), playerScore: selected.spatialScore, avgScore: positionAvg.avgSpatialScore },
      { label: t('growthReport.physical'), playerScore: selected.physicalScore, avgScore: positionAvg.avgPhysicalScore },
    ].map(({ label, playerScore, avgScore }) => (
      <div key={label} className="flex items-center gap-2 text-xs">
        <span className="w-16 text-muted-foreground shrink-0">{label}</span>
        <span className="font-semibold w-5 text-right">{playerScore}</span>
        {avgScore != null && (
          <>
            <span className="text-muted-foreground">vs</span>
            <span className={`w-5 text-right ${positionAvg.sampleCount < 3 ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
              {avgScore.toFixed(1)}
            </span>
          </>
        )}
      </div>
    ))}
  </div>
)}
```

- [x] **Step 10: Commit**

```bash
git add apps/api/src/growth-report/ \
        apps/api/__test__/growth-report/growth-report.position-avg.test.ts \
        football/src/types/growth-report.ts \
        football/src/services/growthReport.service.ts \
        football/src/pages/players/tabs/GrowthReportTab.tsx \
        football/src/locales/ko/player.json \
        football/src/locales/en/player.json
git commit -m "feat(growth-report): add position average comparison with N<3 warning"
```

---

---

## Task 6: 위협 점수 슬라이더 UI (T2 Frontend)

**Files:**
- Modify: `football/src/pages/tactical/TacticalAnalysisPage.tsx`
- Modify: `football/src/locales/ko/match.json`
- Modify: `football/src/locales/en/match.json`
- Modify: `football/src/types/tactical.ts` — add score fields to UpdateTacticalDto
- Modify: `football/src/services/tactical.service.ts` — pass score fields in PATCH payload

**Context:** Backend (Task 1) adds three `Int?` score columns (1–10). This task wires the UI. Sliders insert after the `opponentKeyPlayer` Input (line ~361) and before the `opponentAnalysis` Textarea in the PRE_MATCH form block.

- [x] **Step 1: Add i18n keys**

`football/src/locales/ko/match.json` — inside the `tactical.form` object, after `opponentKeyPlayerLabel`:

```json
"opponentPressureScoreLabel": "압박 위협도",
"opponentSetPieceScoreLabel": "세트피스 위협도",
"opponentCounterScoreLabel": "역습 위협도",
"scoreNone": "미평가"
```

`football/src/locales/en/match.json`:

```json
"opponentPressureScoreLabel": "Pressure Threat",
"opponentSetPieceScoreLabel": "Set Piece Threat",
"opponentCounterScoreLabel": "Counter Threat",
"scoreNone": "Not rated"
```

- [x] **Step 2: Add state and DTO wiring**

In `TacticalAnalysisPage.tsx`, after the `opponentKeyPlayer` state (line ~163), add:

```typescript
const [opponentPressureScore, setOpponentPressureScore] = useState<number | null>(initial?.opponentPressureScore ?? null)
const [opponentSetPieceScore, setOpponentSetPieceScore] = useState<number | null>(initial?.opponentSetPieceScore ?? null)
const [opponentCounterScore, setOpponentCounterScore] = useState<number | null>(initial?.opponentCounterScore ?? null)
```

In `buildPreDto()`, add:

```typescript
...(opponentPressureScore !== null && { opponentPressureScore }),
...(opponentSetPieceScore !== null && { opponentSetPieceScore }),
...(opponentCounterScore !== null && { opponentCounterScore }),
```

Also reset them in the form reset block:

```typescript
setOpponentPressureScore(null)
setOpponentSetPieceScore(null)
setOpponentCounterScore(null)
```

- [x] **Step 3: Add slider JSX**

After the `opponentKeyPlayer` `</div>` block and before the `opponentAnalysis` `<div>`, add:

```tsx
{/* ── 위협 점수 슬라이더 ── */}
{[
  { label: t('tactical.form.opponentPressureScoreLabel'), value: opponentPressureScore, set: setOpponentPressureScore },
  { label: t('tactical.form.opponentSetPieceScoreLabel'), value: opponentSetPieceScore, set: setOpponentSetPieceScore },
  { label: t('tactical.form.opponentCounterScoreLabel'), value: opponentCounterScore, set: setOpponentCounterScore },
].map(({ label, value, set }) => (
  <div key={label} className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <span className="text-xs text-muted-foreground tabular-nums">
        {value !== null ? value : t('tactical.form.scoreNone')}
      </span>
    </div>
    <input
      type="range"
      min={1}
      max={10}
      step={1}
      value={value ?? 5}
      onChange={(e) => set(Number(e.target.value))}
      className="w-full accent-primary"
    />
    {value !== null && (
      <button
        type="button"
        onClick={() => set(null)}
        className="text-xs text-muted-foreground underline"
      >
        {t('tactical.form.scoreNone')}
      </button>
    )}
  </div>
))}
```

- [x] **Step 4: Update frontend type and service**

In `football/src/types/tactical.ts`, add to `UpdateTacticalDto` (or `CreateTacticalDto`):

```typescript
opponentPressureScore?: number
opponentSetPieceScore?: number
opponentCounterScore?: number
```

In `football/src/services/tactical.service.ts`, verify PATCH payload passes these fields through (they should already flow via spread if the DTO type is updated).

- [x] **Step 5: Commit**

```bash
git add football/src/pages/tactical/TacticalAnalysisPage.tsx \
        football/src/types/tactical.ts \
        football/src/services/tactical.service.ts \
        football/src/locales/ko/match.json \
        football/src/locales/en/match.json
git commit -m "feat(tactical): add opponent threat score sliders to PRE_MATCH form"
```

---

## Task 7: TacticalAnalysis 목록에 경기 스코어 표시 (T9)

**File:** `football/src/pages/tactical/TacticalAnalysisPage.tsx`

**Context:** 백엔드 `ANALYSIS_SELECT`에 `match.homeScore/awayScore` 이미 포함. 프론트 타입도 있음. 렌더링만 빠짐.

- [x] **Step 1: 스코어 인라인 표시**

`TacticalAnalysisPage.tsx` 585번 줄 match name 줄에 스코어 추가:

```tsx
<div className="text-sm">
  {a.match.homeTeamName} vs {a.match.awayTeamName}
  {a.match.homeScore != null && a.match.awayScore != null && (
    <span className="ml-2 font-mono text-muted-foreground text-xs">
      {a.match.homeScore}–{a.match.awayScore}
    </span>
  )}
</div>
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/tactical/TacticalAnalysisPage.tsx
git commit -m "feat(tactical): show match score inline on TacticalAnalysis list"
```

---

## Task 8: 세션 승인 시 평가 완성도 소프트 경고 (TR4)

**Files:**
- Modify: `apps/api/src/training/training.service.ts` — `approveSession()` 경고 계산
- Modify: `apps/api/__test__/training/training.service.test.ts` — 경고 케이스 추가

**Context:** `findById()`가 이미 `results`(attendance + performanceScore)를 로드하므로 추가 DB 쿼리 없음.

- [x] **Step 1: Write failing test**

`apps/api/__test__/training/training.service.test.ts`에 추가:

```typescript
describe("TrainingService.approveSession — eval warning", () => {
  test("returns evalWarning when present players have null performanceScore", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1, isApproved: false,
      results: [
        { attendance: "PRESENT", performanceScore: 8 },
        { attendance: "PRESENT", performanceScore: null },
        { attendance: "ABSENT",  performanceScore: null },
      ],
    });
    mockRepo.approve.mockResolvedValue({ id: 1, isApproved: true, approvedById: 99 });

    const result = await service.approveSession(1, 99) as any;
    expect(result.evalWarning).toEqual({ missing: 1, total: 2 });
  });

  test("returns no evalWarning when all present players have scores", async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1, isApproved: false,
      results: [
        { attendance: "PRESENT", performanceScore: 7 },
        { attendance: "ABSENT",  performanceScore: null },
      ],
    });
    mockRepo.approve.mockResolvedValue({ id: 1, isApproved: true, approvedById: 99 });

    const result = await service.approveSession(1, 99) as any;
    expect(result.evalWarning).toBeUndefined();
  });
});
```

- [x] **Step 2: Run test to confirm it fails**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="training.service" --no-coverage 2>&1 | tail -20
```

- [x] **Step 3: Update `approveSession` in `training.service.ts`**

```typescript
async approveSession(id: number, approvedById: number) {
  const session = await this.repo.findById(id);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND");
  if (session.isApproved) throw new AppError(409, "ALREADY_APPROVED");

  const presentResults = session.results.filter(r => r.attendance !== "ABSENT");
  const missingCount = presentResults.filter(r => r.performanceScore == null).length;

  const approved = await this.repo.approve(id, approvedById);

  if (missingCount === 0) return approved;
  return { ...approved, evalWarning: { missing: missingCount, total: presentResults.length } };
}
```

- [x] **Step 4: Run test to confirm it passes**

```bash
cd /Users/juno/work/football
npx jest --testPathPattern="training.service" --no-coverage 2>&1 | tail -20
```

- [x] **Step 5: Commit**

```bash
git add apps/api/src/training/training.service.ts \
        apps/api/__test__/training/training.service.test.ts
git commit -m "feat(training): return evalWarning on approveSession when scores are missing"
```

---

## Task 9: 훈련 부하 단위 enum 추가 (TR5)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` — `LoadUnit` enum + `TrainingLoad.loadUnit` 필드
- Create: `apps/api/prisma/migrations/20260815000002_add_training_load_unit/migration.sql`
- Modify: `apps/api/src/training-load/dto/training-load.dto.ts`
- Modify: `apps/api/src/training-load/training-load.repo.ts`

- [x] **Step 1: Add migration SQL**

Create `apps/api/prisma/migrations/20260815000002_add_training_load_unit/migration.sql`:

```sql
CREATE TYPE "LoadUnit" AS ENUM ('KG', 'MINUTES', 'DISTANCE_M', 'SETS');

ALTER TABLE "TrainingLoad"
  ADD COLUMN IF NOT EXISTS "loadUnit" "LoadUnit";
```

Run:

```bash
cd /Users/juno/work/football/apps/api
npx prisma db execute --file prisma/migrations/20260815000002_add_training_load_unit/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260815000002_add_training_load_unit
```

- [x] **Step 2: Update `schema.prisma`**

Add enum before `TrainingLoad` model:

```prisma
enum LoadUnit {
  KG
  MINUTES
  DISTANCE_M
  SETS
}
```

Add field to `TrainingLoad`:

```prisma
model TrainingLoad {
  id           Int       @id @default(autoincrement())
  playerId     String
  sessionId    Int
  rpe          Int
  load         Int?
  loadUnit     LoadUnit?
  // ... rest unchanged
}
```

Then regenerate:

```bash
cd /Users/juno/work/football/apps/api
npx prisma generate
```

- [x] **Step 3: Update DTO**

`apps/api/src/training-load/dto/training-load.dto.ts`:

```typescript
export type LoadUnit = "KG" | "MINUTES" | "DISTANCE_M" | "SETS";

export interface UpsertTrainingLoadDto {
  sessionId: number;
  rpe?: number;
  load?: number;
  loadUnit?: LoadUnit;
}
```

- [x] **Step 4: Update repo upsert**

In `apps/api/src/training-load/training-load.repo.ts`, add `loadUnit` to the upsert data block:

```typescript
data: {
  rpe: dto.rpe ?? existing?.rpe ?? 0,
  ...(dto.load !== undefined && { load: dto.load }),
  ...(dto.loadUnit !== undefined && { loadUnit: dto.loadUnit }),
  // ... rest unchanged
},
```

- [x] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations/20260815000002_add_training_load_unit/ \
        apps/api/src/training-load/dto/training-load.dto.ts \
        apps/api/src/training-load/training-load.repo.ts
git commit -m "feat(training): add LoadUnit enum to TrainingLoad for explicit unit tracking"
```

---

## Self-Review

### Spec coverage check

| Decision | Task | Status |
|----------|------|--------|
| T2: opponentPressureScore / SetPiece / Counter on TacticalAnalysis | Task 1 | ✅ |
| T5: FormationSnapshot model (matchId, minute, formation, changeReason) | Task 2 | ✅ |
| T6: FormationSnapshot frontend comparison card in MatchDetailPage | Task 3 | ✅ |
| TR2: 훈련 평가 입력률 KPI on HEAD_COACH dashboard | Task 4 | ✅ |
| TR8: GrowthEvaluation position average with N<3 warning | Task 5 | ✅ |
| T2 Frontend: 위협 점수 슬라이더 UI (PRE_MATCH 폼) | Task 6 | ✅ |
| T9: TacticalAnalysis 목록에 경기 스코어 표시 | Task 7 | ✅ |
| T1: TacticalAnalysis endpoint (already exists — no-op) | — | N/A |
| T3: Match.momPlayerId (already exists — no-op) | — | N/A |
| T4: No auto-rearrange on formation change (no-op) | — | N/A |
| T7: Lineup/tactical timing independent (no-op) | — | N/A |
| TR4: 세션 승인 시 평가 완성도 소프트 경고 | Task 8 | ✅ |
| TR5: LoadUnit enum 추가 (KG/MINUTES/DISTANCE_M/SETS) | Task 9 | ✅ |
| T10: LineupSlot.slotKey vs TacticalLineup.position type mismatch (no cross-query exists — no-op) | — | N/A |
| TR1: rehabLoadPercentage (done in Megan plan) | — | N/A |
| TR3: Lateness definition (coaching staff discretion — no-op) | — | N/A |
| TR6: IncidentReport.sessionId (already exists — no-op) | — | N/A |
| TR10: TACTICAL_ANALYST check (already exists — no-op) | — | N/A |

### Type consistency check

- `opponentPressureScore`, `opponentSetPieceScore`, `opponentCounterScore` — `Int?` schema (CHECK 1–10), `number?` DTO, `number | undefined` repo update, `number | null` frontend state — consistent.
- `FormationSnapshot.minute` — nullable Int in schema, `number | null` in frontend type — consistent.
- `FormationSnapshot` DELETE — `remove(id)` on repo/service/controller, `api.delete(...)` on frontend service, `onRemoved(id)` prop filters by id — consistent.
- `PositionAverage` — excludes `playerId` from peer filter (grill Q4); `avgAttitudeScore: number | null` in both backend and frontend — consistent.
- `trainingEvalEntryRate` — denominator = `TrainingResult` where `attendance != ABSENT` (grill Q3); `number` repo return, `number` `HeadCoachStats` frontend type — consistent.
- `LoadUnit` — enum `KG | MINUTES | DISTANCE_M | SETS` in schema, mirrored as union type in DTO — consistent.
- `approveSession` return — `{ ...approved, evalWarning?: { missing: number, total: number } }` (grill Q8); no frontend type change needed (optional field, toast display only) — consistent.

### Placeholder scan

- No TBDs or TODOs found.
- No "similar to Task N" references.
- All code blocks are complete.

---

## Verification Report (2026-08-16)

**Verdict: PASS** (2 bugs caught and fixed during runtime verification)

### 검증 결과

| Item | 검증 방법 | 결과 |
|------|----------|------|
| ThreatScore PATCH + CHECK constraint | `PATCH /api/tactical/9` score=8 → 반환 확인; score=11 → DB 거부(500) | ✅ |
| ThreatScore null clear | `{opponentPressureScore: null}` → 정상 반환 | ✅ |
| FormationSnapshot POST | `{id:1, minute:67, formation:"3-5-2"}` | ✅ |
| FormationSnapshot DELETE | HTTP 204, GET 후 `[]` | ✅ |
| `trainingEvalEntryRate` 런타임 | HEAD_COACH `/api/dashboard/stats` → `trainingEvalEntryRate: 0` (이달 세션 없음) | ✅ (fix 후) |
| `approveSession` evalWarning | PRESENT×2 + ABSENT_AUTHORIZED×1 → `{missing:1, total:2}`; 전원 득점 시 경고 없음 | ✅ (fix 후) |
| Growth report self-exclusion | `peerFilter` 코드 확인 (라인 83), seed에 비교 데이터 없어 sampleCount:0 | ✅ |
| LoadUnit enum | Prisma 쿼리 로그에 `loadUnit:"KG"` 파싱 확인, migration SQL + schema 확인 | ✅ |

### 런타임 검증 중 발견·수정된 버그

| # | 파일 | 문제 | 수정 |
|---|------|------|------|
| 1 | `dashboard.repo.ts` | `attendance: { not: "ABSENT" }` — `AttendanceStatus`에 `"ABSENT"` 없음 → 500 크래시 | `notIn: ["ABSENT_AUTHORIZED","ABSENT_UNAUTHORIZED"]` |
| 2 | `training.service.ts` | `approveSession()` 동일 문제 — evalWarning 분모·분자 모두 잘못 집계 | `!== "ABSENT_AUTHORIZED" && !== "ABSENT_UNAUTHORIZED"` |

### PR

[#284 feat(tactical+training): 이영표+Kane 페르소나 갭 해소](https://github.com/JunoLee1/--API/pull/284)

커밋: `1a3a5c12` (dashboard enum fix) · `b3897e71` (training service fix)
